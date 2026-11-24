import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { buildForestWrites, type ForestMapView } from "@/editor/regionTask/forestWrites";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { __setRecentInstructionsForTest, clearRecentInstructions, loadRecentInstructions, pushRecentInstruction } from "@/editor/regionTask/recentInstructions";
import { analyzeRegionBlend, describeBlendBreak, describeBlockedEntrance, expandRegion, polishRegionSeams } from "@/editor/regionTask/regionBlend";
import { reviewRegionDraft } from "@/editor/regionTask/harnessReview";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject as createBlankDefaultProject, TILE } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type { Project } from "@/project/types";
import { RETIRED_COMBINED_TOWN_TILESET_ID, startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

// forest 오퍼레이터 프로토타입 불변식 — 예술이 아니라 계약을 고정한다.
describe("forestWrites", () => {
  isolateTimers();
  const TRUNKS = new Set([290, 291, 292, 293]);
  const CANOPIES = new Set([260, 261, 262, 263]);
  /** 1×1 풀 — 키큰 풀 오토타일 조각 + 잔디 변형. 한 칸만 쓰면 네모로 뜬다. */
  const ONE_BY_ONE_GRASS = new Set([
    243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335,
    270, 271, 272, 300, 301, 302, 330,
  ]);
  function grassMap(width: number, height: number): ForestMapView {
    return {
      width,
      height,
      lowerTiles: Array.from({ length: width * height }, () => 240),
      upperTiles: Array.from({ length: width * height }, () => -1),
    };
  }
  const REGION: RegionRect = { x: 2, y: 2, width: 30, height: 20 };
  describe("buildForestWrites", () => {
    it("같은 시드·입력이면 결과가 동일하다(결정성)", () => {
      const map = grassMap(40, 30);
      const a = buildForestWrites(map, REGION, { density: 0.7 }, 42);
      const b = buildForestWrites(map, REGION, { density: 0.7 }, 42);
      expect(a.writes).toEqual(b.writes);
      const c = buildForestWrites(map, REGION, { density: 0.7 }, 43);
      expect(JSON.stringify(c.writes)).not.toEqual(JSON.stringify(a.writes));
    });

    it("모든 write 가 영역 안이다", () => {
      const map = grassMap(40, 30);
      const { writes } = buildForestWrites(map, REGION, {}, 7);
      expect(writes.length).toBeGreaterThan(0);
      for (const w of writes) {
        expect(w.x).toBeGreaterThanOrEqual(REGION.x);
        expect(w.x).toBeLessThan(REGION.x + REGION.width);
        expect(w.y).toBeGreaterThanOrEqual(REGION.y);
        expect(w.y).toBeLessThan(REGION.y + REGION.height);
      }
    });

    it("밑동 lower 마다 바로 위 칸 upper 에 수관이 있다(떠 있는 밑동 금지)", () => {
      const map = grassMap(40, 30);
      const { writes, trees } = buildForestWrites(map, REGION, { density: 0.8 }, 11);
      expect(trees).toBeGreaterThan(10);
      const upperAt = new Map(writes.filter((w) => w.layer === "upper").map((w) => [`${w.x},${w.y}`, w.tile]));
      const trunkWrites = writes.filter((w) => w.layer === "lower" && TRUNKS.has(w.tile));
      expect(trunkWrites.length).toBe(trees);
      for (const t of trunkWrites) {
        const canopy = upperAt.get(`${t.x},${t.y - 1}`);
        expect(canopy !== undefined && CANOPIES.has(canopy)).toBe(true);
      }
      // 수관이 lower 로 새지 않는다.
      for (const w of writes) {
        if (w.layer === "lower") expect(CANOPIES.has(w.tile)).toBe(false);
      }
    });

    it("지면이 아닌 칸(구조물)은 절대 건드리지 않는다", () => {
      const map = grassMap(40, 30);
      const walls = new Set<number>();
      for (let y = 6; y <= 10; y += 1) {
        for (let x = 8; x <= 14; x += 1) {
          (map.lowerTiles as number[])[y * map.width + x] = 306; // WALL
          walls.add(y * map.width + x);
        }
      }
      const { writes } = buildForestWrites(map, REGION, { density: 0.9 }, 3);
      for (const w of writes) {
        expect(walls.has(w.y * map.width + w.x)).toBe(false);
      }
    });

    it("density 가 오르면 나무 수가 는다(울창하게 = 파라미터)", () => {
      const map = grassMap(40, 30);
      const sparse = buildForestWrites(map, REGION, { density: 0.25, path: false, clearings: 0 }, 5).trees;
      const mid = buildForestWrites(map, REGION, { density: 0.55, path: false, clearings: 0 }, 5).trees;
      const dense = buildForestWrites(map, REGION, { density: 0.9, path: false, clearings: 0 }, 5).trees;
      expect(sparse).toBeGreaterThan(0);
      expect(mid).toBeGreaterThan(sparse);
      expect(dense).toBeGreaterThan(mid);
    });

    it("path:true 면 서→동 오솔길이 한 덩어리로 이어진다", () => {
      const map = grassMap(40, 30);
      const { writes } = buildForestWrites(map, REGION, { density: 0.85, path: true }, 9);
      const path = new Set(
        writes.filter((w) => w.layer === "lower" && w.tile === 391).map((w) => `${w.x},${w.y}`),
      );
      expect(path.size).toBeGreaterThanOrEqual(REGION.width);
      // 모든 열에 길이 있다.
      for (let x = REGION.x; x < REGION.x + REGION.width; x += 1) {
        let found = false;
        for (let y = REGION.y; y < REGION.y + REGION.height; y += 1) {
          if (path.has(`${x},${y}`)) { found = true; break; }
        }
        expect(found).toBe(true);
      }
      // 4-연결 단일 성분.
      const start = [...path][0];
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const cur = queue.pop() as string;
        const [cx, cy] = cur.split(",").map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const key = `${cx + dx},${cy + dy}`;
          if (path.has(key) && !seen.has(key)) { seen.add(key); queue.push(key); }
        }
      }
      expect(seen.size).toBe(path.size);
      // 길과 밑동이 같은 칸을 다투지 않는다.
      for (const w of writes) {
        if (w.layer === "lower" && TRUNKS.has(w.tile)) expect(path.has(`${w.x},${w.y}`)).toBe(false);
      }
    });

    it("1×1 풀(키큰 풀·잔디 변형)을 lower 에 쓰지 않는다", () => {
      const map = grassMap(40, 30);
      const { writes } = buildForestWrites(map, REGION, { density: 0.7, groundNoise: true }, 42);
      const grassWrites = writes.filter((write) => write.layer === "lower" && ONE_BY_ONE_GRASS.has(write.tile));
      expect(grassWrites).toEqual([]);
    });
  });
});

