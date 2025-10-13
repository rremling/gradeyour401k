// src/app/admin/orders/OrdersClient.tsx
"use client";

import { useState } from "react";

type Order = {
  id?: string;
  customerEmail?: string | null;
  status?: string | null;
  createdAt?: string | null;
  total?: number | string | null;
  currency?: string | null;
  [k: string]: any;
};

function formatMoney(v: unknown, currency?: string | null) {
  if (v === null || v === undefined || v === "") return "$—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "$—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "USD").toUpperCase() }).format(n);
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
  const [cursor, setCursor] = useState<string | null>(initialCursor ?? null);
  const [moreLoading, setMoreLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/orders?limit=25", { cache: "no-store" });
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
      const url = `/api/admin/orders?limit=25&after=${encodeURIComponent(cursor)}`;
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

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={loading} className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50">
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button onClick={logout} className="rounded-md bg-gray-200 text-gray-900 px-4 py-2 hover:bg-gray-300">
            Logout
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {orders.length === 0 ? (
        <div className="mt-6 text-sm text-gray-600">No orders found.</div>
      ) : (
        <>
          <ul className="space-y-3">
            {orders.map((o, idx) => (
              <li key={o.id ?? idx} className="rounded border p-3 bg-white">
                <div className="font-medium">Order #{o.id ?? "—"}</div>
                <div className="text-sm opacity-80">
                  {o.customerEmail ?? "—"} • {o.status ?? "—"} • {formatDate(o.createdAt)}
                </div>
                <div className="text-sm">Total: {formatMoney(o.total, o.currency)}</div>
              </li>
            ))}
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
