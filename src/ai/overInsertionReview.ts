// ai/overInsertionReview.ts
// 과삽입 중간 검토 — 파괴·대량 변경이 확정 전에 사용자 확인을 기다리는 순수 판정(DOM 금지).
//
// 왜 필요한가 — AI 턴은 쓰기가 있으면 종류·개수와 무관하게 즉시 적용되고(approvalPolicy),
// 자문 게이트(레이어 검증·배치 진단)는 적용을 막지 않으며, 볼륨 계약·스펙 자동 확장은
// 오히려 더 짓도록 재주입한다. "마구마구 쳐넣는" 과삽입이 구조적으로 막히지 않는다.
// 이 모듈은 **무엇이 중간 확인 대상인지**만 정한다. 그리기는 modalStack/showConfirm,
// 비교 렌더는 aiChangePreview 가 한다.

import type { ProposedCall } from "./assistantSession";
import { combineDiffs } from "@/project/projectCommitLog";
import type { ChangeSummary } from "@/project/types";

export interface OverInsertionReviewInput {
  readonly calls: readonly ProposedCall[];
  readonly beforeMapCount: number;
  readonly afterMapCount: number;
}

export interface OverInsertionReview {
  readonly needsReview: boolean;
  readonly reasons: readonly string[];
  readonly destructive: boolean;
}

const DESTRUCTIVE_CALLS: ReadonlySet<string> = new Set([
  "remove_event",
  "remove_map",
  "delete_database_record",
  "delete_resource",
  "clear_region",
  "reset_project",
]);

const MASS_WRITE_MIN_CALLS = 6;
const MASS_TILE_MIN_CELLS = 400;
const MASS_EVENT_MIN = 10;

function callDiffTotal(call: ProposedCall): ChangeSummary | undefined {
  return call.result.diff;
}

function totalDiff(calls: readonly ProposedCall[]): ChangeSummary {
  return combineDiffs(calls.map(callDiffTotal));
}

/**
 * 중간 확인이 필요한지 판정한다. 기존 즉시 적용 계약을 깨지 않기 위해 조건은 좁게 둔다:
 * 파괴 표시·파괴성 툴·새 맵 추가·대량 쓰기(툴콜 수·타일 수·이벤트 수).
 * requiresApproval/approvalWarning 같은 승인 메타데이터는 판정에 쓰지 않는다 — 재료 합의·
 * 규칙 쓰기 같은 정상 턴까지 확인 모달로 막히던 과민 반응을 피한다.
 */
export function reviewOverInsertion(input: OverInsertionReviewInput): OverInsertionReview {
  const reasons: string[] = [];
  if (input.calls.length === 0) return { needsReview: false, reasons: [], destructive: false };

  let destructive = false;
  for (const call of input.calls) {
    if (call.destructive || DESTRUCTIVE_CALLS.has(call.name)) {
      destructive = true;
      reasons.push(`파괴 대상: ${call.name}`);
    }
  }
  if (input.afterMapCount > input.beforeMapCount) {
    reasons.push(`새 맵 +${input.afterMapCount - input.beforeMapCount}`);
  }
  if (input.calls.length >= MASS_WRITE_MIN_CALLS) {
    reasons.push(`쓰기 ${input.calls.length}건(기준 ${MASS_WRITE_MIN_CALLS}건 이상)`);
  }
  const diff = totalDiff(input.calls);
  if (diff.tilesChanged >= MASS_TILE_MIN_CELLS) {
    reasons.push(`타일 ${diff.tilesChanged}칸 변경(기준 ${MASS_TILE_MIN_CELLS}칸 이상)`);
  }
  if (diff.eventsRemoved > 0 || diff.mapsRemoved > 0) {
    destructive = true;
    reasons.push(`삭제: 이벤트 ${diff.eventsRemoved}·맵 ${diff.mapsRemoved}`);
  }
  if (diff.eventsAdded >= MASS_EVENT_MIN) {
    reasons.push(`이벤트 +${diff.eventsAdded}개(기준 ${MASS_EVENT_MIN}개 이상)`);
  }

  return {
    needsReview: reasons.length > 0,
    reasons: [...new Set(reasons)],
    destructive,
  };
}

/** 중간 검토 모달에 넘길 공지 페이로드. */
export function overInsertionNotice(input: OverInsertionReviewInput): {
  readonly kind: "over-insertion-review";
  readonly title: string;
  readonly headline: string;
  readonly reasons: readonly string[];
  readonly nextSteps: readonly string[];
} {
  const review = reviewOverInsertion(input);
  return {
    kind: "over-insertion-review",
    title: review.destructive ? "파괴적 변경 확인" : "대량 변경 확인",
    headline: review.destructive
      ? "AI 변경안에 삭제·파괴 대상이 들어 있어 적용 전에 확인합니다."
      : "AI 변경안이 평소보다 커서 적용 전에 한 번 보여드립니다.",
    reasons: review.reasons.length > 0 ? review.reasons : ["확인 대상 변경입니다."],
    nextSteps: [
      "변경 비교(지금 / 적용 후)를 눈으로 확인하세요.",
      "괜찮으면 적용, 아니면 취소 후 되돌리기로 원복하세요.",
    ],
  };
}
