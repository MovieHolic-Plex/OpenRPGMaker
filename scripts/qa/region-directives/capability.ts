// 영역 지시 능력 표 — 사용자가 캔버스에서 영역을 잡고 할 법한 지시 200개 이상을, 그 지시를 수행하는 도구 호출 순서로
// 결정적으로 재현한다(모델 없음). 지시마다 픽스처(버들항 40×30 빈 마을 + 영역 13×12)를 새로 만들고 호출을 돌린 뒤
// 판정한다:
//   완전 = 호출이 모두 성공 · 바깥 맵의 영역 밖 칸/이벤트 변화 0 · 영역 턴 병합(mergeMapBundles)이 버린 것 0 · 지시별 확인 통과
//   부분 = 도구는 있는데 거부됐거나(재료 낱말·인자·조건 — 거부 메시지를 읽고 다시 불러야 한다), 영역 밖을 건드렸거나,
//          병합이 결과 일부를 버렸거나, 지시별 확인이 떨어짐
//   불가 = 그 지시를 수행할 도구·레시피가 없음
// 「전」은 레시피 도입 전 경로다: 장소 짓기는 모델이 외관·실내·문·주인을 따로 부르는 손 사슬, 병합은 기준 커밋의 mergeMapBundles.
// 「후」는 지금 경로다: 장소 짓기는 build_region_place 한 번, 병합은 지금 mergeMapBundles.
//
// 실행: bash scripts/qa/region-directives/run.sh <출력 폴더>  (기준 커밋의 병합기를 꺼낸 뒤 bun 으로 이 파일을 돈다)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCapabilityFixtureProject } from "../../../src/harnesses/assistant-capability/node/capabilityFixture";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { getTool } from "../../../src/editor/tools/toolRegistry";
import { mergeMapBundles } from "../../../src/ai/piAgent/mapBundle";
import { regionPlaceRequest } from "../../../src/ai/regionPlaceIntent";
import type { GameMap, Project } from "../../../src/project/types";

type Call = readonly [string, Record<string, unknown>];
type Merge = (base: Project, results: { mapIds: string[]; project: Project }[]) => { project: Project; spills: { keys: string[] }[] };
interface Env { readonly mapId: string; readonly project: Project; readonly troopId: string; readonly itemId: string; readonly otherMapId: string; readonly fx: readonly string[]; readonly last: Record<string, unknown> }
interface Directive {
  readonly id: string;
  readonly genre: string;
  readonly text: string;
  readonly after: (env: Env) => Call[];
  /** 레시피 도입 전 경로(생략 = after 와 같다). */
  readonly before?: (env: Env) => Call[];
  /** 지시별 확인 — 결과 프로젝트에서 지시가 원한 것이 실제로 생겼나. */
  readonly expect?: (project: Project, env: Env) => string | null;
}

const R = { x: 14, y: 8, width: 13, height: 12 };
const AREA = { x: R.x, y: R.y, w: R.width, h: R.height };
const C = { x: R.x + 6, y: R.y + 6 };

function eventsIn(map: GameMap): number {
  return map.events.filter((e) => e.x >= R.x && e.y >= R.y && e.x < R.x + R.width && e.y < R.y + R.height).length;
}

const needEvent = (min = 1) => (project: Project, env: Env): string | null =>
  eventsIn(project.maps[env.mapId]!) >= min ? null : `영역 안 이벤트 ${min}개가 생기지 않음`;
const needCells = (project: Project, env: Env): string | null => {
  const base = env.project.maps[env.mapId]!;
  const map = project.maps[env.mapId]!;
  for (let y = R.y; y < R.y + R.height; y += 1) for (let x = R.x; x < R.x + R.width; x += 1) {
    const i = y * map.width + x;
    if (base.lowerTiles[i] !== map.lowerTiles[i] || base.upperTiles[i] !== map.upperTiles[i] || JSON.stringify(base.layers?.[i]) !== JSON.stringify(map.layers?.[i])) return null;
  }
  return "영역 안 칸이 하나도 바뀌지 않음";
};
const needVehicle = (project: Project, env: Env): string | null =>
  (project.system.vehicles ?? []).some((v) => v.mapId === env.mapId && v.x >= R.x && v.y >= R.y && v.x < R.x + R.width && v.y < R.y + R.height) ? null : "영역 안 탈것이 남지 않음";
const needNewMap = (project: Project, env: Env): string | null =>
  Object.keys(project.maps).some((id) => !env.project.maps[id]) ? null : "새 맵(실내·던전)이 남지 않음";

const directives: Directive[] = [];
const add = (d: Directive): void => { directives.push(d); };

