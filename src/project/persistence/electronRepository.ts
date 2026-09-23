import { deserialize, serialize } from "../io";
import { diffProjectDocuments, type ProjectDocumentPatch } from "./core/projectPatch";
import { projectWithoutEventDrafts } from "../eventDrafts";
import { setUploadedAssetResolver } from "./assetAccessors";
import type { ProjectWriteAuthority } from "../spatial/saveRouting";
import type { DbPersistenceDisabledReason } from "./types";
import type { UploadedAssetRef } from "../types";
import type { LocalProjectTarget, ProjectTarget } from "./target";
import type {
  AiActivityInput, AiAnalysisRunInput, CommitInput, CommitListItem, ConversationInput, ConversationListOptions,
  LoadSnapshotOptions, MapPatchInput, PersistenceStatus, ProjectRepository, ProjectSnapshot, SaveResult,
} from "./types";

export type OprnBridgeProject = {
  status(): Promise<{ readonly kind: string; readonly projectId?: string; readonly projectDir?: string; readonly url?: string }>;
  probe(): Promise<boolean>;
  open(payload: { readonly projectDir: string }): Promise<{ readonly projectId: string; readonly projectDir: string }>;
  load(payload: { readonly projectDir: string }): Promise<{ readonly serialized: string; readonly sha256: string; readonly revision: number } | null>;
  save(payload: { readonly projectDir: string; readonly serialized: string; readonly expectedSha: string | null }): Promise<SaveResult & { readonly serialized?: string }>;
  saveMapPatch(payload: {
    readonly projectDir: string;
    readonly baseSerialized?: string;
    readonly serialized?: string;
    readonly baseSha?: string | null;
    readonly patch?: ProjectDocumentPatch;
    readonly changedMapIds?: readonly string[];
  }): Promise<(SaveResult & { readonly serialized?: string }) | { readonly kind: "stale-base" }>;
  dataVersion(payload: { readonly projectDir: string }): Promise<number>;
  separateMedia(payload: { readonly projectDir: string }): Promise<{ readonly changed: boolean; readonly migratedAssetIds: readonly string[]; readonly revision: number }>;
  backup(payload: { readonly projectDir: string }): Promise<string>;
};
export type OprnBridgeCommits = {
  record(payload: unknown): Promise<SaveResult>;
  list(payload: { readonly projectDir: string; readonly limit: number }): Promise<readonly CommitListItem[]>;
};
export type OprnBridgeAi = {
  recordActivity(payload: unknown): Promise<SaveResult>;
  listActivity(payload: unknown): Promise<readonly Record<string, unknown>[]>;
  recordConversation(payload: unknown): Promise<SaveResult>;
  listConversations(payload: unknown): Promise<readonly Record<string, unknown>[]>;
  loadConversation(payload: unknown): Promise<Record<string, unknown> | null>;
  recordAnalysisRun(payload: unknown): Promise<SaveResult>;
};
export type OprnBridgeAssets = {
  put(payload: { readonly projectDir: string; readonly mime: string; readonly extension: string; readonly originalName?: string; readonly kind?: string; readonly bytes: Uint8Array }): Promise<{ readonly ref: UploadedAssetRef; readonly dataUrl: null }>;
  list(payload: { readonly projectDir: string }): Promise<readonly UploadedAssetRef[]>;
  read(payload: { readonly projectDir: string; readonly sha256: string }): Promise<Uint8Array>;
  pruneUnused(payload: { readonly projectDir: string; readonly referenced: readonly string[] }): Promise<readonly string[]>;
};
export type OprnBridgeLifecycle = {
  readonly onFlushBeforeClose: (callback: () => void) => void;
  readonly flushDone: () => Promise<unknown>;
  /** 파일 → 저장(CmdOrCtrl+S). 메뉴가 보내는 flush 요청. */
  readonly onSaveRequest: (callback: () => void) => void;
};
export type OprnBridgeStart = {
  readonly recentProjects: () => Promise<readonly { readonly projectDir: string; readonly title: string }[]>;
  readonly openFolder: (payload?: { readonly projectDir?: string }) => Promise<{ readonly projectDir: string; readonly isNew: boolean; readonly projectId: string | null } | null>;
  /** 새 폴더 프로젝트를 만든다. `seed` 를 주면 그 직렬화 문서를 새 폴더에 심는다(장르 프리셋 등). */
  readonly createProject: (input: { readonly title?: string; readonly seed?: string }) => Promise<{ readonly projectDir: string; readonly projectId: string } | null>;
};

