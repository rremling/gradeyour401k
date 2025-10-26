// src/app/account/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAccountToken } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

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

async function updatePrefs(_: any, formData: FormData) {
  "use server";
  const token = cookies().get("acct")?.value || "";
  const claims = await verifyAccountToken(token);
  if (!claims) return { ok: false, error: "Unauthorized" };

  const provider = String(formData.get("provider") || "").trim();
  const profile = String(formData.get("profile") || "").trim();

  await query(
    `UPDATE public.orders
        SET provider = $1, profile = $2
      WHERE email = $3
        AND plan_key = 'annual'`,
    [provider, profile, claims.email]
  );

  return { ok: true };
}

async function createPortal() {
  "use server";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${base}/api/portal`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.url) {
    return { ok: false, error: j?.error || "Could not create portal session" };
  }
  // Redirect server-side to Stripe Billing Portal
  redirect(j.url as string);
}

async function logoutAction() {
  "use server";
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  await fetch(`${base}/api/account/logout`, { method: "POST", cache: "no-store" });
  redirect("/account");
}

/* ───────────────────── Data Loaders ───────────────────── */

async function getContext() {
  const token = cookies().get("acct")?.value || "";
  const claims = await verifyAccountToken(token);
  if (!claims) return { email: null, reports: [] as any[], provider: "", profile: "" };

  const email = claims.email;

  // Use orders + previews to list downloadable PDFs (no separate reports table required)
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
      WHERE email = $1 AND plan_key = 'annual'
      ORDER BY created_at DESC
      LIMIT 1`,
    [email]
  );
  const prefsRows = Array.isArray(rPrefs?.rows) ? rPrefs.rows : (Array.isArray(rPrefs) ? rPrefs : []);
  const provider = prefsRows[0]?.provider || "";
  const profile = prefsRows[0]?.profile || "";

  return { email, reports, provider, profile };
}

/* ───────────────────── Page Component ───────────────────── */

export default async function AccountPage() {
  const { email, reports, provider, profile } = await getContext();

  if (!email) {
    // Not signed in → show magic link request
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

      <section>
        <h2 className="text-xl font-semibold mb-3">Provider & Profile</h2>
        <form action={updatePrefs} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Provider</label>
            <input
              name="provider"
              defaultValue={provider}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Fidelity / Vanguard / etc."
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Profile</label>
            <input
              name="profile"
              defaultValue={profile}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Conservative / Moderate / Growth"
            />
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
        <form action={createPortal}>
          <button className="inline-flex items-center rounded-lg px-4 py-2 bg-slate-900 text-white font-semibold" type="submit">
            Manage Billing
          </button>
        </form>
        <p className="text-slate-500 text-sm mt-2">Update payment method, download invoices, or cancel your subscription.</p>
      </section>
    </main>
  );
}
