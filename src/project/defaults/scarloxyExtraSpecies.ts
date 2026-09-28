// 포켓몬풍 데모의 몬스터 도감 확장 — 새 11종 + 기존 19종의 뒷모습·울음소리 배선.
//
// 이 모듈은 **데이터만** 낸다. 데모 조립(scarloxyPokemonDemoGame.ts)은 다른 작업이 소유하므로
// 여기서는 레코드와 헬퍼를 내보내고, 조립 쪽이 가져다 붙인다:
//
//   project.database.skills.push(...createScarloxyExtraSkills());
//   project.database.monsterSpecies.push(...createScarloxyExtraSpeciesRecords());
//   applyScarloxyBackSprites(project.database.monsterSpecies);  // 30종 모두 뒷모습
//
// 그림: public/assets/scarloxy/scarloxy-monster-<key>{,-back}.png(96x96), 아이콘 scarloxy-monster-icon-<key>.png.
// 울음: public/assets/scarloxy/cries/scarloxy-cry-<key>.wav (scripts/content/synth-scarloxy-cries.py 로 합성).
// 새 11종·모든 뒷모습·새 배경 4장은 이미지 생성 모델로 그린 **생성 자산**이다(팩 원본 아님) —
// 출처 표기는 public/assets/ATTRIBUTION.md 「Generated monster roster expansion」.

