// ai/assistantSession.ts
// 어시스턴트 세션: user msg → LLM → tool_calls → runTool(dryRun 누적) → tool 메시지 → … → 최종 응답.
// - 쓰기 툴은 로컬 draft(ctx.project)에 누적되어 연쇄 툴콜이 이전 결과를 본다(store는 건드리지 않음).
// - 커밋 게이트/인자 검증 실패 시 issues를 tool 메시지로 모델에 되돌려 자가수정을 유도(최대 maxToolCalls 왕복).
// - 브라우저 비의존(순수). chat 함수는 주입 가능(테스트에서 모킹).

import { getTool, runTool } from "@/editor/tools";
import { toOpenAiTools } from "@/editor/tools";
import type { ToolContext, ToolDomain, ToolResult } from "@/editor/tools";
import type { LintIssue } from "@/project/lint/projectLint";
import { beginAssistantToolDomainTurn, computeActiveToolDomains, recordAssistantToolDomainUse } from "@/editor/assistantToolMode";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS, resolveContextViewport, type ContextOptions } from "./contextBuilder";
import {
  calibratedBudgetChars,
  estimatePromptChars,
  loadTokenObservations,
  recordTokenObservation,
} from "./tokenBudget";
import {
  formatViewportContextBlock,
  mapRegionImagePayload,
} from "./mapViewportContext";
import {
  chatCompletion,
  configForLiteModel,
  configWithReasoningPolicy,
  isLlmAbortError,
  isRetryableLlmError,
  LLM_RETRY_BACKOFF_MS,
  loadAiConfig,
  type AiConfig,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ContentPart,
  type OpenAiToolSchema,
  type ToolCall,
} from "./llmClient";
import {
  SPATIAL_BUILD_TOOLS,
  affectedRegions,
  boundarySlackForTool,
  checkRegionsAgainstSpecBoundary,
  builtCellsInRegions,
  implicitSpecFromContext,
  uncoveredRegionsBySpec,
  validateBuildSpec,
  type AffectedRegion,
  type BuildSpec,
  type SpecAsset,
} from "./buildSpec";
import {
  PROPOSAL_COMPLETENESS_WARNING_PREFIX,
  proposalCompletenessWarnings,
  proposalHasChangedMap,
  proposalScopeCarryoverWarning,
  requestLikelyExpectsChange,
} from "./proposalCompleteness";
import {
  formatIntentClarifyMessage,
  resolveIntentClarification,
} from "./intentClarify";
import {
  MAX_WORK_PLAN_AUTO_STEPS_PER_TURN,
  ORCHESTRATOR_SYSTEM_PROMPT,
  advanceWorkPlanFromTools,
  buildDefaultWorkPlan,
  buildOrchestratorUserPayload,
  completeWorkItemById,
  formatRalphContinueMessage,
  formatWorkPlanForOrchestration,
  formatWorkPlanUserVisible,
  getCurrentWorkItem,
  isWorkPlanComplete,
  parseOrchestratorDecision,
  shouldRalphContinue,
  skipWorkItemById,
  summarizeWorkPlan,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
  type WorkPlan,
} from "./workPlan";

// UI 스트리밍/로그용 이벤트.
export type SessionEvent =
  | { type: "assistant_token"; delta: string }
  | { type: "reasoning_token"; delta: string }
  | { type: "assistant_message"; content: string }
  | { type: "assistant_stream_reset" }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; result: ToolResult }
  | { type: "phase"; value: "plan" | "execute" | "review" }
  | { type: "status"; text: string }
  | { type: "work_plan"; plan: WorkPlan };

// 제안(changeset)에 담기는 개별 쓰기 툴콜.
export interface ProposedCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  result: ToolResult;
  destructive: boolean; // remove_event 등 파괴적 작업.
  requiresApproval?: boolean;
  approvalWarning?: string;
}

export interface TurnResult {
  assistantText: string;
  proposedCalls: ProposedCall[]; // 성공한 쓰기 툴콜(수락 시 store에 적용할 시퀀스).
  stoppedReason: "final" | "max-tool-calls" | "token-budget" | "error" | "aborted";
  error?: string;
  /** 어려운 요청의 다층 To-do 진행 상태(있으면 UI/브리지에 노출). */
  workPlan?: WorkPlan;
}

// 감사 로그 항목(Phase 1 헤드리스 러너로 리플레이 가능한 시퀀스).
// at: ISO 타임스탬프(결함 ⑬ — 상태 전이/툴 호출/오류 타임라인을 export 가능하게).
// kind:"status"는 턴 수명주기(시작/종료 사유/오류/재시도) 전이 기록이다.
export type AuditEntry =
  | { kind: "user"; text: string; at?: string }
  | { kind: "assistant"; text: string; toolCalls?: { name: string; args: string }[]; at?: string }
  | { kind: "tool"; name: string; args: Record<string, unknown>; ok: boolean; summary: string; issues?: string[]; construction?: import("@/editor/construction/constructionAudit").ConstructionAuditRecord; at?: string }
  | { kind: "status"; text: string; at?: string };

// 하네스 스냅샷 — 오케스트레이션 주입을 포함한 세션 원본 메시지와 감사 로그를 한 번에 관측한다.
// 🔬 하네스 뷰어와 window.__rpgzzuAiHarness(헤드리스 디버깅)가 소비한다.
export interface HarnessSnapshot {
  readonly model: string;
  readonly liteModel?: string;
  readonly maxTokens: number;
  readonly messages: readonly ChatMessage[];
  readonly audit: readonly AuditEntry[];
  readonly workPlan?: WorkPlan | null;
}

type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

// 파괴적으로 간주하는 툴 이름.
const DESTRUCTIVE_TOOLS = new Set(["remove_event", "remove_map"]);
export const RULE_TOOLS: ReadonlySet<string> = new Set(["set_cluster_rule", "set_group_junction", "set_group_overlay"]);
// 어휘 합의: propose_tile_vocabulary 또는 soft-confirm 시공(목업 확인) 수락 시에만 origin:user.
// requiresApproval 이 메타데이터 자동 커밋·autoApprove 를 막아 명시 수락만 합의로 친다.
export const VOCABULARY_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(["propose_tile_vocabulary"]);
const VOCABULARY_APPROVAL_WARNING = "🔒 재료 합의 제안: 적용하면 해당 타일/그룹을 다음부터 바로 씁니다. 자동 적용되지 않습니다.";
const VOCAB_SOFT_CONFIRM_APPROVAL_WARNING =
  "🖼 맵 배치 초안입니다. [맵만 적용]은 배치만, [맵 적용 + 재료 합의]는 배치와 재료 영구 합의(origin:user)를 함께 합니다.";
const HARD_CLUSTER_RULE_WARNING = "⚠️ 강한 규칙: 이 타일셋을 쓰는 모든 맵의 저장(커밋)이 규칙 위반 시 거부됩니다.";
export const TOKEN_BUDGET_STATUS_TEXT = "요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.";
const EXECUTION_PHASE_HINT = "실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지";
const ZERO_CHANGE_REKICK_HINT = "사용자는 변경을 기대합니다. 질문이 아니면 지금 계획을 세우고 실행하세요";
const ORCHESTRATION_PREFIX = "[오케스트레이션] ";
const REVIEW_REEXECUTE_PREFIX = "재실행:";
const REVIEW_COMPLETE_PREFIX = "완료:";
const RAW_TOOL_CALL_OMISSION_NOTICE = "…(형식 오류로 일부 생략)";
const RAW_STREAM_GUARD_CHARS = 64;

type AssistantPhase = "plan" | "execute" | "review";

export function proposalNeedsExplicitApproval(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => call.requiresApproval === true);
}

export function proposalApprovalWarnings(calls: readonly ProposedCall[]): string[] {
  const warnings = calls
    .map((call) => call.approvalWarning)
    .filter((warning): warning is string => typeof warning === "string" && warning.length > 0);
  return [...new Set(warnings)];
}

export function ruleToolRejectionText(name: string, result: ToolResult): string | null {
  if (!RULE_TOOLS.has(name) || result.ok) return null;
  const issues = result.issues ?? [];
  if (issues.length === 0) return `실패 · ${name} — 커밋 거부: ${result.summary}`;
  const samples = issues
    .filter((issue) => typeof issue.mapId === "string" && typeof issue.x === "number" && typeof issue.y === "number")
    .slice(0, 2)
    .map((issue) => `${issue.mapId} ${issue.x},${issue.y}`);
  const coords = samples.length > 0 ? ` (${samples.join(" / ")}${issues.length > samples.length ? " …" : ""})` : "";
  return `실패 · ${name} — 커밋 거부: 위반 ${issues.length}곳${coords}`;
}

