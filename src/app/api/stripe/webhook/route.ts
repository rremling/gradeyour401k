// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
// Ensure Node runtime for 'pg'
export const runtime = "nodejs";

// --- ENV ---
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const ORDER_EMAIL_TO = process.env.ORDER_EMAIL_TO || "";
const ORDER_EMAIL_FROM = process.env.ORDER_EMAIL_FROM || "";

if (!STRIPE_SECRET_KEY) console.warn("[webhook] Missing STRIPE_SECRET_KEY");
if (!STRIPE_WEBHOOK_SECRET) console.warn("[webhook] Missing STRIPE_WEBHOOK_SECRET");
if (!DATABASE_URL) console.warn("[webhook] Missing DATABASE_URL");
if (!RESEND_API_KEY) console.warn("[webhook] Missing RESEND_API_KEY");
if (!ORDER_EMAIL_TO) console.warn("[webhook] Missing ORDER_EMAIL_TO");
if (!ORDER_EMAIL_FROM) console.warn("[webhook] Missing ORDER_EMAIL_FROM");

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

// Email helper (Resend)
async function sendOrderEmail(opts: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!RESEND_API_KEY || !opts.to || !opts.from) {
    console.warn("[webhook] Email not sent (missing config)", {
      hasKey: !!RESEND_API_KEY,
      to: opts.to,
      from: opts.from,
    });
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
        from: opts.from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html ?? undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      console.error("[webhook] Resend API error", res.status, body);
    } else {
      console.log("[webhook] order email sent");
    }
  } catch (err) {
    console.error("[webhook] Email send failed:", err);
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

      // --- Gather more context (line items) ---
      let lineItems: Stripe.ApiList<Stripe.LineItem> | null = null;
      try {
        lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
      } catch (e) {
        console.warn("[webhook] listLineItems failed:", e);
      }

      // Amount/currency helpers
      const amt =
        typeof session.amount_total === "number"
          ? (session.amount_total / 100).toFixed(2)
          : "—";
      const cur = (session.currency || "").toUpperCase();

      // Build a concise, human-readable outline
      const createdIso = session.created
        ? new Date(session.created * 1000).toISOString()
        : new Date().toISOString();

      const liText =
        lineItems?.data?.length
          ? lineItems.data
              .map((li) => {
                const unit = (li.price?.unit_amount ?? 0) / 100;
                const lc = (li.price?.currency || cur || "").toUpperCase();
                return `• ${li.description || li.price?.nickname || li.price?.id || "Item"} × ${li.quantity ?? 1} @ ${unit.toFixed(2)} ${lc}`;
              })
              .join("\n")
          : "• (No line items retrieved)";

      const subject = `New order: ${plan_key ?? "unknown plan"} · ${amt} ${cur} · ${email ?? "no-email"}`;

      const textBody = `New Stripe order received

Time: ${createdIso}
Status: ${status}

Customer Email: ${email ?? "(none)"}
Plan Key: ${plan_key ?? "(none)"}
Preview ID: ${preview_id ?? "(none)"}
Session ID: ${stripe_session_id}

Amount: ${amt} ${cur}

Line Items:
${liText}

Payment Intent: ${
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? "(none)"
      }
Mode: ${session.mode ?? "(none)"}
`;

      // Fire-and-forget (don't block Stripe ack if email fails)
      sendOrderEmail({
        to: ORDER_EMAIL_TO,
        from: ORDER_EMAIL_FROM,
        subject,
        text: textBody,
        html: textBody.replace(/\n/g, "<br>"),
      }).catch(() => {
        /* logged inside helper */
      });
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
