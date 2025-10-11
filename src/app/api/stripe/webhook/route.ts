// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME || "";
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || "";

/** Resolve an email from as many places as possible */
async function resolveEmail(session: Stripe.Checkout.Session): Promise<string | null> {
  // 1) Customer details collected by Checkout
  const cd = (session as any).customer_details as Stripe.Checkout.Session.CustomerDetails | null;
  if (cd?.email) return cd.email;

  // 2) Retrieve Customer if we got an ID
  if (typeof session.customer === "string" && session.customer) {
    try {
      const cust = await stripe.customers.retrieve(session.customer);
      if (!("deleted" in cust) && cust.email) return cust.email;
    } catch {/* ignore */}
  }

  // 3) Expand payment_intent.latest_charge to get billing_details.email
  try {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["payment_intent.latest_charge", "payment_intent.payment_method"],
    });
    const pi = expanded.payment_intent as Stripe.PaymentIntent | null;
    const latestCharge = (pi?.latest_charge ??
      (typeof pi?.latest_charge === "string" ? await stripe.charges.retrieve(pi!.latest_charge as string) : null)
    ) as Stripe.Charge | null;

    const chargeEmail = latestCharge?.billing_details?.email;
    if (chargeEmail) return chargeEmail;
  } catch {/* ignore */}

  // 4) Legacy / fallback fields
  const legacyEmail: any = (session as any).customer_email; // older Stripe field
  if (legacyEmail) return String(legacyEmail);

  return null;
}

export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  // Verify signature
  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature") as string;
    event = stripe.webhooks.constructEvent(rawBody, sig, SIGNING_SECRET);
  } catch (err: any) {
    console.error("[webhook] signature/parse failed:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ ok: true, ignored: event.type }, { status: 200 });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    // Expand to read line items if we need to infer plan
    const sessionFull = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price", "customer"],
    });

    // Metadata first
    let plan_key = (sessionFull.metadata?.plan_key || session.metadata?.plan_key || "").trim();
    let preview_id = (sessionFull.metadata?.preview_id || session.metadata?.preview_id || "").trim();

    // If plan_key missing, infer from price id(s)
    if (!plan_key) {
      const li = sessionFull.line_items?.data || [];
      const priceIds = li.map((x) => x.price?.id).filter(Boolean);
      if (priceIds.includes(PRICE_ONE_TIME)) plan_key = "one_time";
      else if (priceIds.includes(PRICE_ANNUAL)) plan_key = "annual";
    }

    // Resolve email robustly
    const email = await resolveEmail(sessionFull);

    // If we truly cannot determine a plan, do not insert a broken row
    if (!plan_key) {
      console.error("[webhook] missing plan_key; cannot insert");
      return NextResponse.json({ ok: false, error: "Missing plan_key" }, { status: 200 });
    }

    // Insert order; if we don’t have email yet, mark pending
    const status = email ? "completed" : "pending_email";

    await sql(
      `INSERT INTO public.orders (email, plan_key, status, preview_id, stripe_session_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, plan_key, status, preview_id || null, sessionFull.id]
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[webhook] saveOrder failed:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "stripe/webhook" });
}
