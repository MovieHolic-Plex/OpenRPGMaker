// editor/tools/applyChangesetToStore.ts
// 브라우저 배선 어댑터. 순수 툴 실행 결과를 에디터 스토어에 반영한다.
// **이 파일만 브라우저/에디터(store, mapEditHistory)에 의존한다.** 나머지 툴 레이어는 전부 순수.

import { harnessToolReason, isUsableToolReason, splitToolCallReason } from "@/ai/toolReason";
import { transferDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import { assertSpatialToolAcceptance, finishSpatialToolAcceptance } from "./spatialToolState";
import { ProjectFormatError } from "@/project/io/errors";
import { SpatialOperationError } from "@/project/spatial/domain";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { loadAiConfig } from "@/ai/llmClient";
import { currentAgentEditorIdentity, currentHumanEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommit, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline, summaryForDiff, type CommitLogInput, type CommitRow } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import { canonicalJsonString } from "@/project/persistence/core/canonicalJson";
import type { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { createProjectWikiCoordinator, type WikiDeliveryMilestone } from "@/editor/projectWikiCoordinator";
import type { ChangeSummary, Project } from "@/project/types";
import { reconcileReviewedWorldForApply } from "@/project/world";
import { commitChangeset, summarizeChanges } from "./changeset";
import { runTool } from "./toolRunner";
import { ToolError, type ToolContext, type ToolResult } from "./types";
import { assertHouseProtection, captureHouseProtection } from "./houseProtection";
import type { EditActivityField, EditActivityOrigin } from "@/editor/editActivityLog";
import type { ProjectChangeAnnotation } from "@/project/store";
import type { RunOperation } from "@/ai/runOperation";
import { isMapDestruction } from "@/ai/approvalPolicy";

/**
 * AI/툴 적용을 행위 로그에 남길 주석으로 바꾼다.
 *
 * 왜 필요한가 (2026-08-29 실측) — 이 파일의 `store.replace` 3곳과
 * `regionTask/runRegionTask.ts` 1곳이 descriptor 없이 호출되고 있었다. 그래서 **AI 로 만든
 * 편집 전량**이 기본값 `{ scope: "project" }` + 라벨 없음 + `origin: "human"` 으로 떨어졌다.
 * 채팅으로만 작업하는 사용자에게는 행위 로그가 `(라벨 없음)` 줄만 남아, 고치려던 문제
 * (「어떤 NPC 를 고쳤는지 모른다」)가 AI 경로에 그대로 재현됐다.
 *
 * diff 를 여기서 새로 계산하지 않는다 — 호출부가 이미 `ChangeSummary` 를 들고 있다.
 */
function applyAnnotation(
  origin: EditActivityOrigin,
  label: string,
  diff: ChangeSummary | undefined,
  toolNames: readonly string[],
  reason?: string,
): ProjectChangeAnnotation {
  const fields: EditActivityField[] = [];
  // 변경 없는 축은 싣지 않는다 — 0 이 스무 줄 늘어서면 정작 바뀐 축을 못 찾는다.
  if (diff) {
    for (const [key, value] of Object.entries(diff)) {
      if (typeof value === "number" && value > 0) fields.push({ path: key, after: value });
      else if (value === true) fields.push({ path: key, after: true });
    }
  }
  if (toolNames.length > 0) fields.push({ path: "tools", after: toolNames.join(", ") });
  return { label, origin, ...(fields.length > 0 ? { fields } : {}), ...(reason ? { reason } : {}) };
}

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "build_house",
  "build_village",
  "build_castle",
  "clear_region",
  "clear_map",
  "set_map_properties",
  "place_npc",
  "upsert_event",
  "script_cutscene",
  "move_event",
  "remove_event",
  "author_house",
]);

export type ToolUndoScope =
  | { readonly kind: "map"; readonly mapId: string }
  | { readonly kind: "project" };

/** canonical construction undo 정책: existing target → map, new target → project. */
export function toolUndoScope(name: string, args: Record<string, unknown>): ToolUndoScope {
  if (name === "author_village") {
    const target = args.target;
    if (typeof target === "object" && target !== null && !Array.isArray(target)) {
      const kind = (target as Record<string, unknown>).kind;
      if (kind === "new") return { kind: "project" };
      const mapId = (target as Record<string, unknown>).mapId;
      if (typeof mapId === "string" && mapId.length > 0) return { kind: "map", mapId };
    }
    return { kind: "project" };
  }
  const mapId = typeof args.mapId === "string" ? args.mapId : null;
  if (mapId && MAP_ONLY_WRITE_TOOLS.has(name)) return { kind: "map", mapId };
  return { kind: "project" };
}

