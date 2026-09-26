import type { Project, UploadedAssetRef, ChangeSummary } from "../types";
import type { CanonicalSave, ProjectWriteAuthority } from "../spatial/saveRouting";
import type { MirrorStatus } from "../spatial/persistenceTypes";
import type { EditorIdentity } from "../editorIdentity";
import type { EditActivityCommitAttachment } from "@/editor/editActivityLog";
import type { MapSaveConflict } from "./core/mapMerge";
import type { ProjectTarget } from "./target";

// 포트가 정의를 소유한다. 예전에는 sync 모듈이 정의하고 여기서 별칭만 붙였다 —
// 그러면 모듈을 지울 수 없다. sync 모듈은 이제 이쪽을 다시 내보낸다.
export type CommitReviewStatus = "approved" | "direct";

export type ProjectSnapshot = {
  readonly authority: ProjectWriteAuthority;
  readonly projectId: string | null;
  readonly project: Project;
  readonly sha256: string | null;
};

export type SaveResult =
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly MapSaveConflict[] }
  | {
      readonly kind: "saved";
      readonly project?: Project;
      readonly sha256?: string;
      readonly commitId?: string;
      readonly authority?: ProjectWriteAuthority;
      readonly mirror?: MirrorStatus;
      /** Host document revision this save produced (local SQLite host only). */
      readonly revision?: number;
      /**
       * 제출한 내용의 사적 사본 — 어댑터가 await **전에** 만든다. 호스트가 그대로 썼으면 `project` 와 같은 객체다.
       * `returnsSubmittedCopy` 를 선언한 어댑터만 채운다. 스토어는 이걸로 제출본 복제를 건너뛴다.
       */
      readonly submitted?: Project;
    };

export type MapPatchInput = {
  /**
   * 이벤트 초안을 이미 떼낸 기준본. **어댑터는 다시 투사하지 않는다** — 한 번 더 부르면
   * 저장 한 번에 전역 딥클로이가 두 번 더 도다(2026-09-25 실측: 42MB 문서 토한 프로젝트에서 한 번에 563ms).
   */
  readonly baseProject: Project;
  readonly changedMapIds?: readonly string[];
  /** 같은 처리를 마친 로컬 문서. */
  readonly project: Project;
  readonly authority?: ProjectWriteAuthority;
};

export type AiAnalysisRunInput = {
  readonly promptContext: unknown;
  readonly result: unknown;
  readonly selectedTiles: readonly number[];
  readonly tilesetId: string;
};

export type CommitInput = {
  readonly diff?: ChangeSummary;
  readonly identity: EditorIdentity;
  readonly project: Project;
  readonly reviewStatus: CommitReviewStatus;
  readonly serialized?: string;
  readonly summary: string;
  readonly toolNames: readonly string[];
  /** 직전 원격 커밋 id — 계보 연결. 없으면 null parent. */
  readonly parentCommitId?: string | null;
  /**
   * 이 커밋 경계 안에서 일어난 편집 행위 기록. `patch_json.edits` 로 들어간다.
   * `projectCommitLog` 가 커서로 잘라 넣는다 — 호출부가 직접 채우지 않는다.
   */
  readonly editActivity?: EditActivityCommitAttachment;
};

export type CommitListItem = {
  readonly agentName: string | null;
  readonly authorId: string | null;
  readonly authorKind: string | null;
  readonly authorLabel: string | null;
  readonly commitId: string;
  readonly createdAt: string | null;
  readonly message: string;
  readonly reviewStatus: string | null;
  readonly summary: string | null;
};

export type AiActivityInput = {
  readonly logId: string;
  /** 탭 1개당 uuid 하나. 같은 project_id 를 쓰는 다른 워크트리/탭의 턴과 갈라내는 유일한 키. */
  readonly runId?: string;
  readonly channel: string;
  readonly instruction: string;
  readonly mapId?: string;
  readonly payload: unknown;
};

export type ConversationInput = {
  readonly conversationId: string;
  /** Captured before local persistence. No credentials are serialized into the outbox. */
  readonly destinationProjectId?: string | null;
  readonly title: string;
  readonly model: string;
  readonly projectContextKey?: string;
  readonly entries: unknown;
  /** epoch ms */
  readonly savedAt: number;
};

export type DbPersistenceDisabledReason = "dev-showcase" | "load-failed" | "shared-demo";

export type DbConfigField = "url" | "anonKey";

/** 설정 출처. 예전엔 projectRepository().currentTarget 의 별칭이었다 — 포트가 자기 어휘로 소유한다. */
export type DbPersistenceConfigSource = "custom" | "env" | "legacy";

export type PersistenceStatus =
  | { readonly kind: "disabled"; readonly reason: DbPersistenceDisabledReason }
  | {
      readonly kind: "not-configured";
      readonly missing: readonly DbConfigField[];
      readonly projectId: string;
      readonly source: DbPersistenceConfigSource;
    }
  | { readonly kind: "ready"; readonly projectId: string; readonly source: DbPersistenceConfigSource; readonly url: string };

