// src/app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function env(name: string) {
  return process.env[name] || "";
}

function safeBaseUrl() {
  // Prefer explicit; fall back to Vercel provided URL if available
  return (
    env("NEXT_PUBLIC_BASE_URL") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const planKey = (body?.planKey as "one_time" | "annual") || "one_time";
    const previewId = (body?.previewId as string) || "";

    const secret = env("STRIPE_SECRET_KEY");
    if (!secret) {
      return NextResponse.json(
        { error: "Missing STRIPE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const priceOne = env("STRIPE_PRICE_ID_ONE_TIME");
    const priceAnnual = env("STRIPE_PRICE_ID_ANNUAL");

    const priceId =
      planKey === "annual" ? priceAnnual || priceOne : priceOne;

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe priceId: set STRIPE_PRICE_ID_ONE_TIME / STRIPE_PRICE_ID_ANNUAL" },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });

    const origin = safeBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: planKey === "annual" ? "subscription" : "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success`,
      cancel_url: `${origin}/pricing`,
      metadata: { planKey, previewId },
      // Optional: collect email on checkout
      customer_creation: "always"
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("checkout error:", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
