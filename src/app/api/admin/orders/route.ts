// src/app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMarketRegime } from "@/lib/market";
import { buildReportPDF, type PreviewData } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function okAuth(req: NextRequest) {
  const token = req.headers.get("authorization") || "";
  const expected = process.env.ADMIN_TOKEN || "";
  return expected && token === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!okAuth(req)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const rows = await query<any>(
      `select o.id, o.created_at, o.stripe_session_id, o.plan_key, o.email as customer_email,
              o.preview_id, o.amount_cents, o.currency, o.delivered_at
       from orders o
       order by o.created_at desc
       limit 100`
    ).catch(() => []);
    return NextResponse.json({ orders: rows || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!okAuth(req)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const { email, previewId } = body || {};
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    // try load preview (optional)
    let data: PreviewData | null = null;
    if (previewId) {
      try {
        const r = await query<any>(
          `select provider, profile, rows, grade_base, grade_adjusted from previews where id = $1`,
          [previewId]
        );
        if (r && r[0]) {
          data = {
            provider: r[0].provider || "",
            profile: r[0].profile || "Growth",
            rows: Array.isArray(r[0].rows) ? r[0].rows : [],
            grade_base: Number(r[0].grade_base) || 0,
            grade_adjusted: Number(r[0].grade_adjusted) || 0,
          };
        }
      } catch {}
    }
    if (!data) data = { provider: "", profile: "Growth", rows: [], grade_base: 0, grade_adjusted: 0 };

    const regime = await getMarketRegime();
    const pdf = await buildReportPDF({ ...data, market_regime: regime });

    await sendReportEmail({
      to: email,
      subject: "Your GradeYour401k Report (Resent)",
      html: `<p>As requested, here is your report again.</p><p>— GradeYour401k</p>`,
      attachment: { filename: "GradeYour401k-Report.pdf", content: pdf },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
