import { Pool } from "pg";
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

  return (
    <main className="max-w-xl mx-auto p-6">
      {/* Brand/header */}
      <div className="flex items-center gap-3 mb-6">
        <Image src="/logo.png" alt="GradeYour401k" width={36} height={36} />
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
          <div>
            <div className="text-sm text-gray-500 mb-1">Grade</div>
            <div className="text-2xl font-bold">{data.grade}</div>
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

        <div className="mt-4 text-sm text-gray-500">As of {new Date(data.as_of_date).toLocaleDateString()}</div>
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
