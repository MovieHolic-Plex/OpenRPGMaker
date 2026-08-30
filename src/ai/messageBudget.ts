// ai/messageBudget.ts
// 요청 총 문자 클램프 — 공급자가 받아들일 수 있는 크기 안에 요청을 가둔다. 자율 런(48단계 예산)은
// 뷰포트 이미지(베이스64 수만 자)와 누적 툴 결과로 금방 커진다(CPEN 실측: 88,408자 → 422
// validation_error). 전송 직전 오래된 메시지를 요약·이미지 제거로 압축한다. 영구 대화
// (this.messages)는 건드리지 않고 요청 전용 사본을 만든다 — 감사/하네스 원본 보존.
//
// 예산은 **모델에서 끌어낸다**(resolveRequestCharBudget). 고정 52,000자는 사라진 공급자(CPEN)의
// 검증 상한이었고, 그것이 창 1M 토큰짜리 모델의 기억까지 잘라내고 있었다.
import { AUTO_COMPACTION_TRIGGER_TOKENS, DEFAULT_COMPACTION_SETTINGS, resolveContextWindow } from "./contextCompaction";
import type { AiConfig, ChatMessage, ContentPart } from "./llmClient";
import { DEFAULT_CHARS_PER_TOKEN } from "./tokenBudget";

/**
 * 공급자를 모를 때 쓰는 안전 예산 — CPEN 하드 상한 64,000 대비 여유를 남긴 값이다.
 *
 * **이 값은 폴백이고, 모델을 알면 resolveRequestCharBudget 이 대신 쓰인다.** 그대로 두면
 * CPEN(레지스트리에서 사라진 공급자)의 검증 상한이 창 1M 토큰짜리 모델에도 걸린다 —
 * 근거는 resolveRequestCharBudget 주석.
 */
export const REQUEST_MESSAGE_CHAR_BUDGET = 52_000;
/** 최근 메시지는 압축하지 않는다(모델이 지금 보고 있는 턴 컨텍스트). */
const KEEP_RECENT_MESSAGES = 6;

/**
 * 작업 창 상한(토큰) — **제품 선택**이다. 모델 창이 이보다 커도 여기서 멈춘다.
 *
 * 자동 압축 지점(`AUTO_COMPACTION_TRIGGER_TOKENS` = 200,000 토큰)에서 파생한다. 문턱은 `창 - 예비분`
 * 이므로 지점을 그대로 얻으려면 창 = 지점 + 예비분 이어야 한다(216,384).
 *
 * 예전에는 DEFAULT_CONTEXT_WINDOW(128,000)를 상한으로 삼아 문턱이 111,616 토큰이었다. 그러니
 * 창 1,048,576 짜리 기본 모델(gemini-3.7-flash)이 **창의 11% 지점에서 앞부분 기억을 요약으로
 * 바꿔 버렸다** — 창이 남는데도 이르게 잊었다. 반대로 모델 창을 그대로 쓰면 문턱이 1,032,192 가
 * 되어 압축이 사실상 안 돌고 요청당 입력만 1M 토큰으로 자란다. 200,000 은 그 사이에 명시한 지점이다.
 *
 * 함의: 문자 클램프(resolveRequestCharBudget)도 같은 창을 보므로 함께 넘어진다. 그게 의도다 —
 * 클램프가 압축이 남기기로 한 분량보다 좁으면 요약 직후 그 결과가 다시 잘린다(이 파일 상단 주석).
 * gemini 기준 예산은 216,384 × 4 = 865,536자로 여전히 창(1M 토큰) 안에 잡힌다.
 *
 * 창이 이 상한보다 작은 모델(claude-/glm- 200,000)은 자기 창이 먼저 걸리므로 동작이 바뀌지 않는다.
 */
export const WORKING_CONTEXT_TOKEN_CAP = AUTO_COMPACTION_TRIGGER_TOKENS + DEFAULT_COMPACTION_SETTINGS.reserveTokens;

/** cpenrouter 경로 판정 — llmClient.isCpenGateway 와 같은 규칙(순환 import 회피용 국소 사본). */
function isCpenRoute(model: string, baseUrl: string): boolean {
  if (model.trim().toLowerCase().startsWith("cpen/")) return true;
  return baseUrl.trim().toLowerCase().includes("/api/cpen");
}

