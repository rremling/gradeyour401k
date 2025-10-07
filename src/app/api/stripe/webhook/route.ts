// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { buildReportPDF, type PreviewData } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";
import { getMarketRegime } from "@/lib/market";

function uuid4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function maybeLoadPreview(previewId: string): Promise<PreviewData | null> {
  try {
    const rows = await query<{
      provider: string; profile: string; rows: any; grade_base: number; grade_adjusted: number;
    }>(
      `select provider, profile, rows, grade_base, grade_adjusted
       from previews
       where id = $1`,
      [previewId]
    );
    if (!rows?.length) return null;
    const p = rows[0];
    return {
      provider: p.provider || "",
      profile: p.profile || "Growth",
      rows: Array.isArray(p.rows) ? p.rows : [],
      grade_base: Number(p.grade_base) || 0,
      grade_adjusted: Number(p.grade_adjusted) || 0,
    };
  } catch {
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;

  if (!secret || !key) {
    console.error("Webhook missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return new NextResponse("Config error", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    const raw = await req.text();
    const sig = req.headers.get("stripe-signature") as string;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message || err);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_details?.email ||
        (session.customer_email as string) ||
        "";
      const previewId = (session.metadata?.previewId as string) || "";
      const planKey = (session.metadata?.planKey as "one_time" | "annual") || "one_time";

      // 1) Persist order (best-effort)
      try {
        const id = uuid4();
        await query(
          `insert into orders
           (id, created_at, stripe_session_id, plan_key, email, customer_email, preview_id, amount_cents, currency)
           values ($1, now(), $2, $3, $4, $4, nullif($5,'')::uuid, $6, $7)
           on conflict (stripe_session_id) do nothing`,
          [
            id,
            session.id,
            planKey,
            email || null,
            previewId || null,
            session.amount_total || null,
            session.currency || null,
          ]
        ).catch(() => {});
      } catch (e) {
        console.warn("orders insert failed (continuing):", (e as Error).message);
      }

      // 2) Build data (from preview if available)
      let data: PreviewData | null = null;
      if (previewId) data = await maybeLoadPreview(previewId);
      if (!data) {
        data = {
          provider: "",
          profile: "Growth",
          rows: [],
          grade_base: 0,
          grade_adjusted: 0,
        };
      }

      // 3) Market regime + build PDF
      const regime = await getMarketRegime();
      const pdf = await buildReportPDF({ ...data, market_regime: regime });

      // 4) Email report
      if (email) {
        await sendReportEmail({
          to: email,
          subject:
            planKey === "annual"
              ? "Your GradeYour401k Annual Plan — First Report"
              : "Your GradeYour401k One-Time Report",
          html:
            `<p>Thanks for your purchase!</p>` +
            (data.rows.length
              ? `<p>Your report is attached. Provider: <strong>${data.provider}</strong>; Profile: <strong>${data.profile}</strong>.</p>`
              : `<p>Please complete your holdings to enhance your report: <a href="${process.env.NEXT_PUBLIC_BASE_URL || ""}/grade/new">Finish inputs</a>.</p>`) +
            `<p>— GradeYour401k</p>`,
          attachment: { filename: "GradeYour401k-Report.pdf", content: pdf },
        });

        // 5) Mark delivered
        try {
          await query(
            `update orders
             set delivered_at = now()
             where stripe_session_id = $1`,
            [session.id]
          ).catch(() => {});
        } catch {}
      } else {
        console.warn("checkout.session.completed: missing email");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("webhook handler error:", err?.message || err);
    return new NextResponse("Server error", { status: 500 });
  }
}
