import type { AcceptanceStatus } from "./assistantAcceptance";

export type RunOutcome = {
  readonly execution: "response-final" | "awaiting-user" | "blocked" | "cancelled" | "budget-exhausted" | "failed";
  readonly goal: "unassessed" | "incomplete" | "satisfied";
  readonly delivery: "no-change" | "draft" | "applied" | "persisted" | "persisted-verified";
};

/** Already normalized by the run owner; this projection does not establish evidence authority. */
export type RunOutcomeFacts = {
  readonly execution: RunOutcome["execution"];
  readonly acceptance: AcceptanceStatus | null;
  readonly hasPendingDraft: boolean;
  readonly hasApplied: boolean;
  /** Only this run/version's P1 save receipt and fresh proof can supply these facts. */
  readonly persistence: "none" | "accepted" | "verified-current";
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
  });
}
