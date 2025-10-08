// TEMP webhook: only verifies signature, logs, returns 200
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return new NextResponse("Config error", { status: 500 });

  try {
    const raw = await req.text(); // IMPORTANT: raw body
    const sig = req.headers.get("stripe-signature") as string;
    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    const event = stripe.webhooks.constructEvent(raw, sig, secret);

    console.log("[webhook OK]", event.id, event.type);
    return NextResponse.json({ received: true }); // Always 200 for now
  } catch (err: any) {
    console.error("[webhook FAIL]", err?.message || err);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }
}
