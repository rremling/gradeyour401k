// src/app/api/checkout/validate-promo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json().catch(() => ({}));
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ ok: true, valid: false }, { status: 200 });
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
    const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });

    if (!promos.data.length) {
      return NextResponse.json({ ok: true, valid: false });
    }

    const pc = promos.data[0];
    // Expose coupon details needed for price estimation
    const c = pc.coupon;
    return NextResponse.json({
      ok: true,
      valid: true,
      promotionCodeId: pc.id,
      code: pc.code,
      coupon: {
        percent_off: c.percent_off ?? null,
        amount_off: c.amount_off ?? null,      // in smallest currency unit (e.g., cents)
        currency: c.currency ?? "usd",
        duration: c.duration,                   // once | repeating | forever
      },
    });
  } catch (e: any) {
    console.error("validate-promo error:", e?.message || e);
    return NextResponse.json({ ok: false, valid: false }, { status: 500 });
  }
}
