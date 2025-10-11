// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db"; // <-- keep this relative path
import { sendOrderEmail } from "../../../../lib/email"; // <-- uses RESEND_API_KEY & EMAIL_FROM

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // IMPORTANT: use raw text body for signature verification
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[webhook] verify failed:", err?.message || err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only handle successful checkouts
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;

    // Pull values the way we set them at checkout
    const email =
      (session.customer_details?.email || session.customer_email || "").toLowerCase();
    const previewId = String(session.metadata?.preview_id || "");
    const planKey = String(session.metadata?.plan_key || "one_time"); // default
    const providerDisplay = session.metadata?.provider_display || null;
    const prelimGrade = session.metadata?.prelim_grade || null;

    // Basic sanity
    if (!email) {
      console.warn("[webhook] missing email on session", session.id);
    }
    if (!previewId) {
      console.warn("[webhook] missing preview_id on session", session.id);
    }

    // Save order row (match your Neon columns)
    // orders columns: id, email, plan_key, status, preview_id, stripe_session_id, created_at, next_due_1
    await sql(
      `INSERT INTO public.orders
       (email, plan_key, status, preview_id, stripe_session_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, planKey, session.payment_status || "paid", previewId, session.id]
    );

    // Fire-and-forget: generate the PDF + email with attachment
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.gradeyour401k.com";
      await fetch(`${base}/api/report/generate-and-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // If your route expects a bearer token:
          Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
        },
        body: JSON.stringify({
          previewId,
          email,
          planKey,
        }),
      });
    } catch (e) {
      console.error("[webhook] generate-and-email call failed:", e);
      // Not fatal—user still gets the confirmation email below
    }

    // Immediate confirmation email (plain HTML) so user knows it's processing
    if (email) {
      try {
        await sendOrderEmail({
          to: email,
          subject: "We’ve started your 401(k) report",
          previewId,
          planKey,
          providerDisplay,
          grade: prelimGrade,
        });
      } catch (e) {
        console.error("[webhook] sendOrderEmail failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[webhook] save/send failed:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  // health check
  return NextResponse.json({ ok: true, method: "GET" });
}
