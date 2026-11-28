// 드래그 선택 영역 0ms 컨텍스트 분석 & 우선순위 액션 랭킹.
// 순수 함수(store·DOM·네트워크 의존 없음) — selectionActionChips 가 드래그 직후 호출한다.
//
// 판별 순서:
// 1) 맵 성격: guessMapRole(정본 map.mapRole 우선 → 전투·상점·레이아웃·이름 추정) + tileset.roomKit / tilesetId 보강
// 2) 영역 성격: 저장된 구역 태그(map.locations) > 시공 설계도(map.layoutPlan) > 실시간 타일·통행·테두리 스캔
// 3) 3대 액션 점수화: NPC 추가 · 맵 디렉팅 · 몹 조우 → 내림차순 정렬(#1·#2·#3), #4는 자유 조수 지시
import { guessMapRole, type MapRole } from "@/ai/mapPlacementContext";
import { MAP_ROLE_LABELS } from "@/project/mapRole";
import { locationsOverlap, mapLocations } from "@/project/mapNamedLocations";
import { cellPassability } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { TILE } from "@/project/defaults/constants";
import {
  categorizeTileForContext,
  categorizeTileset,
  type ContextTileCategory,
} from "@/editor/regionTask/regionContextSuggestions";
import { POLISH_INSTRUCTION } from "@/editor/regionTask/suggestedCommands";
import type { Layer } from "@/editor/editorState";
import type { GameMap, MapLayoutRegion, MapNamedLocation, Project, TilesetDef } from "@/project/types";
import type { SelectionRect } from "./selectionTerrainSummary";

export type SelectionQuickActionKind = "npc" | "direct" | "encounter";
export type SelectionZoneSource = "location" | "layout" | "tiles";

export interface SelectionZoneMetrics {
  readonly area: number;
  readonly passableRatio: number;
  readonly emptyUpperRatio: number;
  readonly waterRatio: number;
  readonly insideEvents: number;
  readonly outsideCounts: Readonly<Record<ContextTileCategory, number>>;
  readonly insideCounts: Readonly<Record<ContextTileCategory, number>>;
  readonly hasMapEncounter: boolean;
  readonly hasRegionEncounter: boolean;
}

export interface SelectionZoneContext {
  readonly label: string;
  readonly source: SelectionZoneSource;
  readonly locationId?: string;
  readonly locationTags?: readonly string[];
  readonly suggestedZoneName: string;
  readonly suggestedZoneTags: readonly string[];
  readonly mapRole: MapRole;
  readonly mapRoleLabel: string;
  readonly metrics: SelectionZoneMetrics;
}

export interface SelectionQuickPreset {
  readonly id: string;
  readonly label: string;
  readonly instruction: string;
}

export interface SelectionQuickAction {
  readonly kind: SelectionQuickActionKind;
  readonly rank: 1 | 2 | 3;
  readonly label: string;
  readonly title: string;
  readonly score: number;
  readonly reason: string;
  /** null 이면 에디터 즉시 UI(예: 걸을 때 적 만나기 모달)를 연다. */
  readonly instruction: string | null;
}

export interface SelectionIntentAnalysis {
  readonly zone: SelectionZoneContext;
  readonly actions: readonly SelectionQuickAction[];
  readonly npcPresets: readonly SelectionQuickPreset[];
  readonly directPresets: readonly SelectionQuickPreset[];
  /** 선택 영역 안 통행 가능한 빈 중앙 우선 칸 — 조건에 맞는 칸이 없으면 null. */
  readonly suggestedNpcCell: { readonly x: number; readonly y: number } | null;
  readonly promptPlaceholder: string;
}

const META_WATER_RE = /물|바다|호수|강|연못|수면|하천|폭포|water|sea|river|lake|pond|ocean|shore/iu;
const META_ROAD_RE = /길|포석|광장|도로|보도|바닥돌|오솔길|road|path|cobble|plaza|street|pave|sidewalk/iu;
const META_FOREST_RE = /나무|숲|전나무|소나무|활엽|수관|덤불|잔디|풀숲|tree|forest|wood|pine|bush|canopy|trunk/iu;
const META_BUILDING_RE = /지붕|벽|외벽|집|건물|창문|문|기둥|울타리|담장|roof|wall|house|building|window|door|fence/iu;

