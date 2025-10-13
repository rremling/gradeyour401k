// src/app/admin/orders/OrdersClient.tsx
"use client";

import { useState } from "react";

type Order = { id: string; total: number };

export default function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to refresh");
      }
      const j = await res.json();
      setOrders(j.orders || []);
    } catch (e: any) {
      setErr(e?.message || "Refresh failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <button
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-blue-600 text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
          {err}
        </div>
      )}

      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="rounded border p-3 bg-white">
            <div className="font-medium">Order #{o.id}</div>
            <div className="text-sm opacity-80">Total: ${o.total.toFixed(2)}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
