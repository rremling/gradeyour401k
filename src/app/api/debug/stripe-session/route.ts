// src/app/api/debug/stripe-session/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id"); // Checkout Session id (cs_...)
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  try {
    const sess = await stripe.checkout.sessions.retrieve(id, {
      expand: ["customer", "payment_intent.latest_charge", "line_items.data.price"],
    });

    const emailCandidates = {
      customer_details_email: (sess as any)?.customer_details?.email || null,
      customer_email_on_session: (sess as any)?.customer_email || null,
      customer_object_email:
        typeof sess.customer !== "string" && sess.customer && "deleted" in sess.customer === false
          ? (sess.customer as any).email || null
          : null,
      charge_billing_email:
        (sess.payment_intent as any)?.latest_charge?.billing_details?.email || null,
      mode: sess.mode,
      line_item_price_ids: (sess.line_items?.data || []).map((li) => li.price?.id || null),
      metadata: sess.metadata || null,
    };

    return NextResponse.json({ ok: true, session_id: sess.id, emailCandidates }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Stripe error" }, { status: 500 });
  }
}
