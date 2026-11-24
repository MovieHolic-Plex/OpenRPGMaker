// 편집기 공용 썸네일 캐시 — 공간 카드·맵 미리보기 격자·조수 그림 읽기 도구가 한 캐시를 쓴다.
//
// 왜 내용 해시 키인가: 예전 공간 카드 캐시는 «프로젝트 객체 정체성» 세대였다. 스토어 편집은 프로젝트를
// 통째로 복제하므로 맵 한 칸을 칠해도, 조수가 무엇을 써도 오브젝트 썸네일 전부가 무효가 됐고
// 앱을 다시 켜면 처음부터 다시 구웠다(qa1124 실측: 오브젝트 탭 첫 열기 새 캔버스 267개·longtask 6.3초).
// 키가 그림의 재료(타일셋 그림 + 정의) 해시면 재료가 같은 한 그림도 같다 — 무효화가 필요 없다.
//
// 저장은 두 층이다.
//  - 메모리 LRU: 키 → blob URL. 화면에는 `<img src=blob:>` 만 붙인다(캔버스 0).
//  - IndexedDB `oprn-thumbs`: 키 → PNG Blob. 앱을 다시 켜도 적중한다.
// 캐시는 언제나 버려도 되는 사본이다. 읽기·쓰기가 실패하면 다시 굽는다(tilesetBlobCache.ts 와 같은 계약).
//
// 키 규칙(다른 화면도 같은 접두사를 쓴다):
//  - 오브젝트: `obj:<tilesetAssetHash>:<defHash>` · size = 배율
//  - 장소·지역: `place:<designContentHash>` · size = 픽셀 크기
//  - 맵: `map:<mapId>:<mapRevision>` · size = 픽셀 크기
// 실제 저장 키는 `${key}@${size}` 다.

const DB_NAME = "oprn-thumbs";
const STORE = "thumbs";
const AT_INDEX = "at";
/** 메모리 상한 — 장수와 바이트 둘 다. 넘으면 가장 오래 안 쓴 것부터 URL 을 돌려준다. */
const MEMORY_MAX_ENTRIES = 2_000;
const MEMORY_MAX_BYTES = 64 * 1024 * 1024;
/** 디스크 상한 — 넘으면 오래 안 쓴 것부터 지운다. 오브젝트 썸네일 한 장은 대개 1~4KB 다. */
const DISK_MAX_ENTRIES = 20_000;

type MemoryEntry = { readonly url: string; readonly bytes: number };
/** Blob 대신 바이트를 둔다 — 모든 IndexedDB 구현(테스트의 fake-indexeddb 포함)이 ArrayBuffer 는 복제한다. */
type StoredThumb = { readonly bytes: ArrayBuffer; readonly type: string; readonly at: number };

export type ThumbSource = "memory" | "disk" | "render";
export type ThumbResult = { readonly url: string; readonly source: ThumbSource };
export type ThumbRender = () => Blob | HTMLCanvasElement | null | Promise<Blob | HTMLCanvasElement | null>;

const memory = new Map<string, MemoryEntry>();
let memoryBytes = 0;
const inflight = new Map<string, Promise<ThumbResult | null>>();
let database: Promise<IDBDatabase | null> | undefined;
let pruneScheduled = false;
const stats = { memory: 0, disk: 0, render: 0, miss: 0 };
const pendingWrites = new Set<Promise<void>>();

/** 저장 키. 크기를 키에 넣어야 작은 그림이 큰 자리로 늘어나지 않는다. */
export function thumbStorageKey(key: string, size: string | number): string {
  return `${key}@${size}`;
}

/**
 * 문자열 내용 해시(cyrb53, 53비트) — 키 충돌이 곧 엉뚱한 그림이므로 32비트보다 넓게 잡는다.
 * 암호 해시가 아니다. 썸네일 키 전용이다.
 */
export function thumbContentHash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function canUseBlobUrls(): boolean {
  return typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
}

