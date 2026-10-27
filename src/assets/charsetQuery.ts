import {
  applyCharsetLabelOverrides,
  CHARSET_SEMANTICS,
  type CharsetAge,
  type CharsetGender,
  type CharsetSemanticEntry,
} from "@/assets/charsetSemantics";
import type { CharsetLabelOverride } from "@/project/types";
import { sharedCharacterSemantics } from '@/project/sharedCharacters';

type CharsetCategory = "actor" | "animal" | "monster" | "object" | "people" | "vehicle";

interface QueryIntent {
  readonly genders: ReadonlySet<Exclude<CharsetGender, "none">>;
  readonly ages: ReadonlySet<CharsetAge>;
  readonly tags: ReadonlySet<string>;
  readonly categories: ReadonlySet<CharsetCategory>;
}

export interface NpcGraphicMatch {
  readonly entry: CharsetSemanticEntry;
  readonly score: number;
}

const LEGACY_CATEGORY_ALIASES: ReadonlyMap<string, CharsetCategory> = new Map([
  ["actor", "actor"],
  ["hero", "actor"],
  ["영웅", "actor"],
  ["주인공", "actor"],
  ["animal", "animal"],
  ["동물", "animal"],
  ["monster", "monster"],
  ["enemy", "monster"],
  ["몬스터", "monster"],
  ["적", "monster"],
  ["object", "object"],
  ["오브젝트", "object"],
  ["사물", "object"],
  ["people", "people"],
  ["npc", "people"],
  ["human", "people"],
  ["villager", "people"],
  ["사람", "people"],
  ["주민", "people"],
  ["마을 사람", "people"],
  ["vehicle", "vehicle"],
  ["vehicles", "vehicle"],
  ["탈것", "vehicle"],
]);

const SYNONYMS: readonly {
  readonly terms: readonly string[];
  readonly gender?: Exclude<CharsetGender, "none">;
  readonly age?: CharsetAge;
  readonly tags?: readonly string[];
  readonly category?: CharsetCategory;
}[] = [
  { terms: ["old woman", "elder woman", "할머니", "노파"], gender: "female", age: "elder", tags: ["할머니", "노인", "여성"] },
  { terms: ["old man", "elder man", "할아버지", "노인 남성"], gender: "male", age: "elder", tags: ["노인", "남성"] },
  { terms: ["아줌마"], gender: "female", age: "middle", tags: ["여성", "중년"] },
  { terms: ["아저씨"], gender: "male", age: "middle", tags: ["남성", "중년"] },
  { terms: ["소녀", "girl"], gender: "female", age: "child", tags: ["소녀", "아이", "어린이"] },
  { terms: ["소년", "boy"], gender: "male", age: "child", tags: ["소년", "아이", "어린이"] },
  { terms: ["여자", "여성", "woman", "female"], gender: "female", tags: ["여성"] },
  { terms: ["남자", "남성", "man", "male"], gender: "male", tags: ["남성"] },
  { terms: ["아이", "어린이", "kid", "child"], age: "child", tags: ["아이", "어린이"] },
  { terms: ["청년", "youth", "young"], age: "youth", tags: ["청년"] },
  { terms: ["중년", "middle aged", "middle-aged"], age: "middle", tags: ["중년"] },
  { terms: ["노인", "elder", "old", "aged"], age: "elder", tags: ["노인"] },
  { terms: ["merchant", "shopkeeper", "상인", "여관 주인", "여관주인"], tags: ["상인", "여관", "여관주인"] },
  { terms: ["soldier", "guard", "병사"], tags: ["병사"] },
  { terms: ["knight", "기사"], tags: ["기사"] },
  { terms: ["priest", "cleric", "사제", "성직자"], tags: ["사제", "성직자"] },
  { terms: ["monk", "승려"], tags: ["승려"] },
  { terms: ["wizard", "mage", "마법사"], tags: ["마법사"] },
  { terms: ["king", "국왕"], tags: ["왕", "국왕"] },
  { terms: ["golem", "골렘"], tags: ["골렘"] },
  { terms: ["warrior", "fighter", "전사"], tags: ["전사"] },
  { terms: ["villager", "resident", "주민"], category: "people", tags: ["주민"] },
  { terms: ["actor", "hero", "영웅", "주인공"], category: "actor" },
  { terms: ["animal", "동물"], category: "animal" },
  { terms: ["monster", "enemy", "몬스터", "적"], category: "monster" },
];

