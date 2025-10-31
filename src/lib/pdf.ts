// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FUND_LABELS } from "@/lib/funds";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null;
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string;
  bullUrl?: string;
  clientName?: string;
  reportDate?: string | Date;
  /** NEW: optional Fear & Greed image (PNG/JPG). If missing/invalid, we draw the bar gauge. */
  fearGreedImageUrl?: string;
};

function formatGrade(g: number | string | null): string {
  if (g == null) return "—";
  const n = Number(g);
  return Number.isFinite(n) ? `${n.toFixed(1)} / 5` : String(g);
}
function titleCase(x: string) { return (x || "").replace(/\b\w/g, c => c.toUpperCase()); }
const descFor = (sym: string) => FUND_LABELS[(sym || "").toUpperCase().trim()];

/** Static model for Fidelity Growth (as requested) */
function staticRecommended(provider: string, profile: string) {
  const prov = (provider || "").toLowerCase();
  const prof = (profile || "").toLowerCase();
  if (prov.includes("fidelity") && prof === "growth") {
    return {
      label: "Static model — Fidelity / Growth",
      rows: [
        { symbol: "FSELX", weight: 30 },
        { symbol: "FDCPX", weight: 30 },
        { symbol: "FSPTX", weight: 30 },
        { symbol: "SPAXX", weight: 10 },
      ],
    };
  }
  return { label: "Model recommendations (static placeholder)", rows: [] as {symbol:string;weight:number}[] };
}

type DrawTableRow = { symbol: string; desc?: string; weight?: string; };
type TableOptions = {
  x: number; yStart: number; width: number; rowH?: number; zebra?: boolean;
  showHeader?: boolean; weightCol?: boolean; font: any; fontBold: any; fontSize?: number;
};

function drawTable(page: any, rows: DrawTableRow[], opts: TableOptions) {
  const { x, yStart, width, rowH = 22, zebra = true, showHeader = true, weightCol = true, font, fontBold, fontSize = 10 } = opts;
  const paddingX = 10, paddingY = 6;
  const descColor = rgb(0.35, 0.35, 0.35), textColor = rgb(0.1, 0.1, 0.1);
  const weightW = weightCol ? 70 : 0, symbolW = 130, descW = width - symbolW - weightW;

  let y = yStart;
  if (showHeader) {
    if (zebra) page.drawRectangle({ x, y: y - rowH + 2, width, height: rowH, color: rgb(0.92, 0.95, 1), opacity: 0.35 });
    page.drawText("Symbol", { x: x + paddingX, y: y - paddingY - fontSize, font: fontBold, size: fontSize, color: textColor });
    page.drawText("Description", { x: x + symbolW + paddingX, y: y - paddingY - fontSize, font: fontBold, size: fontSize, color: textColor });
    if (weightCol) {
      const wLab = "Weight", wWidth = font.widthOfTextAtSize(wLab, fontSize);
      page.drawText(wLab, { x: x + width - paddingX - wWidth, y: y - paddingY - fontSize, font: fontBold, size: fontSize, color: textColor });
    }
    y -= rowH;
  }

  rows.forEach((r, idx) => {
    if (zebra && idx % 2 === 0) {
      page.drawRectangle({ x, y: y - rowH + 2, width, height: rowH, color: rgb(0.93, 0.93, 0.95), opacity: 0.35 });
    }
    page.drawText(r.symbol, { x: x + paddingX, y: y - paddingY - fontSize, font, size: fontSize, color: textColor });

    const maxDescWidth = (width - 130 - (weightCol ? 70 : 0)) - paddingX * 2;
    let desc = r.desc || "";
    while (desc && font.widthOfTextAtSize(desc, fontSize) > maxDescWidth) desc = desc.slice(0, -1);
    if (r.desc && desc.length < (r.desc || "").length) desc = desc.replace(/\s+\S*$/, "") + "…";
    if (desc) page.drawText(desc, { x: x + 130 + paddingX, y: y - paddingY - fontSize, font, size: fontSize, color: descColor });

    if (weightCol && r.weight != null) {
      const txt = r.weight, w = font.widthOfTextAtSize(txt, fontSize);
      page.drawText(txt, { x: x + width - paddingX - w, y: y - paddingY - fontSize, font, size: fontSize, color: textColor });
    }
    y -= rowH;
  });
  return y;
}

