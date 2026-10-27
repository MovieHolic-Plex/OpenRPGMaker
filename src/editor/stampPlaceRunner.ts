// editor/stampPlaceRunner.ts
// 바로 깔기 실행기 — 모델이 의도를 읽고(한 번), 코드가 도구를 바로 돌리고, 실패만 모델에게 한 번 되묻는다.
//
// 계획 턴·승인·다회 에이전트 세션은 없다. 모델 호출은 계획 1(실패·시간 초과면 한 번 더) + 수리 1, 가벼운 모델·추론 끔.
// **반드시 모델을 거친다**(사용자 판단, 2026-09-27): 모델이 없거나 끝내 읽지 못하면 아무것도 깔지 않고 이유를 말한다.
// 낱말 규칙으로 조용히 다른 것을 까는 폴백은 없앴다 — 「숲」이 통행 불가 덤불로 깔리던 길이 그 폴백이었다.
// 상자·NPC 는 현재 맵 사실(`@/ai/mapPlacementContext`)을 보고 고르고, 상자 금액은 그 범위로 코드가 맞춘다.
// 순수 계획·검증은 `@/ai/stampPlanner`. 이 파일은 스토어·모델 배선만 한다.
//
// undo: 한 라운드의 단계는 applyToolSequenceToStore(continueOnError) 로 **한 체크포인트**에 묶는다.
// 수리 라운드가 돌면 그 대체 단계가 두 번째 체크포인트가 된다(모델 호출 사이에 사용자가 편집할 수 있어
// 첫 라운드를 커밋하지 않고 들고 있지 않는다).
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import {
  chatCompletion,
  configForLiteModel,
  loadAiConfig,
  type AiConfig,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
} from "@/ai/llmClient";
import { formatMaterialLabelHint } from "@/ai/turnGuide";
import { buildMapPlacementContext } from "@/ai/mapPlacementContext";
import {
  buildStampPlannerUserPayload,
  buildStampRepairPrompt,
  buildStampTurn2Prompt,
  classifyFastPathCommand,
  expandStampObjects,
  extractCompoundFollowUpGoals,
  extractEraseTargetNoun,
  extractMoveDestinationPhrase,
  extractMoveSourcePhrase,
  extractMoveTargetNoun,
  extractSpatialZonePhrase,
  FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
  inferMaxStampLlmTurns,
  parseRelativeShift,
  parseStampPlan,
  planStampFollowUpFallback,
  resolveStampOverlaps,
  shouldRunStampTurn2,
  STAMP_PLANNER_SYSTEM_PROMPT,
  type FastPathCommandClassification,
  type FastPathCommandTier,
  type FastPathRejectCode,
  type FastPathSpatialOpKind,
  type ParsedStampPlan,
  type PlacedMapObjectSummary,
  type StampPlanFacts,
  type StampRect,
  type StampRefusal,
  type StampStep,
  type StampTurnObservation,
} from "@/ai/stampPlanner";
import {
  collectOverlappingPropClearPatches,
  EXTENDED_STAMP_TOOLS,
  expandExtendedSpatialStep,
  type ExtendedTilePatch,
} from "@/editor/stampPlaceExtendedTools";
import { acceptedObjectNames, buildStampObjectIndex, extractCoreObjectName, sampleStampObjectNames } from "@/ai/stampObjects";
import { captureStructureTiles, makeStructurePlacement, removeStructurePlacement, type StructureTiles } from "@/project/structurePlacements";

export {
  classifyFastPathCommand,
  FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
  type FastPathCommandClassification,
  type FastPathCommandTier,
  type FastPathRejectCode,
  type FastPathSpatialOpKind,
};
import { describeStampEffect, eventHasVisibleArt, hasVisibleChange, measureStampEffect, type StampEffect } from "@/editor/stampEffect";
import { expandSceneStep, stampSceneMenu } from "@/editor/stampScenes";
import { forestTreeKindFromResolvedMaterial } from "@/editor/tools/forestDensity";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import type { ToolResult } from "@/editor/tools/types";
import { fillableMaterialSuggestions, resolveMaterialByLabel, suggestMaterialsByLabel } from "@/project/tileVocabulary";
import { buildJpCityBuilding } from "@/editor/jpCity/builder";
import { planQuickHouse, quickHouseCatalog, quickHouseKit, quickHouseMinWidth, quickHouseStyles, type QuickHouseOptions, type QuickHousePlan } from "@/editor/quickHouse";
import { copiedTerrainMap } from "@/editor/terrainDesignPlans";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { store } from "@/project/store";
import { isPassable, isPassableLanding } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack, topTileInStack } from "@/project/mapOverlayTiles";
import { terrainLocked } from "@/project/terrainDesign";
import { invalidateReliefSlopes, rampCode } from "@/project/relief/walk";
import type { GameEvent, GameMap, Project, TilesetDef } from "@/project/types";
import { isWaterRole } from "@/project/tileRoles";
/** 계획 호출 하나에 허용하는 벽시계(의도 선언과 같다). 수리 호출도 같은 값을 따로 쓴다. */
export const STAMP_PLAN_TIMEOUT_MS = 20_000;

/** intentDeclarationClient 의 ChatFn 과 같은 모양 — 테스트는 JSON 문자열을 돌려주는 가짜를 넣는다. */
export type StampChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

export interface StampRunSelection {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type StampRunPhase = "planning" | "applying" | "repairing";

export interface StampRunInput {
  readonly text: string;
  readonly mapId: string;
  readonly selection: StampRunSelection | null;
  readonly signal?: AbortSignal;
  readonly onPhase?: (phase: StampRunPhase) => void;
  /**
   * 스토어에 적용하기 직전에 기다린다(적용 라운드마다 한 번). 주문 대기열이 조수 채팅 턴이 끝날 때까지
   * 적용을 미루는 데 쓴다. 기다리는 동안 다른 주문이 깔렸을 수 있으므로 러너는 기다린 **뒤** 맵 사실을 다시 읽어 겹침을 푼다.
   */
  readonly waitForApply?: () => Promise<void>;
  /** 주입하면 연결 판정을 건너뛰고 이 함수로 모델을 부른다(테스트용). */
  readonly chat?: StampChatFn;
  /** 장면 구성기 씨앗(테스트·재현용). 생략하면 부를 때마다 다른 값 — 같은 문장도 다른 장면이 나온다. */
  readonly variation?: number;
  /** 바로 깔기 내 최대 LLM 연쇄 시공 턴 수 (기본 2, 다단계 RPG 월드빌딩 요청 시 최대 4). */
  readonly maxLlmTurns?: 1 | 2 | 3 | 4;
}

export interface StampRunResult {
  /** 한 단계 이상 적용됐고 남은 실패가 없다. */
  readonly ok: boolean;
  /** 바로 깔기 거부 가드 코드(예: "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT"). */
  readonly code?: FastPathRejectCode;
  /** 3-Tier 분류 결과. */
  readonly tier?: FastPathCommandTier;
  /** 일반 AI 조수 모드로 즉시 넘길 원본 지시문. */
  readonly handoffPrompt?: string;
  /** 채팅 말풍선용 한국어 줄 — 단계마다 한 줄(+ 실패 이유). */
  readonly lines: readonly string[];
  readonly applied: number;
  /** 모델 계획을 받아 적용 단계까지 갔으면 true. 모델 없음·계획 실패·사전 가드면 false. */
  readonly usedModel: boolean;
  /** 칩셋에 그림이 없어 깔지 않은 물건 수(0 이면 필드 없음). */
  readonly refused?: number;
  /** 적용 전후 맵 비교 — 실제로 바뀐 타일·이벤트 수. */
  readonly effect?: StampEffect;
  /** 바로 깔기 실행 중 사용된 LLM 계획 턴 수 (기본 1, 복합·연쇄 시공 시 최대 4). */
  readonly llmTurnsUsed?: 1 | 2 | 3 | 4;
}
type PendingStructureOp =
  | { readonly kind: "remove"; readonly mapId: string; readonly placementId: string }
  | {
      readonly kind: "relocate";
      readonly mapId: string;
      readonly placementId: string;
      readonly kitId: string;
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly before: StructureTiles;
    }
  | {
      readonly kind: "relief_ramps";
      readonly mapId: string;
      readonly style?: string;
      readonly ramps: readonly { readonly x: number; readonly y: number; readonly code: number }[];
    }
  | {
      readonly kind: "tile_patch";
      readonly mapId: string;
      readonly patches: readonly { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number }[];
    }
  | {
      readonly kind: "event_upsert";
      readonly mapId: string;
      readonly event: GameEvent;
    }
  | {
      readonly kind: "switch_ensure";
      readonly switchId: string;
      readonly name: string;
    };
const pendingStructureOps: PendingStructureOp[] = [];
let stampVariationSeq = 0;
const recentCastleArchetypes: CastleArchetypeId[] = [];
type ToolCall = { name: string; args: Record<string, unknown> };

/** 테스트 주입 지점. 기본값은 실제 스토어·모델. */
export interface StampRunDeps {
  readonly getProject: () => Project;
  readonly apply: (calls: readonly ToolCall[]) => ToolResult[];
  readonly chat: StampChatFn;
  readonly getConfig: () => AiConfig;
  readonly isModelReady: (config: AiConfig) => boolean;
  readonly timeoutMs: number;
}

function defaultDeps(chat: StampChatFn | undefined): StampRunDeps {
  return {
    getProject: () => store.getCurrent(),
    apply: (calls) => applyStampCallsWithStructureOps(calls),
    chat: chat ?? chatCompletion,
    getConfig: loadAiConfig,
    isModelReady: chat ? () => true : (config) => isAssistantEndpointReady(config, getAiConnectionStatus(config)),
    timeoutMs: STAMP_PLAN_TIMEOUT_MS,
  };
}

function applyStampCallsWithStructureOps(calls: readonly ToolCall[]): ToolResult[] {
  const ops = pendingStructureOps.splice(0, pendingStructureOps.length);
  const removeOps = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "remove" | "relocate" }> => op.kind === "remove" || op.kind === "relocate");
  if (removeOps.length > 0) {
    const affectedMapIds = new Set(removeOps.map((op) => op.mapId));
    for (const mapId of affectedMapIds) {
      const removeIds = new Set(removeOps.filter((op) => op.mapId === mapId).map((op) => op.placementId));
      store.updateMap(mapId, (draft) => {
        for (const id of removeIds) removeStructurePlacement(draft, id);
      });
    }
  }
  const results = applyToolSequenceToStore(calls, { continueOnError: true });
  const tilePatches = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "tile_patch" }> => op.kind === "tile_patch");
  if (tilePatches.length > 0 && results.some((r) => r.ok)) {
    for (const tp of tilePatches) {
      store.updateMap(tp.mapId, (draft) => {
        for (const p of tp.patches) {
          if (p.x < 0 || p.y < 0 || p.x >= draft.width || p.y >= draft.height) continue;
          const idx = p.y * draft.width + p.x;
          if (p.lower !== undefined) draft.lowerTiles[idx] = p.lower;
          if (p.upper !== undefined) draft.upperTiles[idx] = p.upper;
        }
      });
    }
  }
  const relocations = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "relocate" }> => op.kind === "relocate");
  if (relocations.length > 0 && results.some((r) => r.ok)) {
    for (const rel of relocations) {
      store.updateMap(rel.mapId, (draft) => {
        const next = makeStructurePlacement(draft, {
          id: rel.placementId,
          kitId: rel.kitId,
          rect: { x: rel.x, y: rel.y, w: rel.w, h: rel.h },
          before: rel.before,
        });
        draft.structurePlacements = [...(draft.structurePlacements ?? []), next];
      });
    }
  }
  const reliefOps = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "relief_ramps" }> => op.kind === "relief_ramps");
  if (reliefOps.length > 0 && results.some((r) => r.ok)) {
    for (const rop of reliefOps) {
      store.updateMap(rop.mapId, (draft) => {
        if (!draft.relief) return;
        const ramps = draft.relief.ramps ? [...draft.relief.ramps] : new Array<number>(draft.width * draft.height).fill(0);
        for (const r of rop.ramps) {
          if (r.x >= 0 && r.y >= 0 && r.x < draft.width && r.y < draft.height) {
            ramps[r.y * draft.width + r.x] = r.code;
          }
        }
        draft.relief = {
          ...draft.relief,
          ramps,
          ...(rop.style ? { style: rop.style } : {}),
        };
        invalidateReliefSlopes(draft.relief);
      });
    }
  }
  const switchOps = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "switch_ensure" }> => op.kind === "switch_ensure");
  if (switchOps.length > 0 && results.some((r) => r.ok)) {
    store.update((draft) => {
      for (const sw of switchOps) {
        const existing = draft.switches.find((entry) => entry.id === sw.switchId);
        if (existing) {
          if (existing.name === "") existing.name = sw.name;
        } else {
          draft.switches.push({ id: sw.switchId, name: sw.name });
        }
        draft.session.switches[sw.switchId] ??= false;
      }
    });
  }
  const eventOps = ops.filter((op): op is Extract<PendingStructureOp, { readonly kind: "event_upsert" }> => op.kind === "event_upsert");
  if (eventOps.length > 0 && results.some((r) => r.ok)) {
    const byMap = new Map<string, GameEvent[]>();
    for (const evOp of eventOps) {
      const list = byMap.get(evOp.mapId) ?? [];
      list.push(evOp.event);
      byMap.set(evOp.mapId, list);
    }
    for (const [mapId, events] of byMap) {
      store.updateMap(mapId, (draft) => {
        for (const ev of events) {
          const existingIdx = draft.events.findIndex((e) => e.id === ev.id);
          if (existingIdx >= 0) {
            draft.events[existingIdx] = ev;
          } else {
            draft.events.push(ev);
          }
        }
      });
    }
  }
  return results;
}

export async function runStampPlace(input: StampRunInput): Promise<StampRunResult> {
  return runStampPlaceWith(input, defaultDeps(input.chat));
}

class StampAborted extends Error {}

function contentText(result: ChatResult): string {
  const content = result.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part.type === "text" ? part.text : "")).join("");
  return "";
}

function resultDetail(result: ToolResult | undefined): string {
  if (!result) return "실행되지 않았습니다.";
  return result.summary || result.issues?.map((issue) => issue.message).join(" ") || (result.ok ? "완료" : "실패했습니다.");
}

function reasonOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** 모델 사실 묶음 — 재료는 현재 맵 타일셋의 실제 라벨(채팅 컨텍스트와 같은 힌트 + fill_region 이 받는 면 재료). */
export function buildStampPlanFacts(
  project: Project,
  input: { readonly text: string; readonly mapId: string; readonly target: StampRect; readonly targetIsSelection: boolean },
): StampPlanFacts | null {
  const map = project.maps[input.mapId];
  if (!map) return null;
  const tileset = project.tilesets[map.tilesetId];
  const placement = buildMapPlacementContext(project, input.mapId);
  const objects = buildStampObjectIndex(tileset);
  return {
    text: input.text,
    mapId: input.mapId,
    mapWidth: map.width,
    mapHeight: map.height,
    target: input.target,
    targetIsSelection: input.targetIsSelection,
    ...(tileset ? { tilesetId: tileset.id } : {}),
    fillMaterials: tileset ? fillableLabels(tileset) : [],
    materialHint: formatMaterialLabelHint(tileset).replace(/^- /u, ""),
    ...(tileset ? { wallMaterials: buildableWallLabels(tileset) } : {}),
    ...(tileset ? { doorMaterials: doorLabels(tileset) } : {}),
    houseLooks: tileset ? quickHouseStyles(tileset).length || quickHouseCatalog(tileset).length || (tileset.id === "jp_city" ? 4 : 0) : 0,
    ...(placement ? { placement } : {}),
    scenes: stampSceneMenu(project, map),
    objects,
    objectSamples: sampleStampObjectNames(objects, 36),
    placedObjects: detectPlacedMapObjects(map, tileset),
    isOpenCell: (x, y) => isOpenObjectCell(project, map, x, y),
    isWallMountCell: (x, y) => isWallMountCell(map, tileset, x, y),
    isWaterCell: (x, y) => isWaterCell(map, tileset, x, y),
    isRoadCell: (x, y) => isRoadCell(map, tileset, x, y),
    hasArtAt: (x, y) => hasArtAt(map, x, y),
    ...(tileset ? { isWallCell: (x: number, y: number) => isWallCell(map, tileset, x, y) } : {}),
    isTreeMaterial: (material) => {
      if (!tileset) return false;
      const resolved = resolveMaterialByLabel(tileset, material, { preferGroup: true, preferRoles: ["prop", "terrain"] });
      if (resolved.status === "missing") return true; // 못 찾는 재료는 도구가 라벨 오류를 말한다 — density 를 건드리지 않는다.
      return Boolean(forestTreeKindFromResolvedMaterial({
        kind: resolved.kind,
        ...(resolved.kind === "group" ? { groupId: resolved.group.id, groupName: resolved.group.name } : {}),
        matchedLabel: resolved.matchedLabel,
      }));
    },
  };
}

function fillableLabels(tileset: TilesetDef): string[] {
  const out: string[] = [];
  for (const entry of fillableMaterialSuggestions(tileset, 32)) {
    if (!entry.label || out.includes(entry.label)) continue;
    const resolved = resolveMaterialByLabel(tileset, entry.label, {
      preferGroup: true,
      preferRoles: ["water", "terrain"],
      requireAutotileGroup: true,
    });
    if (resolved.status !== "missing" && resolved.kind === "group") out.push(entry.label);
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * build_wall 이 실제로 세우는 벽 라벨 — 패턴 그룹으로 풀리고 벽 전개 패턴이 있는 것만.
 * 왜(2026-10-17 실측): 「벽」 라벨 검색 후보(버들항: 성벽·절벽면·저택 현관 벽칸…)가 전부 단일 타일이라
 * build_wall 이 「단일 타일입니다」로 매번 실패하고 수리 호출 한 번을 버렸다. 세울 수 있는 벽이 없으면 목록을 보내지 않는다.
 */
function buildableWallLabels(tileset: TilesetDef): string[] {
  const candidates = [
    ...suggestMaterialsByLabel(tileset, "벽", 24).map((entry) => entry.label),
    ...(tileset.tileGroups ?? []).filter((group) => group.role === "wall").map((group) => group.name),
  ];
  const out: string[] = [];
  for (const label of new Set(candidates)) {
    if (!label) continue;
    const resolved = resolveMaterialByLabel(tileset, label, { preferGroup: true, preferRoles: ["wall"] });
    if (resolved.status !== "missing" && resolved.kind === "group" && (resolved.group.patternGrammar?.parts.length ?? 0) > 0) out.push(label);
    if (out.length >= 5) break;
  }
  return out;
}

/** place_door 가 받는 문 라벨 — 패턴 그룹으로 풀리는 것만(단일 타일 문은 도구가 「단일 타일」로 거부한다). */
function doorLabels(tileset: TilesetDef): string[] {
  const out: string[] = [];
  for (const entry of suggestMaterialsByLabel(tileset, "문", 12)) {
    const resolved = resolveMaterialByLabel(tileset, entry.label, { preferGroup: true, preferRoles: ["prop"] });
    if (resolved.status !== "missing" && resolved.kind === "group" && !out.includes(entry.label)) out.push(entry.label);
    if (out.length >= 3) break;
  }
  return out;
}

/** 물건 발자국 한 칸이 놓일 수 있는 칸 — 걸을 수 있고, 위층이 비었고, 이벤트·시작칸이 아니고, 차도·물·벽 면이 아니다. */
export function isOpenObjectCell(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0 || (map.upperOverlayTiles?.[index] ?? -1) >= 0) return false;
  if (map.events.some((event) => event.x === x && (event.y === y || event.y === y + 1))) return false;
  if (project.startMapId === map.id && project.startPos.x === x && project.startPos.y === y) return false;
  if (!isPassableLanding(project, map, x, y)) return false;
  const tileset = project.tilesets[map.tilesetId];
  const lower = map.lowerTiles[index] ?? -1;
  // modern_city 의 타일 9(연석·남쪽이 도로), 타일 10(연석·북쪽이 도로, 남쪽 보도 윗줄이라 높이 3칸 신호등이 차도를 덮음), 타일 5·6(횡단보도) 및 횡단보도 열(x)을 피한다.
  if (tileset?.id === "modern_city") {
    if (lower === 9 || lower === 10 || lower === 5 || lower === 6) return false;
    if (y >= 10 && y <= 18) {
      for (let ry = Math.max(0, y - 5); ry <= Math.min(map.height - 1, y + 5); ry++) {
        const l = map.lowerTiles[ry * map.width + x] ?? -1;
        if (l === 5 || l === 6) return false;
      }
    }
  }
  if (tileset?.id === "jp_city") {
    // 도로 주변(y=10..19)에서 아직 포장되지 않은 맨땅(타일 1)에는 거리 소품을 세우지 않고 보도(y=11..12, 17)에 세운다.
    if (y >= 10 && y <= 19 && lower === 1 && map.lowerTiles.some((t) => t >= 3544 && t <= 3555)) return false;
    // 횡단보도 열(x)과 정확히 겹치는 보도 칸에는 신호등·가로등을 세우지 않고 횡단보도 옆에 세운다.
    for (let ry = Math.max(0, y - 5); ry <= Math.min(map.height - 1, y + 5); ry++) {
      const u = map.upperTiles[ry * map.width + x] ?? -1;
      const l = map.lowerTiles[ry * map.width + x] ?? -1;
      if (u === 3646 || (l >= 3596 && l <= 3604)) return false;
    }
  }
  const meta = tileset?.tileMeta?.[lower];
  const isSidewalk = /보도|인도|광장/u.test(meta?.label ?? "") && !/횡단보도/u.test(meta?.label ?? "");
  const isWall = meta?.role === "wall" || (!isSidewalk && /벽|천장/u.test(meta?.label ?? ""));
  const isRoad = !isSidewalk && (meta?.role === "road" || meta?.role === "path" || /차도|아스팔트|차선|도로|길(?=$|[\s·,(])|포석|횡단보도/u.test(meta?.label ?? ""));
  const isWater = meta?.role === "water" || /물|강|호수|바다|연못|용암/u.test(meta?.label ?? "");
  return !isWall && !isRoad && !isWater;
}

function isGrassOrSoilCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const lower = map.lowerTiles[y * map.width + x] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  return !/보도|인도|광장|판석|연석|차도|아스팔트|생활도로/u.test(meta?.label ?? "");
}

function isWallMountCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0 || (map.upperOverlayTiles?.[index] ?? -1) >= 0) return false;
  const lower = map.lowerTiles[index] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  return meta?.role === "wall" || /벽/u.test(meta?.label ?? "");
}

function isWallCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const lower = map.lowerTiles[y * map.width + x] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  return meta?.role === "wall" || /벽/u.test(meta?.label ?? "");
}

function isWaterCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0) return false;
  const lower = map.lowerTiles[index] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  return isWaterRole(meta?.role) || /물|강|호수|바다|연못|용암|수로/u.test(meta?.label ?? "");
}

function isRoadCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  const upper = map.upperTiles[index] ?? -1;
  // jp_city 의 차도 중앙 점선(3643)은 바닥 차선 표시이므로 차량 배치를 막지 않는다.
  if (upper >= 0 && !(tileset?.id === "jp_city" && upper === 3643)) return false;
  // 횡단보도 칸 및 좌우 1칸 여유 구간에는 차량을 세우지 않는다.
  for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx;
    if (nx < 0 || nx >= map.width) continue;
    const ni = y * map.width + nx;
    const nl = map.lowerTiles[ni] ?? -1;
    const nu = map.upperTiles[ni] ?? -1;
    const nMeta = tileset?.tileMeta?.[nl];
    const uMeta = tileset?.tileMeta?.[nu];
    if (/횡단보도|crosswalk/iu.test(`${nMeta?.label ?? ""} ${uMeta?.label ?? ""}`)) return false;
  }
  const lower = map.lowerTiles[index] ?? -1;
  if (tileset?.id === "modern_city" && (lower === 9 || lower === 10)) return false;
  const meta = tileset?.tileMeta?.[lower];
  if (/보도|인도|광장|연석/u.test(meta?.label ?? "")) return false;
  return meta?.role === "road" || /차도|아스팔트|차선|생활도로|도로/u.test(meta?.label ?? "");
}
/** 그 칸에 보이는 그림이 이미 있는가(위층·겹침 타일 또는 그림 있는 이벤트). */
function hasArtAt(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  const upper = map.upperTiles[index] ?? -1;
  if ((upper >= 0 && upper !== 3643) || (map.upperOverlayTiles?.[index] ?? -1) >= 0) return true;
  return map.events.some((event) => event.x === x && event.y === y && eventHasVisibleArt(event));
}

function targetRect(
  map: { readonly width: number; readonly height: number },
  mapId: string,
  selection: StampRunSelection | null,
): { readonly rect: StampRect; readonly isSelection: boolean } {
  if (selection && selection.mapId === mapId && selection.width > 0 && selection.height > 0) {
    const x = Math.max(0, Math.min(map.width - 1, selection.x));
    const y = Math.max(0, Math.min(map.height - 1, selection.y));
    return {
      rect: { x, y, w: Math.max(1, Math.min(selection.width, map.width - x)), h: Math.max(1, Math.min(selection.height, map.height - y)) },
      isSelection: true,
    };
  }
  return { rect: { x: 0, y: 0, w: map.width, h: map.height }, isSelection: false };
}

function failed(lines: readonly string[]): StampRunResult {
  return { ok: false, lines, applied: 0, usedModel: false };
}

async function callModel(
  deps: StampRunDeps,
  messages: readonly ChatMessage[],
  signal: AbortSignal | undefined,
): Promise<string> {
  if (signal?.aborted) throw new StampAborted();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs);
  const onOuterAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onOuterAbort, { once: true });
  try {
    const base = configForLiteModel(deps.getConfig());
    const config: AiConfig = { ...base, reasoningEffort: "off", maxTokens: Math.min(base.maxTokens, 4096) };
    const result = await deps.chat(config, {
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      signal: controller.signal,
      disableTransientRetry: true,
    });
    return contentText(result);
  } catch (cause) {
    if (signal?.aborted) throw new StampAborted();
    if (controller.signal.aborted) throw new Error(`시간 초과(${deps.timeoutMs}ms)`);
    throw cause;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onOuterAbort);
  }
}

/** 빈 입력을 모델에게 넘길 때의 문장. */
export const EMPTY_SENTENCE = "(빈 입력) 이 자리에 어울리는 것을 알아서 깔아 줘";

const ABORTED: StampRunResult = { ok: false, lines: ["바로 깔기를 중단했습니다."], applied: 0, usedModel: true };

/** 화면에 그림을 바꾸는 도구 — 이 도구만 성공했는데 아무 칸도 안 바뀌었다면 거짓 성공이다. */
const VISUAL_TOOLS: Readonly<Record<string, true>> = {
  fill_region: true,
  paint_tiles: true,
  place_props: true,
  paint_road: true,
  tile_erase: true,
  build_wall: true,
  place_door: true,
  stamp_tileset_object: true,
  place_terrain_house: true,
  build_jp_city_building: true,
  stamp_object: true,
  compose_scene: true,
  sculpt_relief: true,
  place_terrain_ramp: true,
};
/** 도구 결과의 첫 경고 중 사람이 알아야 하는 것(그림 없음·투명) — 줄에 덧붙인다. */
function invisibleWarning(result: ToolResult | undefined): string {
  const text = (result?.warnings ?? []).concat(result?.summary ? [result.summary] : []).find((warning) => /투명|보이지 않/u.test(warning));
  return text ? ` ⚠ ${text}` : "";
}