export type OprnAssetBrowser = {
  open(payload: { readonly url: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }): Promise<{ readonly title: string; readonly url: string }>;
  setBounds(payload: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): Promise<boolean>;
  close(): Promise<boolean>;
  onDownload(callback: (payload: unknown) => void): () => void;
};

export type OprnBridge = {
  readonly team?: import("../../../electron/shared/team").TeamBridge;
  /** true 면 닫기 절차를 호스트(일렉트론 메인)가 연다. 브라우저 로컬 서버는 false 라서 페이지가 직접 막는다. */
  readonly closeIsHostDriven: boolean;
  /** AI 동반 서비스 출처. 일렉트론은 루프백 주소, 브라우저는 페이지와 같은 출처라 null 이다. */
  readonly companionOrigin: string | null;
  /** 동반 서비스 실행별 토큰(설계 7.4). 루프백은 같은 머신의 다른 프로세스에 열려 있다. */
  readonly companionToken: string | null;
  /** 내용 주소 자산을 열 수 있는 접두사. 일렉트론은 oprn-asset 스킴, 브라우저 로컬 서버는 HTTP 경로다. */
  readonly assetBaseUrl: (projectId: string) => string;
  readonly lifecycle: OprnBridgeLifecycle;
  readonly project: OprnBridgeProject;
  readonly commits: OprnBridgeCommits;
  readonly ai: OprnBridgeAi;
  readonly assets: OprnBridgeAssets;
  /** 시작 화면이 쓰는 새 프로젝트/폴더 열기. 편집기도 같은 경로로 폴더를 만든다. */
  readonly start: OprnBridgeStart;
  /** 데스크톱 앱에서만 있다. 제작자 페이지를 창 안에 열고, 받은 파일은 이 프로젝트로만 넘긴다. */
  readonly assetBrowser?: OprnAssetBrowser;
};

declare global {
  interface Window { oprn?: OprnBridge; }
}

export function hasElectronBridge(): boolean {
  return typeof window !== "undefined" && window.oprn !== undefined;
}

/**
 * 주 프로세스가 이미 열어 둔 폴더를 읽는다. 없으면 null.
 *
 * 시작 화면(`app://oprn/start-screen.html`)은 **별도 문서**라서, 사용자가 고른 폴더는
 * 렌더러 모듈 상태로 넘어오지 않고 주 프로세스의 세션에만 남는다. 편집기 문서가 부팅할 때
 * 이 값으로 세션에 다시 붙는다 — 안 붙으면 store.load() 가 대상을 못 찾아 DB 연결 설정
 * 화면으로 떨어진다.
 */
export async function openFolderHeldByMainProcess(): Promise<string | null> {
  if (!hasElectronBridge()) return null;
  const status = await electronBridge().project.status();
  return status.kind === "ready" && status.projectDir ? status.projectDir : null;
}

function electronBridge(): OprnBridge {
  if (typeof window === "undefined" || window.oprn === undefined) {
    throw new Error("Electron 브리지가 없습니다");
  }
  return window.oprn;
}

/** preload 브리지를 포트 뒤에 감싼 렌더러 어댑터. 파일 시스템은 메인 프로세스만 만진다. */
export type ElectronRepository = ProjectRepository & {
  readonly open: (projectDir: string) => Promise<LocalProjectTarget>;
  /**
   * 메인이 이미 열어둔 폴더를 브리지 조회로 채택한다. 시작 화면이 폴더를 연 뒤 편집기 창으로
   * 넘어가면 렌더러 모듈 상태는 비어 있으므로, 부팅 때 한 번 불러 세션을 이어받는다(설계 7.3).
   * 채택할 세션이 없으면 false.
   */
  readonly adoptOpenProject: () => Promise<boolean>;
};

