// assets/bgmThemeRecommendation.ts
// 맵 테마/이름 → CC0 BGM 카탈로그 곡. AI 맵 생성(generate_map / create_map)이
// 마을·숲·동굴에 같은 기본곡을 꽂지 않도록 테마별 후보에서 시드로 고른다.
//
// 규칙:
//   1) 테마 키워드로 카테고리 바늘 목록을 고른다(모르는 이름은 field 폴백).
//   2) 심리스 루프(loop:true)를 우선한다. 테마 풀은 비어 있지 않아서 테마 맵은
//      CDN 카탈로그 id 를 받는다. starterFallback 은 그 풀이 exclude 로 비었을 때만 탄다.
//   3) 순수 함수. Math.random 없음(mulberry32). 예외를 던지지 않는다.

import { BGM_CATALOG, type BgmCatalogTrack } from "@/assets/bgmCatalog";
import { bgmCatalogResourceIds, findBgmRuntimeEntry } from "@/assets/bgmCatalogRuntime";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { mulberry32 } from "@/util/rng";

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

/**
 * 테마 또는 맵 이름에서 카탈로그 곡을 고른다.
 * 같은 (themeOrName, seed, excludeIds) 는 항상 같은 id 를 돌려준다.
 */
export function recommendMapBgm(
  themeOrName: string,
  seed: number,
  excludeIds?: readonly string[],
): string {
  const excluded = new Set(excludeIds ?? []);
  const theme = resolveTheme(themeOrName);
  const rule = THEME_RULES.find((entry) => entry.theme === theme) ?? FIELD_RULE;
  const matches = BGM_CATALOG.filter((track) =>
    rule.categoryNeedles.some((needle) => track.category.includes(needle)),
  );
  const loopMatches = matches.filter((track) => findBgmRuntimeEntry(track.id)?.loop === true);

  const picked =
    pickId(idsOf(loopMatches, excluded), seed) ??
    pickId(idsOf(matches, excluded), seed) ??
    starterFallback(theme, excluded) ??
    pickId(loopCatalogIds(excluded), seed) ??
    pickId(allCatalogIds(excluded), seed);
  return picked ?? STARTER_DEFAULT_BGM_ID;
}

function resolveTheme(themeOrName: unknown): MapBgmTheme {
  const text = typeof themeOrName === "string" ? themeOrName.trim().toLowerCase() : "";
  if (!text) return "field";
  for (const rule of THEME_RULES) {
    if (rule.keywords.some((keyword) => matchesKeyword(text, keyword))) return rule.theme;
  }
  return "field";
}

function matchesKeyword(text: string, keyword: string): boolean {
  const needle = keyword.toLowerCase();
  // "mine" 은 determine 같은 영어 단어에 들어가므로 토큰 경계로만 본다.
  if (needle === "mine") return /(^|[^a-z])mine([^a-z]|$)/.test(text);
  return text.includes(needle);
}

function idsOf(tracks: readonly BgmCatalogTrack[], excluded: ReadonlySet<string>): string[] {
  return tracks.map((track) => track.id).filter((id) => !excluded.has(id));
}

function loopCatalogIds(excluded: ReadonlySet<string>): string[] {
  return BGM_CATALOG.filter((track) => findBgmRuntimeEntry(track.id)?.loop === true)
    .map((track) => track.id)
    .filter((id) => !excluded.has(id));
}

function allCatalogIds(excluded: ReadonlySet<string>): string[] {
  return bgmCatalogResourceIds().filter((id) => !excluded.has(id));
}

function starterFallback(theme: MapBgmTheme, excluded: ReadonlySet<string>): string | undefined {
  const id = theme === "battle" ? STARTER_BATTLE_BGM_ID : STARTER_DEFAULT_BGM_ID;
  return excluded.has(id) ? undefined : id;
}

function pickId(ids: readonly string[], seed: number): string | undefined {
  if (ids.length === 0) return undefined;
  const rng = mulberry32(typeof seed === "number" && Number.isFinite(seed) ? seed : 1);
  return ids[Math.floor(rng() * ids.length)]!;
}
