// editor/tools/village/builder.ts
// 시공 오케스트레이션 — VILLAGE_TOOLS 조립, build_village 본문, intent 해석, 파이프라인 루프.
// 3층: plan_village(계층 계획) → build_village(제약 시공) → critique_village(비평 루프).

import { ALL_HOUSE_KIT_IDS, isHouseKitId, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import type { HouseInteriorProgram } from "@/editor/houseInteriors";
import { setMapLayoutPlan } from "@/project/mapLayoutPlan";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { DEFAULT_SNOW_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { inMapBounds } from "../mapHelpers";
import {
  isYardDecorKind,
  type YardDecorKind,
} from "../houseLotDecor";
import { ToolError, type ToolDefinition, type ToolExecResult } from "../types";
import {
  loadVillagePlan,
  normalizeVillagePlan,
  storeVillagePlan,
  storeVillageSpec,
  villagePlanToBuildSpec,
  type RoadStyle,
} from "../villagePlan";
import {
  countTreeCells,
  countWaterCells,
  evaluateVillageLook,
  planPatchFromLookReport,
  type VillageLookReport,
} from "../villageEvaluate";
import {
  buildTerrainConstraintMasks,
  runTerrainConstraintPass,
} from "../villageTerrainPass";
import { inferRequirementsFromQuery } from "../villageRequirements";
import { isPassable } from "@/project/collision";
import { scrubPlacementConflicts } from "@/project/lint/layoutPlacementValidate";
import { isCombinedTownTileset } from "@/project/tilesetHarness/combinedTown";
import { validateBuildSpec, type BuildSpec } from "@/ai/buildSpec";
import {
  coordKey,
  DEFAULT_HOUSES,
  DEFAULT_ROAD_STYLE,
  DEFAULT_ROAD_WIDTH,
  DEFAULT_SIZE,
  MAX_HOUSES,
  MAX_ROAD_WIDTH,
  MAX_SIZE,
  MIN_HOUSES,
  MIN_SIZE,
  ROAD_TILES,
  uniqueId,
  type BuiltHouse,
  type HouseTemplate,
  type Plaza,
  type Point,
  type Rect,
  type SettlementLayout,
  type VillageIntent,
} from "./constants";
import {
  presetOverrides,
  villagePresetById,
  villageTemplateCatalog,
  type PresetOverrides,
} from "./authoringData";
import { auditVillage, critiqueBuiltVillage, critiqueVillageMap, roadComponentNotes } from "./audit";
import { placeVillageDecor } from "./decor";
import { placeHouseLotFences } from "./fences";
import {
  buildHouses,
  clearHouseRidgeRowProps,
  houseBlockedCells,
  houseStandoffCells,
  restoreHouseDoors,
  terrainBlockedCells,
} from "./houses";
import { createVillageHouseInteriors } from "./interiors";
import { dressVillageLandscape } from "./landscape";
import { npcOverrides, npcText, placeVillageNpcs } from "./npcs";
import {
  mergePlanIntoBuildArgs,
  snapshotProjectMaps,
  wipeAttemptMaps,
} from "./pipeline";
import { villagePlaza } from "./plaza";
import {
  boulevardCells,
  paintVillageRoadsChecked,
  plazaDeckBlockedCells,
  villageBoulevard,
  villageRoadAnchors,
} from "./roads";
import { COORD_SCHEMA, VILLAGE_HOUSE_PLAN_SCHEMA, VILLAGE_NPC_PLAN_SCHEMA } from "../schemaShapes";

export type VillageBuildDomainArgs = Readonly<Record<string, unknown>>;

export function buildVillageDomain(
  draft: Project,
  args: VillageBuildDomainArgs,
): ToolExecResult {
  const merged = mergePlanIntoBuildArgs(draft, args);
  const seed = integerArg(merged, "seed", 1);
  // houseCount 별칭 소비(2026-07-17) — 예전엔 build_village가 이를 조용히 무시해 8채 고정이었다.
  const housePlan = coerceHousePlan(merged.houses ?? merged.houseCount, merged.housePlans);
  const interiorEnabled = merged.interior !== false;
  const doorEventEnabled = merged.doorEvent !== false;
  const fencesEnabled = merged.fences !== false;
  const decorEnabled = merged.decor !== false;
  const warnings: string[] = [];
  // 사용자 저작 데이터 층 — 데이터베이스 「마을」탭 레코드가 코드 기본값을 이긴다.
  // 우선순위: 명시 인자 > 프리셋 > 테마 추론 > 씨앗값 파생.
  const presetId = typeof merged.presetId === "string" ? merged.presetId.trim() : "";
  const preset = presetId ? villagePresetById(draft, presetId) : undefined;
  if (presetId && !preset) {
    warnings.push(`마을 프리셋 '${presetId}'을 찾을 수 없어 코드 기본값으로 시공했다.`);
  }
  const presetValues = presetOverrides(preset);
  // 우선순위 규약대로 **명시 인자가 프리셋을 이긴다.** 프리셋의 templateIds 는 무작위 선택을
  // 좁히는 화이트리스트인데, 호출자가 housePlans[i].templateId 로 형태를 못박았다면 그것은
  // 좁히기의 대상이 아니라 요구다. 합집합을 취하지 않으면 카탈로그에서 걸러져 후보가 0 이 되고
  // houses.ts 의 강제 배치 검사가 house-template-unplaced 로 통째로 중단한다 — 모델이 프롬프트만
  // 보고 만들 수 있는 조합(프리셋 + 명시 형태)이 도구 전체를 죽이는 셈이다.
  const forcedTemplateIds = housePlan.templates.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0,
  );
  const allowedTemplateIds =
    presetValues.templateIds && presetValues.templateIds.length > 0
      ? [...new Set([...presetValues.templateIds, ...forcedTemplateIds])]
      : presetValues.templateIds;
  const catalog = villageTemplateCatalog(draft, allowedTemplateIds);
  warnings.push(...catalog.warnings);
  if (preset) {
    warnings.push(`마을 프리셋 적용: ${preset.name || preset.id} (형태 후보 ${catalog.templates.length}종).`);
  }
  if (merged.npcCount === undefined && presetValues.npcCount !== undefined) merged.npcCount = presetValues.npcCount;
  if (merged.groundTheme === undefined && presetValues.groundTheme !== undefined) merged.groundTheme = presetValues.groundTheme;
  const intent = resolveVillageIntent(merged, housePlan, presetValues, catalog.templates, preset?.id, preset?.name);
  const windows = coerceWindows(merged.windows);
  const overrides = npcOverrides(merged.npcs);
  if (!intent.theme && !hasExplicitVillageIntent(merged) && !merged.planId) {
    warnings.push(
      "계획/의도 없이 기본 레시피로 시공했다. " +
        "plan_village → build_village({ planId }) 또는 theme·housePlans·npcs를 넘겨라.",
    );
  }
  const createArgs = { ...args, ...merged };
  const mapId = typeof createArgs.mapId === "string" && String(createArgs.mapId).trim().length > 0
    ? String(createArgs.mapId).trim()
    : createVillageMap(draft, createArgs, seed);
  const map = requireVillageMap(draft, mapId);
  // 타일셋 스코프 가드 — village/ 모듈의 원시 타일 id는 전부 combined_town 좌표다.
  const tilesetForMap = draft.tilesets?.[map.tilesetId];
  if (!tilesetForMap || !isCombinedTownTileset(tilesetForMap)) {
    throw new ToolError(
      `build_village는 combined_town 칩셋(${DEFAULT_TILESET_ID}) 전용이다 — 이 맵의 타일셋: ${map.tilesetId}. ` +
        "다른 타일 그림판에서는 문/울타리/돌마당 타일 id가 전부 다른 그림이 된다.",
      { code: "village-tileset-mismatch", mapId },
    );
  }
  // 쿼리 상식 스펙: 강/호수 자리를 비운 채 주거 영역만 시공
  const planForReq = typeof merged.planId === "string" ? loadVillagePlan(draft, merged.planId) : undefined;
  const requirements = planForReq?.requirements
    ?? (typeof intent.theme === "string" && intent.theme
      ? inferRequirementsFromQuery(intent.theme)
      : undefined);
  const baseArea = villageBuildArea(map, createArgs.bounds);
  assertBuildAreaSize(map, baseArea);
  // E 하이브리드: requirements → 제약 마스크 → buildable 영역 + 물/숲 셀 회피
  const terrainMasks = requirements && requirements.landmarks.length > 0
    ? buildTerrainConstraintMasks(map, requirements, baseArea)
    : undefined;
  const reserved = terrainMasks?.buildableRect ?? { x: 0, y: 0, w: map.width, h: map.height };
  const area = intersectRects(baseArea, reserved);
  assertBuildAreaSize(map, area);
  if (requirements && requirements.landmarks.length > 0) {
    warnings.push(`상식 스펙 적용: ${requirements.mustExist.join(", ")}`);
  }

  const upperBefore = [...map.upperTiles];
  const rng = mulberry32(seed);
  const perf: string[] = [];
  let perfMark = Date.now();
  const perfLap = (label: string): void => {
    perf.push(`${label}=${((Date.now() - perfMark) / 1000).toFixed(1)}s`);
    perfMark = Date.now();
  };
  const plaza = villagePlaza(area, intent.plazaLayout, intent.settlementLayout, rng);
  // 면적 비례 기본 집 수(2026-07-17) — 요청이 없으면 100×100에도 8채가 깔리던 밀도 붕괴 방지.
  const targetHouses = housePlan.explicit
    ? housePlan.count
    : presetValues.houseCount
      ?? Math.min(MAX_HOUSES, Math.max(DEFAULT_HOUSES, Math.round((area.w * area.h) / 380)));
  // 대로 골격(대형 맵, 리서치 spine-first): 밴드를 집 배치 전에 예약해 구멍 없는 직선 대로 보장.
  const boulevard = villageBoulevard(area, plaza);
  const houseBlockedIdx = new Set<number>(terrainBlockedCells(terrainMasks) ?? []);
  if (boulevard) {
    for (const cell of boulevardCells(area, boulevard)) {
      if (cell.x >= 0 && cell.y >= 0 && cell.x < map.width && cell.y < map.height) {
        houseBlockedIdx.add(cell.y * map.width + cell.x);
      }
    }
  }
  // 대형 맵은 시가지 코어(61×61)에 집을 압축 — 외곽은 밭·숲·수변 몫 (리서치: 코어 압축 룰).
  const coreArea = boulevard
    ? intersectRects(area, { x: plaza.centerX - 30, y: plaza.centerRow - 30, w: 61, h: 61 })
    : area;
  // 자연 시공 순서: 집 배치 → 광장·대로·집 연결 길(얽기설기) → 문 복구 → 울타리
  // (예전엔 길→집이라 길이 집 자리를 선점하는 느낌이 났음)
  const houses = buildHouses(
    map, coreArea, plaza, targetHouses, rng, windows, intent, warnings,
    houseBlockedIdx.size > 0 ? houseBlockedIdx : undefined,
    boulevard ? { ewRow: boulevard.ewRow, nsCol: boulevard.nsCol } : undefined,
  );
  perfLap("houses");
  if (houses.length === 0) {
    throw new ToolError(
      "집을 한 채도 시공하지 못했다 — 맵/bounds가 좁거나 후보 슬롯이 전부 물·숲·광장에 막혀 있다. " +
        "맵을 키우거나 bounds를 넓히거나 houses 수를 줄여라.",
      { code: "no-houses-built", mapId },
    );
  }
  // 집 footprint(용마루 포함) + 장터 데크 = 하드 마스크 — 길이 절대 못 칠한다.
  const hardBlocked = new Set([...houseBlockedCells(houses), ...plazaDeckBlockedCells(plaza, intent)]);
  // 간선·루프용 스탠드오프 마스크 — 벽에서 1칸 띄운다 (문 앞 행은 개방).
  const throughBlocked = new Set([...hardBlocked, ...houseStandoffCells(houses)]);
  // 침범 금지 구역: 하드 마스크 + 수역(마스크 roles) — 훅이 시공 후 강제 점검한다.
  const roadForbidden = new Set(hardBlocked);
  if (terrainMasks) {
    for (let i = 0; i < terrainMasks.roles.length; i += 1) {
      if (terrainMasks.roles[i] === "water") {
        roadForbidden.add(coordKey(i % map.width, Math.floor(i / map.width)));
      }
    }
  }
  // 길 시공 강제 훅 — 시공→침범 점검→롤백 재시도(최대 100회), 시뮬레이션식.
  paintVillageRoadsChecked({
    draft,
    map,
    plaza,
    area,
    houses,
    intent,
    seed,
    warnings,
    hardBlocked,
    throughBlocked,
    forbidden: roadForbidden,
    boulevard,
  });
  perfLap("roads");
  // 문 하단/상단 안전 복구 (진입로 폭 확장·오프셋 대비)
  restoreHouseDoors(map, houses);
  // 길은 다 깐 뒤 울타리(길 칸 스킵)
  if (fencesEnabled) placeHouseLotFences(map, houses, seed, area);
  // 상점 클러스터(2026-07-17, 리서치: 상점=대로 접면+간판): 광장 게이트에 가장 가까운
  // 집 2채를 무기점/잡화점으로, 3순위는 여관으로 지정한다(내부 프로그램 + 간판은 decor).
  assignShopPrograms(houses, plaza, warnings);
  // 여관 간판: retro House 타일 그림판의 INN 간판(443)을 밴 슬롯 443에 이식 — 번호 그대로 재활용.
  ensureInnSignGraft(draft, map.tilesetId);

  // E 지형 패스: 마스크의 water/forest를 fill_region·place_props로 채움 (솔버 교체 포인트)
  // multi-turn 세션은 skipTerrain=true 후 water/forest_big 레이어로 분리 시공
  const skipTerrain = args.skipTerrain === true || merged.skipTerrain === true;
  let landmarkNotes: string[] = [];
  if (!skipTerrain && requirements && requirements.landmarks.length > 0) {
    const terrain = runTerrainConstraintPass(draft, map, requirements, warnings, baseArea);
    landmarkNotes = [...terrain.notes];
    if (terrain.notes.length > 0) warnings.push(`terrainPass: ${terrain.notes.join("; ")}`);
    restoreHouseDoors(map, houses);
  } else if (skipTerrain) {
    landmarkNotes = ["skipTerrain: multi-turn forest/water layers"];
  }
  perfLap("terrain");

  let decorPlaced = 0;
  if (decorEnabled) {
    decorPlaced = placeVillageDecor(draft, map, area, plaza, houses, seed, intent, warnings);
  }
  // 용마루 행 보호구역 정리 — 범용 place_props가 심은 나무/소품을 걷어낸다.
  clearHouseRidgeRowProps(map, houses);
  perfLap("decor");
  // 조경(2026-07-17): 대형 맵(대로 모드)은 시가지 코어 밖을 수변·밭·숲·설원 지구로 채운다.
  // 문법 규칙(수로=물의 논리, 백사장 접안, 눈↔밭 이격, 어둠+계단 세트)은 landscape.ts가 보증.
  if (boulevard) {
    const landscaped = dressVillageLandscape(map, { area, houses, plaza, seed, warnings });
    warnings.push(`조경 지구 ${landscaped}칸`);
    restoreHouseDoors(map, houses);
  }
  perfLap("landscape");
  // 배치 충돌 정리 — 이후 스테이지(terrain 물·decor 나무·landscape 수로)가 서로 다른
  // 시점에 같은 칸을 차지해 생기는 순서 결함(물 위 수관·통행불가 위 수관)을 지운다.
  // 승인 게이트(validateLayoutPlacement)와 같은 규칙이므로, 지나치면 통과한다.
  const scrubbed = scrubPlacementConflicts(draft, map);
  if (scrubbed.propsOnWater > 0 || scrubbed.treesOnImpassable > 0) {
    warnings.push(`배치 정리: 물 위 ${scrubbed.propsOnWater}칸·통행불가 위 ${scrubbed.treesOnImpassable}칸 소품/수관 제거`);
  }

  // 필수 랜드마크 실측 게이트 — 타일 카운트 기준. warning이 아니라 실패다.
  // ("강촌"인데 물 0칸인 맵이 성공으로 반환되는 것을 막는다. skipTerrain 세션은 water 레이어가 따로 검증.)
  if (!skipTerrain && requirements && requirements.landmarks.length > 0) {
    const needRiver = requirements.landmarks.includes("river") || requirements.landmarks.includes("harbor");
    const needLake = requirements.landmarks.includes("lake");
    if (needRiver || needLake) {
      const waterFloor = needRiver ? 30 : 25;
      const waterCells = countWaterCells(map, baseArea);
      if (waterCells < waterFloor) {
        throw new ToolError(
          `필수 수역 미시공: 실측 ${waterCells}칸 < ${waterFloor} — fill_region(물)이 실패했거나 타일셋에 물 어휘가 없다. 쿼리「${requirements.query}」`,
          { code: "landmark-water-missing", mapId },
        );
      }
    }
    if (requirements.landmarks.includes("forest")) {
      const treeCells = countTreeCells(map, baseArea);
      if (treeCells < 15) {
        throw new ToolError(
          `필수 숲 미시공: 실측 나무 ${treeCells}칸 < 15 — place_props(침엽수/활엽수)가 실패했다. 쿼리「${requirements.query}」`,
          { code: "landmark-forest-missing", mapId },
        );
      }
    }
  }
  const houseInteriors = interiorEnabled && doorEventEnabled
    ? createVillageHouseInteriors(draft, map, houses, overrides, seed, warnings)
    : [];
  perfLap("interiors");
  const requestedNpcCount = integerArg(merged, "npcCount", houses.length + 2);
  placeVillageNpcs(draft, map, area, houses, plaza, overrides, seed, warnings, requestedNpcCount);
  applyVillageGroundTheme(map, area, merged.groundTheme);
  setVillageHarnessLayoutPlan(map, area, plaza, houses, intent, seed, fencesEnabled, merged.settlementLayout);

  // 시작 좌표가 집/울타리 아래로 가면 커밋이 거부된다 — 광장 길로 옮긴다.
  ensureVillageStartPosition(draft, map, plaza);

  const audit = auditVillage(map, houses, upperBefore, area);
  perfLap("audit");
  warnings.push(`[vperf] ${perf.join(" ")}`);
  if (houses.length < targetHouses) warnings.push(`집 수 미달: ${houses.length}/${targetHouses}`);
  if (audit.doorsConnected < houses.length) warnings.push(`문 연결 미달: ${audit.doorsConnected}/${houses.length}`);
  if (audit.doorsIntact < houses.length) warnings.push(`문 타일 훼손: ${houses.length - audit.doorsIntact}곳`);
  if (audit.roadInsideHouses > 0) warnings.push(`집 내부를 침범한 도로 ${audit.roadInsideHouses}칸`);
  if (audit.ridgeInvaded > 0) warnings.push(`지붕 용마루 행 침범 ${audit.ridgeInvaded}칸 (길/소품이 지붕을 찢음)`);
  if (audit.roadComponents !== 1) {
    warnings.push(`길 연결 성분 미달: ${audit.roadComponents} — ${roadComponentNotes(map, area).join(", ")}`);
  }
  if (audit.npcCount !== requestedNpcCount) warnings.push(`NPC 수 미달: ${audit.npcCount}/${requestedNpcCount}`);
  if (audit.npcsWithText !== audit.npcCount) warnings.push(`대사 없는 NPC: ${audit.npcCount - audit.npcsWithText}명`);
  if (interiorEnabled && houseInteriors.length !== houses.length) warnings.push(`내부 생성 미달: ${houseInteriors.length}/${houses.length}`);
  if (fencesEnabled && audit.fencedHouses < houses.length) {
    warnings.push(`울타리 미달: ${audit.fencedHouses}/${houses.length}`);
  }

  const doorFronts = houses.map((house) => house.front);
  const critique = critiqueBuiltVillage(draft, map, doorFronts);
  if (!critique.ok) {
    warnings.push(`비평 루프: ${critique.summary}`);
    for (const issue of critique.issues) warnings.push(issue);
  }

  const themeLabel = intent.theme ? `「${intent.theme}」 ` : "";
  const reqNote = requirements && requirements.landmarks.length > 0
    ? ` 필수[${requirements.landmarks.join(",")}]`
    : "";
  return {
    summary:
      `마을 시공 ${themeLabel}: 집 ${houses.length}/${targetHouses}, 울타리 ${fencesEnabled ? audit.fencedHouses : 0}/${houses.length}, ` +
      `길 ${intent.pathStyle}, 마당 ${intent.yardStyle}, 광장 ${intent.plazaStyle}/${intent.plazaLayout}, ` +
      `소품 ${decorEnabled ? decorPlaced : 0}, 문 연결 ${audit.doorsConnected}/${houses.length}, ` +
      `길 성분 ${audit.roadComponents}, NPC ${audit.npcCount}, 내부 ${houseInteriors.length} (창문 ${audit.windowCount}).` +
      `${reqNote} 비평: ${critique.ok ? "통과" : "이슈"}.`,
    data: {
      mapId,
      bounds: area,
      requirements: requirements ?? undefined,
      landmarks: landmarkNotes,
      planId: typeof merged.planId === "string" ? merged.planId : undefined,
      theme: intent.theme || undefined,
      critique,
      intent: {
        pathStyle: intent.pathStyle,
        kitMix: intent.kitMix,
        yardStyle: intent.yardStyle,
        plazaStyle: intent.plazaStyle,
        edgeTrees: intent.edgeTrees,
        plazaLayout: intent.plazaLayout,
        roadWidth: intent.roadWidth,
        roadNaturalness: intent.roadNaturalness,
        settlementLayout: intent.settlementLayout,
      },
      housesBuilt: houses.length,
      // 경고를 결과 데이터로도 노출(2026-07-17) — 재시도 횟수·[vperf]·미달 사유가 호출자에게 보이게.
      warnings: warnings.length > 0 ? [...warnings] : undefined,
      fencesEnabled,
      fencedHouses: fencesEnabled ? audit.fencedHouses : 0,
      fenceTiles: fencesEnabled ? audit.fenceTiles : 0,
      pathStyle: intent.pathStyle,
      decorEnabled,
      decorPlaced: decorEnabled ? decorPlaced : 0,
      doorsConnected: audit.doorsConnected,
      doorsIntact: audit.doorsIntact,
      ridgeInvaded: audit.ridgeInvaded,
      roadComponents: audit.roadComponents,
      npcCount: audit.npcCount,
      interiorCount: houseInteriors.length,
      doorEventCount: houseInteriors.length,
      houses: houses.map((house, index) => {
        const interiorRef = houseInteriors[index];
        return {
          index,
          kitId: house.kitId,
          stories: house.stories,
          templateId: house.templateId,
          doorAt: house.doorAt,
          front: house.front,
          ownerName: house.ownerName ?? npcText(index, overrides).name,
          ...(interiorRef
            ? {
                interiorMapId: interiorRef.interiorMapId,
                doorEventId: interiorRef.doorEventId,
                exitEventId: interiorRef.exitEventId,
                entry: interiorRef.entry,
                exit: interiorRef.exit,
                returnTo: interiorRef.returnTo,
                interiorScale: interiorRef.scale,
                interiorProgram: interiorRef.program,
                interiorStories: interiorRef.stories,
                ...(interiorRef.upperMapId ? { upperMapId: interiorRef.upperMapId } : {}),
                ...(interiorRef.floorMapIds ? { floorMapIds: interiorRef.floorMapIds } : {}),
              }
            : {}),
        };
      }),
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export type VillageStructuralQa = {
  readonly ok: boolean;
  readonly doorsConnected: number;
  readonly doorsIntact: number;
  readonly roadComponents: number;
  readonly ridgeInvaded: number;
  readonly critiqueOk: boolean;
};

export type VillageBuildInspection = {
  readonly exteriorMapId: string;
  readonly interiorMapIds: readonly string[];
  readonly actualHouseCount: number;
  readonly npcCount: number;
  readonly structuralQa: VillageStructuralQa;
};

export function inspectVillageBuild(
  project: Project,
  result: ToolExecResult,
): VillageBuildInspection {
  const data = result.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new ToolError("build_village 결과 데이터가 객체가 아니다.", { code: "invalid-village-result" });
  }
  const exteriorMapId = Reflect.get(data, "mapId");
  const houses = Reflect.get(data, "houses");
  if (typeof exteriorMapId !== "string" || !project.maps[exteriorMapId] || !Array.isArray(houses)) {
    throw new ToolError("build_village 결과에 실제 외부 맵 또는 집 목록이 없다.", {
      code: "invalid-village-result",
      ...(typeof exteriorMapId === "string" ? { mapId: exteriorMapId } : {}),
    });
  }

  const interiorMapIds = new Set<string>();
  for (const house of houses) {
    if (typeof house !== "object" || house === null || Array.isArray(house)) continue;
    const candidates = [
      Reflect.get(house, "interiorMapId"),
      Reflect.get(house, "upperMapId"),
    ];
    const floorMapIds = Reflect.get(house, "floorMapIds");
    if (Array.isArray(floorMapIds)) candidates.push(...floorMapIds);
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate !== exteriorMapId && project.maps[candidate]) {
        interiorMapIds.add(candidate);
      }
    }
  }

  const numericMetric = (key: string): number => {
    const value = Reflect.get(data, key);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new ToolError(`build_village 결과의 ${key}가 숫자가 아니다.`, { code: "invalid-village-result", mapId: exteriorMapId });
    }
    return value;
  };
  const doorsConnected = numericMetric("doorsConnected");
  const doorsIntact = numericMetric("doorsIntact");
  const roadComponents = numericMetric("roadComponents");
  const ridgeInvaded = numericMetric("ridgeInvaded");
  const npcCount = numericMetric("npcCount");
  const critique = Reflect.get(data, "critique");
  const critiqueOk = typeof critique === "object"
    && critique !== null
    && !Array.isArray(critique)
    && Reflect.get(critique, "ok") === true;
  const actualHouseCount = houses.length;
  const structuralQa = {
    ok: actualHouseCount > 0
      && doorsConnected === actualHouseCount
      && doorsIntact === actualHouseCount
      && roadComponents === 1
      && ridgeInvaded === 0
      && critiqueOk,
    doorsConnected,
    doorsIntact,
    roadComponents,
    ridgeInvaded,
    critiqueOk,
  } satisfies VillageStructuralQa;

  return {
    exteriorMapId,
    interiorMapIds: [...interiorMapIds].sort(),
    actualHouseCount,
    npcCount,
    structuralQa,
  };
}

