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
  last_advisor_review_at: string | null; // YYYY-MM-DD
  client_notes: string | null;
  stripe_customer_id: string | null;
  latest_preview_id: string | null;
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

export default function AdminLoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawReturnTo = sp.get("returnTo") || "/admin/orders";
  const returnTo = typeof rawReturnTo === "string" && rawReturnTo.startsWith("/") ? rawReturnTo : "/admin/orders";

  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [authed, setAuthed] = useState<boolean>(false);
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [saveBusy, setSaveBusy] = useState<string | null>(null); // email of row saving
  const [justSavedEmail, setJustSavedEmail] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, ClientRow>>({});

  const visibleRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r => r.email.toLowerCase().includes(q));
  }, [rows, search]);

  useEffect(() => {
    (async () => {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/admin/clients`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setRows(data?.clients || []);
          setAuthed(true);
        } else if (res.status === 401) {
          setAuthed(false);
        } else {
          setErr(`Fetch error: ${res.status}`);
        }
      } catch {
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

  async function reloadClients() {
    setIsFetching(true);
    setErr(null);
    try {
      const url = search.trim()
        ? `/api/admin/clients?search=${encodeURIComponent(search.trim())}`
        : `/api/admin/clients`;
      const res = await fetch(url, { cache: "no-store" });
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
    return drafts[email] || rows.find(r => r.email === email)!;
  }

  function setDraft(email: string, patch: Partial<ClientRow>) {
    setDrafts(prev => ({
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

          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Login"}
          </button>

          <p className="text-xs text-slate-500">
            After login you’ll see a simple CRM with client fields from Account pages.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold">Advisor CRM</h1>
        <div className="flex items-center gap-2">
          <input
            className="border rounded-md px-3 py-2 text-sm w-64"
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") reloadClients(); }}
          />
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
            onClick={reloadClients}
            disabled={isFetching}
          >
            {isFetching ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-slate-700">
            <tr>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Provider</th>
              <th className="text-left px-3 py-2">Profile</th>
              <th className="text-left px-3 py-2">Planned Year</th>
              <th className="text-left px-3 py-2">Employer</th>
              <th className="text-left px-3 py-2">Income</th>
              <th className="text-left px-3 py-2">State</th>
              <th className="text-left px-3 py-2">Comms</th>
              <th className="text-left px-3 py-2">Last Review</th>
              <th className="text-left px-3 py-2">Notes</th>
              <th className="text-left px-3 py-2">Actions</th>
              <th className="text-left px-3 py-2">Stripe</th>
              <th className="text-left px-3 py-2">Latest PDF</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-slate-500">
                  {isFetching ? "Loading…" : "No clients found."}
                </td>
              </tr>
            )}
            {visibleRows.map((r) => {
              const d = getDraft(r.email);
              const stripeUrl = r.stripe_customer_id
                ? `https://dashboard.stripe.com/customers/${r.stripe_customer_id}`
                : null;
              const pdfUrl = r.latest_preview_id
                ? `/api/report/pdf?previewId=${encodeURIComponent(r.latest_preview_id)}`
                : null;

              return (
                <tr key={r.email} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 bg-white"
                      value={d.provider || ""}
                      onChange={(e) => setDraft(r.email, { provider: e.target.value })}
                    >
                      <option value="">—</option>
                      {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 bg-white"
                      value={d.profile || ""}
                      onChange={(e) => setDraft(r.email, { profile: e.target.value })}
                    >
                      <option value="">—</option>
                      {PROFILES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-24"
                      value={d.planned_retirement_year ?? ""}
                      onChange={(e) => setDraft(r.email, { planned_retirement_year: e.target.value ? Number(e.target.value) : null })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      className="border rounded px-2 py-1 w-44"
                      value={d.employer || ""}
                      onChange={(e) => setDraft(r.email, { employer: e.target.value })}
                      placeholder="Employer"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 bg-white"
                      value={d.income_band || ""}
                      onChange={(e) => setDraft(r.email, { income_band: e.target.value })}
                    >
                      <option value="">—</option>
                      {INCOME_BANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 bg-white"
                      value={d.state || ""}
                      onChange={(e) => setDraft(r.email, { state: e.target.value })}
                    >
                      <option value="">—</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 bg-white"
                      value={d.comms_pref || ""}
                      onChange={(e) => setDraft(r.email, { comms_pref: e.target.value })}
                    >
                      <option value="">—</option>
                      {COMMS_PREFS.map(c => (
                        <option key={c} value={c}>
                          {c === "email" ? "Email" : "Phone + Email"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="border rounded px-2 py-1"
                        value={d.last_advisor_review_at || ""}
                        onChange={(e) => setDraft(r.email, { last_advisor_review_at: e.target.value || null })}
                      />
                      <button
                        className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
                        onClick={() => markToday(r.email)}
                        type="button"
                        title="Set to today"
                      >
                        Today
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      className="border rounded px-2 py-1 w-64 h-16"
                      value={d.client_notes || ""}
                      onChange={(e) => setDraft(r.email, { client_notes: e.target.value })}
                      placeholder="Notes..."
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <button
                        className="rounded bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 disabled:opacity-50"
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
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {stripeUrl ? (
                      <a
                        href={stripeUrl}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                        title="Open in Stripe Dashboard"
                      >
                        Open Stripe
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {pdfUrl ? (
                      <a
                        href={pdfUrl}
                        target="_blank"
                        className="text-blue-600 hover:underline"
                        title="Open latest PDF"
                      >
                        Open PDF
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Edits save to the latest order row for each email (same precedence as Account page).
      </p>
    </main>
  );
}
