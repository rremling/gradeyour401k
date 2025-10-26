// src/app/api/report/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMarketRegime } from "@/lib/market";
import { generatePdfBuffer } from "@/lib/pdf";
import { sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Normalize any query() return shape into an array of rows
function asRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  // Some wrappers return { rowCount, rows }, others return { rows: [...] }, others return [...]
  // If it's a plain object, return [] to avoid crashing; we'll log it.
  return [];
}

export async function GET(req: NextRequest) {
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    console.log("[cron] start", { dryRun });

    // Fetch due annual orders using the columns we discussed
    const rawDue = await query(`
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

    const due = asRows<{
      id: number;
      email: string | null;
      provider: string | null;
      profile: string | null;
      due_kind: "q1" | "q2" | "q3";
    }>(rawDue);

    // Extra diagnostics if shape is unexpected
    if (!Array.isArray(due)) {
      console.error("[cron] due not array", {
        typeofRaw: typeof rawDue,
        hasRows: rawDue && Array.isArray(rawDue.rows),
        preview: JSON.stringify(rawDue)?.slice(0, 200),
      });
    }
    console.log("[cron] candidates", { count: due.length });

    let processed = 0;
    const failures: Array<{ id: number; error: string }> = [];

    for (const row of due) {
      try {
        if (!row || !row.email) throw new Error("missing email");

        const provider = (row.provider ?? "").trim();
        const profile  = (row.profile  ?? "Moderate").trim();

        const regime = await getMarketRegime();

        const pdfData = {
          provider,
          profile,
          rows: [],           // TODO: plug in analytics rows if you have them
          grade_base: 0,
          grade_adjusted: 0,
          market_regime: regime,
        };

        const pdf = await generatePdfBuffer(pdfData);

        if (!dryRun) {
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
        }

        processed++;
      } catch (e: any) {
        console.error("[cron] row failed", row?.id, e?.message || e);
        failures.push({ id: row?.id ?? -1, error: String(e?.message || e) });
      }
    }

    console.log("[cron] done", { processed, failures: failures.length, dryRun });
    return NextResponse.json({ ok: true, processed, failures, dryRun });
  } catch (e: any) {
    console.error("[cron] top-level error:", e?.message || e);
    // Also log the stack to Vercel logs
    if (e?.stack) console.error(e.stack);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
