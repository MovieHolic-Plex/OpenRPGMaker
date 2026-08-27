// ai/contextCompaction.ts
// senpi(@code-yeongyu/senpi) 의 컨텍스트 압축 알고리즘을 OpenAI 호환 ChatMessage 배열로 이식한 것.
// 원본:
//   dist/core/compaction/compaction.js
//     — estimateTokens / ESTIMATED_IMAGE_CHARS / BASE64_CHAR_WEIGHT / resolveThresholdContextTokens /
//       shouldCompact / findCutPoint / DEFAULT_COMPACTION_SETTINGS / SUMMARIZATION_PROMPT 계열
//   dist/core/compaction/utils.js
//     — SUMMARIZATION_SYSTEM_PROMPT / serializeConversation / TOOL_RESULT_MAX_CHARS
//   dist/core/extensions/builtin/compaction/retained-message-safety.js
//     — 잔존 창은 "그대로 다시 전송해도 되는" 상태여야 한다는 규칙(여기서는 tool 짝 검사로 축약)
//
// **이 파일은 순수 함수만 담는다.** 네트워크·세션·localStorage·DOM 없음. 요약을 실제로 생성하는 LLM
// 호출은 호출자(세션 계층)의 몫이고, 여기서는 "언제 압축할지 / 어디서 자를지 / 무엇을 남길지 /
// 어떤 요청으로 요약을 시킬지" 만 계산한다.
//
// messageBudget.ts(REQUEST_MESSAGE_CHAR_BUDGET 52,000자 클램프)와는 다른 계층이다. 압축이 **먼저**
// 돌아 대화 자체를 줄이고, 그 결과를 전송 직전에 messageBudget 이 다시 잘라 공급자 하드 상한을 지킨다.
//
// 분량의 절반 가까이가 요약 프롬프트 문자열 상수(순수 데이터)다. 로직은 100 줄 안쪽이고,
// 프롬프트를 별 파일로 쪼개면 "언제 요약하고 무엇을 요약할지" 가 두 곳으로 흩어진다.

import type { ChatMessage, ContentPart } from "./llmClient";

export interface CompactionSettings {
  readonly enabled: boolean;
  /** 압축 결과 요약과 다음 응답을 담을 여유. senpi 기본 16384. */
  readonly reserveTokens: number;
  /** 요약하지 않고 그대로 남길 최근 대화 분량. senpi 기본 20000. */
  readonly keepRecentTokens: number;
}

export const DEFAULT_COMPACTION_SETTINGS: CompactionSettings = {
  enabled: true,
  reserveTokens: 16_384,
  keepRecentTokens: 20_000,
};

/**
 * 모델을 모를 때 쓰는 보수적 컨텍스트 창. 실제보다 작게 잡으면 압축이 좀 자주 돌 뿐이지만,
 * 크게 잡으면 압축 전에 공급자가 컨텍스트 초과로 턴을 죽인다 — 그래서 아래쪽으로 틀린다.
 */
export const DEFAULT_CONTEXT_WINDOW = 128_000;

/**
 * 모델별 컨텍스트 창. 접두사 기준으로만 판정한다 — 카탈로그(modelCatalog.ts)가 자주 늘어나고
 * cpen 게이트웨이는 `cpen/` 같은 제공자 접두사를 붙여 오기 때문에 정확 일치는 금방 낡는다.
 */
const CONTEXT_WINDOW_BY_MODEL_PREFIX: ReadonlyArray<readonly [string, number]> = [
  ["gemini-", 1_048_576],
  ["gpt-5", 400_000],
  ["gpt-daybreak", 400_000],
  ["codex", 400_000],
  ["claude-", 200_000],
  ["grok-", 256_000],
  ["qwen", 262_144],
  ["kimi", 262_144],
  ["glm-", 200_000],
  ["minimax", 200_000],
];

