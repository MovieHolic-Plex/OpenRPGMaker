import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { createBlankProject } from "@/project/defaults";
import { HAND_INTERIOR_TILESET_ID, roomSpecOf } from "@/editor/handInterior/builder";
import { checkLayout } from "@/ai/v2/place/interiorLayout";
import { planJpRegionScene } from "@/editor/jpCity/regionComposer";
import { jpRegionById } from "@/editor/jpCity/japaneseRegionsCatalog";
import { regionWithLayout } from "@/editor/jpCity/regionVariants";
import { planJpCityStreet } from "@/project/jpCityStreetComposer";
import { laneCells } from "@/ai/v2/place/placementRules";
import type { GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools";
import { canMove, isPassable } from "@/project/collision";
import { PIRATE_DEFAULT_SIZE, PIRATE_MAP_KINDS, pirateKindFromText, type PirateMapKind } from "@/project/pirateIslesComposer";
import { isRoadGround } from "@/ai/v2/place/surface";
import { downsample, structureSimilarity } from "@/ai/v2/place/structureSimilarity";
import { isolateTimers } from "./mergedTeardown";

// 실내 칸 배치 거절 글이 고칠 것을 짚는다(2026-11-04 조수 대조 B1 Argon: 감방을 끝내 못 지었다).
//  - 쇠창살(bars)을 감방 남쪽 벽 줄 위에 그었다 → 「cell (x,8) is not floor」 8건만 받았다 → 벽을 짚어 「창살은 벽 대신 선다」고 말한다.
//  - 가로 벽 문 아래 벽면 두 줄 끝 칸에 화로를 둬 감방이 닿지 않았다 → 「문 곁을 비워라」뿐이었다 → 막는 기물을 이름으로 짚는다.
describe("interiorWallsRepairHints", () => {
  isolateTimers();
  const fixture = (name: string) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  describe("실내 칸 배치 거절 글", () => {
    const tileset = createBlankProject().tilesets[HAND_INTERIOR_TILESET_ID]!;
    const spec = roomSpecOf(tileset)!;

    it("벽 위에 그은 쇠창살은 칸마다가 아니라 벽을 짚어 한 줄로 알린다 — 그 칸만 빼고 깔고 알린다(2026-11-16 «거절은 게임이 깨질 때만»: 벽이 그대로 막는다)", () => {
      const check = checkLayout(fixture("argonCellLayoutBarsOnWall"), spec, tileset);
      expect(check.errors.some((e) => e.startsWith("rail"))).toBe(false);
      const rail = check.warnings.filter((e) => e.startsWith("left out — rail")).map((e) => e.slice("left out — ".length));
      expect(rail).toHaveLength(2);
      expect(rail[0]).toContain(`lie on wall "w_cell_south"`);
      expect(rail[0]).toContain("instead of a wall");
    });

    it("닿지 않는 방은 길을 막는 기물을 이름으로 짚는다", () => {
      const L = fixture("argonCellLayoutBrazierBlocksDoor");
      const errors = checkLayout(L, spec, tileset).errors;
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain(`"brazier"@(5,11)`);
      L.objects = L.objects.filter((o: { id: string; x: number; y: number }) => !(o.id === "brazier" && o.x === 5 && o.y === 11));
      expect(checkLayout(L, spec, tileset).errors).toEqual([]);
    });
  });
});

// jp_city 거리 노면(2026-10-25 판정 J44·J71): 차 밑 노면 표시, 동서 길 횡단보도 방향, 차도 가장자리 칸은 사람 자리가 아니다.
describe("jpStreetRoadDecals", () => {
  isolateTimers();
  function kitSizes() {
    const ts = createBlankProject().tilesets.jp_city!;
    return new Map((ts.structureKits ?? []).map((k) => [k.id, { w: k.width, h: k.height }]));
  }
  describe("J44 역전 큰길 노면", () => {
    const kits = kitSizes();
    const plan = (seed: number, crosswalkTile?: number) => {
      const region = regionWithLayout(jpRegionById("station_plaza")!, seed).region;
      return planJpRegionScene({ region, mapId: "m", width: 40, height: 28, seed, kitSize: (id) => kits.get(id), crosswalkTile });
    };

    it("차 밑에도 외측선 키트를 깐다", () => {
      const steps = plan(3).steps;
      const cars = steps.filter((s) => /jp-prop-(car-|bus)/.test(s.note)).map((s) => ({ x: Number(s.args.x), y: Number(s.args.y), ...kits.get(s.note)! }));
      const lines = steps.filter((s) => /jp-gnd-asph-line-[ns]$/.test(s.note)).map((s) => ({ x: Number(s.args.x), y: Number(s.args.y) }));
      expect(cars.length).toBeGreaterThan(0);
      const under = lines.filter((l) => cars.some((c) => l.x >= c.x && l.x < c.x + c.w && l.y >= c.y && l.y < c.y + c.h));
      expect(under.length).toBeGreaterThan(0);
    });

    it("횡단보도 칸을 주면 옛 세로 줄 키트 대신 2층 칠하기로 놓는다", () => {
      const steps = plan(3, 3631).steps;
      expect(steps.some((s) => s.note === "jp-gnd-zebra")).toBe(false);
      const cw = steps.find((s) => s.tool === "paint_tiles");
      expect(cw?.args).toMatchObject({ layer: "2", mode: "cells", tile: 3631 });
    });

    it("시타마치 골목 횡단보도도 같은 칸으로 칠한다", () => {
      const p = planJpCityStreet({ mapId: "m", width: 40, height: 28, seed: 0, style: "shitamachi", crosswalkTile: 3631 });
      expect(p.steps.some((s) => s.tool === "paint_tiles" && s.args.tile === 3631)).toBe(true);
    });
  });
  describe("J71 차도 가장자리 칸은 보도가 아니다", () => {
    it("「…보도 쪽」 흰 선 아스팔트와 횡단보도를 차도로 센다", () => {
      const project = createBlankProject();
      const map = structuredClone(project.maps[project.startMapId]!) as GameMap;
      map.tilesetId = "jp_city";
      const meta = project.tilesets.jp_city!.tileMeta as unknown as { label?: string }[];
      const find = (re: RegExp) => meta.findIndex((m) => re.test(m?.label ?? ""));
      const edge = find(/路側帯 흰 선, 위 보도 쪽/u), walk = find(/^시타마치 바닥 · 콘크리트 판석 보도/u);
      expect(edge).toBeGreaterThan(0);
      map.lowerTiles[0] = edge; map.lowerTiles[1] = walk;
      const lanes = laneCells(project, map);
      expect(lanes.has(0)).toBe(true);
      expect(lanes.has(1)).toBe(false);
    });
  });
});

// 해적 군도 구성기 — 해안 들판(field) 종류, 다른 맵으로 나가는 길(exits), 섬의 부두·가장자리.
// 왜(2026-11-11 map-vqa 깔기 village-to-field): «마을 + 그 동쪽 들판, 마을 동쪽 길로 나가면 들판» 요청이 섬 마을(나가는 길 없음)과 항구(들판 종류 없음)로 지어졌다.
// 같은 판을 엔진 통행으로 다시 재니 섬의 부두와 수상 가옥 두 채는 섬에서 걸어 닿지 않았고(길 끝과 부두 사이 모래 한 줄이 얕은 물이 됐다), 모래 곶이 맵 위 가장자리에 닿아 있었다.
describe("pirateIslesFieldExits", () => {
  isolateTimers();
  const SLOW = 120_000;
  type Cell = { x: number; y: number };
  type Data = { spawn: Cell; areas: { tag: string; x: number; y: number; w: number; h: number; access?: Cell }[]; exits?: ({ side: string } & Cell)[]; exitsMissing?: string[] };
  function compose(kind: PirateMapKind, seed: number, extra: Record<string, unknown> = {}, size?: [number, number]): { project: Project; map: GameMap; data: Data; summary: string } {
    const ctx = { project: createBlankProject() };
    const [w, h] = size ?? [PIRATE_DEFAULT_SIZE[kind].w, PIRATE_DEFAULT_SIZE[kind].h];
    const mapId = (runTool(ctx, "create_map", { name: kind, width: w, height: h, tilesetId: "pirate_isles" }).data as { mapId: string }).mapId;
    const made = runTool(ctx, "compose_pirate_isles_map", { mapId, kind, seed, ...extra });
    expect(made.ok, made.summary).toBe(true);
    return { project: ctx.project, map: ctx.project.maps[mapId]!, data: made.data as Data, summary: made.summary };
  }
  /** 시작 칸에서 걸어 닿는 칸(엔진 통행). */
  function reach(project: Project, map: GameMap, from: Cell): Set<string> {
    const seen = new Set([`${from.x},${from.y}`]), queue = [from];
    for (let cell = queue.pop(); cell; cell = queue.pop()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx, y = cell.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || seen.has(`${x},${y}`) || !canMove(project, map, cell.x, cell.y, x, y)) continue;
      seen.add(`${x},${y}`); queue.push({ x, y });
    }
    return seen;
  }
  const edgeCells = (map: GameMap): Cell[] => { const out: Cell[] = []; for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1) out.push({ x, y }); return out; };
  describe("해적 군도 — 해안 들판", () => {
    it("field 는 종류 목록의 끝에 있다(앞 종류의 씨앗 소금이 바뀌지 않는다)", () => {
      expect(PIRATE_MAP_KINDS.slice(0, 8)).toEqual(["harbor", "beach", "fort", "wreck", "ship", "tavern", "hut", "cave"]);
      expect(PIRATE_MAP_KINDS.at(-1)).toBe("field");
      expect(pirateKindFromText("마을 동쪽 들판")).toBe("field");
      expect(pirateKindFromText("해적 항구 마을")).toBe("harbor");
    });
    it("들길이 서쪽 끝에서 동쪽 끝까지 이어지고, 오두막 문 앞에 닿으며, 맵의 대부분을 걷는다", () => {
      for (const seed of [1, 2, 7]) {
        const { project, map, data } = compose("field", seed);
        const seen = reach(project, map, data.spawn);
        const roadOn = (x: number) => Array.from({ length: map.height }, (_, y) => y).filter((y) => isRoadGround(project, map, x, y) && seen.has(`${x},${y}`));
        expect(roadOn(0).length, `seed ${seed} west`).toBeGreaterThanOrEqual(2);
        expect(roadOn(map.width - 1).length, `seed ${seed} east`).toBeGreaterThanOrEqual(2);
        const doors = data.areas.filter((a) => a.access);
        expect(doors.length).toBe(1);
        expect(seen.has(`${doors[0]!.access!.x},${doors[0]!.access!.y}`)).toBe(true);
        let walk = 0;
        for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, y)) walk++;
        expect(walk / (map.width * map.height)).toBeGreaterThan(0.6);
        // 못 닿는 걷는 칸이 없다.
        expect(seen.size).toBe(walk);
      }
    }, SLOW);
    it("남쪽으로 나가는 들판은 바다 없이 남쪽 가장자리까지 길이 난다", () => {
      const { project, map, data } = compose("field", 5, { exits: ["south", "north"] });
      const seen = reach(project, map, data.spawn);
      expect(data.exits!.map((e) => e.side).sort()).toEqual(["north", "south"]);
      for (const exit of data.exits!) {
        expect(exit.side === "south" ? exit.y : exit.y).toBe(exit.side === "south" ? map.height - 1 : 0);
        expect(isRoadGround(project, map, exit.x, exit.y)).toBe(true);
        expect(seen.has(`${exit.x},${exit.y}`)).toBe(true);
      }
      expect(data.exitsMissing).toEqual([]);
    }, SLOW);
  });
  describe("해적 군도 — 나가는 길", () => {
    it("항구: 큰길은 이미 동서 가장자리에 닿아 있고, 북쪽은 골목을 내며, 남쪽(바다)은 못 낸다고 적는다", () => {
      const { project, map, data, summary } = compose("harbor", 2, { exits: ["east", "west", "north", "south"] });
      const seen = reach(project, map, data.spawn);
      expect(data.exits!.map((e) => e.side).sort()).toEqual(["east", "north", "west"]);
      for (const exit of data.exits!) {
        expect(isRoadGround(project, map, exit.x, exit.y), exit.side).toBe(true);
        expect(seen.has(`${exit.x},${exit.y}`), exit.side).toBe(true);
      }
      expect(data.exits!.find((e) => e.side === "north")!.y).toBe(0);
      expect(data.exitsMissing).toEqual(["south"]);
      expect(summary).toContain("길을 못 낸 변 south");
      // 건물 문 앞은 그대로 닿는다.
      for (const area of data.areas.filter((a) => a.access && a.tag !== "lighthouse")) expect(seen.has(`${area.access!.x},${area.access!.y}`), area.tag).toBe(true);
    }, SLOW);
    it("exits 를 주지 않으면 결과에 exits 칸이 없다(예전 호출과 같은 모양)", () => {
      const { data } = compose("harbor", 2);
      expect(data.exits).toBeUndefined();
    }, SLOW);
    it("섬(beach)은 가장자리로 나가는 길이 없다 — 주문한 변을 모두 «못 냈다» 로 돌려준다", () => {
      const { data } = compose("beach", 3, { exits: ["east", "north"] });
      expect(data.exits).toEqual([]);
      expect(data.exitsMissing!.sort()).toEqual(["east", "north"]);
    }, SLOW);
  });
  describe("해적 군도 — 섬의 부두와 가장자리", () => {
    it("섬 마을의 부두와 수상 가옥은 섬에서 걸어 닿고, 섬은 맵 가장자리에 닿지 않는다(48×36 씨앗 8429 — 끊겨 있던 판)", () => {
      const { project, map, data } = compose("beach", 8429, {}, [48, 36]);
      const seen = reach(project, map, data.spawn);
      const pier = data.areas.find((a) => a.tag === "pier")!;
      expect(seen.has(`${pier.x},${pier.y + pier.h - 1}`)).toBe(true);
      const stilts = data.areas.filter((a) => a.tag === "stilt-hut");
      expect(stilts.length).toBe(2);
      for (const hut of stilts) expect(seen.has(`${hut.access!.x},${hut.access!.y}`)).toBe(true);
      expect(edgeCells(map).filter((c) => isPassable(project, map, c.x, c.y))).toEqual([]);
    }, SLOW);
  });
});

