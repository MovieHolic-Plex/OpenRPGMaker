// 방 키트 단계(interior-exits · door-floor-transfers)는 방으로 깔린 맵에만 돌고, 장소 잇기 자리(pickTransferSpot)는 문 그림을 지어내 깔지 않는다.
// 2026-11-11 단계×테마 표: 에도·일본 도시·마법 학교·한국 거리 바깥 맵 9장 모두에서 «…문» 이름 이벤트 하나가 맵 남쪽 줄 전체를 벽으로 바꿨고,
// 잇기 자리는 걸어서 지나는 성문 한가운데였다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { dressInteriorExits, kitOf } from "@/ai/v2/place/exitDress";
import { doorFloorTransfers } from "@/ai/v2/place/exitTransfers";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { laidOf } from "@/ai/v2/place/laid";
import { pickTransferSpot } from "@/ai/v2/place/transferSpot";
import type { BuildRun } from "@/ai/v2/shared/types";

type Ctx = { project: Project };
const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
const tiles = (map: GameMap) => JSON.stringify([map.lowerTiles, (map as unknown as Record<string, unknown>).lowerOverlayTiles, map.upperTiles, (map as unknown as Record<string, unknown>).upperOverlayTiles]);

function edo(style: string, width: number, height: number): Ctx {
  const ctx = { project: createBlankProject() };
  expect(runTool(ctx, "create_map", { id: "map_e", name: "에도", width, height, tilesetId: "sengoku_edo" }).ok).toBe(true);
  expect(runTool(ctx, "compose_sengoku_edo_map", { mapId: "map_e", style, seed: 1 }).ok).toBe(true);
  const map = ctx.project.maps.map_e!;
  // 시작 칸: 맨 아래 줄의 걸을 수 있는 칸(남쪽 길 끝).
  let start: { x: number; y: number } | undefined;
  for (let x = 0; x < map.width && !start; x++) if (isPassable(ctx.project, map, x, map.height - 1)) start = { x, y: map.height - 1 };
  ctx.project = { ...ctx.project, startMapId: "map_e", startPos: start ?? { x: 0, y: 0 } } as Project;
  return ctx;
}

const gateEvent = (x: number, y: number): GameEvent => ({
  id: "ev_gate_sign", name: "낡은 성문", x, y, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_gate_sign_p0", name: "낡은 성문", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "굳게 닫혀 있다." }] }],
}) as unknown as GameEvent;

describe("room-kit stages run only on maps laid as rooms", () => {
  it("leaves an outdoor street of a room-kit chipset alone, door-named event or not", () => {
    const ctx = edo("village", 54, 42);
    const map0 = ctx.project.maps.map_e!;
    expect(kitOf(ctx.project, map0)).toBeUndefined();
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_e: { ...map0, events: [...map0.events, gateEvent(ctx.project.startPos.x, ctx.project.startPos.y - 3)] } } };
    const before = tiles(ctx.project.maps.map_e!);
    const start = { ...ctx.project.startPos };
    expect(dressInteriorExits(runOf(ctx), "map_e").notes).toEqual([]);
    expect(doorFloorTransfers(runOf(ctx), "map_e")).toEqual([]);
    expect(tiles(ctx.project.maps.map_e!)).toBe(before);
    expect(ctx.project.startPos).toEqual(start);
  }, 60_000);

  it("trusts what the place record says the map was laid as", () => {
    expect(laidOf({ type: "village", name: "거리" })).toBe("outdoor");
    expect(laidOf({ type: "interior", name: "방" })).toBe("room");
    expect(laidOf({ type: "interior", name: "성하 마을", style: "world:sengoku_edo:castle-town" })).toBe("outdoor");
    expect(laidOf({ type: "dungeon", name: "굴" })).toBeUndefined();
    expect(laidOf(undefined)).toBeUndefined();
    const ctx = edo("village", 54, 42);
    expect(kitOf(ctx.project, ctx.project.maps.map_e!, "outdoor")).toBeUndefined();
  }, 60_000);
});

describe("pickTransferSpot", () => {
  it("picks a declared building entrance, never a walk-through gate, and never paints the map", () => {
    const ctx = edo("castle_town", 56, 48);
    const map = ctx.project.maps.map_e!;
    const before = tiles(map);
    const entrances = buildingEntrances(ctx.project, map);
    expect(entrances.length).toBeGreaterThan(0);
    for (const side of ["south", "north", "east", "west"] as const) {
      const spot = pickTransferSpot(runOf(ctx), "map_e", { side, outdoor: true });
      expect(spot).toBeDefined();
      if (spot?.doorAt) {
        expect(entrances.some((e) => e.x === spot.doorAt!.x && e.y === spot.doorAt!.y && e.front.x === spot.x && e.front.y === spot.y)).toBe(true);
        expect(isPassable(ctx.project, map, spot.doorAt.x, spot.doorAt.y)).toBe(false);
      }
      expect(isPassable(ctx.project, map, spot!.x, spot!.y)).toBe(true);
    }
    expect(tiles(ctx.project.maps.map_e!)).toBe(before);
  }, 60_000);

  it("reads building entrances from the kits, blocked cell above a walkable front", () => {
    const ctx = edo("village", 54, 42);
    const map = ctx.project.maps.map_e!;
    const entrances = buildingEntrances(ctx.project, map);
    expect(entrances.length).toBeGreaterThanOrEqual(3);
    for (const e of entrances) {
      expect(isPassable(ctx.project, map, e.x, e.y)).toBe(false);
      expect(isPassable(ctx.project, map, e.front.x, e.front.y)).toBe(true);
      expect(e.kit.length).toBeGreaterThan(0);
    }
  }, 60_000);
});
