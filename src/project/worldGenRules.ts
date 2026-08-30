// 세계 생성 규칙 — "AI가 마을을 깔 때 물·숲·길을 어떤 수치로 깔지"의 **저작 데이터**.
//
// 왜 있는가: 전에는 강 띠 두께(0.12), 호수 지름(0.28), 침엽수 밀도(면적/10), 활엽수 상한(10)
// 같은 숫자가 villageTerrainPass.ts 안에 상수로 박혀 있었다. 저자가 "호수를 더 크게",
// "숲을 더 빽빽하게" 를 원하면 코드를 고쳐야 했다 — 초보 저자에게는 불가능한 요구다.
// 이 모듈은 그 숫자 전부를 프로젝트 데이터(`system.worldGen`)로 끌어내고, 생략되면
// **예전 상수와 완전히 같은 값**으로 해석한다. 즉 이 파일이 없던 시절 프로젝트도 동작이 같다.
//
// 계층 규약: `src/project` 는 `src/editor` 를 import 하지 않는다. 그래서 랜드마크 종류
// (`WorldGenLandmarkKind`)의 정본이 여기에 있고, editor 쪽 `LandmarkKind` 는 이걸 재수출한다.

export const WORLD_GEN_LANDMARK_KINDS = ["river", "lake", "forest", "market", "harbor", "farm"] as const;
export type WorldGenLandmarkKind = (typeof WORLD_GEN_LANDMARK_KINDS)[number];

export type WorldGenSide = "west" | "east" | "north" | "south";
/** `auto` = 규칙이 상황(강 유무 등)을 보고 스스로 고른다. */
export type WorldGenSideChoice = WorldGenSide | "auto";
export type WorldGenWaterShape = "auto" | "circle" | "ellipse" | "rect";
export type WorldGenPathStyle = "auto" | "sand" | "dirt" | "stone";
export type WorldGenPlazaStyle = "auto" | "market" | "garden" | "empty";
export type WorldGenPlazaLayout = "auto" | "center" | "north" | "south" | "west" | "east";
export type WorldGenYardStyle = "auto" | "mixed" | "garden" | "workshop" | "market" | "minimal";
export type WorldGenEdgeTrees = "auto" | "conifer" | "dense" | "none";

/** 물(강·호수) 규칙. 모든 값 생략 가능 — 생략하면 예전 하드코딩 값. */
export interface WorldGenWaterRules {
  /** 강 띠 두께 = 맵 짧은 변 × 이 비율. 예전 0.12. */
  riverBandRatio?: number;
  /** 강 띠 최소 두께(칸). 예전 4. */
  riverBandMin?: number;
  /** 강 띠 최대 두께(칸). 예전 6. */
  riverBandMax?: number;
  /** 강이 함께 있을 때 호수 지름 = 짧은 변 × 이 비율. 예전 0.14. */
  lakeRatioWithRiver?: number;
  /** 호수만 있을 때 호수 지름 비율. 예전 0.28. */
  lakeRatioAlone?: number;
  /** 호수 최소 지름(칸). 예전 8. */
  lakeMinSize?: number;
  /** 수면 모양. `auto` = 거의 정사각이면 원, 아니면 타원(예전 동작). */
  shape?: WorldGenWaterShape;
  /** `auto` 모양에서 "거의 정사각" 판정 허용 오차(칸). 예전 2. */
  squareTolerance?: number;
  /** 물이 붙는 방향. `auto` = 호수 단독이면 북, 그 외 서(예전 동작). */
  side?: WorldGenSideChoice;
}

