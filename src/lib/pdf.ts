// src/lib/pdf.ts
import PDFDocument from "pdfkit";

type Holding = { symbol: string; weight: number };
export type PreviewData = {
  provider: string;
  profile: string;
  rows: Holding[];
  grade_base: number;
  grade_adjusted: number;
  market_regime?: string; // optional e.g., "Bull (SPY>200SMA)"
};

export async function buildReportPDF(data: PreviewData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Header
  doc
    .fontSize(18)
    .text("GradeYour401k — Personalized 401(k) Report", { align: "left" })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#555")
    .text(`Provider: ${data.provider || "—"}   Profile: ${data.profile || "—"}`)
    .text(`Generated: ${new Date().toLocaleString()}`)
    .moveDown();

  // Grade block
  doc
    .fillColor("#000")
    .fontSize(14)
    .text(`Your Grade: ${data.grade_adjusted?.toFixed?.(1) ?? data.grade_adjusted}/5`, { continued: true })
    .fontSize(10)
    .fillColor("#555")
    .text(`   (Base: ${data.grade_base?.toFixed?.(1) ?? data.grade_base}/5)`)
    .moveDown(0.5);

  if (data.market_regime) {
    doc.fontSize(10).fillColor("#333").text(`Market Cycle: ${data.market_regime}`).moveDown(0.5);
  }

  // Holdings table
  doc.fontSize(12).fillColor("#000").text("Your Current Holdings:", { underline: true }).moveDown(0.5);
  doc.fontSize(10).fillColor("#000");
  const startX = doc.x, col2 = startX + 300;
  doc.text("Symbol", startX, doc.y);
  doc.text("Weight %", col2, doc.y);
  doc.moveDown(0.2);
  doc.strokeColor("#999").moveTo(startX, doc.y).lineTo(startX + 500, doc.y).stroke().moveDown(0.4);

  (data.rows || []).forEach((r) => {
    doc.fillColor("#111").text(r.symbol, startX, doc.y);
    doc.text(String(r.weight), col2, doc.y);
    doc.moveDown(0.15);
  });

  // Insights placeholders (gated content)
  doc.moveDown();
  doc.fontSize(12).fillColor("#000").text("Model Comparison & Reallocation Guidance", { underline: true });
  doc.fontSize(10).fillColor("#444").moveDown(0.5).text(
    "This section provides suggested increases / reductions by ticker, " +
      "penalties for invalid/mixed tickers, and model alignment adjustments. " +
      "You’re seeing this because you purchased the full report."
  );

  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#666").text(
    "Disclaimer: This analysis is educational and model-based. It is not individualized investment advice. " +
      "Review your plan rules and fees before implementing any changes."
  );

  doc.end();
  return done;
}
