// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type Holding = { symbol: string; weight: number };
export type PdfArgs = {
  provider: string;
  profile: string;
  /** Pass either letter grade (e.g., "A-") OR numeric "4.2 / 5" — we'll render it nicely */
  grade: string;
  holdings: Holding[];
  /** Optional: external URL or public path (e.g., "/logo.png"). If omitted, no logo is shown. */
  logoUrl?: string;
  /** Optional display name or client label */
  clientName?: string;
  /** Report date; defaults to today (MM/DD/YYYY) */
  reportDate?: string;
};

const COLORS = {
  ink: rgb(0.12, 0.12, 0.12),
  sub: rgb(0.35, 0.35, 0.35),
  line: rgb(0.85, 0.85, 0.85),
  brand: rgb(0.05, 0.35, 0.75), // Kenai/GradeYour401k accent
  badge: rgb(0.05, 0.35, 0.75),
  footer: rgb(0.45, 0.45, 0.45),
};

function todayMMDDYYYY() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
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

export async function generatePdfBuffer({
  provider,
  profile,
  grade,
  holdings,
  logoUrl, // e.g., "https://i.imgur.com/DMCbj99.png"
  clientName,
  reportDate,
}: PdfArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]); // Letter: 8.5 x 11 in @ 72 dpi
  let { width, height } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const logoBytes = await loadLogoBytes(logoUrl);
  const logoImg = logoBytes ? await pdf.embedPng(logoBytes) : null;

  // Layout helpers
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

  // Header block
  const header = () => {
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

    // Grade badge (right side)
    const badgeR = 20;
    const cx = width - MARGIN_X - badgeR;
    const cy = y - 2;
    page.drawCircle({
      x: cx,
      y: cy,
      size: badgeR,
      color: COLORS.badge,
    });
    const gradeText = normalizeGrade(grade);
    const gw = bold.widthOfTextAtSize(gradeText, 14);
    page.drawText(gradeText, {
      x: cx - gw / 2,
      y: cy - 6,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    });

    y -= 46;

    // Meta line
    const meta1 = clientName ? `Client: ${clientName}` : null;
    const meta2 = `Date: ${reportDate || todayMMDDYYYY()}`;
    const meta = [meta1, meta2].filter(Boolean).join("    •    ");
    if (meta) {
      page.drawText(meta, { x: MARGIN_X, y, size: 11, font, color: COLORS.sub });
      y -= 12;
    }

    // Divider
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: width - MARGIN_X, y },
      thickness: 0.8,
      color: COLORS.line,
    });
    y -= 18;
  };

  const normalizeGrade = (g: string) => {
    // Accept "A", "A-", "4.2 / 5", "4/5" — display succinctly
    const trimmed = g.trim();
    const letter = /^[A-D][+-]?$|^F$/.test(trimmed.toUpperCase());
    if (letter) return trimmed.toUpperCase();
    const num = trimmed.match(/(\d+(\.\d+)?)\s*\/\s*5/);
    if (num) return `${num[1]}/5`;
    return trimmed;
  };

  const keyValue = (label: string, value: string) => {
    const labelSize = 12;
    const valueSize = 12;
    const gap = 6;

    page.drawText(label, { x: MARGIN_X, y, size: labelSize, font: bold, color: COLORS.ink });
    const lw = bold.widthOfTextAtSize(label, labelSize);
    page.drawText(value, { x: MARGIN_X + lw + gap, y, size: valueSize, font, color: COLORS.ink });
    y -= 18;
  };

  const holdingsTable = (rows: Holding[]) => {
    sectionTitle("Current Holdings");

    // Column layout
    const colSymbolX = MARGIN_X;
    const colWeightX = width - MARGIN_X - 90;
    const rowH = 18;

    // Header
    const headerY = y;
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
        // re-draw header
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

  // ===== Render =====
  header();

  sectionTitle("Summary");
  keyValue("Provider:", provider);
  keyValue("Profile:", profile);
  keyValue("Preliminary Grade:", normalizeGrade(grade));
  y -= 6;

  holdingsTable(holdings);

  // Footer for last page
  drawFooter(page);

  return await pdf.save();
}