// ── 1. 장소 짓기: 레시피 11종 × 말투 3 ──
const PLACE: readonly (readonly [string, string, string])[] = [
  ["shop", "상점", "shop"], ["weapon_shop", "무기점", "weapon_shop"], ["smithy", "대장간", "smithy"], ["inn", "여관", "inn"],
  ["tavern", "주점", "tavern"], ["house", "집", "house"], ["chapel", "교회", "chapel"], ["bakery", "빵집", "bakery"],
  ["pharmacy", "약방", "pharmacy"], ["dungeon_entrance", "던전 입구", "dungeon"], ["cave_entrance", "동굴 입구", "cave"],
];
const PHRASES = ["여기 {X} 만들어 줘", "이 자리에 {X} 지어 줘", "{X} 하나 세워 줘"];
const INTERIOR_LAYOUT: Record<string, Record<string, unknown>> = {
  shop: { rooms: [{ kind: "pharmacy_shop" }, { kind: "storeroom" }] }, weapon_shop: { rooms: [{ kind: "weapon_shop" }, { kind: "storeroom" }] },
  smithy: { program: "smithy" }, inn: { program: "inn" }, tavern: { program: "tavern" }, house: { rooms: [{ kind: "kitchen" }, { kind: "bedroom" }] },
  chapel: { program: "chapel" }, bakery: { program: "bakery" }, pharmacy: { program: "pharmacy" },
};
/** 레시피 전: 모델이 외관·실내·문·주인을 따로 부르는 사슬. 실내 맵은 트리 루트에 생긴다(create_map 기본). */
function handChain(kind: string, env: Env): Call[] {
  if (kind === "dungeon_entrance" || kind === "cave_entrance") {
    return [["author_dungeon", { type: kind === "cave_entrance" ? "cave" : "catacomb", entrance: { fromMapId: env.mapId, x: C.x, y: C.y } }]];
  }
  return [
    ["place_terrain_house", { mapId: env.mapId, anchor: { x: C.x, y: R.y + R.height - 2 }, kitId: kind === "house" ? "bd-house-h101_0" : "bd-house-h104_1" }],
    ["build_hand_interior_room", { name: kind, layout: INTERIOR_LAYOUT[kind] }],
    ["$link", {}],
    ["$keeper", { kind }],
  ];
}
for (const [kind, label] of PLACE) {
  PHRASES.forEach((phrase, i) => add({
    id: `place-${kind}-${i + 1}`, genre: "장소 짓기", text: phrase.replace("{X}", label),
    after: (env) => [["build_region_place", { mapId: env.mapId, region: R, kind }]],
    before: (env) => handChain(kind, env),
    expect: (project, env) => needNewMap(project, env) ?? needEvent(1)(project, env),
  }));
}
// 레시피가 아직 없는 장소 — 가장 가까운 도구로 시도한다(없으면 불가).
const NO_RECIPE: readonly (readonly [string, Call | null])[] = [
  ["광장 만들어 줘", ["furnish_outdoor_area", { style: "plaza" }]],
  ["정원 꾸며 줘", ["furnish_outdoor_area", { style: "garden" }]],
  ["작은 숲 만들어 줘", ["furnish_outdoor_area", { style: "grove" }]],
  ["연못 하나 파 줘", ["furnish_outdoor_area", { style: "pond" }]],
  ["농장 만들어 줘", ["build_region_place", { kind: "farm" }]],
  ["성문 세워 줘", ["build_region_place", { kind: "gate" }]], ["다리 놓아 줘", ["build_region_place", { kind: "bridge" }]],
  ["우물 만들어 줘", ["place_props", { material: "우물", count: 1 }]],
  ["창고 지어 줘", ["build_region_place", { kind: "warehouse" }]], ["마구간 지어 줘", ["build_region_place", { kind: "stable" }]],
  ["학교 지어 줘", ["build_region_place", { kind: "school" }]], ["경비 초소 세워 줘", ["build_region_place", { kind: "guard_post" }]],
  ["풍차 세워 줘", ["build_region_place", { kind: "windmill" }]], ["등대 세워 줘", ["build_region_place", { kind: "lighthouse" }]],
  ["묘지 만들어 줘", null], ["시장 열어 줘", ["build_region_place", { kind: "market" }]],
  ["사냥터 만들어 줘", ["make_hunting_ground", {}]], ["캠프 만들어 줘", ["$campfire", {}]],
];
NO_RECIPE.forEach(([text, call], i) => add({
  id: `place-other-${i + 1}`, genre: "장소 짓기", text,
  // 레시피 도입 전(build_region_place 에 그 종류가 없던 때)은 짓는 도구가 없었다.
  ...(call?.[0] === "build_region_place" ? { before: (): Call[] => [["$missing", { what: text }]], expect: (project: Project, env: Env) => needNewMap(project, env) ?? needEvent(1)(project, env) } : {}),
  after: (env) => {
    if (!call) return [["$missing", { what: text }]];
    const [name, args] = call;
    if (name === "build_region_place") return [[name, { mapId: env.mapId, region: R, ...args }]];
    if (name === "$campfire") return [["place_pixel_fx", { mapId: env.mapId, x: C.x, y: C.y, effectId: env.fx.find((f) => f.includes("campfire")) ?? env.fx[0] }]];
    if (name === "make_hunting_ground") return [[name, { mapId: env.mapId, area: AREA, troopId: env.troopId }]];
    if (name === "author_world_bridge") return [[name, { mapId: env.mapId, x: R.x + 2, y: C.y, ...args }]];
    if (name === "place_props") return [[name, { mapId: env.mapId, area: AREA, ...args }]];
    return [[name, { mapId: env.mapId, area: AREA, ...args }]];
  },
}));

// ── 2. 꾸미기: 소품 30 ──
const PROPS = ["나무", "침엽수", "활엽수", "꽃", "덤불", "바위", "나무 상자", "통", "벤치", "가로등", "울타리", "화분", "짚더미", "수레", "표지판",
  "깃발", "횃불", "동상", "장작더미", "그물", "항아리", "버섯", "갈대", "돌무더기", "텃밭", "과일박스", "빨랫줄", "모닥불", "분수", "노점"];
