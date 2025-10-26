"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, useEffect } from "react";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "15");
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png"]);
const SCHEDULER_URL = "https://kenaiinvest.appointlet.com/s/401k-review-call";

type Status = "idle" | "signing" | "uploading" | "verifying" | "done" | "error";

export default function UploadClient() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") || "";

  const fileRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);

  // Optional: prefill email/name from query params if you pass them in
  useEffect(() => {
    const em = params.get("email");
    const nm = params.get("name");
    if (em) setEmail(em);
    if (nm) setName(nm);
  }, [params]);

  const validate = (file: File | undefined) => {
    if (!file) return "Please choose a file.";
    if (!ALLOWED.has(file.type)) return "Only PDF, JPG, or PNG are allowed.";
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) return `File is too large. Max ${MAX_MB} MB.`;
    return null;
  };

  const openScheduler = () => {
    const w = window.open(SCHEDULER_URL, "_blank", "noopener,noreferrer");
    if (!w || w.closed) window.location.href = SCHEDULER_URL; // fallback if popup blocked
  };

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const file = fileRef.current?.files?.[0];
    const v = validate(file);
    if (v) {
      setError(v);
      return;
    }
    if (!file) return;

    try {
      setStatus("signing");
      setInfo("Preparing secure upload…");

      // ---- STEP 1: request a signed PUT URL from your existing route ----
      const signRes = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sessionId,   // required by your route to verify paid session
          email,       // optional
          name,        // optional
          purpose: "statement",
        }),
      });

      if (!signRes.ok) {
        const err = await signRes.json().catch(() => ({}));
        throw new Error(err?.error || "Unable to get upload URL.");
      }

      const { uploadUrl, key } = await signRes.json();

      // ---- STEP 2: PUT the file to S3 using the signed URL ----
      setStatus("uploading");
      setInfo("Uploading file…");

      // Keep headers minimal to match the presigned URL.
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) throw new Error("Upload failed.");

      // ---- STEP 3: verify the object exists (your GET verifier) ----
      setStatus("verifying");
      setInfo("Verifying upload…");

      const verifyRes = await fetch(`/api/upload/s3-url?key=${encodeURIComponent(key)}`, {
        method: "GET",
      });
      const verify = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !verify?.ok) {
        throw new Error(verify?.error || "Verification failed.");
      }

      // ---- SUCCESS (stay on page) ----
      setUploadedFilename(file.name);
      setStatus("done");
      setInfo(null);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setError(err?.message || "Something went wrong.");
      setInfo(null);
    }
  }

  const resetForAnother = () => {
    // Reset file input & UI to allow another upload
    if (fileRef.current) fileRef.current.value = "";
    setUploadedFilename(null);
    setStatus("idle");
    setError(null);
    setInfo(null);
  };

  const disabled = status === "signing" || status === "uploading" || status === "verifying";

  return (
    <form onSubmit={handleUpload} className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Upload your statement</h1>
      <p className="text-sm text-gray-600 mb-6">
        PDF, JPG, or PNG up to {MAX_MB}MB. We’ll review it before your call.
      </p>

      {/* SUCCESS STATE (no redirect) */}
      {status === "done" ? (
        <div className="rounded-xl border p-6 bg-white shadow-sm">
          <div className="mb-2 text-green-700 font-medium">Upload successful</div>
          {uploadedFilename && (
            <div className="mb-4 text-sm text-gray-700">
              <span className="font-medium">File:</span> {uploadedFilename}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={resetForAnother}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2.5 hover:bg-gray-50 transition"
            >
              Upload another file
            </button>

            <button
              type="button"
              onClick={openScheduler}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold hover:bg-blue-700 transition"
            >
              Schedule your $149 Review call
            </button>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Pop-ups blocked?{" "}
            <a
              href={SCHEDULER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              Tap here to open the scheduler
            </a>
            .
          </p>
        </div>
      ) : (
        <>
          {/* FORM FIELDS */}
          <div className="grid gap-4 mb-6">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Your Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border px-3 py-2 bg-white"
                placeholder="Jane Doe"
                disabled={disabled}
                required
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border px-3 py-2 bg-white"
                placeholder="you@example.com"
                type="email"
                disabled={disabled}
                required
              />
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium">Statement file</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/jpeg,image/png"
                className="rounded-md border px-3 py-2 bg-white"
                disabled={disabled}
                required
              />
              <p className="text-xs text-gray-500">
                Allowed: PDF, JPG, PNG. Max {MAX_MB}MB.
              </p>
            </div>
          </div>

          {/* STATUS / ERRORS */}
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {info}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={disabled}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {status === "idle" && "Upload"}
              {status === "signing" && "Preparing…"}
              {status === "uploading" && "Uploading…"}
              {status === "verifying" && "Verifying…"}
            </button>

            <button
              type="button"
              onClick={openScheduler}
              className="rounded-lg border px-5 py-2.5 hover:bg-gray-50 transition"
            >
              Schedule call first
            </button>
          </div>
        </>
      )}
    </form>
  );
}
