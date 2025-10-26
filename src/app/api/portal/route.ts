import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { verifyAccountToken } from "@/lib/auth";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export const dynamic = "force-dynamic";

// Finds a customer by email in your orders table; adapt if you store differently
async function getStripeCustomerIdForEmail(email: string): Promise<string | null> {
  const r = await query<{ stripe_customer_id: string }>(
    `SELECT stripe_customer_id
       FROM public.orders
      WHERE email = $1
        AND plan_key = 'annual'
      ORDER BY created_at DESC
      LIMIT 1`,
    [email]
  );
  const rows = Array.isArray((r as any)?.rows) ? (r as any).rows : (Array.isArray(r) ? r : []);
  return rows[0]?.stripe_customer_id || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("acct")?.value || "";
    const claims = await verifyAccountToken(token);
    if (!claims) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = claims.email;
    const customerId = await getStripeCustomerIdForEmail(email);
    if (!customerId) return NextResponse.json({ error: "No Stripe customer found" }, { status: 404 });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${BASE_URL}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "error" }, { status: 500 });
  }
}
