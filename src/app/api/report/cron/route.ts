// src/app/api/report/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getMarketRegime } from "@/lib/market";
import { generatePdfBuffer } from "@/lib/pdf";
import { fetchLatestModel } from "@/lib/models-client"; // <-- NEW

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ─────────────────────────  ENV  ───────────────────────── **/
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";
if (!RESEND_API_KEY) console.warn("[cron] Missing RESEND_API_KEY");
if (!EMAIL_FROM) console.warn("[cron] Missing EMAIL_FROM");

/** ─────────────────────  Helpers / email  ────────────────── **/
type ResendAttachment = { filename: string; content: Buffer; contentType?: string };

async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
}) {
  const attachments =
    params.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content.toString("base64"),
      path: undefined,
      content_id: undefined,
      disposition: "attachment",
      type: a.contentType || "application/pdf",
    })) || [];

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${txt || res.statusText}`);
  }
}

// Normalize any query() return shape into an array of rows
function asRows<T = any>(result: any): T[] {
  if (!result) return [];
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result.rows)) return result.rows as T[];
  return [];
}

// Keep subject/HTML consistent with your one-time email
function buildOneTimeStyleHtml(args: {
  provider: string;
  profile: string;
  grade: number | null;
}) {
  const { provider, profile, grade } = args;
  const safeGrade = grade !== null ? `${Number(grade).toFixed(1)} / 5` : "—";
  const subject = "Your GradeYour401k PDF Report";

  const html = `
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your personalized 401(k) report is attached. View your grade and next steps inside.
  </div>

  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;margin:0 auto;line-height:1.55;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0 16px 0;">
      <tr>
        <td align="left" style="padding:0;">
          <a href="https://gradeyour401k.com" style="text-decoration:none;display:inline-block;">
            <img src="https://i.imgur.com/DMCbj99.png" alt="GradeYour401k" width="160" style="display:block;border:0;outline:none;height:auto;">
          </a>
        </td>
        <td align="right" style="padding:0;font-size:13px;color:#555;">
          <a href="https://gradeyour401k.com" style="color:#0b59c7;text-decoration:none;">gradeyour401k.com</a>
        </td>
      </tr>
    </table>

    <h2 style="margin:0 0 8px 0;">Your GradeYour401k Report</h2>
    <p style="margin:0 0 16px 0;">Your personalized 401(k) report is attached as a PDF.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0;">
      <tr>
        <td style="padding:8px 0;width:160px;color:#555;">Grade</td>
        <td style="padding:8px 0;"><strong>${safeGrade}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Provider</td>
        <td style="padding:8px 0;">${provider || "—"}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Profile</td>
        <td style="padding:8px 0;">${profile || "—"}</td>
      </tr>
    </table>

    <h3 style="margin:16px 0 8px 0;">Recommended Next Steps</h3>
    <ol style="margin:0 0 16px 20px;padding:0;">
      <li style="margin:6px 0;">Log in to your 401(k) plan.</li>
      <li style="margin:6px 0;">Update your allocations to align with your <em>Investor Profile</em> and our <em>Market Profile</em> guidance in the attached report.</li>
      <li style="margin:6px 0;">Save/confirm your changes inside the plan.</li>
      <li style="margin:6px 0;">
        <strong>Ready for a pro’s second opinion?</strong><br />
        Schedule a <strong>30-Minute 401(k) Review Call</strong> with Roger Remling, Tax & Financial Advisor. We’ll confirm your updates, uncover hidden inefficiencies, and ensure your portfolio’s flight path is on course.
      </li>
    </ol>

    <!-- Blue CTA button (same as one-time) -->
    <div style="margin:20px 0 10px;">
      <a href="https://gradeyour401k.com/review"
         style="display:inline-block;padding:12px 18px;background:#0b59c7;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
        Book Your 401(k) Review Call — $149
      </a>
    </div>
    <p style="margin:0 0 16px 0; font-size:14px; color:#555;">
      After checkout you’ll securely upload your 401(k) statement and pick a time on our calendar.
    </p>

    <p style="margin:0 0 16px 0;">Questions? Just give us a call—happy to help.</p>
    <p style="margin:0 0 8px 0;">— GradeYour401k</p>

    <hr style="border:none;border-top:1px solid #e6e6e6;margin:16px 0;" />
    <p style="margin:8px 0 0 0;font-size:12px;color:#777;">
      Prepared by Kenai Investments, Inc. (“Kenai”), a Registered Investment Advisor. This report is for informational purposes only and does not constitute
      a recommendation to buy or sell any security. Grades and allocations are estimates based on data provided and plan options available at the time of
      preparation and may change without notice. Investing involves risk, including the possible loss of principal. Past performance is not indicative of
      future results. Review the attached report carefully and consider your objectives, risk tolerance, time horizon, and tax situation. Advisory services
      are offered only where Kenai is properly registered or exempt from registration. For more information, visit
      <a href="https://gradeyour401k.com" style="color:#0b59c7;text-decoration:none;">gradeyour401k.com</a>.
    </p>
  </div>
  `;

  return { subject, html };
}

/** ─────────────────────────  Handler  ────────────────────── **/
export async function GET(req: NextRequest) {
  // Auth: Vercel Cron injects Authorization: Bearer <CRON_SECRET>
  const expected = `Bearer ${process.env.CRON_SECRET || ""}`;
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";

  try {
    console.log("[cron] start", { dryRun });

    // Select annual orders due for Q1/Q2/Q3 that haven't been sent
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

    console.log("[cron] candidates", { count: due.length });

    let processed = 0;
    const failures: Array<{ id: number; error: string }> = [];

    for (const row of due) {
      try {
        if (!row || !row.email) throw new Error("missing email");

        const provider = (row.provider ?? "").trim();
        const profile = (row.profile ?? "Balanced").trim();

        // Quarterly update emails do not include the user's exact current holdings.
        // Keep grade null (template shows "—"), but DO attach the current recommended model + F&G.
        const grade: number | null = null;
        const holdings: Array<{ symbol: string; weight: number }> = [];

        // Ensure market libs are warmed (optional)
        await getMarketRegime().catch(() => null);

        // NEW: fetch latest model + fear/greed for this provider/profile
        let model: Awaited<ReturnType<typeof fetchLatestModel>> | null = null;
        try {
          model = await fetchLatestModel(provider, profile);
        } catch {
          model = null;
        }

        // Build PDF (now with recommended holdings + live F&G when available)
        const pdfBytes = await generatePdfBuffer({
          provider: provider || "",
          profile: profile || "",
          grade,
          holdings,
          logoUrl: "https://i.imgur.com/DMCbj99.png",
          clientName: profile || undefined,
          reportDate: new Date().toISOString(),
          ...(model
            ? ({
                model_asof: model.asof,
                model_lines: model.lines,
                model_fear_greed: model.fear_greed, // { asof_date, reading } | null
              } as any)
            : ({} as any)),
        });

        if (!dryRun) {
          const { subject, html } = buildOneTimeStyleHtml({ provider, profile, grade });

          await sendEmailViaResend({
            to: row.email,
            subject,
            html,
            attachments: [{ filename: "GradeYour401k.pdf", content: Buffer.from(pdfBytes) }],
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

    // Log success run in cron_log
    await query(
      `INSERT INTO cron_log (job_name, ran_at) VALUES ($1, NOW())`,
      ["report-cron"]
    );

    console.log("[cron] done", { processed, failures: failures.length, dryRun });
    return NextResponse.json({ ok: true, processed, failures, dryRun });
  } catch (e: any) {
    console.error("[cron] top-level error:", e?.message || e);
    if (e?.stack) console.error(e.stack);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
