//  src/app/grade/results/page.tsx
import Link from "next/link";
import {
  PROVIDERS,
  HOLDINGS_MAP,
  type ProviderKey,
  type InvestorProfile,
  validateSymbol,
  labelFor,
  computeGrade,
  diffAgainstModel,
} from "@/lib/gy4k";

// --- helpers ---
function parseRows(raw: string | null) {
  if (!raw) return [] as { symbol: string; weight: number }[];
  try {
    const arr = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((r) => r && typeof r.symbol === "string")
      .map((r) => ({
        symbol: String(r.symbol).toUpperCase(),
        weight:
          r.weight === "" || r.weight === null || r.weight === undefined
            ? 0
            : Number(r.weight) || 0,
      }));
  } catch {
    return [];
  }
}

// count how many user tickers belong to another provider
function countCrossProviderSymbols(selected: ProviderKey | "", symbols: string[]) {
  if (!selected) return 0;
  const others: [ProviderKey, string[]][] = (Object.keys(HOLDINGS_MAP) as ProviderKey[])
    .filter((p) => p !== selected)
    .map((p) => [p, HOLDINGS_MAP[p]]);
  let count = 0;
  for (const s of symbols) {
    const hitOther = others.some(([, list]) => list.includes(s));
    if (hitOther) count++;
  }
  return count;
}

export default function ResultsPage({
  searchParams,
}: {
  searchParams: { provider?: string; profile?: InvestorProfile; grade?: string; rows?: string };
}) {
  const providerLabel = searchParams.provider ?? "";
  const profile = (searchParams.profile as InvestorProfile) ?? "Growth";
  const rowsParam = searchParams.rows ?? "";

  const providerKey =
    PROVIDERS.find((p) => p.label.toLowerCase() === providerLabel.toLowerCase())
      ?.key || "";

  const userRows = parseRows(rowsParam);
  const total = userRows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const baseGrade = computeGrade(profile, total);

  const validity = userRows.map((r) => ({
    ...r,
    status: validateSymbol(providerKey as ProviderKey, r.symbol),
    label: labelFor(r.symbol),
  }));

  const invalidCount = validity.filter((v) => v.status === "invalid").length;
  const crossProviderCount = countCrossProviderSymbols(
    providerKey as ProviderKey,
    userRows.map((r) => r.symbol)
  );
  const offTotalPenalty = Math.min(1, Math.abs(100 - total) / 50);
  const invalidPenalty = Math.min(1, invalidCount * 0.2);
  const crossPenalty = Math.min(0.7, crossProviderCount * 0.1);

  const adjusted = Math.max(1, Math.min(5, baseGrade - (offTotalPenalty + invalidPenalty + crossPenalty)));
  const grade = adjusted.toFixed(1);

  // For “Edit inputs” round-trip
  const backParams = new URLSearchParams({
    provider: providerLabel,
    profile,
    rows: rowsParam || "",
  }).toString();

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-8">
      <h1 className="text-2xl font-bold">Your Grade (v3)</h1>

      <div className="rounded-lg border p-6 space-y-3">
        <p><span className="font-medium">Provider:</span> {providerLabel || "—"}</p>
        <p><span className="font-medium">Profile:</span> {profile}</p>
        <p className="text-3xl">⭐ {grade} / 5</p>
        <p className="text-sm text-gray-600">
          Preview grade adjusts for invalid tickers, cross-provider funds, and allocations not summing to 100%.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Ticker validation</h2>
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Symbol</th>
                <th className="px-3 py-2 text-left">Holding name</th>
                <th className="px-3 py-2 text-left">Weight %</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {validity.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2 font-mono">{r.symbol}</td>
                  <td className="px-3 py-2">{r.label || "—"}</td>
                  <td className="px-3 py-2">{(Number(r.weight) || 0).toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`text-[11px] rounded-full px-2 py-1 border ${
                        r.status === "inList"
                          ? "bg-green-50 text-green-700 border-green-300"
                          : r.status === "custom"
                          ? "bg-amber-50 text-amber-700 border-amber-300"
                          : "bg-red-50 text-red-700 border-red-300"
                      }`}
                    >
                      {r.status === "inList"
                        ? "Valid (in list)"
                        : r.status === "custom"
                        ? "Custom"
                        : "Invalid"}
                    </span>
                  </td>
                </tr>
              ))}
              {validity.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={4}>
                    No holdings entered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-600">
          Penalties applied — Invalid: {invalidCount}, Cross-provider: {crossProviderCount}, Total deviation:{" "}
          {Math.abs(100 - total).toFixed(1)}%.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upgrade to see full analysis</h2>
        <div className="rounded-md border p-4 bg-gray-50">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>
              <strong>Full portfolio analysis</strong> showing which holdings to increase or reduce.
            </li>
            <li>
              <strong>Market-cycle insights</strong> using <code>SPY</code> 30/50/100/200-day SMA trend to adjust risk level.
            </li>
            <li>
              <strong>Professional PDF report</strong> emailed instantly after purchase.
            </li>
          </ul>
          <div className="mt-4 flex gap-3">
            <Link
              href="/pricing"
              className="inline-block rounded-lg bg-blue-600 text-white px-4 py-2 hover:bg-blue-700"
            >
              Purchase full PDF report
            </Link>
            <Link
              href={`/grade/new?${backParams}`}
              className="inline-block rounded-lg border px-4 py-2 hover:bg-gray-50"
            >
              Edit inputs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
