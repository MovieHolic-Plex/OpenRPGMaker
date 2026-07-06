// editor/tools/applyChangesetToStore.ts
// 브라우저 배선 어댑터. 순수 툴 실행 결과를 에디터 스토어에 반영한다.
// **이 파일만 브라우저/에디터(store, mapEditHistory)에 의존한다.** 나머지 툴 레이어는 전부 순수.

import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { currentAgentEditorIdentity, currentHumanEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline, summaryForDiff } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import { runTool } from "./toolRunner";
import type { ToolContext, ToolResult } from "./types";

const MAP_ONLY_WRITE_TOOLS = new Set([
  "paint_tiles",
  "paint_road",
  "stamp_structure",
  "stamp_template_house",
  "build_house",
  "clear_region",
  "set_map_properties",
  "place_npc",
  "upsert_event",
  "move_event",
  "remove_event",
]);

function recordToolSnapshot(name: string, args: Record<string, unknown>): void {
  const mapId = typeof args.mapId === "string" ? args.mapId : null;
  if (mapId && MAP_ONLY_WRITE_TOOLS.has(name)) {
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
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
  const ctx: ToolContext = { project: store.getCurrent() };
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
