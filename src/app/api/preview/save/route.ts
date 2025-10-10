// src/app/api/preview/save/route.ts
import { NextRequest } from "next/server";
import { sql } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HoldingIn = { symbol: string; weight: number };

function j(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureTable() {
  // Qualify schema and quote "rows"
  await sql(`
    CREATE SCHEMA IF NOT EXISTS public;
    CREATE TABLE IF NOT EXISTS public.previews (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      provider TEXT NOT NULL,
      provider_display TEXT NOT NULL,
      profile TEXT NOT NULL,
      "rows" JSONB NOT NULL,
      grade_base NUMERIC,
      grade_adjusted NUMERIC,
      ip TEXT
    );
    CREATE INDEX IF NOT EXISTS previews_created_at_idx
      ON public.previews (created_at DESC);
  `);
}

export async function GET() {
  return j(200, { ok: true, route: "/api/preview/save" });
}

export async function POST(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    console.error("[preview/save] Missing DATABASE_URL env var");
    return j(500, { error: "Server DB not configured (DATABASE_URL missing)" });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return j(400, { error: "Invalid JSON" });
  }

  const {
    provider,
    provider_display,
    profile,
    rows,
    grade_base,
    grade_adjusted,
  } = (body ?? {}) as {
    provider?: string;
    provider_display?: string;
    profile?: string;
    rows?: HoldingIn[];
    grade_base?: number;
    grade_adjusted?: number;
  };

  if (
    !provider ||
    !provider_display ||
    !profile ||
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return j(400, {
      error:
        "Missing required fields (provider, provider_display, profile, rows[])",
    });
  }

  const cleanRows = rows
    .map((r) => ({
      symbol: String(r.symbol || "").toUpperCase().trim(),
      weight: Number(r.weight),
    }))
    .filter((r) => r.symbol && !Number.isNaN(r.weight));

  if (cleanRows.length === 0) {
    return j(400, { error: "No valid rows provided" });
  }

  const ip =
    req.headers.get("x-forwarded-for") ||
    // @ts-ignore
    (req as any).ip ||
    req.headers.get("x-real-ip") ||
    null;

  try {
    const res = await sql<{ id: string }>(
      `
      INSERT INTO public.previews
        (provider, provider_display, profile, "rows", grade_base, grade_adjusted, ip)
      VALUES
        ($1, $2, $3, CAST($4 AS jsonb), $5, $6, $7)
      RETURNING id
    `,
      [
        provider,
        provider_display,
        profile,
        JSON.stringify(cleanRows), // pass as string; CAST handles -> jsonb
        grade_base ?? null,
        grade_adjusted ?? null,
        ip,
      ]
    );

    const id = res.rows?.[0]?.id;
    if (!id) {
      console.error("[preview/save] insert returned no id");
      return j(500, { error: "Failed to create preview id" });
    }
    return j(200, { ok: true, id });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("relation") && msg.includes("does not exist")) {
      console.warn("[preview/save] table missing, creating…");
      try {
        await ensureTable();
        const res2 = await sql<{ id: string }>(
          `
          INSERT INTO public.previews
            (provider, provider_display, profile, "rows", grade_base, grade_adjusted, ip)
          VALUES
            ($1, $2, $3, CAST($4 AS jsonb), $5, $6, $7)
          RETURNING id
        `,
          [
            provider,
            provider_display,
            profile,
            JSON.stringify(cleanRows),
            grade_base ?? null,
            grade_adjusted ?? null,
            ip,
          ]
        );
        const id2 = res2.rows?.[0]?.id;
        if (!id2) {
          console.error("[preview/save] insert-after-create returned no id");
          return j(500, {
            error: "Failed to create preview id (after table create)",
          });
        }
        return j(200, { ok: true, id: id2 });
      } catch (e2: any) {
        console.error("[preview/save] create/insert retry failed:", e2?.message || e2);
        return j(500, { error: "DB insert (after create) failed", detail: String(e2?.message || e2) });
      }
    }

    console.error("[preview/save] insert error:", msg);
    return j(500, { error: "DB insert failed", detail: msg });
  }
}
