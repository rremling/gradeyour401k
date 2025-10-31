// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FUND_LABELS } from "@/lib/funds";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null;
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string;          // GradeYour401k logo
  bullUrl?: string;          // Kenai bull logo
  fearGreedImageUrl?: string;// optional image (PNG/JPG)
  clientName?: string;
  reportDate?: string | Date;
};

/* ──────────────── helpers ──────────────── */
function titleCase(s: string) { return (s || "").replace(/\b\w/g, c => c.toUpperCase()); }
function formatGrade(g: number | string | null) {
  if (g == null) return "—";
  const n = Number(g);
  return Number.isFinite(n) ? `${n.toFixed(1)} / 5` : String(g);
}
const descFor = (sym: string) => FUND_LABELS[(sym || "").toUpperCase().trim()];

/* Static Fidelity/Growth model */
function staticRecommended(provider: string, profile: string) {
  const p = provider.toLowerCase(), r = profile.toLowerCase();
  if (p.includes("fidelity") && r === "growth") {
    return [
      { symbol: "FSELX", weight: 30 },
      { symbol: "FDCPX", weight: 30 },
      { symbol: "FSPTX", weight: 30 },
      { symbol: "SPAXX", weight: 10 },
    ];
  }
  return [];
}

/* Draw holdings table */
function drawTable(page: any, rows: any[], y: number, font: any, fontBold: any) {
  const x = 50, width = 512, rowH = 24;
  const colSymbol = 120, colWeight = 70, pad = 10;
  const fontSize = 10.5;

  // Header
  page.drawRectangle({ x, y: y - rowH + 2, width, height: rowH, color: rgb(0.9,0.93,1), opacity: 0.35 });
  page.drawText("Symbol", { x: x + pad, y: y - 8 - fontSize, font: fontBold, size: fontSize });
  page.drawText("Description", { x: x + colSymbol + pad, y: y - 8 - fontSize, font: fontBold, size: fontSize });
  page.drawText("Weight", { x: x + width - pad - 40, y: y - 8 - fontSize, font: fontBold, size: fontSize });
  y -= rowH;

  // Body
  rows.forEach((r, i) => {
    if (i % 2 === 0)
      page.drawRectangle({ x, y: y - rowH + 2, width, height: rowH, color: rgb(0.94,0.94,0.96), opacity: 0.25 });
    const desc = descFor(r.symbol) || "";
    page.drawText(r.symbol, { x: x + pad, y: y - 8 - fontSize, font, size: fontSize });
    page.drawText(desc.length > 70 ? desc.slice(0,67)+"…" : desc,
      { x: x + colSymbol + pad, y: y - 8 - fontSize, font, size: fontSize, color: rgb(0.35,0.35,0.35) });
    const w = `${r.weight.toFixed(1)}%`;
    const tw = font.widthOfTextAtSize(w, fontSize);
    page.drawText(w, { x: x + width - pad - tw, y: y - 8 - fontSize, font, size: fontSize });
    y -= rowH;
  });
  return y;
}

