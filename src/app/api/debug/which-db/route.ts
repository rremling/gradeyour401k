// src/app/api/debug/which-db/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? "present" : "missing",
    hostHint: process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] || null,
    nodeEnv: process.env.NODE_ENV,
  });
}
