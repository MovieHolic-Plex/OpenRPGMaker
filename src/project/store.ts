import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { createBlankProject } from "./defaults";
import { ensureSwitchVariableSlots } from "./defaults/defaultProject";
import { ensureBundledResourceProfiles, ensureBundledTilesets, removeLegacyRmTileset, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { repairInteriorTransparentPropLayers } from "./defaults/interiorTransparentPropLayerRepair";
import { ensureScarloxyPokemonInteriors } from "./defaults/scarloxyPokemonInteriors";
import { ensureDefaultDatabaseIconResources } from "./defaults/defaultDatabaseIconResources";
import { loadDevProjectOverride, saveDevProjectOverride } from "./devProjectPersistence";
import {
  loadProjectFromSupabase,
  saveProjectMapPatchToSupabase,
  saveProjectToSupabase,
} from "./supabaseProjectSync";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { serialize } from "./io";
import {
  applyEventDraftVault,
  clearEventDraftVault,
  loadEventDraftVaultFromLocalStorage,
  persistEventDraftVaultNow,
  preserveEventDraftsOnProject,
  syncEventDraftVaultFromProject,
} from "./eventDraftVault";
import { cacheSupabaseRootResources } from "@/assets/supabaseResourceCache";
import { syncProjectToUrl } from "./projectUrl";
import {
  saveSupabaseProjectConfigDraft,
  supabaseProjectConfig,
  supabaseProjectConfigDraft,
  supabaseProjectConfigDraftWithSource,
  type SupabaseProjectConfigSource,
} from "./supabaseProjectConfig";
import { dbPersistenceStatus, type DbPersistenceDisabledReason, type DbPersistenceStatus } from "./persistenceStatus";
import { recordManualProjectCommitAfterSave, resetManualProjectCommitBaseline } from "./projectCommitLog";
import { repairMapTreeOrphans } from "@/project/mapTree";
import { sha256HexText } from "@/util/sha256";
import { randomUuid } from "@/util/id";
import type { GameMap, MapId, Project } from "./types";

export type ProjectChangeCell = {
  readonly x: number;
  readonly y: number;
  readonly layer: "lower" | "upper" | "event";
};

export type ProjectChangeDescriptor =
  | { readonly scope: "map"; readonly mapId: MapId; readonly cells?: readonly ProjectChangeCell[] }
  | { readonly scope: "database"; readonly collection?: string }
  | { readonly scope: "system" | "assets" | "project" };

type Listener = (project: Project, change: ProjectChangeDescriptor) => void;
type AutoSaveListener = (state: AutoSaveState) => void;

export type AutoSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "saving" }
  | { readonly kind: "saved"; readonly at: number }
  | { readonly kind: "error"; readonly message: string; readonly retryCount?: number };

export type ProjectFlushResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "not-loaded" }
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly { readonly mapId: string; readonly name: string }[] }
  // todo 5: 성공 시 원격 저장의 sha256 증거를 담는다 — 자율 런 run-end 게이트가
  // agent_run_saved 감사에 projectId + sha256 으로 기록한다. saveProjectToSupabase/
  // saveProjectMapPatchToSupabase 의 결과가 그대로 흘러들어온다(commitId 는 여기 오지
  // 않는다 — 비동기 커밋 로그 경로의 전용 row 다).
  | { readonly kind: "saved"; readonly sha256?: string }
  | { readonly kind: "saved-local" };

export type ProjectDbReconnectResult =
  | { readonly kind: "connected"; readonly source: "remote" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "not-configured" };

/** Stable result for switching the singleton to a new remote project. */
export type LoadNewRemoteProjectResult = {
  readonly projectId: string | null;
};

/** Stable result for an explicit remote reload, including observed target ID only. */
export type ReloadFromRemoteResult =
  | { readonly kind: "reloaded"; readonly title: string; readonly projectId: string }
  | { readonly kind: "not-configured"; readonly projectId: string | null }
  | { readonly kind: "disabled"; readonly projectId: string | null; readonly reason: string }
  | { readonly kind: "cancelled"; readonly projectId: string | null }
  | { readonly kind: "failed"; readonly message: string; readonly projectId: string | null };

