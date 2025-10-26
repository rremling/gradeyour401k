"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function UploadClient() {
  const params = useSearchParams();
  const router = useRouter();

  // 👇 read session_id from the URL placed by Stripe success_url
  const sessionId = params.get("session_id") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle"|"signing"|"uploading"|"verifying"|"done"|"error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Optional: surface a friendly message if sessionId missing
  useEffect(() => {
    if (!sessionId) {
      setError("This page must be opened from the checkout success page so we can verify your session.");
    }
  }, [sessionId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];

    if (!sessionId) {
      setError("Missing session ID. Please complete checkout again.");
      return;
    }
    if (!name.trim() || !email.trim() || !file) {
      setError("Please enter your name, email, and choose a file.");
      return;
    }

    try {
      setStatus("signing");
      // 1) ask backend for presigned PUT url (must include sessionId)
      const res = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sessionId,           // 👈 REQUIRED
          email,
          name,
          purpose: "upload",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.uploadUrl) {
        throw new Error(data?.error || "Failed to get upload URL");
      }

      // 2) PUT directly to S3 — no headers
      setStatus("uploading");
      const put = await fetch(data.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);

      // 3) optional verify
      setStatus("verifying");
      const verify = await fetch(`/api/upload/s3-url?key=${encodeURIComponent(data.key)}`);
      const v = await verify.json();
      if (!verify.ok || !v?.ok) throw new Error(v?.error || "Upload verification failed");

      setStatus("done");
      // go to your scheduling or confirmation page
      router.push("/schedule");
    } catch (e: any) {
      setStatus("error");
      setError(e.message || "Upload failed");
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4 bg-white p-5 rounded-2xl shadow">
      {!sessionId && (
        <div className="text-sm text-red-600">
          Missing session ID. Please start from the <a className="underline" href="/review">review checkout</a> so we can verify your purchase.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Full Name</label>
        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          className="w-full border rounded px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Statement (PDF, JPG, or PNG)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="w-full border rounded px-3 py-2"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Allowed: PDF, JPG, PNG • Max size as configured.</p>
      </div>

      <button
        type="submit"
        disabled={!sessionId || status === "signing" || status === "uploading" || status === "verifying"}
        className="w-full bg-[#0b59c7] text-white rounded-xl py-3 font-medium hover:bg-[#0a4fb5] transition disabled:opacity-50 shadow-md"
      >
        {status === "idle" && "Send Securely"}
        {status === "signing" && "Preparing secure link…"}
        {status === "uploading" && "Sending…"}
        {status === "verifying" && "Verifying…"}
        {status === "done" && "Done!"}
        {status === "error" && "Try Again"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
