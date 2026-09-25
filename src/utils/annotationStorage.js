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
 * Saves a personal note/comment for a specific concept
 */
export function saveAnnotation(subjectId, chapterId, conceptId, noteText, phrase = null) {
  try {
    const key = getKey(subjectId, chapterId);
    const existing = getSavedAnnotations(subjectId, chapterId);

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
