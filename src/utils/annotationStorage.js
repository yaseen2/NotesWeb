// src/utils/annotationStorage.js - Local-first personal study comments and annotations storage (Edge-style)
// Persists student annotations, mnemonics, and takeaways per subject and chapter.

const STORAGE_KEY_PREFIX = 'notesweb_annotations_';

function getKey(subjectId, chapterId) {
  return `${STORAGE_KEY_PREFIX}${subjectId || 'default'}_${chapterId || 'default'}`;
}

/**
 * Loads all annotations for a subject chapter
 */
export function getSavedAnnotations(subjectId, chapterId) {
  try {
    const raw = localStorage.getItem(getKey(subjectId, chapterId));
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('Failed to load annotations:', e);
    return {};
  }
}

/**
 * Finds an annotation by conceptId or normalized phrase match
 */
export function findAnnotationByConceptOrPhrase(annotations, conceptId, phrase) {
  if (!annotations || typeof annotations !== 'object') return null;

  // 1. Direct conceptId lookup
  if (conceptId && annotations[conceptId]?.text?.trim()) {
    return { id: conceptId, ...annotations[conceptId] };
  }

  // 2. Normalized phrase lookup fallback
  const pTarget = (phrase || '').toLowerCase().trim();
  if (!pTarget) return null;

  const entry = Object.entries(annotations).find(([_, a]) => {
    if (!a?.text?.trim()) return false;
    const p = (a?.phrase || '').toLowerCase().trim();
    if (!p) return false;
    return p === pTarget || pTarget.includes(p) || p.includes(pTarget);
  });

  if (entry) {
    return { id: entry[0], ...entry[1] };
  }

  return null;
}

/**
 * Saves a personal note/comment for a specific concept
 */
export function saveAnnotation(subjectId, chapterId, conceptId, noteText, phrase = null) {
  try {
    const key = getKey(subjectId, chapterId);
    const existing = getSavedAnnotations(subjectId, chapterId);

    // If an annotation already exists for this exact phrase under another ID, reuse it
    if (phrase && !existing[conceptId]) {
      const pNorm = phrase.toLowerCase().trim();
      const existingKey = Object.keys(existing).find(
        (k) => (existing[k]?.phrase || '').toLowerCase().trim() === pNorm
      );
      if (existingKey) {
        conceptId = existingKey;
      }
    }

    if (!noteText || !noteText.trim()) {
      delete existing[conceptId];
    } else {
      existing[conceptId] = {
        text: noteText.trim(),
        phrase: phrase || existing[conceptId]?.phrase || null,
        updatedAt: new Date().toISOString(),
      };
    }

    localStorage.setItem(key, JSON.stringify(existing));

    // Dispatch global event for instant reactive cross-component synchronization
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('notesweb-annotations-updated', {
          detail: { subjectId, chapterId, annotations: existing },
        })
      );
    }

    return existing;
  } catch (e) {
    console.error('Failed to save annotation:', e);
    return {};
  }
}

/**
 * Deletes an annotation for a concept
 */
export function deleteAnnotation(subjectId, chapterId, conceptId) {
  return saveAnnotation(subjectId, chapterId, conceptId, '');
}

