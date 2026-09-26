import type { SharedContentScope, SharedContentSnapshot } from "./sharedContentSchema";

/**
 * 공용 자료 응답의 기기 캐시(IndexedDB). 범위마다 마지막 판본 하나만 둔다.
 *
 * 왜 브라우저 HTTP 캐시가 아닌가(2026-09-27 실측): 호스트가 ETag·no-cache 를 줘도 같은 프로필의
 * 두 번째 부팅이 200 으로 전부 다시 받았다 — 압축을 푼 본문이 100MB 를 넘어 Chromium 디스크 캐시가
 * 저장하지 않는다. 그래서 판본(ETag)과 파싱된 스냅숏을 직접 들고, 요청에 If-None-Match 를 붙여
 * 304 면 이것을 쓴다. 저장은 structured clone 이라 다시 파싱하지 않는다.
 */
type CacheEntry = { readonly scope: SharedContentScope; readonly etag: string; readonly value: SharedContentSnapshot };

const DB_NAME = "oprn-shared-content";
const STORE = "responses";
let database: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB unavailable")); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: "scope" }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 없거나 읽을 수 없으면 null — 캐시는 언제나 버려도 되는 사본이다. */
export async function readSharedContentCache(scope: SharedContentScope): Promise<CacheEntry | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(scope);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        resolve(entry && typeof entry.etag === "string" && entry.value ? entry : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** 실패해도 부팅을 막지 않는다 — 다음 부팅이 다시 받을 뿐이다. */
export async function writeSharedContentCache(scope: SharedContentScope, etag: string, value: SharedContentSnapshot): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ scope, etag, value } satisfies CacheEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    /* quota / private mode */
  }
}