/**
 * 요청 총 문자 예산을 **모델에서** 끌어낸다.
 *
 * 왜 필요한가(2026-08-30 조사): 옛 구현은 어느 공급자든 52,000자로 클램프했다. 그 숫자의 출처는
 * CPEN 의 64,000자 검증 상한(422)인데 **CPEN 은 제공자 레지스트리에서 사라졌다** — 지금 고를 수
 * 있는 것은 Antigravity 와 Codex 둘뿐이고 CPEN 전송 코드는 `cpen/` 접두사로 게이트돼 있어
 * 주입 게이트웨이 외에는 닿지 않는다. 그런데도 클램프만 무조건 걸려서, 창 1,048,576 토큰짜리
 * gemini-3.7-flash 가 **창의 1.3% 지점에서 대화 기억을 버렸다**
 * (pi-catalog `google-antigravity/gemini-3.7-flash`: contextWindow 1048576 / maxTokens 65536).
 *
 * 두 계층의 크기가 서로 어긋나 있던 것이 더 나쁘다. 압축(contextCompaction)은 요약으로 기억을
 * **옮기고**, 이 문자 클램프는 오래된 assistant/tool 을 통째로 **버린다**. 압축 계약이 남기기로
 * 한 분량(keepRecentTokens 20,000토큰 ≈ 80,000자)이 클램프(52,000자)보다 커서, 압축이 성공해도
 * 그 결과가 곧바로 클램프에 잘렸다 — 즉 똑똑한 계층은 사실상 돌 자리가 없었다.
 *
 * 그래서 예산을 압축 계약에서 끌어낸다: 남기기로 한 분량 + 요약·응답 여유 + 시스템 프롬프트 자리.
 * 이러면 클램프는 압축이 방금 한 일을 되돌리지 않는 **뒷받침**이 되고, 순서가 제자리로 온다.
 * 모델 창으로 한 번 더 조이고, CPEN 경로에서는 그 공급자의 하드 상한을 그대로 지킨다.
 */
export function resolveRequestCharBudget(config: Pick<AiConfig, "model" | "baseUrl">): number {
  if (isCpenRoute(config.model, config.baseUrl)) return REQUEST_MESSAGE_CHAR_BUDGET;
  // 클램프는 작업 창 전체를 담는다 — 그래야 압축이 방금 만든 결과(요약 + 잔존 꼬리)가 다시
  // 잘리지 않는다. 폴백(52,000)보다 좁아지지는 않는다.
  const workingChars = resolveWorkingContextTokens(config) * DEFAULT_CHARS_PER_TOKEN;
  return Math.max(REQUEST_MESSAGE_CHAR_BUDGET, workingChars);
}

/**
 * 압축 문턱과 문자 클램프가 **같이 보는 작업 창**(토큰).
 *
 * 모델 창을 그대로 쓰면 gemini(1M)의 문턱이 1,032,192 토큰이 되는데 클램프가 그 79분의 1 지점에서
 * 먼저 걸려 요약이 영영 돌지 않았다. 둘을 같은 창에 묶어 요약 → 클램프 순서를 세운다.
 *
 * CPEN 경로는 예외다. 그 공급자의 하드 상한(52,000자 = 13,000토큰)은 압축 계약(잔존 20,000 +
 * 여유 16,384 = 36,384토큰)을 애초에 담지 못한다. 여기서 작업 창을 클램프에 맞추면 문턱이
 * `13,000 - 16,384 = -3,384` 로 **음수가 되어 매 라운드 요약 LLM 이 돈다**(구현 중 실측으로 잡음).
 * 요약해도 결과가 클램프에 안 들어가 이득이 없으므로, 옛 동작(모델 창 = 사실상 요약 없음)을
 * 유지하고 클램프에 맡긴다.
 */
export function resolveWorkingContextTokens(config: Pick<AiConfig, "model" | "baseUrl">): number {
  const window = resolveContextWindow(config.model);
  if (isCpenRoute(config.model, config.baseUrl)) return window;
  return Math.min(window, WORKING_CONTEXT_TOKEN_CAP);
}

export function messageCharLength(message: ChatMessage): number {
  const content = message.content;
  if (content === null || content === undefined) return 0;
  if (typeof content === "string") return content.length;
  return content.reduce((sum, part) => sum + contentPartCharLength(part), 0);
}

