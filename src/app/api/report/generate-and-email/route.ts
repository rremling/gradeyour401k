// src/app/api/report/generate-and-email/route.ts
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db"; // adjust if your path differs
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

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
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

  const pdf = await buildPdf({
    provider: params.provider,
    profile: params.profile,
    grade: params.grade,
    holdings: params.holdings,
  });

  const subject = `Your GradeYour401k report`;
  const html = `
    <div style="font-family:Arial, sans-serif; line-height:1.5">
      <p>Thanks for using GradeYour401k!</p>
      <p>Your preliminary PDF is attached.</p>
      <ul>
        <li><strong>Provider:</strong> ${params.provider}</li>
        <li><strong>Profile:</strong> ${params.profile}</li>
        <li><strong>Grade:</strong> ${params.grade} / 5</li>
      </ul>
      <p>If you didn’t request this report, you can ignore this email.</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject,
    html,
    attachments: [
      {
        filename: "GradeYour401k_Report.pdf",
        content: pdf.toString("base64"),
      },
    ],
  });

  if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const previewId = String(body?.previewId || "").trim();
    let email = String(body?.email || "").trim();

    if (!previewId) {
      return NextResponse.json({ error: "Missing previewId" }, { status: 400 });
    }

    // If email missing, try to infer from the latest PAID order for this preview
    if (!email) {
      const o = await sql<OrderRow>`
        SELECT email
        FROM public.orders
        WHERE preview_id::text = ${previewId} AND status = 'paid'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const candidate = o.rows?.[0]?.email?.trim();
      if (candidate) email = candidate;
    }

    if (!email) {
      return NextResponse.json(
        { error: "Missing destination email (no order email found)" },
        { status: 400 }
      );
    }

    // Load preview
    const r = await sql<PreviewRow>`
      SELECT id, provider, provider_display, profile, "rows", grade_base, grade_adjusted
      FROM public.previews
      WHERE id::text = ${previewId}
      LIMIT 1
    `;
    const p = r.rows?.[0];
    if (!p) {
      return NextResponse.json(
        { error: `Preview not found for id ${previewId}` },
        { status: 404 }
      );
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

    // Normalize holdings
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

    await sendEmailWithPdf({
      to: email,
      provider: providerDisplay,
      profile,
      grade,
      holdings,
    });

    return NextResponse.json({ ok: true });
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
