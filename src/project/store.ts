import { clearCopiedEventPage } from "@/editor/eventPageClipboard";
import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { createBlankProject } from "./defaults";
import { ensureSwitchVariableSlots } from "./defaults/defaultProject";
import { ensureBundledResourceProfiles, ensureBundledTilesets, removeLegacyRmTileset, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { hasPendingFacesetSheetRepair, repairUploadedFacesetSheets } from "@/assets/facesetSheetRepair";
import { repairInteriorTransparentPropLayers } from "./defaults/interiorTransparentPropLayerRepair";
import { ensureScarloxyPokemonInteriors } from "./defaults/scarloxyPokemonInteriors";
import { ensureDefaultDatabaseIconResources } from "./defaults/defaultDatabaseIconResources";
import { defaultTitleScreenSettings, ensureBundledBattleAnimations } from "./defaults/defaultDatabase";
import { isSaveSkippedLocation, loadDevProjectOverride, saveDevProjectOverride } from "./devProjectPersistence";
import type { SupabaseSaveResult, ProjectWriteAuthority } from "./supabaseProjectSync";
import { isSharedDemoProjectId, SHARED_DEMO_PROJECT_ID } from "./sharedDemoProject";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { assertCanonicalReplacement, ProjectRoutingError } from "./spatial/saveRouting";
import { SpatialPersistenceError, type MirrorStatus } from "./spatial/persistence";
import { applyAudioDescriptionDelta } from "./audioDescriptions";
import { applyMonsterMetadataDelta } from "./monsterMetadata";
import { serialize, serializeForComparison } from "./io";
import {
  applyEventDraftVault,
  clearEventDraftVault,
  loadEventDraftVaultFromLocalStorage,
  listEventDraftVaultEntries,
  persistEventDraftVaultNow,
  preserveEventDraftsOnProject,
  restoreEventDraftVaultEntries,
  syncEventDraftVaultFromProject,
} from "./eventDraftVault";
import { cacheSupabaseRootResources } from "@/assets/supabaseResourceCache";
import { syncProjectToUrl } from "./projectUrl";
import {
  saveSupabaseSelectedProjectId,
  stageSupabaseProjectConfigDraft,
  supabaseProjectConfigDraft,
  supabaseProjectConfigDraftWithSource,
  type SupabaseProjectConfig,
  type SupabaseProjectConfigSource,
} from "./supabaseProjectConfig";
import type { DbPersistenceDisabledReason, DbPersistenceStatus } from "./persistenceStatus";
import { projectRepository } from "./persistence/repository";
import { isRemoteTarget, sameProjectTarget, type ProjectTarget } from "./persistence/target";
import type { ProjectRepository } from "./persistence/types";
import { recordManualProjectCommitAfterSave, resetManualProjectCommitBaseline } from "./projectCommitLog";
import { repairMapTreeOrphans } from "@/project/mapTree";
import { sha256HexText } from "@/util/sha256";
import { structuralJson } from "@/util/structuralJson";
import { randomUuid } from "@/util/id";
import { createLogger } from "@/util/logger";
import {
  recordEditActivity,
  type EditActivityField,
  type EditActivityOrigin,
} from "@/editor/editActivityLog";
import type { GameMap, MapId, Project } from "./types";

const log = createLogger("store");

export type ProjectChangeCell = {
  readonly x: number;
  readonly y: number;
  readonly layer: "lower" | "upper" | "event";
};

/**
 * 편집 행위의 의미 정보 — 관측용 부가 필드. 전부 optional 이라 기존 호출부 244곳은
 * 그대로 컴파일된다. 리스너는 이 필드를 보지 않는다(관측 초크포인트만 읽는다).
 *
 * 왜 descriptor 에 얹는가: mutation 초크포인트(`markLocalMutation`)는 "무엇이 바뀌었나" 는
 * 알 수 있지만 "왜 바뀌었나" 는 모른다. 인텐트는 호출자만 안다. 이미 91곳이 descriptor 를
 * 넘기고 있으므로 여기가 인텐트를 실어 보낼 가장 짧은 통로다.
 */
export type ProjectChangeAnnotation = {
  /** 사람이 읽는 행위 이름. 예: "커맨드 추가", "진영 ID 변경". */
  readonly label?: string;
  /** 누가 한 편집인가. 생략하면 "human". AI 경로가 사람으로 오귀속되는 걸 막는 축. */
  readonly origin?: EditActivityOrigin;
  /** 호출자가 **이미 계산해 둔** 필드 단위 변경만 넘긴다. 여기서 diff 를 계산하지 않는다. */
  readonly fields?: readonly EditActivityField[];
  readonly eventId?: string;
  /** 이 편집을 한 한 줄 이유. AI 툴 reason 또는 사람 편집 라벨에서 온다. */
  readonly reason?: string;
  /** 프로젝트 전체 교체 표시 — true면 프로젝트 단위 에디터 캐시가 무효화되고, false면 명시적으로 제외된다. */
  readonly projectSwitch?: boolean;
};

export type ProjectChangeDescriptor =
  | ({ readonly scope: "map"; readonly mapId: MapId; readonly cells?: readonly ProjectChangeCell[] } & ProjectChangeAnnotation)
  | ({ readonly scope: "database"; readonly collection?: string } & ProjectChangeAnnotation)
  | ({ readonly scope: "system" | "assets" | "project" } & ProjectChangeAnnotation);

/** Identity of the project that is actually loaded in this editor session. */
export type ProjectIdentity =
  | { readonly kind: "remote"; readonly id: string }
  | { readonly kind: "local-session"; readonly id: string };

type Listener = (project: Project, change: ProjectChangeDescriptor) => void;
type AutoSaveListener = (state: AutoSaveState) => void;

export type AutoSaveState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "saving" }
  | { readonly kind: "saved"; readonly at: number }
  | {
      readonly kind: "error";
      readonly message: string;
      readonly retryCount?: number;
      readonly code?: "session-not-persisted";
    };

/** In-memory accepted-save token; contains no credentials or mutable project data. */
export type ProjectPersistenceReceipt = {
  readonly revisionId: string;
  readonly projectId: string;
  readonly mutationGeneration: number;
  /** SHA-256 of the existing normalized comparison, not the wire/server hash. */
  readonly contentIdentity: string;
  readonly sha256?: string;
  readonly serverRevision?: number;
};

export type ProjectPersistenceRecovery =
  | { readonly kind: "ready"; readonly mirror?: MirrorStatus }
  | { readonly kind: "blocked"; readonly error: SpatialPersistenceError | ProjectRoutingError; readonly actions: readonly ["reload", "export-copy"] };

export type ProjectPersistenceProof =
  | { readonly kind: "verified"; readonly receipt: ProjectPersistenceReceipt; readonly isCurrent: boolean }
  | { readonly kind: "mismatch"; readonly receipt: ProjectPersistenceReceipt; readonly reason: "target" | "content" }
  | { readonly kind: "disabled" | "cancelled"; readonly receipt: ProjectPersistenceReceipt }
  | { readonly kind: "failed"; readonly receipt: ProjectPersistenceReceipt; readonly message: string };

export type ProjectFlushResult =
  | { readonly kind: "disabled" }
  | { readonly kind: "not-loaded" }
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly { readonly mapId: string; readonly name: string }[] }
  // A clean flush after load may have no accepted-save receipt. Never invent proof from it.
  | { readonly kind: "saved"; readonly sha256?: string; readonly receipt?: ProjectPersistenceReceipt }
  | { readonly kind: "saved-local" };

export type ProjectDbReconnectResult =
  | { readonly kind: "connected"; readonly source: "remote" }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "not-configured" };

/** Stable result for switching the singleton to a new remote project. */
export type LoadNewRemoteProjectResult = {
  readonly projectId: string | null;
};

export type TransactionalNewRemoteProjectDependencies = {
  readonly createProjectId: () => string;
  readonly reloadTarget: (config: SupabaseProjectConfig) => Promise<Project | null>;
  readonly saveTarget: (project: Project, config: SupabaseProjectConfig) => Promise<SupabaseSaveResult>;
};

