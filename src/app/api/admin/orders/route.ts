// src/app/api/admin/orders/route.ts  (inside GET)
const rows = await sql/*sql*/`
  SELECT id, email, status, created_at,
         amount::bigint AS amount_cents,  -- force numeric type
         currency
  FROM public.orders
  ${after ? sql/*sql*/`WHERE created_at < ${after}` : sql``}
  ORDER BY created_at DESC
  LIMIT ${limit + 1}
`;

const slice = rows.slice(0, limit);

const orders = slice.map(r => {
  const cents = r.amount_cents === null || r.amount_cents === undefined
    ? null
    : Number(r.amount_cents);

  return {
    id: r.id,
    customerEmail: r.email,
    status: r.status,
    createdAt: r.created_at,
    total: Number.isFinite(cents) ? cents / 100 : null, // dollars
    currency: r.currency ?? "usd",
  };
});
