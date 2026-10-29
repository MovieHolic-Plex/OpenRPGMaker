/**
 * 『폴른 스타』 2막 B5 재의 들판·새벽샘 터 — 칸 평면도(plan 문자열)로 버들항 칩셋에 직접 그린다.
 *
 * 왜 평면도인가(2026-10-29): 계획 그림(fs-act2-plan.html)의 참고 지도 「화산 지대 필드」·「폐허 마을」은 버들항 웨이브 2 장소
 * (volcano-field·ruined-village)였는데, 그 그림은 생성 스크립트로만 남아 있고(고아 커밋 0bfba316bc) 공용 칩셋에 구워진 적이 없다.
 * 새 도트를 굽지 않고 그 결(잿빛 땅·마른 고목·뼈 무더기·검푸른 바위 능선, 무너진 예배당·빈 집)을 이미 있는 조각으로 다시 짠다.
 *
 * 평면도 글자: `#` 바위 능선(윗면 오토타일 + 남쪽 앞면 2단 — 던전 gap 바위와 같은 규칙), `.` 잿빛 땅, `:` 밝은 잿길,
 * `f`·`W` 무너진 예배당 바닥(돌). 물건은 PlaceProp(키트 왼쪽 위 칸), 불탄 집은 BurntHouse(지붕 반쪽이 내려앉은 집).
 */
import type { GameMap, Project, StructureKitDef } from "@/project/types";

// 2차(2026-10-29 감독 규칙): 이 파일은 칠하지 않는다 — 배치 계획(평면도·소품·불탄 집)만 들고,
// 칠하기는 조수도 쓰는 paint_beodeul_plan 도구(src/editor/tools/beodeulPlanTool.ts)가 한다.

export type PlaceProp = readonly [kitId: string, x: number, y: number];
/** 불탄 집터 — 집 키트 자리. l·r = 그쪽으로 지붕 판이 내려앉음, c = 통째로 무너짐. */
export type BurntHouse = readonly [kitId: string, x: number, y: number, side: "l" | "r" | "c"];

const h32 = (x: number, y: number, s: number): number => {
  let k = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0;
  k ^= k >>> 16; k = Math.imul(k, 0x85ebca6b) >>> 0; k ^= k >>> 13; k = Math.imul(k, 0xc2b2ae35) >>> 0; k ^= k >>> 16;
  return k >>> 0;
};

/** paint_beodeul_plan 인자 — 평면도 + 소품 + 불탄 집. */
export function planArgs(mapId: string, plan: readonly string[], props: readonly PlaceProp[], burnt: readonly BurntHouse[], rockLine: "A" | "B" | "C" | "ice", seed: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const collapse = { l: "left", r: "right", c: "whole" } as const;
  return {
    mapId, plan: [...plan], rockLine, seed,
    props: props.map(([kit, x, y]) => ({ kit, x, y })),
    burnt: burnt.map(([kit, x, y, side]) => ({ kit, x, y, collapse: collapse[side] })),
    ...extra,
  };
}

