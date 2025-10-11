// src/app/api/checkout/debug/route.ts
export const dynamic = "force-dynamic";

export async function GET() {
  const expose = {
    hasSecret: !!process.env.STRIPE_SECRET_KEY,
    hasOneTime: !!process.env.STRIPE_PRICE_ID_ONE_TIME,
    hasAnnual: !!process.env.STRIPE_PRICE_ID_ANNUAL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    nodeEnv: process.env.NODE_ENV || null,
  };
  return Response.json(expose, { status: 200 });
}