export interface WorldGenForestRules {
  /** 숲 밴드 깊이 = 짧은 변 × 이 비율. 예전 0.14. */
  depthRatio?: number;
  /** 숲 밴드 최소 깊이(칸). 예전 4. */
  depthMin?: number;
  /** 숲이 붙는 방향. `auto` = 물 반대편(예전 동작). */
  side?: WorldGenSideChoice;
  /** 침엽수 1그루당 면적(칸). 작을수록 빽빽하다. 예전 10. */
  coniferAreaPerTree?: number;
  /** 침엽수 최소 그루. 예전 8. */
  coniferMinCount?: number;
  /** 침엽수 최소 간격(칸). 예전 2. */
  coniferGap?: number;
  /** 침엽수 자연스러움(0=격자, 1=무작위). 예전 0.6. */
  coniferNaturalness?: number;
  /** 활엽수(2×2 대목) 1그루당 면적. 예전 28. */
  broadleafAreaPerTree?: number;
  /** 활엽수 최소 그루. 예전 4. */
  broadleafMinCount?: number;
  /** 활엽수 최대 그루. 예전 10. */
  broadleafMaxCount?: number;
  /** 활엽수 최소 간격(칸). 예전 3. */
  broadleafGap?: number;
  /** 활엽수 자연스러움. 예전 0.55. */
  broadleafNaturalness?: number;
}

/** 길·광장·마당 규칙. `auto` 는 예전처럼 테마/랜드마크 추론에 맡긴다. */
export interface WorldGenRoadRules {
  pathStyle?: WorldGenPathStyle;
  plazaStyle?: WorldGenPlazaStyle;
  plazaLayout?: WorldGenPlazaLayout;
  yardStyle?: WorldGenYardStyle;
  edgeTrees?: WorldGenEdgeTrees;
}

/**
 * 자연어 낱말 규칙 — "이 낱말이 프롬프트에 있으면 이걸 깔아라".
 *
 * 코드(정규식)를 저자에게 요구하지 않는다. `words` 는 낱말 목록이고 부분 일치로 본다.
 * `exceptWords` 는 오탐 차단용(예: "강" 은 강을 깔지만 "강원" 은 지명이므로 제외).
 */
export interface WorldGenKeywordRule {
  readonly id: string;
  /** 사람이 읽는 규칙 이름. 예: "강이 들어간 말". */
  readonly label: string;
  /** 이 낱말 중 하나라도 있으면 발동. */
  readonly words: readonly string[];
  /** 단, 이 낱말이 있으면 발동하지 않는다. */
  readonly exceptWords?: readonly string[];
  /** 발동하면 깔리는 것들. */
  readonly landmarks: readonly WorldGenLandmarkKind[];
  /** false 면 규칙을 끈다. 생략은 켜짐. */
  readonly enabled?: boolean;
  /** 내장 규칙 표시(저자가 지울 수 없고 끄기만 가능). */
  readonly builtin?: boolean;
}

export interface WorldGenRules {
  water?: WorldGenWaterRules;
  forest?: WorldGenForestRules;
  road?: WorldGenRoadRules;
  /** 저자 낱말 규칙 + 내장 규칙 끄기 상태. */
  keywords?: WorldGenKeywordRule[];
  /** 내장 낱말 규칙을 쓸지. 생략·true = 쓴다. */
  useBuiltinKeywords?: boolean;
  /** 마지막으로 적용한 예시 프리셋 id. UX 표시 전용 — 생성 로직은 읽지 않는다. */
  presetId?: string;
}

export type ResolvedWorldGenWater = Required<WorldGenWaterRules>;
export type ResolvedWorldGenForest = Required<WorldGenForestRules>;
export type ResolvedWorldGenRoad = Required<WorldGenRoadRules>;

export interface ResolvedWorldGenRules {
  readonly water: ResolvedWorldGenWater;
  readonly forest: ResolvedWorldGenForest;
  readonly road: ResolvedWorldGenRoad;
  /** 내장(켜진 것) + 저자 규칙을 합친 발동 순서대로의 목록. */
  readonly keywords: readonly WorldGenKeywordRule[];
}

// 기본값 — 예전 하드코딩과 1:1 대응. 이 숫자를 바꾸면 기존 프로젝트 동작이 바뀐다.
export const DEFAULT_WORLD_GEN_WATER: ResolvedWorldGenWater = {
  riverBandRatio: 0.12,
  riverBandMin: 4,
  riverBandMax: 6,
  lakeRatioWithRiver: 0.14,
  lakeRatioAlone: 0.28,
  lakeMinSize: 8,
  shape: "auto",
  squareTolerance: 2,
  side: "auto",
};

