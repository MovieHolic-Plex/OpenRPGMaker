// editor/tools/village/houses.ts
// 집 배치·스탬프 — 후보 슬롯 생성, 키트 시공, 보호 마스크(footprint/스탠드오프), 문·용마루 복구.

import { ALL_HOUSE_KIT_IDS, HOUSE_KITS as HOUSE_KIT_DEFS, houseKitForTileset, mixableHouseKitIds, stampFootprintHouseKit, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import { stampAuthoredHouseForm } from "@/editor/authoredHouseFormStamp";
import { gableAccentSeed } from "@/editor/gableHouseCompose";
import { stampHouseDoorBackground } from "@/editor/houseInteriors";
import { TILE } from "@/project/defaults/constants";
import type { GameMap } from "@/project/types";
import type { Rng } from "@/util/rng";
import { houseFootprintCells, protectedHouseCells, HOUSE_WALL_LADDER, roofDeckLadderAttachment } from "../houseProtection";
import type { TerrainConstraintMasks } from "../villageTerrainPass";
import type { VillageSketchSite } from "./sketch";
import {
  clamp,
  coordKey,
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  expandRect,
  HOUSE_MARGIN,
  pointInMap,
  rectsOverlap,
  ROAD_TILES,
  shuffled,
  type BuiltHouse,
  type HouseCandidate,
  type HouseTemplate,
  type Plaza,
  type Rect,
  type SettlementLayout,
  type VillageIntent,
  templateFormFor,
  templateHasFixedKit,
} from "./constants";

export function houseBlockedCells(houses: readonly BuiltHouse[], map?: GameMap): Set<string> {
  const blocked = new Set((map ? protectedHouseCells(map) : []).map(({ x, y }) => coordKey(x, y)));
  for (const house of houses) {
    for (const cell of houseFootprintCells(house.bbox)) blocked.add(`${cell.x},${cell.y}`);
  }
  return blocked;
}

/**
 * 간선·루프용 스탠드오프 — 집 보호구역 둘레 1칸(측면·후면)까지 막는다.
 * 간선이 벽에 밀착해 지나가거나 집을 골목처럼 3면으로 감싸는 것을 줄인다.
 * 문 앞 행(남쪽 벽 아래)은 열어 둔다 — 집 앞을 지나는 거리는 마을다움이고, 스퍼가 붙는 곳이다.
 */
export function houseStandoffCells(houses: readonly BuiltHouse[]): Set<string> {
  const blocked = new Set<string>();
  for (const house of houses) {
    const x0 = Math.max(0, house.bbox.x - 1);
    const x1 = house.bbox.x + house.bbox.w;
    const y0 = Math.max(0, house.bbox.y - 2);
    const y1 = house.bbox.y + house.bbox.h - 1;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        blocked.add(coordKey(x, y));
      }
    }
  }
  return blocked;
}

/** 키트 지붕 upper 타일 전체(용마루·트림·코너) — 용마루 행 정리 시 보존 대상. */
export function houseKitRoofUpperTiles(): Set<number> {
  const keep = new Set<number>();
  for (const kitId of ALL_HOUSE_KIT_IDS) {
    const upper = HOUSE_KIT_DEFS[kitId].roof.upper as Record<string, number>;
    for (const value of Object.values(upper)) {
      if (typeof value === "number") keep.add(value);
    }
  }
  return keep;
}

const TREE_TOP_TILES = new Set<number>([260, 261, 262, 263]);
const TREE_BOTTOM_TILES = new Set<number>([290, 291, 292, 293]);

/**
 * 시공 후처리 — 용마루 행(bbox.y-1)을 원상 복구한다.
 * place_props(침엽수 등)는 houseBlocked를 모르는 범용 툴이라 잔디인 이 행에
 * lower 밑동(290-293)·upper 수관을 심고 용마루 upper를 지울 수 있다.
 * 1) 키트 외 upper 제거(나무는 상·하 쌍으로), 2) lower 밑동을 잔디로 복원,
 * 3) bright 키트는 지워진 용마루/캡 upper를 재스탬프.
 */
