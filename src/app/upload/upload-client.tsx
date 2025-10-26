"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "15");
const ALLOWED = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

type Status = "idle" | "signing" | "uploading" | "verifying" | "done" | "error";

export default function UploadClient() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id") || undefined;

  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // NEW: track how many uploads are remaining for this session (as reported by the server)
  const [remaining, setRemaining] = useState<number | null>(null);

  // NEW: purpose of this upload (default "upload"; switch to "additional" for resends/extra docs)
  const [purpose, setPurpose] = useState<"upload" | "additional">("upload");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!name.trim() || !email.trim() || !file) {
      return setError("Please enter your name, email, and choose a file.");
    }
    if (!Object.keys(ALLOWED).includes(file.type)) {
      return setError("Only PDF, JPG, or PNG files are allowed.");
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return setError(`File is too large. Max ${MAX_MB} MB.`);
    }
    if (!sessionId) {
      return setError("This upload link is missing a session_id. Please complete checkout first.");
    }

    try {
      setStatus("signing");
      // Ask our API to create a short-lived pre-signed PUT URL
      const res = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sessionId,
          email: email || undefined,
          name: name || undefined,
          purpose, // <-- NEW
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.uploadUrl || !data?.key) {
        throw new Error(data?.error || "Failed to get upload URL");
      }
      const { uploadUrl, key, remaining: serverRemaining } = data as {
        uploadUrl: string;
        key: string;
        remaining?: number;
      };

      // Server returns remaining after counting this presign
      if (typeof serverRemaining === "number") setRemaining(serverRemaining);

      setStatus("uploading");
      // PUT the file directly to S3 with the same Content-Type we signed for
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      setStatus("verifying");
      // Optional verification via our API
      const verify = await fetch(`/api/upload/s3-url?key=${encodeURIComponent(key)}`);
      const v = await verify.json();
      if (!verify.ok || !v.ok) throw new Error(v?.error || "Upload verification failed");

      setStatus("done");
      // On success, send them to scheduling
      router.push("/schedule");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Upload failed");
    }
  }

  const chosenFileName = fileRef.current?.files?.[0]?.name;

  // Helper to quickly start an "additional" upload intent (resend/extra doc)
  function prepareAdditionalUpload() {
    setPurpose("additional");
    setError(null);
    setStatus("idle");
    // Keep name/email; let them choose another file
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4 bg-white p-5 rounded-2xl shadow">
      {/* Name */}
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

      {/* Email */}
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

      {/* Choose File (styled as button) */}
      <div className="grid gap-2">
        <label className="text-sm font-medium">Statement (PDF, JPG, or PNG)</label>

        <div className="flex items-center gap-3">
          <label
            htmlFor="file-upload"
            className="cursor-pointer inline-block bg-[#0b59c7] text-white font-medium px-4 py-2 rounded-xl hover:bg-[#0a4fb5] transition shadow-md"
          >
            Choose File
          </label>
          <span className="text-sm text-gray-700 truncate max-w-[60%]">
            {chosenFileName ? `Selected: ${chosenFileName}` : "No file selected"}
          </span>
        </div>

        <input
          id="file-upload"
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="hidden"
          required
        />
        <p className="text-xs text-gray-500">
          Allowed: PDF, JPG, PNG • Max size: {MAX_MB} MB
        </p>
      </div>

      {/* Primary action */}
      <button
        type="submit"
        disabled={status === "signing" || status === "uploading" || status === "verifying"}
        className="w-full bg-[#0b59c7] text-white rounded-xl py-2.5 font-medium hover:bg-[#0a4fb5] transition disabled:opacity-50 shadow-md"
      >
        {status === "idle" && (purpose === "additional" ? "Send Another Document Securely" : "Send Securely")}
        {status === "signing" && "Preparing secure link…"}
        {status === "uploading" && `Sending… ${progress}%`}
        {status === "verifying" && "Verifying…"}
        {status === "done" && "Done!"}
        {status === "error" && "Try Again"}
      </button>

      {/* Secondary action: prepare another upload (doesn't submit) */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Files are uploaded over HTTPS and stored privately with encryption at rest.
        </div>
        {typeof remaining === "number" && (
          <div className="text-xs font-medium text-gray-700">
            Uploads remaining: {remaining}
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={prepareAdditionalUpload}
          className="text-sm font-medium text-[#0b59c7] hover:underline"
        >
          Send another document
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
