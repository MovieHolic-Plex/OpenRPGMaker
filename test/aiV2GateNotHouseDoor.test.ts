// 걸어서 지나는 문(성문·아치·목책 문)의 기둥은 집 문이 아니다 — 「문이 굳게 잠겨 있다」 를 세우지 않고, 전에 세운 것은 걷어 낸다.
// 2026-11-11 Terra 게임 둘의 「굳게 닫힌 집 문」 27개가 전부 성문 기둥에 서 있었고, 눈가림 플레이어는 궁전에 들어가지 않았다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { doorArtCells, isWalkThroughDoorArt } from "@/ai/v2/judge/eventReach";
import { lockBareHouseDoors } from "@/ai/v2/place/lockedDoors";
import { VILLAGE_BUILDER } from "@/ai/v2/place/builders/village";
import type { BuildRun } from "@/ai/v2/shared/types";

const locked = (project: Project, mapId: string) => project.maps[mapId]!.events.filter((e) => e.id.startsWith("ev_locked_door_"));

function palace(): { project: Project } {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "map_p", name: "궁전", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
  expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_p", kind: "palace", seed: 1 }).ok).toBe(true);
  return ctx;
}

describe("locked house doors skip walk-through gates", () => {
  it("puts no «locked» line on the posts of a palace gate", () => {
    const ctx = palace();
    const map = ctx.project.maps.map_p!;
    const doors = doorArtCells(ctx.project, map);
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.every((d) => isWalkThroughDoorArt(ctx.project, map, d))).toBe(true);
    const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    expect(notes).toEqual([]);
    expect(locked(ctx.project, "map_p")).toEqual([]);
  });

  it("removes the ones an earlier build left on gate posts", () => {
    const ctx = palace();
    const map = ctx.project.maps.map_p!;
    const post = doorArtCells(ctx.project, map)[0]!;
    const stray = { id: `ev_locked_door_${post.x}_${post.y}`, name: "굳게 닫힌 집 문", x: post.x, y: post.y, trigger: { kind: "playerTouch" }, commands: [], pages: [] } as unknown as GameEvent;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_p: { ...map, events: [...map.events, stray] } } };
    const notes = lockBareHouseDoors({ ctx } as unknown as BuildRun, "map_p");
    expect(notes.join(" ")).toContain(`(${post.x},${post.y})`);
    expect(locked(ctx.project, "map_p")).toEqual([]);
  });

  it("still locks the doors of village houses nobody can enter", () => {
    const ctx = { project: createBlankProject() };
    const run = { ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) } as unknown as BuildRun;
    const built = VILLAGE_BUILDER.build(run, { type: "village", name: "시험", theme: "plain" });
    expect(built.ok, built.summary).toBe(true);
    const mapId = built.mapIds[0]!;
    const map = ctx.project.maps[mapId]!;
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: map.events.filter((e) => !e.id.startsWith("ev_locked_door_")) } } };
    lockBareHouseDoors({ ctx } as unknown as BuildRun, mapId);
    const doors = locked(ctx.project, mapId);
    expect(doors.length).toBeGreaterThan(0);
    for (const d of doors) expect(isWalkThroughDoorArt(ctx.project, ctx.project.maps[mapId]!, d)).toBe(false);
  }, 90_000);
});
