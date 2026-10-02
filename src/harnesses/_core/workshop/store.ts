/**
 * 공방 저장소 — 이 기기의 IndexedDB `oprn-workshop`. 후보는 고르기 전까지 프로젝트 정본이 아니라서
 * 문서 밖에 둔다(정본에 들어가는 것은 2단계의 칩셋 굽기 결과뿐). 범위 키는 조수 대화와 같은 conversationScopeKey.
 * IndexedDB 가 없거나 열기가 실패하면 메모리로 산다 — 호출자는 backend 로 「새로 고침 뒤에도 남는가」를 안다.
 */
import type { ItemDefinition, WorkshopFeedback, WorkshopPick, WorkshopRound } from "./types";

export const WORKSHOP_DB_NAME = "oprn-workshop";
const DB_VERSION = 1;
const STORE_NAMES = ["rounds", "picks", "feedback", "items"] as const;
type StoreName = (typeof STORE_NAMES)[number];
type Row = { readonly id: string; readonly projectKey: string };
type ItemRow = Row & { readonly def: ItemDefinition };
type PickRow = Row & WorkshopPick;

export interface WorkshopStore {
  readonly backend: "indexeddb" | "memory";
  listRounds(projectKey: string): Promise<WorkshopRound[]>;
  getRound(id: string): Promise<WorkshopRound | null>;
  putRound(round: WorkshopRound): Promise<void>;
  deleteRound(id: string): Promise<void>;
  listPicks(projectKey: string): Promise<WorkshopPick[]>;
  putPick(pick: WorkshopPick): Promise<void>;
  deletePick(projectKey: string, itemKey: string): Promise<void>;
  listFeedback(projectKey: string, itemKey?: string): Promise<WorkshopFeedback[]>;
  addFeedback(entry: WorkshopFeedback): Promise<void>;
  listItemDefs(projectKey: string): Promise<ItemDefinition[]>;
  putItemDef(projectKey: string, def: ItemDefinition): Promise<void>;
}

interface Backend {
  all<T extends Row>(store: StoreName, projectKey: string): Promise<T[]>;
  get<T extends Row>(store: StoreName, id: string): Promise<T | null>;
  put(store: StoreName, row: Row): Promise<void>;
  del(store: StoreName, id: string): Promise<void>;
}

const pickId = (projectKey: string, itemKey: string): string => `${projectKey}\n${itemKey}`;

function storeOver(backend: Backend, kind: WorkshopStore["backend"]): WorkshopStore {
  const byCreated = (a: WorkshopRound, b: WorkshopRound) => a.created - b.created || a.id.localeCompare(b.id);
  return {
    backend: kind,
    listRounds: async (projectKey) => (await backend.all<WorkshopRound>("rounds", projectKey)).sort(byCreated),
    getRound: (id) => backend.get<WorkshopRound>("rounds", id),
    putRound: (round) => backend.put("rounds", round),
    deleteRound: (id) => backend.del("rounds", id),
    listPicks: async (projectKey) => (await backend.all<PickRow>("picks", projectKey))
      .map(({ projectKey: p, itemKey, roundId, letter, at }) => ({ projectKey: p, itemKey, roundId, letter, at })),
    putPick: (pick) => backend.put("picks", { ...pick, id: pickId(pick.projectKey, pick.itemKey) }),
    deletePick: (projectKey, itemKey) => backend.del("picks", pickId(projectKey, itemKey)),
    listFeedback: async (projectKey, itemKey) => (await backend.all<WorkshopFeedback>("feedback", projectKey))
      .filter((entry) => itemKey === undefined || entry.itemKey === itemKey)
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    addFeedback: (entry) => backend.put("feedback", entry),
    listItemDefs: async (projectKey) => (await backend.all<ItemRow>("items", projectKey)).map((row) => row.def),
    putItemDef: (projectKey, def) => {
      const row: ItemRow = { id: pickId(projectKey, def.key), projectKey, def };
      return backend.put("items", row);
    },
  };
}

export function createMemoryWorkshopStore(): WorkshopStore {
  const maps = new Map<StoreName, Map<string, Row>>(STORE_NAMES.map((name) => [name, new Map()]));
  const map = (name: StoreName) => maps.get(name)!;
  return storeOver({
    all: async <T extends Row>(name: StoreName, projectKey: string) =>
      [...map(name).values()].filter((row) => row.projectKey === projectKey).map((row) => structuredClone(row) as T),
    get: async <T extends Row>(name: StoreName, id: string) => {
      const row = map(name).get(id);
      return row ? (structuredClone(row) as T) : null;
    },
    put: async (name, row) => { map(name).set(row.id, structuredClone(row)); },
    del: async (name, id) => { map(name).delete(id); },
  }, "memory");
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 요청 실패"));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(WORKSHOP_DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORE_NAMES) {
        if (req.result.objectStoreNames.contains(name)) continue;
        req.result.createObjectStore(name, { keyPath: "id" }).createIndex("projectKey", "projectKey");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 열기 실패"));
    req.onblocked = () => reject(new Error("IndexedDB 열기가 막혔다(다른 탭이 옛 버전을 쥐고 있다)"));
  });
}

function idbBackend(db: IDBDatabase): Backend {
  const store = (name: StoreName, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    all: <T extends Row>(name: StoreName, projectKey: string) =>
      request(store(name, "readonly").index("projectKey").getAll(projectKey)) as Promise<T[]>,
    get: async <T extends Row>(name: StoreName, id: string) => ((await request(store(name, "readonly").get(id))) as T | undefined) ?? null,
    put: async (name, row) => { await request(store(name, "readwrite").put(row)); },
    del: async (name, id) => { await request(store(name, "readwrite").delete(id)); },
  };
}

export async function openWorkshopStore(factory: IDBFactory | null = globalThis.indexedDB ?? null): Promise<WorkshopStore> {
  if (!factory) return createMemoryWorkshopStore();
  try {
    return storeOver(idbBackend(await openDb(factory)), "indexeddb");
  } catch (error) {
    console.warn("[workshop] IndexedDB 를 열지 못해 이 세션은 메모리로 산다:", error);
    return createMemoryWorkshopStore();
  }
}