export type LoadSnapshotOptions = {
  readonly overlayMaps?: boolean;
  readonly includeProjectId?: boolean;
  readonly signal?: AbortSignal;
};
export type ActivityListOptions = { readonly runId?: string };
export type ConversationListOptions = {
  readonly query?: string;
  readonly limit?: number;
  readonly offset?: number;
  readonly signal?: AbortSignal;
  readonly includeEntries?: boolean;
  readonly projectContextKey?: string;
};

/**
 * 프로젝트 저장소 포트. store 와 주변 모듈은 이것만 부른다.
 *
 * 대상 매개변수 규칙: `target` 을 **생략**하면 어댑터가 `currentTarget()` 을 쓴다.
 * `null` 을 **명시**하면 미설정으로 처리한다(sync 함수의 `config = projectRepository().currentTarget()`
 * 기본 매개변수와 같은 의미 — `undefined` 만 기본값을 부른다).
 */
export type AssetPutInput = {
  readonly mime: string;
  readonly extension: string;
  readonly originalName?: string;
  readonly kind?: string;
};

export type AssetPutResult = {
  readonly ref: UploadedAssetRef;
  /** 파일로 저장할 수 없는 어댑터만 채운다 — 문서에 그대로 넣는 데이터 URL. */
  readonly dataUrl: string | null;
};

export interface ProjectRepository {
  readonly kind: "remote" | "local" | "memory";
  /** true 면 문서에 ref 만 넣는다(파일 저장이 있는 어댑터). false 면 dataUrl 을 넣는다. */
  readonly supportsAssetRefs: boolean;
  /**
   * true 면 save·saveMapPatch 가 입력 문서를 await 전에 동기로 다 읽고, 저장 결과에 그 내용의 사적 사본
   * (`submitted`)을 싣는다. 스토어는 이때만 복제 없는 보기를 넘긴다. 없으면 제출 전에 복제한다.
   */
  readonly returnsSubmittedCopy?: boolean;
  /** 지금 이 편집기 세션이 향하는 대상. 원격이면 설정·URL·저장된 선택에서 계산한다. */
  currentTarget(): ProjectTarget | null;
  status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus;
  /** 가벼운 연결 확인. 어댑터가 실패 이유를 로그로 남기고 boolean 만 돌려준다. */
  probe(): Promise<boolean>;
  /** 편집기 로드 읽기. 권한(authority)은 콜백으로 준다 — 지금 store.readRemoteProject 의 모양. */
  loadProject(target: ProjectTarget | null, onAuthority?: (authority: ProjectWriteAuthority) => void): Promise<Project | null>;
  loadSnapshot(target: ProjectTarget, options?: LoadSnapshotOptions): Promise<ProjectSnapshot | null>;
  /** 저장 증명용 읽기 — 커밋 tip 을 건드리지 않는다. */
  loadForProof(target: ProjectTarget, signal?: AbortSignal): Promise<ProjectSnapshot | null>;
  save(project: Project, target: ProjectTarget, authority?: ProjectWriteAuthority): Promise<SaveResult>;
  saveMapPatch(input: MapPatchInput, target: ProjectTarget): Promise<SaveResult>;
  /** 원격 전용: legacy 행을 spatial 정본으로 승격. 없는 어댑터에서는 store 가 ProjectRoutingError 를 던진다. */
  activateLegacy?(target: ProjectTarget): Promise<CanonicalSave>;
  /** 폴더 정본을 `backups/` 사본으로 만들고 그 경로를 돌려준다. 파일을 가진 어댑터만 제공한다. */
  backup?(target?: ProjectTarget | null): Promise<string>;
  readonly commits: {
    record(input: CommitInput, target?: ProjectTarget | null): Promise<SaveResult>;
    list(limit: number, target?: ProjectTarget | null): Promise<readonly CommitListItem[]>;
    /** 동기 도구(툴 프레임워크가 동기라) 를 위한 동기 판 — 선택. 없는 어댑터는 비동기 list 만 있다. */
    listSync?(limit: number, target?: ProjectTarget | null): readonly CommitListItem[];
    hydrateTip(target?: ProjectTarget | null): Promise<string | null>;
    seedTip(projectId: string, commitId: string | null | undefined): void;
  };
  readonly ai: {
    recordActivity(input: AiActivityInput, target?: ProjectTarget | null): Promise<SaveResult>;
    listActivity(limit: number, target?: ProjectTarget | null, options?: ActivityListOptions): Promise<readonly Record<string, unknown>[]>;
    recordConversation(input: ConversationInput, target?: ProjectTarget | null): Promise<SaveResult>;
    listConversations(options: ConversationListOptions, target?: ProjectTarget | null): Promise<readonly Record<string, unknown>[]>;
    loadConversation(conversationId: string, target?: ProjectTarget | null, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
    recordAnalysisRun(input: AiAnalysisRunInput, target?: ProjectTarget | null): Promise<SaveResult>;
  };
  readonly assets: {
    put(bytes: Uint8Array, meta: AssetPutInput): Promise<AssetPutResult>;
    url(sha256: string): string;
    list(): Promise<readonly UploadedAssetRef[]>;
    pruneUnused(referenced: readonly string[]): Promise<readonly string[]>;
  };
}
