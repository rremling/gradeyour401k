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
          height: 1200,
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
      height: 1200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    }
  );
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return png("Image render error (missing DATABASE_URL)");

    const sql = neon(dbUrl);

    const rows = await sql<ShareRow[]>
      `SELECT provider, profile, grade, model_name, sentiment, as_of_date
         FROM public.report_shares
        WHERE id = ${params.id}
        LIMIT 1`;

    const data = rows[0];
    if (!data) return png("Shared grade not found");

    const gradeNum = Number(data.grade);
    const rating = Number.isFinite(gradeNum) ? Math.max(0, Math.min(5, gradeNum)) : 0;
    const ratingPct = `${(rating / 5) * 100}%`;

    const asOf = new Date(data.as_of_date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 1200,
            display: "flex",
            flexDirection: "column",
            background: "#0B1220",       // deep navy
            color: "white",
            padding: 64,
            gap: 36,
            position: "relative",
            boxSizing: "border-box",
            justifyContent: "flex-start",
          }}
        >
          {/* Header: logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img
              src={logoUrl}
              width={64}
              height={64}
              style={{ display: "flex", borderRadius: 12 }}
              alt=""
            />
            <div style={{ display: "flex", fontWeight: 700, fontSize: 36 }}>GradeYour401k</div>
          </div>

          {/* Big Title: 4.5 / 5 + star bar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", fontSize: 88, fontWeight: 800 }}>
              {rating.toFixed(1)} / 5
            </div>
            {/* Stars (gold overlay technique) */}
            <div style={{ display: "flex", position: "relative", height: 64 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 64,
                  color: "#d1d5db",          // gray-300
                  letterSpacing: 6,
                }}
              >
                ★★★★★
              </div>
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  overflow: "hidden",
                  width: ratingPct,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 64,
                    color: "#facc15",        // yellow-400
                    letterSpacing: 6,
                  }}
                >
                  ★★★★★
                </div>
              </div>
            </div>
          </div>

          {/* Info card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "white",
              color: "#111827",
              borderRadius: 32,
              padding: 40,
              gap: 22,
              boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", fontSize: 24, color: "#4B5563" }}>Provider</div>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>{data.provider}</div>

            <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 280 }}>
                <div style={{ display: "flex", fontSize: 22, color: "#4B5563" }}>Profile</div>
                <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>{data.profile}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 280 }}>
                <div style={{ display: "flex", fontSize: 22, color: "#4B5563" }}>As of</div>
                <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>{asOf}</div>
              </div>
              {data.sentiment && (
                <div style={{ display: "flex", flexDirection: "column", minWidth: 280 }}>
                  <div style={{ display: "flex", fontSize: 22, color: "#4B5563" }}>Market Sentiment</div>
                  <div style={{ display: "flex", fontSize: 36, fontWeight: 600 }}>{data.sentiment}</div>
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA (single line, no redundant bottom-right text) */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "auto",
              fontSize: 26,
              color: "#9CA3AF",
            }}
          >
            <div style={{ display: "flex" }}>Get your own grade → GradeYour401k.com</div>
            {/* intentionally nothing else on the right */}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 1200,
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
