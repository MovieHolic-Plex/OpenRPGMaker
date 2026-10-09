import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventScheduleEditor } from "@/editor/panels/eventEditor/eventScheduleEditor";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("NPC schedule editor", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => restoreDom?.());

  // Break caught: an NPC without a tool-authored schedule has no editor surface.
  it("renders for an empty schedule and authors every when/target field", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events.push({ id: "npc", x: 2, y: 3, trigger: { kind: "action" }, commands: [] });
    store.replace(project);

    const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;
    expect(host).toBeTruthy();
    findByTestId(host, "event-schedule-add")?.click();

    setValue(host, "event-schedule-time-phase-0", "evening");
    setChecked(host, "event-schedule-hour-enabled-0", true);
    setValue(host, "event-schedule-hour-start-0", "17");
    setValue(host, "event-schedule-hour-end-0", "19");
    setValue(host, "event-schedule-season-0", "fall");
    setChecked(host, "event-schedule-day-enabled-0", true);
    setValue(host, "event-schedule-day-start-0", "8");
    setValue(host, "event-schedule-day-end-0", "14");
    setValue(host, "event-schedule-x-0", "4");
    setValue(host, "event-schedule-y-0", "5");
    setValue(host, "event-schedule-facing-0", "left");
    setValue(host, "event-schedule-activity-0", "shop");

    expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toEqual({
      when: { timePhase: "evening", hourRange: [17, 19], season: "fall", dayRange: [8, 14] },
      at: { mapId: map.id, x: 4, y: 5 },
      facing: "left",
      activity: "shop",
    });
  });

  // Break caught: schedule rows can be added but not removed back to the empty state.
  it("deletes the authored schedule row", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events.push({
      id: "npc",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      schedule: [{ when: {}, at: { mapId: map.id, x: 2, y: 3 } }],
    });
    store.replace(project);
    const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

    findByTestId(host, "event-schedule-delete-0")?.click();

    expect(store.getCurrent().maps[map.id]?.events[0]?.schedule).toEqual([]);
  });

  // Break caught: an authored hour/day range cannot be cleared back to an always-matching condition.
  it("clears exact-time and day ranges independently", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events.push({
      id: "npc",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      schedule: [{
        when: { timePhase: "day", hourRange: [10, 16], season: "spring", dayRange: [2, 7] },
        at: { mapId: map.id, x: 2, y: 3 },
      }],
    });
    store.replace(project);
    const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

    setChecked(host, "event-schedule-hour-enabled-0", false);
    setChecked(host, "event-schedule-day-enabled-0", false);

    expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]?.when).toEqual({
      timePhase: "day",
      season: "spring",
    });
  });

  // Break caught: HTML min/max can be bypassed and invalid schedule coordinates are persisted.
  it("clamps bypassed hour, day, and target coordinate values", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events.push({
      id: "npc",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      schedule: [{ when: { hourRange: [6, 18], dayRange: [1, 28] }, at: { mapId: map.id, x: 2, y: 3 } }],
    });
    store.replace(project);
    const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

    setValue(host, "event-schedule-hour-start-0", "-10");
    setValue(host, "event-schedule-hour-end-0", "80");
    setValue(host, "event-schedule-day-start-0", "0");
    setValue(host, "event-schedule-day-end-0", "500");
    setValue(host, "event-schedule-x-0", "-3");
    setValue(host, "event-schedule-y-0", "9999");

    expect(store.getCurrent().maps[map.id]?.events[0]?.schedule?.[0]).toMatchObject({
      when: { hourRange: [0, 48], dayRange: [1, 99] },
      at: { mapId: map.id, x: 0, y: map.height - 1 },
    });
  });

  // Break caught: an unconditional row before a conditional row shadows the later schedule silently.
  it("warns when an unconditional row shadows later rows", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    map.events.push({
      id: "npc",
      x: 2,
      y: 3,
      trigger: { kind: "action" },
      commands: [],
      schedule: [
        { when: {}, at: { mapId: map.id, x: 2, y: 3 } },
        { when: { timePhase: "night" }, at: { mapId: map.id, x: 3, y: 3 } },
      ],
    });
    store.replace(project);

    const host = renderEventScheduleEditor(map.id, map.events[0]) as unknown as FakeElement;

    expect(findByTestId(host, "event-schedule-shadow-warning-0")).toBeTruthy();
  });
});

function setValue(host: FakeElement, testid: string, value: string): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing ${testid}`);
  control.value = value;
  control.dispatchEvent(new Event("change"));
}

function setChecked(host: FakeElement, testid: string, checked: boolean): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing ${testid}`);
  control.checked = checked;
  control.dispatchEvent(new Event("change"));
}
