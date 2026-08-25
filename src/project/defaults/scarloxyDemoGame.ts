// Scarloxy MPWSP01 팩 데모 게임 — "몬스터 초원" 예시 프로젝트.
//
// 팩 리소스(타일 그림판/캐릭셋/몬스터/전투 배경/이펙트)를 실제로 조합해 보여주는 샘플.
// 타일 인덱스는 scripts/import-scarloxy-pack.py 가 만든 타일 그림판 시트 기준이며
// (src/assets/scarloxyPackManifest.json 블록 배치), 인덱스 상수에 블록 이름을 병기한다.

import { PRODUCT_BRAND } from "@/brand";
import type { Command, EventPage, GameEvent, GameMap, Project } from "../types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { normalizeEnemyRecord, normalizeSkillRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { DEFAULT_ACTOR_ID } from "./constants";
import { createBlankMap, singleNodeTree } from "./defaultMaps";

export const MEADOW_MAP_ID = "map_scarloxy_meadow";
export const RUINS_MAP_ID = "map_scarloxy_ruins";
export const GRASSLAND_TILESET_ID = "scarloxy_chipset_grassland";
export const WILDS_TILESET_ID = "scarloxy_chipset_wilds";
export const PEOPLE1_CHARSET_ID = "tex_scarloxy_charset_people1";
export const PEOPLE2_CHARSET_ID = "tex_scarloxy_charset_people2";

const EMPTY = -1;

// --- grassland 타일 그림판 타일 인덱스 (30열 그리드) --------------------------------
export const G = {
  GRASS: 124, // grass-terrain 평지(시트 우측 열 9/39/69는 빈 투명 타일이므로 사용 금지)
  SAND_PATCH: [
    [0, 1, 2],
    [30, 31, 32],
    [60, 61, 62],
  ],
  POND: [
    [190, 191, 192],
    [220, 221, 222],
    [250, 251, 252],
  ], // coast-pond-grass
  GREEN_TREE: [
    [10, 11],
    [40, 41],
    [70, 71],
  ],
  TEAL_TREE: [
    [14, 15],
    [44, 45],
    [74, 75],
  ],
  GREEN_TREE_SMALL: [[18], [48]],
  GRASS_TUFT: 78,
  ROCK_1: 226,
  ROCK_2: 227,
  HOUSE_SMALL: rectIndices(270, 5, 5), // house-small (0,9)
  HOUSE_SMALL_ALT: rectIndices(275, 5, 5), // house-small-alt (5,9)
  HOSPITAL: rectIndices(294, 6, 6), // hospital (24,9)
} as const;

// --- wilds 타일 그림판 타일 인덱스 ---------------------------------------------------
export const W = {
  SAND: 124, // sand-terrain 평지(시트 우측 열 9/39/69는 빈 투명 타일이므로 사용 금지)
  GRASS_PATCH: [
    [0, 1, 2],
    [30, 31, 32],
    [60, 61, 62],
  ],
  PALM: [
    [110, 111],
    [140, 141],
    [170, 171],
  ],
  SAND_ROCK_1: 117,
  SAND_ROCK_2: 118,
  RUIN_GATE: rectIndices(270, 3, 3), // ruin-gate (0,9)
  RUIN_PILLAR: [[273], [303], [333]],
  RUIN_PILLAR_BROKE: [[274], [304]],
  ARENA_PLANT: rectIndices(276, 7, 7), // arena-plant (6,9)
} as const;

function rectIndices(topLeft: number, width: number, height: number): number[][] {
  return Array.from({ length: height }, (_, row) =>
    Array.from({ length: width }, (_, col) => topLeft + row * 30 + col)
  );
}

export function createScarloxyDemoMaps(): readonly GameMap[] {
  return [meadowMap(), ruinsMap()];
}