describe("recentInstructions", () => {
  isolateTimers();
  // Vitest environment:"node" 는 localStorage 가 없다 — 메모리 스텁으로 대체.
  // globalThis 타입엔 localStorage 가 없어 명명된 참조로 한 번만 단언.
  const g = globalThis as unknown as { localStorage?: Storage };
  const store = new Map<string, string>();
  const stub: Storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  beforeEach(() => {
    store.clear();
    g.localStorage = stub;
  });
  afterEach(() => {
    delete g.localStorage;
  });
  describe("loadRecentInstructions / pushRecentInstruction", () => {
    it("빈 상태에서 빈 배열", () => {
      clearRecentInstructions();
      expect(loadRecentInstructions()).toEqual([]);
    });

    it("push 하면 최신이 맨 앞", () => {
      pushRecentInstruction("침엽수 숲으로 채워줘");
      pushRecentInstruction("둥근 호수를 만들어줘");
      const list = loadRecentInstructions();
      expect(list).toHaveLength(2);
      expect(list[0]).toBe("둥근 호수를 만들어줘");
      expect(list[1]).toBe("침엽수 숲으로 채워줘");
    });

    it("중복 지시어는 맨 앞으로 이동 (개수 유지)", () => {
      pushRecentInstruction("A");
      pushRecentInstruction("B");
      pushRecentInstruction("A"); // 중복
      const list = loadRecentInstructions();
      expect(list).toHaveLength(2);
      expect(list[0]).toBe("A");
      expect(list[1]).toBe("B");
    });

    it("5개 초과시 가장 오래된 것 삭제 (FIFO)", () => {
      for (let i = 1; i <= 6; i += 1) pushRecentInstruction(`지시${i}`);
      const list = loadRecentInstructions();
      expect(list).toHaveLength(5);
      expect(list[0]).toBe("지시6"); // 최신
      expect(list[4]).toBe("지시2"); // 5개째 — 지시1은 삭제
    });

    it("빈 문자열/공백은 무시", () => {
      pushRecentInstruction("   ");
      pushRecentInstruction("");
      expect(loadRecentInstructions()).toEqual([]);
    });

    it("__setRecentInstructionsForTest 로 직접 세팅", () => {
      __setRecentInstructionsForTest(["X", "Y"]);
      expect(loadRecentInstructions()).toEqual(["X", "Y"]);
    });
  });
});

