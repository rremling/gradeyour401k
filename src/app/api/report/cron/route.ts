// src/app/api/report/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMarketRegime } from "@/lib/market";
import { generatePdfBuffer } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Pick annual orders due today (you can refine this)
  const due = await query<{
    stripe_session_id: string;
    customer_email: string | null;
    preview_id: string | null;
  }>(
    `select stripe_session_id, customer_email, preview_id
       from orders
      where plan_key = 'annual'
        and (next_update_at is null or next_update_at <= now())
      limit 25`
  );

  let processed = 0;
  for (const row of due) {
    const to = row.customer_email;
    if (!to) continue;

    // Load preview rows if you want the latest inputs, else send “starter/last-known”
    // Here we just send a fresh market regime report:
    const regime = await getMarketRegime();
    const data = { provider: "", profile: "Growth", rows: [], grade_base: 0, grade_adjusted: 0, market_regime: regime };
    const pdf = await buildReportPDF(data);

    await sendReportEmail({
      to,
      subject: "Your GradeYour401k Quarterly Update",
      html: `<p>Your quarterly update is attached.</p><p>— GradeYour401k</p>`,
      attachment: { filename: "GradeYour401k-Update.pdf", content: pdf },
    });

    // Move next_update_at forward ~90 days (quarter)
    await query(`update orders set next_update_at = now() + interval '90 days', updates_sent = coalesce(updates_sent,0)+1 where stripe_session_id = $1`, [row.stripe_session_id]);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
