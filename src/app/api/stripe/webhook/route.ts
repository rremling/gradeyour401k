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
  if (!previewId) return null;
  try {
    const rows = await query<{
      provider: string; profile: string; rows: any; grade_base: number; grade_adjusted: number;
    }>(
      `select provider, profile, rows, grade_base, grade_adjusted from previews where id = $1`,
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
  } catch (e: any) {
    console.warn("[webhook] preview load failed:", e?.message || e);
    return null;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    console.error("[webhook] missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return new NextResponse("Config error", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const raw = Buffer.from(await req.arrayBuffer());   // RAW BODY
    const sig = req.headers.get("stripe-signature") as string;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err: any) {
    console.error("[webhook] signature/construct fail:", err?.message || err);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    console.log("[webhook] event", event.id, event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email =
        session.customer_details?.email ||
        (session.customer_email as string) ||
        "";
      const previewId = (session.metadata?.previewId as string) || "";
      const planKey = (session.metadata?.planKey as "one_time" | "annual") || "one_time";

      console.log("[webhook] parsed", { email, previewId, planKey, amount: session.amount_total, currency: session.currency });

      // 1) Upsert order
      try {
        const id = uuid4();
        const previewUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(previewId)
            ? previewId
            : null;

        await query(
          `insert into orders
             (id, created_at, stripe_session_id, plan_key, email, customer_email, preview_id, amount_cents, currency)
           values
             ($1, now(), $2, $3, $4, $4, $5, $6, $7)
           on conflict (stripe_session_id) do update set
             customer_email = excluded.customer_email,
             plan_key = excluded.plan_key,
             amount_cents = excluded.amount_cents,
             currency = excluded.currency`,
          [
            id,
            session.id,
            planKey,
            email || null,
            previewUUID,
            session.amount_total || null,
            session.currency || null,
          ]
        );
        console.log("[webhook] order upserted");
      } catch (e: any) {
        console.error("[webhook] order insert failed:", e?.message || e);
      }

      // 2) Build data
      let data: PreviewData | null = await maybeLoadPreview(previewId);
      if (!data) data = { provider: "", profile: "Growth", rows: [], grade_base: 0, grade_adjusted: 0 };

      // 3) Market regime + PDF
      const regime = await getMarketRegime();
      console.log("[webhook] regime ready");
      const pdf = await buildReportPDF({ ...data, market_regime: regime });
      console.log("[webhook] pdf built", pdf.length, "bytes");

      // 4) Email
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
        console.log("[webhook] email sent");

        try {
          await query(`update orders set delivered_at = now() where stripe_session_id = $1`, [session.id]);
          console.log("[webhook] order marked delivered");
        } catch (e: any) {
          console.warn("[webhook] mark delivered failed:", e?.message || e);
        }
      } else {
        console.warn("[webhook] missing email");
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[webhook] handler error:", err?.message || err);
    return new NextResponse("Server error", { status: 500 });
  }
}