const ZONE_SAFE_WORDS = /광장|시장|상점|마을|여관|집|가게|교회|학교|역|주점|카운터|로비|입구|정원|plaza|market|shop|town|inn|house|lobby|counter/iu;
const ZONE_DANGER_WORDS = /숲|던전|동굴|사냥터|폐허|지하|묘지|습지|보스|위험|야외|길목|forest|dungeon|cave|hunting|ruin|boss|wild|swamp/iu;
const ZONE_WATER_WORDS = /항구|부두|선착장|호수|강|해안|바다|다리|물가|harbor|dock|pier|lake|river|beach|coast|bridge/iu;

const LAYOUT_ROLE_LABELS: Readonly<Record<string, { readonly label: string; readonly tag: string }>> = {
  plaza: { label: "광장", tag: "plaza" },
  market: { label: "상점가", tag: "market" },
  house: { label: "주택 구역", tag: "house" },
  forest: { label: "숲 구역", tag: "forest" },
  lake: { label: "호숫가", tag: "water" },
  river: { label: "강가", tag: "water" },
  harbor: { label: "항구", tag: "harbor" },
  road: { label: "길목", tag: "road" },
};

function clampScore(value: number): number {
  return Math.max(5, Math.min(100, Math.round(value)));
}

function overlapArea(
  a: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  b: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + Math.max(0, a.w), b.x + Math.max(0, b.w));
  const y2 = Math.min(a.y + Math.max(0, a.h), b.y + Math.max(0, b.h));
  return x2 > x1 && y2 > y1 ? (x2 - x1) * (y2 - y1) : 0;
}

function classifyTileWithMeta(tileId: number, tileset: TilesetDef | undefined): ContextTileCategory {
  if (tileId === TILE.EMPTY || tileId < 0) return "other";
  const meta = tileset?.tileMeta?.[tileId];
  if (meta) {
    const hay = `${meta.label ?? ""} ${meta.role ?? ""} ${(meta.tags ?? []).join(" ")}`;
    // "건물 외벽" 등이 "물" 부분 문자열로 수면에 오분류되지 않게 건물을 먼저 판정한다.
    if (META_BUILDING_RE.test(hay)) return "building";
    if (META_WATER_RE.test(hay)) return "water";
    if (META_FOREST_RE.test(hay)) return "forest";
    if (META_ROAD_RE.test(hay)) return "road";
  }
  return categorizeTileForContext(tileId, tileset);
}

function classifyCell(map: GameMap, tileset: TilesetDef | undefined, index: number): ContextTileCategory {
  if ((map.terrainDesign?.waterDepth?.[index] ?? 0) > 0) return "water";
  const upper4 = layerTileAt(map, 4, index);
  if (upper4 >= 0) {
    const cat = classifyTileWithMeta(upper4, tileset);
    if (cat !== "other") return cat;
  }
  const upper3 = layerTileAt(map, 3, index);
  if (upper3 >= 0) {
    const cat = classifyTileWithMeta(upper3, tileset);
    if (cat !== "other") return cat;
  }
  const lower2 = layerTileAt(map, 2, index);
  if (lower2 >= 0) {
    const cat = classifyTileWithMeta(lower2, tileset);
    if (cat !== "other") return cat;
  }
  return classifyTileWithMeta(layerTileAt(map, 1, index), tileset);
}

function resolveEffectiveMapRole(project: Project, map: GameMap, tileset: TilesetDef | undefined): MapRole {
  const guessed = guessMapRole(project, map);
  if (guessed.explicit || guessed.role !== "unknown") return guessed.role;
  const tsCat = categorizeTileset(map.tilesetId);
  if (tsCat === "interior") return "interior";
  if (tsCat === "dungeon") return "dungeon";
  const tsHay = `${map.tilesetId} ${tileset?.name ?? ""}`;
  if (/interior|indoor|실내/iu.test(tsHay)) return "interior";
  if (/dungeon|cave|던전|동굴/iu.test(tsHay)) return "dungeon";
  return "unknown";
}