function recordToolSnapshot(name: string, args: Record<string, unknown>): void {
  const scope = toolUndoScope(name, args);
  if (scope.kind === "map") {
    recordProjectSnapshot(undefined, scope.mapId, { kind: "map" });
    return;
  }
  recordProjectSnapshot();
}

// dryRun 프리뷰: 스토어를 건드리지 않고 결과(diff/issues)만 계산한다.
export function previewTool(name: string, args: Record<string, unknown>): ToolResult {
  const ctx: ToolContext = { project: store.getCurrent() };
  return runTool(ctx, name, args, { dryRun: true });
}

// 실제 적용: 커밋 게이트를 통과하면 undo 체크포인트를 남기고 store.replace로 반영한다.
export function applyToolToStore(name: string, args: Record<string, unknown>): ToolResult {
  const split = splitToolCallReason(args);
  const ctx: ToolContext = { project: store.getCurrent() };
  const result = runTool(ctx, name, split.args, { dryRun: false });
  // 쓰기 툴이 성공적으로 새 프로젝트를 만든 경우에만 반영(읽기 툴/거부는 무시).
  if (result.ok && ctx.project !== store.getCurrent()) {
    finishSpatialToolAcceptance(ctx.project);
    recordToolSnapshot(name, split.args); // 변경 이전 상태를 undo 스냅샷으로 저장.
    const summary = result.summary || summaryForDiff(result.diff ?? combineDiffs([]));
    // origin 은 "tool" — 사람이 에디터에서 툴을 직접 실행한 경로다(채팅 에이전트가 아니다).
    store.replace(ctx.project, {
      change: applyAnnotation(
        "tool",
        `툴 ${name}: ${summary}`,
        result.diff,
        [name],
        isUsableToolReason(split.reason) ? split.reason : harnessToolReason("tool-direct", name),
      ),
    });
    recordProjectCommitFireAndForget({
      project: ctx.project,
      identity: currentHumanEditorIdentity(),
      reviewStatus: "direct",
      summary,
      diff: result.diff,
      toolNames: [name],
    });
    resetManualProjectCommitBaseline(ctx.project);
  }
  return result;
}

export type ApplyToolSequenceOptions = {
  readonly agentName?: string;
  readonly source?: "agent" | "human";
  readonly summary?: string;
};

// 여러 툴 호출을 하나의 undo 체크포인트로 묶어 순차 적용한다(어시스턴트 changeset 수락용).
export function applyToolSequenceToStore(
  calls: readonly { name: string; args: Record<string, unknown>; reason?: string }[],
  options: ApplyToolSequenceOptions = {}
): ToolResult[] {
  const before = store.getCurrent();
  const ctx: ToolContext = { project: before };
  const results: ToolResult[] = [];
  let mutated = false;
  const reasons: string[] = [];
  for (const call of calls) {
    const split = splitToolCallReason(call.args);
    const reason = isUsableToolReason(call.reason) ? call.reason : split.reason;
    if (isUsableToolReason(reason)) reasons.push(reason);
    const result = runTool(ctx, call.name, split.args, { dryRun: false });
    if (result.ok && result.diff) mutated = true;
    results.push(result);
    if (!result.ok) break; // 실패 시 중단(부분 적용 방지).
  }
  if (mutated && results.every((result) => result.ok)) {
    const diff = combineDiffs(results.map((result) => result.diff));
    const toolNames = calls.map((call) => call.name);
    const summary = options.summary
      ?? (results.map((result) => result.summary).filter(Boolean).join(" / ") || summaryForDiff(diff));
    const byAgent = options.source === "agent";
    finishSpatialToolAcceptance(ctx.project);
    recordProjectSnapshot();
    store.replace(ctx.project, {
      change: applyAnnotation(
        byAgent ? "ai" : "tool",
        `${byAgent ? `AI 적용${options.agentName ? ` (${options.agentName})` : ""}` : "툴 묶음"}: ${summary}`,
        diff,
        toolNames,
        reasons.join(" · ") || (byAgent ? "AI 적용" : harnessToolReason("tool-direct", "툴 묶음")),
      ),
    });
    if (byAgent) focusAcceptedAgentChanges(before, ctx.project);
    recordProjectCommitFireAndForget({
      project: ctx.project,
      identity: byAgent ? currentAgentEditorIdentity(options.agentName) : currentHumanEditorIdentity(),
      reviewStatus: byAgent ? "approved" : "direct",
      summary,
      diff,
      toolNames,
    });
    resetManualProjectCommitBaseline(ctx.project);
  }
  return results;
}

