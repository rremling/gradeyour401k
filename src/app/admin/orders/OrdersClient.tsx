// src/app/admin/orders/OrdersClient.tsx
"use client";
import { useState } from "react";
type Order = { id?: string; total?: number | string | null; [k: string]: any };

function formatMoney(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$—";
}

export default function OrdersClient({
  initialOrders,
  initialError,
}: {
  initialOrders: Order[];
  initialError?: string | null;
}) {
  const [orders, setOrders] = useState<Order[]>(Array.isArray(initialOrders) ? initialOrders : []);
  const [err, setErr] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`Refresh failed (${r.status}) ${t.slice(0, 120)}`);
      }
      const j = await r.json().catch(() => ({} as any));
      setOrders(Array.isArray(j?.orders) ? j.orders : []);
      if (j?._error) setErr(String(j._error));
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
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
        <ul className="space-y-2">
          {orders.map((o, idx) => (
            <li key={(o.id as string) ?? idx} className="rounded border p-3 bg-white">
              <div className="font-medium">Order #{(o.id as string) ?? "—"}</div>
              <div className="text-sm opacity-80">Total: {formatMoney(o.total)}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
