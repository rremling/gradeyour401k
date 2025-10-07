// src/app/success/page.tsx
import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Thanks! Payment Received.</h1>
      <p className="text-gray-700">
        If you already graded your inputs, your full PDF report will arrive by email shortly.
      </p>
      <div className="rounded-lg border p-4 bg-gray-50 space-y-2">
        <p className="font-medium">Did you buy first without grading?</p>
        <p className="text-sm text-gray-700">
          No problem—finish your inputs now and we’ll generate your report:
        </p>
        <div className="flex gap-3">
          <Link
            href="/grade/new"
            className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
          >
            Go to Grade Form
          </Link>
          <Link
            href="/"
            className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
          >
            Return Home
          </Link>
        </div>
        <p className="text-xs text-gray-600">
          Tip: If you graded before purchasing, your last inputs are saved in your browser and will be prefilled.
        </p>
      </div>
    </main>
  );
}