PROPS.forEach((material, i) => add({
  id: `decor-${i + 1}`, genre: "꾸미기", text: `여기 ${material} 좀 놓아 줘`,
  after: (env) => [["place_props", { mapId: env.mapId, area: AREA, material, count: 4 }]],
  expect: needCells,
}));
["auto", "grove", "garden", "plaza", "pond"].forEach((style, i) => add({
  id: `decor-fill-${i + 1}`, genre: "꾸미기", text: ["빈 곳 채워 줘", "나무 많이 심어 줘", "꽃밭으로 꾸며 줘", "쉼터처럼 꾸며 줘", "물가로 꾸며 줘"][i]!,
  after: (env) => [["furnish_outdoor_area", { mapId: env.mapId, area: AREA, style, seed: 3 }]],
  expect: needCells,
}));

// ── 3. 지형 ──
const GROUND = ["물", "잔디", "모래", "흙", "눈", "자갈", "돌바닥", "늪", "용암", "꽃밭", "포석", "얼음"];
GROUND.forEach((material, i) => add({
  id: `terrain-fill-${i + 1}`, genre: "지형", text: `여기 바닥을 ${material}(으)로 바꿔 줘`,
  after: (env) => [["fill_region", { mapId: env.mapId, rect: AREA, material, layer: "lower" }]],
  expect: needCells,
}));
([["both", "여기 싹 비워 줘"], ["upper", "위에 놓인 것만 치워 줘"], ["lower", "바닥만 잔디로 되돌려 줘"]] as const).forEach(([layer, text], i) => add({
  id: `terrain-clear-${i + 1}`, genre: "지형", text,
  before: (env) => [["place_props", { mapId: env.mapId, area: AREA, material: "나무", count: 6 }], ["clear_region", { mapId: env.mapId, ...AREA, layer }]],
  after: (env) => [["place_props", { mapId: env.mapId, area: AREA, material: "나무", count: 6 }], ["clear_region", { mapId: env.mapId, ...AREA, layer }]],
}));
([["plateau", "여기 언덕 올려 줘", { op: "plateau", rect: [R.x + 2, R.y + 2, R.x + 10, R.y + 8], h: 2 }],
  ["mountain", "작은 산 하나", { op: "mountain", at: [C.x, C.y], peak: 3, slope: 1 }],
  ["canyon", "골짜기 파 줘", { op: "canyon", path: [[R.x + 1, R.y + 1], [R.x + 11, R.y + 10]], width: 2, h: 0 }],
  ["terraces", "계단식 논처럼", { op: "terraces", rect: [R.x + 1, R.y + 1, R.x + 11, R.y + 10], steps: 3 }],
  ["rough", "땅을 울퉁불퉁하게", { op: "rough", rect: [R.x, R.y, R.x + 12, R.y + 11], amount: 1 }]] as const).forEach(([op, text, spec], i) => add({
  id: `terrain-relief-${i + 1}`, genre: "지형", text,
  after: (env) => [["sculpt_relief", { mapId: env.mapId, ops: [spec] }]],
}));
add({ id: "terrain-ramp", genre: "지형", text: "언덕에 오르막길 내 줘",
  after: (env) => [["sculpt_relief", { mapId: env.mapId, ops: [{ op: "plateau", rect: [R.x + 2, R.y + 2, R.x + 10, R.y + 7], h: 1 }] }], ["place_terrain_ramp", { mapId: env.mapId, at: { x: C.x, y: R.y + 7 }, width: 2 }]] });
add({ id: "terrain-erase", genre: "지형", text: "여기 칸 지워 줘", after: (env) => [["tile_erase", { mapId: env.mapId, rect: AREA, layer: "upper" }]] });

// ── 4. 길 ──
const PATHS = ["흙길", "돌길", "자갈길", "모랫길", "포석길", "나무 다리길"];
PATHS.forEach((material, i) => add({
  id: `road-${i + 1}`, genre: "길", text: `여기 ${material} 깔아 줘`,
  after: (env) => [["lay_path", { mapId: env.mapId, points: [{ x: R.x, y: C.y }, { x: R.x + R.width - 1, y: C.y }], material, naturalness: 0.3, seed: 1 }]],
  expect: needCells,
}));
([["가로로", [{ x: R.x, y: C.y }, { x: R.x + 12, y: C.y }]], ["세로로", [{ x: C.x, y: R.y }, { x: C.x, y: R.y + 11 }]], ["대각선으로", [{ x: R.x, y: R.y }, { x: R.x + 12, y: R.y + 11 }]], ["ㄱ자로", [{ x: R.x, y: R.y + 2 }, { x: R.x + 10, y: R.y + 2 }, { x: R.x + 10, y: R.y + 11 }]]] as const)
  .forEach(([how, points], i) => add({
    id: `road-shape-${i + 1}`, genre: "길", text: `흙길 ${how} 내 줘`,
    after: (env) => [["lay_path", { mapId: env.mapId, points, material: "흙길", naturalness: 0, seed: 1 }]], expect: needCells,
  }));
["dirt", "sand"].forEach((style, i) => add({
  id: `road-paint-${i + 1}`, genre: "길", text: `${style === "dirt" ? "흙" : "모래"} 도로 그어 줘`,
  after: (env) => [["paint_road", { mapId: env.mapId, points: [{ x: R.x, y: C.y }, { x: R.x + 12, y: C.y }], style, naturalness: 0 }]], expect: needCells,
}));

