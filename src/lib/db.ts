// src/lib/db.ts
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // Neon needs SSL
});

export async function sql<T = any>(text: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
