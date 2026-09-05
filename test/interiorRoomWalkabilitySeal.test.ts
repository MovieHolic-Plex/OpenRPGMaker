import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { describe, expect, it } from "vitest";
import {
  INTERIOR_ROOM_DEMO_PLANS,
  runInteriorRoomPipeline,
  evaluateInteriorRoom,
  VR,
} from "@/editor/interiorRoomPipeline";
import type { InteriorRoomPlan } from "@/editor/interiorRoomPipeline";

// 책장(2x3) lower 타일 id — placeBookshelfRow가 setL로 찍는 세트.
const BOOKSHELF_TILES = new Set(interiorObjectById("bookshelf")!.cells.filter((cell) => cell.layer === "lower").map((cell) => cell.tile));

// 봉쇄 재현 플랜(측정 RED 스크립트 scripts/tmp-probe-seal.mts와 동일).
// study 방의 유일 입구 열(innerDoor x=6)에 책장이 놓여 방이 봉쇄된다.
const SEAL_PLAN: InteriorRoomPlan = {
  mapId: "map_probe_seal_v1", name: "probe", width: 16, height: 22,
  wings: [], door: { x: 8, y: 8 }, theme: "study", seed: 7,
  rooms: [
    { id: "corridor", x: 3, y: 4, w: 10, h: 4, theme: "corridor" },
    { id: "study", x: 3, y: 11, w: 8, h: 6, theme: "study" },
  ],
  innerDoors: [{ x: 6, y: 8 }],
};

/**
 * 도달 불가 개방 셀은 평가기(evaluateInteriorRoom)가 파이프라인과 같은 정의로 이미 센다.
 * 테스트가 자체 정의를 다시 쓰면 TILE.EMPTY(-1) 같은 상수를 틀려 '항상 0'인 공허한 단정이 된다
 * (실측: upper !== 0 비교로 개방 셀 0개가 나와 RED에서도 통과했다). 관측자는 평가기로 고정한다.
 */
function walkabilityIssues(
  map: Parameters<typeof evaluateInteriorRoom>[0],
  plan: InteriorRoomPlan,
): { issues: string[]; score: number; unreachableOpenCells: number } {
  const ev = evaluateInteriorRoom(map, plan);
  return {
    issues: ev.issues.filter((s) => /도달 불가/.test(s)),
    score: ev.score,
    unreachableOpenCells: ev.metrics.unreachableOpenCells,
  };
}

describe("interior room walkability sealing (entry sentinel / lower multi-tile set repair)", () => {
  it("D1: bookshelf must never sit on an innerDoor entry column, and every open cell stays reachable", () => {
    // 결함 1: paintRoomSpace는 입구 열을 upper ENTRY_SENTINEL로 점유하지만,
    // placeBookshelfRow는 LOWER에 찍으며 upper 센티널을 보지 못해 책장이 입구 열을 덮는다.
    const plan = SEAL_PLAN;
    const built = runInteriorRoomPipeline(plan);
    const map = built.map;
    const w = map.width;
    const at = (x: number, y: number) => map.lowerTiles[y * w + x]!;

    // (a) innerDoor 열 x=6 중 통로 행(11..13) 어디에도 책장 타일이 없어야 한다.
    const bookOnEntry: string[] = [];
    for (let y = plan.innerDoors![0]!.y + 3; y <= plan.innerDoors![0]!.y + 5; y += 1) {
      if (BOOKSHELF_TILES.has(at(plan.innerDoors![0]!.x, y))) bookOnEntry.push(`(${plan.innerDoors![0]!.x},${y})=${at(plan.innerDoors![0]!.x, y)}`);
    }
    expect(bookOnEntry, `책장이 입구 열을 덮음: ${bookOnEntry.join(", ")}`).toEqual([]);

    // (b) 평가기가 세는 '도달 불가 개방 셀'이 0이어야 한다(RED에서는 29개였다).
    const walk = walkabilityIssues(map, plan);
    expect(walk.issues, `평가기 도달 불가 이슈: ${walk.issues.join(" | ")}`).toEqual([]);
    expect(walk.unreachableOpenCells, "평가기 metrics.unreachableOpenCells").toBe(0);
    expect(walk.score, "평가 점수").toBeGreaterThanOrEqual(85);

    // (c) 봉쇄 없이 시공 성공해야 한다.
    expect(built.ok).toBe(true);

    // (d) 수리 불가 경고가 없어야 한다 — 멀티타일 세트가 길을 막으면 안 된다.
    const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
    expect(sealWarnings, `봉쇄 경고: ${sealWarnings.join(" | ")}`).toEqual([]);
  });

  it("D2: no demo plan (and no measured-seal plan) may end unrepaired behind a lower multi-tile set", () => {
    // 결함 2: enforceWalkability는 REMOVABLE_SINGLE_PROPS(getU=upper 단일 소품)만 걷어낸다.
    // LOWER에 찍힌 2x3 세트(책장/스토브/카운터)가 유일한 길을 막으면 되돌릴 수 없어
    // "제거 가능한 소품 없음" 경고와 함께 ok=false로 끝난다.
    const plans: readonly InteriorRoomPlan[] = [...INTERIOR_ROOM_DEMO_PLANS, SEAL_PLAN];
    for (const plan of plans) {
      const built = runInteriorRoomPipeline(plan);
      const sealWarnings = built.warnings.filter((s) => /제거 가능한 소품 없음/.test(s));
      expect(sealWarnings, `plan ${plan.mapId}: 봉쇄 경고 ${sealWarnings.join(" | ")}`).toEqual([]);
      expect(built.ok, `plan ${plan.mapId}: ok=false, warnings=${built.warnings.join(" | ")}`).toBe(true);
    }
  });
});


it("furnishing another map cannot carry its rollback journal into the next build", () => {
  const first = runInteriorRoomPipeline(SEAL_PLAN);
  runInteriorRoomPipeline(INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "kitchen") ?? INTERIOR_ROOM_DEMO_PLANS[0]!);
  const again = runInteriorRoomPipeline(SEAL_PLAN);
  expect(again.map.lowerTiles).toEqual(first.map.lowerTiles);
  expect(again.map.upperTiles).toEqual(first.map.upperTiles);
  expect(again.warnings).toEqual(first.warnings);
});


it("the L-shaped study restores all six blocking bookshelf cells, opening its eastern pocket", () => {
  // Before repair this actual pipeline plan had 9 unreachable open cells behind the 2×3 shelf.
  const plan = INTERIOR_ROOM_DEMO_PLANS.find((plan) => plan.theme === "study")!;
  const built = runInteriorRoomPipeline(plan);
  for (let y = 9; y <= 11; y += 1) {
    for (let x = 9; x <= 10; x += 1) {
      expect(built.map.lowerTiles[y * plan.width + x], `shelf cell ${x},${y}`).toBe(VR.FLOOR);
    }
  }
  expect(evaluateInteriorRoom(built.map, plan).metrics.unreachableOpenCells).toBe(0);
  expect(built.warnings.filter((warning) => warning.startsWith("walkability:"))).toEqual([]);
});
