// src/lib/db.ts
import { Pool } from "@neondatabase/serverless";
import type { QueryResult, QueryResultRow } from "pg";

// Create Neon-compatible connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** Basic query helper (unchanged) */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Tagged template helper for parameterized SQL.
 * Example:
 *   const { text, params } = sql`SELECT * FROM users WHERE id = ${id}`;
 *   await query(text, params);
 */
export function sql(strings: TemplateStringsArray, ...vals: any[]) {
  let text = "";
  const params: any[] = [];

  strings.forEach((s, i) => {
    text += s;
    if (i < vals.length) {
      params.push(vals[i]);
      text += `$${params.length}`;
    }
  });

  return { text, params };
}
