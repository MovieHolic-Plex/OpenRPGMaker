import { describe, expect, it } from "vitest";
import { computeChangeSites } from "@/project/changeSites";
import type { GameEvent, GameMap, Project } from "@/project/types";

function makeMap(id: string, name: string, width: number, height: number): GameMap {
  return {
    id, name, width, height, tilesetId: "ts", tileSize: 16,
    lowerTiles: new Array(width * height).fill(0),
    upperTiles: new Array(width * height).fill(0),
    events: [],
  } as unknown as GameMap;
}

function project(maps: Record<string, GameMap>): Project {
  return { maps } as unknown as Project;
}

function withTile(map: GameMap, x: number, y: number, tile: number): GameMap {
  const lowerTiles = [...map.lowerTiles];
  lowerTiles[y * map.width + x] = tile;
  return { ...map, lowerTiles };
}

function withEvents(map: GameMap, events: readonly { id: string; x: number; y: number }[]): GameMap {
  return { ...map, events: events.map((e) => ({ id: e.id, x: e.x, y: e.y, pages: [] }) as unknown as GameEvent) };
}

describe("computeChangeSites", () => {
  it("멀리 떨어진 두 군집은 두 지점, 가까운 변경은 한 지점으로 뭉친다", () => {
    const base = makeMap("m", "시장 마을", 40, 30);
    let next = withTile(base, 5, 5, 9);
    next = withTile(next, 6, 5, 9);
    next = withTile(next, 8, 6, 9); // (6,5) 와 거리 2 — gap 4 안, 같은 지점
    next = withTile(next, 30, 25, 9); // 멀다 — 다른 지점
    const sites = computeChangeSites(project({ m: base }), project({ m: next }));
    expect(sites.length).toBe(2);
    expect(sites[0]!.placeLabel).toBe("(2,2) 10×8"); // (5,5)-(8,6) bbox + pad 3
    expect(sites[0]!.tilesChanged).toBe(3);
    expect(sites[0]!.kind).toBe("tiles");
    expect(sites[1]!.region.x).toBe(27);
    expect(sites[1]!.tilesChanged).toBe(1);
    // 위→아래 정렬
    expect(sites[0]!.region.y).toBeLessThan(sites[1]!.region.y);
  });

  it("이벤트 이동은 출발지와 도착지를 함께 덮고, 추가·삭제·이동을 따로 센다", () => {
    const base = withEvents(makeMap("m", "숲", 40, 30), [
      { id: "npc", x: 10, y: 10 },
      { id: "gone", x: 12, y: 10 },
    ]);
    const next = withEvents(makeMap("m", "숲", 40, 30), [
      { id: "npc", x: 14, y: 10 }, // 이동
      { id: "new", x: 11, y: 11 }, // 추가
    ]);
    const sites = computeChangeSites(project({ m: base }), project({ m: next }));
    expect(sites.length).toBe(1);
    const site = sites[0]!;
    expect(site.kind).toBe("events");
    expect([site.eventsAdded, site.eventsRemoved, site.eventsMoved]).toEqual([1, 1, 1]);
    // 출발지 (10,10) 와 도착지 (14,10) 둘 다 영역 안
    expect(site.region.x).toBeLessThanOrEqual(10 - 3);
    expect(site.region.x + site.region.width).toBeGreaterThan(14);
    expect(site.statsLabel).toBe("이벤트 +1 · 이벤트 −1 · 이벤트 이동 1");
  });

  it("타일과 이벤트가 섞이면 mixed, 지점 없는 맵은 지점을 내지 않는다", () => {
    const base = withEvents(makeMap("a", "마을", 20, 20), []);
    let next = withTile(base, 3, 3, 7);
    next = withEvents(next, [{ id: "e", x: 4, y: 4 }]);
    const untouched = makeMap("b", "그대로", 10, 10);
    const sites = computeChangeSites(project({ a: base, b: untouched }), project({ a: next, b: untouched }));
    expect(sites.length).toBe(1);
    expect(sites[0]!.kind).toBe("mixed");
    expect(sites[0]!.mapName).toBe("마을");
  });

  it("맵 추가·삭제·크기 변경은 전체 맵 지점 하나로 선다", () => {
    const stays = makeMap("stay", "본토", 10, 10);
    const resizedBefore = makeMap("rs", "확장", 10, 10);
    const resizedAfter = makeMap("rs", "확장", 20, 10);
    const added = makeMap("new", "신도시", 8, 8);
    const removed = makeMap("old", "폐허", 6, 6);
    const sites = computeChangeSites(
      project({ stay: stays, rs: resizedBefore, old: removed }),
      project({ stay: stays, rs: resizedAfter, new: added }),
    );
    expect(sites.map((s) => [s.mapId, s.kind])).toEqual([
      ["rs", "map-resized"],
      ["new", "map-added"],
      ["old", "map-removed"],
    ]);
    expect(sites[0]!.statsLabel).toBe("크기 10×10 → 20×10");
    expect(sites[1]!.region).toEqual({ x: 0, y: 0, width: 8, height: 8 });
  });

  it("지점이 상한을 넘으면 gap 을 키워 더 굵게 뭉친다 — 지점을 자르지 않는다", () => {
    const base = makeMap("m", "넓은 맵", 100, 10);
    let next = base;
    const columns = [0, 12, 24, 36, 48, 60, 72, 84, 96]; // 서로 거리 12 — gap 4 로는 9 지점
    for (const x of columns) next = withTile(next, x, 5, 9);
    const sites = computeChangeSites(project({ m: base }), project({ m: next }), { maxSites: 4 });
    expect(sites.length).toBeLessThanOrEqual(4);
    const totalTiles = sites.reduce((acc, s) => acc + s.tilesChanged, 0);
    expect(totalTiles).toBe(columns.length);
  });

  it("변경이 없으면 빈 목록", () => {
    const map = makeMap("m", "정지", 10, 10);
    expect(computeChangeSites(project({ m: map }), project({ m: map }))).toEqual([]);
  });
});
