"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");

  async function handleUpload() {
    if (!file) {
      setErr("Please choose a file first.");
      return;
    }
    setErr("");
    setMessage("");
    setUploading(true);

    try {
      const res = await fetch("/api/upload/s3-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, type: file.type }),
      });
      const { url, fields } = await res.json();

      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      formData.append("file", file);

      const upload = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!upload.ok) throw new Error("Upload failed");

      setMessage("✅ File sent securely. You may now schedule your review.");
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold mb-4">Secure Document Upload</h1>
      <p className="text-sm text-gray-600 mb-8">
        Please upload your 401(k) statement securely below. Once received, we’ll review it during your call.
      </p>

      {/* Choose File Button */}
      <div className="mb-6">
        <label
          htmlFor="file-upload"
          className="cursor-pointer inline-block bg-[#0b59c7] text-white font-medium px-5 py-3 rounded-xl hover:bg-[#0a4fb5] transition shadow-md"
        >
          {file ? `Selected: ${file.name}` : "Choose File"}
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      {/* Send Securely Button */}
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="w-full bg-[#0b59c7] text-white rounded-xl py-3 font-medium hover:bg-[#0a4fb5] transition disabled:opacity-50 shadow-md"
      >
        {uploading ? "Sending..." : "Send Securely"}
      </button>

      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
      {message && (
        <p className="mt-4 text-sm text-green-600">{message}</p>
      )}

      <div className="mt-10 text-sm text-gray-500">
        <p>Your file is encrypted and sent directly to our secure AWS servers.</p>
        <p>No copies are stored in your browser or on this device.</p>
      </div>
    </main>
  );
}
