"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "15");
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);

export default function UploadClient() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id") || "";

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const [status, setStatus] = useState<"idle"|"signing"|"uploading"|"verifying"|"done"|"error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("This page must be opened from the checkout success page so we can verify your purchase.");
    }
  }, [sessionId]);

  function onPickClick() {
    setError(null);
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setInfo(null);
    const f = e.target.files?.[0] || null;
    setFile(f || null);
    setFileName(f?.name || "");
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!sessionId) return setError("Missing session ID. Please complete checkout again.");
    if (!name.trim() || !email.trim()) return setError("Please enter your name and email.");
    if (!file) return setError("Please choose a file.");
    if (!ALLOWED.has(file.type)) return setError("Only PDF, JPG, or PNG files are allowed.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File is too large. Max ${MAX_MB} MB.`);

    try {
      setStatus("signing");
      const res = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sessionId,
          email,
          name,
          purpose: "upload",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.uploadUrl || !data?.key) {
        throw new Error(data?.error || "Failed to get upload URL");
      }
      if (typeof data.remaining === "number") {
        setInfo(`Uploads remaining: ${data.remaining}`);
      }

      setStatus("uploading");
      // Try PUT with Content-Type first (common S3 requirement for signed URLs)
      let put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      // If the signature was created *without* Content-Type condition, retry without header
      if (!put.ok && put.status === 403) {
        put = await fetch(data.uploadUrl, { method: "PUT", body: file });
      }
      if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);

      setStatus("verifying");
      const verify = await fetch(`/api/upload/s3-url?key=${encodeURIComponent(data.key)}`);
      const v = await verify.json();
      if (!verify.ok || !v?.ok) throw new Error(v?.error || "Upload verification failed");

      setStatus("done");
      router.push("/schedule");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Upload failed");
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4 bg-white p-5 rounded-2xl shadow">
      <div className="grid gap-2">
        <label className="text-sm font-medium">Full Name</label>
        <input
          className="border rounded px-3 py-2"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="name"
          required
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Email</label>
        <input
          className="border rounded px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          autoComplete="email"
          required
        />
        <p className="text-xs text-gray-500">We’ll use this to match your payment and send confirmation.</p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium">Statement (PDF, JPG, or PNG)</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPickClick}
            className="cursor-pointer inline-block bg-[#0b59c7] text-white font-medium px-4 py-2 rounded-xl hover:bg-[#0a4fb5] transition shadow-md"
          >
            Choose File
          </button>
          <span className="text-sm text-gray-700 truncate max-w-[60%]">
            {fileName ? `Selected: ${fileName}` : "No file selected"}
          </span>
        </div>

        {/* Keep it visually hidden, not display:none, so mobile Safari stays happy */}
        <input
          ref={inputRef}
          type="file"
          onChange={onFileChange}
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          tabIndex={-1}
        />

        <p className="text-xs text-gray-500">Allowed: PDF, JPG, PNG • Max size: {MAX_MB} MB</p>
      </div>

      <button
        type="submit"
        disabled={!sessionId || status === "signing" || status === "uploading" || status === "verifying"}
        className="w-full bg-[#0b59c7] text-white rounded-xl py-2.5 font-medium hover:bg-[#0a4fb5] transition disabled:opacity-50 shadow-md"
      >
        {status === "idle" && "Send Securely"}
        {status === "signing" && "Preparing secure link…"}
        {status === "uploading" && "Sending…"}
        {status === "verifying" && "Verifying…"}
        {status === "done" && "Done!"}
        {status === "error" && "Try Again"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && !error && <p className="text-sm text-gray-700">{info}</p>}

      {!sessionId && (
        <p className="text-xs text-red-600">
          Missing session ID. Please start from the <a className="underline" href="/review">review checkout</a>.
        </p>
      )}

      <p className="text-xs text-gray-500">
        Files are uploaded over HTTPS and stored privately with encryption at rest.
      </p>
    </form>
  );
}
