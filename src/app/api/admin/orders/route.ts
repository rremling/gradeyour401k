// src/app/api/admin/orders/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon } from "@neondatabase/serverless";

export const dynamic = "force-dynamic";

function toIsoOrNull(v: string | null): string | null {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export async function GET(req: Request) {
  try {
    if (!cookies().get("admin_session")?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ orders: [], _error: "Missing DATABASE_URL" });
    const sql = neon(url);

    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit"));
    const limitVal = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const limitPlusOne = limitVal + 1;

    const after = toIsoOrNull(searchParams.get("after"));
    const emailRaw = searchParams.get("email");
    const email = emailRaw && emailRaw.trim().length ? `%${emailRaw.trim()}%` : null; // ILIKE pattern

    let rows: any[];

    if (after && email) {
      // both filters
      rows = await sql/*sql*/`
        SELECT
          id, email, status, created_at,
          amount::bigint AS amount_cents,
          currency, plan_key, next_due_1, next_due_2, next_due_3
        FROM public.orders
        WHERE created_at < ${after}
          AND email ILIKE ${email}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitPlusOne}
      `;
    } else if (after) {
      // time cursor only
      rows = await sql/*sql*/`
        SELECT
          id, email, status, created_at,
          amount::bigint AS amount_cents,
          currency, plan_key, next_due_1, next_due_2, next_due_3
        FROM public.orders
        WHERE created_at < ${after}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitPlusOne}
      `;
    } else if (email) {
      // email only
      rows = await sql/*sql*/`
        SELECT
          id, email, status, created_at,
          amount::bigint AS amount_cents,
          currency, plan_key, next_due_1, next_due_2, next_due_3
        FROM public.orders
        WHERE email ILIKE ${email}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitPlusOne}
      `;
    } else {
      // no filters
      rows = await sql/*sql*/`
        SELECT
          id, email, status, created_at,
          amount::bigint AS amount_cents,
          currency, plan_key, next_due_1, next_due_2, next_due_3
        FROM public.orders
        ORDER BY created_at DESC, id DESC
        LIMIT ${limitPlusOne}
      `;
    }

    const slice = rows.slice(0, limitVal);

    const orders = slice.map((r: any) => {
      const cents = r.amount_cents == null ? null : Number(r.amount_cents);
      return {
        id: r.id,
        customerEmail: r.email,
        status: r.status,
        createdAt: r.created_at,
        total: Number.isFinite(cents) ? cents / 100 : null,
        currency: r.currency ?? "usd",
        planKey: r.plan_key ?? null,
        nextDue1: r.next_due_1 ?? null,
        nextDue2: r.next_due_2 ?? null,
        nextDue3: r.next_due_3 ?? null,
      };
    });

    const nextCursor = rows.length > limitVal ? String(slice[slice.length - 1]?.created_at) : null;

    return NextResponse.json({ orders, nextCursor });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return NextResponse.json(
      { orders: [], _error: err?.code || err?.message || "DB error" },
      { status: 200 }
    );
  }
}
