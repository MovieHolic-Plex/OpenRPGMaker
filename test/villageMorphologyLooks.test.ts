// 형태 유형 마을이 «보기에» 마을인가 — 2026-09-18 사용자 지적 네 가지를 눈금으로 고정한다.
//
// ① 마을 한가운데 공터가 주변 잔디와 구별된다(예전: 8×5 공터 40칸 중 3칸만 채워짐).
// ② 필지 울타리가 지붕 위로 서너 줄 올라가지 않는다(예전: 5줄 집에 11줄 울타리).
// ③ 마을 바깥이 맨 잔디로 남지 않는다(예전: 가장자리 띠 채움 26%, 자유 칸 519/1144 가 잔디).
// ④ 계획이 없는 순환로를 있다고 적지 않는다(형태 경로는 `paintVillageRoadsChecked` 를 건너뛴다).
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { buildVillageDomain } from "@/editor/tools/village/builder";
import { ROAD_TILES } from "@/editor/tools/village/constants";
import { FENCE_BACK_ROWS, FENCE_TILES } from "@/editor/tools/village/constants";
import { parcelFenceTop } from "@/editor/tools/village/morphologyBuild";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";
import { TILE } from "@/project/defaults/constants";

function build(input: {
  readonly morphology?: "street" | "green" | "round" | "cluster";
  readonly width?: number;
  readonly height?: number;
  readonly seed?: number;
  readonly forestDensity?: "sparse" | "normal" | "dense";
  readonly plazaStyle?: "market" | "garden" | "empty";
}): GameMap {
  const width = input.width ?? 64, height = input.height ?? 64;
  const context: ToolContext = { project: createEmptyToolProject("형태 마을 외관") };
  runTool(context, "create_map", { id: "map_v", name: "마을", width, height });
  buildVillageDomain(context.project, {
    mapId: "map_v", seed: input.seed ?? 7, theme: "평범한 마을",
    ...(input.morphology ? { morphology: input.morphology } : {}),
    ...(input.forestDensity ? { forestDensity: input.forestDensity } : {}),
    ...(input.plazaStyle ? { plazaStyle: input.plazaStyle } : {}),
  });
  return context.project.maps.map_v!;
}

/** 잔디도 아니고 길도 아닌 «무언가 있는» 칸. */
function contentCells(map: GameMap, rect: { x: number; y: number; w: number; h: number }): number {
  let n = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (upper > 0 || lower !== TILE.GRASS) n += 1;
    }
  }
  return n;
}

describe("형태 유형 마을 외관", () => {
  it("장터 공터는 바닥이 깔린다 — 주변 잔디와 구별된다", () => {
    const map = build({ morphology: "street", plazaStyle: "market" });
    const plaza = (map.layoutPlan?.regions ?? []).find((region) => region.role === "plaza");
    expect(plaza, "형태 경로도 광장 영역을 계획에 적는다").toBeDefined();
    if (!plaza) return;
    const filled = contentCells(map, plaza);
    const cells = plaza.w * plaza.h;
    // 예전 값은 40칸 중 3칸(8%). 둘레 한 칸은 접근로로 비우므로 100%는 못 된다.
    expect(filled / cells, `공터 ${filled}/${cells}`).toBeGreaterThan(0.4);
  });

  it("공터를 가로지르는 길은 장터 데크가 지우지 않는다", () => {
    // green 은 공터를 두 호의 집이 마주 본다 — 데크가 바닥을 갈아엎으면 문 앞 옆길이 사라져
    // 도달성 QA 가 깨진다(실측: doors 5/8 · reachable false).
    const map = build({ morphology: "green", plazaStyle: "market", width: 64, height: 56 });
    const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house");
    expect(houses.length).toBeGreaterThan(0);
    for (const house of houses) {
      const front = house.front;
      if (!front) continue;
      const hit = [0, 1, 2].some((dy) => ROAD_TILES.has(map.lowerTiles[(front.y + dy) * map.width + front.x] ?? -1));
      expect(hit, `집 ${house.id} 문 앞에 길이 없다`).toBe(true);
    }
  });

  it("필지 울타리 뒷줄은 용마루 위 FENCE_BACK_ROWS 줄을 넘지 않는다", () => {
    // 실측(64×64 street, seed 7): 예전엔 parcel.y=18 / bbox.y=23 — 지붕 위 5줄이 울타리에 갇혔다.
    expect(parcelFenceTop(18, 23)).toBe(23 - FENCE_BACK_ROWS);
    expect(FENCE_BACK_ROWS).toBeLessThanOrEqual(2);
    // 얕은 필지는 그대로 — 필지 위로 울타리를 올리지 않는다.
    expect(parcelFenceTop(22, 23)).toBe(22);
    expect(parcelFenceTop(23, 23)).toBe(23);
  });

  // 지도 수준 단언은 두지 않는다. 울타리는 상위 레이어에 타일 번호로만 남아서 «이 집의 뒷줄»과
  // «이웃 집의 앞줄»을 구별할 수 없고(집 열 안 가장 가까운 울타리 행도 뒷줄이 안 칠해진 집에서는
  // 8줄 위 이웃 것이 잡힌다), 결국 임계를 맞출 때까지 만지는 테스트가 된다. 계약은 위의 순수 함수가
  // 고정하고, 실제 그림은 PR 의 시공 스크린샷이 증거다.

  it("forestDensity 가 마을 바깥 나무 양을 실제로 움직인다", () => {
    const counts = (["sparse", "normal", "dense"] as const).map((forestDensity) => {
      const map = build({ morphology: "street", forestDensity, width: 44, height: 26 });
      return map.upperTiles.filter((tile) => tile > 0).length;
    });
    const [sparse, normal, dense] = counts as [number, number, number];
    expect(sparse, `sparse ${sparse} < normal ${normal}`).toBeLessThan(normal);
    expect(normal, `normal ${normal} < dense ${dense}`).toBeLessThan(dense);
  });

  it("마을 바깥 가장자리 띠가 맨 잔디로 남지 않는다", () => {
    const map = build({ morphology: "street", width: 44, height: 26, forestDensity: "normal", plazaStyle: "market" });
    const band = 3;
    let cells = 0, filled = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (x >= band && y >= band && x < map.width - band && y < map.height - band) continue;
        cells += 1;
        filled += contentCells(map, { x, y, w: 1, h: 1 });
      }
    }
    // 같은 하네스 A/B 실측: origin/main 29% → 34%. 숲이 아니라 «마을 둘레»라 100%는 의도가 아니다.
    expect(filled / cells, `가장자리 ${filled}/${cells}`).toBeGreaterThan(0.32);
  });

  it("형태 경로는 광장에 road-loop 태그를 달지 않는다 — 링 길을 깔지 않기 때문", () => {
    const morph = (map: GameMap): string[] => (map.layoutPlan?.regions ?? []).find((r) => r.role === "plaza")?.tags ?? [];
    expect(morph(build({ morphology: "street" }))).not.toContain("road-loop");
    // 예전 경로(morphology 없음)는 paintPlazaAndAvenue 가 링을 깐다 — 태그는 그대로다.
    expect(morph(build({}))).toContain("road-loop");
  });
});
