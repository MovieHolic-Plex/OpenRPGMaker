// 사용자 쿼리/테마 → 상식 기반 필수 랜드마크 스펙.
// 예: "강촌마을" → 강 + 숲 + 마을(주거). 시공·게이트가 이 목록을 근거로 존재 검증한다.
//
// 낱말 → 랜드마크 대응표와 방향 기본값은 이제 `system.worldGen` 저작 데이터가 지배한다
// (`@/project/worldGenRules`). 규칙을 넘기지 않으면 내장 기본 규칙 = 예전 정규식과 같은 판정.

import { parseSpatialPhrase, type SpatialAnchor } from "@/ai/viewRelativeLocation";
import {
  DEFAULT_WORLD_GEN_RULES,
  matchWorldGenKeywords,
  oppositeWorldGenSide,
  type ResolvedWorldGenRules,
  type WorldGenLandmarkKind,
  type WorldGenSide,
} from "@/project/worldGenRules";

export type LandmarkKind = WorldGenLandmarkKind;

export interface VillageRequirements {
  /** 원문 쿼리/테마 */
  readonly query: string;
  /** 반드시 맵에 존재해야 하는 요소 */
  readonly landmarks: readonly LandmarkKind[];
  /** 항상 true — 집·길이 있는 주거 마을 */
  readonly mustHaveVillage: true;
  /** 사람 읽기용 한 줄 요구사항 */
  readonly mustExist: readonly string[];
  /** 레이아웃 힌트 */
  readonly riverSide: "west" | "east" | "north" | "south";
  readonly forestSide: "west" | "east" | "north" | "south";
  /** 사용자가 숲 자리를 말하면(오른쪽 위 등) 강 반대편·저작 기본값을 이긴다. */
  readonly forestAnchor?: SpatialAnchor;
}

const LANDMARK_LABEL: Record<LandmarkKind, string> = {
  river: "강/하천 수역",
  lake: "호수/연못",
  forest: "숲/나무 군락",
  market: "장터/시장 분위기(광장 소품)",
  harbor: "포구/항구 느낌(물가+모래)",
  farm: "농/밭 분위기(넓은 잔디·마당)",
};

/**
 * 사용자 말에서 상식으로 뽑는 필수 스펙.
 * LLM이 아니라 결정론 — "강촌"이면 강이 있어야 한다는 계약.
 */
export function inferRequirementsFromQuery(
  query: string,
  rules: ResolvedWorldGenRules = DEFAULT_WORLD_GEN_RULES,
): VillageRequirements {
  const q = (query ?? "").trim();
  const landmarks = matchWorldGenKeywords(q, rules.keywords).landmarks;

  const mustExist = [
    "주거 마을(집·길·주민)",
    ...landmarks.map((kind) => LANDMARK_LABEL[kind]),
  ];

  // 강이 있으면 서쪽 물·동쪽 숲이 기본(마을이 강 옆). 호수만 있으면 북쪽 물·남쪽 숲.
  // 저자가 방향을 못 박으면(`auto` 아님) 그 값이 이 상식을 덮는다.
  // 이번 요청에 위치 말(오른쪽 위 등)이 있으면 그게 최우선이다.
  let riverSide: WorldGenSide = "west";
  if (landmarks.includes("lake") && !landmarks.includes("river") && !landmarks.includes("harbor")) {
    riverSide = "north";
  }
  if (rules.water.side !== "auto") riverSide = rules.water.side;
  const spoken = parseSpatialPhrase(q);
  const forestAnchor = spoken
    ? { horizontal: spoken.horizontal, vertical: spoken.vertical }
    : undefined;
  const forestSide: WorldGenSide = forestAnchor
    ? sideFromAnchor(forestAnchor)
    : rules.forest.side !== "auto"
      ? rules.forest.side
      : oppositeWorldGenSide(riverSide);

  return {
    query: q || "(빈 쿼리)",
    landmarks,
    mustHaveVillage: true,
    mustExist,
    riverSide,
    forestSide,
    ...(forestAnchor ? { forestAnchor } : {}),
  };
}

function sideFromAnchor(anchor: SpatialAnchor): WorldGenSide {
  if (anchor.horizontal === "right") return "east";
  if (anchor.horizontal === "left") return "west";
  if (anchor.vertical === "top") return "north";
  if (anchor.vertical === "bottom") return "south";
  return "east";
}

/** requirements가 톤 힌트를 덮을 때 (pathStyle 등). 저자가 `auto` 를 벗어난 값을 고르면 그게 최종이다. */
export function styleHintsFromRequirements(
  req: VillageRequirements,
  rules: ResolvedWorldGenRules = DEFAULT_WORLD_GEN_RULES,
): {
  pathStyle?: "sand" | "dirt" | "stone";
  yardStyle?: "mixed" | "garden" | "workshop" | "market" | "minimal";
  plazaStyle?: "market" | "garden" | "empty";
  edgeTrees?: "conifer" | "dense" | "none";
  plazaLayout?: "center" | "north" | "south" | "west" | "east";
} {
  const hints: ReturnType<typeof styleHintsFromRequirements> = {};
  if (req.landmarks.includes("harbor") || req.landmarks.includes("river")) {
    hints.pathStyle = "sand";
    hints.plazaLayout = req.riverSide === "west" ? "east" : req.riverSide === "east" ? "west" : "south";
  }
  if (req.landmarks.includes("market")) {
    hints.plazaStyle = "market";
    hints.yardStyle = "market";
  }
  if (req.landmarks.includes("farm")) {
    hints.pathStyle = hints.pathStyle ?? "dirt";
    hints.yardStyle = "garden";
    hints.plazaStyle = "garden";
  }
  if (req.landmarks.includes("forest")) {
    hints.edgeTrees = "dense";
  }
  if (rules.road.pathStyle !== "auto") hints.pathStyle = rules.road.pathStyle;
  if (rules.road.yardStyle !== "auto") hints.yardStyle = rules.road.yardStyle;
  if (rules.road.plazaStyle !== "auto") hints.plazaStyle = rules.road.plazaStyle;
  if (rules.road.plazaLayout !== "auto") hints.plazaLayout = rules.road.plazaLayout;
  if (rules.road.edgeTrees !== "auto") hints.edgeTrees = rules.road.edgeTrees;
  return hints;
}

export function requirementsSummary(req: VillageRequirements): string {
  return `필수: ${req.mustExist.join(" · ")}`;
}
