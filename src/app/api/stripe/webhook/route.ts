// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db"; // your db helper

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  let event: Stripe.Event;

  const sig = req.headers.get("stripe-signature") || "";
  const rawBody = await req.text();

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Pull metadata
    const planKey = (session.metadata?.planKey || "").trim();
    const previewId = (session.metadata?.previewId || "").trim();

    // Basic guards
    if (!planKey || !previewId) {
      // Log and 200 (so Stripe stops retrying, but you can fix data later)
      console.error("[webhook] missing planKey/previewId in metadata", session.id, session.metadata);
      return NextResponse.json({ ok: true, note: "missing-metadata" });
    }

    // Try to get email from session/customer_details
    const email =
      session.customer_details?.email ||
      (typeof session.customer === "string" ? undefined : session.customer?.email) ||
      session.customer_email ||
      null;

    // Persist order
    try {
      await sql(
        `
          INSERT INTO orders
            (session_id, email, plan_key, preview_id, amount_total_cents, currency, status, created_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (session_id) DO NOTHING
        `,
        [
          session.id,
          email,
          planKey, // <- THIS is the not-null column
          previewId,
          session.amount_total ?? 0,
          session.currency ?? "usd",
          session.payment_status ?? "unknown",
        ]
      );
    } catch (err) {
      console.error("[webhook] saveOrder failed:", err);
      // still return 200 so Stripe doesn’t keep retrying forever
    }

    // (Optional) kick off your PDF generation/email if you want here
    // ... or let /api/stripe/success page do the resend button
  }

  return NextResponse.json({ ok: true });
}