function refusalLine(refusal: StampRefusal, tilesetLabel: string): string {
  const near = refusal.nearest.length > 0 ? ` 가까운 물건: ${refusal.nearest.join(", ")} — 이 이름으로 다시 말하면 깝니다.` : " 비슷한 이름의 물건도 없습니다.";
  return `「${refusal.wanted}」 — ${tilesetLabel}에는 이 이름의 그림이 없어 깔지 않았습니다(이벤트·지형으로 흉내 내지 않음).${near}`;
}

/** 단계 결과 줄 — 같은 group(화분 3개)은 한 줄로 묶어 놓인 칸을 적는다. */
function stepLines(plan: readonly StampStep[], results: readonly (ToolResult | undefined)[], prefix: string): { lines: string[]; applied: number; failures: { step: StampStep; error: string }[] } {
  const lines: string[] = [];
  const failures: { step: StampStep; error: string }[] = [];
  let applied = 0;
  const grouped = new Map<string, { ok: number; total: number; cells: string[]; note?: string; at: number }>();
  plan.forEach((step, index) => {
    const result = results[index];
    if (step.group) {
      const entry = grouped.get(step.group) ?? { ok: 0, total: 0, cells: [], at: lines.length };
      if (!grouped.has(step.group)) { grouped.set(step.group, entry); lines.push(""); }
      entry.total += 1;
      if (result?.ok) {
        entry.ok += 1;
        applied += 1;
        for (const cell of step.at ?? []) entry.cells.push(`(${cell.x},${cell.y})`);
        if (step.note && !entry.note) entry.note = step.note;
      } else failures.push({ step, error: resultDetail(result) });
      return;
    }
    if (result?.ok) {
      applied += 1;
      if (step.label) lines.push(`${prefix}${step.label} · ${resultDetail(result)}${step.note ? ` (${step.note})` : ""}${invisibleWarning(result)}`);
    } else failures.push({ step, error: resultDetail(result) });
  });
  for (const [group, entry] of grouped) {
    if (entry.ok > 0) lines[entry.at] = `${prefix}${group} ${entry.ok}개 놓음${entry.cells.length ? ` — ${entry.cells.join(" ")}` : ""}${entry.note ? ` (${entry.note})` : ""}`;
  }
  return { lines: lines.filter((line) => line !== ""), applied, failures };
}

export async function runStampPlaceWith(input: StampRunInput, deps: StampRunDeps): Promise<StampRunResult> {
  const project = deps.getProject();
  const map = project.maps[input.mapId];
  if (!map || map.width < 1 || map.height < 1) {
    return { ok: false, lines: ["맵을 연 뒤 바로 깔 수 있습니다."], applied: 0, usedModel: false };
  }
  const rawInputText = input.text.trim();
  const commandCheck = classifyFastPathCommand(rawInputText);
  if (!commandCheck.allowed && commandCheck.code === "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT") {
    return {
      ok: false,
      code: "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT",
      tier: "QUEST_OR_NARRATIVE_REJECTED",
      handoffPrompt: rawInputText,
      lines: [
        commandCheck.guidance ?? FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
        `거부 사유(FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT): 「${commandCheck.matchedCategory ?? "퀘스트·이벤트·대화 만들기"}」 요청은 정적 타일이나 빈 소품으로 흉내 내지 않고 거부합니다.`,
      ],
      applied: 0,
      usedModel: false,
    };
  }
  // 빈 문장도 모델이 읽는다 — 「이 자리를 알아서 채워 달라」는 뜻이다(맵 사실을 보고 고른다).
  const text = rawInputText || EMPTY_SENTENCE;
  const config = deps.getConfig();
  if (!deps.isModelReady(config)) {
    return failed(["바로 깔기는 AI 연결이 필요합니다. 설정에서 모델을 연결한 뒤 다시 시도하세요. 아무것도 깔지 않았습니다."]);
  }
  const target = targetRect(map, input.mapId, input.selection);
  const facts = buildStampPlanFacts(project, { text, mapId: input.mapId, target: target.rect, targetIsSelection: target.isSelection });
  if (!facts) return failed(["맵을 연 뒤 바로 깔 수 있습니다."]);
  const tilesetLabel = project.tilesets[map.tilesetId]?.name ?? "이 칩셋";
  // 적용 전 맵 — 결과 줄이 실제로 바뀐 것을 세는 기준(깊은 복제는 이 맵 하나뿐이라 가볍다).
  const baseline = { ...project, maps: { [input.mapId]: structuredClone(map) } } as Project;

  input.onPhase?.("planning");
  const conversation: ChatMessage[] = [
    { role: "system", content: STAMP_PLANNER_SYSTEM_PROMPT },
    { role: "user", content: buildStampPlannerUserPayload(facts) },
  ];
  // 호출 실패·시간 초과·읽을 수 없는 계획은 한 번만 다시 묻는다. 그래도 안 되면 아무것도 깔지 않는다.
  // 「그림이 없어 거절」은 읽을 수 없는 계획이 아니다 — 다시 물어도 같은 답이므로 재시도하지 않는다.
  let planRaw = "";
  let plan: ParsedStampPlan = { steps: [], dropped: [], refused: [] };
  let lastProblem = "";
  const priorDropped: string[] = [];
  for (let attempt = 0; attempt < 2 && plan.steps.length === 0 && plan.refused.length === 0; attempt++) {
    try {
      planRaw = await callModel(deps, conversation, input.signal);
    } catch (cause) {
      if (cause instanceof StampAborted) return ABORTED;
      lastProblem = `모델 호출 실패: ${reasonOf(cause)}`;
      continue;
    }
    if (input.signal?.aborted) return ABORTED;
    plan = parseStampPlan(planRaw, facts);
    if (plan.guardRejected) {
      return {
        ok: false,
        code: plan.guardRejected.code,
        tier: "QUEST_OR_NARRATIVE_REJECTED",
        handoffPrompt: rawInputText,
        lines: [
          plan.guardRejected.guidance,
          `거부 사유(${plan.guardRejected.code}): 「${plan.guardRejected.matchedCategory}」 요청은 바로 깔기로 처리하지 않습니다.`,
        ],
        applied: 0,
        usedModel: true,
      };
    }
    for (const item of plan.dropped) if (!priorDropped.includes(item)) priorDropped.push(item);
    if (plan.steps.length === 0 && plan.refused.length === 0) {
      lastProblem = plan.error ?? (priorDropped.length ? `버린 단계: ${priorDropped.join(", ")}` : "깔 단계가 없습니다");
    }
  }
  const refusals = plan.refused;
  const refusalLines = refusals.map((refusal) => refusalLine(refusal, tilesetLabel));
  if (plan.steps.length === 0 && refusals.length === 0) {
    return { ok: false, lines: [`모델이 깔 계획을 내지 못해 아무것도 깔지 않았습니다(${lastProblem}).`], applied: 0, usedModel: true };
  }
  if (plan.steps.length === 0) {
    const droppedLine = plan.dropped.length > 0 ? [`버린 단계: ${plan.dropped.join(", ")}`] : [];
    return { ok: false, lines: [...refusalLines, ...droppedLine, "아무것도 깔지 않았습니다."], applied: 0, usedModel: true, refused: refusals.length };
  }

  // 적용 차례를 기다린다 — 그동안 다른 주문·사람이 맵을 바꿨을 수 있다.
  if (input.waitForApply) {
    await input.waitForApply();
    if (input.signal?.aborted) return ABORTED;
  }
  // 새 이벤트가 기존 이벤트·서로와 겹치지 않게 코드가 옮기고, 던전 방·집·물건 칸은 **지금 맵**에서 고른다.
  const liveFacts = refreshFacts(deps, facts);
  const activeFacts = input.waitForApply ? liveFacts : facts;
  const variation = input.variation ?? (Date.now() + (++stampVariationSeq) * 997);
  const turn1RawSteps = plan.steps;
  const expanded = expandPlanSteps(turn1RawSteps, activeFacts, deps.getProject(), landingCheck(deps, input.mapId), variation);
  let combinedSteps: readonly StampStep[] = expanded.steps;
  let combinedDropped: readonly string[] = [...plan.dropped, ...expanded.dropped];
  let llmTurnsUsed: 1 | 2 | 3 | 4 = 1;
  const maxLlmTurns = inferMaxStampLlmTurns(activeFacts.text, input.maxLlmTurns);

  // ── 최대 4턴(maxLlmTurns = 2..4) 다단계 연쇄 시공 루프 ────────────────────────
  // 각 턴 시공 직후의 미리보기 맵(currentDraft)에서 건물·출입구·물·도로·이벤트·스위치·남은 목표를 요약해
  // 복합 요청이거나 직전 턴 계획이 후속 시공(needsFollowUp / remainingGoals)을 요청한 경우 다음 LLM 턴을 수행한다.
  let currentDraft = expanded.previewMap ?? deps.getProject().maps[input.mapId];
  let allRawSteps: StampStep[] = [...turn1RawSteps];
  let lastNeedsFollowUp = plan.needsFollowUp === true;
  let explicitRemainingGoals: readonly string[] = plan.remainingGoals ?? [];
  const turnMessages: ChatMessage[] = [{ role: "assistant", content: planRaw }];
  const stepSig = (s: StampStep): string => {
    const a = (s.args.area ?? s.args.rect ?? s.args.at ?? "") as unknown;
    return `${s.tool}:${JSON.stringify(a)}`;
  };
  const executedStepSigs = new Set<string>(turn1RawSteps.map(stepSig));

  while (llmTurnsUsed < maxLlmTurns && currentDraft) {
    const draftSnap = currentDraft;
    const tilesetSnap = deps.getProject().tilesets[draftSnap.tilesetId];
    const placedStructures = detectPlacedMapObjects(draftSnap, tilesetSnap)
      .filter((o) => o.kind === "structure" || o.kind === "kit")
      .map((o) => ({ id: o.id, name: o.name, x: o.x, y: o.y, w: o.w, h: o.h, kitId: o.kitId }));
    const doorCells = placedStructures.map((s) => {
      const kit = s.kitId ? (tilesetSnap?.structureKits ?? []).find((k) => k.id === s.kitId) : undefined;
      const entrance = kit?.parts?.find((part) => part.kind === "entrance");
      return {
        x: s.x + (entrance ? entrance.dx : Math.floor(s.w / 2)),
        y: Math.min(draftSnap.height - 1, s.y + s.h),
      };
    });
    let waterCells = 0;
    let roadCells = 0;
    for (let y = activeFacts.target.y; y < activeFacts.target.y + activeFacts.target.h; y++) {
      for (let x = activeFacts.target.x; x < activeFacts.target.x + activeFacts.target.w; x++) {
        if (isWaterCell(draftSnap, tilesetSnap, x, y)) waterCells++;
        if (isRoadCell(draftSnap, tilesetSnap, x, y)) roadCells++;
      }
    }
    const eventsCreated = combinedSteps
      .filter((s) => s.tool === "place_npc" || s.tool === "make_villager" || s.tool === "place_chest" || s.tool === "place_savepoint")
      .map((s, idx) => ({
        id: String(s.args.id ?? `turn_ev_${idx}`),
        name: String(s.args.name ?? s.label),
        x: Number(s.args.x ?? (s.args.home as { x?: number } | undefined)?.x ?? activeFacts.target.x),
        y: Number(s.args.y ?? (s.args.home as { y?: number } | undefined)?.y ?? activeFacts.target.y),
      }));
    const switchesWired = [
      ...new Set(
        pendingStructureOps
          .filter((op): op is Extract<PendingStructureOp, { readonly kind: "switch_ensure" }> => op.kind === "switch_ensure")
          .map((op) => op.switchId),
      ),
    ];
    const followUpGoals = extractCompoundFollowUpGoals(activeFacts.text, allRawSteps);
    const usedTools = new Set<string>(allRawSteps.map((s) => s.tool));
    const remainingGoals = [
      ...explicitRemainingGoals.filter((g) => {
        const prefix = g.split(":")[0]?.trim() ?? "";
        return !usedTools.has(prefix);
      }),
      ...followUpGoals.map((g) => `${g.tool}: ${g.label}`),
    ];
    const observation: StampTurnObservation = {
      turnCompleted: llmTurnsUsed,
      placedStructures: placedStructures.map(({ kitId: _k, ...rest }) => rest),
      doorCells,
      waterCells,
      roadCells,
      eventsCreated,
      switchesWired,
      remainingGoals,
    };

    if (!shouldRunStampTurn2(activeFacts, allRawSteps, observation, lastNeedsFollowUp)) {
      break;
    }
    const nextTurn = (llmTurnsUsed + 1) as 2 | 3 | 4;
    const turnFacts: StampPlanFacts = {
      ...activeFacts,
      placedObjects: detectPlacedMapObjects(draftSnap, tilesetSnap),
      isOpenCell: (x, y) => isOpenObjectCell(deps.getProject(), draftSnap, x, y),
      isWallMountCell: (x, y) => isWallMountCell(draftSnap, tilesetSnap, x, y),
      isWaterCell: (x, y) => isWaterCell(draftSnap, tilesetSnap, x, y),
      isRoadCell: (x, y) => isRoadCell(draftSnap, tilesetSnap, x, y),
      isGrassOrSoilCell: (x, y) => isGrassOrSoilCell(draftSnap, tilesetSnap, x, y),
      hasArtAt: (x, y) => hasArtAt(draftSnap, x, y),
      ...(tilesetSnap ? { isWallCell: (x: number, y: number) => isWallCell(draftSnap, tilesetSnap, x, y) } : {}),
    };
    const userPrompt = buildStampTurn2Prompt({
      turn: nextTurn,
      maxTurns: maxLlmTurns,
      facts: turnFacts,
      turn1Steps: allRawSteps,
      priorSteps: allRawSteps,
      observation,
    });
    let nextRaw = "";
    try {
      nextRaw = await callModel(
        deps,
        [
          ...conversation,
          ...turnMessages,
          { role: "user", content: userPrompt },
        ],
        input.signal,
      );
    } catch (cause) {
      if (cause instanceof StampAborted) return ABORTED;
      nextRaw = "";
    }
    llmTurnsUsed = nextTurn;
    let nextCandidateSteps: readonly StampStep[] = [];
    let parsedNext: ParsedStampPlan | null = null;
    if (nextRaw) {
      parsedNext = parseStampPlan(nextRaw, turnFacts);
      nextCandidateSteps = parsedNext.steps.filter((s) => !executedStepSigs.has(stepSig(s)));
    }
    if (nextCandidateSteps.length === 0 && nextTurn === 2) {
      nextCandidateSteps = planStampFollowUpFallback({
        turn: nextTurn,
        maxTurns: maxLlmTurns,
        facts: turnFacts,
        turn1Steps: allRawSteps,
        priorSteps: allRawSteps,
        observation,
      });
    }
    if (nextCandidateSteps.length === 0) {
      break;
    }
    for (const s of nextCandidateSteps) executedStepSigs.add(stepSig(s));
    allRawSteps = [...allRawSteps, ...nextCandidateSteps];
    lastNeedsFollowUp = parsedNext?.needsFollowUp === true;
    explicitRemainingGoals = parsedNext?.remainingGoals ?? [];
    turnMessages.push(
      { role: "user", content: userPrompt },
      { role: "assistant", content: nextRaw || JSON.stringify({ steps: nextCandidateSteps }) },
    );
    const nextExpanded = expandPlanSteps(
      nextCandidateSteps,
      turnFacts,
      deps.getProject(),
      landingCheck(deps, input.mapId),
      variation + nextTurn * 7,
      draftSnap,
    );
    combinedSteps = [...combinedSteps, ...nextExpanded.steps];
    combinedDropped = [...combinedDropped, ...nextExpanded.dropped];
    currentDraft = nextExpanded.previewMap ?? draftSnap;
  }

  plan = { ...plan, steps: combinedSteps, dropped: combinedDropped };
  const lines: string[] = [...refusalLines];
  if (plan.dropped.length > 0) lines.push(`버린 단계: ${plan.dropped.join(", ")}`);
  if (plan.steps.length === 0) return { ok: false, lines, applied: 0, usedModel: true, refused: refusals.length, llmTurnsUsed };
  input.onPhase?.("applying");
  const firstResults = deps.apply(plan.steps.map(toCall));
  const first = stepLines(plan.steps, firstResults, "");
  lines.push(...first.lines);
  let applied = first.applied;
  const failures = first.failures;
  const finish = (ok: boolean, extra: readonly string[], usedRepair: boolean): StampRunResult => {
    const effect = measureStampEffect(baseline, deps.getProject(), input.mapId);
    const visualApplied = plan.steps.some((step, index) => VISUAL_TOOLS[step.tool] === true && firstResults[index]?.ok);
    const lying = visualApplied && !hasVisibleChange(effect);
    const all = [...lines, ...extra];
    const effectLine = describeStampEffect(effect) + (llmTurnsUsed > 1 ? ` · LLM ${llmTurnsUsed}턴 연쇄 시공` : "");
    all.push(effectLine);
    if (lying) all.push("※ 도구는 성공이라 했지만 맵에 눈에 보이게 바뀐 것이 없습니다 — 이 요청은 깔리지 않은 것으로 봅니다.");
    return { ok: ok && !lying && refusals.length === 0, lines: all, applied, usedModel: true, refused: refusals.length, effect, llmTurnsUsed, ...(usedRepair ? {} : {}) };
  };
  if (failures.length === 0) return finish(applied > 0, [], false);

  // 수리 라운드 — 실패한 단계와 도구 오류(가까운 라벨 제안 포함)를 한 번만 되묻는다.
  // 물건(place_object 에서 펼친 단계)·집·던전 방은 모델에게 되묻지 않는다.
  const codePlaced = (step: StampStep): boolean => Boolean(step.group) || step.tool === "place_terrain_house" || step.tool === "build_jp_city_building" || step.tool === "stamp_object";
  const repairable = failures.filter((failure) => !codePlaced(failure.step));
  const objectFailures = failures.filter((failure) => codePlaced(failure.step));
  for (const failure of objectFailures) lines.push(`${failure.step.label} 놓지 못함: ${failure.error}`);
  if (repairable.length === 0) return finish(applied > 0, [], false);
  input.onPhase?.("repairing");
  let repaired: readonly StampStep[] = [];
  let repairError: string | null = null;
  try {
    const repairRaw = await callModel(deps, [
      ...conversation,
      { role: "assistant", content: planRaw },
      { role: "user", content: buildStampRepairPrompt(repairable) },
    ], input.signal);
    // 수리 결과도 적용 차례를 기다린 뒤의 맵으로 겹침을 푼다.
    if (input.waitForApply) {
      await input.waitForApply();
      if (input.signal?.aborted) throw new StampAborted();
    }
    const repairFacts = { ...refreshFacts(deps, facts), repairRound: true };
    const parsed = parseStampPlan(repairRaw, repairFacts);
    const repairedExpanded = expandPlanSteps(parsed.steps, repairFacts, deps.getProject(), landingCheck(deps, input.mapId), variation + 1);
    repaired = repairedExpanded.steps;
    const droppedAgain = [...parsed.dropped, ...repairedExpanded.dropped];
    if (droppedAgain.length > 0) lines.push(`버린 단계: ${droppedAgain.join(", ")}`);
    for (const refusal of parsed.refused) lines.push(refusalLine(refusal, tilesetLabel));
    if (parsed.error) repairError = parsed.error;
  } catch (cause) {
    if (cause instanceof StampAborted) {
      for (const failure of repairable) lines.push(`${failure.step.label} 실패: ${failure.error}`);
      lines.push("수리를 중단했습니다.");
      return finish(false, [], true);
    }
    repairError = reasonOf(cause);
  }
  for (const failure of repairable) lines.push(`${failure.step.label} 실패: ${failure.error}`);
  if (repaired.length === 0) {
    lines.push(`고쳐 깔 단계를 받지 못했습니다${repairError ? `(${repairError})` : ""}.`);
    return finish(false, [], true);
  }
  if (input.signal?.aborted) return finish(false, ["수리를 중단했습니다."], true);
  input.onPhase?.("applying");
  const repairResults = deps.apply(repaired.map(toCall));
  const second = stepLines(repaired, repairResults, "고쳐서 ");
  lines.push(...second.lines);
  for (const failure of second.failures) lines.push(`고쳐도 ${failure.step.label} 실패: ${failure.error}`);
  applied += second.applied;
  return finish(applied > 0 && second.applied > 0 && second.failures.length === 0 && objectFailures.length === 0, [], true);
}

/** 이벤트가 설 수 있는 칸인가 — 런타임과 같은 통행 권위(isPassableLanding). */
function landingCheck(deps: StampRunDeps, mapId: string): (x: number, y: number) => boolean {
  const project = deps.getProject();
  const map = project.maps[mapId];
  return (x, y) => Boolean(map) && isPassableLanding(project, map!, x, y);
}

/** 첫 라운드가 적용된 뒤의 맵 사실 — 수리 단계가 방금 깔린 이벤트와도 겹치지 않게. */
function refreshFacts(deps: StampRunDeps, facts: StampPlanFacts): StampPlanFacts {
  const project = deps.getProject();
  const placement = buildMapPlacementContext(project, facts.mapId);
  const map = project.maps[facts.mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  // 물건 칸 검사는 항상 지금 맵을 읽는다(먼저 끝난 주문·사람이 바꿨을 수 있다).
  const probes = map
    ? {
        isOpenCell: (x: number, y: number) => isOpenObjectCell(project, map, x, y),
        isWallMountCell: (x: number, y: number) => isWallMountCell(map, tileset, x, y),
        isWaterCell: (x: number, y: number) => isWaterCell(map, tileset, x, y),
        isRoadCell: (x: number, y: number) => isRoadCell(map, tileset, x, y),
        hasArtAt: (x: number, y: number) => hasArtAt(map, x, y),
        ...(tileset ? { isWallCell: (x: number, y: number) => isWallCell(map, tileset, x, y) } : {}),
      }
    : {};
  return { ...facts, ...(placement ? { placement } : {}), ...probes };
}

/** 장면 구성 계획이면 구성기 호출로 바꾸고(좌표 펼치기 없음), 아니면 칸 단위 펼치기를 돌린다. */
function expandPlanSteps(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
  project: Project,
  fallbackLanding: (x: number, y: number) => boolean,
  variation: number,
  existingPreviewMap?: GameMap,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[]; readonly previewMap?: GameMap } {
  // 장면 구성 단계는 맨 앞이 아니어도 찾는다(앞에 지형 칠하기 등이 붙는 계획).
  const scene = steps.find((step) => step.tool === "compose_scene");
  if (!scene) return settleAndExpandSteps(steps, facts, project, fallbackLanding, variation, existingPreviewMap);
  const composed = expandSceneStep(scene, project, variation);
  return { steps: [...composed.steps, ...steps.filter((step) => step !== scene)], dropped: composed.dropped };
}

/**
 * 던전 방·지형 칠하기를 미리보기 맵에 먼저 반영한 뒤, 이벤트 겹침 해결 → 집 펼치기 → 물건 펼치기를 순서대로 돌린다.
 * 같은 주문 안에서 방을 파거나 강·도로를 칠한 뒤 상자·함정·다리·횡단보도·벽 횃불을 놓을 때 방금 바뀐 지형을 바로 읽는다.
 */
function settleAndExpandSteps(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
  project: Project,
  fallbackLanding: (x: number, y: number) => boolean,
  variation = 0,
  existingPreviewMap?: GameMap,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[]; readonly previewMap?: GameMap } {
  const map = project.maps[facts.mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) {
    const settled = resolveStampOverlaps(steps, facts, fallbackLanding);
    const houses = expandStampHouses(settled.steps, project, facts, undefined, variation);
    const isOpen = facts.isOpenCell;
    const objectFacts: StampPlanFacts = houses.cells.size === 0
      ? facts
      : { ...facts, isOpenCell: (x, y) => !houses.cells.has(`${x},${y}`) && (isOpen ? isOpen(x, y) : true) };
    const objects = expandStampObjects(houses.steps, objectFacts);
    return { steps: objects.steps, dropped: [...settled.dropped, ...houses.dropped, ...objects.dropped] };
  }
  const previewMap = existingPreviewMap ?? copiedTerrainMap(map);
  if (!existingPreviewMap) {
    previewMap.structurePlacements = [...(map.structurePlacements ?? [])];
  }
  const eraseMove = expandEraseAndMoveSteps(steps, previewMap, tileset, facts);
  const special = expandSpecialSpatialSteps(eraseMove.steps, previewMap, tileset, facts, variation, project);
  const dungeon = expandDungeonRooms(special.steps, previewMap, tileset, facts);
  const urbanFilled = expandUrbanFillAndCrosswalkSteps(dungeon.steps, previewMap, tileset, facts);
  previewFillRegions(urbanFilled, previewMap, tileset);
  const roads = expandTownRoads(urbanFilled, previewMap, tileset, facts);
  const previewFacts: StampPlanFacts = {
    ...facts,
    isOpenCell: (x, y) => isOpenObjectCell(project, previewMap, x, y),
    isWallMountCell: (x, y) => isWallMountCell(previewMap, tileset, x, y),
    isWaterCell: (x, y) => isWaterCell(previewMap, tileset, x, y),
    isRoadCell: (x, y) => isRoadCell(previewMap, tileset, x, y),
    isGrassOrSoilCell: (x, y) => isGrassOrSoilCell(previewMap, tileset, x, y),
    hasArtAt: (x, y) => hasArtAt(previewMap, x, y),
    isWallCell: (x, y) => isWallCell(previewMap, tileset, x, y),
  };
  const landing = (x: number, y: number): boolean => isPassableLanding(project, previewMap, x, y);
  const settled = resolveStampOverlaps(roads, previewFacts, landing);
  const houses = expandStampHouses(settled.steps, project, previewFacts, previewMap, variation);
  const housesWithRoads = connectHouseDoorsToTownRoad(houses.steps, previewMap, tileset, facts);
  const isOpen = previewFacts.isOpenCell;
  const objectFacts: StampPlanFacts = houses.cells.size === 0
    ? previewFacts
    : { ...previewFacts, isOpenCell: (x, y) => !houses.cells.has(`${x},${y}`) && (isOpen ? isOpen(x, y) : true) };
  const objects = expandStampObjects(housesWithRoads, objectFacts);
  const polished = postProcessUrbanObjectSteps(objects.steps, previewMap, tileset, facts);
  return {
    steps: polished,
    dropped: [...eraseMove.dropped, ...special.dropped, ...dungeon.dropped, ...settled.dropped, ...houses.dropped, ...objects.dropped],
    previewMap,
  };
}

function previewFillRegions(steps: readonly StampStep[], previewMap: GameMap, tileset: TilesetDef): void {
  for (const step of steps) {
    if (step.tool === "paint_tiles") {
      const layer = step.args.layer === "upper" ? "upperTiles" : "lowerTiles";
      const tile = typeof step.args.tile === "number" ? step.args.tile : -1;
      const cells = Array.isArray(step.args.cells) ? (step.args.cells as { x: number; y: number }[]) : [];
      if (tile >= 0) {
        for (const c of cells) {
          if (c.x >= 0 && c.y >= 0 && c.x < previewMap.width && c.y < previewMap.height) {
            previewMap[layer][c.y * previewMap.width + c.x] = tile;
          }
        }
      }
      continue;
    }
    if (step.tool !== "fill_region") continue;
    const rect = step.args.rect as StampRect | undefined;
    const material = typeof step.args.material === "string" ? step.args.material : "";
    if (!rect || !material) continue;
    const resolved = resolveMaterialByLabel(tileset, material, {
      preferGroup: true,
      preferRoles: ["water", "terrain"],
      requireAutotileGroup: true,
    });
    if (resolved.status === "missing" || resolved.kind !== "group") continue;
    const repTile = resolved.group.tileIds[0];
    if (repTile === undefined) continue;
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (x < 0 || y < 0 || x >= previewMap.width || y >= previewMap.height) continue;
        previewMap.lowerTiles[y * previewMap.width + x] = repTile;
      }
    }
  }
}

