// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Pool } from "pg";

// Ensure we always run on the server
export const dynamic = "force-dynamic";

// --- ENV ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!STRIPE_SECRET_KEY) {
  console.warn("[webhook] Missing STRIPE_SECRET_KEY");
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn("[webhook] Missing STRIPE_WEBHOOK_SECRET");
}
if (!DATABASE_URL) {
  console.warn("[webhook] Missing DATABASE_URL");
}

// --- Stripe client ---
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

// --- Postgres pool (Neon) ---
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Most Neon connection strings already require SSL; force it if needed:
  ssl: { rejectUnauthorized: false },
});

// Simple helper to insert an order row
async function saveOrder(params: {
  email: string | null;
  plan_key: string | null;
  preview_id: string | null;
  stripe_session_id: string;
  status: string;
}) {
  // Normalize values
  const email = params.email || null;
  const plan_key = params.plan_key || null;
  const preview_id = params.preview_id || null;
  const stripe_session_id = params.stripe_session_id;
  const status = params.status;

  // IMPORTANT: column names match your table exactly:
  // id (serial/uuid), email, plan_key, status, preview_id,
  // stripe_session_id, created_at (timestamptz default now), next_due_1 (nullable)
  const sql = `
    INSERT INTO public.orders
      (email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1)
    VALUES
      ($1, $2, $3, $4, $5, NOW(), NULL)
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING id
  `;
  const values = [email, plan_key, status, preview_id, stripe_session_id];
  const res = await pool.query(sql, values);
  return res.rows?.[0]?.id ?? null;
}

// Optional: GET is handy for quick health checks in the browser
export async function GET() {
  return Response.json({ ok: true, method: "GET" });
}

// Stripe sends POST webhooks with a raw body we must verify
export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook secret not set", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    // Get the raw body **as text** to construct the event
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      return new Response("Missing stripe-signature", { status: 400 });
    }

    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[webhook] constructEvent error:", err?.message || err);
    return new Response(`Webhook Error: ${err?.message ?? "invalid payload"}`, {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Pull email — prefer customer_details if present
        const email =
          session.customer_details?.email ||
          (typeof session.customer === "string"
            ? null
            : session.customer?.email) ||
          (session.customer_email as string | null) ||
          null;

        // Pull metadata set when creating the Checkout Session in /api/checkout
        const plan_key =
          (session.metadata?.plan_key as string | undefined) ?? null;
        const preview_id =
          (session.metadata?.preview_id as string | undefined) ?? null;

        const stripe_session_id = session.id;
        const status =
          (session.payment_status as string) ||
          (session.status as string) ||
          "paid";

        // Save into orders table
        try {
          const orderId = await saveOrder({
            email,
            plan_key,
            preview_id,
            stripe_session_id,
            status,
          });

          console.log(
            "[webhook] saved order:",
            orderId ?? "(already existed via ON CONFLICT?)",
            { email, plan_key, preview_id, stripe_session_id, status }
          );
        } catch (e) {
          console.error("[webhook] saveOrder failed:", e);
          // Do not throw a 500 for DB issues; acknowledge to avoid endless retries.
          // Log thoroughly and fix DB separately.
        }

        break;
      }

      default: {
        // Ignore other events
        break;
      }
    }

    // Always acknowledge receipt
    return Response.json({ received: true });
  } catch (err: any) {
    console.error("[webhook] handler error:", err?.message || err, {
      type: event?.type,
      id: event?.id,
    });
    // Acknowledge anyway to prevent Stripe retry storms; keep errors in logs.
    return Response.json({ received: true, noted: true }, { status: 200 });
  }
}
