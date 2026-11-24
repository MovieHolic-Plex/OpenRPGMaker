// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { openEventRailGroupFor } from "@/editor/panels/eventEditor/pageProps";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, EventPageCondition, GameEvent, Project } from "@/project/types";
import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { navigateToEventDraftIssue } from "@/editor/panels/eventEditor/validationBell";
import { isolateTimers } from "./mergedTeardown";

// 호감도 조건의 UI 게이트 — 런타임이 하드 게이트(resolveSocialKey → null)로 항상 거짓을 내는 조합을
// 저작 화면이 조용히 만들게 두지 않는다. 근거: docs/specs/2026-07-14-character-id-relationship-gate.md §1-7,8
describe("friendshipConditionGate", () => {
  isolateTimers();
  const HINT = "event-condition-friendship-requires-character-id";
  function pageWith(conditions: readonly EventPageCondition[]): EventPage {
    return {
      id: "p1",
      name: "호감도 게이트",
      conditions: [...conditions],
      graphic: {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [{ kind: "text", body: "안녕" }],
    };
  }
  function renderRow(page: EventPage, event?: { characterId?: string }): HTMLElement {
    const host = document.createElement("div");
    host.append(...renderPageConditions("map-start", "ev_gate", page, event));
    return host;
  }
  function seedEvent(page: EventPage, characterId?: string): { project: Project; mapId: string; event: GameEvent } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event: GameEvent = {
      id: "ev_gate",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
      ...(characterId ? { characterId } : {}),
    };
    project.maps[mapId]!.events = [event];
    return { project, mapId, event };
  }
  function issueCodes(page: EventPage, characterId?: string): readonly string[] {
    const { project, mapId, event } = seedEvent(page, characterId);
    return validateEventDraftBody(project, mapId, event).issues.map((issue) => issue.code);
  }
  describe("호감도 조건 게이트", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("NPC 관계가 없으면 조건 행이 항상 거짓임을 말한다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).not.toBeNull();
      // 행 자체는 사라지지 않는다 — RM 계약상 핵심 조건 행은 항상 자리를 지킨다.
      expect(host.querySelector('[data-testid="event-page-friendship-condition-value"]')).not.toBeNull();
    });

    it("NPC 관계가 연결되면 경고가 사라진다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), { characterId: "char_a" });
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("NPC 키를 직접 적은 경로는 미연결에서도 유효하다", () => {
      const host = renderRow(pageWith([{ kind: "friendshipAtLeast", npcKey: "village_herbalist", value: 80 }]));
      expect(host.querySelector(`[data-testid="${HINT}"]`)).toBeNull();
    });

    it("검증기가 미연결 호감도 조건을 경고로 잡는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }])))
        .toContain("condition.friendship.no-character-id");
    });

    it("검증기는 연결됐거나 NPC 키가 있으면 경고하지 않는다", () => {
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", value: 80 }]), "char_a"))
        .not.toContain("condition.friendship.no-character-id");
      expect(issueCodes(pageWith([{ kind: "friendshipAtLeast", npcKey: "char_b", value: 80 }])))
        .not.toContain("condition.friendship.no-character-id");
    });

    it("중첩·명령 안 조건도 같은 게이트를 받는다", () => {
      const nested = pageWith([{ kind: "all", conditions: [{ kind: "friendshipAtLeast", value: 10 }] }]);
      expect(issueCodes(nested)).toContain("condition.friendship.no-character-id");

      const forked = pageWith([]);
      const page: EventPage = {
        ...forked,
        commands: [{
          kind: "fork",
          condition: { kind: "friendshipAtLeast", value: 10 },
          then: [],
          else: [],
        }],
      };
      expect(issueCodes(page)).toContain("condition.friendship.no-character-id");
    });
  });
  describe("검증 이슈 앵커와 설정 레일 그룹", () => {
    it("닫힌 그룹 안의 앵커를 가리키면 그 그룹이 열린다", () => {
      const rail = document.createElement("div");
      rail.className = "event-editor-settings-accordion";
      rail.dataset.railKey = "rail-test";
      const groups = ["look-talk", "when"].map((slug, index) => {
        const group = document.createElement("div");
        group.className = `event-editor-settings-accordion-group${index === 0 ? " is-open" : ""}`;
        group.dataset.railGroup = slug;
        const header = document.createElement("button");
        header.className = "event-editor-settings-accordion-header";
        header.setAttribute("aria-expanded", index === 0 ? "true" : "false");
        group.append(header);
        rail.append(group);
        return group;
      });
      const anchor = document.createElement("input");
      groups[1]!.append(anchor);
      document.body.append(rail);

      openEventRailGroupFor(anchor);

      expect(groups[1]!.classList.contains("is-open")).toBe(true);
      expect(groups[0]!.classList.contains("is-open")).toBe(false);
      expect(groups[1]!.querySelector(".event-editor-settings-accordion-header")?.getAttribute("aria-expanded")).toBe("true");
      rail.remove();
    });
  });
});

describe("pageConditionValidationTargets", () => {
  isolateTimers();
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
    { condition: { kind: "difficulty", difficultyId: "" }, code: "reference.difficulty.missing", advancedField: "difficulty" },
    { condition: { kind: "itemUsed", itemId: "" }, code: "reference.item.missing", advancedField: "item-used" },
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
});