export const DEFAULT_WORLD_GEN_FOREST: ResolvedWorldGenForest = {
  depthRatio: 0.14,
  depthMin: 4,
  side: "auto",
  coniferAreaPerTree: 10,
  coniferMinCount: 8,
  coniferGap: 2,
  coniferNaturalness: 0.6,
  broadleafAreaPerTree: 28,
  broadleafMinCount: 4,
  broadleafMaxCount: 10,
  broadleafGap: 3,
  broadleafNaturalness: 0.55,
};

export const DEFAULT_WORLD_GEN_ROAD: ResolvedWorldGenRoad = {
  pathStyle: "auto",
  plazaStyle: "auto",
  plazaLayout: "auto",
  yardStyle: "auto",
  edgeTrees: "auto",
};

/**
 * 내장 낱말 규칙 — 예전 `inferRequirementsFromQuery` 의 정규식을 낱말 목록으로 옮긴 것.
 * 순서가 곧 발동 순서다(랜드마크는 집합이므로 중복은 자동으로 합쳐진다).
 */
export const BUILTIN_WORLD_GEN_KEYWORD_RULES: readonly WorldGenKeywordRule[] = [
  {
    id: "builtin-river-words",
    label: "강·하천을 가리키는 말",
    words: ["강촌", "강가", "강변", "강마을", "하천", "시내", "river", "riverside", "creek", "stream"],
    landmarks: ["river"],
    builtin: true,
  },
  {
    id: "builtin-river-loose",
    label: "'강' 한 글자만 들어가도 강",
    words: ["강"],
    exceptWords: ["강원", "강도", "강제", "강조", "강좌"],
    landmarks: ["river"],
    builtin: true,
  },
  {
    id: "builtin-lake",
    label: "호수·연못을 가리키는 말",
    words: ["호수", "연못", "호반", "lake", "pond"],
    landmarks: ["lake"],
    builtin: true,
  },
  {
    id: "builtin-harbor",
    label: "항구·바닷가를 가리키는 말",
    words: ["항구", "포구", "어촌", "해안", "바다", "항구촌", "harbor", "port", "coast", "seaside", "fishing"],
    landmarks: ["harbor", "river"],
    builtin: true,
  },
  {
    id: "builtin-forest-words",
    label: "숲·산림을 가리키는 말",
    words: ["숲", "삼림", "산골", "산림", "forest", "woods", "woodland"],
    landmarks: ["forest"],
    builtin: true,
  },
  {
    id: "builtin-settlement-forest",
    label: "시골 취락이면 숲을 두른다",
    words: ["촌", "마을", "village", "hamlet", "농"],
    exceptWords: ["도심", "도시", "시내중심"],
    landmarks: ["forest"],
    builtin: true,
  },
  {
    id: "builtin-market",
    label: "장터·시장을 가리키는 말",
    words: ["장터", "시장", "마켓", "market", "fair", "장시"],
    landmarks: ["market"],
    builtin: true,
  },
  {
    id: "builtin-farm",
    label: "농사·목장을 가리키는 말",
    words: ["농촌", "농가", "밭", "목장", "farm", "pasture", "rural"],
    landmarks: ["farm", "forest"],
    builtin: true,
  },
  {
    id: "builtin-riverside-village",
    label: "'강촌' 은 강 + 숲 최소 세트",
    words: ["강촌"],
    landmarks: ["river", "forest"],
    builtin: true,
  },
];

export const DEFAULT_WORLD_GEN_RULES: ResolvedWorldGenRules = {
  water: DEFAULT_WORLD_GEN_WATER,
  forest: DEFAULT_WORLD_GEN_FOREST,
  road: DEFAULT_WORLD_GEN_ROAD,
  keywords: BUILTIN_WORLD_GEN_KEYWORD_RULES,
};

// 저작 한계 — DB 슬라이더 경계와 정규화가 같은 값을 쓴다(한 곳에서만 정의).
export type WorldGenNumberBound = { readonly min: number; readonly max: number; readonly step: number };

