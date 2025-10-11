// src/app/admin/orders/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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
  // --- Auth token ---
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);

  // --- Data ---
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // --- UI state ---
  const [compact, setCompact] = useState(true);
  const [colEmail, setColEmail] = useState(true);
  const [colPreview, setColPreview] = useState(true);
  const [colSession, setColSession] = useState(false);
  const [colNextDue, setColNextDue] = useState(false);

  // Track which orders were re-sent successfully
  const [resent, setResent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = localStorage.getItem("gy4k_admin_token") || "";
    if (t) {
      setToken(t);
      setHasToken(true);
    }
  }, []);

  function saveToken(v: string) {
    setToken(v);
    localStorage.setItem("gy4k_admin_token", v);
  }

  async function loadOrders() {
    setLoading(true);
    setErr(null);
    setOrders(null);
    try {
      const res = await fetch("/api/admin/orders", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setOrders(data.orders || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function resend(previewId: string | null, orderId: string) {
    setErr(null);
    if (!previewId) {
      setErr("Missing preview_id for this order.");
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
      setResent((m) => ({ ...m, [orderId]: true }));
    } catch (e: any) {
      setErr(e?.message || "Resend failed");
    }
  }

  const tableRowClass = useMemo(
    () => (compact ? "text-xs py-2" : "text-sm py-3"),
    [compact]
  );

  // --- If no token set yet, show a centered login card ---
  if (!hasToken && !token) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Admin · Sign In</h1>
          <p className="mt-2 text-sm text-gray-600">
            Paste your admin token to continue.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              className="border rounded-md p-2 flex-1"
              type="password"
              placeholder="ADMIN_TOKEN"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
            />
            <button
              onClick={() => setHasToken(true)}
              className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              disabled={!token.trim()}
            >
              Continue
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            This token is stored locally in your browser only.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header card with controls */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Admin · Orders</h1>
            <p className="text-sm text-gray-600">
              View orders and re-send individual reports.
            </p>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium">Admin Token</label>
            <div className="mt-1 flex gap-2">
              <input
                className="border rounded-md p-2 flex-1"
                type="password"
                placeholder="ADMIN_TOKEN"
                value={token}
                onChange={(e) => saveToken(e.target.value)}
              />
              <button
                onClick={loadOrders}
                className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
                disabled={loading || !token.trim()}
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Display any top-level error */}
        {err && (
          <p className="mt-3 text-sm text-red-600">
            Error loading orders: {err}
          </p>
        )}

        {/* Display quick view controls */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={compact}
              onChange={(e) => setCompact(e.target.checked)}
            />
            Compact rows
          </label>

          <div className="relative inline-block">
            <details className="group">
              <summary className="list-none cursor-pointer rounded border px-2 py-1 hover:bg-gray-50">
                Columns
              </summary>
              <div className="absolute z-10 mt-2 w-48 rounded border bg-white p-3 shadow">
                <label className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={colEmail}
                    onChange={(e) => setColEmail(e.target.checked)}
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={colPreview}
                    onChange={(e) => setColPreview(e.target.checked)}
                  />
                  Preview ID
                </label>
                <label className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={colSession}
                    onChange={(e) => setColSession(e.target.checked)}
                  />
                  Session ID
                </label>
                <label className="flex items-center gap-2 text-sm py-1">
                  <input
                    type="checkbox"
                    checked={colNextDue}
                    onChange={(e) => setColNextDue(e.target.checked)}
                  />
                  Next Due
                </label>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {orders === null ? (
          <p className="text-sm text-gray-600">No data yet. Click “Refresh”.</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-600">No orders found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full">
              <thead className="text-xs uppercase text-gray-600">
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Created</th>
                  {colEmail && <th className="text-left py-2 pr-4">Email</th>}
                  <th className="text-left py-2 pr-4">Plan</th>
                  <th className="text-left py-2 pr-4">Status</th>
                  {colPreview && <th className="text-left py-2 pr-4">Preview ID</th>}
                  {colSession && <th className="text-left py-2 pr-4">Session</th>}
                  {colNextDue && <th className="text-left py-2 pr-4">Next Due</th>}
                  <th className="text-left py-2 pr-0">Actions</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {orders.map((o) => (
                  <tr key={o.id} className="border-b">
                    <td className={`${tableRowClass} pr-4`}>
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                    {colEmail && (
                      <td className={`${tableRowClass} pr-4 break-words max-w-[14rem]`}>
                        {o.email || "—"}
                      </td>
                    )}
                    <td className={`${tableRowClass} pr-4`}>{o.plan_key || "—"}</td>
                    <td className={`${tableRowClass} pr-4`}>{o.status || "—"}</td>
                    {colPreview && (
                      <td className={`${tableRowClass} pr-4 break-all max-w-[16rem]`}>
                        {o.preview_id || "—"}
                      </td>
                    )}
                    {colSession && (
                      <td className={`${tableRowClass} pr-4 break-all max-w-[16rem]`}>
                        {o.stripe_session_id || "—"}
                      </td>
                    )}
                    {colNextDue && (
                      <td className={`${tableRowClass} pr-4`}>
                        {o.next_due_1 ? new Date(o.next_due_1).toLocaleDateString() : "—"}
                      </td>
                    )}
                    <td className={`${tableRowClass}`}>
                      <button
                        className={[
                          "rounded px-3 py-1 border",
                          resent[o.id]
                            ? "bg-green-600 text-white border-green-600"
                            : "hover:bg-gray-50",
                        ].join(" ")}
                        onClick={() => resend(o.preview_id, o.id)}
                        disabled={resent[o.id]}
                        title={resent[o.id] ? "Re-sent" : "Re-send report"}
                      >
                        {resent[o.id] ? "Sent ✓" : "Re-send"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Small helper on mobile */}
            <p className="mt-2 text-[11px] text-gray-500">
              Tip: On mobile, scroll horizontally. Use “Columns” to hide fields.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