function contentPartCharLength(part: ContentPart): number {
  if (part.type === "text") return part.text.length;
  return part.image_url.url.length;
}

export function totalMessagesCharLength(messages: readonly ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + messageCharLength(message), 0);
}

function compactToolContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      ok?: unknown;
      summary?: unknown;
      issues?: unknown;
      data?: unknown;
      diff?: unknown;
    };
    if (typeof parsed !== "object" || parsed === null) return raw;
    // data/diff 는 컨텍스트 폭파 주범 — ok/summary/issues 만 남긴다.
    const compact: Record<string, unknown> = { ok: parsed.ok };
    if (typeof parsed.summary === "string") compact.summary = parsed.summary;
    if (Array.isArray(parsed.issues)) compact.issues = parsed.issues;
    return JSON.stringify(compact);
  } catch {
    return raw;
  }
}

function compactUserParts(parts: ContentPart[]): ContentPart[] {
  // 이미지(base64) 파트를 제거해 텍스트만 남긴다 — 비전 이미지는 최근 턴에만 의미가 있다.
  return parts.filter((part) => part.type !== "image_url");
}

/**
 * 전송용 사본을 만들고 총 길이가 budgetChars 를 넘으면 오래된 메시지부터 압축한다.
 * - 시스템 프롬프트는 항상 유지.
 * - 최근 KEEP_RECENT_MESSAGES 개는 무압축.
 * - 그 밖의 user/tool 메시지는 이미지 제거 / 툴 결과 요약.
 * - 그래도 초과하면 최근 창 안의 이미지까지 버린다(지시 문장은 남는다).
 * - 마지막 수단으로 오래된 assistant/tool 메시지를 짝과 함께 버린다.
 *
 * **user 메시지는 절대 버리지 않는다.** 예전 구현은 예산 초과 시 `index > 0` 인 첫 메시지를
 * 지웠는데 그게 곧 사용자 지시였다. 짧은 대화(5개)에서는 최근 창(6개)이 전체를 덮어
 * 1차 압축이 아무것도 하지 않고, 곧바로 사용자 지시가 삭제됐다. 실측(2026-08-26): 맵 이미지가
 * 실린 첫 요청이 예산을 넘겨 user 턴이 사라지고 system → assistant(tool_calls) 순서가 되어
 * Cloud Code Assist 가 400 `Please ensure that function call turn comes immediately after a
 * user turn or after a function response turn` 로 거부했다. 지시를 잃는 것은 예산을 넘기는
 * 것보다 나쁘다 — 이미지를 먼저 버리고, 그래도 안 되면 assistant/tool 을 버린다.
 */
export function compactMessagesForRequest(
  messages: readonly ChatMessage[],
  budgetChars: number = REQUEST_MESSAGE_CHAR_BUDGET,
): ChatMessage[] {
  // 툴 짝 복구는 **마지막**에 돈다 — 아래 3차 폐기가 tool 응답만 버려 짝을 깰 수 있기 때문이다.
  return repairToolCallProtocol(clampMessagesToBudget(messages, budgetChars));
}

/**
 * 전송 사본의 **툴콜 프로토콜 불변식**을 세운다: assistant `tool_calls` 는 호출마다 정확히 한 개의
 * `role:"tool"` 응답을 갖고, 짝 없는 tool 응답은 없다.
 *
 * 왜 사본 계층에 있는가(2026-08-30 실측): 툴 실행 도중 예외가 나면 세션의 영구 대화에는
 * `assistant(tool_calls)` 만 남고 응답이 없다. 그 뒤 **모든** 요청이 같은 400 으로 죽는다 —
 * OpenAI 호환 게이트웨이는 `tool_calls` 뒤에 짝 응답을 요구하고, Gemini Cloud Code Assist 는
 * `Please ensure that function call turn comes immediately after a user turn or after a function
 * response turn` 으로 거부한다. 즉 한 번의 예외가 그 세션을 영구히 못 쓰게 만든다.
 * 세션 루프는 이제 응답을 보장하지만(실패 결과라도 붙인다), 이미 저장된 대화·아직 모르는 경로를
 * 위해 전송 경계에서도 같은 불변식을 세운다. 원본(this.messages)은 감사용으로 손대지 않는다.
 */
