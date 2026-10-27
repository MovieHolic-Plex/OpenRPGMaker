import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { shouldRerenderCommandForm } from "@/editor/panels/eventEditor/commandEditDialog";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { idleTimerSatisfies, idleTimerWarningMessage } from "@/editor/panels/eventEditor/timerConditionText";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { el } from "@/util/dom";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

function page(conditions: EventPage["conditions"]): EventPage {
  return {
    id: "page-1",
    name: "검사 페이지",
    conditions: [...conditions],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "hello" }],
  };
}

function gameEvent(eventPage: EventPage): GameEvent {
  return {
    id: "event-test",
    x: 1,
    y: 1,
    trigger: eventPage.trigger,
    commands: [],
    pages: [eventPage],
  };
}

describe("timer condition operator", () => {
  let restoreDom: (() => void) | undefined;
  let replaced: Command | undefined;
  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: (_path, command) => { replaced = command; },
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    replaced = undefined;
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("treats an idle timer as 0 against the stored operator", () => {
    expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 60 })).toBe(true);
    expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 0 })).toBe(true);
    expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 0, op: ">" })).toBe(false);
    expect(idleTimerSatisfies({ kind: "timer", timerId: "timer1", seconds: 30, op: ">=" })).toBe(false);
    expect(idleTimerWarningMessage({ kind: "timer", timerId: "timer1", seconds: 90 })).toContain("90초 이하");
    expect(idleTimerWarningMessage({ kind: "timer", timerId: "timer1", seconds: 0, op: ">" })).toBeNull();
  });

  it("warns for a positive less-than-or-equal threshold and stays quiet for greater-than zero", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const idle = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 60 }]));
    project.maps[mapId]!.events = [idle];
    const idleIssue = validateEventDraftBody(project, mapId, idle).issues.find((issue) => issue.code === "condition.timer.always-true");
    expect(idleIssue?.message).toContain("60초 이하");
    expect(idleIssue?.message).toContain("페이지가 타이머를 켜기 전에");

    const running = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 0, op: ">" }]));
    project.maps[mapId]!.events = [running];
    expect(validateEventDraftBody(project, mapId, running).issues.some((issue) => issue.code === "condition.timer.always-true")).toBe(false);
  });

  it("rebuilds the fork dialog when the timer threshold or operator changes", () => {
    const base = { kind: "fork" as const, condition: { kind: "timer" as const, timerId: "timer1" as const, seconds: 0 }, then: [] };
    expect(shouldRerenderCommandForm(base, { ...base, condition: { ...base.condition, seconds: 90 } })).toBe(true);
    expect(shouldRerenderCommandForm(base, { ...base, condition: { ...base.condition, op: ">" } })).toBe(true);
    expect(shouldRerenderCommandForm(base, base)).toBe(false);
  });

  it("keeps a greater-than operator when the fork timer seconds change", () => {
    const body = renderWithFakeDom(() => renderCommandBody(
      { path: [0], actions, lockKind: true },
      {
        kind: "fork",
        condition: { kind: "timer", timerId: "timer1", seconds: 0, op: ">" },
        then: [],
      },
    ));
    expect(findByTestId(body, "event-fork-timer-warning")).toBeNull();
    expect(body.textContent).toContain("초 초과");
    const minutes = findByTestId(body, "event-condition-timer-minutes");
    expect(minutes).toBeTruthy();
    minutes!.value = "1";
    minutes!.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      condition: { kind: "timer", timerId: "timer1", seconds: 60, op: ">" },
    });
    const op = findByTestId(body, "event-condition-timer-op");
    expect(op?.value).toBe(">");
    op!.value = ">=";
    op!.dispatchEvent(new Event("change"));
    expect(replaced).toMatchObject({
      kind: "fork",
      condition: { kind: "timer", timerId: "timer1", seconds: 60, op: ">=" },
    });
  });

  it("names a 90 second less-than-or-equal fork instead of calling it zero seconds", () => {
    const body = renderWithFakeDom(() => renderCommandBody(
      { path: [0], actions, lockKind: true },
      { kind: "fork", condition: { kind: "timer", timerId: "timer1", seconds: 90 }, then: [] },
    ));
    const warning = findByTestId(body, "event-fork-timer-warning");
    expect(warning?.textContent).toContain("90초 이하");
    expect(warning?.textContent).toContain("0초로 읽어");
    expect(warning?.textContent).not.toContain("임계값");
  });

  it("keeps a greater-than operator when the page timer seconds change", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const event = gameEvent(page([{ kind: "timer", timerId: "timer1", seconds: 5, op: ">" }]));
    project.maps[mapId]!.events = [event];
    store.replace(project);
    const live = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)!.pages![0]!;
    const host = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, event.id, live) }));
    expect(host.textContent).toContain("초과");
    const seconds = findByTestId(host, "event-page-timer1-condition-seconds");
    expect(seconds).toBeTruthy();
    seconds!.value = "12";
    seconds!.dispatchEvent(new Event("change"));
    const saved = store.getCurrent().maps[mapId]!.events.find((entry) => entry.id === event.id)!.pages![0]!.conditions;
    expect(saved).toEqual([{ kind: "timer", timerId: "timer1", seconds: 12, op: ">" }]);
  });
});
