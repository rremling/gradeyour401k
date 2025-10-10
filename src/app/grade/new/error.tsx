// src/app/grade/new/error.tsx
"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-gray-700">
        {error?.message || "A client-side error occurred while loading this page."}
      </p>
      <button
        className="rounded border px-3 py-2 hover:bg-gray-50"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}
