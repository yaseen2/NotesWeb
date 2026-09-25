// src/utils/markdownParser.js - Generic, 100% Dynamic Markdown Parser with Universal Anchor Generation

import { marked } from 'marked';

// Helper to convert heading text to a clean URL-friendly anchor ID
export function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[*_`#]/g, '') // remove markdown bold/italic syntax
    .replace(/\\/g, '') // remove backslashes
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric to hyphen
    .replace(/(^-|-$)/g, ''); // trim leading/trailing hyphens
}

// Custom renderer for marked ensuring every heading has a clean, formatted title and unique slugified ID
const renderer = {
  heading({ text, depth }) {
    // Strip redundant markdown bold asterisks and unescape escaped parentheses/characters
    const cleanText = (text || '')
      .replace(/^\*\*([\s\S]+)\*\*$/, '$1')
      .replace(/^__([\s\S]+)__$/, '$1')
      .replace(/\\([()[\]{}*+?^$|#])/g, '$1')
      .trim();

    const slug = slugify(cleanText);
    const parsedText = marked.parseInline ? marked.parseInline(cleanText) : cleanText;
    return `<h${depth} id="${slug}" class="heading-anchor-target" data-heading-slug="${slug}">${parsedText}</h${depth}>`;
  },
};

marked.use({ renderer, gfm: true, breaks: true });

/**
 * Enhances raw markdown text with universal identifiable HTML anchors for concept deep-linking
 */
export function enhanceMarkdownWithAnchors(rawMarkdown) {
  if (!rawMarkdown) return '';

  let enhanced = rawMarkdown;

  // Automatically turn numbered bold lines (e.g. "**1. The Historical Context...**") into anchor targets
  enhanced = enhanced.replace(
    /(\n\s*)(\*\*\d+[\.\\)]\s*[\s\S]*?\*\*)(\s*\n)/g,
    (match, p1, p2, p3) => {
      const slug = slugify(p2);
      return `${p1}<div id="${slug}" class="long-note-anchor"></div>\n${p2}${p3}`;
    }
  );

  return enhanced;
}

/**
 * Parses and returns the final HTML string with anchor points
 */
export function parseLongNotesMarkdown(rawMarkdown) {
  const preparedMarkdown = enhanceMarkdownWithAnchors(rawMarkdown);
  return marked.parse(preparedMarkdown);
}
