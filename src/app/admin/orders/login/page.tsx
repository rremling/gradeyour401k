"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const returnTo = sp.get("returnTo") || "/admin/orders";

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Invalid token");
      }
      router.replace(returnTo);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-sm text-gray-600">Enter your admin token to continue.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border bg-white p-4 space-y-3">
        <input
          type="password"
          className="w-full border rounded-md p-2"
          placeholder="Admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </main>
  );
}
