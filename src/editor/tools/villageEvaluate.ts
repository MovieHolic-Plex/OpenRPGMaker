// 마을 구조+룩 평가 게이트.
// - 구조: checkReachability 계열 지표(호출 측에서 합쳐도 됨)
// - 룩: 결정론 휴리스틱(광장 소품 밀도, 길 재질, 나무 분포, 상위 점유율)
// 멀티모달 LLM은 같은 VillageLookReport 스키마를 채우면 된다(fixes로 피드백).

import { DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { checkReachability } from "@/project/lint/reachability";
import type { VillagePlan } from "./villagePlan";

const SAND = new Set(DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds);
const DIRT = new Set(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
const TREE_UPPER = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER = new Set([290, 291, 292, 293]);
const FENCE = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
const YARD_PROPS = new Set([349, 350, 351, 352, 327, 328, 288, 348, 237, 202, 203, 320, 234, 235, 236]);

export type FixLayer = "plan" | "build" | "spec";

export interface VillageFix {
  readonly layer: FixLayer;
  readonly action: string;
  readonly hint: string;
  readonly field?: string;
  readonly to?: string | number | boolean;
}

export interface VillageLookReport {
  readonly ok: boolean;
  readonly score: number;
  readonly gate: "structure" | "look" | "both";
  readonly themeMatch: "strong" | "ok" | "weak";
  readonly issues: readonly string[];
  readonly fixes: readonly VillageFix[];
  readonly metrics: {
    readonly upperOccupied: number;
    readonly roadCells: number;
    readonly sandCells: number;
    readonly dirtCells: number;
    readonly waterCells: number;
    readonly treeCells: number;
    /** 활엽수 2×2 군락 개수(강촌 숲 품질 게이트) */
    readonly tree2x2Clusters: number;
    readonly fenceCells: number;
    readonly propCells: number;
    readonly plazaPropCells: number;
    readonly reachableDoors: number;
    readonly doorTargets: number;
  };
  /** 쿼리 상식 스펙 대비 충족 여부 */
  readonly requirementsMet?: readonly { readonly kind: string; readonly ok: boolean; readonly detail: string }[];
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly feedbackForLlm: string;
}

export interface EvaluateVillageInput {
  readonly project: Project;
  readonly mapId: string;
  readonly plan?: VillagePlan;
  readonly doorFronts?: readonly { x: number; y: number }[];
  readonly attempt?: number;
  readonly maxAttempts?: number;
}

export function evaluateVillageLook(input: EvaluateVillageInput): VillageLookReport {
  const map = input.project.maps[input.mapId];
  if (!map) {
    return emptyFail("맵을 찾을 수 없다", input.attempt ?? 1, input.maxAttempts ?? 2);
  }
  const plan = input.plan;
  const attempt = input.attempt ?? 1;
  const maxAttempts = input.maxAttempts ?? 2;
  const issues: string[] = [];
  const fixes: VillageFix[] = [];

  const metrics = collectMetrics(map);
  const doorFronts = input.doorFronts ?? inferDoorFronts(map);
  const start = input.project.startMapId === map.id
    ? input.project.startPos
    : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };

  let reachableDoors = 0;
  let structureOk = true;
  if (doorFronts.length > 0) {
    const reach = checkReachability(input.project, map.id, start, [...doorFronts]);
    reachableDoors = doorFronts.length - reach.unreachable.length;
    if (!reach.reachable) {
      structureOk = false;
      issues.push(`시작→문앞 도달 실패 ${reach.unreachable.length}/${doorFronts.length}`);
      fixes.push({
        layer: "build",
        action: "repair_roads",
        hint: "문 앞과 광장을 잇는 길을 다시 깔거나 plazaLayout을 center로",
        field: "plazaLayout",
        to: "center",
      });
    }
  }

  // 룩 휴리스틱
  let lookScore = 0.55;
  let themeMatch: VillageLookReport["themeMatch"] = "ok";

  if (plan?.pathStyle === "sand") {
    if (metrics.sandCells < Math.max(20, metrics.dirtCells)) {
      issues.push("모래길 테마인데 모래 칸이 부족하거나 흙길이 더 많다");
      fixes.push({ layer: "plan", action: "force_path", field: "pathStyle", to: "sand", hint: "pathStyle=sand로 재시공" });
      lookScore -= 0.15;
      themeMatch = "weak";
    } else {
      lookScore += 0.1;
    }
  }
  if (plan?.pathStyle === "dirt" && metrics.dirtCells < 20) {
    issues.push("흙길 테마인데 흙길 칸이 너무 적다");
    fixes.push({ layer: "plan", action: "force_path", field: "pathStyle", to: "dirt", hint: "pathStyle=dirt로 재시공" });
    lookScore -= 0.1;
  }

  const plazaWanted = plan?.plazaStyle ?? "market";
  if (plazaWanted === "market" || plazaWanted === "garden") {
    const minPlazaProps = plazaWanted === "market" ? 4 : 3;
    if (metrics.plazaPropCells < minPlazaProps && metrics.propCells < minPlazaProps + 4) {
      issues.push(`광장/소품이 비어 ${plazaWanted} 느낌이 약함 (plazaProps=${metrics.plazaPropCells})`);
      fixes.push({
        layer: "plan",
        action: "boost_plaza_decor",
        field: "plazaStyle",
        to: "market",
        hint: "plazaStyle=market, decor=true, seed+1 후 재시공",
      });
      fixes.push({
        layer: "build",
        action: "place_props",
        hint: "광장에 bench_h/fruit_box/flowers 추가 산포",
      });
      lookScore -= 0.2;
      if (themeMatch !== "weak") themeMatch = "weak";
    } else {
      lookScore += 0.1;
    }
  }

  if (plan?.edgeTrees !== "none") {
    const minTrees = plan?.edgeTrees === "dense" ? 24 : 12;
    if (metrics.treeCells < minTrees) {
      issues.push(`외곽 나무가 부족함 (${metrics.treeCells}<${minTrees})`);
      fixes.push({
        layer: "plan",
        action: "boost_trees",
        field: "edgeTrees",
        to: "dense",
        hint: "edgeTrees=dense로 올려 재시공",
      });
      lookScore -= 0.1;
    } else {
      lookScore += 0.05;
    }
  }

  // ── 쿼리 상식 스펙(강촌=강+숲 등) 존재 검증 ──
  const requirementsMet: { kind: string; ok: boolean; detail: string }[] = [];
  const req = plan?.requirements;
  if (req) {
    requirementsMet.push({
      kind: "village",
      ok: metrics.roadCells >= 20 && (doorFronts.length > 0 || metrics.fenceCells > 0),
      detail: `길 ${metrics.roadCells}칸 · 문앞후보 ${doorFronts.length}`,
    });
    if (req.landmarks.includes("river") || req.landmarks.includes("harbor")) {
      const okWater = metrics.waterCells >= 30;
      requirementsMet.push({
        kind: "river",
        ok: okWater,
        detail: `수역 ${metrics.waterCells}칸 (필요≥30)`,
      });
      if (!okWater) {
        issues.push(`필수 스펙 실패: 강/수역이 거의 없음 (${metrics.waterCells}칸) — 쿼리「${req.query}」`);
        fixes.push({
          layer: "build",
          action: "place_river",
          hint: "강/하천 fill_region을 서쪽에 더 넓게",
        });
        lookScore -= 0.25;
        themeMatch = "weak";
      } else {
        lookScore += 0.12;
      }
    }
    if (req.landmarks.includes("lake")) {
      const okLake = metrics.waterCells >= 25;
      requirementsMet.push({ kind: "lake", ok: okLake, detail: `수역 ${metrics.waterCells}칸` });
      if (!okLake) {
        issues.push(`필수 스펙 실패: 호수/연못 수역 부족 (${metrics.waterCells})`);
        fixes.push({ layer: "build", action: "place_lake", hint: "호수 circle fill_region" });
        lookScore -= 0.2;
        themeMatch = "weak";
      }
    }
    if (req.landmarks.includes("forest")) {
      const minForest = 20;
      const okForest = metrics.treeCells >= minForest;
      const okBig = metrics.tree2x2Clusters >= 3;
      requirementsMet.push({
        kind: "forest",
        ok: okForest && okBig,
        detail: `나무 ${metrics.treeCells}칸 (필요≥${minForest}) · 2×2군락 ${metrics.tree2x2Clusters} (필요≥3)`,
      });
      if (!okForest) {
        issues.push(`필수 스펙 실패: 숲/나무 군락 부족 (${metrics.treeCells}<${minForest}) — 쿼리「${req.query}」`);
        fixes.push({
          layer: "plan",
          action: "boost_forest",
          field: "edgeTrees",
          to: "dense",
          hint: "edgeTrees=dense + forest 밴드 재시공",
        });
        lookScore -= 0.2;
        themeMatch = "weak";
      } else if (!okBig) {
        issues.push(`필수 스펙 실패: 2×2 활엽수 군락 부족 (${metrics.tree2x2Clusters}<3) — plant_tree_clusters(broadleaf-2x2)`);
        fixes.push({
          layer: "build",
          action: "plant_tree_clusters",
          hint: 'plant_tree_clusters({ style: "broadleaf-2x2", count: 6 }) 또는 advance forest_big',
        });
        lookScore -= 0.15;
        themeMatch = "weak";
      } else {
        lookScore += 0.12;
      }
    }
    if (req.landmarks.includes("market")) {
      const okMarket = metrics.plazaPropCells >= 3 || metrics.propCells >= 10;
      requirementsMet.push({ kind: "market", ok: okMarket, detail: `광장소품 ${metrics.plazaPropCells}` });
      if (!okMarket) {
        issues.push("필수 스펙 실패: 장터/시장 소품이 약함");
        fixes.push({ layer: "plan", action: "boost_market", field: "plazaStyle", to: "market", hint: "plazaStyle=market" });
        lookScore -= 0.12;
      }
    }
    if (requirementsMet.every((r) => r.ok) && req.landmarks.length > 0) {
      themeMatch = themeMatch === "weak" ? "ok" : "strong";
      lookScore += 0.05;
    }
  }

  if (plan?.fences !== false && metrics.fenceCells < 40) {
    issues.push(`울타리가 거의 없음 (${metrics.fenceCells})`);
    fixes.push({ layer: "plan", action: "enable_fences", field: "fences", to: true, hint: "fences=true 재시공" });
    lookScore -= 0.08;
  }

  // 완전 허전 맵
  if (metrics.upperOccupied < 30) {
    issues.push("상위 레이어 장식이 너무 적어 맵이 허전해 보인다");
    fixes.push({ layer: "plan", action: "boost_decor", field: "decor", to: true, hint: "decor 강화·소품 테마 market" });
    lookScore -= 0.15;
    themeMatch = "weak";
  }

  if (plan?.theme && /어촌|항구|장터|market|harbor|coast/.test(plan.theme) && themeMatch !== "weak") {
    themeMatch = metrics.sandCells > 30 && metrics.propCells > 8 ? "strong" : "ok";
    if (themeMatch === "strong") lookScore += 0.08;
  }

  lookScore = Math.max(0, Math.min(1, lookScore));
  const reqFailed = requirementsMet.some((r) => !r.ok);
  const lookOk = (!reqFailed && issues.filter((i) => !i.includes("도달")).length === 0) || lookScore >= 0.62;
  // 구조 실패·필수 스펙 실패는 게이트 실패
  const ok = structureOk && !reqFailed && lookOk && lookScore >= 0.55;
  const gate: VillageLookReport["gate"] = !structureOk && (!lookOk || reqFailed)
    ? "both"
    : !structureOk
      ? "structure"
      : "look";

  const report: VillageLookReport = {
    ok,
    score: Number(lookScore.toFixed(2)),
    gate,
    themeMatch,
    issues,
    fixes: dedupeFixes(fixes),
    metrics: {
      ...metrics,
      reachableDoors,
      doorTargets: doorFronts.length,
    },
    requirementsMet: requirementsMet.length > 0 ? requirementsMet : undefined,
    attempt,
    maxAttempts,
    feedbackForLlm: "",
  };
  return { ...report, feedbackForLlm: formatFeedbackForLlm(report, plan) };
}

/** 평가 fixes를 plan에 반영한 패치 객체 (normalizeVillagePlan 입력용). */
export function planPatchFromLookReport(plan: VillagePlan, report: VillageLookReport): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    theme: plan.theme,
    query: plan.requirements.query,
    requirements: plan.requirements,
    pathStyle: plan.pathStyle,
    kitMix: plan.kitMix,
    yardStyle: plan.yardStyle,
    plazaStyle: plan.plazaStyle,
    edgeTrees: plan.edgeTrees,
    plazaLayout: plan.plazaLayout,
    fences: plan.fences,
    decor: true,
    interior: plan.interior,
    seed: plan.seed + report.attempt,
    mapName: plan.mapName,
    width: plan.width,
    height: plan.height,
    houses: plan.houses.map((h) => ({ kitId: h.kitId, yard: [...h.yard], ownerName: h.ownerName, id: h.id })),
    npcs: plan.npcs.map((n) => ({ name: n.name, lines: [...n.lines] })),
    id: `${plan.id}_r${report.attempt}`,
  };

  for (const fix of report.fixes) {
    if (fix.layer !== "plan" || !fix.field) continue;
    if (fix.to !== undefined) patch[fix.field] = fix.to;
  }
  // 룩 실패 시 기본 부스트
  if (!report.ok) {
    patch.decor = true;
    if (report.themeMatch === "weak") {
      patch.plazaStyle = "market";
      patch.yardStyle = plan.yardStyle === "minimal" ? "market" : plan.yardStyle;
      patch.edgeTrees = "dense";
    }
  }
  return patch;
}

