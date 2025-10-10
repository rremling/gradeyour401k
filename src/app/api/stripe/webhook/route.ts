import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe() {
  const key = process.env.STRIPE_API_KEY;
  if (!key) {
    // Throwing here is fine at request time, but won't crash the build
    throw new Error("Missing STRIPE_API_KEY");
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing DATABASE_URL");
  }
  return neon(url);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const sql = getSql();

  // Verify signature from raw body
  let event: Stripe.Event;
  try {
    const sig = req.headers.get("stripe-signature") as string;
    const rawBody = await req.text();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: skip if already seen
  const exists = await sql/*sql*/`
    SELECT 1 FROM stripe_webhook_events WHERE id = ${event.id} LIMIT 1
  `;
  if (exists.length > 0) {
    return NextResponse.json({ received: true, deduped: true });
  }

  // Persist the raw event
  await sql/*sql*/`
    INSERT INTO stripe_webhook_events (id, type, payload)
    VALUES (${event.id}, ${event.type}, ${JSON.stringify(event)})
  `;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });

        await sql/*sql*/`
          INSERT INTO orders (id, customer_email, amount_total_cents, currency, status, metadata, line_items)
          VALUES (
            ${session.id},
            ${session.customer_details?.email ?? null},
            ${session.amount_total ?? 0},
            ${session.currency ?? "usd"},
            ${session.payment_status ?? "unpaid"},
            ${session.metadata ? JSON.stringify(session.metadata) : null},
            ${JSON.stringify(items.data)}
          )
          ON CONFLICT (id) DO UPDATE SET
            customer_email = EXCLUDED.customer_email,
            amount_total_cents = EXCLUDED.amount_total_cents,
            currency = EXCLUDED.currency,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata,
            line_items = EXCLUDED.line_items
        `;
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const email =
          typeof pi.charges?.data?.[0]?.billing_details?.email === "string"
            ? pi.charges.data[0].billing_details.email
            : null;

        await sql/*sql*/`
          INSERT INTO orders (id, customer_email, amount_total_cents, currency, status, metadata, line_items)
          VALUES (
            ${pi.id},
            ${email},
            ${pi.amount_received ?? pi.amount ?? 0},
            ${pi.currency ?? "usd"},
            ${pi.status},
            ${pi.metadata ? JSON.stringify(pi.metadata) : null},
            ${null}
          )
          ON CONFLICT (id) DO UPDATE SET
            customer_email = EXCLUDED.customer_email,
            amount_total_cents = EXCLUDED.amount_total_cents,
            currency = EXCLUDED.currency,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata
        `;
        break;
      }
      default:
        // no-op
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
