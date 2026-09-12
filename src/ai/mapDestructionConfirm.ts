// ai/mapDestructionConfirm.ts
// 맵 규모 파괴(clear_map)의 **사용자 허가 요청**을 만든다. 순수 판정 + 문안(DOM 금지) —
// 모달 그리기는 editor/ui/modal 의 showConfirm 이 맡는다(overInsertionReview 와 같은 분업).
//
// 왜 이 계열만 팝업인가 (2026-09 정책 예외): 일반 파괴(remove_event·clear_region 등)는 즉시 적용하고
// 복구는 되돌리기다. 실측 근거는 approvalPolicy 머리말에 있다 — 사용자는 승인 카드를 항상 수락했고
// 카드는 마찰만 남겼다. 그 판단이 성립하는 전제는 "무엇이 사라졌는지 사용자가 화면에서 봤다"이다.
// clear_map 은 그 전제를 깬다: 한 콜로 맵 전체가 바뀌므로, 적용 전 화면과 결과가 **다른 맵**이고
// 되돌리기 한 번이 놓치면 작업 단위 자체가 사라진다. 그래서 이 계열만 사람이 한 번 본다.
//
// 이 모듈은 판정과 문안만 한다. 실제 거부는 두 곳이 집행한다:
//  - chat: aiProposalCard 가 적용 전에 showConfirm 을 띄우고, 취소면 적용하지 않는다.
//  - 자율 런: AssistantSession.maybeAutoApplyMilestone 이 자동 적용을 거부한다(모달을 띄울 사람이 없다).
//  - 그 외 모든 경로: applyProposedProject 가 mapDestructionApproved 없이는 거부한다(안전망).

import type { ProposedCall } from "./assistantSession";
import { isMapDestruction } from "./approvalPolicy";

/** 맵 규모 파괴를 포함한 제안인가. 이름 기반이라 diff 계산 전에도 답할 수 있다. */
export function proposalHasMapDestruction(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => isMapDestruction(call.name));
}

export interface MapDestructionConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

/** 툴 결과 data 에서 사람이 읽을 수치를 꺼낸다 — 모델 문장이 아니라 실행 결과가 근거다. */
function destroyedMapLines(call: ProposedCall): string {
  const data = call.result.data;
  const record = typeof data === "object" && data !== null && !Array.isArray(data)
    ? data as Record<string, unknown>
    : null;
  const name = typeof record?.mapName === "string" && record.mapName.trim() ? record.mapName : null;
  const mapId = typeof record?.mapId === "string" ? record.mapId : (typeof call.args.mapId === "string" ? call.args.mapId : null);
  const cells = typeof record?.cells === "number" ? record.cells : null;
  const total = typeof record?.total === "number" ? record.total : null;
  const fill = record?.fill === "empty" ? "허공" : "잔디";
  const events = record?.events === "remove" ? "이벤트까지 삭제" : "이벤트는 유지";
  const where = name ? `'${name}'${mapId ? `(${mapId})` : ""}` : (mapId ?? "알 수 없는 맵");
  const scale = cells !== null
    ? `${cells}칸`
    : "전체 칸";
  const totalNote = total !== null && cells !== null && total > cells ? ` (맵 ${total}칸 중 통행 보장 칸 제외)` : "";
  return `· ${where} — ${scale}${totalNote}, 하위 타일은 ${fill}, ${events}`;
}

/**
 * 허가 모달 요청. 맵 규모 파괴가 없으면 null — 호출부가 모달 없이 그대로 적용한다.
 * fail-closed: 툴 결과에서 수치를 못 꺼내도 요청 자체는 만든다(모르는 채 지나가지 않는다).
 */
export function mapDestructionConfirmRequest(
  calls: readonly ProposedCall[],
): MapDestructionConfirmRequest | null {
  const destroying = calls.filter((call) => isMapDestruction(call.name));
  if (destroying.length === 0) return null;
  const lines = destroying.map(destroyedMapLines);
  return {
    title: "맵 전체 청소 확인",
    message: [
      destroying.length === 1
        ? "맵 하나의 타일을 전부 비우려 합니다."
        : `맵 ${destroying.length}개의 타일을 전부 비우려 합니다.`,
      "",
      ...lines,
      "",
      "필드 스폰·명명 로케이션·시공 기록 같은 맵 메타데이터는 건드리지 않습니다.",
      "적용 후에도 Ctrl+Z 되돌리기로 복구할 수 있습니다.",
    ].join("\n"),
    confirmLabel: destroying.length === 1 ? "맵 비우기" : `맵 ${destroying.length}개 비우기`,
  };
}