import type { MonsterSpeciesRecord, SkillRecord } from "@/project/types";
import { normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import { DEFAULT_SKILL_ID } from "./constants";

/** 데모의 Gen1 타입 id(scarloxyPokemonDemoGame.ts GEN1_TYPE_DEFINITIONS 와 같은 값). */
export type ScarloxyTypeId =
  | "normal" | "fighting" | "flying" | "poison" | "ground" | "rock" | "bug" | "ghost"
  | "fire" | "water" | "grass" | "electric" | "psychic" | "ice" | "dragon";

export type ScarloxySpeciesStats = {
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
};

/** 야생 출현 제안. 조우표를 짤 때 참고용이며 이 모듈이 맵에 배선하지는 않는다. */
export type ScarloxyHabitat = "route" | "cave" | "beach" | "gym";

export type ScarloxyExtraSpeciesSeed = {
  readonly key: string;
  readonly name: string;
  readonly types: readonly ScarloxyTypeId[];
  readonly stats: ScarloxySpeciesStats;
  /** 0~1. 데모 기존 종과 같은 척도(아기 0.45~0.6, 중간 0.25~0.35, 최종 0.1~0.15). */
  readonly captureRate: number;
  /** 레벨 1 은 기본 공격(DEFAULT_SKILL_ID)이 자동으로 붙는다. */
  readonly moves: readonly { readonly level: number; readonly skillId: string }[];
  readonly evolvesTo?: { readonly key: string; readonly level: number };
  readonly habitat: readonly ScarloxyHabitat[];
  /** 야생으로 나올 때 권장 레벨 구간. */
  readonly wildLevels: readonly [number, number];
  readonly description: string;
};

// --- 새 기술 --------------------------------------------------------------------
// 기존 기술(skill_scarloxy_*, skill_pkmn_rock)은 데모 조립이 만든다. 여기 넣는 기술은 새 종이
// 중·후반에 배우는 한 단계 센 기술이다. 조립 쪽이 없는 id 를 참조하지 않도록 새 종은
// 이 목록 + 데모에 이미 있는 id 만 쓴다(test/scarloxyExtraSpecies.test.ts 가 막는다).

type ExtraSkillSeed = {
  readonly id: string;
  readonly name: string;
  readonly power: number;
  readonly elementId: ScarloxyTypeId;
  readonly maxPp: number;
  readonly animationId: string;
  readonly description: string;
  readonly stateEffects?: SkillRecord["stateEffects"];
  readonly critical?: "normal" | "high";
};

export const SCARLOXY_EXTRA_SKILL_SEEDS: readonly ExtraSkillSeed[] = [
  { id: "skill_scarloxy_rockslide", name: "바위 떨구기", power: 34, elementId: "rock", maxPp: 10, animationId: "anim_scarloxy_explosion", description: "큰 바위를 떨어뜨려 짓누릅니다." },
  { id: "skill_scarloxy_quake", name: "땅울림", power: 38, elementId: "ground", maxPp: 10, animationId: "anim_scarloxy_explosion", description: "땅을 크게 울려 흔듭니다." },
  { id: "skill_scarloxy_thunder_fang", name: "번개 이빨", power: 30, elementId: "electric", maxPp: 15, animationId: "anim_scarloxy_scratch", description: "전기를 두른 이빨로 뭅니다. 가끔 마비시킵니다.", stateEffects: [{ stateId: "state_paralysis", chance: 10, operation: "add" }] },
  { id: "skill_scarloxy_will_o_wisp", name: "도깨비불", power: 28, elementId: "ghost", maxPp: 15, animationId: "anim_scarloxy_fire", description: "푸른 혼불을 날립니다. 가끔 화상을 입힙니다.", stateEffects: [{ stateId: "state_burn", chance: 20, operation: "add" }] },
  { id: "skill_scarloxy_horn_rush", name: "뿔 돌진", power: 34, elementId: "bug", maxPp: 15, animationId: "anim_scarloxy_scratch", description: "뿔을 앞세워 들이받습니다. 급소에 맞기 쉽습니다.", critical: "high" },
  { id: "skill_scarloxy_sludge", name: "오물 폭탄", power: 32, elementId: "poison", maxPp: 10, animationId: "anim_poison", description: "독 오물을 던집니다. 자주 독에 걸립니다.", stateEffects: [{ stateId: "state_poison", chance: 30, operation: "add" }] },
  { id: "skill_scarloxy_brick", name: "기왓장 깨기", power: 32, elementId: "fighting", maxPp: 15, animationId: "anim_scarloxy_scratch", description: "손날로 힘껏 내려칩니다." },
  { id: "skill_scarloxy_blizzard", name: "눈보라", power: 36, elementId: "ice", maxPp: 5, animationId: "anim_scarloxy_ice", description: "세찬 눈보라를 일으킵니다. 가끔 얼립니다.", stateEffects: [{ stateId: "state_freeze", chance: 10, operation: "add" }] },
];

/** 데모 조립이 이미 만드는 기술 id(scarloxyPokemonDemoGame.ts). 새 종의 기술 참조 검증에 쓴다. */
export const SCARLOXY_DEMO_SKILL_IDS: readonly string[] = [
  DEFAULT_SKILL_ID,
  "skill_scarloxy_ember", "skill_scarloxy_leaf", "skill_scarloxy_splash", "skill_scarloxy_scratch",
  "skill_scarloxy_ice", "skill_scarloxy_burst", "skill_pkmn_rock", "skill_scarloxy_quick",
  "skill_scarloxy_punch", "skill_scarloxy_wing", "skill_scarloxy_venom", "skill_scarloxy_mud",
  "skill_scarloxy_bug", "skill_scarloxy_shadow", "skill_scarloxy_spark", "skill_scarloxy_wave",
  "skill_scarloxy_mind", "skill_scarloxy_dragon",
];

export function createScarloxyExtraSkills(): SkillRecord[] {
  return SCARLOXY_EXTRA_SKILL_SEEDS.map((seed) => ({
    ...normalizeSkillRecord({
      id: seed.id,
      name: seed.name,
      scope: "enemy",
      power: seed.power,
      animationId: seed.animationId,
      description: seed.description,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      variance: 15,
      hitRate: 95,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      elementId: seed.elementId,
      ...(seed.stateEffects ? { stateEffects: seed.stateEffects.map((effect) => ({ ...effect })) } : {}),
    }),
    maxPp: seed.maxPp,
    gen1CriticalRate: seed.critical ?? "normal",
  }));
}

// --- 새 11종 -------------------------------------------------------------------
// 진화 라인 셋: 자갈콩→바위곰(바위·땅), 찌릿다람→번개꼬리(전기), 안개령→등롱귀(고스트).
// 나머지 다섯은 단일 종. 데모에 없던 타입(바위·땅·벌레·전기·독·격투·얼음·고스트)을 채운다.

export const SCARLOXY_EXTRA_SPECIES_SEEDS: readonly ScarloxyExtraSpeciesSeed[] = [
  {
    key: "pebblit", name: "자갈콩", types: ["rock", "ground"],
    stats: { maxHp: 22, maxMp: 5, attack: 11, defense: 15, mind: 6, agility: 5 }, captureRate: 0.5,
    moves: [{ level: 3, skillId: "skill_pkmn_rock" }, { level: 7, skillId: "skill_scarloxy_mud" }, { level: 11, skillId: "skill_scarloxy_rockslide" }],
    evolvesTo: { key: "bouldurr", level: 14 }, habitat: ["cave"], wildLevels: [5, 9],
    description: "동굴 바닥의 자갈처럼 굴러다니는 작은 돌 몬스터. 등의 이끼가 나이테다.",
  },
  {
    key: "bouldurr", name: "바위곰", types: ["rock", "ground"],
    stats: { maxHp: 50, maxMp: 8, attack: 21, defense: 23, mind: 9, agility: 7 }, captureRate: 0.12,
    moves: [{ level: 3, skillId: "skill_pkmn_rock" }, { level: 14, skillId: "skill_scarloxy_rockslide" }, { level: 18, skillId: "skill_scarloxy_quake" }],
    habitat: ["cave"], wildLevels: [14, 18],
    description: "바위를 겹쳐 쌓은 몸의 곰. 자갈콩이 오래 굴러 다듬어지면 이렇게 된다.",
  },
  {
    key: "zaplet", name: "찌릿다람", types: ["electric"],
    stats: { maxHp: 17, maxMp: 8, attack: 10, defense: 7, mind: 11, agility: 17 }, captureRate: 0.5,
    moves: [{ level: 3, skillId: "skill_scarloxy_spark" }, { level: 6, skillId: "skill_scarloxy_quick" }, { level: 10, skillId: "skill_scarloxy_wave" }],
    evolvesTo: { key: "voltail", level: 12 }, habitat: ["route"], wildLevels: [3, 7],
    description: "번개 모양 꼬리에 정전기를 모으는 다람쥐. 볼이 파랗게 튀면 조심.",
  },
  {
    key: "voltail", name: "번개꼬리", types: ["electric"],
    stats: { maxHp: 38, maxMp: 12, attack: 18, defense: 12, mind: 17, agility: 23 }, captureRate: 0.15,
    moves: [{ level: 3, skillId: "skill_scarloxy_spark" }, { level: 12, skillId: "skill_scarloxy_thunder_fang" }, { level: 16, skillId: "skill_scarloxy_wave" }],
    habitat: ["route"], wildLevels: [12, 16],
    description: "지그재그 꼬리로 번개를 끌어 쓰는 살쾡이. 찌릿다람이 진화한 모습.",
  },
  {
    key: "wispin", name: "안개령", types: ["ghost"],
    stats: { maxHp: 16, maxMp: 10, attack: 7, defense: 8, mind: 14, agility: 12 }, captureRate: 0.45,
    moves: [{ level: 3, skillId: "skill_scarloxy_shadow" }, { level: 8, skillId: "skill_scarloxy_mind" }],
    evolvesTo: { key: "lanterghast", level: 14 }, habitat: ["cave"], wildLevels: [6, 10],
    description: "동굴 안개에서 태어난 작은 혼. 머리의 불꽃이 꺼지면 잠든다.",
  },
  {
    key: "lanterghast", name: "등롱귀", types: ["ghost", "fire"],
    stats: { maxHp: 36, maxMp: 16, attack: 12, defense: 13, mind: 22, agility: 15 }, captureRate: 0.12,
    moves: [{ level: 3, skillId: "skill_scarloxy_shadow" }, { level: 14, skillId: "skill_scarloxy_will_o_wisp" }, { level: 18, skillId: "skill_scarloxy_ember" }],
    habitat: ["cave"], wildLevels: [14, 18],
    description: "종이 등롱에 혼불을 담아 다니는 유령. 길 잃은 사람을 반대쪽으로 안내한다.",
  },
  {
    key: "hornbeet", name: "뿔장수", types: ["bug", "fighting"],
    stats: { maxHp: 34, maxMp: 6, attack: 20, defense: 16, mind: 6, agility: 11 }, captureRate: 0.25,
    moves: [{ level: 3, skillId: "skill_scarloxy_bug" }, { level: 8, skillId: "skill_scarloxy_punch" }, { level: 12, skillId: "skill_scarloxy_horn_rush" }],
    habitat: ["route", "gym"], wildLevels: [8, 12],
    description: "커다란 뿔로 자기 몸무게의 백 배를 드는 장수풍뎅이.",
  },
  {
    key: "toxtoad", name: "독두꺼", types: ["poison"],
    stats: { maxHp: 30, maxMp: 8, attack: 13, defense: 13, mind: 13, agility: 9 }, captureRate: 0.35,
    moves: [{ level: 3, skillId: "skill_scarloxy_venom" }, { level: 7, skillId: "skill_scarloxy_splash" }, { level: 11, skillId: "skill_scarloxy_sludge" }],
    habitat: ["route", "beach"], wildLevels: [6, 11],
    description: "분홍 혹에서 독즙이 배어 나오는 두꺼비. 비 오는 날 늪가에 모인다.",
  },
  {
    key: "brawlape", name: "주먹숭이", types: ["fighting"],
    stats: { maxHp: 22, maxMp: 5, attack: 15, defense: 9, mind: 6, agility: 14 }, captureRate: 0.45,
    moves: [{ level: 3, skillId: "skill_scarloxy_punch" }, { level: 6, skillId: "skill_scarloxy_quick" }, { level: 10, skillId: "skill_scarloxy_brick" }],
    habitat: ["route", "gym"], wildLevels: [4, 9],
    description: "주먹에 붕대를 감고 하루 종일 섀도복싱하는 작은 원숭이.",
  },
  {
    key: "frostpip", name: "서리펭", types: ["ice"],
    stats: { maxHp: 21, maxMp: 9, attack: 10, defense: 10, mind: 13, agility: 11 }, captureRate: 0.45,
    moves: [{ level: 3, skillId: "skill_scarloxy_ice" }, { level: 7, skillId: "skill_scarloxy_splash" }, { level: 12, skillId: "skill_scarloxy_blizzard" }],
    habitat: ["beach", "cave"], wildLevels: [5, 10],
    description: "고드름 볏을 단 아기 펭귄. 목의 서리 고리가 녹으면 기운이 빠진다.",
  },
  {
    key: "sandscorp", name: "모래전갈", types: ["ground", "poison"],
    stats: { maxHp: 30, maxMp: 7, attack: 17, defense: 15, mind: 8, agility: 13 }, captureRate: 0.3,
    moves: [{ level: 3, skillId: "skill_scarloxy_mud" }, { level: 7, skillId: "skill_scarloxy_venom" }, { level: 12, skillId: "skill_scarloxy_quake" }],
    habitat: ["beach", "cave"], wildLevels: [8, 13],
    description: "모래 속에 숨어 보라색 독침만 내놓고 기다리는 전갈.",
  },
];

/** 데모 기존 19종의 키(scarloxyPokemonDemoGame.ts SPECIES_SEEDS, scarloxyPackManifest.json monsters). */
export const SCARLOXY_BASE_SPECIES_KEYS: readonly string[] = [
  "atrox", "charmadillo", "cindrill", "cleaf", "draem", "emberkit", "finiette", "finsta", "friolera", "gulfin",
  "ivieron", "jacana", "larvea", "mossling", "pluma", "plumette", "pouch", "puddlup", "sparchu",
];

export const SCARLOXY_EXTRA_SPECIES_KEYS: readonly string[] = SCARLOXY_EXTRA_SPECIES_SEEDS.map((seed) => seed.key);

/** 30종 전체 키(기존 19 + 새 11). */
export const SCARLOXY_ALL_SPECIES_KEYS: readonly string[] = [...SCARLOXY_BASE_SPECIES_KEYS, ...SCARLOXY_EXTRA_SPECIES_KEYS];

/** 데모와 같은 id 규칙(scarloxyPokemonDemoGame.ts scarloxySpeciesId). 순환 import 를 피하려고 복제했다. */
export function scarloxyExtraSpeciesId(key: string): string {
  return `species_scarloxy_${key}`;
}

export type ScarloxySpeciesResourceIds = {
  readonly front: string;
  readonly back: string;
  readonly icon: string;
  readonly cry: string;
};

/** 종 키 → 리소스 id 넷. 모두 src/assets/scarloxyPack.ts 에 등록돼 있다. */
export function scarloxySpeciesResourceIds(key: string): ScarloxySpeciesResourceIds {
  return {
    front: `scarloxy-monster-${key}`,
    back: `scarloxy-monster-${key}-back`,
    icon: `scarloxy-monster-icon-${key}`,
    cry: `scarloxy-cry-${key}`,
  };
}

/** 새 11종의 도감 레코드. 뒷모습까지 채워져 있다. */
export function createScarloxyExtraSpeciesRecords(): MonsterSpeciesRecord[] {
  return SCARLOXY_EXTRA_SPECIES_SEEDS.map((seed) => {
    const ids = scarloxySpeciesResourceIds(seed.key);
    return normalizeMonsterSpeciesRecord({
      id: scarloxyExtraSpeciesId(seed.key),
      name: seed.name,
      types: [...seed.types],
      graphic: { monsterResourceId: ids.front, backResourceId: ids.back, graphicHue: 0, transparent: false, flying: seed.key === "wispin" || seed.key === "lanterghast" },
      baseStats: { ...seed.stats },
      captureRate: Math.round(seed.captureRate * 255) / 255,
      // 데모 기존 종과 같은 저속 곡선.
      expCurve: { base: 2, extra: 1, acceleration: 1 },
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, ...seed.moves.map((move) => ({ ...move }))],
      evolutions: seed.evolvesTo
        ? [{ toSpeciesId: scarloxyExtraSpeciesId(seed.evolvesTo.key), requires: { level: seed.evolvesTo.level } }]
        : [],
    });
  });
}