const DEFAULT_CATEGORY_ORDER: readonly CharsetCategory[] = ["people", "actor", "animal", "monster", "object", "vehicle"];

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function englishTokens(normalized: string): ReadonlySet<string> {
  return new Set(normalized.match(/[a-z0-9]+/g) ?? []);
}

function hasTerm(normalized: string, tokens: ReadonlySet<string>, term: string): boolean {
  const normalizedTerm = normalizeQuery(term);
  if (!normalizedTerm) return false;
  if (/^[a-z0-9-]+(?: [a-z0-9-]+)*$/.test(normalizedTerm)) {
    const words = normalizedTerm.split(" ");
    if (words.length === 1) return tokens.has(words[0] as string);
    return normalized.includes(normalizedTerm);
  }
  return normalized.includes(normalizedTerm);
}

function textureShortKey(textureKey: string): string {
  return textureKey.replace(/^tex_easyrpg_charset_/, "");
}

/** CT·FF6풍 영웅 칩(Heroes1~) — 주인공·동료 후보로 먼저 보여 준다. */
function isHeroesEntry(entry: CharsetSemanticEntry): boolean {
  return entry.textureKey.startsWith("tex_oprn_charset_heroes");
}

/** 영웅·주인공 질의에서 Heroes 칩이 RTP Actor 칩보다 앞에 오게 하는 가산점(순위 점수 1 미만의 index 보정보다 훨씬 크다). */
const HEROES_FIRST_BONUS = 150;

function categoryOf(entry: CharsetSemanticEntry): CharsetCategory {
  if (entry.spriteType === 'uploaded') return entry.tags.includes('몬스터') ? 'monster' : entry.tags.includes('동물') ? 'animal' : 'people';
  if (entry.textureKey.startsWith('tex_scarloxy_charset_people') || entry.textureKey.startsWith('tex_oprn_charset_scarloxy_people')) return 'people';
  // 현대 연애 칩(Modern1~3)은 전부 사람이다. 이게 빠지면 "villager"/"npc" 같은 일반 질의가 0건이 된다.
  if (entry.textureKey.startsWith('tex_oprn_charset_modern')) return 'people';
  // CT·FF6풍 영웅 칩(Heroes1)은 주인공·동료 칩이다 — "hero"/"actor"/"주인공" 같은 일반 질의에 RTP Actor 와 같은 분류로 나와야 한다.
  // 전엔 아래에서 「object」로 떨어져 한 번도 검색되지 않았다(jrpg-real-1 J02).
  if (isHeroesEntry(entry)) return 'actor';
  if (entry.textureKey.startsWith('tex_farming_charset_')) return 'animal';
  const shortKey = textureShortKey(entry.textureKey);
  const base = shortKey.replace(/\d+$/, "");
  if (base === "vehicles") return "vehicle";
  if (base === "vehicle") return "vehicle";
  if (base === "actor" || base === "animal" || base === "monster" || base === "object" || base === "people") return base;
  return "object";
}

function directTextureAlias(normalized: string, catalog: readonly CharsetSemanticEntry[]): string | null {
  // "heroes"·"heroes1" — CT·FF6풍 영웅 칩 시트 전체(번들 접두사가 달라 아래 짧은 키 비교에 안 걸린다).
  const heroesAlias = /^heroes(\d*)$/u.exec(normalized);
  if (heroesAlias) {
    const key = `tex_oprn_charset_heroes${heroesAlias[1] || "1"}`;
    if (catalog.some((entry) => entry.textureKey === key)) return key;
  }
  for (const entry of catalog) {
    const shortKey = textureShortKey(entry.textureKey).toLowerCase();
    if (normalized === entry.textureKey.toLowerCase()) return entry.textureKey;
    // "animal" is the whole category, not just the RTP Animal.png sheet.
    if (!LEGACY_CATEGORY_ALIASES.has(normalized) && normalized === shortKey) return entry.textureKey;
  }
  return null;
}

function intentFromQuery(normalized: string): QueryIntent {
  const tokens = englishTokens(normalized);
  const genders = new Set<Exclude<CharsetGender, "none">>();
  const ages = new Set<CharsetAge>();
  const tags = new Set<string>();
  const categories = new Set<CharsetCategory>();
  for (const synonym of SYNONYMS) {
    if (!synonym.terms.some((term) => hasTerm(normalized, tokens, term))) continue;
    if (synonym.gender) genders.add(synonym.gender);
    if (synonym.age) ages.add(synonym.age);
    if (synonym.category) categories.add(synonym.category);
    for (const tag of synonym.tags ?? []) tags.add(tag);
  }
  return { genders, ages, tags, categories };
}

