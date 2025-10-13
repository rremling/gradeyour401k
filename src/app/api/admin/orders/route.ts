// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

// Optional: cache the HTTP connection across invocations on Vercel
neonConfig.fetchConnectionCache = true;

// If you want Edge runtime, switch to: export const runtime = "edge";
// (This file works fine in default node runtime too.)
export const dynamic = "force-dynamic";

function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init);
}

export async function GET(req: Request) {
  try {
    // ---- Auth gate ----
    const hasSession = Boolean(cookies().get("admin_session")?.value);
    if (!hasSession) return json({ error: "Unauthorized" }, { status: 401 });

    // ---- DB ----
    const url = process.env.DATABASE_URL;
    if (!url) {
      return json({ error: "Server misconfigured: DATABASE_URL missing" }, { status: 500 });
    }
    const sql = neon(url);

    // ---- Pagination params ----
    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(100, limitParam)) : 20;
    const after = searchParams.get("after"); // ISO timestamp cursor (exclusive)

    // Example schema (adjust to your table/columns):
    //   CREATE TABLE orders (
    //     id TEXT PRIMARY KEY,
    //     total_cents INTEGER NOT NULL,
    //     status TEXT NOT NULL,
    //     customer_email TEXT,
    //     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    //   );
    //
    // If your table/column names differ, edit the SELECT below accordingly.

    // Build the query with a simple "created_at < after" cursor
    // and return `limit + 1` rows to detect if there's a next page.
    const rows = after
      ? await sql/*sql*/ `
          SELECT id, total_cents, status, customer_email, created_at
          FROM orders
          WHERE created_at < ${after}
          ORDER BY created_at DESC
          LIMIT ${limit + 1}
        `
      : await sql/*sql*/ `
          SELECT id, total_cents, status, customer_email, created_at
          FROM orders
          ORDER BY created_at DESC
          LIMIT ${limit + 1}
        `;

    // Normalize to a safe shape for your UI
    const slice = rows.slice(0, limit);
    const orders = slice.map((r: any) => ({
      id: r.id,
      total: typeof r.total_cents === "number" ? r.total_cents / 100 : null,
      status: r.status ?? "unknown",
      customerEmail: r.customer_email ?? null,
      createdAt: r.created_at, // ISO string
    }));

    const hasMore = rows.length > limit;
    const nextCursor = hasMore ? String(slice[slice.length - 1]?.created_at) : null;

    return json({ orders, nextCursor });
  } catch (err: any) {
    // Don’t leak secrets; return a generic message but log details in your logs
    console.error("GET /api/admin/orders error:", err);
    return json({ error: "Failed to load orders" }, { status: 500 });
  }
}
