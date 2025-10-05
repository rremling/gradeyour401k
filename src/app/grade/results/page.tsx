// src/app/grade/result/page.tsx
// Server Component: read query via `searchParams` prop (no useSearchParams)
import Link from "next/link";

type SearchParams = {
  provider?: string;
  profile?: string;
  grade?: string;
};

export default function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const provider = searchParams.provider ?? "";
  const profile = searchParams.profile ?? "";
  const grade = searchParams.grade ?? "—";

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3">
        <p>
          <span className="font-medium">Provider:</span> {provider || "—"}
        </p>
        <p>
          <span className="font-medium">Profile:</span> {profile || "—"}
        </p>
        <p className="text-3xl">⭐ {grade} / 5</p>
        <p className="text-sm text-gray-600">
          This is a preview grade. Payments and PDF report coming next.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/grade/new"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
        <Link
          href="/"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
