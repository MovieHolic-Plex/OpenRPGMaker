// ai/approvalPolicy.ts — 승인 게이트 없음. AI 가 만든 변경은 그대로 적용되고, 복구는 되돌리기다.
//
// 폐기된 것: `classifyApproval` 이 파괴적·어휘·규칙 툴을 골라 승인 카드([이 맵에 넣기] ·
// [앞으로 자동 적용])로 보내던 흐름(감독 지시 2026-08-28).
//
// 되돌리기가 실제 복구 경로인 근거: 적용은 `applyProposedProject` 한 곳을 지나고 그 함수의
// `recordProjectSnapshot` 은 **프로젝트 전체** 스냅샷을 undo 스택에 쌓는다(옵션 없이 부르면
// kind:"project"). 맵 삭제·reset_project 도 되돌리기 한 번으로 원복된다.
import type { ChangeSummary, Project } from "@/project/types";
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
  "remove_event", "remove_map", "delete_database_record", "delete_resource", "clear_region",
  "clear_map", "reset_project",
]);

/**
 * 맵 규모 파괴 — 한 콜로 맵 전체가 바뀐다. 다른 파괴(이벤트 1개·영역 1칸)와 달리 사용자가 화면에서
 * 보던 것이 통째로 사라지므로, 소실 규모가 승인 UX 를 가른다:
 * 적용 직전 사용자 허가 모달(`mapDestructionConfirm`)과 자율 런 자동 적용 거부
 * (`AssistantSession.maybeAutoApplyMilestone`)가 이 집합 하나를 본다.
 */
export const MAP_DESTRUCTION_TOOLS: ReadonlySet<string> = new Set([
  "clear_map",
  "assemble_mage_city",
]);

/** 이름 기반 맵 규모 파괴 판정. diff 를 모르는 자리(자동 적용 차단·모달)에서 쓴다. */
export function isMapDestruction(name: string): boolean {
  return MAP_DESTRUCTION_TOOLS.has(name);
}

/**
 * 사라지는 맵 id — **이름이 아니라 결과**로 보는 판정.
 *
 * 왜 이름으로는 모자란가(2026-09-17 실측): 「맵 전부 지워줘」 한 줄이 맵 12개를 지웠는데 실행
 * 경로가 `/pi` 라 `toolNames` 가 `["pi_agent"]` 였고 이름 게이트가 한 번도 울리지 않았다. 확인
 * 모달도, 거부도 없이 곧장 「적용 완료」였다. `remove_map` 역시 MAP_DESTRUCTION_TOOLS 밖이라
 * 어느 경로에서도 이름으로는 안 잡혔다. 실행 경로는 앞으로도 늘어난다 — 이름 목록을 늘려 쫓는
 * 대신 base ↔ 제안의 차집합을 본다.
 */
export function removedMapIds(before: Project, proposed: Project): string[] {
  const after = proposed.maps ?? {};
  return Object.keys(before.maps ?? {}).filter((id) => after[id] === undefined).sort();
}

/**
 * 살아남았지만 **이벤트를 전부 잃은** 맵 id. 맵 삭제와 같은 규모의 소실인데 차집합으로는 안 잡힌다
 * (같은 실측에서 마을 맵은 남고 이벤트 20개가 전부 사라졌다 — 20이벤트 → 0이벤트).
 * 「전부」라는 조건이라 임의의 문턱이 아니다: 이벤트가 있던 맵이 하나도 안 남기는 경우만 센다.
 */
function tileLayerHasPaint(tiles: readonly number[] | undefined): boolean {
  return (tiles ?? []).some((tile) => tile !== 0);
}

/** 타일이 있던 맵이 같은 크기 그대로 전 칸 0이 된 경우. Pi 포장 clear_map 이 이름 게이트를 비낀다. */
export function wipedTileMapIds(before: Project, proposed: Project): string[] {
  return Object.entries(before.maps ?? {})
    .filter(([id, map]) => {
      const after = proposed.maps?.[id];
      if (!map || !after || after.width !== map.width || after.height !== map.height) return false;
      const hadPaint = tileLayerHasPaint(map.lowerTiles) || tileLayerHasPaint(map.upperTiles);
      const hasPaint = tileLayerHasPaint(after.lowerTiles) || tileLayerHasPaint(after.upperTiles);
      return hadPaint && !hasPaint;
    })
    .map(([id]) => id)
    .sort();
}

export function emptiedEventMapIds(before: Project, proposed: Project): string[] {
  return Object.entries(before.maps ?? {})
    .filter(([id, map]) => {
      const after = proposed.maps?.[id];
      return (map?.events?.length ?? 0) > 0 && after !== undefined && (after.events?.length ?? 0) === 0;
    })
    .map(([id]) => id)
    .sort();
}

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
