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
  parseStampPlan,
  STAMP_PLANNER_SYSTEM_PROMPT,
  type StampPlanFacts,
  type StampRect,
  type StampStep,
} from "@/ai/stampPlanner";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import type { ToolResult } from "@/editor/tools/types";
import { fillableMaterialSuggestions, suggestMaterialsByLabel } from "@/project/tileVocabulary";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

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
  };
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

  input.onPhase?.("planning");
  const conversation: ChatMessage[] = [
    { role: "system", content: STAMP_PLANNER_SYSTEM_PROMPT },
    { role: "user", content: buildStampPlannerUserPayload(facts) },
  ];
  // 호출 실패·시간 초과·읽을 수 없는 계획은 한 번만 다시 묻는다. 그래도 안 되면 아무것도 깔지 않는다.
  let planRaw = "";
  let plan: ReturnType<typeof parseStampPlan> = { steps: [], dropped: [] };
  let lastProblem = "";
  for (let attempt = 0; attempt < 2 && plan.steps.length === 0; attempt++) {
    try {
      planRaw = await callModel(deps, conversation, input.signal);
    } catch (cause) {
      if (cause instanceof StampAborted) return ABORTED;
      lastProblem = `모델 호출 실패: ${reasonOf(cause)}`;
      continue;
    }
    if (input.signal?.aborted) return ABORTED;
    plan = parseStampPlan(planRaw, facts);
    if (plan.steps.length === 0) {
      lastProblem = plan.error ?? (plan.dropped.length ? `버린 단계: ${plan.dropped.join(", ")}` : "깔 단계가 없습니다");
    }
  }
  if (plan.steps.length === 0) {
    return { ok: false, lines: [`모델이 깔 계획을 내지 못해 아무것도 깔지 않았습니다(${lastProblem}).`], applied: 0, usedModel: true };
  }

  const lines: string[] = [];
  if (plan.dropped.length > 0) lines.push(`버린 단계: ${plan.dropped.join(", ")}`);
  input.onPhase?.("applying");
  const firstResults = deps.apply(plan.steps.map(toCall));
  let applied = 0;
  const failures: { step: StampStep; error: string }[] = [];
  plan.steps.forEach((step, index) => {
    const result = firstResults[index];
    if (result?.ok) {
      applied += 1;
      lines.push(`${step.label} · ${resultDetail(result)}${step.note ? ` (${step.note})` : ""}`);
    } else {
      failures.push({ step, error: resultDetail(result) });
    }
  });
  if (failures.length === 0) return { ok: applied > 0, lines, applied, usedModel: true };

  // 수리 라운드 — 실패한 단계와 도구 오류(가까운 라벨 제안 포함)를 한 번만 되묻는다.
  input.onPhase?.("repairing");
  let repaired: readonly StampStep[] = [];
  let repairError: string | null = null;
  try {
    const repairRaw = await callModel(deps, [
      ...conversation,
      { role: "assistant", content: planRaw },
      { role: "user", content: buildStampRepairPrompt(failures) },
    ], input.signal);
    const parsed = parseStampPlan(repairRaw, facts);
    repaired = parsed.steps;
    if (parsed.error) repairError = parsed.error;
  } catch (cause) {
    if (cause instanceof StampAborted) {
      for (const failure of failures) lines.push(`${failure.step.label} 실패: ${failure.error}`);
      lines.push("수리를 중단했습니다.");
      return { ok: false, lines, applied, usedModel: true };
    }
    repairError = reasonOf(cause);
  }
  for (const failure of failures) lines.push(`${failure.step.label} 실패: ${failure.error}`);
  if (repaired.length === 0) {
    lines.push(`고쳐 깔 단계를 받지 못했습니다${repairError ? `(${repairError})` : ""}.`);
    return { ok: false, lines, applied, usedModel: true };
  }
  if (input.signal?.aborted) return { ok: false, lines: [...lines, "수리를 중단했습니다."], applied, usedModel: true };
  input.onPhase?.("applying");
  const repairResults = deps.apply(repaired.map(toCall));
  let repairedOk = 0;
  let repairedFailed = 0;
  repaired.forEach((step, index) => {
    const result = repairResults[index];
    if (result?.ok) {
      repairedOk += 1;
      lines.push(`고쳐서 ${step.label} · ${resultDetail(result)}${step.note ? ` (${step.note})` : ""}`);
    } else {
      repairedFailed += 1;
      lines.push(`고쳐도 ${step.label} 실패: ${resultDetail(result)}`);
    }
  });
  applied += repairedOk;
  return { ok: applied > 0 && repairedOk > 0 && repairedFailed === 0, lines, applied, usedModel: true };
}

function toCall(step: StampStep): ToolCall {
  return { name: step.tool, args: { ...step.args } };
}
