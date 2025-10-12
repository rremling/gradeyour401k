// src/app/admin/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  // (Optional) Prefill from ?token= without useSearchParams (avoids Suspense requirement)
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const t = url.searchParams.get("token");
        if (t) setToken(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Enter the Admin Token.");
      return;
    }
    try {
      localStorage.setItem("gy4k_admin_token", trimmed);
      router.replace("/admin/orders");
    } catch (err: any) {
      setError(err?.message || "Failed to store token");
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-sm text-gray-600">Enter your Admin Token to continue.</p>
      </div>

      <form onSubmit={handleLogin} className="rounded-lg border p-4 bg-white space-y-3">
        <label className="block text-sm font-medium">Admin Token</label>
        <input
          className="w-full border rounded-md p-2"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your ADMIN_TOKEN"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700"
        >
          Login
        </button>
      </form>
    </main>
  );
}
