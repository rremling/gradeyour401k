// src/app/api/report/generate-and-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { generatePdfBuffer } from "@/lib/pdf"; // your existing helper
import { sendReportEmail } from "@/lib/email"; // your existing helper

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const session_id = String(body.session_id || "").trim();

    if (!session_id) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    // Get order info (we only need email + preview_id)
    const r = await sql(
      `SELECT id, email, preview_id, status
         FROM public.orders
        WHERE stripe_session_id = $1
        LIMIT 1`,
      [session_id]
    );

    const order = r.rows?.[0];
    if (!order) {
      // Don’t 500 — report the situation so the client can retry or show a message
      return NextResponse.json({ ok: false, error: "Order not found for session_id" }, { status: 404 });
    }

    if (!order.email) {
      // Do NOT throw — tell the client we need an email capture flow
      return NextResponse.json({ ok: false, needEmail: true, error: "Missing destination email" }, { status: 200 });
    }
    if (!order.preview_id) {
      return NextResponse.json({ ok: false, error: "Missing preview_id" }, { status: 200 });
    }

    // Generate PDF (buffer) and email it
    const pdf = await generatePdfBuffer(order.preview_id);
    await sendReportEmail({
      to: order.email,
      subject: "Your GradeYour401k Report",
      pdfBuffer: pdf,
      filename: "GradeYour401k-Report.pdf",
    });

    // Optional: mark as emailed
    await sql(
      `UPDATE public.orders
          SET status = 'emailed'
        WHERE stripe_session_id = $1`,
      [session_id]
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[report generate-and-email] error:", err?.message || err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "report/generate-and-email" });
}
