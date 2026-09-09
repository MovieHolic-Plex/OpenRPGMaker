// ai/aiRecordDb.ts
// AI 기록(대화, 이어서 활동 로그)의 로컬 정본 — IndexedDB.
//
// 왜 localStorage 를 떠났나 (실측 2026-09-03): 대화 50건을 한 키에 통째로 다시 쓰다 오리진 한도(약 5MB)를
// 넘겨 `QuotaExceededError` 가 툴콜 스트리밍 도중 터졌고 조수 턴이 끊겼다. localStorage 는 동기라
// 메인 스레드를 막고, 키 하나를 재기록하는 구조라 레코드 하나가 자라면 전부 다시 쓴다.
// IndexedDB 는 비동기·레코드 단위·수백 MB 급이다. SQL 이 필요해지면 이 모듈 안쪽만 갈아 끼운다 —
// 바깥(conversationStore)은 store 이름과 id 로만 말한다.
//
// 폴백: IndexedDB 가 없거나(Node 테스트) 열기가 실패하면(일부 프라이빗 모드) 이 세션은 메모리 Map 으로
// 산다. 호출자는 `writeAiRecords` 가 돌려주는 backend 종류로 «새로 고침 뒤에도 남는가» 를 안다.

export const AI_RECORD_DB_NAME = "oprn-ai-records";
export const AI_RECORD_DB_VERSION = 3;
export const AI_RECORD_STORES = { conversations: "conversations", runCheckpoints: "runCheckpoints" } as const;
export type AiRecordStoreName = (typeof AI_RECORD_STORES)[keyof typeof AI_RECORD_STORES];
export type AiRecordBackendKind = "indexeddb" | "memory";

interface AiRecordRow { readonly id: string }
interface ScopedAiRecordRow extends AiRecordRow { readonly projectContextKey?: string; readonly savedAt: number }
const TOMBSTONES = "conversationTombstones";
const memoryTombstones = new Set<string>();
const tombstoneKey = (id: string, scope: string | null): string => JSON.stringify([scope, id]);

let dbPromise: Promise<IDBDatabase | null> | null = null;
let openFailureWarned = false;
const memoryStores = new Map<AiRecordStoreName, Map<string, unknown>>();
const resetHooks = new Set<() => void>();

function memoryStore(store: AiRecordStoreName): Map<string, unknown> {
  let map = memoryStores.get(store);
  if (!map) {
    map = new Map();
    memoryStores.set(store, map);
  }
  return map;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(AI_RECORD_STORES.runCheckpoints)) {
    const store = db.createObjectStore(AI_RECORD_STORES.runCheckpoints, { keyPath: "id" });
    store.createIndex("conversationId", "conversationId");
    store.createIndex("projectContextKey", "projectContextKey");
    store.createIndex("savedAt", "savedAt");
  }
  if (!db.objectStoreNames.contains(TOMBSTONES)) db.createObjectStore(TOMBSTONES, { keyPath: "id" });
  if (!db.objectStoreNames.contains(AI_RECORD_STORES.conversations)) {
    const store = db.createObjectStore(AI_RECORD_STORES.conversations, { keyPath: "id" });
    store.createIndex("savedAt", "savedAt");
    store.createIndex("projectContextKey", "projectContextKey");
  }
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    if (typeof indexedDB === "undefined") return null;
    try {
      const request = indexedDB.open(AI_RECORD_DB_NAME, AI_RECORD_DB_VERSION);
      request.onupgradeneeded = () => upgrade(request.result);
      const db = await requestToPromise(request);
      // 다른 탭이 스키마를 올리면 이 연결을 놓아 준다 — 다음 호출이 새 버전으로 다시 연다.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      return db;
    } catch (error) {
      if (!openFailureWarned) {
        openFailureWarned = true;
        console.warn("[ai-records] IndexedDB 를 열 수 없어 이 세션의 AI 기록은 메모리에만 남습니다(새로 고치면 사라짐):", error);
      }
      return null;
    }
  })();
  return dbPromise;
}

