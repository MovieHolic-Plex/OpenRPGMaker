const IDB_NAME = "rpg-zzu-sqlite";
const IDB_STORE = "sqlite-files";
const SQLITE_KEY = "tile-metadata";

export async function readSqliteBytes(): Promise<Uint8Array | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openIndexedDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(SQLITE_KEY);
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function writeSqliteBytes(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openIndexedDb();
  try {
    await txDone(db, "readwrite", (store) => {
      store.put(bytes, SQLITE_KEY);
    });
  } finally {
    db.close();
  }
}

export async function clearSqliteBytes(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openIndexedDb();
  try {
    await txDone(db, "readwrite", (store) => {
      store.delete(SQLITE_KEY);
    });
  } finally {
    db.close();
  }
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    action(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
