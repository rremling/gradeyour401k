"use client";

import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file || !email || !name) {
      setError("Please enter your name, email, and select a file.");
      return;
    }

    setError("");
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

      setMessage("✅ File sent securely. Thank you!");
      setFile(null);
      setName("");
      setEmail("");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold mb-2">Secure 401(k) Statement Upload</h1>
      <p className="text-sm text-gray-600 mb-8">
        Please enter your name and email, then securely send your 401(k) statement below.
      </p>

      <div className="flex flex-col gap-4 text-left">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0b59c7]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0b59c7]"
          />
        </div>

        {/* Choose File button */}
        <div className="flex flex-col items-center justify-center mt-2">
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

        {/* Send Securely button */}
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="mt-4 w-full bg-[#0b59c7] text-white rounded-xl py-3 font-medium hover:bg-[#0a4fb5] transition disabled:opacity-50 shadow-md"
        >
          {uploading ? "Sending..." : "Send Securely"}
        </button>

        {error && <p className="text-sm text-red-600 text-center mt-2">{error}</p>}
        {message && <p className="text-sm text-green-600 text-center mt-2">{message}</p>}
      </div>

      <div className="mt-8 text-xs text-gray-500 text-center">
        <p>Your file is encrypted and sent directly to our secure AWS servers.</p>
        <p>No copies are stored in your browser or on this device.</p>
      </div>
    </main>
  );
}
