"use client";

import { useState } from "react";

export default function UploadClient() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return alert("Please choose a file first.");

    try {
      setStatus("Requesting upload link…");

      // 1️⃣ Ask backend for presigned URL
      const res = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sessionId,
          email,
          name,
          purpose: "review",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get upload URL");

      const { uploadUrl } = data;

      // 2️⃣ Upload directly to S3 — PUT with NO HEADERS
      setStatus("Uploading securely…");

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file, // ⚠️ no headers at all
      });

      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      setStatus("✅ Upload complete!");
    } catch (err: any) {
      console.error("upload error", err);
      setStatus(`❌ ${err.message}`);
    }
  }

  return (
    <form
      onSubmit={handleUpload}
      className="bg-white shadow p-6 rounded-xl flex flex-col gap-4"
    >
      <label className="text-sm font-medium">
        Your Name
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full mt-1 border rounded px-2 py-1"
        />
      </label>

      <label className="text-sm font-medium">
        Your Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block w-full mt-1 border rounded px-2 py-1"
        />
      </label>

      <label className="text-sm font-medium">
        Choose File (PDF, JPG, PNG)
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full mt-1 border rounded px-2 py-1"
        />
      </label>

      <button
        type="submit"
        className="bg-blue-600 text-white font-semibold py-2 rounded-md hover:bg-blue-700 transition"
      >
        Send Securely
      </button>

      {status && <p className="text-sm text-gray-700">{status}</p>}
    </form>
  );
}