export function configureScarloxyDemoProject(project: Project): void {
  project.meta = { ...project.meta, title: "Scarloxy 몬스터 초원 데모", author: PRODUCT_BRAND };
  const titleScreen = project.system.titleScreen;
  if (titleScreen) {
    project.system = {
      ...project.system,
      titleScreen: { ...titleScreen, title: "몬스터 초원" },
    };
  }
  project.startPos = { x: 15, y: 12 };
  project.mapTree = { mapId: MEADOW_MAP_ID, children: [singleNodeTree(RUINS_MAP_ID)] };
  project.system = { ...project.system, startActorIds: [DEFAULT_ACTOR_ID] };
  project.session = { ...project.session, partyActorIds: [DEFAULT_ACTOR_ID] };

  // 주인공 워크 스프라이트를 팩의 트레이너 소년으로 교체.
  const hero = project.database.actors.find((actor) => actor.id === DEFAULT_ACTOR_ID);
  if (hero) {
    hero.characterResourceId = "scarloxy-charset-people1";
    hero.characterIndex = 0;
  }

  project.database.skills.push(
    demoSkill("skill_scarloxy_ember", "불씨 뿜기", 26, "anim_scarloxy_fire", "불씨를 뿜어 적을 태웁니다.", "fire"),
    demoSkill("skill_scarloxy_leaf", "잎날리기", 24, "anim_scarloxy_green", "날카로운 잎을 날립니다.", "grass"),
    demoSkill("skill_scarloxy_splash", "물장구", 24, "anim_scarloxy_splash", "물보라를 일으켜 공격합니다.", "water"),
    demoSkill("skill_scarloxy_scratch", "할퀴기", 18, "anim_scarloxy_scratch", "발톱으로 할큅니다."),
    demoSkill("skill_scarloxy_ice", "얼음 조각", 28, "anim_scarloxy_ice", "얼음 조각을 날립니다.", "water"),
    demoSkill("skill_scarloxy_burst", "대폭발", 36, "anim_scarloxy_explosion", "거대한 폭발을 일으킵니다.", "fire")
  );

  project.database.enemies.push(
    demoEnemy("enemy_scarloxy_sparchu", "스파르츄", "scarloxy-monster-sparchu", { maxHp: 20, maxMp: 6, attack: 9, defense: 6, mind: 8, agility: 14 }, { exp: 6, gold: 5 }, ["skill_scarloxy_ember"]),
    demoEnemy("enemy_scarloxy_larvea", "라르베아", "scarloxy-monster-larvea", { maxHp: 16, maxMp: 2, attack: 7, defense: 9, mind: 4, agility: 6 }, { exp: 4, gold: 3 }, ["skill_scarloxy_scratch"]),
    demoEnemy("enemy_scarloxy_plumette", "플루메트", "scarloxy-monster-plumette", { maxHp: 18, maxMp: 4, attack: 8, defense: 6, mind: 6, agility: 18 }, { exp: 5, gold: 4 }, ["skill_scarloxy_leaf"]),
    demoEnemy("enemy_scarloxy_finsta", "핀스타", "scarloxy-monster-finsta", { maxHp: 19, maxMp: 5, attack: 8, defense: 7, mind: 7, agility: 12 }, { exp: 5, gold: 5 }, ["skill_scarloxy_splash"]),
    demoEnemy("enemy_scarloxy_friolera", "프리올레라", "scarloxy-monster-friolera", { maxHp: 34, maxMp: 10, attack: 12, defense: 10, mind: 12, agility: 10 }, { exp: 14, gold: 12 }, ["skill_scarloxy_ice"]),
    demoEnemy("enemy_scarloxy_atrox", "아트록스", "scarloxy-monster-atrox", { maxHp: 66, maxMp: 14, attack: 18, defense: 14, mind: 12, agility: 12 }, { exp: 40, gold: 45 }, ["skill_scarloxy_ember", "skill_scarloxy_burst"])
  );

  project.database.troops.push(
    demoTroop("troop_scarloxy_meadow", "초원의 풀벌레들", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_scarloxy_larvea", x: 128, y: 136 },
      { enemyId: "enemy_scarloxy_plumette", x: 192, y: 128 },
    ]),
    demoTroop("troop_scarloxy_shore", "물가의 핀스타", "scarloxy-backdrop-sand", [
      { enemyId: "enemy_scarloxy_finsta", x: 136, y: 132 },
      { enemyId: "enemy_scarloxy_finsta", x: 192, y: 132 },
    ]),
    demoTroop("troop_scarloxy_frost", "유적의 냉기", "scarloxy-backdrop-ice", [
      { enemyId: "enemy_scarloxy_friolera", x: 168, y: 128 },
    ]),
    demoTroop("troop_scarloxy_boss", "아트록스와 부하", "scarloxy-backdrop-forest", [
      { enemyId: "enemy_scarloxy_atrox", x: 144, y: 124 },
      { enemyId: "enemy_scarloxy_sparchu", x: 208, y: 136 },
    ])
  );
}

// --- 맵 -----------------------------------------------------------------------

