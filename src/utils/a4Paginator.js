// src/utils/a4Paginator.js - Robust LaTeX A4 Two-Column Page Packing Engine
// Matches: \documentclass[10pt,a4paper,twocolumn]{article} with \usepackage[margin=0.5in]{geometry}

/**
 * Strips HTML tags to count raw readable characters
 */
function getCharCount(str) {
  return (str || '').replace(/<[^>]+>/g, '').length;
}

/**
 * Estimates the rendered point height of a content element in a 10pt Latin Modern 2-column layout (256.7pt col width)
 */
function estimateElementHeight(el) {
  if (!el) return 0;
  const len = getCharCount(el.content);
  if (el.type === 'item' || el.type === 'numbered-item') {
    // 256.7pt column - 14pt bullet indent = 242.7pt text width (~47 chars per line at 10pt)
    const lines = Math.max(1, Math.ceil(len / 47));
    return lines * 12 + 1.5;
  }
  if (el.type === 'paragraph') {
    const lines = Math.max(1, Math.ceil(len / 48));
    return lines * 12 + 3;
  }
  if (el.type === 'table') {
    const rows = (el.content || '').split(/<tr/i).length - 1;
    return Math.max(80, (rows || 3) * 16 + 20);
  }
  if (el.type === 'quote') {
    const lines = Math.max(1, Math.ceil(len / 44));
    return lines * 12 + 16;
  }
  if (el.type === 'subsubsection') {
    return 18;
  }
  return 15;
}

/**
 * Estimates the rendered height of a subsection
 */
function estimateSubsectionHeight(sub) {
  let h = sub.title ? 20 : 0;
  if (Array.isArray(sub.elements)) {
    for (const el of sub.elements) {
      h += estimateElementHeight(el);
    }
  }
  return h;
}

/**
 * Estimates the rendered height of a tcolorbox
 */
function estimateTakeawayHeight(t) {
  if (!t) return 0;
  const len = getCharCount(t.content);
  if (t.content && t.content.includes('<li')) {
    const items = t.content.split(/<li/i).length - 1;
    return 16 + 8 + 9 + (items * 13.5);
  }
  const lines = Math.max(1, Math.ceil(len / 47));
  return 16 + 8 + 9 + (lines * 11.5);
}

/**
 * Estimates the rendered height of a section
 */
function estimateSectionHeight(sec) {
  let h = 25; // section title
  if (sec.takeaway) {
    h += estimateTakeawayHeight(sec.takeaway);
  }
  if (Array.isArray(sec.subsections)) {
    for (const sub of sec.subsections) {
      h += estimateSubsectionHeight(sub);
    }
  }
  return h;
}

/**
 * Paginates shortNotesData into distinct A4 two-column pages matching LaTeX article layout
 *
 * LaTeX Geometry Constraints:
 * - Total A4 height: 841.89pt (297mm)
 * - Margins: 36pt top + 36pt bottom = 72pt (margin=0.5in)
 * - Footer with page number: 24pt
 * - Net printable column height: ~746pt
 * - Page 1 header (\maketitle): ~60pt
 * - Page 1 capacity (2 columns): ~1200pt
 * - Subsequent Pages capacity (2 columns): ~1490pt
 */
export function paginateIntoA4Pages(shortNotesData) {
  if (!shortNotesData || !Array.isArray(shortNotesData.sections) || shortNotesData.sections.length === 0) {
    return [];
  }

  const PAGE_1_CAPACITY = 1200;
  const PAGE_N_CAPACITY = 1490;

  const pages = [];
  let currentPage = {
    pageNumber: 1,
    isFirstPage: true,
    title: shortNotesData.title,
    subtitle: shortNotesData.subtitle,
    sections: [],
  };
  pages.push(currentPage);

  let cap = PAGE_1_CAPACITY;
  let used = 0;

  for (let sIdx = 0; sIdx < shortNotesData.sections.length; sIdx++) {
    const section = shortNotesData.sections[sIdx];
    const secH = estimateSectionHeight(section);

    if (used + secH <= cap) {
      currentPage.sections.push(section);
      used += secH;
    } else {
      const secHeaderH = 25 + (section.takeaway ? estimateTakeawayHeight(section.takeaway) : 0);

      // If remaining space allows section header + takeaway + at least 1-2 subsections (> 220pt)
      if (cap - used >= 220 && section.subsections && section.subsections.length > 0) {
        const page1Subs = [];
        const page2Subs = [];
        let subUsed = secHeaderH;

        for (const sub of section.subsections) {
          const subH = estimateSubsectionHeight(sub);
          if (used + subUsed + subH <= cap) {
            page1Subs.push(sub);
            subUsed += subH;
          } else if (used + subUsed + 60 <= cap && sub.elements && sub.elements.length > 1) {
            // Split elements of subsection
            const p1Els = [];
            const p2Els = [];
            let elUsed = sub.title ? 20 : 0;
            for (const el of sub.elements) {
              const elH = estimateElementHeight(el);
              if (used + subUsed + elUsed + elH <= cap) {
                p1Els.push(el);
                elUsed += elH;
              } else {
                p2Els.push(el);
              }
            }
            if (p1Els.length > 0) {
              page1Subs.push({ ...sub, elements: p1Els });
              subUsed += elUsed;
            }
            if (p2Els.length > 0) {
              page2Subs.push({ ...sub, elements: p2Els });
            }
          } else {
            page2Subs.push(sub);
          }
        }

        if (page1Subs.length > 0) {
          currentPage.sections.push({ ...section, subsections: page1Subs });
        }

        // Start next page for remaining content
        currentPage = {
          pageNumber: pages.length + 1,
          isFirstPage: false,
          sections: [{
            ...section,
            isContinuation: true,
            title: section.title,
            takeaway: null,
            subsections: page2Subs,
          }],
        };
        pages.push(currentPage);
        cap = PAGE_N_CAPACITY;
        used = 0;
        for (const s of page2Subs) used += estimateSubsectionHeight(s);
      } else {
        // Move section to new page
        currentPage = {
          pageNumber: pages.length + 1,
          isFirstPage: false,
          sections: [section],
        };
        pages.push(currentPage);
        cap = PAGE_N_CAPACITY;
        used = secH;
      }
    }
  }

  return pages;
}
