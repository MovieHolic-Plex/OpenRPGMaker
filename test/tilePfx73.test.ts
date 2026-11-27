import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext } from "@/editor/tools";
import { setTileLayerOverride, markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { isPassable, canMove } from "@/project/collision";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { blockedFlag, passableFlag, setPassageMark } from "@/project/tilesetPassage";
import { confirmUserTileMetadata } from "@/project/tilesetPalette";
import { completedHouseProject, houseMap, HOUSE_RECT } from "./fixtures/completedHouse";
import { withRetiredEasyRpgTilesets, RETIRED_COMBINED_TOWN_TILESET_ID } from "./support/retiredEasyRpgTilesets";
import { findChasePath, nearestReachableCandidate, type ChasePoint } from "@/player/chaseAi";
import { createBlankMap } from "@/project/defaults";
import { armTerrainComponents, invalidateTilePassabilityComponents, terrainMayReach } from "@/project/tilePassabilityComponents";
import type { GameMap, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("tileEraseGround", () => {
  isolateTimers();
  const MAP_ID = "erase_ground";
  const RECT = { x: 1, y: 1, w: 10, h: 8 };
  // 이 파일의 칸 번호(벽 306·13, 풀 240, 바닥 222, 상자 237, 지붕 385 …)와 재료 이름(「목골 석벽 집 벽 확장」·「나무 상자」)은 합본 마을 칩셋의 것이다.
  // 기본 칩셋이 버들항(beodeul_city)으로 바뀌고(2026-09-30) 합본 마을·실내 시트가 번들에서 빠진 뒤(2026-10-07) create_map 은 버들항 맵을 만들어
  // 240 은 벽, 풀은 737 이 됐고 열여섯 경우가 공개 기준선(0d4f13e7c)부터 떨어졌다. 옛 저장본처럼 그 타일셋 정의를 든 프로젝트에서 합본 마을 맵을 만든다
  // — 편집기는 그런 저장본을 계속 읽고, tile_erase 의 «관찰된 바닥» 규칙은 칩셋과 무관하게 같아야 한다.
  function context(): ToolContext {
    const ctx = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
    const created = runTool(ctx, "create_map", {
      id: MAP_ID, name: "Erase ground fixture", width: 12, height: 10, border: "wall", bgm: { mode: "none" }, tilesetId: COMBINED_TOWN_TILESET_ID,
    });
    expect(created.ok, JSON.stringify(created.issues)).toBe(true);
    expect(ctx.project.maps[MAP_ID].tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
    return ctx;
  }
  describe("tile_erase compatible observed ground", () => {
    it("create_map's wall306 border cannot replace its 80 grass interior cells", () => {
      const ctx = context();
      const before = structuredClone(ctx.project.maps[MAP_ID]);
      expect(before.lowerTiles.filter(tile => tile === 306)).toHaveLength(40);
      expect(before.lowerTiles.filter(tile => tile === 240)).toHaveLength(80);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ groundTile: 240, cleared: 80, requested: 80, skipped: 0 });
      expect(ctx.project.maps[MAP_ID]).toEqual(before);
      for (let y = 1; y < 9; y += 1) {
        for (let x = 1; x < 11; x += 1) expect(isPassable(ctx.project, ctx.project.maps[MAP_ID], x, y)).toBe(true);
      }
    });

    it.each([RECT, { x: 0, y: 0, w: 12, h: 10 }])("captured wall distribution cannot restore wall13 (%j)", (rect) => {
      const ctx = context();
      const wall = runTool(ctx, "build_wall", {
        mapId: MAP_ID, rect: { x: 0, y: 0, w: 12, h: 10 }, material: "목골 석벽 집 벽 확장",
      });
      expect(wall.ok, JSON.stringify(wall.issues)).toBe(true);
      const counts = new Map<number, number>();
      for (const tile of ctx.project.maps[MAP_ID].lowerTiles) counts.set(tile, (counts.get(tile) ?? 0) + 1);
      expect(Object.fromEntries(counts)).toEqual({ 12: 1, 13: 10, 14: 1, 42: 8, 43: 80, 44: 8, 72: 1, 73: 10, 74: 1 });
      const before = structuredClone(ctx.project);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]).toMatchObject({ code: "erase-ground-unresolved", mapId: MAP_ID });
      expect(ctx.project).toEqual(before);
    });

    it.each([
      { tilesetId: COMBINED_TOWN_TILESET_ID, floor: 222, crate: 237 },
      { tilesetId: COMBINED_TOWN_TILESET_ID, floor: 240, crate: 237 },
      { tilesetId: "easyrpg_chipset_interior", floor: 72, crate: 295 },
    ])("preserves $tilesetId floor$floor after real 2/2 crate placement", ({ tilesetId, floor, crate }) => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.tilesetId = tilesetId;
      map.lowerTiles.fill(floor);
      const tilesetsBefore = structuredClone(ctx.project.tilesets);
      const placed = runTool(ctx, "place_props", { mapId: MAP_ID, area: RECT, material: "나무 상자", count: 2, seed: 7 });
      expect(placed.ok, JSON.stringify(placed.issues)).toBe(true);
      expect(ctx.project.maps[MAP_ID].upperTiles.filter(tile => tile === crate)).toHaveLength(2);
      const erased = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
      expect(erased.ok, JSON.stringify(erased.issues)).toBe(true);
      expect(erased.data).toMatchObject({ groundTile: floor, cleared: 80 });
      expect(ctx.project.maps[MAP_ID].lowerTiles).toEqual(Array(120).fill(floor));
      expect(ctx.project.maps[MAP_ID].upperTiles).toEqual(Array(120).fill(TILE.EMPTY));
      expect(ctx.project.tilesets).toEqual(tilesetsBefore);
    });

    it.each([
      { name: "roof even with corrupted open/lower runtime", tile: 385, open: true, authored: false },
      { name: "prop even with authored open/lower rules", tile: 237, open: true, authored: true },
      { name: "wall even with authored open/lower rules", tile: 13, open: true, authored: true },
      { name: "blocked floor", tile: 222, open: false, authored: false },
      { name: "water even with authored open/lower rules", tile: TILE.WATER, open: true, authored: true },
    ])("excludes $name in favor of observed ground", ({ tile, open, authored }) => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      const tileset = ctx.project.tilesets[map.tilesetId];
      map.lowerTiles.fill(tile);
      map.lowerTiles[13] = 240;
      tileset.passability[tile] = open ? passableFlag() : blockedFlag();
      tileset.priority[tile] = "lower";
      if (authored) {
        setTileLayerOverride(tileset, tile, "lower");
        setPassageMark(tileset, tile, "o");
        markUserTileRuntimeMetadata(tileset, tile, { passage: "passable" });
      }
      const before = structuredClone(tileset);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ groundTile: 240 });
      for (let y = 1; y < 9; y += 1) {
        for (let x = 1; x < 11; x += 1) expect(ctx.project.maps[MAP_ID].lowerTiles[y * 12 + x]).toBe(240);
      }
      expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
    });

    it.each(["both", "lower"])("no observed ground fails before mutating the real module draft (%s)", (layer) => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      map.lowerTiles.fill(TILE.EMPTY);
      map.upperTiles.fill(237);
      const before = structuredClone(ctx.project);
      const args = { mapId: MAP_ID, rect: RECT, layer };
      expect(() => getTool("tile_erase")!.run(ctx.project, args)).toThrow(expect.objectContaining({ code: "erase-ground-unresolved" }));
      expect(ctx.project).toEqual(before);
      const original = ctx.project;
      const result = runTool(ctx, "tile_erase", args);
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("erase-ground-unresolved");
      expect(ctx.project).toBe(original);
      expect(ctx.project).toEqual(before);
    });

    it("upper-only erase does not require ground and preserves lower cells", () => {
      const ctx = context();
      ctx.project.maps[MAP_ID].lowerTiles.fill(13);
      ctx.project.maps[MAP_ID].upperTiles.fill(237);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: { x: 0, y: 0, w: 12, h: 10 }, layer: "upper" });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ cleared: 120 });
      expect(ctx.project.maps[MAP_ID].lowerTiles).toEqual(Array(120).fill(13));
      expect(ctx.project.maps[MAP_ID].upperTiles).toEqual(Array(120).fill(TILE.EMPTY));
    });

    it.each(["upper", "solid", "role"])("preserves authored %s exclusion of an otherwise valid floor", (rule) => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      const tileset = ctx.project.tilesets[map.tilesetId];
      map.lowerTiles.fill(222);
      map.lowerTiles[13] = 240;
      if (rule === "upper") setTileLayerOverride(tileset, 222, "upper");
      if (rule === "solid") {
        setPassageMark(tileset, 222, "x");
        markUserTileRuntimeMetadata(tileset, 222, { passage: "solid" });
      }
      if (rule === "role") tileset.tileMeta![222] = confirmUserTileMetadata(tileset.tileMeta![222], { role: "prop" });
      const before = structuredClone(tileset);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ groundTile: 240 });
      expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
    });

    it("honors an explicitly authored ground role and lower/passable override without rewriting its group", () => {
      const ctx = context();
      const map = ctx.project.maps[MAP_ID];
      const tileset = ctx.project.tilesets[map.tilesetId];
      map.lowerTiles.fill(13);
      tileset.tileMeta![13] = confirmUserTileMetadata(tileset.tileMeta![13], { role: "ground", passage: "passable" });
      setTileLayerOverride(tileset, 13, "lower");
      setPassageMark(tileset, 13, "o");
      const before = structuredClone(tileset);
      const result = runTool(ctx, "tile_erase", { mapId: MAP_ID, rect: RECT });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(result.data).toMatchObject({ groundTile: 13 });
      expect(ctx.project.tilesets[map.tilesetId]).toEqual(before);
    });

    it.each(["both", "lower", "upper"])("retains recorded house ownership atomically (%s)", (layer) => {
      // 집 픽스처의 바닥(TILE.GRASS 240)도 합본 마을 번호다 — 버들항 맵에서는 240 이 벽이라 «복원할 바닥 없음» 이 집 보호보다 먼저 나왔다.
      const project = withRetiredEasyRpgTilesets(completedHouseProject());
      houseMap(project).tilesetId = COMBINED_TOWN_TILESET_ID;
      const ctx = { project };
      const before = structuredClone(ctx.project);
      const result = runTool(ctx, "tile_erase", { mapId: ctx.project.startMapId, rect: HOUSE_RECT, layer });
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("protected-house-write");
      expect(ctx.project).toEqual(before);
    });
  });
});

