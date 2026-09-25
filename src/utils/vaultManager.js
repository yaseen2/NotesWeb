import { DEFAULT_VAULT } from '../data/defaultVault';
import {
  idbSet,
  idbGet,
  idbDelete,
  idbClear,
  savePdfBlob,
  getPdfObjectUrl,
} from './db';

const CUSTOM_VAULT_KEY = 'notesweb_custom_vault_v1';
const EDITS_PREFIX = 'notesweb_edits_';

/**
 * Syncs and mirrors localStorage data into IndexedDB on initialization
 */
export async function syncVaultWithIndexedDB() {
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      await idbSet('vault', 'custom_vault', parsed);
    }
    // Mirror any stored edits
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(EDITS_PREFIX)) {
        try {
          const val = JSON.parse(localStorage.getItem(k));
          await idbSet('edits', k.replace(EDITS_PREFIX, ''), val);
        } catch (e) {}
      }
    }
  } catch (e) {
    console.warn('Sync with IndexedDB skipped or partially complete:', e);
  }
}

/**
 * Get all subjects and chapters from user's vault (persisted in localStorage and mirrored in IndexedDB)
 */
export function getVaultSubjects() {
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.subjects)) {
        // Hydrate any missing properties (like pdfPath) from seed vault if defined
        if (parsed.subjects.length > 0 && DEFAULT_VAULT && Array.isArray(DEFAULT_VAULT.subjects)) {
          let updated = false;
          parsed.subjects.forEach((s) => {
            const defSub = DEFAULT_VAULT.subjects.find((ds) => ds.id === s.id);
            if (defSub && Array.isArray(s.chapters)) {
              s.chapters.forEach((c) => {
                const defCh = defSub.chapters?.find((dc) => dc.id === c.id);
                if (defCh?.pdfPath && !c.pdfPath) {
                  c.pdfPath = defCh.pdfPath;
                  updated = true;
                }
              });
            }
          });
          if (updated) {
            localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(parsed));
            idbSet('vault', 'custom_vault', parsed).catch(() => {});
          }
        }
        return parsed.subjects;
      }
    }
    // Only auto-seed on very first visit when raw is completely absent
    if (DEFAULT_VAULT && Array.isArray(DEFAULT_VAULT.subjects)) {
      localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(DEFAULT_VAULT));
      idbSet('vault', 'custom_vault', DEFAULT_VAULT).catch(() => {});
      return DEFAULT_VAULT.subjects;
    }
  } catch (e) {
    console.error('Failed to parse vault:', e);
  }
  return [];
}

/**
 * Completely clears the vault to zero subjects and zero notes across both LocalStorage and IndexedDB.
 */
export function clearVaultToZero() {
  try {
    localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify({ subjects: [] }));
    localStorage.removeItem('notesweb_user_connections_v2');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(EDITS_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    
    // Clear high-capacity IndexedDB stores
    idbClear('edits').catch(() => {});
    idbClear('vault').catch(() => {});
    idbClear('pdfBlobs').catch(() => {});
    idbClear('connections').catch(() => {});
    idbClear('annotations').catch(() => {});
    return true;
  } catch (e) {
    console.error('Failed to clear vault:', e);
    return false;
  }
}

/**
 * Restores the vault back to the default seed vault
 */
export function restoreDefaultSeedVault() {
  try {
    if (DEFAULT_VAULT && Array.isArray(DEFAULT_VAULT.subjects)) {
      localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(DEFAULT_VAULT));
      return true;
    }
  } catch (e) {
    console.error('Failed to restore seed vault:', e);
  }
  return false;
}

/**
 * Get custom edits/content for a chapter
 */
