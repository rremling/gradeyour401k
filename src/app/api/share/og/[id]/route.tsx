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
