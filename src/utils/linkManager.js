// src/utils/linkManager.js - Algorithmic Universal Cross-Tier Connection Engine

import { slugify } from './markdownParser.js';
import { getVaultSubjects } from './vaultManager.js';

const STORAGE_KEY = 'notesweb_user_connections_v2';

// Universal English stop-words to eliminate generic filler words during matching
const STOP_WORDS = new Set([
  'the', 'of', 'in', 'and', 'to', 'a', 'an', 'is', 'was', 'are', 'were', 'for', 'on', 'at', 'by',
  'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
  'part', 'chapter', 'section', 'notes', 'era', 'detailed', 'revision', 'introduction', 'summary',
  'overview', 'act', 'movement', 'context', 'reforms', 'background'
]);

/**
 * Extracts normalized, unique semantic keyword tokens from a string.
 */
function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Parses all headings and anchor targets from raw Markdown (Long Notes).
 */
export function extractMarkdownTargets(longNotesRaw) {
  if (!longNotesRaw) return [];
  const targets = [];
  const lines = longNotesRaw.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let headingTitle = null;
    let inlineSnippet = '';

    // Check for Markdown headings: #, ##, ###, ####
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      headingTitle = headingMatch[1];
    } else {
      // Check for numbered or section bold headings: **Title** [optional text...]
      const boldHeadingMatch = line.match(/^\*\*([^*]{3,90})\*\*\s*(.*)$/);
      if (boldHeadingMatch) {
        headingTitle = boldHeadingMatch[1];
        inlineSnippet = boldHeadingMatch[2].replace(/[*_#\\]/g, '').trim();
      }
    }

    if (headingTitle) {
      const cleanTitle = headingTitle
        .replace(/[*_#\\]/g, '')
        .replace(/\s*\([^)]*\)/g, '')
        .trim();

      const fullCleanTitle = headingTitle.replace(/[*_#\\]/g, '').trim();
      const slug = slugify(fullCleanTitle);

      // Collect summary snippet (from inline remainder or subsequent paragraph)
      let snippet = inlineSnippet ? inlineSnippet.slice(0, 180) : '';
      if (!snippet) {
        for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('---')) {
            snippet = nextLine.replace(/[*_#\\]/g, '').slice(0, 180);
            break;
          }
        }
      }

      if (cleanTitle.length >= 3 && slug) {
        targets.push({
          rawTitle: fullCleanTitle,
          cleanTitle,
          slug,
          snippet,
          keywords: new Set(extractKeywords(cleanTitle)),
        });
      }
    }
  }

  return targets;
}

/**
 * Parses sections, subsections, and takeaways from raw LaTeX (Short Notes).
 */
export function extractLatexConcepts(shortNotesRaw) {
  if (!shortNotesRaw) return [];
  const concepts = [];

  // Match \section{...} blocks
  const secRegex = /\\section\{([^}]+)\}/g;
  let match;
  const sectionPositions = [];

  while ((match = secRegex.exec(shortNotesRaw)) !== null) {
    sectionPositions.push({
      title: match[1].replace(/\\/g, '').trim(),
      index: match.index,
    });
  }

  for (let s = 0; s < sectionPositions.length; s++) {
    const cur = sectionPositions[s];
    const nextIdx = s + 1 < sectionPositions.length ? sectionPositions[s + 1].index : shortNotesRaw.length;
    const secBody = shortNotesRaw.substring(cur.index, nextIdx);

    // Extract takeaway tcolorbox
    let takeawayTitle = '';
    let takeawaySummary = '';
    const tcbMatch = secBody.match(/\\begin\{tcolorbox\}\[([\s\S]*?)\]([\s\S]*?)\\end\{tcolorbox\}/);
    if (tcbMatch) {
      const titleProp = tcbMatch[1].match(/title=\{?([^,\]}]+)\}?/);
      takeawayTitle = titleProp ? titleProp[1].replace(/^\{+/, '').replace(/\}+$/, '').trim() : 'Key Takeaway';
      takeawaySummary = tcbMatch[2]
        .replace(/\\textbf\{([^}]+)\}/g, '$1')
        .replace(/\\textit\{([^}]+)\}/g, '$1')
        .replace(/[\\{}\n]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);
    }

    // Extract \textbf{...} terms in this section
    const boldTerms = [];
    const boldRegex = /\\textbf\{([^{}]+)\}/g;
    let bm;
    while ((bm = boldRegex.exec(secBody)) !== null) {
      const term = bm[1].replace(/\\/g, '').trim();
      if (term.length >= 3 && term.length <= 40 && !/^\d+$/.test(term)) {
        if (!boldTerms.includes(term)) boldTerms.push(term);
      }
    }

    // Extract \subsection{...}
    const subsections = [];
    const subRegex = /\\subsection\{([^}]+)\}/g;
    let subm;
    while ((subm = subRegex.exec(secBody)) !== null) {
      const subTitle = subm[1].replace(/\\/g, '').trim();
      const cleanSub = subTitle.replace(/\s*\([^)]*\)/g, '').trim();
      subsections.push({
        title: subTitle,
        cleanTitle: cleanSub,
        slug: slugify(cleanSub),
        keywords: new Set(extractKeywords(cleanSub)),
      });
    }

    const cleanSecTitle = cur.title.replace(/\s*\([^)]*\)/g, '').trim();
    const secSlug = slugify(cleanSecTitle);

    concepts.push({
      title: cur.title,
      cleanTitle: cleanSecTitle,
      slug: secSlug,
      takeawayTitle,
      takeawaySummary,
      boldTerms,
      subsections,
      keywords: new Set(extractKeywords(cleanSecTitle)),
    });
  }

  return concepts;
}

