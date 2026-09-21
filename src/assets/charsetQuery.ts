import {
  applyCharsetLabelOverrides,
  CHARSET_SEMANTICS,
  type CharsetAge,
  type CharsetGender,
  type CharsetSemanticEntry,
} from "@/assets/charsetSemantics";
import type { CharsetLabelOverride } from "@/project/types";

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

function categoryOf(entry: CharsetSemanticEntry): CharsetCategory {
  const shortKey = textureShortKey(entry.textureKey);
  const base = shortKey.replace(/\d+$/, "");
  if (base === "vehicles") return "vehicle";
  if (base === "vehicle") return "vehicle";
  if (base === "actor" || base === "animal" || base === "monster" || base === "object" || base === "people") return base;
  return "object";
}

function directTextureAlias(normalized: string): string | null {
  for (const entry of CHARSET_SEMANTICS) {
    const shortKey = textureShortKey(entry.textureKey).toLowerCase();
    if (normalized === shortKey || normalized === entry.textureKey.toLowerCase()) return entry.textureKey;
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
  let score = 0;
  if (label === normalized) score += 120;
  else if (label.includes(normalized)) score += 55;
  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    if (tagLower === normalized) score += 45;
    else if (tagLower.includes(normalized)) score += 20;
  }
  if (normalized.length >= 2 && entry.appearance?.toLowerCase().includes(normalized)) score += 12;
  return score;
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
  score += tagScore(intent.tags, entry);
  return score;
}

function catalogFor(overrides?: readonly CharsetLabelOverride[]): readonly CharsetSemanticEntry[] {
  return applyCharsetLabelOverrides(CHARSET_SEMANTICS, overrides);
}

function exactAliasMatches(normalized: string, catalog: readonly CharsetSemanticEntry[]): NpcGraphicMatch[] | null {
  const textureKey = directTextureAlias(normalized);
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
    .map((entry, index) => ({ entry, score: 700 + intentScore(entry, intent) - index / 100 }));
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

export function queryNpcGraphics(
  query: string | undefined,
  limit = 20,
  overrides?: readonly CharsetLabelOverride[],
): NpcGraphicMatch[] {
  const catalog = catalogFor(overrides);
  const normalized = normalizeQuery(query ?? "");
  const cappedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  if (!normalized || normalized === "*" || normalized === "all" || normalized === "전체") {
    return defaultNpcGraphics(catalog).slice(0, cappedLimit);
  }
  const exactAlias = exactAliasMatches(normalized, catalog);
  if (exactAlias) return exactAlias.slice(0, cappedLimit);

  const intent = intentFromQuery(normalized);
  const queryTerms = normalized.split(/\s+/).filter((term) => term.length > 0);
  return catalog
    .map((entry) => {
      if (!satisfiesIntent(entry, intent)) return { entry, score: 0 };
      const wholeTextScore = textMatchScore(normalized, entry);
      const splitTextScore = wholeTextScore > 0 ? 0 : queryTerms.reduce((sum, term) => sum + textMatchScore(term, entry), 0);
      return { entry, score: intentScore(entry, intent) + wholeTextScore + splitTextScore };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, cappedLimit);
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
    const filtered = matches.filter((m) => !avoid.has(charsetGraphicKey(m.entry)));
    if (filtered.length > 0) matches = filtered;
  }

  const generic = isGenericNpcGraphicQuery(query);
  if (!generic || !options.seed) return matches[0]!.entry;

  const pool = matches.slice(0, Math.min(topK, matches.length));
  const idx = hashSeed(options.seed) % pool.length;
  return pool[idx]!.entry;
}

export function npcGraphicExampleLabels(limit = 12): string[] {
  return defaultNpcGraphics().slice(0, limit).map((match) => match.entry.label);
}