// ── 제안 프로젝트 스냅샷 공통 적용 경로(todo 4) ─────────────────────────────
// 제안 카드 수락(aiProposalCard)과 자율 런의 마일스톤 자동 적용(assistantSession)이
// 같은 안전 경로를 공유한다: commitChangeset 검증 → undo 스냅샷 → store.replace →
// **await** 커밋 로그. 커밋 로그는 recordProjectCommit(await 변형)으로 결정적 증거를
// 남긴 뒤 반환한다 — 재실행(applyToolSequenceToStore)이 아니라 제안 스냅샷을 그대로
// 적용하므로 자동 생성 id 프리뷰와 적용이 갈라지지 않는다.

/** Captured by the proposal owner before authoring, never supplied by a model. */
export interface ProposalBase {
  readonly version: ReturnType<typeof store.getVersionToken>;
  readonly identity: string;
  readonly content: string;
  readonly world: string;
}

function proposalContent(project: Project): string {
  // World documents are merged from the live store, not replaced by ordinary proposals.
  // Reuse the JSONB comparator without schema normalization: only key order is
  // ignored, while the existing JSON projection, authored values and arrays stay intact.
  return canonicalJsonString(JSON.parse(JSON.stringify({ ...project, world: undefined })));
}

export function captureProposalBase(project: Project): ProposalBase {
  return Object.freeze({
    version: store.getVersionToken(), identity: JSON.stringify(store.getProjectIdentity()),
    content: proposalContent(project), world: canonicalJsonString(JSON.parse(JSON.stringify(project.world ?? null))),
  });
}

function isProposalBaseCurrent(base: ProposalBase, resetProject: boolean): boolean {
  const version = store.getVersionToken();
  if (version.lineage !== base.version.lineage || JSON.stringify(store.getProjectIdentity()) !== base.identity) return false;
  const current = store.getCurrent();
  // Compare authored values even for unchanged counters: save reconciliation and
  // detached callers do not necessarily share the current object. No-op updates
  // and our own saves remain valid; unrelated human edits never refresh the base.
  return proposalContent(current) === base.content
    && (!resetProject || canonicalJsonString(JSON.parse(JSON.stringify(current.world ?? null))) === base.world);
}

export interface ApplyProposedProjectOptions {
  readonly base: ProposalBase;
  readonly operation?: RunOperation;
  /** Actual local application, before synchronous observers or commit/save awaits. */
  readonly onApplied?: (applied: Extract<ApplyProposedProjectResult, { ok: true }>) => void;
  /** Immutable authority captured when the detached draft was created. */
  readonly baseline: AuthoredProjectBaseline;
  readonly source: "agent" | "agent-milestone";
  /** 에이전트 신원 이름. 기본: loadAiConfig().model(카드 현행 동작과 동일). */
  readonly agentName?: string;
  readonly summary: string;
  readonly toolNames: readonly string[];
  /** 커밋 로그에 기록할 diff. 기본: summarizeChanges(before, proposed). */
  readonly diff?: ChangeSummary;
  readonly snapshotLabel?: string;
  readonly snapshotMapId?: string | null;
  /**
   * 맵 규모 파괴(clear_map)를 사용자가 승인했음을 밝히는 플래그. **모델이 아니라 표면이 채운다.**
   * 채팅 표면은 showConfirm 을 통과한 뒤에만 true 를 넘긴다(aiProposalCard). 자율 런은 이런 배치를
   * 자동 적용하지 않는다(AssistantSession.maybeAutoApplyMilestone) — 모달을 띄울 사람이 없기 때문이다.
   * toolNames 로 판정하는 이유: 이 경로는 도구 실행 전에 합의된 스냅샷을 받으므로 args 를 다시
   * 뜯을 필요가 없고, /pi 처럼 자기 검토 카드를 가진 표면은 실제 툴 이름을 넘기지 않아 스스로 빠진다.
   */
  readonly mapDestructionApproved?: boolean;
  readonly resetProject?: boolean;
  readonly reviewStatus?: CommitLogInput["reviewStatus"];
  readonly reason?: string;
}

