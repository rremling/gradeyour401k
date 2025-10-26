// src/app/api/report/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMarketRegime } from "@/lib/market";
import { generatePdfBuffer } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Auth: Vercel Cron injects Authorization: Bearer <CRON_SECRET>
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  console.log("[cron] annual start", new Date().toISOString());

  // Find annual orders with a quarterly due date that has arrived and not yet sent
  // Process up to 20 per run (adjust as needed)
  const due = await query<{
    id: number;
    email: string | null;
    provider: string | null;
    profile: string | null;
    due_kind: "q1" | "q2" | "q3";
  }>(`
    WITH candidates AS (
      SELECT
        id,
        email,
        provider,
        profile,
        CASE
          WHEN next_due_1 IS NOT NULL AND q1_sent_at IS NULL AND next_due_1 <= NOW() THEN 'q1'
          WHEN next_due_2 IS NOT NULL AND q2_sent_at IS NULL AND next_due_2 <= NOW() THEN 'q2'
          WHEN next_due_3 IS NOT NULL AND q3_sent_at IS NULL AND next_due_3 <= NOW() THEN 'q3'
          ELSE NULL
        END AS due_kind
      FROM public.orders
      WHERE plan_key = 'annual'
    )
    SELECT id, email, provider, profile, due_kind
    FROM candidates
    WHERE due_kind IS NOT NULL
    LIMIT 20;
  `);

  let processed = 0;
  const failures: Array<{ id: number; error: string }> = [];

  for (const row of due) {
    try {
      if (!row.email) {
        throw new Error("missing email");
      }

      const provider = (row.provider ?? "").trim();
      const profile  = (row.profile  ?? "Moderate").trim();

      // If provider is optional for now, allow blank; otherwise bail here
      // if (!provider) throw new Error("missing provider");

      const regime = await getMarketRegime();

      const pdfData = {
        provider,
        profile,
        rows: [],          // TODO: plug in your analytics rows for (provider, profile)
        grade_base: 0,
        grade_adjusted: 0,
        market_regime: regime,
      };

      const pdf = await generatePdfBuffer(pdfData);

      await sendReportEmail({
        to: row.email,
        subject: "Your GradeYour401k Quarterly Update",
        html: `<p>Your quarterly update is attached for ${provider || "your plan"} (${profile}).</p><p>— GradeYour401k</p>`,
        attachment: { filename: "GradeYour401k-Update.pdf", content: pdf },
      });

      const col =
        row.due_kind === "q1" ? "q1_sent_at" :
        row.due_kind === "q2" ? "q2_sent_at" : "q3_sent_at";

      await query(`UPDATE public.orders SET ${col} = NOW() WHERE id = $1`, [row.id]);

      processed++;
    } catch (e: any) {
      console.error("[cron] failed order", row.id, e?.message || e);
      failures.push({ id: row.id, error: String(e?.message || e) });
      // continue to next row
    }
  }

  console.log("[cron] annual done", { processed, failures: failures.length });

  return NextResponse.json({ ok: true, processed, failures });
}