// ── 5. 물 ──
add({ id: "water-pond", genre: "물", text: "동그란 연못 만들어 줘", after: (env) => [["fill_region", { mapId: env.mapId, rect: { x: R.x + 3, y: R.y + 3, w: 6, h: 5 }, material: "물", layer: "lower", shape: "circle" }]], expect: needCells });
add({ id: "water-stream", genre: "물", text: "개울 하나 흐르게", after: (env) => [["fill_region", { mapId: env.mapId, path: [{ x: R.x + 1, y: R.y }, { x: R.x + 6, y: R.y + 6 }, { x: R.x + 3, y: R.y + 11 }], width: 2, material: "물" }]], expect: needCells });
add({ id: "water-river", genre: "물", text: "강 내 줘", after: (env) => [["fill_region", { mapId: env.mapId, path: [{ x: R.x, y: C.y }, { x: R.x + 12, y: C.y }], width: 4, material: "물" }]], expect: needCells });
add({ id: "water-lake", genre: "물", text: "호수로 바꿔 줘", after: (env) => [["fill_region", { mapId: env.mapId, rect: AREA, material: "호수", layer: "lower", shape: "ellipse" }]], expect: needCells });
add({ id: "water-swamp", genre: "물", text: "늪으로 만들어 줘", after: (env) => [["fill_region", { mapId: env.mapId, rect: AREA, material: "늪", layer: "lower" }]], expect: needCells });
add({ id: "water-bridge", genre: "물", text: "강 위에 다리 놓아 줘",
  before: (env) => [["fill_region", { mapId: env.mapId, path: [{ x: C.x, y: R.y }, { x: C.x, y: R.y + 11 }], width: 3, material: "물" }], ["author_world_bridge", { mapId: env.mapId, x: C.x - 3, y: C.y, length: 7, orientation: "horizontal" }]],
  after: (env) => [["fill_region", { mapId: env.mapId, path: [{ x: C.x, y: R.y }, { x: C.x, y: R.y + 11 }], width: 3, material: "물" }], ["build_region_place", { mapId: env.mapId, region: R, kind: "bridge" }]], expect: needCells });
add({ id: "water-boat", genre: "물", text: "물가에 배 하나", after: (env) => [["fill_region", { mapId: env.mapId, rect: AREA, material: "물", layer: "lower" }], ["place_vehicle", { vehicle: "boat", mapId: env.mapId, x: C.x, y: C.y }]], expect: needVehicle });
add({ id: "water-raft", genre: "물", text: "뗏목 띄워 줘", after: (env) => [["fill_region", { mapId: env.mapId, rect: AREA, material: "물", layer: "lower" }], ["place_vehicle", { vehicle: "raft", mapId: env.mapId, x: C.x, y: C.y }]], expect: needVehicle });

// ── 6. NPC ──
const ROLES = ["마을 사람", "경비병", "상인", "아이", "노인", "어부", "농부", "대장장이", "신부", "기사", "마법사", "고양이", "개", "여행자", "음유시인",
  "거지", "학생", "의사", "요리사", "왕", "공주", "도둑", "닭", "소"];
ROLES.forEach((role, i) => add({
  id: `npc-${i + 1}`, genre: "NPC", text: `여기 ${role} 하나 세워 줘`,
  after: (env) => [["place_npc", { mapId: env.mapId, x: C.x, y: C.y, name: role, graphic: { query: role }, pages: [{ lines: ["안녕하세요."] }] }]],
  expect: needEvent(1),
}));
(["random", "fixed", "patrol"] as const).forEach((type, i) => add({
  id: `npc-move-${i + 1}`, genre: "NPC", text: ["이 사람 돌아다니게 해 줘", "이 사람 가만히 서 있게", "경비병이 순찰 돌게"][i]!,
  after: (env) => [["place_npc", { mapId: env.mapId, x: C.x, y: C.y, name: "주민", graphic: { query: "마을 사람" }, pages: [{ lines: ["안녕"] }] }],
    ["configure_npc_patrol", { mapId: env.mapId, eventId: "$lastEvent", type, ...(type === "patrol" ? { directions: ["left", "left", "right", "right"] } : {}) }]],
  expect: needEvent(1),
}));
add({ id: "npc-walkers", genre: "NPC", text: "사람들이 오가게 해 줘", after: (env) => [["add_street_walkers", { mapId: env.mapId, walkers: [{ name: "행인", graphic: { query: "마을 사람" }, stops: [{ x: R.x + 1, y: C.y }, { x: R.x + 11, y: C.y }] }] }]], expect: needEvent(1) });
add({ id: "npc-walkers-3", genre: "NPC", text: "장 보는 사람 셋 다니게", after: (env) => [["add_street_walkers", { mapId: env.mapId, walkers: [0, 1, 2].map((k) => ({ name: `장꾼${k}`, graphic: { query: "마을 사람" }, stops: [{ x: R.x + 1 + k, y: R.y + 2 }, { x: R.x + 11 - k, y: R.y + 9 }] })) }]], expect: needEvent(3) });
add({ id: "npc-schedule", genre: "NPC", text: "밤에는 집에 들어가게", after: (env) => [["place_npc", { mapId: env.mapId, x: C.x, y: C.y, name: "주민", graphic: { query: "마을 사람" }, pages: [{ lines: ["안녕"] }] }],
  ["set_npc_schedule", { mapId: env.mapId, eventId: "$lastEvent", schedule: [{ when: { timePhase: "night" }, at: { mapId: env.mapId, x: C.x + 2, y: C.y } }] }]], expect: needEvent(1) });

