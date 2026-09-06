/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition } from "@/project/types";

afterEach(() => document.body.replaceChildren());

const cases: readonly { readonly condition: EventPageCondition; readonly code: string; readonly simpleId?: string; readonly advancedField: string }[] = [
  { condition: { kind: "variable", variableId: "missing", op: ">=", value: 1 }, code: "reference.variable.missing", simpleId: "event-page-variable-condition-input", advancedField: "variable" },
  { condition: { kind: "actor", actorId: "missing", present: true }, code: "reference.actor.missing", simpleId: "event-page-actor-condition-input", advancedField: "actor" },
  { condition: { kind: "item", itemId: "missing", present: true }, code: "reference.item.missing", simpleId: "event-page-item-condition-input", advancedField: "item" },
  { condition: { kind: "timer", timerId: "timer2", seconds: 0 }, code: "condition.timer.always-true", simpleId: "event-page-timer2-condition-seconds", advancedField: "timer-seconds" },
  { condition: { kind: "timePhase", phase: "night" }, code: "condition.timePhase.no-time-system", simpleId: "event-page-time-phase-condition-input", advancedField: "time-phase" },
  { condition: { kind: "season", season: "winter" }, code: "condition.season.no-time-system", simpleId: "event-page-season-condition-input", advancedField: "season" },
  { condition: { kind: "npcActivity", activity: "" }, code: "condition.npcActivity.empty", simpleId: "event-page-npc-activity-condition-input", advancedField: "npc-activity" },
  { condition: { kind: "friendshipAtLeast", value: 100 }, code: "condition.friendship.no-character-id", simpleId: "event-page-friendship-condition-npc-key", advancedField: "friendship-npc-key" },
  { condition: { kind: "relationshipAtLeast", state: "dating" }, code: "condition.relationship.no-character-id", simpleId: "event-page-relationship-condition-npc-key", advancedField: "relationship-npc-key" },
  { condition: { kind: "gold", op: "<", amount: -1 }, code: "condition.gold.impossible", advancedField: "gold-amount" },
  { condition: { kind: "all", conditions: [] }, code: "condition.all.empty", advancedField: "group-kind" },
  { condition: { kind: "any", conditions: [] }, code: "condition.any.empty", advancedField: "group-kind" },
  { condition: { kind: "run", query: "flag", flag: "", value: true }, code: "condition.run.flag-empty", advancedField: "run" },
];

describe("page condition validation targets", () => {
  it.each(cases)("resolves both repeated and nested $condition.kind fields through rendered controls", ({ condition, code, simpleId, advancedField }) => {
    // Given: duplicate leaves plus the same kind under NOT/ANY. Form IDs for run are deliberately repeated.
    const project = createBlankProject();
    const page: EventPage = { id: "targets", name: "targets", graphic: {}, trigger: { kind: "action" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "target" }],
      conditions: [structuredClone(condition), structuredClone(condition), { kind: "not", condition: { kind: "any", conditions: [structuredClone(condition)] } }] };
    const event = { id: "targets", x: 1, y: 1, trigger: { kind: "action" as const }, commands: [], pages: [page] };
    store.replaceProject(project);
    const root = document.createElement("div");
    root.append(...renderPageConditions(project.startMapId, event.id, page));
    document.body.append(root);
    const custom = installEventEditorCustomSelects(root);
    custom.refresh();
    try {
      // When: the real validator creates navigation locators for this rendered page.
      const issues = validateEventDraftBody(project, project.startMapId, event).issues.filter(issue => issue.code === code);
      expect(issues).toHaveLength(3);
      const suffixes = simpleId ? [undefined, "0", "1-0-0"] : ["0", "1", "2-0-0"];
      // Then: each locator resolves the exact independent field, and focus uses its visible custom control.
      const focused = new Set<Element>();
      issues.forEach((issue, index) => {
        const suffix = suffixes[index];
        const expectedId = suffix === undefined ? simpleId : advancedField === "run"
          ? "event-condition-run-flag" : `event-page-advanced-condition-${advancedField}-${suffix}`;
        expect(issue.field?.testId).toBe(expectedId);
        const scope = advancedField === "run" ? root.querySelector(`[data-testid="event-page-advanced-condition-row-${suffix}"]`) : root;
        const input = scope?.querySelector<HTMLElement>(`[data-testid="${expectedId}"]`);
        expect(input).not.toBeNull();
        const target = scope?.querySelector(`[data-custom-select-for="${expectedId}"]`)
          ?? (input?.matches("select.event-record-modal-select") ? input.parentElement?.querySelector(".event-record-picker-trigger") : input);
        navigateToEventDraftIssue(issue);
        expect(document.activeElement).toBe(target);
        expect(target?.closest("details:not([open])")).toBeNull();
        if (document.activeElement) focused.add(document.activeElement);
      });
      expect(focused.size).toBe(3);
    } finally { custom.dispose(); }
  });
});
