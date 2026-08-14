// editor/tools/applyChangesetToStore.ts
// 브라우저 배선 어댑터. 순수 툴 실행 결과를 에디터 스토어에 반영한다.
// **이 파일만 브라우저/에디터(store, mapEditHistory)에 의존한다.** 나머지 툴 레이어는 전부 순수.

import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { loadAiConfig } from "@/ai/llmClient";
import { currentAgentEditorIdentity, currentHumanEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommit, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline, summaryForDiff, type CommitLogInput, type CommitRow } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { ChangeSummary, Project } from "@/project/types";
import { commitChangeset, summarizeChanges } from "./changeset";
import { runTool } from "./toolRunner";
import type { ToolContext, ToolResult } from "./types";

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "build_house",
  "build_house_kit",
  "build_house_lots",
  "build_village",
  "build_castle",
  "stamp_structure_kit",
  "clear_region",
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
  const ctx: ToolContext = { project: store.getCurrent() };
  const result = runTool(ctx, name, args, { dryRun: false });
  // 쓰기 툴이 성공적으로 새 프로젝트를 만든 경우에만 반영(읽기 툴/거부는 무시).
  if (result.ok && ctx.project !== store.getCurrent()) {
    recordToolSnapshot(name, args); // 변경 이전 상태를 undo 스냅샷으로 저장.
    store.replace(ctx.project);
    recordProjectCommitFireAndForget({
      project: ctx.project,
      identity: currentHumanEditorIdentity(),
      reviewStatus: "direct",
      summary: result.summary || summaryForDiff(result.diff ?? combineDiffs([])),
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
  calls: readonly { name: string; args: Record<string, unknown> }[],
  options: ApplyToolSequenceOptions = {}
): ToolResult[] {
  const before = store.getCurrent();
  const ctx: ToolContext = { project: before };
  const results: ToolResult[] = [];
  let mutated = false;
  for (const call of calls) {
    const result = runTool(ctx, call.name, call.args, { dryRun: false });
    if (result.ok && result.diff) mutated = true;
    results.push(result);
    if (!result.ok) break; // 실패 시 중단(부분 적용 방지).
  }
  if (mutated && results.every((result) => result.ok)) {
    recordProjectSnapshot();
    store.replace(ctx.project);
    if (options.source === "agent") focusAcceptedAgentChanges(before, ctx.project);
    const diff = combineDiffs(results.map((result) => result.diff));
    recordProjectCommitFireAndForget({
      project: ctx.project,
      identity: options.source === "agent" ? currentAgentEditorIdentity(options.agentName) : currentHumanEditorIdentity(),
      reviewStatus: options.source === "agent" ? "approved" : "direct",
      summary: options.summary ?? (results.map((result) => result.summary).filter(Boolean).join(" / ") || summaryForDiff(diff)),
      diff,
      toolNames: calls.map((call) => call.name),
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

export interface ApplyProposedProjectOptions {
  readonly source: "agent" | "agent-milestone";
  /** 에이전트 신원 이름. 기본: loadAiConfig().model(카드 현행 동작과 동일). */
  readonly agentName?: string;
  readonly summary: string;
  readonly toolNames: readonly string[];
  /** 커밋 로그에 기록할 diff. 기본: summarizeChanges(before, proposed). */
  readonly diff?: ChangeSummary;
  readonly snapshotLabel?: string;
  readonly snapshotMapId?: string | null;
  /** reset_project 포함 수락 시 전체 프로젝트 교체(카드 경로 전용). */
  readonly resetProject?: boolean;
  readonly reviewStatus?: CommitLogInput["reviewStatus"];
}

export type ApplyProposedProjectResult =
  | { readonly ok: true; readonly commit: CommitRow; readonly applied: Project }
  | { readonly ok: false; readonly reason: "commit-rejected"; readonly issue?: string };

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
  const before = store.getCurrent();
  const commit = commitChangeset(proposed, before);
  if (!commit.ok) {
    const issue = commit.issues.find((entry) => entry.severity === "error");
    return { ok: false, reason: "commit-rejected", issue: issue?.message ?? "무결성 오류" };
  }
  recordProjectSnapshot(options.snapshotLabel, options.snapshotMapId);
  if (options.resetProject === true) store.replaceProject(proposed);
  else store.replace(proposed);
  focusAcceptedAgentChanges(before, proposed);
  const diff = options.diff ?? summarizeChanges(before, proposed);
  const commitInput: CommitLogInput = {
    project: proposed,
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
  resetManualProjectCommitBaseline(proposed);
  return { ok: true, commit: commitRow, applied: store.getCurrent() };
}
