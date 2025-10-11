// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { sendReportEmail } from "../../../lib/email"; // <= adjust path if your libs live elsewhere
import { generatePdfBuffer } from "../../../lib/report"; // <= must export this from lib/report
// If you don't have those helpers, I can give you inline fallbacks.

export const dynamic = "force-dynamic";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) console.warn("[report] Missing DATABASE_URL");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- helpers ---------------------------------------------------------------

async function readJsonSafe(req: NextRequest) {
  try {
    const txt = await req.text();
    if (!txt) return {};
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

async function resolveContext(req: NextRequest) {
  const url = new URL(req.url);
  const qp = url.searchParams;

  // Accept either casing from querystring (session_id from Stripe success URL)
  const qsPreview =
    qp.get("previewId") || qp.get("preview_id") || undefined;
  const qsSession =
    qp.get("session_id") || qp.get("sessionId") || undefined;
  const qsEmail = qp.get("email") || undefined;

  // Accept from JSON body too
  const body = await readJsonSafe(req as any);
  const bodyPreview =
    (body.previewId as string) || (body.preview_id as string) || undefined;
  const bodySession =
    (body.sessionId as string) || (body.session_id as string) || undefined;
  const bodyEmail = (body.email as string) || undefined;

  // First pass (raw)
  let previewId = qsPreview ?? bodyPreview;
  let sessionId = qsSession ?? bodySession;
  let email = qsEmail ?? bodyEmail;

  // If we have sessionId but no previewId/email, look up in orders
  if (!previewId || !email) {
    if (sessionId) {
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
  }

  // If we still don't have previewId but we have email, grab latest order
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
    `SELECT id, provider, provider_display, profile, "rows", grade_base, grade_adjusted
       FROM public.previews
      WHERE id::text = $1
      LIMIT 1`,
    [previewId]
  );
  return r.rows[0] ?? null;
}

// ---- GET: for quick manual testing in the browser -------------------------
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
      return NextResponse.json(
        { error: `Preview not found for previewId=${previewId}` },
        { status: 404 }
      );
    }

    // Minimal PDF + email send (no-op on GET; we just prove resolution works)
    return NextResponse.json({
      ok: true,
      resolved: { previewId, sessionId: sessionId ?? null, email: email ?? null },
      preview: {
        provider: preview.provider_display || preview.provider,
        profile: preview.profile,
        rowsCount: Array.isArray(preview.rows)
          ? preview.rows.length
          : (() => {
              try {
                return JSON.parse(preview.rows)?.length ?? 0;
              } catch {
                return 0;
              }
            })(),
      },
    });
  } catch (e: any) {
    console.error("[report GET] error:", e);
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}

// ---- POST: actually generate the PDF and send email -----------------------
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
      return NextResponse.json(
        { error: `Preview not found for previewId=${previewId}` },
        { status: 404 }
      );
    }

    // Resolve destination email if still unknown
    let dest = email ?? null;
    if (!dest && sessionId) {
      const r = await pool.query(
        `SELECT email FROM public.orders WHERE stripe_session_id = $1 LIMIT 1`,
        [sessionId]
      );
      dest = r.rows[0]?.email ?? null;
    }
    if (!dest) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found)" },
        { status: 400 }
      );
    }

    // Normalize rows array
    let rows: Array<{ symbol: string; weight: number }> = [];
    if (Array.isArray(preview.rows)) {
      rows = preview.rows;
    } else {
      try {
        rows = JSON.parse(preview.rows ?? "[]");
      } catch {
        rows = [];
      }
    }

    // Build the PDF buffer (your generator should not require font files on disk)
    const pdf = await generatePdfBuffer({
      provider: preview.provider_display || preview.provider || "",
      profile: preview.profile || "",
      grade:
        typeof preview.grade_adjusted === "number"
          ? preview.grade_adjusted
          : typeof preview.grade_base === "number"
          ? preview.grade_base
          : null,
      rows,
    });

    // Email it
    await sendReportEmail({
      to: dest,
      previewId,
      pdfBuffer: pdf,
    });

    return NextResponse.json({ ok: true, emailed: dest, previewId });
  } catch (e: any) {
    console.error("[report generate-and-email POST] error:", e);
    return NextResponse.json(
      { error: e?.message || "internal error" },
      { status: 500 }
    );
  }
}