export function createElectronRepository(): ElectronRepository {
  let opened: LocalProjectTarget | null = null;
  let loadedSha: string | null = null;

  const openedRef = (target: ProjectTarget | null | undefined): LocalProjectTarget | null => {
    if (target !== undefined && target !== null) {
      return "kind" in target && target.kind === "local" ? target : null;
    }
    return opened;
  };
  const requireOpened = (target: ProjectTarget | null | undefined): LocalProjectTarget => {
    const resolved = openedRef(target);
    if (!resolved) throw new Error("열린 프로젝트 폴더가 없습니다");
    return resolved;
  };

  const snapshotOf = (serialized: string | null | undefined, sha256: string | null | undefined, target: LocalProjectTarget): ProjectSnapshot | null => {
    if (!serialized) return null;
    loadedSha = sha256 ?? null;
    return {
      authority: { mode: "legacy", target },
      project: deserialize(serialized),
      sha256: sha256 ?? null,
      projectId: target.projectId,
    };
  };

  setUploadedAssetResolver({
    url: (ref) => (opened ? `${electronBridge().assetBaseUrl(opened.projectId)}${ref.sha256}` : ""),
    bytes: async (ref) => electronBridge().assets.read({ projectDir: requireOpened(undefined).projectDir, sha256: ref.sha256 }),
  });

  return {
    kind: "local",
    supportsAssetRefs: true,
    async open(projectDir: string): Promise<LocalProjectTarget> {
      const result = await electronBridge().project.open({ projectDir });
      loadedSha = null;
      opened = { kind: "local", projectDir, projectId: result.projectId };
      return opened;
    },
    async adoptOpenProject(): Promise<boolean> {
      const status = await electronBridge().project.status();
      if (status.kind !== "ready" || !status.projectDir || !status.projectId) return false;
      loadedSha = null;
      opened = { kind: "local", projectDir: status.projectDir, projectId: status.projectId };
      return true;
    },
    currentTarget: (): ProjectTarget | null => opened,
    async backup(target?: ProjectTarget | null): Promise<string> {
      return await electronBridge().project.backup({ projectDir: requireOpened(target).projectDir });
    },
    status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus {
      if (disabledReason) return { kind: "disabled", reason: disabledReason };
      return opened ? { kind: "ready", projectId: opened.projectId, source: "custom", url: opened.projectDir } : { kind: "not-configured", missing: ["url", "anonKey"], projectId: "", source: "legacy" };
    },
    probe: () => electronBridge().project.probe(),
    async loadProject(target, onAuthority) {
      const resolved = requireOpened(target);
      const loaded = await electronBridge().project.load({ projectDir: resolved.projectDir });
      const snapshot = snapshotOf(loaded?.serialized, loaded?.sha256, resolved);
      if (snapshot) onAuthority?.(snapshot.authority);
      return snapshot?.project ?? null;
    },
    async loadSnapshot(target, _options?: LoadSnapshotOptions) {
      const resolved = requireOpened(target);
      const loaded = await electronBridge().project.load({ projectDir: resolved.projectDir });
      return snapshotOf(loaded?.serialized, loaded?.sha256, resolved);
    },
    async loadForProof(target, _signal) {
      const resolved = requireOpened(target);
      const loaded = await electronBridge().project.load({ projectDir: resolved.projectDir });
      return snapshotOf(loaded?.serialized, loaded?.sha256, resolved);
    },
    async save(project, target, _authority?: ProjectWriteAuthority) {
      const resolved = requireOpened(target);
      const persisted = projectWithoutEventDrafts(project);
      const serialized = serialize(persisted);
      const result = await electronBridge().project.save({ projectDir: resolved.projectDir, serialized, expectedSha: loadedSha });
      if (result.kind === "saved") loadedSha = result.sha256 ?? null;
      return result.kind === "saved" ? { kind: "saved", project: result.serialized ? deserialize(result.serialized) : persisted, sha256: result.sha256 } : result;
    },
    async saveMapPatch(input: MapPatchInput, target) {
      const resolved = requireOpened(target);
      const baseProject = projectWithoutEventDrafts(input.baseProject);
      const persisted = projectWithoutEventDrafts(input.project);
      const patch = diffProjectDocuments(JSON.parse(serialize(baseProject)) as unknown, JSON.parse(serialize(persisted)) as unknown);
      const send = (includeBase: boolean) => electronBridge().project.saveMapPatch({
        projectDir: resolved.projectDir,
        baseSha: loadedSha,
        patch,
        ...(includeBase ? { baseSerialized: serialize(baseProject) } : {}),
        ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
      });
      // 해시가 맞으면 변경분만 보낸다. 다른 저장이 끼면 기준 문서를 한 번 더 보낸다.
      let result = await send(false);
      if (result.kind === "stale-base") result = await send(true);
      if (result.kind === "stale-base") throw new Error("저장 기준 문서가 서버와 달라 맵 패치를 적용하지 못했습니다");
      if (result.kind === "saved") loadedSha = result.sha256 ?? null;
      return result.kind === "saved" ? { kind: "saved", project: result.serialized ? deserialize(result.serialized) : persisted, sha256: result.sha256 } : result;
    },
    commits: {
      record(input: CommitInput, target?) {
        const resolved = requireOpened(target);
        return electronBridge().commits.record({
          projectDir: resolved.projectDir,
          identity: input.identity,
          reviewStatus: input.reviewStatus,
          summary: input.summary,
          ...(input.parentCommitId === undefined ? {} : { parentCommitId: input.parentCommitId }),
          toolNames: input.toolNames,
          ...(input.diff === undefined ? {} : { diff: input.diff }),
          ...(input.editActivity === undefined ? {} : { editActivity: input.editActivity }),
        });
      },
      list(limit, target?) {
        const resolved = requireOpened(target);
        return electronBridge().commits.list({ projectDir: resolved.projectDir, limit });
      },
      async hydrateTip(target?) {
        const resolved = requireOpened(target);
        return (await electronBridge().commits.list({ projectDir: resolved.projectDir, limit: 1 }))[0]?.commitId ?? null;
      },
      seedTip: () => {},
    },
    ai: {
      recordActivity(input: AiActivityInput, target?) {
        const resolved = requireOpened(target);
        return electronBridge().ai.recordActivity({
          projectDir: resolved.projectDir,
          logId: input.logId,
          ...(input.runId ? { runId: input.runId } : {}),
          channel: input.channel,
          instruction: input.instruction,
          ...(input.mapId ? { mapId: input.mapId } : {}),
          payload: input.payload,
        });
      },
      listActivity(limit, target?, options?) {
        const resolved = requireOpened(target);
        return electronBridge().ai.listActivity({ projectDir: resolved.projectDir, limit, ...(options?.runId ? { runId: options.runId } : {}) });
      },
      recordConversation(input: ConversationInput, target?) {
        const resolved = requireOpened(target);
        if (input.destinationProjectId === null) return Promise.resolve({ kind: "not-configured" });
        return electronBridge().ai.recordConversation({
          projectDir: resolved.projectDir,
          conversationId: input.conversationId,
          ...(input.destinationProjectId === undefined ? {} : { destinationProjectId: input.destinationProjectId }),
          title: input.title,
          model: input.model,
          ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
          entries: input.entries,
          savedAt: input.savedAt,
        });
      },
      listConversations(options: ConversationListOptions, target?) {
        const resolved = requireOpened(target);
        options.signal?.throwIfAborted();
        return electronBridge().ai.listConversations({ projectDir: resolved.projectDir, ...options });
      },
      loadConversation(conversationId, target?, signal?) {
        const resolved = requireOpened(target);
        signal?.throwIfAborted();
        return electronBridge().ai.loadConversation({ projectDir: resolved.projectDir, conversationId });
      },
      recordAnalysisRun(input: AiAnalysisRunInput, target?) {
        const resolved = requireOpened(target);
        return electronBridge().ai.recordAnalysisRun({
          projectDir: resolved.projectDir,
          tilesetId: input.tilesetId,
          selectedTiles: input.selectedTiles,
          promptContext: input.promptContext,
          result: input.result,
        });
      },
    },
    assets: {
      async put(bytes, meta) {
        const resolved = requireOpened(undefined);
        return await electronBridge().assets.put({ projectDir: resolved.projectDir, mime: meta.mime, extension: meta.extension, ...(meta.originalName ? { originalName: meta.originalName } : {}), ...(meta.kind ? { kind: meta.kind } : {}), bytes });
      },
      url(sha256) {
        return opened ? `${electronBridge().assetBaseUrl(opened.projectId)}${sha256}` : "";
      },
      list() {
        const resolved = requireOpened(undefined);
        return electronBridge().assets.list({ projectDir: resolved.projectDir });
      },
      pruneUnused(referenced) {
        const resolved = requireOpened(undefined);
        return electronBridge().assets.pruneUnused({ projectDir: resolved.projectDir, referenced });
      },
    },
  };
}