export function repairToolCallProtocol(messages: readonly ChatMessage[]): ChatMessage[] {
  const called = new Set<string>();
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) called.add(call.id);
  }
  const answered = new Set<string>();
  const repaired: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      // 짝 없는 function response 는 그 자체로 같은 400 을 부른다.
      if (message.tool_call_id === undefined || !called.has(message.tool_call_id)) continue;
      if (answered.has(message.tool_call_id)) continue; // 같은 id 중복 응답도 거부 사유다.
      answered.add(message.tool_call_id);
      repaired.push(message);
      continue;
    }
    repaired.push(message);
  }
  const unanswered: ChatMessage[] = [];
  for (const call of repaired.flatMap((message) => message.tool_calls ?? [])) {
    if (answered.has(call.id)) continue;
    answered.add(call.id);
    unanswered.push(lostToolResponse(call.id, call.function.name));
  }
  if (unanswered.length === 0) return repaired;
  // 유실 응답은 해당 assistant 메시지 바로 뒤에 꽂는다(공급자는 순서까지 본다).
  const byId = new Map(unanswered.map((message) => [message.tool_call_id!, message] as const));
  const ordered: ChatMessage[] = [];
  for (const message of repaired) {
    ordered.push(message);
    if (message.role !== "tool" && message.tool_calls) {
      const own = message.tool_calls.map((call) => byId.get(call.id)).filter((entry): entry is ChatMessage => entry !== undefined);
      // 같은 assistant 의 응답들 사이 순서는 공급자가 id 로 짝을 맞추므로 무관하다 —
      // 지켜야 하는 것은 "호출 메시지 다음에 응답들이 온다" 라는 바깥 순서뿐이다.
      ordered.push(...own);
    }
  }
  return ordered;
}

function lostToolResponse(toolCallId: string, name: string): ChatMessage {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    name,
    content: JSON.stringify({
      ok: false,
      summary: `'${name}' 결과가 유실됐습니다(앞선 턴이 중단됨). 필요하면 다시 호출하세요.`,
    }),
  };
}

function clampMessagesToBudget(
  messages: readonly ChatMessage[],
  budgetChars: number,
): ChatMessage[] {
  if (totalMessagesCharLength(messages) <= budgetChars) return [...messages];
  const result: ChatMessage[] = messages.map((message) => ({
    ...message,
    content: Array.isArray(message.content) ? [...message.content] : message.content,
  }));

  // 1차: 오래된 user/tool 메시지 압축 (최근 KEEP_RECENT_MESSAGES 개 제외, 시스템 제외).
  const compactBoundary = Math.max(1, result.length - KEEP_RECENT_MESSAGES);
  for (let index = 1; index < compactBoundary; index += 1) {
    const message = result[index];
    if (message.role === "tool" && typeof message.content === "string") {
      message.content = compactToolContent(message.content);
    } else if (message.role === "user" && Array.isArray(message.content)) {
      message.content = compactUserParts(message.content);
    }
    if (totalMessagesCharLength(result) <= budgetChars) return result;
  }

  // 2차: 최근 창 안의 이미지도 버린다 — 오래된 것부터. 비전 이미지는 재생성할 수 있지만
  // 사용자 지시는 재생성할 수 없다.
  for (let index = 1; index < result.length; index += 1) {
    const message = result[index];
    if (message.role !== "user" || !Array.isArray(message.content)) continue;
    const stripped = compactUserParts(message.content);
    if (stripped.length === message.content.length) continue;
    message.content = stripped;
    if (totalMessagesCharLength(result) <= budgetChars) return result;
  }

  // 3차: 여전히 초과면 오래된 assistant/tool 메시지를 버린다. user 는 건너뛴다.
  // assistant 가 툴을 호출했다면 그 응답(tool)도 같이 버려야 짝 없는 function response 가
  // 남지 않는다 — 그것도 같은 400 을 부른다.
  while (totalMessagesCharLength(result) > budgetChars) {
    const dropIndex = result.findIndex((entry, index) => (
      index > 0 && index < result.length - 2 && entry.role !== "user"
    ));
    if (dropIndex < 0) break;
    const dropped = result.splice(dropIndex, 1)[0];
    for (const call of dropped?.tool_calls ?? []) {
      const paired = result.findIndex((entry) => entry.role === "tool" && entry.tool_call_id === call.id);
      if (paired > 0) result.splice(paired, 1);
    }
  }
  return result;
}
