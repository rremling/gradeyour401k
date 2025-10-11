// /src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

type Body = {
  planKey: "one_time" | "annual";
  previewId?: string | null;
  promotionCodeId?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.planKey) {
      return NextResponse.json({ error: "Missing planKey" }, { status: 400 });
    }
    if (!body?.previewId) {
      // we require a saved preview to personalize the PDF
      return NextResponse.json({ error: "Missing previewId" }, { status: 400 });
    }

    const priceOneTime = process.env.STRIPE_PRICE_ID_ONE_TIME;
    const priceAnnual = process.env.STRIPE_PRICE_ID_ANNUAL;
    if (!priceOneTime || !priceAnnual) {
      return NextResponse.json(
        { error: "Missing Stripe price IDs on server" },
        { status: 500 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      req.headers.get("origin") ||
      "https://www.gradeyour401k.com";

    // Build the line item and mode
    const isOneTime = body.planKey === "one_time";
    const price = isOneTime ? priceOneTime : priceAnnual;

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: isOneTime ? "payment" : "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        plan_key: body.planKey,
        preview_id: String(body.previewId),
      },
    };

    // Apply a validated promotion code if present
    if (body.promotionCodeId) {
      params.discounts = [{ promotion_code: body.promotionCodeId }];
    }

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("[checkout] error:", err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 400 }
    );
  }
}
