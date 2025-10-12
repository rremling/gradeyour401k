// src/app/admin/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import { readAdminToken, clearAdminToken } from "@/lib/admin";
import Link from "next/link";

type OrderRow = {
  id: string;
  email: string | null;
  plan_key: string | null;
  status: string | null;
  preview_id: string | null;
  stripe_session_id: string | null;
  created_at: string; // ISO
  next_due_1: string | null;
};

export default function AdminOrdersPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [resent, setResent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = readAdminToken();
    setToken(t);
    if (!t) return;
    load(t);
  }, []);

  async function load(t: string) {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${t}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`Error loading orders: ${res.status} ${res.statusText}`);
        setOrders(null);
      } else {
        const data = await res.json();
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
      setOrders(null);
    } finally {
      setRefreshing(false);
    }
  }

  async function onResend(o: OrderRow) {
    if (!token) return;
    if (!o.email || !o.preview_id) {
      setError("Missing destination email or preview_id");
      return;
    }
    setResending(o.id);
    setError(null);
    try {
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: o.email,
          previewId: o.preview_id,
          sessionId: o.stripe_session_id || undefined,
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) {
        setError(`Resend failed: ${data?.error || res.statusText}`);
      } else {
        setResent((r) => ({ ...r, [o.id]: true }));
      }
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setResending(null);
    }
  }

  function onLogout() {
    clearAdminToken();
    window.location.href = "/admin/login";
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="rounded-lg border bg-white p-5 space-y-3 text-center">
          <p className="text-sm">You’re not logged in.</p>
          <Link
            href="/admin/login"
            className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Go to Admin Login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <button
            onClick={() => load(token)}
            disabled={refreshing}
            className="rounded-md border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            onClick={onLogout}
            className="rounded-md border px-3 py-2 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
          {error}
        </div>
      )}

      {!orders ? (
        <div className="text-sm text-gray-600">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-gray-600">No orders found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2">Created</th>
                <th className="p-2">Email</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Status</th>
                <th className="p-2">Preview</th>
                <th className="p-2">Session</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{o.email ?? "—"}</td>
                  <td className="p-2">{o.plan_key ?? "—"}</td>
                  <td className="p-2">{o.status ?? "—"}</td>
                  <td className="p-2">{o.preview_id ?? "—"}</td>
                  <td className="p-2">{o.stripe_session_id ?? "—"}</td>
                  <td className="p-2">
                    <button
                      onClick={() => onResend(o)}
                      disabled={resending === o.id}
                      className={[
                        "rounded-md px-3 py-1 text-white",
                        resent[o.id]
                          ? "bg-green-600"
                          : "bg-blue-600 hover:bg-blue-700",
                        resending === o.id ? "opacity-50" : "",
                      ].join(" ")}
                      title={resent[o.id] ? "Sent" : "Resend PDF"}
                    >
                      {resending === o.id ? "Sending…" : resent[o.id] ? "Sent" : "Resend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
