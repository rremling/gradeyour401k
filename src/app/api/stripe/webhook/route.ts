// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db"; // <-- adjust if your db helper lives elsewhere

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook config" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text(); // IMPORTANT: use raw body for signature verification
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  // We only care about completed sessions
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // --- Pull the metadata you set at checkout ---
  const meta = (session.metadata || {}) as Record<string, string | undefined>;
  const plan_key = (meta.plan_key || "").trim(); // "one_time" | "annual"
  const preview_id = (meta.preview_id || "").trim(); // UUID from your preview save step

  // Email from Stripe’s session
  const email =
    session.customer_details?.email ||
    (typeof session.customer_email === "string" ? session.customer_email : "") ||
    "";

  // Basic validation: we need email, plan_key, preview_id
  if (!email || !plan_key || !preview_id) {
    return NextResponse.json(
      { error: "Missing email, plan_key, or preview_id" },
      { status: 400 }
    );
  }

  const stripe_session_id = session.id;
  const status = "paid";

  // Next due only for annual
  const next_due_1 =
    plan_key === "annual" ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 90) : null; // ~90 days

  try {
    // IMPORTANT: match your column names exactly
    await sql(
      `
      INSERT INTO public.orders
        (email, plan_key, status, preview_id, stripe_session_id, create_at, next_due_1)
      VALUES
        ($1, $2, $3, $4, $5, NOW(), $6)
      ON CONFLICT DO NOTHING
      `,
      [email, plan_key, status, preview_id, stripe_session_id, next_due_1]
    );
  } catch (e: any) {
    // Bubble up details in logs for quick diagnosis
    console.error("[webhook] saveOrder failed:", e);
    return NextResponse.json({ error: "DB insert failed" }, { status: 500 });
  }

  // Fire-and-forget: generate & email the report
  // (Make sure this route exists and reads preview_id to build the PDF + send via Resend)
  try {
    const site = process.env.SITE_URL || "https://www.gradeyour401k.com";
    await fetch(`${site}/api/report/generate-and-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
      body: JSON.stringify({ previewId: preview_id, email }),
      // don’t await the response body; just kick it off
    });
  } catch (e) {
    // If email fails, you still want a 200 OK so Stripe stops retrying.
    console.warn("[webhook] generate-and-email kickoff failed:", e);
  }

  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}
