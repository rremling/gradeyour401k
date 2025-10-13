import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;
export const dynamic = "force-dynamic";

function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init);
}

type Cols = {
  id: string;
  total: string | null;       // column name for total (numeric/int)
  created: string;
  status: string | null;
  email: string | null;
};

function pick(cols: Array<{ column_name: string; data_type: string }>): Cols {
  const names = (arr: string[]) => arr.find(n => cols.some(c => c.column_name === n)) || null;

  const id =
    names(["id", "order_id", "uuid"]) ||
    cols.find(c => c.data_type.includes("uuid"))?.column_name ||
    cols[0]?.column_name || "id";

  // prefer cents/integer, then numeric types
  const totalCandidates = [
    "total_cents","amount_cents","subtotal_cents",
    "total","amount","order_total","grand_total","price","sum_total"
  ];
  const createdCandidates = [
    "created_at","createdat","inserted_at","created_on","created","created_ts","created_time","createddate"
  ];
  const statusCandidates = ["status","state","order_status"];
  const emailCandidates = ["customer_email","email","buyer_email","user_email"];

  const total =
    names(totalCandidates.filter(Boolean)) ||
    cols.find(c => ["integer","bigint","numeric","double precision","real","smallint"].includes(c.data_type))?.column_name ||
    null;

  const created =
    names(createdCandidates.filter(Boolean)) ||
    cols.find(c => c.data_type.includes("timestamp"))?.column_name ||
    "created_at";

  const status = names(statusCandidates);
  const email = names(emailCandidates);

  return { id, total, created, status, email };
}

export async function GET(req: Request) {
  try {
    // auth
    if (!cookies().get("admin_session")?.value) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Missing DATABASE_URL");
    const sql = neon(url);

    // discover columns
    const columns = await sql<Array<{ column_name: string; data_type: string }>>/*sql*/`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
    `;
    if (!columns.length) {
      return json({ error: "orders table not found in public schema" }, { status: 500 });
    }
    const map = pick(columns);

    // pagination
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
    const after = searchParams.get("after"); // ISO timestamp

    // dynamic SELECT (only reference columns that actually exist)
    const fields = [
      `"${map.id}" as id`,
      map.total ? `"${map.total}" as total_raw` : `NULL::numeric as total_raw`,
      map.status ? `"${map.status}" as status` : `NULL::text as status`,
      map.email ? `"${map.email}" as customer_email` : `NULL::text as customer_email`,
      `"${map.created}" as created_at`,
    ].join(", ");

    const where = after ? sql/*sql*/`WHERE "${map.created}" < ${after}` : sql``;

    const rows = await sql<any[]>/*sql*/`
      SELECT ${sql.unsafe(fields)}
      FROM "orders"
      ${where}
      ORDER BY "${map.created}" DESC
      LIMIT ${limit + 1}
    `;

    const visible = rows.slice(0, limit);

    const orders = visible.map(r => ({
      id: r.id,
      total:
        r.total_raw == null
          ? null
          : typeof r.total_raw === "number"
          ? (
              // if the column was cents (int-like and typically larger than dollars), you can
              // uncomment the heuristic below, otherwise just return as-is:
              // r.total_raw > 100000 ? r.total_raw / 100 : r.total_raw
              r.total_raw
            )
          : Number(r.total_raw),
      status: r.status ?? null,
      customerEmail: r.customer_email ?? null,
      createdAt: r.created_at,
    }));

    const nextCursor = rows.length > limit ? String(visible[visible.length - 1]?.created_at) : null;

    return json({ orders, nextCursor, meta: { id: map.id, total: map.total, created: map.created } });
  } catch (err: any) {
    console.error("GET /api/admin/orders error:", err);
    return json({ error: "Failed to load orders" }, { status: 500 });
  }
}
