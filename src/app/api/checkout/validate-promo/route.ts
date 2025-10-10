// src/app/api/checkout/validate-promo/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code || typeof code !== "string") {
      return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 });
    }

    const sk = process.env.STRIPE_SECRET_KEY;
    if (!sk) {
      return NextResponse.json({ ok: false, error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(sk, { apiVersion: "2024-06-20" });

    // Find an ACTIVE promotion code that matches
    const list = await stripe.promotionCodes.list({
      code: code.trim(),
      active: true,
      limit: 1,
      expand: ["data.coupon"],
    });

    if (!list.data.length) {
      return NextResponse.json({ ok: false, error: "Invalid or inactive code" }, { status: 404 });
    }

    const promo = list.data[0];

    // Optional: sanity-check restrictions (commented out by default)
    // If you restrict to specific prices, you can check:
    // const priceIds = new Set([
    //   process.env.STRIPE_PRICE_ID_ONE_TIME,
    //   process.env.STRIPE_PRICE_ID_ANNUAL,
    // ].filter(Boolean) as string[]);
    // if (promo.restrictions?.applies_to?.prices?.length) {
    //   const allowed = promo.restrictions.applies_to.prices.some(p => priceIds.has(p));
    //   if (!allowed) {
    //     return NextResponse.json({ ok: false, error: "Code not valid for this item" }, { status: 400 });
    //   }
    // }

    return NextResponse.json({
      ok: true,
      promotionCode: {
        id: promo.id,
        code: promo.code,
        coupon: {
          id: promo.coupon.id,
          percent_off: promo.coupon.percent_off ?? null,
          amount_off: promo.coupon.amount_off ?? null, // cents
          currency: promo.coupon.currency ?? null,
        },
      },
    });
  } catch (e: any) {
    const msg = e?.raw?.message || e?.message || "Failed to validate code";
    console.error("[validate-promo]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
