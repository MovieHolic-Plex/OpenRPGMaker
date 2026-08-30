// 마을 구조+룩 평가 게이트.
// - 구조: checkReachability 계열 지표(호출 측에서 합쳐도 됨)
// - 룩: 결정론 휴리스틱(광장 소품 밀도, 길 재질, 나무 분포, 상위 점유율)
// 멀티모달 LLM은 같은 VillageLookReport 스키마를 채우면 된다(fixes로 피드백).

import { HOUSE_DOOR_CHARSET_TEXTURE } from "@/editor/houseInteriors";
import { DEFAULT_COBBLE_AUTOTILE_GROUP, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { resolveTimeSystem } from "@/project/gameTime";
import type { GameMap, Project } from "@/project/types";
import { checkReachability } from "@/project/lint/reachability";
import type { VillagePlan } from "./villagePlan";

const SAND = new Set(DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds);
const DIRT = new Set(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
// 포석(129 블록) — pathStyle:"stone" 정본. 411/412/413은 밴.
const STONE = new Set<number>(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
const TREE_UPPER = new Set([260, 261, 262, 263, 289]);
const TREE_LOWER = new Set([290, 291, 292, 293]);
const FENCE = new Set([378, 379, 380, 408, 409, 410, 438, 439]);
const YARD_PROPS = new Set([349, 350, 351, 352, 327, 328, 288, 348, 237, 202, 203, 320, 234, 235, 236]);
const WINDOWS = new Set([85, 87]);
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;

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
    readonly exitRoads: number;
    readonly adjacentWindowPairs: number;
    readonly orphanDoorTiles: number;
    readonly doorPairs: number;
    /** Object1 문 이벤트 수 — 문 외형이 타일이 아니라 이벤트인 집을 센다. */
    readonly doorEvents: number;
    readonly houseRegions: number;
    readonly houseShapeKinds: number;
    readonly houseKitKinds: number;
    readonly multiStoryHouses: number;
    readonly scheduledNpcs: number;
    readonly npcActivityKinds: number;
    readonly npcMovementKinds: number;
    readonly treeKinds: number;
    readonly propTileKinds: number;
    readonly longestStraightRoadRun: number;
    readonly interiorTreeCells: number;
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
  } else {
    // 문 앞 좌표 0개 = 집이 없거나 문 유실. 도달성 검증이 불가능한 상태는 통과가 아니라 실패다.
    structureOk = false;
    issues.push("문 앞 좌표가 0개 — 집이 없거나 문이 유실돼 도달성 검증이 불가능하다");
    fixes.push({ layer: "build", action: "rebuild_settlement", hint: "build_village로 집을 재시공해 문 앞 좌표를 확보" });
  }

  // 룩 휴리스틱
  let lookScore = 0.55;
  let themeMatch: VillageLookReport["themeMatch"] = "ok";
  let naturalQualityOk = true;
  // 타일 실측 구조 검사 — builder가 쓴 layoutPlan.kind와 무관하게 항상 실행한다.
  if (metrics.orphanDoorTiles > 0) {
    structureOk = false;
    issues.push(`짝이 없는 문 타일 ${metrics.orphanDoorTiles}칸`);
    fixes.push({ layer: "build", action: "repair_house_doors", hint: "각 집에 116/146 문 한 쌍만 복구" });
    lookScore -= 0.12;
  }
  if (metrics.exitRoads < 4) {
    structureOk = false;
    issues.push(`마을 밖으로 이어지는 길이 ${metrics.exitRoads}/4방향뿐이다`);
    fixes.push({ layer: "build", action: "repair_exit_roads", hint: "layoutPlan roadAnchors 네 곳을 중앙 도로망에 연결" });
    lookScore -= 0.12;
  }
  // 품질 검사를 두 갈래로 나눈다.
  //
  // 왜(2026-07-26 실측): 아래 블록 전체가 `layoutPlan.kind === "village-harness-natural-v2"` 에
  // 갇혀 있었다. 그래서 그 생성기가 도장을 찍지 않은 맵(손으로 만든 맵·AI가 만든 맵·다른 생성기)은
  // **13개 검사를 모두 건너뛰고 통과**했다. 실제 샘플 마을(이슬 장터, 100×100)은 96타일 직선 도로와
  // NPC 일정 0개를 가진 채 "지적 1건, 점수 0.58" 로 통과했다.
  //
  // - 관찰 기반(타일·이벤트에서 직접 세는 것): 어떤 맵에서도 유효하므로 항상 검사한다.
  // - 설계도 기반(집 형태/키트/층수): layoutPlan.regions 에만 있는 정보라 관찰로 확인할 수 없다.
  //   설계도가 없을 때 검사하면 "형태 0종" 같은 **거짓 지적**이 나오므로 설계도가 있을 때만 검사한다.
  const hasVillageBlueprint = map.layoutPlan?.kind === "village-harness-natural-v2";
  // 집 수: 설계도가 있으면 그 값, 없으면 문 개수로 추정한다.
  // 문은 두 형태다 — Object1 문 이벤트(현재 시공 기본값) 또는 타일 문 쌍(116/146).
  const houseCount = metrics.houseRegions > 0
    ? metrics.houseRegions
    : Math.max(metrics.doorEvents, metrics.doorPairs);
  // 정착지로 볼 최소 조건 — 문 쌍이 둘 이상이면 마을 품질을 따질 대상이다.
  const isSettlement = hasVillageBlueprint || houseCount >= 2;
  if (isSettlement) {
    const targetFromPlan = (name: string, fallback: number): number => {
      const prefix = `${name}:`;
      const tag = map.layoutPlan?.regions.flatMap((region) => region.tags ?? []).find((entry) => entry.startsWith(prefix));
      const parsed = tag ? Number(tag.slice(prefix.length)) : Number.NaN;
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const naturalIssue = (message: string, fix: VillageFix, penalty = 0.08): void => {
      naturalQualityOk = false;
      issues.push(message);
      fixes.push(fix);
      lookScore -= penalty;
    };
    if (metrics.adjacentWindowPairs > 0) {
      naturalIssue(
        `창문이 붙은 쌍 ${metrics.adjacentWindowPairs}곳 — 층/창 구분이 흐리다`,
        { layer: "build", action: "separate_floor_windows", hint: "층마다 창 한 행, 층 사이 벽 한 행을 비움" },
      );
    }
    // ── 설계도 기반(집 형태/키트/층수) — layoutPlan 없이는 관찰 불가라 거짓 지적을 만든다.
    const shapeTarget = hasVillageBlueprint ? targetFromPlan("shape-target", Math.min(4, metrics.houseRegions)) : 0;
    if (metrics.houseShapeKinds < shapeTarget) {
      naturalIssue(
        `집 형태가 단조롭다 (${metrics.houseShapeKinds}/${shapeTarget}종)`,
        { layer: "plan", action: "vary_house_templates", hint: "rect/l/u와 다층 템플릿을 중복 전에 순환" },
      );
    }
    const kitTarget = hasVillageBlueprint ? targetFromPlan("kit-target", Math.min(3, metrics.houseRegions)) : 0;
    if (metrics.houseKitKinds < kitTarget) {
      naturalIssue(
        `집 키트가 단조롭다 (${metrics.houseKitKinds}/${kitTarget}종)`,
        { layer: "plan", action: "vary_house_kits", field: "kitMix", to: "mixed", hint: "서로 다른 키트를 먼저 배치" },
      );
    }
    const multiStoryTarget = hasVillageBlueprint
      ? targetFromPlan("multistory-target", Number(map.width >= 46 && metrics.houseRegions >= 6))
      : 0;
    if (metrics.multiStoryHouses < multiStoryTarget) {
      naturalIssue(
        "다층 집이 없어 지붕선과 스카이라인이 평평하다",
        { layer: "build", action: "add_multistory_house", hint: "2층 또는 3층 템플릿을 최소 한 채 배치" },
      );
    }
    // ── 관찰 기반 — houseRegions(설계도) 가 아니라 houseCount(설계도 또는 문 쌍) 를 쓴다.
    const npcTarget = houseCount + 2;
    if (metrics.scheduledNpcs < npcTarget) {
      naturalIssue(
        `시간표가 있는 주민이 부족하다 (${metrics.scheduledNpcs}/${npcTarget})`,
        { layer: "build", action: "assign_npc_schedules", hint: "아침 집·낮 일터·저녁 장터 3단계 일정 부여" },
      );
    }
    // 시간 시스템이 꺼져 있으면 시간표는 저장돼도 실행되지 않는다(npcSchedules.ts:31 에서 즉시 return).
    //
    // **시간표가 실제로 있을 때만** 지적한다. 이유: 시간 시스템은 맵이 아니라 프로젝트 설정이라
    // 시공 중에는 고칠 수 없다. 무조건 지적하면 갓 생성한 마을이 자기 품질 게이트에서 실패한다
    // (실측: run_village_session 이 status=failed 로 떨어졌다). 시간표가 0개면 위의
    // "시간표가 있는 주민이 부족하다" 가 이미 같은 문제를 가리킨다.
    // 게이트를 실패시키지 않고 알리기만 한다(naturalIssue 를 쓰지 않는 이유):
    // 시간 시스템은 맵이 아니라 프로젝트 설정이고, 마을 시공은 선언한 데이터 밖을 바꿀 수 없다
    // ("Village changed undeclared project data" 가드). 시공 중에 고칠 수 없는 것으로 시공을
    // 실패시키면 갓 만든 마을이 무한 재시도에 빠진다(실측: run_village_session status=failed).
    if (metrics.scheduledNpcs > 0 && !resolveTimeSystem(input.project)) {
      issues.push("시간 시스템이 꺼져 있어 주민 시간표가 실행되지 않는다 — 주민이 제자리에 머무른다");
      fixes.push({
        layer: "spec",
        action: "enable_time_system",
        field: "timeSystem.enabled",
        to: true,
        hint: "system.timeSystem.enabled=true 로 켜야 시간표대로 이동한다",
      });
    }
    if (metrics.scheduledNpcs >= 2 && metrics.npcMovementKinds < 2) {
      naturalIssue(
        "모든 주민의 이동 방식이 같다",
        { layer: "build", action: "mix_npc_movement", hint: "고정 상인과 배회 주민을 함께 배치" },
      );
    }
    if (metrics.npcActivityKinds < Math.min(6, metrics.scheduledNpcs)) {
      naturalIssue(
        `주민 활동이 단조롭다 (${metrics.npcActivityKinds}종)`,
        { layer: "build", action: "diversify_npc_activities", hint: "농사·수리·배송·목공·장터·순찰 활동을 분산" },
      );
    }
    if (metrics.treeKinds < 2) {
      naturalIssue(
        `수종이 ${metrics.treeKinds}종뿐이다`,
        { layer: "build", action: "mix_tree_species", hint: "침엽수와 2×2 활엽수 군락을 함께 심기" },
      );
    }
    if (metrics.propTileKinds < 6) {
      naturalIssue(
        `생활 소품 종류가 부족하다 (${metrics.propTileKinds}<6)`,
        { layer: "build", action: "diversify_lived_in_props", hint: "꽃·벤치·상자·과일·탁자·표지판을 마당과 장터에 분산" },
      );
    }
    const maxStraightRun = Math.max(14, Math.floor(Math.max(map.width, map.height) * 0.5));
    if (metrics.longestStraightRoadRun > maxStraightRun) {
      naturalIssue(
        `도로 직선 구간이 너무 길다 (${metrics.longestStraightRoadRun}>${maxStraightRun})`,
        { layer: "build", action: "meander_roads", hint: "출구 간선과 집 진입로를 짧은 계단형 곡선으로 분절" },
      );
    }
    if (houseCount > 0 && metrics.fenceCells > houseCount * 8) {
      naturalIssue(
        `울타리가 필지를 과도하게 둘러싼다 (${metrics.fenceCells}칸)`,
        { layer: "build", action: "fragment_fences", hint: "완전 폐쇄형 사각 울타리를 짧은 마당 경계 조각으로 교체" },
      );
    }
    if (metrics.interiorTreeCells < Math.min(24, houseCount * 3)) {
      naturalIssue(
        `마을 내부 수목이 부족하다 (${metrics.interiorTreeCells}칸)`,
        { layer: "build", action: "scatter_inner_groves", hint: "테두리 띠 대신 내부 빈 공간에도 혼합 수목 군락을 산포" },
      );
    }
  }

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

  const minimumFenceCells = Math.min(24, Math.max(8, metrics.houseRegions * 2));
  if (plan?.fences !== false && metrics.fenceCells < minimumFenceCells) {
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
  const ok = structureOk && naturalQualityOk && !reqFailed && lookOk && lookScore >= 0.55;
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

type VillageCountArea = Readonly<{ x: number; y: number; w: number; h: number }>;

function countBounds(map: GameMap, area?: VillageCountArea): readonly [x0: number, y0: number, x1: number, y1: number] {
  return [
    Math.max(0, area?.x ?? 0),
    Math.max(0, area?.y ?? 0),
    Math.min(map.width, area ? area.x + area.w : map.width),
    Math.min(map.height, area ? area.y + area.h : map.height),
  ];
}

/** 타일 실측 수역 카운트 — builder 랜드마크 게이트·평가가 공유하는 정본 측정 (자기신고 아님). */
export function countWaterCells(map: GameMap, area?: VillageCountArea): number {
  const [x0, y0, x1, y1] = countBounds(map, area);
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const lower = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
      if (isWaterChipsetTile(lower) || isLakeAutotileTile(lower) || lower === TILE.WATER) count += 1;
    }
  }
  return count;
}

/** 타일 실측 나무 카운트 — collectMetrics의 treeCells와 동일 판정. */
export function countTreeCells(map: GameMap, area?: VillageCountArea): number {
  const [x0, y0, x1, y1] = countBounds(map, area);
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      const upper = map.upperTiles[index] ?? TILE.EMPTY;
      if (TREE_UPPER.has(upper) || TREE_LOWER.has(lower) || TREE_LOWER.has(upper)) count += 1;
    }
  }
  return count;
}