/**
 * 현대 도시(modern_city)·일본 도시(jp_city)에서 도로·보도·횡단보도·공원 잔디를 실제 도시 단면에 맞게 보정한다.
 */
function expandUrbanFillAndCrosswalkSteps(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): readonly StampStep[] {
  if (tileset.id !== "modern_city" && tileset.id !== "jp_city") return steps;
  const out: StampStep[] = [];
  const W = previewMap.width;
  const H = previewMap.height;
  for (const step of steps) {
    // 횡단보도(place_object 또는 fill_region)는 expandStampObjects 전에 도로 전 폭(4줄) 2칸 폭 줄무늬로 즉시 변환한다.
    const isCrosswalkStep =
      (step.tool === "place_object" && /횡단보도|crosswalk/iu.test(`${String(step.args.entryId ?? "")} ${String(step.args.name ?? "")} ${step.label}`))
      || (step.tool === "fill_region" && /횡단보도|crosswalk/iu.test(`${String(step.args.material ?? "")} ${step.label}`));
    if (isCrosswalkStep) {
      const rect = (step.args.area ?? step.args.rect) as StampRect | undefined;
      const cx = rect ? rect.x + Math.floor((rect.w - 2) / 2) : Math.floor(W / 2) - 1;
      const roadMinY = 13;
      const roadMaxY = 16;
      const cwCells: { x: number; y: number }[] = [];
      for (let y = roadMinY; y <= roadMaxY; y++) {
        cwCells.push({ x: cx, y }, { x: cx + 1, y });
      }
      if (tileset.id === "modern_city") {
        for (const c of cwCells) previewMap.lowerTiles[c.y * W + c.x] = 5;
        out.push({
          tool: "paint_tiles",
          label: step.label,
          group: step.label,
          at: [{ x: cx, y: roadMinY }],
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 5, cells: cwCells },
        });
      } else {
        const dashCells: { x: number; y: number }[] = [];
        for (let x = 0; x < W; x++) {
          if (x >= cx - 1 && x <= cx + 2) continue;
          if (x % 2 === 0) dashCells.push({ x, y: roadMinY + 1 });
        }
        if (dashCells.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: "차도 중앙 점선",
            group: step.label,
            args: { mapId: facts.mapId, layer: "upper", mode: "cells", tile: 3643, cells: dashCells },
          });
        }
        for (const c of cwCells) previewMap.upperTiles[c.y * W + c.x] = 3646;
        out.push({
          tool: "paint_tiles",
          label: step.label,
          group: step.label,
          at: [{ x: cx, y: roadMinY }],
          args: { mapId: facts.mapId, layer: "upper", mode: "cells", tile: 3646, cells: cwCells },
        });
      }
      continue;
    }
    if (tileset.id === "modern_city" && step.tool === "fill_region") {
      const rect = step.args.rect as StampRect | undefined;
      const mat = typeof step.args.material === "string" ? step.args.material : "";
      out.push(step);
      // 남쪽 공원(y>=19)을 채울 때 분수·벤치가 놓일 중앙 광장(x=13..25, y=21..27)과 보도 연결 진입로(x=19..20, y=19..20)를 벽돌/보도 포석(타일 8)으로 함께 조성한다.
      if (rect && /녹지|공원|잔디/u.test(mat) && rect.y >= 19) {
        const plazaCells: { x: number; y: number }[] = [];
        for (let y = 19; y <= 20; y++) {
          plazaCells.push({ x: 19, y }, { x: 20, y });
          previewMap.lowerTiles[y * W + 19] = 8;
          previewMap.lowerTiles[y * W + 20] = 8;
        }
        for (let y = 21; y <= 27; y++) {
          for (let x = 13; x <= 25; x++) {
            plazaCells.push({ x, y });
            previewMap.lowerTiles[y * W + x] = 8;
          }
        }
        out.push({
          tool: "paint_tiles",
          label: "공원 중앙 광장 및 진입로",
          group: step.label,
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 8, cells: plazaCells },
        });
      }
      continue;
    }
    if (tileset.id === "jp_city" && step.tool === "fill_region") {
      const rect = step.args.rect as StampRect | undefined;
      const mat = typeof step.args.material === "string" ? step.args.material : "";
      if (rect && /^잔디$/u.test(mat) && rect.y >= 17) {
        const fullParkRect: StampRect = { x: 0, y: 18, w: W, h: H - 18 };
        out.push({ ...step, args: { ...step.args, rect: fullParkRect } });
        continue;
      }
      out.push(step);
      if (rect && /판석\s*광장|보도·점자블록/u.test(mat) && rect.y >= 19) {
        const cx = rect.x + Math.floor((rect.w - 2) / 2);
        const entryCells: { x: number; y: number }[] = [];
        for (let y = 18; y <= rect.y; y++) {
          entryCells.push({ x: cx, y }, { x: cx + 1, y });
        }
        out.push({
          tool: "paint_tiles",
          label: "공원 광장 진입로",
          group: step.label,
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 3333, cells: entryCells },
        });
      }
      continue;
    }
    out.push(step);
  }
  return out;
}

/**
 * 현대 도시(modern_city)·일본 도시(jp_city)의 도로 연석, 중앙선, 공원 가로수 화단 테두리를 마무리한다.
 */
function postProcessUrbanObjectSteps(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): readonly StampStep[] {
  if (tileset.id !== "modern_city" && tileset.id !== "jp_city") return steps;
  const W = previewMap.width;
  const H = previewMap.height;
  const out: StampStep[] = [];

  for (const step of steps) {
    if (step.tool === "stamp_tileset_object") {
      const objectId = String(step.args.objectId ?? "");
      const base = step.args.base as { x: number; y: number } | undefined;
      // jp_city: 공원 잔디 위에 찍힌 가로수(jp-prop-tree-*)의 회색 콘크리트 화단 연석(맨 아랫줄)을 풀밭에 맞게 지운다.
      if (tileset.id === "jp_city" && objectId.startsWith("jp-prop-tree-") && base) {
        const lower = previewMap.lowerTiles[base.y * W + base.x] ?? -1;
        const meta = tileset.tileMeta?.[lower];
        if (/잔디|녹지|풀밭/u.test(meta?.label ?? "")) {
          out.push(step);
          out.push({
            tool: "tile_erase",
            label: "",
            group: step.group,
            args: { mapId: facts.mapId, rect: { x: base.x, y: base.y, w: 4, h: 1 }, layer: "upper" },
          });
          continue;
        }
      }
    }
    out.push(step);
  }

  // modern_city: fill_region 이나 건물 배치가 끝난 뒤 도로 연석(y=12, y=17), 중앙선(y=14, y=15), 보도 포석(타일 7)을 정돈한다.
  if (tileset.id === "modern_city" && steps.some((s) => s.tool === "fill_region" || s.tool === "place_terrain_house")) {
    let roadMinY = H, roadMaxY = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = previewMap.lowerTiles[y * W + x] ?? -1;
        if ((t >= 1 && t <= 6) || t === 77 || t === 78) {
          if (y < roadMinY) roadMinY = y;
          if (y > roadMaxY) roadMaxY = y;
        }
      }
    }
    if (roadMinY <= roadMaxY) {
      const sidewalkCells: { x: number; y: number }[] = [];
      const northCurbCells: { x: number; y: number }[] = [];
      const southCurbCells: { x: number; y: number }[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const t = previewMap.lowerTiles[y * W + x] ?? -1;
          if (y === roadMinY - 1) {
            northCurbCells.push({ x, y });
          } else if (y === roadMaxY + 1) {
            southCurbCells.push({ x, y });
          } else if (y === roadMinY - 2 || y === roadMaxY + 2 || (t >= 7 && t <= 16)) {
            sidewalkCells.push({ x, y });
          }
        }
      }
      // 타일 8(보도 포석)은 mc-sidewalk-curb 의 connectTileIds 에만 속하고 memberTileIds 에는 속하지 않아 잔디 경계에서 도로 연석(9~16)으로 변하지 않는다!
      if (sidewalkCells.length > 0) {
        out.push({
          tool: "paint_tiles",
          label: "보도 포석 정돈",
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 8, cells: sidewalkCells },
        });
        for (const c of sidewalkCells) previewMap.lowerTiles[c.y * W + c.x] = 8;
      }
      if (northCurbCells.length > 0) {
        out.push({
          tool: "paint_tiles",
          label: "북쪽 보도 연석",
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 9, cells: northCurbCells },
        });
        for (const c of northCurbCells) previewMap.lowerTiles[c.y * W + c.x] = 9;
      }
      if (southCurbCells.length > 0) {
        out.push({
          tool: "paint_tiles",
          label: "남쪽 보도 연석",
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 10, cells: southCurbCells },
        });
        for (const c of southCurbCells) previewMap.lowerTiles[c.y * W + c.x] = 10;
      }
      if (roadMaxY - roadMinY + 1 >= 4) {
        const centerTop: { x: number; y: number }[] = [];
        const centerBot: { x: number; y: number }[] = [];
        for (let x = 0; x < W; x++) {
          if ((previewMap.lowerTiles[(roadMinY + 1) * W + x] ?? -1) !== 5) centerTop.push({ x, y: roadMinY + 1 });
          if ((previewMap.lowerTiles[(roadMinY + 2) * W + x] ?? -1) !== 5) centerBot.push({ x, y: roadMinY + 2 });
        }
        if (centerTop.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: "차도 중앙선(상)",
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 77, cells: centerTop },
          });
        }
        if (centerBot.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: "차도 중앙선(하)",
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 78, cells: centerBot },
          });
        }
      }
    }
  }
  return out;
}

/**
 * 버들항 마을(`beodeul_city`)에서 `paint_road` 를 `beodeul_road_autotile`(버들항 길 포석) 2칸 폭 직각 L자 도로로 펼친다.
 * - 기존 `paint_road` 도구는 `forest_harmony` 타일 번호(360~405)가 하드코딩되어 있어 버들항에서는 절벽·물·검은 구멍이 찍혔다.
 * - 이미 놓인 집들의 문 앞(`doorX, doorY + 1`)에서도 중심 도로·광장으로 2칸 폭 직각 가지 길을 자동으로 잇는다.
 */
function expandTownRoads(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): readonly StampStep[] {
  const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
  if (!roadGroup || !steps.some((step) => step.tool === "paint_road")) return steps;

  const W = previewMap.width;
  const H = previewMap.height;
  const idx = (x: number, y: number): number => y * W + x;
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;

  const plazaGroup = (tileset.tileGroups ?? []).find((g) => g.id === "beodeul:plaza");
  const plazaTiles = new Set<number>(plazaGroup?.tileIds ?? []);
  const roadTileSet = new Set<number>(roadGroup.memberTileIds);

  const isProtectedSurface = (x: number, y: number): boolean => {
    if (!inb(x, y)) return true;
    const l = previewMap.lowerTiles[idx(x, y)] ?? -1;
    const u = previewMap.upperTiles[idx(x, y)] ?? -1;
    if (plazaTiles.has(l)) return true;
    const lMeta = tileset.tileMeta?.[l];
    const uMeta = tileset.tileMeta?.[u];
    if (isWaterRole(lMeta?.role) || isWaterRole(uMeta?.role)) return true;
    if (/물|강|다리|호수|바다|연못/u.test(`${lMeta?.label ?? ""} ${uMeta?.label ?? ""}`)) return true;
    for (const p of previewMap.structurePlacements ?? []) {
      if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return true;
    }
    return false;
  };

  const isBridgeOrPlaza = (x: number, y: number): boolean => {
    if (!inb(x, y)) return false;
    const l = previewMap.lowerTiles[idx(x, y)] ?? -1;
    const u = previewMap.upperTiles[idx(x, y)] ?? -1;
    if (plazaTiles.has(l)) return true;
    const lMeta = tileset.tileMeta?.[l];
    const uMeta = tileset.tileMeta?.[u];
    return /다리|광장|bridge/iu.test(`${lMeta?.label ?? ""} ${uMeta?.label ?? ""}`);
  };

  const houseDoors: { x: number; y: number }[] = [];
  for (const p of previewMap.structurePlacements ?? []) {
    const kit = (tileset.structureKits ?? []).find((k) => k.id === p.kitId);
    const door = kit?.parts?.find((part) => part.kind === "entrance");
    if (door) {
      houseDoors.push({ x: p.x + door.dx, y: p.y + door.dy + door.h - 1 });
    } else if (/house|inn|shop|manor|log/iu.test(p.kitId)) {
      houseDoors.push({ x: p.x + Math.floor(p.w / 2), y: p.y + p.h - 1 });
    }
  }
  const doorSet = new Set<string>();
  for (const d of houseDoors) {
    doorSet.add(`${d.x},${d.y}`);
    doorSet.add(`${d.x + 1},${d.y}`);
  }

  const out: StampStep[] = [];
  for (const step of steps) {
    if (step.tool !== "paint_road") {
      out.push(step);
      continue;
    }
    const rawPoints = Array.isArray(step.args.points) ? (step.args.points as { x: number; y: number }[]) : [];
    if (rawPoints.length < 2) continue;

    const roadMask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (roadTileSet.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) roadMask[idx(x, y)] = 1;
      }
    }

    const markRoad = (x: number, y: number): void => {
      if (!inb(x, y) || isProtectedSurface(x, y)) return;
      roadMask[idx(x, y)] = 1;
    };
    const carveH = (x0: number, x1: number, y: number): void => {
      const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
      for (let x = minX; x <= maxX; x++) {
        markRoad(x, y);
        markRoad(x, y + 1);
      }
    };
    const carveV = (x: number, y0: number, y1: number): void => {
      const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
      for (let y = minY; y <= maxY; y++) {
        markRoad(x, y);
        markRoad(x + 1, y);
      }
    };

    // 주 수평 도로 높이(mainY)를 찾는다.
    let mainY = rawPoints[0]!.y;
    for (let i = 0; i + 1 < rawPoints.length; i++) {
      const a = rawPoints[i]!;
      const b = rawPoints[i + 1]!;
      if (a.y === b.y) mainY = a.y;
    }

    for (let i = 0; i + 1 < rawPoints.length; i++) {
      const a = rawPoints[i]!;
      const b = rawPoints[i + 1]!;
      if (a.x === b.x) {
        let minY = Math.min(a.y, b.y);
        let maxY = Math.max(a.y, b.y);
        if (minY > 0 && isBridgeOrPlaza(a.x, minY - 1)) minY -= 1;
        if (maxY + 1 < H && isBridgeOrPlaza(a.x, maxY + 1)) maxY += 1;
        carveV(a.x, minY, maxY);
      } else if (a.y === b.y) {
        carveH(a.x, b.x, a.y);
      } else if (a.y < b.y) {
        // 북쪽 집 앞 -> 남쪽 중심 도로(b.y)로 먼저 수직 하강 후 수평 이동(직각 L자)
        carveV(a.x, a.y, b.y + 1);
        carveH(a.x, b.x, b.y);
      } else {
        // 중심 도로(a.y) -> 동/서로 먼저 수평 이동 후 북쪽 집(b.x, b.y)으로 수직 상승(직각 L자)
        carveH(a.x, b.x + 1, a.y);
        carveV(b.x, b.y, a.y + 1);
      }
    }

    // 수평 간선도로인 경우, 북쪽에 놓인 모든 집의 문 앞(door.x, door.y + 1)에서 간선도로(mainY)까지 2칸 폭 직각 가지 길을 잇는다.
    const isHorizontalSpine = rawPoints.some((p, i) => i > 0 && p.y === rawPoints[i - 1]!.y) || rawPoints.length >= 3;
    if (isHorizontalSpine) {
      let minRoadX = W, maxRoadX = 0;
      for (let x = 0; x < W; x++) {
        if (roadMask[idx(x, mainY)] || plazaTiles.has(previewMap.lowerTiles[idx(x, mainY)] ?? -1)) {
          if (x < minRoadX) minRoadX = x;
          if (x > maxRoadX) maxRoadX = x;
        }
      }
      for (const door of houseDoors) {
        if (door.y + 1 <= mainY + 1) {
          carveV(door.x, door.y + 1, mainY + 1);
          if (door.x < minRoadX) carveH(door.x, minRoadX, mainY);
          else if (door.x > maxRoadX) carveH(maxRoadX, door.x + 1, mainY);
        }
      }
    }

    const stepsBuilt = applyBeodeulRoadAutotile(roadMask, previewMap, roadGroup, isBridgeOrPlaza, doorSet, facts.mapId, step.label, step.note);
    out.push(...stepsBuilt);
  }
  return out;
}

function applyBeodeulRoadAutotile(
  roadMask: Uint8Array,
  previewMap: GameMap,
  roadGroup: NonNullable<TilesetDef["autotileGroups"]>[number],
  isBridgeOrPlaza: (x: number, y: number) => boolean,
  doorSet: ReadonlySet<string>,
  mapId: string,
  label: string,
  note?: string,
): StampStep[] {
  const W = previewMap.width;
  const H = previewMap.height;
  const idx = (x: number, y: number): number => y * W + x;
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const connected = (x: number, y: number): boolean => {
    if (!inb(x, y)) return false;
    return roadMask[idx(x, y)] === 1 || isBridgeOrPlaza(x, y) || doorSet.has(`${x},${y}`);
  };
  const byTile = new Map<number, { x: number; y: number }[]>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!roadMask[idx(x, y)]) continue;
      let mask = 0;
      if (connected(x, y - 1)) mask |= 1;
      if (connected(x + 1, y)) mask |= 2;
      if (connected(x, y + 1)) mask |= 4;
      if (connected(x - 1, y)) mask |= 8;
      const tile = roadGroup.variantMap[String(mask)] ?? roadGroup.memberTileIds[0]!;
      if (previewMap.lowerTiles[idx(x, y)] === tile) continue;
      previewMap.lowerTiles[idx(x, y)] = tile;
      const list = byTile.get(tile) ?? [];
      list.push({ x, y });
      byTile.set(tile, list);
    }
  }
  const out: StampStep[] = [];
  let first = true;
  for (const [tile, cells] of byTile) {
    out.push({
      tool: "paint_tiles",
      label: first ? label : "",
      ...(first && note ? { note } : {}),
      group: label,
      args: { mapId, layer: "lower", mode: "cells", tile, cells },
    });
    first = false;
  }
  return out;
}

/**
 * 집이 새로 놓였을 때, 이미 맵에 버들항 포석 도로나 광장이 가까이에 있으면 문 앞을 직각 2칸 폭 길로 잇는다.
 */
function connectHouseDoorsToTownRoad(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): readonly StampStep[] {
  const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
  if (!roadGroup || !steps.some((s) => s.tool === "place_terrain_house")) return steps;
  const W = previewMap.width;
  const H = previewMap.height;
  const roadTileSet = new Set<number>(roadGroup.memberTileIds);
  let bestRoadY = -1;
  let bestRowCount = 0;
  let minRoadX = W;
  let maxRoadX = 0;
  for (let y = 0; y < H; y++) {
    let count = 0;
    for (let x = 0; x < W; x++) {
      if (roadTileSet.has(previewMap.lowerTiles[y * W + x] ?? -1)) {
        count += 1;
        if (x < minRoadX) minRoadX = x;
        if (x > maxRoadX) maxRoadX = x;
      }
    }
    if (count > bestRowCount) {
      bestRowCount = count;
      bestRoadY = y;
    }
  }
  if (bestRoadY < 0) return steps;
  return expandTownRoads(
    [
      ...steps,
      {
        tool: "paint_road",
        label: "집 앞 가지 길 연결",
        args: { mapId: facts.mapId, points: [{ x: minRoadX, y: bestRoadY }, { x: Math.max(minRoadX + 1, maxRoadX), y: bestRoadY }] },
      },
    ],
    previewMap,
    tileset,
    facts,
  );
}

/**
 * `place_dungeon_room` 단계를 `paint_tiles` 호출들로 펼치고 `previewMap` 에 바로 반영한다.
 * - 방(`kind: "room"`): 북쪽 2줄 돌벽(`face-cata-2h`), 나머지 칸 돌바닥(`floor-cata`), `hazard: "lava"|"water"` 면 가운데 2줄 수로 + 돌다리.
 * - 연결(`kind: "connect"|"corridor"`): 이미 파인 방들 사이를 복도로 잇되, 모든 바닥 마스크(`floorMask`)를 먼저 합집합으로 확정한 뒤
 *   전체 바닥의 북쪽 경계에만 2줄 돌벽(`wallB`)과 47변형 천장 테두리를 재계산하여 방 한가운데 벽 조각이 남지 않게 한다.
 */
