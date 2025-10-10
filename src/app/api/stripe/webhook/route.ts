// src/app/api/stripe/webhook/route.ts
import 'server-only';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db'; // adjust path if needed

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export async function GET() {
  return NextResponse.json({ ok: true, at: 'webhook', method: 'GET' });
}

export async function POST(req: Request) {
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const previewId = session.metadata?.previewId ?? null;
    const planKey = session.metadata?.planKey ?? null;
    const email =
      session.customer_details?.email ??
      (session as any).customer_email ??
      null;

    try {
      // IMPORTANT: use text + params (NO tagged template)
      await sql(
        `
        INSERT INTO public.orders
          (stripe_session_id, email, plan, preview_id, status)
        VALUES
          ($1, $2, $3, $4, 'paid')
        ON CONFLICT (stripe_session_id) DO UPDATE SET
          email = EXCLUDED.email,
          plan = EXCLUDED.plan,
          preview_id = EXCLUDED.preview_id,
          status = EXCLUDED.status
        `,
        [session.id, email, planKey, previewId]
      );

      // Fire-and-forget report generation (don’t block webhook)
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
      // Acknowledge to avoid endless Stripe retries; log for follow-up.
      return NextResponse.json({ ok: true, saved: false }, { status: 200 });
    }
  }

  return NextResponse.json({ ok: true });
}
