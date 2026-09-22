import { canWriteTeamProject } from './teamAccess';
import { mergeTeamProject } from "./persistence/core/teamMerge";
import { clearCopiedEventPage } from "@/editor/eventPageClipboard";
import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";
import { rewriteLegacyAdvancedDialogueInProject } from "@/project/io/rewriteLegacyDialogue";
import { createBlankProject } from "./defaults";
// defaultProject 가 아니라 blankProject 에서 가져온다 — defaultProject 는 데모·쇼케이스 빌더 때문에
// 에디터 인테리어 파이프라인을 끌고, store 를 import 하는 테스트 669개가 그 비용을 물게 된다.
import { ensureSwitchVariableSlots } from "./defaults/blankProject";
import { ensureBundledResourceProfiles, ensureBundledTilesets, removeLegacyRmTileset, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { hasPendingFacesetSheetRepair, repairUploadedFacesetSheets } from "@/assets/facesetSheetRepair";
import { repairInteriorTransparentPropLayers } from "./defaults/interiorTransparentPropLayerRepair";
import { ensureScarloxyPokemonInteriors } from "./defaults/scarloxyPokemonInteriors";
import { ensureDefaultDatabaseIconResources } from "./defaults/defaultDatabaseIconResources";
import { ensureBundledBattleAnimations } from "./defaults/defaultDatabase";
import { isSaveSkippedLocation, loadDevProjectOverride, saveDevProjectOverride } from "./devProjectPersistence";
import type { ProjectWriteAuthority } from "./spatial/saveRouting";
import type { SaveResult } from "./persistence/types";
import type { RemoteProjectTarget } from "./persistence/target";
import { isSharedDemoProjectId, SHARED_DEMO_PROJECT_ID } from "./sharedDemoProject";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { assertCanonicalReplacement, ProjectRoutingError } from "./spatial/saveRouting";
import { SpatialPersistenceError, type MirrorStatus } from "./spatial/persistenceTypes";
import { applyAudioDescriptionDelta } from "./audioDescriptions";
import { applyMonsterMetadataDelta } from "./monsterMetadata";
import { serialize, serializeForComparison } from "./io";
import {
  applyEventDraftVault,
  clearEventDraftVault,
  loadEventDraftVaultFromLocalStorage,
  persistEventDraftVaultNow,
  preserveEventDraftsOnProject,
  syncEventDraftVaultFromProject,
} from "./eventDraftVault";
import { syncProjectToUrl } from "./projectUrl";
import type { DbPersistenceDisabledReason, PersistenceStatus as DbPersistenceStatus } from "./persistence/types";
import { projectRepository } from "./persistence/repository";
import { isLocalTarget, isRemoteTarget, sameProjectTarget, type ProjectTarget } from "./persistence/target";
import type { ProjectRepository } from "./persistence/types";
import { recordManualProjectCommitAfterSave, resetManualProjectCommitBaseline } from "./projectCommitLog";
import { repairMapTreeOrphans } from "@/project/mapTree";
import { sha256HexText } from "@/util/sha256";
import { normalizationFingerprint } from "@/util/structuralJson";
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
  readonly reloadTarget: (config: RemoteProjectTarget) => Promise<Project | null>;
  readonly saveTarget: (project: Project, config: RemoteProjectTarget) => Promise<SaveResult>;
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
    let seededNewLocalProject = false;
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
          if (!project && target !== null && isLocalTarget(target)) {
            // 비어 있는 로컬 폴더는 "새 프로젝트"다 — 호스트(앱·로컬 서버)가 폴더를
            // 열어줬는데 "작업을 찾지 못함" 오류로 떨어지면 온라인 선택지가 없는 패키징
            // 앱이 DB 연결 화면에 갇힌다(2026-09-17 패키징 실측: db-required-panel).
            // 빈 문서를 채택하고 dirty 로 둬 첫 flush 가 폴더에 심는다.
            this.adoptProject(createBlankProject(), { restoreVault: false });
            this.loadedRemoteProjectId = target.projectId;
            this.writeAuthority = { mode: "legacy", target };
            this.remotePersistenceEnabled = true;
            this.remotePersistenceDisabledReason = null;
            this.persistedBaseline = null;
            seededNewLocalProject = true;
            resetManualProjectCommitBaseline(this.current);
            this.syncProjectUrlBar();
          } else if (!project) {
            this.remotePersistenceEnabled = true;
            this.remotePersistenceDisabledReason = null;
            this.persistedBaseline = null;
            throw new DbConnectionRequiredError("선택한 작업을 찾지 못했습니다.");
          } else {
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
      }
      this.loaded = true;
      this.dirtySinceLastPersist = false;
      // Defer remote rewrite of normalize fixes so boot is not blocked on Tailscale/dbserver RTT.
      this.dirtySinceLastPersist = false;
      // 방금 채택한 새 로컬 프로젝트는 폴더에 문서가 없다 — 첫 flush 대상으로 dirty 를 되돌린다.
      if (seededNewLocalProject && canWriteTeamProject()) this.dirtySinceLastPersist = true;
      await this.normalizeCurrentProject({ persistIfChanged: false });
    } catch (error) {
      if (error instanceof DbConnectionRequiredError) {
        this.loaded = false;
        throw error;
      }
      this.remotePersistenceEnabled = false;
      this.remotePersistenceDisabledReason = "load-failed";
      log.error("Canonical project load failed", error);
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

  /**
   * 호스트(앱·로컬 서버)가 폴더를 열어둔 채 이 렌더러를 띄웠는가.
   *
   * 첫 방문 게이트가 이걸 봐야 한다 — 호스트가 폴더를 열어줬는데도 "이 기기에 저장된 선택이
   * 없다"는 이유로 원격 공용 데모를 부르면, 원격 설정이 없는 패키징 앱에서는 CSP 가 그 fetch 를
   * 막아 **로드 실패 화면**으로 떨어진다(2026-09-16 패키징 실측). 채택된 로컬 정본이 있으면
   * 그게 곷 사용자의 작업이다.
   */
  hasAdoptedLocalProject(): boolean {
    return this.repository.currentTarget() !== null;
  }

  /**
   * 현재 저장 대상이 로컬 폴더 정본인가(원격 project storage 행이 아님).
   *
   * 협업 락·원격 전용 표면이 판별에 쓴다 — `isRemotePersistenceEnabled()` 는 로컬 폴더에서도
   * true(폴더가 곧 저장소)라 "원격에 쓰는가"의 답이 아니다. 로컬 정본은 단일 작성자라
   * 다중 세션 락이 의미 없고, 원격 자격이 빌드에 박혀 있으면 CSP 에 막히는 REST 호출만
   * 나간다(2026-09-17 패키징 실측).
   */
  usesLocalProjectFolder(): boolean {
    const target = this.repository.currentTarget();
    return target !== null && isLocalTarget(target);
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
    const target: RemoteProjectTarget = { ...base, projectId: SHARED_DEMO_PROJECT_ID };
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

  // 테스트 전용: loaded 플래그와 원격 저장 활성화 상태를 직접 제어.
  // store.load()가 project storage 네트워크/인증에 결합되어 있어 단위 테스트에서
  // flush()/persistCurrent() 경로만 격리하려 검증할 때 사용한다.
  /** @internal */
  isRemotePersistenceEnabled(): boolean {
    return this.remotePersistenceEnabled;
  }

  /**
 * 이 세션이 원격 행을 향하는가 — 원격 전용 표면(원격 어댑터 이관 도구 등)의 게이트다.
 * 로컬 폴더 정본에는 원격 자격증명이 없다. `isRemotePersistenceEnabled` 로 대신 걸면
 * 로컬 세션에서도 참이 되어 원격 전용 코드가 자격증명을 찾게 된다.
 */
  isRemoteProjectSession(): boolean {
    const target = this.repository.currentTarget();
    return target !== null && isRemoteTarget(target);
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
   * Store updates, autosave, export projections, and project storage persistence keep
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
    // 대상은 세션의 저장소가 정본이다. 설정을 읽지 않으므로 로컬 세션에서도 사실대로 나온다.
    const target = this.repository.currentTarget();
    const remote = target !== null && isRemoteTarget(target) ? target : null;
    return deepFreeze({
      canonicalPayload: serialize(project),
      effectiveTarget: {
        projectId: remote?.projectId ?? "",
        url: (remote?.url ?? "").replace(/\/$/, ""),
      },
      project,
    });
  }

  getDbPersistenceStatus(): DbPersistenceStatus {
    return this.repository.status(this.remotePersistenceDisabledReason);
  }

  /** Explicit raw activation. Ambiguous local edits require recovery, never marker-only token adoption. */
  async activateSpatialAuthoring(): Promise<ProjectFlushResult> {
    if (!canWriteTeamProject()) return { kind: "disabled" };
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
  /** A host notification may refresh only a clean, unchanged editor. Never overwrite edits made during I/O. */
  async refreshFromHost(): Promise<boolean> {
    if (!this.loaded || !this.remotePersistenceEnabled || this.dirtySinceLastPersist || this.persistInFlight) return false;
    const generation = this.mutationGeneration, lineage = this.contentLineage;
    const target = this.repository.currentTarget();
    if (!target) return false;
    const snapshot = await this.repository.loadSnapshot(target);
    if (!snapshot || generation !== this.mutationGeneration || lineage !== this.contentLineage
      || this.dirtySinceLastPersist || this.persistInFlight || !sameProjectTarget(target, this.repository.currentTarget())) return false;
    if (this.persistedBaseline && serializeForComparison(snapshot.project) === serializeForComparison(this.persistedBaseline)) return true;
    this.current = preserveEventDraftsOnProject(snapshot.project, this.current);
    this.persistedBaseline = structuredClone(projectWithoutEventDrafts(snapshot.project));
    this.writeAuthority = snapshot.authority;
    this.lastPersistenceReceipt = null;
    resetManualProjectCommitBaseline(this.current);
    // External changes invalidate local undo snapshots; do not let Ctrl+Z undo a teammate's work.
    this.emit({ scope: 'project', origin: 'system', projectSwitch: true });
    return true;
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
      // 대상은 세션의 저장소가 정본이다 — 설정을 직접 읽으면 로컬 세션에서도 환경의 id 를 돌려준다.
      return { kind: "reloaded", projectId: this.repository.currentTarget()?.projectId ?? "", title: this.current.meta?.title ?? "" };
    } catch (error) {
      return {
        kind: "failed",
        message: error instanceof Error ? error.message : "온라인 저장본을 불러오지 못했습니다",
        projectId,
      };
    }
  }

  /** Atomic target proof plus forced reload for the private E2E bridge. */
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
      /** 맵 칸만 바뀌었을 때 전체 재렌더 대신 그 칸만 그리게 한다. */
      readonly renderCells?: { readonly mapId: MapId; readonly cells: readonly ProjectChangeCell[] };
      /** Account the actual mutation before any synchronous observers can retire its owner. */
      readonly onApplied?: (project: Project) => void;
      /** Trusted synchronous history commit, after adoption and before mutation observers. */
      readonly commitHistory?: () => void;
    } = {},
  ): Project {
    if (!canWriteTeamProject()) return this.current;
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
    const annotation = options.change ?? {};
    const descriptor: ProjectChangeDescriptor = options.renderCells
      ? { scope: "map", mapId: options.renderCells.mapId, cells: options.renderCells.cells, ...annotation }
      : { scope: "project", ...annotation };
    try {
      this.markLocalMutation(descriptor, options.onApplied);
    } finally {
      // The project is already live even if application accounting's observer throws.
      this.emit(descriptor);
      this.scheduleAutoSave();
    }
    return applied;
  }

  /** Full project switch (new/import/sample). Drops event-draft vault for the previous project. */
  replaceProject(project: Project, change?: ProjectChangeAnnotation, onApplied?: (project: Project) => void): Project {
    if (!canWriteTeamProject()) return this.current;
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
    if (!canWriteTeamProject()) return;
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
    if (!canWriteTeamProject()) return;
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

  /**
   * Fast path for tile painting. Tile edits only mutate the two dense tile
   * arrays (and the legacy stack maps), so cloning the whole GameMap on every
   * pointer sample needlessly copies events and every optional map setting.
   * Keep the general updateMap contract for arbitrary map edits and use this
   * path for the hot paint/erase/fill loop.
   */
  updateMapTiles(
    mapId: MapId,
    mapMutator: (draft: GameMap) => void,
    change: { readonly cells?: readonly ProjectChangeCell[] } & ProjectChangeAnnotation = {},
  ): void {
    if (!canWriteTeamProject()) return;
    const currentMap = this.current.maps[mapId];
    if (!currentMap) return;
    const draftMap: GameMap = {
      ...currentMap,
      lowerTiles: currentMap.lowerTiles.slice(),
      upperTiles: currentMap.upperTiles.slice(),
      ...(currentMap.lowerTileStacks ? { lowerTileStacks: cloneTileStacks(currentMap.lowerTileStacks) } : {}),
      ...(currentMap.upperTileStacks ? { upperTileStacks: cloneTileStacks(currentMap.upperTileStacks) } : {}),
    };
    mapMutator(draftMap);
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

  /**
   * @internal "저장 직후, 바뀐 것 없음" 상태를 강제한다.
   * store 는 모듈 싱글턴이라 같은 워커에서 앞선 파일이 더티 플래그를 남길 수 있다 —
   * clean flush 경로를 검증하는 테스트는 그 잔여 상태에 기대면 순서에 따라 깨진다.
   */
  _setCleanPersistStateForTest(): void {
    this.dirtySinceLastPersist = false;
    this.lastPersistenceReceipt = null;
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
    if (!canWriteTeamProject()) return { kind: "disabled" };
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
    if (!canWriteTeamProject()) return;
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
    if (!canWriteTeamProject()) return false;
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
   * **관측 초크포인트.** 상태를 바꾸는 6개 메서드(`update`/`updateMap`/`updateMapTiles`/
   * `replace`/`clearAll`/`restoreEventDraftFromVault`)가 전부 여기를 지나므로, mutation 호출부 전량이
   * 외부 파일 수정 없이 계측된다. 호출자는 전부 이 클래스 안에 있다 — 이 성질을
   * test/storeMutationInstrumentation.quarantine.test.ts 가 고정한다.
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
        log.error("Project auto-save failed", error);
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
        log.error("Project auto-save retry failed", error);
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
    if (!canWriteTeamProject()) return { kind: "disabled" };
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
    let receivedTeamChanges = false;
    let reconciledTeamProject = false;
    this.persistedBaseline = acceptedBaseline;
    if (this.repository.kind === 'local') {
      receivedTeamChanges = serializeForComparison(savedProject) !== serializeForComparison(submittedProject);
      if (receivedTeamChanges) {
        const merged = mergeTeamProject(submittedProject, projectWithoutEventDrafts(this.current), savedProject);
        if (merged.kind === 'merged') {
          this.current = preserveEventDraftsOnProject(merged.project, this.current);
          reconciledTeamProject = true;
        } else {
          // An edit made during I/O conflicts with an accepted team change. Keep its old
          // base so the next save reports a conflict rather than silently rebasing it away.
          this.persistedBaseline = structuredClone(submittedProject);
        }
      }
    }
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
    if (reconciledTeamProject || JSON.stringify(audioDescriptions) !== JSON.stringify(this.current.audioDescriptions)
      || JSON.stringify(monsterMetadata) !== JSON.stringify(this.current.monsterMetadata)) {
      const reconciledProject = { ...this.current };
      if (audioDescriptions === undefined) delete reconciledProject.audioDescriptions;
      else reconciledProject.audioDescriptions = structuredClone(audioDescriptions);
      if (monsterMetadata === undefined) delete reconciledProject.monsterMetadata;
      else reconciledProject.monsterMetadata = structuredClone(monsterMetadata);
      this.current = reconciledProject;
      // Synchronization is observable, but is not a new authored mutation.
      this.emit({ scope: "project", origin: "system", projectSwitch: reconciledTeamProject && receivedTeamChanges });
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
    if (options.restoreVault && canWriteTeamProject()) {
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
    if (!canWriteTeamProject()) return;
    const persistIfChanged = options.persistIfChanged !== false;
    // Helpers can report transient changes while reaching the same final structure.
    // The fingerprint keeps every field and array position. Tile grids and long
    // strings are digested so opening a heavy project does not stringify them twice.
    const before = normalizationFingerprint(this.current);
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
    const changed = before !== normalizationFingerprint(this.current);
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

  /** 주소창에 ?project=&name= 반영 (공유/북마크). 로컬 폴더 대상에서는 주소가 아니라 폴더가 정본이다. */
  private syncProjectUrlBar(): void {
    if (!this.remotePersistenceEnabled) return;
    const target = this.repository.currentTarget();
    if (target === null || !isRemoteTarget(target)) return;
    const projectId = target.projectId;
    if (!projectId) return;
    syncProjectToUrl({
      projectId,
      projectName: this.current.meta?.title ?? null,
    });
  }
}

export const store = new ProjectStore();

function cloneTileStacks(stacks: Record<number, number[]>): Record<number, number[]> {
  const copy: Record<number, number[]> = {};
  for (const [index, tiles] of Object.entries(stacks)) copy[Number(index)] = tiles.slice();
  return copy;
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
