// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: string;
  holdings: Array<{ symbol: string; weight: number }>;
};

export async function generatePdfBuffer({
  provider,
  profile,
  grade,
  holdings,
}: PdfArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // US Letter-ish
  const { width } = page.getSize();

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 740;

  // Header
  const title = "GradeYour401k — Personalized Report";
  page.drawText(title, { x: 40, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 28;

  // Summary
  page.drawText(`Provider: ${provider}`, { x: 40, y, size: 12, font });
  y -= 18;
  page.drawText(`Profile: ${profile}`, { x: 40, y, size: 12, font });
  y -= 18;
  page.drawText(`Preliminary Grade: ${grade} / 5`, { x: 40, y, size: 12, font });
  y -= 28;

  // Holdings
  page.drawText("Current Holdings", { x: 40, y, size: 14, font: fontBold });
  y -= 20;

  if (!holdings || holdings.length === 0) {
    page.drawText("No holdings provided.", { x: 40, y, size: 12, font });
    y -= 16;
  } else {
    holdings.forEach((h) => {
      const line = `${(Number(h.weight) || 0).toFixed(1).padStart(6)}% ${String(h.symbol).toUpperCase()}`;
      page.drawText(line, { x: 40, y, size: 12, font });
      y -= 16;
      if (y < 60) {
        y = 740;
        pdf.addPage([612, 792]);
      }
    });
  }

  // Footer
  const footer = "Kenai Investments Inc. — www.kenaiinvest.com";
  const footerWidth = font.widthOfTextAtSize(footer, 10);
  page.drawText(footer, {
    x: width - 40 - footerWidth,
    y: 30,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await pdf.save(); // Uint8Array
}
