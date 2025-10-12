// src/app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const returnTo = sp.get("returnTo") || "/admin/orders";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Unauthorized");
      }
      router.replace(returnTo);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold text-center mb-4">Admin Login</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4 bg-white">
        <div className="space-y-1">
          <label className="text-sm font-medium">Admin token</label>
          <input
            type="password"
            className="w-full border rounded-md p-2"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter ADMIN_TOKEN"
            autoFocus
          />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button
          type="submit"
          disabled={busy || !token}
          className="w-full rounded-md bg-blue-600 text-white py-2 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Login"}
        </button>
      </form>
    </main>
  );
}
