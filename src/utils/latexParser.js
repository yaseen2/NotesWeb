// src/utils/latexParser.js - Robust In-Browser LaTeX Parser & HTML/CSS Converter with KaTeX and Tables

import katex from 'katex';
import { marked } from 'marked';

/**
 * Extracts content within balanced curly braces starting from a given index
 */
export function extractBraceContent(str, startIndex) {
  let depth = 0;
  let start = -1;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.substring(start, i), endIndex: i };
      }
    }
  }
  return null;
}

/**
 * High-speed KaTeX math formula renderer for inline and display equations
 */
export function renderMathInLatex(text) {
  if (!text) return '';

  // 1. Display math: $$...$$
  let processed = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
    try {
      return `<div class="latex-display-math">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return match;
    }
  });

  // Display math: \[...\]
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (match, math) => {
    try {
      return `<div class="latex-display-math">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return match;
    }
  });

  // Display math: \begin{equation}...\end{equation}
  processed = processed.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, (match, math) => {
    try {
      return `<div class="latex-display-math">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch (e) {
      return match;
    }
  });

  // 2. Inline math: $...$ (ignoring escaped \$)
  processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (match, math) => {
    try {
      return `<span class="latex-inline-math">${katex.renderToString(math.trim(), { displayMode: false, throwOnError: false })}</span>`;
    } catch (e) {
      return match;
    }
  });

  return processed;
}

/**
 * Cleans LaTeX typography commands into readable HTML/text with math rendering
 */
export function cleanLatexText(text) {
  if (!text) return '';

  // First process mathematical expressions
  let res = renderMathInLatex(text);

  // Standard text commands
  return res
    .replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>')
    .replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>')
    .replace(/\\underline\{([^}]+)\}/g, '<u>$1</u>')
    .replace(/``([^']+)''/g, '“$1”')
    .replace(/`([^']+)'/g, '‘$1’')
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\\dots/g, '…')
    .replace(/\\large\s*/g, '')
    .replace(/\\small\s*/g, '')
    .trim();
}

/**
 * Parses LaTeX tabular / tabularx environments into clean, responsive HTML tables
 */
export function parseLatexTable(tableTex, activeConnections = []) {
  if (!tableTex) return '';

  // Extract inner rows
  const innerMatch = tableTex.match(/\\begin\{(?:tabular|tabularx)\}(?:\{[^}]*\})*([\s\S]*?)\\end\{(?:tabular|tabularx)\}/);
  if (!innerMatch) return '';

  const rawRows = innerMatch[1].trim().split(/\\\\/);
  const rows = [];

  rawRows.forEach((rawRow) => {
    const cleanRow = rawRow
      .replace(/\\hline/g, '')
      .replace(/\\toprule/g, '')
      .replace(/\\midrule/g, '')
      .replace(/\\bottomrule/g, '')
      .trim();

    if (!cleanRow) return;

    const cells = cleanRow.split('&').map((c) => c.trim());
    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  });

  if (rows.length === 0) return '';

  // Determine if first row is header
  const isFirstRowHeader =
    rows[0].some((c) => c.includes('\\textbf') || c.includes('<strong>')) ||
    tableTex.includes('\\hline');

  let tableHtml = '<div class="latex-table-wrapper"><table class="latex-table">';

  rows.forEach((rowCells, rIdx) => {
    const isHeader = isFirstRowHeader && rIdx === 0;
    const tag = isHeader ? 'th' : 'td';

    tableHtml += '<tr>';
    rowCells.forEach((cell) => {
      const cellClean = injectConceptLinks(cleanLatexText(cell), activeConnections);
      tableHtml += `<${tag}>${cellClean}</${tag}>`;
    });
    tableHtml += '</tr>';
  });

  tableHtml += '</table></div>';
  return tableHtml;
}

/**
 * Injects interactive concept tags into HTML string based on unified connections list
 */