function expandDungeonRooms(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  if (!steps.some((step) => step.tool === "place_dungeon_room")) return { steps, dropped: [] };
  const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
  const faceKit = kits.get("bd-pick-aqueduct-sewer-face-cata-2h") ?? kits.get("bd-pick-castle-catacombs-face-castle-2h");
  const floorKit = kits.get("bd-pick-aqueduct-sewer-floor-cata") ?? kits.get("bd-pick-castle-catacombs-floor-castle");
  const lavaKit = kits.get("bd-pick-volcano-cave-lava-strip");
  const volcanoBridgeKit = kits.get("bd-pick-volcano-cave-bridge");
  const bridgeNsKit = kits.get("bd-pick-aqueduct-sewer-bridge-ns-stone");
  const ceilingKit = kits.get("bd-pick-aqueduct-sewer-ceiling");
  const stairsUpKit = kits.get("bd-pick-aqueduct-sewer-stairs-up-face");
  const stairsDownKit = kits.get("bd-pick-temple-ruins-stairs-down");
  const ceilingGroup = (tileset.autotileGroups ?? []).find((group) => group.id === "beodeul_dungeon_ceiling");
  if (!faceKit || !floorKit) {
    return {
      steps: steps.filter((step) => step.tool !== "place_dungeon_room"),
      dropped: ["던전 방: 이 타일셋에는 던전 벽·바닥 키트가 없습니다"],
    };
  }
  const W = previewMap.width;
  const H = previewMap.height;
  const idx = (x: number, y: number): number => y * W + x;
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const kitTile = (kit: typeof floorKit, x: number, y: number): number => {
    const row = kit.rows[y % kit.rows.length]!;
    return row.tiles[x % row.tiles.length]!;
  };
  const voidTile = ceilingKit?.rows[1]?.tiles[1] ?? 28416;
  const stoneFloorTiles = new Set<number>();
  for (const kit of [floorKit, bridgeNsKit, volcanoBridgeKit, stairsDownKit]) {
    for (const row of kit?.rows ?? []) for (const t of row.tiles) if (t >= 0) stoneFloorTiles.add(t);
  }
  const dungeonFloorTiles = new Set<number>(stoneFloorTiles);
  for (const row of lavaKit?.rows ?? []) for (const t of row.tiles) if (t >= 0) dungeonFloorTiles.add(t);
  const stairsUpTiles = new Set<number>();
  for (const row of stairsUpKit?.rows ?? []) for (const t of row.tiles) if (t >= 0) stairsUpTiles.add(t);
  const dungeonWallTiles = new Set<number>(stairsUpTiles);
  for (const row of faceKit.rows) for (const t of row.tiles) if (t >= 0) dungeonWallTiles.add(t);

  const floorMask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = previewMap.lowerTiles[idx(x, y)] ?? -1;
      if (dungeonFloorTiles.has(t)) floorMask[idx(x, y)] = 1;
    }
  }

  const wantsChokePointDoor = steps.some(
    (s) => s.tool === "place_object" && /arch-bars|arch-dark|철창|아치|문/iu.test(`${String(s.args.objectId ?? "")} ${String(s.args.name ?? "")}`),
  );

  const out: StampStep[] = [];
  const dropped: string[] = [];
  for (const step of steps) {
    if (step.tool !== "place_dungeon_room") {
      out.push(step);
      continue;
    }
    const beforeLower = [...previewMap.lowerTiles];
    const beforeUpper = [...previewMap.upperTiles];
    const area = step.args.area as StampRect;
    const kind = step.args.kind === "corridor" || step.args.kind === "connect" ? step.args.kind : "room";
    const hazard = step.args.hazard === "lava" || step.args.hazard === "water" ? step.args.hazard : "none";

    if (kind === "room") {
      const wallRows = Math.min(2, Math.max(1, area.h - 2));
      for (let y = area.y + wallRows; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y)) continue;
          floorMask[idx(x, y)] = 1;
          previewMap.lowerTiles[idx(x, y)] = kitTile(floorKit, x, y);
        }
      }
      if (hazard !== "none" && area.h >= 7 && lavaKit) {
        const ly = area.y + wallRows + Math.floor((area.h - wallRows - 2) / 2);
        const bx = area.x + Math.floor((area.w - 3) / 2);
        const bridgeRow0 = volcanoBridgeKit?.rows[2]?.tiles ?? [27236, 27237, 27238];
        const bridgeRow1 = volcanoBridgeKit?.rows[3]?.tiles ?? [27239, 27240, 27241];
        for (let dy = 0; dy < 2; dy++) {
          const bRow = dy === 0 ? bridgeRow0 : bridgeRow1;
          for (let x = area.x; x < area.x + area.w; x++) {
            const y = ly + dy;
            if (!inb(x, y)) continue;
            if (x >= bx && x < bx + 3) {
              previewMap.lowerTiles[idx(x, y)] = bRow[x - bx] ?? kitTile(floorKit, x, y);
            } else {
              previewMap.lowerTiles[idx(x, y)] = kitTile(lavaKit, x, y);
            }
          }
        }
      }
    } else {
      // 기존 방 컴포넌트들을 찾아 수평 이웃은 2칸 폭 복도로, 수직 이웃은 남쪽 방의 북벽 2줄(철창 문 초크포인트) 바로 위까지 2칸 폭 복도로 잇는다.
      const seen = new Uint8Array(W * H);
      const rooms: { cx: number; cy: number; minX: number; maxX: number; minY: number; maxY: number }[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!floorMask[idx(x, y)] || seen[idx(x, y)]) continue;
          const q: [number, number][] = [[x, y]];
          seen[idx(x, y)] = 1;
          let sumX = 0, sumY = 0, minX = x, maxX = x, minY = y, maxY = y;
          for (let head = 0; head < q.length; head++) {
            const [cx, cy] = q[head]!;
            sumX += cx; sumY += cy;
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
              if (inb(nx, ny) && floorMask[idx(nx, ny)] && !seen[idx(nx, ny)]) {
                seen[idx(nx, ny)] = 1;
                q.push([nx, ny]);
              }
            }
          }
          if (q.length >= 6) {
            const meanX = sumX / q.length;
            const meanY = sumY / q.length;
            const walkable = q.filter(([qx, qy]) => stoneFloorTiles.has(previewMap.lowerTiles[idx(qx, qy)] ?? -1));
            const anchorPool = walkable.length > 0 ? walkable : q;
            anchorPool.sort((a, b) => Math.hypot(a[0] - meanX, a[1] - meanY) - Math.hypot(b[0] - meanX, b[1] - meanY));
            const [ax, ay] = anchorPool[0]!;
            rooms.push({ cx: ax, cy: ay, minX, maxX, minY, maxY });
          }
        }
      }
      const carveFloorCell = (x: number, y: number): void => {
        if (!inb(x, y)) return;
        if (stairsUpTiles.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) return;
        // 기존 벽에 걸려 있던 횃불이 복도 자리와 겹치면 횃불을 치우고 바닥을 낸다.
        const u = previewMap.upperTiles[idx(x, y)] ?? -1;
        if (u >= 0) {
          const uMeta = tileset.tileMeta?.[u];
          if (/횃불|torch/iu.test(uMeta?.label ?? "")) {
            previewMap.upperTiles[idx(x, y)] = -1;
          } else {
            return;
          }
        }
        if (!floorMask[idx(x, y)]) {
          floorMask[idx(x, y)] = 1;
          previewMap.lowerTiles[idx(x, y)] = kitTile(floorKit, x, y);
        }
      };

      if (rooms.length >= 2) {
        // 1) 수평으로 마주 보는 방 쌍(Y 범위가 겹치는 방들)을 2줄 폭 수평 복도로 연결
        for (let i = 0; i < rooms.length; i++) {
          for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i]!, r2 = rooms[j]!;
            const yOverlapMin = Math.max(r1.minY, r2.minY);
            const yOverlapMax = Math.min(r1.maxY, r2.maxY);
            if (yOverlapMax - yOverlapMin >= 1) {
              const leftR = r1.maxX < r2.minX ? r1 : r2.maxX < r1.minX ? r2 : null;
              const rightR = leftR === r1 ? r2 : leftR === r2 ? r1 : null;
              if (leftR && rightR && rightR.minX - leftR.maxX <= 8) {
                const cy = Math.floor((yOverlapMin + yOverlapMax - 1) / 2);
                for (let x = leftR.maxX; x <= rightR.minX; x++) {
                  carveFloorCell(x, cy);
                  carveFloorCell(x, cy + 1);
                }
              }
            }
          }
        }
        // 2) 수직으로 마주 보는 방 쌍(X 범위가 겹치는 방들)을 2칸 폭 수직 복도로 연결
        //    철창 아치 문(wantsChokePointDoor)이 함께 요청된 경우 남쪽 방의 북벽 2줄(botR.minY - 2 .. botR.minY - 1)을 남겨 문이 정확히 벽 초크포인트에 박히게 한다!
        for (let i = 0; i < rooms.length; i++) {
          for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i]!, r2 = rooms[j]!;
            const xOverlapMin = Math.max(r1.minX, r2.minX);
            const xOverlapMax = Math.min(r1.maxX, r2.maxX);
            if (xOverlapMax - xOverlapMin >= 1) {
              const topR = r1.maxY < r2.minY ? r1 : r2.maxY < r1.minY ? r2 : null;
              const botR = topR === r1 ? r2 : topR === r2 ? r1 : null;
              if (topR && botR && botR.minY - topR.maxY <= 10) {
                const cx = Math.floor((xOverlapMin + xOverlapMax - 1) / 2);
                const stopY = wantsChokePointDoor && botR.minY - topR.maxY >= 4 ? botR.minY - 3 : botR.minY;
                for (let y = topR.maxY; y <= stopY; y++) {
                  carveFloorCell(cx, y);
                  carveFloorCell(cx + 1, y);
                }
              }
            }
          }
        }
      } else {
        const cy = area.y + Math.max(2, Math.floor(area.h / 2));
        for (let x = area.x; x < area.x + area.w; x++) {
          carveFloorCell(x, cy);
          carveFloorCell(x, cy + 1);
        }
      }
    }

    // 모든 방·복도 바닥(floorMask)을 합친 뒤, 바닥 북쪽 경계에만 2줄 돌벽(wallB)을 일괄 계산한다 — 방 한가운데 떠 있는 벽 조각이 절대 생기지 않는다!
    const wallB = new Int8Array(W * H).fill(-1);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (!floorMask[idx(x, y)] && !floorMask[idx(x, y - 1)] && floorMask[idx(x, y + 1)] === 1) {
          wallB[idx(x, y)] = 0;
          wallB[idx(x, y - 1)] = 1;
        }
      }
    }

    // 벽 앞면 타일 계산(좌·우 이웃 벽 연결에 따라 마구리·가운데 타일 선택). 이미 찍힌 계단 타일은 보존한다.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const b = wallB[idx(x, y)]!;
        if (b < 0 || stairsUpTiles.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) continue;
        const row = faceKit.rows[1 - Math.min(1, b)]!.tiles;
        const left = x > 0 && wallB[idx(x - 1, y)] === b;
        const right = x + 1 < W && wallB[idx(x + 1, y)] === b;
        previewMap.lowerTiles[idx(x, y)] = left && right ? row[1]! : !left && right ? row[0]! : left && !right ? row[2]! : row[1]!;
      }
    }

    // 방·벽 바깥 빈 땅은 던전 천장 오토타일(47변형 테두리)로 채운다.
    const isOpen = (x: number, y: number): boolean => inb(x, y) && (floorMask[idx(x, y)] === 1 || wallB[idx(x, y)]! >= 0);
    const bits: readonly [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isOpen(x, y)) continue;
        if (!ceilingGroup) { previewMap.lowerTiles[idx(x, y)] = voidTile; continue; }
        let m = 0;
        for (const [dx, dy, bit] of bits) if (!isOpen(x + dx, y + dy)) m |= bit;
        previewMap.lowerTiles[idx(x, y)] = ceilingGroup.variantMap[String(m)] ?? voidTile;
      }
    }

    // 지워진 벽 위층 횃불이 있으면 tile_erase 로 함께 정리한다.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (beforeUpper[idx(x, y)] !== previewMap.upperTiles[idx(x, y)] && previewMap.upperTiles[idx(x, y)] === -1) {
          out.push({
            tool: "tile_erase",
            label: "",
            group: step.label,
            args: { mapId: facts.mapId, rect: { x, y, w: 1, h: 1 }, layer: "upper" },
          });
        }
      }
    }

    // 바뀐 lowerTiles 를 타일 번호별로 묶어 paint_tiles 단계로 내보낸다.
    const byTile = new Map<number, { x: number; y: number }[]>();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const after = previewMap.lowerTiles[idx(x, y)]!;
        if (after === beforeLower[idx(x, y)]) continue;
        const list = byTile.get(after) ?? [];
        list.push({ x, y });
        byTile.set(after, list);
      }
    }
    let first = true;
    for (const [tile, cells] of byTile) {
      out.push({
        tool: "paint_tiles",
        label: first ? step.label : "",
        ...(first && step.note ? { note: step.note } : {}),
        group: step.label,
        args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile, cells },
      });
      first = false;
    }
  }
  return { steps: out, dropped };
}

/** 크기 말 → 조립식 집 벽 너비(칸). 칩셋의 최소 너비보다 작으면 최소 너비를 쓴다. */
const HOUSE_WIDTH: Record<"small" | "medium" | "large", number> = { small: 5, medium: 7, large: 9 };
/**
 * 시도할 집 외관 — 조립식 스타일이 있으면 그것(맵의 구조물 수로 돌려 이웃 집과 외관이 겹치지 않게, 너비는 원하는 것부터 줄여 가며),
 * 없으면 칩셋의 집 키트(원본 크기 그대로, 크기 말에 가까운 순).
 */
function houseKindRegex(kindText: string | undefined): RegExp | null {
  if (!kindText) return null;
  const text = kindText.trim();
  if (!text) return null;
  if (/편의점|세븐|로손|패밀리|마트|conv|konbini/iu.test(text)) return /편의점|conv|konbini|shop-c/iu;
  if (/카페|커피|베이커리|다방|빵집|cafe|bakery/iu.test(text)) return /카페|빵집|cafe|bakery|shop-a/iu;
  if (/이자카야|선술집|식당|음식점|초밥|도시락|목욕탕|상가|가게|상점|shop|store|izakaya|sushi|bento|sento/iu.test(text)) {
    return /상점|상가|가게|식당|초밥|도시락|목욕탕|대장간|방앗간|마구간|shop|store|bento|sushi|sento|smith|mill|stable/iu;
  }
  if (/오피스|사무|빌딩|회사|은행|병원|호텔|맨션|타워|아파트|office|bank|hospital|hotel|tower|apart/iu.test(text)) {
    return /오피스|사무|빌딩|은행|병원|호텔|타워|맨션|아파트|관청|성당|저택|office|bank|hospital|hotel|tower|apart|manor|cathedral/iu;
  }
  if (/학교|교사|강의동|기숙사|체육관|도서관|강당|연구동|school|campus|dorm|gym|library/iu.test(text)) {
    return /학교|교사|기숙사|체육관|도서관|강당|시계탑|보건실|school|dorm|gym|library|clock|infirmary/iu;
  }
  if (/여관|숙소|주막|민박|inn|lodge/iu.test(text)) return /여관|주막|숙소|inn|lodge/iu;
  if (/대장간|무기점|갑옷|공방|smith|forge/iu.test(text)) return /대장간|무기|공방|smith|forge/iu;
  if (/주택|단독주택|살림집|민가|집|오두막|cottage|house|home/iu.test(text)) return /단독주택|현대식\s*주택|주택|살림집|민가|오두막|bld-house|cottage|home/iu;
  return null;
}

function splitBuildingKindForIndex(kindText: string | undefined, index: number, count: number): string | undefined {
  if (!kindText || count <= 1) return kindText;
  const parts = kindText.split(/\s*(?:·|,|\/|과\s+|와\s+|및\s+)\s*/u).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[index % parts.length];
  return kindText;
}

function houseOptionsFor(tileset: TilesetDef, size: "small" | "medium" | "large", stories: 1 | 2, seed: number, kindText?: string): QuickHouseOptions[] {
  const kindRe = houseKindRegex(kindText);
  const allKits = [...quickHouseCatalog(tileset)];
  const styles = quickHouseStyles(tileset);
  const isGenericHouseAsk = !kindText || /^(?:작은\s*|큰\s*)?(?:집|주택|살림집|민가|단독주택|오두막)(?:\s*\d+\s*채)?$/u.test(kindText.trim());
  // 특정 건물 종류(여관·대장간·상점·편의점·오피스 등)를 요청했거나 조립식 스타일이 없는 타일셋(modern_city 등)이면 매칭 키트를 우선 쓴다.
  if (kindRe && allKits.length > 0 && (!isGenericHouseAsk || styles.length === 0)) {
    const matchedKits = allKits.filter((kit) => kindRe.test(`${kit.id} ${kit.name ?? ""} ${(kit.ai?.tags ?? []).join(" ")}`));
    if (matchedKits.length > 0) {
      matchedKits.sort((a, b) =>
        Number(a.id.startsWith("bd-house-rv-")) - Number(b.id.startsWith("bd-house-rv-"))
        || a.width * a.height - b.width * b.height);
      const ordered = size === "small" ? matchedKits : size === "large" ? [...matchedKits].reverse() : matchedKits;
      const rotated = ordered.map((_, i) => ordered[(seed + i) % ordered.length]!);
      return rotated.map((kit) => ({ style: "blue-stone", width: kit.width, stories: 1, kitId: kit.id }));
    }
  }
  if (styles.length > 0) {
    const rotated = styles.map((_, i) => styles[(seed + i) % styles.length]!);
    rotated.sort((a, b) => Number(quickHouseMinWidth(a) > HOUSE_WIDTH[size]) - Number(quickHouseMinWidth(b) > HOUSE_WIDTH[size]));
    const out: QuickHouseOptions[] = [];
    for (const style of rotated) {
      const min = quickHouseMinWidth(style);
      for (let width = Math.max(min, HOUSE_WIDTH[size]); width >= min; width--) out.push({ style, width, stories });
    }
    return out;
  }
  if (allKits.length === 0) return [];
  const kits = [...allKits].sort((a, b) => a.width * a.height - b.width * b.height);
  const middle = kits[Math.floor(kits.length / 2)]!;
  const sizeOrdered = size === "small" ? kits : size === "large" ? [...kits].reverse()
    : [...kits].sort((a, b) => Math.abs(a.width * a.height - middle.width * middle.height) - Math.abs(b.width * b.height - middle.width * middle.height));
  const rotated = sizeOrdered.map((_, i) => sizeOrdered[(seed + i) % sizeOrdered.length]!);
  if (kindRe) {
    rotated.sort((a, b) =>
      Number(!kindRe.test(`${a.id} ${a.name ?? ""} ${(a.ai?.tags ?? []).join(" ")}`))
      - Number(!kindRe.test(`${b.id} ${b.name ?? ""} ${(b.ai?.tags ?? []).join(" ")}`)));
  }
  return rotated.map((kit) => ({ style: "blue-stone", width: kit.width, stories: 1, kitId: kit.id }));
}

const NON_REMOVABLE_UPPER_RE = /(?:^|[\s·,])(?:물|강물|바닷물|호수|연못|작은 연못|폭포|절벽|벼랑|낭떠러지|밧줄 다리|건물|집|지붕|집 문)(?=$|[\s·,(])|\b(?:water|river|lake|pond|waterfall|cliff|void|bridge|building|house|roof|wall|door)\b/iu;

function isNonRemovableUpperTile(tileset: TilesetDef, tile: number): boolean {
  if (tile < 0) return false;
  const meta = tileset.tileMeta?.[tile];
  if (meta?.role === "water" || meta?.role === "wall" || meta?.role === "roof") return true;
  if (tileset.id === "jp_city" && (tile < 707 || (tile >= 2156 && tile < 2360))) return true;
  const text = `${meta?.label ?? ""} ${(meta?.tags ?? []).join(" ")}`;
  return NON_REMOVABLE_UPPER_RE.test(text);
}

function tryClearForHouse(
  map: GameMap,
  tileset: TilesetDef,
  rect: StampRect,
  blocked: ReadonlySet<string>,
): { readonly clearedMap: GameMap; readonly layer: "both" | "upper" } | null {
  let hasRemovable = false;
  let hasLayer2 = false;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
      if (blocked.has(`${x},${y}`)) return null;
      const i = y * map.width + x;
      if (terrainLocked(map.terrainDesign, i) || (map.terrainDesign?.waterDepth?.[i] ?? 0) > 0 || (map.relief?.ramps?.[i] ?? 0) > 0) return null;
      const l1 = layerTileAt(map, 1, i);
      if (l1 < 0) return null;
      const pass = tileset.passability[l1];
      if (pass && !pass.up && !pass.down && !pass.left && !pass.right) return null;
      const meta1 = tileset.tileMeta?.[l1];
      if (meta1?.role === "water" || meta1?.role === "wall" || meta1?.role === "roof" || meta1?.passage === "solid") return null;
      const l2 = layerTileAt(map, 2, i);
      const l3 = layerTileAt(map, 3, i);
      const l4 = layerTileAt(map, 4, i);
      if (isNonRemovableUpperTile(tileset, l2) || isNonRemovableUpperTile(tileset, l3) || isNonRemovableUpperTile(tileset, l4)) return null;
      if (l2 >= 0) { hasRemovable = true; hasLayer2 = true; }
      if (l3 >= 0 || l4 >= 0 || (topTileInStack(map, "upper", i) ?? -1) >= 0) hasRemovable = true;
    }
  }
  if (!hasRemovable) return null;
  const clearedMap = copiedTerrainMap(map);
  clearedMap.structurePlacements = [...(map.structurePlacements ?? [])];
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const i = y * clearedMap.width + x;
      setLayerTileAt(clearedMap, 2, i, -1);
      setLayerTileAt(clearedMap, 3, i, -1);
      setLayerTileAt(clearedMap, 4, i, -1);
      clearTileStack(clearedMap, "upper", i);
    }
  }
  return { clearedMap, layer: hasLayer2 ? "both" : "upper" };
}

const JP_HOUSE_PRESETS = [
  { ground: "gr.garage", roof: "roof.hip.slate", floorKind: "veranda", wall: "shiro", door: { type: "house" } },
  { ground: "gr.glass.sora", roof: "roof.hip", floorKind: "pairs", wall: "kinari", door: { type: "house" } },
  { ground: "gr.konbini.0", roof: "roof.slate", floorKind: "slide", wall: "shiro", door: { type: "auto" } },
  { ground: "gr.izakaya", roof: "roof.tile", floorKind: "koushi", wall: "kinari", door: { type: "noren" } },
] as const;

type JpHousePreset = {
  readonly ground: string;
  readonly roof: string;
  readonly floorKind: string;
  readonly wall: string;
  readonly door: { readonly type: string };
};

function jpPresetForKind(kindText: string | undefined, seed: number): JpHousePreset {
  const text = (kindText ?? "").trim();
  if (/편의점|마트|수퍼|conv/iu.test(text)) {
    return JP_HOUSE_PRESETS[2];
  }
  if (/이자카야|선술집|식당|음식점|초밥|도시락|상가|가게|상점/u.test(text)) {
    return JP_HOUSE_PRESETS[3];
  }
  if (/오피스|빌딩|사무|은행|병원|호텔|맨션|타워/u.test(text)) {
    return JP_HOUSE_PRESETS[0];
  }
  const order = [JP_HOUSE_PRESETS[0], JP_HOUSE_PRESETS[1], JP_HOUSE_PRESETS[2], JP_HOUSE_PRESETS[3]] as const;
  return order[seed % order.length]!;
}

function expandJpCityHouseStep(
  step: StampStep,
  project: Project,
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
  blocked: Set<string>,
  cells: Set<string>,
  seedStart: number,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[]; readonly nextSeed: number } {
  const target = facts.target;
  const area = step.args.area as StampRect;
  const size = step.args.size === "small" || step.args.size === "large" ? step.args.size : "medium";
  const stories = step.args.stories === 2 ? 2 : 1;
  const count = Number(step.args.count) || 1;
  const kindText = typeof step.args.kind === "string" ? step.args.kind : step.label;
  const widths = size === "small" ? [4, 5] : size === "large" ? [7, 6, 5] : [5, 6, 4];
  const floorCounts = stories === 2 ? [1, 0] : [0, 1];
  const out: StampStep[] = [];
  const dropped: string[] = [];
  let seed = seedStart;
  let placed = 0;
  let smallest: { w: number; h: number } | null = null;
  let lastReason = "";
  const horizontalSpread = area.w >= area.h;
  // 남쪽 바로 아래에 보도·도로가 있으면 건물 정면을 남쪽 보도 쪽(streetfront)으로 맞춘다.
  const hasJpRoad = tileset.id === "jp_city" && previewMap.lowerTiles.some((t) => t >= 3544 && t <= 3604);
  let alignStreetfront = hasJpRoad && target.y + target.h <= 13;
  for (let n = 0; n < count; n++) {
    const cx = count > 1 && horizontalSpread ? area.x + ((n + 0.5) * area.w) / count : area.x + (area.w - 1) / 2;
    const cy = alignStreetfront ? target.y + target.h - 2 : count > 1 && !horizontalSpread ? area.y + ((n + 0.5) * area.h) / count : area.y + (area.h - 1) / 2;
    const subKind = splitBuildingKindForIndex(kindText, n, count);
    const preset = jpPresetForKind(subKind, seed);
    let hit: {
      fx: number;
      fy: number;
      w: number;
      floors: number;
      rect: StampRect;
      door: { x: number; y: number };
      access: readonly { x: number; y: number }[];
      clearRect?: StampRect;
      nextMap: GameMap;
    } | null = null;
    for (const allowClear of [false, true]) {
      for (const floors of floorCounts) {
        for (const w of widths) {
          const probe = buildJpCityBuilding({ x: 0, y: 20, w, floors, ...preset });
          if (!probe.ok) continue;
          const bh = probe.rect.h;
          if (!smallest || w * (bh + 1) < smallest.w * smallest.h) smallest = { w, h: bh + 1 };
          const candidates: { left: number; top: number; d: number }[] = [];
          for (let top = target.y; top + bh + 1 <= target.y + target.h; top++) {
            for (let left = target.x; left + w <= target.x + target.w; left++) {
              const targetTop = alignStreetfront ? target.y + target.h - bh - 1 : cy - (bh - 1) / 2;
              candidates.push({ left, top, d: Math.hypot(left + (w - 1) / 2 - cx, (top - targetTop) * 2) });
            }
          }
          candidates.sort((a, b) => a.d - b.d || b.top - a.top || a.left - b.left);
          for (const cand of candidates) {
            const rect: StampRect = { x: cand.left, y: cand.top, w, h: bh };
            const fullRect: StampRect = { x: cand.left, y: cand.top, w, h: bh + 1 };
            const fx = cand.left;
            const fy = cand.top + bh - 1;
            let testMap = previewMap;
            if (!allowClear) {
              let clean = true;
              for (let y = fullRect.y; clean && y < fullRect.y + fullRect.h; y++) {
                for (let x = fullRect.x; clean && x < fullRect.x + fullRect.w; x++) {
                  if (blocked.has(`${x},${y}`)) { clean = false; break; }
                  const i = y * previewMap.width + x;
                  if (layerTileAt(previewMap, 3, i) >= 0 || layerTileAt(previewMap, 4, i) >= 0) clean = false;
                }
              }
              if (!clean) continue;
            } else {
              const cleared = tryClearForHouse(previewMap, tileset, fullRect, blocked);
              if (!cleared) continue;
              testMap = cleared.clearedMap;
            }
            const built = buildJpCityBuilding(
              { x: fx, y: fy, w, floors, ...preset },
              { world: { width: testMap.width, height: testMap.height, passable: (x, y) => isPassable(project, testMap, x, y) }, minReach: 6 },
            );
            if (!built.ok) {
              lastReason = built.issues[0]?.message ?? "문 앞 접근칸이 막혔습니다";
              continue;
            }
            const nextMap = copiedTerrainMap(testMap);
            for (const p of built.placements) {
              const i = p.y * nextMap.width + p.x;
              if (p.lower !== undefined) { nextMap.lowerTiles[i] = p.lower; continue; }
              setLayerTileAt(nextMap, 3, i, p.upper ?? -1);
              setLayerTileAt(nextMap, 4, i, p.overlay ?? -1);
              clearTileStack(nextMap, "upper", i);
            }
            hit = {
              fx,
              fy,
              w,
              floors,
              rect,
              door: built.doors[0] ?? { x: fx + w - 1, y: fy },
              access: built.access,
              ...(allowClear ? { clearRect: fullRect } : {}),
              nextMap,
            };
            break;
          }
          if (hit) break;
        }
        if (hit) break;
      }
      if (hit) break;
    }
    if (!hit) break;
    const houseLabel = count > 1 ? `${step.label} ${n + 1}/${count}` : step.label;
    if (hit.clearRect) {
      out.push({
        tool: "tile_erase",
        label: `${houseLabel} 터 정리`,
        note: "장식·나무 정리",
        args: { mapId: facts.mapId, rect: hit.clearRect, layer: "upper" },
      });
    }
    // 일본 도시 상점가 블록: 건물 부지와 북쪽 보도(y=12) 사이, 그리고 건물 주변 흙바닥을 도시 블록 포석(3333)으로 빈틈없이 포장한다.
    if (hasJpRoad && tileset.tileMeta?.[3333]) {
      const paveX0 = Math.max(0, hit.rect.x <= 6 ? 0 : hit.rect.x >= 18 && hit.rect.x <= 25 ? 18 : hit.rect.x - 3);
      const paveX1 = Math.min(previewMap.width - 1, hit.rect.x + hit.rect.w >= previewMap.width - 6 ? previewMap.width - 1 : hit.rect.x + hit.rect.w >= 15 && hit.rect.x + hit.rect.w <= 22 ? 21 : hit.rect.x + hit.rect.w + 3);
      const paveY0 = 0;
      const paveY1 = Math.min(previewMap.height - 1, Math.max(hit.rect.y + hit.rect.h, 11));
      const paveCells: { x: number; y: number }[] = [];
      for (let py = paveY0; py <= paveY1; py++) {
        for (let px = paveX0; px <= paveX1; px++) {
          const idx = py * previewMap.width + px;
          if (hit.nextMap.lowerTiles[idx] !== 3333) {
            hit.nextMap.lowerTiles[idx] = 3333;
            paveCells.push({ x: px, y: py });
          }
        }
      }
      if (paveCells.length > 0) {
        out.push({
          tool: "paint_tiles",
          label: `${houseLabel} 블록 포장`,
          group: houseLabel,
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 3333, cells: paveCells },
        });
      }
    }
    for (let y = hit.rect.y - 1; y <= hit.rect.y + hit.rect.h + 1; y++) {
      for (let x = hit.rect.x - 1; x <= hit.rect.x + hit.rect.w; x++) blocked.add(`${x},${y}`);
    }
    for (let y = hit.rect.y; y < hit.rect.y + hit.rect.h; y++) {
      for (let x = hit.rect.x; x < hit.rect.x + hit.rect.w; x++) cells.add(`${x},${y}`);
    }
    for (const acc of hit.access) cells.add(`${acc.x},${acc.y}`);
    Object.assign(previewMap, hit.nextMap);
    out.push({
      tool: "build_jp_city_building",
      label: houseLabel,
      note: [n === 0 ? step.note : undefined, hit.clearRect ? "장식 정리 후 배치" : undefined, `문 (${hit.door.x},${hit.door.y})`].filter(Boolean).join(" · "),
      at: [hit.door],
      args: { mapId: facts.mapId, x: hit.fx, y: hit.fy, w: hit.w, floors: hit.floors, ...preset },
    });
    placed += 1;
    seed += 1;
  }
  if (placed < count) {
    const where = `${facts.targetIsSelection ? "선택 영역" : "맵"} ${target.w}×${target.h}`;
    const why = !smallest
      ? "이 타일셋에는 집 외관이 없습니다"
      : smallest.w > target.w || smallest.h > target.h
        ? `가장 작은 집도 ${smallest.w}×${smallest.h}칸(문 앞 포함)이 필요합니다 — 영역을 넓혀 주세요`
        : `집과 문 앞이 들어갈 평평한 빈 땅이 없습니다(${lastReason || "이벤트·다른 집과 겹침"})`;
    dropped.push(`${step.label}: ${placed > 0 ? `${count}채 중 ${placed}채만 지었습니다 — ` : ""}${where} 안에 ${why}. 벽·바닥으로 흉내 내지 않았습니다`);
  }
  return { steps: out, dropped, nextSeed: seed };
}

/**
 * 계획의 `place_house`(영역·크기만 정해진 보류 단계)를 `place_terrain_house`(또는 jp_city 의 `build_jp_city_building`) 호출로 펼친다 — 자리는 **지금 맵**에서 고른다.
 * 1) 먼저 있는 그대로 `planQuickHouse` 검사를 통과하는 빈 땅을 찾는다.
 * 2) 없으면 물·절벽·잠금·이벤트·기존 보호된 집(`protectedHouseCells`)과 겹치지 않고 지울 수 있는 위층 장식·나무·풀 때문에만 막힌 자리를 찾아
 *    그 발자국+문 앞 사각형에 `tile_erase` 단계를 먼저 넣고, 복제된 미리보기 맵에서 `planQuickHouse` 를 다시 검증한다.
 * 자리가 없으면 그 단계를 버리고 이유를 남긴다 — 벽·바닥으로 흉내 내지 않는다.
 */
