import { extractProjectWiki } from "@/ai/projectWikiClient";
import { conversationScopeKey, listConversations, loadConversation } from "@/ai/conversationStore";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { stripContextFooter } from "@/ai/contextFooter";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store, type ProjectFlushResult, type ProjectPersistenceReceipt } from "@/project/store";
import { applyProjectWikiPatch, type ProjectWikiPatch, type ProjectWorld, type WikiSource } from "@/project/world";
import type { Project } from "@/project/types";
import { genId } from "@/util/id";

/** Facts emitted by the wiki writer, not inferred from a later global store diff. */
export type WikiDeliveryMilestone =
  | { readonly kind: "applied"; readonly project: Project | undefined }
  | { readonly kind: "persisted"; readonly project: Project; readonly receipt: ProjectPersistenceReceipt };

export interface WikiTurnInput {
  readonly text: string;
  readonly mapId: string | null;
  readonly composerMode: "do" | "ask" | "plan";
  readonly signal?: AbortSignal;
  readonly onDelivery?: (milestone: WikiDeliveryMilestone) => void;
}

export class ProjectWikiCheckpointError extends Error {
  constructor(readonly reason: "project-changed" | "conflict" | "save", message: string) {
    super(message);
    this.name = "ProjectWikiCheckpointError";
  }
}

export interface WikiCoordinatorDependencies {
  readonly getProject: () => Project;
  readonly getIdentity: () => string;
  readonly updateWorld: (world: ProjectWorld) => Project | void;
  readonly flush: () => Promise<ProjectFlushResult>;
  readonly extract: typeof extractProjectWiki;
  readonly getConfig: () => AiConfig;
  readonly history: () => Promise<readonly WikiSource[]>;
  readonly status: (text: string) => void;
}

const emptyWorld = (): ProjectWorld => ({ entities: [], relations: [] });

