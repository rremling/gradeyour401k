// src/lib/db.ts
// Postgres helper for Neon (or any hosted PG). Uses `pg`.
// Ensure you set DATABASE_URL in your Vercel env (Production).
//
// Example: DATABASE_URL=postgres://user:pass@HOST/db?sslmode=require

import { Pool, QueryResult } from "pg";

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // works with Neon
    max: 5,
  });
  return _pool;
}

/**
 * Low-level query helper: sql text + params
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * Tagged template helper:
 * const { rows } = await sql`SELECT * FROM table WHERE id = ${id}`;
 */
export async function sql<T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<QueryResult<T>> {
  // Build parameterized query: $1, $2, ...
  let text = "";
  strings.forEach((str, i) => {
    text += str;
    if (i < values.length) text += `$${i + 1}`;
  });
  return query<T>(text, values);
}

/**
 * Simple health check (optional; handy for /api/debug/db)
 */
export async function dbHealth(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
