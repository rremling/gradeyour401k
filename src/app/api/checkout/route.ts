// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME!;
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL!;
const DOMAIN =
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.VERCEL_URL?.startsWith("http")
    ? process.env.VERCEL_URL
    : `https://${process.env.VERCEL_URL || "www.gradeyour401k.com"}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const planKey = body.planKey as "one_time" | "annual";
    const previewId = String(body.previewId || "");
    const promotionCodeId = body.promotionCodeId as string | undefined;

    if (!planKey || !previewId) {
      return NextResponse.json(
        { error: "Missing planKey or previewId" },
        { status: 400 }
      );
    }

    const price = planKey === "annual" ? PRICE_ANNUAL : PRICE_ONE_TIME;
    if (!price) {
      return NextResponse.json(
        { error: `Missing Stripe price for planKey=${planKey}` },
        { status: 500 }
      );
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: planKey === "annual" ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/pricing`,
      // REQUIRED: include metadata that webhook will persist
      metadata: {
        planKey,
        previewId,
      },
      // Optional promo code (use either allow_promotion_codes OR discounts)
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      // Make sure we get the email in the session object
      customer_creation:
        planKey === "annual" ? undefined : "always" /* only in payment mode */,
    };

    // Note: Stripe restricts `customer_creation` to payment mode.
    if (planKey === "annual") {
      // remove any accidental customer_creation if set
      // (not needed here since we conditionally set above)
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Checkout failed: ${err.message || "unknown"}` },
      { status: 500 }
    );
  }
}