/** 활엽수 2×2 스탬프 개수 (upper 262|263 + bottom 292|293 on upper/lower). */
export function countBroadleaf2x2(map: GameMap): number {
  let n = 0;
  for (let y = 0; y < map.height - 1; y += 1) {
    for (let x = 0; x < map.width - 1; x += 1) {
      const u00 = map.upperTiles[y * map.width + x] ?? 0;
      const u10 = map.upperTiles[y * map.width + x + 1] ?? 0;
      const u01 = map.upperTiles[(y + 1) * map.width + x] ?? 0;
      const u11 = map.upperTiles[(y + 1) * map.width + x + 1] ?? 0;
      const l01 = map.lowerTiles[(y + 1) * map.width + x] ?? 0;
      const l11 = map.lowerTiles[(y + 1) * map.width + x + 1] ?? 0;
      const topOk = u00 === 262 && u10 === 263;
      const botOk =
        (u01 === 292 || l01 === 292) && (u11 === 293 || l11 === 293);
      if (topOk && botOk) n += 1;
    }
  }
  return n;
}

function collectMetrics(map: GameMap) {
  let upperOccupied = 0;
  let roadCells = 0;
  let sandCells = 0;
  let dirtCells = 0;
  let waterCells = 0;
  let treeCells = 0;
  let fenceCells = 0;
  let propCells = 0;
  let plazaPropCells = 0;
  const tree2x2Clusters = countBroadleaf2x2(map);

  const plazaX0 = Math.floor(map.width / 2) - 4;
  const plazaY0 = Math.floor(map.height / 2) - 3;
  // 광장은 레이아웃에 따라 이동할 수 있어, 맵 중앙 대역 + 하단 대역 둘 다 센다.
  const bands = [
    { x0: plazaX0, y0: plazaY0, x1: plazaX0 + 8, y1: plazaY0 + 6 },
    { x0: plazaX0, y0: Math.floor(map.height * 0.55), x1: plazaX0 + 8, y1: Math.floor(map.height * 0.55) + 6 },
  ];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const lower = map.lowerTiles[i] ?? TILE.EMPTY;
      const upper = map.upperTiles[i] ?? TILE.EMPTY;
      if (upper !== TILE.EMPTY && upper !== -1) upperOccupied += 1;
      if (isWaterChipsetTile(lower) || isLakeAutotileTile(lower) || lower === TILE.WATER) {
        waterCells += 1;
      }
      if (SAND.has(lower)) {
        sandCells += 1;
        roadCells += 1;
      } else if (DIRT.has(lower)) {
        dirtCells += 1;
        roadCells += 1;
      }
      if (TREE_UPPER.has(upper) || TREE_LOWER.has(lower) || TREE_LOWER.has(upper)) treeCells += 1;
      if (FENCE.has(upper)) fenceCells += 1;
      if (YARD_PROPS.has(upper)) {
        propCells += 1;
        for (const b of bands) {
          if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) plazaPropCells += 1;
        }
      }
    }
  }
  return {
    upperOccupied,
    roadCells,
    sandCells,
    dirtCells,
    waterCells,
    treeCells,
    tree2x2Clusters,
    fenceCells,
    propCells,
    plazaPropCells,
  };
}

