"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || "15");
const ALLOWED = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

export default function UploadClient() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("session_id") || undefined;

  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<"idle" | "signing" | "uploading" | "verifying" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Please choose a file to upload.");
    if (!Object.keys(ALLOWED).includes(file.type)) return setError("Only PDF, JPG, or PNG files are allowed.");
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
          email: email || undefined,
          name: name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get upload URL");
      const { uploadUrl, key } = data as { uploadUrl: string; key: string };

      setStatus("uploading");
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
      const verify = await fetch(`/api/upload/s3-url?key=${encodeURIComponent(key)}`);
      const v = await verify.json();
      if (!verify.ok || !v.ok) throw new Error(v?.error || "Upload verification failed");

      setStatus("done");
      router.push("/schedule");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Upload failed");
    }
  }

  return (
    <form onSubmit={handleUpload} className="space-y-4 bg-white p-5 rounded-2xl shadow">
      <div className="grid gap-3">
        <label className="text-sm font-medium">Name</label>
        <input className="border rounded px-3 py-2" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">Email</label>
        <input className="border rounded px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <p className="text-xs text-gray-500">We’ll use this to match your payment and send confirmation.</p>
      </div>

      <div className="grid gap-3">
        <label className="text-sm font-medium">Statement (PDF, JPG, or PNG)</label>
        <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="block" required />
        <p className="text-xs text-gray-500">Max size: {MAX_MB} MB</p>
      </div>

      <button
        disabled={status === "signing" || status === "uploading" || status === "verifying"}
        className="w-full bg-black text-white rounded-xl py-2.5 font-medium hover:opacity-90 disabled:opacity-50"
      >
        {status === "idle" && "Upload Securely"}
        {status === "signing" && "Preparing secure link…"}
        {status === "uploading" && `Uploading… ${progress}%`}
        {status === "verifying" && "Verifying…"}
        {status === "done" && "Done!"}
        {status === "error" && "Try Again"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Files are uploaded over HTTPS and stored privately with encryption at rest.</p>
    </form>
  );
}