function approvalWarningFor(name: string, args: Record<string, unknown>): string | undefined {
  if (VOCABULARY_PROPOSAL_TOOLS.has(name)) return VOCABULARY_APPROVAL_WARNING;
  const rule = args.rule;
  if (name !== "set_cluster_rule" || !isRecord(rule)) return undefined;
  return rule.strength === "hard" ? HARD_CLUSTER_RULE_WARNING : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rawToolCallMarkupIndex(text: string): number {
  const lower = text.toLowerCase();
  const indexes = [
    lower.indexOf("<tool_call>"),
    lower.indexOf("]<]minimax[>["),
  ].filter((index) => index >= 0);
  const invoke = /<invoke\s+name\s*=/iu.exec(text);
  if (invoke?.index !== undefined) indexes.push(invoke.index);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

export function hasRawToolCallMarkup(text: string): boolean {
  return rawToolCallMarkupIndex(text) >= 0;
}

export function sanitizeAssistantText(text: string): string {
  const index = rawToolCallMarkupIndex(text);
  if (index < 0) return text;
  const safePrefix = text.slice(0, index).trimEnd();
  return `${safePrefix}${RAW_TOOL_CALL_OMISSION_NOTICE}`;
}

function assistantTextLooksLikeQuestion(text: string): boolean {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-2);
  return lines.some((line) => (
    /[?？]\s*$/u.test(line) ||
    /(까요|을까요|ㄹ까요|나요|인가요|습니까|하시겠어요|해도 될까요)[.!…\s]*$/u.test(line)
  ));
}

function orchestrationContent(content: string): string {
  return `${ORCHESTRATION_PREFIX}${content}`;
}

function isOrchestrationMessage(message: ChatMessage, index: number): boolean {
  if (index === 0) return false;
  if (typeof message.content !== "string") return false;
  if (message.role === "user" && message.content.startsWith(ORCHESTRATION_PREFIX)) return true;
  // 핫픽스 전 세션에 남아 있을 수 있는 mid-history system 주입도 턴 종료 시 제거한다.
  if (message.role !== "system") return false;
  return (
    message.content === EXECUTION_PHASE_HINT ||
    message.content.startsWith("검수 단계:") ||
    message.content.startsWith("검수 보완 지시:")
  );
}

function createRawMarkupTokenGuard(emit: (delta: string) => void): { feed(delta: string): void; flush(): void } {
  let pending = "";
  let blocked = false;
  const emitSafe = (text: string): void => {
    if (text) emit(text);
  };
  return {
    feed(delta: string): void {
      if (blocked || !delta) return;
      pending += delta;
      const rawIndex = rawToolCallMarkupIndex(pending);
      if (rawIndex >= 0) {
        emitSafe(pending.slice(0, rawIndex));
        pending = "";
        blocked = true;
        return;
      }
      if (pending.length <= RAW_STREAM_GUARD_CHARS) return;
      const emitLength = pending.length - RAW_STREAM_GUARD_CHARS;
      emitSafe(pending.slice(0, emitLength));
      pending = pending.slice(emitLength);
    },
    flush(): void {
      if (blocked) return;
      const rawIndex = rawToolCallMarkupIndex(pending);
      if (rawIndex >= 0) {
        emitSafe(pending.slice(0, rawIndex));
        pending = "";
        blocked = true;
        return;
      }
      emitSafe(pending);
      pending = "";
    },
  };
}

// ── 비전(BUG C) ───────────────────────────────────────────────────
// 툴 결과는 지금까지 텍스트 JSON으로만 모델에 전달됐다 — 비전 모델이 타일을 '보지' 못해
// 의미를 지어냈다(예: 타일 80을 '탁자'로 오인). 렌더러가 있으면 '보여줘' 계열 툴의 이미지를
// 후속 user 메시지로 주입해 모델이 실제로 보게 한다. 렌더러는 브라우저 전용(패널이 주입).
export interface RenderedToolImage {
  dataUrl: string;
  label: string;
}
export type ToolImageRenderer = (
  project: Project,
  toolName: string,
  data: unknown
) => Promise<RenderedToolImage[]>;

// 이미지를 주입할 툴(명시적 '보여줘' 계열 + 미리보기). get_map_region 등 빈번 조회는 텍스트로 두어 토큰을 아낀다.
const VISION_TOOLS = new Set(["show_tiles", "show_tile_grid", "show_map_region", "preview_house", "render_group_sample"]);

// ── 스펙 게이트(2026-07-05, '모호도' 대체) ────────────────────────
// 자기 신고 수치([모호도 N%]) 대신 코드가 검증하는 밑그림(명세)을 쓴다:
// 공간 쓰기 툴은 set_build_spec으로 제출되어 결정적으로 검증(경계/겹침)된 명세를 기준으로 실행된다.
// 명세 밖 빈 영역은 자동 확장 warning으로 통과하고, 기존 구조물 파괴 위험만 차단한다.
// 사용자가 맵에서 선택한 영역은 암묵적 명세. 검증 3회 실패 시 그 계획은 폐기하고 새 명세로 재계획하게 한다.

// 타일 지식 기록(인터뷰/시연의 답 기록)은 맵/이벤트를 바꾸지 않는 계열 —
// 제안 카드 없이 즉시 저장되는 목록(패널이 자동 반영 판단에 공유한다).
export const METADATA_ONLY_TOOLS = new Set([
  "set_tile_metadata",
  "set_tile_rules",
  "upsert_tile_group",
  "set_tile_passability",
]);

// 세션 전용 툴: 공간 빌드 전 밑그림 제출. 레지스트리 툴이 아니라(프로젝트를 바꾸지 않음)
// 세션이 직접 처리하며, tools 배열에는 이 스키마를 덧붙여 모델에 노출한다.
const SET_BUILD_SPEC_TOOL: OpenAiToolSchema = {
  type: "function",
  function: {
    name: "set_build_spec",
    description:
      "공간 빌드(집/마을/길/청소/NPC 배치/지형 채우기) 전 밑그림(명세)을 제출한다. 검증(경계/겹침) 통과 후 공간 빌드 툴을 실행한다. 페인트/배치 호출이 명세 밖 빈 영역을 쓰면 명세를 자동 확장해 warning으로 통과하지만, 기존 구조물 파괴 위험은 차단된다. 에셋마다 겹치지 않는 영역(x,y,w,h)을 배정하라.",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string" },
        title: { type: "string", description: "밑그림 이름(예: 잿불 마을 확장)" },
        assets: {
          type: "array",
          description:
            "[{id,kind,x,y,w,h,layer?,style?,confirmDestroy?}] — kind: house|road|npc|prop|clear 등, layer: lower(기본)|upper(장식). " +
            "clear 에셋이 기존 구조물(집 등)을 덮으면 confirmDestroy:true가 있어야 통과합니다 — '주변 청소'는 구조물을 피해 영역을 좁히세요.",
          items: { type: "object" },
        },
        buildOrder: {
          type: "array",
          items: { type: "string" },
          description: "건설 순서(kind 목록, 예: [\"clear\",\"terrain\",\"prop\"]). clear가 먼저 오는 buildOrder에서는 후속 배치 에셋이 clear 영역을 덮을 수 있다.",
        },
        pathWidth: { type: "integer", description: "통로 너비(칸)" },
        density: { type: "string", enum: ["spacious", "normal", "dense"], description: "에셋 분배(넓찍/보통/다닥)" },
        layoutStyle: { type: "string", enum: ["straight", "curved", "random"], description: "배치 스타일" },
      },
      required: ["mapId", "assets"],
    },
  },
};

// 검증 실패 허용 횟수(턴당). 초과하면 계획 폐기를 지시한다 — 루프 방지.
const MAX_SPEC_REJECTIONS = 3;
const ASSISTANT_TURN_RETRY_ATTEMPTS = 3;
const TRANSIENT_NETWORK_RETRY_GUIDANCE = "일시적 네트워크 문제로 보이면 재시도를 눌러 주세요.";

/**
 * Session-only WorkPlan tools (Claude TodoWrite / Anthropic task-list style).
 * Always available so the main model can plan/replan inside the ReAct loop;
 * the pre-turn planner also authors the first plan without tools.
 */
