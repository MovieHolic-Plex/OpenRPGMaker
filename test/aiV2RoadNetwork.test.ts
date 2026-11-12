// 길망 검사(judge/roadNetwork) — 닿는 곳 없이 끝나는 길 · 출구 없는 가장자리 길 · 떨어진 길 조각을 좌표로 짚는다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, Project } from "@/project/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { roadNetwork } from "@/ai/v2/judge/roadNetwork";
import { tilesetSurface } from "@/project/tilesetSurface";

function scene() {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const mapId = (run.call("create_map", { name: "길망", width: 30, height: 20, tilesetId: "beodeul_city" }).data as { mapId: string }).mapId;
  const road = (x: number, y: number, w: number, h: number) => expect(run.call("fill_region", { mapId, material: "버들항 · 모랫길 오토타일", rect: { x, y, w, h }, _exactCells: true }).ok).toBe(true);
  const event = (id: string, x: number, y: number, commands: unknown[]) => {
    const p = run.ctx.project, m = p.maps[mapId]!;
    const ev = { id, name: id, x, y, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, name: id, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }] } as unknown as GameEvent;
    run.ctx.project = { ...p, maps: { ...p.maps, [mapId]: { ...m, events: [...m.events, ev] } } } as Project;
  };
  return { run, mapId, road, event, net: () => roadNetwork(run.ctx.project, run.ctx.project.maps[mapId]!) };
}

describe("길망 검사", () => {
  it("버들항 표면 선언은 광장 판석·다리를 길을 잇는 칸으로, 건물·소품을 닿는 곳으로 읽는다(나무는 아니다)", () => {
    const tileset = createBlankProject().tilesets.beodeul_city!, surface = tilesetSurface(tileset);
    const tagged = (tag: string) => tileset.tileMeta!.findIndex((m) => (m?.tags as string[] | undefined)?.includes(tag));
    expect(surface.links.has(tagged("plaza"))).toBe(true);
    expect(surface.links.has(tagged("bridge"))).toBe(true);
    expect(surface.things.has(tagged("building"))).toBe(true);
    expect(surface.things.has(tagged("tree"))).toBe(false);
    expect(surface.road.has(tagged("plaza"))).toBe(false);
  }, 60_000);

  it("풀밭에서 끝나는 길은 막다른 토막이고, 끝에 우물이 서면 아니다", () => {
    const s = scene();
    s.road(0, 10, 20, 2);
    expect(s.net().deadEnds).toEqual([{ x: 19, y: 11, length: 20, into: "ground" }]);
    expect(s.net().edgeNoExit.map((e) => e.side)).toEqual(["west"]);
    expect(s.run.call("stamp_object", { objectId: "kit:beodeul_city/bd-prop-well_roofed", mapId: s.mapId, x: 21, y: 9 }).ok).toBe(true);
    expect(s.net().deadEnds).toEqual([]);
  }, 60_000);

  it("갈래 끝에 아무것도 없으면 짚고, 상자가 있으면 짚지 않는다 · 가장자리 길은 이동이 서면 출구다", () => {
    const s = scene();
    s.road(0, 10, 20, 2);
    s.run.call("stamp_object", { objectId: "kit:beodeul_city/bd-prop-well_roofed", mapId: s.mapId, x: 21, y: 9 });
    s.road(8, 3, 1, 7);
    s.road(14, 16, 3, 1);
    expect(s.net().deadEnds).toEqual([{ x: 8, y: 3, length: 6, into: "ground" }]);
    expect(s.net().detached.map((p) => p.cells)).toEqual([3]);
    s.road(14, 13, 1, 3);   // 큰길에서 맨땅 한 칸 앞까지 — 한 길 줄로 센다
    expect(s.net().detached).toEqual([]);
    s.event("ev_chest", 8, 2, [{ kind: "text", body: "상자" }]);
    expect(s.net().deadEnds.filter((d) => d.x === 8)).toEqual([]);
    s.event("ev_out", 0, 10, [{ kind: "transfer", mapId: "elsewhere", x: 1, y: 1 }]);
    expect(s.net().edgeNoExit).toEqual([]);
  }, 60_000);
});
