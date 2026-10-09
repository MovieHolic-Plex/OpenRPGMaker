// assets/bgmThemeRecommendation.ts
// 맵 테마/이름 → CC0 BGM 카탈로그 곡. AI 맵 생성(generate_map / create_map)이
// 마을·숲·동굴에 같은 기본곡을 꽂지 않도록, 곡 설명을 보고 시드로 고른다.
//
// 규칙:
//   1) 테마 키워드가 있으면 그 낱말을 제목·카테고리·태그·기획문(brief)·청취 설명에서 찾는다.
//   2) 키워드가 없으면 맵 이름의 한글 조각을 같은 설명에서 찾는다(항구·여관처럼 테마 낱말에 없는 장소).
//   3) 그래도 없으면 필드 카테고리로 폴백한다. 맞는 곡이 하나도 없을 때만 스타터.
//   4) 심리스 루프를 우선한다. 순수 함수. Math.random 없음(mulberry32). 예외를 던지지 않는다.
//
// 청취 초안은 음색이고 기획문은 장면이라 둘 다 본다. 프로젝트 설명(overrides)이 있으면
// 그 곡의 청취 초안 대신 프로젝트 설명을 쓴다.

import { getAudioAiDescription } from "@/assets/audioAiDescriptions";
import { BGM_CATALOG, type BgmCatalogTrack } from "@/assets/bgmCatalog";
import { bgmCatalogResourceIds, findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { isCatalogBgmAvailable } from './audioResourceCatalog';
import { mulberry32 } from "@/util/rng";

export type MapBgmRecommendOptions = {
  /** 프로젝트에 덮어쓴 음악 설명. 키는 리소스 id. 있으면 그 곡의 청취 초안을 대체한다. */
  readonly descriptions?: Readonly<Record<string, string>>;
  /** 맵 이름에서 설명을 못 찾을 때 쓸 테마(generate_map 의 village/forest/cave). */
  readonly fallbackTheme?: string;
};

type MapBgmTheme = "village" | "forest" | "cave" | "dungeon" | "night" | "battle" | "field";

type ThemeRule = {
  readonly theme: MapBgmTheme;
  readonly keywords: readonly string[];
  readonly categoryNeedles: readonly string[];
};

const THEME_RULES: readonly ThemeRule[] = [
  {
    theme: "battle",
    keywords: ["battle", "combat", "boss", "전투", "보스"],
    categoryNeedles: ["전투", "보스"],
  },
  {
    theme: "night",
    keywords: ["night", "야간", "밤"],
    categoryNeedles: ["야간 · 휴식", "밤"],
  },
  {
    theme: "dungeon",
    keywords: ["dungeon", "ruin", "던전", "유적", "지하"],
    categoryNeedles: ["던전", "유적"],
  },
  {
    theme: "cave",
    keywords: ["cave", "cavern", "mine", "동굴", "광산", "폐광"],
    categoryNeedles: ["동굴", "광산", "광물"],
  },
  {
    theme: "village",
    keywords: ["village", "town", "city", "마을", "도시"],
    categoryNeedles: ["마을", "광장", "길드", "회관", "시장 · 아침 생활", "축제", "과수원", "어촌", "찻집", "공원", "양봉"],
  },
  {
    theme: "forest",
    keywords: ["forest", "woods", "jungle", "숲", "수풀", "정글", "밀림"],
    categoryNeedles: ["숲 · 탐험", "잎다리", "소나무", "양치식물", "사과꽃"],
  },
  {
    theme: "field",
    keywords: ["field", "meadow", "필드", "초원", "평원"],
    categoryNeedles: ["필드", "초원", "장거리"],
  },
];

const FIELD_RULE = THEME_RULES[THEME_RULES.length - 1]!;

/** 한글 조각이 이보다 많은 곡에 걸리면 너무 흔한 말로 보고 이름 검색에서 뺀다. */
const MAX_NAME_GRAM_TRACKS = 40;

const HANGUL_GRAM_STOP = new Set([
  "으로", "에서", "까지", "부터", "하고", "이나", "또는", "그리고",
  "있는", "없는", "위한", "하는", "되는", "같은", "속의", "에게",
]);

type IndexedTrack = {
  readonly track: BgmCatalogTrack;
  readonly scene: string;
  readonly listening: string;
  readonly loop: boolean;
};

let catalogIndex: readonly IndexedTrack[] | undefined;

/**
 * 테마 또는 맵 이름에서 카탈로그 곡을 고른다.
 * 같은 (themeOrName, seed, excludeIds, options) 는 항상 같은 id 를 돌려준다.
 */
export function recommendMapBgm(
  themeOrName: string,
  seed: number,
  excludeIds?: readonly string[],
  options?: MapBgmRecommendOptions,
): string {
  const excluded = new Set(excludeIds ?? []);
  const theme = explicitTheme(themeOrName) ?? explicitTheme(options?.fallbackTheme) ?? "field";
  const matches = matchingTracks(themeOrName, options);
  const loopMatches = matches.filter((entry) => entry.loop);

  const picked =
    pickId(idsOf(loopMatches, excluded), seed) ??
    pickId(idsOf(matches, excluded), seed) ??
    starterFallback(theme, excluded) ??
    pickId(loopCatalogIds(excluded), seed) ??
    pickId(allCatalogIds(excluded), seed);
  // RTP music ships with the core player even when no optional MP3 pack exists.
  return picked ?? (isCatalogBgmAvailable(STARTER_DEFAULT_BGM_ID) ? STARTER_DEFAULT_BGM_ID : 'easyrpg-music-field-1');
}

function matchingTracks(themeOrName: string, options: MapBgmRecommendOptions | undefined): readonly IndexedTrack[] {
  const text = typeof themeOrName === "string" ? themeOrName.trim().toLowerCase() : "";
  const theme = explicitTheme(text);
  if (theme) return tracksMatchingTheme(theme, options?.descriptions);
  const named = text.length > 0 ? tracksMatchingName(text, options?.descriptions) : [];
  if (named.length > 0) return named;
  const fallback = explicitTheme(options?.fallbackTheme);
  if (fallback) return tracksMatchingTheme(fallback, options?.descriptions);
  return tracksMatchingCategory(FIELD_RULE);
}

function tracksMatchingTheme(
  theme: MapBgmTheme,
  descriptions: MapBgmRecommendOptions["descriptions"],
): readonly IndexedTrack[] {
  const rule = THEME_RULES.find((entry) => entry.theme === theme) ?? FIELD_RULE;
  const terms = themeSearchTerms(rule);
  return catalogTracks().filter((entry) => terms.some((term) => corpusHas(corpusOf(entry, descriptions), term)));
}

function tracksMatchingCategory(rule: ThemeRule): readonly IndexedTrack[] {
  return catalogTracks().filter((entry) =>
    rule.categoryNeedles.some((needle) => entry.track.category.includes(needle)),
  );
}

function tracksMatchingName(
  name: string,
  descriptions: MapBgmRecommendOptions["descriptions"],
): readonly IndexedTrack[] {
  const entries = catalogTracks();
  const grams = hangulGrams(name);
  const useful = grams.filter((gram) => {
    let count = 0;
    for (const entry of entries) {
      if (corpusOf(entry, descriptions).includes(gram)) count += 1;
      if (count > MAX_NAME_GRAM_TRACKS) return false;
    }
    return count >= 1;
  });
  if (useful.length === 0) return [];
  let best = 0;
  const scored = entries.map((entry) => {
    const corpus = corpusOf(entry, descriptions);
    let hits = 0;
    for (const gram of useful) if (corpus.includes(gram)) hits += 1;
    if (hits > best) best = hits;
    return { entry, hits };
  });
  return scored.filter((item) => item.hits === best).map((item) => item.entry);
}

function themeSearchTerms(rule: ThemeRule): readonly string[] {
  const terms = new Set<string>();
  for (const keyword of rule.keywords) terms.add(keyword.toLowerCase());
  for (const needle of rule.categoryNeedles) terms.add(needle.toLowerCase());
  return [...terms];
}

function corpusOf(entry: IndexedTrack, descriptions: MapBgmRecommendOptions["descriptions"]): string {
  const override = descriptions !== undefined && Object.hasOwn(descriptions, entry.track.id)
    ? descriptions[entry.track.id]
    : undefined;
  const listening = override !== undefined ? override : entry.listening;
  return listening.length > 0 ? `${entry.scene}\n${listening.toLowerCase()}` : entry.scene;
}

function corpusHas(corpus: string, term: string): boolean {
  if (term === "mine") return /(^|[^a-z])mine([^a-z]|$)/.test(corpus);
  return corpus.includes(term);
}

function hangulGrams(name: string): string[] {
  const compact = name.replace(/[^가-힣]/g, "");
  const grams = new Set<string>();
  const max = Math.min(4, compact.length);
  for (let len = 2; len <= max; len += 1) {
    for (let index = 0; index + len <= compact.length; index += 1) {
      const gram = compact.slice(index, index + len);
      if (!HANGUL_GRAM_STOP.has(gram)) grams.add(gram);
    }
  }
  return [...grams];
}

function catalogTracks(): readonly IndexedTrack[] {
  catalogIndex ??= BGM_CATALOG.map((track) => {
    const listening = getAudioAiDescription("music", track.id) ?? "";
    return {
      track,
      loop: findBgmRuntimeEntry(track.id)?.loop === true,
      listening,
      scene: [track.title, track.titleEn, track.category, track.brief, ...track.tags].join("\n").toLowerCase(),
    };
  });
  return catalogIndex;
}

function explicitTheme(themeOrName: unknown): MapBgmTheme | undefined {
  const text = typeof themeOrName === "string" ? themeOrName.trim().toLowerCase() : "";
  if (!text) return undefined;
  for (const rule of THEME_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(text, keyword))) return rule.theme;
  }
  return undefined;
}

