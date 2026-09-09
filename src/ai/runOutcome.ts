import type { AcceptanceStatus } from "./assistantAcceptance";

export type VisualDeliveryFacts = {
  /** 이번 실행에서 살아 있는 렌더 캡처 수. */
  readonly attempted: number;
  /** 그중 제공자가 실제 요청에서 수신을 확인한 수. */
  readonly attached: number;
};

export type RunOutcome = {
  readonly execution: "response-final" | "awaiting-user" | "blocked" | "cancelled" | "budget-exhausted" | "failed";
  readonly goal: "unassessed" | "incomplete" | "satisfied";
  readonly delivery: "no-change" | "draft" | "applied" | "persisted" | "persisted-verified";
  /**
   * 자료 이미지가 **실제 요청에 실렸는지**만 말한다. 목표 충족·저장 증명과 독립된 축이고,
   * 모델이 그림을 이해했다는 주장이 아니다. 전달 사실을 보고하지 않은 호출자에게는 false 다.
   */
  readonly imageAttached: boolean;
  /** 전달 사실을 보고한 호출자에게만 존재한다. 없는 것은 "0건"이 아니라 "모름"이다. */
  readonly visualDelivery?: VisualDeliveryFacts;
};

/** Already normalized by the run owner; this projection does not establish evidence authority. */
export type RunOutcomeFacts = {
  readonly execution: RunOutcome["execution"];
  readonly acceptance: AcceptanceStatus | null;
  readonly hasPendingDraft: boolean;
  readonly hasApplied: boolean;
  /** Only this run/version's P1 save receipt and fresh proof can supply these facts. */
  readonly persistence: "none" | "accepted" | "verified-current";
  /** 세션의 이미지 증거 원장이 보고한 전달 사실. 생략하면 이 실행은 그 사실을 모른다. */
  readonly visualDelivery?: VisualDeliveryFacts;
};

const assessedGoals = Object.freeze({
  pending: "incomplete",
  working: "incomplete",
  verifying: "incomplete",
  verified: "satisfied",
  blocked: "incomplete",
} as const satisfies Readonly<Record<AcceptanceStatus, RunOutcome["goal"]>>);

const appliedDeliveries = Object.freeze({
  none: "applied",
  accepted: "persisted",
  "verified-current": "persisted-verified",
} as const satisfies Readonly<Record<RunOutcomeFacts["persistence"], RunOutcome["delivery"]>>);

export function deriveRunOutcome(facts: RunOutcomeFacts): RunOutcome {
  return Object.freeze({
    execution: facts.execution,
    goal: facts.acceptance === null ? "unassessed" : assessedGoals[facts.acceptance],
    // Pending work wins the display axis, not ownership of earlier applied milestones.
    delivery: facts.hasPendingDraft ? "draft"
      : facts.hasApplied ? appliedDeliveries[facts.persistence] : "no-change",
    // 첨부는 오직 확인된 전달에서만 참이다. 보고 자체가 없으면 거짓으로 둔다 — 모르는 것을
    // 성공으로 올리지 않는다.
    imageAttached: (facts.visualDelivery?.attached ?? 0) > 0,
    ...(facts.visualDelivery ? { visualDelivery: Object.freeze({ ...facts.visualDelivery }) } : {}),
  });
}
