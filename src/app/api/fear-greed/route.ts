// src/app/api/fear-greed/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Normalizes upstream providers to { value: 0..100 }.
 * Currently passes through Alternative.me's latest crypto F&G.
 */
export async function GET() {
  try {
    const upstream = "https://api.alternative.me/fng/?limit=1&format=json";
    const r = await fetch(upstream, { cache: "no-store" });
    if (!r.ok) throw new Error(`Upstream ${r.status}`);
    const j = await r.json();
    const raw = Array.isArray(j?.data) && j.data.length ? Number(j.data[0]?.value) : NaN;
    const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 50;
    return NextResponse.json({ value });
  } catch {
    // Soft-fail to a neutral reading if upstream is down
    return NextResponse.json({ value: 50 }, { status: 200 });
  }
}
