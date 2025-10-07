// src/app/api/stripe/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });

    const stripe = new Stripe(key, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(id);

    return NextResponse.json({
      id: session.id,
      mode: session.mode,
      amount_total: session.amount_total,
      currency: session.currency,
      email:
        session.customer_details?.email ||
        (session.customer_email as string) ||
        null,
      previewId: session.metadata?.previewId || null,
      planKey: session.metadata?.planKey || null,
      payment_status: session.payment_status,
      status: session.status,
    });
  } catch (e: any) {
    console.error("session lookup error:", e?.message || e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
