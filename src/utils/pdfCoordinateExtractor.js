// src/utils/pdfCoordinateExtractor.js - Sub-pixel SVG Bounding Box Extractor for PDF Concept Highlights
// Extracts exact glyph/phrase vector coordinates directly from PDF.js text stream to prevent text ghosting & font drift.

/**
 * Escapes regex special characters in a search term
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper to convert PDF rectangle points to viewport pixels across all PDF.js versions
 */
function convertPdfRectToViewport(viewport, minPdfX, minPdfY, maxPdfX, maxPdfY) {
  if (typeof viewport.convertToViewportRectangle === 'function') {
    const vpRect = viewport.convertToViewportRectangle([minPdfX, minPdfY, maxPdfX, maxPdfY]);
    return {
      vx: Math.min(vpRect[0], vpRect[2]),
      vy: Math.min(vpRect[1], vpRect[3]),
      vw: Math.abs(vpRect[2] - vpRect[0]),
      vh: Math.abs(vpRect[3] - vpRect[1]),
    };
  }
  // Standard convertToViewportPoint supported by modern PDF.js (v4/v6)
  const p1 = viewport.convertToViewportPoint(minPdfX, maxPdfY);
  const p2 = viewport.convertToViewportPoint(maxPdfX, minPdfY);
  return {
    vx: Math.min(p1[0], p2[0]),
    vy: Math.min(p1[1], p2[1]),
    vw: Math.abs(p2[0] - p1[0]),
    vh: Math.abs(p2[1] - p1[1]),
  };
}

/**
 * Extracts exact bounding boxes for matching concept phrases on a PDF page
 * 
 * @param {import('pdfjs-dist').PDFPageProxy} page - The PDF.js page instance
 * @param {import('pdfjs-dist').PageViewport} viewport - The scaled viewport
 * @param {Array<{ id: string, phrase: string, targetSection?: string }>} concepts - List of target concepts
 * @returns {Promise<Array<{ conceptId: string, phrase: string, targetSection: string, rects: Array<{ x: number, y: number, width: number, height: number }> }>>}
 */