function remember(storageKey: string, blob: Blob): string | null {
  if (!canUseBlobUrls()) return null;
  const existing = memory.get(storageKey);
  if (existing) {
    memory.delete(storageKey);
    memory.set(storageKey, existing);
    return existing.url;
  }
  const url = URL.createObjectURL(blob);
  memory.set(storageKey, { url, bytes: blob.size });
  memoryBytes += blob.size;
  while ((memory.size > MEMORY_MAX_ENTRIES || memoryBytes > MEMORY_MAX_BYTES) && memory.size > 1) {
    const oldest = memory.entries().next();
    if (oldest.done) break;
    const [oldKey, entry] = oldest.value;
    memory.delete(oldKey);
    memoryBytes -= entry.bytes;
    // 이미 화면에 붙은 <img> 는 디코드된 그림을 계속 보인다. 다음 요청은 디스크에서 새 URL 을 받는다.
    URL.revokeObjectURL(entry.url);
  }
  return url;
}

/** 메모리에 있으면 바로 URL — 동기 경로(셸 재렌더)에서 캔버스 없이 그림을 붙일 때 쓴다. */
export function peekThumb(key: string, size: string | number): string | undefined {
  const storageKey = thumbStorageKey(key, size);
  const entry = memory.get(storageKey);
  if (!entry) return undefined;
  memory.delete(storageKey);
  memory.set(storageKey, entry);
  stats.memory += 1;
  return entry.url;
}

function openDatabase(): Promise<IDBDatabase | null> {
  return database ??= new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE);
        store.createIndex(AT_INDEX, "at");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 한 프레임에 들어온 디스크 조회는 트랜잭션 하나로 묶는다 — 카드 48장이 48 트랜잭션을 열지 않게. */
let readBatch: Map<string, ((blob: Blob | null) => void)[]> | null = null;

function readFromDisk(storageKey: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!readBatch) {
      readBatch = new Map();
      setTimeout(flushReadBatch, 0);
    }
    const waiters = readBatch.get(storageKey) ?? [];
    waiters.push(resolve);
    readBatch.set(storageKey, waiters);
  });
}

async function flushReadBatch(): Promise<void> {
  const batch = readBatch;
  readBatch = null;
  if (!batch) return;
  const found = new Map<string, Blob>();
  const db = await openDatabase();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        for (const storageKey of batch.keys()) {
          const request = store.get(storageKey);
          request.onsuccess = () => {
            const value = request.result as StoredThumb | undefined;
            if (value && value.bytes instanceof ArrayBuffer) found.set(storageKey, new Blob([value.bytes], { type: value.type }));
          };
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  for (const [storageKey, waiters] of batch) {
    const blob = found.get(storageKey) ?? null;
    for (const done of waiters) done(blob);
  }
  if (found.size > 0) touchOnDisk([...found.keys()]);
}

function touchOnDisk(storageKeys: readonly string[]): void {
  void openDatabase().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const at = Date.now();
      for (const storageKey of storageKeys) {
        const request = store.get(storageKey);
        request.onsuccess = () => {
          const value = request.result as StoredThumb | undefined;
          if (value) store.put({ ...value, at } satisfies StoredThumb, storageKey);
        };
      }
    } catch {
      /* 쓰기 실패는 다음 정리 순서만 바뀐다 */
    }
  });
}

function writeToDisk(storageKey: string, blob: Blob): void {
  const write = (async (): Promise<void> => {
    const db = await openDatabase();
    if (!db) return;
    const bytes = await blob.arrayBuffer();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ bytes, type: blob.type || "image/png", at: Date.now() } satisfies StoredThumb, storageKey);
        tx.oncomplete = () => { schedulePrune(); resolve(); };
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        /* quota / private mode — 메모리 캐시만 남는다 */
        resolve();
      }
    });
  })().catch(() => undefined);
  pendingWrites.add(write);
  void write.finally(() => pendingWrites.delete(write));
}

/** 디스크 쓰기가 모두 끝날 때까지 — 테스트와 측정이 «다시 켠 앱» 을 흉내 내기 전에 부른다. */
export async function thumbCacheIdle(): Promise<void> {
  while (pendingWrites.size > 0) await Promise.all([...pendingWrites]);
}

function schedulePrune(): void {
  if (pruneScheduled) return;
  pruneScheduled = true;
  setTimeout(() => {
    pruneScheduled = false;
    void pruneDisk();
  }, 5_000);
}

async function pruneDisk(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const count = store.count();
    count.onsuccess = () => {
      let excess = count.result - DISK_MAX_ENTRIES;
      if (excess <= 0) return;
      const cursor = store.index(AT_INDEX).openCursor();
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current || excess <= 0) return;
        current.delete();
        excess -= 1;
        current.continue();
      };
    };
  } catch {
    /* 정리는 다음 쓰기 때 다시 시도한다 */
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function" || canvas.width <= 0 || canvas.height <= 0) { resolve(null); return; }
    try {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    } catch {
      // 다른 출처 그림으로 더럽혀진 캔버스는 내보낼 수 없다 — 캐시하지 않는다.
      resolve(null);
    }
  });
}