/** 이 세션이 실제로 쓰는 저장소 종류. 열기 실패는 세션 내에서 다시 시도하지 않는다. */
export async function aiRecordBackendKind(): Promise<AiRecordBackendKind> {
  return (await openDatabase()) ? "indexeddb" : "memory";
}

export async function readAllAiRecords<T extends AiRecordRow>(store: AiRecordStoreName): Promise<T[]> {
  const db = await openDatabase();
  if (!db) return Array.from(memoryStore(store).values()) as T[];
  const transaction = db.transaction(store, "readonly");
  const rows = await requestToPromise(transaction.objectStore(store).getAll() as IDBRequest<T[]>);
  await transactionDone(transaction);
  return rows;
}

export async function readAiRecord<T extends AiRecordRow>(store: AiRecordStoreName, id: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return (memoryStore(store).get(id) as T | undefined) ?? null;
  const transaction = db.transaction(store, "readonly");
  const row = await requestToPromise(transaction.objectStore(store).get(id) as IDBRequest<T | undefined>);
  await transactionDone(transaction);
  return row ?? null;
}

/** 같은 id 는 덮어쓴다. 돌려주는 값은 실제로 쓴 저장소 — `memory` 면 새로 고침 뒤에 남지 않는다. */
export async function writeAiRecords<T extends AiRecordRow>(store: AiRecordStoreName, rows: readonly T[]): Promise<AiRecordBackendKind> {
  const db = await openDatabase();
  if (!db) {
    const map = memoryStore(store);
    for (const row of rows) map.set(row.id, row);
    return "memory";
  }
  if (rows.length === 0) return "indexeddb";
  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);
  for (const row of rows) objectStore.put(row);
  await transactionDone(transaction);
  return "indexeddb";
}

/** Atomic local checkpoint read/compare/write. Conversation callers must keep their tombstone-aware API. */
export async function mutateAiRecord(
  store: Exclude<AiRecordStoreName, typeof AI_RECORD_STORES.conversations>, id: string,
  update: (current: unknown) => AiRecordRow | null | undefined,
): Promise<{ readonly backend: AiRecordBackendKind; readonly written: boolean }> {
  const db = await openDatabase();
  if (!db) {
    const rows = memoryStore(store);
    const next = update(structuredClone(rows.get(id) ?? null));
    if (next === null) rows.delete(id);
    else if (next !== undefined) rows.set(id, structuredClone(next));
    return { backend: "memory", written: next !== undefined };
  }
  const transaction = db.transaction(store, "readwrite");
  // Subscribe before scheduling requests. Request success alone is not durable completion.
  const done = transactionDone(transaction);
  const rows = transaction.objectStore(store);
  let written = false;
  let callbackError: unknown;
  const request = rows.get(id);
  request.onsuccess = () => {
    try {
      const next = update(request.result ?? null);
      if (next === null) rows.delete(id);
      else if (next !== undefined) rows.put(next);
      written = next !== undefined;
    } catch (error) {
      callbackError = error;
      transaction.abort();
    }
  };
  try { await done; } catch (error) { throw callbackError ?? error; }
  return { backend: "indexeddb", written };
}

export async function deleteAiRecords(store: AiRecordStoreName, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDatabase();
  if (!db) {
    const map = memoryStore(store);
    for (const id of ids) map.delete(id);
    return;
  }
  const transaction = db.transaction(store, "readwrite");
  const objectStore = transaction.objectStore(store);
  for (const id of ids) objectStore.delete(id);
  await transactionDone(transaction);
}

export async function clearAiRecords(store: AiRecordStoreName): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    for (const row of memoryStore(store).values()) {
      const scoped = row as ScopedAiRecordRow;
      memoryTombstones.add(tombstoneKey(scoped.id, scoped.projectContextKey ?? null));
    }
    memoryStore(store).clear();
    return;
  }
  const transaction = db.transaction([store, TOMBSTONES], "readwrite");
  const cursor = transaction.objectStore(store).openCursor();
  cursor.onsuccess = () => {
    const current = cursor.result;
    if (!current) return;
    const row = current.value as ScopedAiRecordRow;
    transaction.objectStore(TOMBSTONES).put({ id: tombstoneKey(row.id, row.projectContextKey ?? null) });
    current.delete();
    current.continue();
  };
  await transactionDone(transaction);
}