function matchesKeyword(text: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  // "mine" 은 determine 같은 영어 단어에 들어가므로 토큰 경계로만 본다.
  if (needle === "mine") return /(^|[^a-z])mine([^a-z]|$)/.test(text);
  return text.includes(needle);
}

function idsOf(entries: readonly IndexedTrack[], excluded: ReadonlySet<string>): string[] {
  return entries.map((entry) => entry.track.id).filter((id) => !excluded.has(id) && isCatalogBgmAvailable(id));
}

function loopCatalogIds(excluded: ReadonlySet<string>): string[] {
  return BGM_CATALOG.filter((track) => findBgmRuntimeEntry(track.id)?.loop === true)
    .map((track) => track.id)
    .filter((id) => !excluded.has(id) && isCatalogBgmAvailable(id));
}

function allCatalogIds(excluded: ReadonlySet<string>): string[] {
  return bgmCatalogResourceIds().filter((id) => !excluded.has(id) && isCatalogBgmAvailable(id));
}

function starterFallback(theme: MapBgmTheme, excluded: ReadonlySet<string>): string | undefined {
  const id = theme === "battle" ? STARTER_BATTLE_BGM_ID : STARTER_DEFAULT_BGM_ID;
  return excluded.has(id) || !isCatalogBgmAvailable(id) ? undefined : id;
}

function pickId(ids: readonly string[], seed: number): string | undefined {
  if (ids.length === 0) return undefined;
  const rng = mulberry32(typeof seed === "number" && Number.isFinite(seed) ? seed : 1);
  return ids[Math.floor(rng() * ids.length)]!;
}
