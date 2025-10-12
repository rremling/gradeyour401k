// src/app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { writeAdminToken } from "@/lib/admin";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!token.trim()) {
      setErr("Enter your admin token.");
      return;
    }

    // Just store the token locally; server will validate on fetch
    writeAdminToken(token.trim());
    setBusy(true);
    try {
      // quick ping to verify before navigating
      const res = await fetch("/api/admin/orders", {
        headers: { Authorization: `Bearer ${token.trim()}` },
        cache: "no-store",
      });
      if (!res.ok) {
        setErr("Unauthorized. Check your token.");
        setBusy(false);
        return;
      }
      router.push("/admin/orders");
    } catch (e: any) {
      setErr("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-sm text-gray-600">Enter your admin token to continue.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-white p-5">
        <div className="space-y-1">
          <label className="text-sm font-medium">Admin token</label>
          <input
            type="password"
            className="w-full border rounded-md p-2"
            placeholder="••••••••••"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Login"}
        </button>
      </form>
    </main>
  );
}
