// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildReportPDF, type PreviewData } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";
import { getMarketRegime } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadPreview(previewId: string): Promise<PreviewData | null> {
  if (!previewId) return null;
  try {
    const rows = await query<{
      provider: string;
      profile: string;
      rows: any;
      grade_base: number;
      grade_adjusted: number;
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
  } catch (e: any) {
    console.warn("[report] preview load failed:", e?.message || e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { previewId, sessionId, email: emailOverride } = await req.json().catch(() => ({}));

    // 1) If we have a sessionId, try to locate the order and email + preview
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
      } catch (e: any) {
        console.warn("[report] order lookup failed:", e?.message || e);
      }
    }

    // 2) Resolve final email target (allow manual override)
    const toEmail =
      emailOverride ||
      email ||
      null;

    if (!toEmail) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found)" },
        { status: 400 }
      );
    }

    // 3) Load preview if present (body wins, then order’s preview)
    const resolvedPreviewId: string =
      (previewId as string) ||
      (previewFromOrder as string) ||
      "";

    let data: PreviewData | null = null;
    if (resolvedPreviewId) {
      data = await loadPreview(resolvedPreviewId);
    }

    // 4) If still no preview, build a minimal starter report instead of 400
    if (!data) {
      data = {
        provider: "",
        profile: "Growth",
        rows: [],
        grade_base: 0,
        grade_adjusted: 0,
      };
    }

    // 5) Market regime
    const regime = await getMarketRegime(); // will use Alpha Vantage if key present
    const pdf = await buildReportPDF({ ...data, market_regime: regime });

    // 6) Email
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
    console.error("[report] error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Failed to generate/send report" }, { status: 500 });
  }
}
