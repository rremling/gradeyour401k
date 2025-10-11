"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  email: string;
  plan_key: string;
  status: string;
  preview_id: string | null;
  stripe_session_id: string;
  created_at: string;
};

export default function OrdersAdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  // Load token from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("admin_token");
    if (saved) setToken(saved);
  }, []);

  async function login() {
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      alert("Enter your admin password");
      return;
    }
    // Just test with a simple fetch
    const res = await fetch("/api/admin/orders", {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (!res.ok) {
      alert("Invalid password");
      return;
    }
    sessionStorage.setItem("admin_token", trimmed);
    setToken(trimmed);
    await fetchOrders(trimmed);
  }

  async function logout() {
    sessionStorage.removeItem("admin_token");
    setToken(null);
    setOrders([]);
  }

  async function fetchOrders(authToken: string) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch orders");
      setOrders(data.orders);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function resend(sessionId: string) {
    if (!confirm("Resend report for this order?")) return;
    setResending(sessionId);
    try {
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      alert(`Emailed to: ${data.emailed || "unknown"}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setResending(null);
    }
  }

  // Auto-fetch once logged in
  useEffect(() => {
    if (token) fetchOrders(token);
  }, [token]);

  // Login screen
  if (!token) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">Admin Login</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="Enter admin password"
          className="border rounded-md p-2 w-full mb-3"
        />
        <button
          onClick={login}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </main>
    );
  }

  // Orders list
  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admin Orders</h1>
        <button onClick={logout} className="text-sm text-red-600 hover:underline">
          Logout
        </button>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-100 text-left">
              <th className="p-2">Email</th>
              <th className="p-2">Plan</th>
              <th className="p-2">Status</th>
              <th className="p-2">Date</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{o.email}</td>
                <td className="p-2">{o.plan_key}</td>
                <td className="p-2">{o.status}</td>
                <td className="p-2">
                  {new Date(o.created_at).toLocaleString()}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => resend(o.stripe_session_id)}
                    disabled={resending === o.stripe_session_id}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {resending === o.stripe_session_id ? "Sending..." : "Resend"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
