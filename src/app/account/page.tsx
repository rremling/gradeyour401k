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

const ADVISOR_REVIEW_URL = "https://kenaiinvest.appointlet.com/s/401k-review-call/8346";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY",
  "LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY",
] as const;

const INCOME_BANDS = ["<75k", "75-150k", "150-300k", "300-600k", "600k+"] as const;
const COMMS_PREFS = ["email", "phone_email"] as const;

/* ───────────────────── Server Actions ───────────────────── */

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  if (!email) {
    redirect("/account?magic=invalid");
  }

  // Check if an account exists for this email
  const r: any = await query(
    `
      SELECT 1
        FROM public.orders
       WHERE email = $1
       ORDER BY (plan_key = 'annual') DESC, created_at DESC
       LIMIT 1
    `,
    [email]
  );
  const hasAccount = Array.isArray(r?.rows) ? r.rows.length > 0 : (Array.isArray(r) ? r.length > 0 : false);
  if (!hasAccount) {
    redirect("/account?magic=notfound");
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  const res = await fetch(`${base}/api/account/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  if (!res.ok) {
    redirect("/account?magic=sendfail");
  }
  redirect("/account?magic=sent");
}

async function updatePrefs(formData: FormData) {
  "use server";

  const token = safeCookie("acct");
  const claims = await verifyAccountToken(token);
  if (!claims) return { ok: false, error: "Unauthorized" };

  // core prefs
  const provider = String(formData.get("provider") || "").trim();
  const profile = String(formData.get("profile") || "").trim();
  const validProvider = PROVIDERS.includes(provider as (typeof PROVIDERS)[number]);
  const validProfile = PROFILES.includes(profile as (typeof PROFILES)[number]);
  if (!validProvider || !validProfile) {
    redirect("/account?error=invalid_prefs");
  }

  // contact fields
  const full_name = (String(formData.get("full_name") || "").trim() || null) as string | null;
  const phoneRaw = String(formData.get("phone") || "").trim();
  const phonePattern = /^\d{3}-\d{3}-\d{4}$/;

  // Require phone and must match xxx-xxx-xxxx
  if (!phonePattern.test(phoneRaw)) {
    // Bounce back with a phone error flag
    redirect("/account?phone=invalid");
  }
  const phone = phoneRaw as string; // safe now

  // CRM-ish fields
  const plannedYearRaw = String(formData.get("planned_retirement_year") || "").trim();
  const employer = String(formData.get("employer") || "").trim() || null;
  const income_band = String(formData.get("income_band") || "").trim() || null;
  const state = String(formData.get("state") || "").trim() || null;
  const comms_pref = String(formData.get("comms_pref") || "").trim() || null;
  const client_notes = String(formData.get("client_notes") || "").trim() || null;

  // planned retirement year validation (optional)
  let planned_retirement_year: number | null = null;
  if (plannedYearRaw) {
    const n = Number(plannedYearRaw);
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(n) || n < thisYear || n > thisYear + 60) {
      redirect("/account?error=bad_year");
    }
    planned_retirement_year = n;
  }

  // normalize enums if provided
  const incomeOk = !income_band || INCOME_BANDS.includes(income_band as (typeof INCOME_BANDS)[number]);
  const stateOk = !state || US_STATES.includes(state as (typeof US_STATES)[number]);
  const commsOk = !comms_pref || COMMS_PREFS.includes(comms_pref as (typeof COMMS_PREFS)[number]);
  if (!incomeOk || !stateOk || !commsOk) {
    redirect("/account?error=bad_detail");
  }

  try {
    // added full_name ($9) and phone ($10); email is $11
    const result: any = await query(
      `
      WITH target AS (
        SELECT id
          FROM public.orders
         WHERE email = $11
         ORDER BY (plan_key = 'annual') DESC, created_at DESC
         LIMIT 1
      )
      UPDATE public.orders o
         SET provider = $1,
             profile  = $2,
             planned_retirement_year = $3,
             employer = $4,
             income_band = $5,
             state = $6,
             comms_pref = $7,
             client_notes = $8,
             full_name = $9,
             phone = $10,
             updated_at = NOW()
        FROM target
       WHERE o.id = target.id
      RETURNING o.id
      `,
      [
        provider,                // $1
        profile,                 // $2
        planned_retirement_year, // $3
        employer,                // $4
        income_band,             // $5
        state,                   // $6
        comms_pref,              // $7
        client_notes,            // $8
        full_name,               // $9
        phone,                   // $10
        claims.email             // $11
      ]
    );

    const updated = Array.isArray(result?.rows) ? result.rows.length : (result?.rowCount ?? 0);
    if (!updated) {
      redirect("/account?error=not_found");
    }

    // Flash cookie for "Saved!"
    const c = cookies();
    c.set("account_updated", "1", {
      path: "/account",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60,
    });

  } catch (e: any) {
    if (e?.digest === "NEXT_REDIRECT") throw e;
    console.error("[account:updatePrefs] error:", e?.message || e);
    redirect("/account?error=save_fail");
  }

  revalidatePath("/account");
  redirect("/account?updated=1");
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
  const c = cookies();

  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const isSecure = process.env.NODE_ENV !== "development";

  c.set("acct", "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 0,
    domain: cookieDomain
  });

  c.set("account_updated", "", {
    path: "/account",
    httpOnly: false,
    sameSite: "lax",
    secure: isSecure,
    maxAge: 0,
    domain: cookieDomain
  });

  redirect("/");
}

/* NEW: Upload 401(k) Statement into Neon (bytea) */
async function uploadStatementAction(formData: FormData) {
  "use server";

  const token = safeCookie("acct");
  const claims = await verifyAccountToken(token);
  if (!claims) {
    redirect("/account?error=Unauthorized");
  }

  const file = formData.get("statement") as File | null;
  if (!file) {
    redirect("/account?stmt=missing");
  }

  // Validate size (<= 10 MB)
  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size <= 0 || file.size > MAX_BYTES) {
    redirect("/account?stmt=toolarge");
  }

  // Validate MIME
  const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    redirect("/account?stmt=badtype");
  }

  // Read bytes
  let bytes: Buffer;
  try {
    const ab = await file.arrayBuffer();
    bytes = Buffer.from(ab);
  } catch (e) {
    console.error("[account:uploadStatement] read error:", e);
    redirect("/account?stmt=readfail");
  }

  // Optional: link to most recent order for the user
  let orderId: number | null = null;
  try {
    const r: any = await query(
      `SELECT id
         FROM public.orders
        WHERE email = $1
        ORDER BY (plan_key = 'annual') DESC, created_at DESC
        LIMIT 1`,
      [claims!.email]
    );
    const rows = Array.isArray(r?.rows) ? r.rows : (Array.isArray(r) ? r : []);
    orderId = rows[0]?.id ?? null;
  } catch (e) {
    console.warn("[account:uploadStatement] could not link order_id:", e);
  }

  // Insert into Postgres
  try {
    await query(
      `INSERT INTO public.statements (email, order_id, file_name, mime_type, byte_size, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [claims!.email, orderId, file.name, mime, file.size, bytes]
    );
  } catch (e) {
    console.error("[account:uploadStatement] insert error:", e);
    redirect("/account?stmt=savefail");
  }

  revalidatePath("/account");
  redirect("/account?stmt=ok");
}

