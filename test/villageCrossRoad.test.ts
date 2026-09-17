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
      // Then: 비분기는 5점, 분기는 4점. 실제 세 정점은 한 직선에 있지 않다
      for (let index = 0; index < routes.length; index += 1) {
        const route = routes[index]!;
        if (index === branchIndex) {
          expect(route.length).toBeGreaterThanOrEqual(4);
          const [a, b, c] = route.slice(1);
          const cross = (b!.x - a!.x) * (c!.y - b!.y) - (b!.y - a!.y) * (c!.x - b!.x);
          expect(cross, `seed=${seed} branch`).not.toBe(0);
        } else {
          expect(route.length).toBeGreaterThanOrEqual(5);
          const [a, b, c] = route.slice(1, -1);
          const cross = (b!.x - a!.x) * (c!.y - b!.y) - (b!.y - a!.y) * (c!.x - b!.x);
          expect(cross, `seed=${seed} route=${index}`).not.toBe(0);
        }
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

// ── 집 먼저 골격 · 시드 출구 (2026-09-17) ───────────────────────────────────
import {
  villageBoulevard,
  villageExitAnchors,
  villageStreetNetwork,
  type ExitAnchor,
} from "@/editor/tools/village/roads";
import type { BuiltHouse } from "@/editor/tools/village/constants";

function house(x: number, y: number, w = 5, h = 4): BuiltHouse {
  const doorAt = { x: x + Math.floor(w / 2), y: y + h - 1 };
  return {
    bbox: { x, y, w, h },
    doorAt,
    front: { x: doorAt.x, y: doorAt.y + 1 },
    kitId: "blue-stone",
    stories: 1,
    templateId: "t",
  };
}

const HOUSES: readonly BuiltHouse[] = [
  house(4, 6), house(12, 4), house(34, 6), house(41, 9),
  house(5, 32), house(14, 38), house(33, 34), house(40, 40),
];

function inside(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

/** 축 평행 폴리라인을 칸 단위로 펼친다. */
function rasterize(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    expect(a.x === b.x || a.y === b.y, `대각선 구간 ${JSON.stringify(a)}→${JSON.stringify(b)}`).toBe(true);
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let cur = { ...a };
    out.push(cur);
    while (cur.x !== b.x || cur.y !== b.y) {
      cur = { x: cur.x + dx, y: cur.y + dy };
      out.push(cur);
    }
  }
  if (points.length === 1) out.push({ ...points[0]! });
  return out;
}

describe("villageExitAnchors — 출구는 시드로 고른다, 십자 상수가 아니다", () => {
  it("street-grid 는 4변을 그대로 유지한다", () => {
    for (const seed of [1, 7, 42]) {
      const anchors = villageExitAnchors(AREA, PLAZA, seed, "street-grid");
      expect(anchors.map((a) => a.side)).toEqual(["north", "south", "west", "east"]);
    }
  });

  it("유기적 배치는 2~3곳이고 시드마다 조합이 달라진다", () => {
    const combos = new Set<string>();
    for (let seed = 1; seed <= 24; seed += 1) {
      const anchors = villageExitAnchors(AREA, PLAZA, seed, "plaza-ring");
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      expect(anchors.length).toBeLessThanOrEqual(3);
      expect(new Set(anchors.map((a) => a.side)).size).toBe(anchors.length);
      for (const a of anchors) {
        const onEdge = a.y === AREA.y || a.y === AREA.y + AREA.h - 1 || a.x === AREA.x || a.x === AREA.x + AREA.w - 1;
        expect(onEdge, `${a.side} 앵커가 변 위에 없다`).toBe(true);
      }
      combos.add(anchors.map((a) => a.side).join(","));
    }
    expect(combos.size).toBeGreaterThanOrEqual(4);
    // 같은 시드는 같은 답 — layoutPlan.roadAnchors 와 실제 길이 일치해야 한다.
    expect(villageExitAnchors(AREA, PLAZA, 7, "plaza-ring")).toEqual(villageExitAnchors(AREA, PLAZA, 7, "plaza-ring"));
  });

  it("단일 축 대로가 있으면 그 축의 양 끝단이 출구다", () => {
    const big: Rect = { x: 0, y: 0, w: 100, h: 72 };
    const plaza: Plaza = { rect: { x: 46, y: 33, w: 8, h: 6 }, centerRow: 36, centerX: 50 };
    let sawSingleAxis = false;
    for (let seed = 1; seed <= 12; seed += 1) {
      const boulevard = villageBoulevard(big, plaza, seed, "plaza-ring");
      if (boulevard === null || boulevard.axis === "both") continue;
      sawSingleAxis = true;
      const anchors = villageExitAnchors(big, plaza, seed, "plaza-ring", boulevard);
      const sides = anchors.map((a) => a.side);
      const axisSides: ExitAnchor["side"][] = boulevard.axis === "ew" ? ["west", "east"] : ["north", "south"];
      for (const side of axisSides) expect(sides).toContain(side);
      expect(anchors.length).toBeLessThanOrEqual(3);
    }
    expect(sawSingleAxis).toBe(true);
  });
});

describe("villageStreetNetwork — 집을 먼저 두고 길이 집에서 자란다", () => {
  it("모든 집 앞이 골격에 들어가고, 어떤 구간도 집 몸통을 관통하지 않으며, 출구는 골격에 붙는다", () => {
    for (const seed of [1, 7, 42, 100]) {
      const exits = villageExitAnchors(AREA, PLAZA, seed, "plaza-ring");
      const routes = villageStreetNetwork(AREA, PLAZA, HOUSES, exits, seed);
      const cells = new Set<string>();
      for (const route of routes) {
        for (const p of rasterize(route.points)) {
          cells.add(`${p.x},${p.y}`);
          for (const h of HOUSES) expect(inside(p, h.bbox), `seed ${seed}: 길이 집 ${JSON.stringify(h.bbox)} 을 관통`).toBe(false);
        }
      }
      for (const h of HOUSES) expect(cells.has(`${h.front.x},${h.front.y}`), `seed ${seed}: 집 앞 ${JSON.stringify(h.front)} 이 길이 아니다`).toBe(true);
      const exitRoutes = routes.filter((r) => r.kind === "exit");
      expect(exitRoutes).toHaveLength(exits.length);
      for (const [i, anchor] of exits.entries()) {
        const first = exitRoutes[i]!.points[0]!;
        expect(first).toEqual({ x: anchor.x, y: anchor.y });
      }
      // 광장 변에 한 번은 닿아야 한다(광장이 고립되지 않음).
      const plazaTouched = [...cells].some((key) => {
        const [x, y] = key.split(",").map(Number) as [number, number];
        return touchesPlaza({ x, y });
      });
      expect(plazaTouched, `seed ${seed}: 광장이 골격에 안 붙었다`).toBe(true);
    }
  });

  it("골격은 트리가 아니다 — 집 수의 1/4 이하로 고리를 둔다", () => {
    const loops = [1, 7, 42, 100, 5, 9].map((seed) => {
      const routes = villageStreetNetwork(AREA, PLAZA, HOUSES, [], seed).filter((r) => r.kind === "street");
      return routes.length - HOUSES.length; // 트리는 정확히 집 수만큼의 간선
    });
    for (const extra of loops) {
      expect(extra).toBeGreaterThanOrEqual(0);
      expect(extra).toBeLessThanOrEqual(Math.floor(HOUSES.length / 4));
    }
  });

  it("위상은 seed 에, 꺾임만 jitterSeed 에 묶인다", () => {
    const exits = villageExitAnchors(AREA, PLAZA, 7, "plaza-ring");
    const a = villageStreetNetwork(AREA, PLAZA, HOUSES, exits, 7, 7);
    const b = villageStreetNetwork(AREA, PLAZA, HOUSES, exits, 7, 99);
    expect(a.length).toBe(b.length);
    expect(a.map((r) => r.kind)).toEqual(b.map((r) => r.kind));
  });
});
