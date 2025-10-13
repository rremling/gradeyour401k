// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;
export const dynamic = "force-dynamic";

const json = (d: any, init?: number | ResponseInit) => NextResponse.json(d, init);

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

    // --- Pagination ---
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const after = searchParams.get("after"); // ISO timestamp string (exclusive)

    // Build WHERE if a cursor is provided
    const where =
      after ? sql/*sql*/`WHERE created_at < ${after}` : sql``;

    // Query exactly the columns you have
    const rows = await sql<any[]>/*sql*/`
      SELECT id, email, status, created_at, amount, currency
      FROM public.orders
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit + 1}
    `;

    const slice = rows.slice(0, limit);

    // amount is integer cents -> convert to dollars
    const orders = slice.map(r => ({
      id: r.id,
      customerEmail: r.email,
      status: r.status,
      createdAt: r.created_at,
      total: typeof r.amount === "number" ? r.amount / 100 : null,
      currency: r.currency ?? "usd",
    }));

    const nextCursor =
      rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    // Keep the UI alive; surface hint in _error
    return json({ orders: [], _error: err?.code || err?.message || "DB error" }, { status: 200 });
  }
}
