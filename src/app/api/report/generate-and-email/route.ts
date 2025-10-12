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
        grade:
          typeof preview.grade_adjusted === "number"
            ? preview.grade_adjusted
            : typeof preview.grade_base === "number"
            ? preview.grade_base
            : null,
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
    const grade =
      typeof preview.grade_adjusted === "number"
        ? preview.grade_adjusted
        : typeof preview.grade_base === "number"
        ? preview.grade_base
        : null;

    const pdfBytes = await generatePdfBuffer({
  provider: preview.provider_display || preview.provider || "",
  profile: preview.profile || "",
  grade, // number | null is OK; the generator will format it
  holdings: rows, // NOTE: renamed from rows -> holdings
  logoUrl: "https://i.imgur.com/DMCbj99.png",
  clientName: preview.profile || undefined,
  reportDate: preview.created_at || undefined,
});


    await sendEmailViaResend({
      to: toEmail,
      subject: "Your GradeYour401k PDF Report",
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px">
          <p>Hi,</p>
          <p>Your personalized 401(k) report is attached.</p>
          <p><strong>Grade:</strong> ${grade !== null ? `${grade.toFixed(1)} / 5` : "—"}</p>
          <p><strong>Provider:</strong> ${preview.provider_display || preview.provider || "—"}</p>
          <p><strong>Profile:</strong> ${preview.profile || "—"}</p>
          <hr/>
          <p>If you need anything, just reply to this email.</p>
          <p>&mdash; GradeYour401k</p>
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
