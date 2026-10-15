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
import { isPathSurfaceTile } from "@/editor/tools/placementTools";
import { store } from "@/project/store";
import { isPassableLanding } from "@/project/collision";
import { isWallCell } from "@/editor/tools/v3/constructionTools";
import type { GameMap, Project } from "@/project/types";

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
  const labels = (list: readonly { readonly label: string }[]): string[] => [...new Set(list.map((entry) => entry.label))];
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
    fillMaterials: tileset ? labels(fillableMaterialSuggestions(tileset, 24)) : [],
    materialHint: formatMaterialLabelHint(tileset).replace(/^- /u, ""),
    ...(tileset ? { wallMaterials: labels(suggestMaterialsByLabel(tileset, "벽", 5)) } : {}),
    ...(tileset ? { doorMaterials: labels(suggestMaterialsByLabel(tileset, "문", 3)) } : {}),
    ...(placement ? { placement } : {}),
    objects,
    objectSamples: sampleStampObjectNames(objects, 36),
    isOpenCell: (x, y) => isOpenObjectCell(project, map, x, y),
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

/** 물건 발자국 한 칸이 놓일 수 있는 칸 — 걸을 수 있고, 위층이 비었고, 이벤트·시작칸이 아니고, 길·물·벽 면이 아니다. */
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
  if (meta?.tags?.includes("road") || meta?.role === "water" || meta?.role === "wall" || meta?.role === "roof") return false;
  if (isPathSurfaceTile(lower)) return false;
  return true;
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
const VISUAL_TOOLS: ReadonlySet<string> = new Set(["fill_region", "place_props", "paint_road", "tile_erase", "build_wall", "place_door", "stamp_tileset_object"]);

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
      lines.push(`${prefix}${step.label} · ${resultDetail(result)}${step.note ? ` (${step.note})` : ""}${invisibleWarning(result)}`);
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
    if (plan.steps.length === 0 && plan.refused.length === 0) {
      lastProblem = plan.error ?? (plan.dropped.length ? `버린 단계: ${plan.dropped.join(", ")}` : "깔 단계가 없습니다");
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
  // 새 이벤트가 기존 이벤트·서로와 겹치지 않게 코드가 옮긴다(모델이 빈 칸을 잘못 고른 경우).
  // 기존 이벤트는 **지금** 맵에서 읽는다 — 계획을 세우는 동안 먼저 끝난 주문이 같은 칸에 NPC 를 세웠을 수 있다.
  const landing = landingCheck(deps, input.mapId);
  const liveFacts = refreshFacts(deps, facts);
  const settled = resolveStampOverlaps(plan.steps, input.waitForApply ? liveFacts : facts, landing);
  // 물건 칸은 **지금 맵**에서 고른다(이름은 계획 때 확정, 자리는 적용 직전).
  const expanded = expandStampObjects(settled.steps, liveFacts);
  plan = { ...plan, steps: expanded.steps, dropped: [...plan.dropped, ...settled.dropped, ...expanded.dropped] };
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
    const visualApplied = plan.steps.some((step, index) => VISUAL_TOOLS.has(step.tool) && firstResults[index]?.ok);
    const lying = visualApplied && !hasVisibleChange(effect);
    const all = [...lines, ...extra];
    all.push(describeStampEffect(effect));
    if (lying) all.push("※ 도구는 성공이라 했지만 맵에 눈에 보이게 바뀐 것이 없습니다 — 이 요청은 깔리지 않은 것으로 봅니다.");
    return { ok: ok && !lying && refusals.length === 0, lines: all, applied, usedModel: true, refused: refusals.length, effect, ...(usedRepair ? {} : {}) };
  };
  if (failures.length === 0) return finish(applied > 0, [], false);

  // 수리 라운드 — 실패한 단계와 도구 오류(가까운 라벨 제안 포함)를 한 번만 되묻는다.
  // 물건(place_object 에서 펼친 단계)은 모델에게 되묻지 않는다 — 되물으면 사람·조사 지점 같은 엉뚱한 대체가 나왔다.
  const repairable = failures.filter((failure) => !failure.step.group);
  const objectFailures = failures.filter((failure) => failure.step.group);
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
    const repairedSettled = resolveStampOverlaps(parsed.steps, repairFacts, landingCheck(deps, input.mapId));
    const repairedExpanded = expandStampObjects(repairedSettled.steps, repairFacts);
    repaired = repairedExpanded.steps;
    const droppedAgain = [...repairedSettled.dropped, ...repairedExpanded.dropped];
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
  // 물건 칸 검사는 항상 지금 맵을 읽는다(먼저 끝난 주문·사람이 바꿨을 수 있다).
  const probes = map
    ? { isOpenCell: (x: number, y: number) => isOpenObjectCell(project, map, x, y), hasArtAt: (x: number, y: number) => hasArtAt(map, x, y) }
    : {};
  return { ...facts, ...(placement ? { placement } : {}), ...probes };
}

function toCall(step: StampStep): ToolCall {
  return { name: step.tool, args: { ...step.args } };
}