export function injectConceptLinks(htmlText, connectionsList = []) {
  if (!htmlText || !connectionsList || connectionsList.length === 0) return htmlText || '';
  let result = htmlText;

  // Flatten all matching terms from connection records
  const flatTerms = [];
  connectionsList.forEach((conn) => {
    const terms = conn.source?.terms || (conn.source?.text ? [conn.source.text] : conn.terms || []);
    const firstTarget = conn.targets?.[0] || {};
    const targetSection = firstTarget.targetSectionId || conn.targetSection || '';
    const hasMultiple = (conn.targets?.length || 0) > 1;

    terms.forEach((term) => {
      if (term && term.trim()) {
        flatTerms.push({
          term: term.trim(),
          connectionId: conn.id,
          targetSection,
          hasMultiple,
          isUserCustom: !conn.isBuiltin,
        });
      }
    });
  });

  // Sort longest term first so compound phrases match before single words
  flatTerms.sort((a, b) => b.term.length - a.term.length);

  flatTerms.forEach((item) => {
    const cleanTerm = item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!<[^>]*)\\b(${cleanTerm})\\b(?![^<]*>|[^<]*<\\/span>)`, 'gi');

    result = result.replace(regex, (match) => {
      const customClass = item.isUserCustom ? ' user-custom-link' : '';
      const multiAttr = item.hasMultiple ? ' data-multi-target="true"' : '';
      return `<span class="concept-trigger${customClass}" data-connection-id="${item.connectionId}" data-target-section="${item.targetSection}"${multiAttr} title="Click to view deep context">${match}</span>`;
    });
  });

  return result;
}

/**
 * Parses a subsection body into paragraphs, bullet lists, numbered lists, tables, and quotes
 */
function parseSubBody(bodyText, activeConnections) {
  const elements = [];

  // Remove tcolorbox blocks to avoid double parsing in subBody
  let cleanBody = bodyText.replace(/\\begin\{tcolorbox\}[\s\S]*?\\end\{tcolorbox\}/g, '');

  // Strip LaTeX document boilerplate commands
  cleanBody = cleanBody
    .replace(/\\begin\{document\}/g, '')
    .replace(/\\end\{document\}/g, '')
    .replace(/\\maketitle/g, '')
    .replace(/\\newpage/g, '')
    .replace(/\\clearpage/g, '')
    .replace(/\\raggedbottom/g, '')
    .replace(/\\tcbuselibrary\{[^}]*\}/g, '')
    .replace(/\\tcbset\{[^}]*\}/g, '');

  // Extract and process any tabular blocks
  const tableRegex = /\\begin\{(?:tabular|tabularx)\}[\s\S]*?\\end\{(?:tabular|tabularx)\}/g;
  const tables = [];
  cleanBody = cleanBody.replace(tableRegex, (match) => {
    const placeholder = `___LATEX_TABLE_${tables.length}___`;
    tables.push(match);
    return `\n\n${placeholder}\n\n`;
  });

  // Extract quotes
  const quoteRegex = /\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g;
  const quotes = [];
  cleanBody = cleanBody.replace(quoteRegex, (match, content) => {
    const placeholder = `___LATEX_QUOTE_${quotes.length}___`;
    quotes.push(content);
    return `\n\n${placeholder}\n\n`;
  });

  const lines = cleanBody.split('\n');
  let currentListType = null; // 'itemize' | 'enumerate' | null
  let currentParagraph = '';

  const flushParagraph = () => {
    if (currentParagraph.trim()) {
      elements.push({
        type: 'paragraph',
        content: injectConceptLinks(cleanLatexText(currentParagraph), activeConnections),
      });
      currentParagraph = '';
    }
  };

  for (let line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentParagraph && !currentListType) {
        flushParagraph();
      }
      continue;
    }

    // Check table placeholders
    if (trimmed.startsWith('___LATEX_TABLE_')) {
      flushParagraph();
      const match = trimmed.match(/___LATEX_TABLE_(\d+)___/);
      if (match) {
        const tableIdx = parseInt(match[1], 10);
        elements.push({
          type: 'table',
          content: parseLatexTable(tables[tableIdx], activeConnections),
        });
      }
      continue;
    }

    // Check quote placeholders
    if (trimmed.startsWith('___LATEX_QUOTE_')) {
      flushParagraph();
      const match = trimmed.match(/___LATEX_QUOTE_(\d+)___/);
      if (match) {
        const quoteIdx = parseInt(match[1], 10);
        elements.push({
          type: 'quote',
          content: injectConceptLinks(cleanLatexText(quotes[quoteIdx].trim()), activeConnections),
        });
      }
      continue;
    }

    // List Handlers
    if (trimmed.startsWith('\\begin{itemize}')) {
      flushParagraph();
      currentListType = 'itemize';
    } else if (trimmed.startsWith('\\begin{enumerate}')) {
      flushParagraph();
      currentListType = 'enumerate';
    } else if (trimmed.startsWith('\\end{itemize}') || trimmed.startsWith('\\end{enumerate}')) {
      currentListType = null;
    } else if (trimmed.startsWith('\\item')) {
      const itemText = trimmed.replace(/^\\item\s*/, '');
      elements.push({
        type: currentListType === 'enumerate' ? 'numbered-item' : 'item',
        content: injectConceptLinks(cleanLatexText(itemText), activeConnections),
      });
    } else if (trimmed.startsWith('\\subsubsection')) {
      flushParagraph();
      const braceRes = extractBraceContent(trimmed, trimmed.indexOf('\\subsubsection'));
      if (braceRes) {
        elements.push({
          type: 'subsubsection',
          content: cleanLatexText(braceRes.content),
        });
      }
    } else {
      if (currentListType) {
        // Line continuation of previous list item
        const lastEl = elements[elements.length - 1];
        if (lastEl && (lastEl.type === 'item' || lastEl.type === 'numbered-item')) {
          lastEl.content += ' ' + injectConceptLinks(cleanLatexText(trimmed), activeConnections);
        }
      } else {
        currentParagraph = currentParagraph ? currentParagraph + ' ' + trimmed : trimmed;
      }
    }
  }

  flushParagraph();
  return elements;
}

/**
 * Smart Metadata Extractor: extracts title, subtitle, author, date from any uploaded .tex file
 */
export function extractLatexMetadata(rawTex) {
  if (!rawTex) {
    return { title: 'Untitled Note', subtitle: '', period: '' };
  }

  let title = 'Revision Notes';
  let subtitle = '';

  const titleIdx = rawTex.indexOf('\\title');
  if (titleIdx !== -1) {
    const braceRes = extractBraceContent(rawTex, titleIdx);
    if (braceRes && braceRes.content) {
      const parts = braceRes.content.split(/\\\\/);
      if (parts.length > 0) {
        title = cleanLatexText(parts[0].replace(/\\textbf\{([^}]+)\}/, '$1')).replace(/^CSS\s*:/i, '').trim();
      }
      if (parts.length > 1) {
        subtitle = cleanLatexText(parts[1]);
      }
    }
  }

  // Extract period from subtitle or date if present
  let period = subtitle;
  const dateMatch = rawTex.match(/\\date\{([^}]+)\}/);
  if (!period && dateMatch) {
    period = cleanLatexText(dateMatch[1]);
  }

  return {
    title: title || 'Revision Notes',
    subtitle: subtitle || '',
    period: period || 'Study Note',
  };
}

/**
 * Parses tcolorbox internal content, properly handling lists, paragraphs, and concepts
 */
function parseBoxContent(rawContent, activeConns) {
  if (!rawContent) return '';
  if (rawContent.includes('\\item')) {
    const lines = rawContent.split('\n');
    let html = '';
    let inList = false;
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('\\begin{itemize}') || trimmed.startsWith('\\begin{enumerate}')) {
        html += '<ul class="a4-item-list latex-item-list">';
        inList = true;
      } else if (trimmed.startsWith('\\end{itemize}') || trimmed.startsWith('\\end{enumerate}')) {
        html += '</ul>';
        inList = false;
      } else if (trimmed.startsWith('\\item')) {
        const itemText = trimmed.replace(/^\\item\s*/, '');
        html += `<li>${injectConceptLinks(cleanLatexText(itemText), activeConns)}</li>`;
      } else if (inList) {
        html = html.replace(/<\/li>$/, ` ${injectConceptLinks(cleanLatexText(trimmed), activeConns)}</li>`);
      } else {
        html += `<p class="a4-paragraph latex-paragraph">${injectConceptLinks(cleanLatexText(trimmed), activeConns)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }
  return injectConceptLinks(cleanLatexText(rawContent), activeConns);
}

/**
 * Main parser function: converts raw LaTeX string into a structured JavaScript object
 */
export function parseLatexNotes(rawTex, chapterConnections = []) {
  if (!rawTex) return null;

  const activeConns = chapterConnections.length > 0 ? chapterConnections : [];

  // Fallback to Markdown Short Notes parser if raw content is not LaTeX
  if (!rawTex.includes('\\section{') && !rawTex.includes('\\documentclass')) {
    return parseMarkdownShortNotes(rawTex, activeConns);
  }

  // Extract Document Title and Subtitle using balanced brace parser
  let docTitle = 'Detailed Revision Notes';
  let docSubtitle = '';

  const titleIdx = rawTex.indexOf('\\title');
  if (titleIdx !== -1) {
    const braceRes = extractBraceContent(rawTex, titleIdx);
    if (braceRes && braceRes.content) {
      const parts = braceRes.content.split(/\\\\/);
      if (parts.length > 0) {
        docTitle = cleanLatexText(parts[0].replace(/\\textbf\{([^}]+)\}/, '$1'));
      }
      if (parts.length > 1) {
        docSubtitle = cleanLatexText(parts[1]);
      }
    }
  }

  // Parse Sections
  const sections = [];
  const rawSections = rawTex.split(/\\section\{/);

  // Skip preamble (index 0)
  for (let i = 1; i < rawSections.length; i++) {
    const rawSec = rawSections[i];
    const titleEndIdx = rawSec.indexOf('}');
    if (titleEndIdx === -1) continue;

    const secTitleRaw = rawSec.substring(0, titleEndIdx).trim();
    const secBody = rawSec.substring(titleEndIdx + 1);

    // Section Number & Slug
    const secNumber = i;
    const secSlug = secTitleRaw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Parse Takeaway tcolorbox if present
    let takeaway = null;
    const tcolorboxMatch = secBody.match(/\\begin\{tcolorbox\}\[([\s\S]*?)\]([\s\S]*?)\\end\{tcolorbox\}/);
    if (tcolorboxMatch) {
      const boxConfig = tcolorboxMatch[1];
      const boxContent = tcolorboxMatch[2].trim();

      // Extract title
      let boxTitle = 'Key Takeaway';
      const titlePropMatch = boxConfig.match(/title=\{?([^,\]}]+)\}?/);
      if (titlePropMatch) {
        boxTitle = titlePropMatch[1].replace(/^\{+/, '').replace(/\}+$/, '').trim();
      }

      // Extract color
      let boxColor = 'blue';
      if (boxConfig.includes('green')) boxColor = 'green';
      else if (boxConfig.includes('red')) boxColor = 'red';
      else if (boxConfig.includes('orange')) boxColor = 'orange';
      else if (boxConfig.includes('purple')) boxColor = 'purple';
      else if (boxConfig.includes('teal')) boxColor = 'teal';
      else if (boxConfig.includes('gray')) boxColor = 'gray';

      takeaway = {
        title: boxTitle,
        color: boxColor,
        content: parseBoxContent(boxContent, activeConns),
      };
    }

    // Parse Subsections
    const subsections = [];
    const rawSubsections = secBody.split(/\\subsection\{/);

    // Any content before the first subsection
    const preSubElements = parseSubBody(rawSubsections[0], activeConns);
    if (preSubElements.length > 0) {
      subsections.push({
        title: '',
        number: '',
        elements: preSubElements,
      });
    }

    for (let j = 1; j < rawSubsections.length; j++) {
      const rawSub = rawSubsections[j];
      const subTitleEndIdx = rawSub.indexOf('}');
      if (subTitleEndIdx === -1) continue;

      const subTitleRaw = rawSub.substring(0, subTitleEndIdx).trim();
      const subBody = rawSub.substring(subTitleEndIdx + 1);
      const subElements = parseSubBody(subBody, activeConns);

      subsections.push({
        title: cleanLatexText(subTitleRaw),
        number: `${secNumber}.${j}`,
        elements: subElements,
      });
    }

    sections.push({
      number: secNumber,
      id: secSlug,
      title: cleanLatexText(secTitleRaw),
      takeaway,
      subsections,
    });
  }

  return {
    title: docTitle,
    subtitle: docSubtitle,
    sections,
  };
}