export const VILLAGE_TOOLS: readonly ToolDefinition[] = [
  {
    name: "plan_village",
    description:
      "마을 계층 계획을 검증·정규화한다(맵 타일은 변경하지 않음). " +
      "theme·pathStyle·yardStyle·plazaStyle·edgeTrees·plazaLayout·houses[{kitId,yard,ownerName}]·npcs·" +
      "buildOrder(시공 레이어 순서: 호수/강이면 water를 settlement 앞)를 넣으면 " +
      "정규화된 VillagePlan + 한 줄 요약 + issues를 돌려준다. 이어서 run_village_session / advance_village_build 또는 build_village({ planId }). " +
      "settlement 내부는 항상 집→길. 빈 계획 금지 — 테마 마을이면 theme을 반드시 넣을 것.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string", description: "마을 테마/사용자 쿼리(예: 강촌마을). 강·숲·장터 등 필수 스펙을 자동 추출한다." },
        query: { type: "string", description: "theme과 별도 원문 쿼리. 있으면 스펙 추출에 우선." },
        pathStyle: { type: "string", enum: ["sand", "dirt", "stone"], description: "stone=유기 돌마당 필드(성곽·석조 마을)" },
        kitMix: { type: "string", enum: ["mixed", "blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall"] },
        yardStyle: { type: "string", enum: ["mixed", "garden", "workshop", "market", "minimal"] },
        plazaStyle: { type: "string", enum: ["market", "garden", "empty"] },
        edgeTrees: { type: "string", enum: ["conifer", "dense", "none"] },
        plazaLayout: { type: "string", enum: ["center", "north", "south", "west", "east"] },
        houses: {
          type: "array",
          description: "집 계획 [{kitId?, yard?, ownerName?}]. 개수만 쓰려면 houseCount.",
          items: VILLAGE_HOUSE_PLAN_SCHEMA,
        },
        houseCount: { type: "integer", description: "집 수(4~32). houses 없을 때 사용." },
        housePlans: { type: "array", items: VILLAGE_HOUSE_PLAN_SCHEMA, description: "houses 별칭" },
        npcs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
          },
        },
        fences: { type: "boolean" },
        decor: { type: "boolean" },
        interior: { type: "boolean" },
        seed: { type: "integer" },
        mapName: { type: "string" },
        name: { type: "string", description: "mapName 별칭" },
        width: { type: "integer" },
        height: { type: "integer" },
        buildOrder: {
          type: "array",
          description:
            "시공 레이어 순서(LLM 기획). 호수/강: water를 settlement 앞. settlement 내부는 집→길 고정. " +
            "예: [plan,map,water,settlement,forest_conifer,forest_big,critique,look]",
          items: { type: "string" },
        },
        id: { type: "string", description: "계획 id(없으면 자동 생성)" },
      },
      required: ["theme"],
    },
    invalidArgsExample: {
      theme: "강가 어촌 장터",
      pathStyle: "sand",
      yardStyle: "market",
      plazaLayout: "south",
      buildOrder: ["plan", "map", "water", "settlement", "forest_conifer", "forest_big", "critique", "look"],
      houses: [
        { kitId: "bright-plaster", yard: ["barrel", "wood_box"], ownerName: "어부" },
        { kitId: "blue-stone", yard: ["mailbox", "flowers"], ownerName: "포구지기" },
        { kitId: "bright-plaster", yard: ["wood_box", "pot"] },
        { kitId: "blue-stone", yard: ["sign", "jar"] },
      ],
      npcs: [{ name: "어부", lines: ["오늘 파도가 잔잔하구나."] }],
      seed: 42,
    },
    run(draft, args): ToolExecResult {
      const raw = { ...args };
      if (raw.houses === undefined && raw.housePlans !== undefined) raw.houses = raw.housePlans;
      if (raw.houses === undefined && typeof raw.houseCount === "number") raw.houses = raw.houseCount;
      const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
      const { plan, issues, ok } = normalizeVillagePlan(raw, seed);
      if (!ok) {
        throw new ToolError(
          `마을 계획 검증 실패: ${issues.filter((i) => i.severity === "error").map((i) => i.message).join(" / ")}`,
          { code: "invalid-plan" },
        );
      }
      storeVillagePlan(draft, plan);
      const mapW = plan.width ?? DEFAULT_SIZE;
      const mapH = plan.height ?? DEFAULT_SIZE;
      const draftSpec = villagePlanToBuildSpec(plan, "__pending_map__", mapW, mapH);
      const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);
      return {
        summary: `마을 계획 확정: ${plan.summary}`,
        data: {
          planId: plan.id,
          plan,
          previewSummary: plan.summary,
          draftSpec,
          issues,
          next:
            `materialize_village_spec({ planId: "${plan.id}", mapId }) 또는 ` +
            `run_village_pipeline({ planId: "${plan.id}" }) / build_village({ planId })`,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  },
  {
    name: "materialize_village_spec",
    description:
      "plan_village 결과를 set_build_spec 형태의 BuildSpec으로 파생·검증한다. " +
      "맵이 이미 있어야 한다(mapId). 통과 시 planId에 스펙을 저장. " +
      "에이전트 세션에서는 이 data.spec으로 set_build_spec을 호출하면 된다.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        mapId: { type: "string" },
      },
      required: ["planId", "mapId"],
    },
    invalidArgsExample: { planId: "vplan_1", mapId: "map_village_1" },
    run(draft, args): ToolExecResult {
      const planId = String(args.planId ?? "").trim();
      const mapId = String(args.mapId ?? "").trim();
      const plan = loadVillagePlan(draft, planId);
      if (!plan) throw new ToolError(`planId '${planId}' 없음 — plan_village 먼저.`, { code: "plan-not-found" });
      const map = draft.maps[mapId];
      if (!map) throw new ToolError(`맵 없음: ${mapId}`, { code: "map-not-found", mapId });
      const spec = villagePlanToBuildSpec(plan, mapId, map.width, map.height);
      const issues = validateBuildSpec(draft, spec);
      const errors = issues.filter((i) => i.severity === "error");
      if (errors.length > 0) {
        throw new ToolError(
          `스펙 검증 실패: ${errors.map((e) => e.message).join(" / ")}`,
          { code: "spec-invalid" },
        );
      }
      storeVillageSpec(draft, planId, spec);
      return {
        summary: `마을 스펙 확정: assets ${spec.assets.length} · ${spec.title ?? plan.theme}`,
        data: {
          planId,
          mapId,
          spec,
          issues,
          next: `set_build_spec에 동일 spec 제출 후 build_village({ planId: "${planId}", mapId: "${mapId}" })`,
        },
      };
    },
  },
  {
    name: "evaluate_village_look",
    description:
      "시공 후 룩+구조 게이트. 결정론 휴리스틱으로 테마/밀도/광장/나무/도달을 평가하고 " +
      "실패 시 fixes·feedbackForLlm을 반환한다(맵 변경 없음). " +
      "멀티모달 LLM은 show_map_region 이미지와 함께 같은 fixes 스키마로 보완 가능. " +
      "실패 시 revise_village_plan 또는 run_village_pipeline 재시도.",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        planId: { type: "string" },
        attempt: { type: "integer" },
        maxAttempts: { type: "integer" },
        doorFronts: { type: "array", items: COORD_SCHEMA, description: "[{x,y}] 문 앞 좌표" },
      },
      required: ["mapId"],
    },
    invalidArgsExample: { mapId: "map_village_1", planId: "vplan_1", attempt: 1 },
    run(project, args): ToolExecResult {
      const mapId = String(args.mapId ?? "");
      const planId = typeof args.planId === "string" ? args.planId : undefined;
      const plan = planId ? loadVillagePlan(project, planId) : undefined;
      const doorFronts = Array.isArray(args.doorFronts)
        ? args.doorFronts
            .filter((e): e is { x: number; y: number } =>
              typeof e === "object" && e !== null
              && typeof (e as { x?: unknown }).x === "number"
              && typeof (e as { y?: unknown }).y === "number")
            .map((e) => ({ x: e.x, y: e.y }))
        : undefined;
      const report = evaluateVillageLook({
        project,
        mapId,
        plan,
        doorFronts,
        attempt: typeof args.attempt === "number" ? args.attempt : 1,
        maxAttempts: typeof args.maxAttempts === "number" ? args.maxAttempts : 2,
      });
      return {
        summary: report.ok
          ? `마을 룩 게이트 통과 (score ${report.score})`
          : `마을 룩 게이트 실패 (score ${report.score}) — ${report.issues[0] ?? "이슈"}`,
        data: report,
      };
    },
  },
  {
    name: "revise_village_plan",
    description:
      "evaluate_village_look 실패 시 feedback fixes를 plan에 패치해 새 planId로 저장한다(맵 변경 없음). " +
      "이어서 materialize_village_spec + build_village 또는 run_village_pipeline.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        evaluation: {
          type: "object",
          description: "evaluate_village_look의 data 전체",
          // 평가 payload 는 evaluate_village_look 출력을 그대로 되돌려주는 자리다 — 스키마로 고정하지 않는다.
          additionalProperties: true,
        },
      },
      required: ["planId", "evaluation"],
    },
    invalidArgsExample: { planId: "vplan_1", evaluation: { ok: false, attempt: 1, fixes: [] } },
    run(draft, args): ToolExecResult {
      const planId = String(args.planId ?? "").trim();
      const plan = loadVillagePlan(draft, planId);
      if (!plan) throw new ToolError(`planId '${planId}' 없음`, { code: "plan-not-found" });
      const evaluation = args.evaluation as VillageLookReport;
      const patch = planPatchFromLookReport(plan, evaluation);
      const { plan: next, issues, ok } = normalizeVillagePlan(patch, plan.seed + 1);
      if (!ok) {
        throw new ToolError(`계획 패치 실패: ${issues.map((i) => i.message).join(" / ")}`, { code: "invalid-plan" });
      }
      storeVillagePlan(draft, next);
      return {
        summary: `계획 개정: ${plan.id} → ${next.id} · ${next.summary}`,
        data: {
          previousPlanId: plan.id,
          planId: next.id,
          plan: next,
          previewSummary: next.summary,
          next: `run_village_pipeline({ planId: "${next.id}" }) 또는 build_village({ planId: "${next.id}" })`,
        },
      };
    },
  },
  {
    name: "run_village_pipeline",
    description:
      "plan→(맵 생성)→스펙 파생·검증→build→critique/look 평가. 실패 시 plan 패치 후 최대 maxAttempts회 재시공. " +
      "planId 또는 theme 등 plan 인자. 에디터/에이전트 원큐 파이프라인.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string" },
        maxAttempts: { type: "integer", description: "기본 2" },
        theme: { type: "string" },
        seed: { type: "integer" },
        width: { type: "integer" },
        height: { type: "integer" },
        pathStyle: { type: "string" },
        yardStyle: { type: "string" },
        plazaStyle: { type: "string" },
        plazaLayout: { type: "string" },
        edgeTrees: { type: "string" },
        houses: { type: "array", items: VILLAGE_HOUSE_PLAN_SCHEMA },
        npcs: { type: "array", items: VILLAGE_NPC_PLAN_SCHEMA },
      },
    },
    invalidArgsExample: { planId: "vplan_1", maxAttempts: 2 },
    run(draft, args): ToolExecResult {
      return runVillagePipeline(draft, args);
    },
  },
  {
    name: "critique_village",
    description:
      "시공된 마을의 비평 루프: 문 연결·길 성분·시작점→문 앞 도달을 검사한다. " +
      "build_village 직후 호출. 실패 시 issues와 수정 힌트를 반환(맵은 변경하지 않음).",
    mode: "read",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        doorFronts: {
          type: "array",
          description: "[{x,y}] 문 앞 좌표. 생략 시 맵 이벤트 중 문 transfer 근처를 추정하지 않고 start만 검사.",
          items: COORD_SCHEMA,
        },
      },
      required: ["mapId"],
    },
    invalidArgsExample: { mapId: "map_village_1" },
    run(project, args): ToolExecResult {
      return critiqueVillageMap(project, args);
    },
  },
  {
    name: "build_village",
    description:
      "집 키트 기반 마을을 한 번에 시공한다(제약 시공기). " +
      "**권장:** plan_village 후 build_village({ planId }) 또는 build_village({ plan }). " +
      "또는 theme·housePlans·npcs 등 의도 필드를 직접 전달. " +
      "코드가 광장/길/집/울타리/소품/NPC를 시공하고, data.critique에 문 연결·도달 요약을 넣는다. " +
      "집 좌표를 직접 찍으려면 build_house_lots.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        planId: { type: "string", description: "plan_village가 돌려준 계획 id" },
        plan: {
          type: "object",
          description: "VillagePlan 객체(plan_village 결과 plan 필드)",
          // plan_village 가 돌려준 계획을 그대로 되돌려주는 자리다.
          additionalProperties: true,
        },
        mapId: { type: "string", description: "기존 맵에 시공한다. 최소 36x36 필요." },
        name: { type: "string", description: "새 맵 이름(기본: 마을 50x50)" },
        width: { type: "integer", description: "새 맵 가로(기본 50, 36~256)" },
        height: { type: "integer", description: "새 맵 세로(기본 50, 36~256)" },
        theme: {
          type: "string",
          description:
            "마을 테마 한 줄(예: 강가 어촌, 산골 광산촌, 장터 마을). pathStyle/yardStyle 등 미지정 시 휴리스틱으로 추론한다.",
        },
        houseCount: { type: "integer", description: "집 수(4~32). houses/housePlans 없을 때 사용. 미지정 시 면적 비례 기본값." },
        fences: { type: "boolean", description: "집 필지 울타리(기본 true). false면 울타리를 깔지 않는다." },
        decor: {
          type: "boolean",
          description: "마당 소품·외곽 나무·광장 꾸밈(기본 true). false면 소품 산포 생략.",
        },
        pathStyle: {
          type: "string",
          enum: ["sand", "dirt", "stone"],
          description: "길 재질. 기본 sand. stone=유기 돌마당 필드(성곽·석조 마을). theme 힌트로 덮일 수 있음.",
        },
        kitMix: {
          type: "string",
          enum: ["mixed", "blue-stone", "bright-plaster", "amber-wood", "slate-wood", "timber-hall"],
          description: "집 키트 믹스(기본 mixed). houses[].kitId가 있으면 집 단위가 우선.",
        },
        yardStyle: {
          type: "string",
          enum: ["mixed", "garden", "workshop", "market", "minimal"],
          description: "마당 꾸밈 스타일 팩(기본 mixed). houses[].yard가 있으면 집 단위가 우선.",
        },
        plazaStyle: {
          type: "string",
          enum: ["market", "garden", "empty"],
          description: "광장 소품(기본 market=벤치+꽃, garden=꽃 위주, empty=없음).",
        },
        skipTerrain: {
          type: "boolean",
          description:
            "true면 강/숲 terrain 패스를 생략한다. multi-turn 세션(advance_village_build)이 water/forest 레이어를 따로 시공할 때 사용.",
        },
        edgeTrees: {
          type: "string",
          enum: ["conifer", "dense", "none"],
          description: "맵 가장자리 나무(기본 conifer, dense=더 많음, none=없음).",
        },
        plazaLayout: {
          type: "string",
          enum: ["center", "north", "south", "west", "east"],
          description: "광장 위치 바이어스(기본 center).",
        },
        bounds: {
          type: "object",
          description: "기존 맵 안에서 마을을 배치할 경계 사각형. 지정 시 그 안에 광장/집/길/NPC를 배치한다.",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            w: { type: "integer" },
            h: { type: "integer" },
          },
          required: ["x", "y", "w", "h"],
        },
        houses: { type: "integer", description: "목표 집 수(기본 8, 4~32). housePlans가 있으면 그 길이가 우선." },
        housePlans: {
          type: "array",
          description:
            "LLM 집 단위 의도 [{kitId?, yard: 태그[]}]. 길이=집 수. " +
            "yard: firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|sign|barrel. " +
            "좌표(wings)는 코드가 잡는다 — 좌표까지 직접 찍으려면 build_house_lots.",
          items: {
            type: "object",
            properties: {
              kitId: { type: "string", enum: ["blue-stone", "bright-plaster", "amber-wood", "slate-wood"] },
              yard: { type: "array", items: { type: "string" }, description: "마당 꾸밈 태그" },
            },
          },
        },
        seed: { type: "integer", description: "결정론 PRNG 시드(기본 1)" },
        interior: { type: "boolean", description: "집마다 내부 맵과 Object1 문 이벤트를 생성(기본 true). false면 기존 외장/문 타일만 만든다." },
        doorEvent: { type: "boolean", description: "Object1 문 이벤트와 내부 맵을 생성(기본 true, interior:false면 비활성)" },
        windows: {
          type: "object",
          description: "창문 자동 배치 옵션(기본: 켜짐). {enabled:false}로 끄고, {spacing:N}으로 창문 사이 벽 칸 수 지정(기본 2). boolean 도 하위 호환으로 수용.",
          properties: {
            enabled: { type: "boolean", description: "창문 배치 여부(기본 true)" },
            spacing: { type: "integer", description: "창문 사이 벽 칸 수(기본 2)" },
          },
        },
        npcs: {
          type: "array",
          description: "LLM이 쓰는 이름/대사 오버라이드. [{name, lines:string[]}] 순서대로 소비(집 주민+광장 2명).",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    invalidArgsExample: {
      planId: "vplan_abc",
      seed: 7,
    },
    run(draft, args): ToolExecResult {
      return buildVillageDomain(draft, args);
    },
  },
];