export function resolveContextWindow(model: string): number {
  // 제공자 접두사(`cpen/`, `z-ai/` 등)를 떼고 모델 ID 만 본다.
  const normalized = model.trim().toLowerCase();
  const bare = normalized.slice(normalized.lastIndexOf("/") + 1);
  for (const [prefix, window] of CONTEXT_WINDOW_BY_MODEL_PREFIX) {
    if (bare.startsWith(prefix)) return window;
  }
  return DEFAULT_CONTEXT_WINDOW;
}

// ── 토큰 추정 ────────────────────────────────────────────────────────────────

/** 이미지 한 장의 등가 문자 수(senpi ESTIMATED_IMAGE_CHARS). URL 길이는 세지 않는다. */
const ESTIMATED_IMAGE_CHARS = 4800;

/**
 * base64 페이로드·데이터 URL·헥스 덤프처럼 끊기지 않는 긴 런은 문자당 1토큰에 가깝게 쪼개진다
 * (산문의 4문자/토큰이 아니다). 그래서 그런 런만 4배로 가중해 chars/4 휴리스틱을 보수적으로
 * 유지한다 — 가중하지 않으면 1MB 인라인 스크린샷이 ~256K 토큰으로 추정되는데 공급자는 ~1M 을 센다.
 */
const BASE64_RUN_RE = /[A-Za-z0-9+/=_-]{512,}/g;
const BASE64_CHAR_WEIGHT = 4;

function weightedChars(text: string): number {
  let chars = text.length;
  for (const match of text.matchAll(BASE64_RUN_RE)) {
    chars += match[0].length * (BASE64_CHAR_WEIGHT - 1);
  }
  return chars;
}

function contentChars(content: string | ContentPart[] | null): number {
  if (content === null) return 0;
  if (typeof content === "string") return weightedChars(content);
  let chars = 0;
  for (const part of content) {
    if (part.type === "text") chars += weightedChars(part.text);
    else chars += ESTIMATED_IMAGE_CHARS;
  }
  return chars;
}

/**
 * 메시지 1개의 토큰 추정(chars/4 올림). 과대 추정 쪽으로 틀리도록 만든 값이다.
 *
 * senpi 원본은 assistant 텍스트 블록에만 가중치를 붙이지 않는데(어시스턴트가 base64 를 뱉는
 * 일이 드물다는 가정), 이 에디터의 assistant 는 툴 인자로 타일 배열·데이터 URL 을 그대로 실어
 * 보낸다. 그래서 여기서는 role 을 가리지 않고 같은 가중 규칙을 적용한다 — 보수적인 방향이다.
 * reasoning 은 원본의 thinking 블록과 같은 자리이므로 함께 센다.
 */
export function estimateMessageTokens(message: ChatMessage): number {
  let chars = contentChars(message.content);
  if (message.reasoning) chars += weightedChars(message.reasoning);
  for (const call of message.tool_calls ?? []) {
    // 원본은 name.length + weightedChars(JSON.stringify(arguments)) 다. OpenAI 규약의 arguments 는
    // 이미 직렬화된 문자열이므로 다시 stringify 하지 않고 그대로 센다(따옴표 이스케이프만큼의 차이).
    chars += call.function.name.length + weightedChars(call.function.arguments);
  }
  return Math.ceil(chars / 4);
}

/**
 * 대화 전체의 토큰 추정. extraChars 는 메시지에 실리지 않는 부가 문자(툴 스키마 등)를 넣는 자리다.
 */
export function estimateContextTokens(messages: readonly ChatMessage[], extraChars = 0): number {
  let tokens = 0;
  for (const message of messages) tokens += estimateMessageTokens(message);
  return tokens + Math.ceil(Math.max(0, extraChars) / 4);
}

/**
 * 임계 판정에 쓸 컨텍스트 토큰. 과금 usage 와 로컬 추정 중 큰 쪽을 쓰되, usage 가 추정보다
 * 터무니없이 크면(공급자 cacheRead 스파이크: 수백만 vs 로컬 15만) 추정을 믿는다.
 * 출처: compaction.js resolveThresholdContextTokens.
 */