export function expandStampHouses(
  steps: readonly StampStep[],
  project: Project,
  facts: StampPlanFacts,
  surfaceMapOverride?: GameMap,
  variation = 0,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[]; readonly cells: ReadonlySet<string> } {
  const cells = new Set<string>();
  if (!steps.some((step) => step.tool === "place_house")) return { steps, dropped: [], cells };
  const map = surfaceMapOverride ?? project.maps[facts.mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const blocked = new Set<string>();
  for (const event of map?.events ?? []) blocked.add(`${event.x},${event.y}`);
  if (map && project.startMapId === map.id) blocked.add(`${project.startPos.x},${project.startPos.y}`);
  if (map) {
    for (const cell of protectedHouseCells(map)) blocked.add(`${cell.x},${cell.y}`);
  }
  // 같은 계획의 새 이벤트(NPC·상자 등)가 설 칸과 바로 위 칸(두 칸 높이 그림)은 집이 덮지 않는다.
  for (const step of steps) {
    const args = step.args;
    const points = [cellOf(args), cellOf(args.home), step.tool === "place_trap" ? cellOf(args.at) : null];
    for (const point of points) if (point) for (const dy of [-1, 0]) blocked.add(`${point.x},${point.y + dy}`);
  }
  const previewMap = surfaceMapOverride ?? (map ? copiedTerrainMap(map) : undefined);
  if (previewMap && map && !surfaceMapOverride) previewMap.structurePlacements = [...(map.structurePlacements ?? [])];
  const target = facts.target;
  const out: StampStep[] = [];
  const dropped: string[] = [];
  let seed = (map?.structurePlacements?.length ?? 0) + Math.abs(variation);
  for (const step of steps) {
    if (step.tool !== "place_house") { out.push(step); continue; }
    if (!map || !previewMap || !tileset) { dropped.push(`${step.label}: 맵 칩셋을 찾지 못했습니다`); continue; }
    if (tileset.id === "jp_city" && quickHouseStyles(tileset).length === 0) {
      const jp = expandJpCityHouseStep(step, project, previewMap, tileset, facts, blocked, cells, seed);
      out.push(...jp.steps);
      dropped.push(...jp.dropped);
      seed = jp.nextSeed;
      continue;
    }
    // validateStampStep 의 place_house 는 area 를 늘 대상 안으로 자른 StampRect 로 만든다.
    const area = step.args.area as StampRect;
    const size = step.args.size === "small" || step.args.size === "large" ? step.args.size : "medium";
    const stories = step.args.stories === 2 ? 2 : 1;
    const count = Number(step.args.count) || 1;
    const kindText = typeof step.args.kind === "string" ? step.args.kind : step.label;
    const optionsList = houseOptionsFor(tileset, size, stories, seed, kindText);
    if (optionsList.length === 0) {
      dropped.push(`${step.label}: 이 타일셋(${tileset.id})에는 집 외관이 없습니다(벽·문·바닥으로 흉내 내지 않음)`);
      continue;
    }
    let placed = 0;
    let lastReason = "";
    let smallest: { w: number; h: number } | null = null;
    const horizontalSpread = area.w >= area.h;
    const alignUrbanStreetfront = tileset.id === "modern_city" && target.y + target.h <= 12;
    const usedLooks = new Set<string>();
    for (let n = 0; n < count; n++) {
      const cx = count > 1 && horizontalSpread ? area.x + ((n + 0.5) * area.w) / count : area.x + (area.w - 1) / 2;
      const cy = alignUrbanStreetfront ? target.y + target.h - 2 : count > 1 && !horizontalSpread ? area.y + ((n + 0.5) * area.h) / count : area.y + (area.h - 1) / 2;
      const subKind = splitBuildingKindForIndex(kindText, n, count);
      const rawOptions = houseOptionsFor(tileset, size, stories, seed + n, subKind);
      const currentOptions = [
        ...rawOptions.filter((o) => !usedLooks.has(o.kitId ?? o.style)),
        ...rawOptions.filter((o) => usedLooks.has(o.kitId ?? o.style)),
      ];
      let hit: {
        anchor: { x: number; y: number };
        options: QuickHouseOptions;
        rect: StampRect;
        plan: QuickHousePlan;
        clear?: { rect: StampRect; layer: "both" | "upper"; clearedMap: GameMap };
      } | null = null;
      // 1차: 있는 그대로 planQuickHouse 가 통과하는 깨끗한 빈 땅을 찾는다.
      for (const options of currentOptions) {
        const kit = quickHouseKit(tileset, options);
        const door = kit?.parts?.find((part) => part.kind === "entrance");
        if (!kit || !door) continue;
        const neededH = Math.max(kit.height, door.dy + door.h + 1);
        if (!smallest || kit.width * neededH < smallest.w * smallest.h) smallest = { w: kit.width, h: neededH };
        const doorRow = door.dy + door.h - 1;
        const searchPad = count > 1 ? 3 : 0;
        const sX0 = Math.max(0, target.x - searchPad);
        const sY0 = Math.max(0, target.y - searchPad);
        const sX1 = Math.min(previewMap.width, target.x + target.w + searchPad);
        const sY1 = Math.min(previewMap.height, target.y + target.h + searchPad);
        const candidates: { x: number; y: number; d: number }[] = [];
        for (let top = sY0; top + neededH <= sY1; top++) {
          for (let left = sX0; left + kit.width <= sX1; left++) {
            const targetDoorY = alignUrbanStreetfront ? target.y + target.h - 2 : cy;
            candidates.push({
              x: left + door.dx,
              y: top + doorRow,
              d: Math.hypot(left + (kit.width - 1) / 2 - cx, alignUrbanStreetfront ? (top + doorRow - targetDoorY) * 2 : top + (kit.height - 1) / 2 - cy),
            });
          }
        }
        candidates.sort((a, b) => a.d - b.d || (alignUrbanStreetfront ? b.y - a.y : a.y - b.y) || a.x - b.x);
        for (const anchor of candidates) {
          const rect = { x: anchor.x - door.dx, y: anchor.y - doorRow, w: kit.width, h: kit.height };
          let clear = !blocked.has(`${anchor.x},${anchor.y + 1}`);
          for (let y = rect.y; clear && y < rect.y + rect.h; y++) for (let x = rect.x; clear && x < rect.x + rect.w; x++) if (blocked.has(`${x},${y}`)) clear = false;
          if (!clear) continue;
          const plan = planQuickHouse(previewMap, tileset, { x: anchor.x, y: anchor.y }, options);
          if (!plan.ok) { lastReason = plan.reason; continue; }
          hit = { anchor: { x: anchor.x, y: anchor.y }, options, rect, plan };
          break;
        }
        if (hit) break;
      }
      // 2차: 물·절벽·이벤트·보호된 집과 겹치지 않고 지울 수 있는 위층 장식·나무 때문에만 실패한 자리를 찾아 비운 뒤 검증한다.
      if (!hit) {
        for (const options of currentOptions) {
          const kit = quickHouseKit(tileset, options);
          const door = kit?.parts?.find((part) => part.kind === "entrance");
          if (!kit || !door) continue;
          const doorRow = door.dy + door.h - 1;
          const neededH = Math.max(kit.height, doorRow + 2);
          const searchPad = count > 1 ? 3 : 0;
          const sX0 = Math.max(0, target.x - searchPad);
          const sY0 = Math.max(0, target.y - searchPad);
          const sX1 = Math.min(previewMap.width, target.x + target.w + searchPad);
          const sY1 = Math.min(previewMap.height, target.y + target.h + searchPad);
          const candidates: { x: number; y: number; d: number }[] = [];
          for (let top = sY0; top + neededH <= sY1; top++) {
            for (let left = sX0; left + kit.width <= sX1; left++) {
              candidates.push({ x: left + door.dx, y: top + doorRow, d: Math.hypot(left + (kit.width - 1) / 2 - cx, top + (kit.height - 1) / 2 - cy) });
            }
          }
          candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
          for (const anchor of candidates) {
            const rect = { x: anchor.x - door.dx, y: anchor.y - doorRow, w: kit.width, h: kit.height };
            const clearRect = { x: rect.x, y: rect.y, w: rect.w, h: neededH };
            const cleared = tryClearForHouse(previewMap, tileset, clearRect, blocked);
            if (!cleared) continue;
            const plan = planQuickHouse(cleared.clearedMap, tileset, { x: anchor.x, y: anchor.y }, options);
            if (!plan.ok) { lastReason = plan.reason; continue; }
            hit = { anchor: { x: anchor.x, y: anchor.y }, options, rect, plan, clear: { rect: clearRect, layer: cleared.layer, clearedMap: cleared.clearedMap } };
            break;
          }
          if (hit) break;
        }
      }
      if (!hit) break;
      const houseLabel = count > 1 ? `${step.label} ${n + 1}/${count}` : step.label;
      if (hit.clear) {
        Object.assign(previewMap, hit.clear.clearedMap);
        out.push({
          tool: "tile_erase",
          label: `${houseLabel} 터 정리`,
          note: "장식·나무 정리",
          args: { mapId: facts.mapId, rect: hit.clear.rect, layer: hit.clear.layer },
        });
      }
      // modern_city: 북쪽 상가 블록 전체(y=0..10)를 타일 8(비연석 보도 포석)로 빈틈없이 포장하여 건물 둘레에 도로 연석이 말리는 현상을 원천 차단한다.
      if (tileset.id === "modern_city") {
        const apronX0 = Math.max(0, hit.rect.x <= 6 ? 0 : hit.rect.x >= 18 && hit.rect.x <= 26 ? 18 : hit.rect.x - 2);
        const apronX1 = Math.min(previewMap.width - 1, hit.rect.x + hit.rect.w >= previewMap.width - 6 ? previewMap.width - 1 : hit.rect.x + hit.rect.w >= 15 && hit.rect.x + hit.rect.w <= 22 ? 21 : hit.rect.x + hit.rect.w + 2);
        const apronY0 = 0;
        const apronY1 = Math.min(previewMap.height - 1, Math.max(hit.rect.y + hit.rect.h, 10));
        const apronCells: { x: number; y: number }[] = [];
        for (let py = apronY0; py <= apronY1; py++) {
          for (let px = apronX0; px <= apronX1; px++) {
            const idx = py * previewMap.width + px;
            if (previewMap.lowerTiles[idx] !== 8) {
              previewMap.lowerTiles[idx] = 8;
              apronCells.push({ x: px, y: py });
            }
          }
        }
        if (apronCells.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: `${houseLabel} 블록 보도 포장`,
            group: houseLabel,
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 8, cells: apronCells },
          });
        }
      }
      hit.plan.apply?.(previewMap);
      usedLooks.add(hit.options.kitId ?? hit.options.style);
      // 다음 집·물건이 이 집과 문 앞 2칸 폭 진입로를 덮지 않게 막는다.
      for (let y = hit.rect.y - 1; y <= hit.rect.y + hit.rect.h; y++) for (let x = hit.rect.x - 1; x <= hit.rect.x + hit.rect.w; x++) blocked.add(`${x},${y}`);
      blocked.add(`${hit.anchor.x},${hit.anchor.y + 1}`);
      for (let y = hit.rect.y; y < hit.rect.y + hit.rect.h; y++) for (let x = hit.rect.x; x < hit.rect.x + hit.rect.w; x++) cells.add(`${x},${y}`);
      for (let dy = 1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) cells.add(`${hit.anchor.x + dx},${hit.anchor.y + dy}`);
      }
      const args = hit.options.kitId
        ? { mapId: facts.mapId, anchor: hit.anchor, kitId: hit.options.kitId }
        : { mapId: facts.mapId, anchor: hit.anchor, style: hit.options.style, width: hit.options.width, stories: hit.options.stories };
      out.push({
        tool: "place_terrain_house",
        label: houseLabel,
        note: [n === 0 ? step.note : undefined, hit.clear ? "장식 정리 후 배치" : undefined, `문 (${hit.anchor.x},${hit.anchor.y}), 문 앞 (${hit.anchor.x},${hit.anchor.y + 1})`].filter(Boolean).join(" · "),
        at: [hit.anchor],
        args,
      });
      placed += 1;
      seed += 1;
    }
    if (placed < count) {
      const where = `${facts.targetIsSelection ? "선택 영역" : "맵"} ${target.w}×${target.h}`;
      const why = !smallest
        ? "이 타일셋에는 집 외관이 없습니다"
        : smallest.w > target.w || smallest.h > target.h
          ? `가장 작은 집도 ${smallest.w}×${smallest.h}칸(문 앞 포함)이 필요합니다 — 영역을 넓혀 주세요`
          : `집과 문 앞이 들어갈 평평한 빈 땅이 없습니다(${lastReason || "이벤트·다른 집과 겹침"})`;
      dropped.push(`${step.label}: ${placed > 0 ? `${count}채 중 ${placed}채만 지었습니다 — ` : ""}${where} 안에 ${why}. 벽·바닥으로 흉내 내지 않았습니다`);
    }
  }
  return { steps: out, dropped, cells };
}

/** {x, y} 숫자 칸이면 그 칸 — 단계마다 인자 모양이 달라 쓰는 두 필드만 확인한다. */
function cellOf(value: unknown): { x: number; y: number } | null {
  if (typeof value !== "object" || value === null || !("x" in value) || !("y" in value)) return null;
  return typeof value.x === "number" && typeof value.y === "number" ? { x: value.x, y: value.y } : null;
}

function toCall(step: StampStep): ToolCall {
  return { name: step.call ?? step.tool, args: { ...step.args } };
}

// ── 지우기(erase_object) · 옮기기(move_object) 공간 해석기 ───────────────────

export function detectPlacedMapObjects(map: GameMap, tileset: TilesetDef | undefined): PlacedMapObjectSummary[] {
  const W = map.width;
  const H = map.height;
  const out: PlacedMapObjectSummary[] = [];
  const covered = new Set<number>();
  const markCovered = (x: number, y: number, w: number, h: number): void => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (x + dx >= 0 && y + dy >= 0 && x + dx < W && y + dy < H) {
          covered.add((y + dy) * W + (x + dx));
        }
      }
    }
  };

  // 1) map.structurePlacements 기록
  for (const p of map.structurePlacements ?? []) {
    if (/-(?:ground|floor|face|ceiling)-|(?:-ceiling|-water-sew|-water-sea|-water-tide)$/i.test(p.kitId)) continue;
    const kit = (tileset?.structureKits ?? []).find((k) => k.id === p.kitId);
    const rawName = (kit?.name ?? p.kitId).trim();
    const core = p.kitId === "bd-pick-desert-oasis-well"
      ? "분수대 · 돌 우물"
      : /^bd-castle/i.test(p.kitId)
        ? `성 · 성채 · ${extractCoreObjectName(rawName)}`
        : /^bd-shop-/i.test(p.kitId)
          ? `상점 · 가게 · ${extractCoreObjectName(rawName)}`
          : /^quick_house_|^bd-house-|^jp-bldg-|^mc-bld-/i.test(p.kitId)
            ? `집 · ${extractCoreObjectName(rawName)}`
            : extractCoreObjectName(rawName);
    out.push({
      id: p.id,
      kind: "structure",
      name: rawName,
      coreName: core,
      kitId: p.kitId,
      placementId: p.id,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
    });
    markCovered(p.x, p.y, p.w, p.h);
  }

  // 2) upperTiles 에 찍힌 structureKit 무늬 탐지
  const upperPositions = new Map<number, number[]>();
  for (let i = 0; i < W * H; i++) {
    const t = map.upperTiles[i] ?? -1;
    if (t >= 0) {
      const list = upperPositions.get(t);
      if (list) list.push(i);
      else upperPositions.set(t, [i]);
    }
  }

  // 버들항 포룸 3×3 분수대(2429, 2432, 2437) 특수 탐지
  for (const pos of upperPositions.get(2429) ?? []) {
    const ox = pos % W;
    const oy = Math.floor(pos / W);
    if (ox + 3 <= W && oy + 3 <= H && !covered.has(pos) && map.upperTiles[pos + 1] === 2432 && map.upperTiles[pos + 2] === 2437) {
      out.push({
        id: `kit_bd_forum_fountain_${ox}_${oy}`,
        kind: "kit",
        name: "버들항 광장 분수대 3×3",
        coreName: "분수대",
        kitId: "bd-forum-fountain",
        x: ox,
        y: oy,
        w: 3,
        h: 3,
      });
      markCovered(ox, oy, 3, 3);
    }
  }

  const kitsSorted = [...(tileset?.structureKits ?? [])]
    .filter((k) => k.width >= 1 && k.height >= 1 && k.width <= 12 && k.height <= 12 && (k.rows?.length ?? 0) > 0)
    .sort((a, b) => b.width * b.height - a.width * a.height);

  for (const kit of kitsSorted) {
    if (/-(?:ground|floor|face|ceiling)-|(?:-ceiling|-water-sew|-water-sea|-water-tide)$/i.test(kit.id)) continue;
    const upperCells: { dx: number; dy: number; tile: number }[] = [];
    for (let dy = 0; dy < kit.height; dy++) {
      const row = kit.rows[dy];
      if (!row?.upperTiles) continue;
      for (let dx = 0; dx < kit.width; dx++) {
        const t = row.upperTiles[dx] ?? -1;
        if (t >= 0) upperCells.push({ dx, dy, tile: t });
      }
    }
    if (upperCells.length === 0) continue;
    const anchor = upperCells[0]!;
    for (const pos of upperPositions.get(anchor.tile) ?? []) {
      const ox = (pos % W) - anchor.dx;
      const oy = Math.floor(pos / W) - anchor.dy;
      if (ox < 0 || oy < 0 || ox + kit.width > W || oy + kit.height > H) continue;
      let alreadyCovered = false;
      for (let dy = 0; dy < kit.height && !alreadyCovered; dy++) {
        for (let dx = 0; dx < kit.width; dx++) {
          if (covered.has((oy + dy) * W + (ox + dx))) {
            alreadyCovered = true;
            break;
          }
        }
      }
      if (alreadyCovered) continue;
      let matches = 0;
      for (const cell of upperCells) {
        if (map.upperTiles[(oy + cell.dy) * W + (ox + cell.dx)] === cell.tile) matches += 1;
      }
      if (matches < upperCells.length) continue;
      const rawName = (kit.name ?? kit.id).trim();
      const core = kit.id === "bd-pick-desert-oasis-well"
        ? "분수대 · 돌 우물"
        : /^quick_house_|^bd-house-|^jp-bldg-|^mc-bld-/i.test(kit.id)
          ? `집 · ${extractCoreObjectName(rawName)}`
          : extractCoreObjectName(rawName);
      out.push({
        id: `kit_${kit.id}_${ox}_${oy}`,
        kind: "kit",
        name: rawName,
        coreName: core,
        kitId: kit.id,
        x: ox,
        y: oy,
        w: kit.width,
        h: kit.height,
      });
      markCovered(ox, oy, kit.width, kit.height);
    }
  }

  // 3) 남은 upperTiles 소품·나무 클러스터 탐지
  const groupNameByTile = new Map<number, string>();
  for (const g of tileset?.tileGroups ?? []) {
    for (const tid of g.tileIds ?? []) {
      if (!groupNameByTile.has(tid)) groupNameByTile.set(tid, g.name);
    }
  }
  const classifyUpperTile = (tile: number): string | null => {
    if (tile < 0) return null;
    const meta = tileset?.tileMeta?.[tile];
    const groupName = groupNameByTile.get(tile) ?? "";
    const text = `${meta?.label ?? ""} ${meta?.description ?? ""} ${(meta?.tags ?? []).join(" ")} ${groupName}`;
    if (/나무|침엽수|활엽수|소나무|벚나무|은행나무|느티나무|전나무|가로수|숲|tree|pine|conifer|oak|sakura|ginkgo/iu.test(text)) return "나무";
    if (/분수|수반|fountain/iu.test(text)) return "분수대";
    if (/우물|well/iu.test(text)) return "우물";
    if (/벤치|의자|bench|chair/iu.test(text)) return "벤치";
    if (/화분|꽃|화단|planter|pot|flower/iu.test(text)) return "화분";
    if (/울타리|펜스|산울타리|담장|fence|hedge/iu.test(text)) return "울타리";
    if (/바위|돌|암석|rock|stone|boulder/iu.test(text)) return "바위";
    if (/가로등|등불|횃불|lamp|lantern|torch/iu.test(text)) return "가로등";
    if (/동상|조각상|석상|statue/iu.test(text)) return "동상";
    if (/상자|통|배럴|오크통|crate|box|barrel/iu.test(text)) return "상자";
    if (/집|건물|주택|민가|오두막|지붕|house|building|roof/iu.test(text)) return "집";
    return meta?.label?.trim() || groupName || "소품";
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const startIdx = y * W + x;
      if (covered.has(startIdx)) continue;
      const cat = classifyUpperTile(map.upperTiles[startIdx] ?? -1);
      if (!cat) continue;
      const queue: { x: number; y: number }[] = [{ x, y }];
      covered.add(startIdx);
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.x < minX) minX = cur.x;
        if (cur.x > maxX) maxX = cur.x;
        if (cur.y < minY) minY = cur.y;
        if (cur.y > maxY) maxY = cur.y;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const nIdx = ny * W + nx;
            if (covered.has(nIdx)) continue;
            const nCat = classifyUpperTile(map.upperTiles[nIdx] ?? -1);
            if (nCat === cat && nx - minX < 8 && ny - minY < 8) {
              covered.add(nIdx);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }
      out.push({
        id: `prop_${cat}_${minX}_${minY}`,
        kind: "prop_cluster",
        name: cat,
        coreName: cat,
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      });
    }
  }
  return out;
}

function matchesPlacedObjectQuery(obj: PlacedMapObjectSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q || q === "선택 물체" || q === "물체" || q === "이거" || q === "이것") return true;
  const hay = `${obj.coreName} ${obj.name} ${obj.kitId ?? ""}`.toLowerCase();
  if (/^(?:성|성채|성곽|요새|왕성|성문|망루|castle|fortress|citadel|keep)$/iu.test(q)) {
    return /성|성채|왕성|요새|성문|망루|bd-castle|castle/iu.test(hay);
  }
  if (/^(?:집|주택|단독주택|민가|오두막|가옥|초가|저택|살림집|여관|상점|가게|노점|좌판|대장간|편의점|카페|건물|house|building|shop)$/iu.test(q)) {
    return /집|주택|민가|오두막|가옥|초가|저택|살림집|여관|상점|가게|노점|좌판|대장간|편의점|카페|건물|house|bldg|bld-|quick_house|cabin|inn|shop|manor|stall/iu.test(hay);
  }
  if (/^(?:분수|분수대|수반|fountain)$/iu.test(q)) {
    return /분수|수반|fountain|desert-oasis-well/iu.test(hay);
  }
  if (/^(?:우물|돌\s*우물|well)$/iu.test(q)) {
    return /우물|well/iu.test(hay);
  }
  if (/^(?:나무|소나무|벚나무|은행나무|느티나무|전나무|가로수|침엽수|활엽수|숲|tree)$/iu.test(q)) {
    return /나무|침엽수|활엽수|소나무|벚나무|은행나무|가로수|숲|bd-tree-|jp-prop-tree-|mc-prop-(?:street-tree|tree|blossom|ginkgo)|tree|pine/iu.test(hay);
  }
  const synonyms = acceptedObjectNames(query, []).names;
  return synonyms.some((syn) => hay.includes(syn.toLowerCase()));
}

function resolveSpatialZoneRect(
  phrase: string | null | undefined,
  map: GameMap,
  tileset: TilesetDef | undefined,
  target: StampRect,
): StampRect {
  if (!phrase) return target;
  const p = phrase.trim();
  if (p.includes("광장")) {
    const layoutPlaza = (map.layoutPlan?.regions ?? []).find((r) => r.role === "plaza" || r.role === "market");
    if (layoutPlaza && layoutPlaza.w > 0 && layoutPlaza.h > 0) {
      return { x: layoutPlaza.x, y: layoutPlaza.y, w: layoutPlaza.w, h: layoutPlaza.h };
    }
    const plazaTileIds = new Set<number>();
    for (const g of tileset?.tileGroups ?? []) {
      if (/plaza|광장/iu.test(`${g.id} ${g.name}`)) {
        for (const tid of g.tileIds ?? []) plazaTileIds.add(tid);
      }
    }
    let minX = map.width;
    let maxX = -1;
    let minY = map.height;
    let maxY = -1;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const l = map.lowerTiles[y * map.width + x] ?? -1;
        const meta = tileset?.tileMeta?.[l];
        if (plazaTileIds.has(l) || meta?.tags?.includes("plaza") || /광장/u.test(meta?.label ?? "")) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      const x0 = Math.max(0, minX - 1);
      const y0 = Math.max(0, minY - 1);
      const x1 = Math.min(map.width, maxX + 2);
      const y1 = Math.min(map.height, maxY + 2);
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return {
      x: target.x + Math.floor(target.w * 0.25),
      y: target.y + Math.floor(target.h * 0.25),
      w: Math.max(4, Math.ceil(target.w * 0.5)),
      h: Math.max(4, Math.ceil(target.h * 0.5)),
    };
  }
  const halfW = Math.max(1, Math.ceil(target.w * 0.55));
  const halfH = Math.max(1, Math.ceil(target.h * 0.55));
  const rightX = target.x + target.w - halfW;
  const bottomY = target.y + target.h - halfH;
  if (p === "오른쪽 위") return { x: rightX, y: target.y, w: halfW, h: halfH };
  if (p === "왼쪽 위") return { x: target.x, y: target.y, w: halfW, h: halfH };
  if (p === "오른쪽 아래") return { x: rightX, y: bottomY, w: halfW, h: halfH };
  if (p === "왼쪽 아래") return { x: target.x, y: bottomY, w: halfW, h: halfH };
  if (p === "위쪽") return { x: target.x, y: target.y, w: target.w, h: halfH };
  if (p === "아래쪽") return { x: target.x, y: bottomY, w: target.w, h: halfH };
  if (p === "오른쪽") return { x: rightX, y: target.y, w: halfW, h: target.h };
  if (p === "왼쪽") return { x: target.x, y: target.y, w: halfW, h: target.h };
  if (p === "한가운데" || p === "가운데") {
    return {
      x: target.x + Math.floor(target.w * 0.25),
      y: target.y + Math.floor(target.h * 0.25),
      w: Math.max(4, Math.ceil(target.w * 0.5)),
      h: Math.max(4, Math.ceil(target.h * 0.5)),
    };
  }
  return target;
}

function pickSurroundingGroundTile(map: GameMap, tileset: TilesetDef | undefined, rect: StampRect): number {
  const counts = new Map<number, number>();
  for (let y = rect.y - 1; y <= rect.y + rect.h; y++) {
    for (let x = rect.x - 1; x <= rect.x + rect.w; x++) {
      if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) continue;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const t = map.lowerTiles[y * map.width + x] ?? -1;
      if (t < 0) continue;
      const meta = tileset?.tileMeta?.[t];
      if (meta?.role === "wall" || meta?.role === "water") continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let bestTile = tileset?.id === "beodeul_city" ? 737 : 0;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestTile = tile;
    }
  }
  return bestTile;
}