export const ASH_FIELD_PLAN: readonly string[] = [
  "##############:::###############",
  "##############:::###############",
  "##############:::###############",
  "#########.....:::....###########",
  "#######.......:::......#########",
  "######........:::........#######",
  "#####.........:::..........#####",
  "#####........:::.............###",
  "####.........:::.....###.....###",
  "####........:::.....#####.....##",
  "###.........:::.....####......##",
  "###....##...:::......##.......##",
  "###...####..:::..............###",
  "####..###...:::.............####",
  "#####......::::...........######",
  "######....:::::.........########",
  "#######...:::.....##############",
  "########..:::....###############",
  "#########.:::...################",
  "#########.:::....###############",
  "########..:::.....##############",
  "######....:::.......############",
  "####......:::..........#########",
  "###.......::::..........########",
  "###........::::...........######",
  "###.........::::...........#####",
  "##...........::::...........####",
  "##............::::..........####",
  "##.....##......::::.........####",
  "###...####......:::.........####",
  "###....##.......:::........#####",
  "####............:::.......######",
  "#####...........:::......#######",
  "########.........:::...#########",
  "###########......:::..##########",
  "#############....:::.###########",
  "##############...:::############",
  "#################::::###########",
  "##################:::###########",
  "##################:::###########",
];
export const ASH_FIELD_PROPS: readonly PlaceProp[] = [
  ["bd-pick-swamp-stilt-snag", 1, 20],
  ["bd-pick-swamp-stilt-snag", 4, 21],
  ["bd-pick-swamp-stilt-snag", 2, 24],
  ["bd-pick-swamp-stilt-snag", 6, 24],
  ["bd-pick-swamp-stilt-snag", 4, 27],
  ["bd-pick-swamp-stilt-snag", 8, 27],
  ["bd-pick-swamp-stilt-snag", 1, 28],
  ["bd-pick-deep-forest-path-stump", 7, 30],
  ["bd-pick-deep-forest-path-stump", 10, 21],
  ["bd-pick-volcano-cave-coal-pile", 5, 31],
  ["bd-pick-volcano-cave-pillar-fallen", 8, 23],
  ["bd-pick-volcano-cave-ember-a", 9, 31],
  ["bd-pick-volcano-cave-ember-a", 3, 30],
  ["bd-pick-aqueduct-sewer-bone-heap", 22, 24],
  ["bd-pick-aqueduct-sewer-skulls", 25, 27],
  ["bd-pick-aqueduct-sewer-bones", 20, 27],
  ["bd-pick-volcano-cave-bones", 21, 22],
  ["bd-pick-dungeon-theme-bone-pillar", 24, 24],
  ["bd-pick-aqueduct-sewer-bones", 26, 29],
  ["bd-pick-dungeon-theme-bone-pillar", 21, 21],
  ["bd-pick-desert-oasis-bones", 23, 28],
  ["bd-pick-aqueduct-sewer-skulls", 19, 24],
  ["bd-pick-mining-valley-slagrock", 18, 12],
  ["bd-pick-mining-valley-slagrock", 5, 13],
  ["bd-pick-volcano-cave-spike-tall", 9, 7],
  ["bd-pick-volcano-cave-spike-small", 10, 8],
  ["bd-pick-volcano-cave-spike-wide", 6, 9],
  ["bd-pick-volcano-cave-spike-tall", 7, 6],
  ["bd-pick-mining-valley-slagheap", 25, 10],
  ["bd-pick-volcano-cave-ember-a", 23, 13],
  ["bd-pick-swamp-stilt-snag", 6, 3],
  ["bd-pick-swamp-stilt-snag", 19, 3],
  ["bd-pick-swamp-stilt-snag", 22, 5],
  ["bd-pick-swamp-stilt-snag", 9, 3],
  ["bd-pick-volcano-cave-spike-wide", 13, 31],
  ["bd-pick-volcano-cave-pillar-fallen", 21, 33],
  ["bd-pick-volcano-cave-spike-tall", 15, 26],
  ["bd-pick-volcano-cave-spike-small", 16, 27],
  ["bd-pick-swamp-stilt-snag", 0, 14],
  ["bd-pick-swamp-stilt-snag", 28, 18],
  ["bd-pick-volcano-cave-spike-tall", 5, 9],
  ["bd-pick-volcano-cave-spike-wide", 21, 4],
  ["bd-pick-swamp-stilt-snag", 11, 0],
  ["bd-pick-volcano-cave-spike-tall", 21, 32],
  ["bd-pick-swamp-stilt-snag", 3, 34],
  ["bd-pick-volcano-cave-spike-small", 26, 30],
  ["bd-pick-swamp-stilt-snag", 19, 15],
  ["bd-pick-volcano-cave-stalagmite", 20, 14],
  ["bd-pick-swamp-stilt-snag", 25, 14],
  ["bd-pick-swamp-stilt-snag", 27, 35],
  ["bd-pick-swamp-stilt-snag", 22, 0],
  ["bd-pick-volcano-cave-spike-wide", 12, 16],
  ["bd-pick-swamp-stilt-snag", 12, 34],
];
export const DAWN_PLAN: readonly string[] = [
  "#################::#################",
  "#####............::...........######",
  "###..............::.............####",
  "##...WWWWWWWWW...::.............####",
  "##...WWWWWWWWW...::...............##",
  "##...WWWWWWWWW...::...............##",
  "#....fffffffff...::...............##",
  "#....fffffffff...::................#",
  "#....fffffffff...:::...............#",
  "#....fffffffff....:::..............#",
  "#....fffffffff.....::..............#",
  "#....fffffffff.....::..............#",
  "##......::::::::::::::::::.........#",
  "##......::.....::::::..::::........#",
  "##......::....::::::::...::.......##",
  "#.......::....::::::::....::......##",
  "#.......::....::::::::.....::.....##",
  "#.......::.....::::::......::.....##",
  "#......::........::.........::....##",
  "#......::........::..........::...##",
  "##.....::........::...........::..##",
  "##....::.........::............:..##",
  "##....::.........::...............##",
  "###...::.........::..............###",
  "###..............::.............####",
  "####.............::............#####",
  "######...........::.........########",
  "#########........::......###########",
  "###########......::....#############",
  "################::::################",
];
export const DAWN_PROPS: readonly PlaceProp[] = [
  ["bd-out-cabin", 27, 2],
  ["bd-pick-temple-ruins-face-temple-3h", 5, 3],
  ["bd-pick-temple-ruins-face-temple-3h", 8, 3],
  ["bd-pick-temple-ruins-face-temple-3h", 11, 3],
  ["bd-pick-temple-ruins-ruined-wall-2", 5, 9],
  ["bd-pick-temple-ruins-ruined-wall-2", 12, 9],
  ["bd-pick-temple-ruins-column-temple-broken", 6, 6],
  ["bd-pick-temple-ruins-column-temple-tall", 13, 6],
  // 장미창 원판(모자이크 메달리온)은 뺐다 — 땅바닥에 눕힌 큰 원으로 읽혔다(감독 검수). 대신 무너진 지붕·숯이 예배당 바닥을 덮는다.
  ["bd-pick-dungeon-theme-rubble-heap", 7, 7],
  ["bd-pick-volcano-cave-coal-pile", 10, 7],
  ["bd-pick-volcano-cave-pillar-fallen", 9, 9],
  ["bd-pick-shipwreck-reef-plank-pile", 7, 10],
  ["bd-pick-volcano-cave-ember-a", 11, 8],
  ["bd-pick-temple-ruins-rubble-temple", 12, 7],
  // 꺼진 화톳불 — 광장에서 밤을 버티던 사람들의 흔적.
  ["bd-pick-deep-forest-path-campfire", 12, 16],
  ["bd-pick-shipwreck-reef-campfire", 22, 16],
  ["bd-pick-temple-ruins-fallen-column-temple", 10, 11],
  ["bd-pick-dungeon-theme-rubble-heap", 5, 11],
  ["bd-pick-castle-catacombs-rubble", 9, 11],
  ["bd-prop-well_roofed", 16, 13],
  ["bd-pick-swamp-stilt-snag", 20, 2],
  ["bd-pick-swamp-stilt-snag", 23, 4],
  ["bd-pick-swamp-stilt-snag", 2, 1],
  ["bd-pick-swamp-stilt-snag", 31, 9],
  ["bd-pick-swamp-stilt-snag", 9, 23],
  ["bd-pick-swamp-stilt-snag", 13, 25],
  ["bd-pick-swamp-stilt-snag", 21, 25],
  ["bd-pick-deep-forest-path-stump", 24, 10],
  ["bd-pick-aqueduct-sewer-bone-heap", 20, 17],
  ["bd-pick-volcano-cave-coal-pile", 11, 17],
  ["bd-pick-dungeon-theme-tomb-slab", 22, 9],
  ["bd-pick-dungeon-theme-waystone", 25, 9],
  ["bd-pick-dungeon-theme-waystone", 21, 8],
  ["bd-pick-volcano-cave-ember-a", 13, 19],
  ["bd-pick-volcano-cave-bones", 24, 13],
  ["bd-pick-mining-valley-slagrock", 29, 24],
  ["bd-pick-volcano-cave-spike-small", 6, 25],
];
export const DAWN_BURNT: readonly BurntHouse[] = [
  ["bd-out-longhouse", 1, 13, "r"],
  ["bd-out-cabin", 29, 13, "c"],
  ["bd-out-house-plank", 23, 20, "r"],
  ["bd-out-cabin-small", 2, 22, "c"],
]

