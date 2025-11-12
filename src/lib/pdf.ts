// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FUND_LABELS } from "@/lib/funds";
import { computeFinalGrade, formatGradeHalfStar } from "@/lib/grade";

export type PdfArgs = {
  provider: string;
  profile: string;
  grade: number | string | null; // authoritative if provided (stored half-step string like "4.5" preferred)
  holdings: Array<{ symbol: string; weight: number }>;
  logoUrl?: string; // GradeYour401k logo (PNG recommended)
  bullUrl?: string; // Kenai bull logo (PNG recommended)
  fearGreedImageUrl?: string; // optional PNG/JPG for dial
  reportDate?: string | Date;

  // (unchanged) - supplied by your server route
  model_asof?: string | Date | null;
  model_lines?: Array<{ rank?: number; symbol: string; weight: number; role?: string | null }>;
  model_fear_greed?: { asof_date: string | Date | null; reading: number } | null;
};

/* ───────── helpers ───────── */
function titleCase(s: string) {
  return (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
}
const descFor = (sym: string) => FUND_LABELS[(sym || "").toUpperCase().trim()];

function fmtDate(d?: string | Date | null) {
  if (!d) return "—";
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

/* Static fallback (kept as last resort, unchanged) */
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

    // dynamic model data (unchanged)
    model_asof,
    model_lines,
    model_fear_greed,
  } = args;

  /* ───────── page metrics ───────── */
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 44;
  const BOTTOM = 60; // <- real bottom margin so we never write over footer

  const doc = await PDFDocument.create();
  let page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - MARGIN;

  /* Footer drawer (call this before starting a new page, and once at end) */
  function drawFooter(p: any) {
    p.drawLine({
      start: { x: MARGIN, y: 40 },
      end: { x: PAGE_W - MARGIN, y: 40 },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 0.5,
    });
    const footer = "Kenai Investments Inc. - www.kenaiinvest.com - (806) 359-3100";
    const fw = font.widthOfTextAtSize(footer, 10);
    p.drawText(footer, {
      x: (PAGE_W - fw) / 2,
      y: 26,
      font,
      size: 10,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  /* Ensure vertical room; if not enough -> draw footer, add new page, reset y */
  function ensureRoom(need: number) {
    if (y - need <= BOTTOM) {
      drawFooter(page);
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  /* Simple text line writer with page-break protection */
  function writeLine(txt: string, size = 10.5, color = rgb(0.25, 0.25, 0.25)) {
    ensureRoom(size + 6);
    page.drawText(txt, { x: MARGIN, y, font, size, color });
    y -= size + 4;
  }

  /* Wrap a paragraph (approximate) with page-break protection */
  function wrapPara(txt: string, max = 95, size = 10.5) {
    const lines = txt.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) || [txt];
    for (const line of lines) writeLine(line.trim(), size);
  }

  /* ───────── Header logos (spaced and non-overlapping) ───────── */
  if (logoUrl) {
    try {
      const buf = await fetch(logoUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 160;
      const h = w * (img.height / img.width);
      ensureRoom(h - 10);
      page.drawImage(img, { x: MARGIN, y: y - h + 10, width: w, height: h });
    } catch {}
  }
  if (bullUrl) {
    try {
      const buf = await fetch(bullUrl).then((r) => r.arrayBuffer());
      const img = await doc.embedPng(buf);
      const w = 110;
      const h = w * (img.height / img.width);
      // Bull is decorative; no need to ensure, it sits in same band
      page.drawImage(img, {
        x: PAGE_W - MARGIN - w,
        y: y - h + 25,
        width: w,
        height: h,
        opacity: 0.25,
      });
    } catch {}
  }

  y -= 50; // breathing room under logos

  // Title (ASCII hyphen)
  ensureRoom(18 + 26);
  page.drawText("GradeYour401k - Personalized Report", {
    x: MARGIN,
    y,
    font: fontBold,
    size: 18,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 26;

  // Meta line (left): Provider + Profile
  const metaLeft = `Provider: ${titleCase(provider)} - Profile: ${titleCase(profile)}`;
  writeLine(metaLeft, 11.5, rgb(0.25, 0.25, 0.25));

  // ───────── Grade (consistent half-star formatting) ─────────
  // Prefer the passed-in grade; if missing, compute the final grade from profile+holdings.
  const rawGradeNum = (() => {
    if (grade !== null && grade !== undefined && `${grade}`.trim() !== "") {
      const n = Number(grade);
      if (Number.isFinite(n)) return n;
    }
    const fallback = computeFinalGrade(profile, holdings);
    return Number.isFinite(fallback) ? fallback : NaN;
  })();

  const displayGrade = Number.isFinite(rawGradeNum)
    ? formatGradeHalfStar(rawGradeNum) // e.g., "4.5"
    : "—";

  // Grade (right) with vector star (draw at same y band used above)
  const gradeTxt = `Grade: ${displayGrade} / 5`;
  const gradeSize = 11.5;
  const starOuterRadiusPx = 7;
  const gradeTextWidth = font.widthOfTextAtSize(gradeTxt, gradeSize);
  const totalGradeBlockW = 8 + starOuterRadiusPx * 2 + gradeTextWidth; // star + spacing + text
  const gx = PAGE_W - MARGIN - totalGradeBlockW;

  page.drawText(gradeTxt, {
    x: gx + 8 + starOuterRadiusPx * 2,
    y: y + 26, // align with meta line’s previous y band
    font,
    size: gradeSize,
    color: rgb(0.2, 0.2, 0.2),
  });
  drawStar(page, gx + starOuterRadiusPx, y + 28, starOuterRadiusPx);

  // Optional date
  if (reportDate) {
    writeLine(`Date: ${new Date(reportDate).toLocaleDateString()}`, 10.5, rgb(0.4, 0.4, 0.4));
  }

  y -= 8;

  /* ───────── Table helpers (paginate with header redraw) ───────── */
  function drawTableHeader() {
    const x = 50;
    const width = 512;
    const rowH = 24;
    const colSymbol = 120;
    const colWeight = 70;
    const pad = 10;
    const fontSize = 10.5;

    ensureRoom(rowH + 4);
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
  }

  function drawTableRows(rows: Array<{ symbol: string; weight: number }>) {
    const x = 50;
    const width = 512;
    const rowH = 24;
    const colSymbol = 120;
    const colWeight = 70;
    const pad = 10;
    const fontSize = 10.5;

    let headerOnThisPage = true;

    rows.forEach((r, i) => {
      if (y - rowH <= BOTTOM) {
        drawFooter(page);
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        drawTableHeader();
        headerOnThisPage = true;
      } else if (!headerOnThisPage && i === 0) {
        drawTableHeader();
        headerOnThisPage = true;
      }

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

      // Truncate desc to fit in remaining width
      const maxDescWidth = width - colSymbol - colWeight - pad * 2;
      let d = desc;
      while (d && font.widthOfTextAtSize(d, fontSize) > maxDescWidth) d = d.slice(0, -1);
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
  }

  /* ───────── Section: Current Holdings (paginated) ───────── */
  writeLine("CURRENT HOLDINGS", 13, rgb(0, 0, 0));
  drawTableHeader();
  drawTableRows(holdings || []);
  y -= 28;

  /* ───────── Section: Recommended (dynamic, unchanged logic) ───────── */
  const recTitleProvider = titleCase(provider);
  const recTitleProfile = titleCase(profile);
  const modelAsOfStr = model_asof ? fmtDate(model_asof) : null;

  writeLine(
    modelAsOfStr
      ? `RECOMMENDED HOLDINGS (${recTitleProvider} / ${recTitleProfile} - as of ${modelAsOfStr})`
      : `RECOMMENDED HOLDINGS (${recTitleProvider} / ${recTitleProfile})`,
    13,
    rgb(0, 0, 0)
  );

  // Use live model_lines if provided; convert FRACTION -> %
  let recRows: Array<{ symbol: string; weight: number }> = [];
  if (Array.isArray(model_lines) && model_lines.length) {
    recRows = model_lines.map((ln) => ({
      symbol: ln.symbol,
      weight: (Number(ln.weight) || 0) * 100,
    }));
  } else {
    recRows = staticRecommended(provider, profile);
  }

  if (recRows.length) {
    // draw a subtle box around the whole table block (spans pages by redrawing per page)
    const boxX = 44;
    const boxW = PAGE_W - boxX * 2;
    // Open first box top on this page:
    let boxTopPage = page;
    let boxTopY = y + 6;

    // draw the table (may page break)
    drawTableHeader();
    drawTableRows(recRows);

    // Close the box on the current page
    const boxBottom = y - 6;
    boxTopPage.drawRectangle({
      x: boxX,
      y: boxBottom,
      width: boxW,
      height: boxTopY - boxBottom,
      borderColor: rgb(0.75, 0.82, 0.95),
      borderWidth: 1.25,
    });
  } else {
    writeLine("Model recommendations will appear here.", 10.5, rgb(0.35, 0.35, 0.35));
  }

  y -= 36;

  /* ───────── Section: Market Sentiment + Commentary (wrapped) ───────── */
  writeLine("MARKET SENTIMENT", 13, rgb(0, 0, 0));
  y -= 2;

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
        ensureRoom(h + 8);
        const cx = (PAGE_W - w) / 2;
        page.drawImage(img, { x: cx, y: y - h, width: w, height: h });
        y -= h + 8;
        drewDial = true;
      }
    } catch {}
  }

  // Use live FG reading if present; fallback to 63 (unchanged)
  const fgValRaw = model_fear_greed?.reading;
  const fgVal = Math.max(0, Math.min(100, Number.isFinite(Number(fgValRaw)) ? Number(fgValRaw) : 63));
  const fgLabel =
    fgVal < 25 ? "Extreme Fear"
      : fgVal < 45 ? "Fear"
      : fgVal < 55 ? "Neutral"
      : fgVal < 75 ? "Greed"
      : "Extreme Greed";

  if (!drewDial) {
    writeLine(`Fear & Greed Index: ${fgVal} - ${fgLabel}`, 10.5, rgb(0.2, 0.2, 0.2));
    // bar
    ensureRoom(28);
    const gx2 = MARGIN;
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
    y -= 24;
  }

  const commentary =
    "Commentary: Sentiment can swing quickly. Maintain core diversification and avoid concentrated bets; " +
    "rebalancing into targeted sector exposure should be paced and rules-based. Long-term investors should emphasize " +
    "quality, cash-flow resilience, and keep adequate short-term reserves to avoid forced selling in pullbacks.";
  wrapPara(commentary, 95, 10.5);

  y -= 18;

  /* ───────── Section: Next Steps (wrapped) ───────── */
  writeLine("NEXT STEPS", 13, rgb(0, 0, 0));
  const steps = [
    "1) Log in to your 401(k) plan and make the recommended holding adjustments listed above.",
    "2) If your plan doesn't offer a specific symbol, replace it with a like-kind fund in the same asset class and mandate (e.g., large-cap growth ETF <-> large-cap growth index fund).",
    "3) Log in to GradeYour401k.com to update your information, view past reports, or schedule a 401(k) Review with Kenai Investments.",
  ];
  for (const s of steps) {
    wrapPara(s, 98, 10.5);
    y -= 4;
  }

  /* Final footer on the last page */
  drawFooter(page);

  return await doc.save();
}
