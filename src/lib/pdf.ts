const pdfBytes = await generatePdfBuffer({
  provider: preview.provider_display || preview.provider || "",
  profile: preview.profile || "",
  grade,
  holdings: rows,
  logoUrl: "https://i.imgur.com/DMCbj99.png",
  clientName: preview.profile || undefined,
  reportDate: preview.created_at || undefined,

  // Optional overrides
  recommendations: [
    "Consolidate overlapping large-cap funds to a single low-cost index.",
    "Raise contribution rate to capture full employer match.",
    "Set quarterly auto-rebalance if available in plan.",
  ],
  marketOverlay: {
    summary: "Stay close to strategic targets; rebalance on drift. Keep any tactical sleeve modest.",
    tilts: [
      { label: "US Large Cap", direction: "Neutral", note: "Core anchor exposure" },
      { label: "US Small/Mid", direction: "Overweight", note: "Quality tilt; accept volatility" },
      { label: "International Developed", direction: "Neutral", note: "Diversification benefits" },
      { label: "Emerging Markets", direction: "Underweight", note: "Selective exposure only" },
      { label: "Investment-Grade Bonds", direction: "Neutral", note: "Ladder 1–5 yrs if available" },
    ],
    actions: [
      "Express tilts using broad, low-cost funds.",
      "Keep tactical sleeve ≤ 10% of portfolio weight.",
    ],
  },
});
