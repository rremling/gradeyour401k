// src/app/admin/login/AdminLoginClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ClientRow = {
  email: string;
  provider: string | null;
  profile: string | null;
  planned_retirement_year: number | null;
  employer: string | null;
  income_band: string | null;
  state: string | null;
  comms_pref: string | null;
  last_advisor_review_at: string | null; // YYYY-MM-DD (API now casts properly)
  client_notes: string | null;
  stripe_customer_id: string | null;
  latest_preview_id: string | null;
  last_statement_uploaded_at?: string | null;
  // NEW:
  full_name?: string | null;
};

const PROVIDERS = ["Fidelity", "Vanguard", "Schwab", "Voya", "Other"] as const;
const PROFILES = ["Growth", "Balanced", "Conservative"] as const;
const INCOME_BANDS = ["<75k", "75-150k", "150-300k", "300-600k", "600k+"] as const;
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DC","DE","FL","GA","HI","IA","ID","IL","IN","KS","KY",
  "LA","MA","MD","ME","MI","MN","MO","MS","MT","NC","ND","NE","NH","NJ","NM","NV","NY","OH",
  "OK","OR","PA","RI","SC","SD","TN","TX","UT","VA","VT","WA","WI","WV","WY",
] as const;
const COMMS_PREFS = ["email", "phone_email"] as const;

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const [y, m, day] = d.length > 10 ? d.slice(0, 10).split("-") : d.split("-");
    return `${m}-${day}-${y}`; // MM-DD-YYYY
  } catch {
    return d;
  }
}