export async function extractConceptBoundingBoxes(page, viewport, concepts) {
  if (!page || !viewport || !Array.isArray(concepts) || concepts.length === 0) {
    return [];
  }

  const textContent = await page.getTextContent();
  const items = textContent.items || [];
  if (items.length === 0) return [];

  const foundConcepts = [];

  // Sort concepts by phrase length descending so compound terms match before sub-terms
  const sortedConcepts = [...concepts].sort((a, b) => b.phrase.length - a.phrase.length);

  // Group items by line based on vertical baseline (ty within tolerance)
  // In PDF coordinates, ty is item.transform[5]
  const lines = [];
  let currentLine = [];
  let currentTy = null;

  items.forEach((item, itemIdx) => {
    if (!item.str) return;
    const ty = item.transform[5];

    if (currentTy === null || Math.abs(ty - currentTy) < 3.5) {
      currentLine.push({ ...item, originalIdx: itemIdx });
      currentTy = ty;
    } else {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [{ ...item, originalIdx: itemIdx }];
      currentTy = ty;
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  sortedConcepts.forEach((concept) => {
    const rawPhrase = concept.phrase.trim();
    if (!rawPhrase || rawPhrase.length < 2) return;

    const prefix = /^\w/.test(rawPhrase) ? '\\b' : '';
    const suffix = /\w$/.test(rawPhrase) ? '\\b' : '';
    const regex = new RegExp(`${prefix}${escapeRegExp(rawPhrase)}${suffix}`, 'gi');

    // 1. First pass: Match across individual items
    items.forEach((item) => {
      if (!item.str || !item.transform) return;

      let match;
      const str = item.str;
      while ((match = regex.exec(str)) !== null) {
        const matchIndex = match.index;
        const matchLen = match[0].length;

        // PDF coordinate geometry
        const [scaleX, , , scaleY, tx, ty] = item.transform;
        const itemWidth = item.width || 0;
        const fontHeight = item.height || Math.abs(scaleY) || 10;

        if (itemWidth <= 0 || str.length === 0) continue;

        // Proportional horizontal sub-bounding box in PDF points
        const startFraction = matchIndex / str.length;
        const widthFraction = matchLen / str.length;

        const minPdfX = tx + (startFraction * itemWidth);
        const maxPdfX = minPdfX + (widthFraction * itemWidth);
        const minPdfY = ty - fontHeight * 0.22;
        const maxPdfY = ty + fontHeight * 0.92;

        // Convert to viewport pixel coordinates
        const { vx, vy, vw, vh } = convertPdfRectToViewport(viewport, minPdfX, minPdfY, maxPdfX, maxPdfY);

        foundConcepts.push({
          conceptId: concept.id,
          phrase: match[0],
          targetSection: concept.targetSection || concept.id,
          snippet: concept.snippet || '',
          color: concept.color || null,
          isHighlight: Boolean(concept.isHighlight),
          rects: [{
            x: Math.round(vx * 10) / 10,
            y: Math.round(vy * 10) / 10,
            width: Math.round(vw * 10) / 10,
            height: Math.round(vh * 10) / 10,
          }],
        });
      }
    });

    // 2. Second pass: Match multi-word phrases split across items in the same line with token mapping
    lines.forEach((lineItems) => {
      // Build reconstructed line text with virtual spaces between spaced items
      let lineStr = '';
      const charMap = []; // Maps each char index in lineStr to { item, localIdx } or null for virtual space

      for (let i = 0; i < lineItems.length; i++) {
        const it = lineItems[i];
        if (i > 0) {
          const prev = lineItems[i - 1];
          const prevRight = prev.transform[4] + (prev.width || 0);
          const gap = it.transform[4] - prevRight;
          if (gap > 1.5 && !lineStr.endsWith(' ') && !it.str.startsWith(' ')) {
            lineStr += ' ';
            charMap.push(null);
          }
        }
        for (let c = 0; c < it.str.length; c++) {
          lineStr += it.str[c];
          charMap.push({ item: it, localIdx: c });
        }
      }

      let match;
      while ((match = regex.exec(lineStr)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;

        // Check if already matched in single items
        const alreadyMatched = foundConcepts.some(
          (fc) => fc.conceptId === concept.id && fc.phrase.toLowerCase() === match[0].toLowerCase()
        );
        if (alreadyMatched) continue;

        // Group matched characters by item to compute exact sub-rects per item
        const itemRanges = new Map();

        for (let idx = matchStart; idx < matchEnd; idx++) {
          const mapping = charMap[idx];
          if (!mapping) continue; // Skip virtual space

          const { item, localIdx } = mapping;
          if (!itemRanges.has(item)) {
            itemRanges.set(item, { min: localIdx, max: localIdx });
          } else {
            const range = itemRanges.get(item);
            range.min = Math.min(range.min, localIdx);
            range.max = Math.max(range.max, localIdx);
          }
        }

        const subRects = [];
        for (const [it, range] of itemRanges.entries()) {
          const [scaleX, , , scaleY, tx, ty] = it.transform;
          const itemWidth = it.width || 0;
          const fontHeight = it.height || Math.abs(scaleY) || 10;
          const itemLen = it.str.length || 1;

          if (itemWidth > 0 && itemLen > 0) {
            const startFraction = range.min / itemLen;
            const widthFraction = (range.max - range.min + 1) / itemLen;

            const minPdfX = tx + (startFraction * itemWidth);
            const maxPdfX = minPdfX + (widthFraction * itemWidth);
            const minPdfY = ty - fontHeight * 0.22;
            const maxPdfY = ty + fontHeight * 0.92;

            const { vx, vy, vw, vh } = convertPdfRectToViewport(viewport, minPdfX, minPdfY, maxPdfX, maxPdfY);

            subRects.push({
              x: Math.round(vx * 10) / 10,
              y: Math.round(vy * 10) / 10,
              width: Math.round(vw * 10) / 10,
              height: Math.round(vh * 10) / 10,
            });
          }
        }

        if (subRects.length > 0) {
          foundConcepts.push({
            conceptId: concept.id,
            phrase: match[0],
            targetSection: concept.targetSection || concept.id,
            snippet: concept.snippet || '',
            color: concept.color || null,
            isHighlight: Boolean(concept.isHighlight),
            rects: subRects,
          });
        }
      }
    });
  });

  return foundConcepts;
}
