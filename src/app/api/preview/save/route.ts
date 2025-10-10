// src/app/api/preview/save/route.ts
import { NextRequest } from "next/server";
import { sql } from "@/lib/db";

export const runtime = "nodejs"; // ensure Node runtime

type HoldingIn = { symbol: string; weight: number };

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "Invalid JSON" });

    const {
      provider,
      provider_display,
      profile,
      rows,
      grade_base,
      grade_adjusted,
    } = body as {
      provider?: string;
      provider_display?: string;
      profile?: string;
      rows?: HoldingIn[];
      grade_base?: number;
      grade_adjusted?: number;
    };

    // Basic validation
    if (
      !provider ||
      !provider_display ||
      !profile ||
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return json(400, { error: "Missing required fields (provider, provider_display, profile, rows[])" });
    }

    // Rows must have symbol + numeric weight
    const cleanRows = rows
      .map((r) => ({
        symbol: String(r.symbol || "").toUpperCase().trim(),
        weight: Number(r.weight),
      }))
      .filter((r) => r.symbol && !Number.isNaN(r.weight));

    if (cleanRows.length === 0) {
      return json(400, { error: "No valid rows provided" });
    }

    // Optional: total weight sanity (don’t fail hard; just store)
    const total = cleanRows.reduce((s, r) => s + r.weight, 0);

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.ip ||
      req.headers.get("x-real-ip") ||
      null;

    // Insert and return id
    const result = await sql<{ id: string }>(
      `
      INSERT INTO previews (provider, provider_display, profile, rows, grade_base, grade_adjusted, ip)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
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

    const id = result.rows?.[0]?.id;
    if (!id) return json(500, { error: "Failed to create preview id" });

    return json(200, {
      ok: true,
      id,
      meta: { totalWeight: Math.round(total * 10) / 10 },
    });
  } catch (e: any) {
    console.error("[preview/save] error:", e?.message || e);
    return json(500, { error: "Server error saving preview" });
  }
}

// Optional: simple GET for manual debugging
export async function GET() {
  return json(200, { ok: true, route: "/api/preview/save" });
}
