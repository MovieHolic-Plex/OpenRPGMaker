// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
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

// 「실제 세션 수용 판정으로 요구 철회·필수/선택 집계를 그린다」 다섯 케이스는 은퇴했다 — 수용(acceptance) 원장은
// 더 이상 만들어지지 않아(acceptance:disabled, 2026-09-17 하네스 게이트 2차 해체) 세션이 줄 스냅샷이 없다.

it("does not offer a user action for legacy read-only callers", async () => {
  const f = fixture(); await f.run([[plan([size]), skip]]);
  const note = createAiStickyChecklist(); notes.push(note); note.update(f.session.getAcceptanceSnapshot());
  expect(document.querySelector("[data-testid='ai-requirement-withdraw']")).toBeNull();
});
