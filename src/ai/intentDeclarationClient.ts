// ai/intentDeclarationClient.ts
// 의도 선언의 LLM 어댑터. 선언 본체(intentDeclaration.ts)는 순수하게 두고, 네트워크·레지스트리·프로젝트는 여기만 안다.
//
// Authoring uses declaration JSON plus an independent request-coverage audit,
// within the same bounded deadline. Invalid rewards get one shape repair.
// Routing failure remains neutral; coverage failure adds an immutable unresolved
// obligation instead of allowing a partial plan to certify the original request.
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
import { parseRequestCoverageResult, REQUEST_COVERAGE_AUDIT, unresolvedRequestCoverage,
  type RequestRequirement } from "./requestCoverage";

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
  options: {
    readonly chat?: ChatFn; readonly audit?: ChatFn; readonly getConfig?: () => AiConfig; readonly timeoutMs?: number;
    /**
     * 커버리지 감사를 라우팅과 **동시에** 부른다. 감사는 라우팅 결과가 아니라 같은 사실(facts)만 보므로 기다릴 이유가 없다 —
     * 결과를 파싱할 때만 라우팅의 functionalRefinements 를 쓴다. 만들기·고치기가 아니면 감사를 끊고 버린다(가벼운 모델 한 번 낭비).
     * 왜(2026-10-04 실측, Pi 입력창): 라우팅 2.2~5.8s 뒤에 감사 2.2~3.9s 를 차례로 기다렸다. 기본은 꺼짐 — 호출 순서·횟수를 보는
     * 기존 테스트와 세션 경로는 그대로다.
     */
    readonly parallelAudit?: boolean;
  } = {},
): IntentDeclarer {
  const chat = options.chat ?? chatCompletion;
  const getConfig = options.getConfig ?? loadAiConfig;
  const timeoutMs = options.timeoutMs ?? INTENT_DECLARATION_TIMEOUT_MS;
  const routingConfig = (): AiConfig => {
    const config = configForLiteModel(getConfig());
    return { ...config, reasoningEffort: "off", maxTokens: Math.min(config.maxTokens, 4096) };
  };
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
    /**
     * 커버리지 감사는 라우팅과 **별개의 모델 호출**이다 — 한 벽을 나눠 쓰면 라우팅이 느릴 때 감사가 통째로 잘린다.
     * 실측(2026-09-15 라이브, activity e1c80a58·72e8599d): 라우팅이 20초를 거의 다 쓰고 성공했고, 같은 컨트롤러를
     * 물려받은 감사가 그 벽에 잘려 「Request coverage unverified: 시간 초과(20000ms)」라는 **닫을 수 없는** 필수
     * 항목이 생겼다. 모델은 그 항목을 닫으려 repair_acceptance·correct_verification 를 반복하다 예산을 태우고
     * 초안을 버렸다. 감사 실패는 여전히 미확인 항목으로 남기되, 실패 이유가 「라우팅이 예산을 썼다」면 안 된다.
     */
    /** 감사 호출만 띄운다(파싱은 라우팅 결과가 필요해 나중에). 실패는 값으로 돌려준다 — 던지지 않는다. */
    const startAudit = (): { readonly reply: Promise<{ text: string } | { reason: string }>; readonly cancel: () => void } => {
      const auditController = new AbortController();
      const auditTimer = setTimeout(() => auditController.abort(), timeoutMs);
      const onAuditAbort = (): void => auditController.abort();
      signal?.addEventListener("abort", onAuditAbort, { once: true });
      let cancelled = false;
      const reply = (async () => {
        try {
          const result = await (options.audit ?? chat)(routingConfig(), {
            messages: [{ role: "system", content: REQUEST_COVERAGE_AUDIT },
              { role: "user", content: buildIntentUserPayload(facts) }],
            response_format: { type: "json_object" }, temperature: 0.1,
            signal: auditController.signal, disableTransientRetry: true,
          });
          return { text: contentText(result) };
        } catch (cause) {
          const reason = auditController.signal.aborted && !signal?.aborted && !cancelled
            ? `시간 초과(${timeoutMs}ms)`
            : cause instanceof Error ? cause.message : String(cause);
          return { reason };
        } finally {
          clearTimeout(auditTimer);
          signal?.removeEventListener("abort", onAuditAbort);
        }
      })();
      return { reply, cancel: () => { cancelled = true; auditController.abort(); } };
    };
    // 동시 감사: 라우팅을 먼저 띄운 **뒤에** 띄운다(아래 try 첫머리). 호출 순서를 라우팅 → 감사로 지킨다.
    let earlyAudit: ReturnType<typeof startAudit> | null = null;
    const auditCoverage = async (intent: IntentDeclaration): Promise<{ requirements: readonly RequestRequirement[]; error?: string }> => {
      const audit = earlyAudit ?? startAudit();
      earlyAudit = null;
      const reply = await audit.reply;
      if ("reason" in reply) return { requirements: unresolvedRequestCoverage(reply.reason), error: reply.reason };
      const coverage = parseRequestCoverageResult(reply.text, facts,
        (intent.functionalRefinements ?? []).map(refinement => refinement.requirementId));
      return { requirements: coverage.requirements, ...(coverage.error ? { error: coverage.error } : {}) };
    };
    const assessed = async (intent: IntentDeclaration, error?: string): Promise<IntentDeclarationOutcome> => {
      if (intent.mode !== "create" && intent.mode !== "modify") {
        earlyAudit?.cancel();
        earlyAudit = null;
        return { intent, elapsedMs: Date.now() - started, error };
      }
      // This call sees the original request/facts, not the planner or authored draft.
      const coverage = await auditCoverage(intent);
      return { intent: { ...intent, requestRequirements: coverage.requirements }, elapsedMs: Date.now() - started,
        error: error ?? coverage.error };
    };
    try {
      const config = routingConfig();
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
      const routing = chat(config, request);
      if (options.parallelAudit) earlyAudit = startAudit();
      const result = await routing;
      const parsed = parseIntentDeclaration(contentText(result), facts);
      if (parsed.intent) {
        const error = invalidNpcRewardReason(parsed.intent);
        if (!error) {
          invalidIntent = parsed.intent;
          return await assessed(parsed.intent);
        }
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
          return await assessed({ ...invalidIntent, npcRewards: correction.intent.npcRewards });
        }
        return await assessed(invalidIntent, correction.error ?? error);
      }
      return { intent: { ...fallbackIntentDeclaration(facts), requestRequirements: unresolvedRequestCoverage(parsed.error ?? "Intent extraction failed") }, elapsedMs: Date.now() - started, error: parsed.error ?? "해석 실패" };
    } catch (cause) {
      const reason = controller.signal.aborted && !signal?.aborted
        ? `시간 초과(${timeoutMs}ms)`
        : cause instanceof Error ? cause.message : String(cause);
      return { intent: { ...(invalidIntent ?? fallbackIntentDeclaration(facts)), requestRequirements: unresolvedRequestCoverage(reason) }, elapsedMs: Date.now() - started, error: reason };
    } finally {
      // 폴백·오류로 끝났으면 쓰지 않은 동시 감사를 끊는다.
      earlyAudit?.cancel();
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
    && !outcome.error && !invalidNpcRewardReason(outcome.intent)) {
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
