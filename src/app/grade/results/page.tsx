// src/app/grade/result/page.tsx
import Link from "next/link";

type SearchParams = {
  provider?: string;
  profile?: string;
  grade?: string;
  previewId?: string;
};

type PreviewRow = { symbol: string; weight: number };

async function fetchPreview(previewId: string) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const res = await fetch(`${base}/api/preview/get?id=${encodeURIComponent(previewId)}`, {
      // Build time may be static; force dynamic
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      provider: string;
      provider_display?: string;
      profile: string;
      rows: PreviewRow[];
      grade_base?: number;
      grade_adjusted?: number;
    } | null;
  } catch {
    return null;
  }
}

export default async function ResultPage({ searchParams }: { searchParams: SearchParams }) {
  const providerParam = searchParams.provider || "";
  const profile = searchParams.profile || "";
  const grade = searchParams.grade || "—";
  const previewId = searchParams.previewId || "";

  let preview = null as Awaited<ReturnType<typeof fetchPreview>>;

  if (previewId) {
    preview = await fetchPreview(previewId);
  }

  const providerDisplay =
    preview?.provider_display || providerParam || (preview?.provider ?? "");

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Grade</h1>

      <div className="rounded-lg border p-6 space-y-3">
        <p>
          <span className="font-medium">Provider:</span>{" "}
          {providerDisplay || "—"}
        </p>
        <p>
          <span className="font-medium">Profile:</span>{" "}
          {profile || preview?.profile || "—"}
        </p>
        <p className="text-3xl">⭐ {grade} / 5</p>
        <p className="text-sm text-gray-600">
          This is a preview grade. The full PDF report (with model comparison
          and market overlay) is sent after purchase.
        </p>
      </div>

      {preview?.rows?.length ? (
        <section className="rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-3">Your current holdings</h2>
          <div className="grid grid-cols-12 text-sm font-medium border-b pb-2">
            <div className="col-span-8">Symbol</div>
            <div className="col-span-4 text-right">Weight %</div>
          </div>
          <div className="divide-y">
            {preview.rows.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 py-2 text-sm">
                <div className="col-span-8">{r.symbol}</div>
                <div className="col-span-4 text-right">{r.weight.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex gap-3">
        <Link
          href="/pricing"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Buy report
        </Link>
        <Link
          href="/grade/new"
          className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Edit inputs
        </Link>
      </div>
    </main>
  );
}