// 통행 성분 색인이 **답을 바꾸지 않는다**는 증거.
//
// 이 최적화의 위험은 하나다: 낡은 색인이 "도달 불가" 라고 우겨서 벽이 열렸는데도 추격을
// 포기하는 것. 그래서 (1) 색인이 기대는 canMove 대칭 정리를 직접 확인하고,
// (2) 색인 있음/없음의 결과를 무작위 맵으로 대조하고, (3) 제자리 타일 수정 뒤에 색인이
// 스스로 낡음을 알아채는지 본다.
describe("tilePassabilityComponents", () => {
  isolateTimers();
  const SIZE = 14;
  function blankMap(id: string, size = SIZE): GameMap {
    const map = createBlankMap("성분 테스트", size, size);
    map.id = id;
    // TILE.GRASS / TILE.WATER are combined-town chip numbers; since the 2026-10-07 purge the default sheet is beodeul_city,
    // where those numbers mean other (passable) chips. Pin the map to the retired combined-town sheet they were written for.
    map.tilesetId = RETIRED_COMBINED_TOWN_TILESET_ID;
    map.lowerTiles = new Array(size * size).fill(TILE.GRASS);
    map.upperTiles = new Array(size * size).fill(-1);
    return map;
  }
  function projectWith(map: GameMap): Project {
    const project = withRetiredEasyRpgTilesets(createBlankProject(), { interiorHarness: false });
    const tileset = project.tilesets[map.tilesetId];
    if (tileset) map.tileSize = tileset.tileSize;
    project.maps = { [map.id]: map };
    project.mapTree = { mapId: map.id, children: [] };
    project.startMapId = map.id;
    project.startPos = { x: 0, y: 0 };
    return project;
  }
  /** 결정적 PRNG — 실패를 재현할 수 있어야 한다. */
  function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 색인을 전혀 쓰지 않는 참조 도달 판정 — 너비 우선 1회. */
  function referenceReachable(project: Project, map: GameMap, from: ChasePoint, to: ChasePoint): boolean {
    if (from.x === to.x && from.y === to.y) return true;
    const width = map.width;
    const seen = new Set<number>([from.y * width + from.x]);
    let frontier: ChasePoint[] = [from];
    while (frontier.length > 0) {
      const next: ChasePoint[] = [];
      for (const point of frontier) {
        for (const delta of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
          const nx = point.x + delta.x;
          const ny = point.y + delta.y;
          if (nx < 0 || ny < 0 || nx >= width || ny >= map.height) continue;
          const key = ny * width + nx;
          if (seen.has(key)) continue;
          if (!canMove(project, map, point.x, point.y, nx, ny)) continue;
          if (nx === to.x && ny === to.y) return true;
          seen.add(key);
          next.push({ x: nx, y: ny });
        }
      }
      frontier = next;
    }
    return false;
  }
  describe("canMove 대칭 — 성분 색인이 기대는 정리", () => {
    it("인접한 모든 칸 쌍에서 canMove(a,b) 와 canMove(b,a) 가 같다", () => {
      const map = blankMap("map_symmetry");
      const project = projectWith(map);
      // 통행 성질이 섞이도록 물·길·풀을 무작위로 깐다.
      const random = mulberry32(20260830);
      const palette = [TILE.GRASS, TILE.WATER, TILE.PATH];
      for (let index = 0; index < map.lowerTiles.length; index += 1) {
        map.lowerTiles[index] = palette[Math.floor(random() * palette.length)] as number;
      }
      let checked = 0;
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          for (const delta of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
            const nx = x + delta.x;
            const ny = y + delta.y;
            if (nx >= map.width || ny >= map.height) continue;
            checked += 1;
            expect(
              canMove(project, map, x, y, nx, ny),
              `(${x},${y}) ↔ (${nx},${ny}) 의 통행이 방향에 따라 다르다 — 성분 색인 전제가 깨진다`
            ).toBe(canMove(project, map, nx, ny, x, y));
          }
        }
      }
      expect(checked).toBeGreaterThan(300);
    });
  });
  // Heavy under CI load (15s default is too tight): compares many random maps with and without the index.
  describe("색인이 있어도 결과가 같다 (무작위 맵 대조)", { timeout: 120_000 }, () => {
    it("findChasePath 는 색인 없음/있음에서 같은 경로를 낸다", () => {
      const random = mulberry32(7);
      for (let round = 0; round < 24; round += 1) {
        const map = blankMap(`map_diff_${round}`);
        const project = projectWith(map);
        // 벽 밀도를 올려가며 성분이 여러 개로 갈리게 한다.
        const wallRatio = 0.1 + (round % 6) * 0.09;
        for (let index = 0; index < map.lowerTiles.length; index += 1) {
          if (random() < wallRatio) map.lowerTiles[index] = TILE.WATER;
        }
        const from = { x: 1, y: 1 };
        const to = { x: SIZE - 2, y: SIZE - 2 };
        map.lowerTiles[from.y * SIZE + from.x] = TILE.GRASS;
        map.lowerTiles[to.y * SIZE + to.x] = TILE.GRASS;

        invalidateTilePassabilityComponents(map);
        const cold = findChasePath(project, map, from, to);
        armTerrainComponents(project, map);
        const warm = findChasePath(project, map, from, to);

        expect(warm, `round ${round}: 색인이 경로를 바꿨다`).toEqual(cold);
        // 참조 BFS 와도 도달 여부가 맞아야 한다.
        expect(cold.length > 0, `round ${round}: 도달 여부가 참조 BFS 와 다르다`)
          .toBe(referenceReachable(project, map, from, to));
      }
    });

    // accept 필터를 **거는** 경로가 실제 호출부(npcSchedules 의 nearestReachableEdge)다.
    // 필터 없는 대조만 하면, 색인이 후보를 미리 빼는 순서 변화가 accept 와 얽혔을 때를 놓친다.
    it("accept 필터를 걸어도 색인 없음/있음에서 같은 후보를 낸다", () => {
      const random = mulberry32(31337);
      for (let round = 0; round < 24; round += 1) {
        const map = blankMap(`map_accept_${round}`);
        const project = projectWith(map);
        const wallRatio = 0.05 + (round % 8) * 0.07;
        for (let index = 0; index < map.lowerTiles.length; index += 1) {
          if (random() < wallRatio) map.lowerTiles[index] = TILE.WATER;
        }
        const from = { x: 1, y: 1 };
        map.lowerTiles[from.y * SIZE + from.x] = TILE.GRASS;
        // 경계 한 바퀴 — nearestReachableEdge 와 같은 후보 모양.
        const candidates: ChasePoint[] = [];
        for (let x = 0; x < SIZE; x += 1) candidates.push({ x, y: 0 }, { x, y: SIZE - 1 });
        for (let y = 1; y < SIZE - 1; y += 1) candidates.push({ x: 0, y }, { x: SIZE - 1, y });
        // 후보를 절반쯤 떨어뜨리는 결정적 필터. 낙관 통과가 accept 와 얽히면 여기서 갈린다.
        const accept = (point: ChasePoint): boolean => (point.x + point.y) % 3 !== 0;

        invalidateTilePassabilityComponents(map);
        const cold = nearestReachableCandidate(project, map, from, candidates, accept);
        armTerrainComponents(project, map);
        const warm = nearestReachableCandidate(project, map, from, candidates, accept);

        expect(warm, `round ${round}: 색인이 accept 후보 선택을 바꿨다`).toEqual(cold);
        if (cold) {
          expect(accept(cold), `round ${round}: accept 가 거부한 후보를 골랐다`).toBe(true);
          expect(
            referenceReachable(project, map, from, cold),
            `round ${round}: 도달 불가한 후보를 골랐다`
          ).toBe(true);
        }
      }
    });

    it("nearestReachableCandidate 는 색인 없음/있음에서 같은 후보를 낸다", () => {
      const random = mulberry32(99);
      for (let round = 0; round < 24; round += 1) {
        const map = blankMap(`map_cand_${round}`);
        const project = projectWith(map);
        const wallRatio = 0.08 + (round % 7) * 0.08;
        for (let index = 0; index < map.lowerTiles.length; index += 1) {
          if (random() < wallRatio) map.lowerTiles[index] = TILE.WATER;
        }
        const from = { x: 1, y: 1 };
        map.lowerTiles[from.y * SIZE + from.x] = TILE.GRASS;
        const candidates: ChasePoint[] = [];
        for (let y = 0; y < SIZE; y += 1) candidates.push({ x: SIZE - 1, y });
        for (let x = 0; x < SIZE; x += 1) candidates.push({ x, y: SIZE - 1 });

        invalidateTilePassabilityComponents(map);
        const cold = nearestReachableCandidate(project, map, from, candidates);
        armTerrainComponents(project, map);
        const warm = nearestReachableCandidate(project, map, from, candidates);

        expect(warm, `round ${round}: 색인이 후보 선택을 바꿨다`).toEqual(cold);
      }
    });
  });
  describe("낡은 색인은 스스로 들킨다", () => {
    it("벽을 제자리에서 열면 추격이 다시 경로를 찾는다", () => {
      const map = blankMap("map_wall_open");
      const project = projectWith(map);
      const wallX = 7;
      for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + wallX] = TILE.WATER;
      const from = { x: 2, y: 2 };
      const to = { x: SIZE - 2, y: 2 };

      // 첫 탐색이 실패하면서 색인이 만들어진다.
      expect(findChasePath(project, map, from, to)).toEqual([]);
      expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);

      // applyMapOverrides 와 같은 방식으로 **제자리** 수정 — 배열 identity 는 그대로다.
      const doorIndex = 2 * SIZE + wallX;
      const sameArray = map.lowerTiles;
      map.lowerTiles[doorIndex] = TILE.GRASS;
      expect(map.lowerTiles).toBe(sameArray);

      // 지문이 어긋나므로 색인은 다시 만들어지고 문을 통과하는 경로가 나와야 한다.
      expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(true);
      const path = findChasePath(project, map, from, to);
      expect(path.length, "벽이 열렸는데 추격이 경로를 못 찾았다 — 색인이 낡은 답을 우겼다")
        .toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual(to);
    });

    it("벽을 제자리에서 막으면 도달 불가로 바뀐다", () => {
      const map = blankMap("map_wall_close");
      const project = projectWith(map);
      const from = { x: 2, y: 2 };
      const to = { x: SIZE - 2, y: 2 };
      // 열린 맵에서 한 번 성공시켜 두고, 실패를 유도해 색인을 만든다.
      expect(findChasePath(project, map, from, to).length).toBeGreaterThan(0);
      const wallX = 7;
      for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + wallX] = TILE.WATER;
      expect(findChasePath(project, map, from, to)).toEqual([]);
      // 색인이 생긴 뒤에도 같은 답이어야 한다.
      expect(findChasePath(project, map, from, to)).toEqual([]);
      expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);
    });

    it("invalidateTilePassabilityComponents 는 색인을 버려 낙관 판정으로 되돌린다", () => {
      const map = blankMap("map_invalidate");
      const project = projectWith(map);
      for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
      const from = { x: 2, y: 2 };
      const to = { x: SIZE - 2, y: 2 };
      armTerrainComponents(project, map);
      expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(false);
      invalidateTilePassabilityComponents(map);
      // 색인이 없으면 판정을 건너뛴다(낙관) — 결과는 A* 가 낸다.
      expect(terrainMayReach(project, map, from.x, from.y, to.x, to.y)).toBe(true);
      expect(findChasePath(project, map, from, to)).toEqual([]);
    });
  });
  describe("색인을 쓰지 않는 경로", () => {
    it("색인이 없으면 첫 질의는 판정을 건너뛴다", () => {
      const map = blankMap("map_cold");
      const project = projectWith(map);
      for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
      expect(terrainMayReach(project, map, 2, 2, SIZE - 2, 2)).toBe(true);
    });

    it("발자국 이동은 색인을 만들지도 쓰지도 않는다", () => {
      const map = blankMap("map_footprint");
      const project = projectWith(map);
      for (let y = 0; y < SIZE; y += 1) map.lowerTiles[y * SIZE + 7] = TILE.WATER;
      const from = { x: 2, y: 2 };
      const to = { x: SIZE - 2, y: 2 };
      const pass = { footprint: { width: 3, height: 3 }, passRows: 1 } as const;

      // 통행 사각이 비대칭이라 성분 전제가 성립하지 않는다 — 색인을 남기면 안 된다.
      expect(findChasePath(project, map, from, to, pass)).toEqual([]);
      expect(
        terrainMayReach(project, map, from.x, from.y, to.x, to.y),
        "발자국 탐색이 색인을 만들었다 — 대칭 전제가 없는 그래프의 답이 섞인다"
      ).toBe(true);
    });
  });
});
