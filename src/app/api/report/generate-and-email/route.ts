// src/app/api/report/generate-and-email/route.ts
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // <-- ensure this path is correct for your project
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resend } from "resend";

type PreviewRow = {
  id: string;
  provider: string | null;
  provider_display: string | null;
  profile: string | null;
  rows: any;
  grade_base: number | null;
  grade_adjusted: number | null;
};

type OrderRow = {
  email: string | null;
  preview_id: string | null;
  status: string | null;
  stripe_session_id: string | null;
  created_at: string | null;
};

// ---------- helpers: robust input parsing ----------
function getHeader(req: Request, name: string) {
  const v = req.headers.get(name) || req.headers.get(name.toLowerCase());
  return v ? v.trim() : "";
}

async function parseBodySafe(req: Request): Promise<any> {
  try {
    // If no body, req.json() throws; catch & return {}
    return await req.json();
  } catch {
    return {};
  }
}

function pickFirst(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return "";
}

// ---------- DB lookups ----------
async function findOrderBySession(sessionId: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, stripe_session_id, created_at
    FROM public.orders
    WHERE stripe_session_id = ${sessionId}
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

async function latestPaidOrderByEmail(email: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, stripe_session_id, created_at
    FROM public.orders
    WHERE email = ${email} AND status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

async function latestPaidOrderByPreview(previewId: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, stripe_session_id, created_at
    FROM public.orders
    WHERE preview_id::text = ${previewId} AND status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

// ---------- PDF + Email ----------
async function buildPdf(opts: {
  provider: string;
  profile: string;
  grade: string;
  holdings: { symbol: string; weight: number }[];
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const margin = 50;
  let y = 792 - margin;

  const line = (text: string, size = 12, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x: margin, y, size, font, color });
    y -= size + 6;
  };

  line("GradeYour401k — Preliminary Report", 18);
  line(`Provider: ${opts.provider}`);
  line(`Profile: ${opts.profile}`);
  line(`Grade: ${opts.grade} / 5`, 14);

  y -= 6;
  line("Holdings", 14);
  if (!opts.holdings.length) {
    line("None provided.");
  } else {
    opts.holdings.forEach((h) => {
      line(`${(Number(h.weight) || 0).toFixed(1)}% ${String(h.symbol).toUpperCase()}`, 11);
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function sendEmailWithPdf(params: {
  to: string;
  provider: string;
  profile: string;
  grade: string;
  holdings: { symbol: string; weight: number }[];
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
  const FROM_EMAIL = process.env.FROM_EMAIL || "";
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");
  if (!FROM_EMAIL) throw new Error("Missing FROM_EMAIL");

  const resend = new Resend(RESEND_API_KEY);
  const pdf = await buildPdf(params);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: "Your GradeYour401k report",
    html: `
      <div style="font-family:Arial, sans-serif; line-height:1.5">
        <p>Thanks for using GradeYour401k!</p>
        <p>Your preliminary PDF is attached.</p>
        <ul>
          <li><strong>Provider:</strong> ${params.provider}</li>
          <li><strong>Profile:</strong> ${params.profile}</li>
          <li><strong>Grade:</strong> ${params.grade} / 5</li>
        </ul>
      </div>
    `,
    attachments: [{ filename: "GradeYour401k_Report.pdf", content: pdf.toString("base64") }],
  });

  if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
}

// ---------- core resolver ----------
async function resolvePreviewAndEmail(input: {
  previewId?: string;
  sessionId?: string;
  email?: string;
  send?: boolean;
}) {
  let previewId = (input.previewId || "").trim();
  let email = (input.email || "").trim();
  const sessionId = (input.sessionId || "").trim();

  const tried: string[] = [];

  if (!previewId && sessionId) {
    tried.push("by sessionId");
    const ord = await findOrderBySession(sessionId);
    if (ord?.preview_id) previewId = String(ord.preview_id);
    if (!email && ord?.email) email = ord.email.trim();
  }

  if (!previewId && email) {
    tried.push("latest paid order by email");
    const ord = await latestPaidOrderByEmail(email);
    if (ord?.preview_id) previewId = String(ord.preview_id);
  }

  if (previewId && !email) {
    tried.push("latest paid order by previewId");
    const ord = await latestPaidOrderByPreview(previewId);
    if (ord?.email) email = ord.email.trim();
  }

  if (!previewId) {
    throw new Error(
      `Missing previewId. Tried: ${tried.join(
        " → "
      )}. Provide one of: previewId, sessionId, or email.`
    );
  }
  if (!email) {
    throw new Error(
      `Missing destination email. Tried: ${tried.join(
        " → "
      )}. Provide one of: email, sessionId (with an order), or a previewId that has a paid order.`
    );
  }

  // Load preview
  const pr = await sql<PreviewRow>`
    SELECT id, provider, provider_display, profile, "rows", grade_base, grade_adjusted
    FROM public.previews
    WHERE id::text = ${previewId}
    LIMIT 1
  `;
  const p = pr.rows?.[0];
  if (!p) throw new Error(`Preview not found for id ${previewId}`);

  const providerDisplay = p.provider_display || p.provider || "—";
  const profile = p.profile || "—";
  const gradeNum =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted
      : typeof p.grade_base === "number"
      ? p.grade_base
      : null;
  const grade = gradeNum !== null ? gradeNum.toFixed(1) : "—";

  let holdings: { symbol: string; weight: number }[] = [];
  try {
    const raw = p.rows;
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw as any);
    holdings = (arr as any[]).map((r) => ({
      symbol: String(r?.symbol || "").toUpperCase(),
      weight: Number(r?.weight || 0),
    }));
  } catch {
    holdings = [];
  }

  if (input.send) {
    await sendEmailWithPdf({
      to: email,
      provider: providerDisplay,
      profile,
      grade,
      holdings,
    });
  }

  return {
    ok: true as const,
    previewId,
    email,
    provider: providerDisplay,
    profile,
    grade,
    holdingsCount: holdings.length,
  };
}

// ---------- POST (normal path) ----------
export async function POST(req: Request) {
  try {
    const body = await parseBodySafe(req);
    // Also accept through headers as a fallback
    const headerPreview = getHeader(req, "x-preview-id");
    const headerSession = getHeader(req, "x-session-id");
    const headerEmail = getHeader(req, "x-email");
    const sendFlag = String(body?.send ?? getHeader(req, "x-send")).toLowerCase();

    const previewId = pickFirst(body?.previewId, headerPreview);
    const sessionId = pickFirst(body?.sessionId, headerSession);
    const email = pickFirst(body?.email, headerEmail);
    const send = sendFlag === "1" || sendFlag === "true";

    const result = await resolvePreviewAndEmail({ previewId, sessionId, email, send: true });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[report generate-and-email POST] error:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}

// ---------- GET (debug / manual trigger) ----------
// Examples:
// /api/report/generate-and-email?sessionId=cs_... (dry run, resolves only)
// /api/report/generate-and-email?sessionId=cs_...&send=1 (resolve + email)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const previewId = searchParams.get("previewId") || "";
    const sessionId = searchParams.get("sessionId") || "";
    const email = searchParams.get("email") || "";
    const send = ["1", "true", "yes"].includes(
      (searchParams.get("send") || "").toLowerCase()
    );

    const result = await resolvePreviewAndEmail({ previewId, sessionId, email, send });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[report generate-and-email GET] error:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 400 });
  }
}
