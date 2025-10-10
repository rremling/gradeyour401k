// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db"; // <-- adjust only if your db.ts path differs

// Ensure Node runtime (not edge) so we can read the raw body for Stripe signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Stripe requires the exact raw request body to validate the signature.
 * We therefore read req.text() instead of req.json().
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[webhook] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  let rawBody: string;

  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Unable to read body" }, { status: 400 });
  }

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err?.message);
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  // Handle only checkout.session.completed for now
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Prefer explicit metadata set at session creation
    const meta = session.metadata ?? {};
    const planKey =
      (meta.planKey as string) ||
      (meta.plan_key as string) ||
      // sensible fallback by mode if metadata is missing
      (session.mode === "subscription" ? "annual" : "one_time");

    const previewId =
      (meta.previewId as string) || (meta.preview_id as string) || null;

    const email =
      session.customer_details?.email ||
      (typeof session.customer === "string" ? session.customer : null);

    const amountTotal = session.amount_total ?? null;
    const currency = session.currency ?? null;

    // Best-effort coupon/promo reference (may be null for most one-time checkouts)
    // If you pass a specific Promotion Code when creating the session,
    // you can also store that id in metadata and read it here.
    const couponId =
      session.total_details?.discounts?.[0]?.discount?.coupon?.id ?? null;

    // Basic validation before inserting
    if (!planKey) {
      console.error("[webhook] Missing planKey/plan_key in metadata");
      return NextResponse.json({ error: "Missing planKey" }, { status: 400 });
    }
    if (!email) {
      console.error("[webhook] Missing customer email on session", session.id);
      // We continue inserting the order without email, or you can return 400 to retry later.
      // return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    try {
      // Adjust column names below if your schema differs.
      // Expected table definition (example):
      // CREATE TABLE public.orders (
      // id bigserial primary key,
      // session_id text unique not null,
      // email text,
      // plan_key text not null,
      // preview_id text,
      // amount_total bigint,
      // currency text,
      // coupon_id text,
      // created_at timestamptz default now()
      // );
      await sql`
        INSERT INTO public.orders
          (session_id, email, plan_key, preview_id, amount_total, currency, coupon_id)
        VALUES
          (${session.id}, ${email}, ${planKey}, ${previewId}, ${amountTotal}, ${currency}, ${couponId})
        ON CONFLICT (session_id) DO NOTHING
      `;

      console.log("[webhook] order saved:", {
        session_id: session.id,
        email,
        planKey,
        previewId,
        amountTotal,
        currency,
        couponId,
      });
    } catch (err) {
      console.error("[webhook] saveOrder failed:", err);
      // Return 200 so Stripe doesn't retry forever if it's a schema mismatch;
      // change to 500 if you want automatic Stripe retries while you fix DB.
      return NextResponse.json({ received: true, warn: "DB insert failed" }, { status: 200 });
    }
  } else {
    // For visibility, log other events but do nothing
    console.log("[webhook] Ignored event:", event.type);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// Optional: quick GET to prove the route is reachable in a browser
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}
