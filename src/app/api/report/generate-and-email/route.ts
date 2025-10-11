// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "../../../../lib/db";
import { pdf } from "@react-pdf/renderer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Resend } from "resend";

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Always JSON-safe helper
function safeJson(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim();
    const previewId = String(body.previewId || "").trim();

    if (!email || !previewId) {
      return NextResponse.json(
        { ok: false, error: "Missing email or previewId" },
        { status: 400 }
      );
    }

    // Fetch preview data
    const r = await sql(
      `SELECT id, provider_display, profile, grade_adjusted, grade_base
       FROM public.previews
       WHERE id::text = $1
       LIMIT 1`,
      [previewId]
    );

    const p = r.rows?.[0];
    if (!p) {
      return NextResponse.json(
        { ok: false, error: `Preview not found (${previewId})` },
        { status: 404 }
      );
    }

    // Compute grade
    const grade =
      typeof p.grade_adjusted === "number"
        ? p.grade_adjusted.toFixed(1)
        : typeof p.grade_base === "number"
        ? p.grade_base.toFixed(1)
        : "—";

    // ✅ Create a basic PDF using pdf-lib (safe for Vercel, no AFM fonts)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 780]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("401(k) Report", {
      x: 50,
      y: 720,
      size: 24,
      font,
      color: rgb(0.1, 0.3, 0.6),
    });

    page.drawText(`Provider: ${p.provider_display || "—"}`, {
      x: 50,
      y: 680,
      size: 14,
      font,
    });

    page.drawText(`Profile: ${p.profile || "—"}`, {
      x: 50,
      y: 660,
      size: 14,
      font,
    });

    page.drawText(`Grade: ${grade} / 5`, {
      x: 50,
      y: 640,
      size: 16,
      font,
      color: rgb(0.2, 0.6, 0.2),
    });

    page.drawText(
      "This report provides your personalized 401(k) grade and profile summary.",
      {
        x: 50,
        y: 600,
        size: 12,
        font,
      }
    );

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    // ✅ Send email via Resend
    const subject = `Your 401(k) Report — Grade ${grade}/5`;
    const textBody = `Hi there,

Your personalized 401(k) report is attached as a PDF.

Provider: ${p.provider_display || "—"}
Profile: ${p.profile || "—"}
Grade: ${grade}/5

Thank you for using GradeYour401k.com!

— Kenai Investments Team
`;

    await resend.emails.send({
      from: "reports@gradeyour401k.com",
      to: email,
      subject,
      text: textBody,
      attachments: [
        {
          filename: `401k_Report_${previewId}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log(`[generate-and-email] PDF emailed to ${email}`);

    return NextResponse.json({
      ok: true,
      email,
      previewId,
      grade,
    });
  } catch (err: any) {
    console.error("[generate-and-email] error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "PDF generation failed" },
      { status: 500 }
    );
  }
}
