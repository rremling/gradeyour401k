// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;
export const dynamic = "force-dynamic";

function toIsoOrNull(v: string | null): string | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export async function GET(req: Request) {
  try {
    // --- Auth ---
    if (!cookies().get("admin_session")?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- DB ---
    const url = process.env.DATABASE_URL;
    if (!url) {
      return NextResponse.json({ orders: [], _error: "Missing DATABASE_URL" });
    }
    const sql = neon(url);

    // --- Params ---
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const after = toIsoOrNull(searchParams.get("after"));

    // --- Query (your schema: public.orders) ---
    // Order by created_at DESC, then id DESC for stability.
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

    const orders = slice.map((r: any) => {
      const cents =
        r.amount_cents === null || r.amount_cents === undefined
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

    const nextCursor =
      rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return NextResponse.json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    // Keep UI alive: return 200 with hint instead of crashing
    return NextResponse.json(
      { orders: [], _error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
