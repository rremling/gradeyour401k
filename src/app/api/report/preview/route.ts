// src/app/api/report/preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { generatePdfBuffer } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = ["Fidelity", "Vanguard", "Schwab", "Voya", "Other"] as const;
const PROFILES = ["Growth", "Balanced", "Conservative"] as const;

type Line = { symbol: string; weight: number; role: string | null };
type FG = { asof_date: string; reading: number };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") || "").trim();
  const profile = (url.searchParams.get("profile") || "").trim();

  if (!PROVIDERS.includes(provider as any) || !PROFILES.includes(profile as any)) {
    return NextResponse.json(
      { ok: false, error: "Invalid provider/profile" },
      { status: 400 }
    );
  }

  try {
    // 1) Find latest approved snapshot for provider/profile
    const snap = await query<{
      snapshot_id: string;
      asof_date: string;
    }>(
      `
      SELECT snapshot_id, asof_date
      FROM public.model_snapshots
      WHERE provider = $1 AND profile = $2 AND is_approved = true
      ORDER BY asof_date DESC
      LIMIT 1
      `,
      [provider, profile]
    );

    const snapshot = snap.rows?.[0];
    if (!snapshot) {
      return NextResponse.json(
        { ok: false, error: "No model snapshot found" },
        { status: 404 }
      );
    }

    // 2) Load lines for that snapshot
    const linesRes = await query<Line>(
      `
      SELECT symbol, weight, role
      FROM public.model_snapshot_lines
      WHERE snapshot_id = $1
      ORDER BY rank ASC
      `,
      [snapshot.snapshot_id]
    );

    const model_lines = (linesRes.rows || []).map((r) => ({
      symbol: r.symbol,
      weight: Number(r.weight), // FRACTION (0..1) as stored
      role: r.role,
    }));

    // 3) Latest Fear/Greed (best-effort)
    let model_fear_greed: FG | null = null;
    try {
      const fg = await query<FG>(
        `SELECT asof_date, reading FROM public.fear_greed ORDER BY asof_date DESC LIMIT 1`
      );
      if (fg.rows?.length) model_fear_greed = fg.rows[0];
    } catch {
      // table not present → fine; leave null (pdf.ts already has fallback)
      model_fear_greed = null;
    }

    // 4) Build PDF (no email), user holdings left empty on purpose
    const pdf = await generatePdfBuffer({
      provider,
      profile,
      grade: null,
      holdings: [],
      logoUrl: "https://i.imgur.com/DMCbj99.png",
      model_asof: snapshot.asof_date,
      model_lines,
      model_fear_greed,
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${provider}-${profile}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to build PDF" },
      { status: 500 }
    );
  }
}