/** Same-project local history is evidence, not a remote history service. */
export async function projectWikiHistorySources(): Promise<readonly WikiSource[]> {
  const scope = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
  const records = (await listConversations()).filter((record) => record.projectContextKey === scope)
    .sort((a, b) => a.savedAt - b.savedAt);
  const sources: WikiSource[] = [];
  for (const summary of records) {
    const record = await loadConversation(summary.id);
    if (!record || record.projectContextKey !== scope) continue;
    record.entries.forEach((entry, index) => {
      if (entry.kind !== "user" || !entry.text.trim()) return;
      const parsed = entry.at ? Date.parse(entry.at) : NaN;
      sources.push({
        id: `history:${record.id}:${index}`,
        kind: "user", text: stripContextFooter(entry.text).slice(0, 6000),
        at: Number.isFinite(parsed) ? parsed : Math.max(0, record.savedAt - record.entries.length + index),
      });
    });
  }
  return sources.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/**
 * The editor owns awaited checkpoints. Only document deltas are merged; no old
 * project snapshot is ever written back after an asynchronous model response.
 */
export function createProjectWikiCoordinator(overrides: Partial<WikiCoordinatorDependencies> = {}) {
  const deps: WikiCoordinatorDependencies = {
    getProject: () => store.getCurrent(),
    getIdentity: () => JSON.stringify(store.getProjectIdentity()),
    updateWorld: (world) => {
      recordProjectSnapshot("프로젝트 위키 갱신");
      let applied: Project | undefined;
      store.update((project) => { project.world = world; applied = project; }, {
        scope: "project", origin: "ai", label: "프로젝트 위키 갱신",
      });
      // Capture inside the mutation: synchronous subscribers may already have edited again.
      return applied;
    },
    flush: () => store.flush(),
    extract: extractProjectWiki,
    getConfig: loadAiConfig,
    history: projectWikiHistorySources,
    status: () => {},
    ...overrides,
  };
  const identity = deps.getIdentity();
  const requireCurrent = (signal?: AbortSignal): void => {
    signal?.throwIfAborted();
    if (deps.getIdentity() !== identity) {
      throw new ProjectWikiCheckpointError("project-changed", "프로젝트가 바뀌어 이전 기록 갱신을 취소했습니다.");
    }
  };
  const save = async (signal: AbortSignal | undefined, onSaved: (result: ProjectFlushResult) => void): Promise<void> => {
    requireCurrent(signal);
    const result = await deps.flush();
    // Accepted persistence survives a later cancellation/project edit; current proof does not.
    onSaved(result);
    requireCurrent(signal);
    if (result.kind !== "saved" && result.kind !== "saved-local") {
      throw new ProjectWikiCheckpointError("save", `프로젝트 기록 저장을 완료하지 못했습니다 (${result.kind}).`);
    }
    deps.status(result.kind === "saved" ? "프로젝트 기록 저장 완료" : "임시 프로젝트에 기록했습니다. 원격 저장은 꺼져 있습니다.");
  };
  const apply = async (base: Project, patch: ProjectWikiPatch, sources: readonly WikiSource[], signal?: AbortSignal,
    onDelivery?: WikiTurnInput["onDelivery"]) => {
    requireCurrent(signal);
    const result = applyProjectWikiPatch(deps.getProject().world ?? emptyWorld(), base.world ?? emptyWorld(), patch, sources);
    if (result.conflicts.length) {
      throw new ProjectWikiCheckpointError("conflict", "기록을 읽는 동안 문서가 수정되거나 잠겼습니다. 최신 문서를 확인하고 다시 요청해주세요.");
    }
    let applied: Project | undefined;
    if (result.changed) {
      applied = deps.updateWorld(result.world) || undefined;
      onDelivery?.({ kind: "applied", project: applied });
    }
    // Also retries a prior locally applied patch whose remote save failed, without
    // attributing that historical write (or a human edit) to an empty extraction.
    if (result.changed || deps.getProject().world?.entities.some((entity) => entity.wiki)) {
      await save(signal, saved => {
        if (applied && saved.kind === "saved" && saved.receipt
          && store.isPersistenceReceiptForProject(saved.receipt, applied)) {
          onDelivery?.({ kind: "persisted", project: applied, receipt: saved.receipt });
        }
      });
    }
    return deps.getProject().world;
  };
  const backfill = async (signal?: AbortSignal, onDelivery?: WikiTurnInput["onDelivery"]): Promise<number> => {
    requireCurrent(signal);
    const initialCount = deps.getProject().world?.entities.length ?? 0;
    const known = new Set(deps.getProject().world?.entities.flatMap((entity) => entity.wiki?.sources.map((source) => source.id) ?? []) ?? []);
    const sources = (await deps.history()).filter((source) => !known.has(source.id));
    requireCurrent(signal);
    for (let offset = 0; offset < sources.length; offset += 16) {
      const batch = sources.slice(offset, offset + 16);
      const base = structuredClone(deps.getProject());
      deps.status(`이전 대화 기록 정리 ${Math.min(offset + 16, sources.length)}/${sources.length}`);
      const patch = await deps.extract({
        project: base, userText: "이전 대화에서 현재 유효한 제작 결정과 세계 설정을 정리하세요. 기존의 더 최근 명시적 결정을 과거 기록으로 되돌리지 마세요.",
        sources: batch, signal,
      }, { getConfig: deps.getConfig });
      await apply(base, patch, batch, signal, onDelivery);
    }
    return (deps.getProject().world?.entities.length ?? 0) - initialCount;
  };
  return {
    async prepare(input: WikiTurnInput): Promise<Project["world"]> {
      requireCurrent(input.signal);
      if (input.composerMode !== "do") return deps.getProject().world;
      if (!deps.getProject().world?.entities.some((entity) => entity.wiki)) await backfill(input.signal, input.onDelivery);
      const base = structuredClone(deps.getProject());
      requireCurrent(input.signal);
      const source: WikiSource = { id: genId("wiki_turn"), kind: "user", text: input.text, at: Date.now() };
      deps.status("프로젝트 기록을 확인하고 있습니다");
      const patch = await deps.extract({
        project: base, userText: input.text, sources: [source],
        currentMapId: input.mapId, signal: input.signal,
      }, { getConfig: deps.getConfig });
      return apply(base, patch, [source], input.signal, input.onDelivery);
    },
    backfill,
    async observe(summary: string, toolNames: readonly string[], signal?: AbortSignal,
      onDelivery?: WikiTurnInput["onDelivery"]): Promise<Project["world"]> {
      requireCurrent(signal);
      const base = structuredClone(deps.getProject());
      if (!base.world?.entities.some((entity) => entity.wiki)) return base.world;
      const source: WikiSource = {
        id: genId("wiki_applied"), kind: "application", at: Date.now(),
        text: JSON.stringify({
          summary, appliedTools: toolNames,
          maps: Object.values(base.maps).map((map) => ({
            id: map.id, name: map.name, eventCount: map.events.length,
            fieldSpawns: map.fieldSpawns?.map((spawn) => ({ id: spawn.id, troopId: spawn.troopId, area: spawn.area })),
            actionCombat: map.actionCombat === true, encounterRate: map.encounterRate ?? 0,
          })),
          actionCombatEnabled: base.system.actionCombat?.enabled === true,
        }),
      };
      // Applied state is already machine evidence. Do not ask a model to
      // reconstruct it or invent optional fields before recording the receipt.
      const patch: ProjectWikiPatch = { upserts: [{
        id: genId("w_applied"), type: "guideline", name: "적용된 작업",
        summary, body: source.text,
        wiki: { kind: "progress", basis: "observed", sourceIds: [source.id], topic: source.id },
      }] };
      return apply(base, patch, [source], signal, onDelivery);
    },
  };
}
