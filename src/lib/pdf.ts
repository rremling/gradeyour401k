// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FUND_LABELS } from "@/lib/funds";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null;
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string; // GradeYour401k logo (PNG recommended)
  bullUrl?: string; // Kenai bull logo (PNG recommended)
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

/* Page metrics */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 44;
const TOP_Y = PAGE_H - MARGIN;
const BOTTOM_Y = 48; // leave room for footer on each page

type PageCtx = {
  page: any;
  y: number;
};

/* Add a new page and reset y */
function addPage(doc: PDFDocument): PageCtx {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  return { page, y: TOP_Y };
}

/* Ensure there is at least `need` points of vertical room; if not, add page */
function ensureRoom(doc: PDFDocument, ctx: PageCtx, need: number): PageCtx {
  if (ctx.y - need <= BOTTOM_Y) {
    return addPage(doc);
  }
  return ctx;
}

/* Draw footer on every page after content is finished */
function drawFooterOnEveryPage(doc: PDFDocument, font: any) {
  const footer = "Kenai Investments Inc. - www.kenaiinvest.com - (806) 359-3100";
  for (const p of doc.getPages()) {
    p.drawLine({
      start: { x: MARGIN, y: 40 },
      end: { x: PAGE_W - MARGIN, y: 40 },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 0.5,
    });
    const w = font.widthOfTextAtSize(footer, 10);
    p.drawText(footer, {
      x: (PAGE_W - w) / 2,
      y: 26,
      font,
      size: 10,
      color: rgb(0.35, 0.35, 0.35),
    });
  }
}

/* Vector star (no Unicode glyph needed) */
function drawStar(page: any, x: number, y: number, size: number, color = rgb(1, 0.75, 0)) {
  const path =
    "M0,-50 L14,-15 L47,-15 L19,7 L29,40 L0,22 L-29,40 L-19,7 L-47,-15 L-14,-15 Z";
  const scale = size / 50;
  page.drawSvgPath(path, { x, y, scale, color });
}

/* Paragraph wrapper that also page-breaks */
function drawWrappedParagraph(opts: {
  doc: PDFDocument;
  ctx: PageCtx;
  text: string;
  font: any;
  size: number;
  color?: { r: number; g: number; b: number };
  maxCharsPerLine?: number; // crude but consistent with prior code
  lineGap?: number;
}) : PageCtx {
  const { doc, font, size } = opts;
  const color = opts.color || rgb(0.25, 0.25, 0.25);
  const gap = opts.lineGap ?? 14;
  const lines = (opts.text.match(new RegExp(`.{1,${opts.maxCharsPerLine ?? 95}}(\\s|$)`, "g")) || [opts.text])
    .map(s => s.trim());

  let ctx = opts.ctx;
  for (const line of lines) {
    ctx = ensureRoom(doc, ctx, gap + 2);
    ctx.page.drawText(line, {
      x: MARGIN,
      y: ctx.y,
      font,
      size,
      color,
    });
    ctx.y -= gap;
  }
  return ctx;
}