export type DeepReadonly<T> =
  T extends (...args: any[]) => unknown
    ? T
    : T extends ReadonlyMap<infer Key, infer Value>
      ? ReadonlyMap<DeepReadonly<Key>, DeepReadonly<Value>>
      : T extends ReadonlySet<infer Item>
        ? ReadonlySet<DeepReadonly<Item>>
        : T extends readonly (infer Item)[]
          ? readonly DeepReadonly<Item>[]
          : T extends object
            ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
            : T;

export type ProjectE2EEffectiveTarget = {
  readonly projectId: string;
  readonly source: SupabaseProjectConfigSource;
  readonly url: string;
};

/** Detached, runtime-immutable evidence only; none of these fields are persisted in Project. */
export type ProjectE2ESnapshot = {
  readonly canonicalPayload: string;
  readonly effectiveTarget: ProjectE2EEffectiveTarget;
  readonly project: DeepReadonly<Project>;
};

export class DbConnectionRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbConnectionRequiredError";
  }
}


/** 부트가 dev showcase 팩토리를 주입한다. 미설정이면 showcase 경로가 없다. */
export type DevProjectFactory = () => Project | null;
let devProjectFactory: DevProjectFactory | null = null;
export function setDevProjectFactory(factory: DevProjectFactory | null): void {
  devProjectFactory = factory;
}
class ProjectStore {
  private current: Project;
  private listeners = new Set<Listener>();
  private autoSaveListeners = new Set<AutoSaveListener>();
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private autoSaveState: AutoSaveState = { kind: "idle" };
  private readonly autoSaveDelayMs = 4000;
  private readonly autoSaveRetryBaseDelayMs = 10_000;
  private readonly autoSaveRetryMaxDelayMs = 120_000;
  private autoSaveRetryCount = 0;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly healthCheckIntervalMs = 30_000;
  private boundOnlineHandler: (() => void) | null = null;
  private loaded = false;
  private remotePersistenceEnabled = true;
  private remotePersistenceDisabledReason: DbPersistenceDisabledReason | null = null;
  private persistedBaseline: Project | null = null;
  private persistInFlight: Promise<ProjectFlushResult> | null = null;
  // 마지막 "실제 저장"(원격 업서트 또는 dev override 기록) 이후 변경이 있는가 —
  // beforeunload 미저장 경고(도그푸딩 결함 ⑧)의 근거. 저장이 스킵되는 모드(fresh/blank)
  // 에서는 flush가 saved-local을 돌려줘도 실제 기록이 없으므로 true로 남는다.
  private dirtySinceLastPersist = false;
  /** Bumps on every local edit. Used so in-flight remote saves cannot rewind paint. */
  private mutationGeneration = 0;
  /**
   * Read-only player snapshot used by editor sandbox tests. Mutations and every
   * persistence path continue to operate on `current`, so a test run cannot
   * commit or remotely flush the snapshot.
   */
  private readOnlyProjectSnapshot: Project | null = null;


