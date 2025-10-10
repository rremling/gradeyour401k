// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// Important: DO NOT call req.json(). Stripe needs the raw body.
export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2024-06-20",
  });

  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    console.error("[webhook] missing signature or secret");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err: any) {
    console.error("[webhook] constructEvent failed:", err?.message);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Pull common fields
      const session_id = session.id;
      const payment_intent = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id || null;
      const email =
        session.customer_details?.email ||
        (typeof session.customer === "string" ? null : session.customer?.email) ||
        session.metadata?.email ||
        null;
      const amount_total = session.amount_total ?? null; // in cents
      const currency = session.currency ?? null;
      const mode = session.mode ?? null; // 'payment' | 'subscription'
      const plan = session.metadata?.plan || null; // you set this when creating the session
      const preview_id = session.metadata?.previewId || null;

      console.log("[webhook] session completed:", {
        session_id,
        email,
        amount_total,
        currency,
        mode,
        plan,
        preview_id,
      });

      // Insert order
      try {
        await sql(
          `INSERT INTO public.orders
             (email, session_id, payment_intent, amount, currency, mode, plan, preview_id, raw)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (session_id) DO NOTHING`,
          [
            email,
            session_id,
            payment_intent,
            amount_total,
            currency,
            mode,
            plan,
            preview_id,
            event as any, // raw JSON
          ]
        );
        console.log("[webhook] order saved OK");
      } catch (dbErr: any) {
        console.error("[webhook] saveOrder failed:", dbErr);
      }

      // You can trigger your generate-and-email here if desired
      // await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/report/generate-and-email`, { ... })
    } else {
      // Other events are ignored but acknowledged
      // console.log("[webhook] ignored:", event.type);
    }
  } catch (err: any) {
    console.error("[webhook] handler error:", err?.message);
  }

  // Always 200 so Stripe stops retrying
  return NextResponse.json({ received: true }, { status: 200 });
}

// Stripe sends GET pings sometimes; OK to 200 them
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}
