// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME!;
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL!;

/** Get a fully-qualified base URL with scheme */
function getBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");

  const vercelHost = process.env.VERCEL_URL; // e.g. "www.gradeyour401k.com"
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;

  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const planKey = body.planKey as "one_time" | "annual";
    const previewId = String(body.previewId || "");
    const promotionCodeId = body.promotionCodeId as string | undefined;

    if (!planKey || !previewId) {
      return NextResponse.json({ error: "Missing planKey or previewId" }, { status: 400 });
    }

    const price = planKey === "annual" ? PRICE_ANNUAL : PRICE_ONE_TIME;
    if (!price) {
      return NextResponse.json(
        { error: `Missing Stripe price for planKey=${planKey}` },
        { status: 500 }
      );
    }

    const base = getBaseUrl(req);

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: planKey === "annual" ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      // IMPORTANT: use sessionId (camelCase) to match your report API
      success_url: `${base}/success?session_Id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      // IMPORTANT: use snake_case to match your webhook reader
      metadata: { plan_key: planKey, preview_id: previewId },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      ...(planKey === "one_time" ? { customer_creation: "always" } : {}),
    };

    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Checkout failed: ${err?.message || "unknown"}` },
      { status: 500 }
    );
  }
}
