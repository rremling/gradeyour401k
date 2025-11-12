// src/lib/grade.ts
import { FUND_LABELS, labelFor } from "@/lib/funds";

export type Holding = { symbol: string; weight: number };
export type InvestorProfile = "Growth" | "Balanced" | "Conservative" | "Aggressive Growth";

function isBondSymbol(sym: string): boolean {
  const lbl = (labelFor(sym) || "").toLowerCase();
  return /bond|treasury|fixed income|aggregate|corporate|muni|municipal|income|tips/.test(lbl);
}

function fundFamily(sym: string): string {
  const lbl = (labelFor(sym) || "").trim();
  if (!lbl) return "";
  return lbl.split(/\s+/)[0] || "";
}

export function computeFinalGrade(profile: string, rows: Holding[]): number {
  const weights = rows.map((r) => (Number.isFinite(r.weight) ? r.weight : 0));
  const total = weights.reduce((s, n) => s + n, 0);

  // Baseline by profile
  let base =
    (profile === "Growth" || profile === "Aggressive Growth") ? 4.5 :
    profile === "Balanced" ? 3.8 :
    4.1;

  // Penalty if not near 100%
  const off = Math.abs(100 - total);
  if (off > 0.25) base -= Math.min(0.8, off / 100);

  // Cap risk if single position >60%
  if (Math.max(0, ...weights) > 60) base -= 0.2;

  // Diversity sweet spot 6–8 holdings
  const n = rows.length;
  if (n >= 6 && n <= 8) base += 0.35;
  else {
    const dist = Math.min(Math.abs(n - 7), 10);
    base -= dist * 0.05;
  }

  // Prefer “known/curated” tickers a bit
  const curatedCount = rows.filter((r) => !!FUND_LABELS[(r.symbol || "").toUpperCase()]).length;
  if (n > 0) {
    const curatedRatio = curatedCount / n;
    base += (curatedRatio - 0.6) * 0.5;
  }

  // Single family dominance
  const familyWeights: Record<string, number> = {};
  rows.forEach((r) => {
    const fam = fundFamily(r.symbol);
    familyWeights[fam] = (familyWeights[fam] || 0) + (Number(r.weight) || 0);
  });
  const topFamily = Object.entries(familyWeights).sort((a, b) => b[1] - a[1])[0];
  const topFamilyPct = topFamily ? topFamily[1] : 0;
  if (topFamilyPct >= 55 && topFamilyPct <= 85) base += 0.25;
  else if (topFamilyPct > 90) base -= 0.1;

  // Bond threshold per profile
  const bondPct = rows.reduce((s, r) => s + (isBondSymbol(r.symbol) ? (Number(r.weight) || 0) : 0), 0);
  const bondThresh =
    (profile === "Growth" || profile === "Aggressive Growth") ? 20 :
    profile === "Balanced" ? 35 :
    50;
  if (bondPct > bondThresh) {
    const overshoot = bondPct - bondThresh;
    base -= Math.min(0.9, overshoot * 0.03);
  }

  // Clamp + half-star rounding
  const clamped = Math.max(1, Math.min(5, base));
  return Math.round(clamped * 2) / 2;
}

export function formatGradeHalfStar(n: number): string {
  // Always one decimal (e.g. 4.0, 4.5)
  return (Math.round(n * 2) / 2).toFixed(1);
}
