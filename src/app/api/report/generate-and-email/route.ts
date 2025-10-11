// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { sql } from "../../../../lib/db"; // adjust if your path differs
import { generatePdfBuffer } from "../../../../lib/pdf";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, previewId } = await req.json();

    if (!email || !previewId) {
      return NextResponse.json(
        { error: "Missing email or previewId" },
        { status: 400 }
      );
    }

    // Load the saved preview
    const r = await sql(
      `SELECT provider, provider_display, profile, "rows", grade_adjusted, grade_base
       FROM public.previews
       WHERE id::text = $1
       LIMIT 1`,
      [String(previewId)]
    );
    const p: any = r.rows?.[0];
    if (!p) {
      return NextResponse.json(
        { error: "Preview not found for given previewId" },
        { status: 404 }
      );
    }

    const provider =
      p.provider_display || p.provider || "Unknown Provider";
    const profile = p.profile || "—";
    const gradeNum =
      typeof p.grade_adjusted === "number"
        ? p.grade_adjusted
        : typeof p.grade_base === "number"
        ? p.grade_base
        : null;
    const grade = gradeNum !== null ? gradeNum.toFixed(1) : "—";

    // Parse holdings (stored as JSON in previews.rows)
    let holdings: Array<{ symbol: string; weight: number }> = [];
    try {
      const raw = p.rows;
      const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
      holdings = (arr as any[]).map((h) => ({
        symbol: String(h.symbol || "").toUpperCase(),
        weight: Number(h.weight || 0),
      }));
    } catch {
      holdings = [];
    }

    // Generate PDF
    const pdfBytes = await generatePdfBuffer({
      provider,
      profile,
      grade,
      holdings,
    });

    // Email with attachment
    const subject = `Your GradeYour401k Report (${grade} / 5)`;
    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <p>Hi,</p>
        <p>Your preliminary report for <strong>${provider}</strong> (${profile}) is attached.</p>
        <p>Grade: <strong>${grade} / 5</strong></p>
        <p>Thanks for using GradeYour401k!</p>
      </div>
    `;

    const send = await resend.emails.send({
      from: "reports@gradeyour401k.kenaiinvest.com",
      to: email,
      subject,
      html,
      attachments: [
        {
          filename: "GradeYour401k-Report.pdf",
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    if (send.error) {
      console.error("[generate-and-email] resend error:", send.error);
      return NextResponse.json(
        { error: "Email send failed", detail: String(send.error) },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[report generate-and-email] error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true
