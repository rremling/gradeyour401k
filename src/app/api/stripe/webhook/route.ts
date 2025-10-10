// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../lib/db"; // adjust if your db helper is elsewhere

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // --- Handle checkout.session.completed ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const sessionId = session.id;
    const planKey = session.metadata?.planKey || null;
    const previewId = session.metadata?.previewId || null;
    const email =
      session.customer_details?.email ||
      (typeof session.customer === "object" ? session.customer?.email : null) ||
      null;
    const amount = session.amount_total ?? null;
    const currency = session.currency ?? null;
    const status = session.payment_status ?? session.status ?? null;

    try {
      await sql(
        `INSERT INTO public.orders
         (session_id, plan_key, preview_id, email, amount_total, currency, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, planKey, previewId, email, amount, currency, status]
      );

      console.log(`[webhook] ✅ Order saved: ${sessionId}`);
    } catch (err: any) {
      console.error("[webhook] saveOrder failed:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  } else {
    console.log(`[webhook] Ignored event: ${event.type}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