export function resolveThresholdContextTokens(usageTokens: number, estimateTokens: number): number {
  const usage = usageTokens > 0 ? usageTokens : 0;
  const estimate = estimateTokens > 0 ? estimateTokens : 0;
  if (estimate >= 50_000 && usage > estimate * 8) return estimate;
  return Math.max(usage, estimate);
}

export function shouldCompact(contextTokens: number, contextWindow: number, settings: CompactionSettings): boolean {
  if (!settings.enabled) return false;
  return contextTokens > contextWindow - settings.reserveTokens;
}

// ── 절단점 탐색 ──────────────────────────────────────────────────────────────

export interface CompactionCutPoint {
  /** 이 인덱스부터 원문을 남긴다(앞쪽은 요약으로 대체). */
  readonly firstKeptIndex: number;
  /** 턴 중간에서 잘렸을 때 그 턴을 시작한 user 인덱스. 아니면 -1. */
  readonly turnStartIndex: number;
  readonly isSplitTurn: boolean;
}

/**
 * 절단 가능한 지점인가. user/assistant 만 가능하다. role "tool" 은 **절대** 절단점이 아니다 —
 * 자기 tool_call 뒤에 붙어 있어야 하기 때문이다. 인덱스 0(시스템 프롬프트)도 대상이 아니다.
 */
function isCutPointIndex(messages: readonly ChatMessage[], index: number): boolean {
  if (index < 1) return false;
  const role = messages[index]?.role;
  return role === "user" || role === "assistant";
}

/**
 * 최근 keepRecentTokens 만큼을 남기는 절단점을 찾는다(compaction.js findCutPoint 이식).
 *
 * 최신 메시지에서 뒤로 걸으며 추정 토큰을 누적하고, keepRecentTokens 에 닿으면 그 지점 **이후의
 * 가장 가까운 유효 절단점** 으로 스냅한다. 이후에 절단점이 없으면 가장 마지막 절단점을 쓴다.
 */
export function findCompactionCutPoint(
  messages: readonly ChatMessage[],
  keepRecentTokens: number,
): CompactionCutPoint {
  const cutPoints: number[] = [];
  for (let index = 1; index < messages.length; index += 1) {
    if (isCutPointIndex(messages, index)) cutPoints.push(index);
  }
  if (cutPoints.length === 0) {
    // 남길 원문이 없다 — 시스템 프롬프트 바로 뒤를 경계로 본다.
    return { firstKeptIndex: Math.min(1, messages.length), turnStartIndex: -1, isSplitTurn: false };
  }

  let accumulated = 0;
  let cutIndex = cutPoints[0];
  for (let index = messages.length - 1; index >= 1; index -= 1) {
    const tokens = estimateMessageTokens(messages[index]);
    if (tokens === 0) continue;
    accumulated += tokens;
    if (accumulated < keepRecentTokens) continue;
    const snapped = cutPoints.find((candidate) => candidate >= index);
    cutIndex = snapped ?? cutPoints[cutPoints.length - 1];
    break;
  }

  if (messages[cutIndex].role === "user") {
    return { firstKeptIndex: cutIndex, turnStartIndex: -1, isSplitTurn: false };
  }
  // assistant 에서 잘렸다 = 턴 중간이다. 그 턴을 시작한 user 를 찾아 호출자가 앞부분(prefix)을
  // 따로 요약할 수 있게 한다.
  let turnStartIndex = -1;
  for (let index = cutIndex; index >= 1; index -= 1) {
    if (messages[index].role === "user") {
      turnStartIndex = index;
      break;
    }
  }
  return { firstKeptIndex: cutIndex, turnStartIndex, isSplitTurn: turnStartIndex !== -1 };
}

