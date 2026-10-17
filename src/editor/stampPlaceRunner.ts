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
  expandStampObjects,
  parseStampPlan,
  resolveStampOverlaps,
  STAMP_PLANNER_SYSTEM_PROMPT,
  type StampPlanFacts,
  type StampRect,
  type StampRefusal,
  type StampStep,
} from "@/ai/stampPlanner";
import { buildStampObjectIndex, sampleStampObjectNames } from "@/ai/stampObjects";
import { describeStampEffect, eventHasVisibleArt, hasVisibleChange, measureStampEffect, type StampEffect } from "@/editor/stampEffect";
import { forestTreeKindFromResolvedMaterial } from "@/editor/tools/forestDensity";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import type { ToolResult } from "@/editor/tools/types";
import { fillableMaterialSuggestions, resolveMaterialByLabel, suggestMaterialsByLabel } from "@/project/tileVocabulary";
import { buildJpCityBuilding } from "@/editor/jpCity/builder";
import { planQuickHouse, quickHouseCatalog, quickHouseKit, quickHouseMinWidth, quickHouseStyles, type QuickHouseOptions, type QuickHousePlan } from "@/editor/quickHouse";
import { copiedTerrainMap } from "@/editor/terrainDesignPlans";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { isPathSurfaceTile } from "@/editor/tools/placementTools";
import { store } from "@/project/store";
import { isPassable, isPassableLanding } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack, topTileInStack } from "@/project/mapOverlayTiles";
import { terrainLocked } from "@/project/terrainDesign";
import { isWallCell } from "@/editor/tools/v3/constructionTools";
import type { GameMap, Project, TilesetDef } from "@/project/types";

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
}

export interface StampRunResult {
  /** 한 단계 이상 적용됐고 남은 실패가 없다. */
  readonly ok: boolean;
  /** 채팅 말풍선용 한국어 줄 — 단계마다 한 줄(+ 실패 이유). */
  readonly lines: readonly string[];
  readonly applied: number;
  /** 모델 계획을 받아 적용 단계까지 갔으면 true. 모델 없음·계획 실패면 false. */
  readonly usedModel: boolean;
  /** 칩셋에 그림이 없어 깔지 않은 물건 수(0 이면 필드 없음). */
  readonly refused?: number;
  /** 적용 전후 맵 비교 — 실제로 바뀐 타일·이벤트 수. */
  readonly effect?: StampEffect;
}

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
    apply: (calls) => applyToolSequenceToStore(calls, { continueOnError: true }),
    chat: chat ?? chatCompletion,
    getConfig: loadAiConfig,
    isModelReady: chat ? () => true : (config) => isAssistantEndpointReady(config, getAiConnectionStatus(config)),
    timeoutMs: STAMP_PLAN_TIMEOUT_MS,
  };
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
    objects,
    objectSamples: sampleStampObjectNames(objects, 36),
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
  const meta = tileset?.tileMeta?.[lower];
  const isSidewalk = /보도|인도|광장/u.test(meta?.label ?? "") && !/횡단보도/u.test(meta?.label ?? "");
  const isWall = meta?.role === "wall" || meta?.tags?.includes("wall") === true;
  if (!isSidewalk && (meta?.tags?.includes("road") || meta?.role === "water" || isWall || meta?.role === "roof")) return false;
  if (!isSidewalk && isPathSurfaceTile(lower)) return false;
  return true;
}

function isWallMountCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0 || (map.upperOverlayTiles?.[index] ?? -1) >= 0) return false;
  const lower = map.lowerTiles[index] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  const isWall = meta?.role === "wall" || meta?.tags?.includes("wall") === true;
  return isWall && !/천장|ceiling/iu.test(meta?.label ?? "");
}

function isWaterCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0) return false;
  const lower = map.lowerTiles[index] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  return meta?.role === "water" || /물|용암|수역|lava|water/iu.test(meta?.label ?? "");
}

