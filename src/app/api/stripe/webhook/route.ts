// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { saveOrder, markOrderSent } from "@/lib/orders"; // <-- add this

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  return json(200, { ok: true, method: "GET" });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return json(500, { error: "Missing STRIPE_WEBHOOK_SECRET" });

  let payload: string;
  const sig = req.headers.get("stripe-signature");
  if (!sig) return json(400, { error: "Missing signature" });

  try {
    payload = await req.text();
  } catch {
    return json(400, { error: "Invalid body" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Bad signature:", err?.message);
    return json(400, { error: "Signature verification failed" });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email =
        session.customer_details?.email ||
        (session.customer_email as string | undefined) ||
        null;

      const previewId = (session.metadata?.previewId as string | undefined) || null;
      const planKey = (session.metadata?.planKey as string | undefined) || "one_time";

      const amount = (session.amount_total as number | null) ?? null; // cents
      const currency = (session.currency as string | null) ?? null;
      const sessionId = session.id;

      console.log("[webhook] completed", {
        sessionId,
        email,
        previewId,
        planKey,
        amount,
        currency,
      });

      if (!email || !previewId) {
        console.warn("[webhook] Missing email or previewId, skipping DB + email.");
        return json(200, { ok: true, skipped: true });
      }

      // 1) Save or update order in Postgres
      try {
        await saveOrder({
          email,
          plan: (planKey === "annual" ? "annual" : "one_time"),
          previewId,
          stripeSessionId: sessionId,
          amount,
          currency,
        });
      } catch (e) {
        console.error("[webhook] saveOrder failed:", e);
        // Do not fail webhook; continue to email
      }

      // 2) Generate + email PDF
      try {
        const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.gradeyour401k.com";
        const r = await fetch(`${base}/api/report/generate-and-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewId,
            email,
            orderId: sessionId,
            force: true,
          }),
        });

        if (!r.ok) {
          console.error("[webhook] generate-and-email failed:", r.status, await r.text());
        } else {
          await markOrderSent(sessionId).catch(() => {});
          console.log("[webhook] emailed report ok");
        }
      } catch (e) {
        console.error("[webhook] call email route error:", e);
      }

      return json(200, { ok: true });
    }

    return json(200, { ok: true, ignored: event.type });
  } catch (e: any) {
    console.error("[webhook] unhandled error:", e?.message || e);
    return json(200, { ok: true, note: "swallowed error; check logs" });
  }
}
