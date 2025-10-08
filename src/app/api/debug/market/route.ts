// src/app/api/debug/market/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    hasAlphaKey: !!process.env.ALPHA_VANTAGE_API_KEY,
  });
}