/**
 * 종 레코드에 뒷모습을 붙인다. id 가 species_scarloxy_<key> 이고 key 가 30종 안에 있으며
 * 아직 뒷모습이 없는 종만 고친다(저자가 직접 고른 뒷모습은 건드리지 않는다). 고친 수를 돌려준다.
 */
export function applyScarloxyBackSprites(species: MonsterSpeciesRecord[]): number {
  const keys = new Set(SCARLOXY_ALL_SPECIES_KEYS);
  let changed = 0;
  for (const record of species) {
    const key = record.id.startsWith("species_scarloxy_") ? record.id.slice("species_scarloxy_".length) : "";
    if (!keys.has(key) || record.graphic.backResourceId) continue;
    record.graphic = { ...record.graphic, backResourceId: scarloxySpeciesResourceIds(key).back };
    changed += 1;
  }
  return changed;
}

/** 종 id → 울음소리 SE 리소스 id. 30종 밖이면 undefined. playSoundEffect(id, project) 로 튼다. */
export function scarloxySpeciesCryResourceId(speciesId: string): string | undefined {
  const key = speciesId.startsWith("species_scarloxy_") ? speciesId.slice("species_scarloxy_".length) : "";
  return SCARLOXY_ALL_SPECIES_KEYS.includes(key) ? scarloxySpeciesResourceIds(key).cry : undefined;
}

