import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

// Generate a simple, dependency-light PDF with pdf-lib
async function generatePdfBuffer(opts: {
  provider: string;
  profile: string;
  grade: number | null;
  rows: Array<{ symbol: string; weight: number }>;
  createdAt?: string;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter-ish
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const title = "GradeYour401k — Personalized Report";
  const providerLine = `Provider: ${opts.provider || "—"}`;
  const profileLine = `Profile: ${opts.profile || "—"}`;
  const gradeLine = `Preliminary Grade: ${opts.grade !== null ? `${opts.grade.toFixed(1)} / 5` : "—"}`;
  const dateLine = `Created: ${opts.createdAt ? new Date(opts.createdAt).toLocaleString() : new Date().toLocaleString()}`;

  const { width } = page.getSize();
  const margin = 50;
  let y = 742;

  page.drawText(title, { x: margin, y, size: 20, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 28;
  page.drawText(providerLine, { x: margin, y, size: 12, font });
  y -= 18;
  page.drawText(profileLine, { x: margin, y, size: 12, font });
  y -= 18;
  page.drawText(gradeLine, { x: margin, y, size: 12, font });
  y -= 18;
  page.drawText(dateLine, { x: margin, y, size: 12, font });
  y -= 28;

  page.drawText("Holdings", { x: margin, y, size: 14, font });
  y -= 18;
  const rows = opts.rows.slice(0, 40); // keep it short
  if (rows.length === 0) {
    page.drawText("No holdings provided.", { x: margin, y, size: 12, font });
  } else {
    for (const r of rows) {
      const line = `${(Number(r.weight) || 0).toFixed(1).padStart(5, " ")}% ${String(r.symbol || "").toUpperCase()}`;
      page.drawText(line, { x: margin, y, size: 11, font });
      y -= 14;
      if (y < 60) break;
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
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

    const pdf = await generatePdfBuffer({
      provider: preview.provider_display || preview.provider || "",
      profile: preview.profile || "",
      grade,
      rows,
      createdAt: preview.created_at,
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
      attachments: [{ filename: "GradeYour401k.pdf", content: pdf }],
    });

    return NextResponse.json({ ok: true, emailed: toEmail, previewId });
  } catch (e: any) {
    console.error("[report POST] error:", e);
    return NextResponse.json({ error: e?.message || "internal error" }, { status: 500 });
  }
}
