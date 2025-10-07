// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { buildReportPDF, type PreviewData } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// (Optional) very simple market regime placeholder — wire your real logic later
async function getMarketRegime(): Promise<string> {
  // You can replace with Alpha Vantage / SMA logic; keep it static for now
  return "Trend: Neutral (demo)";
}

async function loadPreview(previewId: string): Promise<PreviewData | null> {
  try {
    const rows = await query<{
      provider: string; profile: string; rows: any; grade_base: number; grade_adjusted: number;
    }>(`select provider, profile, rows, grade_base, grade_adjusted from previews where id = $1`, [previewId]);
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
    return null; // DB not configured or query failed
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email as string) || "";            // required
    const previewId = (body.previewId as string) || "";    // preferred
    const override = (body.data as PreviewData | undefined) || undefined; // optional raw data if no DB

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    let data: PreviewData | null = null;
    if (previewId) data = await loadPreview(previewId);
    if (!data && override) data = override;

    if (!data) {
      return NextResponse.json({ error: "No preview data found" }, { status: 400 });
    }

    const regime = await getMarketRegime();
    const pdf = await buildReportPDF({ ...data, market_regime: regime });

    await sendReportEmail({
      to: email,
      subject: "Your GradeYour401k PDF report",
      html:
        `<p>Thanks for your purchase!</p>` +
        `<p>Your report is attached. Provider: <strong>${data.provider}</strong>; Profile: <strong>${data.profile}</strong>.</p>` +
        `<p>If you didn’t enter holdings before purchase, you can complete them here: <a href="${process.env.NEXT_PUBLIC_BASE_URL || ""}/grade/new">Finish inputs</a>.</p>` +
        `<p>— GradeYour401k</p>`,
      attachment: { filename: "GradeYour401k-Report.pdf", content: pdf },
    });

    // optional: mark delivered if DB exists and you passed order id (skip for now)
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("generate-and-email error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
