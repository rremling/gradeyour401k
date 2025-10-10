// src/app/api/stripe/webhook/route.ts
import 'server-only';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // if your alias isn't set, change to: "../../../../lib/db"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Simple health check (also helps Stripe dashboard sanity checks)
export async function GET() {
  return NextResponse.json({ ok: true, at: 'webhook', method: 'GET' });
}

export async function POST(req: Request) {
  // 1) Read raw body for signature verification
  const sig = headers().get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  const raw = await req.text();

  try {
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[webhook] signature verify failed:', err?.message);
    return NextResponse.json({ error: `Signature error: ${err?.message}` }, { status: 400 });
  }

  // 2) Handle only what we need
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Metadata we set when creating the Checkout Session
    const previewId = session.metadata?.previewId ?? null;
    const planKey = session.metadata?.planKey ?? null;

    // Customer email from Checkout
    const email =
      session.customer_details?.email ??
      // fallback if you enabled it
      (session as any).customer_email ??
      null;

    try {
      // 3) Persist order using stripe_session_id (Option B)
      // Make sure your DB has:
      // - column: stripe_session_id TEXT UNIQUE
      // - columns: email TEXT, plan TEXT, preview_id TEXT, status TEXT, created_at TIMESTAMPTZ DEFAULT now()
      await sql/* sql */`
        INSERT INTO public.orders (stripe_session_id, email, plan, preview_id, status)
        VALUES (${session.id}, ${email}, ${planKey}, ${previewId}, 'paid')
        ON CONFLICT (stripe_session_id) DO UPDATE
        SET email = EXCLUDED.email,
            plan = EXCLUDED.plan,
            preview_id = EXCLUDED.preview_id,
            status = EXCLUDED.status
      `;

      // 4) (Optional) Fire-and-forget report generation/email.
      // We do this *after* returning 200 to Stripe in case it’s slow.
      // If your generate endpoint requires auth, add the header here.
      // Don’t block the webhook; run in background.
      queueMicrotask(async () => {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/report/generate-and-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              previewId,
              plan: planKey,
              sessionId: session.id,
            }),
          });
        } catch (e) {
          console.error('[webhook] background generate failed:', e);
        }
      });
    } catch (dbErr: any) {
      console.error('[webhook] saveOrder failed:', dbErr);
      // Still return 200 so Stripe doesn't retry forever if this was a one-off.
      // If you want Stripe to retry on DB failure, return 500 instead.
      return NextResponse.json({ ok: true, saved: false }, { status: 200 });
    }
  }

  // For other events, just acknowledge
  return NextResponse.json({ ok: true });
}