/**
 * 잔존 창을 "그대로 다시 전송해도 되는" 상태로 만든다(retained-message-safety.js 의 취지).
 *
 * role "tool" 은 창 안에 짝(assistant.tool_calls) 이 **먼저** 나온 것만 남긴다. 창 선두의 tool
 * 이나 짝을 잃은 tool 은 버린다 — 짝 없는 function response 는 Gemini/Cloud Code Assist 경로에서
 * 400 이다(messageBudget.ts 주석의 실측과 같은 실패 모드).
 */
export function repairRetainedTail(messages: readonly ChatMessage[]): ChatMessage[] {
  const answered = new Set<string>();
  const repaired: ChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      if (message.tool_call_id === undefined || !answered.has(message.tool_call_id)) continue;
      repaired.push(message);
      continue;
    }
    for (const call of message.tool_calls ?? []) answered.add(call.id);
    repaired.push(message);
  }
  return repaired;
}

// ── 요약 메시지 ──────────────────────────────────────────────────────────────

/** 요약 메시지를 다시 알아보기 위한 구조 토큰. 사람이 읽는 문구가 아니라 식별자다. */
export const COMPACTION_SUMMARY_MARKER = "[context-compaction-summary]";

export function isCompactionSummaryMessage(message: ChatMessage): boolean {
  return message.role === "user" && typeof message.content === "string" && message.content.startsWith(COMPACTION_SUMMARY_MARKER);
}

/**
 * 요약을 대화에 되꽂는 메시지. **role 은 user 다.** 잔존 꼬리가 assistant(tool_calls) 로 시작할 수
 * 있고, 그 앞에 user 턴이 없으면 Cloud Code Assist 가 400 `function call turn comes immediately
 * after a user turn` 로 거부한다(messageBudget.ts 실측). 요약을 user 로 두면 그 조건도 함께 만족한다.
 */
export function compactionSummaryMessage(summary: string): ChatMessage {
  return { role: "user", content: `${COMPACTION_SUMMARY_MARKER}\n${summary}` };
}

export function findPreviousSummary(messages: readonly ChatMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    // typeof 검사는 content 를 string 으로 좁히기 위한 것이고, 마커 판정은 위 함수에 맡긴다.
    if (typeof message.content !== "string" || !isCompactionSummaryMessage(message)) continue;
    return message.content.slice(COMPACTION_SUMMARY_MARKER.length + 1);
  }
  return null;
}

// ── 요약 요청 구성 ───────────────────────────────────────────────────────────

/** 출처: utils.js SUMMARIZATION_SYSTEM_PROMPT(원문 유지). */
export const SUMMARIZATION_SYSTEM_PROMPT = `You are a context summarization assistant. Your task is to read a conversation between a user and an AI assistant, then produce a structured summary following the exact format specified.

Do NOT continue the conversation. Do NOT respond to any questions in the conversation. ONLY output the structured summary.`;

/** 요약 입력에 실을 tool 결과 1개의 최대 문자 수(utils.js TOOL_RESULT_MAX_CHARS). */
const TOOL_RESULT_MAX_CHARS = 2000;

