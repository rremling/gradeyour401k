// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

type Body = {
  planKey: "one_time" | "annual";
  previewId: string;
  promotionCodeId?: string;
};

const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME!; // e.g. price_...
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL!; // e.g. price_...

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gradeyour401k.com";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.planKey) {
      return NextResponse.json({ error: "Missing planKey" }, { status: 400 });
    }
    if (!body?.previewId) {
      return NextResponse.json({ error: "Missing previewId" }, { status: 400 });
    }

    const isOneTime = body.planKey === "one_time";
    const priceId = isOneTime ? PRICE_ONE_TIME : PRICE_ANNUAL;
    if (!priceId) {
      return NextResponse.json({ error: "Price ID not configured" }, { status: 500 });
    }

    // Use payment for one-time, subscription for annual
    const mode: Stripe.Checkout.SessionCreateParams.Mode = isOneTime ? "payment" : "subscription";

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined =
      body.promotionCodeId ? [{ promotion_code: body.promotionCodeId }] : undefined;

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing?canceled=1`,
      // ✅ Carry plan & preview so the webhook can store them
      metadata: {
        plan_key: body.planKey, // <— IMPORTANT
        preview_id: body.previewId, // <— IMPORTANT
      },
      // If you need an email later and no customer is created, enable this:
      customer_creation: isOneTime ? "if_required" : undefined, // only valid in payment mode
      allow_promotion_codes: !body.promotionCodeId ? true : undefined,
      discounts,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Checkout failed: ${err?.message || "unknown"}` },
      { status: 500 }
    );
  }
}