export const WORLD_GEN_BOUNDS = {
  riverBandRatio: { min: 0.02, max: 0.5, step: 0.01 },
  riverBandMin: { min: 1, max: 40, step: 1 },
  riverBandMax: { min: 1, max: 60, step: 1 },
  lakeRatioWithRiver: { min: 0.04, max: 0.6, step: 0.01 },
  lakeRatioAlone: { min: 0.04, max: 0.8, step: 0.01 },
  lakeMinSize: { min: 3, max: 60, step: 1 },
  squareTolerance: { min: 0, max: 20, step: 1 },
  depthRatio: { min: 0.02, max: 0.5, step: 0.01 },
  depthMin: { min: 1, max: 40, step: 1 },
  coniferAreaPerTree: { min: 2, max: 60, step: 1 },
  coniferMinCount: { min: 0, max: 200, step: 1 },
  coniferGap: { min: 1, max: 8, step: 1 },
  coniferNaturalness: { min: 0, max: 1, step: 0.05 },
  broadleafAreaPerTree: { min: 4, max: 200, step: 1 },
  broadleafMinCount: { min: 0, max: 120, step: 1 },
  broadleafMaxCount: { min: 0, max: 200, step: 1 },
  broadleafGap: { min: 1, max: 10, step: 1 },
  broadleafNaturalness: { min: 0, max: 1, step: 0.05 },
} as const satisfies Record<string, WorldGenNumberBound>;

function clampNumber(raw: unknown, bound: WorldGenNumberBound, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.min(bound.max, Math.max(bound.min, raw));
}

function clampInt(raw: unknown, bound: WorldGenNumberBound, fallback: number): number {
  return Math.round(clampNumber(raw, bound, fallback));
}

function pickLiteral<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

const SIDE_CHOICES: readonly WorldGenSideChoice[] = ["auto", "west", "east", "north", "south"];

function resolveWater(raw: WorldGenWaterRules | undefined): ResolvedWorldGenWater {
  const d = DEFAULT_WORLD_GEN_WATER;
  const riverBandMin = clampInt(raw?.riverBandMin, WORLD_GEN_BOUNDS.riverBandMin, d.riverBandMin);
  // 최대가 최소보다 작으면 띠가 사라진다 — 저자 실수를 조용히 삼키지 않고 최소로 끌어올린다.
  const riverBandMax = Math.max(riverBandMin, clampInt(raw?.riverBandMax, WORLD_GEN_BOUNDS.riverBandMax, d.riverBandMax));
  return {
    riverBandRatio: clampNumber(raw?.riverBandRatio, WORLD_GEN_BOUNDS.riverBandRatio, d.riverBandRatio),
    riverBandMin,
    riverBandMax,
    lakeRatioWithRiver: clampNumber(raw?.lakeRatioWithRiver, WORLD_GEN_BOUNDS.lakeRatioWithRiver, d.lakeRatioWithRiver),
    lakeRatioAlone: clampNumber(raw?.lakeRatioAlone, WORLD_GEN_BOUNDS.lakeRatioAlone, d.lakeRatioAlone),
    lakeMinSize: clampInt(raw?.lakeMinSize, WORLD_GEN_BOUNDS.lakeMinSize, d.lakeMinSize),
    shape: pickLiteral(raw?.shape, ["auto", "circle", "ellipse", "rect"] as const, d.shape),
    squareTolerance: clampInt(raw?.squareTolerance, WORLD_GEN_BOUNDS.squareTolerance, d.squareTolerance),
    side: pickLiteral(raw?.side, SIDE_CHOICES, d.side),
  };
}