/**
 * 북방 관문 요새 바깥 북쪽 — author_beodeul_town 성벽 마을을 pad 줄만큼 아래로 민 뒤, 비운 북쪽 줄(0..pad-1)의 평면도.
 * 북문 길(gateXs 열)이 맵 끝까지 곧게 이어지고, 양옆은 잿빛 산 바위 벼랑(B 줄)이 깔때기처럼 길을 조인다.
 * 벼랑 발치와 성벽 사이 두 줄은 눈 덮인 턱 — 성벽 위에서 내려다보면 바깥(눈·벼랑)이 보인다. 눈 소나무 몇 그루.
 * 돌려준 인자를 paint_beodeul_plan 에 그대로 넘긴다(눈 땅·다져진 눈길 흩뿌림).
 */
export function fortApproachArgs(project: Project, map: GameMap, pad: number, gateXs: readonly number[], seed: number): Record<string, unknown> {
  const W = map.width;
  const g0 = Math.min(...gateXs), g1 = Math.max(...gateXs);
  const rock = (x: number, y: number): boolean => {
    if (y >= pad - 2) return false;
    const wob = h32(x, y, seed) % 3 === 0 ? 1 : 0;
    const spread = 3 + Math.floor(y * 1.4) + wob;
    return x < g0 - spread || x > g1 + spread;
  };
  const plan: string[] = [];
  for (let y = 0; y < pad; y += 1) {
    let row = "";
    for (let x = 0; x < W; x += 1) row += rock(x, y) ? "#" : x >= g0 && x <= g1 ? ":" : ".";
    plan.push(row);
  }
  // 눈 덮인 소나무 — 벼랑과 길 사이 눈비탈에 몇 그루(길 양옆 한 칸은 비우고, 서로 겹치지 않게).
  const pine = (project.tilesets[map.tilesetId]?.structureKits ?? []).find((k) => k.id === "bd-pick-snowfield-pine") as (StructureKitDef & { rows: { upperTiles?: number[] }[] }) | undefined;
  const props: PlaceProp[] = [];
  if (pine) {
    const taken = new Set<number>();
    const spots: [number, number][] = [[g0 - 4, 0], [g0 - 6, 2], [g0 - 9, 3], [g0 - 3, 3], [g1 + 3, 0], [g1 + 5, 2], [g1 + 8, 3], [g1 + 2, 4]];
    for (const [px, py] of spots) {
      const cells: number[] = [];
      const fits = pine.rows.every((row, dy) => (row.upperTiles ?? []).every((t, dx) => {
        const x = px + dx, y = py + dy;
        if (t < 0) return true;
        cells.push(y * W + x);
        return x >= 0 && x < W && y < pad && !rock(x, y) && !(x >= g0 - 1 && x <= g1 + 1) && !taken.has(y * W + x);
      }));
      if (!fits || px < 0 || px + pine.width > W || py + pine.height > pad) continue;
      cells.forEach((c) => taken.add(c));
      props.push(["bd-pick-snowfield-pine", px, py]);
    }
  }
  return planArgs(map.id, plan, props, [], "B", seed, {
    x: 0, y: 0, groundKit: "bd-pick-snowfield-ground-snow", pathKit: "bd-pick-snowfield-ground-road", pathStyle: "scatter", pathBlend: 0,
  });
}
