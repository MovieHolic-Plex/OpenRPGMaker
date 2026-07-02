import { createBlankProject } from "./defaults";
import { ensureSwitchVariableSlots } from "./defaults/defaultProject";
import { ensureBundledResourceProfiles, ensureBundledTilesets, removeLegacyRmTileset, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { repairInteriorTransparentPropLayers } from "./defaults/interiorTransparentPropLayerRepair";
import { ensureDefaultDatabaseIconResources } from "./defaults/defaultDatabaseIconResources";
import { loadDevProjectOverride, saveDevProjectOverride } from "./devProjectPersistence";
import { createDevShowcaseProjectForLocation } from "./devShowcaseProjects";
import {
  loadProjectFromSupabase,
  saveProjectMapPatchToSupabase,
  saveProjectToSupabase,
} from "./supabaseProjectSync";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { cacheSupabaseRootResources } from "@/assets/supabaseResourceCache";
import { dbPersistenceStatus, type DbPersistenceDisabledReason, type DbPersistenceStatus } from "./persistenceStatus";
import type { Project } from "./types";

type Listener = (project: Project) => void;

export type ProjectFlushResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "not-loaded" }
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly { readonly mapId: string; readonly name: string }[] }
  | { readonly kind: "saved" }
  | { readonly kind: "saved-local" };

export type ProjectDbReconnectResult =
  | { readonly kind: "connected"; readonly source: "remote" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "not-configured" };

export class DbConnectionRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbConnectionRequiredError";
  }
}

class ProjectStore {
  private current: Project;
  private listeners = new Set<Listener>();
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly autoSaveDelayMs = 15000;
  private loaded = false;
  private remotePersistenceEnabled = true;
  private remotePersistenceDisabledReason: DbPersistenceDisabledReason | null = null;
  private persistedBaseline: Project | null = null;

  constructor() {
    this.current = createBlankProject();
  }

  async load(): Promise<Project> {
    try {
      const devShowcaseProject = createDevShowcaseProjectForLocation();
      if (devShowcaseProject) {
        this.current = loadDevProjectOverride() ?? devShowcaseProject;
        this.remotePersistenceEnabled = false;
        this.remotePersistenceDisabledReason = "dev-showcase";
      } else {
        const status = dbPersistenceStatus({ disabledReason: null });
        if (status.kind === "not-configured") {
          this.remotePersistenceEnabled = false;
          this.remotePersistenceDisabledReason = null;
          this.persistedBaseline = null;
          throw new DbConnectionRequiredError("DB URL and anon key are required before opening a project.");
        } else {
          const project = await loadProjectFromSupabase();
          if (!project) {
            this.remotePersistenceEnabled = true;
            this.remotePersistenceDisabledReason = null;
            this.persistedBaseline = null;
            throw new DbConnectionRequiredError("No project row exists for the selected DB project ID.");
          }
          this.current = project;
          this.remotePersistenceEnabled = true;
          this.remotePersistenceDisabledReason = null;
          this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
        }
      }
      await this.normalizeCurrentProject();
      this.refreshSupabaseResourceCache();
    } catch (error) {
      if (error instanceof DbConnectionRequiredError) {
        this.loaded = false;
        throw error;
      }
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = "load-failed";
      console.error("[store] Supabase canonical project load failed:", error);
      throw error;
    }
    this.loaded = true;
    this.emit();
    return this.current;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // 테스트 전용: loaded 플래그와 원격 저장 활성화 상태를 직접 제어.
  // store.load()가 Supabase 네트워크/인증에 결합되어 있어 단위 테스트에서
  // flush()/persistCurrent() 경로만 격리하려 검증할 때 사용한다.
  /** @internal */
  _setPersistenceStateForTest(state: { loaded: boolean; remotePersistenceEnabled?: boolean; disabledReason?: DbPersistenceDisabledReason | null }): void {
    this.loaded = state.loaded;
    if (state.remotePersistenceEnabled !== undefined) this.remotePersistenceEnabled = state.remotePersistenceEnabled;
    if (state.disabledReason !== undefined) this.remotePersistenceDisabledReason = state.disabledReason;
  }

  getCurrent(): Project {
    return this.current;
  }

  getDbPersistenceStatus(): DbPersistenceStatus {
    return dbPersistenceStatus({ disabledReason: this.remotePersistenceDisabledReason });
  }

  async reconnectRemotePersistence(): Promise<ProjectDbReconnectResult> {
    const status = dbPersistenceStatus({ disabledReason: null });
    if (status.kind !== "ready") return { kind: "not-configured" };
    try {
      const project = await loadProjectFromSupabase();
      if (project) {
        this.current = project;
        this.remotePersistenceEnabled = true;
        this.remotePersistenceDisabledReason = null;
        await this.normalizeCurrentProject();
        this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
        this.emit();
        this.refreshSupabaseResourceCache();
        return { kind: "connected", source: "remote" };
      }
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      this.persistedBaseline = null;
      return { kind: "failed", message: "선택한 DB 프로젝트 ID에 프로젝트가 없습니다. 목록에서 기존 프로젝트를 선택하세요." };
    } catch (error) {
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = "load-failed";
      this.emit();
      return { kind: "failed", message: error instanceof Error ? error.message : "DB 연결 실패" };
    }
  }

  replace(project: Project): void {
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    this.current = project;
    this.emit();
    this.scheduleAutoSave();
  }

  update(mutator: (draft: Project) => void): void {
    const draft: Project = structuredClone(this.current);
    mutator(draft);
    ensureProjectMapConnections(draft);
    ensureSwitchVariableSlots(draft);
    removeLegacySpriteReferences(draft);
    this.current = draft;
    this.emit();
    this.scheduleAutoSave();
  }

  async flush(): Promise<ProjectFlushResult> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (!this.loaded) return { kind: "not-loaded" };
    if (!this.remotePersistenceEnabled && this.remotePersistenceDisabledReason === null) {
      return { kind: "not-configured" };
    }
    return await this.persistCurrent();
  }