const WORK_PLAN_TOOLS: readonly OpenAiToolSchema[] = [
  {
    type: "function",
    function: {
      name: "get_work_plan",
      description: "현재 다층 WorkPlan 진행 상태를 조회한다. 미완료 항목이 있으면 반드시 현재 항목만 실행한다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "set_work_plan",
      description:
        "다층 작업 계획을 새로 세우거나 전면 교체한다(replan). layers/items 구조로 goal을 분해한다. " +
        "실행 중 목표가 바뀌었거나 기존 계획이 틀렸을 때만 호출. 한 항목 완료에는 complete_work_item을 쓴다.",
      parameters: {
        type: "object",
        properties: {
          goal: { type: "string", description: "전체 목표" },
          plannerNote: { type: "string", description: "전략 메모(선택)" },
          layers: {
            type: "array",
            description:
              "[{title, items:[{title, instruction, doneWhen?, successTools?}]}] — 2~6 레이어, 항목당 구체 instruction",
            items: { type: "object" },
          },
        },
        required: ["goal", "layers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_work_item",
      description:
        "현재 또는 지정 항목을 완료하고 다음 항목으로 넘긴다. doneWhen 충족 또는 해당 단계 쓰기 툴 성공 후 호출.",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string", description: "생략 시 현재 in_progress 항목" },
          note: { type: "string", description: "완료 메모" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skip_work_item",
      description: "현재 또는 지정 항목을 건너뛰고 다음으로 간다(막혔을 때만).",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          note: { type: "string" },
        },
      },
    },
  },
];

function specGateResult(summary: string, guidance: readonly string[]): ToolResult {
  return {
    ok: false,
    summary,
    issues: [{ severity: "error", code: "spec-gate", message: guidance.join(" ") }],
  };
}

interface SpecGatePass {
  warnings: LintIssue[];
}

export interface AssistantSessionOptions {
  config?: AiConfig;
  contextOptions?: ContextOptions;
  // 테스트/대체용 chat 구현. 기본은 설정 baseUrl의 OpenAI 호환 chatCompletion.
  chat?: ChatFn;
  // 비전 이미지 렌더러(브라우저 전용). 없으면 텍스트 전용(Node/테스트에서 동일 동작).
  renderImages?: ToolImageRenderer;
  // 이전 모드 스코핑 호환 옵션. 현재는 computeActiveToolDomains()가 UI 도메인을 직접 계산한다.
  toolMode?: () => ToolDomain | undefined;
}

export class AssistantSession {
  private config: AiConfig;
  private readonly chat: ChatFn;
  private readonly contextOptions: ContextOptions;
  // 비전 렌더러(브라우저 전용). 주입되면 '보여줘' 툴 이미지가 모델에 전달된다.
  private readonly renderImages?: ToolImageRenderer;
  // 누적 draft를 담는 툴 컨텍스트(연쇄 툴콜이 이전 변경을 본다).
  private ctx: ToolContext;
  private readonly messages: ChatMessage[] = [];
  private readonly audit: AuditEntry[] = [];
  // 세션 시작 시점 스냅샷(수락 시 store와 대조/리플레이용). rebaseProject로 갱신될 수 있다.
  baselineProject: Project;
  // 스펙 게이트 상태: 확정된 밑그림은 턴 간 유지된다(사용자가 "계속해"로 이어가도 재제출 불필요).
  // 새 set_build_spec이 검증을 통과하면 교체된다.
  private activeSpec: BuildSpec | null = null;
  private activeSpecTurnIndex = 0;
  private currentTurnIndex = 0;
  // 이번 턴 사용자 메시지의 [컨텍스트] 선택 영역에서 파생된 암묵적 명세(턴마다 재계산).
  private turnImplicitSpec: BuildSpec | null = null;
  // 이번 턴 시작 전에 이미 존재하던 명시 스펙. 이 스펙으로 변경 제안이 만들어지면
  // 카드에 이전 계획 포함 경고를 붙인다(D06).
  private carryoverSpecForTurn: BuildSpec | null = null;
  private carryoverWarningAdded = false;
  // 이번 턴의 명세 검증 실패 횟수 — MAX_SPEC_REJECTIONS 초과 시 폐기 지시.
  private specRejections = 0;
  // 이번 턴에 누적된 제안 — 오류 후 재시도(retryLastTurn)에서도 이어진다(결함 ⑥).
  private turnProposals = new Map<string, ProposedCall>();
  /** place_props 등 산포 중복 호출 억제 — 같은 인자로 이미 성공한 쓰기는 재실행하지 않는다. */
  private turnWriteDedupe = new Map<string, ToolResult>();
  private eventBaseProposalKeys = new Map<string, string>();
  private currentTurnToolDomains: ReadonlySet<ToolDomain> | undefined;
  private currentTurnRequestText = "";
  // 직전 턴이 LLM 오류로 끊겼는가(수동 재시도 허용 플래그).
  private lastTurnFailed = false;
  // 현재 시스템 프롬프트에 적용된 문자 예산(토큰 보정). 관측으로 값이 바뀌면 턴 시작 시 재조립한다.
  private appliedBudgetChars: number;
  /** 어려운 요청용 다층 To-do — 턴을 넘나들며 유지. */
  private workPlan: WorkPlan | null = null;
  /** 이번 사용자 메시지 안에서 자동으로 진행한 추가 단계 수. */
  private workPlanAutoStepsThisUserMessage = 0;
  /** 이번 사용자 메시지 동안 성공한 쓰기 툴 이름(WorkPlan complete 가드용). */
  private turnSuccessfulWriteTools = new Set<string>();

  constructor(project: Project, options: AssistantSessionOptions = {}) {
    this.config = options.config ?? loadAiConfig();
    this.chat = options.chat ?? chatCompletion;
    this.contextOptions = options.contextOptions ?? {};
    this.renderImages = options.renderImages;
    this.baselineProject = structuredClone(project);
    this.ctx = { project: structuredClone(project) };
    // 토큰 보정: 명시 budgetChars가 없으면 실측 usage 관측(localStorage — 없으면 빈 목록)으로
    // 문자 예산을 재척도한다. 관측이 없으면 DEFAULT_BUDGET_CHARS 그대로(현행 동작).
    this.appliedBudgetChars = this.contextOptions.budgetChars
      ?? calibratedBudgetChars(DEFAULT_BUDGET_CHARS, loadTokenObservations());
    this.messages.push({
      role: "system",
      content: buildSystemPrompt(project, { ...this.contextOptions, budgetChars: this.appliedBudgetChars }),
    });
  }

  getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  // 설정 폼에서 저장한 새 설정(API 키/모델 등)을 진행 중인 세션에도 반영한다.
  // 세션이 생성 시점 설정을 캐시해 키를 저장해도 401이 반복되던 문제의 해법 —
  // 대화/초안은 보존하고 다음 요청부터 새 설정을 쓴다.
  updateConfig(config: AiConfig): void {
    this.config = config;
  }

  // 지금까지 누적된 draft(= 제안 프리뷰의 정확한 결과). 수락 시 이 스냅샷을 그대로 적용한다.
  // 연쇄 툴콜이 자동 생성 id를 참조하는 경우 재실행(applyToolSequenceToStore) 대신 이 값을 쓰면
  // "프리뷰 == 적용" 이 보장된다.
  getProposedProject(): Project {
    return structuredClone(this.ctx.project);
  }

  // 제안 수락/거부 후, 대화(메시지·감사 로그)를 유지한 채 프로젝트 기준만 store 최신 상태로 갱신한다.
  // 세션 폐기(dropSession)와 달리 대화 기억을 잃지 않는다 — "채팅 세션 단위 전체 기억"(#6)의 핵심.
  rebaseProject(project: Project): void {
    this.baselineProject = structuredClone(project);
    this.ctx = { project: structuredClone(project) };
  }

  // 현재 확정된 밑그림(없으면 null). 패널이 상태 표시/카드 렌더에 쓴다.
  getActiveSpec(): BuildSpec | null {
    return this.activeSpec;
  }

  getWorkPlan(): WorkPlan | null {
    return this.workPlan ? structuredClone(this.workPlan) : null;
  }

  clearWorkPlan(): void {
    this.workPlan = null;
  }

  // set_build_spec 처리: 검증 통과 시 활성화(턴 간 유지), 실패 시 사유를 되돌려 재제출 유도.
  // 프로젝트를 바꾸지 않으므로 diff가 없고 제안(changeset)에도 포함되지 않는다.
  private applyBuildSpec(args: Record<string, unknown>): ToolResult {
    const spec = args as unknown as BuildSpec;
    const errors = validateBuildSpec(this.ctx.project, spec).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      this.specRejections += 1;
      const discarded = this.specRejections >= MAX_SPEC_REJECTIONS;
      const issues = errors.map((issue) => ({ severity: "error" as const, code: "spec-invalid", message: issue.message }));
      issues.push({
        severity: "error",
        code: "spec-invalid",
        message: discarded
          ? `검증 ${this.specRejections}회 실패 — 이 계획은 폐기하세요. 맵 크기·좌표·buildOrder를 스스로 보정한 새 명세를 제출하세요.`
          : "겹치지 않게 좌표를 고치고 필요한 경우 overExisting을 스스로 판단해 set_build_spec을 재제출하세요.",
      });
      return {
        ok: false,
        summary: `밑그림 검증 실패(${this.specRejections}회)${discarded ? " — 계획 폐기" : ""}`,
        issues,
      };
    }
    this.activeSpec = spec;
    this.activeSpecTurnIndex = this.currentTurnIndex;
    this.carryoverSpecForTurn = null;
    this.specRejections = 0;
    const kinds = [...new Set(spec.assets.map((asset) => asset.kind))].join("·");
    return {
      ok: true,
      summary: `밑그림 확정: ${spec.title ?? spec.mapId} — 에셋 ${spec.assets.length}개(${kinds})`,
      data: spec,
    };
  }

  // 공간 쓰기 툴 게이트. 통과하면 warning 목록, 차단이면 사유가 담긴 ToolResult.
  private specGate(name: string, args: Record<string, unknown>): ToolResult | SpecGatePass {
    const regions = affectedRegions(name, args);
    if (regions.length === 0) return { warnings: [] }; // mapId 없는 인자 형태 — 현 공간 툴셋엔 없음.
    const mapId = regions[0].mapId;
    const specs = [this.activeSpec, this.turnImplicitSpec]
      .filter((spec): spec is BuildSpec => spec !== null && spec.mapId === mapId);
    if (specs.length === 0) {
      return specGateResult(`스펙 게이트: '${name}' 차단 — 이 맵의 밑그림(스펙)이 없습니다`, [
        "공간 빌드는 set_build_spec으로 밑그림을 제출해 검증을 통과한 뒤에만 실행됩니다.",
        "체크리스트: 대상 맵, 에셋별 영역(x,y,w,h)·종류·스타일, 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle).",
        "현재 컨텍스트 선택 영역이 있으면 암묵적 명세로 인정됩니다. 없으면 필요한 영역을 직접 산정해 set_build_spec으로 제출하세요.",
      ]);
    }
    // 명시 스펙 + 암묵 선택 영역(같은 맵)의 합집합으로 커버리지를 판정한다.
    const assets = specs.flatMap((spec) => spec.assets);
    const slackCells = boundarySlackForTool(name);
    const coverage = checkRegionsAgainstSpecBoundary(assets, regions, slackCells);
    if (coverage.covered) return { warnings: [] };

    const uncovered = uncoveredRegionsBySpec(assets, regions);
    const map = this.ctx.project.maps[mapId];
    const built = map ? builtCellsInRegions(map, uncovered) : { count: 0 };
    if (built.count > 0) {
      const at = built.sample ? `, 예: (${built.sample.x},${built.sample.y})` : "";
      return specGateResult(`스펙 게이트: '${name}' 차단 — 자동 확장 대상에 기존 구조물 ${built.count}칸${at}`, [
        "명세 밖 빈 영역은 자동 확장하지만, 기존 구조물 파괴 위험은 자동 보정하지 않습니다.",
        "정리하려면 clear 에셋에 confirmDestroy:true를 명시하거나 배치 에셋에 overExisting을 스스로 판단해 지정한 새 명세를 제출하세요.",
      ]);
    }

    const warnings = this.expandSpecWithRegions(mapId, name, regions, uncovered);
    if (warnings.length > 0) return { warnings };
    if (slackCells > 0 && coverage.slackWarning) {
      return { warnings: [{ severity: "warning", code: "spec-gate-auto-expand", message: `명세를 자동 확장했습니다: ${coverage.slackWarning}` }] };
    }
    return { warnings: [] };
  }

  private expandSpecWithRegions(
    mapId: string,
    toolName: string,
    regions: readonly AffectedRegion[],
    uncovered: readonly AffectedRegion[]
  ): LintIssue[] {
    if (uncovered.length === 0) return [];
    const target = this.activeSpec?.mapId === mapId
      ? this.activeSpec
      : this.turnImplicitSpec?.mapId === mapId
      ? this.turnImplicitSpec
      : null;
    if (target === null) return [];

    const additions = regions
      .filter((region) => region.w > 0 && region.h > 0 && uncovered.some((cell) => regionContains(region, cell.x, cell.y)))
      .map((region, index): SpecAsset => ({
        id: `auto:${this.currentTurnIndex}:${toolName}:${target.assets.length + index + 1}`,
        kind: autoExpandedAssetKind(toolName),
        x: region.x,
        y: region.y,
        w: region.w,
        h: region.h,
        note: "스펙 게이트 자동 확장",
      }));
    if (additions.length === 0) return [];

    this.activeSpec = { ...target, assets: [...target.assets, ...additions] };
    this.activeSpecTurnIndex = this.currentTurnIndex;
    const listed = additions.slice(0, 3).map((asset) => `(${asset.x},${asset.y}) ${asset.w}×${asset.h}`).join(", ");
    const extra = additions.length > 3 ? ` 외 ${additions.length - 3}개` : "";
    return [{
      severity: "warning",
      code: "spec-gate-auto-expand",
      message: `명세를 자동 확장했습니다: ${toolName} ${listed}${extra}.`,
    }];
  }

  exportAudit(): string {
    return JSON.stringify({ model: this.config.model, entries: this.audit }, null, 2);
  }

  // 패널이 세션을 폐기(수락/거부)하기 전에 감사 항목을 회수해 누적 보관할 수 있게 한다.
  getAuditEntries(): readonly AuditEntry[] {
    return this.audit;
  }

  // 하네스 관측: 주입 포함 원본 메시지는 여기가 유일한 노출점이다(턴 종료 시 주입은 제거되므로
  // 진행 중 스냅샷과 종료 후 스냅샷이 다를 수 있다 — 감사 로그가 영속 기록을 맡는다).
  getHarnessSnapshot(): HarnessSnapshot {
    return {
      model: this.config.model,
      ...(this.config.liteModel ? { liteModel: this.config.liteModel } : {}),
      maxTokens: this.config.maxTokens,
      messages: this.messages.map((message) => ({ ...message })),
      audit: [...this.audit],
      workPlan: this.workPlan ? structuredClone(this.workPlan) : null,
    };
  }

  // 한 턴 실행: 사용자 메시지 → (LLM ↔ 툴) 루프 → 최종 응답 + 제안 changeset.
  // opts.explicitSkillId: 스킬 서랍/슬래시로 고른 경우 — 집/실내 되묻기 게이트를 건너뛴다.
  async sendUserMessage(
    text: string,
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal,
    opts?: { readonly explicitSkillId?: string | null },
  ): Promise<TurnResult> {
    // 토큰 보정: 직전 턴들의 usage 관측으로 문자 예산이 달라졌으면 시스템 프롬프트를 재조립한다.
    this.refreshSystemPromptBudget();
    // 매 턴: 에디터 뷰포트 좌표(+가능하면 맵 이미지)를 사용자 메시지에 붙여 "여기" 해석을 빠르게 한다.
    const userContent = await this.buildUserTurnContent(text);
    this.messages.push({ role: "user", content: userContent });
    this.pushAudit({ kind: "user", text });
    beginAssistantToolDomainTurn(text);
    this.currentTurnToolDomains = computeActiveToolDomains(text);
    this.currentTurnRequestText = text;

    // 스펙 게이트 턴 초기화: 사용자 선택 영역([컨텍스트])은 이 턴의 암묵적 명세가 된다.
    this.currentTurnIndex += 1;
    this.turnImplicitSpec = implicitSpecFromContext(text);
    this.carryoverSpecForTurn = this.activeSpec && this.activeSpecTurnIndex < this.currentTurnIndex
      ? structuredClone(this.activeSpec)
      : null;
    this.carryoverWarningAdded = false;
    this.specRejections = 0;
    this.turnProposals = new Map();
    this.turnWriteDedupe = new Map();
    this.turnSuccessfulWriteTools = new Set();
    this.eventBaseProposalKeys = new Map();

    // 집 vs 실내 등 경로 미확정: LLM·쓰기 툴 전에 선택지로 되묻기(결정론).
    const clarify = resolveIntentClarification(text, { explicitSkillId: opts?.explicitSkillId });
    if (clarify) {
      const assistantText = formatIntentClarifyMessage(clarify);
      this.messages.push({ role: "assistant", content: assistantText });
      onEvent({ type: "assistant_message", content: assistantText });
      this.pushAudit({ kind: "status", text: `의도 확인(${clarify.kind}): ${clarify.reason}` });
      this.pushAudit({ kind: "assistant", text: assistantText });
      this.pushAudit({ kind: "status", text: "턴 종료(final) — 의도 확인 · 제안 0건" });
      return { assistantText, proposedCalls: [], stoppedReason: "final" };
    }

    // Orchestrator (main LLM): multi-step plan decision — harness does not regex-plan.
    this.workPlanAutoStepsThisUserMessage = 0;
    await this.runOrchestratorPlanner(text, onEvent, signal);

    try {
      const result = await this.runTurnLoop(onEvent, signal);
      return this.withWorkPlanResult(result);
    } finally {
      this.removeOrchestrationMessages();
    }
  }

  /**
   * Planner agent (main LLM, no tools): direct | resume | new_plan | replan.
   * Anthropic long-running harness pattern — code only validates/stores/injects.
   */
  private async runOrchestratorPlanner(
    text: string,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    onEvent({ type: "status", text: "플래너(main LLM)가 작업 분해를 판단 중…" });
    this.pushAudit({ kind: "status", text: "planner:start" });
    const maps = Object.values(this.ctx.project.maps);
    const projectSummary = [
      `title=${this.ctx.project.meta?.title ?? ""}`,
      `maps=${maps.length}`,
      ...maps.slice(0, 12).map((m) => `- ${m.name} ${m.width}x${m.height} events=${m.events?.length ?? 0}`),
    ].join("\n");

    let raw = "";
    try {
      // Always main model — not lite. No tools. Planner is pure cognition.
      const result = await this.chatWithTransientRetry(
        this.config,
        {
          messages: [
            { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildOrchestratorUserPayload({
                userText: text,
                activePlan: this.workPlan,
                projectSummary,
              }),
            },
          ],
        },
        onEvent,
        signal,
        false
      );
      raw = typeof result.message.content === "string" ? result.message.content : "";
    } catch (cause) {
      if (isLlmAbortError(cause) || signal?.aborted) throw cause;
      this.pushAudit({
        kind: "status",
        text: `planner:error ${cause instanceof Error ? cause.message : String(cause)}`,
      });
      if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
        this.injectWorkPlanOrchestration();
        this.emitWorkPlan(onEvent);
      } else if (text.trim().length >= 60) {
        this.workPlan = buildDefaultWorkPlan(text);
        this.emitWorkPlan(onEvent);
        this.injectWorkPlanOrchestration();
        onEvent({ type: "status", text: "플래너 실패 — 최소 폴백 계획으로 진행" });
      }
      return;
    }

    const decision = parseOrchestratorDecision(raw);
    if (!decision) {
      this.pushAudit({ kind: "status", text: `planner:parse-fail raw=${raw.slice(0, 200)}` });
      if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
        this.injectWorkPlanOrchestration();
        this.emitWorkPlan(onEvent);
      } else if (text.trim().length >= 60) {
        this.workPlan = buildDefaultWorkPlan(text);
        this.emitWorkPlan(onEvent);
        this.injectWorkPlanOrchestration();
      }
      return;
    }

    if (decision.action === "direct") {
      this.pushAudit({ kind: "status", text: `planner:direct ${decision.reason ?? ""}` });
      return;
    }

    if (decision.action === "resume") {
      if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
        this.pushAudit({ kind: "status", text: `planner:resume ${decision.reason ?? ""}` });
        onEvent({ type: "status", text: "기존 WorkPlan을 이어 실행합니다 (Ralph resume)." });
        this.emitWorkPlan(onEvent);
        this.injectWorkPlanOrchestration();
      }
      return;
    }

    // new_plan | replan
    this.workPlan = workPlanFromOrchestratorDecision(decision);
    const progress = summarizeWorkPlan(this.workPlan);
    this.pushAudit({
      kind: "status",
      text: `planner:${decision.action} items=${progress.itemsTotal} layers=${progress.layersTotal}`,
    });
    onEvent({
      type: "status",
      text: `플래너가 ${progress.layersTotal}레이어 / ${progress.itemsTotal}항목으로 분해했습니다.`,
    });
    this.emitWorkPlan(onEvent);
    this.injectWorkPlanOrchestration();
  }

  private emitWorkPlan(onEvent: (event: SessionEvent) => void): void {
    if (!this.workPlan) return;
    onEvent({ type: "work_plan", plan: structuredClone(this.workPlan) });
  }

  private injectWorkPlanOrchestration(): void {
    if (!this.workPlan || isWorkPlanComplete(this.workPlan)) return;
    this.pushOrchestrationMessage(formatWorkPlanForOrchestration(this.workPlan));
  }

  /** Ralph: re-inject current item when generator tries to exit early. */
  private injectRalphContinue(onEvent: (event: SessionEvent) => void): void {
    if (!this.workPlan || isWorkPlanComplete(this.workPlan)) return;
    this.workPlanAutoStepsThisUserMessage += 1;
    this.pushOrchestrationMessage(formatRalphContinueMessage(this.workPlan));
    this.pushAudit({
      kind: "status",
      text: `ralph:continue step=${this.workPlanAutoStepsThisUserMessage}/${MAX_WORK_PLAN_AUTO_STEPS_PER_TURN}`,
    });
    onEvent({
      type: "status",
      text: `Ralph 연속 실행 (${this.workPlanAutoStepsThisUserMessage}/${MAX_WORK_PLAN_AUTO_STEPS_PER_TURN}) — 미완료 항목 재주입`,
    });
  }

  private applyWorkPlanTool(name: string, args: Record<string, unknown>): ToolResult {
    if (name === "set_work_plan") {
      const plan = workPlanFromSetToolArgs(args);
      if (!plan) {
        return {
          ok: false,
          summary: "set_work_plan 인자 오류: goal + layers[{title, items[{title, instruction}]}] 필요",
        };
      }
      this.workPlan = plan;
      const progress = summarizeWorkPlan(plan);
      return {
        ok: true,
        summary: `WorkPlan 설정: ${progress.layersTotal}레이어 / ${progress.itemsTotal}항목. 현재: ${progress.current?.itemTitle ?? "(완료)"}`,
        data: { plan: structuredClone(plan), progress },
      };
    }
    if (!this.workPlan) {
      return {
        ok: false,
        summary: "활성 WorkPlan이 없습니다. set_work_plan으로 계획을 세우거나 어려운 요청으로 플래너가 계획을 만들게 하세요.",
      };
    }
    if (name === "get_work_plan") {
      return {
        ok: true,
        summary: formatWorkPlanUserVisible(this.workPlan).slice(0, 500),
        data: { plan: structuredClone(this.workPlan), progress: summarizeWorkPlan(this.workPlan) },
      };
    }
    if (name === "complete_work_item") {
      const id = typeof args.itemId === "string" && args.itemId.trim() ? args.itemId.trim() : this.workPlan.currentItemId;
      if (!id) return { ok: false, summary: "완료할 항목 id가 없습니다." };
      const note = typeof args.note === "string" ? args.note : undefined;
      const result = completeWorkItemById(this.workPlan, id, note, {
        successfulWriteTools: [...this.turnSuccessfulWriteTools],
      });
      if (!result.ok) {
        return {
          ok: false,
          summary: result.reason,
          issues: [{ severity: "error", code: "work-item-incomplete", message: result.reason }],
        };
      }
      const done = result.item;
      const next = getCurrentWorkItem(this.workPlan);
      return {
        ok: true,
        summary: next
          ? `완료: ${done.title} → 다음: ${next.title}`
          : `완료: ${done.title}. 작업 계획이 모두 끝났습니다.`,
        data: { completed: done.id, next: next?.id ?? null, progress: summarizeWorkPlan(this.workPlan) },
      };
    }
    if (name === "skip_work_item") {
      const id = typeof args.itemId === "string" && args.itemId.trim() ? args.itemId.trim() : this.workPlan.currentItemId;
      if (!id) return { ok: false, summary: "건너뛸 항목 id가 없습니다." };
      const note = typeof args.note === "string" ? args.note : undefined;
      const skipped = skipWorkItemById(this.workPlan, id, note);
      if (!skipped) return { ok: false, summary: `항목을 찾지 못했습니다: ${id}` };
      const next = getCurrentWorkItem(this.workPlan);
      return {
        ok: true,
        summary: next ? `건너뜀: ${skipped.title} → 다음: ${next.title}` : `건너뜀: ${skipped.title}. 계획 종료.`,
        data: { skipped: skipped.id, next: next?.id ?? null, progress: summarizeWorkPlan(this.workPlan) },
      };
    }
    return { ok: false, summary: `알 수 없는 WorkPlan 툴: ${name}` };
  }

  private noteSuccessfulWriteTools(names: readonly string[], onEvent: (event: SessionEvent) => void): void {
    if (!this.workPlan || names.length === 0) return;
    const { completed, next } = advanceWorkPlanFromTools(this.workPlan, names);
    if (completed) {
      this.pushAudit({ kind: "status", text: `WorkPlan 자동 완료: ${completed.title}` });
      this.emitWorkPlan(onEvent);
      if (next) {
        onEvent({ type: "status", text: `다음 할 일: ${next.title}` });
      } else if (isWorkPlanComplete(this.workPlan)) {
        onEvent({ type: "status", text: "작업 계획의 모든 항목이 완료되었습니다." });
      }
    }
  }

  private withWorkPlanResult(result: TurnResult): TurnResult {
    if (!this.workPlan) return result;
    const board = formatWorkPlanUserVisible(this.workPlan);
    const hitCap =
      !isWorkPlanComplete(this.workPlan) &&
      this.workPlanAutoStepsThisUserMessage >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN;
    const suffix = isWorkPlanComplete(this.workPlan)
      ? `\n\n---\n${board}`
      : hitCap
        ? `\n\n---\n${board}\n\n(안전 상한 ${MAX_WORK_PLAN_AUTO_STEPS_PER_TURN}단계) 이어서 진행하려면 **「계속」** 이라고 보내세요.`
        : `\n\n---\n${board}`;
    const assistantText = result.assistantText.includes("📋 작업 계획")
      ? result.assistantText
      : `${result.assistantText.trim()}${suffix}`;
    return { ...result, assistantText, workPlan: structuredClone(this.workPlan) };
  }

  // 직전 턴이 LLM 오류로 끊긴 경우에만 재개 가능(도그푸딩 결함 ⑥ — 수동 재시도).
  canRetryLastTurn(): boolean {
    return this.lastTurnFailed;
  }

  // 오류로 끊긴 턴 재개: 새 사용자 메시지 없이 (LLM ↔ 툴) 루프만 다시 돈다.
  // 이미 누적된 제안(turnProposals)과 대화 문맥은 그대로 유지된다.
  async retryLastTurn(onEvent: (event: SessionEvent) => void = () => {}, signal?: AbortSignal): Promise<TurnResult> {
    if (!this.lastTurnFailed) {
      return { assistantText: "", proposedCalls: this.finalizeProposals(this.turnProposals), stoppedReason: "final" };
    }
    this.pushAudit({ kind: "status", text: "오류 후 재시도(retryLastTurn)" });
    try {
      return await this.runTurnLoop(onEvent, signal);
    } finally {
      this.removeOrchestrationMessages();
    }
  }

  // 감사 항목에 ISO 타임스탬프를 붙여 기록한다(결함 ⑬ — 타임라인 export).
  private pushAudit(entry: AuditEntry): void {
    this.audit.push({ ...entry, at: new Date().toISOString() });
  }

  // 토큰 보정(문자↔토큰 계수): 관측 누적으로 보정 예산이 바뀌었으면 시스템 프롬프트를
  // 최신 기준 프로젝트(baselineProject)로 재조립한다. 예산이 같으면 no-op(현행 동작 보존).
  // contextOptions.budgetChars가 명시 주입된 세션은 보정하지 않는다.
  private refreshSystemPromptBudget(): void {
    if (this.contextOptions.budgetChars !== undefined) return;
    const budget = calibratedBudgetChars(DEFAULT_BUDGET_CHARS, loadTokenObservations());
    if (budget === this.appliedBudgetChars) return;
    const system = this.messages[0];
    if (!system || system.role !== "system") return;
    this.appliedBudgetChars = budget;
    system.content = buildSystemPrompt(this.baselineProject, { ...this.contextOptions, budgetChars: budget });
    this.pushAudit({ kind: "status", text: `토큰 보정: 컨텍스트 문자 예산 ${budget}자로 재조립` });
  }

  // 실측 usage.prompt_tokens ↔ 이번 요청으로 보낸 프롬프트 총 문자 수를 짝지어 보정 관측으로 기록.
  // usage가 없으면(공급자가 스트리밍 usage 미지원) 조용히 건너뛴다. 이미지 파트가 섞인 요청은
  // 토큰이 문자 수와 비례하지 않으므로 관측하지 않는다. 호출 시점: 응답 메시지를 messages에
  // 추가하기 전(= messages가 방금 보낸 프롬프트와 정확히 일치할 때).
  private recordPromptUsage(result: ChatResult, toolsChars: number): void {
    const promptTokens = result.usage?.prompt_tokens;
    if (typeof promptTokens !== "number" || !Number.isFinite(promptTokens) || promptTokens <= 0) return;
    const estimate = estimatePromptChars(this.messages, toolsChars);
    if (estimate.hasImages || estimate.chars <= 0) return;
    recordTokenObservation({ promptChars: estimate.chars, promptTokens, at: new Date().toISOString() });
  }

  private withCarryoverWarningIfNeeded(proposal: ProposedCall): ProposedCall {
    const spec = this.carryoverSpecForTurn;
    if (spec === null || this.carryoverWarningAdded || !SPATIAL_BUILD_TOOLS.has(proposal.name)) return proposal;
    if (!proposalHasChangedMap([proposal], spec.mapId)) return proposal;

    this.carryoverWarningAdded = true;
    const warning = proposalScopeCarryoverWarning(buildSpecPlanLabel(spec));
    return { ...proposal, result: appendDiffWarning(proposal.result, warning) };
  }

  // 턴 종료 시 누적된 제안을 배열로 넘긴다(과거엔 보류 시공을 여기서 첨부했으나
  // soft-allow 전환으로 그 기계가 도달 불가가 되어 제거됐다 — 2026-07-11).
  private finalizeProposals(proposedByKey: Map<string, ProposedCall>): ProposedCall[] {
    return [...proposedByKey.values()];
  }

  private upsertProposal(proposedByKey: Map<string, ProposedCall>, proposal: ProposedCall): void {
    const move = moveEventTarget(proposal);
    if (move !== null) {
      const baseKey = this.eventBaseProposalKeys.get(eventTargetKey(move));
      const baseProposal = baseKey ? proposedByKey.get(baseKey) : undefined;
      if (baseKey && baseProposal) {
        proposedByKey.set(baseKey, withMovedEventBaseProposal(baseProposal, move));
        return;
      }
      proposedByKey.set(`move_event:${eventTargetKey(move)}`, proposal);
      return;
    }

    const key = proposalKey(proposal);
    proposedByKey.set(key, proposal);
    const eventTarget = eventBaseTarget(proposal);
    if (eventTarget !== null) this.eventBaseProposalKeys.set(eventTargetKey(eventTarget), key);
  }

  private orchestrationEnabled(): boolean {
    const main = this.config.model.trim();
    const lite = this.config.liteModel?.trim();
    return Boolean(main && lite && lite !== main);
  }

  private phaseConfig(phase: AssistantPhase): AiConfig {
    const base = phase === "execute" ? configForLiteModel(this.config) : this.config;
    // MiniMax 등 장문 추론 모델: 정책으로 effort 캡(실행 단계는 추론 off).
    return configWithReasoningPolicy(base);
  }

  /** 사용자 텍스트 + 뷰포트 블록 + (브라우저) 뷰포트 맵 이미지. */
  private async buildUserTurnContent(text: string): Promise<string | ContentPart[]> {
    const viewport = resolveContextViewport(this.contextOptions);
    if (!viewport) return text;

    const map = this.ctx.project.maps[viewport.mapId];
    const mapName = map?.name ?? viewport.mapId;
    const viewportBlock = formatViewportContextBlock(viewport, mapName);
    const combinedText = `${viewportBlock}\n\n---\n\n${text}`;

    if (!this.renderImages || !map) return combinedText;

    const payload = mapRegionImagePayload(this.ctx.project, viewport.mapId, viewport);
    if (!payload) return combinedText;

    try {
      const images = await this.renderImages(this.ctx.project, "show_map_region", payload);
      if (images.length === 0) return combinedText;
      const parts: ContentPart[] = [
        { type: "text", text: combinedText },
        {
          type: "text",
          text: `아래는 사용자가 지금 보고 있는 맵 화면 근처 미리보기입니다 (${viewport.x},${viewport.y}) ${viewport.w}×${viewport.h}. "여기" 해석 시 이 이미지를 우선하세요.`,
        },
      ];
      for (const image of images) {
        parts.push({ type: "text", text: image.label });
        parts.push({ type: "image_url", image_url: { url: image.dataUrl, detail: "low" } });
      }
      return parts;
    } catch {
      return combinedText;
    }
  }

  private emitPhase(onEvent: (event: SessionEvent) => void, phase: AssistantPhase): void {
    onEvent({ type: "phase", value: phase });
    this.pushAudit({ kind: "status", text: `phase:${phase}` });
  }

  private pushOrchestrationMessage(content: string): void {
    this.messages.push({ role: "user", content: orchestrationContent(content) });
    // 하네스 가시화: 주입은 턴 종료 시 messages에서 제거되므로 감사 로그가 유일한 영속 기록이다.
    this.pushAudit({
      kind: "status",
      text: `오케스트레이션 주입: ${content.length > 600 ? `${content.slice(0, 600)}…` : content}`,
    });
  }

  private removeOrchestrationMessages(): void {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      if (isOrchestrationMessage(this.messages[index], index)) this.messages.splice(index, 1);
    }
  }

  private addExecutionHintIfNeeded(): void {
    const content = orchestrationContent(EXECUTION_PHASE_HINT);
    if (this.messages.some((message) => message.role === "user" && message.content === content)) return;
    this.pushOrchestrationMessage(EXECUTION_PHASE_HINT);
  }

  private reviewBuildSpecForProposal(calls: readonly ProposedCall[]): BuildSpec | null {
    const currentSpec = this.activeSpec && this.activeSpecTurnIndex === this.currentTurnIndex ? this.activeSpec : null;
    if (currentSpec && proposalHasChangedMap(calls, currentSpec.mapId)) return currentSpec;
    if (this.turnImplicitSpec && proposalHasChangedMap(calls, this.turnImplicitSpec.mapId)) return this.turnImplicitSpec;
    if (this.carryoverSpecForTurn && proposalHasChangedMap(calls, this.carryoverSpecForTurn.mapId)) return this.carryoverSpecForTurn;
    if (
      this.activeSpec &&
      requestLikelyExpectsChange(this.currentTurnRequestText) &&
      proposalHasChangedMap(calls, this.activeSpec.mapId)
    ) {
      return this.activeSpec;
    }
    return null;
  }

  private buildReviewPrompt(calls: readonly ProposedCall[], repairAlreadyUsed: boolean): { prompt: string; missingWarnings: string[] } {
    const lintWarnings = proposalCompletenessWarnings({
      requestText: this.currentTurnRequestText,
      buildSpec: this.reviewBuildSpecForProposal(calls),
      calls,
    });
    const diffWarnings = calls.flatMap((call) => call.result.diff?.warnings ?? []);
    const allWarnings = [...new Set([...lintWarnings, ...diffWarnings])];
    const missingWarnings = allWarnings.filter((warning) => warning.startsWith(PROPOSAL_COMPLETENESS_WARNING_PREFIX));
    const lintBlock = allWarnings.length > 0 ? allWarnings.map((warning) => `- ${warning}`).join("\n") : "- 통과";
    const diffBlock = calls.length > 0
      ? calls.map((call, index) => `${index + 1}. ${call.name}: ${call.summary} / ${diffSummaryLine(call.result.diff)}`).join("\n")
      : "- 변경 제안 없음";
    const repairLine = repairAlreadyUsed
      ? "재실행 기회는 이미 사용했습니다. 남은 부족분이 있어도 사용자에게 현재 상태와 부족분을 짧게 보고하세요."
      : `부족분이 있으면 최종 답변 대신 정확히 "${REVIEW_REEXECUTE_PREFIX} <실행 모델에게 줄 보완 지시>" 형식 한 줄로 답하세요.`;
    return {
      prompt: [
        "검수 단계: 완성도 린트 결과와 diff 요약을 기준으로 이번 턴 이행 여부를 확인하세요.",
        repairLine,
        `이행 완료면 "${REVIEW_COMPLETE_PREFIX} <최종 사용자 응답>" 형식 또는 자연스러운 최종 응답만 작성하세요.`,
        "",
        "## 사용자 요청",
        this.currentTurnRequestText,
        "",
        "## 완성도 린트 결과",
        lintBlock,
        "",
        "## diff 요약",
        diffBlock,
      ].join("\n"),
      missingWarnings,
    };
  }

  private async chatWithTransientRetry(
    config: AiConfig,
    req: ChatRequest,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal,
    emitTokens = true
  ): Promise<ChatResult> {
    let attempt = 0;
    while (true) {
      let receivedStreamDelta = false;
      let emittedStreamDelta = false;
      const tokenGuard = emitTokens
        ? createRawMarkupTokenGuard((delta) => {
            emittedStreamDelta = true;
            onEvent({ type: "assistant_token", delta });
          })
        : null;
      try {
        const result = await this.chat(config, {
          ...req,
          disableTransientRetry: true,
          onToken: emitTokens
            ? (delta) => {
                receivedStreamDelta = true;
                tokenGuard?.feed(delta);
              }
            : undefined,
          onReasoning: emitTokens
            ? (delta) => {
                receivedStreamDelta = true;
                emittedStreamDelta = true;
                onEvent({ type: "reasoning_token", delta });
              }
            : undefined,
          signal,
        });
        tokenGuard?.flush();
        return result;
      } catch (cause) {
        if (
          signal?.aborted ||
          isLlmAbortError(cause) ||
          !isRetryableLlmError(cause) ||
          attempt >= ASSISTANT_TURN_RETRY_ATTEMPTS
        ) {
          throw cause;
        }
        attempt += 1;
        const text = receivedStreamDelta
          ? `연결 끊김 — 재시도 중(${attempt}/${ASSISTANT_TURN_RETRY_ATTEMPTS})`
          : `일시 오류 — 재시도 중(${attempt}/${ASSISTANT_TURN_RETRY_ATTEMPTS})`;
        if (emittedStreamDelta) onEvent({ type: "assistant_stream_reset" });
        onEvent({ type: "status", text });
        this.pushAudit({ kind: "status", text });
        await sleep(LLM_RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  private async runTurnLoop(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<TurnResult> {
    this.lastTurnFailed = false;
    // 컨텍스트 도메인 스코핑: 턴 시작 사용자 메시지 기준의 도메인 유니온으로 툴을 고정한다.
    const domains = this.currentTurnToolDomains ?? computeActiveToolDomains("");
    // WorkPlan tools always on: set_work_plan / get / complete / skip (TodoWrite-style in ReAct loop).
    const tools = [
      ...toOpenAiTools(undefined, { domains }),
      SET_BUILD_SPEC_TOOL,
      ...WORK_PLAN_TOOLS,
    ];
    // 토큰 보정 관측용: tools 스키마도 prompt_tokens에 포함되므로 문자 수에 더한다(근사).
    const toolsChars = JSON.stringify(tools).length;
    const proposedByKey = this.turnProposals;
    let assistantText = "";
    const orchestrated = this.orchestrationEnabled() || Boolean(this.workPlan);
    let phase: AssistantPhase = this.workPlan ? "execute" : "plan";
    let executionStarted = Boolean(this.workPlan);
    let writeToolAttempts = 0;
    let zeroChangeRekickUsed = false;
    let reviewRepairUsed = false;
    let reviewMissingWarnings: string[] = [];
    if (orchestrated) this.emitPhase(onEvent, phase);
    if (this.workPlan) this.addExecutionHintIfNeeded();
    // 에이전틱 예산: 사용자 제한은 출력 토큰 하나뿐. 루프 깊이는 사실상 무제한이고
    // (maxToolCalls 기본 200은 폭주 방지 안전핀), 누적 출력 토큰이 maxTokens를 넘으면 멈춘다.
    let spentOutputTokens = 0;

    for (let round = 0; round < this.config.maxToolCalls; round += 1) {
      if (signal?.aborted) {
        this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
      }
      let result: ChatResult;
      try {
        result = await this.chatWithTransientRetry(
          this.phaseConfig(phase),
          phase === "review"
            ? { messages: this.messages }
            : { messages: this.messages, tools, tool_choice: "auto" },
          onEvent,
          signal,
          phase !== "execute"
        );
      } catch (cause) {
        if (isLlmAbortError(cause) || signal?.aborted) {
          this.lastTurnFailed = false;
          this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
          return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
        }
        const rawError = cause instanceof Error ? cause.message : String(cause);
        const error = isRetryableLlmError(cause) ? appendTransientRetryGuidance(rawError) : rawError;
        this.lastTurnFailed = true; // 수동 재시도(retryLastTurn) 허용 상태로 표시.
        this.pushAudit({ kind: "status", text: `턴 중단(error): ${error} · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error", error };
      }
      spentOutputTokens += result.usage?.completion_tokens ?? estimateOutputTokens(result.message);
      // 문자↔토큰 보정 관측(usage 없으면 조용히 스킵). review 단계 요청에는 tools가 없다.
      this.recordPromptUsage(result, phase === "review" ? 0 : toolsChars);

      const assistantMsg = result.message;
      // assistant 응답은 항상 문자열 content다(멀티모달 파트는 우리가 넣는 user 메시지 전용).
      const messageText = typeof assistantMsg.content === "string" ? assistantMsg.content : null;
      this.messages.push(
        messageText !== null && hasRawToolCallMarkup(messageText)
          ? { ...assistantMsg, content: sanitizeAssistantText(messageText) }
          : assistantMsg
      );
      this.pushAudit({
        kind: "assistant",
        text: messageText ?? "",
        toolCalls: assistantMsg.tool_calls?.map((tc) => ({ name: tc.function.name, args: tc.function.arguments })),
      });

      if (phase === "review") {
        const reviewText = messageText ?? "";
        const repairInstruction = reviewRepairUsed ? null : reviewRepairInstruction(reviewText, reviewMissingWarnings);
        if (repairInstruction !== null) {
          reviewRepairUsed = true;
          phase = "execute";
          this.emitPhase(onEvent, "execute");
          this.addExecutionHintIfNeeded();
          this.pushOrchestrationMessage(`검수 보완 지시: ${repairInstruction}`);
          continue;
        }
        assistantText = sanitizeAssistantText(stripReviewCompletePrefix(reviewText));
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const finalText = sanitizeAssistantText(messageText ?? "");
        // Ralph loop: incomplete WorkPlan → re-inject current item; do not early-exit.
        if (
          shouldRalphContinue(this.workPlan, {
            autoStepsUsed: this.workPlanAutoStepsThisUserMessage,
            assistantText: finalText,
          })
        ) {
          phase = "execute";
          executionStarted = true;
          this.emitPhase(onEvent, "execute");
          this.injectRalphContinue(onEvent);
          continue;
        }
        if (orchestrated && executionStarted) {
          phase = "review";
          this.emitPhase(onEvent, "review");
          const review = this.buildReviewPrompt(this.finalizeProposals(proposedByKey), reviewRepairUsed);
          reviewMissingWarnings = review.missingWarnings;
          this.pushOrchestrationMessage(review.prompt);
          continue;
        }
        if (
          orchestrated &&
          !zeroChangeRekickUsed &&
          writeToolAttempts === 0 &&
          requestLikelyExpectsChange(this.currentTurnRequestText) &&
          !assistantTextLooksLikeQuestion(finalText)
        ) {
          zeroChangeRekickUsed = true;
          this.pushOrchestrationMessage(ZERO_CHANGE_REKICK_HINT);
          onEvent({ type: "status", text: "변경 없는 종료를 감지해 실행 계획을 다시 요청합니다." });
          this.pushAudit({ kind: "status", text: "zero-change-rekick" });
          continue;
        }
        // 최종 응답.
        assistantText = finalText;
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      const startsWriteThisRound = toolCalls.some((call) => getTool(call.function.name)?.mode === "write");
      // 이번 라운드에 렌더된 비전 이미지(있으면 툴 메시지 뒤에 user 메시지로 주입).
      const roundImages: RenderedToolImage[] = [];
      const successfulWriteToolsThisRound: string[] = [];
      // Capture before any complete/skip/set tools mutate the cursor.
      const workItemIdAtRoundStart = this.workPlan?.currentItemId ?? null;
      // 각 tool_call 실행 → role:"tool" 메시지로 결과 반환.
      for (const call of toolCalls) {
        const { name, args } = parseToolCall(call);
        const tool = getTool(name);
        if (tool?.mode === "write") writeToolAttempts += 1;
        // 스펙 게이트: set_build_spec은 세션이 직접 처리(검증·활성화)하고,
        // 공간 쓰기 툴은 검증된 밑그림의 할당 영역 안에서만 실행한다(구간 격리).
        let toolResult: ToolResult;
        if (name === "set_build_spec") {
          toolResult = this.applyBuildSpec(args);
        } else if (
          name === "get_work_plan" ||
          name === "set_work_plan" ||
          name === "complete_work_item" ||
          name === "skip_work_item"
        ) {
          toolResult = this.applyWorkPlanTool(name, args);
          if (toolResult.ok) {
            this.emitWorkPlan(onEvent);
            if (name === "set_work_plan" && this.workPlan) {
              executionStarted = true;
              phase = "execute";
              this.emitPhase(onEvent, "execute");
              this.injectWorkPlanOrchestration();
            }
          }
        } else {
          const dedupeKey = writeDedupeKey(name, args);
          const cached = dedupeKey ? this.turnWriteDedupe.get(dedupeKey) : undefined;
          if (cached) {
            toolResult = {
              ...cached,
              summary: `${cached.summary} (이번 턴 동일 배치 재호출 — 건너뜀)`,
              issues: [
                ...(cached.issues ?? []),
                { severity: "warning", code: "write-deduped", message: "같은 place_props 인자는 한 턴에 한 번만 실행됩니다." },
              ],
            };
          } else {
            const gate = tool?.mode === "write" && SPATIAL_BUILD_TOOLS.has(name) ? this.specGate(name, args) : { warnings: [] };
            toolResult = isSpecGatePass(gate)
              ? withSpecGateWarnings(runTool(this.ctx, name, args, { dryRun: false }), gate.warnings)
              : gate;
            if (dedupeKey && toolResult.ok) this.turnWriteDedupe.set(dedupeKey, toolResult);
          }
        }
        if (toolResult.ok && tool?.mode === "write") {
          successfulWriteToolsThisRound.push(name);
          this.turnSuccessfulWriteTools.add(name);
        }
        if (toolResult.ok && tool) recordAssistantToolDomainUse(tool.domains);
        onEvent({ type: "tool_call", name, args, result: toolResult });
        this.pushAudit({
          kind: "tool",
          name,
          args,
          ok: toolResult.ok,
          summary: toolResult.summary,
          // 실패/경고 원인은 감사 로그에도 남긴다 — summary만으로 원인 추적이 안 되던 문제 방지.
          ...(toolResult.issues && toolResult.issues.length > 0 ? { issues: toolResult.issues.map((issue) => issue.message) } : {}),
        });

        // 성공한 쓰기 툴콜만 제안에 누적(동일 좌표 재편집은 최신 것으로 갱신).
        if (toolResult.ok && tool?.mode === "write" && toolResult.diff) {
          const softConfirm = extractVocabSoftConfirm(toolResult.data);
          let proposal: ProposedCall = {
            name,
            args,
            summary: toolResult.summary,
            result: toolResult,
            destructive: DESTRUCTIVE_TOOLS.has(name),
            requiresApproval:
              RULE_TOOLS.has(name)
              || DESTRUCTIVE_TOOLS.has(name)
              || VOCABULARY_PROPOSAL_TOOLS.has(name)
              || softConfirm !== null,
          };
          const approvalWarning = softConfirm
            ? VOCAB_SOFT_CONFIRM_APPROVAL_WARNING
            : approvalWarningFor(name, args);
          if (approvalWarning) proposal.approvalWarning = approvalWarning;
          proposal = this.withCarryoverWarningIfNeeded(proposal);
          this.upsertProposal(proposedByKey, proposal);
        }

        this.messages.push({
          role: "tool",
          tool_call_id: call.id,
          name,
          content: JSON.stringify(toolResultForModel(toolResult)),
        });

        // 비전(BUG C): '보여줘' 계열 툴이면 이미지를 렌더해 모아둔다. 렌더 실패는 무시(텍스트로 진행).
        if (this.renderImages && VISION_TOOLS.has(name) && toolResult.ok && toolResult.data !== undefined) {
          try {
            roundImages.push(...(await this.renderImages(this.ctx.project, name, toolResult.data)));
          } catch {
            /* 렌더 실패는 치명적이지 않다 */
          }
        }
      }

      // 비전 주입: tool 메시지들 뒤에 이미지를 담은 user 메시지를 넣어 모델이 실제로 보게 한다.
      // (OpenAI 순서 규약: assistant(tool_calls) → tool 응답들 → 그다음 다른 role 메시지)
      if (roundImages.length > 0) {
        const parts: ContentPart[] = [
          {
            type: "text",
            text: "방금 show_tiles/show_tile_grid로 조회한 이미지입니다. 타일의 의미·라벨·용도를 판단하거나 사용자에게 설명하기 전에 반드시 아래 이미지를 눈으로 확인하세요.",
          },
        ];
        for (const image of roundImages) {
          parts.push({ type: "text", text: image.label });
          parts.push({ type: "image_url", image_url: { url: image.dataUrl } });
        }
        this.messages.push({ role: "user", content: parts });
      }

      if (orchestrated && startsWriteThisRound && !executionStarted) {
        executionStarted = true;
        phase = "execute";
        this.emitPhase(onEvent, "execute");
        this.addExecutionHintIfNeeded();
      }

      // WorkPlan advance: successTools auto-complete OR complete/skip tools moved the cursor.
      this.noteSuccessfulWriteTools(successfulWriteToolsThisRound, onEvent);
      const afterItemId = this.workPlan?.currentItemId ?? null;
      const advanced =
        Boolean(this.workPlan) &&
        !isWorkPlanComplete(this.workPlan!) &&
        workItemIdAtRoundStart !== null &&
        afterItemId !== null &&
        afterItemId !== workItemIdAtRoundStart;
      if (
        advanced &&
        this.workPlanAutoStepsThisUserMessage < MAX_WORK_PLAN_AUTO_STEPS_PER_TURN
      ) {
        this.workPlanAutoStepsThisUserMessage += 1;
        phase = "execute";
        executionStarted = true;
        this.emitPhase(onEvent, "execute");
        this.injectWorkPlanOrchestration();
        onEvent({
          type: "status",
          text: `WorkPlan 다음 스프린트 (${this.workPlanAutoStepsThisUserMessage}/${MAX_WORK_PLAN_AUTO_STEPS_PER_TURN})`,
        });
      }

      // 출력 토큰 예산 확인(라운드의 툴 실행까지 마친 뒤). 예산 소진이 유일한 사용자 제한.
      if (spentOutputTokens >= this.config.maxTokens) {
        onEvent({
          type: "status",
          text: TOKEN_BUDGET_STATUS_TEXT,
        });
        this.pushAudit({ kind: "status", text: `턴 종료(token-budget) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "token-budget" };
      }
    }

    // 라운드 안전핀 도달(기본 200 — 정상 작업에선 도달하지 않음) — 현재까지의 changeset을 제시.
    onEvent({ type: "status", text: TOKEN_BUDGET_STATUS_TEXT });
    this.pushAudit({ kind: "status", text: `턴 종료(max-tool-calls) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
    return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "max-tool-calls" };
  }
}

interface EventTargetKey {
  readonly mapId: string;
  readonly eventId: string;
}

interface EventMoveTarget extends EventTargetKey {
  readonly x: number;
  readonly y: number;
}

function appendDiffWarning(result: ToolResult, warning: string): ToolResult {
  const diff = result.diff;
  if (!diff || diff.warnings.includes(warning)) return result;
  return { ...result, diff: { ...diff, warnings: [...diff.warnings, warning] } };
}

function diffSummaryLine(diff: ToolResult["diff"]): string {
  if (!diff) return "diff 없음";
  const parts = [
    diff.tilesChanged > 0 ? `타일 ${diff.tilesChanged}` : null,
    diff.eventsAdded > 0 ? `이벤트 추가 ${diff.eventsAdded}` : null,
    diff.eventsModified > 0 ? `이벤트 수정 ${diff.eventsModified}` : null,
    diff.eventsRemoved > 0 ? `이벤트 삭제 ${diff.eventsRemoved}` : null,
    diff.mapsAdded > 0 ? `맵 추가 ${diff.mapsAdded}` : null,
    diff.mapsRemoved > 0 ? `맵 삭제 ${diff.mapsRemoved}` : null,
    diff.dbRecordsChanged > 0 ? `DB ${diff.dbRecordsChanged}` : null,
    diff.tilesetsChanged > 0 ? `타일셋 ${diff.tilesetsChanged}` : null,
    diff.switchesAdded > 0 ? `스위치 ${diff.switchesAdded}` : null,
    diff.variablesAdded > 0 ? `변수 ${diff.variablesAdded}` : null,
    diff.worldEntitiesAdded > 0 ? `세계관 추가 ${diff.worldEntitiesAdded}` : null,
    diff.worldEntitiesModified > 0 ? `세계관 수정 ${diff.worldEntitiesModified}` : null,
    diff.palettePresetsAdded > 0 ? `프리셋 추가 ${diff.palettePresetsAdded}` : null,
    diff.palettePresetsModified > 0 ? `프리셋 수정 ${diff.palettePresetsModified}` : null,
    diff.endingsChanged > 0 ? `엔딩 ${diff.endingsChanged}` : null,
    diff.sessionChanged ? "세션" : null,
    diff.systemChanged ? "시스템" : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(", ") : "구조 변경 0";
}

function reviewRepairInstruction(reviewText: string, missingWarnings: readonly string[]): string | null {
  const trimmed = reviewText.trim();
  if (hasRawToolCallMarkup(trimmed)) {
    const lines = [
      "검수 응답이 툴콜 원시 마크업으로 깨졌습니다. 사용자 요청과 현재 제안 diff를 기준으로 누락된 항목을 실제 도구 호출로 보완하고 새 질문 없이 완료하세요.",
    ];
    if (missingWarnings.length > 0) {
      lines.push("아래 미이행 경고를 우선 보완하세요.", ...missingWarnings.map((warning) => `- ${warning}`));
    }
    return lines.join("\n");
  }
  const explicit = trimmed.match(/^재실행\s*[:：]\s*([\s\S]+)$/u);
  if (explicit?.[1]?.trim()) return explicit[1].trim();
  if (missingWarnings.length === 0) return null;
  return [
    "검수에서 아래 미이행이 발견되었습니다. 누락된 항목만 보완하고 새 질문 없이 완료하세요.",
    ...missingWarnings.map((warning) => `- ${warning}`),
  ].join("\n");
}

function stripReviewCompletePrefix(text: string): string {
  return text.trim().replace(/^완료\s*[:：]\s*/u, "");
}

function buildSpecPlanLabel(spec: BuildSpec): string {
  const title = spec.title?.trim();
  if (title) return title;
  const assetLabels = spec.assets
    .slice(0, 3)
    .map((asset) => asset.id.trim() || asset.kind.trim())
    .filter((label) => label.length > 0);
  const suffix = spec.assets.length > assetLabels.length ? ` 외 ${spec.assets.length - assetLabels.length}개` : "";
  return assetLabels.length > 0 ? `${assetLabels.join(", ")}${suffix}` : spec.mapId;
}

function proposalKey(proposal: ProposedCall): string {
  return `${proposal.name}:${JSON.stringify(proposal.args)}`;
}

/** 산포 툴 중복 억제 키 — seed 는 무시(같은 배치 의도 재호출 방지). */
export function writeDedupeKey(name: string, args: Record<string, unknown>): string | null {
  if (name !== "place_props") return null;
  const mapId = typeof args.mapId === "string" ? args.mapId : "";
  const material = typeof args.material === "string" ? args.material.trim() : typeof args.propVocabId === "string" ? args.propVocabId.trim() : "";
  const count = typeof args.count === "number" ? args.count : args.count;
  const area = args.area;
  return `place_props|${mapId}|${JSON.stringify(area)}|${material}|${String(count)}`;
}

function moveEventTarget(proposal: ProposedCall): EventMoveTarget | null {
  if (proposal.name !== "move_event") return null;
  const mapId = stringValue(proposal.args.mapId);
  const eventId = stringValue(proposal.args.eventId);
  const x = numberValue(proposal.args.x);
  const y = numberValue(proposal.args.y);
  return mapId === null || eventId === null || x === null || y === null ? null : { mapId, eventId, x, y };
}

function eventBaseTarget(proposal: ProposedCall): EventTargetKey | null {
  if (proposal.name === "place_npc" || proposal.name === "place_battle_blocker") {
    const mapId = stringValue(proposal.args.mapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "upsert_event") {
    const mapId = stringValue(proposal.args.mapId);
    const event = isRecord(proposal.args.event) ? proposal.args.event : null;
    const eventId = stringValue(event?.id);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  if (proposal.name === "duplicate_event") {
    const mapId = stringValue(proposal.args.toMapId);
    const data = isRecord(proposal.result.data) ? proposal.result.data : null;
    const eventId = stringValue(data?.eventId) ?? stringValue(proposal.args.newId);
    return mapId === null || eventId === null ? null : { mapId, eventId };
  }

  return null;
}

function withMovedEventBaseProposal(base: ProposedCall, move: EventMoveTarget): ProposedCall {
  const args = structuredClone(base.args);

  if (base.name === "place_npc" || base.name === "place_battle_blocker" || base.name === "duplicate_event") {
    args.x = move.x;
    args.y = move.y;
  } else if (base.name === "upsert_event") {
    const event = isRecord(args.event) ? args.event : null;
    if (event !== null) args.event = { ...event, x: move.x, y: move.y };
  } else {
    return base;
  }

  return {
    ...base,
    args,
    summary: summaryWithFinalEventPosition(base.summary, move),
    result: { ...base.result, data: dataWithEventPosition(base.result.data, move) },
  };
}

function summaryWithFinalEventPosition(summary: string, move: EventMoveTarget): string {
  const coord = `(${move.x}, ${move.y})`;
  const replaced = summary.replace(/배치 \(-?\d+,\s*-?\d+\)/, `배치 ${coord}`);
  return replaced !== summary ? replaced : `${summary} — 최종 위치 ${coord}`;
}

function dataWithEventPosition(data: unknown, move: EventMoveTarget): unknown {
  return isRecord(data) ? { ...data, x: move.x, y: move.y } : data;
}

function eventTargetKey(target: EventTargetKey): string {
  return `${target.mapId}:${target.eventId}`;
}

function isSpecGatePass(result: ToolResult | SpecGatePass): result is SpecGatePass {
  return "warnings" in result;
}

function regionContains(region: AffectedRegion, x: number, y: number): boolean {
  return x >= region.x && y >= region.y && x < region.x + region.w && y < region.y + region.h;
}

function autoExpandedAssetKind(toolName: string): string {
  switch (toolName) {
    case "clear_region":
    case "tile_erase":
      return "clear";
    case "paint_road":
    case "tile_road":
    case "lay_path":
      return "road";
    case "fill_region":
    case "paint_tiles":
    case "tile_paint":
      return "terrain";
    case "place_npc":
      return "npc";
    case "place_battle_blocker":
    case "place_props":
    case "tile_scatter":
      return "prop";
    case "build_house":
    case "build_house_kit":
    case "build_house_lots":
    case "build_village":
      return "house";
    default:
      return "structure";
  }
}

function withSpecGateWarnings(result: ToolResult, warnings: readonly LintIssue[]): ToolResult {
  if (!result.ok || warnings.length === 0) return result;
  const warningMessages = warnings.map((warning) => warning.message);
  return {
    ...result,
    diff: result.diff
      ? { ...result.diff, warnings: [...result.diff.warnings, ...warningMessages] }
      : result.diff,
    issues: [...(result.issues ?? []), ...warnings],
  };
}

// usage가 없는 응답(일부 스트리밍)의 출력 토큰 추정 — 한국어 기준 보수적으로 3자당 1토큰.
function estimateOutputTokens(message: ChatMessage): number {
  const contentLength = message.content?.length ?? 0;
  const argsLength = (message.tool_calls ?? []).reduce((total, call) => total + call.function.arguments.length + call.function.name.length, 0);
  return Math.ceil((contentLength + argsLength) / 3);
}

// 모델에 되돌려줄 툴 결과(자가수정을 위해 issues를 포함).
// show_map_region 등의 거대한 lower/upper 2D 배열은 컨텍스트를 폭파시키므로 생략한다(이미지는 별도 주입).
function toolResultForModel(result: ToolResult): Record<string, unknown> {
  return {
    ok: result.ok,
    summary: result.summary,
    diff: result.diff,
    // issues가 있으면 원인을 읽고 인자를 고쳐 재시도하라는 신호.
    issues: result.issues?.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message })),
    ...(result.warnings && result.warnings.length > 0 ? { warnings: result.warnings } : {}),
    data: compactToolDataForModel(result.data),
  };
}

function compactToolDataForModel(data: unknown): unknown {
  if (data === null || data === undefined || typeof data !== "object") return data;
  const rec = data as Record<string, unknown>;

  // 비전 툴: 전체 타일 행렬 생략 (픽셀 이미지가 별도 user 메시지로 감).
  if (Array.isArray(rec.lower) || Array.isArray(rec.upper)) {
    const w = typeof rec.w === "number" ? rec.w : undefined;
    const h = typeof rec.h === "number" ? rec.h : undefined;
    return {
      mapId: rec.mapId,
      x: rec.x,
      y: rec.y,
      w,
      h,
      tileArraysOmitted: true,
      note: "lower/upper 타일 배열은 컨텍스트 절약을 위해 생략됨. 같은 턴에 주입된 맵 이미지를 보거나, 좌표는 x/y/w/h·summary를 사용. 호수 위치는 get_map_region의 data.water.bounds를 우선.",
    };
  }

  // get_map_region: 과대 그리드는 샘플+water 메타만.
  if (Array.isArray(rec.grid)) {
    const grid = rec.grid as string[];
    const totalChars = grid.reduce((sum, row) => sum + row.length, 0);
    if (totalChars > 900) {
      const step = Math.max(1, Math.ceil(Math.sqrt(totalChars / 600)));
      const sampled = grid.filter((_, index) => index % step === 0).map((row) => {
        if (row.length <= 40) return row;
        let out = "";
        for (let i = 0; i < row.length; i += step) out += row[i];
        return out;
      });
      return {
        ...rec,
        grid: sampled,
        gridSampled: true,
        gridSampleStep: step,
        note: "그리드가 커서 샘플링됨. 호수 좌표는 water.bounds를 쓰고, 상세는 작은 영역으로 재조회.",
      };
    }
  }

  return data;
}

function parseToolCall(call: ToolCall): { name: string; args: Record<string, unknown> } {
  const name = call.function.name;
  let args: Record<string, unknown> = {};
  const raw = call.function.arguments?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") args = parsed as Record<string, unknown>;
    } catch {
      // 인자 JSON 파싱 실패 — 빈 인자로 두면 runTool이 검증 오류를 issues로 돌려줘 자가수정 유도.
    }
  }
  return { name, args };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function appendTransientRetryGuidance(message: string): string {
  if (message.includes(TRANSIENT_NETWORK_RETRY_GUIDANCE)) return message;
  return `${message}\n${TRANSIENT_NETWORK_RETRY_GUIDANCE}`;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