function isRoadCell(map: GameMap, tileset: TilesetDef | undefined, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0) return false;
  const lower = map.lowerTiles[index] ?? -1;
  const meta = tileset?.tileMeta?.[lower];
  const label = meta?.label ?? "";
  if (/보도|인도|광장/u.test(label) && !/횡단보도/u.test(label)) return false;
  return meta?.tags?.includes("road") === true || /도로|차도|아스팔트|생활도로/u.test(label);
}
/** 그 칸에 보이는 그림이 이미 있는가(위층·겹침 타일 또는 그림 있는 이벤트). */
function hasArtAt(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const index = y * map.width + x;
  if ((map.upperTiles[index] ?? -1) >= 0 || (map.upperOverlayTiles?.[index] ?? -1) >= 0) return true;
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
  // 빈 문장도 모델이 읽는다 — 「이 자리를 알아서 채워 달라」는 뜻이다(맵 사실을 보고 고른다).
  const text = input.text.trim() || EMPTY_SENTENCE;
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
  let plan: ReturnType<typeof parseStampPlan> = { steps: [], dropped: [], refused: [] };
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
  const expanded = settleAndExpandSteps(plan.steps, input.waitForApply ? liveFacts : facts, deps.getProject(), landingCheck(deps, input.mapId));
  plan = { ...plan, steps: expanded.steps, dropped: [...plan.dropped, ...expanded.dropped] };
  const lines: string[] = [...refusalLines];
  if (plan.dropped.length > 0) lines.push(`버린 단계: ${plan.dropped.join(", ")}`);
  if (plan.steps.length === 0) return { ok: false, lines, applied: 0, usedModel: true, refused: refusals.length };
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
    all.push(describeStampEffect(effect));
    if (lying) all.push("※ 도구는 성공이라 했지만 맵에 눈에 보이게 바뀐 것이 없습니다 — 이 요청은 깔리지 않은 것으로 봅니다.");
    return { ok: ok && !lying && refusals.length === 0, lines: all, applied, usedModel: true, refused: refusals.length, effect, ...(usedRepair ? {} : {}) };
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
    const repairedExpanded = settleAndExpandSteps(parsed.steps, repairFacts, deps.getProject(), landingCheck(deps, input.mapId));
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

/**
 * 던전 방·지형 칠하기를 미리보기 맵에 먼저 반영한 뒤, 이벤트 겹침 해결 → 집 펼치기 → 물건 펼치기를 순서대로 돌린다.
 * 같은 주문 안에서 방을 파거나 강·도로를 칠한 뒤 상자·함정·다리·횡단보도·벽 횃불을 놓을 때 방금 바뀐 지형을 바로 읽는다.
 */
function settleAndExpandSteps(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
  project: Project,
  fallbackLanding: (x: number, y: number) => boolean,
): { readonly steps: readonly StampStep[]; readonly dropped: readonly string[] } {
  const map = project.maps[facts.mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset) {
    const settled = resolveStampOverlaps(steps, facts, fallbackLanding);
    const houses = expandStampHouses(settled.steps, project, facts);
    const isOpen = facts.isOpenCell;
    const objectFacts: StampPlanFacts = houses.cells.size === 0
      ? facts
      : { ...facts, isOpenCell: (x, y) => !houses.cells.has(`${x},${y}`) && (isOpen ? isOpen(x, y) : true) };
    const objects = expandStampObjects(houses.steps, objectFacts);
    return { steps: objects.steps, dropped: [...settled.dropped, ...houses.dropped, ...objects.dropped] };
  }
  const previewMap = copiedTerrainMap(map);
  previewMap.structurePlacements = [...(map.structurePlacements ?? [])];
  const dungeon = expandDungeonRooms(steps, previewMap, tileset, facts);
  previewFillRegions(dungeon.steps, previewMap, tileset);
  const hasTerrainPreview = dungeon.steps !== steps || steps.some((step) => step.tool === "fill_region");
  const previewFacts: StampPlanFacts = hasTerrainPreview
    ? {
        ...facts,
        isOpenCell: (x, y) => isOpenObjectCell(project, previewMap, x, y),
        isWallMountCell: (x, y) => isWallMountCell(previewMap, tileset, x, y),
        isWaterCell: (x, y) => isWaterCell(previewMap, tileset, x, y),
        isRoadCell: (x, y) => isRoadCell(previewMap, tileset, x, y),
        hasArtAt: (x, y) => hasArtAt(previewMap, x, y),
        isWallCell: (x, y) => isWallCell(previewMap, tileset, x, y),
      }
    : facts;
  const landing = hasTerrainPreview
    ? (x: number, y: number) => isPassableLanding(project, previewMap, x, y)
    : fallbackLanding;
  const settled = resolveStampOverlaps(dungeon.steps, previewFacts, landing);
  const houses = expandStampHouses(settled.steps, project, previewFacts, previewMap);
  const isOpen = previewFacts.isOpenCell;
  const objectFacts: StampPlanFacts = houses.cells.size === 0
    ? previewFacts
    : { ...previewFacts, isOpenCell: (x, y) => !houses.cells.has(`${x},${y}`) && (isOpen ? isOpen(x, y) : true) };
  const objects = expandStampObjects(houses.steps, objectFacts);
  return {
    steps: objects.steps,
    dropped: [...dungeon.dropped, ...settled.dropped, ...houses.dropped, ...objects.dropped],
  };
}

function previewFillRegions(steps: readonly StampStep[], previewMap: GameMap, tileset: TilesetDef): void {
  for (const step of steps) {
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
 * `place_dungeon_room` 단계를 `paint_tiles` 호출들로 펼치고 `previewMap` 에 바로 반영한다.
 * - 방(`kind: "room"`): 북쪽 2줄 돌벽(`face-cata-2h`), 나머지 칸 돌바닥(`floor-cata`), `hazard: "lava"|"water"` 면 가운데 2줄 수로 + 돌다리.
 * - 연결(`kind: "connect"|"corridor"`): 이미 파인 방들 사이를 폭 3칸 복도로 잇고 북쪽 천장 경계에 2줄 돌벽을 세운다.
 * - 방·복도 바깥 빈 땅은 `beodeul_dungeon_ceiling` 47변형 오토타일(밝은 벽 두께 테두리)로 감싼다.
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
  for (const kit of [floorKit, bridgeNsKit, stairsDownKit]) {
    for (const row of kit?.rows ?? []) for (const t of row.tiles) if (t >= 0) stoneFloorTiles.add(t);
  }
  const dungeonFloorTiles = new Set<number>(stoneFloorTiles);
  for (const row of lavaKit?.rows ?? []) for (const t of row.tiles) if (t >= 0) dungeonFloorTiles.add(t);
  const stairsUpTiles = new Set<number>();
  for (const row of stairsUpKit?.rows ?? []) for (const t of row.tiles) if (t >= 0) stairsUpTiles.add(t);
  const dungeonWallTiles = new Set<number>(stairsUpTiles);
  for (const row of faceKit.rows) for (const t of row.tiles) if (t >= 0) dungeonWallTiles.add(t);
  // 현재 맵에서 이미 파인 바닥·벽 마스크를 읽는다.
  const floorMask = new Uint8Array(W * H);
  const wallB = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = previewMap.lowerTiles[idx(x, y)] ?? -1;
      if (dungeonFloorTiles.has(t)) floorMask[idx(x, y)] = 1;
      else if (dungeonWallTiles.has(t)) {
        const southT = y + 1 < H ? (previewMap.lowerTiles[idx(x, y + 1)] ?? -1) : -1;
        wallB[idx(x, y)] = dungeonFloorTiles.has(southT) ? 0 : 1;
      }
    }
  }
  const out: StampStep[] = [];
  const dropped: string[] = [];
  for (const step of steps) {
    if (step.tool !== "place_dungeon_room") {
      out.push(step);
      continue;
    }
    const beforeLower = [...previewMap.lowerTiles];
    const area = step.args.area as StampRect;
    const kind = step.args.kind === "corridor" || step.args.kind === "connect" ? step.args.kind : "room";
    const hazard = step.args.hazard === "lava" || step.args.hazard === "water" ? step.args.hazard : "none";

    if (kind === "room") {
      const wallRows = Math.min(2, Math.max(1, area.h - 2));
      for (let y = area.y; y < area.y + area.h; y++) {
        for (let x = area.x; x < area.x + area.w; x++) {
          if (!inb(x, y)) continue;
          if (y < area.y + wallRows) {
            if (!floorMask[idx(x, y)]) {
              wallB[idx(x, y)] = (area.y + wallRows - 1 - y) as 0 | 1;
            }
          } else {
            floorMask[idx(x, y)] = 1;
            wallB[idx(x, y)] = -1;
            previewMap.lowerTiles[idx(x, y)] = kitTile(floorKit, x, y);
          }
        }
      }
      if (hazard !== "none" && area.h >= 7 && lavaKit) {
        const ly = area.y + wallRows + Math.floor((area.h - wallRows - 2) / 2);
        const bx = area.x + Math.floor((area.w - 2) / 2);
        const bridgeTile = bridgeNsKit?.rows[0]?.tiles[0] ?? kitTile(floorKit, bx, ly);
        for (let dy = 0; dy < 2; dy++) {
          for (let x = area.x; x < area.x + area.w; x++) {
            const y = ly + dy;
            if (!inb(x, y)) continue;
            if (x === bx || x === bx + 1) previewMap.lowerTiles[idx(x, y)] = bridgeTile;
            else previewMap.lowerTiles[idx(x, y)] = kitTile(lavaKit, x, y);
          }
        }
      }
    } else {
      // 기존 방 컴포넌트들을 찾아 중심점 사이를 3칸 폭 L자 복도로 잇는다.
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
        if ((previewMap.upperTiles[idx(x, y)] ?? -1) >= 0) return;
        if (!floorMask[idx(x, y)] && !stairsUpTiles.has(previewMap.lowerTiles[idx(x, y)] ?? -1)) {
          floorMask[idx(x, y)] = 1;
          wallB[idx(x, y)] = -1;
          previewMap.lowerTiles[idx(x, y)] = kitTile(floorKit, x, y);
        }
      };
      const carveCorridor = (x0: number, y0: number, x1: number, y1: number): void => {
        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
        for (let x = minX; x <= maxX; x++) for (let dy = -1; dy <= 1; dy++) carveFloorCell(x, y0 + dy);
        const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
        for (let y = minY; y <= maxY; y++) for (let dx = -1; dx <= 1; dx++) carveFloorCell(x1 + dx, y);
      };
      if (rooms.length >= 2) {
        const connected = new Set<number>([0]);
        while (connected.size < rooms.length) {
          let bestA = 0, bestB = 1, bestD = Infinity;
          for (const a of connected) {
            for (let b = 0; b < rooms.length; b++) {
              if (connected.has(b)) continue;
              const d = Math.hypot(rooms[a]!.cx - rooms[b]!.cx, rooms[a]!.cy - rooms[b]!.cy);
              if (d < bestD) { bestD = d; bestA = a; bestB = b; }
            }
          }
          carveCorridor(rooms[bestA]!.cx, rooms[bestA]!.cy, rooms[bestB]!.cx, rooms[bestB]!.cy);
          connected.add(bestB);
        }
      } else {
        const cy = area.y + Math.max(2, Math.floor(area.h / 2));
        for (let x = area.x; x < area.x + area.w; x++) for (let dy = -1; dy <= 1; dy++) carveFloorCell(x, cy + dy);
      }
      // 바닥 사이에 1~2줄짜리 얇은 천장/벽 틈이 남으면(2줄 벽+1줄 천장이 못 들어가는 좁은 틈) 바닥으로 합친다.
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 1; y < H - 1; y++) {
          for (let x = 0; x < W; x++) {
            if (floorMask[idx(x, y)]) continue;
            const northFloor = floorMask[idx(x, y - 1)] === 1 || (y >= 2 && floorMask[idx(x, y - 2)] === 1);
            const southFloor = floorMask[idx(x, y + 1)] === 1 || (y + 2 < H && floorMask[idx(x, y + 2)] === 1);
            if (northFloor && southFloor) carveFloorCell(x, y);
          }
        }
      }
      // 새로 판 복도 북쪽 변 위에 천장이 3줄 이상 있으면 2줄 벽 앞면을 세운다.
      for (let y = 2; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!floorMask[idx(x, y)] || floorMask[idx(x, y - 1)] || wallB[idx(x, y - 1)] >= 0) continue;
          if (!floorMask[idx(x, y - 2)] && wallB[idx(x, y - 2)] < 0) {
            wallB[idx(x, y - 1)] = 0;
            wallB[idx(x, y - 2)] = 1;
          }
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
  if (/여관|숙소|주막|민박|inn|lodge/iu.test(text)) return /여관|주막|인\b|오두막|저택|inn|lodge|manor|house/iu;
  if (/대장간|무기점|갑옷|공방|smith|forge/iu.test(text)) return /대장간|무기|공방|smith|forge/iu;
  if (/주택|단독주택|살림집|민가|집|오두막|cottage|house|home/iu.test(text)) return /주택|살림집|민가|오두막|집|house|cottage|home/iu;
  return null;
}

