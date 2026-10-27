// 버들항 도로(author_wild_route) — 2026-10-06 「1번 도로가 엉망진창」 수정의 계약.
// 시내 포석·계단 길·덤불 점박이·막다른 길 토막, 그리고 조수가 도로에 찍은 항구·농장 소품.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { beodeulWoodlandGrass } from "@/editor/tools/beodeulForest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt } from "@/project/mapLayers";
import type { GameMap, Project } from "@/project/types";

function routeProject(seed: number): { ctx: ToolContext; map: GameMap } {
  const project = createBlankProject();
  project.database.troops.push({ id: "troop_wild", name: "야생", members: [] } as unknown as Project["database"]["troops"][number]);
  const ctx: ToolContext = { project };
  expect(runTool(ctx, "create_map", { id: "map_route", name: "1번 도로", width: 24, height: 36, tilesetId: "beodeul_city" }, { dryRun: false }).ok).toBe(true);
  const result = runTool(ctx, "author_wild_route", {
    mapId: "map_route", exits: [{ x: 12, y: 35 }, { x: 12, y: 0 }], seed, encounters: [{ troopId: "troop_wild", weight: 1 }],
  }, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  expect(result.warnings ?? []).toEqual([]);   // 출구끼리 걸어서 이어진다
  return { ctx, map: ctx.project.maps.map_route! };
}

beforeEach(() => {
  resetMapEditHistory();
});

describe("버들항 도로", () => {
  it.each([1, 7, 15])("seed %i: 모랫길·숲 벽·필드 표시", (seed) => {
    const { ctx, map } = routeProject(seed);
    const tileset = ctx.project.tilesets.beodeul_city!;
    const sand = new Set(tileset.autotileGroups!.find(group => group.name === "버들항 모랫길")!.memberTileIds);
    const paving = new Set(tileset.autotileGroups!.find(group => group.name === "버들항 길 포석")!.memberTileIds);
    const path = map.lowerTiles.map((tile, index) => (sand.has(tile) ? index : -1)).filter(index => index >= 0);
    expect(path.length).toBeGreaterThan(30);
    expect(map.lowerTiles.some(tile => paving.has(tile))).toBe(false);

    // 막다른 모랫길 토막(4칸 이하 덩이, 출구 아님)이 없다.
    const onPath = new Set(path);
    const seen = new Set<number>();
    for (const start of path) {
      if (seen.has(start)) continue;
      const piece = [start];
      seen.add(start);
      for (let i = 0; i < piece.length; i++) {
        const at = piece[i]!, x = at % map.width;
        for (const next of [at - map.width, at + map.width, x > 0 ? at - 1 : -1, x < map.width - 1 ? at + 1 : -1]) {
          if (next >= 0 && onPath.has(next) && !seen.has(next)) { seen.add(next); piece.push(next); }
        }
      }
      const touchesEdge = piece.some(index => Math.floor(index / map.width) === 0 || Math.floor(index / map.width) === map.height - 1);
      if (!touchesEdge) expect(piece.length, `seed ${seed} 토막 ${piece.slice(0, 4).join(",")}`).toBeGreaterThan(4);
    }

    // 숲 벽: 맵의 절반 이상이 나무·덤불로 덮인다(예전 흩뿌림은 3할 남짓). 나무 composer 는 2~4층에 겹쳐 쌓는다(2026-10-20).
    const covered = map.lowerTiles.filter((_, i) => ([2, 3, 4] as const).some(L => layerTileAt(map, L, i) >= 0)).length;
    expect(covered / (map.width * map.height)).toBeGreaterThan(0.5);
    expect(map.mapRole).toBe("field");

    // 일반 RPG(몬스터 수집 아님): 조우 풀숲·풀숲 로케이션이 없고 조우는 맵 전체, 짙은 풀 속 칸만으로 된 네모 판이 없다(2026-10-21 사용자 정정).
    expect((map.locations ?? []).some(location => location.id.startsWith("loc_wild_grass_"))).toBe(false);
    expect(map.encounterTable?.every(entry => !entry.conditions?.locationId)).toBe(true);
    // 2026-10-24 숲 벽이 마을 숲과 같은 수관 오토타일(#3259)로 바뀌며 짙은 풀 바닥 오토타일을 더는 깔지 않는다 — 바닥은 숲 장면 잔디(r4 B)로 통일되고 공용 잔디 737 은 남지 않는다.
    const woodlandGrass = beodeulWoodlandGrass(ctx.project, tileset);
    expect(woodlandGrass).toBeGreaterThanOrEqual(0);
    expect(map.lowerTiles.some(tile => tile === woodlandGrass)).toBe(true);
    expect(map.lowerTiles.some(tile => tile === 737)).toBe(false);
    const core = (i: number) => map.lowerTiles[i] === 11628;
    for (let y = 0; y + 2 < map.height; y++) for (let x = 0; x + 2 < map.width; x++) {
      const i = y * map.width + x;
      // 속 칸(11628) 3×3 이 덮개 없이 드러나면(2~4층 비어 있음) 네모 판이다
      const bare3 = [0, 1, 2].every(dy => [0, 1, 2].every(dx => core(i + dy * map.width + dx) && ([2, 3, 4] as const).every(L => layerTileAt(map, L, i + dy * map.width + dx) < 0)));
      expect(bare3, `seed ${seed} (${x},${y})`).toBe(false);
    }
  });

  it("도로 맵에는 항구·농장 소품을 찍지 않고 숲길 소품은 찍는다", () => {
    const { ctx } = routeProject(1);
    const port = runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: "map_route", x: 1, y: 1 }, { dryRun: false });
    expect(port.ok).toBe(false);
    expect(port.issues?.[0]?.code).toBe("settlement-prop-on-route");
    const town: ToolContext = { project: createBlankProject() };
    const onTown = runTool(town, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-fishing-port-lobster-pots", mapId: town.project.startMapId, x: 2, y: 2 }, { dryRun: false });
    expect(onTown.ok, onTown.summary).toBe(true);
  });
});