export function getChapterEdits(subjectId, chapterId) {
  try {
    const raw = localStorage.getItem(`${EDITS_PREFIX}${subjectId}_${chapterId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read chapter content:', e);
  }
  return null;
}

/**
 * Save user edits/content for a chapter
 */
export function saveChapterEdits(subjectId, chapterId, { shortNotesRaw, longNotesRaw }) {
  try {
    const payload = {
      shortNotesRaw,
      longNotesRaw,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`${EDITS_PREFIX}${subjectId}_${chapterId}`, JSON.stringify(payload));
    } catch (quotaErr) {
      console.warn('LocalStorage quota reached, relying on IndexedDB:', quotaErr);
    }
    // High capacity IndexedDB storage
    idbSet('edits', `${subjectId}_${chapterId}`, payload).catch(console.error);
    return true;
  } catch (e) {
    console.error('Failed to save chapter edits:', e);
    return false;
  }
}

/**
 * Reset edits for a chapter
 */
export function resetChapterEdits(subjectId, chapterId) {
  try {
    localStorage.removeItem(`${EDITS_PREFIX}${subjectId}_${chapterId}`);
    idbDelete('edits', `${subjectId}_${chapterId}`).catch(console.error);
    return true;
  } catch (e) {
    console.error('Failed to reset chapter edits:', e);
    return false;
  }
}

/**
 * Add a new custom chapter to a subject
 */
export function addCustomChapter(subjectId, chapterData) {
  let vault = { subjects: [] };
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {}

  if (!Array.isArray(vault.subjects)) {
    vault.subjects = [];
  }

  // Find or create subject
  let subject = vault.subjects.find((s) => s.id === subjectId);
  if (!subject) {
    subject = {
      id: subjectId || `subj_${Date.now()}`,
      title: subjectId ? subjectId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : 'General Study Notes',
      code: 'NOTES',
      description: 'User study collection',
      isCustom: true,
      chapters: [],
    };
    vault.subjects.push(subject);
  }

  const newChapter = {
    id: chapterData.id || `ch_${Date.now()}`,
    title: chapterData.title || 'Untitled Chapter',
    subtitle: chapterData.subtitle || 'Study Notes',
    period: chapterData.period || '',
    pdfPath: chapterData.pdfPath || null,
    isCustom: true,
  };

  subject.chapters.push(newChapter);
  localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(vault));
  idbSet('vault', 'custom_vault', vault).catch(console.error);

  // If a binary PDF file was provided, store it persistently in IndexedDB
  if (chapterData.pdfFile) {
    savePdfBlob(newChapter.id, chapterData.pdfFile).catch(console.error);
  }

  // Save content
  if (chapterData.shortNotesRaw || chapterData.longNotesRaw) {
    saveChapterEdits(subject.id, newChapter.id, {
      shortNotesRaw: chapterData.shortNotesRaw || '',
      longNotesRaw: chapterData.longNotesRaw || '',
    });
  }

  return { subject, chapter: newChapter };
}

/**
 * Add a new custom subject
 */
export function addCustomSubject(subjectData) {
  let vault = { subjects: [] };
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {}

  if (!Array.isArray(vault.subjects)) {
    vault.subjects = [];
  }

  const newSubject = {
    id: subjectData.id || `subj_${Date.now()}`,
    title: subjectData.title || 'New Subject',
    code: subjectData.code || 'CUSTOM',
    description: subjectData.description || 'Custom study notes collection',
    isCustom: true,
    chapters: [],
  };

  vault.subjects.push(newSubject);
  localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(vault));
  return newSubject;
}

/**
 * Delete a chapter from a subject
 */
export function deleteChapter(subjectId, chapterId) {
  let vault = { subjects: [] };
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {}

  if (Array.isArray(vault.subjects)) {
    const subject = vault.subjects.find((s) => s.id === subjectId);
    if (subject && Array.isArray(subject.chapters)) {
      subject.chapters = subject.chapters.filter((c) => c.id !== chapterId);
      localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(vault));
      localStorage.removeItem(`${EDITS_PREFIX}${subjectId}_${chapterId}`);
      idbSet('vault', 'custom_vault', vault).catch(console.error);
      idbDelete('edits', `${subjectId}_${chapterId}`).catch(console.error);
      idbDelete('pdfBlobs', chapterId).catch(console.error);
      return true;
    }
  }
  return false;
}

/**
 * Update a chapter's PDF path (e.g., when re-attaching a local file)
 */
export function updateChapterPdf(subjectId, chapterId, newPdfPath) {
  let vault = { subjects: [] };
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {}

  if (Array.isArray(vault.subjects)) {
    const subject = vault.subjects.find((s) => s.id === subjectId);
    if (subject && Array.isArray(subject.chapters)) {
      const chapter = subject.chapters.find((c) => c.id === chapterId);
      if (chapter) {
        chapter.pdfPath = newPdfPath;
        localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(vault));
        idbSet('vault', 'custom_vault', vault).catch(console.error);
        return true;
      }
    }
  }
  return false;
}

/**
 * Delete an entire subject and its chapters
 */
export function deleteSubject(subjectId) {
  let vault = { subjects: [] };
  try {
    const raw = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (raw) vault = JSON.parse(raw);
  } catch (e) {}

  if (Array.isArray(vault.subjects)) {
    const targetSub = vault.subjects.find((s) => s.id === subjectId);
    if (targetSub && Array.isArray(targetSub.chapters)) {
      targetSub.chapters.forEach((c) => {
        idbDelete('edits', `${subjectId}_${c.id}`).catch(console.error);
        idbDelete('pdfBlobs', c.id).catch(console.error);
        localStorage.removeItem(`${EDITS_PREFIX}${subjectId}_${c.id}`);
      });
    }

    vault.subjects = vault.subjects.filter((s) => s.id !== subjectId);
    localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(vault));
    idbSet('vault', 'custom_vault', vault).catch(console.error);
    return true;
  }
  return false;
}

/**
 * Export full vault data (notes, connections, and custom subjects) as a downloadable JSON object
 */
export function exportFullVaultData() {
  const exportData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    connections: {},
    edits: {},
    vault: null,
  };

  try {
    const conns = localStorage.getItem('notesweb_user_connections_v2');
    if (conns) exportData.connections = JSON.parse(conns);
  } catch (e) {}

  try {
    const vault = localStorage.getItem(CUSTOM_VAULT_KEY);
    if (vault) exportData.vault = JSON.parse(vault);
  } catch (e) {}

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(EDITS_PREFIX)) {
      try {
        exportData.edits[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {}
    }
  }

  return exportData;
}

/**
 * Import vault backup data
 */
export function importFullVaultData(jsonData) {
  try {
    const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

    if (data.connections) {
      localStorage.setItem('notesweb_user_connections_v2', JSON.stringify(data.connections));
    }
    if (data.vault) {
      localStorage.setItem(CUSTOM_VAULT_KEY, JSON.stringify(data.vault));
    }
    if (data.edits) {
      Object.entries(data.edits).forEach(([key, val]) => {
        localStorage.setItem(key, JSON.stringify(val));
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