/**
 * Universal Markdown Short Notes Parser
 * Converts structured Markdown revision notes (#, ##, >, -, *) into clean LaTeX revision card sections
 */
export function parseMarkdownShortNotes(rawMd, chapterConnections = []) {
  if (!rawMd) return null;
  const activeConns = chapterConnections.length > 0 ? chapterConnections : [];

  let title = 'Revision Notes';
  let subtitle = '';

  const lines = rawMd.split('\n');
  const sections = [];
  let currentSection = null;
  let currentSubsection = null;
  let secCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Check for H1 (# Title)
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').replace(/[*_#\\]/g, '').trim();
      continue;
    }

    // Check for H2 (## Section Title)
    if (line.startsWith('## ')) {
      const secTitle = line.replace(/^##\s+/, '').replace(/[*_#\\]/g, '').trim();
      const secSlug = secTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      currentSection = {
        number: `${secCounter++}`,
        id: secSlug,
        title: secTitle,
        takeaway: null,
        subsections: [],
      };
      sections.push(currentSection);
      currentSubsection = null;
      continue;
    }

    // If no section created yet, create a default first section
    if (!currentSection) {
      currentSection = {
        number: '1',
        id: 'overview-summary',
        title: 'Core Synthesis & Takeaways',
        takeaway: null,
        subsections: [],
      };
      sections.push(currentSection);
      secCounter = 2;
    }

    // Check for H3 (### Subsection Title)
    if (line.startsWith('### ')) {
      const subTitle = line.replace(/^###\s+/, '').replace(/[*_#\\]/g, '').trim();
      currentSubsection = {
        title: subTitle,
        number: '',
        elements: [],
      };
      currentSection.subsections.push(currentSubsection);
      continue;
    }

    // Check for Blockquote / Takeaway (> ...)
    if (line.startsWith('>')) {
      const quoteText = line.replace(/^>\s*/, '').trim();
      const cleaned = quoteText.replace(/^\*\*([^*]+)\*\*[:\s]*/i, '');
      const boxTitle = quoteText.match(/^\*\*([^*]+)\*\*/)?.[1] || 'Key Takeaway';
      const parsedInline = marked.parseInline ? marked.parseInline(cleaned) : cleaned;
      currentSection.takeaway = {
        title: boxTitle,
        color: 'blue',
        content: `<p class="latex-paragraph">${injectConceptLinks(parsedInline, activeConns)}</p>`,
      };
      continue;
    }

    // Ensure we have a current subsection for elements
    if (!currentSubsection) {
      currentSubsection = {
        title: '',
        number: '',
        elements: [],
      };
      currentSection.subsections.push(currentSubsection);
    }

    // Check bullet list item (- , * )
    if (/^[-*]\s+/.test(line)) {
      const itemContent = line.replace(/^[-*]\s+/, '');
      const parsed = marked.parseInline ? marked.parseInline(itemContent) : itemContent;
      currentSubsection.elements.push({
        type: 'item',
        content: injectConceptLinks(parsed, activeConns),
      });
      continue;
    }

    // Check numbered list item (1. )
    if (/^\d+\.\s+/.test(line)) {
      const itemContent = line.replace(/^\d+\.\s+/, '');
      const parsed = marked.parseInline ? marked.parseInline(itemContent) : itemContent;
      currentSubsection.elements.push({
        type: 'numbered-item',
        content: injectConceptLinks(parsed, activeConns),
      });
      continue;
    }

    // Regular paragraph
    const parsed = marked.parseInline ? marked.parseInline(line) : line;
    currentSubsection.elements.push({
      type: 'paragraph',
      content: injectConceptLinks(parsed, activeConns),
    });
  }

  return {
    title,
    subtitle,
    sections,
  };
}

