// src/editor/workshop/queue/jobStore.ts
/**
 * 공방 작업 줄 저장소 — 이 기기의 IndexedDB `oprn-workshop-jobs`(공방 판 저장소 `oprn-workshop` 과 따로: 판 저장소의 판본을 올리지 않는다).
 * jobs: 작업(범위 키 = 공방과 같은 conversationScopeKey) · packBlobs: 가져온 묶음의 그림 바이트(`<작업 id>\n<sha256>`).
 * 새로 고침·다시 열기 뒤에도 줄과 결과가 남는다. IndexedDB 를 못 열면 메모리로 산다(backend 로 알린다).
 */
import type { WorkshopJob } from "./jobModel";

export const JOB_DB_NAME = "oprn-workshop-jobs";
const DB_VERSION = 1;

export interface JobStore {
  readonly backend: "indexeddb" | "memory";
  listJobs(projectKey: string): Promise<WorkshopJob[]>;
  putJob(job: WorkshopJob): Promise<void>;
  deleteJob(id: string): Promise<void>;
  putPackBlobs(jobId: string, blobs: ReadonlyMap<string, Uint8Array>): Promise<void>;
  getPackBlobs(jobId: string): Promise<Map<string, Uint8Array>>;
  deletePackBlobs(jobId: string): Promise<void>;
}

type BlobRow = { readonly id: string; readonly jobId: string; readonly sha: string; readonly bytes: Uint8Array };

export function createMemoryJobStore(): JobStore {
  const jobs = new Map<string, WorkshopJob>();
  const blobs = new Map<string, BlobRow>();
  return {
    backend: "memory",
    listJobs: async (projectKey) => [...jobs.values()].filter((job) => job.projectKey === projectKey).map((job) => structuredClone(job)),
    putJob: async (job) => { jobs.set(job.id, structuredClone(job)); },
    deleteJob: async (id) => { jobs.delete(id); },
    putPackBlobs: async (jobId, map) => { for (const [sha, bytes] of map) blobs.set(`${jobId}\n${sha}`, { id: `${jobId}\n${sha}`, jobId, sha, bytes }); },
    getPackBlobs: async (jobId) => new Map([...blobs.values()].filter((row) => row.jobId === jobId).map((row) => [row.sha, row.bytes])),
    deletePackBlobs: async (jobId) => { for (const [key, row] of blobs) if (row.jobId === jobId) blobs.delete(key); },
  };
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 요청 실패"));
  });
}

function openDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(JOB_DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("jobs")) db.createObjectStore("jobs", { keyPath: "id" }).createIndex("projectKey", "projectKey");
      if (!db.objectStoreNames.contains("packBlobs")) db.createObjectStore("packBlobs", { keyPath: "id" }).createIndex("jobId", "jobId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 열기 실패"));
    req.onblocked = () => reject(new Error("IndexedDB 열기가 막혔다(다른 탭이 옛 버전을 쥐고 있다)"));
  });
}

export async function openJobStore(factory: IDBFactory | null = globalThis.indexedDB ?? null): Promise<JobStore> {
  if (!factory) return createMemoryJobStore();
  let db: IDBDatabase;
  try {
    db = await openDb(factory);
  } catch (error) {
    console.warn("[workshop-queue] IndexedDB 를 열지 못해 이 세션은 메모리로 산다:", error);
    return createMemoryJobStore();
  }
  const os = (name: "jobs" | "packBlobs", mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    backend: "indexeddb",
    listJobs: (projectKey) => request(os("jobs", "readonly").index("projectKey").getAll(projectKey)) as Promise<WorkshopJob[]>,
    putJob: async (job) => { await request(os("jobs", "readwrite").put(structuredClone(job))); },
    deleteJob: async (id) => { await request(os("jobs", "readwrite").delete(id)); },
    putPackBlobs: async (jobId, map) => {
      const tx = db.transaction("packBlobs", "readwrite");
      const store = tx.objectStore("packBlobs");
      for (const [sha, bytes] of map) store.put({ id: `${jobId}\n${sha}`, jobId, sha, bytes } satisfies BlobRow);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    },
    getPackBlobs: async (jobId) => {
      const rows = (await request(os("packBlobs", "readonly").index("jobId").getAll(jobId))) as BlobRow[];
      return new Map(rows.map((row) => [row.sha, row.bytes]));
    },
    deletePackBlobs: async (jobId) => {
      const keys = (await request(os("packBlobs", "readonly").index("jobId").getAllKeys(jobId))) as IDBValidKey[];
      const tx = db.transaction("packBlobs", "readwrite");
      for (const key of keys) tx.objectStore("packBlobs").delete(key);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    },
  };
}