// ── 7. 이벤트 ──
add({ id: "ev-chest-gold", genre: "이벤트", text: "보물상자에 금화 넣어 줘", after: (env) => [["place_chest", { mapId: env.mapId, x: C.x, y: C.y, contents: { gold: 100 } }]], expect: needEvent(1) });
add({ id: "ev-chest-item", genre: "이벤트", text: "상자에 회복약 넣어 줘", after: (env) => [["place_chest", { mapId: env.mapId, x: C.x, y: C.y, contents: { itemId: env.itemId, count: 2 } }]], expect: needEvent(1) });
add({ id: "ev-item-floor", genre: "이벤트", text: "바닥에 약초 떨어뜨려 줘", after: (env) => [["place_chest", { mapId: env.mapId, x: C.x, y: C.y, look: "item", contents: { itemId: env.itemId } }]], expect: needEvent(1) });
add({ id: "ev-storage", genre: "이벤트", text: "창고 상자 놓아 줘", after: (env) => [["place_storage_chest", { mapId: env.mapId, x: C.x, y: C.y }]], expect: needEvent(1) });
(["both", "slot", "checkpoint", "heal"] as const).forEach((mode, i) => add({
  id: `ev-save-${i + 1}`, genre: "이벤트", text: ["세이브 포인트 놓아 줘", "저장만 되는 곳", "재시작 지점", "회복의 샘"][i]!,
  after: (env) => [["place_savepoint", { mapId: env.mapId, x: C.x, y: C.y, mode }]], expect: needEvent(1),
}));
add({ id: "ev-trap-touch", genre: "이벤트", text: "밟으면 꺼지는 함정", after: (env) => [["place_trap", { mapId: env.mapId, cells: [{ x: C.x, y: C.y }, { x: C.x + 1, y: C.y }], trigger: "touch", message: "바닥이 꺼졌다." }]], expect: needEvent(1) });
add({ id: "ev-trap-action", genre: "이벤트", text: "건드리면 터지는 함정", after: (env) => [["place_trap", { mapId: env.mapId, at: { x: C.x, y: C.y }, trigger: "action", message: "펑!" }]], expect: needEvent(1) });
(["표지판", "우물", "동상"] as const).forEach((name, i) => add({
  id: `ev-examine-${i + 1}`, genre: "이벤트", text: `${name} 조사하면 글이 나오게`,
  after: (env) => [["place_examine_hotspots", { mapId: env.mapId, hotspots: [{ at: { x: C.x, y: C.y }, name, lines: [`${name}이다.`] }] }]], expect: needEvent(1),
}));
(["chest", "crate", "barrel", "sack", "straw", "drawer", "jar", "wardrobe"] as const).forEach((style, i) => add({
  id: `ev-search-${i + 1}`, genre: "이벤트", text: `뒤질 수 있는 ${["상자", "나무 상자", "통", "자루", "짚더미", "서랍", "항아리", "옷장"][i]} 놓아 줘`,
  after: (env) => [["place_search_containers", { mapId: env.mapId, containers: [{ x: C.x, y: C.y, style, loot: { gold: 10 } }] }]], expect: needEvent(1),
}));
(["stationary", "patrol", "chase"] as const).forEach((behavior, i) => add({
  id: `ev-enemy-${i + 1}`, genre: "이벤트", text: ["몬스터 하나 세워 줘", "몬스터가 왔다갔다 하게", "몬스터가 쫓아오게"][i]!,
  after: (env) => [["place_field_enemy", { mapId: env.mapId, x: C.x, y: C.y, troopId: env.troopId, behavior, ...(behavior !== "stationary" ? { patrol: { length: 3 } } : {}) }]], expect: needEvent(1),
}));
add({ id: "ev-hunting", genre: "이벤트", text: "몬스터가 계속 나오는 사냥터", after: (env) => [["make_hunting_ground", { mapId: env.mapId, area: AREA, troopId: env.troopId }]] });
add({ id: "ev-blocker", genre: "이벤트", text: "길 막는 보스", after: (env) => [["place_battle_blocker", { mapId: env.mapId, x: C.x, y: C.y, troopId: env.troopId, intro: ["지나갈 수 없다!"] }]], expect: needEvent(1) });
add({ id: "ev-location", genre: "이벤트", text: "여기를 광장 구역으로 이름 붙여 줘", after: (env) => [["create_map_location", { mapId: env.mapId, name: "광장", ...AREA }]] });
add({ id: "ev-location-2", genre: "이벤트", text: "여기 시장 구역", after: (env) => [["create_map_location", { mapId: env.mapId, name: "시장", ...AREA, tags: ["market"] }]] });
(["lever_secret_passage", "two_step_sequence", "brazier_ignition_order", "statue_pressure_plates", "number_code_lock", "flip_floor_tiles", "balance_scale_weights", "mirror_beam_refraction"] as const).forEach((presetId, i) => add({
  id: `ev-puzzle-${i + 1}`, genre: "이벤트", text: ["레버 당기면 비밀 통로", "순서대로 누르는 장치", "화로 불 붙이는 순서 퍼즐", "석상 발판 퍼즐", "숫자 자물쇠", "바닥 뒤집기 퍼즐", "저울 퍼즐", "거울 빛 반사 퍼즐"][i]!,
  after: (env) => [["author_map_puzzle", { mapId: env.mapId, presetId, x: C.x, y: C.y }]], expect: needEvent(1),
}));
add({ id: "ev-lift", genre: "이벤트", text: "승강기 놓아 줘", after: (env) => [["place_lift", { mapId: env.mapId, x: C.x, y: C.y, direction: "up", distance: 3 }]], expect: needEvent(1) });
add({ id: "ev-cart", genre: "이벤트", text: "탈 수 있는 수레", after: (env) => [["place_vehicle", { vehicle: "cart", mapId: env.mapId, x: C.x, y: C.y }]], expect: needVehicle });
add({ id: "ev-chocobo", genre: "이벤트", text: "탈것 새 한 마리", after: (env) => [["place_vehicle", { vehicle: "chocobo", mapId: env.mapId, x: C.x, y: C.y }]], expect: needVehicle });
add({ id: "ev-airship", genre: "이벤트", text: "비행선 세워 줘", after: (env) => [["place_vehicle", { vehicle: "airship", mapId: env.mapId, x: C.x, y: C.y }]], expect: needVehicle });