function mapRoleLabelOf(role: MapRole): string {
  if (role === "unknown") return "맵";
  return MAP_ROLE_LABELS[role];
}

function bestMatchingLocation(map: GameMap, rect: SelectionRect): MapNamedLocation | undefined {
  const sel = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  const selArea = Math.max(1, sel.w * sel.h);
  let best: MapNamedLocation | undefined;
  let bestOverlap = 0;
  let bestArea = Infinity;
  for (const loc of mapLocations(map)) {
    if (!locationsOverlap(sel, loc)) continue;
    const ov = overlapArea(sel, loc);
    if (ov / selArea < 0.25) continue;
    const locArea = Math.max(1, loc.w * loc.h);
    if (ov > bestOverlap || (ov === bestOverlap && locArea < bestArea)) {
      best = loc;
      bestOverlap = ov;
      bestArea = locArea;
    }
  }
  return best;
}

function bestMatchingLayoutRegion(map: GameMap, rect: SelectionRect): MapLayoutRegion | undefined {
  const regions = map.layoutPlan?.regions ?? [];
  if (regions.length === 0) return undefined;
  const sel = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  const selArea = Math.max(1, sel.w * sel.h);
  let best: MapLayoutRegion | undefined;
  let bestOverlap = 0;
  for (const region of regions) {
    const ov = overlapArea(sel, region);
    if (ov / selArea < 0.25) continue;
    if (ov > bestOverlap) {
      best = region;
      bestOverlap = ov;
    }
  }
  return best;
}

function regionHasWalkEncounter(map: GameMap, rect: SelectionRect, matchedLocationId: string | undefined): boolean {
  const sel = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  for (const entry of map.encounterTable ?? []) {
    if (matchedLocationId && entry.conditions?.locationId === matchedLocationId) return true;
    if (entry.conditions?.region && locationsOverlap(sel, entry.conditions.region)) return true;
  }
  return (map.fieldSpawns ?? []).some((spawn) =>
    (matchedLocationId && spawn.locationId === matchedLocationId) || locationsOverlap(sel, spawn.area),
  );
}

function inferTileZoneLabel(
  mapRole: MapRole,
  metrics: SelectionZoneMetrics,
): { readonly label: string; readonly suggestedName: string; readonly tags: readonly string[] } {
  const { passableRatio, emptyUpperRatio, waterRatio, outsideCounts, insideCounts } = metrics;
  const waterTotal = insideCounts.water + outsideCounts.water;
  const roadTotal = insideCounts.road + outsideCounts.road;
  const forestTotal = insideCounts.forest + outsideCounts.forest;
  const buildingTotal = insideCounts.building + outsideCounts.building;

  if (waterRatio >= 0.65) {
    return { label: "수면·물가", suggestedName: "물가 구역", tags: ["water"] };
  }
  if (passableRatio <= 0.2) {
    return { label: "절벽·막힌 지형", suggestedName: "지형 경계", tags: ["terrain"] };
  }
  if (mapRole === "interior") {
    return emptyUpperRatio >= 0.7
      ? { label: "실내 빈 공간", suggestedName: "실내 구역", tags: ["interior"] }
      : { label: "실내 구역", suggestedName: "실내 구역", tags: ["interior"] };
  }
  if (waterTotal >= 3 && waterRatio < 0.65) {
    return { label: "물가·해안", suggestedName: "물가 부두", tags: ["water", "harbor"] };
  }
  if (buildingTotal >= 2 && (roadTotal >= 2 || emptyUpperRatio >= 0.6)) {
    return { label: "광장·건물 앞", suggestedName: "광장 앞마당", tags: ["plaza", "town"] };
  }
  if (forestTotal >= 3) {
    return roadTotal >= 2
      ? { label: "숲속 길목", suggestedName: "숲길", tags: ["forest", "road"] }
      : { label: "숲 빈터", suggestedName: "숲 구역", tags: ["forest"] };
  }
  if (roadTotal >= 3) {
    return { label: "길목", suggestedName: "길목", tags: ["road"] };
  }
  if (mapRole === "dungeon") {
    return { label: "던전 구역", suggestedName: "던전 구역", tags: ["dungeon"] };
  }
  if (emptyUpperRatio >= 0.75) {
    return mapRole === "town"
      ? { label: "마을 공터", suggestedName: "마을 공터", tags: ["town", "plaza"] }
      : { label: "빈 들판", suggestedName: "빈 들판", tags: ["field"] };
  }
  return { label: `${mapRoleLabelOf(mapRole)} 구역`, suggestedName: `${mapRoleLabelOf(mapRole)} 구역`, tags: [mapRole] };
}