function textMatchScore(term: string, entry: CharsetSemanticEntry): number {
  const normalized = normalizeQuery(term);
  if (!normalized) return 0;
  const label = entry.label.toLowerCase();
  // 한 글자 낱말은 부분 일치를 주지 않는다 — 「용」이 「청년 용사」를, 「돌」이 「떠돌이 검객」을, 「왕」이 「여왕」을
  // 고르던 원인이다(2026-09-27 전수 조사). 한 글자는 라벨 낱말·태그와 정확히 같을 때만 맞는다.
  const partial = normalized.length >= 2;
  const labelWords = label.split(/[\s()（）·,/]+/u).filter(Boolean);
  let score = 0;
  if (label === normalized) score += 120;
  else if (labelWords.includes(normalized) || (partial && label.includes(normalized))) score += 55;
  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === normalized) score += 45;
    else if (partial && tagLower.includes(normalized)) score += 20;
  }
  if (entry.appearance && appearanceHits(normalized, entry.appearance)) score += 12;
  return score;
}

/**
 * 외형 문장(그림을 보고 적은 머리·옷·색)에서 찾는다. 색 낱말은 한 글자(흰·검은)거나 말이 달라(하얀·새하얀·백색) 그대로는 안 맞는다 —
 * 「하얀 드레스」 질의가 0건이라 조수가 이름 비슷한 분홍 드레스 공주를 골랐다(2026-10-25 심사 J41). 색은 같은 무리 낱말이면 맞는다.
 */
const COLOUR_GROUPS: readonly (readonly string[])[] = [
  ["흰", "하얀", "새하얀", "흰색", "하양", "백색", "white"],
  ["검은", "까만", "새까만", "검정", "흑색", "black"],
  ["빨간", "붉은", "빨강", "적색", "red"],
  ["파란", "푸른", "파랑", "청색", "blue"],
  ["노란", "노랑", "황색", "yellow"],
  ["초록", "녹색", "연두", "green"],
  ["분홍", "핑크", "pink"],
  ["보라", "자주", "자줏빛", "purple"],
  ["갈색", "밤색", "brown"],
  ["회색", "잿빛", "grey", "gray"],
  ["금발", "노란 머리", "blonde"],
];
export function colourGroupOf(word: string): readonly string[] | undefined {
  const w = word.toLowerCase();
  return COLOUR_GROUPS.find((group) => group.includes(w));
}
function appearanceHits(term: string, appearance: string): boolean {
  const text = appearance.toLowerCase();
  const words = text.split(/[\s,.·()/]+/u).filter(Boolean);
  const group = colourGroupOf(term);
  if (group) return group.some((colour) => colour.length >= 2 ? text.includes(colour) : words.some((word) => word === colour || word.startsWith(colour)));
  return term.length >= 2 ? text.includes(term) : words.includes(term);
}

/** 질의에서 성별·나이·역할 같은 의도로 읽힌 낱말 — 라벨에 없어도 의도 검사를 통과했으면 맞은 것으로 친다. */
function intentWords(normalized: string): ReadonlySet<string> {
  const tokens = englishTokens(normalized);
  const words = new Set<string>();
  for (const synonym of SYNONYMS) {
    for (const term of synonym.terms) {
      if (hasTerm(normalized, tokens, term)) normalizeQuery(term).split(" ").forEach((word) => words.add(word));
    }
  }
  return words;
}

function tagScore(tags: ReadonlySet<string>, entry: CharsetSemanticEntry): number {
  let score = 0;
  for (const tag of tags) {
    score += textMatchScore(tag, entry);
  }
  return score;
}

function satisfiesIntent(entry: CharsetSemanticEntry, intent: QueryIntent): boolean {
  if (intent.genders.size > 0) {
    if (entry.gender === undefined || entry.gender === "none" || !intent.genders.has(entry.gender)) return false;
  }
  if (intent.ages.size > 0) {
    if (entry.age === undefined || !intent.ages.has(entry.age)) return false;
  }
  if (intent.categories.size > 0 && !intent.categories.has(categoryOf(entry))) return false;
  return true;
}

