// src/lib/pdf.ts
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

type Holding = { symbol: string; weight: number };
export type PreviewData = {
  provider: string;
  profile: string;
  rows: Holding[];
  grade_base: number;
  grade_adjusted: number;
  market_regime?: string;
};

function loadFont(relPath: string): Buffer | null {
  try {
    const p = path.join(process.cwd(), relPath);
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

export async function buildReportPDF(data: PreviewData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  // Load fonts from /public (serverless-readable)
  const interRegular = loadFont("public/fonts/Inter-Regular.ttf");
  const interBold = loadFont("public/fonts/Inter-Bold.ttf");

  if (interRegular) doc.registerFont("Inter", interRegular);
  if (interBold) doc.registerFont("Inter-Bold", interBold);

  const H = interBold ? "Inter-Bold" : undefined;
  const T = interRegular ? "Inter" : undefined;

  // Header
  doc.font(H || "Helvetica-Bold").fontSize(18).fillColor("#111").text("GradeYour401k — Personalized 401(k) Report");
  doc.moveDown(0.2);
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(612 - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.6);

  // Snapshot
  doc.font(H || "Helvetica-Bold").fontSize(12).fillColor("#111").text("Account Snapshot", { underline: true });
  doc.moveDown(0.2);
  doc.font(T || "Helvetica").fontSize(10).fillColor("#333")
    .text(`Provider: ${data.provider || "—"}`)
    .text(`Investor Profile: ${data.profile || "—"}`)
    .text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(0.4);

  // Grade
  doc.font(H || "Helvetica-Bold").fontSize(12).fillColor("#111").text("Your Grade", { underline: true });
  doc.moveDown(0.2);
  doc.font(H || "Helvetica-Bold").fontSize(16).fillColor("#111")
    .text(`${(data.grade_adjusted ?? data.grade_base).toFixed?.(1) || data.grade_adjusted || data.grade_base}/5`);
  doc.font(T || "Helvetica").fontSize(10).fillColor("#6b7280")
    .text(`Base model grade: ${data.grade_base?.toFixed?.(1) ?? data.grade_base}/5`);
  doc.moveDown(0.4);

  if (data.market_regime) {
    doc.font(H || "Helvetica-Bold").fontSize(12).fillColor("#111").text("Market Cycle Overlay", { underline: true });
    doc.moveDown(0.2);
    doc.font(T || "Helvetica").fontSize(10).fillColor("#111").text(data.market_regime);
    doc.moveDown(0.4);
  }

  // Holdings
  doc.font(H || "Helvetica-Bold").fontSize(12).fillColor("#111").text("Current Holdings", { underline: true });
  doc.moveDown(0.2);
  const startX = doc.x; const col2 = startX + 320;
  doc.font(T || "Helvetica").fontSize(10).fillColor("#111");
  doc.text("Symbol", startX, doc.y);
  doc.text("Weight %", col2, doc.y);
  doc.moveDown(0.2);
  doc.strokeColor("#d1d5db").moveTo(startX, doc.y).lineTo(startX + 500, doc.y).stroke();

  (data.rows || []).forEach((r) => {
    doc.moveDown(0.12);
    doc.fillColor("#111").text(r.symbol, startX, doc.y);
    doc.text(String(r.weight), col2, doc.y);
  });

  // Guidance blurb
  doc.moveDown(0.8);
  doc.font(H || "Helvetica-Bold").fontSize(12).fillColor("#111").text("Model Comparison & Guidance", { underline: true });
  doc.moveDown(0.2);
  doc.font(T || "Helvetica").fontSize(10).fillColor("#374151").text(
    "Full section includes suggested increases/reductions by ticker, penalties for invalid or mixed tickers, and market-cycle overlays aligned to the model."
  );

  // Disclaimer
  doc.moveDown(0.8);
  doc.font(T || "Helvetica").fontSize(9).fillColor("#6b7280").text(
    "Disclaimer: Educational and model-based. Not individualized investment advice. Review plan rules, prospectuses, and fees before changes."
  );

  doc.end();
  return done;
}
