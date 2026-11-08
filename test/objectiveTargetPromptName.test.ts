import { describe, expect, it } from "vitest";
import { promptTargetName } from "@/player/objectiveTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";

function doorTo(mapId: string): RuntimeEventView {
  return { event: { id: "ev_door", name: "문", x: 1, y: 1 }, page: { commands: [{ kind: "transfer", mapId }] } } as unknown as RuntimeEventView;
}

describe("promptTargetName", () => {
  it("shows a destination map name in full instead of cutting it at 12 characters (1.36 VQA #32 #33)", () => {
    const project = { maps: { m1: { name: "우물 밑 · 서고 승강구" }, m2: { name: "왕도 아스텔 · 통금의 밤" } } } as never;
    expect(promptTargetName(project, doorTo("m1"), "Z 이동")).toBe("우물 밑 · 서고 승강구");
    expect(promptTargetName(project, doorTo("m2"), "Z 이동")).toBe("왕도 아스텔 · 통금의 밤");
  });

  it("still clips a long event name, which may carry id-like noise", () => {
    const project = { maps: {} } as never;
    const view = { event: { id: "ev_x", name: "아주아주아주아주긴조사대상이름", x: 1, y: 1 }, page: { commands: [] } } as unknown as RuntimeEventView;
    expect(promptTargetName(project, view, "Z 조사")).toBe("아주아주아주아주긴조사…"); // 12자 넘는 이름은 11자 + 「…」(promptTargetName clip)
  });
});
