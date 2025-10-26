import { SignJWT, jwtVerify } from "jose";

const ACCOUNT_SECRET = process.env.ACCOUNT_SECRET || "";
if (!ACCOUNT_SECRET) console.warn("[auth] Missing ACCOUNT_SECRET");
const key = new TextEncoder().encode(ACCOUNT_SECRET);

export type AccountClaims = { sub: string; email: string };

export async function signAccountToken(email: string, ttlMinutes = 30) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ email } as AccountClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlMinutes * 60)
    .setSubject(email)
    .sign(key);
}

export async function verifyAccountToken(token: string): Promise<AccountClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    const email = String(payload.email || payload.sub || "");
    if (!email) return null;
    return { sub: email, email };
  } catch {
    return null;
  }
}
