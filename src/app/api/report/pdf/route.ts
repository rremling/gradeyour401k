import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generatePdfBuffer } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Load a preview by id (text)
async function loadPreview(previewId: string) {
  const r: any = await query(
    `SELECT id, provider, provider_display, profile, "rows", grade_base, grade_adjusted, created_at
       FROM public.previews
      WHERE id::text = $1
      LIMIT 1`,
    [previewId]
  );
  const rows = Array.isArray(r?.rows) ? r.rows : (Array.isArray(r) ? r : []);
  return rows[0] ?? null;
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const previewId = url.searchParams.get("previewId") || url.searchParams.get("preview_id");
    if (!previewId) {
      return new NextResponse("Missing previewId", { status: 400 });
    }

    const preview = await loadPreview(previewId);
    if (!preview) {
      return new NextResponse("Preview not found", { status: 404 });
    }

    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const grade = toNum(preview.grade_adjusted) ?? toNum(preview.grade_base);
    const holdings = parseRows(preview.rows);

    const pdfBytes = await generatePdfBuffer({
      provider: preview.provider_display || preview.provider || "",
      profile: preview.profile || "",
      grade,
      holdings,
      logoUrl: "https://i.imgur.com/DMCbj99.png",
      clientName: preview.profile || undefined,
      reportDate: preview.created_at || undefined,
    });

    const filename = `GradeYour401k-${String(preview.profile || "Report")}-${previewId}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e: any) {
    console.error("[report/pdf] error:", e?.message || e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
