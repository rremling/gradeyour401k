// src/lib/orders.ts
import { sql } from "./db";

export type PlanKey = "one_time" | "annual";

export async function saveOrder(opts: {
  email: string;
  plan: PlanKey;
  previewId: string;
  stripeSessionId: string;
  amount?: number | null; // cents
  currency?: string | null; // 'usd'
}) {
  const { email, plan, previewId, stripeSessionId, amount = null, currency = null } = opts;

  await sql(
    `
    INSERT INTO orders (email, plan, preview_id, stripe_session_id, amount, currency)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (stripe_session_id)
    DO UPDATE
      SET email = EXCLUDED.email,
          plan = EXCLUDED.plan,
          preview_id = EXCLUDED.preview_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency
    `,
    [email, plan, previewId, stripeSessionId, amount, currency]
  );
}

export async function markOrderSent(stripeSessionId: string) {
  await sql(
    `UPDATE orders SET last_sent_at = now() WHERE stripe_session_id = $1`,
    [stripeSessionId]
  );
}