function eraseObjectFootprintSteps(
  obj: PlacedMapObjectSummary,
  previewMap: GameMap,
  tileset: TilesetDef | undefined,
  mapId: string,
  label: string,
): StampStep[] {
  const out: StampStep[] = [];
  const rect: StampRect = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
  const placement = obj.placementId
    ? (previewMap.structurePlacements ?? []).find((p) => p.id === obj.placementId)
    : (previewMap.structurePlacements ?? []).find((p) => p.x < obj.x + obj.w && obj.x < p.x + p.w && p.y < obj.y + obj.h && obj.y < p.y + p.h);

  if (placement) {
    pendingStructureOps.push({ kind: "remove", mapId, placementId: placement.id });
    previewMap.structurePlacements = (previewMap.structurePlacements ?? []).filter((p) => p.id !== placement.id);
  }

  out.push({
    tool: "tile_erase",
    label,
    at: [{ x: obj.x, y: obj.y }],
    args: { mapId, rect, layer: "upper" },
  });

  // 하위 레이어 복원: structurePlacement.before 가 있으면 그 타일로, 아니면 키트가 건드린 하위 타일을 주변 땅 타일로 복원
  const restorePatches: { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number }[] = [];
  const fallbackGround = pickSurroundingGroundTile(previewMap, tileset, rect);
  const kit = obj.kitId ? (tileset?.structureKits ?? []).find((k) => k.id === obj.kitId) : undefined;
  const isCastlePlacement = Boolean(placement?.kitId.startsWith("bd-castle-"));
  for (let dy = 0; dy < rect.h; dy++) {
    for (let dx = 0; dx < rect.w; dx++) {
      const x = rect.x + dx;
      const y = rect.y + dy;
      if (x < 0 || y < 0 || x >= previewMap.width || y >= previewMap.height) continue;
      const idx = y * previewMap.width + x;
      previewMap.upperTiles[idx] = -1;
      if (previewMap.upperOverlayTiles) previewMap.upperOverlayTiles[idx] = -1;
      let restoreLower: number | null = null;
      if (isCastlePlacement) {
        restoreLower = fallbackGround;
      } else if (placement && x >= placement.x && x < placement.x + placement.w && y >= placement.y && y < placement.y + placement.h) {
        const bIdx = (y - placement.y) * placement.w + (x - placement.x);
        const bTile = placement.before.lower[bIdx];
        if (bTile !== undefined && bTile >= 0 && bTile !== previewMap.lowerTiles[idx]) {
          restoreLower = bTile;
        }
      } else if (kit && (kit.rows[dy]?.tiles[dx] ?? -1) >= 0) {
        restoreLower = fallbackGround;
      }
      if (restoreLower !== null && restoreLower !== previewMap.lowerTiles[idx]) {
        previewMap.lowerTiles[idx] = restoreLower;
        restorePatches.push({ x, y, lower: restoreLower, upper: -1 });
      } else {
        restorePatches.push({ x, y, upper: -1 });
      }
    }
  }
  if (restorePatches.length > 0) {
    pendingStructureOps.push({ kind: "tile_patch", mapId, patches: restorePatches });
  }
  return out;
}

function expandEraseAndMoveSteps(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  if (!steps.some((s) => s.tool === "erase_object" || s.tool === "move_object")) {
    return { steps, dropped: [] };
  }
  const out: StampStep[] = [];
  const dropped: string[] = [];
  const W = previewMap.width;
  const H = previewMap.height;

  for (const step of steps) {
    if (step.tool === "erase_object") {
      const query = typeof step.args.query === "string" ? step.args.query : extractEraseTargetNoun(facts.text) ?? "";
      const regionPhrase = typeof step.args.region === "string" ? step.args.region : extractSpatialZonePhrase(facts.text);
      const explicitRect = step.args.rect as StampRect | undefined;
      const zone = explicitRect ?? resolveSpatialZoneRect(regionPhrase, previewMap, tileset, facts.target);
      const placed = detectPlacedMapObjects(previewMap, tileset);
      const candidates = placed.filter((obj) => matchesPlacedObjectQuery(obj, query));
      if (candidates.length === 0) {
        // 이벤트 중에 이름이 맞는 것이 있으면 remove_event 로 처리
        const ev = (facts.placement?.existing.occupied ?? []).find((e) => e.name.includes(query) || query.includes(e.name));
        if (ev) {
          out.push({ tool: "remove_event", label: `${ev.name} 지우기`, args: { mapId: facts.mapId, eventId: ev.id } });
          continue;
        }
        dropped.push(`${step.label}: 맵에서 「${query || "대상"}」을(를) 찾지 못해 지우지 않았습니다`);
        continue;
      }
      const inZone = candidates.filter((obj) => {
        const cx = obj.x + obj.w / 2;
        const cy = obj.y + obj.h / 2;
        return cx >= zone.x - 2 && cx <= zone.x + zone.w + 2 && cy >= zone.y - 2 && cy <= zone.y + zone.h + 2;
      });
      const zoneCx = zone.x + zone.w / 2;
      const zoneCy = zone.y + zone.h / 2;
      const targets = inZone.length > 0
        ? inZone
        : [...candidates].sort((a, b) => Math.hypot(a.x + a.w / 2 - zoneCx, a.y + a.h / 2 - zoneCy) - Math.hypot(b.x + b.w / 2 - zoneCx, b.y + b.h / 2 - zoneCy)).slice(0, 1);

      targets.forEach((targetObj, idx) => {
        const itemLabel = idx === 0
          ? `${regionPhrase ? `${regionPhrase} ` : ""}${query || targetObj.coreName}${targets.length > 1 ? ` ${targets.length}곳` : ""} 지우기 (${targetObj.x},${targetObj.y})`
          : "";
        out.push(...eraseObjectFootprintSteps(targetObj, previewMap, tileset, facts.mapId, itemLabel));
      });
      continue;
    }

    if (step.tool === "move_object") {
      const query = typeof step.args.query === "string" ? step.args.query : extractMoveTargetNoun(facts.text) ?? "물체";
      const fromRegion = typeof step.args.fromRegion === "string" ? step.args.fromRegion : extractMoveSourcePhrase(facts.text);
      const toRegion = typeof step.args.toRegion === "string" ? step.args.toRegion : extractMoveDestinationPhrase(facts.text);
      const parsedShift = parseRelativeShift(facts.text);
      const dx = typeof step.args.dx === "number" ? step.args.dx : parsedShift?.dx ?? null;
      const dy = typeof step.args.dy === "number" ? step.args.dy : parsedShift?.dy ?? null;
      const toArg = cellOf(step.args.to);

      const placed = detectPlacedMapObjects(previewMap, tileset);
      const candidates = placed.filter((obj) => matchesPlacedObjectQuery(obj, query));
      if (candidates.length === 0) {
        const ev = (facts.placement?.existing.occupied ?? []).find((e) => e.name.includes(query) || query.includes(e.name));
        if (ev) {
          const destZone = resolveSpatialZoneRect(toRegion, previewMap, tileset, facts.target);
          const ex = dx !== null ? Math.max(0, Math.min(W - 1, ev.x + dx)) : toArg ? toArg.x : destZone.x + Math.floor(destZone.w / 2);
          const ey = dy !== null ? Math.max(0, Math.min(H - 1, ev.y + dy)) : toArg ? toArg.y : destZone.y + Math.floor(destZone.h / 2);
          out.push({ tool: "move_event", label: `${ev.name} 옮기기 (${ev.x},${ev.y}) → (${ex},${ey})`, args: { mapId: facts.mapId, eventId: ev.id, x: ex, y: ey } });
          continue;
        }
        dropped.push(`${step.label}: 맵에서 옮길 「${query}」을(를) 찾지 못했습니다`);
        continue;
      }

      const srcZone = fromRegion
        ? resolveSpatialZoneRect(fromRegion, previewMap, tileset, { x: 0, y: 0, w: W, h: H })
        : facts.target;
      const srcCx = srcZone.x + srcZone.w / 2;
      const srcCy = srcZone.y + srcZone.h / 2;
      const source = [...candidates].sort(
        (a, b) => Math.hypot(a.x + a.w / 2 - srcCx, a.y + a.h / 2 - srcCy) - Math.hypot(b.x + b.w / 2 - srcCx, b.y + b.h / 2 - srcCy),
      )[0]!;

      // 원본 타일 스냅샷을 먼저 뜬다
      const kit = source.kitId ? (tileset.structureKits ?? []).find((k) => k.id === source.kitId) : undefined;
      const liftedCells: { dx: number; dy: number; lower: number; upper: number; hasKitLower: boolean }[] = [];
      for (let r = 0; r < source.h; r++) {
        for (let c = 0; c < source.w; c++) {
          const idx = (source.y + r) * W + (source.x + c);
          const hasKitLower = kit
            ? (kit.rows[r]?.tiles[c] ?? -1) >= 0
            : source.kind === "structure" && /집|주택|민가|오두막|여관|상점|가게|건물|성|성채|왕성|요새|house|bldg|bld-|quick_house|bd-castle|bd-shop-|castle/iu.test(`${source.coreName} ${source.kitId ?? ""}`);
          liftedCells.push({
            dx: c,
            dy: r,
            lower: previewMap.lowerTiles[idx] ?? -1,
            upper: previewMap.upperTiles[idx] ?? -1,
            hasKitLower,
          });
        }
      }

      const oldPlacement = source.placementId
        ? (previewMap.structurePlacements ?? []).find((p) => p.id === source.placementId)
        : undefined;

      // 목적지 좌표 계산
      let destX = source.x;
      let destY = source.y;
      if (dx !== null || dy !== null) {
        destX = Math.max(0, Math.min(W - source.w, source.x + (dx ?? 0)));
        destY = Math.max(0, Math.min(H - source.h, source.y + (dy ?? 0)));
      } else if (toArg) {
        destX = Math.max(0, Math.min(W - source.w, toArg.x));
        destY = Math.max(0, Math.min(H - source.h, toArg.y));
      } else {
        const destZone = resolveSpatialZoneRect(toRegion, previewMap, tileset, { x: 0, y: 0, w: W, h: H });
        const targetCx = destZone.x + destZone.w / 2;
        const targetCy = destZone.y + destZone.h / 2;
        destX = Math.max(0, Math.min(W - source.w, Math.round(targetCx - source.w / 2)));
        destY = Math.max(0, Math.min(H - source.h, Math.round(targetCy - source.h / 2)));
      }

      // 1) 원본 자리 비우기 및 땅 복원
      const moveLabel = `${query} 옮기기 (${source.x},${source.y}) → ${toRegion ? `${toRegion} ` : dx !== null || dy !== null ? `(${dx ? `${dx > 0 ? `+${dx}` : dx}` : "0"},${dy ? `${dy > 0 ? `+${dy}` : dy}` : "0"}) ` : ""}(${destX},${destY})`;
      const eraseSteps = eraseObjectFootprintSteps(source, previewMap, tileset, facts.mapId, moveLabel);
      out.push(...eraseSteps);

      // 2) 목적지 자리 정리 및 찍기
      const destRect: StampRect = { x: destX, y: destY, w: source.w, h: source.h };
      const destBefore = captureStructureTiles(previewMap, destRect);
      if (oldPlacement) {
        // eraseObjectFootprintSteps 가 넣은 remove 대신 relocate 로 교체
        const remIdx = pendingStructureOps.findIndex((op) => op.kind === "remove" && op.placementId === oldPlacement.id);
        if (remIdx >= 0) pendingStructureOps.splice(remIdx, 1);
        pendingStructureOps.push({
          kind: "relocate",
          mapId: facts.mapId,
          placementId: oldPlacement.id,
          kitId: oldPlacement.kitId,
          x: destX,
          y: destY,
          w: source.w,
          h: source.h,
          before: destBefore,
        });
      }

      const destPatches: { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number }[] = [];
      for (const cell of liftedCells) {
        const x = destX + cell.dx;
        const y = destY + cell.dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const idx = y * W + x;
        previewMap.upperTiles[idx] = cell.upper >= 0 ? cell.upper : -1;
        if (cell.hasKitLower && cell.lower >= 0) {
          previewMap.lowerTiles[idx] = cell.lower;
        }
        destPatches.push({
          x,
          y,
          ...(cell.hasKitLower && cell.lower >= 0 ? { lower: cell.lower } : {}),
          upper: cell.upper >= 0 ? cell.upper : -1,
        });
      }
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
      if (oldPlacement?.kitId.startsWith("bd-castle-") && roadGroup) {
        const roadTileSet = new Set<number>(roadGroup.memberTileIds);
        const roadMask = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (roadTileSet.has(previewMap.lowerTiles[y * W + x] ?? -1)) roadMask[y * W + x] = 1;
          }
        }
        const oldGateX = source.x + Math.floor(source.w / 2);
        const newGateX = destX + Math.floor(source.w / 2);
        const gateExitY = destY + source.h - 1;
        const ry0 = Math.min(H - 1, gateExitY + 1);
        const ry1 = Math.min(H - 1, gateExitY + 2);
        for (let x = Math.min(oldGateX - 1, newGateX - 1); x <= Math.max(oldGateX, newGateX); x++) {
          if (x >= 0 && x < W) {
            roadMask[ry0 * W + x] = 1;
            roadMask[ry1 * W + x] = 1;
          }
        }
        const isCastleGateCell = (x: number, y: number): boolean =>
          Math.abs(x - newGateX) <= 1 && y === gateExitY;
        const roadSteps = applyBeodeulRoadAutotile(roadMask, previewMap, roadGroup, isCastleGateCell, new Set(), facts.mapId, "");
        for (const rs of roadSteps) {
          const cells = (rs.args.cells as { x: number; y: number }[] | undefined) ?? [];
          for (const c of cells) {
            destPatches.push({ x: c.x, y: c.y, lower: previewMap.lowerTiles[c.y * W + c.x] ?? 1008 });
          }
        }
      }
      if (destPatches.length > 0) {
        pendingStructureOps.push({ kind: "tile_patch", mapId: facts.mapId, patches: destPatches });
      }
      if (oldPlacement) {
        previewMap.structurePlacements = [
          ...(previewMap.structurePlacements ?? []),
          makeStructurePlacement(previewMap, {
            id: oldPlacement.id,
            kitId: oldPlacement.kitId,
            rect: destRect,
            before: destBefore,
          }),
        ];
      }
      continue;
    }

    out.push(step);
  }

  return { steps: out, dropped };
}

// ── ① 강(carve_river) · ② 언덕(sculpt_hill) · ④ 성·성채(place_castle) · ⑤ 시체들(place_corpses) · ⑥ 주변 맞춤 조경(harmonize_region) ──

function stampKitDirectSteps(
  kitId: string,
  ox: number,
  oy: number,
  previewMap: GameMap,
  tileset: TilesetDef,
  mapId: string,
  label = "",
  group?: string,
): StampStep[] {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === kitId);
  if (!kit) return [];
  const W = previewMap.width;
  const H = previewMap.height;
  const patches: { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number }[] = [];
  let anchorCell = { x: ox, y: oy };
  let hasAnchor = false;
  for (let dy = 0; dy < kit.height; dy++) {
    const row = kit.rows[dy];
    if (!row) continue;
    for (let dx = 0; dx < kit.width; dx++) {
      const x = ox + dx;
      const y = oy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const idx = y * W + x;
      const lt = row.tiles[dx] ?? -1;
      const ut = row.upperTiles?.[dx] ?? -1;
      if (lt >= 0) previewMap.lowerTiles[idx] = lt;
      if (ut >= 0) previewMap.upperTiles[idx] = ut;
      if (lt >= 0 || ut >= 0) {
        patches.push({
          x,
          y,
          lower: previewMap.lowerTiles[idx] ?? 737,
          upper: previewMap.upperTiles[idx] ?? -1,
        });
        if (!hasAnchor) {
          hasAnchor = true;
          anchorCell = { x, y };
        }
      }
    }
  }
  if (!hasAnchor) return [];
  pendingStructureOps.push({ kind: "tile_patch", mapId, patches });
  if (!label && !group) return [];
  return [
    {
      tool: "paint_tiles",
      label,
      ...(group ? { group } : {}),
      args: { mapId, layer: "lower", mode: "cells", tile: 737, cells: [anchorCell] },
    },
  ];
}

type CastleArchetypeId = "citadel" | "keep" | "gatehouse" | "outpost";

const CASTLE_ARCHETYPE_KO: Record<CastleArchetypeId, string> = {
  citadel: "A형: 왕성 원형(citadel)",
  keep: "B형: 안뜰 본성(keep)",
  gatehouse: "C형: 해자 성문루(gatehouse)",
  outpost: "D형: 망루 초소(outpost)",
};

type RampartSlot = {
  readonly kind: "tower" | "wall_left" | "wall_right" | "wall_center" | "gate";
  readonly dx: number;
  readonly w: number;
};

function buildFrontRampartSlots(
  cw: number,
  wantGate: boolean,
  wantTowers: boolean,
  includeGateTowers: boolean,
): readonly RampartSlot[] {
  const centerW = 5;
  const centerKind: RampartSlot["kind"] = wantGate ? "gate" : "wall_center";
  const hasGateTowers = wantTowers && includeGateTowers && cw >= 11;
  const gateBlockW = centerW + (hasGateTowers ? 6 : 0);
  const hasCornerTowers = wantTowers && (hasGateTowers ? cw >= 19 : cw >= 13);
  const cornerW = hasCornerTowers ? 3 : 0;
  const wingTotal = cw - gateBlockW - cornerW * 2;
  const leftWingW = Math.max(0, Math.floor(wingTotal / 2));
  const rightWingW = Math.max(0, wingTotal - leftWingW);

  const slots: RampartSlot[] = [];
  let cursor = 0;
  const pushSlot = (kind: RampartSlot["kind"], w: number): void => {
    if (w <= 0) return;
    slots.push({ kind, dx: cursor, w });
    cursor += w;
  };

  pushSlot("tower", cornerW);
  pushSlot("wall_left", leftWingW);
  if (hasGateTowers) pushSlot("tower", 3);
  pushSlot(centerKind, centerW);
  if (hasGateTowers) pushSlot("tower", 3);
  pushSlot("wall_right", rightWingW);
  pushSlot("tower", cornerW);

  // Non-overlapping 1-D slot plan invariant check
  let checkCursor = 0;
  for (const s of slots) {
    if (s.dx !== checkCursor || s.w <= 0) {
      throw new Error(`Invalid castle rampart slot plan at dx=${s.dx}, expected=${checkCursor}`);
    }
    checkCursor += s.w;
  }
  if (checkCursor !== cw) {
    throw new Error(`Castle rampart slot width mismatch: ${checkCursor} !== ${cw}`);
  }
  return slots;
}