function collectMetrics(map: GameMap) {
  let upperOccupied = 0;
  let roadCells = 0;
  let sandCells = 0;
  let dirtCells = 0;
  let waterCells = 0;
  let treeCells = 0;
  let interiorTreeCells = 0;
  let fenceCells = 0;
  let propCells = 0;
  let plazaPropCells = 0;
  let adjacentWindowPairs = 0;
  let orphanDoorTiles = 0;
  let doorPairs = 0;
  let hasConifer = false;
  let hasBroadleaf = false;
  const propTileIds = new Set<number>();
  const tree2x2Clusters = countBroadleaf2x2(map);

  const plazaX0 = Math.floor(map.width / 2) - 4;
  const plazaY0 = Math.floor(map.height / 2) - 3;
  const plannedCommons = map.layoutPlan?.regions.filter((region) => region.role === "plaza" || region.role === "market") ?? [];
  const bands = plannedCommons.length > 0
    ? plannedCommons.map((region) => ({ x0: region.x, y0: region.y, x1: region.x + region.w, y1: region.y + region.h }))
    : [
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
      } else if (STONE.has(lower)) {
        roadCells += 1;
      }
      if (TREE_UPPER.has(upper) || TREE_LOWER.has(lower) || TREE_LOWER.has(upper)) {
        treeCells += 1;
        const edgeDistance = Math.min(x, y, map.width - 1 - x, map.height - 1 - y);
        if (edgeDistance >= 5) interiorTreeCells += 1;
      }
      if (upper === 260 || upper === 261 || upper === 290 || upper === 291 || lower === 290 || lower === 291) hasConifer = true;
      if (upper === 262 || upper === 263 || upper === 292 || upper === 293 || lower === 292 || lower === 293) hasBroadleaf = true;
      if (FENCE.has(upper)) fenceCells += 1;
      if (YARD_PROPS.has(upper)) {
        propCells += 1;
        propTileIds.add(upper);
        for (const b of bands) {
          if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) plazaPropCells += 1;
        }
      }
      if (WINDOWS.has(upper)) {
        if (x + 1 < map.width && WINDOWS.has(map.upperTiles[i + 1] ?? TILE.EMPTY)) adjacentWindowPairs += 1;
        if (y + 1 < map.height && WINDOWS.has(map.upperTiles[i + map.width] ?? TILE.EMPTY)) adjacentWindowPairs += 1;
      }
      if (lower === DOOR_BOTTOM) {
        if (y > 0 && map.lowerTiles[i - map.width] === DOOR_TOP) doorPairs += 1;
        else orphanDoorTiles += 1;
      }
      if (lower === DOOR_TOP && (y + 1 >= map.height || map.lowerTiles[i + map.width] !== DOOR_BOTTOM)) orphanDoorTiles += 1;
    }
  }
  const houseRegions = map.layoutPlan?.regions.filter((region) => region.role === "house") ?? [];
  const scheduledNpcs = map.events.filter((event) => (event.schedule?.length ?? 0) > 0);
  const npcActivities = new Set(scheduledNpcs.flatMap((event) => event.schedule?.map((entry) => entry.activity).filter((activity): activity is string => Boolean(activity)) ?? []));
  const npcMovements = new Set(scheduledNpcs.flatMap((event) => {
    const movement = event.pages?.[0]?.movement.type;
    return movement ? [movement] : [];
  }));
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
    exitRoads: countRoadExits(map),
    adjacentWindowPairs,
    orphanDoorTiles,
    doorPairs,
    doorEvents: countDoorEvents(map),
    houseRegions: houseRegions.length,
    houseShapeKinds: new Set(houseRegions.map((region) => region.shape).filter(Boolean)).size,
    houseKitKinds: new Set(houseRegions.map((region) => region.kitId).filter(Boolean)).size,
    multiStoryHouses: houseRegions.filter((region) => region.tags?.some((tag) => {
      if (tag === "2f" || tag === "3f") return true;
      return tag.startsWith("stories:") && Number(tag.slice("stories:".length)) > 1;
    })).length,
    scheduledNpcs: scheduledNpcs.length,
    npcActivityKinds: npcActivities.size,
    npcMovementKinds: npcMovements.size,
    treeKinds: Number(hasConifer) + Number(hasBroadleaf),
    propTileKinds: propTileIds.size,
    longestStraightRoadRun: longestStraightRoadRun(map),
    interiorTreeCells,
  };
}

