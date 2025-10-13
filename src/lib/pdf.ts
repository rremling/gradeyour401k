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
    page =
