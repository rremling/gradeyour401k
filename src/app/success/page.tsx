// src/app/success/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type SessionInfo = {
  id: string;
  email: string | null;
  previewId: string | null;
  planKey: "one_time" | "annual" | null;
  payment_status?: string | null;
  status?: string | null;
};

export default function SuccessPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6">Loading…</main>}>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const sp = useSearchParams();
  const sid = sp.get("session_id");
  const [sess, setSess] = useState<SessionInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function go() {
      setErr(null);
      setMsg(null);
      if (!sid) return;
      const r = await fetch(`/api/stripe/session?id=${encodeURIComponent(sid)}`);
      if (!r.ok) {
        setErr(`Session lookup failed (${r.status})`);
        return;
      }
      const j = await r.json();
      if (!ignore) {
        setSess({
          id: j.id,
          email: j.email,
          previewId: j.previewId,
          planKey: j.planKey,
          payment_status: j.payment_status,
          status: j.status,
        });
      }
    }
    go();
    return () => {
      ignore = true;
    };
  }, [sid]);

  async function resend() {
    try {
      setErr(null);
      setMsg(null);
      setSending(true);
      const email = sess?.email || "";
      const previewId = sess?.previewId || "";
      const res = await fetch("/api/report/generate-and-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, previewId }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Resend failed (${res.status}): ${t}`);
      }
      setMsg("Report re-sent! Check your inbox in a moment.");
    } catch (e: any) {
      setErr(e?.message || "Could not resend");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Thanks! Payment Received.</h1>

      {sess ? (
        <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
          <p>
            We’ll send your PDF report to <strong>{sess.email || "your email"}</strong>.
          </p>
          <p className="text-sm text-gray-600">
            Status: {sess.payment_status || sess.status || "completed"}
          </p>

          <div className="flex gap-3 pt-2">
            <Link
              href="/grade/new"
              className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Edit inputs
            </Link>
            <button
              onClick={resend}
              disabled={sending || !sess.email}
              className={`inline-block rounded-lg px-4 py-2 text-white ${
                sending ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {sending ? "Re-sending…" : "Didn’t get it? Resend report"}
            </button>
          </div>

          {msg && <div className="text-green-700 text-sm">{msg}</div>}
          {err && (
            <div className="text-red-700 text-sm">
              {err}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border p-4 bg-gray-50">
          <p>We’re finalizing your order…</p>
        </div>
      )}

      <div className="text-sm text-gray-600">
        If you purchased before grading, please{" "}
        <Link href="/grade/new" className="text-blue-600 underline">
          complete your inputs
        </Link>{" "}
        and we’ll generate the detailed report (model comparison, penalties, market overlay).
      </div>
    </main>
  );
}
