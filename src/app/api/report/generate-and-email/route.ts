// src/app/api/report/generate-and-email/route.ts
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // adjust if needed
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
  created_at: string | null;
};

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

  const draw = (text: string, size = 12, color = rgb(0, 0, 0)) => {
    page.drawText(text, { x: margin, y, size, font, color });
    y -= size + 6;
  };

  draw("GradeYour401k — Preliminary Report", 18);
  draw(`Provider: ${opts.provider}`, 12);
  draw(`Profile: ${opts.profile}`, 12);
  draw(`Grade: ${opts.grade} / 5`, 14);

  y -= 6;
  draw("Holdings", 14);
  if (!opts.holdings.length) {
    draw("None provided.", 12);
  } else {
    opts.holdings.forEach((h) => {
      draw(`${(Number(h.weight) || 0).toFixed(1)}% ${String(h.symbol).toUpperCase()}`, 11);
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

async function resolveFromSession(sessionId: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, created_at
    FROM public.orders
    WHERE stripe_session_id = ${sessionId}
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

async function latestPaidOrderByEmail(email: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, created_at
    FROM public.orders
    WHERE email = ${email} AND status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

async function latestPaidOrderByPreview(previewId: string) {
  const r = await sql<OrderRow>`
    SELECT email, preview_id, status, created_at
    FROM public.orders
    WHERE preview_id::text = ${previewId} AND status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return r.rows?.[0] || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let previewId = String(body?.previewId || "").trim();
    let email = String(body?.email || "").trim();
    const sessionId = String(body?.sessionId || "").trim();

    // 1) If no previewId but we got a sessionId, resolve via that order
    if (!previewId && sessionId) {
      const ord = await resolveFromSession(sessionId);
      if (ord?.preview_id) previewId = String(ord.preview_id);
      if (!email && ord?.email) email = ord.email.trim();
    }

    // 2) If still no previewId but we have an email, use latest paid order for that email
    if (!previewId && email) {
      const ord = await latestPaidOrderByEmail(email);
      if (ord?.preview_id) previewId = String(ord.preview_id);
    }

    // 3) If we have previewId but no email, fetch latest paid order for that preview
    if (previewId && !email) {
      const ord = await latestPaidOrderByPreview(previewId);
      if (ord?.email) email = ord.email.trim();
    }

    if (!previewId) {
      return NextResponse.json({ error: "Missing previewId" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found)" },
        { status: 400 }
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
    if (!p) {
      return NextResponse.json({ error: `Preview not found for id ${previewId}` }, { status: 404 });
    }

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

    await sendEmailWithPdf({ to: email, provider: providerDisplay, profile, grade, holdings });
    return NextResponse.json({ ok: true, previewId, email });
  } catch (err: any) {
    console.error("[report generate-and-email] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate and email report" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, method: "GET" });
}