export function clearHouseRidgeRowProps(map: GameMap, houses: readonly BuiltHouse[]): number {
  const keep = houseKitRoofUpperTiles();
  let cleared = 0;
  const clearUpperAt = (x: number, y: number): void => {
    if (!pointInMap(map, { x, y })) return;
    const index = y * map.width + x;
    const upper = map.upperTiles[index] ?? TILE.EMPTY;
    if (upper === TILE.EMPTY || keep.has(upper)) return;
    map.upperTiles[index] = TILE.EMPTY;
    cleared += 1;
    // 1×2 나무 쌍 정리 — 밑동을 지웠으면 위 수관도, 수관을 지웠으면 아래 밑동도.
    if (TREE_BOTTOM_TILES.has(upper) && y > 0 && TREE_TOP_TILES.has(map.upperTiles[index - map.width] ?? TILE.EMPTY)) {
      map.upperTiles[index - map.width] = TILE.EMPTY;
      cleared += 1;
    }
    if (TREE_TOP_TILES.has(upper) && y + 1 < map.height && TREE_BOTTOM_TILES.has(map.upperTiles[index + map.width] ?? TILE.EMPTY)) {
      map.upperTiles[index + map.width] = TILE.EMPTY;
      cleared += 1;
    }
  };
  for (const house of houses) {
    const y = house.bbox.y - 1;
    if (y < 0) continue;
    const lastX = house.bbox.x + house.bbox.w - 1;
    const kit = HOUSE_KIT_DEFS[house.kitId];
    for (let x = house.bbox.x; x <= lastX; x += 1) {
      clearUpperAt(x, y);
      const index = y * map.width + x;
      // lower 밑동(침엽수 등)이 용마루 행을 차지했으면 잔디로 복원 + 위 칸 수관 정리.
      if (TREE_BOTTOM_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) {
        map.lowerTiles[index] = TILE.GRASS;
        cleared += 1;
        if (y > 0 && TREE_TOP_TILES.has(map.upperTiles[index - map.width] ?? TILE.EMPTY)) {
          map.upperTiles[index - map.width] = TILE.EMPTY;
          cleared += 1;
        }
      }
      // bright 키트 용마루 재스탬프 — 나무/소품이 지운 캡·용마루를 되살린다.
      // 2026-07-17 교정: 용마루(374)는 불투명 하위, 양끝 투명 캡만 상위.
      // 셀 레시피 집은 용마루가 레시피 안(bbox 첫 행)에 있으므로 bbox 위 행에 킷 용마루를 그리지 않는다.
      if (kit.roof.kind === "bright" && !house.formId) {
        if (x === house.bbox.x || x === lastX) {
          if ((map.upperTiles[index] ?? TILE.EMPTY) === TILE.EMPTY) {
            map.upperTiles[index] = x === house.bbox.x ? kit.roof.upper.ridgeCapL : kit.roof.upper.ridgeCapR;
          }
        } else if ((map.lowerTiles[index] ?? TILE.EMPTY) !== kit.roof.upper.ridge) {
          map.lowerTiles[index] = kit.roof.upper.ridge;
        }
      }
    }
    // 지붕 최상행(bbox.y)의 나무 밑동을 걷어낸다. toolRunner 짝 보정이 밑동을 보면
    // 수관을 용마루 행(y-1)에 재부착한다. 예전엔 파랑 키트 어깨만 막았는데,
    // 스케치 배치가 다른 킷·중간 열에도 밑동을 남긴다.
    const roofY = house.bbox.y;
    for (let x = house.bbox.x; x <= lastX; x += 1) {
      if (!pointInMap(map, { x, y: roofY })) continue;
      const index = roofY * map.width + x;
      if (TREE_BOTTOM_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) {
        map.lowerTiles[index] = TILE.GRASS;
        cleared += 1;
      }
      if (TREE_BOTTOM_TILES.has(map.upperTiles[index] ?? TILE.EMPTY)) {
        map.upperTiles[index] = TILE.EMPTY;
        cleared += 1;
      }
      if (roofY > 0 && TREE_TOP_TILES.has(map.upperTiles[index - map.width] ?? TILE.EMPTY)) {
        map.upperTiles[index - map.width] = TILE.EMPTY;
        cleared += 1;
      }
    }
  }
  return cleared;
}

/**
 * 마스크의 water 셀 → 집 배치 금지 인덱스 집합.
 * (forest는 제외하지 않는다 — place_props는 집 벽을 침범하지 않아 파괴가 없고,
 *  숲 밴드까지 막으면 기존 시드들의 배치·도로 형태가 크게 바뀐다. 침수 결함의 본질은 물.)
 */
