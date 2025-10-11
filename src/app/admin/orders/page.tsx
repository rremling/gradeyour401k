// src/app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  email: string | null;
  plan_key: string | null;
  status: string | null;
  preview_id: string | null;
  stripe_session_id: string | null;
  created_at: string;
  next_due_1: string | null;
};

export default function AdminOrdersPage() {
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // load saved token
  useEffect(() => {
    const t = localStorage.getItem("gy4k_admin_token") || "";
    setToken(t);
  }, []);

  async function load() {
    setError(null);
    setLoading(true);
    setOrders(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`${data?.error || res.statusText} (http ${res.status})`);
      }
      setOrders(data.orders || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function saveToken(v: string) {
    setToken(v);
    localStorage.setItem("gy4k_admin_token", v);
  }

  async function resend(previewId: string | null, email: string | null) {
    setError(null);
    if (!previewId) {
      setError("Missing preview_id for this order.");
      return;
    }
    try {
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ previewId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Resend failed");
      alert("Report re-sent!");
    } catch (e: any) {
      setError(e?.message || "Resend failed");
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin · Orders</h1>

      <div className="rounded border p-4 bg-white space-y-3">
        <label className="text-sm font-medium">Admin Token</label>
        <div className="flex gap-2">
          <input
            className="border rounded p-2 flex-1"
            type="password"
            placeholder="Paste ADMIN_TOKEN"
            value={token}
            onChange={(e) => saveToken(e.target.value)}
          />
          <button
            onClick={load}
            className="rounded bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded border p-4 bg-white">
        {orders === null ? (
          <p className="text-sm text-gray-600">No data yet. Click Refresh.</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-600">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Preview ID</th>
                  <th className="py-2 pr-4">Session</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b">
                    <td className="py-2 pr-4">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{o.email || "—"}</td>
                    <td className="py-2 pr-4">{o.plan_key || "—"}</td>
                    <td className="py-2 pr-4">{o.status || "—"}</td>
                    <td className="py-2 pr-4">{o.preview_id || "—"}</td>
                    <td className="py-2 pr-4">{o.stripe_session_id || "—"}</td>
                    <td className="py-2 pr-4">
                      <button
                        className="rounded border px-3 py-1 hover:bg-gray-50"
                        onClick={() => resend(o.preview_id, o.email)}
                      >
                        Re-send
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
