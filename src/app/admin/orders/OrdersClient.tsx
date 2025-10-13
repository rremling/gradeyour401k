// src/app/admin/orders/OrdersClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Order = { id?: string; total?: number | string | null; [k: string]: any };

function formatMoney(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "$—";
  return `$${n.toFixed(2)}`;
}

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(Array.isArray(initialOrders) ? initialOrders : []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Refresh failed (${r.status})`);
      }
      const j = await r.json().catch(() => ({}));
      const next = Array.isArray((j as any).orders) ? (j as any).orders : [];
      setOrders(next);
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/session", { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Logout failed (${r.status})`);
      }
      // Clear client state then go back to login
      setOrders([]);
      router.replace("/admin/login?returnTo=/admin/orders");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Logout failed");
      setLoggingOut(false);
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="rounded-md bg-gray-200 text-gray-900 px-4 py-2 hover:bg-gray-300 disabled:opacity-50"
          >
            {loggingOut ? "Logging out…" : "Logout"}
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {err}
        </div>
      )}

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
