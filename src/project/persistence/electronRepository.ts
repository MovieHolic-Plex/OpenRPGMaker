import { deserialize, serialize } from "../io";
import { deserializeParsed, projectWireView } from "../io/serialize";
import { assetBlobOwners, parseFoldedDocument, restoreAssetBlobs, unfoldedDocumentTree } from "./core/foldedProject";
import { sharedDefaultAssetDataUrl } from "../sharedContent";
import { readTilesetBlobs, writeTilesetBlobs } from "./tilesetBlobCache";
import { applyProjectDocumentPatch, diffProjectDocumentsSliced, withWirePatchValues, type ProjectDocumentPatch } from "./core/projectPatch";
import { projectWithoutEventDrafts } from "../eventDrafts";
import { setUploadedAssetResolver } from "./assetAccessors";
import type { ProjectWriteAuthority } from "../spatial/saveRouting";
import type { DbPersistenceDisabledReason } from "./types";
import type { Project, UploadedAssetRef } from "../types";
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
  /**
   * 접힌 행(타일셋은 표식) 또는 옛 행의 펼친 글. 없는 호스트(이전 빌드)는 `load` 로 돌아간다.
   * `assetBlobs: true` 를 주면 HTTP 호스트가 업로드 자산 dataUrl 도 전송에서 떼고 `assetBlobShas` 로 알린다.
   */
  loadFolded?(payload: { readonly projectDir: string; readonly assetBlobs?: boolean }): Promise<
    | {
      readonly folded: string; readonly sha256: string; readonly revision: number;
      readonly assetBlobShas?: readonly string[];
      readonly assetBlobHints?: Readonly<Record<string, { readonly bytesSha256: string; readonly head: string }>>;
    }
    | { readonly serialized: string; readonly sha256: string; readonly revision: number }
    | null
  >;
  tilesetBlobs?(payload: { readonly projectDir: string; readonly sha256s: readonly string[] }): Promise<Readonly<Record<string, string>>>;
  /** HTTP 팀 호스트만 있다. `loadFolded({ assetBlobs: true })` 가 알린 자산 본문(dataUrl)을 준다. */
  assetBlobs?(payload: { readonly projectDir: string; readonly sha256s: readonly string[] }): Promise<Readonly<Record<string, string>>>;
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
  /** 시작 화면 카드 그림(cover.jpg). 데스크톱 앱만 있다 — 팀 호스트 브라우저 브리지에는 없다. */
  saveCover?(payload: { readonly projectDir: string; readonly dataUrl: string }): Promise<boolean>;
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
  readonly recentProjects: () => Promise<readonly import("../../../electron/shared/start").RecentProjectEntry[]>;
  readonly openFolder: (payload?: { readonly projectDir?: string }) => Promise<{ readonly projectDir: string; readonly isNew: boolean; readonly projectId: string | null } | null>;
  readonly openRecent?: (payload: { readonly projectDir: string }) => Promise<{ readonly projectDir: string; readonly projectId: string } | null>;
  /**
   * 새 폴더 프로젝트를 만든다. `seed` 를 주면 그 직렬화 문서를 새 폴더에 심는다(장르 프리셋 등).
   * `projectDir` 를 주면(데스크톱 시작 화면) 대화상자 없이 그 새 폴더에 만든다.
   */
  readonly createProject: (input: { readonly title?: string; readonly seed?: string; readonly projectDir?: string }) => Promise<{ readonly projectDir: string; readonly projectId: string } | null>;
  /** 데스크톱 전용 — 새 게임 폴더 추천 경로. */
  readonly suggestProjectDir?: (input: { readonly title?: string; readonly root?: string }) => Promise<import("../../../electron/shared/start").SuggestedProjectDir>;
  /** 데스크톱 전용 — 새 게임을 만들 상위 위치 대화상자. 취소하면 null. */
  readonly chooseProjectRoot?: () => Promise<string | null>;
  /** 데스크톱 전용 — 최근 목록 프로젝트의 카드 그림 재료. 목록에 없는 경로·빈 폴더는 null. */
  readonly coverSource?: (input: { readonly projectDir: string }) => Promise<import("../../../electron/shared/start").ProjectCoverSource | null>;
  /** 데스크톱 전용 — 시작 화면이 구운 카드 그림 저장. 목록에 없는 경로면 false. */
  readonly saveCover?: (input: { readonly projectDir: string; readonly dataUrl: string }) => Promise<boolean>;
  /** 데스크톱 전용 — 다른 컴퓨터의 팀 호스트를 앱 창으로 연다. */
  readonly joinTeam?: (input: { readonly url: string }) => Promise<import("../../../electron/shared/start").JoinTeamResult>;
  /** 데스크톱 전용 — 전에 참여한 팀 호스트 주소. */
  readonly recentTeams?: () => Promise<readonly import("../../../electron/shared/start").RecentTeamEntry[]>;
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

