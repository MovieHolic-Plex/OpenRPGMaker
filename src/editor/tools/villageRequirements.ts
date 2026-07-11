// 사용자 쿼리/테마 → 상식 기반 필수 랜드마크 스펙.
// 예: "강촌마을" → 강 + 숲 + 마을(주거). 시공·게이트가 이 목록을 근거로 존재 검증한다.

export type LandmarkKind = "river" | "lake" | "forest" | "market" | "harbor" | "farm";

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
export function inferRequirementsFromQuery(query: string): VillageRequirements {
  const q = (query ?? "").trim();
  const t = q.toLowerCase();
  const set = new Set<LandmarkKind>();

  // ── 물 ──
  if (/강촌|강가|강변|강마을|하천|시내|river|riverside|creek|stream/.test(t)) {
    set.add("river");
  }
  // "강"이 들어가는 취락 표현 (강화 등 지명은 제외하지 않음 — 보수적으로 강을 깐다)
  if (/강/.test(q) && !/강원|강도|강제|강조|강좌/.test(q)) {
    set.add("river");
  }
  if (/호수|연못|호반|lake|pond/.test(t)) {
    set.add("lake");
  }
  if (/항구|포구|어촌|해안|바다|항구촌|harbor|port|coast|seaside|fishing/.test(t)) {
    set.add("harbor");
    set.add("river"); // 물가 — 강/수역으로 표현
  }

  // ── 숲 ──
  if (/숲|삼림|산골|산림|forest|woods|woodland/.test(t)) {
    set.add("forest");
  }
  // 촌·마을·농촌 상식: 자연 취락이면 숲 밴드
  if (/촌|마을|village|hamlet|농/.test(t) && !/도심|도시|시내중심/.test(t)) {
    set.add("forest");
  }

  // ── 장터 ──
  if (/장터|시장|마켓|market|fair|장시/.test(t)) {
    set.add("market");
  }

  // ── 농 ──
  if (/농촌|농가|밭|목장|farm|pasture|rural/.test(t)) {
    set.add("farm");
    set.add("forest");
  }

  // 강촌 = 강 + 숲 + 마을 (상식 최소 세트)
  if (/강촌/.test(q)) {
    set.add("river");
    set.add("forest");
  }

  const landmarks = [...set];
  const mustExist = [
    "주거 마을(집·길·주민)",
    ...landmarks.map((kind) => LANDMARK_LABEL[kind]),
  ];

  // 강이 있으면 서쪽 물·동쪽 숲이 기본(마을이 강 옆). 호수만 있으면 북쪽 물·남쪽 숲.
  let riverSide: "west" | "east" | "north" | "south" = "west";
  if (landmarks.includes("lake") && !landmarks.includes("river") && !landmarks.includes("harbor")) {
    riverSide = "north";
  }
  const forestSide: "west" | "east" | "north" | "south" = oppositeSide(riverSide);

  return {
    query: q || "(빈 쿼리)",
    landmarks,
    mustHaveVillage: true,
    mustExist,
    riverSide,
    forestSide,
  };
}

function oppositeSide(side: "west" | "east" | "north" | "south"): "west" | "east" | "north" | "south" {
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

/** requirements가 톤 힌트를 덮을 때 (pathStyle 등). */
export function styleHintsFromRequirements(req: VillageRequirements): {
  pathStyle?: "sand" | "dirt";
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
  return hints;
}

export function requirementsSummary(req: VillageRequirements): string {
  return `필수: ${req.mustExist.join(" · ")}`;
}