/* ───────────────────── Data Loaders ───────────────────── */

async function getContext() {
  const token = safeCookie("acct");
  const claims = await verifyAccountToken(token);
  if (!claims) return {
    email: null, reports: [] as any[], provider: "", profile: "",
    last_advisor_review_at: null as Date | string | null,
    planned_retirement_year: null as number | null,
    employer: "", income_band: "", state: "", comms_pref: "", client_notes: "",
    full_name: "", phone: "",
    last_statement_uploaded_at: null as Date | string | null,
  };

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
    `SELECT provider, profile,
            last_advisor_review_at,
            planned_retirement_year,
            employer,
            income_band,
            state,
            comms_pref,
            client_notes,
            full_name,
            phone
       FROM public.orders
      WHERE email = $1
      ORDER BY (plan_key = 'annual') DESC, created_at DESC
      LIMIT 1`,
    [email]
  );
  const prefsRows = Array.isArray(rPrefs?.rows) ? rPrefs.rows : (Array.isArray(rPrefs) ? rPrefs : []);
  const pref = prefsRows[0] || {};
  const provider = pref.provider || "";
  const profile = pref.profile || "";

  // NEW: last statement upload date
  const rLastStmt: any = await query(
    `SELECT uploaded_at
       FROM public.statements
      WHERE email = $1
      ORDER BY uploaded_at DESC
      LIMIT 1`,
    [email]
  );
  const last_statement_uploaded_at =
    Array.isArray(rLastStmt?.rows) && rLastStmt.rows[0]?.uploaded_at
      ? rLastStmt.rows[0].uploaded_at
      : null;

  return {
    email,
    reports,
    provider,
    profile,
    last_advisor_review_at: pref.last_advisor_review_at || null,
    planned_retirement_year: pref.planned_retirement_year ?? null,
    employer: pref.employer || "",
    income_band: pref.income_band || "",
    state: pref.state || "",
    comms_pref: pref.comms_pref || "",
    client_notes: pref.client_notes || "",
    full_name: pref.full_name || "",
    phone: pref.phone || "",
    last_statement_uploaded_at,
  };
}

