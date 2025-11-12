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
          width: 600,
          height: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: bg,
          color: fg,
          padding: 32,
          fontSize: 24,
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex" }}>{text}</div>
      </div>
    ),
    { width: 600, height: 600, headers: { "Content-Type": "image/png" } }
  );
}

/* ─────────────────── SVG Stars (work reliably with @vercel/og) ─────────────────── */
function Star({ fill = "#d1d5db" }: { fill?: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24">
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.59L12 17.98 6.1 20.69l1.13-6.59L2.44 9.44l6.6-.96L12 2.5z"
        fill={fill}
      />
    </svg>
  );
}

function HalfStar() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24">
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
    const rows = await sql<ShareRow[]>`
      SELECT provider, profile, grade, model_name, sentiment, as_of_date
      FROM public.report_shares
      WHERE id = ${params.id}
      LIMIT 1
    `;

    const data = rows[0];
    if (!data) return png("Shared grade not found");

    // ── Grade: use the exact saved half-star string; fallback only if malformed
    const gradeStr = typeof data.grade === "string" ? data.grade : String(data.grade ?? "");
    const displayGrade =
      /^[1-5](?:\.0|\.5)$/.test(gradeStr)
        ? gradeStr
        : (() => {
            const n = Number(gradeStr);
            if (!Number.isFinite(n)) return "—";
            const half = Math.round(Math.min(5, Math.max(1, n)) * 2) / 2;
            return half.toFixed(1);
          })();

    // Stars derived from the already half-step value
    const gradeNum = Number(displayGrade);
    const full = Number.isFinite(gradeNum) ? Math.floor(gradeNum) : 0;
    const hasHalf = Number.isFinite(gradeNum) ? gradeNum - full === 0.5 : false;

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
            padding: 32,
            boxSizing: "border-box",
            gap: 20,
            justifyContent: "flex-start",
          }}
        >
          {/* Header: logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img
              src={logoUrl}
              width={40}
              height={40}
              style={{ display: "flex", borderRadius: 8 }}
              alt=""
            />
            <div style={{ display: "flex", fontWeight: 800, fontSize: 24 }}>GradeYour401k</div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: "flex",
              fontSize: 22,
              lineHeight: 1.25,
              color: "#e5e7eb",
              fontWeight: 600,
            }}
          >
            I graded my 401(k) today — here’s my grade:
          </div>

          {/* Big Grade (equal sizes) */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div style={{ fontSize: 72, fontWeight: 900 }}>{displayGrade}</div>
            <div style={{ fontSize: 72, fontWeight: 700, color: "#a3a3a3" }}>/ 5</div>
          </div>

          {/* Stars */}
          <div style={{ display: "flex", gap: 6 }}>
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
              borderRadius: 20,
              padding: 20,
              gap: 12,
              marginTop: 8,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontSize: 16, color: "#4B5563", display: "flex" }}>Provider</div>
            <div style={{ fontSize: 28, fontWeight: 800, display: "flex" }}>{data.provider}</div>

            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 200 }}>
                <div style={{ fontSize: 14, color: "#4B5563", display: "flex" }}>Profile</div>
                <div style={{ fontSize: 24, fontWeight: 700, display: "flex" }}>{data.profile}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 200 }}>
                <div style={{ fontSize: 14, color: "#4B5563", display: "flex" }}>As of</div>
                <div style={{ fontSize: 22, fontWeight: 700, display: "flex" }}>{asOf}</div>
              </div>
              {data.sentiment && (
                <div style={{ display: "flex", flexDirection: "column", minWidth: 200 }}>
                  <div style={{ fontSize: 14, color: "#4B5563", display: "flex" }}>
                    Market Sentiment
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, display: "flex" }}>
                    {data.sentiment}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              fontSize: 16,
              color: "#9CA3AF",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <div style={{ display: "flex" }}>Get your own grade → GradeYour401k.com</div>
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