function resolveForest(raw: WorldGenForestRules | undefined): ResolvedWorldGenForest {
  const d = DEFAULT_WORLD_GEN_FOREST;
  const broadleafMinCount = clampInt(raw?.broadleafMinCount, WORLD_GEN_BOUNDS.broadleafMinCount, d.broadleafMinCount);
  const broadleafMaxCount = Math.max(
    broadleafMinCount,
    clampInt(raw?.broadleafMaxCount, WORLD_GEN_BOUNDS.broadleafMaxCount, d.broadleafMaxCount),
  );
  return {
    depthRatio: clampNumber(raw?.depthRatio, WORLD_GEN_BOUNDS.depthRatio, d.depthRatio),
    depthMin: clampInt(raw?.depthMin, WORLD_GEN_BOUNDS.depthMin, d.depthMin),
    side: pickLiteral(raw?.side, SIDE_CHOICES, d.side),
    coniferAreaPerTree: clampInt(raw?.coniferAreaPerTree, WORLD_GEN_BOUNDS.coniferAreaPerTree, d.coniferAreaPerTree),
    coniferMinCount: clampInt(raw?.coniferMinCount, WORLD_GEN_BOUNDS.coniferMinCount, d.coniferMinCount),
    coniferGap: clampInt(raw?.coniferGap, WORLD_GEN_BOUNDS.coniferGap, d.coniferGap),
    coniferNaturalness: clampNumber(raw?.coniferNaturalness, WORLD_GEN_BOUNDS.coniferNaturalness, d.coniferNaturalness),
    broadleafAreaPerTree: clampInt(
      raw?.broadleafAreaPerTree,
      WORLD_GEN_BOUNDS.broadleafAreaPerTree,
      d.broadleafAreaPerTree,
    ),
    broadleafMinCount,
    broadleafMaxCount,
    broadleafGap: clampInt(raw?.broadleafGap, WORLD_GEN_BOUNDS.broadleafGap, d.broadleafGap),
    broadleafNaturalness: clampNumber(
      raw?.broadleafNaturalness,
      WORLD_GEN_BOUNDS.broadleafNaturalness,
      d.broadleafNaturalness,
    ),
  };
}

function resolveRoad(raw: WorldGenRoadRules | undefined): ResolvedWorldGenRoad {
  const d = DEFAULT_WORLD_GEN_ROAD;
  return {
    pathStyle: pickLiteral(raw?.pathStyle, ["auto", "sand", "dirt", "stone"] as const, d.pathStyle),
    plazaStyle: pickLiteral(raw?.plazaStyle, ["auto", "market", "garden", "empty"] as const, d.plazaStyle),
    plazaLayout: pickLiteral(
      raw?.plazaLayout,
      ["auto", "center", "north", "south", "west", "east"] as const,
      d.plazaLayout,
    ),
    yardStyle: pickLiteral(
      raw?.yardStyle,
      ["auto", "mixed", "garden", "workshop", "market", "minimal"] as const,
      d.yardStyle,
    ),
    edgeTrees: pickLiteral(raw?.edgeTrees, ["auto", "conifer", "dense", "none"] as const, d.edgeTrees),
  };
}

function normalizeKeywordRule(raw: unknown): WorldGenKeywordRule | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const input = raw as Record<string, unknown>;
  const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : undefined;
  if (!id) return undefined;
  const words = Array.isArray(input.words)
    ? input.words.filter((word): word is string => typeof word === "string" && word.trim().length > 0).map((w) => w.trim())
    : [];
  const landmarks = Array.isArray(input.landmarks)
    ? input.landmarks.filter((kind): kind is WorldGenLandmarkKind =>
        typeof kind === "string" && (WORLD_GEN_LANDMARK_KINDS as readonly string[]).includes(kind))
    : [];
  const exceptWords = Array.isArray(input.exceptWords)
    ? input.exceptWords
        .filter((word): word is string => typeof word === "string" && word.trim().length > 0)
        .map((w) => w.trim())
    : undefined;
  return {
    id,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : id,
    words,
    ...(exceptWords && exceptWords.length > 0 ? { exceptWords } : {}),
    landmarks: [...new Set(landmarks)],
    enabled: input.enabled !== false,
    builtin: input.builtin === true,
  };
}

/**
 * 내장 + 저자 규칙 합치기.
 *
 * 저자 규칙이 내장 규칙과 **같은 id** 를 쓰면 그 자리에서 내장 규칙을 덮는다 —
 * DB UI 가 내장 규칙을 끄거나 낱말을 손볼 때 쓰는 경로다. 새 id 는 뒤에 붙는다.
 */
