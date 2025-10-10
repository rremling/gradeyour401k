// src/app/grade/results/page.tsx
import { Suspense } from "react";
import ResultsClient from "./ResultsClient";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl p-6">
          <div className="rounded-lg border p-6 bg-white text-sm text-gray-600">
            Loading your results…
          </div>
        </main>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
