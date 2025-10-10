// src/app/api/stripe/webhook/route.ts
import Stripe from "stripe";

export const runtime = "nodejs"; // IMPORTANT: Stripe Node SDK needs Node runtime, not Edge.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Optional: if you have a DB save helper, import it here.
// import { saveOrder } from "@/lib/db";

export async function GET() {
  // Helpful ping to see the route is deployed (Stripe will POST, not GET)
  return json(200, { ok: true, method: "GET" });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] Missing STRIPE_WEBHOOK_SECRET");
    return json(500, { error: "Server not configured" });
  }

  let payload: string;
  let sig: string | null = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[webhook] Missing stripe-signature header");
    return json(400, { error: "Missing signature" });
  }

  try {
    // IMPORTANT: use raw text for signature verification
    payload = await req.text();
  } catch (e) {
    console.error("[webhook] Failed to read raw body", e);
    return json(400, { error: "Invalid body" });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
  } catch (err: any) {
    console.error("[webhook] Signature verification failed:", err?.message || err);
    return json(400, { error: "Signature verification failed" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email =
          session.customer_details?.email ||
          (session.customer_email as string | undefined) ||
          null;
        const previewId = (session.metadata?.previewId as string | undefined) || null;
        const planKey = (session.metadata?.planKey as string | undefined) || "one_time";
        const sessionId = session.id;

        console.log("[webhook] checkout.session.completed", {
          sessionId,
          email,
          previewId,
          planKey,
        });

        if (!email || !previewId) {
          console.warn("[webhook] Missing email or previewId. Skipping send.", {
            email,
            previewId,
          });
          // Still return 200 so Stripe won’t retry forever.
          return json(200, { ok: true, skipped: true });
        }

        // 1) (Optional) Persist the order
        try {
          // await saveOrder({
          // email,
          // previewId,
          // planKey,
          // stripeSessionId: sessionId,
          // });
        } catch (e) {
          console.error("[webhook] saveOrder failed:", e);
          // don't fail the webhook; keep going to email
        }

        // 2) Kick off your PDF generation + email
        try {
          // If you secure this route with a secret header, include it here.
          const r = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "https://www.gradeyour401k.com"}/api/report/generate-and-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Example if you check a header inside that route:
              // Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
            },
            body: JSON.stringify({
              previewId,
              email,
              orderId: sessionId,
              force: true,
            }),
          });

          if (!r.ok) {
            const body = await r.text().catch(() => "");
            console.error("[webhook] generate-and-email failed", r.status, body);
          } else {
            const body = await r.json().catch(() => null);
            console.log("[webhook] generate-and-email ok", body);
          }
        } catch (e) {
          console.error("[webhook] Error calling generate-and-email:", e);
        }

        return json(200, { ok: true });
      }

      default: {
        // Acknowledge unhandled event types
        return json(200, { ok: true, ignored: event.type });
      }
    }
  } catch (e: any) {
    console.error("[webhook] Unhandled error:", e?.message || e);
    // Return 200 to prevent Stripe retry storms—log is captured in Vercel.
    return json(200, { ok: true, note: "swallowed error; see logs" });
  }
}
