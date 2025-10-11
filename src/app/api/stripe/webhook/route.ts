// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db"; // relative to this file

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

/**
 * Build Stripe event from raw body + signature.
 * App Router: use req.text() to get the raw payload.
 */
async function getStripeEvent(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) throw new Error("Missing Stripe-Signature header");

  const rawBody = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

  return stripe.webhooks.constructEvent(rawBody, sig, secret);
}

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    event = await getStripeEvent(req);
  } catch (err: any) {
    console.error("[webhook] signature/parse failed:", err?.message || err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // Only handle completed checkout
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;

    const stripe_session_id = session.id;
    const email =
      session.customer_details?.email ||
      (typeof session.customer === "string" ? undefined : undefined) ||
      null;

    // Where we expect the app to put these:
    const plan_key = session.metadata?.plan_key || null;      // "one_time" | "annual"
    const preview_id = session.metadata?.preview_id || null;  // saved grade id

    // If any are missing, try to rescue from line items or price metadata (optional)
    // (Keep simple for now; most setups store metadata on the session.)
    const status = "paid";

    // Validate the required bits for your schema
    if (!stripe_session_id) {
      console.error("[webhook] missing session.id");
      return NextResponse.json({ error: "missing session_id" }, { status: 400 });
    }
    if (!plan_key) {
      console.error("[webhook] missing metadata.plan_key");
      return NextResponse.json({ error: "missing plan_key" }, { status: 400 });
    }
    if (!preview_id) {
      console.error("[webhook] missing metadata.preview_id");
      return NextResponse.json({ error: "missing preview_id" }, { status: 400 });
    }
    if (!email) {
      console.error("[webhook] missing destination email");
      return NextResponse.json({ error: "missing email" }, { status: 400 });
    }

    // Insert order row. If already inserted (rare retries), update it.
    try {
      await sql(
        `INSERT INTO public.orders (email, plan_key, status, preview_id, stripe_session_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, plan_key, status, preview_id, stripe_session_id]
      );
    } catch (e: any) {
      // If duplicate on stripe_session_id, try update instead.
      // (Add a unique index on stripe_session_id to make this deterministic.)
      const msg = String(e?.message || "");
      if (msg.includes("duplicate key") || msg.includes("already exists")) {
        await sql(
          `UPDATE public.orders
             SET email = $1, plan_key = $2, status = $3, preview_id = $4
           WHERE stripe_session_id = $5`,
          [email, plan_key, status, preview_id, stripe_session_id]
        );
      } else {
        console.error("[webhook] insert failed:", e);
        return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[webhook] saveOrder failed:", err);
    return NextResponse.json(
      { error: err?.message || "webhook processing error" },
      { status: 500 }
    );
  }
}

// allow GET health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/stripe/webhook" });
}