export function terrainBlockedCells(masks: TerrainConstraintMasks | undefined): Set<number> | undefined {
  if (!masks) return undefined;
  const blocked = new Set<number>();
  for (let i = 0; i < masks.roles.length; i += 1) {
    if (masks.roles[i] === "water") blocked.add(i);
  }
  return blocked.size > 0 ? blocked : undefined;
}

function bboxTouchesBlocked(bbox: Rect, blocked: ReadonlySet<number>, width: number): boolean {
  // y-1(용마루 행)부터 +1행(문 앞 칸)까지 물을 피한다.
  for (let y = Math.max(0, bbox.y - 1); y < bbox.y + bbox.h + 1; y += 1) {
    for (let x = bbox.x; x < bbox.x + bbox.w; x += 1) {
      if (blocked.has(y * width + x)) return true;
    }
  }
  return false;
}

export interface HouseBoulevardHint {
  readonly ewRow: number;
  readonly nsCol: number;
  /** 대로 축(2026-09-17). 비우면 예전처럼 2축으로 본다. */
  readonly axis?: "both" | "ew" | "ns";
}

/** 박공 조합 형태 후보를 먼저 뽑는 확률 — morphologyPlan 의 GABLE_SHARE 와 같은 기본 분배. */
const GABLE_CANDIDATE_SHARE = 0.6;

/**
 * 섞인 후보 목록을 박공/그 밖으로 나눠 가중 병합한다(각 목록 안의 순서는 유지). 박공 형태가 템플릿 수에
 * 비례한 몫보다 자주 앞에 서게 해 기본 분배에서 골고루 나오게 한다(2026-09-25).
 */
function gableFirst(list: readonly HouseCandidate[], rng: Rng): HouseCandidate[] {
  const gables = list.filter((candidate) => candidate.template.compose !== undefined);
  const others = list.filter((candidate) => candidate.template.compose === undefined);
  if (gables.length === 0 || others.length === 0) return [...list];
  const out: HouseCandidate[] = [];
  let g = 0;
  let o = 0;
  while (g < gables.length || o < others.length) {
    const takeGable = o >= others.length || (g < gables.length && rng() < GABLE_CANDIDATE_SHARE);
    out.push(takeGable ? gables[g++]! : others[o++]!);
  }
  return out;
}

