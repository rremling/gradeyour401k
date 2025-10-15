// src/app/admin/orders/OrdersClient.tsx
"use client";

import { useState } from "react";

type Order = {
  id?: string;
  customerEmail?: string | null; // or: email
  status?: string | null;
  createdAt?: string | null;     // or: created_at
  total?: number | string | null;
  currency?: string | null;
  planKey?: string | null;       // or: plan_key
  nextDue1?: string | null;      // or: next_due_1
  nextDue2?: string | null;      // or: next_due_2
  nextDue3?: string | null;      // or: next_due_3
  [k: string]: any;
};

// read camelCase or snake_case safely
const pick = <T,>(o: any, camel: string, snake: string): T | null =>
  (o?.[camel] ?? o?.[snake] ?? null) as T | null;

function formatDue(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatDueSafe(o: any, camel: string, snake: string) {
  return formatDue(pick<string>(o, camel, snake));
}

function formatMoney(v: unknown, currency?: string | null) {
  if (v === null || v === undefined || v === "") return "$—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "$—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function OrdersClient({
  initialOrders,
  initialError,
  initialCursor,
}: {
  initialOrders: Order[];
  initialError?: string | null;
  initialCursor?: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>(Array.isArray(initialOrders) ? initialOrders : []);
  const [err, setErr] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(initialCursor ?? null);

  // NEW: search state (persist current query to use for loadMore/refresh)
  const [query, setQuery] = useState<string>("");
  const [activeEmail, setActiveEmail] = useState<string>(""); // last applied email

  function buildQuery(base: string, opts?: { after?: string | null; email?: string | null; limit?: number }) {
    const url = new URL(base, window.location.origin);
    url.pathname = "/api/admin/orders";
    const limit = opts?.limit ?? 25;
    url.searchParams.set("limit", String(limit));
    if (opts?.after) url.searchParams.set("after", opts.after);
    const e = (opts?.email ?? "").trim();
    if (e) url.searchParams.set("email", e);
    return url.pathname + url.search; // relative path for fetch
    }

  async function applySearch() {
    setLoading(true);
    setErr(null);
    try {
      const email = query.trim();
      const url = buildQuery("/api/admin/orders", { email, limit: 25 });
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Search failed (${r.status})`);
      const j = await r.json().catch(() => ({} as any));
      setOrders(Array.isArray(j?.orders) ? j.orders : []);
      setCursor(j?.nextCursor ?? null);
      setActiveEmail(email); // remember current filter for loadMore/refresh
      if (j?._error) setErr(String(j._error));
    } catch (e: any) {
      setErr(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function clearSearch() {
    setQuery("");
    setActiveEmail("");
    setLoading(true);
    setErr(null);
    try {
      const url = buildQuery("/api/admin/orders", { limit: 25 });
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Refresh failed (${r.status})`);
      const j = await r.json().catch(() => ({} as any));
      setOrders(Array.isArray(j?.orders) ? j.orders : []);
      setCursor(j?.nextCursor ?? null);
      if (j?._error) setErr(String(j._error));
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const url = buildQuery("/api/admin/orders", { email: activeEmail, limit: 25 });
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Refresh failed (${r.status})`);
      const j = await r.json().catch(() => ({} as any));
      setOrders(Array.isArray(j?.orders) ? j.orders : []);
      setCursor(j?.nextCursor ?? null);
      if (j?._error) setErr(String(j._error));
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setMoreLoading(true);
    setErr(null);
    try {
      const url = buildQuery("/api/admin/orders", { after: cursor, email: activeEmail, limit: 25 });
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`Load more failed (${r.status})`);
      const j = await r.json().catch(() => ({} as any));
      const next = Array.isArray(j?.orders) ? j.orders : [];
      setOrders(prev => [...prev, ...next]);
      setCursor(j?.nextCursor ?? null);
      if (j?._error) setErr(String(j._error));
    } catch (e: any) {
      setErr(e?.message || "Load more failed");
    } finally {
      setMoreLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/admin/login?returnTo=/admin/orders";
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      applySearch();
    }
  }

  return (
    <main className="p-6">
      {/* Header + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Search box */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by email (e.g. user@domain.com)"
              className="border rounded-md px-3 py-2 w-64"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              onClick={applySearch}
              disabled={loading}
              className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
              title="Search"
            >
              Search
            </button>
            <button
              onClick={clearSearch}
              disabled={loading && !activeEmail && !query}
              className="rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200 disabled:opacity-50"
              title="Clear"
            >
              Clear
            </button>
          </div>

          {/* Existing actions */}
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={logout}
              className="rounded-md bg-gray-200 text-gray-900 px-4 py-2 hover:bg-gray-300"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {err && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {err}
        </div>
      )}

      {/* List */}
      {orders.length === 0 ? (
        <div className="mt-6 text-sm text-gray-600">No orders found.</div>
      ) : (
        <>
          <ul className="space-y-3">
            {orders.map((o, idx) => {
              const email = pick<string>(o, "customerEmail", "email");
              const created = pick<string>(o, "createdAt", "created_at");
              const currency = pick<string>(o, "currency", "currency");
              return (
                <li key={o.id ?? idx} className="rounded border p-3 bg-white">
                  <div className="font-medium">Order #{o.id ?? "—"}</div>
                  <div className="text-sm opacity-80">
                    {email ?? "—"} • {o.status ?? "—"} • {formatDate(created)}
                  </div>
                  <div className="text-sm">Total: {formatMoney(o.total, currency)}</div>

                  <div className="mt-2 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <span className="opacity-70">Plan:</span>{" "}
                      {pick<string>(o, "planKey", "plan_key") ?? "—"}
                    </div>
                    <div>
                      <span className="opacity-70">Next Due 1:</span>{" "}
                      {formatDueSafe(o, "nextDue1", "next_due_1")}
                    </div>
                    <div>
                      <span className="opacity-70">Next Due 2:</span>{" "}
                      {formatDueSafe(o, "nextDue2", "next_due_2")}
                    </div>
                    <div>
                      <span className="opacity-70">Next Due 3:</span>{" "}
                      {formatDueSafe(o, "nextDue3", "next_due_3")}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={!cursor || moreLoading}
              className="rounded-md bg-gray-100 px-4 py-2 hover:bg-gray-200 disabled:opacity-50"
            >
              {cursor ? (moreLoading ? "Loading…" : "Load more") : "No more results"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
