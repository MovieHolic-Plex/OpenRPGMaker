import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { villageTemplateCatalog } from "@/editor/tools/village/authoringData";
import { buildVillageDomain } from "@/editor/tools/village/builder";
import type { Point, Rect } from "@/editor/tools/village/constants";
import { ROAD_TILES } from "@/editor/tools/village/constants";
import {
  VILLAGE_MORPHOLOGIES,
  connect4,
  countStrokeComponents,
  planVillageMorphology,
  type MorphologyPlan,
  type VillageMorphology,
} from "@/editor/tools/village/morphologyPlan";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

const AREA: Rect = { x: 0, y: 0, w: 64, h: 64 };
const templates = villageTemplateCatalog(undefined).templates;

function plan(morphology: VillageMorphology, seed: number, extra: Partial<Parameters<typeof planVillageMorphology>[0]> = {}): MorphologyPlan {
  return planVillageMorphology({
    morphology, area: AREA, mapWidth: 64, mapHeight: 64, seed, maxHouses: 32, templates, blocked: new Set(), roadWidth: 2, ...extra,
  });
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function roadSet(result: MorphologyPlan): Set<string> {
  const cells = new Set<string>();
  for (const stroke of result.roads) for (const cell of stroke.cells) cells.add(`${cell.x},${cell.y}`);
  return cells;
}

describe("planVillageMorphology", () => {
  it.each(VILLAGE_MORPHOLOGIES)("%s: 같은 씨앗은 같은 계획을 낸다", (morphology) => {
    // Given: 같은 인자 두 번
    const first = plan(morphology, 7);
    const second = plan(morphology, 7);
    // Then: 집·길·밭이 그대로
    expect(second.houses).toEqual(first.houses);
    expect(second.roads).toEqual(first.roads);
    expect(second.fields).toEqual(first.fields);
  });

  it.each(VILLAGE_MORPHOLOGIES.flatMap((m) => [3, 7, 11, 21].map((seed) => [m, seed] as const)))(
    "%s s%d: 뼈대 길은 한 성분이고 필지는 영역 안에서 서로 겹치지 않는다",
    (morphology, seed) => {
      const result = plan(morphology, seed);
      // 뼈대(옆길 제외)는 4-이웃으로 한 덩어리 — 출구에서 어느 집 앞까지도 걸어갈 수 있어야 한다.
      expect(countStrokeComponents(result.roads)).toBe(1);
      expect(result.houses.length).toBeGreaterThanOrEqual(6);
      expect(result.exits.length).toBeGreaterThanOrEqual(1);
      for (const [index, house] of result.houses.entries()) {
        const { parcel, bbox } = house;
        // 필지가 bbox 를 품고 영역 안(1칸 여백)에 있다.
        expect(bbox.x).toBeGreaterThanOrEqual(parcel.x);
        expect(bbox.x + bbox.w).toBeLessThanOrEqual(parcel.x + parcel.w);
        expect(bbox.y - 1).toBeGreaterThanOrEqual(parcel.y);
        expect(parcel.x).toBeGreaterThanOrEqual(AREA.x + 1);
        expect(parcel.y).toBeGreaterThanOrEqual(AREA.y + 1);
        expect(parcel.x + parcel.w).toBeLessThanOrEqual(AREA.x + AREA.w - 1);
        expect(parcel.y + parcel.h).toBeLessThanOrEqual(AREA.y + AREA.h - 1);
        for (const other of result.houses.slice(index + 1)) expect(rectsOverlap(parcel, other.parcel)).toBe(false);
        // 필지 안에 길 칸이 없다(길이 집을 뚫지 않는다).
        const roads = roadSet(result);
        for (let y = parcel.y; y < parcel.y + parcel.h; y += 1) {
          for (let x = parcel.x; x < parcel.x + parcel.w; x += 1) expect(roads.has(`${x},${y}`)).toBe(false);
        }
      }
      // 밭은 길·필지와 겹치지 않는다.
      const roads = roadSet(result);
      for (const field of result.fields) {
        for (const house of result.houses) expect(rectsOverlap(field.rect, house.parcel)).toBe(false);
        for (let y = field.rect.y; y < field.rect.y + field.rect.h; y += 1) {
          for (let x = field.rect.x; x < field.rect.x + field.rect.w; x += 1) expect(roads.has(`${x},${y}`)).toBe(false);
        }
      }
    },
  );

  it("숲 띠(softBlocked)는 집을 막지만 큰길은 지나간다", () => {
    // Given: 북쪽 6행이 숲 띠
    const soft = new Set<number>();
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 64; x += 1) soft.add(y * 64 + x);
    const result = plan("cluster", 3, { softBlocked: soft });
    // Then: 어느 필지도 숲 띠에 들어가지 않고, 뼈대 길은 여전히 한 성분
    for (const house of result.houses) expect(house.parcel.y).toBeGreaterThanOrEqual(6);
    expect(countStrokeComponents(result.roads)).toBe(1);
  });

  it("connect4 는 대각선 계단을 4-연결로 채운다", () => {
    const cells: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 4, y: 3 }];
    const out = connect4(cells);
    for (let i = 1; i < out.length; i += 1) {
      const a = out[i - 1]!, b = out[i]!;
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 4, y: 3 });
  });
});