export default function AdminLoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawReturnTo = sp.get("returnTo") || "/admin/orders";
  const returnTo =
    typeof rawReturnTo === "string" && rawReturnTo.startsWith("/")
      ? rawReturnTo
      : "/admin/orders";

  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [authed, setAuthed] = useState<boolean>(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [saveBusy, setSaveBusy] = useState<string | null>(null);
  const [justSavedEmail, setJustSavedEmail] = useState<string | null>(null);

  // local editable copies
  const [drafts, setDrafts] = useState<Record<string, ClientRow>>({});

  // ✅ Client-side ranking (do NOT filter away non-matches)
  // Bring matches to the top: startsWith > includes > none; then stable by email
  const visibleRows = useMemo(() => {
    const all = rows.slice();
    const q = search.trim().toLowerCase();
    if (!q) return all;
    const rank = (e: string) => (e.startsWith(q) ? 0 : e.includes(q) ? 1 : 2);
    return all.sort((a, b) => {
      const ae = a.email.toLowerCase();
      const be = b.email.toLowerCase();
      const ra = rank(ae);
      const rb = rank(be);
      if (ra !== rb) return ra - rb;
      return ae.localeCompare(be);
    });
  }, [rows, search]);

  useEffect(() => {
    (async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/admin/clients`, { cache: "no-store", credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setRows(data?.clients || []);
          setAuthed(true);
          setDrafts((d) => {
            const next: Record<string, ClientRow> = {};
            for (const r of data?.clients || []) {
              next[r.email] = d[r.email] || r;
            }
            return next;
          });
        } else if (res.status === 401) {
          setAuthed(false);
        } else {
          setErr(`Fetch error: ${res.status}`);
        }
      } catch {
        // ignore
      } finally {
        setIsFetching(false);
      }
    })();
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Unauthorized");
      }
      await reloadClients();
      setAuthed(true);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // ✅ Always fetch ALL clients; search is client-side only
  async function reloadClients() {
    setIsFetching(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/clients`, { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) {
          setAuthed(false);
          setErr("Session expired. Please log in again.");
          return;
        }
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Fetch error: ${res.status}`);
      }
      const data = await res.json();
      setRows(data?.clients || []);
      setDrafts((d) => {
        const next: Record<string, ClientRow> = {};
        for (const r of data?.clients || []) {
          next[r.email] = d[r.email] || r;
        }
        return next;
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to load clients");
    } finally {
      setIsFetching(false);
    }
  }

  function getDraft(email: string): ClientRow {
    return drafts[email] || rows.find((r) => r.email === email)!;
  }

  function setDraft(email: string, patch: Partial<ClientRow>) {
    setDrafts((prev) => ({
      ...prev,
      [email]: { ...getDraft(email), ...patch },
    }));
  }

  async function saveRow(email: string) {
    const row = getDraft(email);
    setSaveBusy(email);
    setErr(null);
    setJustSavedEmail(null);
    try {
      const res = await fetch("/api/admin/clients/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...row }),
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Save failed");
      }
      setJustSavedEmail(email);
      await reloadClients();
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSaveBusy(null);
      setTimeout(() => setJustSavedEmail(null), 2500);
    }
  }

  function markToday(email: string) {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    setDraft(email, { last_advisor_review_at: iso });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    setAuthed(false);
    setRows([]);
    router.refresh();
  }

  /* ---------------------- Statement helpers ---------------------- */
  function latestStatementUrl(email: string) {
    return `/api/admin/statements/latest?email=${encodeURIComponent(email)}`;
  }

  /* ---------------------- Views ---------------------- */

  if (!authed) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-xl font-semibold text-center mb-4">Admin Login</h1>

        <form onSubmit={onLogin} className="space-y-4 rounded-lg border p-4 bg-white">
          <div>
            <label className="block text-sm font-medium">Admin token</label>
            <input
              className="mt-1 w-full border rounded-md p-2"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter ADMIN_TOKEN"
              autoComplete="off"
              type="password"
            />
          </div>

          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Login"}
          </button>

              </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold">Advisor CRM</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded-md px-3 py-2 text-sm w-64"
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") reloadClients(); // still allowed, but will fetch ALL and sort client-side
            }}
          />
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={reloadClients}
            disabled={isFetching}
          >
            {isFetching ? "Loading…" : "Refresh"}
          </button>
          <button
            onClick={logout}
            className="rounded-md border px-3 py-2 text-sm bg-red-50 text-red-700 hover:bg-red-100"
          >
            Logout
          </button>
        </div>
      </header>

      {/* --- VERTICAL STACKED CARDS --- */}
      <div className="space-y-3">
        {visibleRows.length === 0 && (
          <div className="border rounded-lg bg-white px-4 py-8 text-center text-slate-500">
            {isFetching ? "Loading…" : "No clients found."}
          </div>
        )}

        {visibleRows.map((r) => {
          const d = getDraft(r.email);
          const pdfUrl = r.latest_preview_id
            ? `/api/report/pdf?previewId=${encodeURIComponent(r.latest_preview_id)}`
            : null;
          const stripeUrl = r.stripe_customer_id
            ? `https://dashboard.stripe.com/customers/${r.stripe_customer_id}`
            : null;
          const stmtUrl = latestStatementUrl(r.email);

          return (
            <div key={r.email} className="border rounded-lg bg-white p-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="font-semibold break-all">
                    {d.full_name ? `${d.full_name} — ` : ""}{r.email}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 bg-slate-50">
                      {d.provider || "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 bg-slate-50">
                      {d.profile || "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 bg-slate-50">
                      Last Review: {fmtDate(d.last_advisor_review_at)}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 bg-slate-50">
                      Last Statement: {fmtDate(r.last_statement_uploaded_at ?? null)}
                    </span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      title="Open latest PDF"
                    >
                      PDF
                    </a>
                  ) : (
                    <span className="rounded-md border px-2 py-1 text-xs text-slate-400">
                      PDF
                    </span>
                  )}
                  <a
                    href={stmtUrl}
                    target="_blank"
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    title="Download latest statement"
                  >
                    Statement
                  </a>
                  {stripeUrl ? (
                    <a
                      href={stripeUrl}
                      target="_blank"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      title="Open in Stripe Dashboard"
                    >
                      Stripe
                    </a>
                  ) : (
                    <span className="rounded-md border px-2 py-1 text-xs text-slate-400">
                      Stripe
                    </span>
                  )}
                </div>
              </div>

              {/* Editable fields */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Full name</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    value={d.full_name || ""}
                    onChange={(e) => setDraft(r.email, { full_name: e.target.value })}
                    placeholder="Client name"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Provider</label>
                  <select
                    className="w-full border rounded px-2 py-1 bg-white"
                    value={d.provider || ""}
                    onChange={(e) => setDraft(r.email, { provider: e.target.value })}
                  >
                    <option value="">—</option>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Profile</label>
                  <select
                    className="w-full border rounded px-2 py-1 bg-white"
                    value={d.profile || ""}
                    onChange={(e) => setDraft(r.email, { profile: e.target.value })}
                  >
                    <option value="">—</option>
                    {PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Planned Year</label>
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1"
                    value={d.planned_retirement_year ?? ""}
                    onChange={(e) =>
                      setDraft(r.email, {
                        planned_retirement_year: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Employer</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    value={d.employer || ""}
                    onChange={(e) => setDraft(r.email, { employer: e.target.value })}
                    placeholder="Employer"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Income</label>
                  <select
                    className="w-full border rounded px-2 py-1 bg-white"
                    value={d.income_band || ""}
                    onChange={(e) => setDraft(r.email, { income_band: e.target.value })}
                  >
                    <option value="">—</option>
                    {INCOME_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">State</label>
                  <select
                    className="w-full border rounded px-2 py-1 bg-white"
                    value={d.state || ""}
                    onChange={(e) => setDraft(r.email, { state: e.target.value })}
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Comms</label>
                  <select
                    className="w-full border rounded px-2 py-1 bg-white"
                    value={d.comms_pref || ""}
                    onChange={(e) => setDraft(r.email, { comms_pref: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="email">Email</option>
                    <option value="phone_email">Phone + Email</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Last Review</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="w-full border rounded px-2 py-1"
                      value={d.last_advisor_review_at || ""}
                      onChange={(e) => setDraft(r.email, { last_advisor_review_at: e.target.value || null })}
                    />
                    <button
                      type="button"
                      className="rounded border px-2 text-xs hover:bg-gray-50"
                      onClick={() => {
                        const iso = new Date().toISOString().slice(0,10);
                        setDraft(r.email, { last_advisor_review_at: iso });
                      }}
                    >
                      Today
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs text-slate-500 mb-1">Notes</label>
                  <textarea
                    className="w-full border rounded px-2 py-1 h-20"
                    value={d.client_notes || ""}
                    onChange={(e) => setDraft(r.email, { client_notes: e.target.value })}
                    placeholder="Notes…"
                  />
                </div>
              </div>

              {/* Footer actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 disabled:opacity-50"
                  onClick={() => saveRow(r.email)}
                  disabled={saveBusy === r.email}
                  type="button"
                >
                  {saveBusy === r.email ? "Saving…" : "Save"}
                </button>

                {justSavedEmail === r.email && (
                  <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    Saved!
                  </span>
                )}

                {/* Quick links */}
                <div className="ml-auto flex gap-2">
                  {r.latest_preview_id ? (
                    <a
                      href={`/api/report/pdf?previewId=${encodeURIComponent(r.latest_preview_id)}`}
                      target="_blank"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      title="Open latest PDF"
                    >
                      PDF
                    </a>
                  ) : (
                    <span className="rounded-md border px-2 py-1 text-xs text-slate-400">
                      PDF
                    </span>
                  )}
                  <a
                    href={latestStatementUrl(r.email)}
                    target="_blank"
                    className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                    title="Download latest statement"
                  >
                    Statement
                  </a>
                  {r.stripe_customer_id ? (
                    <a
                      href={`https://dashboard.stripe.com/customers/${r.stripe_customer_id}`}
                      target="_blank"
                      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                      title="Open in Stripe Dashboard"
                    >
                      Stripe
                    </a>
                  ) : (
                    <span className="rounded-md border px-2 py-1 text-xs text-slate-400">
                      Stripe
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500">
        Edits save to the latest order row for each email (same precedence as Account page).
      </p>
    </main>
  );
}
