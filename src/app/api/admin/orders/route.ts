import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;
export const dynamic = "force-dynamic";

const json = (d: any, init?: number | ResponseInit) => NextResponse.json(d, init);

function toIsoOrNull(v: string | null): string | null {
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  // normalize to ISO; Postgres can compare timestamptz with this fine
  return new Date(ms).toISOString();
}

export async function GET(req: Request) {
  try {
    // --- Auth ---
    if (!cookies().get("admin_session")?.value) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- DB ---
    const url = process.env.DATABASE_URL;
    if (!url) return json({ orders: [], _error: "Missing DATABASE_URL" }, { status: 200 });
    const sql = neon(url);

    // --- Params ---
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const afterRaw = searchParams.get("after");
    const after = toIsoOrNull(afterRaw); // <-- VALIDATE STRICTLY

    // --- Query (no dynamic fragments) ---
    // We select id first so ORDER BY 1 is always valid.
    let rows: any[];
    if (after) {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at, amount, currency
        FROM public.orders
        WHERE created_at < ${after}
        ORDER BY 1 DESC, created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at, amount, currency
        FROM public.orders
        ORDER BY 1 DESC, created_at DESC
        LIMIT ${limit + 1}
      `;
    }

    const slice = rows.slice(0, limit);

    const orders = slice.map(r => ({
      id: r.id,
      customerEmail: r.email,
      status: r.status,
      createdAt: r.created_at,
      // amount is integer cents; divide to dollars. If yours is dollars already, remove "/ 100".
      total: typeof r.amount === "number" ? r.amount / 100 : (r.amount != null ? Number(r.amount) / 100 : null),
      currency: r.currency ?? "usd",
    }));

    const nextCursor = rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    // Keep UI alive; surface detail for debugging
    console.error("GET /api/admin/orders error:", err);
    return json(
      { orders: [], _error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