function intentScore(entry: CharsetSemanticEntry, intent: QueryIntent): number {
  let score = 0;
  if (entry.gender && entry.gender !== "none" && intent.genders.has(entry.gender)) score += 90;
  if (entry.age && intent.ages.has(entry.age)) score += 90;
  if (intent.categories.has(categoryOf(entry))) score += 45;
  if (intent.categories.has("actor") && isHeroesEntry(entry)) score += HEROES_FIRST_BONUS;
  score += tagScore(intent.tags, entry);
  return score;
}

/**
 * 장르 잠금(캐릭터 칩) 중 조수 도구 실행이 걷는 동안만 켜지는 카탈로그 필터. 켜져 있으면 허용 칩만 검색·기본 선택에 나온다.
 * 동기 실행 구간에서만 쓴다(try/finally 로 되돌린다) — 중간에 await 하는 비동기 도구에는 걸지 않는다.
 */
let activeCatalogFilter: ((entry: CharsetSemanticEntry) => boolean) | undefined;

export function withNpcGraphicCatalogFilter<T>(filter: ((entry: CharsetSemanticEntry) => boolean) | undefined, run: () => T): T {
  const previous = activeCatalogFilter;
  activeCatalogFilter = filter;
  try { return run(); } finally { activeCatalogFilter = previous; }
}

/** 지금 장르 잠금이 그림 검색을 허용 칩으로 좁히고 있는가(검색 실패 안내 문구가 갈린다). */
export function npcGraphicCatalogIsFiltered(): boolean {
  return activeCatalogFilter !== undefined;
}

function catalogFor(overrides?: readonly CharsetLabelOverride[]): readonly CharsetSemanticEntry[] {
  const all = applyCharsetLabelOverrides([...CHARSET_SEMANTICS, ...sharedCharacterSemantics()], overrides);
  return activeCatalogFilter ? all.filter(activeCatalogFilter) : all;
}

function exactAliasMatches(normalized: string, catalog: readonly CharsetSemanticEntry[]): NpcGraphicMatch[] | null {
  const textureKey = directTextureAlias(normalized, catalog);
  if (textureKey) {
    return catalog
      .filter((entry) => entry.textureKey === textureKey)
      .map((entry, index) => ({ entry, score: 1000 - index }));
  }
  const category = LEGACY_CATEGORY_ALIASES.get(normalized);
  if (!category) return null;
  const intent = intentFromQuery(normalized);
  return catalog
    .filter((entry) => categoryOf(entry) === category)
    .map((entry, index) => ({ entry, score: 700 + intentScore(entry, intent) - index / 100 + (category === "actor" && isHeroesEntry(entry) ? HEROES_FIRST_BONUS : 0) }))
    .sort((a, b) => b.score - a.score);
}