// 이음새 마감 + 어울림 검증 계약.
//
// 이 두 함수가 다듬기의 "결과가 정말 이어졌는가" 를 책임진다. 특히 polishRegionSeams 는
// 영역 **밖 1칸**을 건드리는 유일한 경로라, 재질까지 바꾸지 않는다는 계약이 깨지면
// 하드 스코프(clipMapCellsToRegion)를 우회해 맵을 오염시키는 구멍이 된다.
describe("regionBlend", () => {
  isolateTimers();
  // TILE.* 는 합본 마을 칩 번호다 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵이 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  const MAP_ID = "map_blend";
  const W = 20;
  const REGION: RegionRect = { x: 8, y: 8, width: 4, height: 4 };
  function makeProject(): Project {
    const context = { project: createBlankProject() };
    const created = runTool(context, "create_map", { id: MAP_ID, name: "어울림 테스트", width: W, height: W, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
    expect(created.ok, created.summary).toBe(true);
    context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
    return context.project;
  }
  /** 이 맵의 오토타일 그룹이 관리하는 타일 id 전체 — "재질 집합" 판정의 기준. */
  function autotileMemberIds(project: Project): Set<number> {
    const map = project.maps[MAP_ID];
    const ids = new Set<number>();
    for (const group of autotileGroupsForTileset(project.tilesets[map.tilesetId])) {
      for (const id of group.memberTileIds) ids.add(id);
    }
    return ids;
  }
  function fill(project: Project, rect: RegionRect, tileId: number): void {
    const map = project.maps[MAP_ID];
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) map.lowerTiles[y * W + x] = tileId;
    }
  }
  describe("expandRegion", () => {
    it("margin 만큼 키우고 맵 안으로 자른다", () => {
      expect(expandRegion({ x: 5, y: 5, width: 2, height: 2 }, 2)).toEqual({ x: 3, y: 3, width: 6, height: 6 });
      // 좌상단에 붙으면 음수로 나가지 않고 폭이 줄어든다(오른쪽·아래는 그대로 자란다).
      expect(expandRegion({ x: 0, y: 0, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
        .toEqual({ x: 0, y: 0, width: 4, height: 4 });
      expect(expandRegion({ x: 8, y: 8, width: 2, height: 2 }, 2, { width: 10, height: 10 }))
        .toEqual({ x: 6, y: 6, width: 4, height: 4 });
    });
  });
  describe("polishRegionSeams", () => {
    it("계단식 모래 경계의 변형을 다시 계산하고 재질 집합은 바꾸지 않는다", () => {
      const project = makeProject();
      // 영역 안을 통째로 기본 모래 id 로 칠한다 — 변형이 전부 «가운데» 라 경계가 직각으로 굳는다.
      fill(project, REGION, TILE.SAND);
      const before = project.maps[MAP_ID].lowerTiles.slice();
      const members = autotileMemberIds(project);

      const result = polishRegionSeams(project, MAP_ID, REGION);

      expect(result.polishedCells).toBeGreaterThan(0);
      // 입력은 변형되지 않는다(순수).
      expect(project.maps[MAP_ID].lowerTiles).toEqual(before);
      const after = result.project.maps[MAP_ID].lowerTiles;
      // 바뀐 칸은 모두 오토타일 그룹 멤버 사이의 이동이다 — 잔디가 모래로 뒤바뀌지 않는다.
      for (let index = 0; index < after.length; index += 1) {
        if (after[index] === before[index]) continue;
        expect(members.has(before[index]!)).toBe(true);
        expect(members.has(after[index]!)).toBe(true);
      }
    });

    it("멱등이다 — 승인 시 재검토에서 다시 돌려도 결과가 같다", () => {
      const project = makeProject();
      fill(project, REGION, TILE.SAND);
      const once = polishRegionSeams(project, MAP_ID, REGION);
      const twice = polishRegionSeams(once.project, MAP_ID, REGION);
      expect(twice.project.maps[MAP_ID].lowerTiles).toEqual(once.project.maps[MAP_ID].lowerTiles);
      expect(twice.seamCells).toBe(0);
    });

    it("없는 맵이면 입력을 그대로 돌려준다", () => {
      const project = makeProject();
      const result = polishRegionSeams(project, "map_missing", REGION);
      expect(result.project).toBe(project);
      expect(result.seamCells).toBe(0);
    });

    it("이음새로 바뀐 영역 밖 칸은 확장 스코프에서 region-scope-violation 이 되지 않는다", () => {
      const base = makeProject();
      fill(base, REGION, TILE.SAND);
      // 영역 밖 한 줄도 모래로 — polishMapTerrain 이 8-이웃 링까지 재검사하므로 밖에서도 변형이 바뀐다.
      fill(base, { x: REGION.x, y: REGION.y + REGION.height, width: REGION.width, height: 1 }, TILE.SAND);
      const seamed = polishRegionSeams(base, MAP_ID, REGION);
      expect(seamed.seamCells).toBeGreaterThan(0);

      const scoped = reviewRegionDraft({
        base,
        draft: seamed.project,
        mapId: MAP_ID,
        region: REGION,
        scopeRegion: expandRegion(REGION, 1, base.maps[MAP_ID]),
      });
      expect(scoped.report.issues.filter((issue) => issue.code === "region-scope-violation")).toEqual([]);

      // 같은 초안을 원래 사각형 기준으로 보면 error 로 잡힌다 — 확장 스코프가 실제로 필요했다는 증거.
      const strict = reviewRegionDraft({ base, draft: seamed.project, mapId: MAP_ID, region: REGION });
      expect(strict.report.issues.some((issue) => issue.code === "region-scope-violation")).toBe(true);
    });
  });
  describe("analyzeRegionBlend", () => {
    it("주변과 같은 재질이면 만점이다", () => {
      const project = makeProject();
      const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
      expect(report.totalEdgeCells).toBe(REGION.width * 2 + REGION.height * 2);
      expect(report.matchedEdgeCells).toBe(report.totalEdgeCells);
      expect(report.score).toBe(100);
      expect(report.brokenCrossings).toEqual([]);
    });

    it("바깥 길이 영역 안에서 끊기면 brokenCrossings 로 좌표를 남긴다", () => {
      const project = makeProject();
      // 영역 위쪽 바로 밖 한 줄을 길로 — 영역 안은 잔디라 길이 끊긴다.
      fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);

      const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
      expect(report.brokenCrossings).toHaveLength(REGION.width);
      for (const crossing of report.brokenCrossings) {
        expect(crossing.kind).toBe("road");
        expect(crossing.y).toBe(REGION.y);
      }
      expect(report.score).toBeLessThan(100);
      expect(describeBlendBreak(report.brokenCrossings[0])).toContain(`(${REGION.x},${REGION.y})`);
    });

    it("길을 영역 안까지 이으면 끊김이 사라진다", () => {
      const project = makeProject();
      fill(project, { x: REGION.x, y: REGION.y - 1, width: REGION.width, height: 1 }, TILE.PATH);
      fill(project, REGION, TILE.PATH);
      const report = analyzeRegionBlend({ project, mapId: MAP_ID, region: REGION });
      expect(report.brokenCrossings).toEqual([]);
    });

    it("원래부터 벽이던 경계는 newlyBlockedEntrances 에 들어가지 않는다", () => {
      const base = makeProject();
      // 영역 첫 줄을 벽으로 — base 에서도 막혀 있다.
      fill(base, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);
      const report = analyzeRegionBlend({ project: base, mapId: MAP_ID, region: REGION, base });
      expect(report.newlyBlockedEntrances).toEqual([]);
    });

    it("걸어 들어오던 칸을 이 초안이 막으면 새로 막힌 진입으로 센다", () => {
      const base = makeProject();
      const draft: Project = structuredClone(base);
      fill(draft, { x: REGION.x, y: REGION.y, width: REGION.width, height: 1 }, TILE.WALL);

      const report = analyzeRegionBlend({ project: draft, mapId: MAP_ID, region: REGION, base });
      // 북쪽 변 4칸 + 서/동 변의 첫 줄 2칸이 벽이 된다.
      expect(report.newlyBlockedEntrances.length).toBeGreaterThanOrEqual(REGION.width);
      for (const point of report.newlyBlockedEntrances) expect(point.y).toBe(REGION.y);
      expect(describeBlockedEntrance(report.newlyBlockedEntrances[0])).toContain("새로 막혔습니다");
    });

    it("없는 맵이면 0점 빈 리포트", () => {
      const report = analyzeRegionBlend({ project: makeProject(), mapId: "map_missing", region: REGION });
      expect(report).toEqual({
        score: 0,
        matchedEdgeCells: 0,
        totalEdgeCells: 0,
        brokenCrossings: [],
        newlyBlockedEntrances: [],
      });
    });
  });
});