  constructor() {
    this.current = createBlankProject();
    this.boundOnlineHandler = () => this.onNetworkRestored();
    // 존재만 보지 않고 **능력**을 본다. 테스트가 심는 부분 스텁 window 에는 addEventListener 가
    // 없어서 `typeof window !== "undefined"` 만으로는 생성자가 던졌고, 그 결과 저장/로드
    // 테스트 10여 건이 아예 실행되지 않았다(안전망이 조용히 사라진 상태였다).
    // regionTaskStatus.ts 가 이미 쓰는 관례와 맞춘다.
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("online", this.boundOnlineHandler);
    }
  }

  async load(): Promise<Project> {
    try {
      const devShowcaseProject = devProjectFactory?.() ?? null;
      if (devShowcaseProject) {
        this.adoptProject(loadDevProjectOverride() ?? devShowcaseProject, { restoreVault: true });
        this.remotePersistenceEnabled = false;
        this.remotePersistenceDisabledReason = "dev-showcase";
      } else {
        const status = dbPersistenceStatus({ disabledReason: null });
        if (status.kind === "not-configured") {
          this.remotePersistenceEnabled = false;
          this.remotePersistenceDisabledReason = null;
          this.persistedBaseline = null;
          throw new DbConnectionRequiredError("온라인 저장 설정이 필요합니다.");
        } else {
          const project = await loadProjectFromSupabase();
          if (!project) {
            this.remotePersistenceEnabled = true;
            this.remotePersistenceDisabledReason = null;
            this.persistedBaseline = null;
            throw new DbConnectionRequiredError("선택한 작업을 찾지 못했습니다.");
          }
          this.adoptProject(project, { restoreVault: true });
          this.remotePersistenceEnabled = true;
          this.remotePersistenceDisabledReason = null;
          this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
          resetManualProjectCommitBaseline(this.current);
          this.syncProjectUrlBar();
        }
      }
      // Defer remote rewrite of normalize fixes so boot is not blocked on Tailscale/dbserver RTT.
      await this.normalizeCurrentProject({ persistIfChanged: false });
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
    this.dirtySinceLastPersist = false;
    this.emit({ scope: "project" });
    return this.current;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // 부팅 실패 복구(도그푸딩 결함 ②): 로드 실패 상태에서 대체 프로젝트(예제/빈)를 메모리로 연다.
  // 깨진 원격/로컬 프로젝트를 덮어쓰지 않도록 원격 저장은 끈 채 시작한다 —
  // 사용자는 이후 DB 연결 설정에서 명시적으로 다시 연결/저장할 수 있다.
  async loadFallbackProject(project: Project): Promise<void> {
    this.adoptProject(project, { restoreVault: true });
    this.remotePersistenceEnabled = false;
    this.remotePersistenceDisabledReason = "load-failed";
    this.persistedBaseline = null;
    this.loaded = true;
    await this.normalizeCurrentProject();
    this.dirtySinceLastPersist = false;
    this.emit({ scope: "project" });
  }

  /**
   * Welcome/genre pipeline: blank/authored project for a NEW remote row.
   * Keeps remote persistence on when DB is configured, mints a project id, and
   * never reuses the previously loaded project id (so lake village etc. stay intact).
   */
  async loadNewRemoteProject(
    project: Project,
    options: { readonly projectId?: string; readonly title?: string } = {},
  ): Promise<LoadNewRemoteProjectResult> {
    const title = options.title?.trim();
    if (title) {
      project.meta = { ...project.meta, title };
    }

    const draft = supabaseProjectConfigDraft();
    const configured = Boolean(draft.url && draft.anonKey);
    const projectId =
      options.projectId?.trim()
      || (configured ? `oprn-${randomUuid().replace(/-/g, "").slice(0, 10)}` : null);

    // Full project switch — drop previous event drafts; new world starts clean.
    clearEventDraftVault();
    persistEventDraftVaultNow();
    this.adoptProject(project, { restoreVault: false });
    this.persistedBaseline = null;
    this.loaded = true;
    this.dirtySinceLastPersist = true;

    if (configured && projectId) {
      // URL projectId wins over stored custom draft — update URL first so
      // subsequent supabaseProjectConfig() / autosave target the new row.
      syncProjectToUrl({ projectId, projectName: project.meta?.title ?? null });
      saveSupabaseProjectConfigDraft({
        anonKey: draft.anonKey,
        projectId,
        url: draft.url,
      });
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      this.syncProjectUrlBar();
    } else {
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = null;
    }

    // 부팅/웰컴 경로에서 즉시 원격 쓰기를 기다리지 않는다 — dbserver(Tailscale) 첫 연결
    // 플레이크 한 번에 부팅이 벨려졌다(2026-08-18). 쓰기는 아래 scheduleAutoSave의
    // 재시도/백오프 경로가 책임진다(load()의 부팅 지연 저장과 동일한 원칙).
    await this.normalizeCurrentProject({ persistIfChanged: false });
    this.emit({ scope: "project" });
    if (this.remotePersistenceEnabled) this.scheduleAutoSave();
    return { projectId };
  }

  /** Atomic target proof plus fixture switch for the private E2E bridge. */
  async loadNewRemoteProjectForE2E(
    project: Project,
    input: {
      readonly expectedAnonKeyDigest: string;
      readonly expectedCurrentProjectId: string;
      readonly expectedProjectId: string;
      readonly expectedTargetUrl: string;
      readonly title: string;
    },
  ): Promise<LoadNewRemoteProjectResult | { readonly kind: "target-mismatch" }> {
    const draft = supabaseProjectConfigDraft();
    if (
      draft.projectId !== input.expectedCurrentProjectId
      || draft.url.replace(/\/$/, "") !== input.expectedTargetUrl
      || await sha256HexText(draft.anonKey.trim()) !== input.expectedAnonKeyDigest
    ) {
      return { kind: "target-mismatch" };
    }
    return this.loadNewRemoteProject(project, { projectId: input.expectedProjectId, title: input.title });
  }

  // 테스트 전용: loaded 플래그와 원격 저장 활성화 상태를 직접 제어.
  // store.load()가 Supabase 네트워크/인증에 결합되어 있어 단위 테스트에서
  // flush()/persistCurrent() 경로만 격리하려 검증할 때 사용한다.
  /** @internal */
  isRemotePersistenceEnabled(): boolean {
    return this.remotePersistenceEnabled;
  }

  _setPersistenceStateForTest(state: { loaded: boolean; remotePersistenceEnabled?: boolean; disabledReason?: DbPersistenceDisabledReason | null }): void {
    this.loaded = state.loaded;
    if (state.remotePersistenceEnabled !== undefined) this.remotePersistenceEnabled = state.remotePersistenceEnabled;
    if (state.disabledReason !== undefined) this.remotePersistenceDisabledReason = state.disabledReason;
  }

  getCurrent(): Project {
    return this.readOnlyProjectSnapshot ?? this.current;
  }

  /**
   * Temporarily exposes an in-memory project to read-only runtime consumers.
   * Store updates, autosave, export projections, and Supabase persistence keep
   * using the canonical `current` project. The returned release is idempotent.
   */
  beginReadOnlyProjectSnapshot(project: Project): () => void {
    const previous = this.readOnlyProjectSnapshot;
    const snapshot = structuredClone(project);
    this.readOnlyProjectSnapshot = snapshot;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.readOnlyProjectSnapshot === snapshot) this.readOnlyProjectSnapshot = previous;
    };
  }

  /** Narrow E2E observation seam. It never exposes credentials or a live Project reference. */
  getE2ESnapshot(): ProjectE2ESnapshot {
    const project = structuredClone(projectWithoutEventDrafts(this.current));
    const effectiveTarget = supabaseProjectConfigDraftWithSource();
    return deepFreeze({
      canonicalPayload: serialize(project),
      effectiveTarget: {
        projectId: effectiveTarget.projectId,
        source: effectiveTarget.source,
        url: effectiveTarget.url.replace(/\/$/, ""),
      },
      project,
    });
  }

  getDbPersistenceStatus(): DbPersistenceStatus {
    return dbPersistenceStatus({ disabledReason: this.remotePersistenceDisabledReason });
  }

  getAutoSaveState(): AutoSaveState {
    return this.autoSaveState;
  }

  // 마지막 실제 저장 이후 미저장 변경이 있는가(결함 ⑧ — 창 닫기 경고 근거).
  hasUnsavedChanges(): boolean {
    return this.dirtySinceLastPersist;
  }

  subscribeAutoSave(listener: AutoSaveListener): () => void {
    this.autoSaveListeners.add(listener);
    return () => this.autoSaveListeners.delete(listener);
  }

  async reconnectRemotePersistence(): Promise<ProjectDbReconnectResult> {
    const status = dbPersistenceStatus({ disabledReason: null });
    if (status.kind !== "ready") return { kind: "not-configured" };
    try {
      const project = await loadProjectFromSupabase();
      if (project) {
        this.current = preserveEventDraftsOnProject(project, this.current);
        syncEventDraftVaultFromProject(this.current);
        this.remotePersistenceEnabled = true;
        this.remotePersistenceDisabledReason = null;
        await this.normalizeCurrentProject();
        this.loaded = true;
        this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
        resetManualProjectCommitBaseline(this.current);
        this.dirtySinceLastPersist = false;
        this.syncProjectUrlBar();
        this.emit({ scope: "project" });
        this.refreshSupabaseResourceCache();
        return { kind: "connected", source: "remote" };
      }
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      this.persistedBaseline = null;
      return { kind: "failed", message: "선택한 작업을 찾지 못했습니다. 목록에서 다시 선택하세요." };
    } catch (error) {
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = "load-failed";
      this.emit();
      return { kind: "failed", message: error instanceof Error ? error.message : "온라인 저장 연결 실패" };
    }
  }
  /**
   * DB에서 현재 projectId 프로젝트를 다시 읽어 에디터 메모리를 교체한다.
   * 외부 스크립트/다른 세션 저장분을 즉시 반영할 때 사용.
   */
  async reloadFromRemote(options: { readonly force?: boolean } = {}): Promise<ReloadFromRemoteResult> {
    const projectId = supabaseProjectConfigDraft().projectId || null;
    if (!this.remotePersistenceEnabled) {
      return {
        kind: "disabled",
        projectId,
        reason: this.remotePersistenceDisabledReason ?? "remote-disabled",
      };
    }
    if (!options.force && this.dirtySinceLastPersist) {
      return { kind: "cancelled", projectId };
    }
    try {
      const project = await loadProjectFromSupabase();
      if (!project) {
        return { kind: "failed", message: "DB에서 프로젝트를 찾을 수 없습니다.", projectId };
      }
      this.current = preserveEventDraftsOnProject(project, this.current);
      syncEventDraftVaultFromProject(this.current);
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      await this.normalizeCurrentProject();
      this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
      resetManualProjectCommitBaseline(this.current);
      this.dirtySinceLastPersist = false;
      this.syncProjectUrlBar();
      this.emit({ scope: "project" });
      this.refreshSupabaseResourceCache();
      return { kind: "reloaded", projectId: supabaseProjectConfigDraft().projectId, title: this.current.meta?.title ?? "" };
    } catch (error) {
      return {
        kind: "failed",
        message: error instanceof Error ? error.message : "온라인 저장본을 불러오지 못했습니다",
        projectId,
      };
    }
  }

  /** Atomic target proof plus forced reload for the private E2E bridge. */
  async reloadFromRemoteForE2E(input: {
    readonly expectedAnonKeyDigest: string;
    readonly expectedProjectId: string;
    readonly expectedTargetUrl: string;
  }): Promise<ReloadFromRemoteResult | { readonly kind: "target-mismatch" }> {
    const config = supabaseProjectConfig();
    if (
      !config
      || config.projectId !== input.expectedProjectId
      || config.url !== input.expectedTargetUrl
      || await sha256HexText(config.anonKey.trim()) !== input.expectedAnonKeyDigest
    ) {
      return { kind: "target-mismatch" };
    }
    return this.reloadFromRemote({ force: true });
  }

  replace(project: Project, options: { readonly preserveEventDrafts?: boolean } = {}): void {
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    // Default: keep open event editor drafts across undo/AI/accept/remote merges.
    // Pass preserveEventDrafts:false only for intentional full project switches
    // (new project / import / sample load) via replaceProject().
    if (options.preserveEventDrafts === false) {
      this.current = project;
      syncEventDraftVaultFromProject(this.current);
    } else {
      this.current = preserveEventDraftsOnProject(project, this.current);
      syncEventDraftVaultFromProject(this.current);
    }
    this.markLocalMutation();
    this.emit({ scope: "project" });
    this.scheduleAutoSave();
  }

  /** Full project switch (new/import/sample). Drops event-draft vault for the previous project. */
  replaceProject(project: Project): void {
    clearEventDraftVault();
    persistEventDraftVaultNow();
    this.replace(project, { preserveEventDrafts: false });
  }

  update(mutator: (draft: Project) => void, change: ProjectChangeDescriptor = { scope: "project" }): void {
    const draft: Project = structuredClone(this.current);
    mutator(draft);
    ensureProjectMapConnections(draft);
    ensureMapTreeCoversAllMaps(draft);
    ensureSwitchVariableSlots(draft);
    removeLegacySpriteReferences(draft);
    this.current = draft;
    syncEventDraftVaultFromProject(this.current);
    this.markLocalMutation();
    this.emit(change);
    this.scheduleAutoSave();
  }

  updateMap(
    mapId: MapId,
    mapMutator: (draft: GameMap) => void,
    change: { readonly cells?: readonly ProjectChangeCell[] } = {}
  ): void {
    const currentMap = this.current.maps[mapId];
    if (!currentMap) return;
    const draftMap: GameMap = structuredClone(currentMap);
    mapMutator(draftMap);
    // Map-only edits only replace one GameMap. The skipped normalizers read
    // project root/mapConnections, switch+variable database/session slots, or
    // the entire project for legacy sprite IDs; paint/erase/fill/event moves do
    // not create those legacy/global shapes, so full-project normalize is left
    // on update(), replace(), load(), and save paths.
    this.current = {
      ...this.current,
      maps: {
        ...this.current.maps,
        [mapId]: draftMap,
      },
    };
    syncEventDraftVaultFromProject(this.current);
    this.markLocalMutation();
    this.emit({ scope: "map", mapId, ...change });
    this.scheduleAutoSave();
  }

  /** @internal */
  _getPersistedBaselineForTest(): Project | null {
    return this.persistedBaseline;
  }

  /** @internal */
  _setPersistedBaselineForTest(project: Project | null): void {
    this.persistedBaseline = project;
  }

  async flush(): Promise<ProjectFlushResult> {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.clearAutoSaveRetry();
    if (!this.loaded) return { kind: "not-loaded" };
    if (!this.remotePersistenceEnabled && this.remotePersistenceDisabledReason === null) {
      return { kind: "not-configured" };
    }
    // Clean flush: skip network/serialize when nothing changed since last successful persist.
    if (!this.dirtySinceLastPersist && this.autoSaveState.kind !== "error") {
      if (this.remotePersistenceEnabled) return { kind: "saved" };
      if (this.remotePersistenceDisabledReason === "dev-showcase") return { kind: "saved-local" };
      return this.remotePersistenceDisabledReason === null ? { kind: "not-configured" } : { kind: "disabled" };
    }
    return await this.saveCurrentWithAutoSaveState();
  }

  async clearAll(): Promise<void> {
    clearEventDraftVault();
    persistEventDraftVaultNow();
    this.current = createBlankProject();
    this.markLocalMutation();
    this.emit({ scope: "project" });
    this.scheduleAutoSave();
  }

  /**
   * Force-restore a single open draft from the vault into the live project.
   * Used by the event editor when a store race briefly drops the event mid-edit.
   */
  restoreEventDraftFromVault(mapId: MapId, eventId: string): boolean {
    if (this.current.maps[mapId]?.events.some((entry) => entry.id === eventId)) return true;
    const withVault = applyEventDraftVault(structuredClone(this.current));
    if (!withVault.maps[mapId]?.events.some((entry) => entry.id === eventId)) return false;
    this.current = withVault;
    syncEventDraftVaultFromProject(this.current);
    this.markLocalMutation();
    this.emit({ scope: "map", mapId });
    this.scheduleAutoSave();
    return true;
  }

  /** Local edit counter — remote save responses must not clobber a newer generation. */
  private markLocalMutation(): void {
    this.mutationGeneration += 1;
    this.dirtySinceLastPersist = true;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(change: ProjectChangeDescriptor = { scope: "project" }): void {
    for (const listener of this.listeners) listener(this.current, change);
  }

  private emitAutoSave(): void {
    for (const listener of this.autoSaveListeners) listener(this.autoSaveState);
  }

  private setAutoSaveState(state: AutoSaveState): void {
    this.autoSaveState = state;
    this.emitAutoSave();
  }

  private scheduleAutoSave(): void {
    if (!this.loaded) return;
    if (!this.remotePersistenceEnabled) return;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.clearAutoSaveRetry();
    this.setAutoSaveState({ kind: "pending" });
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        console.error("[store] Supabase auto-save failed:", error);
      });
    }, this.autoSaveDelayMs);
  }

  private clearAutoSaveRetry(): void {
    if (!this.autoSaveRetryTimer) return;
    clearTimeout(this.autoSaveRetryTimer);
    this.autoSaveRetryTimer = null;
  }

  private scheduleAutoSaveRetry(): void {
    if (this.autoSaveRetryTimer) return;
    const delay = Math.min(
      this.autoSaveRetryBaseDelayMs * 2 ** this.autoSaveRetryCount,
      this.autoSaveRetryMaxDelayMs,
    );
    this.autoSaveRetryTimer = setTimeout(() => {
      this.autoSaveRetryTimer = null;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        console.error("[store] Supabase auto-save retry failed:", error);
      });
    }, delay);
    this.startHealthCheck();
  }

  /**
   * Periodic lightweight probe while in error state. If the DB responds we
   * immediately attempt a flush instead of waiting for the next backoff tick.
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(() => {
      void this.runHealthCheck();
    }, this.healthCheckIntervalMs);
  }

  private stopHealthCheck(): void {
    if (!this.healthCheckTimer) return;
    clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }

  private async runHealthCheck(): Promise<void> {
    if (!this.loaded || !this.remotePersistenceEnabled) {
      this.stopHealthCheck();
      return;
    }
    const config = supabaseProjectConfig();
    if (!config) {
      this.stopHealthCheck();
      return;
    }
    try {
      // GET with limit=0 on a known table in the rpg_zzu schema.
      // Must include Accept-Profile (same as supabaseJsonHeaders "read")
      // so PostgREST resolves the table correctly. A 200 means the DB is
      // genuinely reachable and a flush should succeed.
      const response = await fetch(`${config.url}/rest/v1/projects?limit=0`, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          Accept: "application/json",
          "Accept-Profile": "rpg_zzu",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        console.info(`[store] Health check: DB reachable (${response.status}), attempting flush`);
        this.stopHealthCheck();
        this.clearAutoSaveRetry();
        this.autoSaveRetryCount = 0;
        void this.saveCurrentWithAutoSaveState().catch((error) => {
          console.error("[store] Health-check-triggered flush failed:", error);
        });
      } else {
        console.warn(`[store] Health check: server responded ${response.status} — not triggering flush`);
      }
    } catch {
      // Network unreachable — keep waiting for next tick or online event.
    }
  }

  /** Browser "online" event: network interface came back. */
  private onNetworkRestored(): void {
    if (!this.loaded || !this.remotePersistenceEnabled) return;
    if (this.autoSaveState.kind !== "error") return;
    console.info("[store] Network restored, attempting immediate flush");
    this.stopHealthCheck();
    this.clearAutoSaveRetry();
    void this.saveCurrentWithAutoSaveState().catch((error) => {
      console.error("[store] Online-event flush failed:", error);
    });
  }

  private async saveCurrentWithAutoSaveState(): Promise<ProjectFlushResult> {
    // Coalesce concurrent flush calls onto one network round-trip, then re-run
    // if the user painted more tiles while that round-trip was in flight.
    if (this.persistInFlight) {
      const inFlightResult = await this.persistInFlight;
      if (this.dirtySinceLastPersist && this.loaded && this.remotePersistenceEnabled) {
        return await this.saveCurrentWithAutoSaveState();
      }
      return inFlightResult;
    }
    this.setAutoSaveState({ kind: "saving" });
    const run = (async (): Promise<ProjectFlushResult> => {
      try {
        // Local-first catch-up: if paint lands during a save RTT, persist again
        // immediately instead of reporting "saved" while still dirty and waiting
        // the full autosave debounce (tiles stay local; DB just lags one hop).
        let result = await this.persistCurrent();
        while (
          this.dirtySinceLastPersist
          && this.loaded
          && this.remotePersistenceEnabled
          && result.kind === "saved"
        ) {
          result = await this.persistCurrent();
        }
        this.setAutoSaveState(autoSaveStateForFlushResult(result));
        this.autoSaveRetryCount = 0;
        this.stopHealthCheck();
        return result;
      } catch (error) {
        this.autoSaveRetryCount += 1;
        this.setAutoSaveState({ kind: "error", message: autoSaveErrorMessage(error), retryCount: this.autoSaveRetryCount });
        this.scheduleAutoSaveRetry();
        throw error;
      } finally {
        this.persistInFlight = null;
      }
    })();
    this.persistInFlight = run;
    return await run;
  }

  private async persistCurrent(): Promise<ProjectFlushResult> {
    // Always checkpoint open drafts to localStorage before remote I/O so a
    // tab crash mid-save can still recover the event editor session.
    syncEventDraftVaultFromProject(this.current);
    persistEventDraftVaultNow();
    if (!this.remotePersistenceEnabled) {
      if (this.remotePersistenceDisabledReason === "dev-showcase") {
        // fresh/blank 위치에서는 기록이 스킵되므로(false 반환) dirty를 유지한다(결함 ⑧·⑩).
        if (saveDevProjectOverride(projectWithoutEventDrafts(this.current))) {
          this.dirtySinceLastPersist = false;
        }
        return { kind: "saved-local" };
      }
      return this.remotePersistenceDisabledReason === null ? { kind: "not-configured" } : { kind: "disabled" };
    }
    // Snapshot local state at submit time. Paint during await must win over the response.
    const generationAtSubmit = this.mutationGeneration;
    const submittedProject = projectWithoutEventDrafts(this.current);
    const result = this.persistedBaseline
      ? await saveProjectMapPatchToSupabase({ project: submittedProject, baseProject: this.persistedBaseline })
      : await saveProjectToSupabase(submittedProject);
    if (result.kind === "not-configured") return result;
    if (result.kind === "conflict") return result;
    const savedProject = result.project ?? submittedProject;
    // Baseline tracks what the server accepted — not what the editor is showing.
    this.persistedBaseline = structuredClone(projectWithoutEventDrafts(savedProject));
    // Local-first: never replace live maps/project with the save response.
    // Doing so rewound brush strokes that landed during the network RTT
    // (user symptom: painted tiles pop back / cancel after a moment).
    if (this.mutationGeneration === generationAtSubmit) {
      this.dirtySinceLastPersist = false;
    } else {
      // Newer local edits exist. Keep dirty; saveCurrentWithAutoSaveState's
      // immediate catch-up loop (or a concurrent flush waiter) persists them.
      // Do not arm the 4s autosave debounce here — that left a "saved" gap.
      this.dirtySinceLastPersist = true;
    }
    recordManualProjectCommitAfterSave(savedProject);
    this.refreshSupabaseResourceCache();
    return result;
  }

  /**
   * Load/switch to a project while restoring any crash-recovered event drafts
   * for the current DB project id.
   */
  private adoptProject(project: Project, options: { readonly restoreVault: boolean }): void {
    clearEventDraftVault();
    if (options.restoreVault) {
      loadEventDraftVaultFromLocalStorage();
      this.current = applyEventDraftVault(project);
    } else {
      this.current = project;
    }
    syncEventDraftVaultFromProject(this.current);
  }

  private async normalizeCurrentProject(options: { readonly persistIfChanged?: boolean } = {}): Promise<void> {
    const persistIfChanged = options.persistIfChanged !== false;
    const dialogueRewritten = rewriteLegacyAdvancedDialogueInProject(this.current);
    const changed = [
      dialogueRewritten,
      ensureProjectMapConnections(this.current),
      // 실내 보강은 mapTree 고아 복구보다 먼저 — 새로 넣은 실내 맵이 같은 패스에서 트리에 편입된다.
      ensureScarloxyPokemonInteriors(this.current),
      ensureMapTreeCoversAllMaps(this.current),
      ensureSwitchVariableSlots(this.current),
      ensureBundledTilesets(this.current),
      repairInteriorTransparentPropLayers(this.current),
      removeLegacyRmTileset(this.current),
      removeLegacySpriteReferences(this.current),
      ensureBundledResourceProfiles(this.current),
      ensureDefaultDatabaseIconResources(this.current),
    ].some(Boolean);
    // Boot load must not block the editor on a full remote rewrite (~2MB+).
    // Schedule deferred auto-save so the shell can paint first.
    if (changed && this.remotePersistenceEnabled) {
      if (persistIfChanged) await this.persistCurrent();
      else {
        this.dirtySinceLastPersist = true;
        this.scheduleAutoSave();
      }
    }
  }

  private refreshSupabaseResourceCache(): void {
    if (!this.remotePersistenceEnabled) return;
    void cacheSupabaseRootResources(this.current)
      .then((report) => {
        if (report.skipped.length > 0) {
          console.warn("[store] Supabase resource cache skipped:", report.skipped);
        }
      })
      .catch((error) => {
        console.error("[store] Supabase resource cache refresh failed:", error);
      });
  }

  /** 주소창에 ?project=&name= 반영 (공유/북마크). */
  private syncProjectUrlBar(): void {
    if (!this.remotePersistenceEnabled) return;
    const projectId = supabaseProjectConfig()?.projectId;
    if (!projectId) return;
    syncProjectToUrl({
      projectId,
      projectName: this.current.meta?.title ?? null,
    });
  }
}

export const store = new ProjectStore();

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    if (value instanceof Map || value instanceof Set) {
      throw new TypeError("E2E snapshots cannot contain mutable collections");
    }
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

function ensureProjectMapConnections(project: Project): boolean {
  if (Array.isArray(project.mapConnections)) return false;
  project.mapConnections = [];
  return true;
}

function ensureMapTreeCoversAllMaps(project: Project): boolean {
  return repairMapTreeOrphans(project);
}

function autoSaveStateForFlushResult(result: ProjectFlushResult): AutoSaveState {
  switch (result.kind) {
    case "saved":
    case "saved-local":
      return { kind: "saved", at: Date.now() };
    case "conflict":
      return { kind: "error", message: "온라인 저장이 충돌했습니다. 저장본을 다시 불러온 뒤 저장하세요." };
    case "disabled":
      return { kind: "error", message: "온라인 저장을 사용할 수 없습니다." };
    case "not-configured":
      return { kind: "error", message: "온라인 저장 연결이 필요합니다." };
    case "not-loaded":
      return { kind: "idle" };
  }
}

function autoSaveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 저장 오류";
}
