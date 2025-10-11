// src/app/api/checkout/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME || ""; // e.g. price_live_...
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || ""; // e.g. price_live_...
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gradeyour401k.com";

if (!STRIPE_SECRET_KEY) console.warn("[checkout] Missing STRIPE_SECRET_KEY");
if (!PRICE_ONE_TIME) console.warn("[checkout] Missing STRIPE_PRICE_ID_ONE_TIME");
if (!PRICE_ANNUAL) console.warn("[checkout] Missing STRIPE_PRICE_ID_ANNUAL");

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

type Body = {
  planKey?: "one_time" | "annual";
  previewId?: string;
  promotionCodeId?: string; // optional, pre-validated on pricing page
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    // Validate required fields
    const planKey = body.planKey;
    const previewId = (body.previewId || "").trim();

    if (!planKey || !["one_time", "annual"].includes(planKey)) {
      return Response.json({ error: "Missing or invalid planKey" }, { status: 400 });
    }
    if (!previewId) {
      return Response.json({ error: "Missing previewId (save your grade first)" }, { status: 400 });
    }

    const mode = planKey === "annual" ? "subscription" : "payment";
    const price = planKey === "annual" ? PRICE_ANNUAL : PRICE_ONE_TIME;

    if (!price) {
      return Response.json({ error: "Price ID not configured for this plan" }, { status: 500 });
    }

    // Optional promotion code
    const discounts =
      body.promotionCodeId ? [{ promotion_code: body.promotionCodeId }] : undefined;

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price, quantity: 1 }],
      discounts, // use either discounts OR allow_promotion_codes (not both)
      allow_promotion_codes: !discounts, // allow manual entry if none was pre-applied
      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing`,
      // CRITICAL: include the metadata your webhook expects
      metadata: {
        plan_key: planKey, // "one_time" | "annual"
        preview_id: previewId, // saved grade id (localStorage -> pricing -> here)
      },
      // Optional: collect the email on Stripe Checkout
      customer_creation: mode === "payment" ? "always" : undefined, // payment-only
      // If you’re doing subscriptions, customer_creation is not allowed; omit for annual
    });

    return Response.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error("[checkout] error:", err?.message || err);
    return Response.json({ error: "Checkout failed" }, { status: 500 });
  }
}
