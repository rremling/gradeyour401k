// src/app/admin/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Optional: if already logged in, go straight to orders
  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem("gy4k_admin_token") : null;
    if (existing) router.replace("/admin/orders");
  }, [router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const t = token.trim();
    if (!t) {
      setError("Enter your admin token.");
      return;
    }

    try {
      localStorage.setItem("gy4k_admin_token", t);
      router.push("/admin/orders");
    } catch (err) {
      setError("Could not save token. Check your browser settings and try again.");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-sm text-gray-600 mt-1">Enter your admin token to view orders.</p>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border bg-white p-5 space-y-4">
        <label className="block text-sm font-medium">
          Admin token
          <input
            className="mt-1 w-full border rounded-md p-2"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your token"
            autoFocus
          />
        </label>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </main>
  );
}
