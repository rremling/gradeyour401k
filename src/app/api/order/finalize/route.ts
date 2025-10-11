// src/app/api/order/finalize/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId =
      searchParams.get("session_id") ||
      searchParams.get("sessionId") ||
      "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id. Provide ?session_id=..." },
        { status: 400 }
      );
    }

    // TODO: fetch Stripe session with sessionId, ensure order exists in DB,
    // send the email/PDF if not already sent, etc.

    return NextResponse.json({ ok: true, sessionId });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Finalize failed" },
      { status: 500 }
    );
  }
}
