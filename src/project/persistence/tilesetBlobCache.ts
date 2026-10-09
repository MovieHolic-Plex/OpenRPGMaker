/**
 * 타일셋 본문의 기기 캐시(IndexedDB). 키는 본문 글의 SHA-256 이라 판본 무효화가 필요 없다 — 내용이 바뀌면 키가 바뀐다.
 * 프로젝트가 달라도 공용·번들 타일셋은 같은 본문이므로 한 번 받으면 모든 프로젝트가 쓴다.
 * 캐시는 언제나 버려도 되는 사본이다: 읽기·쓰기가 실패하면 호스트에서 받는다(sharedContentCache.ts 와 같은 계약).
 */

const DB_NAME = "oprn-tileset-blobs";
const STORE = "blobs";
let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readTilesetBlobs(sha256s: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (sha256s.length === 0) return found;
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      for (const sha of sha256s) {
        const request = store.get(sha);
        request.onsuccess = () => { if (typeof request.result === "string") found.set(sha, request.result); };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    found.clear();
  }
  return found;
}

export async function writeTilesetBlobs(blobs: ReadonlyMap<string, string>): Promise<void> {
  if (blobs.size === 0) return;
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      for (const [sha, body] of blobs) store.put(body, sha);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* quota / private mode */
  }
}
