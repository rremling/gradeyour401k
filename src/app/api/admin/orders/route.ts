// src/app/api/admin/orders/route.ts
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get("returnTo") || "/admin/orders";

  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Unauthorized");
      }
      router.push(returnTo);
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold text-center mb-4">Admin Login</h1>

      <form onSubmit={onLogin} className="space-y-4 rounded-lg border p-4 bg-white">
        <label className="block text-sm font-medium">Admin token</label>
        <input
          className="w-full border rounded-md p-2"
          placeholder="Enter admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <button
          type="submit"
          disabled={busy || !token}
          className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Logging in…" : "Login"}
        </button>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </main>
  );
}
