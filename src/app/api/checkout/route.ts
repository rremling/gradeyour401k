// src/app/api/checkout/route.ts
import Stripe from "stripe";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME || "";
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.gradeyour401k.com";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

type Body = {
  planKey?: "one_time" | "annual";
  previewId?: string;
  promotionCodeId?: string; // optional pre-validated code id
};

function missingEnv(): string[] {
  const m: string[] = [];
  if (!STRIPE_SECRET_KEY) m.push("STRIPE_SECRET_KEY");
  if (!PRICE_ONE_TIME) m.push("STRIPE_PRICE_ID_ONE_TIME");
  if (!PRICE_ANNUAL) m.push("STRIPE_PRICE_ID_ANNUAL");
  if (!SITE_URL) m.push("NEXT_PUBLIC_SITE_URL");
  return m;
}

export async function POST(req: NextRequest) {
  try {
    const missing = missingEnv();
    if (missing.length) {
      return Response.json(
        { error: `Missing env vars: ${missing.join(", ")}` },
        { status: 500 }
      );
    }
    if (!stripe) {
      return Response.json({ error: "Stripe not initialized" }, { status: 500 });
    }

    const body = (await req.json()) as Body;

    const planKey = body.planKey;
    const previewId = (body.previewId || "").trim();
    const promotionCodeId = (body.promotionCodeId || "").trim() || undefined;

    if (!planKey || !["one_time", "annual"].includes(planKey)) {
      return Response.json({ error: "Missing or invalid planKey" }, { status: 400 });
    }
    if (!previewId) {
      return Response.json(
        { error: "Missing previewId (save your grade first)" },
        { status: 400 }
      );
    }

    const mode: "payment" | "subscription" =
      planKey === "annual" ? "subscription" : "payment";

    const price = planKey === "annual" ? PRICE_ANNUAL : PRICE_ONE_TIME;
    if (!price) {
      return Response.json(
        { error: `Price ID not configured for plan: ${planKey}` },
        { status: 500 }
      );
    }

    // IMPORTANT: In subscription mode you CANNOT use customer_creation.
    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price, quantity: 1 }],

      // If you passed a pre-validated promotionCodeId from /pricing, attach it here.
      // Do NOT also set allow_promotion_codes when discounts are present.
      discounts: promotionCodeId ? [{ promotion_code: promotionCodeId }] : undefined,
      allow_promotion_codes: promotionCodeId ? undefined : true,

      success_url: `${SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/pricing`,

      // Webhook depends on these
      metadata: {
        plan_key: planKey, // "one_time" | "annual"
        preview_id: previewId, // your saved grade id
      },

      // Collect an email; only allowed in payment mode
      customer_creation: mode === "payment" ? "always" : undefined,
    });

    return Response.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    // Bubble up a clear reason to the UI and log full details to Vercel
    const msg =
      err?.raw?.message || // Stripe APIError shape
      err?.message ||
      "Checkout failed";
    console.error("[checkout] error:", err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