function truncateForSummary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[... ${text.length - maxChars} more characters truncated]`;
}

function plainText(content: string | ContentPart[] | null): string {
  if (content === null) return "";
  if (typeof content === "string") return content;
  // 이미지는 요약에 넣을 수 없다 — 텍스트 파트만 이어붙인다.
  return content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
}

/**
 * 대화를 **텍스트로** 직렬화한다(utils.js serializeConversation). 메시지 배열로 넘기면 모델이
 * "이어서 대답할 대화" 로 취급하므로, 요약 대상은 반드시 한 덩어리 텍스트로 넣는다.
 * 시스템 프롬프트는 요약 대상이 아니라 제외한다.
 */
function serializeConversation(messages: readonly ChatMessage[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    const text = plainText(message.content);
    switch (message.role) {
      case "system":
        break;
      case "user":
        if (text) parts.push(`[User]: ${text}`);
        break;
      case "assistant": {
        if (message.reasoning) parts.push(`[Assistant thinking]: ${message.reasoning}`);
        if (text) parts.push(`[Assistant]: ${text}`);
        const calls = (message.tool_calls ?? []).map((call) => `${call.function.name}(${call.function.arguments})`);
        if (calls.length > 0) parts.push(`[Assistant tool calls]: ${calls.join("; ")}`);
        break;
      }
      case "tool":
        if (text) parts.push(`[Tool result]: ${truncateForSummary(text, TOOL_RESULT_MAX_CHARS)}`);
        break;
    }
  }
  return parts.join("\n\n");
}

/** 출처: compaction.js SUMMARIZATION_PROMPT(신규 요약). 형식은 원문 유지. */
const SUMMARIZATION_PROMPT = `The messages above are a conversation to summarize. Create a structured context checkpoint summary that another LLM will use to continue the work.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? Can be multiple items if the session covers different tasks.]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned by user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [Ordered list of what should happen next]

## Critical Context
- [Any data, examples, or references needed to continue]
- [Or "(none)" if not applicable]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

/** 출처: compaction.js UPDATE_SUMMARIZATION_PROMPT(이전 요약 갱신). 형식은 원문 유지. */
const UPDATE_SUMMARIZATION_PROMPT = `The messages above are NEW conversation messages to incorporate into the existing summary provided in <previous-summary> tags.

Update the existing structured summary with new information. RULES:
- PRESERVE all existing information from the previous summary
- ADD new progress, decisions, and context from the new messages
- UPDATE the Progress section: move items from "In Progress" to "Done" when completed
- UPDATE "Next Steps" based on what was accomplished
- PRESERVE exact file paths, function names, and error messages
- If something is no longer relevant, you may remove it

Use this EXACT format:

## Goal
[Preserve existing goals, add new ones if the task expanded]

## Constraints & Preferences
- [Preserve existing, add new ones discovered]

## Progress
### Done
- [x] [Include previously done items AND newly completed items]

### In Progress
- [ ] [Current work - update based on progress]

### Blocked
- [Current blockers - remove if resolved]

## Key Decisions
- **[Decision]**: [Brief rationale] (preserve all previous, add new)

## Next Steps
1. [Update based on current state]

## Critical Context
- [Preserve important context, add new if needed]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

/**
 * 요약을 시킬 요청 메시지. [system 지침, 직렬화된 대화(+이전 요약), 형식 지시] 세 개다.
 * 이전 요약이 있으면 그것을 **보존하며 갱신하는** UPDATE 변형을 쓴다.
 */
export function buildSummarizationRequest(
  source: readonly ChatMessage[],
  previousSummary?: string | null,
): ChatMessage[] {
  let conversation = `<conversation>\n${serializeConversation(source)}\n</conversation>\n\n`;
  if (previousSummary) conversation += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
  return [
    { role: "system", content: SUMMARIZATION_SYSTEM_PROMPT },
    { role: "user", content: conversation },
    { role: "user", content: previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT },
  ];
}

/**
 * 압축된 대화를 조립한다: 시스템 프롬프트 → 요약 → 수리된 잔존 꼬리.
 * 원본 배열은 건드리지 않는다(감사·하네스용 원문 보존은 messageBudget 과 같은 방침).
 */
export function buildCompactedMessages(args: {
  readonly messages: readonly ChatMessage[];
  readonly cutPoint: CompactionCutPoint;
  readonly summary: string;
}): ChatMessage[] {
  const { messages, cutPoint, summary } = args;
  const head = messages.length > 0 && messages[0].role === "system" ? [messages[0]] : [];
  return [...head, compactionSummaryMessage(summary), ...repairRetainedTail(messages.slice(cutPoint.firstKeptIndex))];
}