function houseOptionsFor(tileset: TilesetDef, size: "small" | "medium" | "large", stories: 1 | 2, seed: number, kindText?: string): QuickHouseOptions[] {
  const kindRe = houseKindRegex(kindText);
  const allKits = [...quickHouseCatalog(tileset)];
  // 특정 건물 종류(여관·대장간·상점·편의점·오피스 등)를 요청했고 그에 맞는 키트가 있으면 키트를 우선 쓴다.
  if (kindRe && allKits.length > 0 && !/^(?:집|주택|살림집|민가|단독주택)$/u.test((kindText ?? "").trim())) {
    const matchedKits = allKits.filter((kit) => kindRe.test(`${kit.id} ${kit.name ?? ""} ${(kit.ai?.tags ?? []).join(" ")}`));
    if (matchedKits.length > 0) {
      matchedKits.sort((a, b) => a.width * a.height - b.width * b.height);
      const ordered = size === "small" ? matchedKits : size === "large" ? [...matchedKits].reverse() : matchedKits;
      const rotated = ordered.map((_, i) => ordered[(seed + i) % ordered.length]!);
      return rotated.map((kit) => ({ style: "blue-stone", width: kit.width, stories: 1, kitId: kit.id }));
    }
  }
  const styles = quickHouseStyles(tileset);
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
  // kitId 가 있으면 quickHouseKit 은 style 을 보지 않는다 — 타입을 채우는 자리값이다.
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
  { ground: "gr.machiya", roof: "roof.tile", floorKind: "koushi", wall: "kinari", door: { type: "house" } },
  { ground: "gr.machiya", roof: "roof.hip", floorKind: "pairs", wall: "shiro", door: { type: "machiya" } },
  { ground: "gr.garage", roof: "roof.slate", floorKind: "veranda", wall: "shiro", door: { type: "rollup" } },
  { ground: "gr.shutter.sora", roof: "roof.hip.slate", floorKind: "slide", wall: "kinari", door: { type: "lattice" } },
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
    return { ground: "gr.shutter.sora", roof: "roof.slate", floorKind: "slide", wall: "shiro", door: { type: "lattice" } };
  }
  if (/이자카야|선술집|식당|음식점|초밥|도시락|상가|가게|상점/u.test(text)) {
    return { ground: "gr.machiya", roof: "roof.tile", floorKind: "koushi", wall: "kinari", door: { type: "machiya" } };
  }
  if (/오피스|빌딩|사무|은행|병원|호텔|맨션|타워/u.test(text)) {
    return { ground: "gr.garage", roof: "roof.slate", floorKind: "veranda", wall: "shiro", door: { type: "rollup" } };
  }
  const order = [JP_HOUSE_PRESETS[2], JP_HOUSE_PRESETS[0], JP_HOUSE_PRESETS[3], JP_HOUSE_PRESETS[1]] as const;
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
  for (let n = 0; n < count; n++) {
    const cx = count > 1 && horizontalSpread ? area.x + ((n + 0.5) * area.w) / count : area.x + (area.w - 1) / 2;
    const cy = count > 1 && !horizontalSpread ? area.y + ((n + 0.5) * area.h) / count : area.y + (area.h - 1) / 2;
    const preset = jpPresetForKind(kindText, seed);
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
              candidates.push({ left, top, d: Math.hypot(left + (w - 1) / 2 - cx, top + (bh - 1) / 2 - cy) });
            }
          }
          candidates.sort((a, b) => a.d - b.d || a.top - b.top || a.left - b.left);
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
  let seed = map?.structurePlacements?.length ?? 0;
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
    for (let n = 0; n < count; n++) {
      const cx = count > 1 && horizontalSpread ? area.x + ((n + 0.5) * area.w) / count : area.x + (area.w - 1) / 2;
      const cy = count > 1 && !horizontalSpread ? area.y + ((n + 0.5) * area.h) / count : area.y + (area.h - 1) / 2;
      const currentOptions = houseOptionsFor(tileset, size, stories, seed, kindText);
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
        const candidates: { x: number; y: number; d: number }[] = [];
        for (let top = target.y; top + neededH <= target.y + target.h; top++) {
          for (let left = target.x; left + kit.width <= target.x + target.w; left++) {
            candidates.push({ x: left + door.dx, y: top + doorRow, d: Math.hypot(left + (kit.width - 1) / 2 - cx, top + (kit.height - 1) / 2 - cy) });
          }
        }
        candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
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
          const candidates: { x: number; y: number; d: number }[] = [];
          for (let top = target.y; top + neededH <= target.y + target.h; top++) {
            for (let left = target.x; left + kit.width <= target.x + target.w; left++) {
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
      hit.plan.apply?.(previewMap);
      // 다음 집·물건이 이 집과 문 앞을 덮지 않게 한 칸 둘레까지 막는다(물건은 발자국과 문 앞만 피한다).
      for (let y = hit.rect.y - 1; y <= hit.rect.y + hit.rect.h; y++) for (let x = hit.rect.x - 1; x <= hit.rect.x + hit.rect.w; x++) blocked.add(`${x},${y}`);
      blocked.add(`${hit.anchor.x},${hit.anchor.y + 1}`);
      for (let y = hit.rect.y; y < hit.rect.y + hit.rect.h; y++) for (let x = hit.rect.x; x < hit.rect.x + hit.rect.w; x++) cells.add(`${x},${y}`);
      cells.add(`${hit.anchor.x},${hit.anchor.y + 1}`);
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
  return { name: step.tool, args: { ...step.args } };
}