export function buildHouses(
  map: GameMap,
  area: Rect,
  plaza: Plaza,
  target: number,
  rng: Rng,
  windows: HouseKitWindowsOption | undefined,
  intent: VillageIntent,
  warnings: string[],
  terrainBlocked?: ReadonlySet<number>,
  boulevard?: HouseBoulevardHint,
  /**
   * 문 타일(116/146)을 깔지 여부. 기본값 false —
   * 문 외형은 Object1 문 이벤트 스프라이트가 담당하므로 타일까지 깔면 문이 두 겹이 된다.
   * 문 이벤트를 만들지 않는 시공(interior:false / doorEvent:false)에서만 true 로 넘긴다.
   */
  paintDoorTiles = false,
  sketchSites?: readonly VillageSketchSite[],
  /** 이 맵 타일셋에 집 부품 칸(3060~)이 있으면 박공 형태에 굴뚝·지붕창·차양·꼭대기 장식을 0~2개 붙인다. */
  houseParts = false,
): BuiltHouse[] {
  const existing = new Set(protectedHouseCells(map).map(({ x, y }) => y * map.width + x));
  const available = houseCandidates(area, plaza, target, intent.templateCatalog, intent.settlementLayout, boulevard, sketchSites);
  const candidates = [
    ...gableFirst(shuffled(available.filter((candidate) => candidate.sketch === true), rng), rng),
    ...gableFirst(shuffled(available.filter((candidate) => candidate.organic && candidate.sketch !== true), rng), rng),
    ...gableFirst(shuffled(available.filter((candidate) => !candidate.organic), rng), rng),
  ];
  const houses: BuiltHouse[] = [];
  // 부품 씨앗 소금 — 같은 자리라도 마을 씨앗이 다르면 다른 부품이 붙게 rng 에서 한 번 뽑는다.
  const rngSeedSalt = houseParts ? Math.floor(rng() * 0x7fffffff) : 0;
  // 킷 믹스 후보 — 부품 칸이 있는 타일셋이면 재료 킷(초가·슬레이트·벽돌·반목조 …)까지.
  const kitPool = mixableHouseKitIds(houseParts);
  const usedTemplateIds = new Set<string>();
  const usedKitIds = new Set<HouseKitId>();
  const candidateTemplateIds = new Set(candidates.map((candidate) => candidate.template.id));
  // 형태 다양성 강제 — 카탈로그 34종(2026-07-17) 기준, 대형 마을(20+집)이 같은 꼴 반복이 되지 않게.
  const requiredTemplateKinds = Math.min(8, target, candidateTemplateIds.size);
  const hasMultiStoryCandidate = candidates.some((candidate) => (candidate.template.stories ?? 1) > 1);
  // relaxForcedTemplates: 강제 templateId 가 어느 슬롯에도 안 맞을 때(카탈로그에 없는 id 포함) 형태 제약만 풀고
  // 다시 시도하는 3차 패스용. 킷 강제·다양성 규칙은 그대로다. (2026-09-18 거부 대신 대체)
  const tryCandidates = (list: readonly HouseCandidate[], relaxForcedTemplates = false): void => {
    for (const candidate of list) {
      if (houses.length >= target) break;
      if (!canPlaceHouse(area, plaza.rect, houses, candidate.bbox)) continue;
      if (bboxTouchesBlocked(candidate.bbox, existing, map.width)) continue;
      // 물 마스크 셀과 겹치는 후보는 버린다 — 나중에 지형 패스가 집을 침수시키지 않도록.
      if (terrainBlocked && bboxTouchesBlocked(candidate.bbox, terrainBlocked, map.width)) continue;
      const forced = intent.houseKits[houses.length];
      const forcedTemplateId = relaxForcedTemplates ? undefined : intent.houseTemplates[houses.length];
      if (forced && candidate.template.kitId && candidate.template.kitId !== forced) continue;
      // 셀 레시피는 재료가 셀에 박혀 있다 — 재료를 하나로 고정한 마을(테마 원형·설계서)에는 그 재료의 레시피만 섞는다.
      const fixedForm = templateHasFixedKit(candidate.template) ? candidate.template.form : undefined;
      if (fixedForm && !forced && !forcedTemplateId && intent.kitMix !== "mixed" && fixedForm.kitId !== intent.kitMix) continue;
      if (!forcedTemplateId && target >= 4 && houses.length === 0 && hasMultiStoryCandidate && (candidate.template.stories ?? 1) === 1) continue;
      if (!forcedTemplateId && usedTemplateIds.size < requiredTemplateKinds && usedTemplateIds.has(candidate.template.id)) continue;
      const unusedKits = kitPool.filter((id) => !usedKitIds.has(id));
      const mixedKitPool = usedKitIds.size < Math.min(3, target) && unusedKits.length > 0 ? unusedKits : kitPool;
      // 템플릿 강제 킷(옥상 데크 등)이 최우선 — 지오메트리가 킷에 종속이라 다른 킷이면 시공이 깨진다.
      // 재료 킷은 부품 칸이 있는 타일셋에서만 — 없으면 같은 계열 기본 킷.
      const kitId = houseKitForTileset(candidate.template.kitId
        ?? forced
        ?? (intent.kitMix === "mixed"
          ? (mixedKitPool[Math.floor(rng() * mixedKitPool.length)] as HouseKitId)
          : intent.kitMix), houseParts);
      // housePlans[].templateId 가 있으면 그 템플릿만 허용(촌장 ㄱ자 등).
      if (forcedTemplateId && candidate.template.id !== forcedTemplateId) continue;
      // 자동 추첨 제외 형태는 명시했을 때만.
      if (!forcedTemplateId && candidate.template.excludeFromDefaultMix) continue;
      const stories: 1 | 2 | 3 = candidate.template.stories === 3 ? 3 : candidate.template.stories === 2 ? 2 : 1;
      // 박공 조합 형태는 고른 킷으로 합성한다 — 고정 레시피는 그대로.
      const form = templateFormFor(candidate.template, kitId,
        houseParts ? gableAccentSeed(candidate.template.id, candidate.bbox.x, candidate.bbox.y, rngSeedSalt) : undefined);
      const result = form
        ? stampAuthoredHouseForm(map, form, { x: candidate.bbox.x, y: candidate.bbox.y })
        : stampFootprintHouseKit(map, {
          kitId,
          stories,
          ...(candidate.template.lowWall ? { lowWall: true } : {}),
          wings: candidate.template.wingsAt(candidate.bbox.x, candidate.bbox.y),
          windows,
        });
      if (!result.ok || !result.doorAt) {
        warnings.push(`집 시공 실패(${candidate.template.name}): ${result.reason ?? "문 좌표 없음"}`);
        continue;
      }
      // Only a successfully stamped new house replaces leftover streets under ridge caps/wing gaps.
      // Existing ownership is excluded above; finish before sealing, never repair a completed house.
      for (const { x, y } of houseFootprintCells(candidate.bbox, map)) {
        const index = y * map.width + x;
        if (ROAD_TILES.has(map.lowerTiles[index] ?? TILE.EMPTY)) map.lowerTiles[index] = TILE.GRASS;
      }
      const doorAt = result.doorAt;
      const topIndex = (doorAt.y - 1) * map.width + doorAt.x;
      const bottomIndex = doorAt.y * map.width + doorAt.x;
      if (paintDoorTiles) {
        map.lowerTiles[topIndex] = DOOR_TOP_TILE;
        map.lowerTiles[bottomIndex] = DOOR_BOTTOM_TILE;
      } else {
        stampHouseDoorBackground(map, doorAt);
      }
      // 후처리 복원값 — 이벤트 문이면 359 두 칸, 타일 문이면 116/146.
      const doorTiles = {
        top: map.lowerTiles[topIndex] ?? DOOR_TOP_TILE,
        bottom: map.lowerTiles[bottomIndex] ?? DOOR_BOTTOM_TILE,
      };
      if (candidate.template.roofDeck) applyRoofDeck(map, candidate.bbox, doorAt);
      const houseIndex = houses.length;
      houses.push({
        bbox: candidate.bbox,
        doorAt,
        doorTiles,
        front: { x: doorAt.x, y: doorAt.y + 1 },
        kitId,
        stories,
        templateId: candidate.template.id,
        ...(form ? { formId: form.id } : {}),
        ...(intent.houseOwners[houseIndex] ? { ownerName: intent.houseOwners[houseIndex] } : {}),
        ...(intent.housePrograms[houseIndex] ? { program: intent.housePrograms[houseIndex] } : {}),
      });
      usedTemplateIds.add(candidate.template.id);
      usedKitIds.add(kitId);
    }
  };
  tryCandidates(candidates);
  // 변형 레이아웃에서 집이 모자라면 고전 위·아래 밴드로 보충
  if (houses.length < target && intent.settlementLayout !== "plaza-ring") {
    tryCandidates(shuffled(houseCandidates(area, plaza, target, intent.templateCatalog, "plaza-ring", boulevard), rng));
  }
  // 3차: 강제 templateId 때문에 자리가 안 잡힌 슬롯은 형태 제약을 풀고 다른 형태로 채운다. 아래 검사가 슬롯별로 경고한다.
  if (houses.length < target && intent.houseTemplates.some(Boolean)) {
    tryCandidates(candidates, true);
    if (houses.length < target && intent.settlementLayout !== "plaza-ring") {
      tryCandidates(shuffled(houseCandidates(area, plaza, target, intent.templateCatalog, "plaza-ring", boulevard), rng), true);
    }
  }
  if (houses.length < target) {
    warnings.push(`집 후보 진단: 후보 ${candidates.length}개 중 ${houses.length}/${target} 시공 (area ${area.w}×${area.h})`);
  }
  // 2026-09-18 강제 templateId 를 못 맞추면 실패 대신 경고. 실측: 모델이 templateId 를 넣으면 슬롯이 안 맞아
  // 마을 전체가 두 번 반려됐고, 세 번째에야 templateId 를 비워 성공했다. 집은 지어졌으니 "이 집만 다른 형태" 로 알린다.
  for (let i = 0; i < target; i += 1) {
    const forced = intent.houseTemplates[i];
    if (!forced) continue;
    const built = houses[i];
    if (!built || built.templateId !== forced) {
      warnings.push(`housePlans[${i}].templateId='${forced}' 는 이 자리에 맞지 않아 ${built ? `'${built.templateId}' 로 대체` : "생략"}했습니다.`);
    }
  }
  return houses;
}

