// src/app/success/SuccessClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id") || "";

  const [status, setStatus] = useState<
    "idle" | "finalizing" | "done" | "error"
  >("idle");
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    async function go() {
      if (!sessionId) {
        setStatus("error");
        setMsg("Missing session_id in URL.");
        return;
      }
      setStatus("finalizing");
      try {
        const res = await fetch("/api/order/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to finalize order.");
        }
        setStatus("done");
        setMsg("Your report has been emailed. Check your inbox!");
      } catch (e: any) {
        setStatus("error");
        setMsg(e?.message || "Something went wrong finalizing the order.");
      }
    }
    go();
  }, [sessionId]);

  return (
    <div className="rounded-lg border p-6 bg-white space-y-2">
      {status === "finalizing" && (
        <p className="text-sm text-gray-700">Finalizing your order…</p>
      )}
      {status === "done" && (
        <p className="text-sm text-green-700">{msg}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-700">{msg}</p>
      )}
      <p className="text-xs text-gray-500">
        Session: <span className="font-mono">{sessionId || "—"}</span>
      </p>
    </div>
  );
}
