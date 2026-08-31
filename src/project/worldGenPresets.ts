import type { WorldGenRules } from "@/project/worldGenRules";

export interface WorldGenPreset {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  /** 이 프리셋이 노리는 프롬프트 예시 — 미리보기 캡션과 낱말 규칙 시험에 쓴다. */
  readonly exampleQuery: string;
  readonly rules: WorldGenRules;
}

/**
 * 예시 프리셋 — 저자가 "이런 마을" 을 그림으로 고르는 입구.
 *
 * 각 프리셋은 완결된 규칙 묶음이다(부분 패치가 아니다). 그래야 고른 결과가
 * 이전에 만지던 값과 섞이지 않고, 썸네일이 실제 적용 결과와 일치한다.
 */
export const WORLD_GEN_PRESETS: readonly WorldGenPreset[] = [
  {
    id: "preset-default",
    label: "기본",
    summary: "지금까지의 기본 규칙. 강은 서쪽에 얇게, 숲은 동쪽에 보통 밀도로 깔린다.",
    exampleQuery: "강촌마을",
    rules: {
      presetId: "preset-default",
      water: {},
      forest: {},
      road: {},
    },
  },
  {
    id: "preset-wide-lake",
    label: "넓은 호수 마을",
    summary: "호수를 맵 절반 가까이 크게 파고 북쪽에 앉힌다. 집은 호수 남동쪽으로 밀린다.",
    exampleQuery: "호수 옆 조용한 마을",
    rules: {
      presetId: "preset-wide-lake",
      water: { lakeRatioAlone: 0.46, lakeRatioWithRiver: 0.3, lakeMinSize: 14, shape: "circle", side: "north" },
      forest: { depthRatio: 0.12, coniferAreaPerTree: 12 },
      road: { pathStyle: "sand", plazaStyle: "garden", plazaLayout: "south" },
    },
  },
  {
    id: "preset-deep-forest",
    label: "빽빽한 숲속 마을",
    summary: "물은 없고 숲이 맵 깊이까지 들어온다. 침엽수 간격을 좁혀 시야를 막는다.",
    exampleQuery: "깊은 숲속 나무꾼 마을",
    rules: {
      presetId: "preset-deep-forest",
      water: {},
      forest: {
        depthRatio: 0.3,
        depthMin: 8,
        coniferAreaPerTree: 5,
        coniferMinCount: 40,
        coniferGap: 1,
        coniferNaturalness: 0.8,
        broadleafAreaPerTree: 14,
        broadleafMaxCount: 26,
      },
      road: { pathStyle: "dirt", edgeTrees: "dense", plazaStyle: "empty" },
    },
  },
  {
    id: "preset-big-river",
    label: "큰 강이 흐르는 마을",
    summary: "강 띠를 두껍게 늘려 맵 한쪽을 강으로 채운다. 길은 모래, 광장은 강 반대편.",
    exampleQuery: "큰 강을 건너는 나루 마을",
    rules: {
      presetId: "preset-big-river",
      water: { riverBandRatio: 0.26, riverBandMin: 8, riverBandMax: 22, shape: "rect", side: "west" },
      forest: { depthRatio: 0.16, side: "east" },
      road: { pathStyle: "sand", plazaLayout: "east", plazaStyle: "market" },
    },
  },
  {
    id: "preset-market-town",
    label: "장터 도시",
    summary: "물과 숲을 최소로 줄이고 광장·마당을 장터 톤으로 맞춘다. 길은 돌바닥.",
    exampleQuery: "사람 붐비는 장터 도시",
    rules: {
      presetId: "preset-market-town",
      water: { riverBandRatio: 0.05, riverBandMin: 2, riverBandMax: 4 },
      forest: { depthRatio: 0.05, depthMin: 2, coniferAreaPerTree: 22, coniferMinCount: 4, broadleafMaxCount: 4 },
      road: { pathStyle: "stone", plazaStyle: "market", plazaLayout: "center", yardStyle: "market", edgeTrees: "none" },
    },
  },
  {
    id: "preset-harbor",
    label: "항구 마을",
    summary: "남쪽을 바다로 열고 모래 길을 깐다. 숲은 북쪽 언덕에만 얇게.",
    exampleQuery: "배가 드나드는 항구 어촌",
    rules: {
      presetId: "preset-harbor",
      water: { riverBandRatio: 0.22, riverBandMin: 7, riverBandMax: 18, shape: "rect", side: "south" },
      forest: { depthRatio: 0.1, depthMin: 3, side: "north", coniferAreaPerTree: 14 },
      road: { pathStyle: "sand", plazaStyle: "market", plazaLayout: "north", yardStyle: "workshop" },
    },
  },
];

export function findWorldGenPreset(id: string | undefined): WorldGenPreset | undefined {
  if (!id) return undefined;
  return WORLD_GEN_PRESETS.find((preset) => preset.id === id);
}
