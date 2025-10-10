import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless"; // serverless Postgres client

export const runtime = "nodejs";            // Stripe needs raw body; don't use edge
export const dynamic = "force-dynamic";     // avoid static optimization

const stripe = new Stripe(process.env.STRIPE_API_KEY!, {
  apiVersion: "2024-06-20",
});
const sql = neon(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  try {
    // Stripe signature verification requires the raw text body
    const sig = req.headers.get("stripe-signature") as string;
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    // Signature verification failed
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: skip if we've seen this event
  try {
    const existing = await sql/*sql*/`
      SELECT 1 FROM stripe_webhook_events WHERE id = ${event.id} LIMIT 1
    `;
    if (existing.length > 0) {
      return NextResponse.json({ received: true, deduped: true });
    }
  } catch (e) {
    console.error("DB check error", e);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // Persist event first (so retries won’t double-handle)
  try {
    await sql/*sql*/`
      INSERT INTO stripe_webhook_events (id, type, payload)
      VALUES (${event.id}, ${event.type}, ${JSON.stringify(event)})
    `;
  } catch (e) {
    // Unique constraint violation means we already processed
    return NextResponse.json({ received: true, deduped: true });
  }

  try {
    switch (event.type) {
      // If you use Stripe Checkout:
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Optionally fetch line items snapshot
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          limit: 100,
        });

        await sql/*sql*/`
          INSERT INTO orders (id, customer_email, amount_total_cents, currency, status, metadata, line_items)
          VALUES (
            ${session.id},
            ${session.customer_details?.email ?? null},
            ${session.amount_total ?? 0},
            ${session.currency ?? "usd"},
            ${session.payment_status ?? "unpaid"},
            ${session.metadata ? JSON.stringify(session.metadata) : null},
            ${JSON.stringify(lineItems.data)}
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

      // If you charge with Payment Intents directly:
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

      // Add any other events you care about:
      // - payment_intent.payment_failed
      // - charge.refunded
      // - checkout.session.async_payment_succeeded / failed
      default:
        // No-op for events we don’t handle, but they’re stored in stripe_webhook_events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Handler error", err);
    // Return 500 so Stripe will retry per its retry schedule
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}
