// 읍 광장의 놓기 규칙(editor/tools/beodeulSquareGuard.ts): 가운데 기물은 하나, 소품은 가장자리 줄에, 가운데와 테 줄은 비우고, 기물끼리 겹치지 않는다.
// 2026-11-15 실모델 확인 판 r5 «갈매기 포구»: 시공기가 놓은 원주·우물·좌판 위에 조수가 우물·돌 수조·좌판을 더 찍어 작은 광장에 물 기물 셋이 겹쳐 섰다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isCentrepieceKit, squareRefusal, squareSpot, squareZones, townSquares, TOWN_SQUARE_TAG } from "@/editor/tools/beodeulSquareGuard";
import { squareInnerWhole, squareRing } from "@/editor/tools/beodeulTownCore";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

const TS = "beodeul_city";
const WELL = { id: "well", ai: { tags: ["prop", "water"] }, rows: [{ tiles: [-1], upperTiles: [900] }] };
const STALL = { id: "stall", ai: { tags: ["prop", "market"] }, rows: [{ tiles: [-1], upperTiles: [901] }] };
const RIVER = { id: "river", ai: { tags: ["water"] }, rows: [{ tiles: [5], upperTiles: [902] }] };
const TILESET = { structureKits: [WELL, STALL, RIVER] } as never;
const FOOT = [{ dx: 0, dy: 0, foot: true }];

/** 20×14 맵 가운데에 15×7 광장(테 포함) 하나. */
function squareMap(tagged = true): GameMap {
  const W = 20, H = 14;
  return { id: "m", width: W, height: H, lowerTiles: new Array(W * H).fill(1), upperTiles: new Array(W * H).fill(-1), events: [],
    locations: tagged ? [{ id: "loc1", name: "광장", x: 2, y: 3, w: 15, h: 7, tags: [TOWN_SQUARE_TAG] }] : [] } as unknown as GameMap;
}
const put = (map: GameMap, x: number, y: number, tile: number) => { map.upperTiles[y * map.width + x] = tile; };