// ── 8. 상점 품목(영역에 상점을 지은 뒤) ──
const SHOP_FOLLOW: readonly (readonly [string, (env: Env) => Record<string, unknown>])[] = [
  ["상점에 회복약 더 팔게", (env) => ({ add: [{ itemId: env.itemId }] })],
  ["상점에서 회복약은 빼 줘", (env) => ({ remove: [env.itemId] })],
  ["상점 품목을 회복약 하나로", (env) => ({ stock: [{ itemId: env.itemId }] })],
  ["회복약 값 30으로", (env) => ({ add: [{ itemId: env.itemId, priceOverride: 30 }] })],
  ["겨울에만 파는 물건", (env) => ({ add: [{ itemId: env.itemId, seasons: ["winter"] }] })],
  ["봄 가격 따로", (env) => ({ add: [{ itemId: env.itemId, priceBySeason: { spring: 5 } }] })],
];
SHOP_FOLLOW.forEach(([text, args], i) => add({
  id: `shopstock-${i + 1}`, genre: "상점 품목", text: `여기 상점 만들고 ${text}`,
  before: (env) => [...handChain("shop", env), ["set_shop_stock", { mapId: "$interior", eventId: "$keeper", ...args(env) }]],
  after: (env) => [["build_region_place", { mapId: env.mapId, region: R, kind: "shop" }], ["set_shop_stock", { mapId: "$interior", eventId: "$keeper", ...args(env) }]],
  expect: needNewMap,
}));

// ── 9. 문 연결 ──
add({ id: "door-pair", genre: "문 연결", text: "여기서 옆 마을로 가는 문", after: (env) => [["create_transfer_pair", { a: { mapId: env.mapId, x: C.x, y: C.y }, b: { mapId: env.otherMapId, x: 10, y: 8 } }]], expect: needEvent(1) });
add({ id: "door-link", genre: "문 연결", text: "여기를 옆 마을과 이어 줘", after: (env) => [["link_maps", { from: { mapId: env.mapId, x: C.x, y: C.y }, to: { mapId: env.otherMapId, x: 10, y: 8 } }]], expect: needEvent(1) });
add({ id: "door-lock", genre: "문 연결", text: "상점 문은 밤에 잠기게", after: (env) => [["build_region_place", { mapId: env.mapId, region: R, kind: "shop" }], ["lock_door", { mapId: env.mapId, x: "$doorX", y: "$doorY", unlockWhen: { timePhase: "day" }, lockedText: "문이 닫혀 있다." }]],
  before: (env) => [...handChain("shop", env), ["lock_door", { mapId: env.mapId, x: "$doorX", y: "$doorY", unlockWhen: { timePhase: "day" }, lockedText: "문이 닫혀 있다." }]], expect: needNewMap });
add({ id: "door-key", genre: "문 연결", text: "열쇠 있어야 열리는 집", after: (env) => [["build_region_place", { mapId: env.mapId, region: R, kind: "house" }], ["lock_door", { mapId: env.mapId, x: "$doorX", y: "$doorY", unlockWhen: { itemId: "item_old_key" }, lockedText: "열쇠가 필요하다." }]],
  before: (env) => [...handChain("house", env), ["lock_door", { mapId: env.mapId, x: "$doorX", y: "$doorY", unlockWhen: { itemId: "item_old_key" }, lockedText: "열쇠가 필요하다." }]], expect: needNewMap });
add({ id: "door-timegate", genre: "문 연결", text: "여기에 시간의 문", after: (env) => [["create_time_gate", { a: { mapId: env.mapId, x: C.x, y: C.y }, b: { mapId: env.otherMapId, x: 10, y: 8 }, effect: "swirl" }]], expect: needEvent(1) });
add({ id: "door-lift-map", genre: "문 연결", text: "승강기로 옆 맵 가게", after: (env) => [["place_lift", { mapId: env.mapId, x: C.x, y: C.y, direction: "up", distance: 2, toMapId: env.otherMapId, toX: 10, toY: 8 }]], expect: needEvent(1) });
add({ id: "door-dungeon-name", genre: "문 연결", text: "여기 지하 감옥으로 내려가는 입구", after: (env) => [["build_region_place", { mapId: env.mapId, region: R, kind: "dungeon_entrance", name: "지하 감옥" }]], before: (env) => handChain("dungeon_entrance", env), expect: needNewMap });

