import type { Project, UploadedAssetRef } from "../types";
import type { CanonicalSave, ProjectWriteAuthority } from "../spatial/saveRouting";
import type { DbPersistenceDisabledReason, DbPersistenceStatus } from "../persistenceStatus";
import type {
  SupabaseAiActivityLogInput,
  SupabaseAiAnalysisRunInput,
  SupabaseConversationInput,
  SupabaseProjectCommitInput,
  SupabaseProjectCommitListItem,
  SupabaseProjectMapPatchInput,
  SupabaseProjectSnapshot,
  SupabaseSaveResult,
} from "../supabaseProjectSync";
import type { ProjectTarget } from "./target";

// 중립 이름. 지금은 sync 모듈의 타입에 대한 별칭이고, Supabase 퇴역 단계에서 정의가 이쪽으로 온다.
export type ProjectSnapshot = SupabaseProjectSnapshot;
export type SaveResult = SupabaseSaveResult;
export type MapPatchInput = SupabaseProjectMapPatchInput;
export type CommitInput = SupabaseProjectCommitInput;
export type CommitListItem = SupabaseProjectCommitListItem;
export type AiActivityInput = SupabaseAiActivityLogInput;
export type AiAnalysisRunInput = SupabaseAiAnalysisRunInput;
export type ConversationInput = SupabaseConversationInput;
export type PersistenceStatus = DbPersistenceStatus;

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
 * `null` 을 **명시**하면 미설정으로 처리한다(sync 함수의 `config = supabaseProjectConfig()`
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