export class NewRemoteProjectTransactionError extends Error {
  constructor(
    readonly stage: "flush" | "configuration" | "save" | "reload" | "verify" | "concurrent-edit" | "commit" | "cancelled",
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "NewRemoteProjectTransactionError";
  }
}

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
  private healthCheckLineage = 0;
  private readonly healthCheckIntervalMs = 30_000;
  private boundOnlineHandler: (() => void) | null = null;
  private loaded = false;
  private remotePersistenceEnabled = true;
  private remotePersistenceDisabledReason: DbPersistenceDisabledReason | null = null;
  private persistedBaseline: Project | null = null;
  private writeAuthority: ProjectWriteAuthority | null = null;
  private persistenceRecovery: ProjectPersistenceRecovery = { kind: "ready" };
  private lastPersistenceReceipt: ProjectPersistenceReceipt | null = null;
  /** Load/adoption lineage is separate from the local-edit counter used by catch-up saves. */
  private contentLineage = 0;
  private readonly persistenceTargets = new WeakMap<ProjectPersistenceReceipt, {
    readonly target: ProjectTarget;
    readonly contentLineage: number;
    readonly projectAtSubmit: Project;
  }>();
  private persistInFlight: Promise<ProjectFlushResult> | null = null;
  private persistInFlightLineage = 0;
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
  private loadedRemoteProjectId: string | null = null;
  private localProjectSessionId = randomUuid();

  /** 부를 때마다 고른다 — 테스트가 import 뒤 setProjectRepositoryForTest 로 바꿔 끼우기 때문이다. */
  private get repository(): ProjectRepository {
    return projectRepository();
  }

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
        this.beginLocalProjectSession();
        this.remotePersistenceEnabled = false;
        this.remotePersistenceDisabledReason = "dev-showcase";
      } else {
        const status = this.repository.status(null);
        if (status.kind === "not-configured") {
          this.remotePersistenceEnabled = false;
          this.remotePersistenceDisabledReason = null;
          this.persistedBaseline = null;
          throw new DbConnectionRequiredError("온라인 저장 설정이 필요합니다.");
        } else {
          const { project, authority, target } = await this.readRemoteProject();
          if (!project) {
            this.remotePersistenceEnabled = true;
            this.remotePersistenceDisabledReason = null;
            this.persistedBaseline = null;
            throw new DbConnectionRequiredError("선택한 작업을 찾지 못했습니다.");
          }
          this.adoptProject(project, { restoreVault: true });
          const loadedProjectId = target?.projectId;
          const sharedDemo = isSharedDemoProjectId(loadedProjectId);
          // 공용 데모 행은 어떤 경로로 열리든 읽기 전용이다 — ?project= 딥링크나
          // 작업 선택 목록에서 골라도 쓰기 권한·자동저장을 쥐지 않는다.
          this.writeAuthority = sharedDemo ? null : authority;
          if (loadedProjectId) this.loadedRemoteProjectId = loadedProjectId;
          else this.beginLocalProjectSession();
          this.remotePersistenceEnabled = !sharedDemo;
          this.remotePersistenceDisabledReason = sharedDemo ? "shared-demo" : null;
          this.persistedBaseline = sharedDemo ? null : structuredClone(projectWithoutEventDrafts(this.current));
          resetManualProjectCommitBaseline(this.current);
          this.syncProjectUrlBar();
        }
      }
      this.loaded = true;
      this.dirtySinceLastPersist = false;
      // Defer remote rewrite of normalize fixes so boot is not blocked on Tailscale/dbserver RTT.
      this.dirtySinceLastPersist = false;
      await this.normalizeCurrentProject({ persistIfChanged: false });
      this.refreshSupabaseResourceCache();
    } catch (error) {
      if (error instanceof DbConnectionRequiredError) {
        this.loaded = false;
        throw error;
      }
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = "load-failed";
      log.error("Supabase canonical project load failed", error);
      throw error;
    }
    this.loaded = true;
    // A pending local edit still owns its autosave; only then may the flag clear.
    // Canonical targets keep it for the authority-owned flush path.
    if (this.dirtySinceLastPersist) this.scheduleAutoSave();
    else if (this.writeAuthority?.mode !== "canonical") this.dirtySinceLastPersist = false;
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
    this.beginLocalProjectSession();
    this.remotePersistenceEnabled = false;
    this.remotePersistenceDisabledReason = "load-failed";
    this.persistedBaseline = null;
    this.loaded = true;
    this.dirtySinceLastPersist = false;
    await this.normalizeCurrentProject();
    this.emit({ scope: "project" });
  }

  /**
   * 첫 방문 공용 데모를 읽기 전용으로 연다.
   *
   * 일반 load() 와 다른 점: ?project=/선택 저장을 쓰지 않고, 쓰기 권한을
   * 아예 쥐지 않는다(writeAuthority=null + remotePersistenceEnabled=false).
   * 방문자의 편집은 메모리에만 머물고 자동저장·flush·락 경로는 전부 비활성이라
   * 공용 행을 덮어쓸 수 없다. 편집은 "편집용 사본"(loadNewRemoteProjectTransactionally)에서만.
   *
   * 행이 없거나 읽기가 실패하면 null — 호출자(mode.ts)가 기존 첫 방문 경로로 폴백한다.
   * 데모 부재가 부팅을 벨리면 안 되므로 여기서 throw 하지 않는다.
   */
  async loadSharedDemo(): Promise<Project | null> {
    const base = this.repository.currentTarget();
    if (!base || !isRemoteTarget(base)) return null;
    const target: SupabaseProjectConfig = { ...base, projectId: SHARED_DEMO_PROJECT_ID };
    let snapshot;
    try {
      snapshot = await this.repository.loadSnapshot(target);
    } catch (error) {
      log.warn("공용 데모 읽기 실패 — 첫 방문 폴백 경로로 진행", error);
      return null;
    }
    if (!snapshot) return null;
    this.adoptProject(snapshot.project, { restoreVault: false });
    this.writeAuthority = null;
    // Identity stays "remote/demo" so a fork's concurrent-edit guard anchors to
    // the demo; the row is unreachable for writes either way.
    this.loadedRemoteProjectId = SHARED_DEMO_PROJECT_ID;
    this.remotePersistenceEnabled = false;
    this.remotePersistenceDisabledReason = "shared-demo";
    this.persistedBaseline = null;
    this.loaded = true;
    this.dirtySinceLastPersist = false;
    await this.normalizeCurrentProject({ persistIfChanged: false });
    this.emit({ scope: "project", projectSwitch: true });
    return this.current;
  }

  /** 현재 세션이 공용 데모(읽기 전용)인가 — 토스트/배너/포크 표면의 판정 근거. */
  isSharedDemoSession(): boolean {
    return this.remotePersistenceDisabledReason === "shared-demo";
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
      nameNewProject(project, title);
    }

    const draft = supabaseProjectConfigDraft();
    const configured = Boolean(draft.url && draft.anonKey);
    const projectId =
      options.projectId?.trim()
      || (configured ? `oprn-${randomUuid().replace(/-/g, "").slice(0, 10)}` : null);
    // 공용 데모 행은 어떤 발급 경로로도 쓰기 대상이 될 수 없다.
    if (projectId === SHARED_DEMO_PROJECT_ID) {
      throw new ProjectRoutingError("target-changed", "공용 데모 행은 덮어쓸 수 없습니다. 다른 프로젝트 ID를 사용하세요.");
    }

    // Full project switch — drop previous event drafts and copied pages; new world starts clean.
    clearEventDraftVault();
    clearCopiedEventPage();
    persistEventDraftVaultNow();
    this.adoptProject(project, { restoreVault: false });
    this.persistedBaseline = null;
    this.loaded = true;
    this.dirtySinceLastPersist = true;

    if (configured && projectId) {
      // URL projectId wins over stored custom draft — update URL first so
      // subsequent repository.currentTarget() / autosave target the new row.
      syncProjectToUrl({ projectId, projectName: project.meta?.title ?? null });
      saveSupabaseSelectedProjectId(projectId);
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      this.loadedRemoteProjectId = projectId;
      const target = this.repository.currentTarget();
      this.writeAuthority = target ? { mode: "create", target: { ...target } } : null;
      this.syncProjectUrlBar();
    } else {
      this.beginLocalProjectSession();
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = null;
    }

    // 부팅/웰컴 경로에서 즉시 원격 쓰기를 기다리지 않는다 — dbserver(Tailscale) 첫 연결
    // 플레이크 한 번에 부팅이 벨려졌다(2026-08-18). 쓰기는 아래 scheduleAutoSave의
    // 재시도/백오프 경로가 책임진다(load()의 부팅 지연 저장과 동일한 원칙).
    await this.normalizeCurrentProject({ persistIfChanged: false });
    this.emit({ scope: "project", projectSwitch: true });
    if (this.remotePersistenceEnabled) this.scheduleAutoSave();
    return { projectId };
  }

  /**
   * Welcome/manual preset boundary. It prepares and verifies a new Supabase row
   * without touching the open project, draft vault, config, or URL. Local state
   * is committed only after current-project flush + target save + target reload.
   */
  async loadNewRemoteProjectTransactionally(
    project: Project,
    options: ({ readonly source?: "remote"; readonly projectId?: string }
      | { readonly source: "dev-showcase"; readonly projectId?: never })
      & { readonly title?: string; readonly signal?: AbortSignal } = {},
    dependencies: TransactionalNewRemoteProjectDependencies = {
      createProjectId: () => `oprn-${randomUuid().replace(/-/g, "").slice(0, 10)}`,
      reloadTarget: async (config) => {
        const snapshot = await projectRepository().loadForProof(config);
        if (snapshot && snapshot.projectId !== config.projectId) {
          throw new NewRemoteProjectTransactionError("reload", "재로드한 온라인 사본의 프로젝트 ID가 일치하지 않습니다.");
        }
        return snapshot?.project ?? null;
      },
      saveTarget: (candidate, config) => projectRepository().save(candidate, config),
    },
  ): Promise<{ readonly projectId: string }> {
    const promoteShowcase = options.source === "dev-showcase";
    // 공용 데모 세션도 쇼케이스와 같이 flush 할 자기 원격 원본이 없다 — 읽기 전용
    // 행에 flush 를 시도하면 "disabled" 로 실패하므로, 소스 플러시를 건너뛰고 바로 사본을 만든다.
    const sharedDemoSession = this.remotePersistenceDisabledReason === "shared-demo";
    // Accepted metadata reconciliation can replace the root without changing ownership.
    const sourceLineage = this.contentLineage;
    const sourceGeneration = this.mutationGeneration;
    const sourceIdentity = this.getProjectIdentity();
    const candidate = structuredClone(project);
    const assertSourceCurrent = (): void => {
      if (options.signal?.aborted) {
        throw new NewRemoteProjectTransactionError("cancelled", "온라인 사본 전환을 취소했습니다. 원본은 유지됩니다.");
      }
      const identity = this.getProjectIdentity();
      if (this.contentLineage !== sourceLineage || this.mutationGeneration !== sourceGeneration
        || identity.kind !== sourceIdentity.kind || identity.id !== sourceIdentity.id) {
        throw new NewRemoteProjectTransactionError(
          "concurrent-edit", "준비 중 현재 프로젝트가 변경되어 전환을 취소했습니다. 변경 내용을 확인한 뒤 다시 시도하세요.",
        );
      }
    };
    assertSourceCurrent();
    if (promoteShowcase || sharedDemoSession) {
      if (!this.loaded || this.remotePersistenceEnabled
        || this.remotePersistenceDisabledReason !== (promoteShowcase ? "dev-showcase" : "shared-demo")) {
        throw new NewRemoteProjectTransactionError("configuration", "브라우저 쇼케이스나 공용 데모에서만 사본 만들기 전환을 시작할 수 있습니다.");
      }
      // Do not flush a read-only/quota-constrained source. Its live edits and previous
      // local recovery stay untouched; the detached candidate is the explicit new copy.
    } else {
      const flushResult = await this.flush();
      if (flushResult.kind !== "saved") {
        throw new NewRemoteProjectTransactionError(
          flushResult.kind === "not-configured" ? "configuration" : "flush",
          "현재 프로젝트를 Supabase에 저장하지 못해 새 프로젝트를 시작하지 않았습니다.",
        );
      }
    }
    assertSourceCurrent();

    const baseConfig = this.repository.currentTarget();
    const draft = supabaseProjectConfigDraft();
    if (!baseConfig || !isRemoteTarget(baseConfig) || !draft.url || !draft.anonKey) {
      throw new NewRemoteProjectTransactionError(
        "configuration",
        "Supabase 연결을 확인한 뒤 다시 시도하세요.",
      );
    }

    const projectId = promoteShowcase ? dependencies.createProjectId() : options.projectId?.trim() || dependencies.createProjectId();
    if (promoteShowcase && projectId === baseConfig.projectId) {
      throw new NewRemoteProjectTransactionError("configuration", "온라인 사본은 기존 작업과 다른 새 프로젝트 ID가 필요합니다.");
    }
    // 공용 데모 원본은 어떤 전환 경로로도 쓰기 대상이 될 수 없다 — 사본은 항상 새 id 다.
    if (projectId === SHARED_DEMO_PROJECT_ID) {
      throw new NewRemoteProjectTransactionError("configuration", "공용 데모 원본은 덮어쓸 수 없습니다. 사본은 새 프로젝트 ID로 저장됩니다.");
    }
    const targetConfig: SupabaseProjectConfig = { ...baseConfig, projectId };
    const title = options.title?.trim();
    if (title) nameNewProject(candidate, title);
    const lineageAfterFlush = this.contentLineage;

    let saved: SupabaseSaveResult;
    try {
      saved = await dependencies.saveTarget(projectWithoutEventDrafts(candidate), targetConfig);
    } catch (error) {
      throw new NewRemoteProjectTransactionError(
        "save",
        error instanceof Error ? error.message : "새 Supabase 프로젝트 저장에 실패했습니다.",
        error,
      );
    }
    if (saved.kind !== "saved") {
      throw new NewRemoteProjectTransactionError(
        "save",
        "새 Supabase 프로젝트 저장을 확인하지 못했습니다.",
      );
    }
    assertSourceCurrent();

    let reloaded: Project | null;
    try {
      reloaded = await dependencies.reloadTarget(targetConfig);
    } catch (error) {
      throw new NewRemoteProjectTransactionError(
        "reload",
        error instanceof Error ? error.message : "새 Supabase 프로젝트 재로드에 실패했습니다.",
        error,
      );
    }
    if (!reloaded) {
      throw new NewRemoteProjectTransactionError(
        "reload",
        "저장한 새 Supabase 프로젝트를 다시 읽지 못했습니다.",
      );
    }

    const expected = projectWithoutEventDrafts(promoteShowcase ? candidate : saved.project ?? candidate);
    if (serializeForComparison(expected) !== serializeForComparison(projectWithoutEventDrafts(reloaded))) {
      throw new NewRemoteProjectTransactionError(
        "verify",
        "새 Supabase 프로젝트의 저장본과 재로드 결과가 일치하지 않습니다.",
      );
    }
    assertSourceCurrent();
    // dirtySinceLastPersist 는 "원격에 아직 안 간 내 변경" — 읽기 전용 데모 세션에는
    // 원격 원본이 없어 이 플래그가 계속 켜져 있을 수 있다. 데모 소스의 정합성은
    // assertSourceCurrent(계보·세대·식별자 동일성)가 이미 보장한다.
    if (!promoteShowcase && !sharedDemoSession && (this.dirtySinceLastPersist
      || this.contentLineage !== lineageAfterFlush || !sameProjectTarget(baseConfig, this.repository.currentTarget()))) {
      throw new NewRemoteProjectTransactionError(
        "concurrent-edit",
        "준비 중 현재 프로젝트가 변경되어 전환을 취소했습니다. 변경 내용을 저장한 뒤 다시 시도하세요.",
      );
    }

    const localSnapshot = {
      current: this.current,
      dirtySinceLastPersist: this.dirtySinceLastPersist,
      loaded: this.loaded,
      loadedRemoteProjectId: this.loadedRemoteProjectId,
      mutationGeneration: this.mutationGeneration,
      persistedBaseline: this.persistedBaseline,
      lastPersistenceReceipt: this.lastPersistenceReceipt,
      contentLineage: this.contentLineage,
      writeAuthority: this.writeAuthority,
      persistenceRecovery: this.persistenceRecovery,
      remotePersistenceDisabledReason: this.remotePersistenceDisabledReason,
      remotePersistenceEnabled: this.remotePersistenceEnabled,
    };
    const draftVaultSnapshot = listEventDraftVaultEntries();
    const previousHref = browserHref();

    // Stage the only failure-prone browser write after every rollback snapshot
    // exists but before deleting drafts or adopting the candidate.
    let stagedConfig: ReturnType<typeof stageSupabaseProjectConfigDraft>;
    try {
      stagedConfig = stageSupabaseProjectConfigDraft({
        anonKey: draft.anonKey,
        projectId,
        url: draft.url,
      });
    } catch (error) {
      throw new NewRemoteProjectTransactionError(
        "commit",
        error instanceof Error ? error.message : "새 프로젝트 설정을 브라우저에 저장하지 못했습니다.",
        error,
      );
    }

    try {
      clearEventDraftVault();
      clearCopiedEventPage();
      this.adoptProject(structuredClone(reloaded), { restoreVault: false });
      this.writeAuthority = saved.authority ?? { mode: "legacy", target: targetConfig };
      this.persistenceRecovery = { kind: "ready", ...(saved.mirror ? { mirror: saved.mirror } : {}) };
      this.persistedBaseline = structuredClone(projectWithoutEventDrafts(reloaded));
      this.loaded = true;
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      this.dirtySinceLastPersist = false;
      this.mutationGeneration += 1;
      resetManualProjectCommitBaseline(this.current);
      syncProjectToUrl({ projectId, projectName: reloaded.meta?.title ?? null, clearDevProject: promoteShowcase });
      saveSupabaseSelectedProjectId(projectId);
      this.loadedRemoteProjectId = projectId;
      stagedConfig.commit();
    } catch (error) {
      this.current = localSnapshot.current;
      this.persistedBaseline = localSnapshot.persistedBaseline;
      this.lastPersistenceReceipt = localSnapshot.lastPersistenceReceipt;
      this.contentLineage = localSnapshot.contentLineage;
      this.writeAuthority = localSnapshot.writeAuthority;
      this.persistenceRecovery = localSnapshot.persistenceRecovery;
      this.loaded = localSnapshot.loaded;
      this.loadedRemoteProjectId = localSnapshot.loadedRemoteProjectId;
      this.remotePersistenceEnabled = localSnapshot.remotePersistenceEnabled;
      this.remotePersistenceDisabledReason = localSnapshot.remotePersistenceDisabledReason;
      this.dirtySinceLastPersist = localSnapshot.dirtySinceLastPersist;
      this.mutationGeneration = localSnapshot.mutationGeneration;
      restoreEventDraftVaultEntries(draftVaultSnapshot);
      try {
        stagedConfig.rollback();
      } catch (rollbackError) {
        log.error("Failed to roll back staged Supabase config", rollbackError);
      }
      restoreBrowserHref(previousHref);
      throw new NewRemoteProjectTransactionError(
        "commit",
        error instanceof Error ? error.message : "새 프로젝트의 로컬 전환을 완료하지 못했습니다.",
        error,
      );
    }

    // The old draft key is removed only after the switch can no longer reject.
    persistEventDraftVaultNow(baseConfig.projectId);
    if (promoteShowcase) {
      this.autoSaveRetryCount = 0;
      this.setAutoSaveState({ kind: "saved", at: Date.now() });
    }
    try {
      this.emit({ scope: "project", projectSwitch: true });
    } catch (error) {
      log.error("Project listener failed after transactional switch", error);
    }
    this.refreshSupabaseResourceCache();
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

  /** Client-local authored revision, not a save receipt or a remote writer lease. */
  getVersionToken(): Readonly<{ lineage: number; generation: number }> {
    return Object.freeze({ lineage: this.contentLineage, generation: this.mutationGeneration });
  }

  getProjectIdentity(): ProjectIdentity {
    return this.loadedRemoteProjectId
      ? { kind: "remote", id: this.loadedRemoteProjectId }
      : { kind: "local-session", id: this.localProjectSessionId };
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
    return this.repository.status(this.remotePersistenceDisabledReason);
  }

  /** Explicit raw activation. Ambiguous local edits require recovery, never marker-only token adoption. */
  async activateSpatialAuthoring(): Promise<ProjectFlushResult> {
    const repository = this.repository;
    const target = repository.currentTarget();
    if (!this.loaded || !this.remotePersistenceEnabled || !target || !this.writeAuthority
      || !sameProjectTarget(this.writeAuthority.target, target)) {
      throw new ProjectRoutingError("authority-required", "Load the legacy target before explicit activation.");
    }
    const activateLegacy = repository.activateLegacy;
    if (!activateLegacy) throw new ProjectRoutingError("authority-required", "This storage cannot activate a legacy target.");
    if (this.persistInFlight) throw new ProjectRoutingError("activation-stale", "A save is in progress; activation must start from an independent raw capture.");
    if (this.persistenceRecovery.kind === "blocked" && this.persistenceRecovery.error.code === "activation-stale") {
      throw this.persistenceRecovery.error;
    }
    const lineage = this.contentLineage;
    const generation = this.mutationGeneration;
    if (this.autoSaveTimer) { clearTimeout(this.autoSaveTimer); this.autoSaveTimer = null; }
    this.clearAutoSaveRetry();
    if (this.dirtySinceLastPersist) {
      const error = new ProjectRoutingError("activation-stale", "Local edits must be saved or copied before activation. Reload explicitly before trying again.");
      this.persistenceRecovery = { kind: "blocked", error, actions: ["reload", "export-copy"] };
      this.setAutoSaveState({ kind: "error", message: autoSaveErrorMessage(error) });
      throw error;
    }
    const run = (async (): Promise<ProjectFlushResult> => {
      try {
        const saved = await activateLegacy.call(repository, target);
        if (this.contentLineage !== lineage || !sameProjectTarget(target, this.repository.currentTarget())) return saved;
        if (this.mutationGeneration !== generation) {
          throw new ProjectRoutingError("activation-stale", "The remote activation was accepted, but newer local edits were not adopted or published. Reload or export a copy before saving.", {
            projectId: target.projectId, sha256: saved.sha256, mirror: saved.mirror,
            ...(saved.authority.mode === "canonical" && saved.authority.revision !== undefined ? { serverRevision: saved.authority.revision } : {}),
          });
        }
        this.writeAuthority = saved.authority;
        this.persistedBaseline = structuredClone(projectWithoutEventDrafts(saved.project));
        this.lastPersistenceReceipt = null;
        this.persistenceRecovery = { kind: "ready", mirror: saved.mirror };
        this.current = preserveEventDraftsOnProject(saved.project, this.current);
        syncEventDraftVaultFromProject(this.current);
        persistEventDraftVaultNow();
        this.dirtySinceLastPersist = false;
        this.setAutoSaveState({ kind: "saved", at: Date.now() });
        this.emit({ scope: "project", origin: "system", projectSwitch: false });
        return saved;
      } catch (error) {
        if (this.contentLineage === lineage && sameProjectTarget(target, this.repository.currentTarget())) {
          if (error instanceof SpatialPersistenceError || error instanceof ProjectRoutingError) {
            this.persistenceRecovery = { kind: "blocked", error, actions: ["reload", "export-copy"] };
          }
          this.setAutoSaveState({ kind: "error", message: autoSaveErrorMessage(error) });
        }
        throw error;
      } finally { this.persistInFlight = null; }
    })();
    this.persistInFlight = run;
    return run;
  }

  getPersistenceRecovery(): ProjectPersistenceRecovery {
    return this.persistenceRecovery;
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
    const status = this.repository.status(null);
    if (status.kind !== "ready") return { kind: "not-configured" };
    try {
      const { project, authority } = await this.readRemoteProject();
      if (project) {
        const sharedDemo = isSharedDemoProjectId(status.projectId);
        this.contentLineage += 1;
        this.lastPersistenceReceipt = null;
        this.current = preserveEventDraftsOnProject(project, this.current);
        clearCopiedEventPage();
        syncEventDraftVaultFromProject(this.current);
        // 재연결도 공용 데모 행을 쓰기 가능하게 만들지 않는다 — 대상이 데모면 읽기 전용 유지.
        this.remotePersistenceEnabled = !sharedDemo;
        this.remotePersistenceDisabledReason = sharedDemo ? "shared-demo" : null;
        this.loadedRemoteProjectId = status.projectId;
        this.writeAuthority = sharedDemo ? null : authority;
        this.persistenceRecovery = { kind: "ready" };
        this.loaded = true;
        if (this.writeAuthority?.mode === "canonical") {
          this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
          this.dirtySinceLastPersist = false;
        }
        await this.normalizeCurrentProject();
        if (this.writeAuthority?.mode !== "canonical") {
          this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
          this.dirtySinceLastPersist = false;
        }
        resetManualProjectCommitBaseline(this.current);
        this.dirtySinceLastPersist = false;
        await this.normalizeCurrentProject();
        this.syncProjectUrlBar();
        this.emit({ scope: "project", projectSwitch: true });
        this.refreshSupabaseResourceCache();
        return { kind: "connected", source: "remote" };
      }
      if (!isSharedDemoProjectId(status.projectId)) {
        this.remotePersistenceEnabled = true;
        this.remotePersistenceDisabledReason = null;
      }
      this.persistedBaseline = null;
      return { kind: "failed", message: "선택한 작업을 찾지 못했습니다. 목록에서 다시 선택하세요." };
    } catch (error) {
      if (!(error instanceof SpatialPersistenceError) && !(error instanceof ProjectRoutingError)) {
        this.remotePersistenceEnabled = false;
        this.remotePersistenceDisabledReason = "load-failed";
      }
      this.emit();
      return { kind: "failed", message: error instanceof Error ? error.message : "온라인 저장 연결 실패" };
    }
  }
  /**
   * DB에서 현재 projectId 프로젝트를 다시 읽어 에디터 메모리를 교체한다.
   * 외부 스크립트/다른 세션 저장분을 즉시 반영할 때 사용.
   */
  async reloadFromRemote(options: { readonly force?: boolean } = {}): Promise<ReloadFromRemoteResult> {
    const projectId = this.repository.currentTarget()?.projectId ?? null;
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
      const { project, authority } = await this.readRemoteProject();
      if (!project) {
        return { kind: "failed", message: "DB에서 프로젝트를 찾을 수 없습니다.", projectId };
      }
      this.contentLineage += 1;
      this.lastPersistenceReceipt = null;
      this.current = preserveEventDraftsOnProject(project, this.current);
      syncEventDraftVaultFromProject(this.current);
      this.remotePersistenceEnabled = true;
      this.remotePersistenceDisabledReason = null;
      if (projectId) this.loadedRemoteProjectId = projectId;
      this.writeAuthority = authority;
      this.persistenceRecovery = { kind: "ready" };
      if (this.writeAuthority?.mode === "canonical") {
        this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
        this.dirtySinceLastPersist = false;
      }
      await this.normalizeCurrentProject();
      if (this.writeAuthority?.mode !== "canonical") {
        this.persistedBaseline = structuredClone(projectWithoutEventDrafts(this.current));
        this.dirtySinceLastPersist = false;
      }
      resetManualProjectCommitBaseline(this.current);
      this.dirtySinceLastPersist = false;
      await this.normalizeCurrentProject();
      this.syncProjectUrlBar();
      // 같은 projectId의 원격 저장본을 다시 읽는 경로라 의도적으로 프로젝트 전환 표시를 하지 않는다.
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
    const config = this.repository.currentTarget();
    if (
      !config
      || !isRemoteTarget(config)
      || config.projectId !== input.expectedProjectId
      || config.url !== input.expectedTargetUrl
      || await sha256HexText(config.anonKey.trim()) !== input.expectedAnonKeyDigest
    ) {
      return { kind: "target-mismatch" };
    }
    return this.reloadFromRemote({ force: true });
  }

  /**
   * `change` 는 관측용 주석이다 — undo/AI 적용/원격 병합이 서로 구분되게 라벨을 실어 보낸다.
   * 생략하면 라벨 없는 project 스코프 변경으로 기록된다(`__oprnUnlabeledEditCount()` 에 집계).
   * Returns the applied project captured before synchronous mutation subscribers run.
   */
  replace(
    project: Project,
    options: {
      readonly preserveEventDrafts?: boolean;
      readonly change?: ProjectChangeAnnotation;
      /** Account the actual mutation before any synchronous observers can retire its owner. */
      readonly onApplied?: (project: Project) => void;
      /** Trusted synchronous history commit, after adoption and before mutation observers. */
      readonly commitHistory?: () => void;
    } = {},
  ): Project {
    assertCanonicalReplacement(project, this.writeAuthority);
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
    if (options.preserveEventDrafts === false || options.change?.projectSwitch === true) {
      this.contentLineage += 1;
      this.lastPersistenceReceipt = null;
      this.persistedBaseline = null;
    }
    if (options.change?.projectSwitch === true) clearCopiedEventPage();
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
    const applied = this.current;
    options.commitHistory?.();
    try {
      this.markLocalMutation({ scope: "project", ...(options.change ?? {}) }, options.onApplied);
    } finally {
      // The project is already live even if application accounting's observer throws.
      this.emit({ scope: "project", ...(options.change ?? {}) });
      this.scheduleAutoSave();
    }
    return applied;
  }

  /** Full project switch (new/import/sample). Drops event-draft vault for the previous project. */
  replaceProject(project: Project, change?: ProjectChangeAnnotation, onApplied?: (project: Project) => void): Project {
    assertCanonicalReplacement(project, this.writeAuthority);
    clearEventDraftVault();
    clearCopiedEventPage();
    persistEventDraftVaultNow();
    if (this.loadedRemoteProjectId === null) this.beginLocalProjectSession();
    return this.replace(project, {
      preserveEventDrafts: false,
      change: { label: "프로젝트 교체", projectSwitch: true, ...(change ?? {}) },
      onApplied,
    });
  }

  update(mutator: (draft: Project) => void, change: ProjectChangeDescriptor = { scope: "project" }): void {
    const draft: Project = structuredClone(this.current);
    mutator(draft);
    assertCanonicalReplacement(draft, this.writeAuthority);
    ensureProjectMapConnections(draft);
    ensureMapTreeCoversAllMaps(draft);
    ensureSwitchVariableSlots(draft);
    removeLegacySpriteReferences(draft);
    this.current = draft;
    syncEventDraftVaultFromProject(this.current);
    this.markLocalMutation(change);
    this.emit(change);
    this.scheduleAutoSave();
  }

  updateMap(
    mapId: MapId,
    mapMutator: (draft: GameMap) => void,
    change: { readonly cells?: readonly ProjectChangeCell[] } & ProjectChangeAnnotation = {}
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
    const descriptor: ProjectChangeDescriptor = { scope: "map", mapId, ...change };
    this.markLocalMutation(descriptor);
    this.emit(descriptor);
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

  /** Historical acceptance belongs to its actual submitted owner, not the latest live revision. */
  isPersistenceReceiptForProject(receipt: ProjectPersistenceReceipt, project: Project): boolean {
    return this.persistenceTargets.get(receipt)?.projectAtSubmit === project;
  }

  /** Recheck at consumption time: proof can outlive the editor revision it describes. */
  isPersistenceReceiptCurrent(receipt: ProjectPersistenceReceipt): boolean {
    const authority = this.persistenceTargets.get(receipt);
    const target = authority?.target;
    const config = this.repository.currentTarget();
    return this.loaded && this.remotePersistenceEnabled
      && this.lastPersistenceReceipt === receipt
      && this.mutationGeneration === receipt.mutationGeneration
      && authority?.contentLineage === this.contentLineage
      && !!target && !!config
      && sameProjectTarget(target, config);
  }

  /** Read-only verification of a store-issued save receipt. Failed attempts are always retryable. */
  async verifyPersistedRevision(
    receipt: ProjectPersistenceReceipt,
    options: { readonly signal?: AbortSignal; readonly validate?: (project: Project) => string | undefined } = {},
  ): Promise<ProjectPersistenceProof> {
    const target = this.persistenceTargets.get(receipt)?.target;
    if (!target) return { kind: "failed", receipt, message: "Unknown accepted revision" };
    if (options.signal?.aborted) return { kind: "cancelled", receipt };
    if (!this.remotePersistenceEnabled) return { kind: "disabled", receipt };
    try {
      const read = await this.repository.loadForProof(target, options.signal);
      if (options.signal?.aborted) return { kind: "cancelled", receipt };
      if (!this.remotePersistenceEnabled) return { kind: "disabled", receipt };
      if (!read) return { kind: "failed", receipt, message: "Saved project not found" };
      if (read.projectId !== receipt.projectId) return { kind: "mismatch", receipt, reason: "target" };
      const observedIdentity = await sha256HexText(serializeForComparison(projectWithoutEventDrafts(read.project)));
      if (options.signal?.aborted) return { kind: "cancelled", receipt };
      if (!this.remotePersistenceEnabled) return { kind: "disabled", receipt };
      if (observedIdentity !== receipt.contentIdentity) return { kind: "mismatch", receipt, reason: "content" };
      // Trusted run-end validators see only the canonical read that matched this receipt.
      const validationProblem = options.validate?.(read.project);
      if (options.signal?.aborted) return { kind: "cancelled", receipt };
      if (validationProblem) return { kind: "failed", receipt, message: validationProblem };
      return { kind: "verified", receipt, isCurrent: this.isPersistenceReceiptCurrent(receipt) };
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
        return { kind: "cancelled", receipt };
      }
      return { kind: "failed", receipt, message: error instanceof Error ? error.message : String(error) };
    }
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
      if (this.remotePersistenceEnabled) {
        const receipt = this.lastPersistenceReceipt;
        return receipt && this.isPersistenceReceiptCurrent(receipt)
          ? { kind: "saved", receipt, ...(receipt.sha256 ? { sha256: receipt.sha256 } : {}) }
          : { kind: "saved" };
      }
      if (this.remotePersistenceDisabledReason === "dev-showcase") return { kind: "saved-local" };
      return this.remotePersistenceDisabledReason === null ? { kind: "not-configured" } : { kind: "disabled" };
    }
    return await this.saveCurrentWithAutoSaveState();
  }

  async clearAll(): Promise<void> {
    assertCanonicalReplacement(createBlankProject(), this.writeAuthority);
    clearEventDraftVault();
    clearCopiedEventPage();
    persistEventDraftVaultNow();
    this.contentLineage += 1;
    this.lastPersistenceReceipt = null;
    this.persistedBaseline = null;
    this.current = createBlankProject();
    if (this.loadedRemoteProjectId === null) this.beginLocalProjectSession();
    this.markLocalMutation({ scope: "project", label: "전체 초기화" });
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
    this.markLocalMutation({ scope: "map", mapId, label: "드래프트 금고 복원", origin: "system", eventId });
    this.emit({ scope: "map", mapId });
    this.scheduleAutoSave();
    return true;
  }

  /**
   * Local edit counter — remote save responses must not clobber a newer generation.
   *
   * **관측 초크포인트.** 상태를 바꾸는 5개 메서드(`update`/`updateMap`/`replace`/`clearAll`/
   * `restoreEventDraftFromVault`)가 전부 여기를 지나므로, 275개 mutation 호출부 전량이
   * 외부 파일 수정 없이 계측된다. 호출자는 전부 이 클래스 안에 있다 — 이 성질을
   * test/storeMutationInstrumentation.test.ts 가 고정한다.
   */
  private markLocalMutation(change: ProjectChangeDescriptor, onApplied?: (project: Project) => void): void {
    this.mutationGeneration += 1;
    this.dirtySinceLastPersist = true;
    try {
      onApplied?.(this.current);
    } finally {
      this.recordChangeActivity(change);
    }
  }

  /**
   * 편집 행위 1건을 감사 로그에 남긴다.
   *
   * 성능: descriptor 에 이미 담긴 값만 읽는다. **여기서 diff 를 계산하지 않는다** —
   * 페인트 스트로크마다 전 맵 비교를 돌리는 셈이 되고, 그게 새 병목이 된다.
   * 필드 단위 상세는 호출자가 이미 계산해 둔 것(이벤트 편집기의 EventDiff 등)만 실어 보낸다.
   */
  private recordChangeActivity(change: ProjectChangeDescriptor): void {
    try {
      recordEditActivity({
        scope: change.scope,
        label: change.label ?? null,
        generation: this.mutationGeneration,
        ...(change.origin === undefined ? {} : { origin: change.origin }),
        ...(change.scope === "map"
          ? { mapId: change.mapId, ...(change.cells === undefined ? {} : { cellCount: change.cells.length }) }
          : {}),
        ...(change.scope === "database" && change.collection !== undefined
          ? { collection: change.collection }
          : {}),
        ...(change.fields === undefined ? {} : { fields: change.fields }),
        ...(change.eventId === undefined ? {} : { eventId: change.eventId }),
        ...(change.reason === undefined ? {} : { reason: change.reason }),
      });
    } catch (error) {
      // 관측이 편집을 막으면 안 된다 — 기록 실패는 경고로 남기고 편집은 그대로 진행한다.
      log.warn("편집 행위 기록 실패", error);
    }
  }

  private beginLocalProjectSession(): void {
    this.loadedRemoteProjectId = null;
    this.writeAuthority = null;
    this.localProjectSessionId = randomUuid();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 리스너 1개의 예외가 나머지를 죽이지 않게 격리한다.
   *
   * 실측(2026-08-29): try/catch 가 없어서 구독자 하나가 던지면 뒤에 등록된 구독자 전부가
   * 그 프레임에서 건너뛰어졌다 — 캔버스 재렌더·자동저장 예약·패널 갱신이 한꺼번에 멈추는데
   * 원인 로그는 어디에도 남지 않았다. 격리하고 어느 리스너가 던졌는지 기록한다.
   */
  private emit(change: ProjectChangeDescriptor = { scope: "project" }): void {
    for (const listener of this.listeners) {
      try {
        listener(this.current, change);
      } catch (error) {
        log.error("프로젝트 변경 리스너가 예외를 던졌다 — 나머지 리스너는 계속 실행한다", {
          scope: change.scope,
          label: change.label ?? null,
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }
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
    if (!this.remotePersistenceEnabled) {
      if (this.remotePersistenceDisabledReason === "dev-showcase" && isSaveSkippedLocation()) {
        this.setAutoSaveState(nonPersistentSessionAutoSaveState());
      }
      return;
    }
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.clearAutoSaveRetry();
    const lineage = this.contentLineage;
    const timer = setTimeout(() => {
      // A queued callback cannot consume a replacement's timer or save its content.
      if (this.contentLineage !== lineage || this.autoSaveTimer !== timer) return;
      this.autoSaveTimer = null;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        log.error("Supabase auto-save failed", error);
      });
    }, this.autoSaveDelayMs);
    this.autoSaveTimer = timer;
    // Publish after registration: a synchronous subscriber may schedule its own save.
    this.setAutoSaveState({ kind: "pending" });
  }

  private clearAutoSaveRetry(): void {
    if (!this.autoSaveRetryTimer) return;
    clearTimeout(this.autoSaveRetryTimer);
    this.autoSaveRetryTimer = null;
  }

  private scheduleAutoSaveRetry(lineage: number): void {
    // The error-state subscriber may have replaced the failed save's project.
    if (this.contentLineage !== lineage || this.autoSaveRetryTimer) return;
    const delay = Math.min(
      this.autoSaveRetryBaseDelayMs * 2 ** this.autoSaveRetryCount,
      this.autoSaveRetryMaxDelayMs,
    );
    const timer = setTimeout(() => {
      if (this.contentLineage !== lineage || this.autoSaveRetryTimer !== timer) return;
      this.autoSaveRetryTimer = null;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        log.error("Supabase auto-save retry failed", error);
      });
    }, delay);
    this.autoSaveRetryTimer = timer;
    this.startHealthCheck(lineage);
  }

  /**
   * Periodic lightweight probe while in error state. If the DB responds we
   * immediately attempt a flush instead of waiting for the next backoff tick.
   */
  private startHealthCheck(lineage: number): void {
    if (this.healthCheckTimer && this.healthCheckLineage === lineage) return;
    this.stopHealthCheck();
    const timer = setInterval(() => this.runHealthCheck(lineage, timer), this.healthCheckIntervalMs);
    this.healthCheckTimer = timer;
    this.healthCheckLineage = lineage;
  }

  private stopHealthCheck(): void {
    if (!this.healthCheckTimer) return;
    clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }

  private async runHealthCheck(lineage: number, timer: ReturnType<typeof setInterval>): Promise<void> {
    if (this.contentLineage !== lineage || this.healthCheckTimer !== timer) return;
    if (!this.loaded || !this.remotePersistenceEnabled) {
      this.stopHealthCheck();
      return;
    }
    if (!this.repository.currentTarget()) {
      this.stopHealthCheck();
      return;
    }
    const reachable = await this.repository.probe();
    if (this.contentLineage !== lineage || this.healthCheckTimer !== timer) return;
    if (reachable) {
      log.info("Health check: DB reachable, attempting flush");
      this.stopHealthCheck();
      this.clearAutoSaveRetry();
      this.autoSaveRetryCount = 0;
      void this.saveCurrentWithAutoSaveState().catch((error) => {
        log.error("Health-check-triggered flush failed", error);
      });
    } else {
      log.warn("Health check: DB not reachable — not triggering flush");
    }
  }

  /** Browser "online" event: network interface came back. */
  private onNetworkRestored(): void {
    if (!this.loaded || !this.remotePersistenceEnabled) return;
    if (this.autoSaveState.kind !== "error") return;
    log.info("Network restored, attempting immediate flush");
    this.stopHealthCheck();
    this.clearAutoSaveRetry();
    void this.saveCurrentWithAutoSaveState().catch((error) => {
      log.error("Online-event flush failed", error);
    });
  }

  private async saveCurrentWithAutoSaveState(): Promise<ProjectFlushResult> {
    // Coalesce concurrent flush calls onto one network round-trip, then re-run
    // if the user painted more tiles while that round-trip was in flight.
    const lineage = this.contentLineage;
    if (this.persistInFlight && this.persistInFlightLineage !== lineage) {
      // A replacement's explicit request waits for the older transport, but
      // neither inherits its result nor gives that old save catch-up authority.
      try {
        await this.persistInFlight;
      } catch (error) {
        // The original promise still rejects to its callers. Only this separate
        // owner's request may proceed after the failed transport has settled.
        log.warn("Earlier project save failed before queued replacement flush", error);
      }
      if (this.contentLineage !== lineage) return { kind: "disabled" };
      return await this.saveCurrentWithAutoSaveState();
    }
    if (this.persistInFlight && this.persistInFlightLineage === lineage) {
      const inFlightResult = await this.persistInFlight;
      if (this.contentLineage === lineage && this.dirtySinceLastPersist && this.loaded && this.remotePersistenceEnabled) {
        return await this.saveCurrentWithAutoSaveState();
      }
      return inFlightResult;
    }
    this.setAutoSaveState({ kind: "saving" });
    // Status subscribers run synchronously and may replace the project (and even
    // start its own flush). This request no longer authorizes a write after that.
    if (this.contentLineage !== lineage) return { kind: "disabled" };
    const target = this.repository.currentTarget();
    const canonical = Object.hasOwn(this.current, "spatialAuthoring") || this.writeAuthority?.mode === "canonical";
    const run = (async (): Promise<ProjectFlushResult> => {
      try {
        // Local-first catch-up: if paint lands during a save RTT, persist again
        // immediately instead of reporting "saved" while still dirty and waiting
        // the full autosave debounce (tiles stay local; DB just lags one hop).
        let result = await this.persistCurrent();
        while (
          this.dirtySinceLastPersist
          && this.contentLineage === lineage
          && this.loaded
          && this.remotePersistenceEnabled
          && result.kind === "saved"
          && (!canonical || this.contentLineage === lineage)
          && target !== null && sameProjectTarget(target, this.repository.currentTarget())
        ) {
          result = await this.persistCurrent();
        }
        if (target && !sameProjectTarget(target, this.repository.currentTarget())) return result;
        if (this.contentLineage === lineage) {
          this.setAutoSaveState(autoSaveStateForFlushResult(
            result,
            this.remotePersistenceDisabledReason === "dev-showcase"
              && isSaveSkippedLocation()
              && this.dirtySinceLastPersist,
          ));
          this.autoSaveRetryCount = 0;
          this.stopHealthCheck();
        }
        return result;
      } catch (error) {
        if (target && !sameProjectTarget(target, this.repository.currentTarget())) throw error;
        if (error instanceof SpatialPersistenceError || error instanceof ProjectRoutingError) {
          this.persistenceRecovery = { kind: "blocked", error, actions: ["reload", "export-copy"] };
          this.clearAutoSaveRetry();
          this.stopHealthCheck();
        }
        if (this.contentLineage === lineage) {
          this.autoSaveRetryCount += 1;
          this.setAutoSaveState({ kind: "error", message: autoSaveErrorMessage(error), retryCount: this.autoSaveRetryCount });
          if (this.remotePersistenceEnabled) this.scheduleAutoSaveRetry(lineage);
        }
        throw error;
      } finally {
        if (this.persistInFlightLineage === lineage) this.persistInFlight = null;
      }
    })();
    this.persistInFlight = run;
    this.persistInFlightLineage = lineage;
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
          if (diagnosticObserved("authoring")) publishDiagnostic({ category: "authoring", phase: "saved", generation: this.mutationGeneration, storage: "local" });
        }
        return { kind: "saved-local" };
      }
      return this.remotePersistenceDisabledReason === null ? { kind: "not-configured" } : { kind: "disabled" };
    }
    // Snapshot local state at submit time. Paint during await must win over the response.
    const config = this.repository.currentTarget();
    if (!config) return { kind: "not-configured" };
    if (this.persistenceRecovery.kind === "blocked" && this.persistenceRecovery.error.code === "activation-stale") {
      throw this.persistenceRecovery.error;
    }
    const target = Object.freeze({ ...config });
    const generationAtSubmit = this.mutationGeneration;
    const diagnosticOwner = diagnosticToken();
    const lineageAtSubmit = this.contentLineage;
    const projectAtSubmit = this.current;
    const submittedProject = projectWithoutEventDrafts(projectAtSubmit);
    // 커밋 로그가 쓸 diff baseline — **이 저장 직전에 서버가 갖고 있던 내용**이다.
    // 아래에서 `this.persistedBaseline` 을 저장 결과로 갈아치우므로 여기서 잡아두지 않으면
    // 커밋 diff 가 "자기 자신과의 비교"(=빈 diff)로 무너진다. await 앞에서 읽는 이유는
    // normalizeCurrentProject 가 persistInFlight 코얼레싱 밖에서 persistCurrent 를 직접
    // 부르는 경로가 있어서다 — RTT 중에 이 필드가 다른 저장에 의해 바뀔 수 있다.
    const commitBaseline = this.persistedBaseline;
    const authority = this.writeAuthority ?? undefined;
    const result = commitBaseline
      ? await this.repository.saveMapPatch({ project: submittedProject, baseProject: commitBaseline, authority }, target)
      : await this.repository.save(submittedProject, target, authority);
    if (result.kind === "not-configured") return result;
    if (result.kind === "conflict") return result;
    const savedProject = result.project ?? submittedProject;
    // Keep accepted content detached even if a replacement arrives during receipt hashing.
    const acceptedBaseline = structuredClone(projectWithoutEventDrafts(savedProject));
    let receipt: ProjectPersistenceReceipt | undefined;
    try {
      // Capture accepted content before the hash await; never derive it from live getCurrent().
      const acceptedContent = serializeForComparison(acceptedBaseline);
      receipt = Object.freeze({
        revisionId: randomUuid(),
        projectId: target.projectId,
        mutationGeneration: generationAtSubmit,
        contentIdentity: await sha256HexText(acceptedContent),
        ...(result.sha256 ? { sha256: result.sha256 } : {}),
        ...(result.authority?.mode === "canonical" && result.authority.revision !== undefined ? { serverRevision: result.authority.revision } : {}),
      });
      this.persistenceTargets.set(receipt, { target, contentLineage: lineageAtSubmit, projectAtSubmit });
    } catch (error) {
      // Intermediate projects may save but cannot supply normalized proof. Preserve flush compatibility.
      log.warn("Accepted project could not produce a persistence receipt", error);
    }
    recordManualProjectCommitAfterSave(savedProject, commitBaseline);
    // Historical saves retain proof, but cannot adopt a baseline, metadata or dirty state
    // into a replacement project (including a replacement during the hash await).
    if (this.contentLineage !== lineageAtSubmit || !sameProjectTarget(target, this.repository.currentTarget())) return receipt ? { ...result, receipt } : result;
    if (result.authority) this.writeAuthority = result.authority;
    this.persistenceRecovery = { kind: "ready", ...(result.mirror ? { mirror: result.mirror } : {}) };
    this.persistedBaseline = acceptedBaseline;
    this.lastPersistenceReceipt = receipt ?? null;
    if (receipt && diagnosticOwner && diagnosticOwner === diagnosticToken() && diagnosticObserved("authoring")) {
      publishDiagnostic({ category: "authoring", phase: "saved", generation: generationAtSubmit, storage: "remote" });
    }
    const audioDescriptions = applyAudioDescriptionDelta(
      submittedProject.audioDescriptions,
      this.current.audioDescriptions,
      savedProject.audioDescriptions,
    );
    const monsterMetadata = applyMonsterMetadataDelta(
      submittedProject.monsterMetadata,
      this.current.monsterMetadata,
      savedProject.monsterMetadata,
    );
    if (JSON.stringify(audioDescriptions) !== JSON.stringify(this.current.audioDescriptions)
      || JSON.stringify(monsterMetadata) !== JSON.stringify(this.current.monsterMetadata)) {
      const reconciledProject = { ...this.current };
      if (audioDescriptions === undefined) delete reconciledProject.audioDescriptions;
      else reconciledProject.audioDescriptions = structuredClone(audioDescriptions);
      if (monsterMetadata === undefined) delete reconciledProject.monsterMetadata;
      else reconciledProject.monsterMetadata = structuredClone(monsterMetadata);
      this.current = reconciledProject;
      // Synchronization is observable, but is not a new authored mutation.
      this.emit({ scope: "project", origin: "system", projectSwitch: false });
    }
    // A synchronization subscriber may itself replace the project.
    if (this.contentLineage !== lineageAtSubmit) return receipt ? { ...result, receipt } : result;
    // Local-first: never replace live maps with the save response.
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
    this.refreshSupabaseResourceCache();
    return receipt ? { ...result, receipt } : result;
  }

  /**
   * Load/switch to a project while restoring any crash-recovered event drafts
   * for the current DB project id.
   */
  private adoptProject(project: Project, options: { readonly restoreVault: boolean }): void {
    this.contentLineage += 1;
    this.lastPersistenceReceipt = null;
    this.writeAuthority = null;
    this.persistenceRecovery = { kind: "ready" };
    clearEventDraftVault();
    clearCopiedEventPage();
    if (options.restoreVault) {
      loadEventDraftVaultFromLocalStorage();
      this.current = applyEventDraftVault(project);
    } else {
      this.current = project;
    }
    syncEventDraftVaultFromProject(this.current);
  }

  private async readRemoteProject(): Promise<{
    readonly project: Project | null;
    readonly authority: ProjectWriteAuthority | null;
    readonly target: ProjectTarget | null;
  }> {
    const target = this.repository.currentTarget();
    const lineage = this.contentLineage;
    const generation = this.mutationGeneration;
    let authority: ProjectWriteAuthority | null = null;
    try {
      const project = await this.repository.loadProject(target, value => { authority = value; });
      if (this.contentLineage !== lineage || this.mutationGeneration !== generation || (target && !sameProjectTarget(target, this.repository.currentTarget()))) {
        throw new ProjectRoutingError("target-changed", "Local content or target changed while loading; the late response was not adopted.");
      }
      return { project, authority, target };
    } catch (error) {
      if (this.contentLineage === lineage && target && sameProjectTarget(target, this.repository.currentTarget())
        && (error instanceof SpatialPersistenceError || error instanceof ProjectRoutingError)) {
        this.persistenceRecovery = { kind: "blocked", error, actions: ["reload", "export-copy"] };
      }
      throw error;
    }
  }

  private async normalizeCurrentProject(options: { readonly persistIfChanged?: boolean } = {}): Promise<void> {
    const persistIfChanged = options.persistIfChanged !== false;
    // Helpers can report transient changes while reaching the same final structure.
    // Compare raw records, not deserialize/canonical hashing: no authored fields are forgiven.
    const before = structuralJson(this.current);
    // 어느 정규화기가 실제로 손을 댔는지 이름으로 남긴다.
    // 실측(2026-08-29): 이 13개는 `this.current` 를 in-place 로 고치면서 markLocalMutation 을
    // 부르지 않는다 — 프로젝트가 로드 중에 조용히 바뀌는데 그 사실이 어디에도 안 남아서
    // "내가 안 건드렸는데 값이 달라졌다" 를 추적할 수 없었다.
    const normalizers: readonly (readonly [string, boolean])[] = [
      ["legacyDialogue", rewriteLegacyAdvancedDialogueInProject(this.current)],
      ["mapConnections", ensureProjectMapConnections(this.current)],
      // 실내 보강은 mapTree 고아 복구보다 먼저 — 새로 넣은 실내 맵이 같은 패스에서 트리에 편입된다.
      ["scarloxyInteriors", ensureScarloxyPokemonInteriors(this.current)],
      ["mapTreeCoverage", ensureMapTreeCoversAllMaps(this.current)],
      ["switchVariableSlots", ensureSwitchVariableSlots(this.current)],
      ["bundledTilesets", ensureBundledTilesets(this.current)],
      ["interiorPropLayers", repairInteriorTransparentPropLayers(this.current)],
      ["legacyRmTileset", removeLegacyRmTileset(this.current)],
      ["legacySpriteRefs", removeLegacySpriteReferences(this.current)],
      ["bundledResourceProfiles", ensureBundledResourceProfiles(this.current)],
      ["databaseIconResources", ensureDefaultDatabaseIconResources(this.current)],
      // 팩 이전 스냅샷은 anim_gen_* 이 없어 스타터 아이템·스킬 참조가 끊긴다 —
      // 그대로 두면 fail-closed 재생 게이트가 ▶테스트를 조용히 막는다.
      ["bundledBattleAnimations", ensureBundledBattleAnimations(this.current)],
    ];
    const appliedNormalizers = normalizers.filter(([, applied]) => applied).map(([name]) => name);
    const changed = before !== structuralJson(this.current);
    if (changed) {
      this.markLocalMutation({
        scope: "system",
        label: `프로젝트 정규화 (${appliedNormalizers.length}종)`,
        origin: "system",
        fields: appliedNormalizers.map((name) => ({ path: name, after: true })),
      });
    }
    // 업로드 시트의 진짜 절단은 canvas 가 필수라 동기 보정 배열 밖에서 돌린다.
    // 쪼갤 것이 없으면 await 조차 하지 않는다 — 로드 경로에 자시합을 더하면 지속화 순서가 바뀐다.
    const repairTarget = this.current;
    const repairLineage = this.contentLineage;
    const facesRepaired = hasPendingFacesetSheetRepair(repairTarget)
      ? await repairUploadedFacesetSheets(repairTarget)
      : false;
    // The repair mutates its captured object, not necessarily the current project.
    // A normal edit can also replace that object without advancing load lineage.
    if (this.current !== repairTarget || this.contentLineage !== repairLineage) return;
    if (facesRepaired) {
      this.markLocalMutation({ scope: "system", origin: "system", label: "Faceset sheet migration" });
      this.emit();
    }
    // Boot load must not block the editor on a full remote rewrite (~2MB+).
    // Schedule deferred auto-save so the shell can paint first.
    if ((changed || facesRepaired) && this.remotePersistenceEnabled) {
      this.dirtySinceLastPersist = true;
      if (persistIfChanged && this.writeAuthority?.mode !== "canonical") await this.persistCurrent();
      else if (persistIfChanged && !this.persistInFlight) await this.saveCurrentWithAutoSaveState();
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
          log.warn("Supabase resource cache skipped", report.skipped);
        }
      })
      .catch((error) => {
        log.error("Supabase resource cache refresh failed", error);
      });
  }

  /** 주소창에 ?project=&name= 반영 (공유/북마크). */
  private syncProjectUrlBar(): void {
    if (!this.remotePersistenceEnabled) return;
    const projectId = this.repository.currentTarget()?.projectId;
    if (!projectId) return;
    syncProjectToUrl({
      projectId,
      projectName: this.current.meta?.title ?? null,
    });
  }
}

