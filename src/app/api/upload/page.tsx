import { Suspense } from "react";
import UploadClient from "./upload-client";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">Securely Upload Your 401(k) Statement</h1>
      <p className="text-sm text-gray-600 mb-6">
        Your payment was received. Please upload a PDF (or clear photo) of your 401(k) statement.
      </p>
      <Suspense fallback={<div>Loading…</div>}>
        <UploadClient />
      </Suspense>
    </main>
  );
}