describe("광장의 자리 — 테 · 안 · 가운데", () => {
  it("테 한 줄 안쪽이 돌바닥이고, 거기서 두 칸 들어간 네모가 가운데다 · 작은 광장은 가운데가 없다", () => {
    const z = squareZones({ x0: 2, y0: 3, x1: 16, y1: 9 });
    expect(z.inner).toEqual({ x0: 3, y0: 4, x1: 15, y1: 8 });
    expect(z.centre).toEqual({ x0: 5, y0: 6, x1: 13, y1: 6 });
    expect(squareZones({ x0: 0, y0: 0, x1: 5, y1: 4 }).centre).toBeNull();
  });
  it("맵에 적힌 광장 표시(town-square)만 읽는다 — 표시 없는 옛 맵은 규칙이 없다", () => {
    expect(townSquares(squareMap())).toHaveLength(1);
    expect(townSquares(squareMap(false))).toHaveLength(0);
    expect(squareRefusal(squareMap(false), TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")).toBeUndefined();
  });
  it("가운데 기물 급은 킷 꼬리표로 안다 — 우물·분수·석상·원주, 제 바닥을 가져오는 물 지형 조각은 아니다", () => {
    expect(isCentrepieceKit(WELL)).toBe(true);
    expect(isCentrepieceKit({ id: "f", ai: { tags: ["tall", "plaza fountain"] } })).toBe(true);
    expect(isCentrepieceKit({ id: "s", ai: { tags: ["사자 석상"] } })).toBe(true);
    expect(isCentrepieceKit({ id: "c", ai: { tags: ["prop", "monument"] } })).toBe(true);
    expect(isCentrepieceKit(STALL)).toBe(false);
    expect(isCentrepieceKit({ id: "d", ai: { tags: ["dwelling"] } })).toBe(false);
    expect(isCentrepieceKit(RIVER)).toBe(false);
  });
});

describe("광장 규칙(squareRefusal)", () => {
  it("빈 광장에는 가운데 기물이 안쪽 어디든 선다 — 테 줄만 안 된다", () => {
    const map = squareMap();
    expect(squareRefusal(map, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")).toBeUndefined();
    expect(squareRefusal(map, TILESET, WELL, { x: 2, y: 6 }, FOOT, "well")?.code).toBe("square-open");
  });
  it("가운데 기물이 이미 있으면 둘째는 거절한다 — 가운데 자리에 선 것이든, 가장자리 줄의 우물이든", () => {
    const centre = squareMap(); put(centre, 9, 6, 777);
    expect(squareRefusal(centre, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well")?.code).toBe("square-centrepiece");
    const edge = squareMap(); put(edge, 4, 8, 900);
    expect(squareRefusal(edge, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well")?.code).toBe("square-centrepiece");
    // 광장 밖은 규칙이 없다
    expect(squareRefusal(centre, TILESET, WELL, { x: 18, y: 1 }, FOOT, "well")).toBeUndefined();
  });
  it("그 밖의 소품은 가장자리 줄에만 — 가운데 자리 · 가운데 곁 · 테 줄은 거절", () => {
    const map = squareMap();
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 6 }, FOOT, "stall")?.code).toBe("square-open"); // 가운데 자리
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall")?.code).toBe("square-open"); // 가장자리 줄에 닿지 않는다
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 3 }, FOOT, "stall")?.code).toBe("square-open"); // 테 줄
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall")).toBeUndefined(); // 남쪽 안줄
    expect(squareRefusal(map, TILESET, STALL, { x: 3, y: 6 }, FOOT, "stall")).toBeUndefined(); // 서쪽 안줄
    // 깊이 두 칸 좌판: 발이 안줄과 그 윗줄에 선다
    expect(squareRefusal(map, TILESET, STALL, { x: 6, y: 7 }, [{ dx: 0, dy: 0, foot: true }, { dx: 0, dy: 1, foot: true }], "stall")).toBeUndefined();
  });
  it("기물끼리 겹치지 않는다 — replace 는 밑의 것을 지우므로 겹침이 아니고, 덮이는 가운데 기물은 세지 않는다", () => {
    const map = squareMap(); put(map, 9, 8, 901); put(map, 9, 6, 900);
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall")?.code).toBe("square-overlap");
    expect(squareRefusal(map, TILESET, STALL, { x: 9, y: 8 }, FOOT, "stall", { replace: true })).toBeUndefined();
    expect(squareRefusal(map, TILESET, WELL, { x: 9, y: 6 }, FOOT, "well", { replace: true })).toBeUndefined();
    expect(squareRefusal(map, TILESET, WELL, { x: 10, y: 6 }, FOOT, "well", { replace: true })?.code).toBe("square-centrepiece");
  });
  it("가까운 자리(squareSpot): 소품은 가장자리 줄로, 둘째 가운데 기물은 광장 밖으로", () => {
    const map = squareMap(); put(map, 9, 6, 900);
    const stall = squareSpot(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall", { free: () => true });
    expect(stall?.code).toBe("square-open");
    expect(stall?.free).toEqual({ x: 8, y: 4 });
    const well = squareSpot(map, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well", { free: () => true });
    expect(well?.code).toBe("square-centrepiece");
    const f = well!.free!;
    expect(f.x < 2 || f.x > 16 || f.y < 3 || f.y > 9).toBe(true);
    // 광장 밖에 이미 선 우물 곁(두 칸 안)은 건너뛴다 — 물 기물 둘이 나란히 붙어 서지 않는다
    put(map, f.x, f.y, 900);
    const next = squareSpot(map, TILESET, WELL, { x: 12, y: 5 }, FOOT, "well", { free: () => true })!.free!;
    expect(Math.max(Math.abs(next.x - f.x), Math.abs(next.y - f.y))).toBeGreaterThan(2);
    expect(next.x < 2 || next.x > 16 || next.y < 3 || next.y > 9).toBe(true);
    // 다른 놓기 규칙이 모두 막으면 자리를 내지 않는다
    expect(squareSpot(map, TILESET, STALL, { x: 9, y: 5 }, FOOT, "stall", { free: () => false })?.free).toBeUndefined();
  });
});

describe("시공기와 찍기 도구", () => {
  const built = (() => {
    let cache: { ctx: ToolContext; mapId: string } | undefined;
    return () => {
      if (cache) return cache;
      const project = createBlankProject() as Project;
      const ctx = { project, currentMapId: project.startMapId } as ToolContext;
      const res = runTool(ctx, "author_beodeul_town", { theme: "river", seed: 7, form: "plaza" });
      expect(res.ok, res.summary).toBe(true);
      cache = { ctx, mapId: (res.data as { mapId: string }).mapId };
      return cache;
    };
  })();
  const upper = (map: GameMap, x: number, y: number) => (map.upperTiles[y * map.width + x] ?? -1) >= 0 || (map.upperOverlayTiles?.[y * map.width + x] ?? -1) >= 0;

  it("읍의 광장: 시공기가 광장을 맵에 적고, 광장에 걸친 물 기물·기념물은 하나뿐이며, 문은 모두 닿는다", () => {
    const { ctx, mapId } = built();
    const map = ctx.project.maps[mapId]!;
    const squares = townSquares(map);
    expect(squares).toHaveLength(1);
    const { box } = squares[0]!;
    const kits = ctx.project.tilesets[TS]!.structureKits ?? [];
    const pieces = (map.structurePlacements ?? []).filter((p) => p.x <= box.x1 && p.x + p.w > box.x0 && p.y <= box.y1 && p.y + p.h > box.y0)
      .filter((p) => isCentrepieceKit(kits.find((k) => k.id === p.kitId)));
    expect(pieces).toHaveLength(1);
  }, 240_000);

  it("stamp_object: 둘째 우물은 거절(한 줄 까닭과 광장 밖 가까운 자리), 가운데의 상자는 거절, nearest 는 가장자리 줄로 옮긴다", () => {
    const { ctx, mapId } = built();
    const map = () => ctx.project.maps[mapId]!;
    const z = townSquares(map())[0]!;
    const cy = Math.round((z.box.y0 + z.box.y1) / 2);
    // 가운데 줄에서 위층 그림이 없는 칸
    let free = -1;
    for (let x = z.centre!.x0; x <= z.centre!.x1 && free < 0; x += 1) if (!upper(map(), x, cy) && !upper(map(), x + 1, cy) && !upper(map(), x, cy + 1) && !upper(map(), x + 1, cy + 1)) free = x;
    expect(free).toBeGreaterThanOrEqual(0);
    const well = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-obj-well-windlass`, mapId, x: free, y: cy });
    expect(well.ok).toBe(false);
    expect(well.summary).toContain("already has its centrepiece");
    const crate = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-prop-crate_apple`, mapId, x: free, y: cy });
    expect(crate.ok).toBe(false);
    expect(crate.summary).toContain("kept open for walking");
    const moved = runTool(ctx, "stamp_object", { objectId: `kit:${TS}/bd-prop-crate_apple`, mapId, x: free, y: cy, onOverlap: "nearest" });
    expect(moved.ok, moved.summary).toBe(true);
    const at = (moved.data as { rect: { x: number; y: number } }).rect;
    const onEdge = at.x === z.inner.x0 || at.x === z.inner.x1 || at.y === z.inner.y0 || at.y === z.inner.y1;
    const outside = at.x < z.box.x0 || at.x > z.box.x1 || at.y < z.box.y0 || at.y > z.box.y1;
    expect(onEdge || outside).toBe(true);
    // 가운데 줄은 그대로 비어 있다
    expect(upper(map(), free, cy)).toBe(false);
  }, 240_000);
});

// 2026-11-15 명세 은행 lay-base-harbor «항구 마을»: 물가에 깎여 계단 꼴이 된 포구 광장을 테와 안으로 나눠 깔자 조각난 안마다 연석이 둘러졌다.
describe("광장의 안이 한 덩이일 때만 테와 안을 나눠 깐다", () => {
  const W = 20;
  const cells = (rects: [number, number, number, number][]): number[] => rects.flatMap(([x0, y0, x1, y1]) => {
    const out: number[] = [];
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) out.push(y * W + x);
    return out;
  });
  it("네모 광장의 안은 한 덩이다", () => {
    const { ring, inner } = squareRing(W, 20, cells([[3, 3, 9, 8]]));
    expect(inner.length).toBe(5 * 4);
    expect(ring.length).toBe(7 * 6 - 5 * 4);
    expect(squareInnerWhole(W, inner)).toBe(true);
  });
  it("계단 꼴로 깎여 안이 둘로 갈라진 광장은 한 덩이가 아니다", () => {
    // 두 네모가 모서리 한 줄로만 이어진 꼴 — 안은 왼쪽 덩이와 오른쪽 덩이로 갈라진다
    const { inner } = squareRing(W, 20, [...new Set(cells([[2, 2, 6, 6], [6, 6, 11, 10]]))]);
    expect(inner.length).toBeGreaterThanOrEqual(6);
    expect(squareInnerWhole(W, inner)).toBe(false);
  });
  it("안이 여섯 칸이 안 되는 광장도 나누지 않는다", () => {
    const { inner } = squareRing(W, 20, cells([[3, 3, 6, 6]]));
    expect(inner.length).toBe(4);
    expect(squareInnerWhole(W, inner)).toBe(false);
  });
});
