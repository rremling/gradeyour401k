// src/app/api/admin/statements/latest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

function badRequest(message = "Bad request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message = "No statement found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

function sanitizeFileName(name: string) {
  // Keep it simple: remove path seps/control chars; trim to 120 chars.
  const safe = name.replace(/[/\\?%*:|"<>\x00-\x1F]+/g, " ").trim();
  return (safe || "statement").slice(0, 120);
}

export async function GET(req: NextRequest) {
  // ── Admin auth: require admin_session cookie to be present ───────────────
  // (Matches your existing admin login/logout flow.)
  const adminCookie = cookies().get("admin_session")?.value || "";
  if (!adminCookie) return unauthorized();

  // ── Parse & validate query params ────────────────────────────────────────
  const email = req.nextUrl.searchParams.get("email")?.trim();
  if (!email) return badRequest("Missing 'email' query param.");

  // basic sanity check (keeps things tidy; DB query still parameterized)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return badRequest("Invalid email.");
  }

  // ── Fetch latest statement bytes for this email ──────────────────────────
  const sql = `
    SELECT file_name, mime_type, byte_size, data
      FROM public.statements
     WHERE email = $1
     ORDER BY uploaded_at DESC
     LIMIT 1
  `;
  let row:
    | { file_name: string; mime_type: string; byte_size: number; data: Buffer }
    | undefined;

  try {
    const r: any = await query(sql, [email]);
    const rows = Array.isArray(r?.rows) ? r.rows : Array.isArray(r) ? r : [];
    if (!rows.length) return notFound();
    row = rows[0];
  } catch (e: any) {
    console.error("[admin:statements/latest] query error:", e?.message || e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!row) return notFound();

  const { file_name, mime_type, byte_size, data } = row;

  // ── Build safe headers for download ──────────────────────────────────────
  const safeName = sanitizeFileName(file_name);
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(safeName);

  const headers = new Headers();
  headers.set("Content-Type", mime_type || "application/octet-stream");
  headers.set("Content-Length", String(byte_size || data?.length || 0));
  // RFC 5987: include both filename and filename* for best cross-browser support
  headers.set(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`
  );
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  // ── Return the raw bytes ─────────────────────────────────────────────────
  return new Response(data, { status: 200, headers });
}
