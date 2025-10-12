// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Holding = { symbol: string; weight: number };

export type MarketTilt = {
  label: string; // e.g., "US Large Cap", "Energy", "Intl Developed"
  direction: "Overweight" | "Underweight" | "Neutral";
  note?: string; // optional short note
};

export type MarketOverlay = {
  summary?: string; // one-paragraph overview
  tilts?: MarketTilt[]; // directional tilts table
  actions?: string[]; // optional action bullets (appears under overlay)
};

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null;
  holdings: Holding[];
  logoUrl?: string;
  clientName?: string;
  reportDate?: string;

  // New, optional
  recommendations?: string[];
  marketOverlay?: MarketOverlay;
};

const COLORS = {
  ink: rgb(0.12, 0.12, 0.12),
  sub: rgb(0.35, 0.35, 0.35),
  line: rgb(0.85, 0.85, 0.85),
  brand: rgb(0.05, 0.35, 0.75),
  badge: rgb(0.05, 0.35, 0.75),
  footer: rgb(0.45, 0.45, 0.45),
  pos: rgb(0.05, 0.55, 0.2), // green-ish for Overweight
  neg: rgb(0.7, 0.15, 0.15), // red-ish for Underweight
  neu: rgb(0.4, 0.4, 0.4),   // neutral gray
};

function todayMMDDYYYY() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

function normalizeGradeText(g: number | string | null) {
  if (g === null || g === undefined) return "—";
  if (typeof g === "number") return `${g.toFixed(1)}/5`;
  const trimmed = g.trim();
  const letter = /^[A-D][+-]?$|^F$/i.test(trimmed);
  if (letter) return trimmed.toUpperCase();
  const num = trimmed.match(/(\d+(\.\d+)?)\s*\/\s*5/);
  if (num) return `${num[1]}/5`;
  const maybeNum = Number(trimmed);
  if (!Number.isNaN(maybeNum)) return `${maybeNum.toFixed(1)}/5`;
  return trimmed;
}

function normalizeGradeNumber(g: number | string | null): number | null {
  if (g === null || g === undefined) return null;
  if (typeof g === "number") return Number.isFinite(g) ? g : null;
  const trimmed = g.trim();
  const num = trimmed.match(/(\d+(\.\d+)?)\s*\/\s*5/);
  if (num) return Number(num[1]);
  const maybeNum = Number(trimmed);
  return Number.isFinite(maybeNum) ? maybeNum : null;
}

