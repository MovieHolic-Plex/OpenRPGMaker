// ai/intentDeclarationClient.ts
// 의도 선언의 LLM 어댑터. 선언 본체(intentDeclaration.ts)는 순수하게 두고, 네트워크·레지스트리·프로젝트는 여기만 안다.
//
// 보통 한 번, JSON 하나다. 잘못된 보상 선언만 같은 시간 예산 안에서 한 번 교정한다.
// 도구 루프도 스트리밍도 없다. llmClient 의 response_format:"json_object"
// 경로를 쓴다(operatorIntentClient 와 같은 자리). 벽시계 상한을 넘기거나 응답을 읽지 못하면 중립 폴백으로
// 떨어지고 그 사실을 감사 로그에 남긴다 — 되묻지 않고, 툴은 UI 도메인·핀·이름 언급·능력 승격으로만 노출된다.
//
// 같은 문장을 영역 작업 러너와 세션이 연달아 읽으므로 짧은 캐시를 둔다(선언 두 번 = 호출 두 번).
import { listLiveConceptFacilityLabels } from "@/editor/conceptBundleResolve";
import { activeTools } from "@/editor/tools";
import type { Project } from "@/project/types";
import {
  buildIntentUserPayload,
  continuationIntentDeclaration,
  emptyIntentDeclaration,
  fallbackIntentDeclaration,
  INTENT_SYSTEM_PROMPT,
  isContinuationText,
  parseIntentDeclaration,
  type IntentDeclaration,
  type IntentFacts,
  type IntentSelectionFact,
} from "./intentDeclaration";
import { chatCompletion, configForLiteModel, loadAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "./llmClient";
import { projectWikiContext } from "./projectWikiContext";

/** 한 문장을 JSON 으로 옮기는 데 허용하는 벽시계. 넘기면 끊고 폴백으로 떨어진다. */
export const INTENT_DECLARATION_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 90_000;
const CACHE_MAX = 8;

export interface IntentDeclarationOutcome {
  readonly intent: IntentDeclaration;
  readonly elapsedMs: number;
  /** 폴백으로 떨어진 이유(있을 때만). */
  readonly error?: string;
}

/** 사실 묶음 → 선언. 세션·러너가 주입받는 함수 타입이라 테스트는 JSON 문자열을 돌려주는 가짜를 넣는다. */
export type IntentDeclarer = (facts: IntentFacts, signal?: AbortSignal) => Promise<IntentDeclarationOutcome>;

type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

export interface BuildIntentFactsInput {
  readonly project: Project;
  readonly userText: string;
  readonly currentMapId: string | null | undefined;
  readonly selection: IntentSelectionFact | null | undefined;
  readonly hasActivePlan: boolean;
  readonly unresolvedFunctional?: IntentFacts["unresolvedFunctional"];
}

/** 코드가 아는 사실만 모은다 — 열린 맵, 선택 사각형, 맵 목록, 개념 시설 라벨, 활성 툴 이름. */
export function buildIntentFacts(input: BuildIntentFactsInput): IntentFacts {
  const currentMap = input.currentMapId ? input.project.maps[input.currentMapId] : undefined;
  return {
    userText: input.userText,
    currentMap: currentMap ? { id: currentMap.id, name: currentMap.name } : null,
    selection: input.selection ?? null,
    maps: Object.values(input.project.maps).map((map) => ({ id: map.id, name: map.name })),
    facilityLabels: [...listLiveConceptFacilityLabels(input.project)],
    toolNames: activeTools().map((tool) => tool.name),
    hasActivePlan: input.hasActivePlan,
    ...(input.unresolvedFunctional?.length ? { unresolvedFunctional: input.unresolvedFunctional } : {}),
    actualStart: { mapId: input.project.startMapId, ...input.project.startPos },
    wikiContext: projectWikiContext(input.project, { query: input.userText, mapId: input.currentMapId }).text,
  };
}

/** 모델 응답 본문을 문자열로. */
function contentText(result: ChatResult): string {
  const content = result.message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part.type === "text" ? part.text : "")).join("");
  return "";
}

function invalidNpcRewardReason(intent: IntentDeclaration): string | undefined {
  const rewards = intent.npcRewards;
  return rewards && "invalidReason" in rewards ? rewards.invalidReason : undefined;
}

/**
 * 실제 모델을 부르는 선언자. `chat`/`getConfig` 는 테스트 주입용이다.
 * 빈 문장은 부르지 않고, 진행 중 계획을 이어가는 한 마디(계속/이어서)는 continuation 으로 선언한다.
 */
