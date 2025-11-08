// src/app/api/report/preview-pdf/route.ts
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { generatePdfBuffer } from "@/lib/pdf";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "",
  ssl: { rejectUnauthorized: false },
});

function parseRows(raw: unknown): Array<{ symbol: string; weight: number }> {
  if (Array.isArray(raw)) return raw as any[];
  try { return JSON.parse((raw as any) ?? "[]") } catch { return []; }
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const previewId = u.searchParams.get("previewId") || "";
  if (!previewId) {
    return NextResponse.json({ ok: false, error: "previewId required" }, { status: 400 });
  }

  const r = await pool.query(
    `SELECT provider, provider_display, profile, "rows", grade_base, grade_adjusted, created_at
       FROM public.previews WHERE id::text = $1 LIMIT 1`,
    [previewId]
  );
  const p = r.rows[0];
  if (!p) return NextResponse.json({ ok: false, error: "Preview not found" }, { status: 404 });

  // Pull live model + fear/greed (same endpoint your client uses)
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const q = new URLSearchParams({
    provider: p.provider_display || p.provider || "",
    profile: p.profile || "",
  }).toString();
  const modelRes = await fetch(`${base}/api/models/latest?${q}`, { cache: "no-store" });
  const model = modelRes.ok ? await modelRes.json() : null;

  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);
  const grade = toNum(p.grade_adjusted) ?? toNum(p.grade_base);
  const rows = parseRows(p.rows);

  const pdf = await generatePdfBuffer({
    provider: p.provider_display || p.provider || "",
    profile: p.profile || "",
    grade,
    holdings: rows,
    logoUrl: "https://i.imgur.com/DMCbj99.png",
    model_asof: model?.asof || null,
    model_lines: model?.lines || null,
    model_fear_greed: model?.fear_greed || null,
    reportDate: p.created_at || undefined,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="GradeYour401k.pdf"`,
    },
  });
}
