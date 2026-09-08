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
  expect(button().closest("summary")).toBeNull();
  const toggle = note.root.querySelector<HTMLButtonElement>("[data-testid='ai-sticky-toggle']")!;
  if (toggle.getAttribute("aria-expanded") !== "true") toggle.click();
  const details = button().closest("details");
  expect(details).not.toBeNull(); details!.open = true;
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
  expect(note.root.querySelector<HTMLElement>("[data-testid='ai-sticky-count']")?.hidden).toBe(true);
  expect(note.root.querySelector(".ai-sticky-done-group [data-item-id='size']")).toBeNull();
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

it("counts only active required obligations while retaining optional and withdrawn failed evidence", async () => {
  const f = fixture();
  await f.run([[plan([
    { id: "pass", title: "PASS", criteria: [{ kind: "eventCount", target: size.criteria[0]!.target, count: 0 }] },
    { ...size, id: "required" }, { ...size, id: "optional", required: false }, { ...size, id: "withdrawn" },
  ]), skip]]);
  const before = f.session.getAcceptanceSnapshot(); if (!before) throw new Error("Missing real assessment");
  expect(f.session.withdrawRequirement({ acceptanceId: before.id, requirementId: "withdrawn", reason: "USER_SCOPE_SENTINEL" })).toBe(true);
  const current = f.session.getAcceptanceSnapshot();
  const note = createAiStickyChecklist(); notes.push(note); note.update(current);
  const count = note.root.querySelector<HTMLElement>("[data-testid='ai-sticky-count']")!;
  expect(count.textContent).toBe("1/2");
  expect(count.dataset).toMatchObject({ requiredCount: "2", verifiedCount: "1", optionalCount: "1", withdrawnCount: "1" });
  expect(note.root.querySelectorAll(".ai-sticky-optional-group [data-testid='ai-sticky-item']")).toHaveLength(1);
  expect(note.root.querySelectorAll(".ai-sticky-withdrawn-group [data-testid='ai-sticky-item']")).toHaveLength(1);
  expect(note.root.dataset.status).toBe("blocked");
  expect(current?.items.find(item => item.id === "optional")).toMatchObject({ required: false, status: "blocked", evidence: [{ passed: false }] });
  expect(current?.items.find(item => item.id === "withdrawn")).toMatchObject({ withdrawal: { source: "user" }, status: "blocked", evidence: [{ passed: false }] });
  expect(note.root.querySelector("[data-item-id='withdrawn']")?.getAttribute("data-status")).toBe("blocked");
  expect(f.session.getAcceptanceSnapshot()).toBe(current);
});

it("reports zero required obligations without relabeling optional work as verified", async () => {
  const f = fixture(); await f.run([[plan([{ ...size, required: false }]), skip]]);
  const current = f.session.getAcceptanceSnapshot();
  const note = createAiStickyChecklist(); notes.push(note); note.update(current);
  const count = note.root.querySelector<HTMLElement>("[data-testid='ai-sticky-count']")!;
  expect(count.hidden).toBe(true);
  expect(count.dataset).toMatchObject({ requiredCount: "0", verifiedCount: "0", optionalCount: "1", withdrawnCount: "0" });
  expect(note.root.dataset.status).toBe("verified");
  expect(note.root.querySelector("[data-item-id='size']")?.getAttribute("data-status")).toBe("working");
  expect(note.root.querySelector(".ai-sticky-done-group [data-item-id='size']")).toBeNull();
  expect(note.root.querySelectorAll(".ai-sticky-optional-group [data-testid='ai-sticky-item']")).toHaveLength(1);
  expect(f.session.getAcceptanceSnapshot()).toBe(current);
});

it("retains genuinely verified optional status in its own group without required credit", async () => {
  const f = fixture(); await f.run([[plan([{ id: "optional-pass", title: "OPTIONAL_PASS", required: false,
    criteria: [{ kind: "eventCount", target: size.criteria[0]!.target, count: 0 }] }]), skip]]);
  const current = f.session.getAcceptanceSnapshot();
  expect(current?.items[0]?.status).toBe("verified");
  const note = createAiStickyChecklist(); notes.push(note); note.update(current);
  const row = note.root.querySelector(".ai-sticky-optional-group [data-item-id='optional-pass']");
  expect(row).not.toBeNull(); expect(row?.getAttribute("data-status")).toBe("verified");
  expect(note.root.querySelector(".ai-sticky-done-group [data-item-id='optional-pass']")).toBeNull();
  const count = note.root.querySelector<HTMLElement>("[data-testid='ai-sticky-count']")!;
  expect(count.hidden).toBe(true);
  expect(count.dataset).toMatchObject({ requiredCount: "0", verifiedCount: "0", optionalCount: "1", withdrawnCount: "0" });
  expect(f.session.getAcceptanceSnapshot()).toBe(current);
});
