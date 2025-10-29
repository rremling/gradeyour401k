import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { generatePdfBuffer } from "@lib/pdf";


export const dynamic = "force-dynamic";

// --- ENV --------------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "reports@gradeyour401k.kenaiinvest.com";

if (!DATABASE_URL) console.warn("[report] Missing DATABASE_URL");
if (!RESEND_API_KEY) console.warn("[report] Missing RESEND_API_KEY");
if (!EMAIL_FROM) console.warn("[report] Missing EMAIL_FROM");

// --- DB ---------------------------------------------------------------------
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Helpers ----------------------------------------------------------------
async function readJsonSafe(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function resolveContext(req: NextRequest) {
  // Accept from querystring
  const u = new URL(req.url);
  const q = u.searchParams;
  const qsPreview = q.get("previewId") || q.get("preview_id") || undefined;
  const qsSession = q.get("session_id") || q.get("sessionId") || undefined;
  const qsEmail = q.get("email") || undefined;

  // Accept from JSON body
  const body = await readJsonSafe(req);
  const bodyPreview = (body.previewId as string) || (body.preview_id as string) || undefined;
  const bodySession = (body.sessionId as string) || (body.session_id as string) || undefined;
  const bodyEmail = (body.email as string) || undefined;

  let previewId = qsPreview ?? bodyPreview;
  let sessionId = qsSession ?? bodySession;
  let email = qsEmail ?? bodyEmail;

  // If we only have a sessionId, look up preview/email in orders
  if (sessionId && (!previewId || !email)) {
    const r = await pool.query(
      `SELECT preview_id, email
         FROM public.orders
        WHERE stripe_session_id = $1
        LIMIT 1`,
      [sessionId]
    );
    if (r.rows[0]) {
      previewId = previewId || r.rows[0].preview_id || undefined;
      email = email || r.rows[0].email || undefined;
    }
  }

  // If we still lack previewId but have email, use the newest order
  if (!previewId && email) {
    const r = await pool.query(
      `SELECT preview_id
         FROM public.orders
        WHERE email = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [email]
    );
    if (r.rows[0]?.preview_id) {
      previewId = r.rows[0].preview_id;
    }
  }

  return { previewId, sessionId, email };
}

async function loadPreview(previewId: string) {
  const r = await pool.query(
    `SELECT id, provider, provider_display, profile, "rows", grade_base, grade_adjusted, created_at
       FROM public.previews
      WHERE id::text = $1
      LIMIT 1`,
    [previewId]
  );
  return r.rows[0] ?? null;
}

function parseRows(raw: unknown): Array<{ symbol: string; weight: number }> {
  if (Array.isArray(raw)) return raw as any[];
  try {
    const arr = JSON.parse((raw as any) ?? "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}


async function sendEmailViaResend(params: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
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

// --- GET: debug / dry-run ---------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const { previewId, sessionId, email } = await resolveContext(req);
    if (!previewId) {
      return NextResponse.json(
        {
          error:
            `Missing previewId. Tried: ${sessionId ?? ""} / ${email ?? ""}. ` +
            `Provide one of: previewId, sessionId, or email.`,
        },
        { status: 400 }
      );
    }
    const preview = await loadPreview(previewId);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      resolved: { previewId, sessionId: sessionId ?? null, email: email ?? null },
      preview: {
        provider: preview.provider_display || preview.provider,
        profile: preview.profile,
        grade: (() => {
          const toNum = (v: any) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          };
          return toNum(preview.grade_adjusted) ?? toNum(preview.grade_base);
        })(),
        rowsCount: parseRows(preview.rows).length,
      },
    });
  } catch (e: any) {
    console.error("[report GET] error:", e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

// --- POST: generate PDF + send email ---------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { previewId, sessionId, email } = await resolveContext(req);
    if (!previewId) {
      return NextResponse.json(
        {
          error:
            `Missing previewId. Tried: ${sessionId ?? ""} / ${email ?? ""}. ` +
            `Provide one of: previewId, sessionId, or email.`,
        },
        { status: 400 }
      );
    }

    const preview = await loadPreview(previewId);
    if (!preview) {
      return NextResponse.json({ error: "Preview not found" }, { status: 404 });
    }

    // Resolve destination email if needed
    let toEmail = email ?? null;
    if (!toEmail && sessionId) {
      const r = await pool.query(
        `SELECT email FROM public.orders WHERE stripe_session_id = $1 LIMIT 1`,
        [sessionId]
      );
      toEmail = r.rows[0]?.email ?? null;
    }
    if (!toEmail) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found)" },
        { status: 400 }
      );
    }

    const rows = parseRows(preview.rows);
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const grade = toNum(preview.grade_adjusted) ?? toNum(preview.grade_base);

    const pdfBytes = await generatePdfBuffer({
      provider: preview.provider_display || preview.provider || "",
      profile: preview.profile || "",
      grade,
      holdings: rows,
      logoUrl: "https://i.imgur.com/DMCbj99.png",
      clientName: preview.profile || undefined,
      reportDate: preview.created_at || undefined,
    });

    await sendEmailViaResend({
      to: toEmail,
      subject: "Your GradeYour401k PDF Report",
      html: `
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
        <td style="padding:8px 0;"><strong>${grade !== null ? `${Number(grade).toFixed(1)} / 5` : "—"}</strong></td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Provider</td>
        <td style="padding:8px 0;">${preview.provider_display || preview.provider || "—"}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#555;">Profile</td>
        <td style="padding:8px 0;">${preview.profile || "—"}</td>
      </tr>
    </table>

    <h3 style="margin:16px 0 8px 0;">Your 401(k) just received a new clearance — implement your new allocation today.</h3>
    <h3 style="margin:16px 0 8px 0;">Recommended Next Steps</h3>
<ol style="margin:0 0 16px 20px;padding:0;">
  <li style="margin:6px 0;">Log in to your <strong>GradeYour401k</strong> account.</li>
  <li style="margin:6px 0;">Review your latest report and confirm your provider and investor profile are up to date.</li>
  <li style="margin:6px 0;">Update your details if needed and view/download past reports anytime.</li>
</ol>


    <!-- Blue CTA button -->
    <div style="margin:20px 0 10px;">
      <a href="https://gradeyour401k.com/account"
         style="display:inline-block;padding:12px 18px;background:#0b59c7;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
        Account Login
      </a>
    </div>
    
    <p style="margin:0 0 16px 0;">Questions? Just give us a call—happy to help. (806) 359-3100</p>
    <p style="margin:0 0 8px 0;">— GradeYour401k</p>

    <hr style="border:none;border-top:1px solid #e6e6e6;margin:16px 0;" />
    <p style="margin:8px 0 0 0;font-size:12px;color:#777;">
      Prepared by Kenai Investments, Inc. (“Kenai”), a Registered Investment Advisor. This report is for informational purposes only and does not constitute
      a recommendation to buy or sell any security. Grades and allocations are estimates based on data provided and plan options available at the time of
      preparation and may change without notice. Investing involves risk, including the possible loss of principal. Past performance is not indicative of
      future results. Review the attached report carefully and consider your objectives, risk tolerance, time horizon, and tax situation. Advisory services
      are offered only where Kenai is properly registered or exempt from registration. For more information, visit
      <a href="https://gradeyour401k.com" style="color:#0b59c7;text-decoration:none;">gradeyour401k.com</a>.
      <a href="https://pilotyour401k.com" style="color:#0b59c7;text-decoration:none;">pilotyour401k.com</a>.
      <a href="https://kenaiinvest.com" style="color:#0b59c7;text-decoration:none;">kenaiinvest.com</a>.
    </p>
  </div>
`,
      attachments: [{ filename: "GradeYour401k.pdf", content: Buffer.from(pdfBytes) }],
    });

    return NextResponse.json({ ok: true, emailed: toEmail, previewId });
  } catch (e: any) {
    console.error("[report POST] error:", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