function integerArg(args: Record<string, unknown>, key: string, fallback: number, min?: number, max?: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  }
  if (min !== undefined && value < min) throw new ToolError(`${key}는 ${min} 이상이어야 합니다.`, { code: "invalid-args" });
  if (max !== undefined && value > max) throw new ToolError(`${key}는 ${max} 이하여야 합니다.`, { code: "invalid-args" });
  return value;
}

function coerceWindows(value: unknown): HouseKitWindowsOption | undefined {
  if (value === undefined || value === true) return undefined;
  if (value === false) return false;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("windows는 boolean 또는 {enabled?, spacing?} 객체여야 합니다.", { code: "invalid-args" });
  }
  if ((value as Record<string, unknown>).enabled === false) return false;
  const spacing = (value as Record<string, unknown>).spacing;
  if (spacing === undefined) return {};
  if (typeof spacing !== "number" || !Number.isInteger(spacing) || spacing < 0) {
    throw new ToolError("windows.spacing은 0 이상의 정수여야 합니다.", { code: "invalid-args" });
  }
  return { spacing };
}

function createVillageMap(draft: Project, args: Record<string, unknown>, seed: number): string {
  const width = integerArg(args, "width", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = integerArg(args, "height", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const name = typeof args.name === "string" && args.name.trim().length > 0 ? args.name.trim() : "마을 50x50";
  const id = uniqueId(draft, "map_village", `${seed >>> 0}_${width}x${height}`);
  const size = width * height;
  const map: GameMap = {
    id,
    name,
    width,
    height,
    tilesetId: DEFAULT_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(size).fill(TILE.GRASS),
    upperTiles: new Array<number>(size).fill(TILE.EMPTY),
    events: [],
  };
  draft.maps[id] = map;
  if (!draft.maps[draft.mapTree.mapId]) {
    draft.mapTree = { mapId: id, children: [] };
  } else if (draft.mapTree.mapId !== id && !draft.mapTree.children.some((child) => child.mapId === id)) {
    draft.mapTree.children.push({ mapId: id, children: [] });
  }
  if (!draft.maps[draft.startMapId]) {
    draft.startMapId = id;
    draft.startPos = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }
  return id;
}

function requireVillageMap(draft: Project, mapId: string): GameMap {
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  return map;
}

function villageBuildArea(map: GameMap, value: unknown): Rect {
  if (value === undefined) return { x: 0, y: 0, w: map.width, h: map.height };
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError("bounds는 {x,y,w,h} 객체여야 합니다.", { code: "invalid-args", mapId: map.id });
  }
  const bounds = value as Record<string, unknown>;
  for (const field of ["x", "y", "w", "h"] as const) {
    if (typeof bounds[field] !== "number" || !Number.isInteger(bounds[field]) || !Number.isFinite(bounds[field])) {
      throw new ToolError(`bounds.${field}는 정수여야 합니다.`, { code: "invalid-args", mapId: map.id });
    }
  }
  return { x: bounds.x as number, y: bounds.y as number, w: bounds.w as number, h: bounds.h as number };
}

function assertBuildAreaSize(map: GameMap, area: Rect): void {
  if (area.x < 0 || area.y < 0 || area.x + area.w > map.width || area.y + area.h > map.height) {
    throw new ToolError(`build_village bounds가 맵 경계를 벗어납니다: ${area.x},${area.y},${area.w}x${area.h}`, {
      code: "bounds-out-of-map",
      mapId: map.id,
    });
  }
  if (area.w < MIN_SIZE || area.h < MIN_SIZE) {
    throw new ToolError(`build_village는 최소 ${MIN_SIZE}x${MIN_SIZE} 영역이 필요합니다: ${area.w}x${area.h}`, {
      code: area.w === map.width && area.h === map.height ? "map-too-small" : "bounds-too-small",
      mapId: map.id,
    });
  }
}

interface HousePlanCoerced {
  readonly count: number;
  readonly explicit: boolean;
  readonly yards: readonly (readonly YardDecorKind[])[];
  readonly kits: readonly (HouseKitId | undefined)[];
  readonly templates: readonly (string | undefined)[];
  readonly owners: readonly (string | undefined)[];
  readonly programs: readonly (HouseInteriorProgram | undefined)[];
}

const HOUSE_INTERIOR_PROGRAMS = ["dwelling", "shop", "inn", "workshop", "study", "manor"] as const;

function isHouseInteriorProgram(value: string): value is HouseInteriorProgram {
  return (HOUSE_INTERIOR_PROGRAMS as readonly string[]).includes(value);
}

function coerceHousePlan(housesArg: unknown, housePlansArg: unknown): HousePlanCoerced {
  if (Array.isArray(housePlansArg) && housePlansArg.length > 0) {
    const yards: YardDecorKind[][] = [];
    const kits: (HouseKitId | undefined)[] = [];
    const templates: (string | undefined)[] = [];
    const owners: (string | undefined)[] = [];
    const programs: (HouseInteriorProgram | undefined)[] = [];
    for (let i = 0; i < housePlansArg.length; i += 1) {
      const entry = housePlansArg[i];
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        throw new ToolError(`housePlans[${i}]는 객체여야 합니다.`, { code: "invalid-args" });
      }
      const record = entry as Record<string, unknown>;
      const kit = record.kitId;
      if (kit !== undefined && !isHouseKitId(kit)) {
        throw new ToolError(`housePlans[${i}].kitId는 ${ALL_HOUSE_KIT_IDS.join("|")}여야 합니다.`, { code: "invalid-args" });
      }
      kits.push(kit as HouseKitId | undefined);
      yards.push(coerceYardTags(record.yard, `housePlans[${i}].yard`));
      const templateId = record.templateId;
      if (templateId !== undefined && typeof templateId !== "string") {
        throw new ToolError(`housePlans[${i}].templateId는 문자열이어야 합니다.`, { code: "invalid-args" });
      }
      templates.push(typeof templateId === "string" ? templateId : undefined);
      const ownerName = record.ownerName;
      if (ownerName !== undefined && typeof ownerName !== "string") {
        throw new ToolError(`housePlans[${i}].ownerName는 문자열이어야 합니다.`, { code: "invalid-args" });
      }
      owners.push(typeof ownerName === "string" && ownerName.trim() ? ownerName.trim() : undefined);
      const program = record.program;
      if (program !== undefined) {
        if (typeof program !== "string" || !isHouseInteriorProgram(program)) {
          throw new ToolError(
            `housePlans[${i}].program은 dwelling|shop|inn|workshop|study|manor 중 하나여야 합니다.`,
            { code: "invalid-args" },
          );
        }
        programs.push(program);
      } else {
        programs.push(undefined);
      }
    }
    const count = Math.min(MAX_HOUSES, Math.max(MIN_HOUSES, housePlansArg.length));
    return {
      count,
      explicit: true,
      yards: yards.slice(0, count),
      kits: kits.slice(0, count),
      templates: templates.slice(0, count),
      owners: owners.slice(0, count),
      programs: programs.slice(0, count),
    };
  }
  const count = typeof housesArg === "number" && Number.isInteger(housesArg)
    ? Math.min(MAX_HOUSES, Math.max(MIN_HOUSES, housesArg))
    : DEFAULT_HOUSES;
  if (housesArg !== undefined && (typeof housesArg !== "number" || !Number.isInteger(housesArg))) {
    throw new ToolError("houses는 정수이거나 housePlans 배열을 쓰세요.", { code: "invalid-args" });
  }
  // explicit=false면 빌더가 맵 면적 비례 기본값으로 대체한다(100×100에 8채 고정 방지).
  return { count, explicit: housesArg !== undefined, yards: [], kits: [], templates: [], owners: [], programs: [] };
}

