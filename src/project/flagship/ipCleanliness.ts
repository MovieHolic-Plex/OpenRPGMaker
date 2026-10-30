/**
 * 출하되는 플레이어 JSON(`<id>.play.json`)의 원작 IP 고유명 검사.
 *
 * 왜: 대표 데모는 판매·공개용이다. 원작 고유명(해리포터풍 학교 이름·기숙사, 다른 게임 주인공 이름 등)이
 * 플레이어가 보는 글에 새면 안 된다. 기존 validateFlagshipIpCleanliness 는 맵 JSON 만 훑었다.
 * 이 검사는 prepareWebExport 가 만든 그대로의 출하 JSON 에서 «플레이어에게 보이는 글»만 걷는다.
 * 타일셋 정의·참고문서·에셋 목록은 걷지 않는다(번들 타일셋은 bundledTilesetRef 포인터로만 들어간다).
 */
import { BANNED_IP_PROPER_NOUNS, FLAGSHIP_STYLE_LOCKS } from "./beats";
import type { FlagshipDemoId } from "./types";

/** 공개 팩용 일반 낱말(원작 고유명 → 일반 말). scripts/store/seedBundles.mts 가 가져다 쓴다. */
export const WIZARDING_SCRUB_PAIRS: readonly (readonly [string, string])[] = [
  ["해리포터풍", "마법 학교풍"], ["해리포터", "마법 학교"], ["호그와트풍", "마법 학교풍"], ["호그와트", "마법 학교"],
  ["그리핀도르", "붉은 사자 기숙사"], ["슬리데린", "초록 뱀 기숙사"], ["래번클로", "푸른 독수리 기숙사"], ["후플푸프", "노란 오소리 기숙사"],
  ["퀴디치", "빗자루 공놀이"], ["허니듀크", "마법 과자점"], ["호그스미드", "마법 마을"], ["다이애건 앨리", "마법 상점가"], ["다이애건", "마법 상점가"],
  ["올리밴더", "지팡이 장인"], ["HP 테마", "마법 학교 테마"], ["세스트랄", "해골 날개말"], ["스니치", "금빛 날개공"], ["블러저", "쇠공"], ["쿼플", "붉은 공"],
];

/** 스토어 공개 팩이 원작 기숙사 이름 자리에 넣는 대체 기숙사 이름(위 목록의 4 기숙사 항목 오른쪽). */
const STORE_HOUSE_NAMES: readonly string[] = ["붉은 사자 기숙사", "초록 뱀 기숙사", "푸른 독수리 기숙사", "노란 오소리 기숙사"];

/**
 * 마법 학교(해리포터풍) 원작 고유명 — WIZARDING_SCRUB_PAIRS 의 왼쪽 낱말 + 스토어 대체 기숙사 이름.
 * 「HP 테마」처럼 고유명이 아닌 상품 문구와 겹치는 줄은 왼쪽 그대로 들어간다(출하 글에 나오면 어차피 잘못이다).
 */
export const WIZARDING_ORIGINAL_NAMES: readonly string[] = [
  ...new Set([...WIZARDING_SCRUB_PAIRS.map(([from]) => from), ...STORE_HOUSE_NAMES]),
];

/** 플레이어에게 보이는 글이 사는 최상위 키. 그 밖(tilesets·assets·aiDocuments·world* 등)은 걷지 않는다. */
const PLAYER_VISIBLE_ROOTS = [
  "meta", "maps", "database", "endings", "commonEvents", "quests", "system", "characters", "journal", "oprnStoryJournal", "terms",
] as const;

/** 걷는 가지 안에서도 플레이어에게 안 보이는 키. */
const SKIPPED_KEYS: ReadonlySet<string> = new Set([
  "bundledTilesetRef", "referenceDocuments", "audioDescriptions", "monsterMetadata", "aiDocuments", "aiInstructions",
]);

export interface ShippedPlayJsonHit {
  /** 예: `maps.fs_hub.events[2].pages[0].commands[5].text` */
  readonly path: string;
  readonly noun: string;
}

function nounsFor(id: FlagshipDemoId | string): readonly string[] {
  const lock = (FLAGSHIP_STYLE_LOCKS as Readonly<Record<string, { readonly bannedProperNouns: readonly string[] } | undefined>>)[id];
  return [...new Set([...(lock?.bannedProperNouns ?? []), ...BANNED_IP_PROPER_NOUNS, ...WIZARDING_ORIGINAL_NAMES])];
}

function walk(value: unknown, path: string, nouns: readonly string[], hits: ShippedPlayJsonHit[]): void {
  if (typeof value === "string") {
    for (const noun of nouns) if (value.includes(noun)) hits.push({ path, noun });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, nouns, hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIPPED_KEYS.has(key)) continue;
      walk(child, path ? `${path}.${key}` : key, nouns, hits);
    }
  }
}

/**
 * 출하 play.json 텍스트에서 원작 고유명이 들어간 «플레이어에게 보이는 글»을 찾는다(없으면 빈 배열).
 * 검사 낱말 = 그 데모 styleLock.bannedProperNouns + 전역 목록 + WIZARDING_ORIGINAL_NAMES.
 */
export function validateShippedPlayJson(id: FlagshipDemoId | string, playJsonText: string): readonly ShippedPlayJsonHit[] {
  return findOriginalIpNames(JSON.parse(playJsonText), nounsFor(id));
}

/**
 * 이미 파싱된 프로젝트·play.json 객체에서 낱말 목록이 들어간 «플레이어에게 보이는 글»을 찾는다.
 * run_lint 의 original-ip-name 경고(조수가 부를 수 있는 길)와 validateShippedPlayJson 이 같은 걷기를 쓴다.
 */
export function findOriginalIpNames(root: unknown, nouns: readonly string[]): readonly ShippedPlayJsonHit[] {
  const hits: ShippedPlayJsonHit[] = [];
  if (!root || typeof root !== "object") return hits;
  const record = root as Record<string, unknown>;
  for (const key of PLAYER_VISIBLE_ROOTS) {
    if (record[key] !== undefined) walk(record[key], key, nouns, hits);
  }
  return hits;
}
