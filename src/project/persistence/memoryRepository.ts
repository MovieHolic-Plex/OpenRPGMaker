import { removeLegacySpriteReferences } from "../defaults/defaultAssets";
import { projectWithoutEventDrafts } from "../eventDrafts";
import { deserialize, serialize } from "../io";
import type { DbPersistenceDisabledReason } from "../persistenceStatus";
import type { ProjectWriteAuthority } from "../spatial/saveRouting";
import type { Project } from "../types";
import { randomUuid } from "@/util/id";
import { sha256HexText } from "@/util/sha256";
import { mapPatchChangeSet, planMapPatch, readMapPatchSnapshot } from "./core/mapPatch";
import { projectWire } from "./core/projectWire";
import type { ProjectTarget } from "./target";
import type {
  AiActivityInput, AiAnalysisRunInput, CommitInput, CommitListItem, ConversationInput, ConversationListOptions,
  LoadSnapshotOptions, MapPatchInput, PersistenceStatus, ProjectRepository, ProjectSnapshot, SaveResult,
} from "./types";

export type MemoryProjectRow = {
  readonly projectId: string;
  readonly json: unknown;
  readonly serialized: string;
  readonly sha256: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type MemoryRepository = ProjectRepository & {
  readonly rows: ReadonlyMap<string, MemoryProjectRow>;
};

type Row = Record<string, unknown>;
const MAP_PATCH_MAX_ATTEMPTS = 4;

/**
 * 테스트용 저장소. legacy 문서의 Supabase 경로와 같은 의미를 core 함수만으로 낸다.
 * spatial 발행은 모델링하지 않는다 — 문서에 spatialAuthoring 마커가 있어도 일반 저장으로 다룬다.
 */
export function createMemoryRepository(options: { readonly target: ProjectTarget | null; readonly now?: () => string }): MemoryRepository {
  const now = options.now ?? (() => new Date().toISOString());
  const rows = new Map<string, MemoryProjectRow>();
  const commits = new Map<string, CommitListItem[]>();
  const tips = new Map<string, string>();
  const activity = new Map<string, Row[]>();
  const conversations = new Map<string, Row[]>();
  const analysisRuns: Row[] = [];
  const bucket = <T>(store: Map<string, T[]>, key: string): T[] => {
    const existing = store.get(key);
    if (existing) return existing;
    const created: T[] = [];
    store.set(key, created);
    return created;
  };
  const currentTarget = (): ProjectTarget | null => options.target;
  const resolve = (target: ProjectTarget | null | undefined): ProjectTarget | null => (target === undefined ? currentTarget() : target);

  const snapshotOf = (row: MemoryProjectRow, target: ProjectTarget, includeProjectId: boolean): ProjectSnapshot => ({
    authority: { mode: "legacy", target: { ...target } },
    project: deserialize(row.serialized),
    sha256: row.sha256,
    projectId: includeProjectId ? row.projectId : null,
  });

  const putRow = async (target: ProjectTarget, project: Project): Promise<{ readonly project: Project; readonly sha256: string }> => {
    const wire = await projectWire(project);
    rows.set(target.projectId, {
      projectId: target.projectId, json: wire.json, serialized: wire.serialized, sha256: wire.sha256,
      title: project.meta.title, updatedAt: now(),
    });
    return { project, sha256: wire.sha256 };
  };

  const repository: MemoryRepository = {
    kind: "memory",
    rows,
    currentTarget,
    status(disabledReason: DbPersistenceDisabledReason | null): PersistenceStatus {
      if (disabledReason) return { kind: "disabled", reason: disabledReason };
      const target = currentTarget();
      if (!target) return { kind: "not-configured", missing: ["url", "anonKey"], projectId: "", source: "legacy" };
      return { kind: "ready", projectId: target.projectId, source: "custom", url: target.url };
    },
    probe: () => Promise.resolve(currentTarget() !== null),
    async loadProject(target, onAuthority) {
      if (!target) return null;
      const snapshot = await repository.loadSnapshot(target);
      if (snapshot) onAuthority?.(snapshot.authority);
      return snapshot?.project ?? null;
    },
    loadSnapshot(target, loadOptions: LoadSnapshotOptions = {}) {
      const row = rows.get(target.projectId);
      return Promise.resolve(row ? snapshotOf(row, target, loadOptions.includeProjectId === true) : null);
    },
    loadForProof: (target) => repository.loadSnapshot(target, { includeProjectId: true }),
    async save(project, target, authority?: ProjectWriteAuthority): Promise<SaveResult> {
      const persistedProject = projectWithoutEventDrafts(project);
      removeLegacySpriteReferences(persistedProject);
      const saved = await putRow(target, persistedProject);
      return {
        kind: "saved", project: saved.project, sha256: saved.sha256,
        ...(authority?.mode === "create" ? { authority: { mode: "legacy" as const, target: { ...target } } } : {}),
      };
    },
    async saveMapPatch(input: MapPatchInput, target): Promise<SaveResult> {
      const persistedProject = projectWithoutEventDrafts(input.project);
      const baseProject = projectWithoutEventDrafts(input.baseProject);
      removeLegacySpriteReferences(persistedProject);
      removeLegacySpriteReferences(baseProject);
      const changeSet = mapPatchChangeSet(baseProject, persistedProject, input.changedMapIds);
      for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
        const latestRow = rows.get(target.projectId);
        const latest = latestRow ? readMapPatchSnapshot(latestRow.json) : changeSet.canonicalBase;
        const latestSha = latestRow?.sha256 ?? null;
        const plan = await planMapPatch(changeSet, latest);
        if (plan.kind === "conflict") return { kind: "conflict", conflicts: plan.conflicts };
        // CAS: 계획을 세우는 동안 다른 쓰기가 끼어들었으면 다시 읽는다(단일 스레드라 실제로는 항상 통과).
        if ((rows.get(target.projectId)?.sha256 ?? null) !== latestSha) continue;
        rows.set(target.projectId, {
          projectId: target.projectId, json: plan.wire.json, serialized: plan.wire.serialized, sha256: plan.wire.sha256,
          title: plan.mergedProject.meta.title, updatedAt: now(),
        });
        return { kind: "saved", project: plan.mergedProject, sha256: plan.wire.sha256 };
      }
      throw new Error("memory project changed too often while saving map patch");
    },
    commits: {
      async record(input: CommitInput, target?): Promise<SaveResult> {
        const resolved = resolve(target);
        if (!resolved) return { kind: "not-configured" };
        const serialized = input.serialized ?? serialize(projectWithoutEventDrafts(input.project));
        await sha256HexText(serialized); // Supabase 경로와 같은 비용·순서(current_sha256 계산)를 유지한다.
        const commitId = randomUuid();
        const list = bucket(commits, resolved.projectId);
        list.unshift({
          agentName: input.identity.kind === "agent" ? input.identity.agentName ?? null : null,
          authorId: input.identity.id, authorKind: input.identity.kind, authorLabel: input.identity.label,
          commitId, createdAt: now(), message: input.summary, reviewStatus: input.reviewStatus, summary: input.summary,
        });
        tips.set(resolved.projectId, commitId);
        return { kind: "saved", commitId };
      },
      list(limit, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("온라인 저장 연결이 필요합니다"));
        const n = Math.max(1, Math.min(100, Math.floor(limit)));
        const list = bucket(commits, resolved.projectId).slice(0, n);
        const tip = list[0]?.commitId;
        if (tip) tips.set(resolved.projectId, tip);
        return Promise.resolve(list);
      },
      async hydrateTip(target?) {
        const resolved = resolve(target);
        if (!resolved) return null;
        return (await repository.commits.list(1, resolved))[0]?.commitId ?? null;
      },
      peekTip: (projectId) => tips.get(projectId) ?? null,
      seedTip(projectId, commitId) { if (commitId) tips.set(projectId, commitId); },
    },
    ai: {
      recordActivity(input: AiActivityInput, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        const list = bucket(activity, resolved.projectId);
        const row: Row = {
          log_id: input.logId, project_id: resolved.projectId, channel: input.channel,
          instruction: input.instruction.slice(0, 4000), map_id: input.mapId ?? null,
          ...(input.runId ? { run_id: input.runId } : {}), payload_json: input.payload, created_at: now(),
        };
        const index = list.findIndex((entry) => entry.log_id === input.logId);
        if (index >= 0) list[index] = row; else list.unshift(row);
        return Promise.resolve({ kind: "saved" });
      },
      listActivity(limit, target?, listOptions = {}) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve([]);
        const n = Math.max(1, Math.min(100, Math.floor(limit)));
        const list = bucket(activity, resolved.projectId)
          .filter((row) => (listOptions.runId ? row.run_id === listOptions.runId : true))
          .slice(0, n)
          .map((row) => ({ ...row, source: "ai_activity_logs" }));
        return Promise.resolve(list);
      },
      recordConversation(input: ConversationInput, target?) {
        const resolved = resolve(target);
        if (!resolved || input.destinationProjectId === null) return Promise.resolve({ kind: "not-configured" });
        const projectId = input.destinationProjectId
          ?? (input.projectContextKey?.startsWith("remote:") ? input.projectContextKey.slice(7) : resolved.projectId);
        const list = bucket(conversations, projectId);
        const row: Row = {
          conversation_id: input.conversationId, project_id: projectId, title: input.title.slice(0, 200), model: input.model,
          project_context_key: input.projectContextKey ?? null, entries_json: input.entries, saved_at: new Date(input.savedAt).toISOString(),
        };
        const index = list.findIndex((entry) => entry.conversation_id === input.conversationId);
        if (index >= 0) list[index] = row; else list.push(row);
        return Promise.resolve({ kind: "saved" });
      },
      listConversations(listOptions: ConversationListOptions, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        listOptions.signal?.throwIfAborted();
        const n = Math.max(1, Math.min(100, Math.floor(listOptions.limit ?? 50)));
        const offset = Math.max(0, Math.floor(listOptions.offset ?? 0));
        const query = listOptions.query?.trim().toLowerCase();
        const rowsForProject = bucket(conversations, resolved.projectId)
          .filter((row) => (listOptions.projectContextKey === undefined ? true : row.project_context_key === listOptions.projectContextKey))
          .filter((row) => (query ? String(row.title).toLowerCase().includes(query) : true))
          .sort((a, b) => String(b.saved_at).localeCompare(String(a.saved_at)) || String(a.conversation_id).localeCompare(String(b.conversation_id)))
          .slice(offset, offset + n)
          .map((row) => (listOptions.includeEntries ? row : Object.fromEntries(Object.entries(row).filter(([key]) => key !== "entries_json"))));
        return Promise.resolve(rowsForProject);
      },
      loadConversation(conversationId, target?, signal?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.reject(new Error("Conversation recovery is not configured"));
        signal?.throwIfAborted();
        return Promise.resolve(bucket(conversations, resolved.projectId).find((row) => row.conversation_id === conversationId) ?? null);
      },
      recordAnalysisRun(input: AiAnalysisRunInput, target?) {
        const resolved = resolve(target);
        if (!resolved) return Promise.resolve({ kind: "not-configured" });
        analysisRuns.push({
          run_id: randomUuid(), project_id: resolved.projectId, tileset_id: input.tilesetId,
          selected_tile_ids_json: input.selectedTiles, prompt_context_json: input.promptContext, result_json: input.result, created_at: now(),
        });
        return Promise.resolve({ kind: "saved" });
      },
    },
  };
  return repository;
}