/**
 * 상점 클러스터 지정(2026-07-17) — 광장 게이트에서 가까운 집부터 무기점·잡화점·여관 프로그램을
 * 부여한다(이미 프로그램이 있으면 건너뜀). 간판(472/473)은 decor가 이 프로그램을 보고 건다.
 */
function assignShopPrograms(houses: BuiltHouse[], plaza: Plaza, warnings: string[]): void {
  if (houses.length < 3) return;
  const gate = { x: plaza.centerX, y: plaza.rect.y + plaza.rect.h };
  const order = houses
    .map((house, index) => ({ index, dist: Math.abs(house.front.x - gate.x) + Math.abs(house.front.y - gate.y) }))
    .sort((a, b) => a.dist - b.dist)
    .filter(({ index }) => houses[index]!.program === undefined)
    .map(({ index }) => index);
  const roles: HouseInteriorProgram[] = ["shop", "shop", "inn"];
  const assigned: string[] = [];
  for (let i = 0; i < roles.length && i < order.length; i += 1) {
    const index = order[i]!;
    houses[index] = { ...houses[index]!, program: roles[i] };
    assigned.push(`${index}:${roles[i]}`);
  }
  if (assigned.length > 0) warnings.push(`상점가 지정: ${assigned.join(", ")} (광장 근접순)`);
}

