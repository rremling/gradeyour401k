import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "../../../../lib/db";
import { sendOrderEmail } from "../../../../lib/email";

export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[webhook] Missing signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const buf = await req.text();
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const email = session.customer_details?.email || "";
        const preview_id = session.metadata?.previewId || "";
        const plan_key = session.metadata?.planKey || "one_time";
        const stripe_session_id = session.id;

        console.log("[webhook] Checkout completed for:", email, plan_key);

        // Save order in Neon
        try {
          await sql(
            `INSERT INTO public.orders (email, plan_key, status, preview_id, stripe_session_id, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [email, plan_key, "paid", preview_id, stripe_session_id]
          );
          console.log("[webhook] Order saved:", email);
        } catch (dbErr) {
          console.error("[webhook] saveOrder failed:", dbErr);
        }

        // Send order email
        try {
          if (email) {
            await sendOrderEmail(email, plan_key, preview_id);
          } else {
            console.warn("[webhook] No email found in session");
          }
        } catch (emailErr) {
          console.error("[webhook] sendOrderEmail failed:", emailErr);
        }

        break;
      }

      default:
        console.log("[webhook] Unhandled event type:", event.type);
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error("[webhook] General error:", err);
    return NextResponse.json({ error: err?.message || "Webhook failed" }, { status: 500 });
  }
}