function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

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

  /**
   * 프로젝트를 연다. 호스트가 접힌 행을 주면 타일셋 본문은 기기 캐시에서 채우고 없는 것만 받는다.
   * 만든 트리는 펼친 글을 `JSON.parse` 한 것과 같다(core/foldedProject.ts). 본문을 못 채우면 다시 받는다.
   * 실측(2026-09-27, 82MB): 받는 글 81.6MB → 1.0MB(두 번째 열기부터).
   *
   * 팀 호스트(HTTP, `assetBlobs` 가 있다)는 업로드 자산 dataUrl 도 같은 방식으로 뗀다. 실측(2026-09-28, Tailscale):
   * 접힌 행 64MB 중 63MB 가 공용 자산 dataUrl 393개였고, 부팅·팀 변경 반영마다 gzip 45MB(약 4.5s)를 다시 받았다.
   *
   * 본문이 사이에 지워졌으면(다른 저장이 끼었다) 펼친 전체 글(`load`)로 돌아가지 않고 접힌 행을 한 번 더 받는다.
   * 전체 글은 이 규모에서 호스트 메인 프로세스를 V8 OOM 으로 죽였다(2026-09-28 실측).
   */
  const loadSnapshotFromHost = async (target: LocalProjectTarget): Promise<ProjectSnapshot | null> => {
    const bridge = electronBridge().project;
    if (!bridge.loadFolded || !bridge.tilesetBlobs) {
      const loaded = await bridge.load({ projectDir: target.projectDir });
      return snapshotOf(loaded?.serialized, loaded?.sha256, target);
    }
    const assetTransport = typeof bridge.assetBlobs === "function";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const loaded = await bridge.loadFolded({ projectDir: target.projectDir, ...(assetTransport ? { assetBlobs: true } : {}) });
      if (!loaded) return null;
      if ("serialized" in loaded) return snapshotOf(loaded.serialized, loaded.sha256, target);
      const folded = parseFoldedDocument(loaded.folded);
      const tilesetShas = [...new Set(folded.tilesetShas.values())];
      const assetShas = assetTransport ? [...new Set(loaded.assetBlobShas ?? [])] : [];
      // 두 본문 모두 내용 주소 글이라 같은 기기 캐시를 쓴다(키 = 글의 SHA-256).
      const blobs = await readTilesetBlobs([...tilesetShas, ...assetShas]);
      // 공용 기본 자산은 부팅이 이미 받은 카탈로그에 같은 그림이 있다 — 첫 참여에 다시 받지 않는다.
      const owners = assetShas.length > 0 ? assetBlobOwners(folded.document) : new Map<string, string[]>();
      for (const sha of assetShas) {
        const hint = loaded.assetBlobHints?.[sha];
        if (blobs.has(sha) || !hint) continue;
        for (const id of owners.get(sha) ?? []) {
          const dataUrl = sharedDefaultAssetDataUrl(id, hint.bytesSha256, hint.head);
          if (dataUrl) { blobs.set(sha, dataUrl); break; }
        }
      }
      const fetchMissing = async (shas: readonly string[], fetch: ((payload: { readonly projectDir: string; readonly sha256s: readonly string[] }) => Promise<Readonly<Record<string, string>>>) | undefined): Promise<void> => {
        const missing = shas.filter((sha) => !blobs.has(sha));
        if (missing.length === 0 || !fetch) return;
        const fetched = new Map(Object.entries(await fetch({ projectDir: target.projectDir, sha256s: missing })));
        for (const [sha, body] of fetched) blobs.set(sha, body);
        void writeTilesetBlobs(fetched);
      };
      await Promise.all([fetchMissing(tilesetShas, bridge.tilesetBlobs), fetchMissing(assetShas, bridge.assetBlobs)]);
      if ([...tilesetShas, ...assetShas].some((sha) => !blobs.has(sha))) continue;
      restoreAssetBlobs(folded.document, blobs);
      loadedSha = loaded.sha256;
      return {
        authority: { mode: "legacy", target },
        project: deserializeParsed(unfoldedDocumentTree(folded, blobs)),
        sha256: loaded.sha256,
        projectId: target.projectId,
      };
    }
    throw new Error("호스트 문서가 읽는 동안 계속 바뀌어 프로젝트를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
  };

  setUploadedAssetResolver({
    url: (ref) => (opened ? `${electronBridge().assetBaseUrl(opened.projectId)}${ref.sha256}` : ""),
    bytes: async (ref) => electronBridge().assets.read({ projectDir: requireOpened(undefined).projectDir, sha256: ref.sha256 }),
  });

  return {
    kind: "local",
    returnsSubmittedCopy: true,
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
      const snapshot = await loadSnapshotFromHost(resolved);
      if (snapshot) onAuthority?.(snapshot.authority);
      return snapshot?.project ?? null;
    },
    async loadSnapshot(target, _options?: LoadSnapshotOptions) {
      return await loadSnapshotFromHost(requireOpened(target));
    },
    async loadForProof(target, _signal) {
      return await loadSnapshotFromHost(requireOpened(target));
    },
    async save(project, target, _authority?: ProjectWriteAuthority) {
      const resolved = requireOpened(target);
      const persisted = projectWithoutEventDrafts(project);
      const serialized = serialize(persisted);
      const result = await electronBridge().project.save({ projectDir: resolved.projectDir, serialized, expectedSha: loadedSha });
      if (result.kind === "saved") loadedSha = result.sha256 ?? null;
      if (result.kind !== "saved") return result;
      const revision = result.revision === undefined ? {} : { revision: result.revision };
      // 호스트가 문서를 돌려보내지 않았으면 제출한 사적 사본(persisted)이 곧 저장된 내용이다.
      return result.serialized
        ? { kind: "saved", project: deserialize(result.serialized), sha256: result.sha256, ...revision }
        : { kind: "saved", project: persisted, submitted: persisted, sha256: result.sha256, ...revision };
    },
    async saveMapPatch(input: MapPatchInput, target) {
      const resolved = requireOpened(target);
      // `MapPatchInput` 은 이밌트 초안을 이미 떼낸 문서를 들고 온다(types.ts `MapPatchInput` 머리말).
      // 여기서 다시 `projectWithoutEventDrafts` 를 부르면 생산 프로젝트 한 번에 전역 딥클로이 두 번 더 도는다
      // (2026-09-25 실측: 42MB 문서 토한 프로젝트에서 한 번에 563ms).
      const baseProject = input.baseProject;
      const persisted = input.project;
      // 버려진 `terrainTemplates` 만 떼는 얕은 보기로 비교한다 — 이것이 예전의
      // `JSON.parse(serialize(x))` 왕부가 «보기» 로 샀던 유일한 것이다. 복사 없이 같은 판정을 늨는다.
      // 비교는 잘게 나눠 돈다(수십 칸 타일셋 대조가 한 번에 약 1s). 쉬는 동안 스토어는 가지를 교체만 하므로
      // 입력 보기가 가리키는 내용은 제출 때 그대로다.
      const patch = withWirePatchValues(await diffProjectDocumentsSliced(projectWireView(baseProject), projectWireView(persisted), yieldToMain));
      // 호스트가 이 패치를 기준본 위에 얹어 저장하므로, 같은 연산이 곧 저장될 내용의 사적 사본이다.
      // 패치 값은 이미 JSON 왕복 사본이고, 나머지 가지는 기준본(사적·불변)을 공유한다 — 복제가 변경량에 비례한다.
      // 실측(2026-09-26, 81MB 새 프로젝트): 저장마다 전체 복제 1.2s 를 없앤다. serialize(submitted) 는 호스트 행과 같다.
      const submitted = applyProjectDocumentPatch(baseProject, patch) as Project;
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
      if (result.kind !== "saved") return result;
      const revision = result.revision === undefined ? {} : { revision: result.revision };
      return result.serialized
        ? { kind: "saved", project: deserialize(result.serialized), submitted, sha256: result.sha256, ...revision }
        : { kind: "saved", project: submitted, submitted, sha256: result.sha256, ...revision };
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
