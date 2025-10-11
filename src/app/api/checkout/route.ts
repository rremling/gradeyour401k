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
  // Preferred: explicit base URL set in env, must include scheme
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");

  // Vercel provides a host without scheme; add https://
  const vercelHost = process.env.VERCEL_URL; // e.g. "www.gradeyour401k.com"
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;

  // Fallback to request origin (works locally)
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    // Last resort
    return "http://localhost:3000";
  }
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

    const base = getBaseUrl(req); // <- always includes scheme
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: planKey === "annual" ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing`,
      metadata: { planKey, previewId },
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      // Only permitted in payment mode:
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
