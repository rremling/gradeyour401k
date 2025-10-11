// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { sendReportEmail } from "../../../../lib/email"; // relative to this file
import { sql } from "../../../../lib/db"; // adjust if your db export differs

// ---------- helpers ----------
async function getPreview(previewId: string) {
  const r = await sql(
    `SELECT id, created_at, provider, provider_display, profile, "rows", grade_base, grade_adjusted
     FROM public.previews
     WHERE id::text = $1
     LIMIT 1`,
    [previewId]
  );
  return r.rows?.[0] ?? null;
}

function renderPdfBuffer({
  provider,
  provider_display,
  profile,
  grade,
  rows,
}: {
  provider: string;
  provider_display: string;
  profile: string;
  grade: string;
  rows: Array<{ symbol: string; weight: number }>;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margin: 50 });
      const bufs: Uint8Array[] = [];

      doc.on("data", (d) => bufs.push(d));
      doc.on("end", () => {
        resolve(Buffer.concat(bufs));
      });

      // Header
      doc.fontSize(18).text("GradeYour401k — Personalized Report", { align: "left" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#666").text("Kenai Investments Inc.");
      doc.fillColor("#000").moveDown();

      // Summary
      doc.fontSize(12).text(`Provider: ${provider_display || provider || "—"}`);
      doc.text(`Profile: ${profile || "—"}`);
      doc.text(`Preliminary Grade: ${grade || "—"} / 5`);
      doc.moveDown();

      // Holdings
      doc.fontSize(12).text("Holdings", { underline: true });
      doc.moveDown(0.3);
      rows.forEach((r) => {
        const w = Number.isFinite(r.weight) ? r.weight : 0;
        doc.text(`${(r.symbol || "").toUpperCase()} — ${w.toFixed(1)}%`);
      });

      // Footer
      doc.moveDown();
      doc.fontSize(9).fillColor("#666").text(
        "This preview is informational. Your paid report includes deeper analysis, market regime overlay, and guidance.",
        { align: "left" }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function handleGenerateAndEmail({
  email,
  previewId,
}: {
  email: string;
  previewId: string;
}) {
  // 1) Load preview
  const p = await getPreview(previewId);
  if (!p) throw new Error(`Preview not found: ${previewId}`);

  // 2) Parse rows
  let rows: Array<{ symbol: string; weight: number }> = [];
  try {
    const raw = p.rows;
    const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
    rows = (arr as any[]).map((r) => ({
      symbol: String(r.symbol || "").toUpperCase(),
      weight: Number(r.weight || 0),
    }));
  } catch {
    rows = [];
  }

  // 3) Pick grade
  const grade =
    typeof p.grade_adjusted === "number"
      ? p.grade_adjusted.toFixed(1)
      : typeof p.grade_base === "number"
      ? p.grade_base.toFixed(1)
      : "—";

  // 4) Generate PDF buffer
  const pdfBuffer = await renderPdfBuffer({
    provider: p.provider,
    provider_display: p.provider_display,
    profile: p.profile,
    grade,
    rows,
  });

  // 5) Email
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <p>Thanks for your purchase!</p>
      <p>Your personalized 401(k) report is attached.</p>
      <p style="font-size:12px;color:#666">Kenai Investments Inc.</p>
    </div>
  `;

  await sendReportEmail({
    to: email,
    subject: "Your GradeYour401k Report",
    html,
    attachments: [
      {
        filename: "GradeYour401k-Report.pdf",
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { ok: true };
}

// ---------- POST (preferred) ----------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body.email || "").trim();
    const previewId = String(body.previewId || "").trim();

    if (!email || !previewId) {
      return NextResponse.json(
        { error: "Missing email or previewId" },
        { status: 400 }
      );
    }

    const out = await handleGenerateAndEmail({ email, previewId });
    return NextResponse.json(out);
  } catch (err: any) {
    console.error("[report generate-and-email] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

// ---------- GET (manual testing) ----------
// e.g. /api/report/generate-and-email?email=you@site.com&previewId=UUID
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = String(searchParams.get("email") || "").trim();
    const previewId = String(searchParams.get("previewId") || "").trim();

    if (!email || !previewId) {
      return NextResponse.json(
        { error: "Missing email or previewId" },
        { status: 400 }
      );
    }

    const out = await handleGenerateAndEmail({ email, previewId });
    return NextResponse.json(out);
  } catch (err: any) {
    console.error("[report generate-and-email GET] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
