// src/app/account/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { verifyAccountToken } from "@/lib/auth";
import { query } from "@/lib/db";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ───────────────────── Helpers ───────────────────── */

function safeCookie(name: string): string {
  try {
    return cookies().get(name)?.value || "";
  } catch {
    return "";
  }
}

/* ───────────────────── Config / Options ───────────────────── */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" }) : null;

const PROVIDERS = ["Fidelity", "Vanguard", "Schwab", "Voya", "Other"] as const;
const PROFILES = ["Growth", "Balanced", "Conservative"] as const;

/* ───────────────────── Server Actions ───────────────────── */

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email) return { ok: false, error: "Email required" };

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${base}/api/account/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return { ok: false, error: j?.error || "Failed to send link" };
  }
  return { ok: true };
}

async function updatePrefs(formData: FormData) {
  "use server";
  try {
    const token = safeCookie("acct");
    const claims = await verifyAccountToken(token);
    if (!claims) return { ok: false, error: "Unauthorized" };

    const provider = String(formData.get("provider") || "").trim();
    const profile = String(formData.get("profile") || "").trim();

    const validProvider = PROVIDERS.includes(provider as (typeof PROVIDERS)[number]);
    const validProfile = PROFILES.includes(profile as (typeof PROFILES)[number]);
    if (!validProvider || !validProfile) {
      return { ok: false, error: "Invalid provider or profile." };
    }

    const result: any = await query(
      `
      WITH target AS (
        SELECT id
          FROM public.orders
         WHERE email = $3
         ORDER BY (plan_key = 'annual') DESC, created_at DESC
         LIMIT 1
      )
      UPDATE public.orders o
         SET provider = $1,
             profile  = $2,
             updated_at = NOW()
        FROM target
       WHERE o.id = target.id
      RETURNING o.id
      `,
      [provider, profile, claims.email]
    );

    const updated = Array.isArray(result?.rows) ? result.rows.length : (result?.rowCount ?? 0);
    if (!updated) {
      return { ok: false, error: "No order found to update for this account." };
    }

    // Flash cookie so the page can show "Updated!" without relying on URL params.
    const c = cookies();
    c.set("account_updated", "1", {
      path: "/account",
      httpOnly: false,         // readable by client if you ever want
      sameSite: "lax",
      maxAge: 60,              // 1 minute is plenty
    });

    revalidatePath("/account");
    redirect("/account");
  } catch (e: any) {
    console.error("[account:updatePrefs] error:", e?.message || e);
    return { ok: false, error: "Could not save preferences. Please try again." };
  }
}

async function createPortalAction() {
  "use server";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const token = safeCookie("acct");
  const claims = await verifyAccountToken(token);
  if (!claims) {
    redirect(`/account?error=${encodeURIComponent("Please sign in again via a magic link.")}`);
  }
  if (!stripe) {
    redirect(`/account?error=${encodeURIComponent("Stripe not configured. Set STRIPE_SECRET_KEY.")}`);
  }

  const r: any = await query(
    `SELECT stripe_customer_id
       FROM public.orders
      WHERE email = $1
      ORDER BY (plan_key = 'annual') DESC, created_at DESC
      LIMIT 1`,
    [claims!.email]
  );
  const rows = Array.isArray(r?.rows) ? r.rows : (Array.isArray(r) ? r : []);
  const customerId: string | undefined = rows[0]?.stripe_customer_id;

  if (!customerId) {
    redirect(`/account?error=${encodeURIComponent("No Stripe customer found for this account.")}`);
  }

  const session = await (stripe as Stripe).billingPortal.sessions.create({
    customer: customerId as string,
    return_url: `${base}/account`,
  });

  redirect(session.url);
}

async function logoutAction() {
  "use server";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  await fetch(`${base}/api/account/logout`, { method: "POST", cache: "no-store" });
  redirect("/account");
}

/* ───────────────────── Data Loaders ───────────────────── */