/**
 * 여관 간판 이식(2026-07-17) — combined_town에는 여관 간판이 없어서, retro House 칩셋의
 * INN 간판(443)을 사용 금지 슬롯 443에 타일 이식한다. 넘버링 불변(덮어쓰기 모드).
 */
export const INN_SIGN_TILE = 443;
function ensureInnSignGraft(draft: Project, tilesetId: string): void {
  const tileset = draft.tilesets[tilesetId];
  if (!tileset) return;
  const grafts = tileset.tileGrafts ?? [];
  if (grafts.some((graft) => graft.targetTile === INN_SIGN_TILE)) return;
  tileset.tileGrafts = [
    ...grafts,
    { targetTile: INN_SIGN_TILE, sourceChipset: "tex_easyrpg_chipset_retro_house", sourceTile: 443 },
  ];
}

function coerceYardTags(value: unknown, label: string): YardDecorKind[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError(`${label}는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
  const out: YardDecorKind[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isYardDecorKind(item)) {
      throw new ToolError(
        `${label} 태그 '${String(item)}'는 지원하지 않습니다. firewood|mailbox|pot|jar|bench_h|bench_v|flowers|fruit_box|wood_box|table_h|sign|barrel`,
        { code: "invalid-args" },
      );
    }
    out.push(item);
  }
  return out;
}

function hasExplicitVillageIntent(args: Record<string, unknown>): boolean {
  return Boolean(
    (typeof args.theme === "string" && args.theme.trim())
    || args.pathStyle !== undefined
    || args.kitMix !== undefined
    || args.yardStyle !== undefined
    || args.plazaStyle !== undefined
    || args.edgeTrees !== undefined
    || args.plazaLayout !== undefined
    || (Array.isArray(args.housePlans) && args.housePlans.length > 0)
    || (Array.isArray(args.npcs) && args.npcs.length > 0),
  );
}

function resolveVillageIntent(
  args: Record<string, unknown>,
  housePlan: HousePlanCoerced,
  presetValues: PresetOverrides,
  templateCatalog: readonly HouseTemplate[],
  presetId: string | undefined,
  presetName: string | undefined,
): VillageIntent {
  const theme = typeof args.theme === "string" ? args.theme.trim() : "";
  const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 1;
  // 프리셋이 있으면 테마 추론보다 앞선다 — 사용자가 직접 정한 값이 휴리스틱을 이긴다.
  const inferred = { ...inferIntentFromTheme(theme), ...presetValues };
  const pathStyle = args.pathStyle !== undefined ? coercePathStyle(args.pathStyle) : (inferred.pathStyle ?? DEFAULT_ROAD_STYLE);
  const kitMix = coerceEnum(args.kitMix, ["mixed", "blue-stone", "bright-plaster", "amber-wood", "slate-wood"] as const, inferred.kitMix ?? "mixed", "kitMix");
  const yardStyle = coerceEnum(args.yardStyle, ["mixed", "garden", "workshop", "market", "minimal"] as const, inferred.yardStyle ?? "mixed", "yardStyle");
  const plazaStyle = coerceEnum(args.plazaStyle, ["market", "garden", "empty"] as const, inferred.plazaStyle ?? "market", "plazaStyle");
  const edgeTrees = coerceEnum(args.edgeTrees, ["conifer", "dense", "none"] as const, inferred.edgeTrees ?? "conifer", "edgeTrees");
  const plazaLayout = coerceEnum(args.plazaLayout, ["center", "north", "south", "west", "east"] as const, inferred.plazaLayout ?? "center", "plazaLayout");
  // 길 폭·자연도·배치 패턴: 명시 인자 → 프리셋 → seed 파생 (전부 1칸 직선 금지)
  const roadWidth = typeof args.roadWidth === "number" && Number.isInteger(args.roadWidth)
    ? Math.min(MAX_ROAD_WIDTH, Math.max(2, args.roadWidth))
    : presetValues.roadWidth ?? (seed % 2 === 0 ? 3 : DEFAULT_ROAD_WIDTH);
  const roadNaturalness = typeof args.roadNaturalness === "number" && Number.isFinite(args.roadNaturalness)
    ? Math.min(1, Math.max(0.35, args.roadNaturalness))
    : presetValues.roadNaturalness ?? 0.4 + ((seed >>> 3) % 4) * 0.1; // 0.4~0.7
  // plaza-ring을 기본으로 두고 seed로 가끔만 변형 (항상 clusters면 집 수가 줄어 회귀)
  const defaultSettlement: SettlementLayout = presetValues.settlementLayout ?? (seed % 5 === 0
    ? "clusters"
    : seed % 3 === 0
      ? "street-grid"
      : "plaza-ring");
  const settlementLayout = coerceEnum(
    args.settlementLayout,
    ["plaza-ring", "street-grid", "clusters"] as const,
    defaultSettlement,
    "settlementLayout",
  );
  return {
    theme,
    templateCatalog,
    ...(presetId ? { presetId } : {}),
    ...(presetName ? { presetName } : {}),
    pathStyle,
    kitMix,
    yardStyle,
    plazaStyle,
    edgeTrees,
    plazaLayout,
    roadWidth,
    roadNaturalness,
    settlementLayout,
    houseYards: housePlan.yards,
    houseKits: housePlan.kits,
    houseTemplates: housePlan.templates,
    houseOwners: housePlan.owners,
    housePrograms: housePlan.programs,
  };
}

function inferIntentFromTheme(theme: string): Partial<Pick<VillageIntent, "pathStyle" | "kitMix" | "yardStyle" | "plazaStyle" | "edgeTrees" | "plazaLayout">> {
  if (!theme) return {};
  const t = theme.toLowerCase();
  // 성곽·석조 마을 = 포석(129 블록) 돌길 (참조 맵 학습 2026-07-16)
  if (/성곽|석조|돌길|성문|castle|citadel/.test(t)) {
    return { pathStyle: "stone", yardStyle: "workshop", plazaStyle: "garden", edgeTrees: "conifer" };
  }
  if (/어촌|항구|바다|호수|강가|해안|coast|harbor|lake|river|beach|sand/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", plazaLayout: "south", edgeTrees: "conifer" };
  }
  if (/장터|시장|market|fair|축제/.test(t)) {
    return { pathStyle: "sand", yardStyle: "market", plazaStyle: "market", edgeTrees: "conifer" };
  }
  if (/농|밭|촌락|farm|rural|목장|목축/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "dense", plazaLayout: "center" };
  }
  if (/광산|산골|mine|mountain|채석/.test(t)) {
    return { pathStyle: "dirt", yardStyle: "workshop", plazaStyle: "empty", edgeTrees: "dense", kitMix: "blue-stone" };
  }
  if (/정원|꽃|garden/.test(t)) {
    return { pathStyle: "sand", yardStyle: "garden", plazaStyle: "garden", edgeTrees: "conifer" };
  }
  return {};
}

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string,
): T {
  if (value === undefined) return fallback;
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  throw new ToolError(`${label}는 ${allowed.join("|")} 중 하나여야 합니다.`, { code: "invalid-args" });
}

function coercePathStyle(value: unknown): RoadStyle {
  if (value === undefined) return DEFAULT_ROAD_STYLE;
  if (value === "sand" || value === "dirt" || value === "stone") return value;
  throw new ToolError("pathStyle는 \"sand\"|\"dirt\"|\"stone\" 중 하나여야 합니다.", { code: "invalid-args" });
}

function villageTool(name: string): ToolDefinition {
  const tool = VILLAGE_TOOLS.find((entry) => entry.name === name);
  if (!tool) throw new Error(`마을 툴 없음: ${name}`);
  return tool;
}

function intersectRects(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, x2 - x), h: Math.max(0, y2 - y) };
}

/** plan → build → spec → look 평가 → 실패 시 plan 패치 재시공. */
function runVillagePipeline(draft: Project, args: Record<string, unknown>): ToolExecResult {
  const maxAttempts = typeof args.maxAttempts === "number" && Number.isInteger(args.maxAttempts)
    ? Math.min(3, Math.max(1, args.maxAttempts))
    : 2;

  let planId = typeof args.planId === "string" ? args.planId.trim() : "";
  let plan = planId ? loadVillagePlan(draft, planId) : undefined;

  if (!plan) {
    const theme = typeof args.theme === "string" && args.theme.trim() ? args.theme.trim() : "평범한 마을";
    const planned = villageTool("plan_village").run(draft, { ...args, theme });
    planId = String((planned.data as { planId: string }).planId);
    plan = loadVillagePlan(draft, planId);
  }
  if (!plan || !planId) throw new ToolError("파이프라인에 계획이 없다.", { code: "plan-not-found" });

  const log: Record<string, unknown>[] = [];
  let lastBuildData: Record<string, unknown> | undefined;
  let lastEval: VillageLookReport | undefined;
  let lastSummary = "";

  // 재시도 정리의 기준선 — 파이프라인 진입 전에 있던 맵은 절대 지우지 않는다.
  const baseline = snapshotProjectMaps(draft);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) wipeAttemptMaps(draft, baseline);

    try {
      const built = buildVillageDomain(draft, { planId });
      lastSummary = built.summary;
      lastBuildData = (built.data ?? {}) as Record<string, unknown>;
      log.push({ step: "build", attempt, summary: built.summary });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push({ step: "build", attempt, error: message });
      throw err;
    }

    const mapId = String(lastBuildData.mapId ?? "");
    try {
      const specResult = villageTool("materialize_village_spec").run(draft, { planId, mapId });
      log.push({ step: "spec", attempt, summary: specResult.summary, spec: (specResult.data as { spec?: BuildSpec })?.spec });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.push({ step: "spec", attempt, error: message });
      // 스펙 실패해도 룩 평가는 진행 (시공은 이미 됨)
    }

    const houses = Array.isArray(lastBuildData.houses) ? lastBuildData.houses as { front: { x: number; y: number } }[] : [];
    lastEval = evaluateVillageLook({
      project: draft,
      mapId,
      plan: loadVillagePlan(draft, planId),
      doorFronts: houses.map((house) => house.front),
      attempt,
      maxAttempts,
    });
    log.push({
      step: "evaluate",
      attempt,
      ok: lastEval.ok,
      score: lastEval.score,
      issues: lastEval.issues,
      feedbackForLlm: lastEval.feedbackForLlm,
    });

    if (lastEval.ok) {
      return {
        summary: `마을 파이프라인 성공 (${attempt}/${maxAttempts}): ${lastSummary}`,
        data: {
          ok: true,
          planId,
          mapId,
          attempt,
          maxAttempts,
          evaluation: lastEval,
          build: lastBuildData,
          log,
        },
      };
    }

    if (attempt < maxAttempts) {
      const revised = villageTool("revise_village_plan").run(draft, {
        planId,
        evaluation: lastEval,
      });
      planId = String((revised.data as { planId: string }).planId);
      plan = loadVillagePlan(draft, planId);
      log.push({ step: "revise", attempt, planId, summary: revised.summary, feedback: lastEval.feedbackForLlm });
    }
  }

  return {
    summary: `마을 파이프라인 종료(룩 미통과 ${maxAttempts}회): score ${lastEval?.score ?? 0}`,
    data: {
      ok: false,
      planId,
      mapId: lastBuildData?.mapId,
      attempt: maxAttempts,
      maxAttempts,
      evaluation: lastEval,
      build: lastBuildData,
      log,
    },
    warnings: lastEval?.issues ? [...lastEval.issues] : ["룩 게이트 미통과"],
  };
}

function ensureVillageStartPosition(draft: Project, map: GameMap, plaza: Plaza): void {
  draft.startMapId = map.id;
  const candidates: Point[] = [
    { x: plaza.centerX, y: plaza.centerRow },
    { x: plaza.rect.x + 1, y: plaza.rect.y + 1 },
    { x: plaza.rect.x + Math.floor(plaza.rect.w / 2), y: plaza.rect.y + plaza.rect.h - 1 },
  ];
  for (const point of candidates) {
    if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) continue;
    const lower = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    // 길 또는 테마 바닥(눈/잔디)이면서 실제 통행 가능한 지점을 채택한다.
    if (isVillageStartGround(lower) && isPassable(draft, map, point.x, point.y)) {
      draft.startPos = { x: point.x, y: point.y };
      return;
    }
  }
  const fallback = nearestPassableStart(draft, map, { x: plaza.centerX, y: plaza.centerRow });
  draft.startPos = fallback ?? { x: plaza.centerX, y: plaza.centerRow };
}

function isVillageStartGround(tileId: number): boolean {
  return ROAD_TILES.has(tileId) || tileId === TILE.GRASS || DEFAULT_SNOW_AUTOTILE_GROUP.memberTileIds.includes(tileId);
}

function applyVillageGroundTheme(map: GameMap, area: Rect, value: unknown): void {
  if (value === undefined || value === "grass") return;
  if (value !== "snow") throw new ToolError("groundTheme은 grass|snow여야 합니다.", { code: "invalid-args", mapId: map.id });
  const points: Point[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const index = y * map.width + x;
      if (map.upperTiles[index] !== TILE.EMPTY || ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) continue;
      if ((map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.GRASS) continue;
      map.lowerTiles[index] = DEFAULT_SNOW_AUTOTILE_GROUP.memberTileIds[0] ?? 67;
      points.push({ x, y });
    }
  }
  shapeAutotileGroupAround(map, DEFAULT_SNOW_AUTOTILE_GROUP, points);
}

function nearestPassableStart(project: Project, map: GameMap, origin: Point): Point | undefined {
  for (let radius = 0; radius <= 12; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      const dx = radius - Math.abs(dy);
      for (const x of dx === 0 ? [origin.x] : [origin.x - dx, origin.x + dx]) {
        const y = origin.y + dy;
        if (!inMapBounds(map, x, y)) continue;
        const lower = map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
        if (isVillageStartGround(lower) && isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  return undefined;
}

function setVillageHarnessLayoutPlan(
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  houses: readonly BuiltHouse[],
  intent: VillageIntent,
  seed: number,
  fencesEnabled: boolean,
  settlementLayout: unknown,
): void {
  const kitLabel: Record<HouseKitId, string> = {
    "blue-stone": "파랑 석벽",
    "bright-plaster": "오렌지 회벽",
    "amber-wood": "오렌지 통나무",
    "slate-wood": "파랑 통나무",
    "timber-hall": "빨간 널지붕 목조홀",
    "aframe-stone": "빨간 A자 석벽",
  };
  const explicitKits = intent.houseKits.slice(0, houses.length);
  const explicitTemplates = intent.houseTemplates.slice(0, houses.length);
  const kitTarget = explicitKits.length === houses.length && explicitKits.every(Boolean)
    ? new Set(explicitKits).size
    : Math.min(3, houses.length);
  const shapeTarget = explicitTemplates.length === houses.length && explicitTemplates.every(Boolean)
    ? new Set(explicitTemplates).size
    : Math.min(4, houses.length);
  const multiStoryTarget = explicitTemplates.length === houses.length && explicitTemplates.every(Boolean)
    ? Number(houses.some((house) => house.stories > 1))
    : Number(map.width >= 46 && houses.length >= 6);
  setMapLayoutPlan(map, {
    version: 1,
    kind: "village-harness-natural-v2",
    seed,
    regions: [
      {
        id: "village_commons",
        role: "plaza",
        label: intent.plazaStyle === "market" ? "생활 장터와 중앙 녹지" : "중앙 녹지 광장",
        ...plaza.rect,
        tags: [
          "commons",
          "road-loop",
          ...(settlementLayout === "street-grid" ? ["street-grid"] : []),
          // 어떤 사용자 프리셋으로 지었는지 — 같은 마을을 다시 뽑을 때의 단서.
          ...(intent.presetId ? [`preset:${intent.presetId}`] : []),
          intent.plazaStyle,
          `kit-target:${kitTarget}`,
          `shape-target:${shapeTarget}`,
          `multistory-target:${multiStoryTarget}`,
        ],
      },
      ...houses.map((house, index) => ({
        id: `village_house_${index + 1}`,
        role: "house",
        label: `${kitLabel[house.kitId]} ${house.stories > 1 ? `${house.stories}층 ` : ""}${house.templateId} 집`,
        ...house.bbox,
        kitId: house.kitId,
        shape: house.templateId,
        yardTheme: intent.yardStyle,
        tags: [`${house.stories}f`, `shape:${house.templateId}`, "authored-reference-grammar"],
        doorAt: house.doorAt,
        front: house.front,
        hasFence: fencesEnabled,
      })),
    ],
    roadAnchors: villageRoadAnchors(area, plaza, seed).map((point, index) => ({
      id: (["north-exit", "south-exit", "west-exit", "east-exit"] as const)[index]!,
      ...point,
    })),
    notes: "직접 저작 자연 마을의 비대칭 집·중앙 루프·네 방향 출구·층별 창 분리 문법을 적용한 하네스 설계도",
  });
}
