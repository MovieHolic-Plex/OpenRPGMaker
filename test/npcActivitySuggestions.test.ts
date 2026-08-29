import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import { renderNpcActivityCondition } from "@/editor/panels/eventEditor/conditionForm";
import { collectNpcActivitySuggestions } from "@/editor/panels/eventEditor/options";
import { renderPageConditions } from "@/editor/panels/eventEditor/pageConditions";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent, NpcScheduleEntry, Project } from "@/project/types";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const EVENT_ID = "ev-activity-condition";
const NPC_ID = "ev-scheduled-npc";

function scheduleEntry(mapId: string, activity: string | undefined): NpcScheduleEntry {
  return { when: { timePhase: "day" }, at: { mapId, x: 3, y: 3 }, activity, facing: "down" };
}

function seedScheduledNpc(project: Project, activities: readonly (string | undefined)[]): void {
  const mapId = project.startMapId;
  const npc: GameEvent = {
    id: NPC_ID,
    x: 3,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    schedule: activities.map((activity) => scheduleEntry(mapId, activity)),
  };
  const map = project.maps[mapId];
  if (!map) throw new Error("start map missing");
  map.events = [...map.events.filter((entry) => entry.id !== NPC_ID), npc];
}

function activityPage(activity: string): EventPage {
  return {
    id: "page-activity",
    name: "활동 조건",
    conditions: [{ kind: "npcActivity", activity }],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "안녕" }],
  };
}

function hostEvent(page: EventPage): GameEvent {
  return { id: EVENT_ID, x: 2, y: 2, trigger: page.trigger, commands: [], pages: [page] };
}

function optionValues(root: FakeElement, testId: string): string[] {
  const list = findByTestId(root, testId);
  if (!list) throw new Error(`datalist ${testId} 없음`);
  return list.children.filter((child) => child.tagName === "OPTION").map((option) => option.value);
}

describe("활동 조건 저작 도움", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });

  it("프로젝트 일정에 적힌 활동을 중복 없이 정렬해 모은다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["저녁 장터", "귀가", "저녁 장터", "  ", undefined]);

    expect(collectNpcActivitySuggestions(project)).toEqual(["귀가", "저녁 장터"]);
  });

  it("일정이 없으면 빈 목록을 준다", () => {
    expect(collectNpcActivitySuggestions(createBlankProject())).toEqual([]);
  });

  it("페이지 활동 조건 입력이 프로젝트 활동을 후보로 건다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["귀가", "저녁 장터"]);
    const page = activityPage("저녁 장터");
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [...project.maps[mapId]!.events, hostEvent(page)];
    store.replace(project);

    const root = renderWithFakeDom(() => el("div", { children: renderPageConditions(mapId, EVENT_ID, page) }));

    expect(optionValues(root, "event-page-npc-activity-condition-options")).toEqual(["귀가", "저녁 장터"]);
    const input = findByTestId(root, "event-page-npc-activity-condition-input");
    expect(input?.getAttribute("list")).toBe("event-page-npc-activity-condition-options");
  });

  it("분기 폼 활동 입력도 같은 후보를 건다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["귀가"]);
    store.replace(project);

    const root = renderWithFakeDom(() =>
      el("div", { children: [renderNpcActivityCondition({ kind: "npcActivity", activity: "귀가" }, () => undefined)] })
    );

    expect(optionValues(root, "event-condition-npc-activity-options")).toEqual(["귀가"]);
    const input = findByTestId(root, "event-condition-npc-activity");
    expect(input?.getAttribute("list")).toBe("event-condition-npc-activity-options");
  });

  it("어떤 일정에도 없는 활동은 저작 시점에 알려준다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["귀가"]);
    const event = hostEvent(activityPage("관광"));
    project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

    const result = validateEventDraftBody(project, project.startMapId, event);
    const issue = result.issues.find((entry) => entry.code === "condition.npcActivity.unknown");

    expect(issue?.severity).toBe("warning");
    expect(issue?.message).toContain("NPC 일정");
  });

  it("일정에 있는 활동은 알리지 않는다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["귀가", "저녁 장터"]);
    const event = hostEvent(activityPage("저녁 장터"));
    project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

    const result = validateEventDraftBody(project, project.startMapId, event);

    expect(result.issues.filter((entry) => entry.code === "condition.npcActivity.unknown")).toEqual([]);
  });

  it("빈 활동은 기존 경고만 내고 미확인 경고를 겹치지 않는다", () => {
    const project = createBlankProject();
    seedScheduledNpc(project, ["귀가"]);
    const event = hostEvent(activityPage("   "));
    project.maps[project.startMapId]!.events = [...project.maps[project.startMapId]!.events, event];

    const codes = validateEventDraftBody(project, project.startMapId, event).issues.map((entry) => entry.code);

    expect(codes).toContain("condition.npcActivity.empty");
    expect(codes).not.toContain("condition.npcActivity.unknown");
  });
});