/** 다리 판자와 동일 — 상위 O가 하위 X를 덮는 통행 오버라이드. houseVariety 가 옥상 데크 판정에 쓴다. */
export const ROOF_DECK_PLANK = 199;
/** 데크 뒷줄 왼쪽 모서리·앞줄 난간(기둥/살) — manor-balcony 발코니와 같은 타일. */
const ROOF_DECK_CORNER = 198;
const ROOF_DECK_RAIL_POST = 167;
const ROOF_DECK_RAIL = 163;

/**
 * 옥상 데크(파랑 평지붕 전용) — 지붕 몸통 안쪽에 판자(199)를 얹어 보행면으로 만들고,
 * 벽면 사다리(322) 기둥으로 마당과 잇는다. 다리의 "상위 통행 오버라이드" 메커니즘 재사용.
 * 데크 테두리(지붕 최상행·몸통 좌우 끝 열·처마)는 하위 지붕 그대로라 지붕 밖으로 샐 수 없고,
 * 유일한 출입은 사다리 열이다.
 */
export function applyRoofDeck(map: GameMap, bbox: Rect, doorAt: { readonly x: number; readonly y: number }): void {
  const left = bbox.x;
  const right = bbox.x + bbox.w - 1;
  const eaveY = bbox.y + bbox.h - 3 - 1; // 벽 밴드 3행(1층) 바로 위가 처마
  const { x: ladderX } = roofDeckLadderAttachment(bbox, doorAt);
  // 데크 = 지붕 좌우 한 칸씩 남긴 가운데(좌우 대칭). 예전에는 오른쪽만 두 칸 남기고 가장자리 없이 판자만 깔아
  // 지붕 위에 판자가 떠 있는 것처럼 보였다(2026-09-25). 이제 발코니 문법(manor-balcony, 사용자 원작)을 따른다:
  // 뒷줄 첫 칸 198(데크 모서리) · 판자 199 · 앞줄은 난간 167/163(통행 막힘) — 사다리 열만 판자로 비워 오르내린다.
  for (let y = bbox.y + 1; y < eaveY; y += 1) {
    const front = y === eaveY - 1 && eaveY - 1 > bbox.y + 1;
    for (let x = left + 1; x <= right - 1; x += 1) {
      const index = y * map.width + x;
      if (map.upperTiles[index] !== TILE.EMPTY) continue;
      let tile = ROOF_DECK_PLANK;
      if (front && x !== ladderX) tile = x === left + 1 || x === right - 1 || (x - left) % 2 === 1 ? ROOF_DECK_RAIL_POST : ROOF_DECK_RAIL;
      else if (y === bbox.y + 1 && x === left + 1) tile = ROOF_DECK_CORNER;
      map.upperTiles[index] = tile;
    }
  }
  // 사다리 기둥: 문에서 먼 쪽 벽 열, 처마→벽→지면 1칸까지 강제 설치(창문은 사다리로 대체).
  for (let y = eaveY; y <= bbox.y + bbox.h; y += 1) {
    if (!pointInMap(map, { x: ladderX, y })) break;
    map.upperTiles[y * map.width + ladderX] = HOUSE_WALL_LADDER;
  }
}

