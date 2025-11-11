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

function png(text: string, bg = "#0B1220", fg = "white") {
  return new ImageResponse(
    (
      <div
        style={{
          width: 300,
          height: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: fg,
          padding: 16,
          fontSize: 16,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex" }}>{text}</div>
      </div>
    ),
    { width: 300, height: 300, headers: { "Content-Type": "image/png" } }
  );
}

/* ─────────────────── SVG Stars ─────────────────── */
function Star({ fill = "#d1d5db" }: { fill?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.59L12 17.98 6.1 20.69l1.13-6.59L2.44 9.44l6.6-.96L12 2.5z"
        fill={fill}
      />
    </svg>
  );
}

function HalfStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <defs>
        <clipPath id="halfClip">
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.59L12 17.98 6.1 20.69l1.13-6.59L2.44 9.44l6.6-.96L12 2.5z"
        fill="#d1d5db"
      />
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.59L12 17.98 6.1 20.69l1.13-6.59L2.44 9.44l6.6-.96L12 2.5z"
        fill="#facc15"
        clipPath="url(#halfClip)"
      />
    </svg>
  );
}

/* ─────────────────── Route ─────────────────── */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const reqUrl = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${reqUrl.protocol}//${reqUrl.host}`;
    const logoUrl = `${baseUrl}/logo.png`;

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) return png("Image render error");

    const sql = neon(dbUrl);
    const rows = await sql<ShareRow[]>
      `SELECT provider, profile, grade, model_name, sentiment, as_of_date
         FROM public.report_shares
        WHERE id = ${params.id}
        LIMIT 1`;

    const data = rows[0];
    if (!data) return png("Shared grade not found");

    const gradeNum = Number(data.grade);
    const ratingRaw = Number.isFinite(gradeNum) ? Math.max(0, Math.min(5, gradeNum)) : 0;
    const rating = Math.round(ratingRaw * 2) / 2;
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;

    const asOf = new Date(data.as_of_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return new ImageResponse(
      (
        <div
          style={{
            width: 600,
            height: 600,
            display: "flex",
            flexDirection: "column",
            background: "#0B1220",
            color: "white",
            padding: 16,
            boxSizing: "border-box",
            gap: 10,
            justifyContent: "flex-start",
          }}
        >
          {/* Header: logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <img
              src={logoUrl}
              width={20}
              height={20}
              style={{ display: "flex", borderRadius: 4 }}
              alt=""
            />
            <div style={{ display: "flex", fontWeight: 700, fontSize: 13 }}>GradeYour401k</div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              fontSize: 13,
              lineHeight: 1.2,
              color: "#e5e7eb",
              fontWeight: 500,
            }}
          >
            I graded my 401(k) today — here’s my grade:
          </div>

          {/* Big Grade */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{ratingRaw.toFixed(1)}</div>
            <div style={{ fontSize: 36, fontWeight: 600, color: "#a3a3a3" }}>/ 5</div>
          </div>

          {/* Stars */}
          <div style={{ display: "flex", gap: 2 }}>
            {Array.from({ length: full }).map((_, i) => (
              <Star key={`full-${i}`} fill="#facc15" />
            ))}
            {hasHalf && <HalfStar key="half" />}
            {Array.from({ length: 5 - full - (hasHalf ? 1 : 0) }).map((_, i) => (
              <Star key={`empty-${i}`} fill="#d1d5db" />
            ))}
          </div>

          {/* White info card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "white",
              color: "#111827",
              borderRadius: 10,
              padding: 10,
              gap: 6,
              marginTop: 6,
            }}
          >
            <div style={{ fontSize: 9, color: "#4B5563" }}>Provider</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{data.provider}</div>

            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, color: "#4B5563" }}>Profile</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{data.profile}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 9, color: "#4B5563" }}>As of</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{asOf}</div>
              </div>
            </div>
          </div>

          {/* Footer CTA */}
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              fontSize: 10,
              color: "#9CA3AF",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div>Get your own grade → GradeYour401k.com</div>
          </div>
        </div>
      ),
      {
        width: 600,
        height: 600,
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
