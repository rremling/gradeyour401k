// src/app/api/checkout/route.ts
// Creates a Stripe Checkout session for one-time or annual.
// Needs env in Vercel (Production):
// - STRIPE_SECRET_KEY = sk_live_...
// - STRIPE_PRICE_ID_ONE_TIME = price_.... (one-time)
// - STRIPE_PRICE_ID_ANNUAL = price_.... (recurring)
// (Optional) NEXT_PUBLIC_SITE_URL if you host behind a proxy/domain.

import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  planKey: "one_time" | "annual";
  previewId?: string | null;
  promotionCodeId?: string | null; // Stripe Promotion Code id (not the code text)
};

// Helper to get absolute site origin (fallback to Vercel URL headers if needed)
function getOrigin(req: Request): string {
  // Honor NEXT_PUBLIC_SITE_URL if you set it
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  // Otherwise derive from request headers
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: "Missing STRIPE_SECRET_KEY" }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }
    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
    });

    const body = (await req.json()) as Body;

    const planKey = body.planKey;
    const previewId = (body.previewId || "").toString();
    const promotionCodeId = body.promotionCodeId || undefined;

    if (!planKey || (planKey !== "one_time" && planKey !== "annual")) {
      return new Response(JSON.stringify({ error: "Invalid planKey" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    if (!previewId) {
      return new Response(JSON.stringify({ error: "Missing previewId" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const priceOneTime = process.env.STRIPE_PRICE_ID_ONE_TIME;
    const priceAnnual = process.env.STRIPE_PRICE_ID_ANNUAL;

    if (!priceOneTime || !priceAnnual) {
      return new Response(
        JSON.stringify({
          error:
            "Missing STRIPE_PRICE_ID_ONE_TIME and/or STRIPE_PRICE_ID_ANNUAL env vars",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    const origin = getOrigin(req);

    // Build common options
    const common: Stripe.Checkout.SessionCreateParams = {
      mode: planKey === "one_time" ? "payment" : "subscription",
      line_items: [
        {
          price: planKey === "one_time" ? priceOneTime : priceAnnual,
          quantity: 1,
        },
      ],
      // If we got a specific promotion code id, pass it in `discounts`.
      // Otherwise, allow user to type codes at checkout.
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),

      // Attach metadata so the webhook can persist order rows
      metadata: {
        plan_key: planKey,
        preview_id: previewId,
      },

      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
    };

    const session = await stripe.checkout.sessions.create(common);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    const msg =
      err?.message || (typeof err === "string" ? err : "Checkout failed");
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