function inferDoorFronts(map: GameMap): { x: number; y: number }[] {
  return map.events
    .filter((event) => /door|문|house|집/i.test(event.id))
    .map((event) => ({ x: event.x, y: Math.min(map.height - 1, event.y + 1) }))
    .slice(0, 24);
}

function dedupeFixes(fixes: readonly VillageFix[]): VillageFix[] {
  const seen = new Set<string>();
  const out: VillageFix[] = [];
  for (const fix of fixes) {
    const key = `${fix.layer}:${fix.action}:${fix.field ?? ""}:${String(fix.to ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fix);
  }
  return out;
}

function formatFeedbackForLlm(report: VillageLookReport, plan?: VillagePlan): string {
  const reqLines = report.requirementsMet?.map((r) => `- ${r.kind}: ${r.ok ? "OK" : "MISSING"} (${r.detail})`) ?? [];
  const lines = [
    `[village_gate] attempt ${report.attempt}/${report.maxAttempts} ${report.ok ? "PASS" : "FAIL"}`,
    `gate=${report.gate} score=${report.score} themeMatch=${report.themeMatch}`,
    plan ? `theme="${plan.theme}" planId=${plan.id}` : "",
    plan?.requirements ? `query="${plan.requirements.query}" must: ${plan.requirements.mustExist.join(", ")}` : "",
    reqLines.length > 0 ? "requirements:" : "",
    ...reqLines,
    "issues:",
    ...report.issues.map((i) => `- ${i}`),
    "fixes:",
    ...report.fixes.map((f) => `- [${f.layer}] ${f.action}${f.field ? ` ${f.field}=${String(f.to)}` : ""} — ${f.hint}`),
    report.ok
      ? "통과. 추가 재시공 불필요."
      : report.attempt >= report.maxAttempts
        ? "최대 시도 도달. 현재 맵을 유지하고 사용자에게 남은 issues를 보고하라."
        : "쿼리 필수 요소(강/숲 등)가 빠졌으면 랜드마크 시공을 보강하고, plan 필드 패치 후 build_village를 재실행하라.",
  ];
  return lines.filter(Boolean).join("\n");
}

function emptyFail(message: string, attempt: number, maxAttempts: number): VillageLookReport {
  return {
    ok: false,
    score: 0,
    gate: "structure",
    themeMatch: "weak",
    issues: [message],
    fixes: [],
    metrics: {
      upperOccupied: 0,
      roadCells: 0,
      sandCells: 0,
      dirtCells: 0,
      waterCells: 0,
      treeCells: 0,
      tree2x2Clusters: 0,
      fenceCells: 0,
      propCells: 0,
      plazaPropCells: 0,
      reachableDoors: 0,
      doorTargets: 0,
    },
    attempt,
    maxAttempts,
    feedbackForLlm: message,
  };
}
