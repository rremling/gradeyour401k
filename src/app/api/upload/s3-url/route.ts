import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Stripe from "stripe";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET!;
const MAX_MB = Number(process.env.UPLOAD_MAX_MB || "15");
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" }) : null;

async function getEmailFromStripe(sessionId?: string): Promise<string | null> {
  if (!stripe || !sessionId) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["customer_details"] });
    return session.customer_details?.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType, sessionId, email } = await req.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
    }
    if (!ALLOWED.includes(contentType)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }

    const emailFromStripe = await getEmailFromStripe(sessionId);
    const safeEmail = (emailFromStripe || email || "unknown").toLowerCase();

    const ts = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const key = `uploads/${ts}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const putCmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private",
      Metadata: { uploader_email: safeEmail, source: "gy401k-review" },
      ServerSideEncryption: "AES256",
    });

    const uploadUrl = await getSignedUrl(s3, putCmd, { expiresIn: 15 * 60 });

    return NextResponse.json({
      uploadUrl,
      key,
      maxBytes: MAX_MB * 1024 * 1024,
      allowed: ALLOWED,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to sign URL" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    const size = Number(head.ContentLength || 0);
    const ok = size > 0 && size <= Number(process.env.UPLOAD_MAX_MB || "15") * 1024 * 1024;

    return NextResponse.json({ ok, size, contentType: head.ContentType || null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Verify failed" }, { status: 400 });
  }
}
