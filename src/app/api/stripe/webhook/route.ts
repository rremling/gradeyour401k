// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
// Adjust this import path if your project structure differs:
import { sql } from "../../../../lib/db"; // from /src/app/api/stripe/webhook/route.ts to /src/lib/db.ts

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

const SIGNING_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

// Used if metadata is missing to infer plan from price ID(s)
const PRICE_ONE_TIME = process.env.STRIPE_PRICE_ID_ONE_TIME || "";
const PRICE_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL || "";

export async function POST(req: NextRequest) {
  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    const sig = req.headers.get("stripe-signature") as string;
    event = stripe.webhooks.constructEvent(rawBody, sig, SIGNING_SECRET);
  } catch (err: any) {
    console.error("[webhook] signature/parse failed:", err?.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Expand to read line items if we need to infer the plan
      const sessionFull = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items.data.price.product", "customer"],
      });

      // 1) metadata first (authoritative)
      let plan_key = (sessionFull.metadata?.plan_key || session.metadata?.plan_key || "").trim();
      let preview_id = (sessionFull.metadata?.preview_id || session.metadata?.preview_id || "").trim();

      // 2) If plan_key missing, infer from line items’ price IDs
      if (!plan_key) {
        const li = sessionFull.line_items?.data || [];
        const priceIds = li.map((x) => x.price?.id).filter(Boolean);
        if (priceIds.includes(PRICE_ONE_TIME)) plan_key = "one_time";
        else if (priceIds.includes(PRICE_ANNUAL)) plan_key = "annual";
      }

      // Pull email if available
      const email =
        sessionFull.customer_details?.email ||
        (typeof sessionFull.customer === "object" ? sessionFull.customer?.email : null) ||
        null;

      // Fallbacks
      if (!plan_key) {
        console.error("[webhook] missing plan_key; cannot insert");
        return NextResponse.json({ ok: false, error: "Missing plan_key" }, { status: 200 });
      }

      // Insert order
      // Ensure your 'orders' table has columns:
      // id (PK), email, plan_key, status, preview_id, stripe_session_id, created_at (default now()), next_due_1 (nullable)
      await sql(
        `INSERT INTO public.orders (email, plan_key, status, preview_id, stripe_session_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [email, plan_key, "completed", preview_id || null, sessionFull.id]
      );

      // Optionally: trigger initial PDF generation here or rely on /success finalize
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Ignore other events
    return NextResponse.json({ ok: true, ignored: event.type }, { status: 200 });
  } catch (err: any) {
    console.error("[webhook] saveOrder failed:", err);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}

export async function GET() {
  // Simple health ping
  return NextResponse.json({ ok: true, endpoint: "stripe/webhook" });
}