// ── 10. 연출 ──
for (let i = 0; i < 16; i += 1) add({
  id: `fx-${i + 1}`, genre: "연출", text: `여기 ${["불꽃", "화토불", "물보라", "물방울", "오로라", "눈보라", "풀잎 흩날림", "반딧불", "마법진", "빛무리", "빛기둥", "반짝임", "연기", "폭죽", "서리", "얼음 결정"][i]} 효과 넣어 줘`,
  after: (env) => [["place_pixel_fx", { mapId: env.mapId, x: C.x, y: C.y, effectId: env.fx[i % env.fx.length] }]], expect: needEvent(1),
});
(["lava_bridge", "volcano", "poison_swamp", "ruins_shrine"] as const).forEach((theme, i) => add({
  id: `fx-scene-${i + 1}`, genre: "연출", text: ["용암 다리 무대", "화산 무대", "독늪 무대", "유적 제단 무대"][i]!,
  after: (env) => [["build_scene_setting", { mapId: env.mapId, theme, x: C.x, y: C.y }]], expect: needCells,
}));
([["말 걸면 회상 장면", "action"], ["들어오면 자동 장면", "auto"], ["밟으면 장면", "playerTouch"]] as const).forEach(([text, trigger], i) => add({
  id: `fx-cutscene-${i + 1}`, genre: "연출", text,
  after: (env) => [["script_cutscene", { mapId: env.mapId, x: C.x, y: C.y, trigger, beats: [{ kind: "say", speaker: "나", text: "그날을 기억한다." }, { kind: "shake", durationMs: 300 }] }]], expect: needEvent(1),
}));

// ── 실행 ──
function resolveArgs(value: unknown, env: Env): unknown {
  if (typeof value === "string" && value.startsWith("$")) return env.last[value.slice(1)] ?? value;
  if (Array.isArray(value)) return value.map((v) => resolveArgs(v, env));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveArgs(v, env)]));
  return value;
}

interface Step { readonly tool: string; readonly ok: boolean; readonly summary: string }
interface Outcome { readonly status: "완전" | "부분" | "불가"; readonly reason: string; readonly where: string; readonly steps: Step[]; readonly outsideCells: number; readonly outsideEvents: number; readonly spills: string[]; readonly newMaps: number }

const toolFiles = new Map<string, string>();
function whereTool(name: string): string {
  if (toolFiles.has(name)) return toolFiles.get(name)!;
  const out = Bun.spawnSync(["git", "grep", "-n", `name: "${name}"`, "--", "src/editor/tools", "src/editor/agentMode", "src/harnesses"]).stdout.toString().split("\n")[0] ?? "";
  const where = out ? out.split(":").slice(0, 2).join(":") : "도구 없음";
  toolFiles.set(name, where);
  return where;
}

function outsideDiff(before: GameMap, after: GameMap): { cells: number; events: number } {
  let cells = 0;
  const inR = (x: number, y: number) => x >= R.x && y >= R.y && x < R.x + R.width && y < R.y + R.height;
  for (let i = 0; i < after.lowerTiles.length; i += 1) {
    const x = i % after.width; const y = Math.floor(i / after.width);
    if (!inR(x, y) && (before.lowerTiles[i] !== after.lowerTiles[i] || before.upperTiles[i] !== after.upperTiles[i] || JSON.stringify(before.layers?.[i]) !== JSON.stringify(after.layers?.[i]))) cells += 1;
  }
  const old = new Map(before.events.map((e) => [e.id, JSON.stringify(e)]));
  const events = after.events.filter((e) => !inR(e.x, e.y) && old.get(e.id) !== JSON.stringify(e)).length;
  return { cells, events };
}

function runOne(calls: (env: Env) => Call[], expect: Directive["expect"], merge: Merge, seed: Env): Outcome {
  const ctx = { project: structuredClone(seed.project), currentMapId: seed.mapId, assistantRun: true };
  const env: Env = { ...seed, last: {} };
  const steps: Step[] = [];
  const base = structuredClone(ctx.project);
  for (const [rawName, rawArgs] of calls(env)) {
    let name = rawName;
    let args = resolveArgs(rawArgs, env) as Record<string, unknown>;
    if (name === "$missing") {
      return { status: "불가", reason: `「${String(args.what)}」 를 짓는 도구·레시피 없음`, where: "src/editor/tools/regionPlaceTools.ts (레시피 표 BUILDINGS)", steps, outsideCells: 0, outsideEvents: 0, spills: [], newMaps: 0 };
    }
    if (name === "$link") {
      name = "create_transfer_pair";
      args = { a: { mapId: env.mapId, x: env.last.doorX, y: env.last.doorY }, b: { mapId: env.last.interior, x: env.last.exitX, y: env.last.exitY } };
    }
    if (name === "$keeper") {
      const kind = String(args.kind);
      const commands = kind === "inn" ? [{ kind: "inn", price: 20 }] : ["shop", "weapon_shop", "smithy", "tavern", "bakery", "pharmacy"].includes(kind) ? [{ kind: "shop", itemIds: [env.itemId], allowSell: true }] : [];
      name = "place_npc";
      args = { mapId: env.last.interior, x: Number(env.last.exitX), y: Number(env.last.exitY) - 4, name: "주인", graphic: { query: "상인" }, pages: [{ lines: ["어서 오세요."], commands }] };
    }
    if (!getTool(name)) {
      steps.push({ tool: name, ok: false, summary: "등록되지 않은 도구" });
      return { status: "불가", reason: `도구 ${name} 없음`, where: "src/editor/tools/toolRegistry.ts", steps, outsideCells: 0, outsideEvents: 0, spills: [], newMaps: 0 };
    }
    const result = runTool(ctx, name, args);
    const summary = result.ok ? result.summary : `${result.summary} ${(result.issues ?? []).filter((i) => i.severity === "error").map((i) => i.message).join(" | ")}`;
    steps.push({ tool: name, ok: result.ok, summary: summary.replace(/\s+/g, " ").slice(0, 240) });
    if (!result.ok) {
      return { status: "부분", reason: `${name} 거부: ${summary.replace(/\s+/g, " ").slice(0, 160)}`, where: whereTool(name), steps, outsideCells: 0, outsideEvents: 0, spills: [], newMaps: 0 };
    }
    const data = (result.data ?? {}) as Record<string, any>;
    if (name === "place_terrain_house" && data.doorFront) Object.assign(env.last, { doorX: data.doorFront.x, doorY: data.doorFront.y - 1 });
    if (name === "build_hand_interior_room" && data.mapId) Object.assign(env.last, { interior: data.mapId, exitX: data.exits?.[0]?.x, exitY: data.exits?.[0]?.y });
    if (name === "build_region_place") Object.assign(env.last, { interior: data.interiorMapId ?? data.dungeonMapId, keeper: data.keeper?.eventId, doorX: data.exterior?.door?.x, doorY: data.exterior?.door?.y });
    if (name === "place_npc" && data.eventId) Object.assign(env.last, { lastEvent: data.eventId, ...(env.last.keeper ? {} : { keeper: data.eventId }) });
  }
  const after = ctx.project;
  const diff = outsideDiff(base.maps[env.mapId]!, after.maps[env.mapId]!);
  const merged = merge(base, [{ mapIds: [env.mapId], project: after }]);
  const spills = merged.spills.flatMap((s) => s.keys);
  const newMaps = Object.keys(after.maps).filter((id) => !base.maps[id]).length;
  const keptNew = Object.keys(merged.project.maps).filter((id) => !base.maps[id]).length;
  const problem = expect?.(merged.project, { ...env, project: base });
  const reasons: string[] = [];
  if (diff.cells > 0) reasons.push(`영역 밖 칸 ${diff.cells}개 바뀜`);
  if (diff.events > 0) reasons.push(`영역 밖 이벤트 ${diff.events}개`);
  if (spills.length > 0) reasons.push(`영역 턴 병합이 버림: ${spills.slice(0, 4).join(", ")}${keptNew < newMaps ? ` (새 맵 ${newMaps - keptNew}개 버려져 문이 없는 맵을 가리킴)` : ""}`);
  if (problem) reasons.push(problem);
  const where = spills.length > 0 ? "src/ai/piAgent/mapBundle.ts mergeMapBundles" : diff.cells || diff.events ? whereTool(steps.at(-1)!.tool) : problem ? whereTool(steps.at(-1)!.tool) : "";
  return { status: reasons.length ? "부분" : "완전", reason: reasons.join(" · "), where, steps, outsideCells: diff.cells, outsideEvents: diff.events, spills, newMaps: keptNew };
}

