// src/app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter your admin token.");
      return;
    }

    // Persist token for the orders page to read and use in Authorization header
    try {
      localStorage.setItem("gy4k_admin_token", trimmed);
    } catch {
      // If storage fails, still try to proceed
    }

    // Go to the dashboard
    router.push("/admin/orders");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-sm text-gray-600 mt-1">
          Enter the admin token to access orders.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Admin token</label>
          <div className="flex gap-2">
            <input
              type={show ? "text" : "password"}
              className="w-full border rounded-md p-2"
              placeholder="Paste your admin token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="border rounded-md px-3 py-2 text-sm hover:bg-gray-50"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            This is compared server-side via the <code>Authorization: Bearer …</code> header.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700"
        >
          Continue to Orders
        </button>
      </form>
    </main>
  );
}