function meadowMap(): GameMap {
  const map = createBlankMap("몬스터 초원 마을", 30, 22, GRASSLAND_TILESET_ID);
  map.id = MEADOW_MAP_ID;
  map.lowerTiles = new Array<number>(map.width * map.height).fill(G.GRASS);
  map.upperTiles = new Array<number>(map.width * map.height).fill(EMPTY);
  map.encounterRate = 6;
  map.troopIds = ["troop_scarloxy_meadow"];

  stampLower(map, 5, 16, G.SAND_PATCH);
  stampLower(map, 24, 15, G.POND);

  stampUpper(map, 3, 3, G.HOUSE_SMALL);
  stampUpper(map, 22, 3, G.HOUSE_SMALL_ALT);
  stampUpper(map, 12, 1, G.HOSPITAL);
  for (const [x, y] of [[0, 0], [8, 0], [19, 0], [28, 0], [0, 18], [10, 19], [19, 19]] as const) {
    stampUpper(map, x, y, G.GREEN_TREE);
  }
  for (const [x, y] of [[2, 9], [27, 8], [14, 18]] as const) {
    stampUpper(map, x, y, G.TEAL_TREE);
  }
  stampUpper(map, 9, 10, G.GREEN_TREE_SMALL);
  setUpper(map, 20, 12, G.GRASS_TUFT);
  setUpper(map, 7, 12, G.GRASS_TUFT);
  setUpper(map, 21, 17, G.ROCK_1);
  setUpper(map, 4, 14, G.ROCK_2);

  map.events.push(
    talker("ev_scarloxy_guide", 15, 10, "금발 소년", [
      "여긴 Scarloxy 팩으로 만든 몬스터 초원 마을이야.",
      "풀숲을 걸으면 팩 몬스터들이 랜덤 인카운트로 나타나. 남쪽 길로 가면 사막 유적도 있어.",
    ], [], charsetGraphic(PEOPLE1_CHARSET_ID, 1)),
    talker("ev_scarloxy_healer", 14, 8, "보라 머리 치유사", [
      "병원 앞이라 다행이네요. 상처를 돌봐 드릴게요.",
    ], [{ kind: "recoverAll" }], charsetGraphic(PEOPLE1_CHARSET_ID, 3), PASSIVE_MOVEMENT),
    talker("ev_scarloxy_farmer", 7, 15, "밀짚모자 농부", [
      "모래밭 감자는 잘 자라는데, 라르베아가 자꾸 갉아먹지 뭐야.",
    ], [], charsetGraphic(PEOPLE1_CHARSET_ID, 6)),
    battler("ev_scarloxy_water_boss", 23, 14, "물 도장 보스", [
      "물가의 몬스터들과 겨뤄 볼래?",
    ], "troop_scarloxy_shore", charsetGraphic(PEOPLE1_CHARSET_ID, 7)),
    battler("ev_scarloxy_fire_boss", 26, 18, "불 도장 보스", [
      "내 아트록스는 만만치 않아. 도전해라!",
    ], "troop_scarloxy_boss", charsetGraphic(PEOPLE2_CHARSET_ID, 0)),
    transferEvent("ev_scarloxy_to_ruins", 15, 21, RUINS_MAP_ID, 12, 2, "사막 유적으로"),
  );
  return map;
}

function ruinsMap(): GameMap {
  const map = createBlankMap("사막 유적", 24, 18, WILDS_TILESET_ID);
  map.id = RUINS_MAP_ID;
  map.lowerTiles = new Array<number>(map.width * map.height).fill(W.SAND);
  map.upperTiles = new Array<number>(map.width * map.height).fill(EMPTY);
  map.encounterRate = 7;
  map.troopIds = ["troop_scarloxy_frost"];

  stampLower(map, 3, 12, W.GRASS_PATCH);
  stampUpper(map, 10, 4, W.RUIN_GATE);
  stampUpper(map, 15, 4, W.RUIN_PILLAR);
  stampUpper(map, 8, 5, W.RUIN_PILLAR_BROKE);
  stampUpper(map, 3, 8, W.ARENA_PLANT);
  for (const [x, y] of [[1, 1], [20, 2], [19, 13]] as const) {
    stampUpper(map, x, y, W.PALM);
  }
  setUpper(map, 17, 9, W.SAND_ROCK_1);
  setUpper(map, 6, 3, W.SAND_ROCK_2);

  map.events.push(
    transferEvent("ev_scarloxy_to_meadow", 12, 1, MEADOW_MAP_ID, 15, 20, "초원 마을로"),
    battler("ev_scarloxy_ruin_guard", 11, 6, "풀 도장 보스", [
      "유적의 냉기가 깨어났다. 프리올레라의 시험을 받아라!",
    ], "troop_scarloxy_frost", charsetGraphic(PEOPLE2_CHARSET_ID, 1)),
    talker("ev_scarloxy_ruin_sign", 5, 15, "낡은 표지판", [
      "아레나에서는 예로부터 몬스터 시합이 열렸다고 한다.",
    ], [], NO_GRAPHIC, PASSIVE_MOVEMENT),
  );
  return map;
}

// --- DB 헬퍼 -------------------------------------------------------------------

export function demoSkill(id: string, name: string, power: number, animationId: string, description: string, elementId?: string) {
  return normalizeSkillRecord({
    id,
    name,
    scope: "enemy",
    power,
    animationId,
    description,
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    variance: 15,
    hitRate: 95,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    elementId,
  });
}

