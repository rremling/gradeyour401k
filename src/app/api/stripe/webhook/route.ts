// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const raw = Buffer.from(await req.arrayBuffer());
  console.log("[webhook/min] bytes:", raw.length, "sig?", !!sig);
  return NextResponse.json({ ok: true });
}
