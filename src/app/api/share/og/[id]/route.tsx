/* /src/app/api/share/og/[id]/route.tsx */
import { ImageResponse } from "next/og";
import { neon } from "@neondatabase/serverless";

export const runtime = "edge";
export const revalidate = 0;

type ShareRow = {
  provider: string;
  profile: string;
  grade: string;
  model_name: string | null;
  sentiment: string | null;
  as_of_date: string;
};

function png(text: string, bg = "#111827", fg = "white") {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: fg,
          padding: 40,
          fontSize: 36,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex" }}>{text}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    }
  );
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return png(debug ? "Missing DATABASE_URL" : "Image render error");

    const sql = neon(dbUrl);

    const rows = await sql<ShareRow[]>
      `SELECT provider, profile, grade, model_name, sentiment, as_of_date
         FROM public.report_shares
        WHERE id = ${params.id}
        LIMIT 1`;

    const data = rows[0];
    if (!data) return png(debug ? `Shared grade not found: ${params.id}` : "Shared grade not found");

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
            position: "relative",
          }}
        >
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
              <div style={{ display: "flex" }}>GY</div>
            </div>
            <div style={{ display: "flex", fontWeight: 600, fontSize: 32 }}>GradeYour401k</div>
          </div>

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
            <div style={{ display: "flex", fontSize: 28, color: "#4B5563" }}>Provider</div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{data.provider}</div>

            <div style={{ display: "flex", gap: 40 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 24, color: "#4B5563" }}>Profile</div>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{data.profile}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 24, color: "#4B5563" }}>Grade</div>
                <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>{data.grade} / 5</div>
              </div>
            </div>

            {data.sentiment && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", fontSize: 24, color: "#4B5563" }}>Market Sentiment</div>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>{data.sentiment}</div>
              </div>
            )}

            <div style={{ display: "flex", fontSize: 22, color: "#6B7280" }}>As of {asOf}</div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 28,
            }}
          >
            <div style={{ display: "flex" }}>Get your own grade → GradeYour401k.com</div>
            <div style={{ display: "flex", fontSize: 24, color: "#9CA3AF" }}>{title}</div>
          </div>

          {debug && (
            <div
              style={{
                display: "flex",
                position: "absolute",
                right: 24,
                bottom: 24,
                fontSize: 18,
                color: "#9CA3AF",
              }}
            >
              id={params.id}
            </div>
          )}
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (err) {
    console.error("[OG] top-level error:", err);
    return png("Image render error");
  }
}