describe("buildVillageDomain({ morphology })", () => {
  function build(morphology: VillageMorphology, seed: number): { map: GameMap; summary: string; warnings: string[] } {
    const context: ToolContext = { project: createEmptyToolProject(`형태 마을 ${morphology}`) };
    runTool(context, "create_map", { id: "map_v", name: "마을", width: 64, height: 64 });
    const result = buildVillageDomain(context.project, { mapId: "map_v", seed, theme: "평범한 마을", morphology });
    return { map: context.project.maps.map_v!, summary: result.summary, warnings: result.warnings ?? [] };
  }

  it.each(VILLAGE_MORPHOLOGIES)("%s: 모든 문이 길에 닿고 길 성분이 1이며 요약에 형태가 적힌다", (morphology) => {
    const { map, summary, warnings } = build(morphology, 7);
    expect(summary).toContain("형태 ");
    expect(summary).toMatch(/길 성분 1\b/);
    expect(warnings.filter((w) => /문 앞에서 길을 못 찾았다|성분 미달|문 연결 미달/.test(w))).toEqual([]);
    const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house");
    expect(houses.length).toBeGreaterThanOrEqual(6);
    for (const house of houses) {
      const front = house.front;
      expect(front).toBeDefined();
      if (!front) continue;
      // 문 앞 칸 또는 그 아래 2칸 안에 길 재질이 있다(옆 기둥 집은 문 앞 칸 자체가 옆길이다).
      const hit = [0, 1, 2].some((dy) => ROAD_TILES.has(map.lowerTiles[(front.y + dy) * map.width + front.x] ?? -1));
      expect(hit).toBe(true);
    }
    const plazaTags = (map.layoutPlan?.regions ?? []).find((region) => region.role === "plaza")?.tags ?? [];
    expect(plazaTags).toContain(`morphology:${morphology}`);
  });

  it("morphology 없는 호출은 예전 경로 그대로다", () => {
    const context: ToolContext = { project: createEmptyToolProject("기존 경로") };
    runTool(context, "create_map", { id: "map_v", name: "마을", width: 64, height: 64 });
    const result = buildVillageDomain(context.project, { mapId: "map_v", seed: 7, theme: "평범한 마을" });
    expect(result.summary).not.toContain("형태 ");
    const plazaTags = (context.project.maps.map_v!.layoutPlan?.regions ?? []).find((region) => region.role === "plaza")?.tags ?? [];
    expect(plazaTags.some((tag) => tag.startsWith("morphology:"))).toBe(false);
  });
});
