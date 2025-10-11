// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

// --- ENV ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!STRIPE_SECRET_KEY) console.warn("[webhook] Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) console.warn("[webhook] Missing STRIPE_WEBHOOK_SECRET");
if (!DATABASE_URL) console.warn("[webhook] Missing DATABASE_URL");

// --- Stripe client ---
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// --- Postgres pool (Neon) ---
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Save order helper (columns must match your table)
async function saveOrder(params: {
  email: string | null;
  plan_key: string | null;
  preview_id: string | null;
  stripe_session_id: string;
  status: string;
}) {
  const { email, plan_key, preview_id, stripe_session_id, status } = params;

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

// Health check (useful in browser)
export async function GET() {
  return Response.json({ ok: true, method: "GET" });
}

// Webhook handler
export async function POST(req: NextRequest) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return new Response("Webhook secret not set", { status: 500 });
  }

  let event: Stripe.Event;

  // Stripe requires the raw body for signature verification
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });

    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[webhook] constructEvent error:", err?.message || err);
    return new Response(`Webhook Error: ${err?.message ?? "invalid payload"}`, {
      status: 400,
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Email resolution (prefer customer_details)
      const email =
        session.customer_details?.email ||
        (typeof session.customer === "string" ? null : session.customer?.email) ||
        (session.customer_email as string | null) ||
        null;

      // --- Tolerant metadata reads (snake_case OR camelCase) ---
      const plan_key =
        (session.metadata?.plan_key as string | undefined) ??
        (session.metadata?.planKey as string | undefined) ??
        null;

      const preview_id =
        (session.metadata?.preview_id as string | undefined) ??
        (session.metadata?.previewId as string | undefined) ??
        null;

      const stripe_session_id = session.id;
      const status =
        (session.payment_status as string) ||
        (session.status as string) ||
        "paid";

      // Save to DB (log but don't 500 on failure so Stripe won’t retry forever)
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
          orderId ?? "(duplicate/ON CONFLICT)",
          { email, plan_key, preview_id, stripe_session_id, status }
        );
      } catch (e) {
        console.error("[webhook] saveOrder failed:", e);
      }
    }

    // Always acknowledge receipt to Stripe
    return Response.json({ received: true });
  } catch (err: any) {
    console.error("[webhook] handler error:", err?.message || err, {
      type: event?.type,
      id: event?.id,
    });
    // Acknowledge anyway; keep error in logs
    return Response.json({ received: true, noted: true }, { status: 200 });
  }
}
