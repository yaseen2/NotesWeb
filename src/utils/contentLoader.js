// src/utils/contentLoader.js - 100% Dynamic Content Loader for User Vault
 
import { getChapterEdits, getVaultSubjects } from './vaultManager';
import { getPdfObjectUrl, idbGet } from './db';

/**
 * Dynamically loads the raw content for a given subject and chapter from user vault
 */
export async function fetchChapterData(subjectId, chapterId) {
  if (!subjectId || !chapterId) {
    return {
      shortNotesRaw: '',
      longNotesRaw: '',
      pdfPath: null,
      concepts: [],
      isUpcoming: false,
      isEmptyVault: true,
    };
  }

  const hasActualEdits = !!localStorage.getItem(`notesweb_edits_${subjectId}_${chapterId}`);
  let customEdits = getChapterEdits(subjectId, chapterId);

  // If not found in localStorage (e.g. storage quota hit), query IndexedDB directly
  if (!customEdits) {
    try {
      customEdits = await idbGet('edits', `${subjectId}_${chapterId}`);
    } catch (e) {}
  }

  // Fallback to chapter data stored directly in the vault
  const subjects = getVaultSubjects();
  const subject = subjects.find((s) => s.id === subjectId);
  const chapter = subject?.chapters?.find((c) => c.id === chapterId);

  let pdfPath = customEdits?.pdfPath || chapter?.pdfPath || null;

  // Restore live PDF Object URL from IndexedDB if binary blob is persisted
  try {
    const liveBlobUrl = await getPdfObjectUrl(chapterId);
    if (liveBlobUrl) {
      pdfPath = liveBlobUrl;
    }
  } catch (e) {}

  if (customEdits) {
    return {
      shortNotesRaw: customEdits.shortNotesRaw || '',
      longNotesRaw: customEdits.longNotesRaw || '',
      pdfPath,
      concepts: [],
      isUpcoming: false,
      hasUserEdits: hasActualEdits || !!customEdits,
    };
  }

  return {
    shortNotesRaw: chapter?.shortNotesRaw || '',
    longNotesRaw: chapter?.longNotesRaw || '',
    pdfPath,
    concepts: [],
    isUpcoming: false,
    isEmptyVault: false,
  };
}