function defaultNpcGraphics(catalog: readonly CharsetSemanticEntry[] = CHARSET_SEMANTICS): NpcGraphicMatch[] {
  const byCategory = new Map(DEFAULT_CATEGORY_ORDER.map((category, index) => [category, index]));
  return catalog
    .map((entry, index) => ({
      entry,
      score: 100 - (byCategory.get(categoryOf(entry)) ?? 99) * 10 - index / 100,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Complete semantic matches; resource pagination must not lose entries after 100. */
export function findNpcGraphicMatches(
  query: string | undefined,
  overrides?: readonly CharsetLabelOverride[],
): NpcGraphicMatch[] {
  const catalog = catalogFor(overrides);
  const normalized = normalizeQuery(query ?? "");
  if (!normalized || normalized === "*" || normalized === "all" || normalized === "전체") {
    return defaultNpcGraphics(catalog);
  }
  const exactAlias = exactAliasMatches(normalized, catalog);
  if (exactAlias) return exactAlias;
  // 라벨과 글자 그대로 같은 칸이 있으면 그 칸이 답이다. 성별·나이 의도 필터를 거치면 「금발 소년」(나이 youth)이
  // 「소년=child」 의도에 걸려 자기 이름으로도 안 나온다(2026-09-27 전수 조사).
  const exactLabel = catalog.filter((entry) => entry.label.toLowerCase() === normalized);
  if (exactLabel.length > 0) return exactLabel.map((entry, index) => ({ entry, score: 2000 - index }));

  const intent = intentFromQuery(normalized);
  const queryTerms = normalized.split(/\s+/).filter((term) => term.length > 0);
  const intentTerms = intentWords(normalized);
  const termHitsEntry = (term: string, entry: CharsetSemanticEntry): boolean =>
    intentTerms.has(term) || textMatchScore(term, entry) > 0;
  const strict = catalog
    .map((entry) => {
      if (!satisfiesIntent(entry, intent)) return { entry, score: 0 };
      // 여러 낱말 질의는 낱말마다 이 칸을 가리켜야 한다. 하나만 맞아도 채택하면 「고양이 석상」이 살아 있는
      // 고양이가, 「강철 문」이 나무 문이 된다(2026-09-27 전수 조사). 성별·나이 같은 의도 낱말은 위에서 걸렀다.
      if (queryTerms.length > 1 && !queryTerms.every((term) => termHitsEntry(term, entry))) return { entry, score: 0 };
      const wholeTextScore = textMatchScore(normalized, entry);
      const splitTextScore = wholeTextScore > 0 ? 0 : queryTerms.reduce((sum, term) => sum + textMatchScore(term, entry), 0);
      return { entry, score: intentScore(entry, intent) + wholeTextScore + splitTextScore };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  if (strict.length > 0 || queryTerms.length < 2) return strict;
  // 모든 낱말을 가진 칸이 없으면 «가장 많은 낱말이 맞는 칸»을 준다(성별·나이 의도는 그대로 지킨다).
  // 왜(2026-10-25 심사 J66): 「하얀 드레스 여자 유령」이 0건이라 조수가 「유령」 한 낱말로 다시 찾아 만화풍 흰 시트 유령을
  // 하얀 드레스 여자 자리에 놓았다 — 판정자 눈에 고무 오리였다. 의도 낱말이 아닌 낱말이 하나는 맞아야 한다.
  const described = queryTerms.filter((term) => !intentTerms.has(term));
  return catalog
    .map((entry) => {
      if (!satisfiesIntent(entry, intent)) return { entry, score: 0 };
      const hits = described.filter((term) => textMatchScore(term, entry) > 0);
      if (hits.length === 0) return { entry, score: 0 };
      return { entry, score: hits.length * 100 + intentScore(entry, intent) + hits.reduce((sum, term) => sum + textMatchScore(term, entry), 0) };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** 질의 낱말 중 이 칸이 가리키지 않는 것(부분 일치로 고른 칸이면 비어 있지 않다). 성별·나이 의도 낱말은 맞은 것으로 친다. */
export function unmatchedNpcGraphicTerms(query: string, entry: CharsetSemanticEntry): string[] {
  const normalized = normalizeQuery(query);
  const intentTerms = intentWords(normalized);
  return normalized.split(/\s+/).filter((term) => term && !intentTerms.has(term) && textMatchScore(term, entry) <= 0);
}

/** 사람(여자·소녀·부인…)이 유령인 인물 — 사람 칩에 반투명 빛(blendMode add)으로 그린다. 시트 유령 몬스터 칩이 아니다. */
export const GHOST_WORDS = /유령|귀신|원령|망령|혼령|ghost|phantom|spirit/iu;
export const PERSON_WORDS = /여자|여성|남자|남성|소녀|소년|아이|아가씨|부인|아주머니|할머니|할아버지|노인|신부|하녀|메이드|언니|누나|엄마|어머니|아버지|사람|woman|girl|boy|man|lady|bride|maid/iu;

export function queryNpcGraphics(query: string | undefined, limit = 20, overrides?: readonly CharsetLabelOverride[]): NpcGraphicMatch[] {
  const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return findNpcGraphicMatches(query, overrides).slice(0, cappedLimit);
}

export function resolveNpcGraphic(
  query: string,
  overrides?: readonly CharsetLabelOverride[],
): CharsetSemanticEntry | null {
  return queryNpcGraphics(query, 1, overrides)[0]?.entry ?? null;
}

export type NpcGraphicPickOptions = {
  /** 맵에 이미 쓴 textureKey#characterIndex — 가능하면 피한다. */
  readonly avoidKeys?: ReadonlySet<string>;
  /** 안정 샘플링용 시드 (이름+좌표 등). 없으면 1등 고정. */
  readonly seed?: string;
  /** 시드 샘플 시 top-K 후보 (기본 8). */
  readonly sampleTopK?: number;
  readonly overrides?: readonly CharsetLabelOverride[];
};

export function charsetGraphicKey(entry: Pick<CharsetSemanticEntry, "textureKey" | "characterIndex">): string {
  return `${entry.textureKey}#${entry.characterIndex}`;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 일반 주민 별칭 — 1등 고정이면 전부 people1#0으로 몰린다. */
export function isGenericNpcGraphicQuery(query: string): boolean {
  const n = normalizeQuery(query);
  return n === "villager" || n === "npc" || n === "human" || n === "people"
    || n === "사람" || n === "주민" || n === "마을 사람";
}

/**
 * 맵 내 중복을 피하고, 일반 query(+seed)면 top-K에서 안정 샘플한다.
 * 구체 역할(상인/기사…)은 1등 유지 + avoid만 적용.
 */
export function pickNpcGraphic(query: string, options: NpcGraphicPickOptions = {}): CharsetSemanticEntry | null {
  const topK = Math.max(1, Math.min(24, options.sampleTopK ?? 8));
  const poolLimit = Math.max(topK, 16);
  let matches = queryNpcGraphics(query, poolLimit, options.overrides);
  if (matches.length === 0) return null;

  const avoid = options.avoidKeys;
  if (avoid && avoid.size > 0) {
    // 라벨이 질의와 정확히 같은 칸이 있으면 그 칸들 안에서만 피한다 — 맵에 왕이 이미 있다고 「왕」 요청에
    // 여왕을 주면 안 된다(2026-09-27 전수 조사). 같은 그림을 두 번 쓰는 편이 다른 인물로 바꾸는 것보다 낫다.
    const wanted = normalizeQuery(query);
    const exact = matches.filter((m) => m.entry.label.toLowerCase() === wanted);
    const pool = exact.length > 0 ? exact : matches;
    const filtered = pool.filter((m) => !avoid.has(charsetGraphicKey(m.entry)));
    if (filtered.length > 0) matches = filtered;
    else if (exact.length > 0) matches = exact;
  }

  const generic = isGenericNpcGraphicQuery(query);
  if (!generic || !options.seed) return matches[0]!.entry;

  const pool = matches.slice(0, Math.min(topK, matches.length));
  const idx = hashSeed(options.seed) % pool.length;
  return pool[idx]!.entry;
}

export function npcGraphicExampleLabels(limit = 12): string[] {
  return (activeCatalogFilter ? defaultNpcGraphics(catalogFor()) : defaultNpcGraphics()).slice(0, limit).map((match) => match.entry.label);
}

/**
 * CT·FF6·클래식 JRPG 조수 안내 — 영웅 칩(Heroes1)이 지금 카탈로그에 보일 때만 한 줄을 돌려준다.
 * 장르 잠금(몬스터·연애)이 카탈로그를 좁혀 영웅 칩이 안 보이면 null — 잠긴 장르에는 권하지 않는다.
 * list_resources(charset)·list_npc_graphics 가 응답에 싣는다(jrpg-real-1 J02: RTP Actor 만 고르고 Heroes1 을 한 번도 안 썼다).
 */
export function jrpgHeroesCharsetHint(overrides?: readonly CharsetLabelOverride[], query?: string): string | null {
  // 특정 인물을 찾는 질의(할머니·골렘…)에는 군더더기다 — 기본 목록·주인공·영웅·동료·JRPG 질의에만 싣는다.
  const q = normalizeQuery(query ?? "");
  if (q && q !== "*" && q !== "all" && q !== "전체" && !/hero|actor|주인공|영웅|용사|동료|party|파티|companion|jrpg|시간여행|crono|chrono|ff6|크로노/u.test(q)) return null;
  const heroes = catalogFor(overrides).filter(isHeroesEntry);
  if (heroes.length === 0) return null;
  const list = heroes.map((entry) => `${entry.characterIndex}=${entry.label}`).join(", ");
  return `JRPG(크로노 트리거·FF6·클래식)를 만드는 중이면 주인공·동료·주요 NPC 칩은 RTP Actor 보다 CT·FF6풍 영웅 칩 Heroes1 을 먼저 고른다 — `
    + `textureKey ${heroes[0]!.textureKey}, characterIndex ${list}. query:"heroes" 로 전체를 본다. `
    + `Heroes1 에는 짝 얼굴이 없으니 faceResourceId 는 list_resources(kind:"faceset") 에서 성별·머리색이 비슷한 얼굴을 고르거나 생략한다. 현대·연애·몬스터 수집 게임에는 해당 없다.`;
}
