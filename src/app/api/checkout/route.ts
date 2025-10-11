// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME || process.env.STRIPE_PRICE_ID_DEFAULT;
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL;

if (!stripeSecret) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(stripeSecret, {
  apiVersion: "2024-06-20",
});

type Body = {
  planKey?: "one_time" | "annual";
  previewId?: string;
  promotionCodeId?: string; // optional Stripe Promotion Code id
};

export async function POST(req: Request) {
  try {
    const { planKey, previewId, promotionCodeId } = (await req.json()) as Body;

    if (!planKey || (planKey !== "one_time" && planKey !== "annual")) {
      return NextResponse.json({ error: "Invalid planKey" }, { status: 400 });
    }
    if (!previewId) {
      return NextResponse.json({ error: "Missing previewId" }, { status: 400 });
    }

    // Choose price & mode
    const priceId =
      planKey === "one_time" ? PRICE_ONE_TIME : PRICE_ANNUAL;

    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe price id for plan ${planKey}. Set STRIPE_PRICE_ID_ONE_TIME / STRIPE_PRICE_ID_ANNUAL.` },
        { status: 500 }
      );
    }

    const mode: "payment" | "subscription" =
      planKey === "one_time" ? "payment" : "subscription";

    // Base session params (shared)
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // IMPORTANT: pass session_id to success page
      success_url: `https://www.gradeyour401k.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://www.gradeyour401k.com/pricing`,
      // Keep the metadata small & clear; webhook will read these
      metadata: {
        plan_key: planKey,
        preview_id: previewId,
      },
    };

    // Apply promotions per Stripe rules:
    // - EITHER `discounts` (when we already validated and have a promotion_code id)
    // - OR `allow_promotion_codes: true` (let user type one at checkout)
    if (promotionCodeId) {
      (sessionParams as any).discounts = [{ promotion_code: promotionCodeId }];
    } else {
      (sessionParams as any).allow_promotion_codes = true;
    }

    // Create session
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session?.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[checkout] error:", err);
    const msg =
      typeof err?.message === "string"
        ? err.message
        : "Checkout failed. Please try again.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// (Optional) GET: quick ping for health checks
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/checkout" });
}
