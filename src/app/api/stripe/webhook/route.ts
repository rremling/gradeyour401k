// TEMP webhook: responds to GET and POST so we can verify reachability
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Let you hit it in the browser without a 405
  return NextResponse.json({ ok: true, method: "GET" });
}

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    const raw = Buffer.from(await req.arrayBuffer()); // read body to confirm we can access it
    console.log("[webhook/TEMP] bytes:", raw.length, "sig?", !!sig);
    return NextResponse.json({ ok: true, method: "POST", gotSig: !!sig });
  } catch (e: any) {
    console.error("[webhook/TEMP] error:", e?.message || e);
    return new NextResponse("fail", { status: 500 });
  }
}
