// src/lib/models-client.ts (server-only helper)
export async function fetchLatestModel(provider: string, profile: string) {
  const q = new URLSearchParams({ provider, profile }).toString();
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/models/latest?${q}`, {
    cache: "no-store",
    // If this runs in a route handler (server), absolute URL is safest.
  });
  if (!res.ok) throw new Error(`models/latest failed: ${res.status}`);
  return (await res.json()) as {
    ok: boolean;
    asof: string;
    provider: string;
    profile: string;
    notes: string | null;
    fear_greed: { asof_date: string; reading: number } | null;
    lines: { rank: number; symbol: string; weight: number; role: string | null }[];
  };
}