function buildNpcInstruction(zone: SelectionZoneContext): string {
  const scope = zone.source === "location" ? `「${zone.label}」 구역` : `이 선택 영역(${zone.label})`;
  return `${scope} 안의 통행 가능한 빈 칸에 분위기에 어울리는 NPC 1~2명과 짧은 대화를 배치해 줘. 기존 높이·경사로·물·건물은 바꾸지 마.`;
}

function buildDirectInstruction(zone: SelectionZoneContext): string {
  const { metrics, mapRole, label } = zone;
  const waterTotal = metrics.insideCounts.water + metrics.outsideCounts.water;
  const forestTotal = metrics.insideCounts.forest + metrics.outsideCounts.forest;
  const buildingTotal = metrics.insideCounts.building + metrics.outsideCounts.building;
  const roadTotal = metrics.insideCounts.road + metrics.outsideCounts.road;

  if (waterTotal >= 3 || ZONE_WATER_WORDS.test(label)) {
    return `이 선택 영역(${label})의 물가 분위기에 맞게 부두·난간·등불·소품을 자연스럽게 다듬어 줘. 기존 수심·높이·경사로는 유지해.`;
  }
  if (mapRole === "interior") {
    return `이 실내 영역(${label})에 어울리는 가구·소품·동선을 자연스럽게 배치해 줘. 기존 벽과 출입구는 막지 마.`;
  }
  if (buildingTotal >= 2 || ZONE_SAFE_WORDS.test(label)) {
    return `이 선택 영역(${label}) 주변 건물과 어울리게 가로등·화분·벤치·바닥 소품으로 디테일을 다듬어 줘. 높이·경사로·물은 유지해.`;
  }
  if (forestTotal >= 3) {
    return `이 선택 영역(${label})을 숲 분위기에 맞게 나무 가장자리·바위·풀·오솔길로 자연스럽게 다듬어 줘. 통로와 높이·물은 유지해.`;
  }
  if (roadTotal >= 3) {
    return `이 길목(${label}) 양옆에 이정표·가로수·돌 장식을 자연스럽게 배치해 줘. 지나다니는 길과 높이·물은 유지해.`;
  }
  return `${POLISH_INSTRUCTION} (${label} 성격에 맞추고 기존 높이·경사로·물은 유지해 줘)`;
}

