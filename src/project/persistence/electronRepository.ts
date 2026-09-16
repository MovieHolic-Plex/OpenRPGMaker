import { deserialize, serialize } from "../io";
import { projectWithoutEventDrafts } from "../eventDrafts";
import { setUploadedAssetResolver } from "./assetAccessors";
import type { ProjectWriteAuthority } from "../spatial/saveRouting";
import type { DbPersistenceDisabledReason } from "../persistenceStatus";
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
  save(payload: { readonly projectDir: string; readonly serialized: string; readonly expectedSha: string | null }): Promise<SaveResult>;
  saveMapPatch(payload: { readonly projectDir: string; readonly baseSerialized: string; readonly serialized: string; readonly changedMapIds?: readonly string[] }): Promise<SaveResult>;
  dataVersion(payload: { readonly projectDir: string }): Promise<number>;
  separateMedia(payload: { readonly projectDir: string }): Promise<{ readonly changed: boolean; readonly migratedAssetIds: readonly string[]; readonly revision: number }>;
  backup(payload: { readonly projectDir: string }): Promise<string>;
};
export type OprnBridgeCommits = {
  record(payload: unknown): Promise<SaveResult>;
  list(payload: { readonly projectDir: string; readonly limit: number }): Promise<readonly CommitListItem[]>;
  listSync(payload: { readonly projectDir: string; readonly limit: number }): readonly CommitListItem[];
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
};
export type OprnBridge = {
  readonly lifecycle: OprnBridgeLifecycle;
  readonly project: OprnBridgeProject;
  readonly commits: OprnBridgeCommits;
  readonly ai: OprnBridgeAi;
  readonly assets: OprnBridgeAssets;
};

declare global {
  interface Window { oprn?: OprnBridge; }
}

export function hasElectronBridge(): boolean {
  return typeof window !== "undefined" && window.oprn !== undefined;
}

function electronBridge(): OprnBridge {
  if (typeof window === "undefined" || window.oprn === undefined) {
    throw new Error("Electron 브리지가 없습니다");
  }
  return window.oprn;
}

/** preload 브리지를 포트 뒤에 감싼 렌더러 어댑터. 파일 시스템은 메인 프로세스만 만진다. */
export type ElectronRepository = ProjectRepository & { readonly open: (projectDir: string) => Promise<LocalProjectTarget> };

export function createElectronRepository(): ElectronRepository {
  let opened: LocalProjectTarget | null = null;

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
    return {
      authority: { mode: "legacy", target },
      project: deserialize(serialized),
      sha256: sha256 ?? null,
      projectId: target.projectId,
    };
  };

  setUploadedAssetResolver({
    url: (ref) => (opened ? `oprn-asset://${opened.projectId}/${ref.sha256}` : ""),
    bytes: async (ref) => electronBridge().assets.read({ projectDir: requireOpened(undefined).projectDir, sha256: ref.sha256 }),
  });

  return {
    kind: "local",
    supportsAssetRefs: true,
    async open(projectDir: string): Promise<LocalProjectTarget> {
      const result = await electronBridge().project.open({ projectDir });
      opened = { kind: "local", projectDir, projectId: result.projectId };
      return opened;
    },
    currentTarget: (): ProjectTarget | null => opened,
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
      const result = await electronBridge().project.save({ projectDir: resolved.projectDir, serialized, expectedSha: null });
      return result.kind === "saved" ? { kind: "saved", project: persisted, sha256: result.sha256 } : result;
    },
    async saveMapPatch(input: MapPatchInput, target) {
      const resolved = requireOpened(target);
      const baseProject = projectWithoutEventDrafts(input.baseProject);
      const persisted = projectWithoutEventDrafts(input.project);
      const result = await electronBridge().project.saveMapPatch({
        projectDir: resolved.projectDir,
        baseSerialized: serialize(baseProject),
        serialized: serialize(persisted),
        ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
      });
      return result.kind === "saved" ? { kind: "saved", project: persisted, sha256: result.sha256 } : result;
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
      peekTip(projectId) {
        return (opened && opened.projectId === projectId) ? electronBridge().commits.listSync({ projectDir: opened.projectDir, limit: 1 })[0]?.commitId ?? null : null;
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
        return opened ? `oprn-asset://${opened.projectId}/${sha256}` : "";
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
