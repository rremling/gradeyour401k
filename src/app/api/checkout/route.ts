// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl() {
  // Prefer explicit public base url in prod (Vercel)
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  // Fallbacks for dev
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planKey = (body?.planKey as "one_time" | "annual") || "one_time";
    const previewId = (body?.previewId as string | undefined) || "";
    const promoCodeText = (body?.promo as string | undefined)?.trim();

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    // Price selection
    const priceOneTime =
      process.env.STRIPE_PRICE_ID_ONE_TIME ||
      process.env.STRIPE_PRICE_ID_DEFAULT;
    const priceAnnual = process.env.STRIPE_PRICE_ID_ANNUAL;

    const isSubscription = planKey === "annual";
    const priceId = isSubscription ? priceAnnual : priceOneTime;
    if (!priceId) {
      return NextResponse.json(
        {
          error: isSubscription
            ? "Missing STRIPE_PRICE_ID_ANNUAL"
            : "Missing STRIPE_PRICE_ID_ONE_TIME (or STRIPE_PRICE_ID_DEFAULT)",
        },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
    const origin = getBaseUrl();

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        planKey,
        previewId: previewId || "",
      },
      allow_promotion_codes: true,
    };

    // IMPORTANT: only for payment mode
    if (!isSubscription) {
      // @ts-expect-error: valid for payment mode only
      params.customer_creation = "always";
    }

    // Optionally pre-apply a promotion code by text, if provided
    if (promoCodeText) {
      const promos = await stripe.promotionCodes.list({
        code: promoCodeText,
        active: true,
        limit: 1,
      });
      if (promos.data.length) {
        params.discounts = [{ promotion_code: promos.data[0].id }];
      }
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to start Checkout" },
      { status: 500 }
    );
  }
}
