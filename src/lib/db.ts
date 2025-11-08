// src/lib/db.ts
import { Pool } from "@neondatabase/serverless";
import type { QueryResult, QueryResultRow } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

