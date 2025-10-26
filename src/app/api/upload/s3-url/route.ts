// src/app/api/upload/s3-url/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Stripe from "stripe";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// -------- ENV ---------------------------------------------------------------
const AWS_REGION = process.env.AWS_REGION || "";          // required
const S3_BUCKET = process.env.S3_BUCKET || "";            // required
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ""; // required
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || "15");
const MAX_UPLOADS_PER_SESSION = Number(process.env.MAX_UPLOADS_PER_SESSION || "3");

// Debug toggles (OPTIONAL)
// Set in Vercel temporarily if you need to test path end-to-end:
// DEBUG_ALLOW_NO_SESSION=1 => bypass Stripe verification (DEV ONLY)
const DEBUG_ALLOW_NO_SESSION = process.env.DEBUG_ALLOW_NO_SESSION === "1";

// Upstash (optional)
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Allowed content-types
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

// -------- Guard required envs early (clear errors) --------------------------
if (!AWS_REGION) console.warn("[s3-url] Missing AWS_REGION");
if (!S3_BUCKET) console.warn("[s3-url] Missing S3_BUCKET");
if (!STRIPE_SECRET_KEY && !DEBUG_ALLOW_NO_SESSION) {
  console.warn("[s3-url] Missing STRIPE_SECRET_KEY (required unless DEBUG_ALLOW_NO_SESSION=1)");
}

// -------- Clients -----------------------------------------------------------
const s3 = new S3Client({ region: AWS_REGION || "us-east-1" });
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" }) : (null as any);

// Upstash or in-memory fallback
let redis: Redis | { get: Function; incr: Function; expire: Function };
let limiter: Ratelimit | { limit: (key: string) => Promise<{ success: boolean }> };

if (UPSTASH_URL && UPSTASH_TOKEN) {
  const real = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
  redis = real as unknown as Redis;
  limiter = new Ratelimit({ redis: real, limiter: Ratelimit.slidingWindow(5, "10 m") });
} else {
  console.warn("[s3-url] Upstash not configured; using in-memory rate-limit (non-persistent).");
  const counters = new Map<string, number>();
  redis = {
    async get<T>(k: string) { return (counters.get(k) as any as T) ?? null; },
    async incr(k: string) { counters.set(k, (counters.get(k) ?? 0) + 1); },
    async expire(_k: string, _sec: number) { /* no-op */ },
  } as any;
  limiter = { async limit(_key: string) { return { success: true }; } } as any;
}

// -------- Helpers -----------------------------------------------------------
function ipFrom(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 180);
}

async function verifyStripeSession(sessionId: string) {
  if (DEBUG_ALLOW_NO_SESSION) return { ok: true, email: "debug@example.com", session: null };
  if (!stripe) return { ok: false, email: null, session: null };
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer_details"] });
    const paid = session.payment_status === "paid" || (typeof session.amount_total === "number" && session.amount_total === 0);
    const email =
      session.customer_details?.email ||
      (typeof session.customer_email === "string" ? session.customer_email : null);
    return { ok: paid, email, session };
  } catch (err: any) {
    console.error("[s3-url] Stripe verify failed:", err?.message || err);
    return { ok: false, email: null, session: null };
  }
}

// -------- POST: sign a PUT URL ---------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Basic env sanity
    if (!AWS_REGION || !S3_BUCKET) {
      return NextResponse.json({ error: "Server missing AWS configuration" }, { status: 500 });
    }

    // Rate limit
    const ip = ipFrom(req);
    const rate = await limiter.limit(`presign:${ip}`);
    if (!rate.success) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({} as any));
    const { filename, contentType, sessionId, email: emailFromClient, name, purpose } = body || {};

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }
    if (!ALLOWED.has(contentType)) {
      return NextResponse.json({ error: "Only PDF, JPG, or PNG files are allowed." }, { status: 415 });
    }
    if (!sessionId && !DEBUG_ALLOW_NO_SESSION) {
      return NextResponse.json({ error: "Missing sessionId (upload allowed only after checkout)" }, { status: 400 });
    }

    // Stripe check (unless debug bypass)
    const v = await verifyStripeSession(sessionId || "");
    if (!v.ok) {
      return NextResponse.json({ error: "Upload allowed only after successful checkout." }, { status: 403 });
    }
    const email = (emailFromClient || v.email || "unknown").toLowerCase();

    // Per-session cap
    const countKey = `uploads:count:${sessionId || "debug"}`;
    const used = (await (redis as any).get<number>(countKey)) || 0;
    if (used >= MAX_UPLOADS_PER_SESSION) {
      return NextResponse.json(
        { error: `Upload limit reached for this session. (${used}/${MAX_UPLOADS_PER_SESSION})`, limit: MAX_UPLOADS_PER_SESSION, used },
        { status: 429 }
      );
    }

    // Object key
    const ts = Date.now();
    const key = `uploads/${sessionId || "debug"}/${ts}-${Math.random().toString(36).slice(2, 8)}-${safeName(filename)}`;

    // Minimal presign — no bound headers
    const putCmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 15 * 60 });

    // Count + expiry
    await (redis as any).incr(countKey);
    await (redis as any).expire(countKey, 60 * 60 * 24 * 30);

    return NextResponse.json({
      uploadUrl,
      key,
      maxBytes: UPLOAD_MAX_MB * 1024 * 1024,
      allowed: Array.from(ALLOWED),
      remaining: Math.max(0, MAX_UPLOADS_PER_SESSION - (used + 1)),
      context: { sessionId: sessionId || "debug", email, purpose: purpose || "upload" },
    });
  } catch (e: any) {
    console.error("[s3-url POST] error:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Failed to sign URL" }, { status: 500 });
  }
}

// -------- GET: verify object exists ----------------------------------------
export async function GET(req: NextRequest) {
  try {
    if (!AWS_REGION || !S3_BUCKET) {
      return NextResponse.json({ ok: false, error: "Server missing AWS configuration" }, { status: 500 });
    }
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const size = Number(head.ContentLength || 0);
    const ok = size > 0 && size <= UPLOAD_MAX_MB * 1024 * 1024;
    return NextResponse.json({ ok, size, contentType: head.ContentType || null, etag: head.ETag || null });
  } catch (e: any) {
    console.error("[s3-url GET] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "Verify failed" }, { status: 400 });
  }
}