/* ───────────────────── Page Component ───────────────────── */

export default async function AccountPage({
  searchParams = {},
}: {
  searchParams?: {
    error?: string;
    updated?: string;
    magic?: "sent" | "notfound" | "invalid" | "sendfail";
    phone?: "invalid";
    stmt?: "ok" | "missing" | "toolarge" | "badtype" | "readfail" | "savefail"; // NEW
  };
}) {
  const {
    email, reports, provider, profile,
    last_advisor_review_at,
    planned_retirement_year,
    employer, income_band, state, comms_pref, client_notes,
    full_name, phone,
    last_statement_uploaded_at, // NEW
  } = await getContext();

  const errorMsg = searchParams?.error || "";
  const magicStatus = searchParams?.magic;

  const cookieUpdated = cookies().get("account_updated")?.value === "1";
  const justUpdated = searchParams?.updated === "1" || cookieUpdated;

  // Field-specific error flags
  const phoneInvalid = searchParams?.phone === "invalid";

  if (!email) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Access Your Account</h1>
        <p className="text-slate-600 mb-4">
          Enter your email and we'll send you a secure link to view past reports and manage preferences.
        </p>

        {/* Banners for magic link result */}
        {magicStatus === "sent" && (
          <div className="mb-3 border border-green-200 bg-green-50 text-green-800 rounded-md px-3 py-2">
            We found your account and sent a sign-in link to your email.
          </div>
        )}
        {magicStatus === "notfound" && (
          <div className="mb-3 border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-3 py-2">
            We couldn’t find an active account for that email. Please check the address used at purchase or contact support.
          </div>
        )}
        {magicStatus === "invalid" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            Please enter a valid email address.
          </div>
        )}
        {magicStatus === "sendfail" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            We couldn’t send the link right now. Please try again in a moment.
          </div>
        )}

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

      {/* Provider & Profile + Details (single form) */}
      <section>
        <h2 className="text-xl font-semibold mb-1">Your Plan & Details</h2>

        <form action={updatePrefs} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Provider */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Provider</label>
            <select
              key={`provider-${provider}`}
              name="provider"
              defaultValue={provider || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              required
            >
              <option value="" disabled>Select a provider</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Profile */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Profile</label>
            <select
              key={`profile-${profile}`}
              name="profile"
              defaultValue={profile || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
              required
            >
              <option value="" disabled>Select a profile</option>
              {PROFILES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Planned retirement year */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Planned Retirement Year</label>
            <input
              type="number"
              name="planned_retirement_year"
              placeholder="YYYY"
              defaultValue={planned_retirement_year ?? ""}
              className="w-full border rounded-lg px-3 py-2"
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 60}
            />
          </div>

          {/* Employer */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Employer / Plan Sponsor</label>
            <input
              type="text"
              name="employer"
              placeholder="e.g., Southwest Airlines"
              defaultValue={employer || ""}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Income band */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Household Income Range</label>
            <select
              name="income_band"
              defaultValue={income_band || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Prefer not to say</option>
              {INCOME_BANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* State */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">State</label>
            <select
              name="state"
              defaultValue={state || ""}
              className="w-full border rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Select</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Full Name */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Full Name</label>
            <input
              type="text"
              name="full_name"
              placeholder="Your name"
              defaultValue={full_name || ""}
              className="w-full border rounded-lg px-3 py-2"
              maxLength={200}
            />
          </div>

          {/* Phone (required, strict pattern) */}
          <div className="sm:col-span-1">
            <label className="text-sm text-slate-600">Phone</label>
            <input
              type="tel"
              name="phone"
              placeholder="123-456-7890"
              defaultValue={phone || ""}
              className={[
                "w-full border rounded-lg px-3 py-2",
                phoneInvalid ? "border-red-500 ring-1 ring-red-300" : ""
              ].join(" ")}
              required
              // exact xxx-xxx-xxxx pattern
              pattern="^\d{3}-\d{3}-\d{4}$"
              title="Enter phone as 123-456-7890"
              inputMode="numeric"
              maxLength={12}
            />
            {phoneInvalid && (
              <p className="mt-1 text-sm text-red-600">
                Please enter your phone as <strong>123-456-7890</strong> and try again.
              </p>
            )}
          </div>

          {/* Comms pref */}
          <div className="sm:col-span-3">
            <label className="text-sm text-slate-600 block mb-1">Communication Preference</label>
            <div className="flex items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="comms_pref" value="email" defaultChecked={comms_pref === "email" || !comms_pref} />
                Email only
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="comms_pref" value="phone_email" defaultChecked={comms_pref === "phone_email"} />
                Phone + Email
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="sm:col-span-3">
            <label className="text-sm text-slate-600">Notes (optional)</label>
            <textarea
              name="client_notes"
              rows={3}
              placeholder="Anything you'd like your advisor to know."
              defaultValue={client_notes || ""}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Save + inline Saved! banner */}
          <div className="sm:col-span-3 flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-sky-600 text-white font-semibold"
            >
              Save
            </button>
            {justUpdated && (
              <div
                role="status"
                aria-live="polite"
                className="inline-flex items-center gap-2 rounded-md bg-green-50 text-green-800 border border-green-200 px-2.5 py-1 text-sm"
              >
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Saved!
              </div>
            )}
          </div>
        </form>
      </section>

      {/* Advisor Review panel (enhanced with Statement Upload) */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Advisor Review</h2>

        {/* Inline result banners for statement upload */}
        {searchParams?.stmt === "ok" && (
          <div className="mb-3 border border-green-200 bg-green-50 text-green-800 rounded-md px-3 py-2">
            Statement uploaded successfully.
          </div>
        )}
        {searchParams?.stmt === "missing" && (
          <div className="mb-3 border border-amber-200 bg-amber-50 text-amber-900 rounded-md px-3 py-2">
            Please choose a file before uploading.
          </div>
        )}
        {searchParams?.stmt === "toolarge" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            File is too large. Max size is 10&nbsp;MB.
          </div>
        )}
        {searchParams?.stmt === "badtype" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            Unsupported file type. Allowed: PDF, JPG, PNG.
          </div>
        )}
        {searchParams?.stmt === "readfail" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            Couldn’t read the file. Please try again.
          </div>
        )}
        {searchParams?.stmt === "savefail" && (
          <div className="mb-3 border border-red-200 bg-red-50 text-red-800 rounded-md px-3 py-2">
            We couldn’t save your statement right now. Please try again shortly.
          </div>
        )}

        <div className="rounded-lg border p-4 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="text-slate-600">
                Last Advisor Review:{" "}
                <strong>
                  {last_advisor_review_at
                    ? new Date(last_advisor_review_at).toLocaleDateString()
                    : "—"}
                </strong>
              </div>
              <div className="text-slate-600">
                Last Statement Upload:{" "}
                <strong>
                  {last_statement_uploaded_at
                    ? new Date(last_statement_uploaded_at).toLocaleDateString()
                    : "—"}
                </strong>
              </div>
              <p className="text-xs text-slate-500">
                Accepted types: PDF, JPG, PNG • Max 10&nbsp;MB • Avoid full SSNs.
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
              {/* Upload mini-form */}
              <form action={uploadStatementAction} className="flex items-center gap-2">
                <input
                  type="file"
                  name="statement"
                  accept=".pdf,image/jpeg,image/png"
                  className="block w-full sm:w-64 text-sm
                             file:mr-3 file:rounded-md file:border file:border-slate-300
                             file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm
                             file:text-slate-700 hover:file:bg-slate-100"
                  required
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 bg-slate-900 text-white font-semibold"
                >
                  Upload
                </button>
              </form>

              {/* Existing book button */}
              <a
                href={ADVISOR_REVIEW_URL}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2 bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
              >
                Book your $149 Advisor Review
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Billing */}
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

      {/* Past Reports (PDFs ONLY) */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Past Reports</h2>
        {reports.filter((r: any) => !!r.preview_id).length === 0 ? (
          <p className="text-slate-600">No reports yet.</p>
        ) : (
          <ul className="space-y-2">
            {reports
              .filter((r: any) => !!r.preview_id)
              .map((r: any) => {
                const ts = r.preview_created_at || r.order_created_at;
                const label = `Preview ${String(r.preview_id).slice(0, 8)}`;
                const sub = `${r.preview_provider ? `${r.preview_provider} · ` : ""}${r.preview_profile || ""}`.replace(/ · $/, "");
                const href = `/api/report/pdf?previewId=${encodeURIComponent(r.preview_id)}`;
                return (
                  <li
                    key={`${r.order_id}-${r.preview_id}`}
                    className="flex items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-sm text-slate-500">
                        {sub ? `${sub} · ` : ""}
                        {ts ? new Date(ts).toLocaleString() : ""}
                      </div>
                    </div>
                    <a
                      href={href}
                      target="_blank"
                      className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200"
                    >
                      Download PDF
                    </a>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </main>
  );
}