/**
 * Pure algorithmic matcher: dynamically links LaTeX concepts to Markdown target headings.
 * No hardcoded lists, IDs, or domain-specific logic. Works across any academic subject.
 */
export function autoDiscoverConnections(shortNotesRaw, longNotesRaw) {
  if (!shortNotesRaw || !longNotesRaw) return [];

  const mdTargets = extractMarkdownTargets(longNotesRaw);
  const latexConcepts = extractLatexConcepts(shortNotesRaw);

  if (mdTargets.length === 0 || latexConcepts.length === 0) return [];

  const connections = [];
  const linkedTargetSlugs = new Set();

  function scoreCandidate(itemKeywords, itemSlug, target) {
    let score = 0;
    if (itemSlug === target.slug) {
      score += 10;
    } else if (itemSlug.includes(target.slug) || target.slug.includes(itemSlug)) {
      score += 6;
    }
    let sharedCount = 0;
    itemKeywords.forEach((kw) => {
      if (target.keywords.has(kw)) sharedCount++;
    });
    if (itemKeywords.size > 0) {
      score += (sharedCount / Math.max(1, itemKeywords.size)) * 8;
    }
    return { score, sharedCount };
  }

  // 1. Match Sections
  latexConcepts.forEach((concept) => {
    let bestMatch = null;
    let highestScore = 0;

    mdTargets.forEach((target) => {
      const { score } = scoreCandidate(concept.keywords, concept.slug, target);
      if (score > highestScore && score >= 3.0) {
        highestScore = score;
        bestMatch = target;
      }
    });

    if (bestMatch) {
      linkedTargetSlugs.add(bestMatch.slug);

      const terms = [concept.cleanTitle];
      if (concept.title !== concept.cleanTitle) {
        terms.push(concept.title);
      }
      concept.boldTerms.slice(0, 3).forEach((bt) => {
        if (!terms.includes(bt)) terms.push(bt);
      });

      connections.push({
        id: `auto_${concept.slug}`,
        isAuto: true,
        isBuiltin: false,
        source: {
          text: concept.cleanTitle,
          terms,
          side: 'short',
          sectionId: concept.slug,
        },
        targets: [
          {
            targetSectionId: bestMatch.slug,
            title: bestMatch.rawTitle,
            summary: concept.takeawaySummary || bestMatch.snippet || '',
            snippet: bestMatch.snippet || '',
          },
        ],
      });
    }

    // 2. Also match Subsections if they strongly match targets
    concept.subsections.forEach((sub) => {
      let subBestMatch = null;
      let subHighestScore = 0;

      mdTargets.forEach((target) => {
        const { score } = scoreCandidate(sub.keywords, sub.slug, target);
        if (score > subHighestScore && score >= 3.5) {
          subHighestScore = score;
          subBestMatch = target;
        }
      });

      if (subBestMatch && !connections.some((c) => c.source.text.toLowerCase() === sub.cleanTitle.toLowerCase())) {
        linkedTargetSlugs.add(subBestMatch.slug);
        connections.push({
          id: `auto_${sub.slug}`,
          isAuto: true,
          isBuiltin: false,
          source: {
            text: sub.cleanTitle,
            terms: [sub.cleanTitle, sub.title],
            side: 'short',
            sectionId: concept.slug,
          },
          targets: [
            {
              targetSectionId: subBestMatch.slug,
              title: subBestMatch.rawTitle,
              summary: subBestMatch.snippet || '',
              snippet: subBestMatch.snippet || '',
            },
          ],
        });
      }
    });
  });

  return connections;
}