/* Table header + rows with automatic page breaking */
function drawTablePaginated(opts: {
  doc: PDFDocument;
  ctx: PageCtx;
  title?: string;
  rows: Array<{ symbol: string; weight: number }>;
  font: any;
  fontBold: any;
  headerLabel?: string; // e.g., "CURRENT HOLDINGS"
  showDescription?: boolean;
}) : PageCtx {
  const { doc, font, fontBold } = opts;
  let ctx = opts.ctx;

  const x = 50;
  const width = 512;
  const rowH = 24;
  const colSymbol = 120;
  const colWeight = 70;
  const pad = 10;
  const fontSize = 10.5;

  // Section title
  if (opts.headerLabel) {
    ctx = ensureRoom(doc, ctx, 18 + 8);
    ctx.page.drawText(opts.headerLabel, { x: MARGIN, y: ctx.y, font: fontBold, size: 13 });
    ctx.y -= 8;
  }

  // Draw header (with page-break protection)
  function drawHeader() {
    ctx.page.drawRectangle({
      x,
      y: ctx.y - rowH + 2,
      width,
      height: rowH,
      color: rgb(0.9, 0.93, 1),
      opacity: 0.35,
    });
    ctx.page.drawText("Symbol", {
      x: x + pad,
      y: ctx.y - 8 - fontSize,
      font: fontBold,
      size: fontSize,
    });
    if (opts.showDescription !== false) {
      ctx.page.drawText("Description", {
        x: x + colSymbol + pad,
        y: ctx.y - 8 - fontSize,
        font: fontBold,
        size: fontSize,
      });
    }
    ctx.page.drawText("Weight", {
      x: x + width - pad - 40,
      y: ctx.y - 8 - fontSize,
      font: fontBold,
      size: fontSize,
    });
    ctx.y -= rowH;
  }

  // Make sure we have room for header + at least one row; else, new page
  ctx = ensureRoom(doc, ctx, rowH * 2);
  drawHeader();

  const maxDescWidth = opts.showDescription === false
    ? 0
    : width - colSymbol - colWeight - pad * 2;

  opts.rows.forEach((r, i) => {
    // Break if next row would collide with footer
    ctx = ensureRoom(doc, ctx, rowH);
    // If we just added a page, redraw the header on the new page
    if (ctx.y > TOP_Y - 2 - rowH) {
      drawHeader();
    }

    if (i % 2 === 0) {
      ctx.page.drawRectangle({
        x,
        y: ctx.y - rowH + 2,
        width,
        height: rowH,
        color: rgb(0.94, 0.94, 0.96),
        opacity: 0.25,
      });
    }

    const desc = descFor(r.symbol) || "";
    ctx.page.drawText((r.symbol || "").toUpperCase(), {
      x: x + pad,
      y: ctx.y - 8 - fontSize,
      font,
      size: fontSize,
    });

    if (opts.showDescription !== false) {
      let d = desc;
      while (d && font.widthOfTextAtSize(d, fontSize) > maxDescWidth) {
        d = d.slice(0, -1);
      }
      if (d && d.length < desc.length) d = d.replace(/\s+\S*$/, "") + "...";
      if (d) {
        ctx.page.drawText(d, {
          x: x + colSymbol + pad,
          y: ctx.y - 8 - fontSize,
          font,
          size: fontSize,
          color: rgb(0.35, 0.35, 0.35),
        });
      }
    }

    const wTxt = `${Number(r.weight || 0).toFixed(1)}%`;
    const wWidth = font.widthOfTextAtSize(wTxt, fontSize);
    ctx.page.drawText(wTxt, {
      x: x + width - pad - wWidth,
      y: ctx.y - 8 - fontSize,
      font,
      size: fontSize,
    });

    ctx.y -= rowH;
  });

  return ctx;
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
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // First page
  let ctx = addPage(doc);

  /* ───────── Header logos (first page only) ───────── */
  if (logoUrl) {
    try {
      const buf = await fetch(logoUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 160;
      const h = w * (img.height / img.width);
      ctx.page.drawImage(img, { x: MARGIN, y: ctx.y - h + 10, width: w, height: h });
    } catch {}
  }
  if (bullUrl) {
    try {
      const buf = await fetch(bullUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 110;
      const h = w * (img.height / img.width);
      ctx.page.drawImage(img, {
        x: PAGE_W - MARGIN - w,
        y: ctx.y - h + 25,
        width: w,
        height: h,
        opacity: 0.25,
      });
    } catch {}
  }

  ctx.y -= 50; // breathing room under logos

  // Title
  ctx.page.drawText("GradeYour401k - Personalized Report", {
    x: MARGIN,
    y: ctx.y,
    font: fontBold,
    size: 18,
    color: rgb(0.1, 0.1, 0.1),
  });
  ctx.y -= 26;

  // Meta line (left): Provider + Profile
  const metaLeft = `Provider: ${titleCase(provider)} - Profile: ${titleCase(profile)}`;
  ctx.page.drawText(metaLeft, {
    x: MARGIN,
    y: ctx.y,
    font,
    size: 11.5,
    color: rgb(0.25, 0.25, 0.25),
  });

  // Grade (right) with vector star
  const gradeTxt = `Grade: ${toGradeText(grade)}`;
  const gradeSize = 11.5;
  const gradeWidth = font.widthOfTextAtSize(gradeTxt, gradeSize) + 8 + 14; // star padding
  const gx = PAGE_W - MARGIN - gradeWidth;

  const starOuterRadiusPx = 7;
  drawStar(ctx.page, gx + starOuterRadiusPx, ctx.y + 2, starOuterRadiusPx);

  ctx.page.drawText(gradeTxt, {
    x: gx + 8 + starOuterRadiusPx * 2,
    y: ctx.y,
    font,
    size: gradeSize,
    color: rgb(0.2, 0.2, 0.2),
  });

  ctx.y -= 16;

  // Optional date
  if (reportDate) {
    ctx.page.drawText(`Date: ${new Date(reportDate).toLocaleDateString()}`, {
      x: MARGIN,
      y: ctx.y,
      font,
      size: 10.5,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  ctx.y -= 36;

  /* ───────── Section: Current Holdings (paginated) ───────── */
  ctx = drawTablePaginated({
    doc,
    ctx,
    rows: holdings || [],
    font,
    fontBold,
    headerLabel: "CURRENT HOLDINGS",
    showDescription: true,
  });

  ctx.y -= 28;

  /* ───────── Section: Recommended (paginated) ───────── */
  // NOTE: Title includes a generic label; if you pass an "as of" label externally, inject it here
  ctx = drawTablePaginated({
    doc,
    ctx,
    rows: [], // placeholder; will be replaced by your real recommended rows before calling this
    font,
    fontBold,
    headerLabel: "RECOMMENDED HOLDINGS",
    showDescription: true,
  });

  ctx.y -= 24;

  /* ───────── Section: Market Sentiment + Commentary (wrapped across pages) ───────── */
  // Title
  ctx = ensureRoom(doc, ctx, 18 + 6);
  ctx.page.drawText("MARKET SENTIMENT", { x: MARGIN, y: ctx.y, font: fontBold, size: 13 });
  ctx.y -= 18;

  // Dial image or fallback bar
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
        // make room or page-break
        ctx = ensureRoom(doc, ctx, h + 8);
        const cx = (PAGE_W - w) / 2;
        ctx.page.drawImage(img, { x: cx, y: ctx.y - h, width: w, height: h });
        ctx.y -= h + 8;
        drewDial = true;
      }
    } catch {}
  }

  if (!drewDial) {
    const fgVal = 63;
    ctx = ensureRoom(doc, ctx, 14 + 10 + 28);
    ctx.page.drawText(`Fear & Greed Index: ${fgVal} - Greed`, {
      x: MARGIN,
      y: ctx.y,
      font,
      size: 10.5,
      color: rgb(0.2, 0.2, 0.2),
    });
    ctx.y -= 14;
    const gx2 = MARGIN;
    const gw = 512;
    const gh = 10;
    ctx.page.drawRectangle({
      x: gx2, y: ctx.y - gh, width: gw, height: gh, color: rgb(0.9, 0.9, 0.9),
    });
    ctx.page.drawRectangle({
      x: gx2, y: ctx.y - gh, width: gw * (fgVal / 100), height: gh, color: rgb(0.2, 0.65, 0.3),
    });
    ctx.y -= 28;
  }

  const commentary =
    "Commentary: Sentiment is tilting toward Greed, which often coincides with stronger momentum. " +
    "Maintain core diversification and avoid concentrated bets; rebalancing into targeted sector exposure " +
    "should be paced and rules-based. Long-term investors should emphasize quality, cash-flow resilience, " +
    "and keep adequate short-term reserves to avoid forced selling in pullbacks.";

  ctx = drawWrappedParagraph({
    doc, ctx, text: commentary, font, size: 10.5, color: rgb(0.25, 0.25, 0.25), maxCharsPerLine: 95, lineGap: 14,
  });

  ctx.y -= 18;

  /* ───────── Section: Next Steps (wrapped, paginated) ───────── */
  ctx = ensureRoom(doc, ctx, 16);
  ctx.page.drawText("NEXT STEPS", { x: MARGIN, y: ctx.y, font: fontBold, size: 13 });
  ctx.y -= 16;

  const steps = [
    "1) Log in to your 401(k) plan and make the recommended holding adjustments listed above.",
    "2) If your plan doesn't offer a specific symbol, replace it with a like-kind fund in the same asset class and mandate (e.g., large-cap growth ETF <-> large-cap growth index fund).",
    "3) Log in to GradeYour401k.com to update your information, view past reports, or schedule a 401(k) Review with Kenai Investments.",
  ];
  for (const s of steps) {
    ctx = drawWrappedParagraph({
      doc, ctx, text: s, font, size: 10.5, color: rgb(0.25, 0.25, 0.25), maxCharsPerLine: 98, lineGap: 14,
    });
    ctx.y -= 4;
  }

  // Draw the footer across ALL pages (after content so we don't overdraw)
  drawFooterOnEveryPage(doc, font);

  return await doc.save();
}
