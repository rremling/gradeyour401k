// src/lib/pdf.ts
import PDFDocument from "pdfkit";

type Holding = { symbol: string; weight: number };
export type PreviewData = {
  provider: string;
  profile: string;
  rows: Holding[];
  grade_base: number;
  grade_adjusted: number;
  market_regime?: string;
};

// Optional inline logo (black text wordmark fallback). Replace with your image if you have one.
const LOGO_TEXT = "GradeYour401k";

function drawHeader(doc: PDFKit.PDFDocument) {
  doc.fontSize(18).fillColor("#111").text(LOGO_TEXT, { continued: false });
  doc.moveDown(0.2);
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(612 - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.6);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.6);
  doc.fontSize(12).fillColor("#111").text(title, { underline: true });
  doc.moveDown(0.2);
}

function drawKeyValue(doc: PDFKit.PDFDocument, left: string, right: string) {
  const x = doc.x;
  const y = doc.y;
  doc.fontSize(10).fillColor("#333").text(left, x, y, { width: 200 });
  doc.font("Helvetica-Bold").fillColor("#111").text(right, x + 210, y);
  doc.font("Helvetica");
  doc.moveDown(0.2);
}

function drawHoldingsTable(doc: PDFKit.PDFDocument, rows: Holding[]) {
  const startX = doc.x;
  const col2 = startX + 320;
  doc.fontSize(10).fillColor("#111");
  doc.text("Symbol", startX, doc.y);
  doc.text("Weight %", col2, doc.y);
  doc.moveDown(0.2);
  doc.strokeColor("#d1d5db").moveTo(startX, doc.y).lineTo(startX + 500, doc.y).stroke();
  doc.moveDown(0.15);

  rows.forEach((r) => {
    doc.fillColor("#111").text(r.symbol, startX, doc.y);
    doc.text(String(r.weight), col2, doc.y);
    doc.moveDown(0.1);
  });
}

function drawBarChart(doc: PDFKit.PDFDocument, rows: Holding[]) {
  // Simple horizontal bar chart of current weights
  const data = rows.slice(0, 10); // cap to 10 bars
  if (!data.length) return;

  const chartX = doc.x;
  const chartY = doc.y + 6;
  const w = 500;
  const h = 160;
  const maxW = Math.max(...data.map((d) => d.weight), 100);

  // frame
  doc.strokeColor("#d1d5db").rect(chartX, chartY, w, h).stroke();

  const barH = Math.floor((h - 20) / data.length);
  data.forEach((d, i) => {
    const y = chartY + 10 + i * barH;
    const label = `${d.symbol} (${d.weight}%)`;
    const width = Math.max(0, (d.weight / maxW) * (w - 150));
    doc.fontSize(9).fillColor("#333").text(label, chartX + 6, y, { width: 140, ellipsis: true });
    doc.fillColor("#2563eb").rect(chartX + 150, y + 3, width, Math.max(10, barH - 6)).fill();
  });

  doc.moveDown( h / 13 ); // space after chart
}

export async function buildReportPDF(data: PreviewData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawHeader(doc);

  drawSectionTitle(doc, "Account Snapshot");
  drawKeyValue(doc, "Provider", data.provider || "—");
  drawKeyValue(doc, "Investor Profile", data.profile || "—");
  drawKeyValue(doc, "Generated", new Date().toLocaleString());

  drawSectionTitle(doc, "Your Grade");
  doc.fontSize(16).fillColor("#111").text(`${(data.grade_adjusted ?? data.grade_base).toFixed?.(1) || data.grade_adjusted || data.grade_base}/5`);
  doc.moveDown(0.2);
  doc.fontSize(10).fillColor("#6b7280").text(`Base model grade: ${data.grade_base?.toFixed?.(1) ?? data.grade_base}/5`);

  if (data.market_regime) {
    drawSectionTitle(doc, "Market Cycle Overlay");
    doc.fontSize(10).fillColor("#111").text(data.market_regime);
  }

  drawSectionTitle(doc, "Current Holdings");
  drawHoldingsTable(doc, data.rows || []);

  if (data.rows?.length) {
    drawSectionTitle(doc, "Allocation Chart");
    drawBarChart(doc, data.rows);
  }

  drawSectionTitle(doc, "Model Comparison & Guidance");
  doc.fontSize(10).fillColor("#374151").text(
    "In this section, we compare your current weights to model targets and highlight suggested increases and reductions. " +
      "Penalties for invalid or mixed-provider tickers and the impact of current market cycle are reflected here."
  );

  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#6b7280").text(
    "Disclaimer: This analysis is educational and model-based. It is not individualized investment advice. " +
      "Always review plan rules, fund prospectuses, and fees before making changes."
  );

  doc.end();
  return done;
}
