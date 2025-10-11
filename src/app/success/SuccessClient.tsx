// src/app/success/SuccessClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function SuccessClient() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id") || "";

  const [status, setStatus] = useState<
    "idle" | "looking-up" | "generating" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function run() {
      if (!sessionId) {
        setStatus("error");
        setMessage("Missing session_id in URL.");
        return;
      }
      setStatus("looking-up");
      try {
        // 1) fetch email + previewId from DB
        const look = await fetch(`/api/order/by-session?session_id=${encodeURIComponent(sessionId)}`);
        const lookData = await look.json();
        if (!look.ok || !lookData?.ok) {
          throw new Error(lookData?.error || "Could not find order details.");
        }

        const email = String(lookData.email || "");
        const previewId = String(lookData.previewId || "");
        if (!email || !previewId) {
          throw new Error("Order has no email or preview id.");
        }

        // 2) trigger PDF + email
        setStatus("generating");
        const res = await fetch("/api/report/generate-and-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, previewId }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || "Failed to generate/send report.");
        }

        setStatus("done");
        setMessage("Your report has been emailed. Check your inbox!");
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Something went wrong.");
      }
    }
    run();
  }, [sessionId]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Payment confirmed</h1>
      {status === "looking-up" && (
        <div className="rounded border p-4 bg-white text-sm text-gray-700">
          Looking up your order…
        </div>
      )}
      {status === "generating" && (
        <div className="rounded border p-4 bg-white text-sm text-gray-700">
          Generating your PDF and sending email…
        </div>
      )}
      {status === "done" && (
        <div className="rounded border p-4 bg-green-50 text-green-700 text-sm">
          {message}
        </div>
      )}
      {status === "error" && (
        <div className="rounded border p-4 bg-red-50 text-red-700 text-sm">
          {message}
        </div>
      )}

      <div className="text-sm text-gray-600">
        Session: <span className="font-mono">{sessionId || "—"}</span>
      </div>
    </main>
  );
}
