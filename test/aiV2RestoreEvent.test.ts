import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { restoreEventFromBefore } from "@/ai/v2/restoreEvent";

const withEvent = (): Project => {
  const p = createBlankProject() as Project;
  const map = Object.values(p.maps)[0]!;
  map.events = [{ id: "ev_memory", name: "깨어난 손님의 기억", x: 12, y: 6, pages: [{ id: "p0", conditions: { switchId: "sw_v2scene_329777_shown" }, movement: { type: "fixed" }, commands: [{ kind: "showText", text: "a" }, { kind: "showText", text: "b" }, { kind: "showText", text: "c" }] }] } as never];
  return p;
};

describe("restore_event (toy-shop advisor turn 2)", () => {
  it("re-adds a deleted event exactly as it was before the request", () => {
    const before = withEvent();
    const after = structuredClone(before);
    Object.values(after.maps)[0]!.events = [];
    const r = restoreEventFromBefore(before, after, "ev_memory");
    expect(r.ok).toBe(true);
    expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
  });
  it("overwrites a rewritten event and accepts the event name", () => {
    const before = withEvent();
    const after = structuredClone(before);
    const ev = Object.values(after.maps)[0]!.events![0]! as unknown as { name?: string; pages: { conditions: unknown }[] };
    ev.name = undefined; ev.pages[0]!.conditions = { switchId: "sw_0003" };
    expect(restoreEventFromBefore(before, after, "깨어난 손님의 기억").ok).toBe(true);
    expect(Object.values(after.maps)[0]!.events).toEqual(Object.values(before.maps)[0]!.events);
  });
  it("refuses an id that did not exist before and lists what did", () => {
    const before = withEvent();
    const r = restoreEventFromBefore(before, structuredClone(before), "ev_nope");
    expect(r.ok).toBe(false);
    expect(r.summary).toContain("ev_memory");
  });
});
