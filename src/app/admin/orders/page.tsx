"use client";
import { useEffect, useState } from "react";

type Order = {
  id: number;
  email: string | null;
  plan_key: string | null;
  status: string | null;
  preview_id: string | null;
  stripe_session_id: string;
  created_at: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<number, string>>({});
  const [lastStatus, setLastStatus] = useState<number | null>(null);

  async function fetchOrders(authToken: string) {
    setError(null);
    setLastStatus(null);
    try {
      // Send token both ways (header + query param) to simplify proxy/debugging
      const res = await fetch(`/admin/orders/api?token=${encodeURIComponent(authToken)}`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      setLastStatus(res.status);

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setOrders(data.orders || []);
    } catch (err: any) {
      console.error("Fetch failed:", err);
      setOrders([]);
      setError(err.message || "Failed to load orders");
    }
  }

  function handleLogin() {
    setToken(input);
    localStorage.setItem("admin_token", input);
    fetchOrders(input);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem("admin_token");
    setOrders([]);
  }

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) {
      setToken(saved);
      fetchOrders(saved);
    }
  }, []);

  async function resendFor(order: Order) {
    if (!token) return;
    setRowMsg((m) => ({ ...m, [order.id]: "" }));
    setSendingId(order.id);

    try {
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // optional
        },
        body: JSON.stringify({
          previewId: order.preview_id || undefined,
          sessionId: order.stripe_session_id,
          email: order.email || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Resend failed (HTTP ${res.status})`);
      }
      setRowMsg((m) => ({ ...m, [order.id]: "Resent! Check the inbox." }));
    } catch (e: any) {
      console.error("Resend error:", e);
      setRowMsg((m) => ({ ...m, [order.id]: e?.message || "Resend failed" }));
    } finally {
      setSendingId(null);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <input
          type="password"
          className="w-full border rounded-md p-2"
          placeholder="Enter admin password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="rounded-md bg-blue-600 text-white px-4 py-2 w-full"
          onClick={handleLogin}
        >
          Login
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Admin Orders</h1>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => fetchOrders(token)}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
          <a
            href={`/admin/orders/api?token=${encodeURIComponent(token)}`}
            target="_blank"
            className="text-sm text-gray-600 hover:underline"
          >
            Test API (raw)
          </a>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
          <div className="font-semibold mb-1">Error loading orders</div>
          <div>{error}</div>
          {lastStatus && <div className="mt-1">HTTP status: {lastStatus}</div>}
          <div className="mt-2 text-xs text-gray-600">
            Tip: ensure <code>ADMIN_PASSWORD</code> is set in Vercel (Production)
            and matches the password you entered. Also confirm <code>DATABASE_URL</code> points
            to the Neon DB that actually has your orders.
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Plan</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Preview ID</th>
              <th className="p-2 text-left">Stripe Session</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!error && orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-4 text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-t align-top">
                  <td className="p-2">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{o.email || "—"}</td>
                  <td className="p-2">{o.plan_key || "—"}</td>
                  <td className="p-2">{o.status || "—"}</td>
                  <td className="p-2">{o.preview_id || "—"}</td>
                  <td className="p-2 font-mono text-xs break-all">
                    {o.stripe_session_id}
                  </td>
                  <td className="p-2">
                    <button
                      disabled={sendingId === o.id}
                      onClick={() => resendFor(o)}
                      className="rounded-md border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {sendingId === o.id ? "Sending…" : "Resend"}
                    </button>
                    {rowMsg[o.id] && (
                      <div className="text-xs mt-1">
                        {rowMsg[o.id].includes("Resent")
                          ? <span className="text-green-700">{rowMsg[o.id]}</span>
                          : <span className="text-red-700">{rowMsg[o.id]}</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