export async function main(outDir: string, oldMergePath: string): Promise<void> {
  const oldMerge = (await import(oldMergePath)).mergeMapBundles as Merge;
  const fixture = createCapabilityFixtureProject();
  const ctx = { project: fixture, currentMapId: "", assistantRun: true };
  const made = runTool(ctx, "create_map", { name: "영역 시험 마을", width: 40, height: 30, tilesetId: "beodeul_city" });
  const mapId = (made.data as { mapId: string }).mapId;
  const fxIds: string[] = [];
  for (const category of ["fire", "water", "weather", "nature", "magic", "light", "explosions", "ice"]) {
    const listed = runTool(ctx, "list_pixel_fx", { category });
    const items = ((listed.data as { items?: { id: string; loop?: boolean }[] } | undefined)?.items ?? []).filter((item) => item.loop);
    fxIds.push(...items.slice(0, 2).map((item) => item.id));
  }
  const seed: Env = {
    mapId, project: ctx.project, troopId: fixture.database.troops[0]!.id,
    itemId: fixture.database.items.find((i) => i.price > 0 && i.consumable)!.id,
    otherMapId: Object.keys(ctx.project.maps).find((id) => id !== mapId && id !== ctx.project.startMapId) ?? "map_ember_village",
    fx: fxIds, last: {},
  };
  const only = process.env.REGION_DIRECTIVES_ONLY ? new RegExp(process.env.REGION_DIRECTIVES_ONLY) : null;
  const rows = [];
  for (const d of directives.filter((entry) => !only || only.test(entry.id))) {
    const afterOutcome = runOne(d.after, d.expect, mergeMapBundles as unknown as Merge, seed);
    const beforeOutcome = runOne(d.before ?? d.after, d.expect, oldMerge, seed);
    rows.push({ id: d.id, genre: d.genre, text: d.text, routedToRecipe: regionPlaceRequest(d.text), before: beforeOutcome, after: afterOutcome });
    process.stdout.write(`ROW ${d.id} ${beforeOutcome.status}→${afterOutcome.status}\n`);
  }
  const count = (side: "before" | "after", status: string) => rows.filter((r) => r[side].status === status).length;
  const summary = {
    directives: rows.length, genres: [...new Set(rows.map((r) => r.genre))],
    before: { 완전: count("before", "완전"), 부분: count("before", "부분"), 불가: count("before", "불가") },
    after: { 완전: count("after", "완전"), 부분: count("after", "부분"), 불가: count("after", "불가") },
    fixture: { tileset: "beodeul_city", map: "40x30", region: R, fx: fxIds },
  };
  writeFileSync(resolve(outDir, "capability.json"), JSON.stringify({ summary, rows }, null, 1));
  process.stdout.write(`SUMMARY ${JSON.stringify(summary)}\n`);
}

if (import.meta.main) {
  const [outDir, oldMerge] = process.argv.slice(2);
  if (!outDir || !oldMerge) throw new Error("capability.ts <출력 폴더> <기준 커밋 mapBundle.ts 경로>");
  await main(resolve(outDir), resolve(oldMerge));
}
