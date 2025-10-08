// src/lib/pdf.ts (pdf-lib version: no external fonts needed)
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Holding = { symbol: string; weight: number };
export type PreviewData = {
  provider: string;
  profile: string;
  rows: Holding[];
  grade_base: number;
  grade_adjusted: number;
  market_regime?: string;
};

function drawTextBlock(page: any, text: string, x: number, y: number, opts: { size?: number; color?: any; font?: any } = {}) {
  page.drawText(text, {
    x,
    y,
    size: opts.size ?? 10,
    color: opts.color ?? rgb(0.1, 0.1, 0.1),
    font: opts.font,
  });
}

export async function buildReportPDF(data: PreviewData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 64;
  // Header
  drawTextBlock(page, "GradeYour401k — Personalized 401(k) Report", 48, y, { size: 18, font: fontBold });
  y -= 18 + 8;

  // Divider
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, color: rgb(0.9, 0.9, 0.9) });
  y -= 20;

  // Account Snapshot
  drawTextBlock(page, "Account Snapshot", 48, y, { size: 12, font: fontBold });
  y -= 16;
  drawTextBlock(page, `Provider: ${data.provider || "—"}`, 48, y, { font });
  y -= 14;
  drawTextBlock(page, `Investor Profile: ${data.profile || "—"}`, 48, y, { font });
  y -= 14;
  drawTextBlock(page, `Generated: ${new Date().toLocaleString()}`, 48, y, { font });
  y -= 22;

  // Grade
  drawTextBlock(page, "Your Grade", 48, y, { size: 12, font: fontBold });
  y -= 18;
  const gradeText = `${((data.grade_adjusted ?? data.grade_base) as number).toFixed?.(1) || data.grade_adjusted || data.grade_base}/5`;
  drawTextBlock(page, gradeText, 48, y, { size: 16, font: fontBold });
  y -= 16 + 6;
  drawTextBlock(page, `Base model grade: ${data.grade_base?.toFixed?.(1) ?? data.grade_base}/5`, 48, y, { font, size: 10, color: rgb(0.42, 0.45, 0.5) });
  y -= 22;

  // Market regime (optional)
  if (data.market_regime) {
    drawTextBlock(page, "Market Cycle Overlay", 48, y, { size: 12, font: fontBold });
    y -= 16;
    drawTextBlock(page, data.market_regime, 48, y, { font });
    y -= 22;
  }

  // Holdings
  drawTextBlock(page, "Current Holdings", 48, y, { size: 12, font: fontBold });
  y -= 16;

  // Table headers
  drawTextBlock(page, "Symbol", 48, y, { fontBold });
  drawTextBlock(page, "Weight %", 360, y, { fontBold });
  y -= 12;
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, color: rgb(0.82, 0.85, 0.86) });
  y -= 10;

  (data.rows || []).forEach((r) => {
    drawTextBlock(page, String(r.symbol || "—"), 48, y, { font });
    drawTextBlock(page, String(r.weight ?? "—"), 360, y, { font });
    y -= 14;
    if (y < 80) {
      // new page if needed
      y = height - 64;
      const p2 = pdfDoc.addPage([612, 792]);
      p2.drawText("Current Holdings (cont.)", { x: 48, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 24;
    }
  });

  y -= 18;
  drawTextBlock(page, "Model Comparison & Guidance", 48, Math.max(y, 80), { size: 12, font: fontBold });
  y -= 16;
  drawTextBlock(
    page,
    "Full section includes suggested increases/reductions by ticker, penalties for invalid/mixed tickers, and market-cycle overlays aligned to the model.",
    48,
    Math.max(y, 64),
    { font, size: 10, color: rgb(0.22, 0.25, 0.28) }
  );

  // Footer disclaimer
  drawTextBlock(
    page,
    "Disclaimer: Educational and model-based. Not individualized investment advice. Review plan rules, prospectuses, and fees before changes.",
    48,
    48,
    { font, size: 9, color: rgb(0.42, 0.45, 0.5) }
  );

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