/**
 * Loads all saved user connections from localStorage
 */
export function loadAllUserConnections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    return {};
  } catch (e) {
    console.error('Failed to load user connections from localStorage:', e);
    return {};
  }
}

/**
 * Saves all user connections to localStorage
 */
export function saveAllUserConnections(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save user connections to localStorage:', e);
  }
}

/**
 * Returns connections for a chapter: user-customized if present, or dynamically auto-discovered.
 */
export function getChapterConnections(subjectId, chapterId, shortNotesRaw = '', longNotesRaw = '') {
  const key = `${subjectId}/${chapterId}`;
  const allUserConns = loadAllUserConnections();

  if (Array.isArray(allUserConns[key]) && allUserConns[key].length > 0) {
    return allUserConns[key];
  }

  let sRaw = shortNotesRaw;
  let lRaw = longNotesRaw;

  if (!sRaw || !lRaw) {
    try {
      const subjects = getVaultSubjects();
      const subject = subjects.find((s) => s.id === subjectId);
      const chapter = subject?.chapters?.find((c) => c.id === chapterId);
      if (chapter) {
        sRaw = sRaw || chapter.shortNotesRaw || '';
        lRaw = lRaw || chapter.longNotesRaw || '';
      }
    } catch (e) {}
  }

  if (sRaw && lRaw) {
    return autoDiscoverConnections(sRaw, lRaw);
  }

  return [];
}

/**
 * Adds or updates a user connection for a specific chapter
 */
export function addOrUpdateConnection(subjectId, chapterId, connection) {
  const key = `${subjectId}/${chapterId}`;
  const allUserConns = loadAllUserConnections();
  const chapterList = allUserConns[key] || [];

  const existingIdx = chapterList.findIndex((c) => c.id === connection.id);
  if (existingIdx !== -1) {
    chapterList[existingIdx] = connection;
  } else {
    chapterList.unshift({
      ...connection,
      id: connection.id || `conn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    });
  }

  allUserConns[key] = chapterList;
  saveAllUserConnections(allUserConns);
  return chapterList;
}

/**
 * Removes a user-created connection
 */
export function removeConnection(subjectId, chapterId, connectionId) {
  const key = `${subjectId}/${chapterId}`;
  const allUserConns = loadAllUserConnections();
  const chapterList = allUserConns[key] || [];

  const filtered = chapterList.filter((c) => c.id !== connectionId);
  allUserConns[key] = filtered;
  saveAllUserConnections(allUserConns);
  return filtered;
}

/**
 * Exports all user connections as a JSON string for backups
 */
export function exportConnectionsBackup() {
  const data = loadAllUserConnections();
  return JSON.stringify(data, null, 2);
}

/**
 * Imports user connections from a backup JSON string
 */
export function importConnectionsBackup(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    saveAllUserConnections(parsed);
    return true;
  } catch (e) {
    console.error('Invalid connection backup JSON:', e);
    return false;
  }
}

/**
 * Returns a dictionary of all connections across the entire vault
 */
export function getAllConnections() {
  const allUserConns = loadAllUserConnections();
  const merged = { ...allUserConns };

  try {
    const subjects = getVaultSubjects();
    subjects.forEach((sub) => {
      (sub.chapters || []).forEach((ch) => {
        const key = `${sub.id}/${ch.id}`;
        if (!merged[key] || merged[key].length === 0) {
          if (ch.shortNotesRaw && ch.longNotesRaw) {
            merged[key] = autoDiscoverConnections(ch.shortNotesRaw, ch.longNotesRaw);
          }
        }
      });
    });
  } catch (e) {}

  return merged;
}
