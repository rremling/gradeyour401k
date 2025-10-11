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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState<Record<string, "ok" | "sending" | "err">>({});

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orders", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to load");
      setOrders(data.orders || []);
    } catch (e: any) {
      setErr(e?.message || "Error loading orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function resend(order: Order) {
    if (!order.email || !order.preview_id) {
      alert("Missing destination email or preview id on this order.");
      return;
    }
    setSending((s) => ({ ...s, [order.id]: "sending" }));
    try {
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: order.email, previewId: order.preview_id }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Resend failed");
      setSending((s) => ({ ...s, [order.id]: "ok" }));
    } catch (e) {
      setSending((s) => ({ ...s, [order.id]: "err" }));
      alert("Resend failed. Check logs.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={logout}
            className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-sm text-gray-600">No orders found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-[700px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Plan</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Preview</th>
                <th className="px-3 py-2 text-left">Session</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const state = sending[o.id];
                const btnClass =
                  state === "ok"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : state === "sending"
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : state === "err"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "border hover:bg-gray-50";
                return (
                  <tr key={o.id} className="border-t">
                    <td className="px-3 py-2">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{o.email || "—"}</td>
                    <td className="px-3 py-2">{o.plan_key || "—"}</td>
                    <td className="px-3 py-2">{o.status || "—"}</td>
                    <td className="px-3 py-2">{o.preview_id || "—"}</td>
                    <td className="px-3 py-2">{o.stripe_session_id || "—"}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => resend(o)}
                        disabled={state === "sending"}
                        className={`rounded-md px-3 py-1.5 text-sm ${btnClass}`}
                      >
                        {state === "ok" ? "Re-sent" : state === "sending" ? "Sending…" : "Re-send"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
