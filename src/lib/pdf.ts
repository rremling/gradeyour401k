// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null; // allow number or string
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string; // optional logo
};

// ---------- helpers ----------
function formatGrade(g: number | string | null): string {
  if (g == null) return "—";
  const n = Number(g);
  if (Number.isFinite(n)) return `${n.toFixed(1)} / 5`;
  return String(g);
}

// shorter text for the circle badge (avoid " / 5")
function compactGrade(g: number | string | null): string {
  if (g == null) return "—";
  const n = Number(g);
  if (Number.isFinite(n)) return n.toFixed(1);
  const s = String(g).trim();
  const m = s.match(/^(\d+(\.\d+)?)\s*\/\s*5/);
  return m ? m[1] : s.toUpperCase();
}

// fetch PNG bytes for logo
async function loadPngBytes(url?: string): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// simple word-wrap for paragraph lines
function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const words = String(text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// prefilled recommendations by profile (no config yet)
function recommendedByProfile(profile: string): string[] {
  const p = (profile || "").toLowerCase();
  if (/(aggr|max|very.*growth)/i.test(p)) {
    return [
      "Keep core equity funds as the backbone; avoid over-concentration in single sectors.",
      "Rebalance to targets when any sleeve drifts more than +/-5%.",
      "Use broad, low-cost indices for international and small/mid-cap exposure.",
    ];
  }
  if (/(balanced|moderate|mod)/i.test(p)) {
    return [
      "Maintain a 60/40-style core; prefer high-quality bond ballast.",
      "Trim overweight positions; consolidate redundant funds to reduce overlap.",
      "Quarterly rebalance; review risk level annually to match time horizon.",
    ];
  }
  // default “Growth”
  return [
    "Favor broad US equity core with a measured small/mid tilt.",
    "Add international developed exposure for diversification; keep EM modest.",
    "Rebalance quarterly; keep any tactical sleeve <= 10% of the portfolio.",
  ];
}

// draw right-aligned numeric text at xRight
function drawRightAlignedText(page: any, text: string, xRight: number, y: number, size: number, font: any, color = rgb(0.1,0.1,0.1)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}

// ---------- main ----------
export async function generatePdfBuffer({
  provider,
  profile,
  grade,
  holdings,
  logoUrl,
}: PdfArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]); // US Letter-ish
  let { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // layout constants
  const MARGIN_X = 40;
  const BODY_SIZE = 12;
  const SECTION_SIZE = 14;
  let y = 740;
  let pageIndex = 1;

  // section rule (thin line)
  function sectionRule() {
    page.drawLine({
      start: { x: MARGIN_X, y },
      end:   { x: width - MARGIN_X, y },
      thickness: 0.5,
      color: rgb(0.88,0.88,0.88),
    });
    y -= 12;
  }

  // footer + page number
  function drawFooter() {
    const footer = "Kenai Investments Inc. — www.kenaiinvest.com";
    const w = font.widthOfTextAtSize(footer, 10);
    page.drawText(footer, {
      x: width - MARGIN_X - w,
      y: 30,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
    const label = `Page ${pageIndex}`;
    const pw = font.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: MARGIN_X, y: 30, size: 10, font, color: rgb(0.35,0.35,0.35) });
  }

  // new page helper with running header
  function newPage() {
    drawFooter();            // finalize current page
    pageIndex += 1;
    page = pdf.addPage([612, 792]);
    ({ width, height } = page.getSize());
    y = 740;

    // running header line + label
    page.drawText("GradeYour401k — Report", { x: MARGIN_X, y: 760, size: 10, font, color: rgb(0.35,0.35,0.35) });
    page.drawLine({
      start: { x: MARGIN_X, y: 754 },
      end:   { x: width - MARGIN_X, y: 754 },
      thickness: 0.5,
      color: rgb(0.85,0.85,0.85),
    });
  }

  // LOGO (optional)
  if (logoUrl) {
    const bytes = await loadPngBytes(logoUrl);
    if (bytes) {
      const img = await pdf.embedPng(bytes);
      const LOGO_H = 28;
      const aspect = img.width / img.height;
      const MAX_LOGO_W = 180;
      const wLogo = Math.min(MAX_LOGO_W, LOGO_H * aspect);
      page.drawImage(img, { x: MARGIN_X, y: y - LOGO_H + 6, width: wLogo, height: LOGO_H });
      y -= 32;
    }
  }

  // Header title
  const title = "GradeYour401k — Personalized Report";
  page.drawText(title, { x: MARGIN_X, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

  // Grade badge (right side, with thin border)
  const badgeText = compactGrade(grade);
  const badgeR = 18;
  const badgeCX = width - MARGIN_X - badgeR;
  const badgeCY = y + 4; // vertically aligns with title
  page.drawCircle({
    x: badgeCX, y: badgeCY, size: badgeR,
    color: rgb(0.1, 0.45, 0.85),
    borderColor: rgb(0,0,0),
    borderWidth: 0.2
  });
  const tw = fontBold.widthOfTextAtSize(badgeText, 12);
  page.drawText(badgeText, {
    x: badgeCX - tw / 2,
    y: badgeCY - 4.5,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 28;

  // Summary
  page.drawText(`Provider: ${provider}`, { x: MARGIN_X, y, size: BODY_SIZE, font });
  y -= 18;
  page.drawText(`Profile: ${profile}`, { x: MARGIN_X, y, size: BODY_SIZE, font });
  y -= 18;
  page.drawText(`Preliminary Grade: ${formatGrade(grade)}`, { x: MARGIN_X, y, size: BODY_SIZE, font });
  y -= 20;
  sectionRule();

  // Holdings
  page.drawText("Current Holdings", { x: MARGIN_X, y, size: SECTION_SIZE, font: fontBold });
  y -= 18;

  // header row
  page.drawText("Symbol", { x: MARGIN_X, y, size: BODY_SIZE, font: fontBold, color: rgb(0.35,0.35,0.35) });
  drawRightAlignedText(page, "Weight", width - MARGIN_X, y, BODY_SIZE, fontBold, rgb(0.35,0.35,0.35));
  y -= 16;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end:   { x: width - MARGIN_X, y },
    thickness: 0.5,
    color: rgb(0.88,0.88,0.88),
  });
  y -= 8;

  const ROW_H = 16;
  let rowIndex = 0;

  if (!holdings || holdings.length === 0) {
    page.drawText("No holdings provided.", { x: MARGIN_X, y, size: BODY_SIZE, font });
    y -= 16;
  } else {
    for (const h of holdings) {
      if (y < 60) newPage();

      // zebra stripe
      if (rowIndex % 2 === 0) {
        page.drawRectangle({
          x: MARGIN_X - 2,
          y: y - 2,
          width: width - MARGIN_X * 2 + 4,
          height: ROW_H + 4,
          color: rgb(0.965, 0.965, 0.97),
        });
      }

      page.drawText(String(h.symbol).toUpperCase(), { x: MARGIN_X, y, size: BODY_SIZE, font });
      const weightText = `${(Number(h.weight) || 0).toFixed(1)}%`;
      drawRightAlignedText(page, weightText, width - MARGIN_X, y, BODY_SIZE, font);
      y -= ROW_H;
      rowIndex++;
    }
  }

  y -= 8;
  sectionRule();

  // Recommended (prefilled)
  page.drawText("Recommended", { x: MARGIN_X, y, size: SECTION_SIZE, font: fontBold });
  y -= 18;

  const recos = recommendedByProfile(profile);
  const maxW = width - MARGIN_X * 2;
  // callout box background
  const startY = y;
  const boxTop = startY + 10;
  // Estimate box height = min(200, bullets * lineHeight), we’ll draw bullets then box border behind
  let tempY = y;
  for (const r of recos.slice(0, 3)) {
    const lines = wrapText(r, maxW - 12, font, BODY_SIZE);
    tempY -= lines.length * 16 + 4 + 2; // lines + bullet spacing
  }
  const boxHeight = Math.min(200, startY - tempY + 14);
  // background
  page.drawRectangle({
    x: MARGIN_X, y: boxTop - boxHeight,
    width: width - MARGIN_X * 2,
    height: boxHeight,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.8, 0.88, 1.0),
    borderWidth: 1,
  });

  // bullets in box
  y = boxTop - 18;
  for (const r of recos.slice(0, 3)) {
    if (y < 80) { newPage(); page.drawText("Recommended", { x: MARGIN_X, y, size: SECTION_SIZE, font: fontBold }); y -= 18; }
    page.drawText("•", { x: MARGIN_X + 12, y, size: BODY_SIZE, font });
    const lines = wrapText(r, maxW - 24, font, BODY_SIZE);
    let first = true;
    for (const line of lines) {
      if (!first && y < 80) newPage();
      page.drawText(line, { x: MARGIN_X + 24, y, size: BODY_SIZE, font });
      y -= 16;
      first = false;
    }
    y -= 2;
  }
  y -= 12;
  sectionRule();

  // Market Cycle (Bull/Bear) — micro visual + short copy
  page.drawText("Market Cycle (Bull/Bear)", { x: MARGIN_X, y, size: SECTION_SIZE, font: fontBold });
  y -= 18;

  // simple green/red bars + labels
  page.drawRectangle({ x: MARGIN_X,     y, width: 140, height: 6, color: rgb(0.10, 0.60, 0.25) });
  page.drawText("Bull", { x: MARGIN_X + 148, y: y - 1, size: 10, font, color: rgb(0.10,0.60,0.25) });
  page.drawRectangle({ x: MARGIN_X + 200, y, width: 140, height: 6, color: rgb(0.70, 0.20, 0.20) });
  page.drawText("Bear", { x: MARGIN_X + 348, y: y - 1, size: 10, font, color: rgb(0.70,0.20,0.20) });
  y -= 14;

  const lead = "Use the market cycle lens to guide risk pacing while staying close to your strategic targets. Avoid large, all-or-nothing moves.";
  const bullets = [
    "Bull phase: allow equity to ride within guardrails; harvest gains on excess drift.",
    "Bear phase: defend with quality, cash flow, and investment-grade bonds; rebalance into weakness incrementally.",
    "Across cycles: keep contributions steady; automation beats timing.",
  ];

  const leadLines = wrapText(lead, maxW, font, BODY_SIZE);
  for (const line of leadLines) {
    if (y < 60) newPage();
    page.drawText(line, { x: MARGIN_X, y, size: BODY_SIZE, font, color: rgb(0.12, 0.12, 0.12) });
    y -= 16;
  }
  y -= 6;

  for (const b of bullets) {
    if (y < 60) newPage();
    page.drawText("•", { x: MARGIN_X, y, size: BODY_SIZE, font });
    const lines = wrapText(b, maxW - 12, font, BODY_SIZE);
    let first = true;
    for (const line of lines) {
      if (!first && y < 60) newPage();
      page.drawText(line, { x: MARGIN_X + 12, y, size: BODY_SIZE, font });
      y -= 16;
      first = false;
    }
    y -= 2;
  }

  // finalize last page
  drawFooter();
  return await pdf.save(); // Uint8Array
}
