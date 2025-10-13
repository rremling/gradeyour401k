// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true; // no await here (safe at top-level)
export const dynamic = "force-dynamic";

const json = (d: any, init?: number | ResponseInit) => NextResponse.json(d, init);

function toIsoOrNull(v: string | null): string | null {
  if (!v) return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export async function GET(req: Request) {
  try {
    // ---- Auth ----
    if (!cookies().get("admin_session")?.value) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- DB ----
    const url = process.env.DATABASE_URL;
    if (!url) return json({ orders: [], _error: "Missing DATABASE_URL" }, { status: 200 });
    const sql = neon(url); // sync construction; no top-level await anywhere

    // ---- Params ----
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

    const after = toIsoOrNull(searchParams.get("after"));

    // ---- Query (no dynamic string building that would require top-level await) ----
    // Select id first so ORDER BY 1 is safe
    let rows: any[];
    if (after) {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at,
               amount::bigint AS amount_cents,
               currency
        FROM public.orders
        WHERE created_at < ${after}
        ORDER BY 1 DESC, created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await sql/*sql*/`
        SELECT id, email, status, created_at,
               amount::bigint AS amount_cents,
               currency
        FROM public.orders
        ORDER BY 1 DESC, created_at DESC
        LIMIT ${limit + 1}
      `;
    }

    const slice = rows.slice(0, limit);

    const orders = slice.map((r: any) => {
      const cents = r.amount_cents === null || r.amount_cents === undefined ? null : Number(r.amount_cents);
      return {
        id: r.id,
        customerEmail: r.email,
        status: r.status,
        createdAt: r.created_at,                            // ISO string
        total: Number.isFinite(cents) ? cents / 100 : null, // dollars
        currency: r.currency ?? "usd",
      };
    });

    const nextCursor = rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    // keep UI alive
    return json({ orders: [], _error: err?.code || err?.message || "DB error" }, { status: 200 });
  }
}