function buildNpcPresets(zone: SelectionZoneContext): SelectionQuickPreset[] {
  const scope = zone.source === "location" ? `「${zone.label}」` : `이 선택 영역(${zone.label})`;
  const guard = "기존 높이·경사로·물·건물은 바꾸지 마.";
  const waterTotal = zone.metrics.insideCounts.water + zone.metrics.outsideCounts.water;
  if (waterTotal >= 3 || ZONE_WATER_WORDS.test(zone.label)) {
    return [
      { id: "ferryman", label: "뱃사공 NPC", instruction: `${scope} 물가 근처 통행 가능한 칸에 배편을 안내하는 뱃사공 NPC와 대화를 배치해 줘. ${guard}` },
      { id: "fisher", label: "낚시꾼 주민", instruction: `${scope} 선착장 주변에 지역 소문을 들려주는 낚시꾼 NPC 1명을 배치해 줘. ${guard}` },
      { id: "dock-merchant", label: "항구 상인", instruction: `${scope}에 여행 보급품을 파는 항구 상인 NPC를 배치해 줘. ${guard}` },
    ];
  }
  if (zone.mapRole === "interior") {
    return [
      { id: "shopkeeper", label: "가게 주인", instruction: `${scope} 실내 카운터 근처에 주인 NPC와 짧은 대화를 배치해 줘. ${guard}` },
      { id: "guest", label: "손님 NPC", instruction: `${scope} 실내 빈 칸에 머물고 있는 손님 NPC 1~2명을 배치해 줘. ${guard}` },
      { id: "chest", label: "조사·상자 이벤트", instruction: `${scope} 실내 구석에 조사하거나 열 수 있는 소품·상자 이벤트를 배치해 줘. ${guard}` },
    ];
  }
  if (zone.mapRole === "dungeon" || ZONE_DANGER_WORDS.test(zone.label)) {
    return [
      { id: "scout", label: "정찰병·안내자", instruction: `${scope} 길목에 앞쪽 위험을 경고해 주는 정찰병 NPC 1명을 배치해 줘. ${guard}` },
      { id: "chest", label: "보물상자", instruction: `${scope} 구석 통행 가능한 칸에 이 맵 수준에 맞는 보물상자 1개를 배치해 줘. ${guard}` },
      { id: "hermit", label: "은둔자 NPC", instruction: `${scope}에 짧은 힌트를 주는 은둔자 NPC 1명을 배치해 줘. ${guard}` },
    ];
  }
  return [
    { id: "merchant", label: "상인 NPC", instruction: `${scope} 통행 가능한 칸에 잡화 상인 NPC와 대화를 배치해 줘. ${guard}` },
    { id: "villager", label: "마을 주민", instruction: `${scope}에 마을 이야기를 들려주는 주민 NPC 1~2명을 배치해 줘. ${guard}` },
    { id: "guard", label: "경비병", instruction: `${scope} 입구·길목 근처에 경비병 NPC를 배치해 줘. ${guard}` },
  ];
}

function buildDirectPresets(zone: SelectionZoneContext): SelectionQuickPreset[] {
  const scope = zone.source === "location" ? `「${zone.label}」` : `이 선택 영역(${zone.label})`;
  const guard = "기존 높이·경사로·물은 유지해.";
  const waterTotal = zone.metrics.insideCounts.water + zone.metrics.outsideCounts.water;
  if (waterTotal >= 3 || ZONE_WATER_WORDS.test(zone.label)) {
    return [
      { id: "dock-props", label: "부두·등불 소품", instruction: `${scope} 물가에 부두·화물·등불 소품을 자연스럽게 채워 줘. ${guard}` },
      { id: "shore-polish", label: "물가 다듬기", instruction: `${scope} 해안선과 주변 바닥을 자연스럽게 이어지게 다듬어 줘. ${guard}` },
      { id: "bridge", label: "다리 놓기", instruction: `${scope} 물길을 건널 수 있게 나무 다리를 놓아 줘. ${guard}` },
    ];
  }
  if (zone.mapRole === "interior") {
    return [
      { id: "furniture", label: "가구·소품 채우기", instruction: `${scope} 실내에 어울리는 테이블·의자·장식 소품을 배치해 줘. 출입구는 막지 마.` },
      { id: "lighting", label: "따뜻한 등불 분위기", instruction: `${scope} 실내에 등불과 아늑한 소품으로 따뜻한 분위기를 내 줘.` },
      { id: "polish", label: "주변과 다듬기", instruction: `${POLISH_INSTRUCTION} (${zone.label} 실내 동선 유지)` },
    ];
  }
  if (zone.mapRole === "dungeon" || zone.metrics.outsideCounts.forest >= 3) {
    return [
      { id: "forest-detail", label: "바위·풀·이끼 보강", instruction: `${scope}에 바위·이끼·풀을 자연스럽게 흩뿌려 디테일을 살려 줘. 통로와 높이·물은 유지해.` },
      { id: "campfire", label: "야영지·모닥불", instruction: `${scope} 빈터에 모닥불과 통나무 의자로 작은 야영지를 만들어 줘. ${guard}` },
      { id: "polish", label: "주변과 다듬기", instruction: `${POLISH_INSTRUCTION} (${zone.label} 통로·높이 유지)` },
    ];
  }
  return [
    { id: "street-props", label: "가로등·화분·벤치", instruction: `${scope}에 가로등·화분·벤치·표지판을 자연스럽게 배치해 줘. ${guard}` },
    { id: "polish", label: "주변과 다듬기", instruction: `${POLISH_INSTRUCTION} (${zone.label} 성격 유지, 높이·경사로·물 보존)` },
    { id: "market-stalls", label: "좌판·광장 분위기", instruction: `${scope}에 작은 좌판과 등불을 놓아 활기찬 광장 분위기를 만들어 줘. ${guard}` },
  ];
}

