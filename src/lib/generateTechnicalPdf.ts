import type { PDFFont, PDFPage } from "pdf-lib";
import { PDFDocument, PageSizes, StandardFonts, rgb } from "pdf-lib";

function wrapLine(line: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const result: string[] = [];
  let rest = line;
  while (rest.length > 0) {
    let fit = 0;
    let low = 1;
    let high = rest.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const slice = rest.slice(0, mid);
      const w = font.widthOfTextAtSize(slice, fontSize);
      if (w <= maxWidth) {
        fit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (fit === 0) fit = 1;
    result.push(rest.slice(0, fit));
    rest = rest.slice(fit).replace(/^\s+/, "");
  }
  return result;
}

function drawLineSafe(page: PDFPage, text: string, opts: { x: number; y: number; size: number; font: PDFFont }) {
  try {
    page.drawText(text, { ...opts, color: rgb(0, 0, 0) });
  } catch {
    page.drawText(text.replace(/[^\u0020-\u00FF]/g, "?"), { ...opts, color: rgb(0, 0, 0) });
  }
}

/**
 * Gera PDF sem dependencia de ficheiros .afm no disco (compativel com bundling Next.js).
 */
export async function generateTechnicalPdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 9;
  const margin = 40;
  const lineSpacing = fontSize * 1.35;
  const [pageWidth, pageHeight] = PageSizes.A4;
  const textWidth = pageWidth - 2 * margin;

  let page = doc.addPage(PageSizes.A4);
  let baselineY = pageHeight - margin;

  const newPage = () => {
    page = doc.addPage(PageSizes.A4);
    baselineY = pageHeight - margin;
  };

  for (const rawLine of lines) {
    const normalized = rawLine.replace(/\r\n/g, "\n");
    const segments = normalized.split("\n");
    for (const segment of segments) {
      const wrapped = wrapLine(segment, font, fontSize, textWidth);
      for (const piece of wrapped) {
        if (baselineY < margin + lineSpacing) newPage();
        drawLineSafe(page, piece, { x: margin, y: baselineY, size: fontSize, font });
        baselineY -= lineSpacing;
      }
    }
  }

  return doc.save();
}
