import { extractProjectWiki, ProjectWikiExtractionFormatError, ProjectWikiExtractionTimeoutError } from "@/ai/projectWikiClient";
import { conversationScopeKey, queryConversationArchive, loadConversationForScope } from "@/ai/conversationStore";
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

/** Deferred preparation neither replaces the detached world nor claims a write/save. */
export type WikiPreparationOutcome = Project["world"]
  | { readonly kind: "deferred"; readonly reason: WikiDeferralReason };

/**
 * Why this turn carries no record update. Both reasons describe the *extraction round only* —
 * project-state failures (changed/conflict/save) still abort the request, because those mean
 * the caller would author against records it never read.
 */
export type WikiDeferralReason = "extraction-timeout" | "extraction-invalid";

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
  const records = [...(await queryConversationArchive({ projectContextKey: scope, limit: Number.MAX_SAFE_INTEGER })).records]
    .sort((a, b) => a.savedAt - b.savedAt || a.id.localeCompare(b.id));
  const sources: WikiSource[] = [];
  for (const summary of records) {
    const record = await loadConversationForScope(summary.id, scope);
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
    async prepare(input: WikiTurnInput): Promise<WikiPreparationOutcome> {
      requireCurrent(input.signal);
      if (input.composerMode !== "do") return deps.getProject().world;
      const existingWiki = deps.getProject().world?.entities.some((entity) => entity.wiki);
      if (!existingWiki) await backfill(input.signal, input.onDelivery);
      const base = structuredClone(deps.getProject());
      requireCurrent(input.signal);
      const source: WikiSource = { id: genId("wiki_turn"), kind: "user", text: input.text, at: Date.now() };
      deps.status("프로젝트 기록을 확인하고 있습니다");
      let patch: ProjectWikiPatch;
      try {
        patch = await deps.extract({
          project: base, userText: input.text, sources: [source],
          currentMapId: input.mapId, signal: input.signal,
        }, { getConfig: deps.getConfig });
      } catch (cause) {
        requireCurrent(input.signal);
        // 유예는 추출 라운드의 두 실패에만 열려 있다 — 응답이 안 온 것(timeout)과, 온 응답이
        // 기록 형식이 아닌 것(invalid). 둘 다 "이번 턴 기록 없음"일 뿐 요청을 막을 이유가 아니다.
        //
        // 유예하지 '않는' 것: 보호 문서 침범·역전 supersede(ProjectWikiPatchConflictError)와
        // 프로젝트 변경·충돌·저장 실패. 앞은 모델이 프로젝트를 잘못 읽었다는 판정이고, 뒤는
        // 읽지도 않은 기록 위에 저작하게 되는 경우라 둘 다 요청을 멈추는 편이 맞다.
        //
        // 형식 오류에 existingWiki 조건을 걸지 않는 이유(2026-09-15 회귀): 기록이 아직 없는
        // 프로젝트에서 첫 추출이 깨진 답을 받으면 저작 자체가 영영 막힌다. 실제로 이 경로가
        // 턴을 통째로 죽여 툴이 하나도 돌지 않았고, 맵에 아무것도 시공되지 않았다.
        // 타임아웃 규칙은 건드리지 않는다(기록이 있을 때만 유예).
        const reason: WikiDeferralReason | null =
          cause instanceof ProjectWikiExtractionFormatError ? "extraction-invalid"
          : cause instanceof ProjectWikiExtractionTimeoutError && existingWiki ? "extraction-timeout"
          : null;
        if (!reason) throw cause;
        // Deferral must not let a detached session author against changed records/scope.
        const current = deps.getProject();
        if (input.mapId && JSON.stringify(current.maps[input.mapId]) !== JSON.stringify(base.maps[input.mapId])) {
          throw new ProjectWikiCheckpointError("project-changed", "기록을 읽는 동안 요청 대상 맵이 바뀌었습니다.");
        }
        if (JSON.stringify(current.world) !== JSON.stringify(base.world)) {
          throw new ProjectWikiCheckpointError("conflict", "기록을 읽는 동안 문서가 수정되었습니다. 최신 문서를 확인해주세요.");
        }
        return { kind: "deferred", reason };
      }
      return apply(base, patch, [source], input.signal, input.onDelivery);
    },
    backfill,
  };
}