// 생성물끼리 구조 유사도(structureSimilarity): 같은 배치·거울 배치는 1, 다른 배치는 우연 수준(카파).
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
describe("structureSimilarity", () => {
  isolateTimers();
  describe("structureSimilarity", () => {
    const n = 8;
    const road = (vertical: boolean) => downsample(Array.from({ length: 64 }, (_, i) => ((vertical ? i % 8 : Math.floor(i / 8)) === 3 ? 1 : 0)), 8, 8, n);

    it("is 1 for the same layout and its mirror", () => {
      const g = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 < 2 ? 2 : i % 8 === 4 ? 1 : 0)), 8, 8, n);
      const mirror = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 > 5 ? 2 : i % 8 === 3 ? 1 : 0)), 8, 8, n);
      expect(structureSimilarity(g, g)).toBe(1);
      expect(structureSimilarity(g, mirror)).toBe(1);
    });

    it("is near chance when the road runs another way", () => {
      expect(structureSimilarity(road(true), road(false))).toBeLessThan(0.2);
    });

    it("does not call two half-floor caves alike just because both are half floor", () => {
      const left = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? 3 : 0)), 8, 8, n);
      const top = downsample(Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) < 4 ? 3 : 0)), 8, 8, n);
      expect(structureSimilarity(left, top)).toBeLessThan(0.2);
    });
  });
});