export const store = new ProjectStore();

function nameNewProject(project: Project, title: string): void {
  const playerTitle = project.system.titleScreen?.title?.trim();
  if (!playerTitle || playerTitle === defaultTitleScreenSettings().title) {
    project.system.titleScreen = { ...(project.system.titleScreen ?? defaultTitleScreenSettings()), title };
  }
  project.meta = { ...project.meta, title };
}

function browserHref(): string | null {
  if (typeof window === "undefined") return null;
  return typeof window.location?.href === "string" ? window.location.href : null;
}

function restoreBrowserHref(href: string | null): void {
  if (!href || typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    window.history.replaceState(window.history.state, "", href);
  } catch {
    /* A malformed or cross-origin test location must not hide the original commit failure. */
  }
}

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

function autoSaveStateForFlushResult(result: ProjectFlushResult, sessionNotPersisted = false): AutoSaveState {
  switch (result.kind) {
    case "saved":
      return { kind: "saved", at: Date.now() };
    case "saved-local":
      return sessionNotPersisted ? nonPersistentSessionAutoSaveState() : { kind: "saved", at: Date.now() };
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

function nonPersistentSessionAutoSaveState(): AutoSaveState {
  return {
    kind: "error",
    code: "session-not-persisted",
    message: "이 세션은 저장되지 않습니다. 보존하려면 프로젝트를 내보내세요.",
  };
}

function autoSaveErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 저장 오류";
}
