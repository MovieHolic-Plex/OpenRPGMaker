import { describe, expect, expectTypeOf, it } from "vitest";
import type { AcceptanceStatus } from "@/ai/assistantAcceptance";
import { deriveRunOutcome, type RunOutcome } from "@/ai/runOutcome";

type Facts = Parameters<typeof deriveRunOutcome>[0];

const executions = [
  "response-final", "awaiting-user", "blocked", "cancelled", "budget-exhausted", "failed",
] as const satisfies readonly RunOutcome["execution"][];

const assessments = [
  { acceptance: null, goal: "unassessed" },
  { acceptance: "pending", goal: "incomplete" },
  { acceptance: "working", goal: "incomplete" },
  { acceptance: "verifying", goal: "incomplete" },
  { acceptance: "verified", goal: "satisfied" },
  { acceptance: "blocked", goal: "incomplete" },
] as const satisfies readonly {
  readonly acceptance: AcceptanceStatus | null;
  readonly goal: RunOutcome["goal"];
}[];

const deliveries = [
  { hasPendingDraft: false, hasApplied: false, persistence: "none", delivery: "no-change" },
  { hasPendingDraft: false, hasApplied: false, persistence: "accepted", delivery: "no-change" },
  { hasPendingDraft: false, hasApplied: false, persistence: "verified-current", delivery: "no-change" },
  { hasPendingDraft: false, hasApplied: true, persistence: "none", delivery: "applied" },
  { hasPendingDraft: false, hasApplied: true, persistence: "accepted", delivery: "persisted" },
  { hasPendingDraft: false, hasApplied: true, persistence: "verified-current", delivery: "persisted-verified" },
  { hasPendingDraft: true, hasApplied: false, persistence: "none", delivery: "draft" },
  { hasPendingDraft: true, hasApplied: false, persistence: "accepted", delivery: "draft" },
  { hasPendingDraft: true, hasApplied: false, persistence: "verified-current", delivery: "draft" },
  { hasPendingDraft: true, hasApplied: true, persistence: "none", delivery: "draft" },
  { hasPendingDraft: true, hasApplied: true, persistence: "accepted", delivery: "draft" },
  { hasPendingDraft: true, hasApplied: true, persistence: "verified-current", delivery: "draft" },
] as const satisfies readonly (Pick<Facts, "hasPendingDraft" | "hasApplied" | "persistence"> & {
  readonly delivery: RunOutcome["delivery"];
})[];

const queryFacts = {
  execution: "response-final", acceptance: null,
  hasPendingDraft: false, hasApplied: false, persistence: "none",
} as const satisfies Facts;

describe("deriveRunOutcome", () => {
  it("exposes the readonly normalized API when imported by a caller", () => {
    // Given
    const facts: Facts = queryFacts;
    // When
    const outcome = deriveRunOutcome(facts);
    // Then
    expectTypeOf(outcome).toEqualTypeOf<RunOutcome>();
    expectTypeOf<Facts>().toEqualTypeOf<{
      readonly execution: RunOutcome["execution"];
      readonly acceptance: AcceptanceStatus | null;
      readonly hasPendingDraft: boolean;
      readonly hasApplied: boolean;
      readonly persistence: "none" | "accepted" | "verified-current";
    }>();
    expect(outcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
  });

  for (const execution of executions) {
    for (const { acceptance, goal } of assessments) {
      describe(`${execution} / ${acceptance}`, () => {
        it.each(deliveries)(
          "projects $delivery when pending=$hasPendingDraft applied=$hasApplied persistence=$persistence",
          ({ hasPendingDraft, hasApplied, persistence, delivery }) => {
            // Given: expected axes come from the fixed contract tables, not the implementation.
            const facts = Object.freeze({ execution, acceptance, hasPendingDraft, hasApplied, persistence });
            // When
            const outcome = deriveRunOutcome(facts);
            // Then
            expect(outcome).toEqual({ execution, goal, delivery });
          },
        );
      });
    }
  }

  it("preserves accepted persistence when the owner cannot supply a current passing proof", () => {
    // Given: failed proof leaves the accepted save fact intact; this is not a proof-authority test.
    const facts: Facts = { ...queryFacts, acceptance: "verifying", hasApplied: true, persistence: "accepted" };
    // When
    const outcome = deriveRunOutcome(facts);
    // Then
    expect(outcome).toEqual({ execution: "response-final", goal: "incomplete", delivery: "persisted" });
  });

  it("leaves caller facts unchanged when a pending draft wins over applied work", () => {
    // Given: mutable caller input also must not be frozen or rewritten by projection.
    const facts: Facts = { ...queryFacts, execution: "cancelled", hasPendingDraft: true, hasApplied: true };
    const before = { ...facts };
    // When
    deriveRunOutcome(facts);
    // Then
    expect(facts).toEqual(before);
    expect(Object.isFrozen(facts)).toBe(false);
  });

  it("returns an immutable value when projecting normalized facts", () => {
    // Given
    const facts = Object.freeze({ ...queryFacts });
    // When
    const outcome = deriveRunOutcome(facts);
    // Then: every output field is primitive, so freezing the object freezes the whole value.
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(Reflect.set(outcome, "delivery", "persisted-verified")).toBe(false);
    expect(outcome.delivery).toBe("no-change");
  });

  it("does not borrow old delivery or assessment when a new query follows verified applied work", () => {
    // Given: prior invocation is fixture setup, not a source of current-run authority.
    deriveRunOutcome({ ...queryFacts, acceptance: "verified", hasApplied: true, persistence: "verified-current" });
    // When
    const outcome = deriveRunOutcome(queryFacts);
    // Then
    expect(outcome).toEqual({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
  });
});