/** 그려 둔 그림을 캐시에 넣는다. 같은 키의 다음 요청은 이 그림을 받는다. */
export async function putThumb(key: string, size: string | number, art: Blob | HTMLCanvasElement): Promise<string | null> {
  const blob = art instanceof Blob ? art : await canvasToBlob(art);
  if (!blob) return null;
  const storageKey = thumbStorageKey(key, size);
  writeToDisk(storageKey, blob);
  return remember(storageKey, blob);
}

/**
 * 비동기 조회 — 메모리 → 디스크 → `render`. `render` 가 없거나 null 이면 없는 것으로 돌려준다.
 * 같은 키를 동시에 부르면 한 번만 굽는다.
 */
export function getThumbResult(key: string, size: string | number, render?: ThumbRender): Promise<ThumbResult | null> {
  const storageKey = thumbStorageKey(key, size);
  const hit = memory.get(storageKey);
  if (hit) {
    memory.delete(storageKey);
    memory.set(storageKey, hit);
    stats.memory += 1;
    return Promise.resolve({ url: hit.url, source: "memory" });
  }
  const running = inflight.get(storageKey);
  if (running) return running;
  const work = (async (): Promise<ThumbResult | null> => {
    const stored = await readFromDisk(storageKey);
    if (stored) {
      const url = remember(storageKey, stored);
      if (url) {
        stats.disk += 1;
        return { url, source: "disk" };
      }
    }
    if (!render) {
      stats.miss += 1;
      return null;
    }
    const art = await render();
    if (!art) return null;
    const url = await putThumb(key, size, art);
    if (!url) return null;
    stats.render += 1;
    return { url, source: "render" };
  })().finally(() => inflight.delete(storageKey));
  inflight.set(storageKey, work);
  return work;
}

/** 계획서(qa1124-space)에서 맞춘 모양 — blob URL 만 필요한 호출자용. */
export async function getThumb(key: string, size: string | number, render?: ThumbRender): Promise<string | null> {
  return (await getThumbResult(key, size, render))?.url ?? null;
}

/** 접두사로 지운다(메모리 + 디스크). 예: 맵 하나의 옛 판본 `map:<mapId>:`. */
export async function invalidatePrefix(prefix: string): Promise<void> {
  for (const [storageKey, entry] of [...memory]) {
    if (!storageKey.startsWith(prefix)) continue;
    memory.delete(storageKey);
    memoryBytes -= entry.bytes;
    URL.revokeObjectURL(entry.url);
  }
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      // 문자열 키 범위: prefix 이상, prefix + U+FFFF 미만.
      tx.objectStore(STORE).delete(IDBKeyRange.bound(prefix, `${prefix}\uffff`, false, true));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 적중 계측 — 수용 기준(재시작 뒤 적중 ≥95%)을 화면 밖에서 잴 때 쓴다. */
export function thumbCacheStats(): Readonly<typeof stats> & { readonly entries: number; readonly bytes: number } {
  return { ...stats, entries: memory.size, bytes: memoryBytes };
}

/** 테스트 격리용 — 메모리만 비운다. 디스크(IndexedDB)는 «다시 켠 앱» 을 흉내 낼 때 남겨 둔다. */
export function resetThumbCacheMemory(): void {
  for (const entry of memory.values()) {
    if (canUseBlobUrls()) URL.revokeObjectURL(entry.url);
  }
  memory.clear();
  memoryBytes = 0;
  inflight.clear();
  readBatch = null;
  stats.memory = 0;
  stats.disk = 0;
  stats.render = 0;
  stats.miss = 0;
}

/** 테스트 격리용 — 열린 DB 연결도 잊는다(fake-indexeddb 를 새로 깔 때). */
export function resetThumbCacheForTests(): void {
  resetThumbCacheMemory();
  database = undefined;
}

if (typeof window !== "undefined") {
  // 측정 스크립트(브라우저)가 적중률을 읽는 창구. 기능 경로는 쓰지 않는다.
  (window as unknown as { __oprnThumbCacheStats?: typeof thumbCacheStats }).__oprnThumbCacheStats = thumbCacheStats;
}
