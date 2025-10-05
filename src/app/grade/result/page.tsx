// src/app/grade/result/page.tsx
import { Suspense } from "react";
import Link from "next/link";

function ResultInner() {
  "use client";
  import { useSearchParams } from "next/navigation"; // inline import keeps the server layer clean
  // TypeScript doesn't like dynamic import inside function, so we re-declare here:
  const sp = (require("next/navigation") as typeof import("next/navigation")).useSearchParams();

  const provider = sp.get("provider") ?? "";
  const profile  = sp.get("profile")  ?? "";
  const grade    = sp.get("grade")    ?? "—";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3">
        <p><span className="font-medium">Provider:</span> {provider || "—"}</p>
        <p><span className="font-medium">Profile:</span> {profile || "—"}</p>
        <p className="text-3xl">⭐ {grade} / 5</p>
        <p className="text-sm text-gray-600">This is a preview grade. Payments and PDF report coming next.</p>
      </div>

      <div className="flex gap-3">
        <Link href="/grade/new" className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50">
          Edit inputs
        </Link>
        <Link href="/" className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50">
          Back to home
        </Link>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading grade…</main>}>
      <ResultInner />
    </Suspense>
  );
}
