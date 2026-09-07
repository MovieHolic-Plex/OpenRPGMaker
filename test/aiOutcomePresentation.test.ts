// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import type { RequirementWithdrawalAction } from "@/ai/assistantAcceptance";
import type { RunOutcome } from "@/ai/runOutcome";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";
import { fixture, plan, size, skip } from "./requiredOutcomeFixture";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";

const notes: ReturnType<typeof createAiStickyChecklist>[] = [];
afterEach(() => {
  notes.forEach(note => note.dispose()); notes.length = 0;
  document.body.replaceChildren(); resetIntentDeclarationCache(); vi.restoreAllMocks();
});
function button(): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>("[data-testid='ai-requirement-withdraw']");
  if (!found) throw new Error("Missing requirement action");
  return found;
}

const executions: readonly RunOutcome["execution"][] = ["response-final", "awaiting-user", "blocked", "cancelled", "budget-exhausted", "failed"];
const goals: readonly RunOutcome["goal"][] = ["unassessed", "incomplete", "satisfied"];
const deliveries: readonly RunOutcome["delivery"][] = ["no-change", "draft", "applied", "persisted", "persisted-verified"];
for (const execution of executions) for (const goal of goals) for (const delivery of deliveries) {
  it(`projects ${execution}/${goal}/${delivery} without changing authority`, () => {
    const outcome = Object.freeze({ execution, goal, delivery });
    const root = renderRunOutcome(outcome);
    expect(root.dataset).toMatchObject({ testid: "ai-run-outcome", execution, goal, delivery });
    expect(root.getAttribute("role")).toBe("status");
    expect(root.querySelectorAll("button, input")).toHaveLength(0);
    expect(outcome).toEqual({ execution, goal, delivery });
  });
}

it("withdraws the exact real requirement only on user activation, retaining source and failed evidence", async () => {
  const f = fixture(); await f.run([[plan([size]), skip]], {}, "SOURCE_FIXTURE");
  const snapshot = f.session.getAcceptanceSnapshot();
  if (!snapshot) throw new Error("Missing real assessment");
  const withdraw = vi.fn((action: RequirementWithdrawalAction) => {
    const accepted = f.session.withdrawRequirement(action);
    note.update(f.session.getAcceptanceSnapshot());
    return accepted;
  });
  const note = createAiStickyChecklist({ onWithdraw: withdraw }); notes.push(note);
  note.update(snapshot);
  expect(withdraw).not.toHaveBeenCalled();
  expect(button().dataset.requirementId).toBe(size.id);
  expect(button().closest("summary")).not.toBeNull();
  button().focus(); button().click();
  expect(withdraw).toHaveBeenCalledOnce();
  expect(withdraw).toHaveBeenCalledWith({ acceptanceId: snapshot.id, requirementId: size.id, reason: expect.any(String) });
  const item = f.session.getAcceptanceSnapshot()?.items[0];
  expect(item).toMatchObject({ id: size.id, source: { text: "SOURCE_FIXTURE" }, withdrawal: {
    acceptanceId: snapshot.id, requirementId: size.id, source: "user",
  }, evidence: [{ passed: false }] });
  expect(item?.withdrawal?.reason.trim().length).toBeGreaterThan(0);
  expect(item?.status).not.toBe("verified");
  expect(f.session.getRunOutcome()?.goal).toBe("satisfied");
  expect(button().disabled).toBe(true);
  expect(document.activeElement).not.toBe(document.body);
  button().click(); expect(withdraw).toHaveBeenCalledOnce();
});

it("keeps rejected and busy actions from changing the canonical obligation", async () => {
  const f = fixture(); await f.run([[plan([size]), skip]]);
  const withdraw = vi.fn(() => false);
  const note = createAiStickyChecklist({ onWithdraw: withdraw }); notes.push(note);
  note.update(f.session.getAcceptanceSnapshot());
  note.setBusy(true); button().click(); expect(withdraw).not.toHaveBeenCalled();
  note.setBusy(false); button().click(); expect(withdraw).toHaveBeenCalledOnce();
  expect(f.session.getRunOutcome()?.goal).toBe("incomplete");
  expect(button().disabled).toBe(false);
  expect(document.querySelector("[data-testid='ai-requirement-action-status']")?.getAttribute("role")).toBe("status");
  note.dispose();
  expect(document.querySelector("[data-testid='ai-sticky-checklist']")).toBeNull();
});

it("does not offer a user action for legacy read-only callers", async () => {
  const f = fixture(); await f.run([[plan([size]), skip]]);
  const note = createAiStickyChecklist(); notes.push(note); note.update(f.session.getAcceptanceSnapshot());
  expect(document.querySelector("[data-testid='ai-requirement-withdraw']")).toBeNull();
});
