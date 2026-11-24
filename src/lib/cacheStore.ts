const DB_NAME = 'mc-pack-studio-cache';
const DB_VERSION = 1;
const STORE_TEXTURES = 'textures';
const STORE_EXTRA = 'extraFiles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TEXTURES)) {
        db.createObjectStore(STORE_TEXTURES);
      }
      if (!db.objectStoreNames.contains(STORE_EXTRA)) {
        db.createObjectStore(STORE_EXTRA);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSaveTexture(path: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEXTURES, 'readwrite');
    tx.objectStore(STORE_TEXTURES).put(blob, path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheDeleteTexture(path: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEXTURES, 'readwrite');
    tx.objectStore(STORE_TEXTURES).delete(path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheLoadAllTextures(): Promise<Map<string, Blob>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TEXTURES, 'readonly');
    const store = tx.objectStore(STORE_TEXTURES);
    const result = new Map<string, Blob>();
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        result.set(String(cursor.key), cursor.value as Blob);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSaveExtraFile(path: string, bytes: Uint8Array): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EXTRA, 'readwrite');
    tx.objectStore(STORE_EXTRA).put(bytes, path);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheLoadAllExtraFiles(): Promise<Map<string, Uint8Array>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EXTRA, 'readonly');
    const store = tx.objectStore(STORE_EXTRA);
    const result = new Map<string, Uint8Array>();
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        result.set(String(cursor.key), cursor.value as Uint8Array);
        cursor.continue();
      } else {
        resolve(result);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function cacheClearAll(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_TEXTURES, STORE_EXTRA], 'readwrite');
    tx.objectStore(STORE_TEXTURES).clear();
    tx.objectStore(STORE_EXTRA).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
