// src/app/api/preview/save/route.ts
import { NextRequest, NextResponse } from "next/server";

// Optional DB import — only used if DATABASE_URL exists
let query: ((text: string, params?: any[]) => Promise<any>) | null = null;
try {
  // Dynamically import so build doesn’t fail without pg
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const mod = await import("@/lib/db");
  query = mod.query;
} catch {
  query = null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function uuid() {
  // tiny uuid v4-ish
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, profile, rows, grade_base, grade_adjusted } = body || {};

    // Basic validation (but allow placeholder previews)
    if (!rows || !Array.isArray(rows)) {
      // allow empty placeholder
    }

    const id = uuid();

    // If DB is available, persist
    if (process.env.DATABASE_URL && query) {
      try {
        await query(
          `insert into previews (id, provider, profile, rows, grade_base, grade_adjusted)
           values ($1,$2,$3,$4::jsonb,$5,$6)`,
          [
            id,
            provider || "",
            profile || "Growth",
            JSON.stringify(rows || []),
            Number(grade_base) || 0,
            Number(grade_adjusted) || 0,
          ]
        );
      } catch (e) {
        // Don’t fail the request just because DB isn’t ready
        console.warn("preview/save DB insert failed (continuing):", (e as Error).message);
      }
    } else {
      // No DB? Log so you can verify in Vercel logs
      console.log("preview/save (no DB):", { id, provider, profile, rowsCount: (rows || []).length });
    }

    return NextResponse.json({ previewId: id });
  } catch (e: any) {
    console.error("preview/save error:", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