export function demoEnemy(
  id: string,
  name: string,
  monsterResourceId: string,
  stats: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number },
  rewards: { exp: number; gold: number },
  skillIds: readonly string[],
  extra: { level?: number; speciesId?: string } = {},
) {
  return normalizeEnemyRecord({
    id,
    name,
    monsterResourceId,
    level: extra.level,
    speciesId: extra.speciesId,
    stats,
    rewards: { ...rewards, dropRatePercent: 0 },
    actions: skillIds.map((skillId, index) => ({
      skillId,
      priority: 5,
      condition: index === 0 ? ({ kind: "always" } as const) : ({ kind: "turn", start: 2, interval: 2 } as const),
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    })),
  });
}

export function demoTroop(
  id: string,
  name: string,
  previewBackgroundResourceId: string,
  members: readonly { enemyId: string; x: number; y: number }[],
  extra: { uncapturable?: boolean; trainerBattle?: boolean } = {},
) {
  return normalizeTroopRecord({
    id,
    name,
    uncapturable: extra.uncapturable,
    trainerBattle: extra.trainerBattle,
    enemyIds: members.map((member) => member.enemyId),
    members: [...members],
    autoAlign: false,
    previewBackgroundResourceId,
    battleEventPages: [],
  });
}

// --- 이벤트/타일 헬퍼 (defaultAdventureGame.ts 패턴) ---------------------------

export const PASSIVE_MOVEMENT = { type: "fixed", speed: 3, frequency: 3 } as const;
export const WANDER_MOVEMENT = { type: "random", speed: 2, frequency: 3 } as const;
export const NO_GRAPHIC = { transparent: true } as const satisfies EventPage["graphic"];

export function charsetGraphic(spriteId: string, characterIndex: number): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

export function talker(
  id: string,
  x: number,
  y: number,
  speaker: string,
  lines: readonly string[],
  extraCommands: readonly Command[] = [],
  graphic: EventPage["graphic"] = NO_GRAPHIC,
  movement: EventPage["movement"] = WANDER_MOVEMENT,
): GameEvent {
  return event(id, x, y, [
    page(`${id}_page`, speaker, [...lines.map((body) => ({ kind: "text", speaker, body }) satisfies Command), ...extraCommands], graphic, movement),
  ]);
}

export function battler(id: string, x: number, y: number, speaker: string, lines: readonly string[], troopId: string, graphic: EventPage["graphic"]): GameEvent {
  return event(id, x, y, [
    page(`${id}_page`, speaker, [
      ...lines.map((body) => ({ kind: "text", speaker, body }) satisfies Command),
      { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
    ], graphic, PASSIVE_MOVEMENT),
  ]);
}

export function transferEvent(id: string, x: number, y: number, mapId: string, toX: number, toY: number, name: string): GameEvent {
  return event(id, x, y, [
    page(`${id}_page`, name, [{ kind: "transfer", mapId, x: toX, y: toY, fade: "black" }], NO_GRAPHIC, PASSIVE_MOVEMENT),
  ], "playerTouch", "below");
}

export function event(id: string, x: number, y: number, pages: readonly EventPage[], trigger: GameEvent["trigger"]["kind"] = "action", priority: EventPage["priority"] = "same"): GameEvent {
  return { id, x, y, trigger: { kind: trigger }, commands: [], pages: pages.map((entry) => ({ ...entry, trigger: { kind: trigger }, priority })) };
}

export function page(
  id: string,
  name: string,
  commands: readonly Command[],
  graphic: EventPage["graphic"],
  movement: EventPage["movement"],
  conditions: EventPage["conditions"] = [],
): EventPage {
  return { id, name, conditions: [...conditions], graphic, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement, commands: [...commands] };
}

export function stampLower(map: GameMap, originX: number, originY: number, pattern: readonly (readonly number[])[]): void {
  forEachPatternTile(map, originX, originY, pattern, (index, tile) => {
    map.lowerTiles[index] = tile;
  });
}

export function stampUpper(map: GameMap, originX: number, originY: number, pattern: readonly (readonly number[])[]): void {
  forEachPatternTile(map, originX, originY, pattern, (index, tile) => {
    map.upperTiles[index] = tile;
  });
}

export function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function forEachPatternTile(
  map: GameMap,
  originX: number,
  originY: number,
  pattern: readonly (readonly number[])[],
  apply: (index: number, tile: number) => void,
): void {
  for (let dy = 0; dy < pattern.length; dy += 1) {
    const row = pattern[dy];
    if (!row) continue;
    for (let dx = 0; dx < row.length; dx += 1) {
      const tile = row[dx];
      if (tile === undefined || tile < 0) continue;
      const x = originX + dx;
      const y = originY + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      apply(y * map.width + x, tile);
    }
  }
}