async function loadLogoBytes(logoUrl?: string): Promise<Uint8Array | null> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// Simple word-wrap for a given max width
function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const w of words) {
    const testLine = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(testLine, size);
    if (width <= maxWidth) {
      line = testLine;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Auto recommendations based on grade/profile if none provided
function makeDefaultRecommendations(gradeNum: number | null, profile: string): string[] {
  const p = (profile || "").toLowerCase();
  const isAggressive = /aggr|growth|max/i.test(p);
  const isConservative = /cons|income|defen/i.test(p);

  if (gradeNum === null) {
    return [
      "Verify your investor profile is current before making allocation changes.",
      "Review the largest positions in your plan for overlap and costs.",
      "Rebalance to target weights and set a calendar reminder for quarterly checks.",
    ];
  }

  if (gradeNum >= 4.2) {
    return [
      "Maintain current core allocations; avoid unnecessary turnover.",
      "Rebalance back to target weights if any sleeve drift exceeds ±5%.",
      "Confirm contribution rate and employer match are maximized.",
    ];
  }

  if (gradeNum >= 3.4) {
    return [
      "Trim overweight positions and boost underrepresented core funds to reach target.",
      "Consolidate redundant funds to reduce overlap and fees.",
      `Align risk to your profile${isAggressive ? " (allow slightly higher equity weight)" : isConservative ? " (raise quality and bond ballast)" : ""}.`,
    ];
  }

  return [
    "Simplify the lineup to 3–6 core funds that map to your profile.",
    `Shift toward broad market index funds${isConservative ? " and add short/intermediate bond exposure" : isAggressive ? " and reduce niche/single-sector bets" : ""}.`,
    "Set up an automatic quarterly rebalance until drift is within ±3%.",
  ];
}

// Default market overlay if none supplied
function makeDefaultOverlay(gradeNum: number | null, profile: string): MarketOverlay {
  const summary =
    gradeNum !== null && gradeNum >= 4
      ? "Conditions favor staying close to strategic targets. Maintain discipline; rebalance on drift."
      : "Use current conditions to migrate toward a cleaner core allocation. Prioritize broad, low-cost funds.";

  const tilts: MarketTilt[] = [
    { label: "US Large Cap", direction: "Neutral", note: "Core anchor exposure" },
    { label: "US Small/Mid", direction: "Overweight", note: "Quality tilt; accept volatility" },
    { label: "International Developed", direction: "Neutral", note: "Diversification benefits" },
    { label: "Emerging Markets", direction: "Underweight", note: "Selective exposure only" },
    { label: "Investment-Grade Bonds", direction: "Neutral", note: "Ladder 1–5 yrs if available" },
    { label: "Cash/Stable Value", direction: "Neutral", note: "Tactical dry powder only" },
  ];

  const p = (profile || "").toLowerCase();
  if (/cons|income|defen/i.test(p)) {
    // nudge toward ballast
    tilts.forEach(t => {
      if (t.label.includes("Bonds")) t.direction = "Overweight";
      if (t.label.includes("US Small")) t.direction = "Underweight";
    });
  } else if (/aggr|growth|max/i.test(p)) {
    // nudge toward equity beta
    tilts.forEach(t => {
      if (t.label.includes("US Small")) t.direction = "Overweight";
      if (t.label.includes("Bonds")) t.direction = "Underweight";
    });
  }

  const actions = [
    "Implement tilts using the lowest-cost, broadest funds available.",
    "Keep any tactical sleeve ≤ 10% of portfolio weight.",
  ];

  return { summary, tilts, actions };
}

export async function generatePdfBuffer({
  provider,
  profile,
  grade,
  holdings,
  logoUrl,
  clientName,
  reportDate,
  recommendations,
  marketOverlay,
}: PdfArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]); // Letter
  let { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await loadLogoBytes(logoUrl);
  const logoImg = logoBytes ? await pdf.embedPng(logoBytes) : null;

  const MARGIN_X = 40;
  const TOP_Y = height - 40;
  const BOTTOM_Y = 40;

  let y = TOP_Y;

  const drawFooter = (p = page) => {
    const footer = "Kenai Investments, Inc. — www.kenaiinvest.com";
    const w = font.widthOfTextAtSize(footer, 10);
    p.drawLine({
      start: { x: MARGIN_X, y: BOTTOM_Y + 18 },
      end: { x: width - MARGIN_X, y: BOTTOM_Y + 18 },
      thickness: 0.5,
      color: COLORS.line,
    });
    p.drawText(footer, {
      x: width - MARGIN_X - w,
      y: BOTTOM_Y + 6,
      size: 10,
      font,
      color: COLORS.footer,
    });
  };

  const newPage = () => {
    drawFooter(page);
    page = pdf.addPage([612, 792]);
    ({ width, height } = page.getSize());
    y = height - 40;
  };

  const sectionTitle = (txt: string) => {
    if (y < BOTTOM_Y + 80) newPage();
    page.drawText(txt, { x: MARGIN_X, y, size: 14, font: bold, color: COLORS.ink });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: width - MARGIN_X, y },
      thickness: 0.8,
      color: COLORS.line,
    });
    y -= 18;
  };

  const writeParagraph = (txt: string, maxWidth: number, size = 12, color = COLORS.ink) => {
    const lines = wrapText(txt, maxWidth, font, size);
    for (const line of lines) {
      if (y < BOTTOM_Y + 24) newPage();
      page.drawText(line, { x: MARGIN_X, y, size, font, color });
      y -= 16;
    }
  };

  // ===== Header =====
  const title = "GradeYour401k — Personalized Report";
  const titleSize = 20;

  // Logo
  let logoWidth = 0;
  if (logoImg) {
    const LOGO_H = 36;
    const aspect = logoImg.width / logoImg.height;
    logoWidth = LOGO_H * aspect;
    page.drawImage(logoImg, {
      x: MARGIN_X,
      y: y - LOGO_H,
      width: logoWidth,
      height: LOGO_H,
    });
  }

  // Title
  const titleX = logoImg ? MARGIN_X + logoWidth + 12 : MARGIN_X;
  page.drawText(title, {
    x: titleX,
    y: y - 4,
    size: titleSize,
    font: bold,
    color: COLORS.brand,
  });

  // Grade badge (right)
  const badgeR = 20;
  const cx = width - MARGIN_X - badgeR;
  const cy = y - 2;
  page.drawCircle({ x: cx, y: cy, size: badgeR, color: COLORS.badge });
  const gradeText = normalizeGradeText(grade);
  const gw = bold.widthOfTextAtSize(gradeText, 14);
  page.drawText(gradeText, { x: cx - gw / 2, y: cy - 6, size: 14, font: bold, color: rgb(1, 1, 1) });

  y -= 46;

  // Meta
  const metaLeft = clientName ? `Client: ${clientName}` : "";
  const metaRight = `Date: ${reportDate ? new Date(reportDate).toLocaleDateString() : todayMMDDYYYY()}`;
  const meta = [metaLeft, metaRight].filter(Boolean).join("    •    ");
  if (meta) {
    page.drawText(meta, { x: MARGIN_X, y, size: 11, font, color: COLORS.sub });
    y -= 12;
  }
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: width - MARGIN_X, y },
    thickness: 0.8,
    color: COLORS.line,
  });
  y -= 18;

  // ===== Summary =====
  sectionTitle("Summary");
  const keyValue = (label: string, value: string) => {
    page.drawText(label, { x: MARGIN_X, y, size: 12, font: bold, color: COLORS.ink });
    const lw = bold.widthOfTextAtSize(label, 12);
    page.drawText(value, { x: MARGIN_X + lw + 6, y, size: 12, font, color: COLORS.ink });
    y -= 18;
  };
  keyValue("Provider:", provider || "—");
  keyValue("Profile:", profile || "—");
  keyValue("Preliminary Grade:", gradeText);
  y -= 6;

  // ===== Holdings =====
  const holdingsTable = (rows: Holding[]) => {
    sectionTitle("Current Holdings");
    const colSymbolX = MARGIN_X;
    const colWeightX = width - MARGIN_X - 90;
    const rowH = 18;

    // header
    page.drawText("Symbol", { x: colSymbolX, y, size: 12, font: bold, color: COLORS.sub });
    page.drawText("Weight", { x: colWeightX, y, size: 12, font: bold, color: COLORS.sub });
    y -= rowH;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: width - MARGIN_X, y },
      thickness: 0.5,
      color: COLORS.line,
    });
    y -= 6;

    if (!rows || rows.length === 0) {
      page.drawText("No holdings provided.", { x: MARGIN_X, y, size: 12, font, color: COLORS.ink });
      y -= rowH;
      return;
    }

    for (const h of rows) {
      if (y < BOTTOM_Y + 40) {
        newPage();
        sectionTitle("Current Holdings (cont.)");
        page.drawText("Symbol", { x: colSymbolX, y, size: 12, font: bold, color: COLORS.sub });
        page.drawText("Weight", { x: colWeightX, y, size: 12, font: bold, color: COLORS.sub });
        y -= rowH;
        page.drawLine({
          start: { x: MARGIN_X, y },
          end: { x: width - MARGIN_X, y },
          thickness: 0.5,
          color: COLORS.line,
        });
        y -= 6;
      }
      const symbol = String(h.symbol || "").toUpperCase().trim();
      const weight = `${Number(h.weight || 0).toFixed(1)}%`;

      page.drawText(symbol, { x: colSymbolX, y, size: 12, font, color: COLORS.ink });
      page.drawText(weight, { x: colWeightX, y, size: 12, font, color: COLORS.ink });

      y -= rowH;
    }
  };

  holdingsTable(holdings || []);

  // ===== Recommendations =====
  sectionTitle("Recommendations");
  const gradeNum = normalizeGradeNumber(grade);
  const recos = (recommendations && recommendations.length > 0)
    ? recommendations
    : makeDefaultRecommendations(gradeNum, profile);

  const maxParaWidth = width - MARGIN_X * 2;
  if (recos.length === 0) {
    writeParagraph("No recommendations provided.", maxParaWidth);
  } else {
    for (const r of recos) {
      // bullet
      if (y < BOTTOM_Y + 24) newPage();
      page.drawText("•", { x: MARGIN_X, y, size: 12, font, color: COLORS.ink });
      const bulletIndent = 14;
      const lines = wrapText(r, maxParaWidth - bulletIndent, font, 12);
      let firstLine = true;
      for (const line of lines) {
        if (!firstLine) {
          if (y < BOTTOM_Y + 24) newPage();
        }
        page.drawText(line, { x: MARGIN_X + bulletIndent, y, size: 12, font, color: COLORS.ink });
        y -= 16;
        firstLine = false;
      }
      y -= 4;
    }
  }

  // ===== Market Overlay =====
  sectionTitle("Market Overlay");
  const overlay = marketOverlay ?? makeDefaultOverlay(gradeNum, profile);

  if (overlay.summary) {
    writeParagraph(overlay.summary, maxParaWidth, 12, COLORS.ink);
    y -= 6;
  }

  // Tilts table (if any)
  const tilts = overlay.tilts || [];
  if (tilts.length > 0) {
    // table header
    if (y < BOTTOM_Y + 80) newPage();
    page.drawText("Tilt", { x: MARGIN_X, y, size: 12, font: bold, color: COLORS.sub });
    page.drawText("Direction", { x: MARGIN_X + 220, y, size: 12, font: bold, color: COLORS.sub });
    page.drawText("Note", { x: MARGIN_X + 340, y, size: 12, font: bold, color: COLORS.sub });
    y -= 18;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: width - MARGIN_X, y },
      thickness: 0.5,
      color: COLORS.line,
    });
    y -= 6;

    for (const t of tilts) {
      if (y < BOTTOM_Y + 40) newPage();
      page.drawText(t.label, { x: MARGIN_X, y, size: 12, font, color: COLORS.ink });

      const dirColor =
        t.direction === "Overweight" ? COLORS.pos :
        t.direction === "Underweight" ? COLORS.neg : COLORS.neu;

      page.drawText(t.direction, { x: MARGIN_X + 220, y, size: 12, font, color: dirColor });

      // Note wraps
      const noteText = t.note || "";
      const noteLines = wrapText(noteText, width - (MARGIN_X + 340) - MARGIN_X, font, 12);
      if (noteLines.length === 0) {
        y -= 18;
      } else {
        let first = true;
        for (const line of noteLines) {
          if (!first) {
            if (y < BOTTOM_Y + 24) newPage();
          }
          page.drawText(line, { x: MARGIN_X + 340, y, size: 12, font, color: COLORS.ink });
          y -= 16;
          first = false;
        }
        y -= 2;
      }
    }
    y -= 4;
  }

  const overlayActions = overlay.actions || [];
  if (overlayActions.length > 0) {
    if (y < BOTTOM_Y + 40) newPage();
    page.drawText("Actions", { x: MARGIN_X, y, size: 12, font: bold, color: COLORS.sub });
    y -= 16;
    for (const a of overlayActions) {
      if (y < BOTTOM_Y + 24) newPage();
      page.drawText("•", { x: MARGIN_X, y, size: 12, font, color: COLORS.ink });
      const lines = wrapText(a, maxParaWidth - 14, font, 12);
      let first = true;
      for (const line of lines) {
        if (!first && y < BOTTOM_Y + 24) newPage();
        page.drawText(line, { x: MARGIN_X + 14, y, size: 12, font, color: COLORS.ink });
        y -= 16;
        first = false;
      }
      y -= 2;
    }
  }

  // Footer for last page
  drawFooter(page);
  return await pdf.save();
}