function expandSpecialSpatialSteps(
  steps: readonly StampStep[],
  previewMap: GameMap,
  tileset: TilesetDef,
  facts: StampPlanFacts,
  variation = 0,
  project?: Project,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  if (
    !steps.some(
      (s) =>
        s.tool === "carve_river" ||
        s.tool === "sculpt_hill" ||
        s.tool === "place_castle" ||
        s.tool === "place_shop" ||
        s.tool === "place_corpses" ||
        s.tool === "harmonize_region" ||
        EXTENDED_STAMP_TOOLS.has(s.tool),
    )
  ) {
    return { steps, dropped: [] };
  }
  const out: StampStep[] = [];
  const dropped: string[] = [];
  const W = previewMap.width;
  const H = previewMap.height;
  const idx = (x: number, y: number): number => y * W + x;
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const houseCells = new Set<string>(protectedHouseCells(previewMap).map((c) => `${c.x},${c.y}`));
  const roadGroupForCtx = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");

  for (const step of steps) {
    if (EXTENDED_STAMP_TOOLS.has(step.tool)) {
      const extRes = expandExtendedSpatialStep(step, {
        project: project ?? store.getCurrent(),
        previewMap,
        tileset,
        facts,
        variation,
        stampKitDirect: (kitId, ox, oy, label, note, _group) =>
          stampKitDirectSteps(kitId, ox, oy, previewMap, tileset, facts.mapId, label, note),
        applyRoadAutotile: (roadMask, isProtectedCell, label) =>
          roadGroupForCtx
            ? applyBeodeulRoadAutotile(roadMask, previewMap, roadGroupForCtx, isProtectedCell, new Set(), facts.mapId, label)
            : [],
        queueTilePatch: (patches: readonly ExtendedTilePatch[]) => {
          pendingStructureOps.push({ kind: "tile_patch", mapId: facts.mapId, patches });
        },
        queueEventUpsert: (event: GameEvent) => {
          pendingStructureOps.push({ kind: "event_upsert", mapId: facts.mapId, event });
        },
        queueSwitchEnsure: (switchId: string, name: string) => {
          pendingStructureOps.push({ kind: "switch_ensure", switchId, name });
        },
        detectObjects: detectPlacedMapObjects,
      });
      out.push(...extRes.steps);
      dropped.push(...extRes.dropped);
      continue;
    }
    if (step.tool === "carve_river") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      const direction = step.args.direction === "vertical" ? "vertical" : "horizontal";
      const wantBridge = step.args.bridge !== false;
      const canalGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_canal_lake_47");
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");

      if (tileset.id === "beodeul_city" && canalGroup) {
        const waterMask = new Uint8Array(W * H);
        const cx = area.x + Math.floor(area.w / 2);
        const cy = area.y + Math.floor(area.h / 2);
        const waveSign = Math.abs(variation) % 2 === 0 ? 1 : -1;
        const shift = (Math.abs(variation) % 3) - 1;
        if (direction === "horizontal") {
          const baseY = Math.max(area.y + 1, Math.min(area.y + area.h - 5, cy - 2 + shift));
          for (let x = area.x; x < area.x + area.w; x++) {
            const distMid = x - cx;
            const wave = area.h >= 8 && Math.abs(distMid) >= 4 ? (distMid < 0 ? -waveSign : waveSign) : 0;
            const y0 = Math.max(0, Math.min(H - 4, baseY + wave));
            for (let dy = 0; dy < 4; dy++) {
              if (!houseCells.has(`${x},${y0 + dy}`)) waterMask[idx(x, y0 + dy)] = 1;
            }
          }
        } else {
          const baseX = Math.max(area.x + 1, Math.min(area.x + area.w - 5, cx - 2 + shift));
          for (let y = area.y; y < area.y + area.h; y++) {
            const distMid = y - cy;
            const wave = area.w >= 8 && Math.abs(distMid) >= 4 ? (distMid < 0 ? -waveSign : waveSign) : 0;
            const x0 = Math.max(0, Math.min(W - 4, baseX + wave));
            const isBridgeBand = wantBridge && Math.abs(distMid) <= 2;
            const span = isBridgeBand ? 5 : 4;
            for (let dx = 0; dx < span; dx++) {
              if (x0 + dx < W && !houseCells.has(`${x0 + dx},${y}`)) waterMask[idx(x0 + dx, y)] = 1;
            }
          }
        }

        // 강물 영역 위층 나무·소품 정리
        out.push({
          tool: "tile_erase",
          label: "",
          args: { mapId: facts.mapId, rect: area, layer: "upper" },
        });
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (inb(x, y) && !houseCells.has(`${x},${y}`)) previewMap.upperTiles[idx(x, y)] = -1;
          }
        }

        // 8방향 이웃 오토타일 계산으로 자연스러운 강둑과 물줄기 타일 배치
        const bits: readonly [number, number, number][] = [
          [0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8],
          [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128],
        ];
        const byWaterTile = new Map<number, { x: number; y: number }[]>();
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (!waterMask[idx(x, y)]) continue;
            let m = 0;
            for (const [dx, dy, bit] of bits) {
              const nx = x + dx;
              const ny = y + dy;
              if (!inb(nx, ny) || waterMask[idx(nx, ny)] === 1) m |= bit;
            }
            const tile = canalGroup.variantMap[String(m)] ?? 23152;
            previewMap.lowerTiles[idx(x, y)] = tile;
            const list = byWaterTile.get(tile) ?? [];
            list.push({ x, y });
            byWaterTile.set(tile, list);
          }
        }
        let first = true;
        for (const [tile, cells] of byWaterTile) {
          out.push({
            tool: "paint_tiles",
            label: first ? step.label : "",
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile, cells },
          });
          first = false;
        }

        // 다리 및 강변 진입로·수변 조경 배치
        if (wantBridge) {
          if (direction === "horizontal") {
            const baseY = Math.max(area.y + 1, Math.min(area.y + area.h - 5, cy - 2));
            const bx = Math.max(area.x + 1, Math.min(area.x + area.w - 4, cx - 1));
            // 남북 방향 돌다리(3×6, bd-pick-volcano-cave-bridge 또는 bd-bridge-arch) + 포석 진입로
            out.push(...stampKitDirectSteps("bd-pick-volcano-cave-bridge", bx, Math.max(0, baseY - 1), previewMap, tileset, facts.mapId, "강 위 돌다리 횡단교"));
            if (roadGroup) {
              const roadTile = roadGroup.memberTileIds[0] ?? 1008;
              const roadCells: { x: number; y: number }[] = [];
              for (const ry of [baseY - 2, baseY + 5]) {
                if (ry >= 0 && ry < H) {
                  for (let dx = 0; dx < 3; dx++) {
                    if (bx + dx < W && !houseCells.has(`${bx + dx},${ry}`)) {
                      previewMap.lowerTiles[idx(bx + dx, ry)] = roadTile;
                      roadCells.push({ x: bx + dx, y: ry });
                    }
                  }
                }
              }
              if (roadCells.length > 0) {
                out.push({
                  tool: "paint_tiles",
                  label: "",
                  args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: roadTile, cells: roadCells },
                });
              }
            }
            // 강변 물레방아·버드나무·수변 꽃화단 배치
            if (bx - 4 >= area.x && baseY - 2 >= 0) {
              out.push(...stampKitDirectSteps("bd-tree-f4f319", bx - 3, Math.max(0, baseY - 3), previewMap, tileset, facts.mapId));
            }
            if (bx + 4 < area.x + area.w && baseY - 2 >= 0) {
              out.push(...stampKitDirectSteps("bd-prop-lamp_crook", bx + 3, Math.max(0, baseY - 2), previewMap, tileset, facts.mapId));
            }
          } else {
            const baseX = Math.max(area.x + 1, Math.min(area.x + area.w - 5, cx - 2));
            const by = Math.max(area.y + 1, Math.min(area.y + area.h - 4, cy - 2));
            out.push(...stampKitDirectSteps("bd-pick-mountain-pass-stone-bridge", baseX, by, previewMap, tileset, facts.mapId, "강 위 아치 돌다리"));
          }
        }
        continue;
      }

      // 기타 타일셋 폴백: fill_region path 모드로 물줄기 생성
      const waterMat = facts.fillMaterials.find((m) => /물|강|수역|호수|water|river/iu.test(m)) ?? "물";
      const pathPoints = direction === "horizontal"
        ? [
            { x: area.x, y: Math.max(0, area.y + Math.floor(area.h / 2) - 1) },
            { x: area.x + Math.floor(area.w / 2), y: Math.min(H - 1, area.y + Math.floor(area.h / 2) + 1) },
            { x: area.x + area.w - 1, y: Math.max(0, area.y + Math.floor(area.h / 2) - 1) },
          ]
        : [
            { x: Math.max(0, area.x + Math.floor(area.w / 2) - 1), y: area.y },
            { x: Math.min(W - 1, area.x + Math.floor(area.w / 2) + 1), y: area.y + Math.floor(area.h / 2) },
            { x: Math.max(0, area.x + Math.floor(area.w / 2) - 1), y: area.y + area.h - 1 },
          ];
      out.push({
        tool: "fill_region",
        label: step.label,
        args: { mapId: facts.mapId, rect: area, path: pathPoints, width: 4, material: waterMat, clearUpper: true },
      });
      continue;
    }

    if (step.tool === "sculpt_hill") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      const levels = Math.max(1, Math.min(3, Number(step.args.levels) || 2));
      const wantStairs = step.args.stairs !== false;
      const x0 = Math.max(1, area.x);
      const y0 = Math.max(1, area.y);
      const x1 = Math.min(W - 2, area.x + area.w - 1);
      const y1 = Math.min(H - 3, area.y + area.h - 2);
      if (x1 - x0 < 3 || y1 - y0 < 3) {
        dropped.push(`${step.label}: 언덕을 빚을 영역이 너무 좁습니다(최소 4×4칸 필요)`);
        continue;
      }

      // 언덕 경계에 걸치는 기존 나무·소품을 먼저 정리해 두 단 걸침을 방지
      out.push({
        tool: "tile_erase",
        label: "",
        args: { mapId: facts.mapId, rect: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 2 }, layer: "upper" },
      });
      for (let y = y0; y <= Math.min(H - 1, y1 + 1); y++) {
        for (let x = x0; x <= x1; x++) {
          if (!houseCells.has(`${x},${y}`)) previewMap.upperTiles[idx(x, y)] = -1;
        }
      }

      // 1단 대지 + 2단 정상부(levels >= 2) ops 구성
      const ops: Record<string, unknown>[] = [
        { op: "rect", rect: [x0, y0, x1, y1], h: 1, mode: "set" },
      ];
      const hasTier2 = levels >= 2 && y1 - y0 >= 5 && x1 - x0 >= 5;
      const tier2X0 = x0 + 1;
      const tier2X1 = x1 - 1;
      const tier2Y1 = y0 + Math.floor((y1 - y0) * 0.55);
      if (hasTier2) {
        ops.push({ op: "rect", rect: [tier2X0, y0, tier2X1, tier2Y1], h: 2, mode: "set" });
      }

      const hillSeed = (Math.abs(variation) % 997) + 1;
      out.push({
        tool: "sculpt_relief",
        label: step.label,
        args: { mapId: facts.mapId, ops, seed: hillSeed },
      });

      // previewMap.relief 동기화 및 남쪽 절벽 중앙 오르막 돌계단(ramps 코드 5 = 북쪽 오르막 계단) 설정
      const nextLevels = previewMap.relief?.levels ? [...previewMap.relief.levels] : new Array<number>(W * H).fill(0);
      const nextRamps = previewMap.relief?.ramps ? [...previewMap.relief.ramps] : new Array<number>(W * H).fill(0);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          nextLevels[idx(x, y)] = 1;
        }
      }
      if (hasTier2) {
        for (let y = y0; y <= tier2Y1; y++) {
          for (let x = tier2X0; x <= tier2X1; x++) {
            nextLevels[idx(x, y)] = 2;
          }
        }
      }

      const stairRamps: { x: number; y: number; code: number }[] = [];
      const midX = Math.floor((x0 + x1) / 2);
      if (wantStairs) {
        const stairCode = rampCode("n", true);
        // 0단 -> 1단 남쪽 절벽 오르막 계단(2칸 폭)
        if (y1 + 1 < H) {
          for (const sx of [midX - 1, midX]) {
            if (sx >= x0 && sx <= x1) {
              nextRamps[idx(sx, y1 + 1)] = stairCode;
              stairRamps.push({ x: sx, y: y1 + 1, code: stairCode });
            }
          }
        }
        // 1단 -> 2단 남쪽 절벽 오르막 계단(2칸 폭)
        if (hasTier2 && tier2Y1 + 1 <= y1) {
          for (const sx of [midX - 1, midX]) {
            if (sx >= tier2X0 && sx <= tier2X1) {
              nextRamps[idx(sx, tier2Y1 + 1)] = stairCode;
              stairRamps.push({ x: sx, y: tier2Y1 + 1, code: stairCode });
            }
          }
        }
        pendingStructureOps.push({
          kind: "relief_ramps",
          mapId: facts.mapId,
          style: "grass-cliff",
          ramps: stairRamps,
        });
      }
      previewMap.relief = {
        width: W,
        height: H,
        levels: nextLevels,
        ramps: nextRamps,
        style: "grass-cliff",
      };

      // 언덕 꼭대기 평탄면에 전망 나무·벤치·꽃화단 배치 (한 단 안에만 앉혀 높이 규칙 100% 준수)
      if (tileset.id === "beodeul_city") {
        const topY = y0 + 1;
        if (x0 + 1 <= x1 - 3 && topY + 2 <= (hasTier2 ? tier2Y1 : y1)) {
          out.push(...stampKitDirectSteps("bd-tree-f4f319", x0 + 1, topY, previewMap, tileset, facts.mapId, "언덕 정상 전망 나무와 벤치"));
        }
        if (x1 - 3 >= x0 + 3 && topY + 1 <= (hasTier2 ? tier2Y1 : y1)) {
          out.push(...stampKitDirectSteps("bd-prop-bench_wood", x1 - 3, topY + 1, previewMap, tileset, facts.mapId));
        }
        if (midX - 1 >= x0 + 1 && topY <= (hasTier2 ? tier2Y1 - 1 : y1 - 1)) {
          out.push(...stampKitDirectSteps("bd-pick-wizard-tower-bed-flower", midX - 1, topY, previewMap, tileset, facts.mapId));
        }
      }
      continue;
    }

    if (step.tool === "place_shop") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      const kind = (step.args.kind as "potion" | "weapon" | "armor" | "general" | undefined) ?? "general";
      const shopName = typeof step.args.name === "string" ? step.args.name : "간단한 상점";
      const stockIds = Array.isArray(step.args.stock) && step.args.stock.length > 0
        ? (step.args.stock as string[])
        : ["item_potion", "item_hi_potion", "item_antidote"];
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");

      if (tileset.id === "beodeul_city") {
        const canFitShopHouse = area.w >= 6 && area.h >= 7 && !/노점|좌판/u.test(facts.text);
        const houseKitId = kind === "potion"
          ? "bd-house-h134_0"
          : kind === "weapon"
            ? (area.w >= 8 ? "bd-house-smithy_town" : "bd-house-h110_0")
            : kind === "armor"
              ? "bd-house-h110_0"
              : "bd-house-h134_0";
        const houseKit = canFitShopHouse ? (tileset.structureKits ?? []).find((k) => k.id === houseKitId) : undefined;
        const stallKitId = kind === "potion"
          ? "bd-prop-stall_herb_flower"
          : kind === "weapon" || kind === "armor"
            ? "bd-prop-stall_cheese_meat"
            : "bd-prop-stall_jug_bottle";
        const bannerKitId = kind === "potion" ? "bd-pick-walled-market-banner-teal" : "bd-pick-walled-market-banner-red";

        const shopX = Math.max(
          0,
          Math.min(
            W - (houseKit ? houseKit.width + 2 : 5),
            area.w >= (houseKit ? houseKit.width + 4 : 7) ? area.x + 1 : area.x,
          ),
        );
        const shopY = Math.max(0, Math.min(H - (houseKit ? houseKit.height + 2 : 6), area.y + 1));
        const clearW = Math.min(W - shopX, houseKit ? houseKit.width + 4 : 6);
        const clearH = Math.min(H - shopY, houseKit ? houseKit.height + 2 : 6);
        const clearRect: StampRect = { x: shopX, y: shopY, w: clearW, h: clearH };
        const buildingRect: StampRect = houseKit
          ? { x: shopX, y: shopY, w: houseKit.width, h: houseKit.height }
          : clearRect;
        const propClearPatches = collectOverlappingPropClearPatches(
          { previewMap, tileset, detectObjects: detectPlacedMapObjects },
          buildingRect,
          1,
          houseCells,
        );
        if (propClearPatches.length > 0) {
          pendingStructureOps.push({ kind: "tile_patch", mapId: facts.mapId, patches: propClearPatches });
        }
        const shopBefore = captureStructureTiles(previewMap, buildingRect);

        let shopTouchesHouse = false;
        for (let y = clearRect.y; y < clearRect.y + clearRect.h; y++) {
          for (let x = clearRect.x; x < clearRect.x + clearRect.w; x++) {
            if (houseCells.has(`${x},${y}`)) shopTouchesHouse = true;
            else if (inb(x, y)) previewMap.upperTiles[idx(x, y)] = -1;
          }
        }
        if (!shopTouchesHouse) {
          out.push({
            tool: "tile_erase",
            label: "",
            args: { mapId: facts.mapId, rect: clearRect, layer: "upper" },
          });
        }

        if (houseKit) {
          out.push(...stampKitDirectSteps(houseKit.id, shopX, shopY, previewMap, tileset, facts.mapId, `${shopName} 건물과 매대 시공`));
          const stallX = Math.min(W - 2, shopX + houseKit.width + (area.w >= houseKit.width + 3 ? 1 : 0));
          const stallY = shopY + Math.max(0, houseKit.height - 4);
          out.push(...stampKitDirectSteps(stallKitId, stallX, stallY, previewMap, tileset, facts.mapId));
          if (shopX - 1 >= area.x) {
            out.push(...stampKitDirectSteps(bannerKitId, shopX - 1, shopY + Math.max(0, houseKit.height - 4), previewMap, tileset, facts.mapId));
          } else if (stallX + 2 < area.x + area.w && stallX + 2 < W) {
            out.push(...stampKitDirectSteps(bannerKitId, stallX + 2, shopY + Math.max(0, houseKit.height - 4), previewMap, tileset, facts.mapId));
          }
          const doorPart = houseKit.parts?.find((p) => p.kind === "entrance");
          const doorX = shopX + (doorPart ? doorPart.dx : Math.floor(houseKit.width / 2));
          const doorY = shopY + (doorPart ? doorPart.dy + doorPart.h - 1 : houseKit.height - 1);
          const doorFrontY = Math.min(H - 1, shopY + houseKit.height);
          const merchantAt = { x: Math.min(W - 1, stallX), y: doorFrontY };

          // 상점 앞 포석 마당 및 기존 길 연결
          if (roadGroup) {
            const roadTileSet = new Set<number>(roadGroup.memberTileIds);
            const roadMask = new Uint8Array(W * H);
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                if (roadTileSet.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) roadMask[idx(x, y)] = 1;
              }
            }
            for (let rx = shopX; rx <= Math.min(W - 1, stallX + 1); rx++) {
              for (let ry = doorFrontY; ry <= Math.min(H - 1, doorFrontY + 1); ry++) {
                if (!houseCells.has(`${rx},${ry}`)) roadMask[idx(rx, ry)] = 1;
              }
            }
            let nearestRoad: { x: number; y: number; d: number } | null = null;
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                if (x >= shopX && x <= stallX + 1 && y >= doorFrontY && y <= doorFrontY + 1) continue;
                if (roadTileSet.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) {
                  const d = Math.abs(x - doorX) + Math.abs(y - doorFrontY);
                  if (!nearestRoad || d < nearestRoad.d) nearestRoad = { x, y, d };
                }
              }
            }
            if (nearestRoad) {
              const minY = Math.min(doorFrontY, nearestRoad.y);
              const maxY = Math.max(doorFrontY, nearestRoad.y);
              for (let y = minY; y <= maxY; y++) {
                for (const rx of [doorX, Math.min(W - 1, doorX + 1)]) {
                  if (!houseCells.has(`${rx},${y}`)) roadMask[idx(rx, y)] = 1;
                }
              }
              const minX = Math.min(doorX, nearestRoad.x);
              const maxX = Math.max(doorX, nearestRoad.x);
              for (let x = minX; x <= maxX; x++) {
                for (const ry of [nearestRoad.y, Math.min(H - 1, nearestRoad.y + 1)]) {
                  if (!houseCells.has(`${x},${ry}`)) roadMask[idx(x, ry)] = 1;
                }
              }
            }
            const shopDoorSet = new Set<string>([`${doorX},${doorY}`, `${doorX + 1},${doorY}`]);
            const roadSteps = applyBeodeulRoadAutotile(roadMask, previewMap, roadGroup, () => false, shopDoorSet, facts.mapId, "");
            const roadPatches: { readonly x: number; readonly y: number; readonly lower: number }[] = [];
            for (const rs of roadSteps) {
              const cells = (rs.args.cells as { x: number; y: number }[] | undefined) ?? [];
              for (const c of cells) {
                roadPatches.push({ x: c.x, y: c.y, lower: previewMap.lowerTiles[idx(c.x, c.y)] ?? 1008 });
              }
            }
            if (roadPatches.length > 0) {
              pendingStructureOps.push({ kind: "tile_patch", mapId: facts.mapId, patches: roadPatches });
            }
          }

          pendingStructureOps.push({
            kind: "relocate",
            mapId: facts.mapId,
            placementId: `shop_${shopX}_${shopY}`,
            kitId: `bd-shop-${kind}`,
            x: buildingRect.x,
            y: buildingRect.y,
            w: buildingRect.w,
            h: buildingRect.h,
            before: shopBefore,
          });
          previewMap.structurePlacements = [
            ...(previewMap.structurePlacements ?? []),
            makeStructurePlacement(previewMap, {
              id: `shop_${shopX}_${shopY}`,
              kitId: `bd-shop-${kind}`,
              rect: buildingRect,
              before: shopBefore,
            }),
          ];
          const npcName = kind === "potion" ? "물약 상인" : kind === "weapon" ? "무기 상인" : kind === "armor" ? "방어구 상인" : "상점 주인";
          out.push({
            tool: "make_villager",
            label: `${npcName} NPC (상점 재고 연결)`,
            args: {
              mapId: facts.mapId,
              name: npcName,
              home: merchantAt,
              graphic: { query: "merchant" },
              movement: "fixed",
              pages: [{
                lines: [
                  `${npcName}: 어서 오세요! 여행에 필요한 물품을 고르시지요.`,
                  `${npcName}: 오늘 막 들어온 싱싱한 회복약과 장비도 있답니다.`,
                ],
              }],
              shop: { stock: stockIds.map((itemId) => ({ itemId })) },
            },
          });
        } else {
          // 소형 영역 또는 노점 요청: 노점 매대 + 길드 깃발 + 상인 NPC
          const stallX = Math.max(0, Math.min(W - 3, area.x + Math.floor((area.w - 2) / 2)));
          const stallY = Math.max(0, Math.min(H - 5, area.y + 1));
          out.push(...stampKitDirectSteps(stallKitId, stallX, stallY, previewMap, tileset, facts.mapId, `${shopName} 노점 매대와 깃발 시공`));
          if (stallX - 1 >= 0) {
            out.push(...stampKitDirectSteps(bannerKitId, stallX - 1, stallY, previewMap, tileset, facts.mapId));
          }
          const npcName = kind === "potion" ? "물약 상인" : kind === "weapon" ? "무기 상인" : "상점 상인";
          out.push({
            tool: "make_villager",
            label: `${npcName} NPC (상점 재고 연결)`,
            args: {
              mapId: facts.mapId,
              name: npcName,
              home: { x: stallX, y: Math.min(H - 1, stallY + 4) },
              graphic: { query: "merchant" },
              movement: "fixed",
              pages: [{
                lines: [
                  `${npcName}: 어서 오세요! 좋은 물건 많으니 천천히 둘러보세요.`,
                ],
              }],
              shop: { stock: stockIds.map((itemId) => ({ itemId })) },
            },
          });
        }
        continue;
      }

      // 기타 타일셋 폴백
      out.push({
        tool: "place_house",
        label: `${shopName} 건물`,
        args: { mapId: facts.mapId, area, size: "medium", count: 1, stories: 1, kind: "상점" },
      });
      out.push({
        tool: "make_villager",
        label: `${shopName} 상인`,
        args: {
          mapId: facts.mapId,
          name: "상점 주인",
          home: { x: area.x + Math.floor(area.w / 2), y: Math.min(H - 1, area.y + area.h - 1) },
          graphic: { query: "merchant" },
          movement: "fixed",
          pages: [{ lines: ["상점 주인: 어서 오세요! 필요한 물건을 골라 보세요."] }],
          shop: { stock: stockIds.map((itemId) => ({ itemId })) },
        },
      });
      continue;
    }

    if (step.tool === "place_castle") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      if (area.w < 11 || area.h < 8) {
        dropped.push(`${step.label}: 성채는 최소 11×8칸이 필요합니다(현재 ${area.w}×${area.h}칸) — 더 크게 잡아 주세요`);
        continue;
      }
      const wantGate = step.args.gate !== false;
      const wantTowers = step.args.towers !== false;
      const askedArchetype = step.args.archetype as CastleArchetypeId | undefined;
      const castleKit = (tileset.structureKits ?? []).find((k) => k.id === "bd-castle");
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
      const canalGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_canal_lake_47");

      if (tileset.id === "beodeul_city" && castleKit) {
        const fitting: CastleArchetypeId[] = [];
        if (area.w >= 33 && area.h >= 33) fitting.push("citadel");
        if (area.w >= 19 && area.h >= 12) fitting.push("keep");
        if (area.w >= 14 && area.h >= 11) fitting.push("gatehouse");
        if (area.w >= 11 && area.h >= 8) fitting.push("outpost");

        let chosen: CastleArchetypeId;
        if (askedArchetype && fitting.includes(askedArchetype)) {
          chosen = askedArchetype;
        } else {
          const existingCastleKits = (previewMap.structurePlacements ?? [])
            .map((p) => p.kitId)
            .filter((id) => id.startsWith("bd-castle-"))
            .map((id) => id.replace("bd-castle-", "") as CastleArchetypeId);
          const recentSet = new Set<CastleArchetypeId>([
            ...existingCastleKits.slice(-(fitting.length - 1)),
            ...recentCastleArchetypes.slice(-(fitting.length - 1)),
          ]);
          const unused = fitting.filter((a) => !recentSet.has(a));
          const pool = unused.length > 0 ? unused : fitting;
          chosen = typeof step.args.seed === "number" ? pool[Math.abs(step.args.seed) % pool.length]! : pool[0]!;
        }
        recentCastleArchetypes.push(chosen);
        if (recentCastleArchetypes.length > 6) recentCastleArchetypes.shift();

        const archetypeNote = fitting.length > 1
          ? `다시 부르면 다른 형(${fitting.map((a) => CASTLE_ARCHETYPE_KO[a]).join(" · ")})`
          : `이 크기(${area.w}×${area.h})에선 ${CASTLE_ARCHETYPE_KO[chosen]}만 가능 — 17×12 이상이면 다른 형`;
        const castleLabel = `${step.label} [${CASTLE_ARCHETYPE_KO[chosen]}]`;

        // 아키타입별 홀수 대칭 폭(cw) 및 높이(ch) 산정 (주변 소품·우물과 최소 1칸 여유 확보)
        const oddAtMost = (maxW: number): number => (maxW % 2 === 1 ? maxW : maxW - 1);
        const cw = chosen === "citadel"
          ? 33
          : chosen === "keep"
            ? Math.max(19, Math.min(23, oddAtMost(area.w - (area.w >= 21 ? 1 : 0))))
            : chosen === "gatehouse"
              ? Math.max(13, Math.min(21, oddAtMost(area.w - (area.w >= 14 ? 1 : 0))))
              : Math.max(11, Math.min(17, oddAtMost(area.w - (area.w >= 12 ? 1 : 0))));
        const ch = chosen === "citadel"
          ? 33
          : chosen === "keep"
            ? Math.max(12, Math.min(16, area.h - (area.h >= 17 ? 1 : 0)))
            : chosen === "gatehouse"
              ? Math.max(11, Math.min(14, area.h - (area.h >= 13 ? 1 : 0)))
              : Math.max(8, Math.min(12, area.h - (area.h >= 10 ? 1 : 0)));

        // 좌측에 우물·건물 등이 바짝 붙어 있으면 1칸 우측 여백을 우선 확보
        const padX = area.w - cw;
        const ox = Math.max(0, Math.min(W - cw, area.x + (padX === 1 ? 1 : Math.floor(padX / 2))));
        const oy = Math.max(0, Math.min(H - ch, area.y + Math.floor((area.h - ch) / 2)));
        const castleRect: StampRect = { x: ox, y: oy, w: cw, h: ch };
        const castlePropClears = collectOverlappingPropClearPatches(
          { previewMap, tileset, detectObjects: detectPlacedMapObjects },
          castleRect,
          1,
          houseCells,
        );
        const castleBefore = captureStructureTiles(previewMap, castleRect);

        let castleTouchesHouse = false;
        for (let y = oy; y < Math.min(H, oy + ch); y++) {
          for (let x = ox; x < ox + cw; x++) {
            if (houseCells.has(`${x},${y}`)) castleTouchesHouse = true;
            else previewMap.upperTiles[idx(x, y)] = -1;
          }
        }
        if (!castleTouchesHouse) {
          out.push({
            tool: "tile_erase",
            label: "",
            args: { mapId: facts.mapId, rect: castleRect, layer: "upper" },
          });
        }

        const touchedCells = new Set<number>(castlePropClears.map((p) => idx(p.x, p.y)));
        const setCell = (x: number, y: number, lt: number, ut: number): void => {
          if (!inb(x, y) || houseCells.has(`${x},${y}`)) return;
          const cellIdx = idx(x, y);
          touchedCells.add(cellIdx);
          if (lt >= 0) previewMap.lowerTiles[cellIdx] = lt;
          previewMap.upperTiles[cellIdx] = ut >= 0 ? ut : -1;
        };

        // 3×9 원형 망루 스탬프 도우미 (계단 난간·물가 갈대 잔상을 제거한 순수 대칭 원탑)
        const stampCleanRoundTower = (tx: number, topY: number): void => {
          for (let dy = 0; dy < 9; dy++) {
            const srcRow = castleKit.rows[14 + dy]!;
            for (let dx = 0; dx < 3; dx++) {
              const ut = dy === 0
                ? (dx === 0 ? -1 : srcRow.upperTiles?.[1 + dx] ?? -1)
                : (srcRow.upperTiles?.[11 + dx] ?? -1);
              const lt = dy === 0
                ? (previewMap.lowerTiles[idx(tx + dx, topY)] ?? 1509)
                : dy <= 3
                  ? 1509
                  : (srcRow.tiles[11 + dx] ?? 1509);
              setCell(tx + dx, topY + dy, lt, ut);
            }
          }
        };

        // 북쪽 흉벽(rows 0..2 of bd-castle) 스탬프 도우미 (좌우 완전 대칭)
        const stampNorthBattlement = (yStart: number, xStart: number, width: number): void => {
          for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < width; dx++) {
              const isEdge = dx === 0 || dx === width - 1;
              const pairCol = dx <= Math.floor((width - 1) / 2) ? dx : (width - 1 - dx);
              const lt = dy === 0
                ? 2
                : dy === 1
                  ? (isEdge ? 80 : 80 + (pairCol % 2))
                  : (isEdge ? 251 : 251 + (pairCol % 2));
              setCell(xStart + dx, yStart + dy, lt, -1);
            }
          }
        };

        // 1-D 비겹침 슬롯 계획(buildFrontRampartSlots)에 따른 전면 성벽·망루·성문 스탬프 도우미
        const stampFrontRampartBySlots = (wallBottomY: number, includeGateTowers: boolean): void => {
          const slots = buildFrontRampartSlots(cw, wantGate, wantTowers, includeGateTowers);
          const wallTopY = wallBottomY - 3; // rows 19..22 (4 rows)
          const towerTopY = wallBottomY - 8; // rows 14..22 (9 rows)
          for (const slot of slots) {
            if (slot.kind === "tower") {
              stampCleanRoundTower(ox + slot.dx, towerTopY);
            } else if (slot.kind === "gate") {
              // R18: 성문 뒤 깨끗한 안뜰 석판 + 좌우 난간 끝
              for (let dx = 0; dx < 5; dx++) {
                setCell(ox + slot.dx + dx, wallTopY - 1, dx === 0 || dx === 4 ? 2855 : 1509, -1);
              }
              for (let dy = 0; dy < 4; dy++) {
                const srcRow = castleKit.rows[19 + dy]!;
                for (let dx = 0; dx < 5; dx++) {
                  setCell(
                    ox + slot.dx + dx,
                    wallTopY + dy,
                    srcRow.tiles[14 + dx] ?? 1509,
                    srcRow.upperTiles?.[14 + dx] ?? -1,
                  );
                }
              }
            } else {
              // wall_left, wall_right, wall_center: 좌우 대칭 성벽 슬라이스 (절대 % 7 로 끊기지 않게 대칭 매핑)
              for (let dx = 0; dx < slot.w; dx++) {
                const distFromOuter = slot.kind === "wall_right" ? (slot.w - 1 - dx) : dx;
                const wallCol = 4 + Math.min(6, distFromOuter);
                setCell(ox + slot.dx + dx, wallTopY - 1, 2850, -1);
                for (let dy = 0; dy < 4; dy++) {
                  const srcRow = castleKit.rows[19 + dy]!;
                  setCell(ox + slot.dx + dx, wallTopY + dy, srcRow.tiles[wallCol] ?? 1509, -1);
                }
              }
            }
          }
        };

        // 수호 기사 석상(2×3, cols 9..10, rows 15..17) 스탬프 도우미
        const stampKnightStatue = (sx: number, sy: number): void => {
          for (let dy = 0; dy < 3; dy++) {
            const srcRow = castleKit.rows[15 + dy]!;
            for (let dx = 0; dx < 2; dx++) {
              setCell(sx + dx, sy + dy, srcRow.tiles[9 + dx] ?? 1509, srcRow.upperTiles?.[9 + dx] ?? -1);
            }
          }
        };

        const gateCenterCol = ox + Math.floor(cw / 2);
        let gateExitY = oy + ch - 1;

        if (chosen === "citadel") {
          // A형: 33×33 버들항 왕성 전체 키트 원형 배치
          for (let dy = 0; dy < 33; dy++) {
            const srcRow = castleKit.rows[dy]!;
            for (let dx = 0; dx < 33; dx++) {
              const lt = srcRow.tiles[dx] ?? -1;
              const ut = srcRow.upperTiles?.[dx] ?? -1;
              setCell(ox + dx, oy + dy, lt, ut);
            }
          }
          gateExitY = oy + 32;
        } else if (chosen === "keep") {
          // B형: 안뜰 본성(keep) — 북쪽 궁전 본성(rows 0..10) + 중앙 포석 안뜰·기사 석상 + 남쪽 외성벽·성문(좌우 모서리 원탑)
          for (let dy = 0; dy < ch; dy++) {
            for (let dx = 0; dx < cw; dx++) {
              setCell(ox + dx, oy + dy, 1509, -1);
            }
          }
          stampNorthBattlement(oy, ox, cw);
          // 궁전 본채(cols 11..21) + 좌우 날개(cols 5..10 / 22..27, 양끝 지붕 경사 보존)
          const keepHalfW = Math.min(11, Math.floor((cw - 1) / 2));
          const keepStartX = ox + Math.floor(cw / 2) - keepHalfW;
          const wingW = Math.max(0, keepHalfW - 5);
          const leftWingCols = wingW <= 4 ? [5, 6, 9, 10].slice(0, wingW) : wingW === 5 ? [5, 6, 7, 9, 10] : [5, 6, 7, 8, 9, 10];
          const rightWingCols = wingW <= 4 ? [22, 23, 26, 27].slice(0, wingW) : wingW === 5 ? [22, 23, 25, 26, 27] : [22, 23, 24, 25, 26, 27];
          for (let dy = 0; dy <= 10; dy++) {
            const srcRow = castleKit.rows[dy]!;
            for (let kdx = -keepHalfW; kdx <= keepHalfW; kdx++) {
              const srcCol = kdx < -5
                ? (leftWingCols[kdx + keepHalfW] ?? 16 + kdx)
                : kdx > 5
                  ? (rightWingCols[kdx - 6] ?? 16 + kdx)
                  : 16 + kdx;
              const lt = srcRow.tiles[srcCol] ?? 1509;
              const ut = srcRow.upperTiles?.[srcCol] ?? -1;
              setCell(keepStartX + kdx + keepHalfW, oy + dy, lt, ut);
            }
          }
          // 본성 대문에서 남쪽 성문까지 이어지는 3칸 폭 왕실 카펫 포석(3221)
          for (let y = oy + 11; y < oy + ch; y++) {
            for (let rx = gateCenterCol - 1; rx <= gateCenterCol + 1; rx++) {
              setCell(rx, y, 3221, -1);
            }
          }
          // 남쪽 외성벽(모서리 탑 + 성벽 + 중앙 성문, 본성 쌍둥이 탑을 가리지 않게 성문 옆 탑은 생략)
          stampFrontRampartBySlots(oy + ch - 1, false);
          if (cw >= 19 && ch >= 15) {
            stampKnightStatue(gateCenterCol - 4, oy + ch - 7);
            stampKnightStatue(gateCenterCol + 3, oy + ch - 7);
          }
          gateExitY = oy + ch - 1;
        } else if (chosen === "gatehouse") {
          // C형: 해자 성문루(gatehouse) — 북쪽 흉벽 + 안뜰(깃발·화로/석상) + 전면 성문루·원탑 + 남쪽 수로 해자 & 도개교
          const moatRows = ch >= 13 ? 3 : 2;
          const wallBottomY = oy + ch - 1 - moatRows;
          for (let dy = 0; dy <= wallBottomY - oy; dy++) {
            for (let dx = 0; dx < cw; dx++) {
              setCell(ox + dx, oy + dy, 1509, -1);
            }
          }
          stampNorthBattlement(oy, ox, cw);
          for (let y = oy + 3; y <= wallBottomY; y++) {
            for (let rx = gateCenterCol - 1; rx <= gateCenterCol + 1; rx++) {
              setCell(rx, y, 3221, -1);
            }
          }
          // 안뜰 대칭 장식: 넓은 경우(cw>=19) 기사 석상 + 붉은 깃발, 14×11(cw=13)인 경우 중앙 통로 좌우 대칭 깃발
          const bannerKit = (tileset.structureKits ?? []).find((k) => k.id === "bd-pick-walled-market-banner-red");
          if (bannerKit && wallBottomY - oy >= 7) {
            const by = oy + 2;
            for (const bx of [gateCenterCol - 2, gateCenterCol + 2]) {
              for (let bdy = 0; bdy < bannerKit.height; bdy++) {
                const ut = bannerKit.rows[bdy]?.upperTiles?.[0] ?? -1;
                if (ut >= 0) setCell(bx, by + bdy, previewMap.lowerTiles[idx(bx, by + bdy)] ?? 1509, ut);
              }
            }
          }
          if (cw >= 19 && wallBottomY - oy >= 8) {
            stampKnightStatue(ox + 4, oy + 3);
            stampKnightStatue(ox + cw - 6, oy + 3);
          }
          stampFrontRampartBySlots(wallBottomY, true);

          // 남쪽 해자(beodeul_canal_lake_47 대칭 오토타일) + 중앙 3칸 도개교(cols 15..17, rows 23..25)
          const moatY0 = wallBottomY + 1;
          const moatMask = new Uint8Array(W * H);
          for (let my = moatY0; my < oy + ch; my++) {
            for (let dx = 0; dx < cw; dx++) {
              if (wantGate && Math.abs(ox + dx - gateCenterCol) <= 1) continue;
              moatMask[idx(ox + dx, my)] = 1;
            }
          }
          const bits: readonly [number, number, number][] = [
            [0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8],
            [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128],
          ];
          for (let my = moatY0; my < oy + ch; my++) {
            for (let dx = 0; dx < cw; dx++) {
              const mx = ox + dx;
              if (!moatMask[idx(mx, my)]) continue;
              let m = 0;
              for (const [bdx, bdy, bit] of bits) {
                const nx = mx + bdx;
                const ny = my + bdy;
                if (inb(nx, ny) && moatMask[idx(nx, ny)] === 1) m |= bit;
              }
              const wTile = canalGroup?.variantMap[String(m)] ?? 23152;
              setCell(mx, my, wTile, -1);
            }
          }
          if (wantGate) {
            const bridgeRows = moatRows === 3 ? [23, 24, 25] : [23, 25];
            bridgeRows.forEach((kitRowIdx, bdy) => {
              const srcRow = castleKit.rows[kitRowIdx]!;
              for (let bdx = -1; bdx <= 1; bdx++) {
                setCell(
                  gateCenterCol + bdx,
                  moatY0 + bdy,
                  srcRow.tiles[16 + bdx] ?? 3221,
                  srcRow.upperTiles?.[16 + bdx] ?? -1,
                );
              }
            });
          }
          gateExitY = oy + ch - 1;
        } else {
          // D형: 망루 초소 · 정원 요새(outpost) — bd-mpart-tower 쌍둥이 옆탑 + bd-garden-gate 정문 + 돌담·가로등·청록 깃발·중앙 분수
          const mpartTower = (tileset.structureKits ?? []).find((k) => k.id === "bd-mpart-tower");
          const gardenGate = (tileset.structureKits ?? []).find((k) => k.id === "bd-garden-gate");
          const lampPost = (tileset.structureKits ?? []).find((k) => k.id === "bd-mpart-lamp-post");
          const cypressTub = (tileset.structureKits ?? []).find((k) => k.id === "bd-mpart-cypress-tub");
          const tealBanner = (tileset.structureKits ?? []).find((k) => k.id === "bd-pick-walled-market-banner-teal");

          for (let dy = 0; dy < ch; dy++) {
            for (let dx = 0; dx < cw; dx++) {
              const isInnerPlaza = dx >= 2 && dx < cw - 2 && dy >= 2 && dy < ch - 2;
              setCell(ox + dx, oy + dy, isInnerPlaza ? 3221 : 1509, -1);
            }
          }
          for (let y = oy + 1; y < oy + ch; y++) {
            for (let rx = gateCenterCol - 1; rx <= gateCenterCol + 1; rx++) {
              setCell(rx, y, 3221, -1);
            }
          }
          // 북쪽 흉벽(3줄) 및 좌우 낮은 돌담(23527) 테두리
          stampNorthBattlement(oy, ox, cw);
          for (let dy = 3; dy < ch - 1; dy++) {
            setCell(ox, oy + dy, 1509, 23527);
            setCell(ox + cw - 1, oy + dy, 1509, 23527);
          }
          // 남쪽 돌담 + 중앙 정원 철문(bd-garden-gate, 5×3) + 좌우 원뿔 옆탑(bd-mpart-tower, 3×9)
          const southY = oy + ch - 1;
          for (let dx = 0; dx < cw; dx++) {
            if (wantGate && Math.abs(ox + dx - gateCenterCol) <= 2) continue;
            setCell(ox + dx, southY, 1509, 23527);
          }
          if (wantGate && gardenGate && ch >= 4) {
            const gx = gateCenterCol - 2;
            const gy = southY - 2;
            for (let dy = 0; dy < 3; dy++) {
              const r = gardenGate.rows[dy]!;
              for (let dx = 0; dx < 5; dx++) {
                const ut = r.upperTiles?.[dx] ?? -1;
                setCell(gx + dx, gy + dy, 3221, ut);
              }
            }
          }
          if (wantTowers && mpartTower && ch >= 9) {
            const ty = southY - 8;
            for (const tx of [ox, ox + cw - 3]) {
              for (let dy = 0; dy < 9; dy++) {
                const r = mpartTower.rows[dy]!;
                for (let dx = 0; dx < 3; dx++) {
                  const ut = r.upperTiles?.[dx] ?? -1;
                  if (ut >= 0) setCell(tx + dx, ty + dy, 1509, ut);
                }
              }
            }
          }
          // 안뜰 대칭 사이프러스 화분·쌍등 가로등·청록 길드 깃발·중앙 분수대(3×3)
          if (cypressTub && ch >= 9) {
            for (const cxPos of [ox + 3, ox + cw - 4]) {
              for (let dy = 0; dy < 3; dy++) {
                const ut = cypressTub.rows[dy]?.upperTiles?.[0] ?? -1;
                if (ut >= 0) setCell(cxPos, oy + 2 + dy, 3221, ut);
              }
            }
          }
          if (lampPost && ch >= 9) {
            for (const lxPos of [gateCenterCol - 3, gateCenterCol + 3]) {
              for (let dy = 0; dy < 3; dy++) {
                const ut = lampPost.rows[dy]?.upperTiles?.[0] ?? -1;
                if (ut >= 0) setCell(lxPos, oy + Math.max(3, ch - 6) + dy, 3221, ut);
              }
            }
          }
          if (tealBanner && ch >= 10) {
            for (const bxPos of [gateCenterCol - 2, gateCenterCol + 2]) {
              for (let dy = 0; dy < 4; dy++) {
                const ut = tealBanner.rows[dy]?.upperTiles?.[0] ?? -1;
                if (ut >= 0) setCell(bxPos, oy + 2 + dy, 3221, ut);
              }
            }
          }
          if (cw >= 15 && ch >= 11) {
            const fLowerRows: readonly (readonly [number, number, number])[] = [
              [9050, 9051, 9052],
              [9216, 9217, 9222],
              [9394, 9399, 9404],
            ];
            const fUpperRows: readonly (readonly [number, number, number])[] = [
              [2429, 2432, 2437],
              [2590, 9218, 2600],
              [9395, 9400, 9405],
            ];
            const fy0 = oy + Math.max(3, Math.floor((ch - 4) / 2));
            for (let dy = 0; dy < 3; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                setCell(gateCenterCol + dx, fy0 + dy, fLowerRows[dy]![dx + 1]!, fUpperRows[dy]![dx + 1]!);
              }
            }
          }
          gateExitY = southY;
        }

        // 성채 좌·우 외벽에 기존 도로가 옆구리로 막다른 충돌하는 경우 1칸 여유 잔디(737)로 정리하고, 성문 출구에서 가장 가까운 도로까지 포석 길 연결
        if (roadGroup) {
          const roadTileSet = new Set<number>(roadGroup.memberTileIds);
          for (let y = oy; y < oy + ch; y++) {
            for (const sideX of [ox - 1, ox + cw]) {
              if (inb(sideX, y) && roadTileSet.has(previewMap.lowerTiles[idx(sideX, y)] ?? -1)) {
                setCell(sideX, y, 737, -1);
              }
            }
          }
          if (wantGate) {
            const roadMask = new Uint8Array(W * H);
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                if (roadTileSet.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) roadMask[idx(x, y)] = 1;
              }
            }
            let nearestRoad: { x: number; y: number; d: number } | null = null;
            for (let y = 0; y < H; y++) {
              for (let x = 0; x < W; x++) {
                if (x >= ox - 1 && x <= ox + cw && y >= oy && y < oy + ch) continue;
                if (roadMask[idx(x, y)] === 1) {
                  const d = Math.abs(x - gateCenterCol) + Math.abs(y - (gateExitY + 1));
                  if (!nearestRoad || d < nearestRoad.d) nearestRoad = { x, y, d };
                }
              }
            }
            const startY = Math.min(H - 1, gateExitY + 1);
            const turnY = Math.min(H - 2, gateExitY + 2);
            for (let y = startY; y <= Math.min(H - 1, turnY + 1); y++) {
              for (let rx = gateCenterCol - 1; rx <= gateCenterCol; rx++) {
                if (inb(rx, y) && !houseCells.has(`${rx},${y}`)) roadMask[idx(rx, y)] = 1;
              }
            }
            if (nearestRoad) {
              const targetX = nearestRoad.x;
              const minX = Math.min(targetX, gateCenterCol);
              const maxX = Math.max(targetX, gateCenterCol);
              for (let x = minX; x <= maxX; x++) {
                for (const ry of [turnY, Math.min(H - 1, turnY + 1)]) {
                  if (inb(x, ry) && !houseCells.has(`${x},${ry}`)) roadMask[idx(x, ry)] = 1;
                }
              }
              const minY = Math.min(nearestRoad.y, turnY);
              const maxY = Math.max(nearestRoad.y, turnY + 1);
              for (let y = minY; y <= maxY; y++) {
                for (const rx of [Math.max(0, targetX - 1), targetX]) {
                  if (inb(rx, y) && !houseCells.has(`${rx},${y}`)) roadMask[idx(rx, y)] = 1;
                }
              }
            }
            // applyBeodeulRoadAutotile 결과를 touchedCells 에 반영
            const isCastleGateCell = (x: number, y: number): boolean =>
              Math.abs(x - gateCenterCol) <= 1 && y === gateExitY;
            const roadSteps = applyBeodeulRoadAutotile(roadMask, previewMap, roadGroup, isCastleGateCell, new Set(), facts.mapId, "");
            for (const rs of roadSteps) {
              const cells = (rs.args.cells as { x: number; y: number }[] | undefined) ?? [];
              for (const c of cells) touchedCells.add(idx(c.x, c.y));
            }
          }
        }

        // 성채를 structurePlacements 에 등록하여 "성 오른쪽으로 몇 칸 옮겨줘" (move_object) 및 지우기(erase_object) 가 동작하게 함
        const placementId = `castle_${ox}_${oy}`;
        pendingStructureOps.push({
          kind: "relocate",
          mapId: facts.mapId,
          placementId,
          kitId: `bd-castle-${chosen}`,
          x: ox,
          y: oy,
          w: cw,
          h: ch,
          before: castleBefore,
        });
        previewMap.structurePlacements = [
          ...(previewMap.structurePlacements ?? []),
          makeStructurePlacement(previewMap, {
            id: placementId,
            kitId: `bd-castle-${chosen}`,
            rect: castleRect,
            before: castleBefore,
          }),
        ];

        const patches: { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number }[] = [];
        let anchorCell = { x: ox, y: oy };
        let anchorTile = 1509;
        let hasAnchor = false;
        for (const cellIdx of touchedCells) {
          const x = cellIdx % W;
          const y = Math.floor(cellIdx / W);
          const lt = previewMap.lowerTiles[cellIdx] ?? -1;
          const ut = previewMap.upperTiles[cellIdx] ?? -1;
          patches.push({
            x,
            y,
            ...(lt >= 0 ? { lower: lt } : {}),
            upper: ut,
          });
          if (!hasAnchor && lt >= 0) {
            hasAnchor = true;
            anchorCell = { x, y };
            anchorTile = lt;
          }
        }
        pendingStructureOps.push({ kind: "tile_patch", mapId: facts.mapId, patches });
        out.push({
          tool: "paint_tiles",
          label: castleLabel,
          note: archetypeNote,
          args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: anchorTile, cells: [anchorCell] },
        });
        continue;
      }

      // 기타 타일셋 폴백: build_wall + place_door
      const wallMat = facts.wallMaterials?.[0] ?? "성벽";
      out.push({
        tool: "build_wall",
        label: step.label,
        args: { mapId: facts.mapId, rect: area, material: wallMat },
      });
      continue;
    }

    if (step.tool === "place_corpses") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      const withDebris = step.args.withDebris !== false;
      if (tileset.id === "beodeul_city") {
        // 대상 구역 안의 기존 잔디 장식 정리
        let corpsesTouchesHouse = false;
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (houseCells.has(`${x},${y}`)) corpsesTouchesHouse = true;
            else if (inb(x, y)) previewMap.upperTiles[idx(x, y)] = -1;
          }
        }
        if (!corpsesTouchesHouse) {
          out.push({
            tool: "tile_erase",
            label: "",
            args: { mapId: facts.mapId, rect: area, layer: "upper" },
          });
        }

        const cx = area.x + Math.floor(area.w / 2);
        const cy = area.y + Math.floor(area.h / 2);
        const placements: readonly { readonly kitId: string; readonly x: number; readonly y: number }[] = [
          { kitId: "bd-pick-aqueduct-sewer-bone-heap", x: Math.max(area.x, cx - 3), y: Math.max(area.y, cy - 1) },
          { kitId: "bd-pick-aqueduct-sewer-bone-heap", x: Math.min(area.x + area.w - 2, cx + 1), y: Math.min(area.y + area.h - 2, cy + 1) },
          { kitId: "bd-pick-desert-oasis-bones", x: Math.max(area.x, cx - 1), y: Math.max(area.y, cy - 2) },
          { kitId: "bd-pick-desert-oasis-bones", x: Math.max(area.x, cx - 4), y: Math.min(area.y + area.h - 1, cy + 2) },
          { kitId: "bd-pick-aqueduct-sewer-skulls", x: cx, y: cy },
          { kitId: "bd-pick-aqueduct-sewer-skulls", x: Math.min(area.x + area.w - 1, cx + 3), y: Math.max(area.y, cy - 1) },
          { kitId: "bd-pick-aqueduct-sewer-bones", x: Math.max(area.x, cx - 2), y: Math.min(area.y + area.h - 1, cy + 1) },
          { kitId: "bd-pick-aqueduct-sewer-bones", x: Math.min(area.x + area.w - 1, cx + 2), y: Math.max(area.y, cy - 2) },
          ...(withDebris
            ? [
                { kitId: "bd-prop-sword_barrel", x: Math.max(area.x, cx - 2), y: cy },
                { kitId: "bd-pick-shipwreck-reef-broken-barrel", x: Math.min(area.x + area.w - 1, cx + 2), y: cy },
                { kitId: "bd-pick-castle-catacombs-rubble", x: Math.max(area.x, cx - 1), y: Math.min(area.y + area.h - 1, cy + 2) },
                { kitId: "bd-pick-aqueduct-sewer-rubble", x: Math.min(area.x + area.w - 1, cx + 3), y: Math.min(area.y + area.h - 1, cy + 2) },
                { kitId: "bd-pick-desert-oasis-grave", x: Math.min(area.x + area.w - 2, cx + 2), y: Math.max(area.y, cy - 3) },
                { kitId: "bd-pick-mountain-pass-brazier", x: Math.max(area.x, cx - 4), y: Math.max(area.y, cy - 2) },
              ]
            : []),
        ];

        const occupied = new Set<string>();
        let first = true;
        for (const item of placements) {
          const kit = (tileset.structureKits ?? []).find((k) => k.id === item.kitId);
          if (!kit) continue;
          if (item.x < area.x || item.y < area.y || item.x + kit.width > area.x + area.w || item.y + kit.height > area.y + area.h) continue;
          let overlap = false;
          for (let dy = 0; dy < kit.height && !overlap; dy++) {
            for (let dx = 0; dx < kit.width; dx++) {
              if (occupied.has(`${item.x + dx},${item.y + dy}`) || houseCells.has(`${item.x + dx},${item.y + dy}`)) {
                overlap = true;
                break;
              }
            }
          }
          if (overlap) continue;
          for (let dy = 0; dy < kit.height; dy++) {
            for (let dx = 0; dx < kit.width; dx++) {
              occupied.add(`${item.x + dx},${item.y + dy}`);
            }
          }
          out.push(...stampKitDirectSteps(item.kitId, item.x, item.y, previewMap, tileset, facts.mapId, first ? step.label : ""));
          first = false;
        }
        continue;
      }

      // 기타 타일셋 폴백: place_object 해골
      out.push({
        tool: "place_object",
        label: step.label,
        args: {
          mapId: facts.mapId,
          name: "해골",
          area,
          count: Number(step.args.count) || 4,
        },
      });
      continue;
    }

    if (step.tool === "harmonize_region") {
      const area = (step.args.area as StampRect | undefined) ?? facts.target;
      const roadGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_road_autotile");
      const plazaGroup = (tileset.tileGroups ?? []).find((g) => g.id === "beodeul:plaza");

      if (tileset.id === "beodeul_city") {
        // 1) 주변 맥락(도로·광장·풀밭·나무·소품) 스캔
        const roadSet = new Set<number>(roadGroup?.memberTileIds ?? []);
        const plazaSet = new Set<number>(plazaGroup?.tileIds ?? []);
        let nearestRoad: { x: number; y: number; d: number } | null = null;
        const cx = area.x + Math.floor(area.w / 2);
        const cy = area.y + Math.floor(area.h / 2);
        for (let y = Math.max(0, area.y - 6); y < Math.min(H, area.y + area.h + 6); y++) {
          for (let x = Math.max(0, area.x - 6); x < Math.min(W, area.x + area.w + 6); x++) {
            const l = previewMap.lowerTiles[idx(x, y)] ?? -1;
            if (roadSet.has(l) || plazaSet.has(l)) {
              const d = Math.abs(x - cx) + Math.abs(y - cy);
              if (!nearestRoad || d < nearestRoad.d) nearestRoad = { x, y, d };
            }
          }
        }

        // 2) 영역 내 어색한 잔여 상위 타일 정리 및 주변 잔디 바탕(737) 통일
        let harmTouchesHouse = false;
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (houseCells.has(`${x},${y}`)) harmTouchesHouse = true;
          }
        }
        if (!harmTouchesHouse) {
          out.push({
            tool: "tile_erase",
            label: "",
            args: { mapId: facts.mapId, rect: area, layer: "upper" },
          });
        }
        const grassCells: { x: number; y: number }[] = [];
        for (let y = area.y; y < area.y + area.h; y++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            if (!inb(x, y) || houseCells.has(`${x},${y}`)) continue;
            previewMap.upperTiles[idx(x, y)] = -1;
            const l = previewMap.lowerTiles[idx(x, y)] ?? -1;
            if (!roadSet.has(l) && !plazaSet.has(l) && l !== 737) {
              previewMap.lowerTiles[idx(x, y)] = 737;
              grassCells.push({ x, y });
            }
          }
        }
        if (grassCells.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: "",
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: 737, cells: grassCells },
          });
        }

        // 3) 인접 마을 도로에서 자연스럽게 이어지는 포석 쉼터(작은 마당) 조성
        const pocketW = Math.min(4, Math.max(2, area.w - 4));
        const pocketH = Math.min(3, Math.max(2, area.h - 4));
        const px0 = area.x + Math.floor((area.w - pocketW) / 2);
        const py0 = area.y + Math.floor((area.h - pocketH) / 2);
        const paveTile = roadGroup?.memberTileIds[0] ?? 1008;
        const paveCells: { x: number; y: number }[] = [];
        for (let y = py0; y < py0 + pocketH; y++) {
          for (let x = px0; x < px0 + pocketW; x++) {
            if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
              previewMap.lowerTiles[idx(x, y)] = paveTile;
              paveCells.push({ x, y });
            }
          }
        }
        if (nearestRoad) {
          const stepX = nearestRoad.x < px0 ? -1 : nearestRoad.x >= px0 + pocketW ? 1 : 0;
          const stepY = nearestRoad.y < py0 ? -1 : nearestRoad.y >= py0 + pocketH ? 1 : 0;
          if (stepY !== 0) {
            const startY = stepY < 0 ? nearestRoad.y + 1 : py0 + pocketH;
            const endY = stepY < 0 ? py0 - 1 : nearestRoad.y - 1;
            for (let y = Math.min(startY, endY); y <= Math.max(startY, endY); y++) {
              for (const x of [cx - 1, cx]) {
                if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
                  previewMap.lowerTiles[idx(x, y)] = paveTile;
                  paveCells.push({ x, y });
                }
              }
            }
          } else if (stepX !== 0) {
            const startX = stepX < 0 ? nearestRoad.x + 1 : px0 + pocketW;
            const endX = stepX < 0 ? px0 - 1 : nearestRoad.x - 1;
            for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
              for (const y of [cy - 1, cy]) {
                if (inb(x, y) && !houseCells.has(`${x},${y}`)) {
                  previewMap.lowerTiles[idx(x, y)] = paveTile;
                  paveCells.push({ x, y });
                }
              }
            }
          }
        }
        if (paveCells.length > 0) {
          out.push({
            tool: "paint_tiles",
            label: "주변 길망 연결 포석 마당과 마을 조경(활엽수·벤치·가로등·화단)",
            args: { mapId: facts.mapId, layer: "lower", mode: "cells", tile: paveTile, cells: paveCells },
          });
        }

        // 4) 주변 버들항 마을 풍경과 어우러지는 나무·벤치·가로등·꽃화단·우물/화분 배치
        const propsToPlace: readonly { readonly kitId: string; readonly x: number; readonly y: number }[] = [
          { kitId: "bd-tree-f4f319", x: area.x + 1, y: area.y },
          { kitId: "bd-tree-e9d9b3", x: Math.max(area.x + 1, area.x + area.w - 3), y: area.y },
          { kitId: "bd-prop-bench_wood", x: px0, y: Math.max(area.y + 1, py0 - 1) },
          { kitId: "bd-prop-lamp_crook", x: Math.min(area.x + area.w - 1, px0 + pocketW), y: Math.max(area.y, py0 - 1) },
          { kitId: "bd-pick-wizard-tower-bed-flower", x: area.x + 1, y: Math.min(area.y + area.h - 2, py0 + pocketH) },
          { kitId: "bd-prop-flowerbox_long", x: Math.max(area.x + 1, area.x + area.w - 3), y: Math.min(area.y + area.h - 1, py0 + pocketH) },
          { kitId: "bd-prop-planter_round", x: Math.max(area.x, px0 - 1), y: py0 + pocketH - 1 },
        ];
        const occupied = new Set<string>();
        for (const item of propsToPlace) {
          const kit = (tileset.structureKits ?? []).find((k) => k.id === item.kitId);
          if (!kit) continue;
          if (item.x < area.x || item.y < area.y || item.x + kit.width > area.x + area.w || item.y + kit.height > area.y + area.h) continue;
          let overlap = false;
          for (let dy = 0; dy < kit.height && !overlap; dy++) {
            for (let dx = 0; dx < kit.width; dx++) {
              if (occupied.has(`${item.x + dx},${item.y + dy}`) || houseCells.has(`${item.x + dx},${item.y + dy}`)) {
                overlap = true;
                break;
              }
            }
          }
          if (overlap) continue;
          for (let dy = 0; dy < kit.height; dy++) {
            for (let dx = 0; dx < kit.width; dx++) {
              occupied.add(`${item.x + dx},${item.y + dy}`);
            }
          }
          out.push(...stampKitDirectSteps(item.kitId, item.x, item.y, previewMap, tileset, facts.mapId));
        }
        continue;
      }

      // 기타 타일셋 폴백: 주변 지형 채우기 + 나무·화분 배치
      const grassMat = facts.fillMaterials.find((m) => /잔디|풀|녹지|grass/iu.test(m)) ?? facts.fillMaterials[0];
      if (grassMat) {
        out.push({
          tool: "fill_region",
          label: step.label,
          args: { mapId: facts.mapId, rect: area, material: grassMat, shape: "rect" },
        });
      }
      continue;
    }

    out.push(step);
  }
  return { steps: out, dropped };
}
