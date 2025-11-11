/* @vercel/og image for shared grades */
import { ImageResponse } from "next/og";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";
export const revalidate = 0;

const sql = neon(process.env.DATABASE_URL!);

// Edge-safe fetch
async function getShare(id: string) {
  try {
    const rows = await sql<
      {
        provider: string;
        profile: string;
        grade: string;
        model_name: string | null;
        sentiment: string | null;
        as_of_date: string;
      }[]
    >`SELECT provider, profile, grade, model_name, sentiment, as_of_date
       FROM public.report_shares WHERE id = ${id} LIMIT 1`;
    return rows[0] ?? null;
  } catch (err) {
    console.error("[OG] DB fetch error:", err);
    return null;
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const data = await getShare(params.id);
  if (!data) return new Response("Not found", { status: 404 });

  const asOf = new Date(data.as_of_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const title = `My 401(k) Grade: ${data.grade} / 5`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#0B1220",
          color: "white",
          padding: 48,
          fontSize: 36,
          justifyContent: "space-between",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2563EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 28,
            }}
          >
            GY
          </div>
          <div style={{ fontWeight: 600, fontSize: 32 }}>GradeYour401k</div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "white",
            color: "#111827",
            borderRadius: 24,
            padding: 36,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: 28, color: "#4B5563" }}>Provider</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{data.provider}</div>

          <div style={{ display: "flex", gap: 40 }}>
            <div>
              <div style={{ fontSize: 24, color: "#4B5563" }}>Profile</div>
              <div style={{ fontSize: 40, fontWeight: 600 }}>{data.profile}</div>
            </div>
            <div>
              <div style={{ fontSize: 24, color: "#4B5563" }}>Grade</div>
              <div style={{ fontSize: 64, fontWeight: 800 }}>{data.grade} / 5</div>
            </div>
          </div>

          {data.sentiment && (
            <div>
              <div style={{ fontSize: 24, color: "#4B5563" }}>Market Sentiment</div>
              <div style={{ fontSize: 36, fontWeight: 600 }}>{data.sentiment}</div>
            </div>
          )}

          <div style={{ fontSize: 22, color: "#6B7280" }}>As of {asOf}</div>
        </div>

        {/* Footer CTA */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 28,
          }}
        >
          <div>Get your own grade → GradeYour401k.com</div>
          <div style={{ fontSize: 24, color: "#9CA3AF" }}>{title}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" },
    }
  );
}
