// src/app/api/admin/orders/route.ts
// …imports and setup unchanged…

export async function GET(req: Request) {
  try {
    if (!cookies().get("admin_session")?.value) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.DATABASE_URL;
    if (!url) return json({ orders: [], _error: "Missing DATABASE_URL" }, { status: 200 });
    const sql = neon(url);

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    // ⬇ default 50 (was 20)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const afterRaw = searchParams.get("after");
    const after = (() => {
      if (!afterRaw) return null;
      const ms = Date.parse(afterRaw);
      return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
    })();

    // ⬇ Order by created_at first, then id for deterministic tie-break
    let rows: any[];
    if (after) {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at,
               amount::bigint AS amount_cents,
               currency
        FROM public.orders
        WHERE created_at < ${after}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at,
               amount::bigint AS amount_cents,
               currency
        FROM public.orders
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit + 1}
      `;
    }

    const slice = rows.slice(0, limit);
    const orders = slice.map((r: any) => ({
      id: r.id,
      customerEmail: r.email,
      status: r.status,
      createdAt: r.created_at,
      total: r.amount_cents == null ? null : Number(r.amount_cents) / 100,
      currency: r.currency ?? "usd",
    }));

    const nextCursor = rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return json({ orders: [], _error: err?.code || err?.message || "DB error" }, { status: 200 });
  }
}
