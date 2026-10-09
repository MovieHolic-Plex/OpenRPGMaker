// 반복 맵(map.loop) — 2026-09-24 꿈 세계 도그푸딩: 「가장자리가 반대편으로 이어지는 숲」을 만들 속성이 없었다.
import { describe, expect, it } from "vitest";
import { loopStepTarget, wrapLoopPosition } from "@/project/mapLoop";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

const map = { width: 10, height: 8, loop: "horizontal" as const };

describe("map.loop", () => {
  it("루프 축 가장자리를 넘는 걸음만 반대편으로 접는다", () => {
    expect(loopStepTarget(map, 9, 3, 1, 0)).toEqual({ x: 0, y: 3 });
    expect(loopStepTarget(map, 0, 3, -1, 0)).toEqual({ x: 9, y: 3 });
    expect(loopStepTarget(map, 4, 0, 0, -1)).toBeNull();
    expect(loopStepTarget(map, 4, 3, 1, 0)).toBeNull();
    expect(loopStepTarget({ ...map, loop: "both" }, 4, 0, 0, -1)).toEqual({ x: 4, y: 7 });
    expect(wrapLoopPosition(map, 10, 3)).toEqual({ x: 0, y: 3 });
    expect(wrapLoopPosition(map, 3, -1)).toEqual({ x: 3, y: -1 });
  });

  it("set_map_properties 로 켜고 끄며, 가장자리가 막혀 있으면 경고한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const on = runTool(ctx, "set_map_properties", { mapId, loop: "both" });
    expect(on.ok, on.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.loop).toBe("both");
    expect(on.summary).toContain("사방 반복");
    const off = runTool(ctx, "set_map_properties", { mapId, loop: "none" });
    expect(off.ok, off.summary).toBe(true);
    expect(ctx.project.maps[mapId]!.loop).toBeUndefined();
  });
});
