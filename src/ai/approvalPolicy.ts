// ai/approvalPolicy.ts — 승인 게이트 없음. AI 가 만든 변경은 그대로 적용되고, 복구는 되돌리기다.
//
// 폐기된 것: `classifyApproval` 이 파괴적·어휘·규칙 툴을 골라 승인 카드([이 맵에 넣기] ·
// [앞으로 자동 적용])로 보내던 흐름(감독 지시 2026-08-28).
//
// 되돌리기가 실제 복구 경로인 근거: 적용은 `applyProposedProject` 한 곳을 지나고 그 함수의
// `recordProjectSnapshot` 은 **프로젝트 전체** 스냅샷을 undo 스택에 쌓는다(옵션 없이 부르면
// kind:"project"). 맵 삭제·reset_project 도 되돌리기 한 번으로 원복된다.
import type { ChangeSummary } from "@/project/types";
import type { ProposedCall } from "./session/types";

/** 타일 지식(메타데이터) 전용 툴 — 변경 카드 없이 즉시 반영되는 계열(aiChatPanelHelpers 공유). */
export const METADATA_ONLY_TOOLS: ReadonlySet<string> = new Set([
  "set_tile_metadata",
  "set_tile_rules",
  "upsert_tile_group",
  "set_tile_passability",
]);

export type ProposalApplyMode = "apply-now" | "no-changes";

export interface ProposalApplyModeInput {
  /** 이 턴이 만든 쓰기 툴콜 수. 0 이면 적용할 것이 없다. */
  readonly callCount: number;
}

/**
 * 턴이 만든 변경을 어떻게 처리하는지는 이 한 자리가 정한다: 쓰기가 있으면 바로 적용한다.
 *
 * 안전 분류·완성도 린트 경고·파괴 여부·"자동 적용" 설정은 **입력이 아니다** — 일부러 전부
 * 버렸다. 사용자는 승인 카드를 항상 수락했고, 카드는 마찰만 남겼다. 경고는 카드가 아니라
 * 로그로 전달한다.
 *
 * 오류로 끝난 턴도 적용한다: 그 턴이 이미 성공시킨 쓰기를 조용히 버리면 저작물이 사라진다
 * (예전 `review` 분기는 카드가 있어야 회수할 수 있었고, 그 카드를 없앴다). 되돌리기가 있다.
 */
export function resolveProposalApplyMode(input: ProposalApplyModeInput): ProposalApplyMode {
  return input.callCount > 0 ? "apply-now" : "no-changes";
}

export function isSilencedSuccess(calls: readonly ProposedCall[], assistantText: string): { silenced: boolean; kind: string; message: string } | null {
  if (calls.length === 0) {
    const clipped = assistantText.trim().slice(0, 120);
    return { silenced: true, kind: "empty_proposal", message: `변경 없이 종료됨 — "${clipped || "설명 없음"}" — 재시도/되묻기 필요` };
  }
  const autoExpanded = calls.some((c) => c.approvalWarning?.includes("auto-expanded") || c.summary.includes("자동 확장"));
  if (autoExpanded) return { silenced: true, kind: "auto_expanded", message: "스펙 밖 영역을 자동 확장으로 채웠습니다 — 위치를 확인하세요." };
  return null;
}

// #262 판 목록. main 의 라벨용 목록은 3종이었는데, clear_region·delete_resource·
// delete_database_record 도 소실을 만든다 — diff 가 타일 소실을 구분하지 못하므로 이름으로 잡는다.
const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "remove_event", "remove_map", "delete_database_record", "delete_resource", "clear_region", "reset_project",
]);

/**
 * **결과 기반 파괴성 판정** (#262 진단 근본원인 9).
 *
 * 이름 목록만 보면 "지우고 제대로 다시 놓는다"(`remove_event`)는 파괴로 잡히고, "새 맵을 만들어
 * 거기 짓는다"(실제로는 기존 맵을 통째로 교체하던 `run_interior_room_pipeline`)는 무해로 지나갔다.
 * 이름 목록은 유지하되 diff 가 소실을 보고하면 이름과 무관하게 파괴로 본다.
 */
export function isDestructiveOutcome(
  name: string,
  args: Record<string, unknown> | undefined,
  diff: ChangeSummary | undefined,
): boolean {
  if (DESTRUCTIVE_TOOLS.has(name)) return true;
  if (args?.replaceExisting === true) return true;
  if (!diff) return false;
  return diff.mapsRemoved > 0 || diff.eventsRemoved > 0;
}
