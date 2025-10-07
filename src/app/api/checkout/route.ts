// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Helper to read envs safely */
function env(name: string) {
  return process.env[name] || "";
}

/** Build a safe base URL for redirect links */
function safeBaseUrl() {
  return (
    env("NEXT_PUBLIC_BASE_URL") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planKey = (body?.planKey as "one_time" | "annual") || "one_time";
    const previewId = (body?.previewId as string) || "";

    const secret = env("STRIPE_SECRET_KEY");
    if (!secret) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const priceOne = env("STRIPE_PRICE_ID_ONE_TIME");   // one-time price id (payment)
    const priceAnnual = env("STRIPE_PRICE_ID_ANNUAL");  // recurring price id (subscription)

    const isSubscription = planKey === "annual";
    const priceId = isSubscription ? priceAnnual : priceOne;

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe priceId: set STRIPE_PRICE_ID_ONE_TIME / STRIPE_PRICE_ID_ANNUAL" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
    const origin = safeBaseUrl();

    // Base params
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      // Include session_id in success URL so /success can fetch details
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { planKey, previewId },
      allow_promotion_codes: true, // let users enter your promo code
    };

    // Stripe only allows customer_creation in payment mode
    if (!isSubscription) {
      // @ts-expect-error - field is valid for payment mode
      params.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}
