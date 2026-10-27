import { describe, expect, it } from "vitest";
import { applyVariantLook, parseKeepIntact, resolveVariantLook } from "@/editor/tools/mapVariantLook";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import type { GameMap, Project } from "@/project/types";

describe("derive_map_variant 시대 겉모습(J03)", () => {
  it("era·name·id 낱말로 프리셋을 고르고, look 이 있으면 그것이 이긴다", () => {
    expect(resolveVariantLook({ era: "ruin" })).toBe("ruin");
    expect(resolveVariantLook({ name: "붕괴된 노르드 잔해 (붕괴의 세계)" })).toBe("ruin");
    expect(resolveVariantLook({ era: "past" })).toBe("past");
    expect(resolveVariantLook({ era: "고대" })).toBe("past");
    expect(resolveVariantLook({ era: "future", id: "map_x" })).toBe("future");
    expect(resolveVariantLook({ era: "황폐한 미래" })).toBe("ruin");
    expect(resolveVariantLook({ era: "평행세계 B", id: "map_alt" })).toBeNull();
    expect(resolveVariantLook({ era: "past", look: "none" })).toBeNull();
    expect(resolveVariantLook({ era: "past", look: "future" })).toBe("future");
    expect(resolveVariantLook({ look: "nope" })).toEqual({ error: expect.stringContaining("look 은") });
  });

  function townDraft(): { draft: Project; map: GameMap } {
    const width = 20;
    const height = 12;
    const cells = width * height;
    const map = {
      id: "m", name: "마을", width, height, tilesetId: "ts", tileSize: 16, events: [],
      lowerTiles: new Array(cells).fill(7), upperTiles: new Array(cells).fill(-1), structurePlacements: [],
    } as unknown as GameMap;
    // 건물 두 채(5×5) — 찍기 전 땅(7)을 before 로 기록하고 지붕 타일(900)을 덮는다.
    for (const x of [2, 12]) {
      const rect = { x, y: 3, w: 5, h: 5 };
      const before = captureStructureTiles(map, rect);
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 5; col += 1) map.upperTiles[(3 + row) * width + x + col] = 900;
      appendStructurePlacement(map, { kitId: `bd-house-${x}`, rect, before });
    }
    const draft = {
      maps: { m: map },
      tilesets: { ts: { id: "ts", structureKits: [{ id: "bd-pick-temple-ruins-rubble-temple", kind: "section", width: 1, height: 1, rows: [{ tiles: [-1], upperTiles: [555] }], learnedFrom: "db-authored" }] } },
    } as unknown as Project;
    return { draft, map };
  }

  it("ruin 은 조명·안개를 걸고 건물을 철거해 땅으로 되돌리며 폐허 조각을 놓는다", () => {
    const { draft, map } = townDraft();
    const warnings: string[] = [];
    const report = applyVariantLook(draft, map, "ruin", warnings, "variants[x]");
    expect(map.defaultLighting?.ambient).toBeGreaterThan(0);
    expect(map.climate).toMatchObject({ mode: "fixed", weather: "fog" });
    expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
    const roofsLeft = map.upperTiles.filter((tile) => tile === 900).length;
    expect(roofsLeft).toBeLessThan(50);
    expect(map.upperTiles.filter((tile) => tile === 555).length).toBe(report.stampedPieces);
    expect(report.stampedPieces).toBeGreaterThan(0);
  });

  it("물 칸 위에는 폐허 조각을 놓지 않는다(받침 없는 물체로 커밋이 거절되던 결함)", () => {
    const { draft, map } = townDraft();
    (draft.tilesets.ts as unknown as { tileMeta: Record<number, { tags: string[] }> }).tileMeta = { 7: { tags: ["water"] } };
    const report = applyVariantLook(draft, map, "ruin", [], "variants[w]");
    expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
    expect(report.stampedPieces).toBe(0);
    expect(map.upperTiles.filter((tile) => tile === 555).length).toBe(0);
  });

  it("철거한 건물 자리의 2·4층 덧그림 지붕 조각도 지운다(허공에 남던 지붕)", () => {
    const { draft, map } = townDraft();
    const cells = map.width * map.height;
    map.lowerOverlayTiles = new Array(cells).fill(-1);
    map.upperOverlayTiles = new Array(cells).fill(-1);
    for (const x of [2, 12]) for (let row = 0; row < 5; row += 1) for (let col = 0; col < 6; col += 1) map.upperOverlayTiles[(3 + row) * map.width + x + col] = 901;
    map.upperOverlayTiles[0] = 902; // 건물 밖 덧그림은 그대로
    const report = applyVariantLook(draft, map, "ruin", [], "variants[o]");
    expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
    expect(map.upperOverlayTiles.filter((tile) => tile === 901).length).toBeLessThan(60);
    expect(map.upperOverlayTiles[0]).toBe(902);
  });

  it("철거한 건물의 그림자 띠(2층 덧그림, 오른쪽·아랫줄)도 지운다", () => {
    const { draft, map } = townDraft();
    const cells = map.width * map.height;
    map.lowerOverlayTiles = new Array(cells).fill(-1);
    const shadow = BEODEUL_NATURE.shadows["bd-house-2"] ?? Object.values(BEODEUL_NATURE.shadows)[0]!;
    const kitIds = Object.keys(BEODEUL_NATURE.shadows);
    // 건물 두 채의 kitId 를 그림자 사전에 있는 이름으로 바꿔 두고 그 그림자 칸에 덧그림을 깐다.
    map.structurePlacements = map.structurePlacements!.map((placement, n) => ({ ...placement, kitId: kitIds[n]! }));
    const shadowCellsOf = (placement: { x: number; y: number; kitId: string }) => {
      const sh = BEODEUL_NATURE.shadows[placement.kitId]!;
      const out: number[] = [];
      sh.rows.forEach((row, j) => row.forEach((tile, i) => { if (tile >= 0) out.push((placement.y + sh.dy + j) * map.width + placement.x + sh.dx + i); }));
      return out.filter((index) => index >= 0 && index < cells);
    };
    const all = map.structurePlacements!.flatMap((placement) => shadowCellsOf(placement));
    for (const index of all) map.lowerOverlayTiles[index] = 30286;
    map.lowerOverlayTiles[0] = 30999; // 건물 밖 덧그림은 그대로
    const report = applyVariantLook(draft, map, "ruin", [], "variants[s]");
    expect(report.demolishedBuildings).toBeGreaterThanOrEqual(1);
    expect(map.lowerOverlayTiles.filter((tile) => tile === 30286).length).toBeLessThan(all.length);
    expect(map.lowerOverlayTiles[0]).toBe(30999);
    expect(shadow).toBeDefined();
  });

  it("같은 변형 id 는 언제나 같은 철거·배치가 나온다", () => {
    const first = townDraft();
    const second = townDraft();
    applyVariantLook(first.draft, first.map, "past", [], "a");
    applyVariantLook(second.draft, second.map, "past", [], "a");
    expect(first.map.upperTiles).toEqual(second.map.upperTiles);
  });

  it("건물 배치 기록이 없으면 조명·안개만 걸고 경고한다", () => {
    const { draft, map } = townDraft();
    map.structurePlacements = [];
    const warnings: string[] = [];
    const report = applyVariantLook(draft, map, "future", warnings, "variants[y]");
    expect(report.demolishedBuildings).toBe(0);
    expect(map.defaultLighting).toBeDefined();
    expect(warnings.join(" ")).toContain("structurePlacements");
  });

  it("burned 는 집 자리를 잿빛 집터·숯 기둥으로 바꾸고 keepIntact 건물 하나는 그대로 둔다(폴른 스타 2막 B5)", () => {
    expect(resolveVariantLook({ name: "새벽샘 (서른 해 전 불탄 마을)" })).toBe("burned");
    expect(resolveVariantLook({ era: "ruin", look: "burned" })).toBe("burned");
    expect(parseKeepIntact("north")).toBe("north");
    expect(parseKeepIntact("3,4")).toEqual({ x: 3, y: 4 });
    expect(parseKeepIntact("top")).toEqual({ error: expect.stringContaining("keepIntact") });
    const { draft, map } = townDraft();
    const kit = (id: string, rows: { tiles: number[]; upperTiles: number[] }[]) => ({ id, kind: "section", width: rows[0]!.tiles.length, height: rows.length, rows, learnedFrom: "db-authored" });
    const ground = (tile: number) => [0, 1, 2].map(() => ({ tiles: [tile, tile, tile], upperTiles: [-1, -1, -1] }));
    (draft.tilesets.ts as unknown as { structureKits: unknown[] }).structureKits.push(
      kit("bd-pick-mining-valley-ground-slagg", ground(40)),
      kit("bd-pick-mining-valley-ground-rock", ground(41)),
      kit("bd-pick-volcano-cave-pillar-broken-a", [{ tiles: [-1], upperTiles: [60] }, { tiles: [-1], upperTiles: [61] }]),
      kit("bd-pick-volcano-cave-coal-pile", [{ tiles: [-1, -1], upperTiles: [70, 71] }]),
    );
    const report = applyVariantLook(draft, map, "burned", [], "variants[b]", { keepIntact: "west" });
    expect(report.keptIntact).toMatchObject({ x: 2, y: 3, w: 5, h: 5 });
    expect(report.demolishedBuildings).toBe(1);
    const rect = (x0: number) => Array.from({ length: 25 }, (_, n) => (3 + Math.floor(n / 5)) * map.width + x0 + (n % 5));
    expect(rect(2).every((index) => map.upperTiles[index] === 900)).toBe(true);
    expect(rect(12).some((index) => map.upperTiles[index] === 900)).toBe(false);
    expect(rect(12).every((index) => map.lowerTiles[index] === 40 || map.lowerTiles[index] === 41)).toBe(true);
    expect(rect(12).filter((index) => map.upperTiles[index] === 61).length).toBeGreaterThanOrEqual(2);
    expect(map.climate).toBeUndefined();
  });
});
