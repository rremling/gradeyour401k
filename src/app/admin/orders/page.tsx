"use client";
import { useEffect, useState } from "react";

type Order = {
  id: number;
  email: string;
  plan_key: string;
  status: string;
  preview_id: string;
  stripe_session_id: string;
  created_at: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchOrders(authToken: string) {
    setError(null);
    try {
      const res = await fetch("/admin/orders/api", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      console.error("Fetch failed:", err);
      setError(err.message || "Failed to load orders");
    }
  }

  function handleLogin() {
    setToken(input);
    localStorage.setItem("admin_token", input);
  }

  function logout() {
    setToken(null);
    localStorage.removeItem("admin_token");
  }

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) {
      setToken(saved);
      fetchOrders(saved);
    }
  }, []);

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
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admin Orders</h1>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => fetchOrders(token!)}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
          <button
            onClick={logout}
            className="text-sm text-red-600 hover:underline"
          >
            Logout
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}

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
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-4 text-gray-500">
                  No orders found.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-2">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{o.email || "—"}</td>
                  <td className="p-2">{o.plan_key}</td>
                  <td className="p-2">{o.status}</td>
                  <td className="p-2">{o.preview_id || "—"}</td>
                  <td className="p-2 font-mono text-xs">{o.stripe_session_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
