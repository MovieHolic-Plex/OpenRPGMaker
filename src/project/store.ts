// project/store.ts
// 단일 Project 저장소. IndexedDB에 저장 + subscribe 단방향 알림 + 디바운스 자동저장.
// EditScene/패널 모두 이 store를 통해서만 Project를 갱신한다(단일 진실 원천).

import type { Project } from "./types";
import { createBlankProject } from "./defaults";
import { createDevShowcaseProjectForLocation } from "./devShowcaseProjects";
import { ensureBundledResourceProfiles, ensureBundledTilesets } from "./defaults/defaultAssets";

const DB_NAME = "rpg-zzu";
const STORE = "projects";
const KEY = "current";
const DB_VERSION = 1;
type Listener = (project: Project) => void;

// ── IndexedDB 얇은 래퍼 (외부 의존성 없음) ──
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value: Project): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function idbGet(): Promise<Project | undefined> {
  const db = await openDb();
  try {
    return await new Promise<Project | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as Project | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbClear(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// ── Store 싱글톤 ──
class ProjectStore {
  private current: Project;
  private listeners = new Set<Listener>();
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autoSaveDelayMs = 1000;
  private loaded = false;

  constructor() {
    this.current = createBlankProject();
  }

  // 앱 시작 시 호출. IDB에서 불러오거나 없으면 빈 프로젝트.
  async load(): Promise<Project> {
    try {
      const devShowcaseProject = createDevShowcaseProjectForLocation();
      if (devShowcaseProject) {
        this.current = devShowcaseProject;
        await this.persistCurrent();
        this.loaded = true;
        this.emit();
        return this.current;
      }
      const saved = await idbGet();
      if (saved && typeof saved.version === "number") {
        this.current = saved;
        const tilesetsChanged = ensureBundledTilesets(this.current);
        const resourceProfilesChanged = ensureBundledResourceProfiles(this.current);
        const changed = tilesetsChanged || resourceProfilesChanged;
        if (changed) await this.persistCurrent();
      }
    } catch (e) {
      console.warn("[store] 로드 실패, 빈 프로젝트로 시작:", e);
    }
    this.loaded = true;
    this.emit();
    return this.current;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getCurrent(): Project {
    return this.current;
  }

  // 외부에서 Project를 통째로 교체(가져오기 등).
  replace(project: Project): void {
    this.current = project;
    this.emit();
    this.scheduleAutoSave();
  }

  // mutator로 갱신. 단일 진실 원천 — 모든 쓰기는 이 경로로.
  update(mutator: (draft: Project) => void): void {
    // 깊은 복사로 초안 생성 후 mutator 적용. Phaser/DOM이 동일 참조를 공유하지 않도록.
    const draft: Project = structuredClone(this.current);
    mutator(draft);
    this.current = draft;
    this.emit();
    this.scheduleAutoSave();
  }

  // 즉시 저장(수동 저장 또는 Play 진입 전 확정 저장).
  async flush(): Promise<void> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    try {
      await this.persistCurrent();
    } catch (e) {
      console.error("[store] 저장 실패:", e);
      throw e;
    }
  }

  async clearAll(): Promise<void> {
    await idbClear();
    this.current = createBlankProject();
    this.emit();
  }

  // ── 구독 ──
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.current);
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.flush().catch(() => {/* 이미 로깅됨 */});
    }, this.autoSaveDelayMs);
  }

  private async persistCurrent(): Promise<void> {
    await idbPut(this.current);
  }
}

export const store = new ProjectStore();