export function resolveWorldGenKeywordRules(raw: WorldGenRules | undefined): readonly WorldGenKeywordRule[] {
  const authored = Array.isArray(raw?.keywords)
    ? raw.keywords.map(normalizeKeywordRule).filter((rule): rule is WorldGenKeywordRule => rule !== undefined)
    : [];
  const useBuiltin = raw?.useBuiltinKeywords !== false;
  const overrides = new Map(authored.map((rule) => [rule.id, rule]));
  const merged: WorldGenKeywordRule[] = [];
  if (useBuiltin) {
    for (const builtin of BUILTIN_WORLD_GEN_KEYWORD_RULES) {
      const override = overrides.get(builtin.id);
      merged.push(override ? { ...override, builtin: true, label: override.label || builtin.label } : builtin);
    }
  }
  const builtinIds = new Set(BUILTIN_WORLD_GEN_KEYWORD_RULES.map((rule) => rule.id));
  for (const rule of authored) {
    if (useBuiltin && builtinIds.has(rule.id)) continue;
    merged.push(rule);
  }
  return merged;
}

export function resolveWorldGenRules(raw: WorldGenRules | undefined): ResolvedWorldGenRules {
  if (!raw) return DEFAULT_WORLD_GEN_RULES;
  return {
    water: resolveWater(raw.water),
    forest: resolveForest(raw.forest),
    road: resolveRoad(raw.road),
    keywords: resolveWorldGenKeywordRules(raw),
  };
}

/** 낱말 규칙 발동 — 프롬프트 → 랜드마크 집합. 정규식이 아니라 부분 일치다. */
export function matchWorldGenKeywords(
  query: string,
  rules: readonly WorldGenKeywordRule[],
): { readonly landmarks: readonly WorldGenLandmarkKind[]; readonly firedRuleIds: readonly string[] } {
  const text = (query ?? "").trim().toLowerCase();
  const landmarks = new Set<WorldGenLandmarkKind>();
  const firedRuleIds: string[] = [];
  if (!text) return { landmarks: [], firedRuleIds: [] };
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    if (rule.words.length === 0 || rule.landmarks.length === 0) continue;
    const hit = rule.words.some((word) => text.includes(word.toLowerCase()));
    if (!hit) continue;
    const blocked = rule.exceptWords?.some((word) => text.includes(word.toLowerCase())) ?? false;
    if (blocked) continue;
    firedRuleIds.push(rule.id);
    for (const kind of rule.landmarks) landmarks.add(kind);
  }
  return { landmarks: [...landmarks], firedRuleIds };
}

// 미리보기와 시공기가 **같은 함수**로 칸 수를 센다 — 따로 계산하면 보이는 그림과 깔리는 맵이 갈라진다.
export function riverBandDepth(shortSide: number, water: ResolvedWorldGenWater): number {
  return Math.min(water.riverBandMax, Math.max(water.riverBandMin, Math.floor(shortSide * water.riverBandRatio)));
}

export function lakeDiameter(shortSide: number, water: ResolvedWorldGenWater, nearRiver: boolean): number {
  const ratio = nearRiver ? water.lakeRatioWithRiver : water.lakeRatioAlone;
  return Math.max(water.lakeMinSize, Math.floor(shortSide * ratio));
}

export function forestBandDepth(shortSide: number, forest: ResolvedWorldGenForest): number {
  return Math.max(forest.depthMin, Math.floor(shortSide * forest.depthRatio));
}

export function coniferCountFor(areaTiles: number, forest: ResolvedWorldGenForest): number {
  return Math.max(forest.coniferMinCount, Math.floor(areaTiles / forest.coniferAreaPerTree));
}

export function broadleafCountFor(areaTiles: number, forest: ResolvedWorldGenForest): number {
  return Math.max(
    forest.broadleafMinCount,
    Math.min(forest.broadleafMaxCount, Math.floor(areaTiles / forest.broadleafAreaPerTree)),
  );
}

export function waterShapeFor(
  rectWidth: number,
  rectHeight: number,
  water: ResolvedWorldGenWater,
): "rect" | "ellipse" | "circle" {
  if (water.shape !== "auto") return water.shape;
  return Math.abs(rectWidth - rectHeight) <= water.squareTolerance ? "circle" : "ellipse";
}

export function oppositeWorldGenSide(side: WorldGenSide): WorldGenSide {
  switch (side) {
    case "west":
      return "east";
    case "east":
      return "west";
    case "north":
      return "south";
    case "south":
      return "north";
  }
}