/** Compare/write and deletion suppression share one readwrite transaction, including across tabs. */
export async function mutateScopedAiRecord<T extends ScopedAiRecordRow>(
  key: { readonly store: AiRecordStoreName; readonly id: string; readonly scope: string | null; readonly replaceEqual?: boolean;
    /** Synchronous admission against the value read inside this same transaction. */
    readonly admit?: (current: T | null) => boolean },
  update: ((current: T | null) => T) | null,
): Promise<{ readonly backend: AiRecordBackendKind; readonly written: boolean }> {
  const db = await openDatabase();
  const deletedKey = tombstoneKey(key.id, key.scope);
  const decide = (current: T | null, deleted: boolean): T | null | undefined => {
    if (update && key.admit && !key.admit(current)) return undefined;
    if (current && (current.projectContextKey ?? null) !== key.scope) return undefined;
    if (!update) return null;
    if (deleted) return undefined;
    const next = update(current);
    if (current && (current.savedAt > next.savedAt || (current.savedAt === next.savedAt && !key.replaceEqual))) return undefined;
    return next;
  };
  if (!db) {
    const rows = memoryStore(key.store);
    const next = decide((rows.get(key.id) as T | undefined) ?? null, memoryTombstones.has(deletedKey));
    if (next === null) { memoryTombstones.add(deletedKey); rows.delete(key.id); }
    else if (next) rows.set(key.id, structuredClone(next));
    return { backend: "memory", written: next !== undefined };
  }
  const transaction = db.transaction([key.store, TOMBSTONES], "readwrite");
  const done = transactionDone(transaction);
  const rows = transaction.objectStore(key.store);
  const tombstones = transaction.objectStore(TOMBSTONES);
  const currentRequest = rows.get(key.id) as IDBRequest<T | undefined>;
  const deletedRequest = tombstones.get(deletedKey);
  let written = false;
  // Requests execute in creation order; decide synchronously in the last callback to keep the transaction active.
  deletedRequest.onsuccess = () => {
    try {
      const next = decide(currentRequest.result ?? null, deletedRequest.result !== undefined);
      if (next === null) { tombstones.put({ id: deletedKey }); rows.delete(key.id); }
      else if (next) rows.put(next);
      written = next !== undefined;
    } catch (error) {
      transaction.abort();
      callbackError = error;
    }
  };
  let callbackError: unknown;
  try { await done; } catch (error) { throw callbackError ?? error; }
  return { backend: "indexeddb", written };
}

export async function isScopedAiRecordDeleted(id: string, scope: string | null): Promise<boolean> {
  const db = await openDatabase();
  const key = tombstoneKey(id, scope);
  if (!db) return memoryTombstones.has(key);
  const transaction = db.transaction(TOMBSTONES, "readonly");
  const done = transactionDone(transaction);
  const row = await requestToPromise(transaction.objectStore(TOMBSTONES).get(key));
  await done;
  return row !== undefined;
}

/** 저장소 모듈이 세션 단위 상태(이관 표식 등)를 리셋 때 함께 비우도록 등록한다. */
export function registerAiRecordDbResetHook(hook: () => void): void {
  resetHooks.add(hook);
}

/** 테스트 전용 — 연결 캐시·메모리 폴백·경고 표식을 비운다. 테스트마다 새 `indexedDB` 세계를 쓸 때 부른다. */
export function resetAiRecordDbForTest(): void {
  const pending = dbPromise;
  dbPromise = null;
  openFailureWarned = false;
  memoryStores.clear();
  memoryTombstones.clear();
  for (const hook of resetHooks) hook();
  void pending?.then((db) => db?.close()).catch(() => undefined);
}