function longestStraightRoadRun(map: GameMap): number {
  const isRoad = (x: number, y: number): boolean => {
    const tile = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
    return SAND.has(tile) || DIRT.has(tile) || STONE.has(tile);
  };
  let longest = 0;
  for (let y = 0; y < map.height; y += 1) {
    let run = 0;
    for (let x = 0; x < map.width; x += 1) {
      run = isRoad(x, y) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  for (let x = 0; x < map.width; x += 1) {
    let run = 0;
    for (let y = 0; y < map.height; y += 1) {
      run = isRoad(x, y) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

function countRoadExits(map: GameMap): number {
  const isRoad = (x: number, y: number): boolean => {
    const lower = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
    return SAND.has(lower) || DIRT.has(lower) || STONE.has(lower);
  };
  const anchors = map.layoutPlan?.roadAnchors;
  if (anchors && anchors.length > 0) {
    return anchors.filter((anchor) => anchor.x >= 0 && anchor.y >= 0 && anchor.x < map.width && anchor.y < map.height && isRoad(anchor.x, anchor.y)).length;
  }
  const north = Array.from({ length: map.width }, (_, x) => isRoad(x, 0)).some(Boolean);
  const south = Array.from({ length: map.width }, (_, x) => isRoad(x, map.height - 1)).some(Boolean);
  const west = Array.from({ length: map.height }, (_, y) => isRoad(0, y)).some(Boolean);
  const east = Array.from({ length: map.height }, (_, y) => isRoad(map.width - 1, y)).some(Boolean);
  return Number(north) + Number(south) + Number(west) + Number(east);
}

/** 문 외형을 맡은 Object1 문 이벤트 수. 문 charset 스프라이트를 쓴 이벤트만 센다. */
function countDoorEvents(map: GameMap): number {
  return map.events.filter((event) => {
    const sprite = event.pages?.[0]?.graphic.sprite;
    return sprite?.id === HOUSE_DOOR_CHARSET_TEXTURE;
  }).length;
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
      exitRoads: 0,
      adjacentWindowPairs: 0,
      orphanDoorTiles: 0,
      doorPairs: 0,
      doorEvents: 0,
      houseRegions: 0,
      houseShapeKinds: 0,
      houseKitKinds: 0,
      multiStoryHouses: 0,
      scheduledNpcs: 0,
      npcActivityKinds: 0,
      npcMovementKinds: 0,
      treeKinds: 0,
      propTileKinds: 0,
      longestStraightRoadRun: 0,
      interiorTreeCells: 0,
    },
    attempt,
    maxAttempts,
    feedbackForLlm: message,
  };
}
