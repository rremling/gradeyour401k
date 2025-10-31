// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FUND_LABELS } from "@/lib/funds";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null;
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string;           // GradeYour401k logo (PNG recommended)
  bullUrl?: string;           // Kenai bull logo (PNG recommended)
  fearGreedImageUrl?: string; // optional PNG/JPG for dial
  reportDate?: string | Date;
};

/* ───────── helpers ───────── */
function titleCase(s: string) {
  return (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
}
function toGradeText(g: number | string | null) {
  if (g == null) return "-";
  const n = Number(g);
  return Number.isFinite(n) ? `${n.toFixed(1)} / 5` : String(g);
}
const descFor = (sym: string) => FUND_LABELS[(sym || "").toUpperCase().trim()];

/* Static: Fidelity / Growth */
function staticRecommended(provider: string, profile: string) {
  const p = (provider || "").toLowerCase();
  const r = (profile || "").toLowerCase();
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

/* Table drawer (lighter zebra, non-overlapping) */
function drawTable(
  page: any,
  rows: Array<{ symbol: string; weight: number }>,
  y: number,
  font: any,
  fontBold: any
) {
  const x = 50;
  const width = 512;
  const rowH = 24;
  const colSymbol = 120;
  const colWeight = 70;
  const pad = 10;
  const fontSize = 10.5;

  // Header
  page.drawRectangle({
    x,
    y: y - rowH + 2,
    width,
    height: rowH,
    color: rgb(0.9, 0.93, 1),
    opacity: 0.35,
  });
  page.drawText("Symbol", {
    x: x + pad,
    y: y - 8 - fontSize,
    font: fontBold,
    size: fontSize,
  });
  page.drawText("Description", {
    x: x + colSymbol + pad,
    y: y - 8 - fontSize,
    font: fontBold,
    size: fontSize,
  });
  page.drawText("Weight", {
    x: x + width - pad - 40,
    y: y - 8 - fontSize,
    font: fontBold,
    size: fontSize,
  });
  y -= rowH;

  // Body
  rows.forEach((r, i) => {
    if (i % 2 === 0) {
      page.drawRectangle({
        x,
        y: y - rowH + 2,
        width,
        height: rowH,
        color: rgb(0.94, 0.94, 0.96),
        opacity: 0.25,
      });
    }
    const desc = descFor(r.symbol) || "";
    page.drawText((r.symbol || "").toUpperCase(), {
      x: x + pad,
      y: y - 8 - fontSize,
      font,
      size: fontSize,
    });

    // Truncate desc to fit in remaining width (ASCII ellipsis)
    const maxDescWidth = width - colSymbol - colWeight - pad * 2;
    let d = desc;
    while (d && font.widthOfTextAtSize(d, fontSize) > maxDescWidth) {
      d = d.slice(0, -1);
    }
    if (d && d.length < desc.length) d = d.replace(/\s+\S*$/, "") + "...";
    if (d) {
      page.drawText(d, {
        x: x + colSymbol + pad,
        y: y - 8 - fontSize,
        font,
        size: fontSize,
        color: rgb(0.35, 0.35, 0.35),
      });
    }

    const wTxt = `${Number(r.weight || 0).toFixed(1)}%`;
    const wWidth = font.widthOfTextAtSize(wTxt, fontSize);
    page.drawText(wTxt, {
      x: x + width - pad - wWidth,
      y: y - 8 - fontSize,
      font,
      size: fontSize,
    });

    y -= rowH;
  });
  return y;
}

/* Vector star (no Unicode glyph needed) */
function drawStar(page: any, x: number, y: number, size: number, color = rgb(1, 0.75, 0)) {
  const path =
    "M0,-50 L14,-15 L47,-15 L19,7 L29,40 L0,22 L-29,40 L-19,7 L-47,-15 L-14,-15 Z";
  const scale = size / 50;
  page.drawSvgPath(path, { x, y, scale, color });
}

export async function generatePdfBuffer(args: PdfArgs): Promise<Uint8Array> {
  const {
    provider,
    profile,
    grade,
    holdings,
    logoUrl,
    bullUrl,
    fearGreedImageUrl,
    reportDate,
  } = args;

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 44;
  let y = 792 - margin;

  /* ───────── Header logos (spaced and non-overlapping) ───────── */
  if (logoUrl) {
    try {
      const buf = await fetch(logoUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 160;
      const h = w * (img.height / img.width);
      page.drawImage(img, { x: margin, y: y - h + 10, width: w, height: h });
    } catch {}
  }
  if (bullUrl) {
    try {
      const buf = await fetch(bullUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 110;
      const h = w * (img.height / img.width);
      page.drawImage(img, {
        x: 612 - margin - w,
        y: y - h + 25,
        width: w,
        height: h,
        opacity: 0.25,
      });
    } catch {}
  }

  y -= 100; // breathing room under logos

  // Title (ASCII hyphen)
  page.drawText("GradeYour401k - Personalized Report", {
    x: margin,
    y,
    font: fontBold,
    size: 18,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 26;

  // Meta line (left): Provider + Profile
  const metaLeft = `Provider: ${titleCase(provider)}   -   Profile: ${titleCase(profile)}`;
  page.drawText(metaLeft, {
    x: margin,
    y,
    font,
    size: 11.5,
    color: rgb(0.25, 0.25, 0.25),
  });

  // Grade (right) with vector star
  const gradeTxt = `Grade: ${toGradeText(grade)}`;
  const gradeSize = 11.5;
  const gradeWidth = font.widthOfTextAtSize(gradeTxt, gradeSize) + 8 + 14; // 14px star approx
  const gx = 612 - margin - gradeWidth;

  const starOuterRadiusPx = 7;
  drawStar(page, gx + starOuterRadiusPx, y + 2, starOuterRadiusPx);

  page.drawText(gradeTxt, {
    x: gx + 8 + starOuterRadiusPx * 2,
    y,
    font,
    size: gradeSize,
    color: rgb(0.2, 0.2, 0.2),
  });

  y -= 16;

  // Optional date only
  if (reportDate) {
    page.drawText(`Date: ${new Date(reportDate).toLocaleDateString()}`, {
      x: margin,
      y,
      font,
      size: 10.5,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  y -= 36;

  /* ───────── Section: Current Holdings ───────── */
  page.drawText("CURRENT HOLDINGS", {
    x: margin,
    y,
    font: fontBold,
    size: 13,
  });
  y -= 8;
  y = drawTable(page, holdings || [], y, font, fontBold);
  y -= 28;

  /* ───────── Section: Recommended (boxed) ───────── */
  page.drawText("RECOMMENDED HOLDINGS (Static: Fidelity / Growth)", {
    x: margin,
    y,
    font: fontBold,
    size: 13,
  });
  y -= 8;

  const boxX = 44;
  const boxW = 612 - boxX * 2;
  const boxTop = y + 6;

  const recRows = staticRecommended(provider, profile);
  if (recRows.length) {
    y = drawTable(page, recRows, y, font, fontBold);
  } else {
    page.drawText("Model recommendations will appear here.", {
      x: margin,
      y: y - 14,
      font,
      size: 10.5,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 30;
  }

  const boxBottom = y - 6;
  page.drawRectangle({
    x: boxX,
    y: boxBottom,
    width: boxW,
    height: boxTop - boxBottom,
    borderColor: rgb(0.75, 0.82, 0.95),
    borderWidth: 1.25,
    color: undefined,
  });

  y -= 36;

  /* ───────── Section: Market Sentiment + Commentary ───────── */
  page.drawText("MARKET SENTIMENT", {
    x: margin,
    y,
    font: fontBold,
    size: 13,
  });
  y -= 18;

  let drewDial = false;
  if (fearGreedImageUrl) {
    try {
      const bytes = await fetch(fearGreedImageUrl).then((r) => r.arrayBuffer());
      let img: any = null;
      try {
        img = await doc.embedPng(bytes);
      } catch {
        img = await doc.embedJpg(bytes);
      }
      if (img) {
        const maxW = 400;
        const w = Math.min(maxW, img.width);
        const h = w * (img.height / img.width);
        const cx = (612 - w) / 2;
        page.drawImage(img, { x: cx, y: y - h, width: w, height: h });
        y -= h + 8;
        drewDial = true;
      }
    } catch {}
  }

  if (!drewDial) {
    const fgVal = 63;
    page.drawText(`Fear & Greed Index: ${fgVal} - Greed`, {
      x: margin,
      y,
      font,
      size: 10.5,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 14;
    const gx2 = margin;
    const gw = 512;
    const gh = 10;
    page.drawRectangle({
      x: gx2,
      y: y - gh,
      width: gw,
      height: gh,
      color: rgb(0.9, 0.9, 0.9),
    });
    page.drawRectangle({
      x: gx2,
      y: y - gh,
      width: gw * (fgVal / 100),
      height: gh,
      color: rgb(0.2, 0.65, 0.3),
    });
    y -= 18;
  }

  const commentary =
    "Commentary: Sentiment is tilting toward Greed, which often coincides with stronger momentum. " +
    "Maintain core diversification and avoid concentrated bets; rebalancing into targeted sector exposure " +
    "should be paced and rules-based. Long-term investors should emphasize quality, cash-flow resilience, " +
    "and keep adequate short-term reserves to avoid forced selling in pullbacks.";
  const wrap = (t: string, max = 95) => t.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) || [t];
  wrap(commentary).forEach((line) => {
    page.drawText(line.trim(), {
      x: margin,
      y,
      font,
      size: 10.5,
      color: rgb(0.25, 0.25, 0.25),
    });
    y -= 14;
  });

  y -= 18;

  /* ───────── Section: Next Steps ───────── */
  page.drawText("NEXT STEPS", { x: margin, y, font: fontBold, size: 13 });
  y -= 16;

  const steps = [
    "1) Log in to your 401(k) plan and make the recommended holding adjustments listed above.",
    "2) If your plan doesn't offer a specific symbol, replace it with a like-kind fund in the same asset class and mandate (e.g., large-cap growth ETF <-> large-cap growth index fund).",
    "3) Log in to gradeyour401k.com to update your information, view past reports, or schedule a 401(k) Review with Kenai Investments.",
  ];
  steps.forEach((s) => {
    wrap(s, 98).forEach((line) => {
      page.drawText(line.trim(), {
        x: margin,
        y,
        font,
        size: 10.5,
        color: rgb(0.25, 0.25, 0.25),
      });
      y -= 14;
    });
    y -= 4;
  });

  /* ───────── Footer ───────── */
  page.drawLine({
    start: { x: margin, y: 40 },
    end: { x: 612 - margin, y: 40 },
    color: rgb(0.8, 0.8, 0.8),
    thickness: 0.5,
  });
  const footer = "Kenai Investments Inc.  -  www.kenaiinvest.com  -  (806) 359-3100";
  const fw = font.widthOfTextAtSize(footer, 10);
  page.drawText(footer, {
    x: (612 - fw) / 2,
    y: 26,
    font,
    size: 10,
    color: rgb(0.35, 0.35, 0.35),
  });

  return await doc.save();
}