function pickSuggestedNpcCell(
  map: GameMap,
  tileset: TilesetDef | undefined,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { readonly x: number; readonly y: number } | null {
  const cx = Math.floor((x0 + x1 - 1) / 2);
  const cy = Math.floor((y0 + y1 - 1) / 2);
  const occupied = new Set(map.events.map((ev) => `${ev.x},${ev.y}`));
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (occupied.has(`${x},${y}`)) continue;
      const i = y * map.width + x;
      if ((map.terrainDesign?.waterDepth?.[i] ?? 0) > 0) continue;
      if (tileset) {
        const pf = cellPassability(tileset, map, i);
        if (!pf.up && !pf.down && !pf.left && !pf.right) continue;
      }
      const dist = Math.abs(x - cx) + Math.abs(y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x, y };
      }
    }
  }
  return best;
}

/**
 * 선택 영역(rect)의 맥락을 0ms로 분석하고 우선순위 액션(#1·#2·#3)을 계산한다.
 */
export function analyzeSelectionIntent(
  project: Project,
  map: GameMap,
  rect: SelectionRect,
  activeLayer?: Layer,
): SelectionIntentAnalysis {
  const tileset = project.tilesets[map.tilesetId];
  const mapRole = resolveEffectiveMapRole(project, map, tileset);
  const mapRoleLabel = mapRoleLabelOf(mapRole);

  const x0 = Math.max(0, Math.min(map.width - 1, rect.x));
  const y0 = Math.max(0, Math.min(map.height - 1, rect.y));
  const x1 = Math.max(x0 + 1, Math.min(map.width, rect.x + Math.max(1, rect.width)));
  const y1 = Math.max(y0 + 1, Math.min(map.height, rect.y + Math.max(1, rect.height)));
  const rw = x1 - x0;
  const rh = y1 - y0;
  const area = Math.max(1, rw * rh);

  const insideCounts: Record<ContextTileCategory, number> = { water: 0, road: 0, forest: 0, building: 0, other: 0 };
  const outsideCounts: Record<ContextTileCategory, number> = { water: 0, road: 0, forest: 0, building: 0, other: 0 };
  let passableCells = 0;
  let emptyUpperCells = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * map.width + x;
      insideCounts[classifyCell(map, tileset, i)] += 1;
      if (layerTileAt(map, 3, i) < 0 && layerTileAt(map, 4, i) < 0) emptyUpperCells += 1;
      if (!tileset) {
        passableCells += 1;
      } else {
        const pf = cellPassability(tileset, map, i);
        if (pf.up || pf.down || pf.left || pf.right) passableCells += 1;
      }
    }
  }

  for (let y = y0 - 1; y <= y1; y += 1) {
    for (let x = x0 - 1; x <= x1; x += 1) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) continue;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const i = y * map.width + x;
      outsideCounts[classifyCell(map, tileset, i)] += 1;
    }
  }

  const insideEvents = map.events.filter((ev) => ev.x >= x0 && ev.x < x1 && ev.y >= y0 && ev.y < y1).length;
  const hasMapEncounter = (map.encounterRate ?? 0) > 0 || (map.encounterTable?.length ?? 0) > 0 || (map.fieldSpawns?.length ?? 0) > 0;

  const matchedLocation = bestMatchingLocation(map, { x: x0, y: y0, width: rw, height: rh });
  const matchedLayout = matchedLocation ? undefined : bestMatchingLayoutRegion(map, { x: x0, y: y0, width: rw, height: rh });
  const hasRegionEncounter = regionHasWalkEncounter(map, { x: x0, y: y0, width: rw, height: rh }, matchedLocation?.id);

  const metrics: SelectionZoneMetrics = {
    area,
    passableRatio: passableCells / area,
    emptyUpperRatio: emptyUpperCells / area,
    waterRatio: insideCounts.water / area,
    insideEvents,
    outsideCounts,
    insideCounts,
    hasMapEncounter,
    hasRegionEncounter,
  };

  let zone: SelectionZoneContext;
  if (matchedLocation) {
    zone = {
      label: matchedLocation.name,
      source: "location",
      locationId: matchedLocation.id,
      ...(matchedLocation.tags?.length ? { locationTags: matchedLocation.tags } : {}),
      suggestedZoneName: matchedLocation.name,
      suggestedZoneTags: matchedLocation.tags ?? [],
      mapRole,
      mapRoleLabel,
      metrics,
    };
  } else if (matchedLayout) {
    const mapped = LAYOUT_ROLE_LABELS[matchedLayout.role];
    const layoutLabel = matchedLayout.label.trim() || mapped?.label || matchedLayout.role;
    zone = {
      label: layoutLabel,
      source: "layout",
      suggestedZoneName: layoutLabel,
      suggestedZoneTags: mapped ? [mapped.tag] : [matchedLayout.role],
      mapRole,
      mapRoleLabel,
      metrics,
    };
  } else {
    const inferred = inferTileZoneLabel(mapRole, metrics);
    zone = {
      label: inferred.label,
      source: "tiles",
      suggestedZoneName: inferred.suggestedName,
      suggestedZoneTags: inferred.tags,
      mapRole,
      mapRoleLabel,
      metrics,
    };
  }

  // 점수 계산 — 모든 3대 액션이 항상 노출되며, 확률이 높은 순서대로 #1·#2·#3 배치된다.
  let npcScore = 26;
  let directScore = 30;
  let encounterScore = 16;
  const npcReasons: string[] = [];
  const directReasons: string[] = [];
  const encounterReasons: string[] = [];

  // 1) 맵 성격
  if (mapRole === "town") {
    npcScore += 22; npcReasons.push("마을");
    directScore += 8;
    encounterScore -= 10;
  } else if (mapRole === "interior") {
    npcScore += 24; npcReasons.push("실내");
    directScore += 14; directReasons.push("실내 꾸미기");
    encounterScore -= 12;
  } else if (mapRole === "dungeon") {
    encounterScore += 36; encounterReasons.push("던전");
    directScore += 10;
  } else if (mapRole === "field") {
    encounterScore += 26; encounterReasons.push("필드");
    directScore += 10;
  }

  // 2) 저장된 구역 태그 / 설계도 키워드
  const zoneHay = `${zone.label} ${(zone.locationTags ?? []).join(" ")} ${zone.suggestedZoneTags.join(" ")}`;
  if (ZONE_SAFE_WORDS.test(zoneHay)) {
    npcScore += 16; npcReasons.push(zone.label);
    directScore += 8;
  }
  if (ZONE_DANGER_WORDS.test(zoneHay)) {
    encounterScore += 22; encounterReasons.push(zone.label);
    directScore += 8;
  }
  if (ZONE_WATER_WORDS.test(zoneHay) || metrics.waterRatio >= 0.35) {
    directScore += 20; directReasons.push("물가·부두");
    npcScore -= 4;
  }

  // 3) 영역 크기
  if (area <= 6) {
    npcScore += 22; npcReasons.push("소형 영역");
    encounterScore -= 8;
  } else if (area <= 48) {
    directScore += 12; directReasons.push("중형 구간");
    encounterScore += 12;
  } else {
    directScore += 26; directReasons.push("광역 구획");
    encounterScore += 14; encounterReasons.push("넓은 구역");
    npcScore -= 10;
  }

  // 4) 내부 상태 (통행·빈바닥·이벤트·조우)
  if (metrics.passableRatio <= 0.25) {
    directScore += 24; directReasons.push("비통행 지형");
    npcScore -= 24;
    encounterScore -= 24;
  } else if (metrics.emptyUpperRatio >= 0.72) {
    directScore += 18; directReasons.push("빈 바닥");
  } else {
    npcScore += 8;
  }

  if (insideEvents === 0 && metrics.passableRatio > 0.35) {
    npcScore += 12; npcReasons.push("NPC 비어있음");
  } else if (insideEvents >= 3) {
    npcScore -= 10;
  }

  if (!hasRegionEncounter && (mapRole === "dungeon" || mapRole === "field" || metrics.outsideCounts.forest >= 3)) {
    encounterScore += 18; encounterReasons.push("조우 미설정");
  } else if (hasRegionEncounter) {
    encounterScore += 6; encounterReasons.push("기존 조우 수정");
  }

  // 5) 테두리 지형 보정
  if (metrics.outsideCounts.building >= 2 || metrics.outsideCounts.road >= 2) {
    npcScore += 10;
    if (npcReasons.length < 2) npcReasons.push("길·건물 인접");
  }
  if (metrics.outsideCounts.forest >= 3 && mapRole !== "town" && mapRole !== "interior") {
    encounterScore += 16;
    if (encounterReasons.length < 2) encounterReasons.push("숲 인접");
  }

  // 6) 현재 작업 레이어 보정
  if (activeLayer === "event") {
    npcScore += 18; npcReasons.push("이벤트 레이어");
  } else if (activeLayer === "upper") {
    directScore += 12; directReasons.push("상위 레이어");
  }

  const rawActions: Omit<SelectionQuickAction, "rank">[] = [
    {
      kind: "npc",
      label: "NPC 추가",
      score: clampScore(npcScore),
      reason: npcReasons.length > 0 ? npcReasons.slice(0, 2).join(" · ") : "구역 내 인물 배치",
      title: `이 영역(${zone.label})에 NPC와 대화를 추가 — AI 조수 지시`,
      instruction: buildNpcInstruction(zone),
    },
    {
      kind: "direct",
      label: "맵 디렉팅",
      score: clampScore(directScore),
      reason: directReasons.length > 0 ? directReasons.slice(0, 2).join(" · ") : "주변 어울림 보강",
      title: `이 영역(${zone.label})을 분위기에 맞게 다듬기 — AI 조수 지시`,
      instruction: buildDirectInstruction(zone),
    },
    {
      kind: "encounter",
      label: "몹 조우",
      score: clampScore(encounterScore),
      reason: encounterReasons.length > 0 ? encounterReasons.slice(0, 2).join(" · ") : "걸을 때 적 만나기",
      title: `이 영역(${zone.label})에 걸을 때 적 만나기(인카운터) 설정`,
      instruction: null,
    },
  ];

  rawActions.sort((a, b) => b.score - a.score);
  const actions: SelectionQuickAction[] = rawActions.map((item, idx) => ({
    ...item,
    rank: (idx + 1) as 1 | 2 | 3,
  }));

  const promptPlaceholder = `${zone.label} · AI에게 시킬 일…`;
  return {
    zone,
    actions,
    npcPresets: buildNpcPresets(zone),
    directPresets: buildDirectPresets(zone),
    suggestedNpcCell: pickSuggestedNpcCell(map, tileset, x0, y0, x1, y1),
    promptPlaceholder,
  };
}
