import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Stripe from "stripe";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// -------- ENV ---------------------------------------------------------------
const AWS_REGION = process.env.AWS_REGION!;
const S3_BUCKET = process.env.S3_BUCKET!;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY!;
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || "15");

// Upstash (rate limit + per-session counters)
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL!;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

// default 3 uploads per Stripe Checkout session; change as needed
const MAX_UPLOADS_PER_SESSION = Number(process.env.MAX_UPLOADS_PER_SESSION || "3");

// Allowed content-types
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

// -------- Clients -----------------------------------------------------------
const s3 = new S3Client({ region: AWS_REGION });
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const redis = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
const limiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 requests / 10 minutes
});

// -------- Helpers -----------------------------------------------------------
function ipFrom(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown"
  );
}

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 180);
}

async function verifyStripeSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer_details"],
  });

  const paid =
    session.payment_status === "paid" ||
    (typeof session.amount_total === "number" && session.amount_total === 0);

  const email =
    session.customer_details?.email ||
    (typeof session.customer_email === "string" ? session.customer_email : null);

  return { ok: paid, email, session };
}

// -------- POST: sign a PUT URL ---------------------------------------------
export async function POST(req: NextRequest) {
  try {
    // Basic rate limit by IP before any heavy work
    const ip = ipFrom(req);
    const rate = await limiter.limit(`presign:${ip}`);
    if (!rate.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const { filename, contentType, sessionId, email: emailFromClient, name, purpose } = body || {};

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Missing filename or contentType" },
        { status: 400 }
      );
    }
    if (!ALLOWED.has(contentType)) {
      return NextResponse.json(
        { error: "Only PDF, JPG, or PNG files are allowed." },
        { status: 415 }
      );
    }
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId (upload allowed only after checkout)" },
        { status: 400 }
      );
    }

    // Verify Stripe session is paid (or $0 after promo)
    const v = await verifyStripeSession(sessionId);
    if (!v.ok) {
      return NextResponse.json(
        { error: "Upload allowed only after successful checkout." },
        { status: 403 }
      );
    }
    const email = (emailFromClient || v.email || "unknown").toLowerCase();

    // Per-session upload cap (allows resend/additional docs up to MAX)
    // NOTE: We count at presign time; you can reset via Redis if needed.
    const countKey = `uploads:count:${sessionId}`;
    const used = (await redis.get<number>(countKey)) || 0;
    if (used >= MAX_UPLOADS_PER_SESSION) {
      return NextResponse.json(
        {
          error: `Upload limit reached for this session. (${used}/${MAX_UPLOADS_PER_SESSION})`,
          limit: MAX_UPLOADS_PER_SESSION,
          used,
        },
        { status: 429 }
      );
    }

    // Generate a key namespaced by session so your S3 structure stays tidy
    const ts = Date.now();
    const key = `uploads/${sessionId}/${ts}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeName(filename)}`;

    // Sign a short-lived PUT URL (no SSE header here; rely on bucket default encryption)
    const putCmd = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 15 * 60 });

    // Increment the per-session counter AFTER signing to throttle abuse
    // (If you prefer to increment only after verify step below, move this.)
    await redis.incr(countKey);
    // Optional: expire the counter after N days so repeat customers can upload again later
    await redis.expire(countKey, 60 * 60 * 24 * 30); // 30 days

    return NextResponse.json({
      uploadUrl,
      key,
      maxBytes: UPLOAD_MAX_MB * 1024 * 1024,
      allowed: Array.from(ALLOWED),
      remaining:
        Math.max(0, MAX_UPLOADS_PER_SESSION - (used + 1)),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to sign URL" },
      { status: 500 }
    );
  }
}

// -------- GET: verify object exists ----------------------------------------
export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key })
    );
    const size = Number(head.ContentLength || 0);
    const ok = size > 0 && size <= UPLOAD_MAX_MB * 1024 * 1024;
    return NextResponse.json({
      ok,
      size,
      contentType: head.ContentType || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Verify failed" },
      { status: 400 }
    );
  }
}
