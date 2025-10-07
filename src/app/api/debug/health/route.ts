export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      env: {
        STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
        STRIPE_PRICE_ID_ONE_TIME: !!process.env.STRIPE_PRICE_ID_ONE_TIME,
        STRIPE_PRICE_ID_ANNUAL: !!process.env.STRIPE_PRICE_ID_ANNUAL,
        STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || null,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        DATABASE_URL: !!process.env.DATABASE_URL,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
}
