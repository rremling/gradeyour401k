// src/app/api/checkout/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // ensure this runs on the server

// Ensure you set STRIPE_SECRET_KEY in Vercel Env (Project Settings → Environment Variables)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-09-30.acacia", // ok to use latest available in your SDK
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const priceId: string = body?.priceId || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || "";
    const metadata: Record<string, string> = body?.metadata || {};

    if (!priceId) {
      return new NextResponse("Missing Stripe priceId", { status: 400 });
    }

    // Prefer explicit base URL via env; fall back to Vercel URL
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL?.startsWith("http")
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL}`;

    const successUrl = `${baseUrl}/success`;
    const cancelUrl = `${baseUrl}/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return new NextResponse(err?.message || "Checkout error", { status: 500 });
  }
}