export async function generatePdfBuffer(args: PdfArgs): Promise<Uint8Array> {
  const { provider, profile, grade, holdings, logoUrl, bullUrl, clientName, reportDate, fearGreedImageUrl } = args;

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;
  let y = 792 - margin;

  // Logo (bigger)
  if (logoUrl) {
    try {
      const imgBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
      const img = await doc.embedPng(imgBytes);
      const logoW = 170, logoH = logoW * (img.height / img.width);
      page.drawImage(img, { x: margin, y: y - logoH, width: logoW, height: logoH });
    } catch {}
  }
  // Optional bull watermark (bigger)
  if (bullUrl) {
    try {
      const bullBytes = await fetch(bullUrl).then(r => r.arrayBuffer());
      const bullImg = await doc.embedPng(bullBytes);
      const bw = 120, bh = bw * (bullImg.height / bullImg.width);
      page.drawImage(bullImg, { x: 612 - margin - bw, y: y - bh + 6, width: bw, height: bh, opacity: 0.25 });
    } catch {}
  }

  y -= 12;
  page.drawText("GradeYour401k — Personalized Report", { x: margin, y: y - 32, font: fontBold, size: 18, color: rgb(0.1, 0.1, 0.1) });

  const line2 = [`Provider: ${titleCase(provider)}`, `Profile: ${titleCase(profile)}`, `Preliminary Grade: ${formatGrade(grade)}`].join("   •   ");
  page.drawText(line2, { x: margin, y: y - 52, font, size: 11.5, color: rgb(0.2, 0.2, 0.2) });

  if (clientName || reportDate) {
    const meta = [clientName ? `Client: ${clientName}` : null, reportDate ? `Date: ${new Date(reportDate).toLocaleDateString()}` : null].filter(Boolean).join("   •   ");
    page.drawText(meta, { x: margin, y: y - 68, font, size: 10.5, color: rgb(0.35, 0.35, 0.35) });
  }
  y -= 90;

  // Current Holdings
  page.drawText("Current Holdings", { x: margin, y, font: fontBold, size: 13, color: rgb(0.1, 0.1, 0.1) });
  y -= 10;
  const rowsCurrent = (holdings || []).map(h => ({ symbol: (h.symbol || "").toUpperCase(), desc: descFor(h.symbol), weight: `${Number(h.weight || 0).toFixed(1)}%` }));
  y = drawTable(page, rowsCurrent, { x: margin, yStart: y, width: 612 - margin * 2, rowH: 24, zebra: true, showHeader: true, weightCol: true, font, fontBold, fontSize: 10.5 });
  y -= 12;

  // Recommended (static Fidelity Growth)
  const rec = staticRecommended(provider, profile);
  page.drawText("Recommended Holdings", { x: margin, y, font: fontBold, size: 13, color: rgb(0.1, 0.1, 0.1) });
  y -= 14;
  page.drawText(rec.label, { x: margin, y, font, size: 10.5, color: rgb(0.35, 0.35, 0.35) });
  y -= 6;

  if (rec.rows.length) {
    const recRows = rec.rows.map(r => ({ symbol: r.symbol, desc: descFor(r.symbol), weight: `${r.weight.toFixed(1)}%` }));
    y = drawTable(page, recRows, { x: margin, yStart: y, width: 612 - margin * 2, rowH: 24, zebra: true, showHeader: true, weightCol: true, font, fontBold, fontSize: 10.5 });
  } else {
    page.drawText("Model details will appear here.", { x: margin, y: y - 18, font, size: 10.5, color: rgb(0.35, 0.35, 0.35) });
    y -= 30;
  }
  y -= 8;

  // Market Sentiment — try image first
  page.drawText("Market Sentiment", { x: margin, y, font: fontBold, size: 13, color: rgb(0.1, 0.1, 0.1) });
  y -= 18;

  let drewImage = false;
  if (fearGreedImageUrl) {
    try {
      const bytes = await fetch(fearGreedImageUrl).then(r => r.arrayBuffer());
      // Try PNG first, then JPG
      let img: any | null = null;
      try { img = await doc.embedPng(bytes); } catch { img = await doc.embedJpg(bytes); }
      if (img) {
        const maxW = 612 - margin * 2;
        const targetW = Math.min(maxW, 500);
        const targetH = targetW * (img.height / img.width);
        page.drawImage(img, { x: margin, y: y - targetH, width: targetW, height: targetH });
        y -= targetH + 8;
        drewImage = true;
      }
    } catch {
      // ignore, will fall back to bar
    }
  }

  if (!drewImage) {
    // Fallback simple gauge bar
    const fgValue = 63; // static placeholder
    page.drawText(`Fear & Greed Index (static placeholder): ${fgValue} — Greed`, { x: margin, y, font, size: 10.5, color: rgb(0.2, 0.2, 0.2) });
    y -= 10;
    const gaugeW = 612 - margin * 2, gaugeH = 10, gx = margin, gy = y - gaugeH - 4;
    page.drawRectangle({ x: gx, y: gy, width: gaugeW, height: gaugeH, color: rgb(0.92, 0.92, 0.92) });
    const pct = Math.max(0, Math.min(100, fgValue)) / 100;
    page.drawRectangle({ x: gx, y: gy, width: gaugeW * pct, height: gaugeH, color: rgb(0.2, 0.65, 0.3) });
    y = gy - 20;
  }

  // Footer
  const footer = "Kenai Investments Inc. — www.kenaiinvest.com";
  const fw = font.widthOfTextAtSize(footer, 10);
  page.drawText(footer, { x: (612 - fw) / 2, y: 24, font, size: 10, color: rgb(0.35, 0.35, 0.35) });

  return await doc.save();
}
