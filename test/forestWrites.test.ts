// forest 오퍼레이터 프로토타입 불변식 — 예술이 아니라 계약을 고정한다.
import { describe, expect, it } from "vitest";
import { buildForestWrites, type ForestMapView } from "@/editor/regionTask/forestWrites";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";

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