export function createLlmIntentDeclarer(
  options: { readonly chat?: ChatFn; readonly getConfig?: () => AiConfig; readonly timeoutMs?: number } = {},
): IntentDeclarer {
  const chat = options.chat ?? chatCompletion;
  const getConfig = options.getConfig ?? loadAiConfig;
  const timeoutMs = options.timeoutMs ?? INTENT_DECLARATION_TIMEOUT_MS;
  return async (facts, signal) => {
    const started = Date.now();
    const text = facts.userText.trim();
    if (!text) return { intent: emptyIntentDeclaration(), elapsedMs: 0 };
    if (isContinuationText(text) && facts.hasActivePlan) {
      return { intent: continuationIntentDeclaration(facts), elapsedMs: 0 };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onOuterAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onOuterAbort, { once: true });
    let invalidIntent: IntentDeclaration | undefined;
    try {
      const config = configForLiteModel(getConfig());
      const request: ChatRequest = {
        messages: [
          { role: "system", content: INTENT_SYSTEM_PROMPT },
          { role: "user", content: buildIntentUserPayload(facts) },
        ],
        response_format: { type: "json_object" },
        // 분류 호출이라 표집을 좁힌다. 같은 문장이 매번 다르게 읽히면 라우팅이 흔들린다.
        temperature: 0.1,
        signal: controller.signal,
        disableTransientRetry: true,
      };
      const result = await chat(config, request);
      const parsed = parseIntentDeclaration(contentText(result), facts);
      if (parsed.intent) {
        const error = invalidNpcRewardReason(parsed.intent);
        if (!error) return { intent: parsed.intent, elapsedMs: Date.now() - started };
        invalidIntent = parsed.intent;
        const repaired = await chat(config, {
          ...request,
          messages: [
            ...request.messages,
            { role: "assistant", content: contentText(result) },
            { role: "user", content: `Correct only the npcRewards JSON shape and return the full declaration. Preserve every grant, count and one-time requirement from the user request. ${error}. Each target must use exactly one eventId or eventName; each item/monster grant exactly one id or name. Currency uses kind:"gold" with no id/name; do not convert named items to currency. Omit unused keys instead of writing null. Do not omit npcRewards to bypass this error.` },
          ],
        });
        const correction = parseIntentDeclaration(contentText(repaired), facts);
        if (correction.intent?.npcRewards !== undefined && !invalidNpcRewardReason(correction.intent)) {
          return {
            intent: { ...invalidIntent, npcRewards: correction.intent.npcRewards },
            elapsedMs: Date.now() - started,
          };
        }
        return { intent: invalidIntent, elapsedMs: Date.now() - started, error: correction.error ?? error };
      }
      return { intent: fallbackIntentDeclaration(facts), elapsedMs: Date.now() - started, error: parsed.error ?? "해석 실패" };
    } catch (cause) {
      const reason = controller.signal.aborted && !signal?.aborted
        ? `시간 초과(${timeoutMs}ms)`
        : cause instanceof Error ? cause.message : String(cause);
      return { intent: invalidIntent ?? fallbackIntentDeclaration(facts), elapsedMs: Date.now() - started, error: reason };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onOuterAbort);
    }
  };
}

// ── 짧은 캐시 ─────────────────────────────────────────────────────────────────
// 러너(영역 작업 탈출 판정)와 세션(턴 라우팅)이 같은 문장을 연달아 선언한다. 한 문장은 한 번만 부른다.

const cache = new Map<string, { readonly outcome: IntentDeclarationOutcome; readonly at: number }>();

function cacheKey(facts: IntentFacts): string {
  const selection = facts.selection
    ? `${facts.selection.mapId}:${facts.selection.x},${facts.selection.y},${facts.selection.width},${facts.selection.height}`
    : "-";
  return `${facts.userText.trim()}|${facts.currentMap?.id ?? "-"}|${selection}|${facts.hasActivePlan ? "plan" : "noplan"}|${facts.wikiContext ?? ""}|${JSON.stringify(facts.actualStart)}|${JSON.stringify(facts.maps)}|${JSON.stringify(facts.unresolvedFunctional)}`;
}

export async function declareIntentCached(
  declarer: IntentDeclarer,
  facts: IntentFacts,
  signal?: AbortSignal,
): Promise<IntentDeclarationOutcome> {
  const key = cacheKey(facts);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return { ...hit.outcome, elapsedMs: 0 };
  const outcome = await declarer(facts, signal);
  // 폴백(모델 실패)은 캐시하지 않는다 — 다음 호출이 다시 시도할 수 있어야 한다.
  if ((outcome.intent.source === "llm" || outcome.intent.source === "continuation")
    && !invalidNpcRewardReason(outcome.intent)) {
    cache.set(key, { outcome, at: now });
    while (cache.size > CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  return outcome;
}

export function resetIntentDeclarationCache(): void {
  cache.clear();
}
