// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- ENV ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ORDER_EMAIL_TO = process.env.ORDER_EMAIL_TO || "";
const ORDER_EMAIL_FROM = process.env.ORDER_EMAIL_FROM || "";
const NEXT_PUBLIC_BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

if (!STRIPE_SECRET_KEY) console.warn("[webhook] Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) console.warn("[webhook] Missing STRIPE_WEBHOOK_SECRET");
if (!DATABASE_URL) console.warn("[webhook] Missing DATABASE_URL");
if (!RESEND_API_KEY) console.warn("[webhook] Missing RESEND_API_KEY");
if (!ORDER_EMAIL_TO) console.warn("[webhook] Missing ORDER_EMAIL_TO");
if (!ORDER_EMAIL_FROM) console.warn("[webhook] Missing ORDER_EMAIL_FROM");

// --- Clients ---
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// --- Utils ---
function getBaseUrl(req: Request) {
  if (NEXT_PUBLIC_BASE_URL) return NEXT_PUBLIC_BASE_URL;
  const host = process.env.VERCEL_URL;
  return host ? `https://${host.replace(/\/+$/, "")}` : "http://localhost:3000";
}

// Create table (idempotent) and UPSERT order row
async function upsertOrder(params: {
  email: string | null;
  plan_key: string | null;
  preview_id: string | null;
  stripe_session_id: string;
  amount_total: number | null;
  payment_status: string | null;
}) {
  const { email, plan_key, preview_id, stripe_session_id, amount_total, payment_status } = params;

  // Ensure table exists and has the columns we use
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.orders (
      id BIGSERIAL PRIMARY KEY,
      stripe_session_id TEXT UNIQUE NOT NULL,
      email TEXT,
      plan_key TEXT,
      preview_id TEXT,
      amount_total BIGINT,
      payment_status TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const sql = `
    INSERT INTO public.orders
      (stripe_session_id, email, plan_key, preview_id, amount_total, payment_status)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (stripe_session_id) DO UPDATE
      SET email = EXCLUDED.email,
          plan_key = EXCLUDED.plan_key,
          preview_id = EXCLUDED.preview_id,
          amount_total = EXCLUDED.amount_total,
          payment_status = EXCLUDED.payment_status
    RETURNING id
  `;
  const values = [
    stripe_session_id,
    email,
    plan_key,
    preview_id,
    amount_total,
    payment_status,
  ];
  const res = await pool.query(sql, values);
  return res.rows?.[0]?.id ?? null;
}

// Admin email via Resend
async function sendAdminEmail(opts: { subject: string; text: string; html?: string }) {
  if (!RESEND_API_KEY || !ORDER_EMAIL_TO || !ORDER_EMAIL_FROM) {
    console.warn("[webhook] Admin email not sent (missing config)");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ORDER_EMAIL_FROM,
        to: ORDER_EMAIL_TO,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? opts.text.replace(/\n/g, "<br>"),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error("[webhook] Resend API error", res.status, body);
    } else {
      console.log("[webhook] admin email sent");
    }
  } catch (err) {
    console.error("[webhook] Admin email send failed:", err);
  }
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

  // 1) Verify signature with RAW body
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("Missing stripe-signature", { status: 400 });
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[webhook] constructEvent error:", err?.message || err);
    return new Response(`Webhook Error: ${err?.message ?? "invalid payload"}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const paid = session.payment_status === "paid" || (session.amount_total ?? 0) === 0;
      if (!paid) {
        console.log("[webhook] session not paid/zero, skipping save", session.id);
        return Response.json({ received: true });
      }

      // Pull metadata (your /api/checkout sets plan_key + optional preview_id)
      const plan_key =
        (session.metadata?.plan_key as string | undefined) ??
        (session.metadata?.planKey as string | undefined) ??
        null;

      const preview_id =
        (session.metadata?.preview_id as string | undefined) ??
        (session.metadata?.previewId as string | undefined) ??
        null;

      const email =
        session.customer_details?.email ||
        (session.customer_email as string | null) ||
        null;

      const amount_total = typeof session.amount_total === "number" ? session.amount_total : null;
      const payment_status = session.payment_status ?? null;
      const stripe_session_id = session.id;

      // 2) UPSERT the order in Neon
      try {
        const orderId = await upsertOrder({
          email,
          plan_key,
          preview_id,
          stripe_session_id,
          amount_total,
          payment_status,
        });
        console.log("[webhook] upserted order id:", orderId, {
          email,
          plan_key,
          preview_id,
          stripe_session_id,
          amount_total,
          payment_status,
        });
      } catch (e) {
        console.error("[webhook] upsertOrder failed:", e);
      }

      // 3) (Optional) trigger your report email for non-review plans
      if (plan_key && plan_key !== "review") {
        try {
          const base = getBaseUrl(req);
          const r = await fetch(`${base}/api/report/generate-and-email`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId: session.id }),
          });
          if (!r.ok) {
            const txt = await r.text().catch(() => "");
            throw new Error(`report route ${r.status}: ${txt || r.statusText}`);
          }
        } catch (e: any) {
          // Log, but still ACK so Stripe retries the webhook on its own schedule
          console.error("[webhook] report email trigger failed:", e?.message || e);
        }
      }

      // 4) Send you a quick admin email (fire-and-forget)
      const cur = (session.currency || "").toUpperCase();
      const amt = amount_total !== null ? (amount_total / 100).toFixed(2) : "—";
      const subject = `New order: ${plan_key ?? "unknown"} · ${amt} ${cur} · ${email ?? "no-email"}`;
      const text = `New Stripe order
Plan: ${plan_key ?? "(none)"}
Preview: ${preview_id ?? "(none)"}
Email: ${email ?? "(none)"}
Amount: ${amt} ${cur}
Session: ${stripe_session_id}
Status: ${payment_status ?? "(none)"}`
      sendAdminEmail({ subject, text }).catch(() => {});
    }

    // Always ack so Stripe stops pushing this event (retries happen only on 4xx/5xx)
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
