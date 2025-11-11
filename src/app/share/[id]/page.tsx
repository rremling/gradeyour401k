// at top of /share/[id]/page.tsx
import type { Metadata } from "next";
import { Pool } from "pg";

export const runtime = "nodejs";   // ✅ ensure Node runtime for `pg`
export const revalidate = 0;       // ✅ always server-render fresh

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://gradeyour401k.com";
  const image = `${baseUrl}/api/share/og/${params.id}`;
  const url = `${baseUrl}/share/${params.id}`;

  return {
    title: "Shared 401(k) Grade — GradeYour401k",
    description: "See this 401(k) grade and get your own in minutes.",
    openGraph: {
      title: "Shared 401(k) Grade",
      description: "See this 401(k) grade and get your own in minutes.",
      url,
      siteName: "GradeYour401k",
      type: "article",
      images: [{ url: image, width: 1200, height: 630, type: "image/png", alt: "Shared 401(k) Grade" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Shared 401(k) Grade",
      description: "See this 401(k) grade and get your own in minutes.",
      images: [image], // 1200x630
    },
    alternates: { canonical: url },
  };
}

import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function getShare(id: string) {
  const { rows } = await pool.query(
    `SELECT id, provider, profile, grade, model_name, sentiment, as_of_date
     FROM public.report_shares WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const data = await getShare(params.id);
  if (!data) {
    return (
      <main className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Link not found</h1>
        <p className="text-gray-600">This shared grade link is invalid or expired.</p>
      </main>
    );
  }

  // ── Star rating prep (e.g., 4.5 -> 4.5 / 5 + stars) ───────────────────────
  const gradeNum = Number(data.grade);
  const rating = Number.isFinite(gradeNum) ? Math.max(0, Math.min(5, gradeNum)) : 0;
  const ratingPct = `${(rating / 5) * 100}%`;

  return (
    <main className="max-w-xl mx-auto p-6">
      {/* Brand/header */}
      <div className="flex items-center gap-3 mb-6">
        <Image
          src="/logo.png"            // served from /public/logo.png
          alt="GradeYour401k logo"
          width={36}
          height={36}
          className="rounded-lg"
          priority
          sizes="36px"
        />
        <h1 className="text-2xl font-semibold">Shared 401(k) Grade</h1>
      </div>

      {/* Card */}
      <div className="rounded-2xl border p-5 bg-white shadow-sm">
        <div className="text-sm text-gray-500 mb-1">Provider</div>
        <div className="font-medium mb-4">{data.provider}</div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Profile</div>
            <div className="font-medium">{data.profile}</div>
          </div>

          {/* ── Grade with stars and 4.5 / 5 ── */}
          <div>
            <div className="text-sm text-gray-500 mb-1">Grade</div>
            <div className="flex items-center gap-2">
              {/* Stars */}
              <div className="relative inline-block align-middle" aria-label={`${rating.toFixed(1)} out of 5`}>
                <div className="text-xl text-gray-300 tracking-[2px] select-none">★★★★★</div>
                <div className="absolute left-0 top-0 h-full overflow-hidden" style={{ width: ratingPct }}>
                  <div className="text-xl text-yellow-500 tracking-[2px] select-none">★★★★★</div>
                </div>
              </div>
              {/* Numeric */}
              <div className="text-2xl font-bold">{rating.toFixed(1)} / 5</div>
            </div>
          </div>
        </div>

        {data.model_name && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-1">Model</div>
            <div className="font-medium">{data.model_name}</div>
          </div>
        )}

        {data.sentiment && (
          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-1">Market Sentiment</div>
            <div className="font-medium">{data.sentiment}</div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          As of {new Date(data.as_of_date).toLocaleDateString()}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6">
        <Link href="/pricing" className="inline-block rounded-xl px-4 py-2 bg-black text-white">
          Get Your 401(k) Grade
        </Link>
      </div>
    </main>
  );
}