async function getContext() {
  const token = safeCookie("acct");
  const claims = await verifyAccountToken(token);
  if (!claims) return { email: null, reports: [] as any[], provider: "", profile: "" };

  const email = claims.email;

  const rReports: any = await query(
    `SELECT
        o.id          AS order_id,
        o.created_at  AS order_created_at,
        p.id::text    AS preview_id,
        p.created_at  AS preview_created_at,
        p.profile     AS preview_profile,
        COALESCE(p.provider_display, p.provider) AS preview_provider
     FROM public.orders o
     LEFT JOIN public.previews p ON p.id = o.preview_id
     WHERE o.email = $1
     ORDER BY COALESCE(p.created_at, o.created_at) DESC
     LIMIT 50`,
    [email]
  );
  const reports = Array.isArray(rReports?.rows) ? rReports.rows : (Array.isArray(rReports) ? rReports : []);

  const rPrefs: any = await query(
    `SELECT provider, profile
       FROM public.orders
      WHERE email = $1
      ORDER BY (plan_key = 'annual') DESC, created_at DESC
      LIMIT 1`,
    [email]
  );
  const prefsRows = Array.isArray(rPrefs?.rows) ? rPrefs.rows : (Array.isArray(rPrefs) ? rPrefs : []);
  const provider = prefsRows[0]?.provider || "";
  const profile = prefsRows[0]?.profile || "";

  return { email, reports, provider, profile };
}

/* ───────────────────── Page Component ───────────────────── */

export default async function AccountPage({
  searchParams = {},
}: {
  searchParams?: { error?: string; updated?: string };
}) {
  const { email, reports, provider, profile } = await getContext();
  const errorMsg = searchParams?.error || "";

  // Show "Updated!" if query param OR flash cookie exists
  const cookieUpdated = cookies().get("account_updated")?.value === "1";
  const justUpdated = searchParams?.updated === "1" || cookieUpdated;

  if (!email) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Access Your Account</h1>
        <p className="text-slate-600 mb-4">
          Enter your email and we'll send you a secure link to view past reports and manage preferences.
        </p>
        <form action={sendMagicLink} className="space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full border rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            className="inline-flex items-center rounded-lg px-4 py-2 bg-sky-600 text-white font-semibold"
          >
            Email me a sign-in link
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      {errorMsg ? (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-md px-3 py-2">
          {errorMsg}
        </div>
      ) : null}

      <section>
        <h1 className="text-2xl font-semibold">Your Account</h1>
        <p className="text-slate-600">
          Signed in as <strong>{email}</strong>
        </p>
        <form action={logoutAction}>
          <button className="mt-2 text-sm text-slate-500 underline" type="submit">
            Sign out
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-1">Provider & Profile</h2>

        {justUpdated && (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 inline-flex items-center gap-2 rounded-md bg-green-50 text-green-800 border border-green-200 px-2.5 py-1 text-sm"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Updated!
          </div>
        )}

        <form action={updatePrefs} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Provider</label>
            <select
              key={`provider-${provider}`}
              name="provider"
              defaultValue={provider || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              required
            >
              <option value="" disabled>
                Select a provider
              </option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Profile</label>
            <select
              key={`profile-${profile}`}
              name="profile"
              defaultValue={profile || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              required
            >
              <option value="" disabled>
                Select a profile
              </option>
              {PROFILES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-lg px-4 py-2 bg-sky-600 text-white font-semibold"
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Billing</h2>
        <form action={createPortalAction}>
          <button className="inline-flex items-center rounded-lg px-4 py-2 bg-slate-900 text-white font-semibold" type="submit">
            Manage Billing
          </button>
        </form>
        <p className="text-slate-500 text-sm mt-2">
          Update payment method, download invoices, or cancel your subscription.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Past Reports</h2>
        {reports.length === 0 ? (
          <p className="text-slate-600">No reports yet.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((r: any) => {
              const ts = r.preview_created_at || r.order_created_at;
              const label = r.preview_id ? `Preview ${String(r.preview_id).slice(0, 8)}` : `Order ${r.order_id}`;
              const sub = `${r.preview_provider ? `${r.preview_provider} · ` : ""}${r.preview_profile || ""}`.replace(
                / · $/,
                ""
              );
              const href = r.preview_id ? `/api/report/pdf?previewId=${encodeURIComponent(r.preview_id)}` : "#";
              return (
                <li
                  key={`${r.order_id}-${r.preview_id || "nopreview"}`}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-slate-500">
                      {sub ? `${sub} · ` : ""}
                      {ts ? new Date(ts).toLocaleString() : ""}
                    </div>
                  </div>
                  {r.preview_id ? (
                    <a
                      href={href}
                      target="_blank"
                      className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200"
                    >
                      Download PDF
                    </a>
                  ) : (
                    <span className="text-slate-400 text-sm">No preview</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
