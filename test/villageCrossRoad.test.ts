import { describe, expect, it } from "vitest";
import { villageArteryRoutes, villageRoadAnchors } from "@/editor/tools/village/roads";
import type { Plaza, Point, Rect } from "@/editor/tools/village/constants";

const AREA: Rect = { x: 0, y: 0, w: 50, h: 50 };
const PLAZA: Plaza = { rect: { x: 21, y: 22, w: 8, h: 6 }, centerRow: 25, centerX: 25 };

function touchesPlaza(point: Point): boolean {
  const plaza = PLAZA.rect;
  const onNorthSouth = (point.y === plaza.y || point.y === plaza.y + plaza.h - 1)
    && point.x >= plaza.x && point.x < plaza.x + plaza.w;
  const onWestEast = (point.x === plaza.x || point.x === plaza.x + plaza.w - 1)
    && point.y >= plaza.y && point.y < plaza.y + plaza.h;
  return onNorthSouth || onWestEast;
}

describe("village cross-road fix", () => {
  it("4개 출구 앵커는 4변에 그대로 있다", () => {
    for (const seed of [1, 7, 42, 100]) {
      const [north, south, west, east] = villageRoadAnchors(AREA, PLAZA, seed);
      expect(north?.y).toBe(AREA.y);
      expect(south?.y).toBe(AREA.y + AREA.h - 1);
      expect(west?.x).toBe(AREA.x);
      expect(east?.x).toBe(AREA.x + AREA.w - 1);
    }
  });

  it("N/S 앵커가 시드마다 흩어진다 — 항상 중심 x에 붙지 않는다", () => {
    const xs = [1, 7, 42, 100, 5, 9, 13].map(
      (seed) => villageRoadAnchors(AREA, PLAZA, seed)[0]?.x ?? -1,
    );
    expect(new Set(xs).size).toBeGreaterThan(1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(4);
  });

  it("4갈래 중 1갈래는 인접 축 간선에 T자로 붙는다 — 정반대 축이 아니다", () => {
    for (const seed of [0, 1, 2, 3, 7, 42, 100]) {
      const routes = villageArteryRoutes(AREA, PLAZA, seed, 0.5);
      expect(routes).toHaveLength(4);
      const ends = routes.map((route) => route[route.length - 1]!);
      expect(ends.filter(touchesPlaza)).toHaveLength(3);
      const branchIndex = ((seed % 4) + 4) % 4;
      const hostIndex = (branchIndex + 2) % 4;
      const branchedEnd = ends[branchIndex]!;
      expect(touchesPlaza(branchedEnd)).toBe(false);
      const hostMid = routes[hostIndex]![1]!;
      expect(branchedEnd.x).toBe(hostMid.x);
      expect(branchedEnd.y).toBe(hostMid.y);
      const branchIsNorthSouth = branchIndex <= 1;
      const hostIsNorthSouth = hostIndex <= 1;
      expect(branchIsNorthSouth).not.toBe(hostIsNorthSouth);
    }
  });

  it("분기 갈래는 시드 0~3에서 4가지 패턴을 전부 돈다", () => {
    const patterns = [0, 1, 2, 3].map((seed) => {
      const routes = villageArteryRoutes(AREA, PLAZA, seed, 0.5);
      return routes.map((route) => String(touchesPlaza(route[route.length - 1]!))).join("");
    });
    expect(new Set(patterns).size).toBe(4);
  });

  it("흔들린 경유점은 맵 안에 머문다", () => {
    for (const seed of [0, 1, 2, 3, 7, 42, 100]) {
      const routes = villageArteryRoutes(AREA, PLAZA, seed, 0.5);
      for (const route of routes) {
        for (const point of route.slice(1, -1)) {
          expect(point.x).toBeGreaterThanOrEqual(AREA.x + 1);
          expect(point.x).toBeLessThanOrEqual(AREA.x + AREA.w - 2);
          expect(point.y).toBeGreaterThanOrEqual(AREA.y + 1);
          expect(point.y).toBeLessThanOrEqual(AREA.y + AREA.h - 2);
        }
      }
    }
  });

  it("직선이 굳지 않는다 — 간선은 내부에서 꺾인다", () => {
    // Given: 분기 갈래가 다른 시드들
    // When: 간선 폴리라인을 뽑는다
    for (const seed of [0, 1, 2, 3, 7, 42]) {
      const routes = villageArteryRoutes(AREA, PLAZA, seed, 0.5);
      const branchIndex = ((seed % 4) + 4) % 4;
      // Then: 비분기는 5점, 분기는 4점 이상. 내부 세 점은 한 직선에 있지 않다
      for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index]!;
        expect(route.length).toBeGreaterThanOrEqual(index === branchIndex ? 4 : 5);
        const interior = route.slice(1, -1);
        if (interior.length < 3) continue;
        const [a, b, c] = interior;
        const cross = (b!.x - a!.x) * (c!.y - b!.y) - (b!.y - a!.y) * (c!.x - b!.x);
        expect(cross, `seed=${seed} route=${index}`).not.toBe(0);
      }
    }
  });

  it("재시도 지터가 바뀌어도 앵커·분기 갈래는 원본 시드에 묶인다", () => {
    const base = villageArteryRoutes(AREA, PLAZA, 7, 0.5, 7);
    const retried = villageArteryRoutes(AREA, PLAZA, 7, 0.5, 7 + 7919);
    expect(retried.map((route) => route[0])).toEqual(base.map((route) => route[0]));
    const branchOf = (routes: readonly (readonly Point[])[]): number =>
      routes.findIndex((route) => !touchesPlaza(route[route.length - 1]!));
    expect(branchOf(retried)).toBe(branchOf(base));
  });
});
