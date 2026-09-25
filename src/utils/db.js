// src/utils/db.js - Native Promise-based IndexedDB Storage Engine
// Provides high-capacity, persistent local storage for PDFs, note edits, and connection graphs.
// Immune to the 5MB localStorage limit and survives browser restarts.

const DB_NAME = 'NotesWeb_Vault_DB';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Initializes and upgrades the IndexedDB instance.
 */
export function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Vault metadata (subjects, chapters, settings)
      if (!db.objectStoreNames.contains('vault')) {
        db.createObjectStore('vault');
      }

      // 2. Note content & edits (keyed by `${subjectId}_${chapterId}`)
      if (!db.objectStoreNames.contains('edits')) {
        db.createObjectStore('edits');
      }

      // 3. Binary PDF storage (keyed by `chapterId`, stores raw Blobs/ArrayBuffers)
      if (!db.objectStoreNames.contains('pdfBlobs')) {
        db.createObjectStore('pdfBlobs');
      }

      // 4. Personal annotations & study notes
      if (!db.objectStoreNames.contains('annotations')) {
        db.createObjectStore('annotations');
      }

      // 5. Cross-tier connection links
      if (!db.objectStoreNames.contains('connections')) {
        db.createObjectStore('connections');
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Retrieves a value by key from a specific store
 */
export async function idbGet(storeName, key) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`idbGet failed on store ${storeName}:`, err);
    return null;
  }
}

/**
 * Stores a value by key in a specific store
 */
export async function idbSet(storeName, key, value) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`idbSet failed on store ${storeName}:`, err);
    return false;
  }
}

/**
 * Deletes a record by key
 */
export async function idbDelete(storeName, key) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`idbDelete failed on store ${storeName}:`, err);
    return false;
  }
}

/**
 * Retrieves all keys and values from a specific store
 */
export async function idbGetAll(storeName) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.openCursor();
      const results = {};

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          results[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`idbGetAll failed on store ${storeName}:`, err);
    return {};
  }
}

/**
 * Clears an entire object store
 */
export async function idbClear(storeName) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`idbClear failed on store ${storeName}:`, err);
    return false;
  }
}

/**
 * Helper to store a PDF binary blob for a chapter
 */
export async function savePdfBlob(chapterId, fileOrBlob) {
  if (!chapterId || !fileOrBlob) return null;
  await idbSet('pdfBlobs', chapterId, {
    blob: fileOrBlob,
    size: fileOrBlob.size,
    type: fileOrBlob.type || 'application/pdf',
    name: fileOrBlob.name || `${chapterId}.pdf`,
    savedAt: new Date().toISOString(),
  });
  return URL.createObjectURL(fileOrBlob);
}

/**
 * Helper to retrieve a PDF blob and generate a fresh live Object URL
 */
export async function getPdfObjectUrl(chapterId) {
  if (!chapterId) return null;
  const record = await idbGet('pdfBlobs', chapterId);
  if (record && record.blob) {
    return URL.createObjectURL(record.blob);
  }
  return null;
}
