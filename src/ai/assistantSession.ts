// ai/assistantSession.ts
// 어시스턴트 세션: user msg → LLM → tool_calls → runTool(dryRun 누적) → tool 메시지 → … → 최종 응답.
// - 쓰기 툴은 로컬 draft(ctx.project)에 누적되어 연쇄 툴콜이 이전 결과를 본다(store는 건드리지 않음).
// - 커밋 게이트/인자 검증 실패 시 issues를 tool 메시지로 모델에 되돌려 자가수정을 유도(최대 maxToolCalls 왕복).
// - 브라우저 비의존(순수). chat 함수는 주입 가능(테스트에서 모킹).

import { getTool, normalizeToolArgs, runTool } from "@/editor/tools";
import { viewportVillageBounds } from "@/editor/tools/authorVillageSupport";
import { toOpenAiTools } from "@/editor/tools";
import type { ToolContext, ToolDomain, ToolResult } from "@/editor/tools";
import {
  harnessToolReason,
  injectToolReasonIntoOpenAiTool,
  isUsableToolReason,
  splitToolCallReason,
} from "@/ai/toolReason";
import {
  buildCastWriterMessages,
  collectPendingNpcs,
  existingCastOnMap,
  parseCastSheet,
  worldEntityNames,
  type CastContext,
} from "@/ai/npcCast";
import { buildWorldDigest, normalizeProjectWorld } from "@/project/world";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { isDestructiveOutcome } from "@/ai/approvalPolicy";
import { contextFooterMapId, stripContextFooter } from "@/ai/contextFooter";
import {
  continuationIntentDeclaration,
  emptyIntentDeclaration,
  fallbackIntentDeclaration,
  formatIntentAudit,
  formatIntentClarifyMessage,
  formatIntentNote,
  formatScopeNote,
  isContinuationText,
  type IntentDeclaration,
} from "@/ai/intentDeclaration";
import { buildIntentFacts, declareIntentCached, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { ComposerMode } from "@/ai/composerMode";
import { store } from "@/project/store";
import { supabaseProjectConfigDraft } from "@/project/supabaseProjectConfig";
import {
  PLAY_WALKTHROUGH_TOOL,
  parseLayerVerdict,
  selectVerificationCalls,
  type LayerDescriptor,
  type LayerVerdictInput,
  type VerificationCallRecord,
} from "./agentVerification";
import type { LintIssue } from "@/project/lint/projectLint";
import { beginAssistantToolDomainTurn, computeActiveToolDomains, recordAssistantToolDomainUse } from "@/editor/assistantToolMode";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { extractVocabSoftConfirm } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { buildSystemPrompt, DEFAULT_BUDGET_CHARS, resolveContextMapId, resolveContextViewport, type ContextOptions } from "./contextBuilder";
import {
  buildConversationTurnContext,
  mapTransitionNote,
  type ConversationTurnContext,
  type TurnSelectionSnapshot,
} from "./conversationTurnContext";
import { capabilityEscalationSchemas, clampTurnToolSchemas } from "./capabilityEscalation";
import { buildPreferenceMemorySection } from "./preferenceMemory";
import { mentionedToolSchemas, planRequiredToolSchemas, toolSchemasForNames } from "./planToolExposure";
import { compactMessagesForRequest, resolveRequestCharBudget, resolveWorkingContextTokens } from "./messageBudget";
import {
  buildCompactedMessages,
  buildSummarizationRequest,
  DEFAULT_COMPACTION_SETTINGS,
  MANUAL_COMPACTION_SETTINGS,
  describeContextUsage,
  estimateContextTokens,
  findCompactionCutPoint,
  findPreviousSummary,
  resolveThresholdContextTokens,
  shouldCompact,
  type ContextUsage,
} from "./contextCompaction";
import { restoredTranscriptMessage } from "./conversationReplay";
import { addSessionUsage, EMPTY_SESSION_USAGE, type SessionUsageTotals } from "./sessionUsage";
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
  formatResolvedSpatialBlock,
  implicitSpecFromViewLocation,
  resolveTurnViewLocation,
} from "./viewRelativeLocation";
import {
  chatCompletion,
  configForLiteModel,
  isLlmAbortError,
  isOhMyPiWorkerCrash,
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
  TILE_WRITE_TOOLS,
  affectedRegions,
  boundarySlackForTool,
  checkRegionsAgainstSpecBoundary,
  implicitSpecFromContext,
  implicitSpecFromScope,
  normalizeBuildSpec,
  protectedCellsInRegions,
  toolWritesTiles,
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
import { defaultYieldToUi, type YieldToUi } from "./yieldToUi";
import {
  MAX_RALPH_ATTEMPTS_PER_ITEM,
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
  blockWorkItemById,
  reactivateBlockedWorkItems,
  skipWorkItemById,
  summarizeWorkPlan,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
  type WorkItem,
  type WorkItemOutcomeGate,
  type WorkLayer,
  type WorkPlan,
} from "./workPlan";
import {
  authoredQuestIdFrom,
  authoredTroopIdFrom,
  battlePhaseSimulationFrom,
  createdMapIdFrom,
  verifyAuthoredBossPhases,
  verifyAuthoredQuestsPlayable,
  verifyCreatedMapsAuthored,
  verifyTargetMapChanged,
  type BattlePhaseSimulation,
} from "./workItemOutcome";
import {
  MAX_VOLUME_CONTINUES_PER_TURN,
  formatVolumeContinueMessage,
  measureVolume,
  placedNpcIdFrom,
  verifyPlacedNpcsHaveStatePages,
  volumeGaps,
  volumeUnmet,
  type VolumeBar,
  type VolumeSnapshot,
} from "./volumeContract";
import {
  buildRunRecap,
  serializeRunRecap,
  usageDelta,
  type RunRecap,
} from "./runRecap";

const MAX_ESCALATED_TOOLS_PER_TURN = 16;
/**
 * 한 항목에서 **같은 쓰기 툴 + 같은 실패 요약**을 연속으로 몇 번까지 허용하는가 (2026-09-03).
 * 스펙 게이트 거부처럼 인자를 바꾸지 않으면 영원히 같은 결과인 실패가 여기서 끊긴다.
 */
const MAX_REPEATED_TOOL_FAILURES_PER_ITEM = 4;
const MAX_BASE_TURN_TOOL_SCHEMAS = 40;

function discoveredToolNames(result: ToolResult): string[] {
  if (!result.ok || typeof result.data !== "object" || result.data === null || Array.isArray(result.data)) return [];
  const matches = (result.data as { readonly matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];
  return matches.flatMap((match) => {
    if (typeof match !== "object" || match === null || Array.isArray(match)) return [];
    const name = (match as { readonly name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
}

// UI 스트리밍/로그용 이벤트.
export type SessionEvent =
  | { type: "assistant_token"; delta: string }
  | { type: "reasoning_token"; delta: string }
  | { type: "assistant_message"; content: string }
  | { type: "assistant_stream_reset" }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; result: ToolResult; reason?: string }
  // 툴 실행 직전에 나가는 신호 이벤트 — 결과 도착 전에 "지금 무엇을 하는 중"을 그릴 수 있게 한다.
  // index는 이번 턴의 1-based 실행 서수.
  | { type: "tool_started"; name: string; index: number }
  | { type: "phase"; value: "plan" | "execute" | "review" }
  | { type: "status"; text: string }
  | { type: "work_plan"; plan: WorkPlan }
  // ── 마일스톤 자동 적용(todo 4) ─────────────────────────────────────
  // 자율 런에서 작업 항목 완료가 안전 검사를 통과해 스토어에 자동 적용됐다.
  | { type: "milestone_applied"; title: string; toolCount: number; commitId: string | null }
  // 자동 적용이 차단됐다(파괴적/어휘/규칙 verdict 또는 완성도 경고) — 카드가 렌더되어
  // 사용자 승인을 기다린다(런 일시정지).
  | { type: "proposal_paused"; reason: string; warnings?: readonly string[] }
  /** 사용자 목표(자율 런이면 드라이버 전체)가 끝났을 때 토큰·경과·과정 계량. */
  | { type: "run_recap"; recap: RunRecap };

// 제안(changeset)에 담기는 개별 쓰기 툴콜.
export interface ProposedCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  result: ToolResult;
  destructive: boolean; // remove_event 등 파괴적 작업.
  requiresApproval?: boolean;
  approvalWarning?: string;
  /** 이 쓰기를 한 한 줄 이유. 적용 감사·편집 로그로 복사된다. */
  reason?: string;
}

export interface TurnResult {
  assistantText: string;
  proposedCalls: ProposedCall[]; // 성공한 쓰기 툴콜(수락 시 store에 적용할 시퀀스).
  stoppedReason: "final" | "max-tool-calls" | "token-budget" | "error" | "aborted";
  error?: string;
  /** 어려운 요청의 다층 To-do 진행 상태(있으면 UI/브리지에 노출). */
  workPlan?: WorkPlan;
  /** 이 사용자 목표가 태운 토큰·경과·과정. 채팅에는 토큰 줄만, 로그에는 전부. */
  recap?: RunRecap;
}

// 감사 로그 항목(Phase 1 헤드리스 러너로 리플레이 가능한 시퀀스).
// at: ISO 타임스탬프(결함 ⑬ — 상태 전이/툴 호출/오류 타임라인을 export 가능하게).
// kind:"status"는 턴 수명주기(시작/종료 사유/오류/재시도) 전이 기록이다.
export type AuditEntry =
  | { kind: "user"; text: string; at?: string; context?: ConversationTurnContext }
  | { kind: "assistant"; text: string; toolCalls?: { name: string; args: string }[]; at?: string }
  | { kind: "tool"; name: string; args: Record<string, unknown>; ok: boolean; summary: string; reason?: string; issues?: string[]; construction?: import("@/editor/construction/constructionAudit").ConstructionAuditRecord; at?: string }
  | { kind: "status"; text: string; at?: string };

// 하네스 스냅샷 — 오케스트레이션 주입을 포함한 세션 원본 메시지와 감사 로그를 한 번에 관측한다.
// 🔬 하네스 뷰어와 window.__oprnAiHarness(헤드리스 디버깅)가 소비한다.
export interface HarnessSnapshot {
  readonly model: string;
  readonly liteModel?: string;
  readonly maxTokens: number;
  readonly messages: readonly ChatMessage[];
  readonly audit: readonly AuditEntry[];
  readonly workPlan?: WorkPlan | null;
}

type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

// 파괴성 판정은 approvalPolicy.isDestructiveOutcome 한 곳으로 모았다(이름 목록 + 결과 diff).
// 여기 있던 3개짜리 지역 목록은 approvalPolicy 의 6개짜리 정본과 어긋나 있었다.
export const RULE_TOOLS: ReadonlySet<string> = new Set(["set_cluster_rule", "set_group_junction", "set_group_overlay"]);

// 어휘 합의: propose_tile_vocabulary 또는 soft-confirm 시공(목업 확인)이 적용될 때 origin:user 로 확정된다
// (적용 경로가 markSoftVocabApprovalsOnProject 를 부른다 — 승인 버튼은 없다).
export const VOCABULARY_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(["propose_tile_vocabulary"]);
const VOCABULARY_APPROVAL_WARNING = "🔒 재료 합의: 적용하면 해당 타일/그룹을 다음부터 바로 씁니다(되돌리기로 원복).";
const VOCAB_SOFT_CONFIRM_APPROVAL_WARNING =
  "🖼 맵 배치와 함께 재료를 합의했습니다(origin:user). 되돌리면 배치와 합의가 함께 원복됩니다.";
const HARD_CLUSTER_RULE_WARNING = "⚠️ 강한 규칙: 이 타일셋을 쓰는 모든 맵의 저장(커밋)이 규칙 위반 시 거부됩니다.";
export const TOKEN_BUDGET_STATUS_TEXT = "요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.";

// 예산 소진으로 잘린 턴은 모델이 마무리 문장을 낼 기회가 없어 assistantText 가 빈 채로 끝난다.
// 그대로 반환하면 제안이 승인 대기로 떠 있는데도 화면에는 아무 말이 없다 — 2026-08-29 실측:
// 영역 턴이 max-tool-calls 로 잘리며 313칸 제안 13건을 침묵으로 남겼고, 사용자에게는
// "명령이 씹혔다"로 보였다. 최소한 왜 멈췄고 무엇이 대기 중인지는 말한다.
export function truncatedTurnText(existing: string, proposals: number, budgetLabel: string): string {
  if (existing.trim().length > 0) return existing;
  const pending = proposals > 0
    ? `지금까지 만든 제안 ${proposals}건이 승인 대기 중입니다 — 수락하면 반영됩니다.`
    : "적용할 만한 변경은 만들지 못했습니다.";
  return `${budgetLabel}을 다 써서 이번 턴을 여기서 멈췄습니다. ${pending} 이어서 요청해 주세요.`;
}
const EXECUTION_PHASE_HINT = "실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지. 한 응답에 여러 tool_calls를 배치해 라운드 수를 최소화하라(예: fill_region + author_house + paint_road를 동시에).";
const ZERO_CHANGE_REKICK_HINT = "사용자는 변경을 기대합니다. 질문이 아니면 지금 계획을 세우고 실행하세요";
const UNBUILT_SPEC_REKICK_HINT =
  "밑그림(set_build_spec)만 확정되었고 실제 배치 툴이 한 번도 호출되지 않았습니다. " +
  "밑그림은 사용자에게 보이지 않고 승인할 대상도 아닙니다 — 다시 밑그림을 제출하지 말고 " +
  "명세의 에셋을 실제로 만드는 배치 툴(place_npc · make_villager · author_house · place_props 등)을 지금 호출하세요.";
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

function plannedTargetMismatch(spec: BuildSpec, args: Record<string, unknown>): string | null {
  const expected = spec.plannedMap;
  const target = args.target;
  if (!expected || !isRecord(target) || target.kind !== "new") return null;

  const planned = isRecord(target.plannedMap) ? target.plannedMap : target;
  const actualMapId = typeof planned.mapId === "string"
    ? planned.mapId
    : typeof target.mapId === "string"
      ? target.mapId
      : null;
  const actualWidth = typeof planned.width === "number" ? planned.width : null;
  const actualHeight = typeof planned.height === "number" ? planned.height : null;
  if (
    actualMapId === expected.mapId
    && actualWidth === expected.width
    && actualHeight === expected.height
  ) {
    return null;
  }

  return `확정된 plannedMap은 '${expected.mapId}' ${expected.width}×${expected.height}이지만 요청 대상은 `
    + `'${actualMapId ?? "?"}' ${actualWidth ?? "?"}×${actualHeight ?? "?"}입니다.`;
}

export function rawToolCallMarkupIndex(text: string): number {
  const lower = text.toLowerCase();
  // 공급자 고유의 센티넬 문자열은 여기서 열거하지 않는다 — 전에는 한 공급자의 raw 툴콜
  // 구분자를 하드코딩했는데, 그 공급자를 쓰지 않게 되면서 죽은 문자열만 남았다.
  // `<tool_call>` 과 `<invoke name=` 는 공급자를 가리지 않는 누출 형태다.
  const indexes = [
    lower.indexOf("<tool_call>"),
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
const VISION_TOOLS = new Set(["show_tiles", "show_tile_grid", "show_map_region", "preview_house", "look_at_houses", "render_group_sample"]);

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
// 감사(test/toolSchemaProviderCompat.test.ts)가 레지스트리 툴과 함께 검사해야 하므로 export 한다.
export const SET_BUILD_SPEC_TOOL: OpenAiToolSchema = {
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
            "겹치지 않는 영역을 가진 에셋 목록. kind: house|road|npc|prop|clear|terrain 등, layer: lower(기본)|upper(장식). " +
            "clear 에셋이 기존 구조물(집 등)을 덮으면 confirmDestroy:true가 있어야 통과합니다 — '주변 청소'는 구조물을 피해 영역을 좁히세요. " +
            "배치 에셋 자리·주변에 기존 타일이 있으면 overExisting:\"clear\"|\"keep\"이 있어야 통과합니다.",
          // properties 를 선언하지 않으면(items:{type:"object"}) strict function-calling 경로에서
          // 모델이 필드를 표현할 방법이 없어 `assets:[{}]` 만 보낸다 — 2026-08-23 실측: 밑그림 검증 10회 연속 실패.
          //
          // 같은 벽을 필드 단위로 또 밟았다(2026-08-29 실측): 검증기가 overExisting 을 요구하는데
          // 여기 선언이 없어 모델이 9회 연속 재제출에서 단 한 번도 그 필드를 낼 수 없었다. 같은 턴에서
          // 선언돼 있던 confirmDestroy 는 정상적으로 나왔다 — 차이는 오직 이 목록에 있느냐였다.
          // 결과: 영역 턴이 24콜 예산을 태우고 max-tool-calls 로 잘렸다(313칸이 미적용으로 폐기).
          // 검증기가 요구하는 필드는 반드시 여기 선언한다 — properties 는 계약이고 description 은 주석이다.
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "에셋 식별자(예: house_1)" },
              kind: { type: "string", description: "house|road|npc|prop|clear|terrain 등" },
              x: { type: "integer", description: "영역 좌상단 타일 x(칸 좌표)" },
              y: { type: "integer", description: "영역 좌상단 타일 y(칸 좌표)" },
              w: { type: "integer", description: "가로 칸 수 — 차지하는 마지막 칸은 x+w-1" },
              h: { type: "integer", description: "세로 칸 수 — 차지하는 마지막 칸은 y+h-1" },
              layer: { type: "string", enum: ["lower", "upper"], description: "기본 lower" },
              style: { type: "string", description: "종류별 스타일 힌트(선택)" },
              shape: {
                type: "string",
                enum: ["rect", "ellipse", "circle"],
                description: "면 채우기 형태 힌트(기본 rect). 원형 수역은 circle — fill_region.shape 와 맞춘다",
              },
              confirmDestroy: { type: "boolean", description: "clear가 기존 구조물을 덮을 때만 true" },
              overExisting: {
                type: "string",
                enum: ["clear", "keep"],
                description:
                  "배치(비-clear) 에셋 자리·주변에 기본 타일이 아닌 것이 있을 때의 정리 방침. " +
                  "clear=정리하고 배치, keep=그대로 위에 배치. 검증기가 요구하면 반드시 넣는다",
              },
            },
            required: ["id", "kind", "x", "y", "w", "h"],
          },
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

// 검증기가 재제출 때 채우라고 이름을 부르는 에셋 필드. 여기 있는 이름은 반드시
// SET_BUILD_SPEC_TOOL 의 assets.items.properties 에도 선언돼 있어야 한다 —
// 선언 없는 필드를 요구하면 모델이 낼 방법이 없어 거부 루프가 예산을 태운다.
// 계약은 test/toolSchemaProviderCompat.test.ts 가 지킨다.
export const SPEC_REMEDY_FIELDS = ["overExisting", "confirmDestroy"] as const;

// 키 순서에 흔들리지 않는 명세 지문. JSON.stringify 는 키 삽입 순서를 그대로 따르므로
// 모델이 같은 내용을 순서만 바꿔 보내면 다른 문자열이 된다 — 정렬해서 비교한다.
function specFingerprint(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(specFingerprint).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const body = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${specFingerprint(entry)}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const ASSISTANT_TURN_RETRY_ATTEMPTS = 3;
const TRANSIENT_NETWORK_RETRY_GUIDANCE = "일시적 네트워크 문제로 보이면 재시도를 눌러 주세요.";

/**
 * 자율 런(autonomous driver)의 총 예산 — 자동 계속 턴 수 상한.
 * 턴당 Ralph 상한(MAX_WORK_PLAN_AUTO_STEPS_PER_TURN)과 별개로, 하나의 목표에 대해
 * 하니스가 사용자 개입 없이 소비할 수 있는 총 턴 수를 묶는다. 소진 시
 * agent_run_budget_exhausted 감사를 남기고 멈추며, 사용자의 「계속」 한마디로 재가동된다.
 */
export const AGENT_RUN_MAX_TOTAL_STEPS = 48;

/**
 * Session-only WorkPlan tools (Claude TodoWrite / Anthropic task-list style).
 * Always available so the main model can plan/replan inside the ReAct loop;
 * the pre-turn planner also authors the first plan without tools.
 */
/** 세션 전용 쓰기 툴(레지스트리 밖) — 질문 모드에서 함께 뺀다. */
const SESSION_WRITE_TOOL_NAMES: ReadonlySet<string> = new Set(["set_build_spec", "set_work_plan", "complete_work_item", "skip_work_item"]);

/** 프로젝트를 바꾸는 툴인가 — 레지스트리 mode:"write" 또는 세션 전용 쓰기 툴. */
export function isWriteToolName(name: string): boolean {
  return getTool(name)?.mode === "write" || SESSION_WRITE_TOOL_NAMES.has(name);
}

function composerAskRefusal(name: string): ToolResult {
  return {
    ok: false,
    summary: `질문 모드에서는 변경 도구(${name})를 실행하지 않습니다. 조회 도구로만 답하세요 — 변경이 필요하면 사용자가 지시 모드로 바꿔야 합니다.`,
    issues: [{ severity: "error", code: "composer-mode-ask", message: `${name} 은(는) 프로젝트를 바꾸는 도구라 질문 모드에서 거부됐습니다.` }],
  };
}

export const WORK_PLAN_TOOLS: readonly OpenAiToolSchema[] = [
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
            description: "2~6 레이어. 각 레이어는 title 과 items 를 가지며, 항목마다 구체적인 instruction 이 필요하다.",
            // items:{type:"object"} 로 두면 모델이 `layers:[{}]` 밖에 못 보낸다(2026-08-23 실측: 8회 연속 인자 오류).
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "생략 시 L1, L2 … 자동" },
                title: { type: "string", description: "레이어 제목" },
                items: {
                  type: "array",
                  description: "이 레이어의 작업 항목",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", description: "생략 시 L1-1 … 자동" },
                      title: { type: "string", description: "항목 제목" },
                      instruction: { type: "string", description: "실행 모델이 그대로 수행할 구체 지시" },
                      doneWhen: { type: "string", description: "완료 판정 기준(선택)" },
                      successTools: {
                        type: "array",
                        description: "이 항목의 성공을 증명하는 툴 이름(선택)",
                        items: { type: "string" },
                      },
                    },
                    required: ["title", "instruction"],
                  },
                },
              },
              required: ["title", "items"],
            },
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

/** 이번 턴이 손댈 범위 — 현재 맵의 선택 사각형. 사실이지 의도가 아니다. */
export interface SessionTurnScope {
  readonly mapId: string;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface SessionTurnOptions {
  readonly autonomous?: boolean;
  /** 사용자 발화 원문. text 에 footer 가 붙어 올 때 의도 선언·툴 언급 스캔은 이것만 본다. */
  readonly instruction?: string;
  readonly scope?: SessionTurnScope | null;
  /** 컴포저 모드(지시/질문/계획). 없으면 지시. 세션이 강제한다 — 프롬프트 힌트가 아니다(`@/ai/composerMode`). */
  readonly composerMode?: ComposerMode;
  /**
   * 하네스 내부 플래그 — 자율 드라이버가 스스로 보낸 합성 「계속」 턴인가. 패널·브리지는 넘기지 않는다.
   *
   * 사용자의 새 메시지(직접 친 「계속」 포함)와 구분해야 하는 것이 둘 있다:
   *  1. 막힌 항목 되살리기 — 사람이 다시 말을 걸었을 때만 재시도한다(2026-09-03).
   *  2. 플래너 왕복 — 계획이 그대로인 드라이버 계속 턴은 resume 이 자명하므로 main 모델 콜을 건너뛴다.
   */
  readonly driverContinue?: boolean;
}

export interface AssistantSessionOptions {
  config?: AiConfig;
  contextOptions?: ContextOptions;
  // 테스트/대체용 chat 구현. 기본은 설정 baseUrl의 OpenAI 호환 chatCompletion.
  chat?: ChatFn;
  /**
   * 턴 시작에 사용자 발화를 구조화 의도로 선언하는 함수(한 번, JSON). 패널·영역 작업은 실제 모델
   * 선언자(createLlmIntentDeclarer)를 넣는다. 없으면 중립 폴백 선언으로 진행한다 — 되묻기·계획·툴
   * 도메인을 문장 키워드로 추측하는 경로는 없다(2026-09-03 의도 라우터 감사).
   */
  declareIntent?: IntentDeclarer;
  /**
   * 자율 실행 드라이버용 사용자-대기 조회 훅(peek-only). 패널의 pendingSends 큐에
   * 메시지가 있는지 "만" 보고한다 — 드라이버는 절대 dequeue 하지 않는다(패널의 기존
   * 드레인 루프가 전달한다). 비문자·빈 문자열은 null 로 취급한다(시스템 경계 검증).
   */
  peekPendingUserMessage?: () => string | null;
  // 비전 이미지 렌더러(브라우저 전용). 없으면 텍스트 전용(Node/테스트에서 동일 동작).
  renderImages?: ToolImageRenderer;
  // 이전 모드 스코핑 호환 옵션. 현재는 computeActiveToolDomains()가 UI 도메인을 직접 계산한다.
  toolMode?: () => ToolDomain | undefined;
  /**
   * 턴 시점 선택 영역 조회(에디터 UI 상태). 사용자 감사 항목의 상황 스냅샷에만 쓰이며
   * 시스템 프롬프트에는 들어가지 않는다 — 그래서 ContextOptions 가 아니라 여기 있다.
   */
  getTurnSelection?: () => TurnSelectionSnapshot | null | undefined;
  /**
   * 복원/되감기로 들어온 세션에 주입할 이전 대화 기록(conversationReplay.serializeAuditTranscript).
   * 시스템 프롬프트 바로 뒤 role "user" 한 덩어리로 들어간다 — 화면만 복원하고 모델은 아무것도
   * 기억하지 못하던 상태를 메꾸는 유일한 입력이다.
   */
  priorTranscript?: string;
  /**
   * 동기 도구 실행 직전에 이벤트 루프를 양보한다. 기본은 브라우저에서 rAF 1틱,
   * Node/테스트는 즉시. 주입하면 테스트가 양보 횟수를 셀 수 있다.
   */
  yieldToUi?: YieldToUi;
}

/** 수동 압축(compactNow) 결과. 건너뜀은 사유를 사람 문장으로 돌려준다(UI 가 그대로 보여준다). */
export type CompactionOutcome =
  | { readonly kind: "done"; readonly beforeTokens: number; readonly afterTokens: number; readonly summary: string }
  | { readonly kind: "skipped"; readonly reason: string };

export class AssistantSession {
  private config: AiConfig;
  private readonly chat: ChatFn;
  private readonly contextOptions: ContextOptions;
  // 비전 렌더러(브라우저 전용). 주입되면 '보여줘' 툴 이미지가 모델에 전달된다.
  private readonly renderImages?: ToolImageRenderer;
  private readonly yieldToUi: YieldToUi;
  /** 이번 턴이 플래너 왕복을 건너뛰었는가 — 계획 툴·검수·Ralph 도 같이 끈다. */
  private skipPlannerThisTurn = false;
  /** 이번 턴의 컴포저 모드. ask 는 쓰기 툴을 노출·실행하지 않고, plan 은 계획만 세우고 멈춘다. */
  private turnComposerMode: ComposerMode = "do";
  /** 이번 턴의 플래너가 계획을 새로 세웠는가(new_plan/replan/폴백). resume 은 아니다 — 계획 모드의 「계속」은 실행된다. */
  private planAuthoredThisTurn = false;
  /** 직전 턴이 계획만 세우고 멈춘 턴이었는가 — 자율 드라이버는 이 턴 다음에 자동 계속하지 않는다. */
  private lastTurnPlanOnly = false;
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
  // 직전에 거부된 명세의 정규화 지문. 키 순서만 바꾼 같은 명세를 재제출하는 공회전을
  // 짚어주기 위해서다(2026-08-29 실측: 314바이트 동일 payload 3연속 재제출로 예산 소진).
  private lastRejectedSpecFingerprint: string | null = null;
  // 이번 턴에 누적된 제안 — 오류 후 재시도(retryLastTurn)에서도 이어진다(결함 ⑥).
  private turnProposals = new Map<string, ProposedCall>();
  /** place_props 등 산포 중복 호출 억제 — 같은 인자로 이미 성공한 쓰기는 재실행하지 않는다. */
  private turnWriteDedupe = new Map<string, ToolResult>();
  private turnEscalatedToolNames: string[] = [];
  /** 이번 턴에 실행을 시작한 툴 수 — tool_started 이벤트의 1-based 서수 원천. */
  private turnToolStartedCount = 0;
  private eventBaseProposalKeys = new Map<string, string>();
  private currentTurnToolDomains: ReadonlySet<ToolDomain> | undefined;
  private currentTurnRequestText = "";
  /** 이번 턴의 사용자 발화만(가이드·footer 없음) — 툴 이름 언급·능력 승격·의도 선언의 입력. */
  private currentTurnInstruction = "";
  /** 이번 턴의 의도 선언. 턴 시작에 한 번 정해지고 라우팅(되묻기·플래너·툴 노출·대상 맵)이 이것만 읽는다. */
  private turnIntent: IntentDeclaration | null = null;
  /** 이번 턴이 손댈 선택 사각형(있으면). 패널·영역 작업이 사실로 넘긴다. */
  private turnScope: SessionTurnScope | null = null;
  // 직전 턴이 LLM 오류로 끊겼는가(수동 재시도 허용 플래그).
  private lastTurnFailed = false;
  // ── 자율 실행 드라이버(todo 2) ────────────────────────────────────────
  // 턴이 끝난 뒤 (계획 미완료 && 예산 잔여 && 대기 사용자 메시지 없음 && 중단 아님)인
  // 동안 하니스가 스스로 다음 턴을 송신한다. 사용자가 그 사이에 무언가를 보냈다면
  // peekPendingUserMessage 훅이 그것을 알려주고 드라이버는 양보한다(사용자 우선).
  private readonly peekPendingUserMessage: (() => string | null) | undefined;
  /** 이 자율 런에서 자동 계속한 턴 수(예산 소비). 사용자의 수동 진입마다 0으로 재가동된다. */
  private autoRunSteps = 0;
  // ── 마일스톤 자동 적용(todo 4) ────────────────────────────────────────
  // 이번 sendUserMessage 진입이 opts.autonomous 인가 — 참일 때만 완료 항목을 자동 적용한다.
  private milestoneAutoApply = false;
  // 커밋 게이트가 현재 턴의 마일스톤 적용을 거부했다. 저장소는 바뀌지 않았으므로 현재
  // 자율 런만 멈추고, 다음 사용자 메시지 진입 또는 성공한 rebase 에서 다시 가동한다.
  private milestoneApplyFailed = false;
  // 직전에 처리한 완료 항목 id — 같은 항목의 중복 complete_work_item 재트리거 방지.
  private lastMilestoneCompletionItemId: string | null = null;
  // ── 레이어 검증(자문) ──────────────────────────────────────────────────────
  // 자율 런에서 레이어 완료마다 canonical 테이블(agentVerification)대로 검증 툴콜을
  // runTool(세션 ctx)로 돌리고 verdict 를 **감사에만** 남긴다. 재킥·3회 중단은 없다
  // (2026-08-30 실측으로 제거 — agentVerification 헤더의 ADVISORY CONTRACT 참조).
  // 자문 검증이 직접 실행한 툴콜은 히스토리에 기록하지 않는다(모델 저작만).
  /** 런 누적 툴콜 히스토리(검증 선택용) — 쓰기 툴 + play_walkthrough 만 기록한다. */
  private verificationHistory: VerificationCallRecord[] = [];
  /** 이 플랜에서 이미 자문 검증을 돌린 레이어 id(플랜 id 기준 — replan 시 자연 리셋). */
  private verifiedPlanId: string | null = null;
  private verifiedLayerIds = new Set<string>();
  /** run-end 저장 증명(flush+reload)을 처리한 플랜 id — 플랜당 1회. */
  private runEndProofPlanId: string | null = null;
  // 현재 시스템 프롬프트에 적용된 문자 예산(토큰 보정). 관측으로 값이 바뀌면 턴 시작 시 재조립한다.
  private appliedBudgetChars: number;
  /** 직전 요청에 공급자가 실제로 과금한 프롬프트 토큰 — 컨텍스트 압축 임계 판정의 실측 입력. */
  private lastPromptTokens = 0;
  /**
   * 이번 턴에서 요약 콜이 이미 실패했는가. 실패하면 대화가 그대로 커다란 채로 다음 라운드로
   * 가므로, 가드가 없으면 라운드마다 같은 요약 콜을 다시 때린다(한 턴에 수십 번). 턴당 1회로
   * 제한하고 다음 사용자 턴에서 다시 시도한다 — 일시 장애는 그때 자연히 회복된다.
   * 성공한 압축은 이 예산을 쓰지 않는다(senpi per-turn-cap.js: 성공은 admission budget 을
   * 소모하지 않고, 반복 실패만 회로 차단기가 막는다 — circuit-breaker.js).
   */
  /**
   * 이 턴에 압축을 이미 시도했는가(성공·실패 모두). 한 턴은 여러 라운드를 돌고 판정은 매 라운드
   * 도는데, 요약은 LLM 콜이라 라운드마다 다시 부르면 그만큼 돈과 시간이 나간다.
   *
   * 옛 이름은 `compactionFailedThisTurn` 으로 **실패만** 막았다. 성공 쪽이 새지 않았던 것은
   * 문턱이 모델 창(gemini 1,032,192토큰)에 붙어 있어서 두 번째 판정 때 잘라낼 앞부분이 남지
   * 않았기 때문(`firstKeptIndex <= 1` 조기 반환)이고, 문턱이 작업 창으로 내려오자 같은 턴에
   * 요약이 반복해 돌았다(실측: test/assistantSessionCompaction 요약 콜 1회 → 7회).
   */
  private compactionAttemptedThisTurn = false;
  /**
   * 직전 압축을 되돌리기 위한 압축 **전** 메시지 사본과 그때의 계량.
   *
   * 압축은 앞부분 원문을 요약 1건으로 바꿔치우는 비가역 연산이다 — 요약이 중요한 사실을
   * 빠뜨렸다는 것은 대개 다음 턴이 헛짓을 한 뒤에야 드러나고, 그때는 원문이 이미 없다.
   * 한 단계짜리 사본을 들고 있는 값이 그 손실보다 싸다(사본은 다음 압축 때 교체된다).
   */
  private lastCompaction: {
    readonly messagesBefore: readonly ChatMessage[];
    readonly summary: string;
    readonly beforeTokens: number;
    readonly afterTokens: number;
  } | null = null;
  /** 세션이 태운 LLM 호출/토큰 집계(sessionUsage). 모든 chat 호출이 this.chat 한 곳을 지난다. */
  private usageTotals: SessionUsageTotals = EMPTY_SESSION_USAGE;
  /** 어려운 요청용 다층 To-do — 턴을 넘나들며 유지. */
  private workPlan: WorkPlan | null = null;
  /** 이번 사용자 메시지 안에서 자동으로 진행한 추가 단계 수. */
  private workPlanAutoStepsThisUserMessage = 0;
  /**
   * 항목 id → 이 런에서 그 항목에 Ralph 를 재주입한 횟수. 사용자의 새 메시지가 리셋한다.
   * MAX_RALPH_ATTEMPTS_PER_ITEM 에 닿으면 항목을 blocked 로 표시하고 턴을 끝낸다(무한 재주입 차단).
   */
  private ralphAttemptsByItemId = new Map<string, number>();
  /** 항목 id → 마지막으로 자동 완료를 막은 사유(산출물 게이트·완성도 경고). 교착 안내 문구의 근거. */
  private lastBlockReasonByItemId = new Map<string, string>();
  /**
   * 항목 id → `${툴 이름}::${실패 요약}` 이 연속으로 몇 번 같았는가.
   *
   * Ralph 교착 판정은 「모델이 나가려 한다」를 신호로 쓰는데, 같은 쓰기 툴을 **같은 이유로 계속 실패**하는
   * 모델은 나가려 하지 않으므로 그 신호가 오지 않는다(2026-09-03 e2e 실측: 스펙 게이트에 막힌 fill_region
   * 을 대본이 주는 대로 30번 반복했고 Ralph 는 한 번도 안 돌았다). 같은 실패가 이 상한에 닿으면 항목을
   * blocked 로 돌려 같은 출구로 나간다.
   */
  private repeatedToolFailures = new Map<string, { readonly key: string; count: number }>();
  /** 이 턴은 자율 드라이버의 합성 「계속」인가(SessionTurnOptions.driverContinue). */
  private turnIsDriverContinue = false;
  /** 플래너 LLM 왕복만 건너뛴다 — 계획 툴·오케스트레이션 주입은 그대로 둔다(skipPlannerThisTurn 과 다르다). */
  private skipPlannerRoundOnly = false;
  /** 현재 WorkItem에서 이번 사용자 메시지 동안 성공한 모든 툴 이름(읽기 포함). */
  private turnSuccessfulTools = new Set<string>();
  private successfulToolsWorkItemId: string | null = null;
  /** 현재 WorkItem 이 새로 만든 맵 id — 산출물 게이트가 "만들고 안 채운 맵"을 잡는 근거. */
  private turnItemCreatedMapIds = new Set<string>();
  /** 현재 WorkItem 이 전투 이벤트 페이지를 쓴 트룹 id — 페이즈 발동 검증 대상. */
  private turnItemAuthoredTroopIds = new Set<string>();
  /** 현재 WorkItem 에서 돌린 simulate_battle 의 페이즈 발동 근거(troopId → 결과). */
  private turnItemBattleSimulations = new Map<string, BattlePhaseSimulation>();
  /** 현재 WorkItem 이 등록한 퀘스트 id — 완주 검증 대상. */
  private turnItemQuestIds = new Set<string>();
  /** 현재 WorkItem 이 place_npc/make_villager 로 만든 이벤트 id — 상태별 페이지 게이트. */
  private turnItemPlacedNpcIds = new Set<string>();
  /**
   * 볼륨 계약은 **사용자 목표 런** 단위다. 자율 드라이버의 「계속」 턴이 시작 스냅샷을
   * 다시 찍으면 직전 턴에서 채운 맵이 기준이 되어 같은 막대를 또 요구한다.
   */
  private runVolumeBaseline: VolumeSnapshot | null = null;
  private runVolumeBar: VolumeBar | null = null;
  /** 이번 사용자 턴 안에서 볼륨 미달로 재주입한 횟수(턴마다 0으로 리셋). */
  private volumeContinueUsed = 0;
  /**
   * 같은 항목이 매 라운드 같은 차단 사유를 다시 찍지 않도록 하는 중복 방지 키(`항목id::사유`).
   * 사유까지 키에 넣는다 — 산출물 미완성 → 완성도 경고처럼 차단 이유가 바뀌면 다시 알려야
   * 모델도 사용자도 무엇이 남았는지 안다(항목 id 만으로 묶으면 두 번째 사유가 조용히 사라진다).
   */
  private lastOutcomeBlockedKey: string | null = null;
  /** 직전 사용자 턴의 상황 — 맵 이동 경계 판정용. */
  private lastTurnContext: ConversationTurnContext | null = null;
  private readonly getTurnSelection?: () => TurnSelectionSnapshot | null | undefined;
  private readonly declareIntent: IntentDeclarer | null;

  constructor(project: Project, options: AssistantSessionOptions = {}) {
    this.config = options.config ?? loadAiConfig();
    // 계량은 로그 파싱이 아니라 호출 지점에서 센다(sessionUsage.ts). 본문·플래너·검수·요약 콜이
    // 모두 이 한 겹을 지나므로, 여기서 세면 어떤 경로도 빠지지 않는다.
    const rawChat = options.chat ?? chatCompletion;
    this.chat = async (config, req) => {
      const result = await rawChat(config, req);
      this.usageTotals = addSessionUsage(this.usageTotals, config.model, result.usage);
      return result;
    };
    this.peekPendingUserMessage = options.peekPendingUserMessage;
    this.contextOptions = options.contextOptions ?? {};
    this.renderImages = options.renderImages;
    this.yieldToUi = options.yieldToUi ?? defaultYieldToUi;
    this.getTurnSelection = options.getTurnSelection;
    this.declareIntent = options.declareIntent ?? null;
    this.baselineProject = structuredClone(project);
    this.ctx = { project: cloneDetachedDraft(project) };
    // 토큰 보정: 명시 budgetChars가 없으면 실측 usage 관측(localStorage — 없으면 빈 목록)으로
    // 문자 예산을 재척도한다. 관측이 없으면 DEFAULT_BUDGET_CHARS 그대로(현행 동작).
    this.appliedBudgetChars = this.contextOptions.budgetChars
      ?? calibratedBudgetChars(DEFAULT_BUDGET_CHARS, loadTokenObservations());
    this.messages.push({
      role: "system",
      content: buildSystemPrompt(project, this.systemPromptOptions()),
    });
    // 복원/되감기로 만든 세션: 이전 대화를 시스템 프롬프트 바로 뒤에 한 덩어리로 꽂는다.
    const prior = options.priorTranscript?.trim();
    if (prior) {
      this.messages.push(restoredTranscriptMessage(prior));
      this.pushAudit({ kind: "status", text: `이전 대화 기록 주입: ${prior.length}자` });
    }
  }

  /**
   * 시스템 프롬프트 조립 옵션. 사람 성향 블록은 여기서 채운다 — contextBuilder 는 순수 함수라
   * localStorage 를 못 읽고, 조립 시점마다 다시 읽어야 세션 도중 갱신된 성향이 반영된다.
   */
  private systemPromptOptions(): ContextOptions {
    return {
      ...this.contextOptions,
      budgetChars: this.appliedBudgetChars,
      preferenceMemorySection: buildPreferenceMemorySection(this.contextOptions.projectScopeKey),
    };
  }

  getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  /** 세션이 태운 LLM 호출/토큰 집계. */
  getUsageTotals(): SessionUsageTotals {
    return this.usageTotals;
  }

  /**
   * 지금 대화가 모델 창의 어디쯤인가 — 자동 압축 임계와 **같은 입력**으로 계산한다.
   * 게이지가 다른 식으로 세면 표시와 실제 압축 시점이 어긋난다. 그래서 창도 압축 판정과
   * 같은 작업 창(resolveWorkingContextTokens)을 넘긴다 — 모델 창(gemini 1M)을 쓰면
   * 게이지가 "맥락 3%" 인데 압축이 도는 모순이 보인다.
   */
  getContextUsage(): ContextUsage {
    return describeContextUsage({
      messages: this.messages,
      model: this.config.model,
      usageTokens: this.lastPromptTokens,
      contextWindow: resolveWorkingContextTokens(this.config),
    });
  }

  /** 대화에 살아 있는 최신 압축 요약(없으면 null). UI 가 "무엇이 잊혔는지" 를 보여주는 원문. */
  getLatestCompactionSummary(): string | null {
    return findPreviousSummary(this.messages);
  }

  /** 직전 압축을 되돌릴 수 있는가(한 단계). */
  canUndoCompaction(): boolean {
    return this.lastCompaction !== null;
  }

  /**
   * 직전 압축을 되돌린다 — 요약으로 갈아치우기 **전** 메시지 배열로 복귀한다.
   * 되돌릴 압축이 없으면 false.
   */
  undoLastCompaction(): boolean {
    const snapshot = this.lastCompaction;
    if (!snapshot) return false;
    this.lastCompaction = null;
    // messages 는 세션이 계속 참조하는 배열이다 — 재할당 대신 제자리 교체로 동일성을 유지한다.
    this.messages.splice(0, this.messages.length, ...snapshot.messagesBefore);
    this.pushAudit({
      kind: "status",
      text: `압축 되돌림: ${snapshot.afterTokens} -> ${snapshot.beforeTokens} 토큰 (요약 1건 폐기)`,
    });
    return true;
  }

  /**
   * 사용자가 지금 누른 수동 압축. 임계와 무관하게 돌고, 이번 턴의 요약 실패 회로차단기
   * (compactionAttemptedThisTurn)도 무시한다 — 사람이 명시로 요청한 것이므로 한 번은 시도한다.
   */
  async compactNow(onEvent?: (event: SessionEvent) => void, signal?: AbortSignal): Promise<CompactionOutcome> {
    return this.runCompaction(onEvent ?? (() => undefined), signal, true);
  }

  /**
   * 감독 지침이 바뀌었을 때처럼 프로젝트 쪽 컨텍스트만 갈아끼운다. 대화(messages 꼬리·감사
   * 로그)는 건드리지 않고 시스템 프롬프트만 최신 프로젝트로 재조립한다.
   */
  refreshProjectContext(project: Project): void {
    this.baselineProject = structuredClone(project);
    this.rebuildSystemPrompt();
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
    return cloneDetachedDraft(this.ctx.project);
  }

  // 제안 수락/거부 후, 대화(메시지·감사 로그)를 유지한 채 프로젝트 기준만 store 최신 상태로 갱신한다.
  // 세션 폐기(dropSession)와 달리 대화 기억을 잃지 않는다 — "채팅 세션 단위 전체 기억"(#6)의 핵심.
  rebaseProject(project: Project): void {
    this.baselineProject = structuredClone(project);
    this.ctx = { project: cloneDetachedDraft(project) };
    // rebase = 적용 성공 후 세션이 store와 재동기화됐다는 신호다. 현재 턴의 적용 실패 상태를 버린다.
    this.milestoneApplyFailed = false;
    // 기준이 바뀌면 이전 제안은 전부 적용됐거나 버려진 것이다. 제자리 clear — runTurnLoop 가 잡아 둔
    // 참조(proposedByKey)를 보존한다(마일스톤 경로와 같은 이유).
    this.turnProposals.clear();
  }

  /**
   * 새 사용자 턴 직전, 승인 대기 제안이 없으면 세션 기준을 편집기 저장소 최신으로 맞춘다.
   *
   * 세션 draft 는 마지막 적용/수락 시점의 사본이다. 사용자가 두 턴 사이에 데이터베이스를 고치면
   * (2026-09-02 실측: 「임시 → 개념 꾸러미」에서 여관→주막으로 개명한 뒤 「주막을 새 맵으로 지어줘」)
   * 세션은 그 변경을 모른 채 옛 나무로 시스템 프롬프트를 짜고 `place_concept("주막")` 이
   * 「찾지 못했다」로 실패했다. 제안이 남아 있으면(아직 수락·거부되지 않은 쓰기) 그 쓰기를 잃으므로
   * 건드리지 않는다. 호출자(패널)가 저장소 프로젝트를 넘긴다 — 세션은 전역 저장소를 직접 읽지 않는다.
   */
  syncBaselineFromStoreIfClean(project: Project): boolean {
    if (this.turnProposals.size > 0) return false;
    this.rebaseProject(project);
    // 시스템 프롬프트(개념 꾸러미 절·맵 요약·구조물 목록)도 새 기준으로 — 안 그러면 모델은 옛 나무를 읽는다.
    this.rebuildSystemPrompt();
    return true;
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
      const fingerprint = specFingerprint(spec);
      const repeated = fingerprint === this.lastRejectedSpecFingerprint;
      this.lastRejectedSpecFingerprint = fingerprint;
      this.specRejections += 1;
      const discarded = this.specRejections >= MAX_SPEC_REJECTIONS;
      const issues = errors.map((issue) => ({ severity: "error" as const, code: "spec-invalid", message: issue.message }));
      // 검증기가 이름을 부른 필드를 그대로 되돌려준다 — 산문 지시만으로는 모델이 좌표만 흔든다.
      const demanded = SPEC_REMEDY_FIELDS.filter((field) => errors.some((issue) => issue.message.includes(field)));
      const fieldList = demanded.join("·");
      if (repeated) {
        issues.push({
          severity: "error",
          code: "spec-invalid",
          message:
            "직전과 내용이 같은 명세입니다(키 순서만 다른 것은 같은 것으로 봅니다). 같은 것을 다시 내면 같은 이유로 거부됩니다."
            + (demanded.length > 0 ? ` 이번에는 지적된 에셋에 ${fieldList} 필드를 실제로 넣어 제출하세요.` : ""),
        });
      }
      issues.push({
        severity: "error",
        code: "spec-invalid",
        message: discarded
          ? `검증 ${this.specRejections}회 실패 — 이 계획은 폐기하세요. 맵 크기·좌표·buildOrder를 스스로 보정한 새 명세를 제출하세요.`
          : demanded.length > 0
            ? `지적된 에셋에 ${fieldList} 필드를 넣어 set_build_spec을 재제출하세요 — 좌표만 바꾸면 같은 이유로 또 거부됩니다.`
            : "겹치지 않게 좌표를 고치고 필요한 경우 overExisting을 스스로 판단해 set_build_spec을 재제출하세요.",
      });
      return {
        ok: false,
        summary: `밑그림 검증 실패(${this.specRejections}회)${repeated ? " — 직전과 동일" : ""}${discarded ? " — 계획 폐기" : ""}`,
        issues,
      };
    }
    // 검증기는 "22" 같은 숫자 문자열을 받아주지만 게이트는 저장된 값을 그대로 더한다 — 경계에서 정수로 굳혀 저장한다.
    const normalized = normalizeBuildSpec(spec);
    this.activeSpec = normalized;
    this.activeSpecTurnIndex = this.currentTurnIndex;
    // carryoverSpecForTurn은 previous-turn 스펙을 다음 턴으로 넘기는 슬롯이라
    // 현재 턴에서 새로 확정된 스펙이 이전 계획을 덮으면 다음 턴 carryover가 끊긴다.
    // previous-turn carryover는 다음 sendUserMessage 초입에서 세팅되므로 여기서 null로 비우지 않는다.
    this.specRejections = 0;
    this.lastRejectedSpecFingerprint = null;
    const kinds = [...new Set(normalized.assets.map((asset) => asset.kind))].join("·");
    return {
      ok: true,
      summary: `밑그림 확정: ${normalized.title ?? normalized.mapId} — 에셋 ${normalized.assets.length}개(${kinds})`,
      data: normalized,
    };
  }

  // 공간 쓰기 툴 게이트. 통과하면 warning 목록, 차단이면 사유가 담긴 ToolResult.
  //
  // 두 가지 다른 계약이 겹쳐 있다:
  //  1. 스코프(밑그림 필수·자동 확장) — SPATIAL_BUILD_TOOLS 만. 명세 밖 빈 영역은 자동 확장 warning 으로 통과.
  //  2. 기존 내용 보호 — 타일을 쓰는 모든 툴(SPATIAL 의 타일 쓰기 + TILE_WRITE_TOOLS 의 v3 프리미티브).
  //     기준선(사용자 맵)에 이미 있던 지어진 칸은 밑그림 **안이라도** 에셋 선언(clear+confirmDestroy,
  //     overExisting) 없이는 덮지 않는다. 이 세션이 초안에 그린 것은 기준선에 없으므로 다시 손댈 수 있다.
  //     2026-09-03 적대적 리뷰: 보호가 제출 시점에만 돌아 밑그림 안에 지은 집을 같은 턴 clear 가 지웠고,
  //     확정 뒤 사용자가 판 호수를 다음 턴 채우기가 덮었고, 게이트 밖 tile_erase 가 절벽을 지웠다.
  private specGate(name: string, args: Record<string, unknown>): ToolResult | SpecGatePass {
    if (
      name === "place_npc"
      && typeof args.mapId === "string"
      && typeof args.id === "string"
      && typeof args.x === "number"
      && typeof args.y === "number"
    ) {
      const existing = this.ctx.project.maps[args.mapId]?.events.find((event) => event.id === args.id);
      if (existing?.x === args.x && existing.y === args.y) return { warnings: [] };
    }
    const scoped = SPATIAL_BUILD_TOOLS.has(name);
    const regions = this.gateRegions(name, args);
    if (regions.length === 0) return { warnings: [] }; // mapId 없는 인자 형태 — 현 공간 툴셋엔 없음.
    const mapId = regions[0].mapId;
    const specs = [this.activeSpec, this.turnImplicitSpec]
      .filter((spec): spec is BuildSpec => spec !== null && spec.mapId === mapId);
    if (scoped && specs.length === 0) {
      return specGateResult(`스펙 게이트: '${name}' 차단 — 이 맵의 밑그림(스펙)이 없습니다`, [
        "공간 빌드는 set_build_spec으로 밑그림을 제출해 검증을 통과한 뒤에만 실행됩니다.",
        "체크리스트: 대상 맵, 에셋별 영역(x,y,w,h)·종류·스타일, 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle).",
        "현재 컨텍스트 선택 영역이 있으면 암묵적 명세로 인정됩니다. 없으면 필요한 영역을 직접 산정해 set_build_spec으로 제출하세요.",
      ]);
    }
    if (scoped && this.activeSpec?.mapId === mapId) {
      const mismatch = plannedTargetMismatch(this.activeSpec, args);
      if (mismatch) {
        return specGateResult(`스펙 게이트: '${name}' 차단 — plannedMap 불일치`, [
          mismatch,
          "set_build_spec의 plannedMap과 새 맵 target의 mapId·width·height를 같은 값으로 맞춘 뒤 다시 호출하세요.",
        ]);
      }
    }
    // 명시 스펙 + 암묵 선택 영역(같은 맵)의 합집합으로 커버리지·허가를 판정한다.
    const assets = specs.flatMap((spec) => spec.assets);

    // 기존 내용 보호 — 기준선 맵 기준. 밑그림 안팎을 가리지 않고, 새 맵(기준선에 없음)은 대상이 아니다.
    if (toolWritesTiles(name)) {
      const baseline = this.baselineProject.maps[mapId];
      if (baseline) {
        const tileset = this.baselineProject.tilesets[baseline.tilesetId];
        const guarded = protectedCellsInRegions(baseline, regions, assets, tileset);
        if (guarded.count > 0) {
          const at = guarded.sample ? `, 예: (${guarded.sample.x},${guarded.sample.y})` : "";
          return specGateResult(`스펙 게이트: '${name}' 차단 — 기존 구조물·지형 ${guarded.count}칸을 덮습니다${at}`, [
            "명세 밖 빈 영역은 자동 확장하지만, 기존 구조물 파괴 위험은 자동 보정하지 않습니다.",
            "사용자 맵에 이미 있는 구조물·물·절벽은 밑그림 안이라도 선언 없이 덮지 않습니다(이 세션이 방금 그린 것은 예외).",
            "철거가 의도면 그 영역을 덮는 clear 에셋에 confirmDestroy:true 를, 그 위에 지을 거면 배치 에셋에 overExisting:\"clear\"|\"keep\" 을 넣은 set_build_spec 을 제출한 뒤 다시 호출하세요.",
            "기존 것을 피하려면 영역을 좁히세요.",
          ]);
        }
      }
    }
    if (!scoped) return { warnings: [] };

    const slackCells = boundarySlackForTool(name);
    const coverage = checkRegionsAgainstSpecBoundary(assets, regions, slackCells);
    if (coverage.covered) return { warnings: [] };

    const uncovered = uncoveredRegionsBySpec(assets, regions);
    const warnings = this.expandSpecWithRegions(mapId, name, regions, uncovered);
    if (warnings.length > 0) return { warnings };
    if (slackCells > 0 && coverage.slackWarning) {
      return { warnings: [{ severity: "warning", code: "spec-gate-auto-expand", message: `명세를 자동 확장했습니다: ${coverage.slackWarning}` }] };
    }
    return { warnings: [] };
  }

  /** 게이트가 볼 영향 영역. 홍수 채우기(paint_tiles mode=fill)는 시작점이 아니라 맵 전체다 — 면적 0 폴백은 검사를 건너뛴다. */
  private gateRegions(name: string, args: Record<string, unknown>): AffectedRegion[] {
    if (name === "paint_tiles" && args.mode === "fill" && typeof args.mapId === "string") {
      const map = this.ctx.project.maps[args.mapId];
      if (map) return [{ mapId: args.mapId, x: 0, y: 0, w: map.width, h: map.height }];
    }
    return affectedRegions(name, args);
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

    const expanded = { ...target, assets: [...target.assets, ...additions] };
    if (target === this.activeSpec) {
      this.activeSpec = expanded;
      this.activeSpecTurnIndex = this.currentTurnIndex;
    } else {
      // 선택 영역 암묵 스펙은 이 턴의 것이다 — activeSpec 으로 승격하면 다음 턴부터 그 맵의 게이트가
      // 밑그림 없이 열린다(2026-09-03 적대적 리뷰 P3). 확장도 그 턴 안에서만 유효하다.
      this.turnImplicitSpec = expanded;
    }
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

  async sendUserMessage(
    text: string,
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal,
    opts?: SessionTurnOptions,
  ): Promise<TurnResult> {
    // 자율 드라이버: opts.autonomous === true 일 때만 진입한다(명시 플래그 — 플래그 없는 기존
    // 호출처(영역 작업·클러스터 모달·평가 러너)는 종전대로 턴 1개로 끝난다). 패널·MCP 브리지는
    // 패널의 sendText 가 autonomous:true 를 주므로 같은 진입점을 공유하고, 브리지 코드는 불변이다.
    // 사용자의 수동 진입(새 sendUserMessage 호출)은 예산 카운터를 0으로 되돌린다(re-arm).
    // 마일스톤 자동 적용도 같은 명시 플래그로만 켠다. 직전 턴의 커밋 게이트 실패는
    // 현재 자율 런만 중단하는 상태이므로 새 사용자 메시지에서 반드시 재가동한다.
    this.milestoneAutoApply = opts?.autonomous === true;
    if (this.milestoneApplyFailed) {
      // 실패한 proposed draft를 다음 턴으로 가져가면 같은 커밋 오류가 반복된다. 저장소는 실패
      // 당시 바뀌지 않았으므로 canonical store에서 세션 draft를 다시 시작한다.
      this.rebaseProject(store.getCurrent());
    } else {
      this.milestoneApplyFailed = false;
    }
    const startedAt = Date.now();
    const usageBefore = this.usageTotals;
    const auditFrom = this.audit.length;
    const turnOptions: SessionTurnOptions = {
      ...(opts?.instruction !== undefined ? { instruction: opts.instruction } : {}),
      scope: opts?.scope ?? null,
      composerMode: opts?.composerMode ?? "do",
    };
    if (opts?.autonomous !== true) {
      const result = await this.executeUserTurn(text, onEvent, signal, turnOptions);
      return this.finishRunRecap(result, startedAt, usageBefore, auditFrom, onEvent);
    }
    const first = await this.executeUserTurn(text, onEvent, signal, turnOptions);
    // 계획 모드의 계획만 세운 턴은 사용자 확인을 기다린다 — 드라이버가 「계속」을 대신 보내버리면 멈춘 의미가 없다.
    if (this.lastTurnPlanOnly) return this.finishRunRecap(first, startedAt, usageBefore, auditFrom, onEvent);
    const last = await this.runAutonomousDriver(first, onEvent, signal);
    return this.finishRunRecap(last, startedAt, usageBefore, auditFrom, onEvent);
  }

  /**
   * 자율 실행 드라이버 — 턴이 끝난 뒤 조건이 유지되는 동안 하니스가 스스로 다음 턴을 송신한다.
   * 사용자의 수동 진입(다음 sendUserMessage 호출)은 예산 카운터를 0으로 되돌린다(re-arm).
   */
  private async runAutonomousDriver(
    first: TurnResult,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal
  ): Promise<TurnResult> {
    this.autoRunSteps = 0;
    let last = first;
    while (this.shouldAutoContinue(last, onEvent, signal)) {
      this.autoRunSteps += 1;
      this.pushAudit({ kind: "status", text: `agent_run:auto-continue step=${this.autoRunSteps}/${AGENT_RUN_MAX_TOTAL_STEPS}` });
      onEvent({
        type: "status",
        text: `자율 실행 계속 (${this.autoRunSteps}/${AGENT_RUN_MAX_TOTAL_STEPS})`,
      });
      const next = await this.executeUserTurn("계속", onEvent, signal, { driverContinue: true });
      if (next.stoppedReason === "aborted" || next.stoppedReason === "error") return next;
      last = next;
    }
    // run-end 저장 증명(todo 5): 플랜 완료 + remote persistence 활성이면 flush → reload →
    // agent_run_saved 감사(projectId + sha256 + 최신 커밋 row).
    await this.maybeRunEndProof(onEvent);
    return last;
  }

  /** 드라이버 계속 판정 — 계획 미완료 && 예산 잔여 && 사용자 대기 없음 && 중단 아님. */
  private shouldAutoContinue(last: TurnResult, onEvent: (event: SessionEvent) => void, signal?: AbortSignal): boolean {
    if (signal?.aborted) return false;
    if (last.stoppedReason === "aborted" || last.stoppedReason === "error") return false;
    // 저장소를 바꾸지 못한 마일스톤이 있으면 현재 자율 런을 멈춘다. 승인 UI는 없으며,
    // 다음 사용자 메시지가 새 턴을 시작하면 다시 적용을 시도할 수 있다.
    if (this.milestoneApplyFailed) {
      this.pushAudit({ kind: "status", text: "agent_run:stopped-apply-failed — 마일스톤 적용 실패로 현재 자율 실행을 멈춥니다 (프로젝트 저장소 변경 없음)" });
      return false;
    }
    const volumeOpen = this.volumeUnmetNow();
    if ((!this.workPlan || isWorkPlanComplete(this.workPlan)) && !volumeOpen) return false;
    if (this.autoRunSteps >= AGENT_RUN_MAX_TOTAL_STEPS) {
      this.pushAudit({
        kind: "status",
        text: `agent_run_budget_exhausted steps=${this.autoRunSteps}/${AGENT_RUN_MAX_TOTAL_STEPS} — 이어서 진행하려면 「계속」 이라고 보내세요`,
      });
      onEvent({ type: "status", text: "자율 실행 예산 소진 — 「계속」이라고 보내면 이어서 진행합니다." });
      return false;
    }
    // 사용자 우선: 패널의 pendingSends 큐에 대기 메시지가 있으면 드라이버는 양보한다.
    // dequeue 하지 않는다(peek-only) — 패널의 기존 드레인 루프가 전달하고, 계획이 여전히
    // 미완료면 다음 사용자 턴 종료 후 런이 다시 자동 계속된다.
    const pending = this.peekPendingUserMessage?.() ?? null;
    if (typeof pending === "string" && pending.trim().length > 0) {
      this.pushAudit({ kind: "status", text: "agent_run:paused-user-message — 대기 중 사용자 메시지가 자동 계속보다 우선합니다" });
      return false;
    }
    // Ralph 지속 판정을 그대로 재사용(두 번째 휴리스틱을 만들지 않는다). autoStepsUsed=0 은
    // 다음 턴을 시작해도 되는가(턴 시작 시점)의 판정이고, assistantText 는 직전 턴이 사용자
    // 질문으로 끝났는지 판별한다 — 질문이면 false(문의 대기, 자동 송신 금지).
    const assistantText = this.rawLastTurnAssistantText(last);
    if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
      return shouldRalphContinue(this.workPlan, { autoStepsUsed: 0, assistantText });
    }
    // 계획이 끝났거나 없어도 볼륨 막대가 비면 코드가 다음 턴을 연다. 사용자 「계속」이 아니다.
    if (volumeOpen && assistantTextLooksLikeQuestion(assistantText)) return false;
    return volumeOpen;
  }

  /** 드라이버의 질문 판별용 원문 — 계획 게시판 접미어(행 끝 정규식 오염)를 제거한 최종 응답. */
  private rawLastTurnAssistantText(last: TurnResult): string {
    return last.assistantText.split("\n\n---\n")[0]!.trim();
  }

  // 한 턴 실행: 사용자 메시지 → (LLM ↔ 툴) 루프 → 최종 응답 + 제안 changeset.
  private async executeUserTurn(
    text: string,
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal,
    options: SessionTurnOptions = {},
  ): Promise<TurnResult> {
    // 토큰 보정: 직전 턴들의 usage 관측으로 문자 예산이 달라졌으면 시스템 프롬프트를 재조립한다.
    this.refreshSystemPromptBudget();
    // 매 턴: 에디터 뷰포트 좌표(+가능하면 맵 이미지)를 사용자 메시지에 붙여 "여기" 해석을 빠르게 한다.
    const turnContext = this.captureTurnContext();
    const transition = mapTransitionNote(this.lastTurnContext, turnContext);
    this.lastTurnContext = turnContext;
    // 맵 이동은 대화를 끝내지 않는다. 대신 시스템 프롬프트를 새 맵으로 다시 조립하고
    // 전사에 경계를 남긴다 — 그러지 않으면 매 턴 새로 부는 뷰포트 바록만 새 맵을 가리키고
    // 시스템 프롬프트(타일 어휘·구조 키트·맵 요약)는 세션이 시작된 맵에 머별러 둘이 어긋난다.
    if (transition) {
      this.rebuildSystemPrompt();
      this.pushAudit({ kind: "status", text: transition });
      onEvent({ type: "status", text: transition });
    }
    const userContent = await this.buildUserTurnContent(text);
    this.messages.push({ role: "user", content: userContent });
    this.pushAudit({ kind: "user", text, context: turnContext });
    // 사용자 발화만 따로 든다. `[컨텍스트]` footer 는 코드가 아는 사실이라 모델에는 그대로 가지만,
    // 의도 선언·툴 이름 언급·능력 승격의 입력은 사용자 말이어야 한다 — 기계 텍스트가 이 자리에
    // 섞여 들어 라우팅이 어긋났던 것이 2026-09-03 감사의 근인이었다.
    const instruction = (options.instruction ?? stripContextFooter(text)).trim();
    this.currentTurnInstruction = instruction;
    this.currentTurnRequestText = text;
    this.turnScope = options.scope ?? null;
    this.turnComposerMode = options.composerMode ?? "do";
    this.planAuthoredThisTurn = false;
    this.lastTurnPlanOnly = false;
    this.turnIsDriverContinue = options.driverContinue === true;
    this.skipPlannerRoundOnly = false;
    // 사람이 다시 말을 걸었다 = 재시도 신호. 막힌 항목을 되살리고 항목별 Ralph 시도 수를 0으로 돌린다.
    // 드라이버의 합성 「계속」은 이 리셋을 받지 못한다 — 그래야 막힌 항목에서 런이 실제로 멈춘다.
    if (!this.turnIsDriverContinue) {
      this.ralphAttemptsByItemId.clear();
      this.lastBlockReasonByItemId.clear();
      this.repeatedToolFailures.clear();
      if (this.workPlan) {
        const revived = reactivateBlockedWorkItems(this.workPlan);
        if (revived > 0) {
          this.pushAudit({ kind: "status", text: `work-item:reactivated ${revived}건 — 사용자 메시지로 재시도` });
          this.emitWorkPlan(onEvent);
        }
      }
    }

    // 의도 선언: 모델이 한 번 읽어 구조화한다(수정/생성·실내/야외·시설·되묻기·계획·툴). 코드는 이 선언만
    // 소비한다. 선언자가 없거나 실패하면 중립 폴백 — 되묻지 않고, 툴은 UI 도메인·핀·이름 언급·승격만.
    // 질문 모드는 사용자가 직접 고른 사실이라 선언의 create/modify 를 덮어쓴다 — 안 그러면 플래너·쓰기 기대가 문장 판정으로 돈다.
    const intent = this.applyComposerModeToIntent(await this.declareTurnIntent(instruction, onEvent, signal));
    this.turnIntent = intent;
    beginAssistantToolDomainTurn(intent);
    this.currentTurnToolDomains = computeActiveToolDomains(intent);

    // 스펙 게이트 턴 초기화: 사용자 선택 영역([컨텍스트])은 이 턴의 암묵적 명세가 된다.
    this.currentTurnIndex += 1;
    this.turnImplicitSpec = implicitSpecFromContext(text)
      ?? implicitSpecFromScope(options.scope)
      ?? this.implicitSpecFromViewPhrase(instruction);
    this.carryoverSpecForTurn = this.activeSpec && this.activeSpecTurnIndex < this.currentTurnIndex
      ? structuredClone(this.activeSpec)
      : null;
    this.carryoverWarningAdded = false;
    this.specRejections = 0;
    this.lastRejectedSpecFingerprint = null;
    this.turnProposals = new Map();
    this.turnWriteDedupe = new Map();
    this.turnToolStartedCount = 0;
    this.turnEscalatedToolNames = [];
    this.compactionAttemptedThisTurn = false;
    this.turnSuccessfulTools = new Set();
    this.turnItemCreatedMapIds = new Set();
    this.turnItemAuthoredTroopIds = new Set();
    this.turnItemBattleSimulations = new Map();
    this.turnItemQuestIds = new Set();
    this.turnItemPlacedNpcIds = new Set();
    this.lastOutcomeBlockedKey = null;
    // 볼륨 막대는 플래너가 계획과 함께 선언한 것만 남는다. 이어가기(계속)는 유지, 새 요청은 풀어 준다.
    this.releaseVolumeContractForNewRequest(intent);
    this.volumeContinueUsed = 0;
    this.successfulToolsWorkItemId = this.workPlan?.currentItemId ?? null;
    this.eventBaseProposalKeys = new Map();
    this.skipPlannerThisTurn = false;

    // 되묻기: 선언이 질문을 냈을 때만, chat 모드에서만 멈춘다.
    // F-05: auto/orchestrated 모드에서는 멈추지 않고 진행한다 — 의도 노트가 「되묻지 말고 택하라」고 알린다.
    let clarifyBypassed = false;
    if (intent.clarify) {
      const shouldBypassClarify = this.config.agentMode === "auto" || this.orchestrationEnabled();
      if (shouldBypassClarify) {
        clarifyBypassed = true;
        this.pushAudit({ kind: "status", text: `의도 확인 건너뜀: ${intent.clarify} — auto/orchestrated` });
      } else {
        const assistantText = formatIntentClarifyMessage(intent);
        this.messages.push({ role: "assistant", content: assistantText });
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `의도 확인: ${intent.clarify}` });
        this.pushAudit({ kind: "assistant", text: assistantText });
        this.pushAudit({ kind: "status", text: "턴 종료(final) — 의도 확인 · 제안 0건" });
        return { assistantText, proposedCalls: [], stoppedReason: "final" };
      }
    }

    // 선언이 확정한 것은 본문 모델도 봐야 한다 — 안 그러면 모델이 같은 것을 되묻는다(2026-09-03 실측: 대장간).
    const intentNote = formatIntentNote(intent, { clarifyBypassed });
    if (intentNote) this.pushOrchestrationMessage(intentNote);
    // 선택 사각형은 사실이다 — 선언이 그 안에서 작업한다고 했으면 경계를, 새 맵/실내 시공이면 참고용임을 알린다.
    if (this.turnScope) this.pushOrchestrationMessage(formatScopeNote(this.turnScope, intent));

    // Orchestrator (main LLM): multi-step plan decision — harness does not regex-plan.
    this.workPlanAutoStepsThisUserMessage = 0;
    // 진행 중인 계획은 resume/replan 이 필요하므로 건너뛰지 않는다. 그 외에는 선언이 정한다 —
    // 질문·단일 단계는 플래너 왕복을 내지 않고, 선택 영역 작업은 정의상 한 스프린트다.
    const skipReason = this.plannerSkipReasonFor(intent);
    this.skipPlannerThisTurn = skipReason !== null;
    if (skipReason) {
      this.pushAudit({ kind: "status", text: `planner:skip ${skipReason}` });
    }
    // 드라이버의 합성 「계속」은 계획이 그대로면 결정이 자명하다(resume) — main 모델 왕복을 건너뛰고
    // planner:resume 이 하던 일(계획 재주입 + 목록 갱신)만 코드가 직접 한다. 계획 툴은 그대로 노출된다
    // (숨기면 모델이 complete_work_item 을 못 불러 교착이 오히려 늘어난다). 사용자가 직접 친 「계속」은
    // 이 경로가 아니므로 플래너가 정상적으로 replan 할 수 있다.
    if (
      !this.skipPlannerThisTurn
      && this.turnIsDriverContinue
      && this.workPlan
      && !isWorkPlanComplete(this.workPlan)
      && getCurrentWorkItem(this.workPlan)?.status !== "blocked"
    ) {
      this.skipPlannerRoundOnly = true;
      this.pushAudit({ kind: "status", text: "planner:skip driver-continue (resume 자명 — main 모델 왕복 생략)" });
      this.emitWorkPlan(onEvent);
      this.injectWorkPlanOrchestration();
    }
    if (
      (this.orchestrationEnabled() || this.workPlan || this.turnComposerMode === "plan")
      && !this.skipPlannerThisTurn
      && !this.skipPlannerRoundOnly
    ) {
      try {
        await this.runOrchestratorPlanner(text, onEvent, signal);
      } catch (cause) {
        // 플래너 라운드 중 사용자 중단 — 본문 루프의 중단 계약(stoppedReason "aborted")과
        // 동일하게 반환한다. agentMode=auto 로 플래너가 상시 돌면서 이 경로가 도달 가능해졌다.
        if (isLlmAbortError(cause) || signal?.aborted) {
          this.lastTurnFailed = false;
          this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
          return { assistantText: "", proposedCalls: [], stoppedReason: "aborted", error: "사용자가 중단했습니다" };
        }
        throw cause;
      }
    }

    if (this.turnComposerMode === "plan" && this.planAuthoredThisTurn && this.workPlan && !isWorkPlanComplete(this.workPlan)) {
      this.removeOrchestrationMessages();
      return this.finishPlanOnlyTurn(onEvent);
    }

    try {
      const result = await this.runTurnLoop(onEvent, signal);
      return this.withWorkPlanResult(result);
    } finally {
      this.removeOrchestrationMessages();
    }
  }

  /** 질문 모드는 선언을 「질문·단일 단계」로 고정한다. 다른 모드는 선언 그대로. */
  private applyComposerModeToIntent(intent: IntentDeclaration): IntentDeclaration {
    if (this.turnComposerMode !== "ask") return intent;
    if (intent.mode === "question" && !intent.needsPlan) return intent;
    this.pushAudit({ kind: "status", text: `composer:ask 선언 mode=${intent.mode}→question needsPlan=${intent.needsPlan}→false` });
    return { ...intent, mode: "question", needsPlan: false };
  }

  /** 계획 모드: 계획 카드를 내고 실행 없이 턴을 끝낸다. 「계속」이 다음 턴에서 resume 으로 실행한다. */
  private finishPlanOnlyTurn(onEvent: (event: SessionEvent) => void): TurnResult {
    const plan = this.workPlan;
    if (!plan) throw new Error("finishPlanOnlyTurn: 계획이 없다");
    const assistantText = "계획을 세워두었습니다. 이대로 실행하려면 「계속」이라고 보내고, 고칠 게 있으면 그대로 말해 주세요.";
    this.messages.push({ role: "assistant", content: assistantText });
    onEvent({ type: "assistant_message", content: assistantText });
    this.pushAudit({ kind: "assistant", text: assistantText });
    this.pushAudit({ kind: "status", text: "턴 종료(final) — composer:plan 계획만 수립 · 제안 0건" });
    this.lastTurnPlanOnly = true;
    return { assistantText, proposedCalls: [], stoppedReason: "final", workPlan: structuredClone(plan) };
  }

  /**
   * 이번 턴의 의도 선언. 빈 문장은 빈 선언, 진행 중 계획/볼륨을 이어가는 한 마디(계속·이어서)는 모델을
   * 부르지 않고 continuation, 선언자가 없으면 중립 폴백. 그 외에는 모델이 한 번 읽는다(짧은 캐시).
   */
  private async declareTurnIntent(
    instruction: string,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal,
  ): Promise<IntentDeclaration> {
    if (!instruction) return emptyIntentDeclaration();
    const hasActivePlan = Boolean(this.workPlan && !isWorkPlanComplete(this.workPlan));
    const scope = this.turnScope;
    const selection = scope
      ? { mapId: scope.mapId, x: scope.region.x, y: scope.region.y, width: scope.region.width, height: scope.region.height }
      : this.getTurnSelection?.() ?? null;
    const facts = buildIntentFacts({
      project: this.ctx.project,
      userText: instruction,
      currentMapId: resolveContextMapId(this.contextOptions) ?? null,
      selection,
      hasActivePlan,
    });
    if (isContinuationText(instruction) && (hasActivePlan || this.runVolumeBar)) {
      const intent = continuationIntentDeclaration(facts);
      this.pushAudit({ kind: "status", text: formatIntentAudit(intent, 0) });
      return intent;
    }
    if (!this.declareIntent) {
      const intent = fallbackIntentDeclaration(facts);
      this.pushAudit({ kind: "status", text: `${formatIntentAudit(intent, 0)} (선언자 없음)` });
      return intent;
    }
    onEvent({ type: "status", text: "요청을 읽는 중…" });
    const outcome = await declareIntentCached(this.declareIntent, facts, signal);
    this.pushAudit({
      kind: "status",
      text: `${formatIntentAudit(outcome.intent, outcome.elapsedMs)}${outcome.error ? ` — 폴백 사유: ${outcome.error}` : ""}`,
    });
    return outcome.intent;
  }

  /** 이 턴이 쓰기 툴을 돌려야 하는 요청인가 — 선언(생성/수정)이 정본, 선언이 없을 때만 문장 휴리스틱. */
  private turnExpectsChange(): boolean {
    const intent = this.turnIntent;
    if (intent && intent.source === "llm") return intent.mode === "create" || intent.mode === "modify";
    return requestLikelyExpectsChange(this.currentTurnInstruction);
  }

  /** 플래너 왕복을 건너뛸 이유. null 이면 플래너가 돈다(오케스트레이션이 켜져 있을 때). */
  private plannerSkipReasonFor(intent: IntentDeclaration): string | null {
    if (this.turnComposerMode === "ask") return "composer:ask";
    if (intent.source === "empty") return "empty";
    if (this.turnComposerMode === "plan") return null;
    if (this.workPlan) return null;
    if (this.turnScope) return "selection";
    if (intent.mode === "question") return "question";
    if (!intent.needsPlan) return "single-step";
    return null;
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
    // 맵 id 를 실어야 한다 — 이름만 있으면 열려 있지 않은 기존 맵을 지목할 방법이 없고,
    // 플래너 프롬프트는 "건설/수정 지시는 목표 맵을 반드시 명시"를 요구한다(진단 근본원인 14).
    const targetMapId = this.planTargetMapId(text) ?? this.contextOptions.currentMapId;
    const projectSummary = [
      `title=${this.ctx.project.meta?.title ?? ""}`,
      `maps=${maps.length}`,
      ...maps
        .slice(0, 12)
        .map((m) =>
          `- ${m.name} \`${m.id}\` ${m.width}x${m.height} events=${m.events?.length ?? 0}`
          + (m.id === targetMapId ? " ← 현재 열린 맵(기본 작업 대상)" : ""),
        ),
      ...(targetMapId ? [`## Target map\n${targetMapId}`] : []),
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
      } else if (text.trim().length >= 60 || this.turnComposerMode === "plan") {
        this.adoptFallbackWorkPlan(text, onEvent, "플래너 실패 — 최소 폴백 계획으로 진행");
      }
      return;
    }

    const parsed = parseOrchestratorDecision(raw);
    if (!parsed.decision) {
      // 실패 사유 + 원문을 함께 남긴다. 사유 없이 잘린 원문만 남기면 원인 규명이 불가능하다(2026-08-23 QA).
      this.pushAudit({ kind: "status", text: `planner:parse-fail ${parsed.error} raw=${raw.slice(0, 800)}` });
      if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
        this.injectWorkPlanOrchestration();
        this.emitWorkPlan(onEvent);
      } else if (text.trim().length >= 60 || this.turnComposerMode === "plan") {
        // 폴백 계획은 사용자 요청을 그대로 담지 못한다 — 조용히 진행하면 축소된 결과를 성공으로 보고하게 된다.
        this.adoptFallbackWorkPlan(text, onEvent, `플래너 응답을 해석하지 못해 폴백 계획으로 진행합니다 (${parsed.error})`);
      }
      return;
    }
    const decision = parsed.decision;

    if (decision.action === "direct") {
      // 플래너의 direct 는 존중한다. 예전에는 「마을」 정규식이 이 판정을 거부하고 코드가 3항목 계획을
      // 강제해 「이 마을에 상인 하나 추가해줘」가 마을 통째를 지었다(2026-09-03 실측 93초·맵 3장).
      this.pushAudit({ kind: "status", text: `planner:direct ${decision.reason ?? ""}` });
      // 계획 모드는 사용자가 계획 카드를 요구한 것이다 — 단일 단계라도 1항목 계획으로 보여 주고 멈춘다.
      if (this.turnComposerMode === "plan" && (!this.workPlan || isWorkPlanComplete(this.workPlan))) {
        this.adoptFallbackWorkPlan(text, onEvent, "플래너가 한 단계로 판단했습니다 — 1항목 계획으로 정리합니다.");
      }
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
    // 수정 요청이면 대상 맵 id 를 계획에 박아 매 스프린트 재주입한다 — footer 가 없는
    // 자율 계속 턴에도 대상이 남아야 한다(진단 근본원인 14).
    this.workPlan = workPlanFromOrchestratorDecision(decision, new Date(), this.planTargetMapId(text));
    this.planAuthoredThisTurn = true;
    // 볼륨 막대는 플래너가 계획과 함께 선언한 값만 쓴다 — 문장 정규식으로 막대를 씌우지 않는다.
    this.armVolumeContractFromPlanner(decision.volume ?? null);
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

  /** 플래너가 계획을 내지 못했을 때(오류·해석 실패·계획 모드의 direct) 코드가 최소 계획을 세운다. */
  private adoptFallbackWorkPlan(text: string, onEvent: (event: SessionEvent) => void, statusText: string): void {
    this.workPlan = buildDefaultWorkPlan(text, new Date(), { modifies: this.turnIntent?.mode === "modify" });
    this.planAuthoredThisTurn = true;
    this.emitWorkPlan(onEvent);
    this.injectWorkPlanOrchestration();
    onEvent({ type: "status", text: statusText });
  }

  /**
   * 이 계획이 손볼 기존 맵 id. 신규 생성 요청이면 undefined 를 돌려 대상 고정을 하지 않는다.
   * 우선순위: 요청문 footer 의 현재 맵 → 컨텍스트 옵션의 currentMapId.
   */
  private planTargetMapId(text: string): string | undefined {
    const intent = this.turnIntent;
    if (!intent || intent.mode !== "modify") return undefined;
    const candidate = intent.targetMapId ?? contextFooterMapId(text) ?? this.contextOptions?.currentMapId;
    return candidate && this.ctx.project.maps[candidate] ? candidate : undefined;
  }

  private emitWorkPlan(onEvent: (event: SessionEvent) => void): void {
    if (!this.workPlan) return;
    onEvent({ type: "work_plan", plan: structuredClone(this.workPlan) });
  }

  private injectWorkPlanOrchestration(): void {
    if (!this.workPlan || isWorkPlanComplete(this.workPlan)) return;
    this.pushOrchestrationMessage(formatWorkPlanForOrchestration(this.workPlan));
  }

  /**
   * Ralph 재주입 직전 교착 판정 — 같은 항목에서 상한(MAX_RALPH_ATTEMPTS_PER_ITEM)만큼 이어서 시도했는데도
   * 완료되지 않았으면 그 항목을 `blocked` 로 표시하고 재주입을 포기한다. 돌려주는 값이 있으면 턴을 끝내야 한다.
   *
   * 왜 필요한가(2026-09-03 실측): 빈 맵에서 `fill_region` 이 스펙 게이트에 막히자 Ralph 가 같은 항목을
   * **173번** 재주입했다. 모델이 나가려 하는데 하네스가 끝을 인정하지 않는 상태는 더 밀어붙여도 풀리지 않는다.
   */
  private blockStalledWorkItem(onEvent: (event: SessionEvent) => void): WorkItem | null {
    const plan = this.workPlan;
    const current = plan ? getCurrentWorkItem(plan) : null;
    if (!plan || !current) return null;
    // 연속 시도 수 — 이 항목에서 쓰기가 성공하면 recordSuccessfulTool 이 0으로 되돌린다.
    const used = this.ralphAttemptsByItemId.get(current.id) ?? 0;
    if (used < MAX_RALPH_ATTEMPTS_PER_ITEM) return null;
    // 기록된 차단 사유가 없으면(툴을 아예 안 불러 게이트가 돌지 않은 경우) 미충족 완료 조건을 직접 말한다 —
    // 「무엇을 고쳐야 하는가」가 사용자에게 전달되는 유일한 단서다.
    const pending = (current.successTools ?? []).filter((name) => !this.turnSuccessfulTools.has(name));
    const why =
      this.lastBlockReasonByItemId.get(current.id)
      ?? (pending.length > 0
        ? `완료 조건(successTools: ${pending.join(", ")})이 이번 시도에서 충족되지 않았습니다.`
        : "모델이 완료를 선언하지 않았고 하네스 완료 조건(산출물 검사)도 충족되지 않았습니다.");
    const blocked = blockWorkItemById(plan, current.id, why);
    if (!blocked) return null;
    this.pushAudit({
      kind: "status",
      text: `ralph:stalled item=${current.id} attempts=${used}/${MAX_RALPH_ATTEMPTS_PER_ITEM} — ${why}`,
    });
    onEvent({ type: "status", text: `막힘: ${blocked.title} — ${why}` });
    this.emitWorkPlan(onEvent);
    return blocked;
  }

  /**
   * 같은 쓰기 툴이 같은 이유로 연속 실패하는 것을 센다. 상한에 닿으면 현재 항목을 blocked 로 돌려
   * Ralph 교착과 같은 출구(사용자에게 넘김)로 보낸다. 성공한 쓰기 하나가 카운터를 지운다.
   */
  private noteRepeatedToolFailure(name: string, result: ToolResult): void {
    const currentItemId = this.workPlan?.currentItemId;
    if (!currentItemId || getTool(name)?.mode !== "write") return;
    const key = `${name}::${result.summary.slice(0, 120)}`;
    const entry = this.repeatedToolFailures.get(currentItemId);
    const next = entry && entry.key === key ? { key, count: entry.count + 1 } : { key, count: 1 };
    this.repeatedToolFailures.set(currentItemId, next);
    if (next.count >= MAX_REPEATED_TOOL_FAILURES_PER_ITEM) {
      this.lastBlockReasonByItemId.set(currentItemId, result.summary);
    }
  }

  /** 같은 실패가 상한만큼 반복됐는가 — 참이면 호출부가 항목을 막고 턴을 끝낸다. */
  private hasRepeatedToolFailureStall(): boolean {
    const currentItemId = this.workPlan?.currentItemId;
    if (!currentItemId) return false;
    return (this.repeatedToolFailures.get(currentItemId)?.count ?? 0) >= MAX_REPEATED_TOOL_FAILURES_PER_ITEM;
  }

  /** 막힌 항목으로 턴을 끝낼 때 사용자에게 보내는 문장 — 무엇이 막혔고 무엇을 하면 되는지. */
  private blockedTurnText(blocked: WorkItem, modelText = ""): string {
    return [
      modelText.trim(),
      `**${blocked.title}** 에서 막혔습니다 — ${blocked.note ?? ""}`.trim(),
      "무엇을 바꿔야 할지 알려 주시면 그 지점부터 다시 진행합니다. 이 단계를 빼려면 「건너뛰기」 라고 보내세요.",
    ]
      .filter((part) => part.length > 0)
      .join("\n\n");
  }

  /** Ralph: re-inject current item when generator tries to exit early. */
  private injectRalphContinue(onEvent: (event: SessionEvent) => void): void {
    if (!this.workPlan || isWorkPlanComplete(this.workPlan)) return;
    const currentItemId = this.workPlan.currentItemId;
    if (currentItemId) {
      this.ralphAttemptsByItemId.set(currentItemId, (this.ralphAttemptsByItemId.get(currentItemId) ?? 0) + 1);
    }
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

  /**
   * 새 요청은 이전 런의 볼륨 막대를 풀어 준다. 이어가기(계속/이어서 — continuation 선언)는 막대를 유지해
   * 미달 재주입이 다음 턴까지 이어진다. 막대를 새로 세우는 것은 플래너다(armVolumeContractFromPlanner).
   */
  private releaseVolumeContractForNewRequest(intent: IntentDeclaration): void {
    if (intent.source === "continuation" && this.runVolumeBar) return;
    this.runVolumeBaseline = null;
    this.runVolumeBar = null;
  }

  /** 플래너가 계획과 함께 선언한 최소 산출량. null 이면 이 런에는 볼륨 계약이 없다. */
  private armVolumeContractFromPlanner(bar: VolumeBar | null): void {
    if (!bar || (bar.authoredMaps <= 0 && bar.multiPageNpcs <= 0 && bar.shops <= 0 && bar.quests <= 0)) return;
    this.runVolumeBaseline = measureVolume(this.ctx.project);
    this.runVolumeBar = bar;
    this.pushAudit({
      kind: "status",
      text: `volume-contract:armed maps+${bar.authoredMaps} npcs+${bar.multiPageNpcs} shops+${bar.shops} quests+${bar.quests} (플래너 선언)`,
    });
  }

  private volumeGapsNow(): string[] {
    if (!this.runVolumeBar || !this.runVolumeBaseline) return [];
    return volumeGaps(this.runVolumeBaseline, measureVolume(this.getProposedProject()), this.runVolumeBar);
  }

  private volumeUnmetNow(): boolean {
    if (!this.runVolumeBar || !this.runVolumeBaseline) return false;
    return volumeUnmet(this.runVolumeBaseline, measureVolume(this.getProposedProject()), this.runVolumeBar);
  }

  /** 모델이 볼륨 미달인 채 퇴장하면 Ralph 다음으로 재주입한다. 사용자 「계속」이 아니다. */
  private injectVolumeContinue(onEvent: (event: SessionEvent) => void, finalText: string): boolean {
    if (this.milestoneApplyFailed) return false;
    if (assistantTextLooksLikeQuestion(finalText)) return false;
    if (this.volumeContinueUsed >= MAX_VOLUME_CONTINUES_PER_TURN) return false;
    const gaps = this.volumeGapsNow();
    if (gaps.length === 0) return false;
    this.volumeContinueUsed += 1;
    this.pushOrchestrationMessage(formatVolumeContinueMessage(gaps));
    this.pushAudit({
      kind: "status",
      text: `volume-contract:continue ${this.volumeContinueUsed}/${MAX_VOLUME_CONTINUES_PER_TURN} ${gaps.join(";")}`,
    });
    onEvent({
      type: "status",
      text: `볼륨 계약 미달 — 코드가 이어서 실행합니다 (${this.volumeContinueUsed}/${MAX_VOLUME_CONTINUES_PER_TURN})`,
    });
    return true;
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
      // 새 계획 — 항목 id 는 위치 기반("L1-1")이라 이전 계획과 겹칠 수 있다. 중복 완료 방지 추적을 초기화한다.
      this.lastMilestoneCompletionItemId = null;
      this.turnSuccessfulTools.clear();
      this.successfulToolsWorkItemId = plan.currentItemId;
      // 새 계획 = 새 검증 주기: 증명 상태만 리셋한다(툴콜 히스토리는 런 전체 누적 —
      // questId/시나리오 선택이 이전 레이어 저작물을 계속 본다).
      this.runEndProofPlanId = null;
      const progress = summarizeWorkPlan(plan);
      return {
        ok: true,
        summary: `WorkPlan 설정: ${progress.layersTotal}레이어 / ${progress.itemsTotal}항목. 현재: ${progress.current?.itemTitle ?? "(완료)"}`,
        data: { plan: structuredClone(plan), progress },
      };
    }
    // 조회는 계획이 없어도 실패가 아니다 — "없음"은 정확한 답이다. ok:false 로 돌려주면 정상 상태가
    // 실패 통계에 섞이고 모델이 교정할 것도 없는 실패를 재시도한다(2026-08-23 실측).
    if (name === "get_work_plan") {
      if (!this.workPlan) {
        return { ok: true, summary: "활성 WorkPlan 없음. 다단계 작업이면 set_work_plan으로 계획을 세우세요.", data: { plan: null } };
      }
      return {
        ok: true,
        summary: formatWorkPlanUserVisible(this.workPlan).slice(0, 500),
        data: { plan: structuredClone(this.workPlan), progress: summarizeWorkPlan(this.workPlan) },
      };
    }
    if (!this.workPlan) {
      return {
        ok: false,
        summary: "활성 WorkPlan이 없습니다. set_work_plan으로 계획을 세우거나 어려운 요청으로 플래너가 계획을 만들게 하세요.",
      };
    }
    if (name === "complete_work_item") {
      const id = typeof args.itemId === "string" && args.itemId.trim() ? args.itemId.trim() : this.workPlan.currentItemId;
      if (!id) return { ok: false, summary: "완료할 항목 id가 없습니다." };
      const note = typeof args.note === "string" ? args.note : undefined;
      this.syncSuccessfulToolsToCurrentWorkItem();
      const beforeStatus = this.workPlan.layers.flatMap((layer) => layer.items).find((item) => item.id === id)?.status;
      const result = completeWorkItemById(this.workPlan, id, note, {
        successfulTools: [...this.turnSuccessfulTools],
        outcomeGate: this.outcomeGate(),
        // 이름이 어긋난 successTools 로 교착되지 않게, 명시 완료는 「성공한 쓰기 + 산출물 게이트 통과」를 근거로 인정한다.
        allowWriteEvidenceFallback: true,
      });
      if (result.ok && !result.alreadyDone && beforeStatus !== "done") {
        const needed = result.item.successTools ?? [];
        const missing = needed.filter((name) => !this.turnSuccessfulTools.has(name));
        if (missing.length > 0) {
          this.pushAudit({
            kind: "status",
            text: `work-item:complete-by-write-evidence ${result.item.id} — successTools 미기록 ${missing.join(", ")}`,
          });
        }
      }
      if (!result.ok) {
        this.lastBlockReasonByItemId.set(id, result.reason);
        return {
          ok: false,
          summary: result.reason,
          issues: [{ severity: "error", code: "work-item-incomplete", message: result.reason }],
        };
      }
      const done = result.item;
      const next = getCurrentWorkItem(this.workPlan);
      if (result.alreadyDone) {
        // 자동 완료된 항목의 재완료 — 다시 짓지 말라고 분명히 말한다. 마일스톤 적용은 첫 완료가 이미 트리거했다.
        return {
          ok: true,
          summary: next
            ? `이미 완료된 항목: ${done.title} (다시 시공하지 마세요) → 현재: ${next.title}`
            : `이미 완료된 항목: ${done.title} (다시 시공하지 마세요). 작업 계획이 모두 끝났습니다.`,
          // `completed` 를 비워 둔다 — 실행 루프가 이 키로 마일스톤 적용·레이어 검증을 다시 트리거한다.
          data: { alreadyDone: done.id, next: next?.id ?? null, progress: summarizeWorkPlan(this.workPlan) },
        };
      }
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

  private syncSuccessfulToolsToCurrentWorkItem(): void {
    const currentItemId = this.workPlan?.currentItemId ?? null;
    if (currentItemId === this.successfulToolsWorkItemId) return;
    this.turnSuccessfulTools.clear();
    // 산출물 추적도 항목 단위다 — 이전 항목이 만든 맵을 다음 항목이 채울 책임으로 물려받지 않는다.
    this.turnItemCreatedMapIds.clear();
    this.turnItemAuthoredTroopIds.clear();
    this.turnItemBattleSimulations.clear();
    this.turnItemQuestIds.clear();
    this.turnItemPlacedNpcIds.clear();
    this.lastOutcomeBlockedKey = null;
    this.successfulToolsWorkItemId = currentItemId;
  }

  /**
   * 산출물 게이트 — doneWhen 은 자연어라 기계가 못 읽으므로 successTools 이름 매칭 다음에 결과물을 직접 본다.
   *  - 맵: 만들기만 하고 안 채운 맵이 없는지(2026-08-28 실측: create_map 성공 3초 만에 자동 완료 → 잔디 단색 맵 2장).
   *  - 보스 페이즈: 쓴 페이지가 simulate_battle 에서 실제로 발동했는지.
   *  - 퀘스트: lint 0 + walkthrough 로 씬을 완주하는지(2026-08-24 감사: 퀘스트 툴 호출 0회).
   *  - 대상 맵: 수정 계획의 지목된 맵이 실제로 바뀌었는지(2026-08-29 modify 진단 근본원인 10:
   *    새 맵을 만들어 시공하면 successTools 이름 매칭은 전부 통과하고 대상 맵은 그대로 남았다).
   */
  private outcomeGate(): WorkItemOutcomeGate {
    return () => {
      const project = this.getProposedProject();
      const maps = verifyCreatedMapsAuthored(project, this.turnItemCreatedMapIds);
      if (!maps.ok) return maps;
      const targetMapId = this.workPlan?.targetMapId;
      const changedTargetMaps =
        targetMapId && proposalHasChangedMap(this.finalizeProposals(this.turnProposals), targetMapId)
          ? [targetMapId]
          : [];
      const target = verifyTargetMapChanged(targetMapId, changedTargetMaps, this.turnItemCreatedMapIds);
      if (!target.ok) return target;
      const phases = verifyAuthoredBossPhases(
        project,
        this.turnItemAuthoredTroopIds,
        this.turnItemBattleSimulations,
      );
      if (!phases.ok) return phases;
      const quests = verifyAuthoredQuestsPlayable(project, this.turnItemQuestIds);
      if (!quests.ok) return quests;
      return verifyPlacedNpcsHaveStatePages(project, this.turnItemPlacedNpcIds);
    };
  }

  private recordSuccessfulTool(name: string): void {
    this.syncSuccessfulToolsToCurrentWorkItem();
    this.turnSuccessfulTools.add(name);
    // 교착 판정은 **연속** 무진행이다 — 이 항목에서 쓰기가 하나라도 성공했으면 진행이 있었으므로
    // 시도 수를 0으로 돌린다. 그러지 않으면 여러 턴에 걸쳐 정상 진행하는 큰 항목이 누적으로 막힌다.
    const currentItemId = this.workPlan?.currentItemId;
    if (currentItemId && getTool(name)?.mode === "write") {
      this.ralphAttemptsByItemId.delete(currentItemId);
      this.lastBlockReasonByItemId.delete(currentItemId);
      this.repeatedToolFailures.delete(currentItemId);
    }
  }

  /**
   * 자동 완료 전용 게이트 = 산출물 검사 + 완성도 경고.
   *
   * 완성도 경고는 종전에 `maybeAutoApplyMilestone` 에서 **자동 적용만** 보류시켰다(2026-08-28 실측:
   * audit[10] 자동 완료 → audit[11] 적용 실패 상태, 항목은 이미 done). 경고가 떴다는 것은
   * 요청 대비 산출물이 모자라다는 뜻이므로 완료 자체를 막는다. 모델이 그래도 끝내야 한다고
   * 판단하면 complete_work_item 을 명시 호출할 수 있다 — 그 경로는 산출물 게이트만 통과하면 되므로
   * 교착되지 않는다.
   */
  private autoCompleteGate(): WorkItemOutcomeGate {
    const outcome = this.outcomeGate();
    return (item) => {
      const verdict = outcome(item);
      if (!verdict.ok) return verdict;
      const calls = this.finalizeProposals(this.turnProposals);
      if (calls.length === 0) return { ok: true };
      const warnings = proposalCompletenessWarnings({
        requestText: this.currentTurnInstruction,
        intent: this.turnIntent,
        buildSpec: this.reviewBuildSpecForProposal(calls),
        calls,
      });
      if (warnings.length === 0) return { ok: true };
      return {
        ok: false,
        reason: `완성도 경고 ${warnings.length}건 — ${warnings.slice(0, 3).join(" / ")}`,
      };
    };
  }

  private async noteSuccessfulTools(names: readonly string[], onEvent: (event: SessionEvent) => void): Promise<void> {
    if (!this.workPlan || names.length === 0) return;
    const { completed, next, blocked } = advanceWorkPlanFromTools(this.workPlan, names, this.autoCompleteGate());
    const blockedKey = blocked ? `${blocked.item.id}::${blocked.reason}` : null;
    if (blocked && blockedKey !== this.lastOutcomeBlockedKey) {
      // 항목은 in_progress 로 남는다 — Ralph 재주입과 모델의 다음 라운드가 이어서 채우게 한다.
      this.lastOutcomeBlockedKey = blockedKey;
      this.lastBlockReasonByItemId.set(blocked.item.id, blocked.reason);
      this.pushAudit({ kind: "status", text: `WorkPlan 자동 완료 차단: ${blocked.item.title} — ${blocked.reason}` });
      this.pushOrchestrationMessage(
        `HARNESS: 항목 '${blocked.item.title}' 은 아직 완료할 수 없습니다. ${blocked.reason}`,
      );
      onEvent({ type: "status", text: `완료 보류: ${blocked.item.title} — ${blocked.reason}` });
    }
    if (completed) {
      this.pushAudit({ kind: "status", text: `WorkPlan 자동 완료: ${completed.title}` });
      this.emitWorkPlan(onEvent);
      if (next) {
        onEvent({ type: "status", text: `다음 할 일: ${next.title}` });
      } else if (isWorkPlanComplete(this.workPlan)) {
        onEvent({ type: "status", text: "작업 계획의 모든 항목이 완료되었습니다." });
      }
      // successTools 자동 완료 경로 — 마일스톤 자동 적용을 같은 단위로 트리거한다.
      await this.maybeAutoApplyMilestone(completed, onEvent);
      // 레이어 검증 게이트(todo 5): 완료 항목이 속한 레이어가 끝났으면 canonical 테이블대로 검증.
      await this.sweepFinishedLayers(onEvent);
      this.syncSuccessfulToolsToCurrentWorkItem();
    }
  }

  /**
   * 마일스톤 자동 적용(todo 4): 완료된 work-item의 제안을 안전 적용 경로로 기계적으로 반영한다.
   * 자율 런(opts.autonomous)에서만 동작한다. 승인 분류·완성도 경고 게이트는 없다 — 승인 카드를
   * 없앴으므로 보류는 사용자가 풀 수 없는 교착이 된다. 남은 보류 사유는 적용 검증 실패
   * (커밋 게이트 차단) 하나뿐이다.
   */
  private async maybeAutoApplyMilestone(completed: WorkItem, onEvent: (event: SessionEvent) => void): Promise<void> {
    if (!this.milestoneAutoApply) return;
    // 같은 턴에서 적용 실패 뒤 후속 완료 신호가 와도 조용히 누락하지 않고 감사로 남긴다.
    if (this.milestoneApplyFailed) {
      this.pushAudit({
        kind: "status",
        text: `agent_run:milestone-skipped-apply-failed "${completed.title}" — 앞선 마일스톤 적용 실패로 현재 턴의 적용을 중단했습니다 (프로젝트 저장소 변경 없음)`,
      });
      return;
    }
    if (this.lastMilestoneCompletionItemId === completed.id) return; // 같은 항목 중복 트리거 방지.
    this.lastMilestoneCompletionItemId = completed.id;
    const calls = this.finalizeProposals(this.turnProposals);
    if (calls.length === 0) return; // 이번 턴에 마일스톤 쓰기가 없으면 적용 대상이 없다.
    const proposed = this.getProposedProject();
    const applied = await applyProposedProject(proposed, {
      source: "agent-milestone",
      agentName: this.config.model,
      summary: `마일스톤: ${completed.title}`,
      toolNames: calls.map((call) => call.name),
      snapshotLabel: `마일스톤: ${completed.title}`,
      reason: calls.map((call) => call.reason).filter(isUsableToolReason).join(" · ") || `마일스톤 적용: ${completed.title}`,
    });
    if (!applied.ok) {
      // 커밋 게이트 차단 — 저장소는 그대로 두고 현재 자율 런만 중단한다.
      this.failMilestoneApply(completed, `적용 검증 실패: ${applied.issue ?? "무결성 오류"}`, [], onEvent);
      return;
    }
    this.pushAudit({
      kind: "status",
      text: `agent_run:milestone-applied "${completed.title}" calls=${calls.length} commit=${applied.commit.commitId ?? "local-only"} persisted=${String(applied.commit.persisted)}`,
    });
    onEvent({
      type: "milestone_applied",
      title: completed.title,
      toolCount: calls.length,
      commitId: applied.commit.commitId,
    });
    // 적용된 제안을 턴 결과/카드에서 제거하고, draft == 적용본이므로 baseline을 최신화한다
    // (store.replace 정규화 반영 — 다음 마일스톤의 draft가 깨끗하게 시작된다).
    // 주의: 새 Map 으로 교체하면 runTurnLoop 가 잡아 둔 proposedByKey 참조가 stale 되어
    // 같은 턴의 후속 라운드 쓰기가 제안에서 사라진다(다중 마일스톤 자동 적용 누락) —
    // 제자리 clear 로 참조를 보존한다.
    this.turnProposals.clear();
    this.rebaseProject(applied.applied);
  }

  /** 툴 실행 직전 신호를 알린다(1-based 서수). 실행 로직은 건드리지 않는다. */
  private emitToolStarted(onEvent: (event: SessionEvent) => void, name: string): void {
    this.turnToolStartedCount += 1;
    onEvent({ type: "tool_started", name, index: this.turnToolStartedCount });
  }

  /** 라이브 행·고스트가 한 프레임을 그릴 틈을 준다. 중단이면 양보하지 않는다. */
  private async yieldForUi(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    await this.yieldToUi();
  }

  private failMilestoneApply(
    completed: WorkItem,
    reason: string,
    warnings: readonly string[],
    onEvent: (event: SessionEvent) => void,
  ): void {
    this.milestoneApplyFailed = true;
    this.pushAudit({ kind: "status", text: `agent_run:milestone-apply-failed "${completed.title}" — ${reason} (프로젝트 저장소 변경 없음)` });
    // 이벤트 이름은 기존 패널/테스트 소비 계약을 유지한다. 의미는 적용 실패다.
    onEvent({ type: "proposal_paused", reason, warnings });
    onEvent({ type: "status", text: `마일스톤 적용 실패: ${completed.title} — ${reason} (프로젝트 저장소는 변경되지 않았습니다)` });
  }

  // ── 레이어 검증 게이트(todo 5) ────────────────────────────────────────────

  private isLayerFinished(layer: WorkLayer): boolean {
    return layer.items.every((item) => item.status === "done" || item.status === "skipped");
  }

  private isLayerVerified(layerId: string): boolean {
    return this.verifiedPlanId === (this.workPlan?.id ?? null) && this.verifiedLayerIds.has(layerId);
  }

  private markLayerVerified(layerId: string): void {
    this.verifiedPlanId = this.workPlan?.id ?? null;
    this.verifiedLayerIds.add(layerId);
  }

  /** 현재 모델 작업 중인 레이어 id(없으면 undefined) — 툴콜 히스토리 소속 레이어 기록용. */
  private verificationLayerId(): string | undefined {
    return this.workPlan?.layers[this.workPlan.currentLayerIndex]?.id;
  }

  /**
   * 레이어 검증 1회 실행 — **자문이다.** canonical 테이블(selectVerificationCalls)대로 검증
   * 툴콜을 기존 툴 실행기(runTool)로 돌리고 verdict 를 감사에 남긴다. 재킥·3회 중단 계약은
   * 제거했다(2026-08-30 실측): 부팅 정규화기가 만든 선재 참조 위반 54건이 매 시도 동일하게
   * 잡혀, 에이전트가 만들지도 않았고 고칠 수도 없는 손상으로 예산 3회를 태우고 런이 죽었다.
   */
  private async executeVerificationAdvisory(
    layer: LayerDescriptor,
    onEvent: (event: SessionEvent) => void
  ): Promise<void> {
    const calls = selectVerificationCalls(layer, this.verificationHistory);
    const results: LayerVerdictInput[] = [];
    for (const call of calls) {
      this.emitToolStarted(onEvent, call.name);
      await this.yieldForUi();
      const reason = harnessToolReason("verification", call.name);
      const result = runTool(this.ctx, call.name, call.args);
      onEvent({ type: "tool_call", name: call.name, args: call.args, result, reason });
      this.pushAudit({
        kind: "tool",
        name: call.name,
        args: call.args,
        ok: result.ok,
        summary: result.summary,
        reason,
        ...(result.issues && result.issues.length > 0 ? { issues: result.issues.map((issue) => issue.message) } : {}),
      });
      results.push({ name: call.name, result });
    }
    const verdict = parseLayerVerdict(results);
    const layerId = layer.id ?? "";
    const label = layerId !== "" ? layerId : layer.title;
    this.markLayerVerified(layerId);
    if (verdict.pass) {
      this.pushAudit({
        kind: "status",
        text: `agent_run:verification-pass layer=${label} calls=${calls.map((c) => c.name).join(",")} warnings=${verdict.warnings.length}`,
      });
      return;
    }
    this.pushAudit({
      kind: "status",
      text: `agent_run:verification-advisory layer=${label} blocking=${verdict.blockingIssues.length} warnings=${verdict.warnings.length} — 자문이므로 런을 중단하지 않는다`,
    });
    for (const issue of verdict.blockingIssues.slice(0, 8)) {
      this.pushAudit({ kind: "status", text: `agent_run:verification-note layer=${label} — ${issue}` });
    }
    onEvent({ type: "status", text: `검증 지적 ${verdict.blockingIssues.length}건 (자문) — 진행은 계속합니다.` });
  }

  /**
   * 완료된 레이어를 순서대로 1회씩 자문 검증한다. 이미 본 레이어는 다시 보지 않는다
   * (markLayerVerified). 반환값이 없다 — 이 스윕은 런 제어에 관여하지 않는다.
   */
  private async sweepFinishedLayers(onEvent: (event: SessionEvent) => void): Promise<void> {
    const plan = this.workPlan;
    if (!plan || !this.milestoneAutoApply) return;
    for (let li = 0; li < plan.layers.length; li += 1) {
      const layer = plan.layers[li]!;
      if (!this.isLayerFinished(layer)) continue;
      if (this.isLayerVerified(layer.id)) continue;
      await this.executeVerificationAdvisory({
        id: layer.id,
        title: layer.title,
        isFinal: li === plan.layers.length - 1,
        items: layer.items,
      }, onEvent);
    }
  }

  /**
   * run-end 저장 증명(todo 5): 자율 런에서 플랜이 완료됐고 remote persistence 가 켜져 있으면
   * store.flush() → store.reloadFromRemote() 를 실행하고, flush 결과의 sha256 + 프로젝트 id 로
   * agent_run_saved 감사를 남긴다. commitId 는 기존 list_project_commits 읽기 툴로 최신 row 를
   * 조회해 기록한다(브라우저 전용 툴 — node/테스트에선 unavailable 로 우아하게 기록).
   */
  private async maybeRunEndProof(onEvent: (event: SessionEvent) => void): Promise<void> {
    const plan = this.workPlan;
    if (!plan || !this.milestoneAutoApply) return;
    if (this.milestoneApplyFailed) return;
    if (!isWorkPlanComplete(plan)) return;
    if (this.runEndProofPlanId === plan.id) return;
    this.runEndProofPlanId = plan.id;
    if (!store.isRemotePersistenceEnabled()) {
      this.pushAudit({ kind: "status", text: "agent_run_local_only — remote persistence 비활성으로 저장 증명을 건너뜁니다" });
      onEvent({ type: "status", text: "자율 런 완료 — 로컬 전용 저장(remote persistence 비활성)입니다." });
      return;
    }
    try {
      const flushResult = await store.flush();
      if (flushResult.kind !== "saved") {
        this.pushAudit({ kind: "status", text: `agent_run:save-skipped kind=${flushResult.kind}` });
        onEvent({ type: "status", text: `자율 런 저장 건너뜀(${flushResult.kind}) — 저장 증명이 없습니다.` });
        return;
      }
      const reloadResult = await store.reloadFromRemote();
      const projectId = supabaseProjectConfigDraft().projectId || "(unknown)";
      const sha256 = flushResult.sha256 ?? null;
      let commitId: string | null = null;
      try {
        const commitResult = runTool(this.ctx, "list_project_commits", { limit: 1 });
        if (commitResult.ok) {
          const data = isRecord(commitResult.data) ? commitResult.data : null;
          const commits = Array.isArray(data?.commits) ? data.commits : [];
          const newest = commits[0];
          commitId = isRecord(newest) && typeof newest.commit_id === "string" ? newest.commit_id : null;
        } else {
          this.pushAudit({ kind: "status", text: `agent_run:commit-evidence-unavailable — ${commitResult.summary}` });
        }
      } catch (error) {
        this.pushAudit({
          kind: "status",
          text: `agent_run:commit-evidence-unavailable — ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      this.pushAudit({
        kind: "status",
        text: `agent_run_saved projectId=${projectId} sha256=${sha256 ?? "none"} commit=${commitId ?? "unavailable"} reload=${reloadResult.kind}`,
      });
      onEvent({ type: "status", text: `자율 런 저장 증명 완료 — projectId=${projectId} sha256=${sha256 ?? "none"} reload=${reloadResult.kind}` });
    } catch (error) {
      this.pushAudit({
        kind: "status",
        text: `agent_run:save-failed — ${error instanceof Error ? error.message : String(error)}`,
      });
      onEvent({ type: "status", text: "자율 런 원격 저장 실패 — 감사 로그를 확인하세요." });
    }
  }

  private withWorkPlanResult(result: TurnResult): TurnResult {
    if (!this.workPlan) return result;
    const hitCap =
      !isWorkPlanComplete(this.workPlan) &&
      this.workPlanAutoStepsThisUserMessage >= MAX_WORK_PLAN_AUTO_STEPS_PER_TURN;
    const suffix = hitCap ? "\n\n이어서 진행하려면 「계속」이라고 보내세요." : "";
    return {
      ...result,
      assistantText: `${result.assistantText.trim()}${suffix}`,
      workPlan: structuredClone(this.workPlan),
    };
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
    const startedAt = Date.now();
    const usageBefore = this.usageTotals;
    const auditFrom = this.audit.length;
    try {
      const result = await this.runTurnLoop(onEvent, signal);
      return this.finishRunRecap(result, startedAt, usageBefore, auditFrom, onEvent);
    } finally {
      this.removeOrchestrationMessages();
    }
  }

  /** 사용자 목표가 끝날 때 토큰·경과·과정을 감사에 남기고 채팅용 한 줄을 보낸다. */
  private finishRunRecap(
    result: TurnResult,
    startedAt: number,
    usageBefore: SessionUsageTotals,
    auditFrom: number,
    onEvent: (event: SessionEvent) => void,
  ): TurnResult {
    const recap = buildRunRecap({
      elapsedMs: Date.now() - startedAt,
      usage: usageDelta(usageBefore, this.usageTotals),
      audit: this.audit.slice(auditFrom),
      stoppedReason: result.stoppedReason,
      proposedWrites: result.proposedCalls.length,
    });
    this.pushAudit({ kind: "status", text: `run-recap ${serializeRunRecap(recap)}` });
    onEvent({ type: "run_recap", recap });
    return { ...result, recap };
  }

  // 감사 항목에 ISO 타임스탬프를 붙여 기록한다(결함 ⑬ — 타임라인 export).
  private pushAudit(entry: AuditEntry): void {
    this.audit.push({ ...entry, at: new Date().toISOString() });
  }

  /** 선택 영역이 없을 때, 「오른쪽 위」 같은 말을 지금 화면 상자로 바꿔 암묵 명세로 쓴다. */
  private implicitSpecFromViewPhrase(intentText: string): BuildSpec | null {
    const viewport = resolveContextViewport(this.contextOptions);
    const located = resolveTurnViewLocation(intentText, viewport);
    if (!viewport || !located) return null;
    return implicitSpecFromViewLocation({
      mapId: viewport.mapId,
      requestText: intentText,
      rect: located.rect,
    });
  }

  /** 이번 턴의 편집 상황(맵·뷰포트·선택) 스냅샷 — 감사 기록과 맵 이동 판정의 단일 출처. */
  private captureTurnContext(): ConversationTurnContext {
    return buildConversationTurnContext(this.ctx.project, {
      mapId: resolveContextMapId(this.contextOptions) ?? null,
      viewport: resolveContextViewport(this.contextOptions),
      selection: this.getTurnSelection?.() ?? null,
    });
  }

  /** 시스템 프롬프트를 현재 예산/현재 맵 기준으로 다시 조립한다(messages[0] 교체). */
  private rebuildSystemPrompt(): void {
    const system = this.messages[0];
    if (!system || system.role !== "system") return;
    system.content = buildSystemPrompt(this.baselineProject, this.systemPromptOptions());
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
    this.rebuildSystemPrompt();
    this.pushAudit({ kind: "status", text: `토큰 보정: 컨텍스트 문자 예산 ${budget}자로 재조립` });
  }

  // 실측 usage.prompt_tokens ↔ 이번 요청으로 보낸 프롬프트 총 문자 수를 짝지어 보정 관측으로 기록.
  // usage가 없으면(공급자가 스트리밍 usage 미지원) 조용히 건너뛴다. 이미지 파트가 섞인 요청은
  // 토큰이 문자 수와 비례하지 않으므로 관측하지 않는다. 호출 시점: 응답 메시지를 messages에
  // 추가하기 전(= messages가 방금 보낸 프롬프트와 정확히 일치할 때).
  private recordPromptUsage(result: ChatResult, toolsChars: number, sentMessages?: readonly ChatMessage[]): void {
    const promptTokens = result.usage?.prompt_tokens;
    if (typeof promptTokens !== "number" || !Number.isFinite(promptTokens) || promptTokens <= 0) return;
    // 압축 임계 판정의 과금 측 입력. 이미지 요청은 보정 관측에서 제외되지만(아래 hasImages)
    // 과금 토큰 자체는 유효하므로 여기서 먼저 저장한다.
    this.lastPromptTokens = promptTokens;
    // 전송 사본을 기준으로 보정 관측한다(요청이 압축됐으면 압축 후 크기로).
    const estimate = estimatePromptChars(sentMessages ?? this.messages, toolsChars);
    if (estimate.hasImages || estimate.chars <= 0) return;
    recordTokenObservation({ promptChars: estimate.chars, promptTokens, at: new Date().toISOString() });
  }

  /**
   * 컨텍스트 압축(contextCompaction): 대화가 모델 창을 넘볼 만큼 커졌으면 앞부분을 LLM 요약
   * 1건으로 갈아치운다. 요청 직전(compactMessagesForRequest 앞)에 돈다 — 문자 클램프는 오래된
   * assistant/tool 을 통째로 버리므로, 그 전에 요약으로 기억을 옮겨두어야 한다.
   *
   * **이 메서드는 절대 던지지 않는다.** 요약은 최적화이지 턴의 정확성 요건이 아니다. 실패·중단·
   * 빈 응답이면 대화를 손대지 않고 조용히 돌아가고, 요청은 기존 문자 클램프가 감당한다.
   */
  private async maybeCompactConversation(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<void> {
    await this.runCompaction(onEvent, signal, false);
  }

  /**
   * 압축 본체. force=false 는 턴 루프의 자동 경로(임계 + 턴당 1회 회로차단기), force=true 는
   * 사용자가 누른 수동 경로(임계·회로차단기 무시, 더 좁은 잔존 창)다.
   */
  private async runCompaction(
    onEvent: (event: SessionEvent) => void,
    signal: AbortSignal | undefined,
    force: boolean,
  ): Promise<CompactionOutcome> {
    if (!force && this.compactionAttemptedThisTurn) {
      return { kind: "skipped", reason: "이번 턴에 요약을 이미 시도했습니다" };
    }
    const settings = force ? MANUAL_COMPACTION_SETTINGS : DEFAULT_COMPACTION_SETTINGS;
    const estimate = estimateContextTokens(this.messages);
    const contextTokens = resolveThresholdContextTokens(this.lastPromptTokens, estimate);
    // 모델 창이 아니라 **작업 창**으로 판정한다 — 창을 그대로 쓰면 gemini(1M)의 문턱이
    // 1,032,192 토큰이 되는데 문자 클램프가 그 훨씬 아래에서 먼저 걸려 이 요약이 영영 돌지 않았다.
    if (!force && !shouldCompact(contextTokens, resolveWorkingContextTokens(this.config), settings)) {
      return { kind: "skipped", reason: "아직 자동 압축 임계에 닿지 않았습니다" };
    }
    const cutPoint = findCompactionCutPoint(this.messages, settings.keepRecentTokens);
    // 요약할 앞부분이 없다(시스템 프롬프트 직후가 곧 잔존 창) — LLM 을 부를 이유가 없다.
    if (cutPoint.firstKeptIndex <= 1) {
      return { kind: "skipped", reason: "요약할 앞부분이 없습니다(대화가 짧습니다)" };
    }

    onEvent({ type: "status", text: "대화가 길어져 이전 맥락을 요약 중…" });
    let summary: string | null = null;
    try {
      // 요약 콜에는 툴을 싣지 않는다(요약 모델이 툴을 부르면 안 된다). 이 콜 자체는 압축
      // 판정을 다시 타지 않으므로 재귀가 없다. 상위 라운드 재시도와 겹치지 않게 즉시 실패시킨다.
      const result = await this.chat(this.config, {
        messages: buildSummarizationRequest(this.messages.slice(1, cutPoint.firstKeptIndex), findPreviousSummary(this.messages)),
        disableTransientRetry: true,
        signal,
      });
      const text = result.message.content;
      summary = typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
    } catch (cause) {
      const reason = isLlmAbortError(cause) || signal?.aborted
        ? "사용자가 중단했습니다"
        : cause instanceof Error ? cause.message : String(cause);
      this.compactionAttemptedThisTurn = true;
      this.pushAudit({ kind: "status", text: `대화 압축 건너뜀: 요약 실패 — ${reason}` });
      return { kind: "skipped", reason: `요약 실패 — ${reason}` };
    }
    if (signal?.aborted) {
      this.compactionAttemptedThisTurn = true;
      this.pushAudit({ kind: "status", text: "대화 압축 건너뜀: 사용자가 중단했습니다" });
      return { kind: "skipped", reason: "사용자가 중단했습니다" };
    }
    if (summary === null) {
      this.compactionAttemptedThisTurn = true;
      this.pushAudit({ kind: "status", text: "대화 압축 건너뜀: 요약 응답이 비어 있습니다" });
      return { kind: "skipped", reason: "요약 응답이 비어 있습니다" };
    }

    // 성공도 "이 턴에 시도함"으로 센다 — 남은 라운드에서 요약 LLM 을 다시 부르지 않는다.
    this.compactionAttemptedThisTurn = true;
    const before = this.messages.map((message) => message);
    const compacted = buildCompactedMessages({ messages: this.messages, cutPoint, summary });
    const compactedTokens = estimateContextTokens(compacted);
    // messages 는 세션이 계속 참조하는 배열이다 — 재할당 대신 제자리 교체로 동일성을 유지한다.
    this.messages.splice(0, this.messages.length, ...compacted);
    this.lastCompaction = { messagesBefore: before, summary, beforeTokens: contextTokens, afterTokens: compactedTokens };
    this.pushAudit({ kind: "status", text: `대화 압축: ${contextTokens} -> ${compactedTokens} 토큰 (요약 1건)` });
    return { kind: "done", beforeTokens: contextTokens, afterTokens: compactedTokens, summary };
  }

  /**
   * 뷰포트 같은 라이브 상태는 순수 도구 안이 아니라 호출 경계에서 구체적인 인자로 고정한다.
   * 그래야 프리뷰와 나중 적용이 같은 영역을 시공하고, 감사 로그 재생도 카메라 위치에 흔들리지 않는다.
   */
  private resolveToolCallArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
    if (name !== "author_village") return args;
    const target = args.target;
    if (!isRecord(target) || target.kind !== "existing" || target.bounds !== undefined) return args;
    const mapId = target.mapId;
    if (typeof mapId !== "string") return args;
    const snapshot = resolveContextViewport(this.contextOptions);
    if (!snapshot || snapshot.mapId !== mapId) return args;
    const map = this.ctx.project.maps[mapId];
    if (!map) return args;

    const normalized = normalizeToolArgs(name, args);
    const normalizedTarget = normalized.target;
    if (!isRecord(normalizedTarget)) return args;
    return {
      ...normalized,
      target: { ...normalizedTarget, bounds: viewportVillageBounds(snapshot, map) },
    };
  }

  private withCarryoverWarningIfNeeded(proposal: ProposedCall): ProposedCall {
    const spec = this.carryoverSpecForTurn;
    if (spec === null || this.carryoverWarningAdded) return proposal;
    if (!SPATIAL_BUILD_TOOLS.has(proposal.name)) return proposal;
    // carryover는 diff 생성 전 시점에 붙는다 — tilesChanged 기준으로 거르면 아직 0이라 누락된다.
    // previous-turn spec의 같은 맵에 다시 쓰는 공간 쓰기면 1회 경고를 붙인다.
    // paint_tiles 등 from/to 직사각형이 regionsFromKnownCall에서 0-폭으로 잡히는 레거시
    // 버그로 proposalHasChangedMap이 false가 되던 케이스가 있어 same-map fast path 필수.
    const callerMapId = (proposal.args as unknown as { readonly mapId?: unknown })?.mapId;
    const isSameMapWrite = typeof callerMapId === "string" && callerMapId === spec.mapId;
    if (!isSameMapWrite && !proposalHasChangedMap([proposal], spec.mapId)) return proposal;

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
    // agentMode "auto" = 플래너 상시(모델 이원화 여부와 무관). "chat"·미지정은 종래
    // 판정(감독≠실행 모델일 때만)을 그대로 유지한다 — 구형 저장 blob/직접 주입 config
    // 회귀 방지.
    if (this.config.agentMode === "auto") return true;
    const main = this.config.model.trim();
    const lite = this.config.liteModel?.trim();
    return Boolean(main && lite && lite !== main);
  }

  private phaseConfig(phase: AssistantPhase): AiConfig {
    // 실행 단계는 configForLiteModel 이 reasoning 을 off 로 끈다. 계획·검수 단계는 사용자가
    // 고른 reasoningEffort 를 그대로 쓴다(모델 이름으로 effort 를 깎던 공급자 정책은 제거됨).
    return phase === "execute" ? configForLiteModel(this.config) : this.config;
  }

  /** 사용자 텍스트 + 뷰포트 블록 + (브라우저) 뷰포트 맵 이미지. */
  private async buildUserTurnContent(text: string): Promise<string | ContentPart[]> {
    const viewport = resolveContextViewport(this.contextOptions);
    if (!viewport) return text;

    const map = this.ctx.project.maps[viewport.mapId];
    const mapName = map?.name ?? viewport.mapId;
    const viewportBlock = formatViewportContextBlock(viewport, mapName, this.ctx.project);
    const located = resolveTurnViewLocation(stripContextFooter(text), viewport);
    const locationBlock = located
      ? `\n\n${formatResolvedSpatialBlock({ phrase: located.phrase.phrase, frame: located.frame, rect: located.rect })}`
      : "";
    const combinedText = `${viewportBlock}${locationBlock}\n\n---\n\n${text}`;

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
          text: located
            ? `아래는 사용자가 지금 보고 있는 맵 화면입니다. 「${located.phrase.phrase}」는 (${located.rect.x},${located.rect.y}) ${located.rect.w}×${located.rect.h} — 이 상자 안에만 놓으세요.`
            : `아래는 사용자가 지금 보고 있는 맵 화면 근처 미리보기입니다 (${viewport.x},${viewport.y}) ${viewport.w}×${viewport.h}. "여기" 해석 시 이 이미지를 우선하세요.`,
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

  /**
   * 이번 턴에 확정한 밑그림이 있는데 그 명세대로 아무것도 짓지 않았는가.
   *
   * 툴 호출이 0건인 대화형 응답(승인 질문 등)과 구분하는 판별자다 — 그쪽은 정상이고,
   * 이쪽은 "에셋 명세를 확정해 두고 실행을 건너뛴" 상태라 사용자에게 아무 결과도 남지 않는다.
   */
  private hasUnbuiltSpecThisTurn(): boolean {
    if (this.activeSpecTurnIndex !== this.currentTurnIndex) return false;
    const assets = this.activeSpec?.assets ?? [];
    return assets.length > 0;
  }

  /**
   * 확정된 밑그림의 npc 에셋을 **코드가 직접** place_npc 로 실행한다.
   *
   * 실측 결함(2026-07-29 region-task-log): 모델이 npc 에셋 명세를 확정해 두고 place_npc 를
   * 부르지 않아 사용자에게 아무 결과도 남지 않았다. 프롬프트에는 이미 place_npc 지시가 세 곳
   * 있었고 그 턴 메시지에도 실려 있었으므로, 지시를 더 넣는 것으로는 막히지 않는다.
   * (게다가 그 턴의 시스템 프롬프트는 예산 초과로 잘려 있었다 — 규칙 추가는 역효과다.)
   *
   * kind:"npc" 는 인자가 명세만으로 확정되는 에셋이다(맵·좌표·역할). author_house 가 집에
   * 대해 이미 그렇듯, 확정된 인자의 호출은 모델의 성실함이 아니라 코드가 책임진다.
   *
   * 중복 배치는 호출 시점으로 막는다 — 이 메서드는 이번 턴 쓰기 툴이 0건일 때만 불린다.
   * 모델이 스스로 place_npc 를 불렀다면 writeToolAttempts > 0 이라 여기까지 오지 않는다.
   */
  private buildSpecNpcAssetsDirectly(
    onEvent: (event: SessionEvent) => void,
    proposedByKey: Map<string, ProposedCall>
  ): number {
    const assets = (this.activeSpec?.assets ?? []).filter((asset) => asset.kind === "npc");
    const mapId = this.activeSpec?.mapId;
    if (!mapId || assets.length === 0) return 0;

    let placed = 0;
    for (const asset of assets) {
      const name = specNpcName(asset);
      const args: Record<string, unknown> = {
        mapId,
        x: asset.x,
        y: asset.y,
        name,
        graphic: { query: name },
        // 대사 없는 대기 페이지 — 코드가 "${name}입니다." 류를 지어내지 않는다. 라운드 끝의 캐스트 라이터가
        // 테마·이웃·세계관에 맞춰 채운다(authorPendingNpcCast). 상점 역할이어도 빈 shop 커맨드는 꽂지 않는다
        // (eventDraftValidator 가 shop.items.empty 로 막는다) — 재고는 set_shop_stock 이 맡는다는 사실만 감사에 남긴다.
        pages: [{}],
      };
      if (SHOP_ROLE_NAME.test(name)) {
        this.pushAudit({ kind: "status", text: `spec-npc:shop-stock-missing ${name} — 상점 재고는 set_shop_stock 으로 채워야 상점이 열린다` });
      }
      this.emitToolStarted(onEvent, "place_npc");
      const reason = harnessToolReason("spec-npc", name);
      const result = runTool(this.ctx, "place_npc", args, { dryRun: false });
      onEvent({ type: "tool_call", name: "place_npc", args, result, reason });
      this.pushAudit({
        kind: "tool",
        name: "place_npc",
        args,
        ok: result.ok,
        summary: `${result.summary} (밑그림 npc 에셋 자동 실행)`,
        reason,
        ...(result.issues && result.issues.length > 0 ? { issues: result.issues.map((issue) => issue.message) } : {}),
      });
      if (!result.ok || !result.diff) continue;
      this.recordSuccessfulTool("place_npc");
      this.upsertProposal(proposedByKey, {
        name: "place_npc",
        args,
        summary: result.summary,
        result,
        destructive: false,
        requiresApproval: false,
        reason,
      });
      placed += 1;
    }
    return placed;
  }


  /**
   * 캐스트 라이터 — 이번 라운드가 남긴 **대사 없는 NPC**(기준선에 없던 이벤트, text 커맨드 0)를 맵별로 모아
   * lite 모델에게 한 장의 캐스트 시트를 받아 `author_npc_cast` 로 적용한다.
   *
   * 왜 코드가 대사를 안 쓰는가(2026-09-03 사용자 결정): 생성 코드에 박힌 고정 대사(DEFAULT_NPCS·"안녕하세요."·
   * "${name}입니다.")가 모든 마을을 같게 만들었다. 대사는 테마·이웃·세계관에 매여야 하므로 모델이 쓰고,
   * 코드는 검증(전원 대사·상호 언급·세계관 언급 — ai/npcCast.parseCastSheet)과 적용만 한다.
   * 왜 턴 끝인가: 라운드마다 쓰면 한 명씩 놓는 모델은 옆집 이름을 모른 채 대사를 받는다. 모델이 배치를 마친
   * 뒤(최종 응답·검수 종료·예산 종료 직전) 대기 NPC 전원을 한 번에 넘겨야 서로를 언급하고, 세계관 다이제스트도
   * 한 번만 실린다. 최종 응답 분기에서 실패하면 한 라운드를 더 돌려 모델이 직접 쓰게 한다(1회).
   * 실패(JSON 깨짐·검증 2회 실패·툴 거부)는 **대체 문구가 아니라 재킥**이다 — 모델에게 place_npc {id, dialogue}
   * 로 직접 쓰라는 오케스트레이션 메시지를 넣고 감사에 `npc-cast:failed` 를 남긴다. 이 메서드는 던지지 않는다.
   */
  private async authorPendingNpcCast(
    onEvent: (event: SessionEvent) => void,
    signal: AbortSignal | undefined,
    proposedByKey: Map<string, ProposedCall>,
    theme: string,
  ): Promise<"none" | "applied" | "rekick"> {
    if (signal?.aborted) return "none";
    const pending = collectPendingNpcs(this.ctx.project, this.baselineProject);
    if (pending.length === 0) return "none";
    let outcome: "none" | "applied" | "rekick" = "none";
    const byMap = new Map<string, typeof pending>();
    for (const npc of pending) byMap.set(npc.mapId, [...(byMap.get(npc.mapId) ?? []), npc]);
    const worldDigest = buildWorldDigest(normalizeProjectWorld(this.ctx.project), { maxTokens: 600 });
    const worldNames = worldEntityNames(this.ctx.project);
    for (const [mapId, residents] of byMap) {
      const ctx: CastContext = {
        mapId,
        mapName: this.ctx.project.maps[mapId]?.name ?? mapId,
        theme,
        requestText: this.currentTurnRequestText,
        worldDigest,
        worldNames,
        existingCast: existingCastOnMap(this.ctx.project, mapId, new Set(residents.map((npc) => npc.eventId))),
        residents,
      };
      onEvent({ type: "status", text: `주민 ${residents.length}명의 이름·대사를 쓰는 중…` });
      const sheet = await this.requestCastSheet(ctx, signal);
      if (!sheet.ok) {
        this.rekickPendingNpcDialogue(onEvent, mapId, residents.map((npc) => npc.eventId), sheet.issues);
        outcome = "rekick";
        continue;
      }
      const args: Record<string, unknown> = { mapId, residents: sheet.sheet.residents };
      this.emitToolStarted(onEvent, "author_npc_cast");
      const reason = harnessToolReason("npc-cast", `${ctx.mapName} 주민 ${residents.length}명`);
      const result = runTool(this.ctx, "author_npc_cast", args, { dryRun: false });
      onEvent({ type: "tool_call", name: "author_npc_cast", args, result, reason });
      this.pushAudit({
        kind: "tool",
        name: "author_npc_cast",
        args,
        ok: result.ok,
        summary: `${result.summary} (캐스트 라이터)`,
        reason,
        ...(result.issues && result.issues.length > 0 ? { issues: result.issues.map((issue) => issue.message) } : {}),
      });
      if (!result.ok || !result.diff) {
        this.rekickPendingNpcDialogue(onEvent, mapId, residents.map((npc) => npc.eventId), [result.summary]);
        outcome = "rekick";
        continue;
      }
      this.recordSuccessfulTool("author_npc_cast");
      this.upsertProposal(proposedByKey, { name: "author_npc_cast", args, summary: result.summary, result, destructive: false, requiresApproval: false, reason });
      this.pushAudit({ kind: "status", text: `npc-cast:applied map=${mapId} residents=${sheet.sheet.residents.map((resident) => resident.name).join(",")}` });
      if (outcome === "none") outcome = "applied";
    }
    return outcome;
  }

  /** lite 모델에 시트를 요청한다 — 검증 실패면 사유를 붙여 1회 재요청. 어떤 예외도 밖으로 내지 않는다. */
  private async requestCastSheet(ctx: CastContext, signal: AbortSignal | undefined): Promise<ReturnType<typeof parseCastSheet>> {
    const messages = buildCastWriterMessages(ctx);
    let issues: readonly string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await this.chat(configForLiteModel(this.config), {
          messages: issues.length === 0
            ? messages
            : [...messages, { role: "user", content: `이전 시트는 거부되었습니다. 아래를 고쳐 JSON 전체를 다시 쓰세요:\n- ${issues.join("\n- ")}` }],
          response_format: { type: "json_object" },
          temperature: 0.8,
          signal,
          disableTransientRetry: true,
        });
        const text = typeof result.message.content === "string" ? result.message.content : "";
        const parsed = parseCastSheet(text, ctx);
        if (parsed.ok) return parsed;
        issues = parsed.issues;
        this.pushAudit({ kind: "status", text: `npc-cast:rejected attempt=${attempt + 1} — ${issues.join(" / ").slice(0, 600)}` });
      } catch (cause) {
        issues = [cause instanceof Error ? cause.message : String(cause)];
        this.pushAudit({ kind: "status", text: `npc-cast:error attempt=${attempt + 1} — ${issues[0]}` });
        if (signal?.aborted) break;
      }
    }
    return { ok: false, issues };
  }

  private rekickPendingNpcDialogue(onEvent: (event: SessionEvent) => void, mapId: string, eventIds: readonly string[], issues: readonly string[]): void {
    this.pushAudit({ kind: "status", text: `npc-cast:failed map=${mapId} pending=${eventIds.join(",")} — ${issues.join(" / ").slice(0, 400)}` });
    this.pushOrchestrationMessage(
      `HARNESS: 대사 없는 NPC ${eventIds.length}명이 남았습니다(map=${mapId}: ${eventIds.join(", ")}). 코드는 대사를 지어내지 않습니다 — `
      + `각 NPC 에 place_npc {mapId, id, name, home, dialogue:[{text}]} 로 이름과 대사를 직접 쓰세요. `
      + `테마에 맞고, 주민끼리 서로의 이름을 언급하고, 세계관 개체(세력·장소·사건)를 언급해야 합니다. 인사말 한 줄은 안 됩니다.`,
    );
    onEvent({ type: "status", text: `주민 대사 생성 실패 — 모델이 직접 씁니다 (${eventIds.length}명)` });
  }

  private reviewBuildSpecForProposal(calls: readonly ProposedCall[]): BuildSpec | null {
    const currentSpec = this.activeSpec && this.activeSpecTurnIndex === this.currentTurnIndex ? this.activeSpec : null;
    if (currentSpec && proposalHasChangedMap(calls, currentSpec.mapId)) return currentSpec;
    if (this.turnImplicitSpec && proposalHasChangedMap(calls, this.turnImplicitSpec.mapId)) return this.turnImplicitSpec;
    if (this.carryoverSpecForTurn && proposalHasChangedMap(calls, this.carryoverSpecForTurn.mapId)) return this.carryoverSpecForTurn;
    if (
      this.activeSpec &&
      this.turnExpectsChange() &&
      proposalHasChangedMap(calls, this.activeSpec.mapId)
    ) {
      return this.activeSpec;
    }
    return null;
  }

  private buildReviewPrompt(calls: readonly ProposedCall[], repairAlreadyUsed: boolean): { prompt: string; missingWarnings: string[] } {
    const lintWarnings = proposalCompletenessWarnings({
      requestText: this.currentTurnInstruction,
      intent: this.turnIntent,
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
        const retryLimit = isOhMyPiWorkerCrash(cause) ? 1 : ASSISTANT_TURN_RETRY_ATTEMPTS;
        if (
          signal?.aborted ||
          isLlmAbortError(cause) ||
          !isRetryableLlmError(cause) ||
          attempt >= retryLimit
        ) {
          throw cause;
        }
        attempt += 1;
        const text = receivedStreamDelta
          ? `연결 끊김 — 재시도 중(${attempt}/${retryLimit})`
          : `일시 오류 — 재시도 중(${attempt}/${retryLimit})`;
        if (emittedStreamDelta) onEvent({ type: "assistant_stream_reset" });
        onEvent({ type: "status", text });
        this.pushAudit({ kind: "status", text });
        await sleep(LLM_RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  private async runTurnLoop(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<TurnResult> {
    this.lastTurnFailed = false;
    // 컨텍스트 도메인 스코핑: 턴 시작 사용자 메시지 기준의 도메인 유니온을 기본 작업 세트로 쓴다.
    const domains = this.currentTurnToolDomains ?? computeActiveToolDomains(this.turnIntent);
    // WorkPlan 툴(set/get_work_plan, complete/skip_work_item)은 **계획을 실제로 쓰는 턴에만**
    // 붙인다. 예전에는 무조건 붙어서, 오케스트레이션이 꺼진 기본 설정(감독=실행 모델 동일)에서
    // 플래너가 돌지도 않는데 4개가 매 요청에 실려 갔다(실측: 45개 중 4개).
    // 조건은 아래 `orchestrated` 와 같아야 한다 — 계획 단계를 알리면서 계획 툴을 숨기면 모순이다.
    const planToolsOn = (this.orchestrationEnabled() || Boolean(this.workPlan)) && !this.skipPlannerThisTurn;
    // 계획 요구 툴(todo 8 실측): successTools/지시문에 명시된 툴은 도메인 게이트·40툴 상한에
    // 떨어져도 계획이 활성인 동안 반드시 노출한다(plan_world/play_walkthrough/build_village 등).
    // 도메인 캡 목록과 합집합을 만들고 중복은 제거한다(CPEN 128툴 상한 내 유지).
    const proposedByKey = this.turnProposals;
    let assistantText = "";
    const orchestrated = (this.orchestrationEnabled() || Boolean(this.workPlan)) && !this.skipPlannerThisTurn;
    let phase: AssistantPhase = this.workPlan ? "execute" : "plan";
    let executionStarted = Boolean(this.workPlan);
    let writeToolAttempts = 0;
    let zeroChangeRekickUsed = false;
    let reviewRepairUsed = false;
    let reviewMissingWarnings: string[] = [];
    let npcCastRekickUsed = false;
    let turnTheme = "";
    if (orchestrated) this.emitPhase(onEvent, phase);
    if (this.workPlan) this.addExecutionHintIfNeeded();
    // 에이전틱 예산: 사용자 제한은 출력 토큰 하나뿐. 루프 깊이는 사실상 무제한이고
    // (maxToolCalls 기본 2000은 폭주 방지 안전핀), 누적 출력 토큰이 maxTokens를 넘으면 멈춘다.
    let spentOutputTokens = 0;

    for (let round = 0; round < this.config.maxToolCalls; round += 1) {
      if (signal?.aborted) {
        this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
      }
      let result: ChatResult;
      const baseTools = toOpenAiTools(undefined, { domains });
      // 이름 언급·선언 툴은 사용자 발화와 의도 선언에서만 온다. footer/가이드 같은 기계 텍스트는 보지 않는다.
      const mentioned = mentionedToolSchemas(this.currentTurnInstruction);
      const declared = toolSchemasForNames(this.turnIntent?.tools ?? []);
      const planRequired = this.workPlan ? planRequiredToolSchemas(this.workPlan) : [];
      const questPersist = this.currentTurnToolDomains?.has("quest")
        ? toolSchemasForNames(["author_story_arc", "define_quest", "create_quest", "verify_quest", "lint_quest", "generate_walkthrough"])
        : [];
      const discoveryEscalated = toolSchemasForNames(this.turnEscalatedToolNames);
      const requiredByName = new Map(
        [
          ...mentioned,
          ...declared,
          ...planRequired,
          ...questPersist,
          ...discoveryEscalated,
          SET_BUILD_SPEC_TOOL,
          ...(planToolsOn ? WORK_PLAN_TOOLS : []),
        ].map((tool) => [tool.function.name, tool] as const),
      );
      const requiredNames = new Set(requiredByName.keys());
      const requiredTools = [...requiredByName.values()].filter((tool) => tool.function.name !== "find_tools");
      const baseCandidates = baseTools
        .filter((tool) => !requiredNames.has(tool.function.name) && tool.function.name !== "find_tools")
        .slice(0, MAX_BASE_TURN_TOOL_SCHEMAS);
      // 자연어 능력 승격: 사용자가 정확한 레지스트리 이름을 안 써도 요청 문장과 실제로 매칭되는
      // 툴을 같은 라운드에 얹는다. 도메인 40 상한에 밀려 "그 기능이 없습니다"로 답하던 회귀 방지.
      // 승격분은 required 와 같이 도메인 게이트 밖에서 살아남고, 대신 도메인 작업 세트의 꼬리
      // (도메인 쿼터가 마지막에 채운, 요청과 가장 관련 없는 항목)를 그만큼 내준다 — 라운드당
      // 예약 없는 작업 툴 수는 40으로 유지된다.
      const capability = capabilityEscalationSchemas(
        this.currentTurnInstruction,
        new Set([...baseCandidates.map((tool) => tool.function.name), ...requiredNames, "find_tools"]),
      );
      const capabilityNames = new Set(capability.map((tool) => tool.function.name));
      const baseExposed = baseCandidates.slice(0, Math.max(0, MAX_BASE_TURN_TOOL_SCHEMAS - capability.length));
      const tools = clampTurnToolSchemas(
        [...baseExposed, ...requiredTools, ...capability, ...toolSchemasForNames(["find_tools"])],
        capabilityNames,
      )
        // 질문 모드: 쓰기 스키마는 모델에 보이지 않는다. 문장으로 "바꾸지 마라"고 부탁하는 대신 능력을 뺀다.
        .filter((tool) => this.turnComposerMode !== "ask" || !isWriteToolName(tool.function.name))
        .map((tool) => injectToolReasonIntoOpenAiTool(tool));
      const toolsChars = JSON.stringify(tools).length;
      const exposedNames = new Set(tools.map((tool) => tool.function.name));
      const capabilityExposed = [...capabilityNames].filter((name) => exposedNames.has(name));
      if (capabilityExposed.length > 0) {
        this.pushAudit({ kind: "status", text: `tools:escalated ${capabilityExposed.join(",")} (capability)` });
      }
      this.pushAudit({
        kind: "status",
        text: `tools:exposed ${tools.length} — ${tools.map((tool) => tool.function.name).join(",")}${capabilityExposed.length > 0 ? ` | capability:${capabilityExposed.join(",")}` : ""}`.slice(0, 2000),
      });
      // 컨텍스트 압축(요약)은 요청 조립보다 **먼저** 돈다: 대화 자체를 줄이지 못하면
      // 아래 문자 클램프가 오래된 assistant/tool 을 통째로 버려 기억이 소리 없이 사라진다.
      await this.maybeCompactConversation(onEvent, signal);
      // 요청 문자 클램프: 예산은 모델 창에서 끌어낸다(resolveRequestCharBudget) — 고정 52,000 은
      // 사라진 공급자(CPEN)의 검증 상한이라 창 1M 짜리 모델의 기억까지 잘라냈다.
      // 원본(this.messages)은 감사/하네스용으로 유지된다.
      const requestMessages = compactMessagesForRequest(this.messages, resolveRequestCharBudget(this.config));
      try {
        result = await this.chatWithTransientRetry(
          this.phaseConfig(phase),
          phase === "review"
            ? { messages: requestMessages }
            : { messages: requestMessages, tools, tool_choice: "auto" },
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
        const error = isRetryableLlmError(cause) && !isOhMyPiWorkerCrash(cause)
          ? appendTransientRetryGuidance(rawError)
          : rawError;
        this.lastTurnFailed = true; // 수동 재시도(retryLastTurn) 허용 상태로 표시.
        this.pushAudit({ kind: "status", text: `턴 중단(error): ${error} · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error", error };
      }
      spentOutputTokens += result.usage?.completion_tokens ?? estimateOutputTokens(result.message);
      // 문자↔토큰 보정 관측(usage 없으면 조용히 스킵). review 단계 요청에는 tools가 없다.
      this.recordPromptUsage(result, phase === "review" ? 0 : toolsChars, requestMessages);

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
        // 레이어 검증(자문): 지적을 감사에 남기되 최종화를 막지 않는다.
        await this.sweepFinishedLayers(onEvent);
        await this.authorPendingNpcCast(onEvent, signal, proposedByKey, turnTheme || this.activeSpec?.title || "");
        assistantText = sanitizeAssistantText(stripReviewCompletePrefix(reviewText));
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const finalText = sanitizeAssistantText(messageText ?? "");
        // Ralph loop: incomplete WorkPlan → re-inject current item; do not early-exit.
        // 단, 현재 턴의 마일스톤 적용이 실패했으면 저장소와 draft가 어긋난 채 다음 항목을
        // 저작하지 않는다. 새 사용자 메시지가 실패 상태를 해제한 뒤 이어갈 수 있다.
        if (
          !this.milestoneApplyFailed
          && shouldRalphContinue(this.workPlan, {
            autoStepsUsed: this.workPlanAutoStepsThisUserMessage,
            assistantText: finalText,
          })
        ) {
          // 같은 항목을 상한만큼 밀어붙였는데도 안 되면 재주입을 멈추고 사용자에게 넘긴다.
          const stalled = this.blockStalledWorkItem(onEvent);
          if (stalled) {
            assistantText = this.blockedTurnText(stalled, finalText);
            onEvent({ type: "assistant_message", content: assistantText });
            this.pushAudit({
              kind: "status",
              text: `턴 종료(final) — 항목 교착으로 중단 · 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}`,
            });
            return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
          }
          phase = "execute";
          executionStarted = true;
          this.emitPhase(onEvent, "execute");
          this.injectRalphContinue(onEvent);
          continue;
        }
        // 단순 요청(쓰기 도구 ≤8회)은 검수 단계를 건너뛰어 LLM 왕복 1~2회를 절약한다.
        if (orchestrated && executionStarted && writeToolAttempts > 8) {
          phase = "review";
          this.emitPhase(onEvent, "review");
          const review = this.buildReviewPrompt(this.finalizeProposals(proposedByKey), reviewRepairUsed);
          reviewMissingWarnings = review.missingWarnings;
          this.pushOrchestrationMessage(review.prompt);
          continue;
        }
        // 밑그림만 그리고 끝낸 턴은 종료로 인정하지 않는다.
        //
        // 실제 결함(2026-07-29 region-task-log): `set_build_spec` 으로 상인 NPC 밑그림을
        // 확정하고 `place_npc` 를 한 번도 부를지 않은 채 "사용자 승인 후 진행됩니다"로 끝냈다.
        // proposedCalls=0 이니 승인할 대상이 없고 UI 에 승인 버튼이 뜨지 않는다 —
        // 사용자는 없는 버튼을 기다리게 된다.
        //
        // 이 조건은 `orchestrated` 와 분리해야 한다. 감독 로그는 model === liteModel 이라
        // orchestrated=false 여서 아래 재통 재킹이 꿫 꿠 상황이었다.
        // 단, "툴 호출 자체가 0건인 대화형 승인 질문"은 정상이므로 건드리지 않는다 —
        // 판별자는 **이번 턴에 에셋 있는 밑그림을 확정했는가**이다.
        if (
          !zeroChangeRekickUsed &&
          writeToolAttempts === 0 &&
          this.hasUnbuiltSpecThisTurn() &&
          this.turnExpectsChange() &&
          !assistantTextLooksLikeQuestion(finalText)
        ) {
          zeroChangeRekickUsed = true;
          this.pushOrchestrationMessage(UNBUILT_SPEC_REKICK_HINT);
          onEvent({ type: "status", text: "밑그림만 확정된 상태를 감지해 실제 배지를 진행합니다." });
          this.pushAudit({ kind: "status", text: "zero-change-rekick (unbuilt-spec)" });
          continue;
        }
        // 재킥을 이미 썼는데도 쓰기가 0건이면 모델에게 더 기대지 않는다 — 코드가 직접 짓는다.
        // kind:"npc" 는 명세만으로 인자가 확정되므로 결정론적으로 실행할 수 있다.
        // 단, 변경을 기대하는 턴이고 모델이 되묻고 끝낸 것이 아닐 때만이다 — 「이 위치로 진행할까요?」 뒤에
        // 코드가 NPC 를 놓으면 사용자는 묻는 말에 답하기도 전에 결과를 받는다(2026-09-03 적대적 리뷰 P9).
        if (
          writeToolAttempts === 0 &&
          this.hasUnbuiltSpecThisTurn() &&
          this.turnExpectsChange() &&
          !assistantTextLooksLikeQuestion(finalText)
        ) {
          const placed = this.buildSpecNpcAssetsDirectly(onEvent, proposedByKey);
          if (placed > 0) {
            onEvent({ type: "status", text: `밑그림의 NPC ${placed}명을 직접 배치했습니다.` });
            this.pushAudit({ kind: "status", text: `spec-npc-autobuild ${placed}` });
          }
        }
        if (
          orchestrated &&
          !zeroChangeRekickUsed &&
          writeToolAttempts === 0 &&
          this.turnExpectsChange() &&
          !assistantTextLooksLikeQuestion(finalText)
        ) {
          zeroChangeRekickUsed = true;
          this.pushOrchestrationMessage(ZERO_CHANGE_REKICK_HINT);
          onEvent({ type: "status", text: "변경 없는 종료를 감지해 실행 계획을 다시 요청합니다." });
          this.pushAudit({ kind: "status", text: "zero-change-rekick" });
          continue;
        }
        // 볼륨 계약: 모델이 "됐습니다"로 나가도 맵/NPC/상점/퀘스트 최소치가 비면 코드가 재주입한다.
        // 사용자 「계속」에 맡기지 않는다. Ralph(미완료 계획) · 밑그림 재킥 다음에 온다.
        if (this.injectVolumeContinue(onEvent, finalText)) {
          phase = "execute";
          executionStarted = true;
          if (orchestrated || this.workPlan) this.emitPhase(onEvent, "execute");
          continue;
        }
        // 캐스트 라이터: 이 턴이 남긴 대사 없는 NPC 를 한 장의 시트로 채운다. 실패하면 모델에게 한 번 되돌린다.
        if (!npcCastRekickUsed) {
          const cast = await this.authorPendingNpcCast(onEvent, signal, proposedByKey, turnTheme || this.activeSpec?.title || "");
          if (cast === "rekick") {
            npcCastRekickUsed = true;
            phase = "execute";
            executionStarted = true;
            continue;
          }
        }
        // 레이어 검증(자문): 최종 응답 전에 1회 돌려 지적을 근거로 남긴다. 런은 멈추지 않는다.
        await this.sweepFinishedLayers(onEvent);
        // 최종 응답.
        assistantText = finalText;
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      const startsWriteThisRound = toolCalls.some((call) => getTool(call.function.name)?.mode === "write");
      // 이번 라운드에 렌더된 비전 이미지(있으면 툴 메시지 뒤에 user 메시지로 주입).
      const roundImages: RenderedToolImage[] = [];
      // Capture before any complete/skip/set tools mutate the cursor.
      const workItemIdAtRoundStart = this.workPlan?.currentItemId ?? null;
      // 각 tool_call 실행 → role:"tool" 메시지로 결과 반환.
      for (const call of toolCalls) {
        const parsedCall = parseToolCall(call);
        const name = parsedCall.name;
        const split = splitToolCallReason(this.resolveToolCallArgs(name, parsedCall.args));
        const args = split.args;
        const callReason = split.reason;
        const tool = getTool(name);
        if (typeof args.theme === "string" && args.theme.trim()) turnTheme = args.theme.trim();
        this.emitToolStarted(onEvent, name);
        await this.yieldForUi(signal);
        if (tool?.mode === "write") writeToolAttempts += 1;
        // 프로토콜 보장: 이 호출에 대한 role:"tool" 응답을 반드시 남긴다. 응답 없이 라운드를 벗어나면
        // 세션의 영구 대화에 짝 없는 tool_calls 가 남아 **그 뒤 모든 턴**이 공급자 400 으로 죽는다
        // (실측 2026-08-30). 예외는 삼키지 않고 응답을 붙인 뒤 그대로 다시 던진다.
        let responded = false;
        const respond = (result: ToolResult): void => {
          if (responded) return;
          responded = true;
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: JSON.stringify(toolResultForModel(result)),
          });
        };
        try {
          // 스펙 게이트: set_build_spec은 세션이 직접 처리(검증·활성화)하고,
          // 공간 쓰기 툴은 검증된 밑그림의 할당 영역 안에서만 실행한다(구간 격리).
          let toolResult: ToolResult;
          const recordedReason = isUsableToolReason(callReason)
            ? callReason
            : "이유 없음 — 모델이 reason 을 생략함";
          if (split.missing && parsedCall.parseError === null) {
            this.pushAudit({ kind: "status", text: `tool-args:missing-reason ${name}` });
          }
          if (parsedCall.parseError !== null) {
            toolResult = invalidJsonArgsResult(name, call.function.arguments ?? "", parsedCall.parseError);
            this.pushAudit({ kind: "status", text: `tool-args:invalid-json ${name} — ${parsedCall.parseError}` });
          } else if (this.turnComposerMode === "ask" && isWriteToolName(name)) {
            // 노출 목록은 감사용이고 실행은 이름으로 한다 — 모델이 외워 둔 쓰기 툴을 불러도 여기서 막는다.
            toolResult = composerAskRefusal(name);
            this.pushAudit({ kind: "status", text: `composer:ask 쓰기 툴 거부 ${name}` });
          } else if (name === "set_build_spec") {
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
              // 명시 complete_work_item 완료 경로 — 마일스톤 자동 적용을 같은 단위로 트리거한다.
              if (name === "complete_work_item" && this.workPlan) {
                const completedId = completedWorkItemIdFromResult(toolResult);
                const completedItem = completedId ? findWorkItemById(this.workPlan, completedId) : null;
                if (completedItem) await this.maybeAutoApplyMilestone(completedItem, onEvent);
                // 레이어 검증 게이트(todo 5) — 명시 complete 경로도 같은 단위로 트리거한다.
                if (completedItem) await this.sweepFinishedLayers(onEvent);
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
              const gate = tool?.mode === "write" && (SPATIAL_BUILD_TOOLS.has(name) || TILE_WRITE_TOOLS.has(name))
                ? this.specGate(name, args)
                : { warnings: [] };
              toolResult = isSpecGatePass(gate)
                ? withSpecGateWarnings(runTool(this.ctx, name, args, { dryRun: false }), gate.warnings)
                : gate;
              if (dedupeKey && toolResult.ok) this.turnWriteDedupe.set(dedupeKey, toolResult);
            }
          }
          // 읽기 툴도 기록한다 — 플래너가 `successTools:["get_map_region"]` 같은 확인 항목을 자주 쓰는데
          // 쓰기만 세면 그 항목은 무슨 짓을 해도 완료할 수 없는 게이트가 된다(2026-08-23 실측: 2회 거부 후 skip).
          if (toolResult.ok) this.recordSuccessfulTool(name);
          else this.noteRepeatedToolFailure(name, toolResult);
          if (toolResult.ok) {
            // 이 항목이 새로 만든 맵을 기록한다 — 산출물 게이트가 "만들고 안 채운 맵"을 여기서 잡는다.
            const createdMapId = createdMapIdFrom(name, args, toolResult.data);
            if (createdMapId) this.turnItemCreatedMapIds.add(createdMapId);
            // 보스 페이즈: 페이지를 쓴 트룹과 시뮬 근거를 짝지어 둔다(발동 여부는 프로젝트 상태에 안 남는다).
            const authoredTroopId = authoredTroopIdFrom(name, args, toolResult.data);
            if (authoredTroopId) {
              this.turnItemAuthoredTroopIds.add(authoredTroopId);
              // 페이지가 바뀌면 이전 시뮬 근거는 무효다 — 다시 돌려야 한다.
              this.turnItemBattleSimulations.delete(authoredTroopId);
            }
            const simulation = battlePhaseSimulationFrom(name, args, toolResult.data);
            if (simulation) this.turnItemBattleSimulations.set(simulation.troopId, simulation);
            // 퀘스트: 등록한 id 를 기록한다 — 완주 검증은 게이트가 직접 돌린다.
            const questId = authoredQuestIdFrom(name, args);
            if (questId) this.turnItemQuestIds.add(questId);
            const npcId = placedNpcIdFrom(name, toolResult.data, args);
            if (npcId) this.turnItemPlacedNpcIds.add(npcId);
          }
          if (name === "find_tools") {
            const discovered = discoveredToolNames(toolResult);
            const next = [...this.turnEscalatedToolNames];
            for (const toolName of discovered) {
              const existing = next.indexOf(toolName);
              if (existing >= 0) next.splice(existing, 1);
              next.push(toolName);
            }
            this.turnEscalatedToolNames = next.slice(-MAX_ESCALATED_TOOLS_PER_TURN);
            if (discovered.length > 0) {
              this.pushAudit({ kind: "status", text: `tools:escalated ${discovered.join(",")}` });
            }
          }
          if (toolResult.ok && tool) recordAssistantToolDomainUse(tool.domains);
          onEvent({ type: "tool_call", name, args, result: toolResult, reason: recordedReason });
          this.pushAudit({
            kind: "tool",
            name,
            args,
            ok: toolResult.ok,
            summary: toolResult.summary,
            reason: recordedReason,
            // 실패/경고 원인은 감사 로그에도 남긴다 — summary만으로 원인 추적이 안 되던 문제 방지.
            ...(toolResult.issues && toolResult.issues.length > 0 ? { issues: toolResult.issues.map((issue) => issue.message) } : {}),
          });
          // 검증 히스토리 기록(todo 5): 쓰기 툴 + play_walkthrough 만 — questId/시나리오 선택에 쓴다.
          // (검증 게이트가 직접 실행한 툴콜은 여기로 오지 않는다 — 모델 저작 히스토리만.)
          if (tool && (tool.mode === "write" || name === PLAY_WALKTHROUGH_TOOL)) {
            this.verificationHistory.push({ name, args, ok: toolResult.ok, layerId: this.verificationLayerId() });
          }

          // 성공한 쓰기 툴콜만 제안에 누적(동일 좌표 재편집은 최신 것으로 갱신).
          if (toolResult.ok && tool?.mode === "write" && toolResult.diff) {
            const softConfirm = extractVocabSoftConfirm(toolResult.data);
            let proposal: ProposedCall = {
              name,
              args,
              summary: toolResult.summary,
              result: toolResult,
              reason: recordedReason,
              // 이름 목록이 아니라 결과 diff 로 파괴성을 본다 — 기존 맵을 교체하거나 이벤트를 지운
              // 호출은 이름이 생성계여도 승인 카드를 거친다(진단 근본원인 9).
              destructive: isDestructiveOutcome(name, args, toolResult.diff),
              requiresApproval:
                RULE_TOOLS.has(name)
                || isDestructiveOutcome(name, args, toolResult.diff)
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

          respond(toolResult);

          // 비전(BUG C): '보여줘' 계열 툴이면 이미지를 렌더해 모아둔다. 렌더 실패는 무시(텍스트로 진행).
          if (this.renderImages && VISION_TOOLS.has(name) && toolResult.ok && toolResult.data !== undefined) {
            try {
              roundImages.push(...(await this.renderImages(this.ctx.project, name, toolResult.data)));
            } catch {
              /* 렌더 실패는 치명적이지 않다 */
            }
          }
        } catch (cause) {
          // 예상하지 못한 예외 — 이 호출의 응답을 먼저 남기고(짝 없는 tool_calls 로 세션을 오염하지 않는다)
          // 그대로 다시 던진다 — 턴 자체는 사용자에게 실패로 보이는 것이 맞다.
          const failure = cause instanceof Error ? cause.message : String(cause);
          this.pushAudit({ kind: "status", text: `tool-loop:exception ${name} — ${failure}` });
          respond({
            ok: false,
            summary: `'${name}' 실행 중 예상하지 못한 오류: ${failure}`,
            issues: [{ severity: "error", code: "tool-loop-exception", message: failure }],
          });
          throw cause;
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
      await this.noteSuccessfulTools([...this.turnSuccessfulTools], onEvent);
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

      // 같은 쓰기 실패가 반복되면(인자를 바꾸지 않는 모델) 라운드를 더 태우지 않고 사용자에게 넘긴다.
      if (this.hasRepeatedToolFailureStall() && this.workPlan) {
        const currentItemId = this.workPlan.currentItemId;
        const reason = currentItemId ? this.lastBlockReasonByItemId.get(currentItemId) ?? "같은 실패가 반복됩니다." : "";
        const blocked = currentItemId ? blockWorkItemById(this.workPlan, currentItemId, reason) : null;
        if (blocked) {
          this.pushAudit({
            kind: "status",
            text: `tool-failure:stalled item=${blocked.id} repeats=${MAX_REPEATED_TOOL_FAILURES_PER_ITEM} — ${reason}`,
          });
          onEvent({ type: "status", text: `막힘: ${blocked.title} — ${reason}` });
          this.emitWorkPlan(onEvent);
          assistantText = this.blockedTurnText(blocked, assistantText);
          onEvent({ type: "assistant_message", content: assistantText });
          this.pushAudit({
            kind: "status",
            text: `턴 종료(final) — 반복 실패로 중단 · 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}`,
          });
          return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
        }
      }

      // 출력 토큰 예산 확인(라운드의 툴 실행까지 마친 뒤). 예산 소진이 유일한 사용자 제한.
      if (spentOutputTokens >= this.config.maxTokens) {
        await this.authorPendingNpcCast(onEvent, signal, proposedByKey, turnTheme || this.activeSpec?.title || "");
        onEvent({
          type: "status",
          text: TOKEN_BUDGET_STATUS_TEXT,
        });
        this.pushAudit({ kind: "status", text: `턴 종료(token-budget) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return {
          assistantText: truncatedTurnText(assistantText, proposedByKey.size, "출력 토큰 예산"),
          proposedCalls: this.finalizeProposals(proposedByKey),
          stoppedReason: "token-budget",
        };
      }
    }

    // 라운드 안전핀 도달(기본 200 — 정상 작업에선 도달하지 않음) — 현재까지의 changeset을 제시.
    await this.authorPendingNpcCast(onEvent, signal, proposedByKey, turnTheme || this.activeSpec?.title || "");
    onEvent({ type: "status", text: TOKEN_BUDGET_STATUS_TEXT });
    this.pushAudit({ kind: "status", text: `턴 종료(max-tool-calls) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
    return {
      assistantText: truncatedTurnText(assistantText, proposedByKey.size, "도구 호출 예산"),
      proposedCalls: this.finalizeProposals(proposedByKey),
      stoppedReason: "max-tool-calls",
    };
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

/** 상점 역할 이름 판정 — eventTools 의 같은 정규식과 의미를 맞춘다(그쪽은 비공개). */
const SHOP_ROLE_NAME = /상점\s*주인|잡화\s*상|잡화점|가게\s*주인|상인|merchant|shopkeeper|shop\s*owner/u;

function specNpcName(asset: SpecAsset): string {
  const style = asset.style?.trim();
  if (style) return style;
  const note = asset.note?.trim();
  return note && note.length > 0 ? note : "주민";
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
  if (proposal.name === "place_npc" || proposal.name === "make_villager" || proposal.name === "place_battle_blocker") {
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
  } else if (base.name === "make_villager") {
    const home = isRecord(args.home) ? args.home : null;
    if (home !== null) args.home = { ...home, x: move.x, y: move.y };
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
    case "make_villager":
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
      // look_at_houses 의 집계는 이미지로 대체되지 않는 판정 근거다 — 배열만 떼고 남긴다.
      ...(rec.bounds === undefined ? {} : { bounds: rec.bounds }),
      ...(rec.houses === undefined ? {} : { houses: rec.houses }),
      ...(rec.variety === undefined ? {} : { variety: rec.variety }),
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

function parseToolCall(call: ToolCall): { name: string; args: Record<string, unknown>; parseError: string | null } {
  const name = call.function.name;
  const raw = call.function.arguments?.trim();
  if (!raw) return { name, args: {}, parseError: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { name, args: parsed as Record<string, unknown>, parseError: null };
    }
    return { name, args: {}, parseError: `인자가 JSON 객체가 아닙니다(${Array.isArray(parsed) ? "array" : typeof parsed}).` };
  } catch (cause) {
    // 예전엔 파싱 실패를 조용히 삼켜 빈 인자로 툴을 돌렸다. 그러면 모델은 `필수 인자 누락:
    // mapId, x, y…` 를 받고 "인자를 안 보냈다"고 이해해 **똑같은 큰 페이로드를 그대로 재전송**한다 —
    // 진짜 원인은 보통 출력 상한으로 JSON 이 중간에서 잘린 것이다. 사유를 그대로 알린다.
    return { name, args: {}, parseError: cause instanceof Error ? cause.message : String(cause) };
  }
}

/** 인자 JSON 자체가 깨진 툴콜 — 툴을 돌리지 않고 사유를 모델에 되돌려 자가수정을 유도한다. */
function invalidJsonArgsResult(name: string, raw: string, reason: string): ToolResult {
  const compact = raw.length > 160 ? `${raw.slice(0, 80)}…(중략)…${raw.slice(-40)}` : raw;
  return {
    ok: false,
    summary: `'${name}' 인자 JSON 파싱 실패: ${reason}`,
    issues: [
      {
        severity: "error",
        code: "invalid-json-args",
        message:
          `인자 JSON 을 해석하지 못했습니다: ${reason}. 인자를 생략한 것이 아니라 깨진 문자열로 도달했으므로,`
          + ` 같은 내용을 그대로 다시 보내면 또 실패합니다. 출력 길이 상한에 걸려 JSON 이 잘린 경우가 대부분이니`
          + ` 한 호출에 담는 항목 수를 줄이거나 호출을 여러 번으로 나눠 다시 시도하세요.`
          + ` 받은 원문(축약): ${compact}`,
      },
    ],
  };
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

/** 완료된 work-item을 id로 찾는다 — 완료 직후 currentItemId는 다음 항목으로 넘어가 있다. */
function findWorkItemById(plan: WorkPlan, itemId: string): WorkItem | null {
  for (const layer of plan.layers) {
    const item = layer.items.find((entry) => entry.id === itemId);
    if (item) return item;
  }
  return null;
}

/** complete_work_item ToolResult.data.completed(항목 id)를 안전하게 꺼낸다. */
function completedWorkItemIdFromResult(result: ToolResult): string | null {
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) return null;
  const completed = (result.data as Record<string, unknown>).completed;
  return typeof completed === "string" && completed.length > 0 ? completed : null;
}
