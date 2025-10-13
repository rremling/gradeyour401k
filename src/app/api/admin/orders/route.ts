// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;
export const dynamic = "force-dynamic";

function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(req: Request) {
  try {
    // ---- Auth ----
    if (!cookies().get("admin_session")?.value) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- DB ----
    const url = process.env.DATABASE_URL;
    if (!url) return json({ error: "Missing DATABASE_URL" }, { status: 500 });
    const sql = neon(url);

    // ---- Params ----
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const after = searchParams.get("after"); // ISO timestamp

    // 🔁 If your real columns differ, change them here:
    // columns: id (text/uuid), total (numeric), status (text), customer_email (text), created_at (timestamptz)
    const rows = after
      ? await sql/*sql*/`
          SELECT id, total, status, customer_email, created_at
          FROM orders
          WHERE created_at < ${after}
          ORDER BY created_at DESC
          LIMIT ${limit + 1}
        `
      : await sql/*sql*/`
          SELECT id, total, status, customer_email, created_at
          FROM orders
          ORDER BY created_at DESC
          LIMIT ${limit + 1}
        `;

    const slice = rows.slice(0, limit);
    const orders = slice.map((r: any) => ({
      id: r.id,
      total: r.total == null ? null : Number(r.total),
      status: r.status ?? null,
      customerEmail: r.customer_email ?? null,
      createdAt: r.created_at,
    }));

    const nextCursor = rows.length > limit ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    // Don’t crash the page; surface a hint to the UI
    return NextResponse.json(
      { orders: [], _error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
