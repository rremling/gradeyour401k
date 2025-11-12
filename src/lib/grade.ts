// src/lib/grade.ts
import { FUND_LABELS, labelFor } from "@/lib/funds";

export const MAX_GRADE = 4.5;
export const MIN_GRADE = 1.5;

/** Round to nearest 0.5 while enforcing MIN/MAX and returning "x.x" */
export function formatGradeHalfStar(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const clamped = Math.max(MIN_GRADE, Math.min(MAX_GRADE, n));
  const half = Math.round(clamped * 2) / 2;
  return half.toFixed(1);
}

function isBondSymbol(sym: string): boolean {
  const lbl = (labelFor(sym) || "").toLowerCase();
  return /bond|treasury|fixed income|aggregate|corporate|muni|municipal|income|tips/.test(lbl);
}
function fundFamily(sym: string): string {
  const lbl = (labelFor(sym) || "").trim();
  if (!lbl) return "";
  return lbl.split(/\s+/)[0] || "";
}

/**
 * Final grade with a stricter calibration:
 * - Hard cap at 4.5
 * - Bases lowered so typical outputs land ~3.2–4.2
 * - Penalties scaled up slightly; small bonuses preserved but muted
 */
export function computeFinalGrade(
  profile: string,
  rows: Array<{ symbol: string; weight: number }>
): number {
  const clean = (rows || [])
    .map((r) => ({ symbol: String(r.symbol || "").toUpperCase().trim(), weight: Number(r.weight) || 0 }))
    .filter((r) => r.symbol && Number.isFinite(r.weight) && r.weight > 0);

  const weights = clean.map((r) => r.weight);
  const total = weights.reduce((s, n) => s + n, 0);
  const n = clean.length;

  // Lower bases a touch to avoid grade inflation
  let score =
    profile === "Growth" || profile === "Aggressive Growth"
      ? 3.70
      : profile === "Balanced"
      ? 3.40
      : 3.30; // Conservative / default

  // 1) Allocation completeness (0–1.2 penalty)
  const off = Math.abs(100 - total);
  score -= Math.min(1.2, off / 60); // 6% off = 0.1 penalty; 30% off = 0.5; 72%+ off hits cap

  // 2) Single-position concentration (up to ~0.6 penalty)
  const maxPos = Math.max(0, ...weights);
  if (maxPos > 40) {
    // soft penalty above 40%; ramps after 60%
    score -= 0.25 + Math.min(0.35, (maxPos - 40) / 80); // 60% -> ~0.5; 80% -> ~0.75 (capped 0.6 total addl)
  }

  // 3) Fund count optimal band around 7 (penalty stronger)
  if (n > 0) {
    const dist = Math.abs(n - 7);
    score -= Math.min(0.8, dist * 0.10); // every fund away from 7 costs 0.10 (capped)
    if (n >= 6 && n <= 9) score += 0.10; // small bonus if in good range
  } else {
    score -= 0.8;
  }

  // 4) Curated coverage ratio (muted bonus/penalty)
  if (n > 0) {
    const curated = clean.filter((r) => !!FUND_LABELS[r.symbol]).length;
    const ratio = curated / n; // center at 0.6
    score += Math.max(-0.20, Math.min(0.20, (ratio - 0.60) * 0.40));
  }

  // 5) Family concentration (penalize heavy brand concentration)
  const familyWeights: Record<string, number> = {};
  clean.forEach((r) => (familyWeights[fundFamily(r.symbol)] = (familyWeights[fundFamily(r.symbol)] || 0) + r.weight));
  const topFam = Object.entries(familyWeights).sort((a, b) => b[1] - a[1])[0];
  const topPct = topFam ? topFam[1] : 0;
  if (topPct >= 40 && topPct <= 60) score += 0.10; // mild sweet spot
  if (topPct > 70) score -= 0.20 + Math.min(0.20, (topPct - 70) / 150); // 85% -> ~0.30 penalty

  // 6) Bond alignment by profile (penalize outside bands)
  const bondPct = clean.reduce((s, r) => s + (isBondSymbol(r.symbol) ? r.weight : 0), 0);
  const [bondMin, bondMax] =
    profile === "Growth" || profile === "Aggressive Growth"
      ? [10, 25]
      : profile === "Balanced"
      ? [25, 45]
      : [40, 60];

  if (bondPct < bondMin) score -= Math.min(0.60, (bondMin - bondPct) * 0.03);
  if (bondPct > bondMax) score -= Math.min(0.60, (bondPct - bondMax) * 0.03);

  // 7) Unknown/uncategorized funds (ding a bit to reward mapped menus)
  const unknowns = clean.filter((r) => !FUND_LABELS[r.symbol]).length;
  if (unknowns > 0) score -= Math.min(0.40, unknowns * 0.05);

  // Clamp and snap to half-star; never return 5.0
  const clamped = Math.max(MIN_GRADE, Math.min(MAX_GRADE, score));
  return Math.round(clamped * 2) / 2;
}
