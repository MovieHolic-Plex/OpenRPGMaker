import { mkdtemp } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import type { Project } from "@/project/types";
import type { ProjectTarget } from "@/project/persistence/target";
import type {
  AiActivityInput,
  AiAnalysisRunInput,
  AssetPutInput,
  AssetPutResult,
  CommitInput,
  CommitListItem,
  ConversationInput,
  ConversationListOptions,
  LoadSnapshotOptions,
  MapPatchInput,
  PersistenceStatus,
  ProjectRepository,
  ProjectSnapshot,
  SaveResult,
} from "@/project/persistence/types";
import type { DbPersistenceDisabledReason } from "@/project/persistenceStatus";
import type { ProjectWriteAuthority } from "@/project/spatial/saveRouting";
import { initLocalProjectStore } from "../../electron/local-store/store";

export type LocalRepositoryFixture = {
  readonly repository: ProjectRepository;
  readonly target: ProjectTarget;
  readonly projectDir: string;
  readonly close: () => void;
};

/** Maps the renderer port onto the local store; P4 replaces this test-side glue with the IPC bridge. */
export async function createLocalRepositoryFixture(): Promise<LocalRepositoryFixture> {
  const projectDir = await mkdtemp(join(tmpdir(), "oprn-local-contract-"));
  const store = await initLocalProjectStore({ projectDir });
  const target: ProjectTarget = { url: `local://${projectDir}`, anonKey: "local", projectId: store.projectId };
  const tips = new Map<string, string>();
  const legacyAuthority = (): ProjectWriteAuthority => ({ mode: "legacy", target: { ...target } });

  const snapshotOf = (includeProjectId: boolean): ProjectSnapshot | null => {
    const snapshot = store.loadSnapshot();
    if (!snapshot) return null;
    return {
      authority: legacyAuthority(),
      project: snapshot.project,
      sha256: snapshot.sha256,
      projectId: includeProjectId ? target.projectId : null,
    };
  };

  const resolveTarget = (value: ProjectTarget | null | undefined): ProjectTarget | null => (value === undefined ? target : value);

  const repository: ProjectRepository = {
    kind: "local",
    supportsAssetRefs: true,
    assets: {
      async put(bytes: Uint8Array, meta: AssetPutInput): Promise<AssetPutResult> {
        const ref = await store.putAsset(bytes, meta);
        return { ref, dataUrl: null };
      },
      url(sha256: string): string {
        return `oprn-asset://${target.projectId}/${sha256}`;
      },
      async list() {
        return store.listAssets().map((asset) => ({
          sha256: asset.sha256,
          mime: asset.mime,
          bytes: asset.bytes,
          extension: asset.extension,
        }));
      },
      pruneUnused(referenced: readonly string[]) {
        return store.pruneUnusedAssets(referenced);
      },
    },
    currentTarget: (): ProjectTarget | null => target,
    status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus {
      if (disabledReason) return { kind: "disabled", reason: disabledReason };
      return { kind: "ready", projectId: target.projectId, source: "custom", url: target.url };
    },
    probe: (): Promise<boolean> => Promise.resolve(true),
    async loadProject(_target, onAuthority): Promise<Project | null> {
      const snapshot = snapshotOf(true);
      if (snapshot) onAuthority?.(snapshot.authority);
      return snapshot?.project ?? null;
    },
    loadSnapshot(_target, _options?: LoadSnapshotOptions): Promise<ProjectSnapshot | null> {
      return Promise.resolve(snapshotOf(false));
    },
    loadForProof: (_target, _signal?: AbortSignal): Promise<ProjectSnapshot | null> => Promise.resolve(snapshotOf(true)),
    async save(project, _target, saveAuthority?: ProjectWriteAuthority): Promise<SaveResult> {
      const persisted = projectWithoutEventDrafts(project);
      const saved = await store.saveProject(persisted);
      if (saved.kind === "conflict") return { kind: "conflict", conflicts: saved.conflicts };
      return {
        kind: "saved",
        project: persisted,
        sha256: saved.sha256,
        ...(saveAuthority?.mode === "create" ? { authority: legacyAuthority() } : {}),
      };
    },
    async saveMapPatch(input: MapPatchInput, _target): Promise<SaveResult> {
      const saved = await store.saveMapPatch({
        baseProject: projectWithoutEventDrafts(input.baseProject),
        project: projectWithoutEventDrafts(input.project),
        ...(input.changedMapIds ? { changedMapIds: input.changedMapIds } : {}),
      });
      if (saved.kind === "conflict") return { kind: "conflict", conflicts: saved.conflicts };
      const snapshot = snapshotOf(false);
      return snapshot
        ? { kind: "saved", project: snapshot.project, ...(snapshot.sha256 ? { sha256: snapshot.sha256 } : {}) }
        : { kind: "saved" };
    },
    commits: {
      record(input: CommitInput, recordTarget?): Promise<SaveResult> {
        const resolved = resolveTarget(recordTarget);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        const commitId = store.recordCommit({
          identity: {
            id: input.identity.id,
            label: input.identity.label,
            kind: input.identity.kind,
            ...(input.identity.kind === "agent" && input.identity.agentName ? { agentName: input.identity.agentName } : {}),
          },
          reviewStatus: input.reviewStatus,
          summary: input.summary,
          ...(input.parentCommitId === undefined ? {} : { parentCommitId: input.parentCommitId }),
          ...(input.diff === undefined ? {} : { diff: input.diff }),
          toolNames: input.toolNames,
          ...(input.editActivity === undefined ? {} : { editActivity: input.editActivity }),
        });
        tips.set(resolved.projectId, commitId);
        return Promise.resolve({ kind: "saved", commitId });
      },
      list(limit: number, listTarget?): Promise<readonly CommitListItem[]> {
        const resolved = resolveTarget(listTarget);
        if (!resolved) return Promise.reject(new Error("온라인 저장 연결이 필요합니다"));
        const rows = store.listCommits(limit);
        const tip = rows[0]?.commitId;
        if (tip) tips.set(resolved.projectId, tip);
        return Promise.resolve(rows);
      },
      hydrateTip(hydrateTarget?): Promise<string | null> {
        const resolved = resolveTarget(hydrateTarget);
        if (!resolved) return Promise.resolve(null);
        const tip = store.listCommits(1)[0]?.commitId ?? null;
        if (tip) tips.set(resolved.projectId, tip);
        return Promise.resolve(tip);
      },
      peekTip: (projectId: string): string | null => tips.get(projectId) ?? null,
      seedTip(projectId: string, commitId: string | null | undefined): void {
        if (commitId) tips.set(projectId, commitId);
      },
    },
    ai: {
      recordActivity(input: AiActivityInput, activityTarget?): Promise<SaveResult> {
        const resolved = resolveTarget(activityTarget);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        store.recordActivity({
          logId: input.logId,
          ...(input.runId ? { runId: input.runId } : {}),
          channel: input.channel,
          instruction: input.instruction,
          ...(input.mapId ? { mapId: input.mapId } : {}),
          payload: input.payload,
        });
        return Promise.resolve({ kind: "saved" });
      },
      listActivity(limit: number, activityTarget?, options?): Promise<readonly Record<string, unknown>[]> {
        const resolved = resolveTarget(activityTarget);
        if (!resolved) return Promise.resolve([]);
        return Promise.resolve(store.listActivity(limit, options?.runId ? { runId: options.runId } : {}));
      },
      recordConversation(input: ConversationInput, conversationTarget?): Promise<SaveResult> {
        const resolved = resolveTarget(conversationTarget);
        if (!resolved || input.destinationProjectId === null) return Promise.resolve({ kind: "not-configured" });
        store.recordConversation({
          conversationId: input.conversationId,
          destinationProjectId: input.destinationProjectId ?? resolved.projectId,
          title: input.title,
          model: input.model,
          ...(input.projectContextKey ? { projectContextKey: input.projectContextKey } : {}),
          entries: input.entries,
          savedAt: input.savedAt,
        });
        return Promise.resolve({ kind: "saved" });
      },
      listConversations(options: ConversationListOptions, conversationTarget?): Promise<readonly Record<string, unknown>[]> {
        const resolved = resolveTarget(conversationTarget);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        options.signal?.throwIfAborted();
        return Promise.resolve(store.listConversations(options));
      },
      loadConversation(conversationId: string, conversationTarget?, signal?): Promise<Record<string, unknown> | null> {
        const resolved = resolveTarget(conversationTarget);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        signal?.throwIfAborted();
        return Promise.resolve(store.loadConversation(conversationId));
      },
      recordAnalysisRun(input: AiAnalysisRunInput, runTarget?): Promise<SaveResult> {
        const resolved = resolveTarget(runTarget);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        store.recordAnalysisRun(input);
        return Promise.resolve({ kind: "saved" });
      },
    },
  };

  return {
    repository,
    target,
    projectDir,
    close: (): void => {
      store.close();
      rmSync(projectDir, { force: true, recursive: true });
    },
  };
}
