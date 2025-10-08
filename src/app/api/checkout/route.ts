// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planKey = (body?.planKey as "one_time" | "annual") || "one_time";
    const previewId = (body?.previewId as string | undefined) || "";
    const promotionCodeId = (body?.promotionCodeId as string | undefined) || undefined;

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const priceOneTime = process.env.STRIPE_PRICE_ID_ONE_TIME || process.env.STRIPE_PRICE_ID_DEFAULT;
    const priceAnnual = process.env.STRIPE_PRICE_ID_ANNUAL;

    const isSubscription = planKey === "annual";
    const priceId = isSubscription ? priceAnnual : priceOneTime;
    if (!priceId) {
      return NextResponse.json(
        { error: isSubscription ? "Missing STRIPE_PRICE_ID_ANNUAL" : "Missing STRIPE_PRICE_ID_ONE_TIME (or STRIPE_PRICE_ID_DEFAULT)" },
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
      metadata: { planKey, previewId: previewId || "" },
    };

    // customer_creation is ONLY allowed in payment mode
    if (!isSubscription) {
      // @ts-expect-error: allowed in payment mode
      params.customer_creation = "always";
    }

    // Set EXACTLY one of these:
    if (promotionCodeId) {
      params.discounts = [{ promotion_code: promotionCodeId }];
    } else {
      params.allow_promotion_codes = true;
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    // Surface Stripe error message so UI shows the actual cause
    const msg =
      err?.raw?.message ||
      err?.message ||
      "Failed to start Checkout";
    console.error("checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
