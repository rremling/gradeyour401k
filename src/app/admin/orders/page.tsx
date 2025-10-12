// src/app/admin/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type OrderRow = {
  id: string | number;
  email: string | null;
  plan_key: string | null;
  status: string | null;
  preview_id: string | null;
  stripe_session_id: string | null;
  created_at: string;
  next_due_1: string | null;
};

export default function AdminOrdersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resending, setResending] = useState<Record<string, boolean>>({});
  const [resent, setResent] = useState<Record<string, boolean>>({});

  // Load token from localStorage
  useEffect(() => {
    try {
      const t = localStorage.getItem("gy4k_admin_token");
      setToken(t);
    } catch {
      setToken(null);
    }
  }, []);

  const hasToken = useMemo(() => !!token && token.trim().length > 0, [token]);

  async function loadOrders() {
    if (!hasToken) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error loading orders ${res.status}: ${text || res.statusText}`);
      }
      const data = await res.json();
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  function logout() {
    try {
      localStorage.removeItem("gy4k_admin_token");
    } catch {}
    setToken(null);
    setOrders([]);
    router.replace("/admin/login");
  }

  async function resend(orderId: string | number) {
    if (!hasToken) return;
    setResending((m) => ({ ...m, [String(orderId)]: true }));
    try {
      const res = await fetch("/api/admin/orders/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Resend failed (${res.status})`);
      }
      setResent((m) => ({ ...m, [String(orderId)]: true }));
    } catch (e: any) {
      alert(e?.message || "Resend failed");
    } finally {
      setResending((m) => ({ ...m, [String(orderId)]: false }));
    }
  }

  if (!hasToken) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-gray-600">You must log in to view orders.</p>
        </div>
        <div className="text-center">
          <button
            className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
            onClick={() => router.replace("/admin/login")}
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Orders</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={loadOrders}
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
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-md border p-4 bg-white text-sm text-gray-600">
          No orders found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Preview ID</th>
                <th className="py-2 pr-3">Session</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const idStr = String(o.id);
                const isResending = !!resending[idStr];
                const isResent = !!resent[idStr];
                return (
                  <tr key={idStr} className="border-b">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{o.email ?? "—"}</td>
                    <td className="py-2 pr-3">{o.plan_key ?? "—"}</td>
                    <td className="py-2 pr-3">{o.status ?? "—"}</td>
                    <td className="py-2 pr-3">{o.preview_id ?? "—"}</td>
                    <td className="py-2 pr-3">{o.stripe_session_id ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <button
                        className={[
                          "rounded-md px-3 py-1.5 text-white",
                          isResent
                            ? "bg-green-600"
                            : isResending
                            ? "bg-gray-400"
                            : "bg-blue-600 hover:bg-blue-700",
                        ].join(" ")}
                        disabled={isResending}
                        onClick={() => resend(o.id)}
                        title={isResent ? "Resent" : "Resend report email"}
                      >
                        {isResending ? "Sending…" : isResent ? "Resent" : "Resend"}
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