export type ApplyProposedProjectResult =
  | { readonly ok: true; readonly commit: CommitRow; readonly applied: Project; readonly commitProject?: Project; readonly wikiWarning?: string; readonly wikiDelivery?: WikiDeliveryMilestone }
  | {
    readonly ok: false;
    readonly reason: "commit-rejected" | "retired-run" | "stale-base" | "stale-baseline" | "map-destruction-unapproved";
    /** 대표 사유 한 줄(상태 텍스트·토스트용). */
    readonly issue?: string;
    /**
     * 반려를 만든 **차단 사유 전량**. 게이트 경고 모달이 이걸 그대로 나열한다.
     * `commit.issues` 가 아니라 `commit.blocking` 에서 온다 — issues 에는 이 변경이
     * 만들지 않은 선재 오류도 섞여 있어서, 첫 error 를 골라 보고하면 반려와 무관한
     * 문장이 사유로 나갔다(예: 무관한 편집인데 "시작 위치 통행 불가"가 사유로 표시).
     */
    readonly issues?: readonly string[];
  };

/**
 * 제안 프로젝트를 안전 적용 경로로 반영한다. 실패(커밋 게이트 차단) 시 스토어를
 * 건드리지 않는다. 성공 시 undo 스냅샷 1개 + store.replace + await 커밋 row 1개가
 * 보장된다(마일스톤 단위 결정성). 커밋 기록 네트워크 실패는 적용을 막지 않는다
 * (기존 fire-and-forget의 console.warn 정책과 동일) — row는 persisted:false 로 반환.
 */