  async clearAll(): Promise<void> {
    this.current = createBlankProject();
    this.emit();
    this.scheduleAutoSave();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.current);
  }

  private scheduleAutoSave(): void {
    if (!this.loaded) return;
    if (!this.remotePersistenceEnabled) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.persistCurrent().catch((error) => {
        console.error("[store] Supabase auto-save failed:", error);
      });
    }, this.autoSaveDelayMs);
  }

  private async persistCurrent(): Promise<ProjectFlushResult> {
    if (!this.remotePersistenceEnabled) {
      if (this.remotePersistenceDisabledReason === "dev-showcase") {
        saveDevProjectOverride(projectWithoutEventDrafts(this.current));
        return { kind: "saved-local" };
      }
      return this.remotePersistenceDisabledReason === null ? { kind: "not-configured" } : { kind: "disabled" };
    }
    const persistedProject = projectWithoutEventDrafts(this.current);
    const result = this.persistedBaseline
      ? await saveProjectMapPatchToSupabase({ project: persistedProject, baseProject: this.persistedBaseline })
      : await saveProjectToSupabase(persistedProject);
    if (result.kind === "not-configured") return result;
    if (result.kind === "conflict") return result;
    const savedProject = result.project ?? persistedProject;
    this.persistedBaseline = structuredClone(savedProject);
    if (result.project) {
      this.current = structuredClone(result.project);
      this.emit();
    }
    this.refreshSupabaseResourceCache();
    return result;
  }

  private async normalizeCurrentProject(): Promise<void> {
    const changed = [
      ensureProjectMapConnections(this.current),
      ensureSwitchVariableSlots(this.current),
      ensureBundledTilesets(this.current),
      repairInteriorTransparentPropLayers(this.current),
      removeLegacyRmTileset(this.current),
      removeLegacySpriteReferences(this.current),
      ensureBundledResourceProfiles(this.current),
      ensureDefaultDatabaseIconResources(this.current),
    ].some(Boolean);
    if (changed && this.remotePersistenceEnabled) await this.persistCurrent();
  }

  private refreshSupabaseResourceCache(): void {
    if (!this.remotePersistenceEnabled) return;
    void cacheSupabaseRootResources(this.current).catch((error) => {
      console.error("[store] Supabase resource cache refresh failed:", error);
    });
  }
}

export const store = new ProjectStore();

function ensureProjectMapConnections(project: Project): boolean {
  if (Array.isArray(project.mapConnections)) return false;
  project.mapConnections = [];
  return true;
}
