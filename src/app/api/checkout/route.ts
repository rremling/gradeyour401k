// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

// Existing products
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME!;
const PRICE_ANNUAL   = process.env.STRIPE_PRICE_ID_ANNUAL!;

// NEW: 30-min review ($149 one-time)
// Prefer STRIPE_PRICE_ID_REVIEW if present; fall back to STRIPE_PRICE_401K_REVIEW (your live var)
const PRICE_REVIEW =
  process.env.STRIPE_PRICE_ID_REVIEW ||
  process.env.STRIPE_PRICE_401K_REVIEW || "";

// Types for planKey
type PlanKey = "one_time" | "annual" | "review";

// Resolve base URL (Vercel-aware)
function getBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/+$/, "");
  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const planKey = body.planKey as PlanKey;
    const previewId = body.previewId ? String(body.previewId) : "";
    const promotionCodeId = body.promotionCodeId as string | undefined; // optional, to auto-apply a promo code
    const email = (body.email as string | undefined) || undefined;       // optional, to prefill Checkout email

    if (!planKey) {
      return NextResponse.json({ error: "Missing planKey" }, { status: 400 });
    }

    // Choose price/mode/redirects per plan
    let price = "";
    let mode: Stripe.Checkout.SessionCreateParams.Mode = "payment";
    let successUrl = "";
    let cancelUrl = "";

    const base = getBaseUrl(req);

    if (planKey === "review") {
      // $149 consult → success goes to /upload with session_id
      if (!PRICE_REVIEW) {
        return NextResponse.json({ error: "Missing Stripe price for planKey=review" }, { status: 500 });
      }
      price = PRICE_REVIEW;
      mode = "payment";
      successUrl = `${base}/upload?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl  = `${base}/review`;
    } else if (planKey === "one_time") {
      if (!previewId) {
        return NextResponse.json({ error: "Missing previewId for one_time" }, { status: 400 });
      }
      if (!PRICE_ONE_TIME) {
        return NextResponse.json({ error: "Missing Stripe price for planKey=one_time" }, { status: 500 });
      }
      price = PRICE_ONE_TIME;
      mode = "payment";
      successUrl = `${base}/success/?session_id={CHECKOUT_SESSION_ID}`; // keep existing success for report purchase
      cancelUrl  = `${base}/pricing`;
    } else if (planKey === "annual") {
      if (!previewId) {
        return NextResponse.json({ error: "Missing previewId for annual" }, { status: 400 });
      }
      if (!PRICE_ANNUAL) {
        return NextResponse.json({ error: "Missing Stripe price for planKey=annual" }, { status: 500 });
      }
      price = PRICE_ANNUAL;
      mode = "subscription";
      successUrl = `${base}/success/?session_id={CHECKOUT_SESSION_ID}`;
      cancelUrl  = `${base}/pricing`;
    } else {
      return NextResponse.json({ error: `Unknown planKey: ${planKey}` }, { status: 400 });
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [{ price, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email, // optional prefill
      // If you pass promotionCodeId, we apply it; else we allow the code field on Checkout
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
      // Keep prior behavior for one_time (creates a Customer record)
      ...(planKey === "one_time" ? { customer_creation: "always" } : {}),
      metadata: {
        plan_key: planKey,
        ...(previewId ? { preview_id: previewId } : {}),
        product: planKey === "review" ? "401k_review_call" : "grade_your_401k",
      },
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