function houseCandidates(
  area: Rect,
  plaza: Plaza,
  target: number,
  catalog: readonly HouseTemplate[],
  settlement: SettlementLayout = "plaza-ring",
  boulevard?: HouseBoulevardHint,
  sketchSites?: readonly VillageSketchSite[],
): HouseCandidate[] {
  const minTemplateWidth = Math.min(...catalog.map((template) => template.w));
  const wantedColumns = Math.ceil(target / 2);
  // 슬롯 폭은 카탈로그 최대 폭 8을 기본으로 — 폭 8 슬롯이 한 열도 안 서는 좁은 맵만
  // 최소 폭으로 강등한다. (예전 로직은 "모든 열이 8폭으로 서는가"를 물어서 대형 맵이
  // 오히려 최소 폭 슬롯이 되고, 소형 오두막만 배치되는 함정이 있었다 — 2026-07-17.)
  const maxWideColumns = Math.floor(area.w / (8 + HOUSE_MARGIN * 2));
  const slotWidth = maxWideColumns >= 1 ? 8 : minTemplateWidth;
  const maxColumns = Math.max(1, Math.floor(area.w / (slotWidth + HOUSE_MARGIN * 2)));
  const columns = Math.max(1, Math.min(wantedColumns, maxColumns));
  const templates = catalog.filter((template) => template.w <= slotWidth);
  const span = columns * slotWidth + (columns - 1) * HOUSE_MARGIN * 2;
  const xStart = area.x + Math.max(HOUSE_MARGIN, Math.floor((area.w - span) / 2));
  const candidates: HouseCandidate[] = [];

  // 스케치 프리패스(유기적 후보 우선) — 격자보다 먼저 깔아 organic-first 셔플이 뽑게 한다.
  // 기존 분수 슬롯·밴드·격자는 그대로 둔다(스케치가 못 채우면 폴백이 메운다).
  if (sketchSites !== undefined) {
    for (const site of sketchSites) {
      for (const template of templates) {
        const rawX = site.x - Math.floor(template.w / 2);
        const rawY = site.y;
        const x = clamp(rawX, area.x + HOUSE_MARGIN, area.x + area.w - HOUSE_MARGIN - template.w);
        const y = clamp(rawY, area.y + HOUSE_MARGIN, area.y + area.h - HOUSE_MARGIN - template.h);
        if (Math.abs(x - rawX) > 1 || Math.abs(y - rawY) > 1) continue;
        candidates.push({
          template,
          bbox: { x, y, w: template.w, h: template.h },
          organic: true,
          sketch: true,
        });
      }
    }
  }

  if (settlement !== "street-grid") {
    const naturalSlots = [
      { fx: 0.12, fy: 0.06 }, { fx: 0.32, fy: 0.01 }, { fx: 0.58, fy: 0.08 }, { fx: 0.86, fy: 0.02 },
      { fx: 0.10, fy: 0.42 }, { fx: 0.88, fy: 0.35 },
      { fx: 0.13, fy: 0.82 }, { fx: 0.35, fy: 0.92 }, { fx: 0.61, fy: 0.83 }, { fx: 0.87, fy: 0.91 },
      { fx: 0.24, fy: 0.52 }, { fx: 0.73, fy: 0.57 },
    ] as const;
    for (const slot of naturalSlots) {
      for (const template of templates) {
        const maxX = area.x + area.w - HOUSE_MARGIN - template.w;
        const maxY = area.y + area.h - HOUSE_MARGIN - template.h;
        const x = clamp(
          area.x + Math.floor(area.w * slot.fx) - Math.floor(template.w / 2),
          area.x + HOUSE_MARGIN,
          maxX,
        );
        const y = clamp(
          area.y + Math.floor((area.h - template.h) * slot.fy),
          area.y + HOUSE_MARGIN,
          maxY,
        );
        candidates.push({ template, bbox: { x, y, w: template.w, h: template.h }, organic: true });
      }
    }
  }

  // 공통: 광장 위·아래 밴드. 대형 맵(72+)은 동서 대로(광장 남측 y+h+1, 폭3)와 겹치지 않게
  // 아래 밴드를 대로 남쪽 접면(frontage)으로 내린다 — 대로변 상가/주거 열 (2026-07-17).
  // 대로가 남북 한 축뿐이면 동서 접면은 없다 — 아래 밴드를 대로 남쪽으로 내리지 않는다.
  const largeBoulevard = boulevard !== undefined && (boulevard.axis ?? "both") !== "ns";
  const ewBoulevardRow = boulevard?.ewRow ?? plaza.rect.y + plaza.rect.h + 1;
  for (let col = 0; col < columns; col += 1) {
    const slotX = xStart + col * (slotWidth + HOUSE_MARGIN * 2);
    for (const template of templates) {
      const staggerX = settlement === "clusters" ? (col % 3) - 1 : 0;
      const staggerTop = settlement === "clusters" ? ((col * 2) % 5) - 2 : 0;
      const staggerBottom = settlement === "clusters" ? ((col * 3 + 1) % 5) - 2 : 0;
      const x = slotX + Math.floor((slotWidth - template.w) / 2) + staggerX;
      const bottomY = largeBoulevard
        ? ewBoulevardRow + 3
        : plaza.rect.y + plaza.rect.h + HOUSE_MARGIN + staggerBottom;
      candidates.push({ template, bbox: { x, y: plaza.rect.y - HOUSE_MARGIN - template.h + staggerTop, w: template.w, h: template.h }, organic: false });
      candidates.push({ template, bbox: { x, y: bottomY, w: template.w, h: template.h }, organic: false });
    }
  }

  // 대형 맵 격자 lot(2026-07-17, 리서치 필지 분할 룰): 코어 전체를 stepY=11 행 격자로 덮는
  // 후보를 공급한다 — 광장·대로 충돌은 bboxTouchesBlocked/canPlaceHouse가 걸러낸다.
  if (largeBoulevard) {
    for (let y = area.y + HOUSE_MARGIN; y + 9 <= area.y + area.h - HOUSE_MARGIN; y += 11) {
      for (let col = 0; col < columns; col += 1) {
        const slotX = xStart + col * (slotWidth + HOUSE_MARGIN * 2);
        for (const template of templates) {
          const x = slotX + Math.floor((slotWidth - template.w) / 2);
          candidates.push({ template, organic: false, bbox: { x, y, w: template.w, h: template.h } });
        }
      }
    }
  }

  // street-grid / clusters: 광장 좌·우 밴드도 후보에 넣어 배치가 위·아래만 되지 않게.
  // 대형 코어(56+)는 어느 레이아웃이든 좌·우 밴드를 공급한다 — 상하 2밴드만으로는
  // 면적 비례 집 수(20+)의 후보가 고갈된다 (2026-07-17).
  if (settlement === "street-grid" || settlement === "clusters" || area.w >= 56) {
    const rowStep = 7;
    // 대형 코어는 좌·우 밴드를 다중 열(최대 3링)로 공급 — 면적 비례 집 수(20+)의 후보 확보.
    const columnRings = area.w >= 56 ? 3 : 1;
    for (let row = area.y + HOUSE_MARGIN; row + 6 < area.y + area.h - HOUSE_MARGIN; row += rowStep) {
      if (row + 6 > plaza.rect.y - 2 && row < plaza.rect.y + plaza.rect.h + 2) continue;
      for (const template of templates) {
        for (let ring = 0; ring < columnRings; ring += 1) {
          const offset = (template.w + HOUSE_MARGIN * 2) * ring;
          // 대형 맵: 남북 대로와 겹치지 않게 오른쪽 밴드를 대로 동쪽 접면으로.
          const rightBase = boulevard && (boulevard.axis ?? "both") !== "ew"
            ? boulevard.nsCol + 2 + 1
            : plaza.rect.x + plaza.rect.w + HOUSE_MARGIN;
          candidates.push({
            template,
            organic: false,
            bbox: {
              x: plaza.rect.x - HOUSE_MARGIN - template.w - offset,
              y: row,
              w: template.w,
              h: template.h,
            },
          });
          candidates.push({
            template,
            organic: false,
            bbox: {
              x: rightBase + offset,
              y: row,
              w: template.w,
              h: template.h,
            },
          });
        }
      }
    }
  }

  // clusters: 광장에서 떨어진 코너 클러스터 후보
  if (settlement === "clusters") {
    const corners = [
      { x: area.x + HOUSE_MARGIN + 1, y: area.y + HOUSE_MARGIN + 1 },
      { x: area.x + area.w - HOUSE_MARGIN - 9, y: area.y + HOUSE_MARGIN + 1 },
      { x: area.x + HOUSE_MARGIN + 1, y: area.y + area.h - HOUSE_MARGIN - 9 },
      { x: area.x + area.w - HOUSE_MARGIN - 9, y: area.y + area.h - HOUSE_MARGIN - 9 },
    ];
    for (const corner of corners) {
      for (const template of templates) {
        candidates.push({
          template,
          organic: false,
          bbox: { x: corner.x, y: corner.y, w: template.w, h: template.h },
        });
      }
    }
  }

  return candidates;
}