export async function applyProposedProject(
  proposed: Project,
  options: ApplyProposedProjectOptions,
): Promise<ApplyProposedProjectResult> {
  if (options.operation?.signal.aborted) return { ok: false, reason: "retired-run", issue: "Run authority retired" };
  if (!isProposalBaseCurrent(options.base, options.resetProject === true)) {
    return { ok: false, reason: "stale-base", issue: "기준 프로젝트가 변경되었습니다. 최신 편집을 기준으로 다시 요청해주세요." };
  }
  const before = store.getCurrent();
  if (!options.baseline.matches(before, options.resetProject === true)) {
    const issue = "초안을 만든 뒤 프로젝트가 수정되었습니다. 최신 프로젝트에서 다시 생성하고 독립 검수를 받아주세요.";
    return { ok: false, reason: "stale-baseline", issue, issues: [issue] };
  }
  // 맵 규모 파괴는 사람이 봐야 적용된다. 권위(위)와 불변식(아래) 검사를 통과한 배치라도,
  // "무엇이 사라졌는지 화면에서 봤다"는 전제 없이는 되돌리기가 유일한 복구라는 정책이 성립하지 않는다.
  if (options.mapDestructionApproved !== true && options.toolNames.some((name) => isMapDestruction(name))) {
    const issue = "맵 전체 청소는 사용자 허가가 필요합니다 — 채팅에서 확인 후 적용하세요.";
    return { ok: false, reason: "map-destruction-unapproved", issue, issues: [issue] };
  }
  const wikiProjectIdentity = JSON.stringify(store.getProjectIdentity());
  // Wiki checkpoints and human codex edits own world documents independently of
  // detached authoring previews. A title/map proposal must not restore an old wiki.
  const appliedProject = { ...proposed };
  transferDetachedDraftMemory(proposed, appliedProject);
  try { assertSpatialToolAcceptance(appliedProject, before); }
  catch (error) {
    if (!(error instanceof ToolError || error instanceof ProjectFormatError || error instanceof SpatialOperationError)) throw error;
    return { ok: false, reason: "commit-rejected", issue: error.message, issues: [error.message] };
  }
  if (!options.resetProject) {
    // R2: blanket live-world replacement erases approved author_npc_cast
    // registrations. Merge instead — reviewed authored graph wins, live wiki
    // documents survive. The R1 baseline gate above already rejected concurrent
    // authored drift, so the reviewed partition applies cleanly by construction.
    const merged = reconcileReviewedWorldForApply(proposed.world, before.world);
    if (merged) appliedProject.world = merged;
    else delete appliedProject.world;
  }
  // A detached preview may predate human edits or newly accepted houses.
  // Capture the live baseline at application, before any history or store writes.
  try {
    assertHouseProtection(captureHouseProtection(before), appliedProject, []);
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    const issue = error.mapId ? `[${error.mapId}] ${error.message}` : error.message;
    return { ok: false, reason: "commit-rejected", issue, issues: [issue] };
  }
  const commit = commitChangeset(appliedProject, before);
  if (!commit.ok) {
    const blocking = commit.blocking.map((entry) =>
      entry.mapId ? `[${entry.mapId}] ${entry.message}` : entry.message);
    return {
      ok: false,
      reason: "commit-rejected",
      issue: blocking[0] ?? "무결성 오류",
      issues: blocking,
    };
  }
  if (options.operation?.signal.aborted) return { ok: false, reason: "retired-run", issue: "Run authority retired" };
  finishSpatialToolAcceptance(appliedProject);
  recordProjectSnapshot(options.snapshotLabel, options.snapshotMapId);
  // diff 를 replace **전에** 계산한다 — 행위 로그 라벨이 이 시점에 확정돼야 하고,
  // summarizeChanges 는 before(교체 전 스토어)를 필요로 한다.
  const diff = options.diff ?? summarizeChanges(before, appliedProject);
  const change = applyAnnotation(
    "ai",
    `${options.source === "agent-milestone" ? "AI 마일스톤" : "AI 제안"} 적용: ${options.summary}`,
    diff,
    options.toolNames,
    options.reason ?? `AI 적용: ${options.summary}`,
  );
  // The client-owned write critical section is synchronous: no await or external
  // callback between the last authority check, undo snapshot, and replacement.
  // All async commit/wiki work below follows the actual local mutation.
  if (options.operation?.signal.aborted) return { ok: false, reason: "retired-run", issue: "Run authority retired" };
  if (!isProposalBaseCurrent(options.base, options.resetProject === true)) {
    return { ok: false, reason: "stale-base", issue: "기준 프로젝트가 변경되었습니다. 최신 편집을 기준으로 다시 요청해주세요." };
  }
  recordProjectSnapshot(options.snapshotLabel, options.snapshotMapId);
  // Correlate at the mutation boundary: synchronous subscribers and the awaited
  // commit can both leave a later edit in the live store before this apply returns.
  const onApplied = (project: Project): void => {
    options.onApplied?.({ ok: true, applied: project, commitProject: project, commit: {
      commitId: null, persisted: false, reviewStatus: options.reviewStatus ?? "approved",
      summary: options.summary, toolNames: options.toolNames, recordedAt: new Date().toISOString(),
    } });
  };
  const commitProject = options.resetProject === true
    ? store.replaceProject(appliedProject, { ...change, projectSwitch: false }, onApplied)
    : store.replace(appliedProject, { change, onApplied });
  if (!options.operation?.signal.aborted) focusAcceptedAgentChanges(before, appliedProject);
  const commitInput: CommitLogInput = {
    project: appliedProject,
    identity: currentAgentEditorIdentity(options.agentName ?? loadAiConfig().model),
    reviewStatus: options.reviewStatus ?? "approved",
    summary: options.summary,
    diff,
    toolNames: options.toolNames,
  };
  let commitRow: CommitRow;
  try {
    commitRow = await recordProjectCommit(commitInput);
  } catch (error) {
    console.warn("[projectCommits] record failed:", error);
    commitRow = {
      commitId: null,
      persisted: false,
      reviewStatus: commitInput.reviewStatus,
      summary: commitInput.summary,
      toolNames: commitInput.toolNames ?? [],
      recordedAt: new Date().toISOString(),
    };
  }
  if (options.operation?.signal.aborted) return { ok: true, commit: commitRow, applied: commitProject, commitProject };
  resetManualProjectCommitBaseline(appliedProject);
  let wikiWarning: string | undefined;
  let wikiDelivery: WikiDeliveryMilestone | undefined;
  if (JSON.stringify(store.getProjectIdentity()) !== wikiProjectIdentity) {
    return { ok: true, commit: commitRow, applied: store.getCurrent(), commitProject, wikiWarning: "프로젝트가 바뀌어 이전 작업의 위키 진행 기록을 갱신하지 않았습니다." };
  }
  if (appliedProject.world?.entities.some((entity) => entity.wiki)) {
    try {
      await createProjectWikiCoordinator().observe(options.summary, options.toolNames, options.operation?.signal,
        milestone => { wikiDelivery = milestone; });
    } catch (cause) {
      wikiWarning = cause instanceof Error ? cause.message : String(cause);
    }
  }
  return { ok: true, commit: commitRow, applied: store.getCurrent(), commitProject,
    ...(wikiDelivery ? { wikiDelivery } : {}), ...(wikiWarning ? { wikiWarning } : {}) };
}
