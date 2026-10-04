// editor/tools/applyChangesetToStore.ts
// 브라우저 배선 어댑터. 순수 툴 실행 결과를 에디터 스토어에 반영한다.
// **이 파일만 브라우저/에디터(store, mapEditHistory)에 의존한다.** 나머지 툴 레이어는 전부 순수.

import { harnessToolReason, isUsableToolReason, splitToolCallReason } from "@/ai/toolReason";
import { transferDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import { assertSpatialToolAcceptance, authorMergedSpatialProposal, finishSpatialToolAcceptance } from "./spatialToolState";
import { mergeProjectThreeWay, type ProjectMergeConflict } from "@/project/projectMerge";
import { ProjectFormatError } from "@/project/io/errors";
import { SpatialOperationError } from "@/project/spatial/domain";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { loadAiConfig } from "@/ai/llmClient";
import { currentAgentEditorIdentity, currentHumanEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommit, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline, summaryForDiff, type CommitLogInput, type CommitRow } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import { canWriteTeamProject, TEAM_READ_ONLY_WRITE_MESSAGE } from "@/project/teamAccess";
import { jsonContentDigest, withContentDigestEpoch } from "@/project/persistence/core/contentDigest";
import { AuthoredProjectBaseline, projectIdentityDigest, type ProjectIdentitySource } from "@/project/authoredProjectBaseline";
import type { ChangeSummary, Project } from "@/project/types";
import { reconcileReviewedWorldForApply } from "@/project/world";
import { commitChangeset, summarizeChanges } from "./changeset";
import { warmRoundtripCheck } from "@/project/lint/projectLint";
import { runTool } from "./toolRunner";
import { ToolError, type ToolContext, type ToolResult } from "./types";
import { assertHouseProtection, captureHouseProtection } from "./houseProtection";
import type { EditActivityField, EditActivityOrigin } from "@/editor/editActivityLog";
import type { ProjectChangeAnnotation } from "@/project/store";
import { mapCellApply, toolMapCellApply } from "@/editor/incrementalMapApply";
import type { RunOperation } from "@/ai/runOperation";
import { emptiedEventMapIds, isMapDestruction, removedMapIds, wipedTileMapIds } from "@/ai/approvalPolicy";

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
  // MZ 4층 블록·그림자 — mapId 한 맵의 칸만 쓴다(맵 스냅샷이 2·4층·그림자까지 담는다).
  "stamp_layer_block",
  "paint_shadow",
  "sculpt_relief",
  "design_terrain", "lay_terrain_road", "place_terrain_ramp",
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
  "place_props",
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
      renderCells: toolMapCellApply(store.getCurrent(), ctx.project) ?? undefined,
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
  /**
   * 실패한 호출을 건너뛰고 나머지를 이어 적용한다. 성공한 호출만 한 undo 체크포인트로 반영한다.
   * 바로 깔기(stampPlaceRunner)가 쓴다 — 여러 단계 중 하나가 재료를 못 찾아도 나머지는 깔려야 한다.
   * 기본(false)은 기존 계약 그대로: 첫 실패에서 멈추고 전부 성공했을 때만 반영한다.
   */
  readonly continueOnError?: boolean;
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
    if (!result.ok && !options.continueOnError) break; // 실패 시 중단(부분 적용 방지).
  }
  if (mutated && (options.continueOnError || results.every((result) => result.ok))) {
    const applied = results.filter((result) => result.ok);
    const diff = combineDiffs(applied.map((result) => result.diff));
    const toolNames = calls.filter((_call, index) => results[index]?.ok).map((call) => call.name);
    const summary = options.summary
      ?? (applied.map((result) => result.summary).filter(Boolean).join(" / ") || summaryForDiff(diff));
    const byAgent = options.source === "agent";
    finishSpatialToolAcceptance(ctx.project);
    recordProjectSnapshot();
    store.replace(ctx.project, {
      renderCells: toolMapCellApply(store.getCurrent(), ctx.project) ?? undefined,
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
  return projectIdentityDigest(project, "proposal");
}

function worldContent(project: Project): string {
  return jsonContentDigest(project.world ?? null)!;
}

/**
 * 한 동기 구간 안에서만 같은 객체의 정체성 요약을 한 번만 만든다.
 *
 * 왜(2026-09-23 실측, 34.9 MB 프로젝트): 체크포인트 하나가 같은 객체를 두고 proposalContent·
 * authoredIdentity·contentIdentity 를 겹쳐 계산했다 — 한 번에 0.5 s 씩 메인 스레드가 멈췄다.
 *
 * 구간을 넘겨 기억하지 않는다: 사람은 세대를 올리지 않고 객체를 제자리에서 고칠 수 있고
 * (aiMutationApplyAccounting «live content changes without a generation increment»), 그걸
 * 잡는 게 바로 stale-base 검사다. 기억을 세대에 묶었더니 그 편집 위로 옛 제안이 적용됐다.
 * 구간 밖의 재사용은 contentDigest 가 노드마다 현재 값을 대조한 뒤에만 한다.
 */
interface IdentityMemo { content?: string; authored?: string; complete?: string }
let identityScope: WeakMap<Project, IdentityMemo> | null = null;
function withIdentityScope<T>(run: () => T): T {
  if (identityScope) return run();
  identityScope = new WeakMap();
  // 같은 구간 안에서는 요약의 노드 대조도 한 번만 한다(contentDigest.withContentDigestEpoch). 구간 안에서는 값을 고치지 않는다.
  try { return withContentDigestEpoch(run); } finally { identityScope = null; }
}
function memoOf(project: Project): IdentityMemo | null {
  if (!identityScope) return null;
  let memo = identityScope.get(project);
  if (!memo) identityScope.set(project, memo = {});
  return memo;
}
function proposalContentOf(project: Project): string {
  const memo = memoOf(project);
  return memo ? (memo.content ??= proposalContent(project)) : proposalContent(project);
}
const storeIdentities: ProjectIdentitySource = {
  authored: project => {
    const memo = memoOf(project);
    return memo ? (memo.authored ??= projectIdentityDigest(project, "authored")) : projectIdentityDigest(project, "authored");
  },
  complete: project => {
    const memo = memoOf(project);
    return memo ? (memo.complete ??= projectIdentityDigest(project, "complete")) : projectIdentityDigest(project, "complete");
  },
};

export function captureAuthoredBaseline(project: Project): AuthoredProjectBaseline {
  return new AuthoredProjectBaseline(project, storeIdentities);
}

export function captureProposalBase(project: Project): ProposalBase {
  return Object.freeze({
    version: store.getVersionToken(), identity: JSON.stringify(store.getProjectIdentity()),
    content: proposalContentOf(project), world: worldContent(project),
  });
}

/** 적용 권위(기준 + 초안 기준선)를 한 번에 잡는다. 둘을 따로 잡으면 같은 직렬화를 두 번 한다. */
export function captureApplyAuthority(project: Project): { base: ProposalBase; baseline: AuthoredProjectBaseline } {
  return withIdentityScope(() => ({ base: captureProposalBase(project), baseline: captureAuthoredBaseline(project) }));
}

/**
 * 한가할 때 첫 적용의 준비 비용을 미리 치른다: 타일셋·업로드 자산 항목의 저장 왕복 검사 통과 기록, 적용 권위 요약의 노드 기억.
 * 판정에는 영향이 없다 — 왕복 기록은 검사가 실제로 통과한 객체에만 남고, 요약 기억은 값 대조로만 쓰인다.
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB): 조수 첫 체크포인트 적용이 이 둘을 처음 하느라 약 2.7s, 이후는 약 0.3s 였다.
 */
export function warmApplyCaches(project: Project): void {
  try {
    withIdentityScope(() => {
      proposalContentOf(project);
      storeIdentities.authored(project);
    });
    warmRoundtripCheck(project);
  } catch {
    // 준비는 선택이다. 실패하면 첫 적용이 예전처럼 직접 한다.
  }
}

function isProposalBaseCurrent(base: ProposalBase, resetProject: boolean): boolean {
  const version = store.getVersionToken();
  if (version.lineage !== base.version.lineage || JSON.stringify(store.getProjectIdentity()) !== base.identity) return false;
  const current = store.getCurrent();
  // Compare authored values even for unchanged counters: save reconciliation and
  // detached callers do not necessarily share the current object. No-op updates
  // and our own saves remain valid; unrelated human edits never refresh the base.
  return proposalContentOf(current) === base.content
    && (!resetProject || worldContent(current) === base.world);
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
  /** Trusted caller groups live milestones under its first undo snapshot. */
  readonly skipSnapshot?: boolean;
  readonly snapshotLabel?: string;
  readonly snapshotMapId?: string | null;
  /**
   * 맵 규모 파괴(타일 전체 청소·맵 삭제·이벤트 전멸)를 사용자가 승인했음을 밝히는 플래그.
   * **모델이 아니라 표면이 채운다** — showConfirm 을 통과한 뒤에만 true 다(aiProposalCard·
   * aiPiAgentCommand). 자율 런은 이런 배치를 자동 적용하지 않는다
   * (AssistantSession.maybeAutoApplyMilestone) — 모달을 띄울 사람이 없기 때문이다.
   *
   * 2026-09-17 이전에는 이 게이트가 `toolNames` 만 봤고, 주석에 「`/pi` 는 자기 검토 카드가 있으니
   * 스스로 빠진다」고 적혀 있었다. 그 전제가 틀렸다 — 검토 카드의 [적용]은 파괴를 따로 묻지 않고,
   * 자동 적용(`piApply="auto"`)에는 카드 자체가 없다. 그래서 판정은 이름이 **아니라** 결과다.
   */
  readonly mapDestructionApproved?: boolean;
  readonly resetProject?: boolean;
  readonly reviewStatus?: CommitLogInput["reviewStatus"];
  readonly reason?: string;
  /**
   * 출발점 이후 스토어가 움직였으면 거절하지 말고 3-way 병합해 지금 프로젝트 위에 얹는다(2026-10-03).
   * `lineage` = 이 제안이 갈라져 나온 프로젝트(실행의 직전 적용본). 같은 프로젝트(계보·신원)일 때만 — 다른 프로젝트로
   * 바뀌었으면 여전히 stale-base 다. 둘이 같은 자리를 다르게 바꿨으면 스토어 값을 남기고 결과의 `merge.conflicts` 로 알린다.
   * 사람이 다른 맵을 고쳤거나 다른 맵의 AI 실행이 먼저 반영돼도 이 실행의 체크포인트가 죽지 않게 한다.
   */
  readonly rebase?: { readonly lineage: Project };
  /**
   * 적용 뒤 화면을 그 맵으로 데려갈까. 기본 "visible-only". "visible-only" 는 보고 있는 맵일 때만 강조·재생하고
   * 맵을 바꾸거나 카메라를 옮기지 않는다 — 다른 맵에서 도는 백그라운드 실행이 사용자를 끌고 다니지 않게.
   */
  readonly focus?: "follow" | "visible-only";
}

export type ApplyProposedProjectResult =
  | { readonly ok: true; readonly commit: CommitRow; readonly applied: Project; readonly commitProject?: Project;
      /** rebase 로 지금 프로젝트 위에 병합했으면 그 결과(충돌 자리 = 스토어 값을 남긴 곳). */
      readonly merge?: { readonly conflicts: readonly ProjectMergeConflict[]; readonly cellConflicts: number } }
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
interface PreparedApply {
  readonly merge?: { readonly conflicts: readonly ProjectMergeConflict[]; readonly cellConflicts: number };
  readonly appliedProject: Project;
  readonly diff: ChangeSummary;
  readonly change: ReturnType<typeof applyAnnotation>;
}

export async function applyProposedProject(
  proposed: Project,
  options: ApplyProposedProjectOptions,
): Promise<ApplyProposedProjectResult> {
  if (options.operation?.signal.aborted) return { ok: false, reason: "retired-run", issue: "Run authority retired" };
  // 보기 전용 팀 프로젝트에서는 store.replace 가 조용히 아무것도 하지 않는다. 여기서 막지 않으면
  // 호출자가 ok:true 를 받아 「적용됐어요」를 띄운다.
  if (!canWriteTeamProject()) {
    return { ok: false, reason: "commit-rejected", issue: TEAM_READ_ONLY_WRITE_MESSAGE, issues: [TEAM_READ_ONLY_WRITE_MESSAGE] };
  }
  const before = store.getCurrent();
  // 첫 권위 검사부터 마지막 권위 검사까지는 await 도 외부 콜백도 없는 한 동기 구간이다. 그 안에서만 같은 객체
  // (before = 스토어의 현재 프로젝트)의 정체성 문자열을 한 번 만들어 두 검사가 나눠 쓴다 — 예전에는 마지막 검사가
  // 구간 밖이라 수 MB 직렬화를 한 번 더 돌렸다(2026-09-23 실측, 체크포인트마다 0.5 s). 구간은 교체 전에 닫힌다.
  const prepared = withIdentityScope((): ApplyProposedProjectResult | PreparedApply => {
    let authorityBase = options.base;
    let authorityBaseline = options.baseline;
    let merge: PreparedApply["merge"];
    // 같은 프로젝트 안에서 내용만 움직였으면 3-way 병합으로 지금 위에 얹는다. 병합 결과의 권위는 «지금» 이다.
    if (options.rebase && options.resetProject !== true && !isProposalBaseCurrent(options.base, false)
      && store.getVersionToken().lineage === options.base.version.lineage
      && JSON.stringify(store.getProjectIdentity()) === options.base.identity) {
      const merged = mergeProjectThreeWay(options.rebase.lineage, proposed, before);
      proposed = merged.project;
      authorMergedSpatialProposal(proposed, before);
      ({ base: authorityBase, baseline: authorityBaseline } = captureApplyAuthority(before));
      merge = { conflicts: merged.conflicts, cellConflicts: merged.cellConflicts };
    }
    const authority = withIdentityScope(() => !isProposalBaseCurrent(authorityBase, options.resetProject === true) ? "stale-base"
      : !authorityBaseline.matches(before, options.resetProject === true, storeIdentities) ? "stale-baseline" : null);
    if (authority === "stale-base") {
      return { ok: false, reason: "stale-base", issue: "기준 프로젝트가 변경되었습니다. 최신 편집을 기준으로 다시 요청해주세요." };
    }
    if (authority === "stale-baseline") {
      const issue = "초안을 만든 뒤 프로젝트가 수정되었습니다. 최신 프로젝트에서 다시 생성하고 독립 검수를 받아주세요.";
      return { ok: false, reason: "stale-baseline", issue, issues: [issue] };
    }
    // 맵 규모 파괴는 사람이 봐야 적용된다. 권위(위)와 불변식(아래) 검사를 통과한 배치라도,
    // "무엇이 사라졌는지 화면에서 봤다"는 전제 없이는 되돌리기가 유일한 복구라는 정책이 성립하지 않는다.
    //
    // 소실은 **이름이 아니라 결과**로 잡는다 — 이름 목록은 실행 경로가 늘 때마다 빈다(2026-09-17
    // 실측: `/pi` 한 줄이 맵 12개를 지우고 이벤트 20개를 날렸는데 toolNames 가 ["pi_agent"] 라
    // 게이트가 울리지 않았다). resetProject 는 예외다: 프로젝트 전체 교체는 맵 소실이 곧 의도이고
    // 그 경로는 자기 확인을 따로 받는다.
    const losesMaps = options.resetProject === true
      ? false
      : removedMapIds(before, proposed).length > 0 || emptiedEventMapIds(before, proposed).length > 0 || wipedTileMapIds(before, proposed).length > 0;
    if (options.mapDestructionApproved !== true
      && (losesMaps || options.toolNames.some((name) => isMapDestruction(name)))) {
      const issue = losesMaps
        ? "맵·이벤트가 사라지는 변경은 사용자 허가가 필요합니다 — 채팅에서 확인 후 적용하세요."
        : "맵 전체 청소는 사용자 허가가 필요합니다 — 채팅에서 확인 후 적용하세요.";
      return { ok: false, reason: "map-destruction-unapproved", issue, issues: [issue] };
    }
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
    // 클러스터 규칙 위반은 커밋을 막지 않고(commitChangeset 의 isBlocking), 이 경로는
    // commit.issues 를 쓰지 않는다 — 전체 맵 클러스터 스캔(체크포인트마다 ~1s)을 건너뛴다.
    // 규칙 감사는 ruleAuditPanel 이 따로 보여 준다.
    const commit = commitChangeset(appliedProject, before, { clusterMapIds: [] });
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
    if (!isProposalBaseCurrent(authorityBase, options.resetProject === true)) {
      return { ok: false, reason: "stale-base", issue: "기준 프로젝트가 변경되었습니다. 최신 편집을 기준으로 다시 요청해주세요." };
    }
    return { appliedProject, diff, change, ...(merge ? { merge } : {}) };
  });
  if ("ok" in prepared) return prepared;
  const { appliedProject, diff, change, merge } = prepared;
  if (!options.skipSnapshot) recordProjectSnapshot(options.snapshotLabel, options.snapshotMapId);
  // Correlate at the mutation boundary: synchronous subscribers and the awaited
  // commit can both leave a later edit in the live store before this apply returns.
  const onApplied = (project: Project): void => {
    options.onApplied?.({ ok: true, applied: project, commitProject: project, commit: {
      commitId: null, persisted: false, reviewStatus: options.reviewStatus ?? "approved",
      summary: options.summary, toolNames: options.toolNames, recordedAt: new Date().toISOString(),
    } });
  };
  const renderCells = options.resetProject === true
    ? null
    : mapCellApply(before, appliedProject, options.snapshotMapId ?? null);
  const commitProject = options.resetProject === true
    ? store.replaceProject(appliedProject, { ...change, projectSwitch: false }, onApplied)
    : store.replace(appliedProject, { change, onApplied, ...(renderCells ? { renderCells } : {}) });
  if (!options.operation?.signal.aborted) focusAcceptedAgentChanges(before, appliedProject, { follow: options.focus === "follow" });
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
  if (options.operation?.signal.aborted) return { ok: true, commit: commitRow, applied: commitProject, commitProject, ...(merge ? { merge } : {}) };
  resetManualProjectCommitBaseline(appliedProject);
  // Applied work already has a commit and mutation audit entry. Do not turn it
  // into another authored document or attribute a later live edit to this apply.
  return { ok: true, commit: commitRow, applied: commitProject, commitProject, ...(merge ? { merge } : {}) };
}