function canPlaceHouse(area: Rect, plaza: Rect, houses: readonly BuiltHouse[], bbox: Rect): boolean {
  if (bbox.x < area.x + HOUSE_MARGIN || bbox.y < area.y + HOUSE_MARGIN) return false;
  if (bbox.x + bbox.w > area.x + area.w - HOUSE_MARGIN) return false;
  if (bbox.y + bbox.h > area.y + area.h - HOUSE_MARGIN) return false;
  if (rectsOverlap(bbox, expandRect(plaza, HOUSE_MARGIN))) return false;
  return houses.every((house) => !rectsOverlap(expandRect(bbox, HOUSE_MARGIN), house.bbox));
}

export function restoreHouseDoors(map: GameMap, houses: readonly BuiltHouse[]): void {
  for (const house of houses) {
    const { x, y } = house.doorAt;
    if (y > 0 && y < map.height && x >= 0 && x < map.width) {
      const tiles = house.doorTiles ?? { top: DOOR_TOP_TILE, bottom: DOOR_BOTTOM_TILE };
      map.lowerTiles[y * map.width + x] = tiles.bottom;
      map.lowerTiles[(y - 1) * map.width + x] = tiles.top;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
      map.upperTiles[(y - 1) * map.width + x] = TILE.EMPTY;
    }
  }
}
