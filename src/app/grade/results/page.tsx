// Server Component
import Link from "next/link";
import { sql } from "../../../lib/db";

type SearchParams = { previewId?: string };

export default async function ResultPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const previewId = searchParams.previewId;
  if (!previewId || !/^\d+$/.test(previewId)) {
    // No id → guide user
    return (
      <main className="mx-auto max-w-3xl p-6 space-y-4">
        <h1 className="text-2xl font-bold">Your Grade</h1>
        <div className="rounded border p-4 bg-white">
          <p className="text-sm text-gray-700">
            We couldn’t find your saved preview. Please get your grade again.
          </p>
          <div className="mt-3">
            <Link href="/grade/new" className="text-blue-600 underline">
              Get your grade →
            </Link>
          </div>
        </div>
      </main>
    );
  }