/* ──────────────── main generator ──────────────── */
export async function generatePdfBuffer(args: PdfArgs): Promise<Uint8Array> {
  const { provider, profile, grade, holdings, logoUrl, bullUrl, fearGreedImageUrl, clientName, reportDate } = args;

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 44;
  let y = 792 - margin;

  /* HEADER AREA */
  // Left logo (GradeYour401k)
  if (logoUrl) {
    try {
      const img = await doc.embedPng(await fetch(logoUrl).then(r=>r.arrayBuffer()));
      const w = 160, h = w * (img.height/img.width);
      page.drawImage(img, { x: margin, y: y - h + 10, width: w, height: h });
    } catch {}
  }
  // Right bull (Kenai)
  if (bullUrl) {
    try {
      const img = await doc.embedPng(await fetch(bullUrl).then(r=>r.arrayBuffer()));
      const w = 110, h = w * (img.height/img.width);
      page.drawImage(img, { x: 612 - margin - w, y: y - h + 25, width: w, height: h, opacity: 0.25 });
    } catch {}
  }

  y -= 100; // create more breathing room

  page.drawText("GradeYour401k — Personalized Report",
    { x: margin, y: y, font: fontBold, size: 18, color: rgb(0.1,0.1,0.1) });
  y -= 26;
  const meta = [
    `Provider: ${titleCase(provider)}`,
    `Profile: ${titleCase(profile)}`,
    `Grade: ${formatGrade(grade)}`
  ].join("   •   ");
  page.drawText(meta, { x: margin, y, font, size: 11.5, color: rgb(0.25,0.25,0.25) });
  y -= 16;
  const meta2 = [
    clientName ? `Client: ${clientName}` : "",
    reportDate ? `Date: ${new Date(reportDate).toLocaleDateString()}` : ""
  ].filter(Boolean).join("   •   ");
  if (meta2) page.drawText(meta2, { x: margin, y, font, size: 10.5, color: rgb(0.4,0.4,0.4) });

  y -= 36;

  /* SECTION 1 — Current Holdings */
  page.drawText("CURRENT HOLDINGS", { x: margin, y, font: fontBold, size: 13 });
  y -= 8;
  y = drawTable(page, holdings || [], y, font, fontBold);
  y -= 28; // extra gap

  /* SECTION 2 — Recommended Holdings */
  page.drawText("RECOMMENDED HOLDINGS (Static: Fidelity / Growth)",
    { x: margin, y, font: fontBold, size: 13 });
  y -= 8;
  const rec = staticRecommended(provider, profile);
  y = rec.length ? drawTable(page, rec, y, font, fontBold)
                 : (page.drawText("Model recommendations will appear here.", {x:margin, y:y-14, font, size:10.5}), y-24);
  y -= 36;

  /* SECTION 3 — Market Sentiment */
  page.drawText("MARKET SENTIMENT", { x: margin, y, font: fontBold, size: 13 });
  y -= 18;

  let drew = false;
  if (fearGreedImageUrl) {
    try {
      const bytes = await fetch(fearGreedImageUrl).then(r=>r.arrayBuffer());
      let img:any=null;
      try { img = await doc.embedPng(bytes); } catch { img = await doc.embedJpg(bytes); }
      if (img) {
        const maxW = 400, w = Math.min(maxW, img.width);
        const h = w * (img.height / img.width);
        const cx = (612 - w)/2;
        page.drawImage(img, { x: cx, y: y - h, width: w, height: h });
        y -= h + 8;
        drew = true;
      }
    } catch {}
  }
  if (!drew) {
    const fgVal = 63;
    page.drawText(`Fear & Greed Index: ${fgVal} — Greed`,
      { x: margin, y, font, size: 10.5, color: rgb(0.2,0.2,0.2) });
    y -= 14;
    const gx = margin, gw = 512, gh = 10;
    page.drawRectangle({ x: gx, y: y-gh, width: gw, height: gh, color: rgb(0.9,0.9,0.9) });
    page.drawRectangle({ x: gx, y: y-gh, width: gw*(fgVal/100), height: gh, color: rgb(0.2,0.65,0.3) });
    y -= 30;
  }

  /* FINAL NOTE */
  page.drawText("Next Steps", { x: margin, y, font: fontBold, size: 13 });
  y -= 14;
  const note =
    "Log in to your GradeYour401k account to update your information, view past reports, or schedule a 401(k) Review with Kenai Investments.";
  const lines = note.match(/.{1,95}(\s|$)/g) || [note];
  lines.forEach(line => {
    page.drawText(line.trim(), { x: margin, y, font, size: 10.5, color: rgb(0.25,0.25,0.25) });
    y -= 14;
  });

  /* FOOTER */
  page.drawLine({ start: {x: margin, y: 40}, end: {x: 612 - margin, y: 40}, color: rgb(0.8,0.8,0.8), thickness: 0.5 });
  const footer = "Kenai Investments Inc.  •  www.kenaiinvest.com  •  (806) 359-3100";
  const w = font.widthOfTextAtSize(footer, 10);
  page.drawText(footer, { x: (612 - w)/2, y: 26, font, size: 10, color: rgb(0.35,0.35,0.35) });

  return await doc.save();
}
