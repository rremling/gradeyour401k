// src/lib/db.ts
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // ssl: { rejectUnauthorized: false }, // uncomment if your host needs SSL
    });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]) {
  const p = getPool();
  if (!p) throw new Error("DB not configured");
  const client = await p.connect();
  try {
    const res = await client.query<T>(text, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}
