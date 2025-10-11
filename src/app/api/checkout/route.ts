// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.gradeyour401k.com";

const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME!;
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL!;

export async function POST(req: NextRequest) {
  try {
    const { planKey, previewId, promotionCodeId } = await req.json();

    if (!planKey || !previewId) {
      return NextResponse.json(
        { error: "Missing planKey or previewId" },
        { status: 400 }
      );
    }

    const priceId =
      planKey === "annual"
        ? PRICE_ANNUAL
        : planKey === "one_time"
        ? PRICE_ONE_TIME
        : null;

    if (!priceId) {
      return NextResponse.json({ error: "Invalid planKey" }, { status: 400 });
    }

    // Build params so we only include ONE of the promo fields.
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing`,
      metadata: {
        plan_key: planKey,
        preview_id: previewId,
      },
    };

    if (promotionCodeId && String(promotionCodeId).trim() !== "") {
      // Use an explicit promotion code -> set discounts, DO NOT set allow_promotion_codes
      params.discounts = [{ promotion_code: String(promotionCodeId) }];
    } else {
      // Let the customer enter a code at checkout -> set allow_promotion_codes, DO NOT set discounts
      params.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("[checkout] failed:", err);
    return NextResponse.json(
      { error: "Checkout failed. " + (err?.message || "") },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "checkout" });
}
