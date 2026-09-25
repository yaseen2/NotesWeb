// src/utils/highlightManager.js - Industrial W3C Text Quote Highlighting Engine
// Uses W3C Web Annotation Data Model (Exact + Prefix + Suffix) to make highlights resilient to note edits.

import { idbGet, idbSet, idbDelete } from './db';

const STORAGE_PREFIX = 'notesweb_highlights_v1_';

export const HIGHLIGHT_COLORS = [
  { id: 'amber', name: 'Amber', hex: '#fef08a', border: '#eab308' },
  { id: 'sage', name: 'Sage', hex: '#bbf7d0', border: '#22c55e' },
  { id: 'lavender', name: 'Lavender', hex: '#e9d5ff', border: '#a855f7' },
  { id: 'rose', name: 'Rose', hex: '#fecdd3', border: '#f43f5e' },
  { id: 'sky', name: 'Sky', hex: '#bae6fd', border: '#0284c7' },
];

function getKey(subjectId, chapterId) {
  return `${STORAGE_PREFIX}${subjectId || 'default'}_${chapterId || 'default'}`;
}

/**
 * Extracts W3C Text Quote Anchor from a DOM Range
 */
export function extractTextQuoteFromRange(range) {
  const exact = range.toString().trim();
  let prefix = '';
  let suffix = '';

  try {
    if (range.startContainer && range.startContainer.textContent) {
      const fullText = range.startContainer.textContent;
      const start = range.startOffset;
      prefix = fullText.slice(Math.max(0, start - 32), start).trim();
    }
    if (range.endContainer && range.endContainer.textContent) {
      const fullText = range.endContainer.textContent;
      const end = range.endOffset;
      suffix = fullText.slice(end, Math.min(fullText.length, end + 32)).trim();
    }
  } catch (e) {
    console.warn('Text quote context extraction error:', e);
  }

  return { exact, prefix, suffix };
}

/**
 * Loads all highlights for a chapter
 */
export function getSavedHighlights(subjectId, chapterId) {
  try {
    const raw = localStorage.getItem(getKey(subjectId, chapterId));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load highlights from localStorage:', e);
  }
  return [];
}

/**
 * Async loader querying IndexedDB as primary high-capacity store
 */
export async function getSavedHighlightsAsync(subjectId, chapterId) {
  const key = `${subjectId || 'default'}_${chapterId || 'default'}`;
  try {
    const fromIdb = await idbGet('annotations', `hl_${key}`);
    if (Array.isArray(fromIdb)) return fromIdb;
  } catch (e) {}
  return getSavedHighlights(subjectId, chapterId);
}

/**
 * Adds or updates a highlight
 */
export function saveHighlight(subjectId, chapterId, highlight) {
  const list = getSavedHighlights(subjectId, chapterId);
  const existingIdx = list.findIndex((h) => h.id === highlight.id);

  const record = {
    id: highlight.id || `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    subjectId,
    chapterId,
    color: highlight.color || 'amber',
    textQuote: highlight.textQuote, // { exact, prefix, suffix }
    annotation: highlight.annotation || '',
    targetAnchorId: highlight.targetAnchorId || null,
    createdAt: highlight.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx !== -1) {
    list[existingIdx] = record;
  } else {
    list.push(record);
  }

  try {
    localStorage.setItem(getKey(subjectId, chapterId), JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage full, persisting highlights in IndexedDB:', e);
  }

  idbSet('annotations', `hl_${subjectId}_${chapterId}`, list).catch(console.error);
  return list;
}

/**
 * Deletes a highlight
 */
export function deleteHighlight(subjectId, chapterId, highlightId) {
  const list = getSavedHighlights(subjectId, chapterId);
  const filtered = list.filter((h) => h.id !== highlightId);

  try {
    localStorage.setItem(getKey(subjectId, chapterId), JSON.stringify(filtered));
  } catch (e) {}

  idbSet('annotations', `hl_${subjectId}_${chapterId}`, filtered).catch(console.error);
  return filtered;
}

/**
 * Triple-Anchor Resolver: Locates a highlight even when document text has been edited
 * 
 * Strategy 1: Exact prefix + quote + suffix match (100% confidence)
 * Strategy 2: Exact quote match
 * Strategy 3: Normalized case-insensitive quote match
 */
export function resolveHighlightInText(documentText, highlight) {
  if (!documentText || !highlight || !highlight.textQuote) return null;

  const { exact, prefix, suffix } = highlight.textQuote;
  if (!exact) return null;

  // 1. Triple-Anchor Context Search
  if (prefix && suffix) {
    const fullContext = `${prefix}${exact}${suffix}`;
    const contextIdx = documentText.indexOf(fullContext);
    if (contextIdx !== -1) {
      const start = contextIdx + prefix.length;
      return { start, end: start + exact.length, strategy: 'context-exact' };
    }
  }

  // 2. Exact quote match
  const exactIdx = documentText.indexOf(exact);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + exact.length, strategy: 'exact' };
  }

  // 3. Case-insensitive normalized match
  const lowerDoc = documentText.toLowerCase();
  const lowerExact = exact.toLowerCase();
  const lowerIdx = lowerDoc.indexOf(lowerExact);
  if (lowerIdx !== -1) {
    return { start: lowerIdx, end: lowerIdx + exact.length, strategy: 'normalized' };
  }

  return null; // Highlight is orphaned
}
