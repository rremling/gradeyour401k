// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildReportPDF, type PreviewData } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";
import { getMarketRegime } from "@/lib/market";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPreview(previewId: string): Promise<PreviewData | null> {
  if (!previewId) return null;
  try {
    const rows = await query<{
      provider: string; profile: string; rows: any;
      grade_base: number; grade_adjusted: number;
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

export async function POST(req: NextRequest) {
  try {
    const { previewId, sessionId, email: emailOverride } = await req.json().catch(() => ({}));

    // 1) Try DB first (orders table)
    let email: string | null = null;
    let previewFromOrder: string | null = null;

    if (sessionId) {
      try {
        const rows = await query<{ customer_email: string | null; preview_id: string | null }>(
          `select customer_email, preview_id
             from orders
            where stripe_session_id = $1
            order by created_at desc
            limit 1`,
          [sessionId]
        );
        if (rows?.length) {
          email = rows[0].customer_email;
          previewFromOrder = rows[0].preview_id;
        }
      } catch {}
    }

    // 2) If DB didn’t have it, ask Stripe for the session to get email + metadata
    if (!email && sessionId) {
      const sk = process.env.STRIPE_SECRET_KEY;
      if (!sk) return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
      const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["customer"],
      });

      email =
        session.customer_details?.email ||
        (session.customer_email as string) ||
        (typeof session.customer === "object" && session.customer?.email) ||
        null;

      // grab preview from metadata if present
      if (!previewFromOrder) {
        const m = session.metadata || {};
        if (m.previewId && typeof m.previewId === "string") {
          previewFromOrder = m.previewId;
        }
      }
    }

    // 3) Final email resolution (allow explicit override from client)
    const toEmail = emailOverride || email || null;
    if (!toEmail) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found and none in Stripe session)" },
        { status: 400 }
      );
    }

    // 4) Resolve preview data (prefer explicit previewId in body, then order/stripe)
    const resolvedPreviewId = (previewId as string) || (previewFromOrder as string) || "";
    let data: PreviewData | null = null;
    if (resolvedPreviewId) data = await loadPreview(resolvedPreviewId);

    // 5) Fallback to starter report if no preview exists yet
    if (!data) {
      data = { provider: "", profile: "Growth", rows: [], grade_base: 0, grade_adjusted: 0 };
    }

    // 6) Market regime + PDF
    const regime = await getMarketRegime();
    const pdf = await buildReportPDF({ ...data, market_regime: regime });

    // 7) Email it
    await sendReportEmail({
      to: toEmail,
      subject: "Your GradeYour401k Report",
      html:
        (resolvedPreviewId
          ? `<p>Your personalized report is attached.</p>`
          : `<p>Your starter report is attached. For a more detailed report, please complete your holdings here: <a href="${process.env.NEXT_PUBLIC_BASE_URL || ""}/grade/new">Finish inputs</a>.</p>`) +
        `<p>— GradeYour401k</p>`,
      attachment: { filename: "GradeYour401k-Report.pdf", content: pdf },
    });

    return NextResponse.json({ ok: true, usedPreview: !!resolvedPreviewId });
  } catch (e: any) {
    console.error("[report resend] error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Failed to generate/send report" }, { status: 500 });
  }
}
