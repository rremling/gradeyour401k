// src/app/success/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

export default function SuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id || "";
  const [status, setStatus] = useState<"idle"|"sending"|"ok"|"err">("idle");
  const [msg, setMsg] = useState<string>("");

  async function resend() {
    try {
      setStatus("sending");
      setMsg("");
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }), // 👈 send session id
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("err");
        setMsg(data?.error || "Failed to resend");
      } else {
        setStatus("ok");
        setMsg("Report re-sent! Check your inbox.");
      }
    } catch (e: any) {
      setStatus("err");
      setMsg(e?.message || "Failed to resend");
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Payment confirmed</h1>
      <p>Thanks for your purchase! Your PDF report will be emailed to you.</p>

      <div className="flex gap-3">
        <button
          onClick={resend}
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
          disabled={status === "sending"}
        >
          {status === "sending" ? "Sending…" : "Resend report"}
        </button>
        <Link
          href="/grade/new"
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Edit inputs (improve report)
        </Link>
      </div>

      {msg && (
        <p
          className={`text-sm ${
            status === "ok" ? "text-green-700" : "text-red-700"
          }`}
        >
          {msg}
        </p>
      )}
    </main>
  );
}
