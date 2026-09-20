import { eventScopeAllowsTool, eventScopeRefusal, type EventCommandScope } from "./eventCommandScope";
import { refreshSharedCharacterGraphics } from "@/project/sharedCharacterFaceResolver";
import { configForRole } from "./modelRoles";
import { configForLegacySupervisor } from "./ultrabrainConfig";
import { genId as newCheckpointRunId } from "@/util/id";
import { readLatestRunCheckpoint, saveRunCheckpoint, type RunCheckpoint, type RunCheckpointKey } from "./runCheckpointStore";
import { checkpointContentIdentity, reconcileRunCheckpoint, type RunRecovery, type RunRuntimeState } from "./runRecovery";
import { ACCEPTANCE_EXAMPLES, acceptanceRecord, type AcceptanceSnapshot, type AcceptancePromise, type AcceptanceSource, type RequirementWithdrawalAction } from "./assistantAcceptance";
import { diagnosticObserved, diagnosticToken, publishDiagnostic } from "@/util/diagnosticObserver";
import { type ResultReview, type ReviewFinding } from "./independentReview";
import type { LintIssue } from "@/project/lint/projectLint";
import { runProjectLint } from "@/editor/tools/queryTools";
import { parseFunctionalRequirements, type FunctionalCriterion } from "./functionalAcceptance";
import { deriveRunOutcome, type RunOutcome } from "./runOutcome";
import { RunOperation } from "./runOperation";
import { AssistantAcceptanceLedger } from "./assistantAcceptanceLedger";
import { acceptanceFingerprint } from "./assistantAcceptanceEvaluation";
import { AssistantImageEvidence, coveredByImages, type AcceptanceImageReceipt } from "./assistantImageEvidence";
import { ACCEPTANCE_TOOLS } from "./assistantAcceptanceTools";
import { adventureCompletionProblems, type AdventureRequirements } from "./adventureCompletion";
import { buildActionArenaAuthoringGuide, selectActionArenaAuthoringRecipe } from "./actionArenaAuthoring";
// ai/assistantSession.ts
// 어시스턴트 세션: user msg → LLM → tool_calls → runTool(dryRun 누적) → tool 메시지 → … → 최종 응답.
// - 쓰기 툴은 로컬 draft(ctx.project)에 누적되어 연쇄 툴콜이 이전 결과를 본다(store는 건드리지 않음).
// - 커밋 게이트/인자 검증 실패 시 issues를 tool 메시지로 모델에 되돌려 자가수정을 유도(최대 maxToolCalls 왕복).
// - 브라우저 비의존(순수). chat 함수는 주입 가능(테스트에서 모킹).

import { workTargetContractIssues, workTargetIssues, workToolOutcome, type WorkToolOutcome } from "./workPlanTargets";
import { ToolReadEvidence } from "./toolReadEvidence";
import { ToolVerificationEvidence, parseVerificationChecks, verificationInitialState, type VerificationRequirement, type ApproachPreview } from "./toolVerificationEvidence";
import { isVerifyNpcRewardInput, npcRewardTargetSnapshot, VERIFY_NPC_REWARD_TOOL, type NpcRewardWitness } from "./npcRewardWitness";
import { APPEARANCE_GENERATION_TOOL } from "@/editor/tools/characterAppearanceTools";
import { GAME_OVER_IMAGE_TOOL, OPENING_IMAGE_TOOL } from "@/editor/tools/cinematicTools";
import { IMAGE_ASSET_TOOL } from "@/editor/tools/imageAssetTools";
import type { AppearanceGenerationHandoff } from "@/editor/characterAppearanceGeneration";
import { EVENT_COMMAND_ASSIST_TOOL } from "@/editor/tools/eventCommandAssistTool";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { getTool, normalizeToolArgs, runTool } from "@/editor/tools";
import { validateArgs } from "@/editor/tools/jsonSchema";
import { viewportVillageBounds } from "@/editor/tools/authorVillageSupport";
import type { ToolContext, ToolResult } from "@/editor/tools";
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
import { applyProposedProject, captureProposalBase, type ProposalBase, type ApplyProposedProjectResult } from "@/editor/tools/applyChangesetToStore";
import { AuthoredProjectBaseline, authoredIdentity } from "@/project/authoredProjectBaseline";
import { isDestructiveOutcome, isMapDestruction } from "@/ai/approvalPolicy";
import { mapLossConfirmRequest } from "@/ai/mapDestructionConfirm";
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
  type NpcRewardRequirement,
  type NpcRewardRequirements,
} from "@/ai/intentDeclaration";
import { buildIntentFacts, declareIntentCached, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { ComposerMode } from "@/ai/composerMode";
import { store, type ProjectPersistenceReceipt, type ProjectPersistenceProof } from "@/project/store";
import {
  PLAY_WALKTHROUGH_TOOL,
  EVALUATE_GAME_QUALITY_TOOL,
  VERIFICATION_TOOL_NAMES,
  parseLayerVerdict,
  selectVerificationCalls,
  type LayerDescriptor,
  type LayerVerdictInput,
  type VerificationCallRecord,
} from "./agentVerification";
import { beginAssistantToolDomainTurn, recordAssistantToolDomainUse } from "@/editor/assistantToolMode";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { applyVocabSoftConfirmApprovals, extractVocabSoftConfirm } from "@/project/tileVocabulary";
import { syncDraftWikiWithLive } from "@/project/world";
import type { Project } from "@/project/types";
import { buildGroundedRequest, buildSystemPrompt, DEFAULT_BUDGET_CHARS, resolveContextMapId, resolveContextViewport, type ContextOptions } from "./contextBuilder";
import { extractOriginalContext, GET_ORIGINAL_CONTEXT_TOOL, OriginalContextStore } from "./originalContext";
import {
  buildConversationTurnContext,
  mapTransitionNote,
  type ConversationTurnContext,
  type TurnSelectionSnapshot,
} from "./conversationTurnContext";
import { buildPreferenceMemorySection } from "./preferenceMemory";
import { buildSessionRegistryTools } from "./sessionToolExposure";
import { resolveWorkingContextTokens } from "./messageBudget";
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
import { addSessionUsage, EMPTY_SESSION_USAGE, estimateOutputTokens, type SessionUsageTotals } from "./sessionUsage";
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
import { resolveAutonomy, type AutonomyResolution } from "./autonomyLevels";
import {
  chatCompletion,
  configForLiteModel,
  isAutonomyLevel,
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
  type ImageUrlPart,
} from "./llmClient";
import {
  SPATIAL_BUILD_TOOLS,
  TILE_WRITE_TOOLS,
  affectedRegions,
  implicitSpecFromContext,
  implicitSpecFromScope,
  normalizeBuildSpec,
  plannedGrowthForSpec,
  protectedCellsInRegions,
  toolWritesTiles,
  validateBuildSpec,
  type AffectedRegion,
  type BuildSpec,
  type SpecAsset,
} from "./buildSpec";
import {
  proposalCompletenessWarnings,
  buildSpecCompletenessWarnings,
  proposalHasChangedMap,
  proposalScopeCarryoverWarning,
  requestLikelyExpectsChange,
  type ProposalCompletenessCall,
} from "./proposalCompleteness";
import { defaultYieldToUi, type YieldToUi } from "./yieldToUi";
import { defaultFreezeGuard, type FreezeGuard } from "./pageFreezeGuard";
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
  openWorkItemIds,
  parseOrchestratorDecision,
  ralphContinuationDecision,
  type RalphContinuationDecision,
  blockWorkItemById,
  reactivateBlockedWorkItems,
  repairWorkPlan,
  skipWorkItemById,
  summarizeWorkPlan,
  workPlanFromOrchestratorDecision,
  workPlanFromSetToolArgs,
  workPlanVerificationInputs,
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
  verifyNpcRewardsPlayable,
  npcRewardTargetMatches,
  type WorkItemOutcomeVerdict,
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
} from "./runRecap";

import {
  AGENT_RUN_MAX_TOTAL_STEPS,
  MAX_ESCALATED_TOOLS_PER_TURN,
  MAX_REPEATED_TOOL_FAILURES_PER_ITEM,
  MAX_SPEC_REJECTIONS,
} from "./session/budgets";
import { isRecord } from "./session/unknownValue";
import {
  BUDGET_STOP_REASONS,
  TOKEN_BUDGET_STATUS_TEXT,
  assistantTextLooksLikeQuestion,
  createRawMarkupTokenGuard,
  hasRawToolCallMarkup,
  sanitizeAssistantText,
  truncatedTurnText,
} from "./session/assistantText";
import {
  EXECUTION_PHASE_HINT,
  UNBUILT_SPEC_REKICK_HINT,
  ZERO_CHANGE_REKICK_HINT,
  isOrchestrationMessage,
  orchestrationContent,
} from "./session/orchestration";
import {
  RULE_TOOLS,
  VOCABULARY_PROPOSAL_TOOLS,
  VOCAB_SOFT_CONFIRM_APPROVAL_WARNING,
  approvalWarningFor,
} from "./session/proposalApproval";
import {
  CORRECT_VERIFICATION_TOOL,
  SET_BUILD_SPEC_TOOL,
  VISION_TOOLS,
  WORK_PLAN_TOOLS,
  composerAskRefusal,
  isWriteToolName,
} from "./session/sessionTools";
import {
  SHOP_ROLE_NAME,
  SPEC_REMEDY_FIELDS,
  autoExpandedAssetKind,
  buildSpecPlanLabel,
  growthGuidanceLine,
  isSpecGatePass,
  specFingerprint,
  specGateResult,
  specNpcName,
  type SpecGatePass,
} from "./session/buildSpecGate";
import { appendDiffWarning, withSpecGateWarnings } from "./session/toolResultWarnings";
import {
  eventBaseTarget,
  eventTargetKey,
  moveEventTarget,
  proposalKey,
  withMovedEventBaseProposal,
  writeDedupeKey,
} from "./session/eventTargets";
import {
  deferredToolResult,
  discoveredToolNames,
  invalidJsonArgsResult,
  isDeferredToolResult,
  parseToolCall,
  toolResultForModel,
  toolRetryTarget,
  toolTargetMapId,
} from "./session/toolPayload";
import { batchRecordTarget, failedRecordReference, type BatchRecordTarget } from "./session/recordReference";
import { ASSISTANT_TURN_RETRY_ATTEMPTS, appendTransientRetryGuidance, sleep } from "./session/transientRetry";
import { completedWorkItemIdFromResult, findWorkItemById } from "./session/workItemLookup";
import type {
  AssistantPhase,
  AssistantSessionOptions,
  AuditEntry,
  ChatFn,
  CompactionOutcome,
  CompletionAssessment,
  HarnessSnapshot,
  ProposedCall,
  RenderedToolImage,
  RunEndProofState,
  SessionEvent,
  SessionTurnOptions,
  SessionTurnScope,
  ToolImageRenderer,
  TurnResult,
} from "./session/types";

// ── 공개 계약 ──────────────────────────────────────────────────────
// 이 모듈은 클래스를 소유하고, 세션의 나머지 표면은 session/* 이 소유한다.
// 61개 소비자가 이 경로로 import 하므로 기존 export 를 그대로 다시 내보낸다.
export type {
  AssistantSessionOptions,
  AuditEntry,
  CompactionOutcome,
  CompletionAssessment,
  HarnessSnapshot,
  ProposedCall,
  RenderedToolImage,
  RunEndProofState,
  SessionEvent,
  SessionTurnOptions,
  SessionTurnScope,
  ToolImageRenderer,
  TurnResult,
} from "./session/types";
export { AGENT_RUN_MAX_TOTAL_STEPS } from "./session/budgets";
export {
  TOKEN_BUDGET_STATUS_TEXT,
  hasRawToolCallMarkup,
  rawToolCallMarkupIndex,
  sanitizeAssistantText,
  truncatedTurnText,
} from "./session/assistantText";
export {
  RULE_TOOLS,
  VOCABULARY_PROPOSAL_TOOLS,
  proposalApprovalWarnings,
  proposalNeedsExplicitApproval,
  ruleToolRejectionText,
} from "./session/proposalApproval";
export {
  CORRECT_VERIFICATION_TOOL,
  METADATA_ONLY_TOOLS,
  SET_BUILD_SPEC_TOOL,
  WORK_PLAN_TOOLS,
  isWriteToolName,
} from "./session/sessionTools";
export { SPEC_REMEDY_FIELDS } from "./session/buildSpecGate";
export { writeDedupeKey } from "./session/eventTargets";


/** lint error 의 신원 — 기준선에 이미 있던 결함과 초안이 새로 만든 결함을 가른다. */
function lintErrorIdentity(issue: LintIssue): string {
  return JSON.stringify([issue.code, issue.mapId ?? null, issue.eventId ?? null, issue.x ?? null, issue.y ?? null, issue.message]);
}

function lintErrors(project: Project): LintIssue[] {
  // 세션 안의 run_lint 와 같은 레지스트리 경로를 탄다 — 테스트가 같은 스파이로 잡을 수 있고, 결과가 어긋날 수 없다.
  const lint = runTool({ project }, "run_lint", {}, { dryRun: true });
  const issues = Array.isArray((lint.data as { issues?: unknown } | undefined)?.issues)
    ? ((lint.data as { issues: LintIssue[] }).issues) : [];
  return issues.filter(issue => issue.severity === "error");
}

/**
 * 결정적 초안 검사 — 변경된 맵에서 **초안이 새로 만든** lint error 만 본다. 검수 모델도 이미지도 원장도 없다.
 *
 * 기준선(baseline)에 이미 있던 결함은 초안의 책임이 아니다. 이걸 빼지 않으면 결함이 하나라도 있는
 * 프로젝트에서는 어떤 초안도 영영 적용되지 않는다(실측: 테스트 픽스처의 sw_missing_xyz 참조 하나가
 * 제목만 바꾼 초안을 막았다). 옛 하네스의 "lint 기준선 출처(provenance)" 규칙과 같은 뜻이다.
 */
export function deterministicDraftFindings(project: Project, changedMapIds: readonly string[], baseline?: Project): ReviewFinding[] {
  const changed = new Set(changedMapIds);
  const inherited = new Set(baseline ? lintErrors(baseline).map(lintErrorIdentity) : []);
  return lintErrors(project)
    .filter(issue => !inherited.has(lintErrorIdentity(issue)))
    .filter(issue => issue.mapId === undefined || changed.size === 0 || changed.has(issue.mapId))
    .map((issue, index): ReviewFinding => ({
      id: `lint-${index + 1}`,
      target: issue.mapId ? `${issue.mapId}${issue.x !== undefined ? ` (${issue.x},${issue.y})` : ""}` : "project",
      problem: `${issue.code}: ${issue.message}`,
      requestedChange: "run_lint 가 error 0건이 되도록 해당 위치를 고치세요.",
      validation: "run_lint error 0",
    }));
}

export class AssistantSession {
  private checkpointHost: AssistantSessionOptions["checkpoint"];
  private checkpointKey: RunCheckpointKey | null = null;
  private checkpointSavedAt = 0;
  private checkpointCurrentIdentity = "";
  private checkpointRequestBaseline: { readonly project: Project; readonly identity: string } | null = null;
  /**
   * 같은 프로젝트 객체의 신원 재계산을 막는다. 실측(2026-09-09, 기본 프로젝트): 신원 1회가
   * **약 160ms** 인데 라운드마다 두 번 계산해 20라운드짜리 턴이 6초 이상을 여기에만 썼다.
   * 실표면에서는 그 누적이 60초 정착 예산을 넘겨 UI 가 굳었다. 객체가 바뀌면 자동으로
   * 무효화된다 — 내용이 바뀌면 저장소가 새 객체를 만들기 때문이다.
   */
  private identityOf(project: Project): string {
    // 캐시하지 않는다. 독립 검토(2026-09-09)가 잡은 결함: 세션은 위키 준비 뒤 baselineProject·
    // ctx.project 의 world 를 제자리에서 바꾸므로, 객체 신원을 키로 캐시하면 낡은 신원을 찍는다.
    return checkpointContentIdentity(project);
  }
  private checkpointQueue: Promise<void> = Promise.resolve();
  private checkpointPending: RunCheckpoint["pending"] = null;
  private checkpointApplied: RunCheckpoint["applied"] = null;
  private checkpointTerminal = false;
  private checkpointRoundLimit = 0;
  private checkpointRoundsUsed = 0;
  private checkpointOutputStart = 0;
  private checkpointOutputLimit = 0;
  private recoveredCheckpoint: RunCheckpoint | null = null;
  private recoveryOperation: RunOperation | null = null;
  private recoveryBudget: RunCheckpoint["budget"] | null = null;

  getRunIdentity(): RunCheckpointKey | null { return this.checkpointKey ? { ...this.checkpointKey } : null; }
  /**
   * 가장 최근 캡처 시도의 완료. 큐 전체의 과거 실패를 누적해서 보고하지 않는다 —
   * capture 직후 await 하는 호출자는 자기 쓰기의 실패를 그대로 받고, 중간의
   * best-effort 캡처 실패는 경고로만 남는다(그 지점들은 애초에 await 하지 않는다).
   */
  whenCheckpointed(): Promise<void> { return this.checkpointQueue; }

  /**
   * 저장·증명 경로에서 쓰는 대기. 체크포인트 쓰기가 실패해도 **삼키고 진행**한다.
   *
   * 왜: 이 대기를 그대로 throw 하면 `proveAppliedRevision` 의 catch 가 잡아 저장 증명을
   * `failed` 로 끝내고 원격 읽기조차 시도하지 않는다. 실측(2026-09-09, proof-failure
   * 실표면 시나리오): 체크포인트 한 건이 거부되자 `store.flush()` 에 도달하지 못해
   * **저장 자체가 사라졌다**. 복구 장치가 정본 저장을 죽이는 것은 순서가 뒤집힌 것이다.
   * 실패하면 복구 가능성만 잃고, 저장·증명은 그대로 간다.
   */
  private async checkpointBestEffort(): Promise<void> {
    try { await this.whenCheckpointed(); }
    catch (cause) {
      this.pushAudit({ kind: "status", text: `agent_run:checkpoint-write-failed — ${cause instanceof Error ? cause.message : String(cause)} (저장·증명은 계속합니다)` });
    }
  }

  private exportRuntime(): RunRuntimeState {
    // captureCheckpoint clones the whole row synchronously, including this runtime.
    return { schemaVersion: 1, instruction: this.currentTurnInstruction,
      requestText: this.currentTurnRequestText, composerMode: this.turnComposerMode, autonomous: this.milestoneAutoApply,
      execution: this.runExecution,
      // 원장이 같은 기준선을 이미 보관한다 — 두 벌 실으면 쓰기마다 복제·검증이 두 배가 된다.
      ...(this.acceptance ? {} : { requestBaseline: this.acceptanceRequestBaseline }),
      acceptance: this.acceptance?.exportRecovery() ?? null, verification: this.verificationEvidence.exportRecovery(),
      verificationOwnerSequence: this.verificationOwnerSequence,
      verificationOwners: this.workPlan?.layers.flatMap(layer => layer.items.flatMap(item => {
        const owner = this.verificationOwners.get(item);
        return owner ? [[item.id, owner.ownerId, owner.checkIds] as const] : [];
      })) ?? [],
      currentTurnIndex: this.currentTurnIndex, specs: [...this.specsByMap], latestSpecMapId: this.latestSpecMapId,
      implicitSpec: this.turnImplicitSpec, viewSpec: this.turnViewSpec, viewSpecWorkItemId: this.turnViewSpecWorkItemId,
      originalContext: this.originalContext?.context ?? null, adventureRequirements: this.adventureRequirements,
      npcRewardRequirements: this.npcRewardRequirements, statefulNpcRequirement: this.statefulNpcRequirement,
      npcRewardItemBaselines: [...this.npcRewardItemBaseline].map(([requirement, baseline]) => [acceptanceFingerprint(requirement), baseline] as const),
      volumeBaseline: this.runVolumeBaseline, volumeBar: this.runVolumeBar, volumeContinueUsed: this.volumeContinueUsed,
      acceptanceRepairAttempts: this.acceptanceRepairAttempts, reviewAttempts: this.reviewAttempts,
      lastBlockReasons: [...this.lastBlockReasonByItemId], roundLimit: this.config.maxToolCalls, outputLimit: this.config.maxTokens };
  }

  /** Capture synchronously, enqueue immutable rows. Retired completions keep their old run/epoch key. */
  private captureCheckpoint(): void {
    const key = this.checkpointKey;
    if (!key || !this.storeBacked) return;
    // This original-request baseline is replaced, never mutated; live draft identities are not cached.
    if (this.checkpointRequestBaseline?.project !== this.acceptanceRequestBaseline) {
      this.checkpointRequestBaseline = { project: this.acceptanceRequestBaseline,
        identity: this.identityOf(this.acceptanceRequestBaseline) };
    }
    let pending = this.checkpointPending;
    // 라운드마다 도는 캡처는 초안 신원을 **다시 계산하지 않는다**. 실측(2026-09-09, late-cancel):
    // 신원 1회가 200ms대라 미스 23회가 4.8초였고, 그 누적이 하네스의 60초 신호 창을 넘겨
    // 늦은 적용 검증이 통째로 실패했다(병합 이전 main 은 같은 지점을 27.8초에 통과).
    // 적용 직전(prepareCheckpointApply)에는 그대로 정확히 계산한다 — 거기가 진짜 경계다.
    if (!pending && this.turnProposals.size && !this.checkpointTerminal) pending = {
      operationId: `${key.runId}:${key.epoch}:apply`, stage: "proposal-ready", proposal: {
        baseContentIdentity: this.identityOf(this.baselineProject),
        contentIdentity: this.identityOf(this.ctx.project),
        // 초안 바이트는 적용 대기에서만 싣는다(prepareCheckpointApply). 여기서 실으면 쓰기마다
        // 프로젝트를 한 벌 더 복제하는데, 재개는 이 단계에서 그 바이트를 쓰지 않는다.
        calls: this.finalizeProposals(this.turnProposals),
      },
    };
    const paused = this.runExecution === "cancelled" || this.runExecution === "awaiting-user";
    if (paused && pending?.stage === "proposal-ready") pending = null;
    const status: RunCheckpoint["status"] = paused ? pending ? "awaiting-user" : "terminal"
      : this.checkpointTerminal && !pending ? "terminal" : "active";
    // 캡처는 **그 순간을 동결**해야 한다. 독립 검토(2026-09-09)가 잡은 결함: workPlan 은 살아 있는
    // 참조이고 항목 상태가 제자리에서 바뀌므로, 동결하지 않으면 저장된 행이 나중의 계획 진행과
    // 이전 런타임·예산을 섞어 담는다(찢어진 복구 상태). 비용보다 무결성이 먼저다.
    const checkpoint: RunCheckpoint = structuredClone({ ...key, schemaVersion: 1,
      savedAt: this.checkpointSavedAt = Math.max(Date.now(), this.checkpointSavedAt + 1), status,
      request: this.acceptanceRequestSource, baseContentIdentity: this.checkpointRequestBaseline.identity,
      currentContentIdentity: this.checkpointCurrentIdentity, workPlan: this.workPlan,
      runtime: this.exportRuntime(), budget: {
        remainingToolCalls: Math.max(0, this.checkpointRoundLimit - this.checkpointRoundsUsed),
        remainingOutputTokens: Math.max(0, this.checkpointOutputLimit - (this.estimatedOutputTotal - this.checkpointOutputStart)),
        remainingAutoRunSteps: Math.max(0, AGENT_RUN_MAX_TOTAL_STEPS - this.autoRunSteps),
        remainingWorkPlanSteps: Math.max(0, MAX_WORK_PLAN_AUTO_STEPS_PER_TURN - this.workPlanAutoStepsThisUserMessage),
        ralphAttemptsByItemId: [...this.ralphAttemptsByItemId],
        repeatedToolFailures: [...this.repeatedToolFailures].map(([id, failures]) => [id, [...failures]] as const),
      }, verification: this.verificationEvidence.snapshot(), acceptance: this.getAcceptanceSnapshot(),
      applied: this.checkpointApplied,
      // 영수증은 이 체크포인트가 가리키는 프로젝트의 것만 담는다. 다른 프로젝트(전환·다중 세션)의
      // 영수증을 넣으면 행 전체가 malformed 로 거부되어 **복구 기록이 통째로 사라진다** —
      // 실측(2026-09-09, late-cancel): save/proof 필드가 계속 거부됐다. 소유가 다르면
      // 기록하지 않는 편이 정확하다(없는 것은 "모름"이고, 거짓 증거가 아니다).
      save: this.runReceipt?.projectId === key.projectId ? this.runReceipt : null,
      proof: (() => { const proof = this.getRunEndProof();
        return proof?.receipt && proof.receipt.projectId !== key.projectId ? null : proof; })(),
      pending });
    // Order is preserved, but a rejected predecessor must not skip this write: `.then` alone would
    // silently drop every later capture in this session after one failed row (unsupported existing row,
    // aborted transaction). Each capture waits for the previous attempt to settle and then writes itself.
    const attempt = this.checkpointQueue.catch(() => {}).then(async () => { await saveRunCheckpoint(checkpoint); });
    this.checkpointQueue = attempt;
    // Observe synchronous callback failures without pretending durability; awaited boundaries still reject.
    void attempt.catch(cause => console.warn("[aiRunCheckpoint] Checkpoint persistence failed", cause));
  }

  private async beginCheckpoint(instruction: string, text: string, options: SessionTurnOptions): Promise<void> {
    const operation = this.runOperation;
    if (!this.checkpointHost || !this.storeBacked) return;
    // 프로젝트 신원은 세션 생성 뒤에도 바뀐다 — 패널은 원격 로드 전에 세션을 만들 수 있고, 그때
    // 굳은 local-session id 로 키를 잡으면 이후 저장 영수증(원격 id)과 어긋나 **모든 체크포인트가
    // 거부된다**(실측 2026-09-09: outcome-matrix 에서 save/proof 필드가 통째로 malformed).
    // 턴 시작 시점의 실제 신원을 쓰고, 그 이후로는 이 런의 키를 고정한다.
    const host = { ...this.checkpointHost, projectId: store.getProjectIdentity().id };
    this.checkpointHost = host;
    const latest = await operation.wait(readLatestRunCheckpoint(host.conversationId, host.projectId, host.projectContextKey));
    this.checkpointKey = { ...host, runId: newCheckpointRunId(), epoch: Math.max(Date.now(), (this.checkpointKey?.epoch ?? 0) + 1, latest.kind === "found" ? latest.checkpoint.epoch + 1 : 0) };
    this.checkpointPending = null;
    this.checkpointCurrentIdentity = this.identityOf(store.getCurrent());
    this.checkpointTerminal = false;
    this.checkpointRoundLimit = this.recoveryBudget?.remainingToolCalls ?? this.config.maxToolCalls;
    this.checkpointRoundsUsed = 0;
    this.checkpointOutputStart = this.estimatedOutputTotal;
    this.checkpointOutputLimit = Math.min(this.config.maxTokens, this.recoveryBudget?.remainingOutputTokens ?? this.config.maxTokens);
    if (this.recoveryOperation !== operation) {
      this.currentTurnInstruction = instruction;
      this.currentTurnRequestText = text;
      if (options.goalAction !== "resume" && !isContinuationText(instruction)) {
        this.checkpointApplied = null;
        this.acceptanceRequestBaseline = structuredClone(this.baselineProject);
        this.acceptanceRequestSource = { requestId: `request-${this.currentTurnIndex + 1}`, text: stripContextFooter(instruction), scope: options.scope ?? null };
      }
    }
    this.captureCheckpoint();
    // 시작 체크포인트 실패로 사용자의 턴 자체를 막지 않는다 — 복구 가능성만 잃는다.
    await operation.wait(this.checkpointBestEffort());
  }

  /** Durably prepare the one candidate BEFORE the real store mutation; this grants no review authority. */
  async prepareCheckpointApply(): Promise<void> {
    if (!this.checkpointKey) return;
    const operation = this.runOperation;
    operation.assertCurrent();
    const project = this.getProposedProject();
    this.checkpointPending = { operationId: `${this.checkpointKey.runId}:${this.checkpointKey.epoch}:apply`, stage: "applying", proposal: {
      baseContentIdentity: this.identityOf(this.baselineProject), contentIdentity: this.identityOf(project),
      project, calls: this.finalizeProposals(this.turnProposals),
    } };
    this.captureCheckpoint();
    // 적용 직전은 **진짜 내구성 경계**다 — 여기서 기다린 기록이 있어야 적용 직후 중단에서
    // "이미 적용됨"을 알아볼 수 있다. 그래서 실패를 삼키지 않는다. 호출자(aiProposalCard)는
    // 중단으로 인한 거부를 소유권 상실로 처리하고, 그 외 실패는 그대로 드러난다.
    await operation.wait(this.whenCheckpointed());
  }

  /**
   * The runner, not the model-final event, settles delivery. Pending uncertainty stays active.
   *
   * 이 대기는 **UI 잠금 해제 앞**에 있다. 기록이 끝나지 않으면 전송 버튼이 영원히 비활성으로
   * 남아 사용자가 조수를 못 쓴다 — 실측(2026-09-09, required-skip 실표면)에서 정확히 그렇게
   * 굳었다. 그래서 실패는 삼키고 진행한다(복구 가능성만 잃는다).
   */
  async settleCheckpoint(): Promise<void> {
    this.checkpointTerminal = this.runExecution === "response-final" && this.turnProposals.size === 0
      && (!this.workPlan || isWorkPlanComplete(this.workPlan));
    this.captureCheckpoint();
    // 정산도 마찬가지다 — 기록 실패가 턴 종료를 실패로 바꾸지 않는다.
    await this.checkpointBestEffort();
  }

  /** No writes or capability import. Recheck the live project immediately before installing canonical state. */
  restoreCheckpoint(checkpoint: RunCheckpoint, durable: boolean): RunRecovery {
    const host = this.checkpointHost;
    if (!host || store.getProjectIdentity().id !== host.projectId || checkpoint.conversationId !== host.conversationId || checkpoint.projectId !== host.projectId
      || checkpoint.projectContextKey !== host.projectContextKey) return { kind: "unsupported", reason: "identity-mismatch", next: "open-transcript" };
    const recovery = reconcileRunCheckpoint({ kind: "found", checkpoint, durable }, store.getCurrent());
    if (recovery.kind !== "resumable" || !checkpoint.runtime) return recovery;
    const state = checkpoint.runtime;
    this.rebaseProject(store.getCurrent());
    this.workPlan = structuredClone(checkpoint.workPlan);
    this.successfulToolsWorkItemId = this.workPlan?.currentItemId ?? null;
    this.verificationOwnerSequence = state.verificationOwnerSequence;
    for (const layer of this.workPlan?.layers ?? []) for (const item of layer.items) {
      const owner = state.verificationOwners.find(([id]) => id === item.id);
      if (owner) this.verificationOwners.set(item, { ownerId: owner[1], checkIds: [...owner[2]] });
    }
    this.acceptanceRequestBaseline = structuredClone(state.requestBaseline ?? state.acceptance!.baseline);
    this.acceptanceRequestSource = structuredClone(checkpoint.request);
    this.verificationEvidence.restoreRecovery(state.verification);
    this.acceptance = state.acceptance ? AssistantAcceptanceLedger.restoreRecovery(state.acceptance, this.imageEvidence,
      (project, requirement) => verifyNpcRewardsPlayable(project, [requirement], this.npcRewardWitnesses)) : null;
    this.currentTurnInstruction = state.instruction; this.currentTurnRequestText = state.requestText;
    this.currentTurnIndex = state.currentTurnIndex;
    this.turnComposerMode = state.composerMode; this.turnScope = structuredClone(checkpoint.request.scope);
    this.specsByMap.clear(); for (const [id, spec] of state.specs) this.specsByMap.set(id, structuredClone(spec));
    this.latestSpecMapId = state.latestSpecMapId;
    this.turnImplicitSpec = structuredClone(state.implicitSpec); this.turnViewSpec = structuredClone(state.viewSpec);
    this.turnViewSpecWorkItemId = state.viewSpecWorkItemId;
    this.originalContext = state.originalContext ? new OriginalContextStore(structuredClone(state.originalContext)) : null;
    this.adventureRequirements = structuredClone(state.adventureRequirements);
    this.npcRewardRequirements = structuredClone(state.npcRewardRequirements);
    this.statefulNpcRequirement = state.statefulNpcRequirement;
    this.npcRewardItemBaseline.clear();
    if (Array.isArray(this.npcRewardRequirements)) for (const requirement of this.npcRewardRequirements) {
      const baseline = state.npcRewardItemBaselines.find(([key]) => key === acceptanceFingerprint(requirement));
      if (baseline) this.npcRewardItemBaseline.set(requirement, baseline[1]);
    }
    this.runVolumeBaseline = structuredClone(state.volumeBaseline); this.runVolumeBar = structuredClone(state.volumeBar);
    this.volumeContinueUsed = state.volumeContinueUsed;
    this.acceptanceRepairAttempts = state.acceptanceRepairAttempts; this.reviewAttempts = state.reviewAttempts;
    this.lastBlockReasonByItemId = new Map(state.lastBlockReasons);
    this.ralphAttemptsByItemId = new Map(checkpoint.budget.ralphAttemptsByItemId);
    this.repeatedToolFailures = new Map(checkpoint.budget.repeatedToolFailures.map(([id, failures]) => [id, new Map(failures)]));
    this.autoRunSteps = AGENT_RUN_MAX_TOTAL_STEPS - Math.min(AGENT_RUN_MAX_TOTAL_STEPS, checkpoint.budget.remainingAutoRunSteps);
    this.workPlanAutoStepsThisUserMessage = MAX_WORK_PLAN_AUTO_STEPS_PER_TURN - Math.min(MAX_WORK_PLAN_AUTO_STEPS_PER_TURN, checkpoint.budget.remainingWorkPlanSteps);
    this.recoveryBudget = structuredClone(checkpoint.budget);
    this.turnAppliedMilestoneCalls = structuredClone([...(checkpoint.applied?.calls ?? [])]);
    this.checkpointApplied = structuredClone(checkpoint.applied);
    // Historical content and calls are context, never offered as unapplied tool calls.
    this.messages.push(restoredTranscriptMessage(JSON.stringify({ originalRequest: checkpoint.request,
      appliedCalls: checkpoint.applied?.calls ?? [], presentProposalCalls: recovery.reason === "prepared-content-present" ? checkpoint.pending?.proposal?.calls : [],
      remainingWorkPlan: this.workPlan })));
    this.recoveredCheckpoint = structuredClone(checkpoint);
    this.publishAcceptance();
    return recovery;
  }

  async resumeRecoveredRun(onEvent: (event: SessionEvent) => void = () => {}, signal?: AbortSignal): Promise<TurnResult> {
    const checkpoint = this.recoveredCheckpoint;
    if (!checkpoint?.runtime || store.getProjectIdentity().id !== this.checkpointHost?.projectId) throw new Error("No admitted checkpoint to continue");
    const recovery = reconcileRunCheckpoint({ kind: "found", checkpoint, durable: true }, store.getCurrent());
    if (recovery.kind !== "resumable") throw new Error(`Checkpoint requires reconciliation: ${recovery.reason}`);
    return this.sendUserMessage("계속", onEvent, signal, { goalAction: "resume", driverContinue: true,
      autonomous: checkpoint.runtime.autonomous, composerMode: checkpoint.runtime.composerMode, scope: checkpoint.request.scope });
  }

  private readonly appearanceProjectIdentity = store.getProjectIdentity();
  private turnAppearanceGeneration: AppearanceGenerationHandoff | undefined;
  private config: AiConfig;
  private readonly chat: ChatFn;
  private readonly contextOptions: ContextOptions;
  // 비전 렌더러(브라우저 전용). 주입되면 '보여줘' 툴 이미지가 모델에 전달된다.
  private readonly renderImages?: ToolImageRenderer;
  private readonly yieldToUi: YieldToUi;
  private readonly freezeGuard: FreezeGuard;
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
  private proposalBase: ProposalBase;
  // 스펙 게이트 상태: 확정된 밑그림은 턴 간 유지된다(사용자가 "계속해"로 이어가도 재제출 불필요).
  // 같은 맵의 성공한 제출만 교체한다. 삽입 순서는 최근 확정/확장 순서다.
  private readonly specsByMap = new Map<string, { spec: BuildSpec; turnIndex: number }>();
  private latestSpecMapId: string | null = null;
  private currentTurnIndex = 0;
  // 이번 턴 사용자 메시지의 [컨텍스트] 선택 영역에서 파생된 암묵적 명세(턴마다 재계산).
  private turnImplicitSpec: BuildSpec | null = null;
  // An inferred viewport placement belongs to a matching placement instruction,
  // not every item that happens to edit its map. Its box is captured before camera moves.
  private turnViewSpec: BuildSpec | null = null;
  private turnViewSpecWorkItemId: string | null = null;
  // 이번 턴 시작 전에 이미 존재하던 명시 스펙. 이 스펙으로 변경 제안이 만들어지면
  // 카드에 이전 계획 포함 경고를 붙인다(D06).
  private carryoverSpecsForTurn = new Map<string, BuildSpec>();
  private readonly carryoverWarningsAdded = new Set<string>();
  // 이번 턴의 명세 검증 실패 횟수 — MAX_SPEC_REJECTIONS 초과 시 폐기 지시.
  private specRejections = 0;
  // 직전에 거부된 명세의 정규화 지문. 키 순서만 바꾼 같은 명세를 재제출하는 공회전을
  // 짚어주기 위해서다(2026-08-29 실측: 314바이트 동일 payload 3연속 재제출로 예산 소진).
  private lastRejectedSpecFingerprint: string | null = null;
  // 이번 턴에 누적된 제안 — 오류 후 재시도(retryLastTurn)에서도 이어진다(결함 ⑥).
  private turnProposals = new Map<string, ProposedCall>();
  // Quantity and diff completeness belong to one work item, even before milestone apply.
  private readonly workItemProposals = new Map<string, ProposedCall>();
  /**
   * 이 턴에 마일스톤으로 저장소에 적용을 끝낸 쓰기 툴콜 원장.
   *
   * `maybeAutoApplyMilestone` 이 `turnProposals` 를 비우기 때문에, 이 원장이 없으면 턴 끝의
   * 어떤 소비자도 "이 턴이 무엇을 지었는지" 를 알 수 없다. 청사진 정산은 이미
   * `commitAgentBlueprintProgress()` 로 같은 구멍을 막고 있었고(aiTurnRunner), 검수·완성도
   * 린트 경로만 막히지 않은 상태였다.
   */
  private turnAppliedMilestoneCalls: ProposedCall[] = [];
  /** place_props 등 산포 중복 호출 억제 — 같은 인자로 이미 성공한 쓰기는 재실행하지 않는다. */
  private turnWriteDedupe = new Map<string, ToolResult>();
  private turnEscalatedToolNames: string[] = [];
  /** Discovery miss or neutral routing opts the next request into the complete catalog. */
  private turnFullCatalogFallback = false;
  /** 이번 턴에 실행을 시작한 툴 수 — tool_started 이벤트의 1-based 서수 원천. */
  private turnToolStartedCount = 0;
  private eventBaseProposalKeys = new Map<string, string>();
  private currentTurnRequestText = "";
  /** 이번 턴의 사용자 발화만(가이드·footer 없음) — 툴 이름 언급·능력 승격·의도 선언의 입력. */
  private currentTurnInstruction = "";
  private adventureRequirements: AdventureRequirements | undefined;
  private statefulNpcRequirement = false;
  private npcRewardRequirements: NpcRewardRequirements | undefined;
  /** Captured requirement object identity binds index and request lifetime; never stores verdicts. */
  private readonly npcRewardWitnesses = new Map<NpcRewardRequirement, NpcRewardWitness>();
  /** Only declared NPC event state, so DB/terrain items do not inherit NPC acceptance. */
  private readonly npcRewardItemBaseline = new Map<NpcRewardRequirement, string>();
  private readonly imageEvidence = new AssistantImageEvidence();
  private readonly adventureIconRecords = new Map<string, { collection: "items" | "equipment"; id: string }>();
  /** 이번 턴의 의도 선언. 턴 시작에 한 번 정해지고 라우팅(되묻기·플래너·툴 노출·대상 맵)이 이것만 읽는다. */
  private turnIntent: IntentDeclaration | null = null;
  private readonly readEvidence = new ToolReadEvidence();
  private originalContext: OriginalContextStore | null = null;
  private readonly verificationEvidence = new ToolVerificationEvidence();
  private readonly verificationOwners = new WeakMap<WorkItem, { ownerId: string; checkIds: string[] }>();
  private verificationOwnerSequence = 0;
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
  private staleProposal = false;
  // 직전에 처리한 완료 항목 id — 같은 항목의 중복 complete_work_item 재트리거 방지.
  private lastMilestoneCompletionItemId: string | null = null;
  // ── 레이어 검증(자문) ──────────────────────────────────────────────────────
  // 자율 런에서 레이어 완료마다 canonical 테이블(agentVerification)대로 검증 툴콜을
  // runTool(세션 ctx)로 돌리고 verdict 를 **감사에만** 남긴다. 재킥·3회 중단은 없다
  // (2026-08-30 실측으로 제거 — agentVerification 헤더의 ADVISORY CONTRACT 참조).
  // 자문 검증이 직접 실행한 툴콜은 히스토리에 기록하지 않는다(모델 저작만).
  /** 런 누적 툴콜 히스토리(검증 선택용) — 쓰기 툴 + play_walkthrough 만 기록한다. */
  private verificationHistory: VerificationCallRecord[] = [];
  private completionQualityRequired = false;
  /** 이 플랜에서 이미 자문 검증을 돌린 레이어 id(플랜 id 기준 — replan 시 자연 리셋). */
  private verifiedPlanId: string | null = null;
  private verifiedLayerIds = new Set<string>();
  private runEndProof: RunEndProofState | null = null;
  private lastAppliedProject: { project: Project; commitId: string | null } | null = null;
  private runExecution: RunOutcome["execution"] = "response-final";
  private acceptanceApplyPending = false;
  /** Mutable settlement handle, never replaced by a getter or another run. */
  private runResult: { current: TurnResult | null; settled: boolean } = { current: null, settled: false };
  private runOperation = new RunOperation();
  private cancelPendingRun: (() => TurnResult) | undefined;
  private cancelPendingProof: ((publish?: (event: SessionEvent) => void) => void) | undefined;

  /** Capture before application/proof awaits; a later run never inherits this authority. */
  getRunOperation(): RunOperation { return this.runOperation; }

  retireRun(): TurnResult | undefined {
    const owner = this.runResult;
    if (this.cancelPendingRun && !owner.settled) return this.cancelPendingRun();
    this.runOperation.retire();
    if (owner === this.runResult) this.cancelPendingProof?.();
    return owner.current ?? undefined;
  }

  private beginRunOperation(signal?: AbortSignal): RunOperation | null {
    const previous = this.runOperation;
    this.retireRun();
    // A subscriber may have accepted a newer entry while retiring the old owner.
    if (this.runOperation !== previous) return null;
    const operation = new RunOperation(signal);
    this.runOperation = operation;
    return operation;
  }
  private storeBacked = false;
  private eventCommandScope: EventCommandScope | undefined;
  private runReceipt: ProjectPersistenceReceipt | null = null;
  private wikiDelivery: {
    owner: { current: TurnResult | null };
    project: Project | undefined;
    receipt: ProjectPersistenceReceipt | null;
  } | null = null;
  private runSubscriber: ((event: SessionEvent) => void) | undefined;
  private runRecapAuditIndex: number | null = null;
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
  private acceptance: AssistantAcceptanceLedger | null = null;
  private acceptanceRequestBaseline: Project;
  private acceptanceRequestSource: AcceptanceSource = { requestId: "request-0", text: "", scope: null };
  private readonly acceptanceHistory: AcceptanceSnapshot[] = [];
  private acceptanceAppliedProject: Project | null = null;
  private acceptanceSequence = 0;
  private acceptanceRepairAttempts = 0;
  private resultReview: ResultReview | null = null;
  private approvedReviewIdentity: string | null = null;
  /**
   * Revision whose approval was consumed by a successful apply (subscribed
   * autonomous milestone path and panel proposal path). Reporting only: the
   * recorded approved verdict survives the consumed one-shot authority so a
   * successful accepted application is not rewritten to unapproved. Never
   * authority — every apply path still requires a live isDraftReviewApproved().
   * Cleared wherever a new edit, review attempt, failure or turn retires the
   * recorded verdict; never by the R1 latch or rebase, which both fire on the
   * session's own apply.
   */
  private consumedApprovedRevision: number | null = null;
  /** Approval belongs to this loop attempt, never to a replaceable UI signal. */
  private reviewTurn: { readonly signal: AbortSignal | undefined } | null = null;
  private reviewRevision = 0;
  private reviewDraftTransform?: (project: Project) => Project;
  private reviewAttempts = 0;
  private lastReviewFailure: string | null = null;
  private reviewBaseline: Project;
  private reviewToolResults: { name: string; args: Record<string, unknown>; result: ToolResult }[] = [];
  private readonly reviewImages = new Map<AcceptanceImageReceipt, readonly RenderedToolImage[]>();
  private activeTurnSignal?: AbortSignal;
  private estimatedOutputTotal = 0;
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
   * 항목 id → 툴/대상/안정된 issue code별 실패 횟수. 다른 대상의 성공은 지우지 않는다.
   *
   * Ralph 교착 판정은 「모델이 나가려 한다」를 신호로 쓰는데, 같은 쓰기 툴을 **같은 이유로 계속 실패**하는
   * 모델은 나가려 하지 않으므로 그 신호가 오지 않는다(2026-09-03 e2e 실측: 스펙 게이트에 막힌 fill_region
   * 을 대본이 주는 대로 30번 반복했고 Ralph 는 한 번도 안 돌았다). 같은 실패가 이 상한에 닿으면 항목을
   * blocked 로 돌려 같은 출구로 나간다.
   */
  private repeatedToolFailures = new Map<string, Map<string, { target: string; count: number; summary: string }>>();
  /** 이 턴은 자율 드라이버의 합성 「계속」인가(SessionTurnOptions.driverContinue). */
  private turnIsDriverContinue = false;
  /** 플래너 LLM 왕복만 건너뛴다 — 계획 툴·오케스트레이션 주입은 그대로 둔다(skipPlannerThisTurn 과 다르다). */
  private skipPlannerRoundOnly = false;
  /** 현재 WorkItem에서 이번 사용자 메시지 동안 성공한 모든 툴 이름(읽기 포함). */
  private turnSuccessfulTools = new Set<string>();
  private workItemToolOutcomes: WorkToolOutcome[] = [];
  /** 마지막으로 감사에 **전체 목록**을 남긴 도구 카탈로그. 같은 카탈로그는 개수만 남긴다. */
  private lastAuditedToolCatalog: string | null = null;
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
  private readonly prepareProjectWiki: AssistantSessionOptions["prepareProjectWiki"];
  private draftBaseline: AuthoredProjectBaseline;
  private draftBaselineCurrent = true;
  /** Authored partition of the approved candidate. Wiki-only drift (coordinator
   * receipts, manual notes) adopts into the approval instead of voiding it. */
  private approvedAuthoredIdentity: string | null = null;
  /** Latest live world observed via refreshAcceptance. Pre-review wiki sync adopts
   * newer coordinator/manual documents from here; authored drift stays R1's gate. */
  private observedLiveWorld: Project["world"];

  constructor(project: Project, options: AssistantSessionOptions = {}) {
    this.storeBacked = project === store.getCurrent();
    this.checkpointHost = options.checkpoint;
    this.config = configForLegacySupervisor(options.config ?? loadAiConfig());
    // 계량은 로그 파싱이 아니라 호출 지점에서 센다(sessionUsage.ts). 본문·플래너·검수·요약 콜이
    // 모두 이 한 겹을 지나므로, 여기서 세면 어떤 경로도 빠지지 않는다.
    const rawChat = options.chat ?? chatCompletion;
    this.chat = async (config, req) => {
      const operation = this.runOperation;
      operation.assertCurrent();
      const result = await operation.wait(rawChat(config, req));
      this.estimatedOutputTotal += result.usage?.completion_tokens ?? estimateOutputTokens(result.message);
      this.usageTotals = addSessionUsage(this.usageTotals, config.model, result.usage);
      return result;
    };
    this.peekPendingUserMessage = options.peekPendingUserMessage;
    this.contextOptions = options.contextOptions ?? {};
    this.renderImages = options.renderImages;
    this.yieldToUi = options.yieldToUi ?? defaultYieldToUi;
    this.freezeGuard = options.freezeGuard ?? defaultFreezeGuard;
    this.getTurnSelection = options.getTurnSelection;
    this.declareIntent = options.declareIntent ?? null;
    this.prepareProjectWiki = options.prepareProjectWiki;
    this.draftBaseline = new AuthoredProjectBaseline(project);
    this.observedLiveWorld = structuredClone(project.world);
    this.baselineProject = structuredClone(project);
    this.ctx = { project: cloneDetachedDraft(project) };
    this.proposalBase = captureProposalBase(project);
    this.acceptanceRequestBaseline = structuredClone(project);
    this.reviewBaseline = structuredClone(project);
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
      wikiQuery: this.currentTurnInstruction,
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
    const operation = this.beginRunOperation(signal);
    if (!operation) return { kind: "skipped", reason: "Run ownership replaced" };
    try { return await this.runCompaction(onEvent ?? (() => undefined), operation.signal, true); }
    catch (cause) {
      if (operation.signal.aborted) return { kind: "skipped", reason: "사용자가 중단했습니다" };
      throw cause;
    }
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
    this.config = configForLegacySupervisor(config);
  }

  // 지금까지 누적된 draft(= 제안 프리뷰의 정확한 결과). 수락 시 이 스냅샷을 그대로 적용한다.
  // 연쇄 툴콜이 자동 생성 id를 참조하는 경우 재실행(applyToolSequenceToStore) 대신 이 값을 쓰면
  // "프리뷰 == 적용" 이 보장된다.
  /** Surface-owned clipping/normalization must precede review, never follow approval. */
  setReviewDraftTransform(transform: (project: Project) => Project): void {
    this.reviewDraftTransform = transform;
  }

  isDraftReviewApproved(project = this.ctx.project): boolean {
    // R1 live-base latch AND R3 loop-owner/original-signal guard: a stale base
    // voids approval even with a live owner, and a retired attempt voids it even
    // with a current base. Both identities retire together.
    return this.turnComposerMode !== "ask" && this.draftBaselineCurrent && this.reviewTurn !== null && !this.reviewTurn.signal?.aborted
      && this.resultReview?.status === "approved"
      && this.approvedReviewIdentity === JSON.stringify(project);
  }

  getDraftBaseline(): AuthoredProjectBaseline {
    return this.draftBaseline;
  }

  getResultReview(): ResultReview | null {
    if (!this.resultReview) return null;
    if (this.resultReview.status === "approved" && !this.isDraftReviewApproved()
      && this.consumedApprovedRevision !== this.resultReview.revision) {
      return { ...this.resultReview, status: "unapproved", summary: "Draft changed or cancelled after review" };
    }
    return structuredClone(this.resultReview);
  }

  getProposedProject(): Project {
    return cloneDetachedDraft(this.ctx.project);
  }

  getProposalBase(): ProposalBase { return this.proposalBase; }

  // 제안 수락/거부 후, 대화(메시지·감사 로그)를 유지한 채 프로젝트 기준만 store 최신 상태로 갱신한다.
  // 세션 폐기(dropSession)와 달리 대화 기억을 잃지 않는다 — "채팅 세션 단위 전체 기억"(#6)의 핵심.
  rebaseProject(project: Project): void {
    if (JSON.stringify(this.ctx.project) !== JSON.stringify(project)) this.invalidateVerificationAfterWrite();
    if (this.approvedReviewIdentity !== JSON.stringify(project)) {
      // Coordinator receipts and manual wiki notes arrive outside the authored
      // candidate: adopt wiki-only drift into the approval, void anything else.
      if (this.approvedAuthoredIdentity !== null && this.approvedAuthoredIdentity === authoredIdentity(project)) {
        this.approvedReviewIdentity = JSON.stringify(project);
      } else {
        this.approvedReviewIdentity = null;
        this.approvedAuthoredIdentity = null;
      }
    }
    this.draftBaseline = new AuthoredProjectBaseline(project);
    this.draftBaselineCurrent = true;
    this.pruneRemovedMapSpecs(this.ctx.project, project);
    this.baselineProject = structuredClone(project);
    this.ctx = { project: cloneDetachedDraft(project) };
    this.proposalBase = captureProposalBase(project);
    // rebase = 적용 성공 후 세션이 store와 재동기화됐다는 신호다. 현재 턴의 적용 실패 상태를 버린다.
    this.milestoneApplyFailed = false;
    this.staleProposal = false;
    // 기준이 바뀌면 이전 제안은 전부 적용됐거나 버려진 것이다. 제자리 clear — runTurnLoop 가 잡아 둔
    // 참조(proposedByKey)를 보존한다(마일스톤 경로와 같은 이유).
    this.turnProposals.clear();
    this.refreshAcceptance(project);
  }

  /**
   * 새 사용자 턴 직전, 승인 대기 제안이 없으면 세션 기준을 편집기 저장소 최신으로 맞춘다.
   *
   * 세션 draft 는 마지막 적용/수락 시점의 사본이다. 사용자가 두 턴 사이에 데이터베이스를 고치면
   * (2026-09-02 실측: 「맵 → 타일셋 → 개념 꾸러미」에서 여관→주막으로 개명한 뒤 「주막을 새 맵으로 지어줘」)
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
  getActiveSpec(mapId: string | null = this.latestSpecMapId): BuildSpec | null {
    return mapId === null ? null : this.specsByMap.get(mapId)?.spec ?? null;
  }

  private rememberSpec(spec: BuildSpec): void {
    this.specsByMap.delete(spec.mapId);
    this.specsByMap.set(spec.mapId, { spec, turnIndex: this.currentTurnIndex });
    this.latestSpecMapId = spec.mapId;
  }

  /** Never-created planned maps survive normal rebases; removed identities do not. */
  private pruneRemovedMapSpecs(before: Project, after: Project, reset = false): void {
    const removed = (mapId: string): boolean => reset || Boolean(before.maps[mapId] && !after.maps[mapId]);
    for (const mapId of this.specsByMap.keys()) {
      if (removed(mapId)) this.specsByMap.delete(mapId);
    }
    for (const mapId of this.carryoverSpecsForTurn.keys()) {
      if (removed(mapId)) {
        this.carryoverSpecsForTurn.delete(mapId);
        this.carryoverWarningsAdded.delete(mapId);
      }
    }
    if (this.turnImplicitSpec && removed(this.turnImplicitSpec.mapId)) this.turnImplicitSpec = null;
    if (this.latestSpecMapId !== null && !this.specsByMap.has(this.latestSpecMapId)) {
      this.latestSpecMapId = [...this.specsByMap.keys()].at(-1) ?? null;
    }
  }

  getWorkPlan(): WorkPlan | null {
    return this.workPlan ? structuredClone(this.workPlan) : null;
  }

  clearWorkPlan(): void {
    this.workPlan = null;
  }

  getAcceptanceSnapshot(): AcceptanceSnapshot | null {
    return this.acceptance?.getSnapshot() ?? null;
  }

  getAcceptanceHistory(): readonly AcceptanceSnapshot[] {
    return Object.freeze([...this.acceptanceHistory]);
  }

  /** UI/bridge user action only; deliberately absent from all LLM tool schemas. */
  withdrawRequirement(action: RequirementWithdrawalAction, onEvent?: (event: SessionEvent) => void): boolean {
    const accepted = this.acceptance?.withdraw(action) === true;
    if (accepted) {
      this.publishAcceptance(onEvent);
      this.publishRunOutcome(onEvent);
    }
    return accepted;
  }

  /** Same idle panel-owned boundary as withdrawal; no model tool or history replay. */
  previewApproachCorrection(checkId: string): ApproachPreview | null {
    if (!this.acceptanceAppliedProject || acceptanceFingerprint(this.ctx.project) !== acceptanceFingerprint(this.acceptanceAppliedProject)) return null;
    return this.verificationEvidence.previewApproach(checkId, this.acceptanceAppliedProject);
  }

  confirmApproachCorrection(preview: ApproachPreview, onEvent?: (event: SessionEvent) => void): boolean {
    if (!this.acceptanceAppliedProject || acceptanceFingerprint(this.ctx.project) !== acceptanceFingerprint(this.acceptanceAppliedProject)) return false;
    const revision = this.verificationEvidence.confirmApproach(preview, this.acceptanceAppliedProject);
    if (!revision) return false;
    this.pushAudit({ kind: "status", text: `approach:user-confirmed ${JSON.stringify(revision)}` });
    this.pushOrchestrationMessage(`사용자가 접근 보정만 승인했습니다. 아직 검증되지 않았습니다. 원래 checkId와 승인된 정확한 args로 correct_verification을 새로 실행하세요. 다른 기준과 실패는 유지됩니다.\n${JSON.stringify(revision)}`);
    this.publishAcceptance(onEvent);
    this.publishRunOutcome(onEvent);
    return true;
  }

  /** Applied-state refresh for store changes/undo, including after completion. */
  refreshAcceptance(project: Project, onEvent?: (event: SessionEvent) => void): void {
    if (JSON.stringify(this.ctx.project) !== JSON.stringify(project)) this.invalidateVerificationAfterWrite();
    // The exact reviewed candidate already carries checks against these values.
    // Still retire live apply authority below; content evidence is not permission.
    const reviewedContent = this.isDraftReviewApproved(project);
    // Latch a changed authored base even while no approval exists yet. A later
    // reviewer response (or an undo) cannot make that old draft current again.
    if (!this.draftBaseline.matches(project)) {
      this.staleProposal = true;
      this.draftBaselineCurrent = false;
      this.approvedReviewIdentity = null;
      this.approvedAuthoredIdentity = null;
    }
    this.observedLiveWorld = project.world ? structuredClone(project.world) : undefined;
    if (project === store.getCurrent()) this.storeBacked = true;
    this.imageEvidence.current(project);
    if (!this.acceptance && !this.verificationEvidence.hasChecks()) return;
    // A verdict may precede declaration; late adoption must not revive pre-edit proof.
    const previous = this.acceptanceAppliedProject ?? this.acceptanceRequestBaseline;
    if (!reviewedContent && previous !== project && acceptanceFingerprint(previous) !== acceptanceFingerprint(project)) {
      this.verificationEvidence.invalidateAfterWrite();
    }
    this.acceptanceAppliedProject = structuredClone(project);
    this.publishAcceptance(onEvent);
    if (this.acceptanceApplyPending && this.runExecution === "blocked"
      && this.lastAppliedProject?.project === project && this.turnProposals.size === 0
      && this.acceptance?.getSnapshot().status === "verified") {
      this.acceptanceApplyPending = false;
      this.runExecution = "response-final";
      this.publishRunOutcome(onEvent);
    }
  }

  private publishAcceptance(onEvent?: (event: SessionEvent) => void): void {
    this.imageEvidence.current(this.ctx.project);
    if (!this.acceptance || !this.acceptanceAppliedProject) return;
    const draft = this.turnProposals.size > 0 ? this.ctx.project : this.acceptanceAppliedProject;
    this.acceptance.bindVerificationRequirements(this.verificationEvidence, this.ctx.project);
    this.adoptVerificationRequirements();
    const snapshot = this.acceptance.evaluate(this.acceptanceAppliedProject, draft, this.verificationEvidence, this.verificationEvidence.problems("blocking"));
    onEvent?.({ type: "acceptance", snapshot });
  }

  private adoptPlanAcceptance(onEvent?: (event: SessionEvent) => void): void {
    const plan = this.workPlan;
    this.adoptAcceptance(plan?.acceptance || plan?.requirements
      ? [...(plan.acceptance ?? []), ...(plan.requirements ?? [])] : undefined, onEvent);
  }

  /**
   * 2026-09-17 수용 원장(acceptance ledger) 해체.
   *
   * 실측(최대 런 첫 턴 526 s): 절반이 `review_acceptance` 41회 중 38회 실패였다. 사유는 전부
   * `image-review-unavailable` — 타일셋 그래프트 렌더가 안 돼 imageReviewed 기준을 영영 만족할 수 없는데
   * 모델은 8분간 같은 도구를 두드렸다. `complete_work_item` 은 targetChange 기준이 "Draft is not yet applied"
   * 라며 거부했다 — 초안이니 당연히 아직 적용 전이다. 원장이 스스로 만족 불가능한 계약을 세우고 그걸 근거로
   * 완료를 막는 구조다. 결정적 lint 검사가 승인을 맡은 지금, 원장은 남길 이유가 없다.
   *
   * 원장을 만들지 않는다. `this.acceptance` 는 항상 null 이고, 그래서 acceptance 도구는 노출되지 않으며
   * `acceptanceOpen()` 은 false, 자동 계속·complete_work_item·최종 문구 어디에도 개입하지 않는다.
   * 플래너가 낸 acceptance/requirements 배열은 파싱만 되고 무시된다. 검증 요구(verification requirements) 채택은 유지.
   */
  private adoptAcceptance(promises: readonly AcceptancePromise[] | undefined, onEvent?: (event: SessionEvent) => void,
    request?: { readonly baseline: Project; readonly source: AcceptanceSource }): void {
    void onEvent; void request;
    if (promises?.length) this.pushAudit({ kind: "status", text: `acceptance:disabled — 플래너 수용 계약 ${promises.length}건을 기록만 하고 강제하지 않습니다` });
    this.adoptVerificationRequirements();
    return;
  }

  getVerificationSnapshot(includeAttempts = true) { return this.verificationEvidence.snapshot(includeAttempts); }

  private verificationInitialState(name: string): unknown {
    return verificationInitialState(name, this.ctx.project);
  }

  /** Both authoring paths must validate the entire candidate before touching live state. */
  private preflightWorkPlan(plan: WorkPlan): ToolResult | null {
    const items = plan.layers.flatMap(layer => layer.items);
    const conflicts: { itemId: string; declarationIndex: number; checkId?: unknown; reason: string }[] = [];
    // Inspect wire input first: parseVerificationChecks deliberately rejects an
    // entire malformed array and normalization can discard malformed items.
    for (const input of workPlanVerificationInputs(plan)) {
      const declarations = Array.isArray(input.checks) ? input.checks : [input.checks];
      const parsed = parseVerificationChecks(input.checks);
      for (const [declarationIndex, raw] of declarations.entries()) {
        const checkId = acceptanceRecord(raw) ? raw.checkId : undefined;
        const check = parseVerificationChecks([raw])?.[0];
        const retained = check && items.some(item => item.id === input.itemId && item.verificationChecks?.some(entry =>
          acceptanceFingerprint(entry) === acceptanceFingerprint(check)));
        if ((!parsed && (checkId !== undefined || declarations.length > 1)) || (check && !retained)) {
          conflicts.push({ itemId: input.itemId, declarationIndex, checkId, reason: "Malformed or discarded verification declaration; retain valid item fields and complete tool input." });
        }
      }
    }
    const ledger = this.acceptance ?? new AssistantAcceptanceLedger(`acceptance-${this.acceptanceSequence + 1}`,
      plan.goal, this.acceptanceRequestBaseline);
    const ownership = ledger.verificationOwnership(this.ctx.project, [...(plan.acceptance ?? []), ...(plan.requirements ?? [])], this.acceptanceRequestBaseline);
    const existing = this.verificationEvidence.snapshot(false).requirements;
    const resolutions = new Map<string, VerificationRequirement>();
    for (const item of items) for (const [declarationIndex, check] of (item.verificationChecks ?? []).entries()) {
      const reject = (reason: string) => conflicts.push({ itemId: item.id, declarationIndex, checkId: check.checkId, reason });
      if (!item.successTools?.includes(check.tool)) { reject("Declare this verification tool in the item's successTools."); continue; }
      const previous = check.checkId ? existing.find(entry => entry.checkId === check.checkId) : undefined;
      if (check.checkId && !previous) { reject("Unknown retained checkId; use a session-owned requirement ID."); continue; }
      if (previous && (previous.name !== check.tool
        || acceptanceFingerprint(previous.mapTargets ?? []) !== acceptanceFingerprint(item.mapTargets ?? []))) {
        reject("Retained requirements must preserve their tool and exact mapTargets (including when omitted)."); continue;
      }
      const binding = "criterion" in check ? ownership.find(entry => entry.promiseId === check.criterion.promiseId
        && entry.criterionIndex === check.criterion.criterionIndex
        && (entry.criterion.kind === "reachability" ? "check_reachability" : "run_action_combat_test") === check.tool) : undefined;
      const args = "args" in check ? check.args : !binding?.mapId ? null : binding.criterion.kind === "reachability"
        ? { mapId: binding.mapId, from: binding.criterion.from, targets: binding.criterion.to } : { mapId: binding.mapId };
      const inScope = !args || !item.mapTargets?.length || !getTool(check.tool)?.parameters.properties?.mapId
        || (typeof args.mapId === "string" && item.mapTargets.includes(args.mapId));
      if (!previous) continue; // New unresolved scopes are adopted as independent pending checks.
      if (!args || !inScope) { reject("The retained ID must resolve to valid input on its retained targets."); continue; }
      const requirement: VerificationRequirement = { checkId: previous.checkId, ownerId: previous.ownerId, name: check.tool, args,
        mapTargets: previous.mapTargets,
        ...("criterion" in check ? { criterion: check.criterion, acceptedCriterion: binding?.criterion }
          : { interactionTargets: check.interactionTargets, initialState: this.verificationInitialState(check.tool) }) };
      if (previous.args !== null) {
        if (acceptanceFingerprint(previous.args) !== acceptanceFingerprint(args)
          || ("args" in check && acceptanceFingerprint(previous.interactionTargets) !== acceptanceFingerprint(check.interactionTargets))
          || ("criterion" in check && previous.criterion && acceptanceFingerprint(previous.criterion) !== acceptanceFingerprint(check.criterion))) {
          reject("Specified checkId has immutable scope or interaction ownership; a distinct additional check must omit checkId.");
        }
        continue; // Exact reuse never respecifies criterion linkage, initial state, owner or proof.
      }
      if (previous.acceptedCriterion && acceptanceFingerprint(previous.acceptedCriterion) !== acceptanceFingerprint(requirement.acceptedCriterion)) {
        reject("Pending criterion resolution must preserve its accepted criterion and ownership."); continue;
      }
      const earlier = resolutions.get(previous.checkId);
      if (earlier && acceptanceFingerprint(earlier) !== acceptanceFingerprint(requirement)) {
        reject("Contradictory resolutions of the same pending checkId in this candidate; provide one compatible specification."); continue;
      }
      resolutions.set(previous.checkId, requirement);
    }
    if (conflicts.length) return { ok: false, summary: "WorkPlan rejected atomically: verification declaration conflict. Old plan and proof remain installed. Distinct checks omit checkId; pending resolutions preserve owner, tool and targets.",
      issues: conflicts.map(conflict => ({ severity: "error", code: "verification-declaration-conflict", message: `${conflict.itemId}[${conflict.declarationIndex}] ${conflict.checkId ?? "new check"}: ${conflict.reason}` })),
      data: { conflicts, plan: this.getWorkPlan(), acceptance: this.getAcceptanceSnapshot(), verification: this.getVerificationSnapshot() } };
    const targetIssues = items.flatMap(item => workTargetContractIssues(item).map(issue => ({ ...issue, itemId: item.id })));
    return targetIssues.length ? { ok: false, summary: targetIssues.map(issue => `${issue.itemId}: ${issue.message}`).join(" "),
      issues: targetIssues.map(issue => ({ severity: "error", code: issue.code, message: issue.message })),
      data: { targetIssues, plan: this.getWorkPlan(), acceptance: this.getAcceptanceSnapshot(), verification: this.getVerificationSnapshot() } } : null;
  }

  private adoptVerificationRequirements(): void {
    const ownership = this.acceptance?.verificationOwnership(this.ctx.project) ?? [];
    const accepted = ownership.map(binding => {
      const name = binding.criterion.kind === "reachability" ? "check_reachability" : "run_action_combat_test";
      const checkId = `${this.acceptance!.id}:${binding.promiseId}:${binding.criterionIndex}`;
      const args = !binding.mapId ? null : binding.criterion.kind === "reachability"
        ? { mapId: binding.mapId, from: binding.criterion.from, targets: binding.criterion.to }
        : { mapId: binding.mapId };
      this.verificationEvidence.adopt({ checkId, ownerId: `${this.acceptance!.id}:${binding.promiseId}`, name, args,
        criterion: { promiseId: binding.promiseId, criterionIndex: binding.criterionIndex }, acceptedCriterion: binding.criterion });
      this.verificationEvidence.setRequirementActive(checkId, binding.active);
      this.verificationEvidence.setCriterionPassed(checkId, binding.passed);
      return { ...binding, checkId, name, args };
    });
    for (const requirement of this.verificationEvidence.snapshot(false).requirements) {
      if (!requirement.criterion) continue;
      const binding = accepted.find(entry => entry.promiseId === requirement.criterion!.promiseId && entry.criterionIndex === requirement.criterion!.criterionIndex);
      if (!binding) continue;
      if (requirement.args === null && binding.mapId) {
        const original = this.verificationEvidence.snapshot(false).requirements.find(entry => entry.checkId === binding.checkId)!;
        this.verificationEvidence.adopt({ ...requirement, args: original.args });
      }
      this.verificationEvidence.setCriterionPassed(requirement.checkId, binding.passed);
    }
    const malformedItems = new Set(this.workPlan ? workPlanVerificationInputs(this.workPlan)
      .filter(input => !parseVerificationChecks(input.checks)).map(input => input.itemId) : []);
    for (const item of this.workPlan?.layers.flatMap(layer => layer.items) ?? []) {
      if (this.verificationOwners.has(item)) continue;
      const ownerId = `verification-owner-${++this.verificationOwnerSequence}`;
      const checkIds: string[] = [];
      for (const name of item.successTools ?? []) {
        if (!VERIFICATION_TOOL_NAMES.has(name)) continue;
        const criteria = accepted.filter(binding => binding.active && binding.name === name && (!item.mapTargets?.length
          || binding.mapId === undefined || item.mapTargets.includes(binding.mapId)));
        const declarations = (item.verificationChecks ?? []).filter(check => check.tool === name);
        if (criteria.length && !declarations.length && !malformedItems.has(item.id)) { checkIds.push(...criteria.map(binding => binding.checkId)); continue; }
        const adoptPending = (checkId: string) => {
          this.verificationEvidence.adopt({ checkId, ownerId, name, args: null, mapTargets: item.mapTargets ?? undefined });
          checkIds.push(checkId);
        };
        // 스펙이 아예 없는 successTools 는 검증 요구로 채택하지 않는다. 예전에는 `args: null`
        // 요구를 심었는데, 그건 **하네스가 스스로 만든 해소 불가능한 요구**였다: 실행은 반영되지
        // 않고(observe 의 matching 은 args !== null 만 고른다) correct_verification 도 거부하므로
        // (correction 의 `if (!stored?.args) return null`) set_work_plan 재선언 말고는 뚫을 수 없다.
        // 2026-09-11 실 LLM 턴에서 gemini-3.8-flash·3.1-flash·3.1-flash-lite 셋 다 이유와 checkId 를
        // 툴 결과로 받고도 재선언하지 못했다 — 2026-09-10 로그의 예산 소진이 그 결과다.
        // 검증 계약은 verificationChecks 가 담는다. 스펙 없는 successTools 는 원래 의미대로
        // "이 툴을 성공시켜라"로만 판정한다(passed() 의 attempts 분기).
        // 단 **입력이 망가져 선언이 탈락한 항목**은 그대로 막는다 — 그러지 않으면 망가진 선언이
        // 조용히 사라지고 무관한 승인 기준을 재사용한다.
        if (!declarations.length) {
          if (!malformedItems.has(item.id)) continue;
          adoptPending(`${ownerId}:${name}:pending`);
        }
        for (const [index, check] of declarations.entries()) {
          const previous = check.checkId ? this.verificationEvidence.snapshot(false).requirements.find(entry => entry.checkId === check.checkId) : undefined;
          const declarationOwner = previous?.ownerId ?? ownerId;
          const checkId = previous?.checkId ?? `${ownerId}:${name}:${index}`;
          // Preflight established exact reuse. Never rewrite frozen linkage,
          // interaction/initial-state ownership or proof, even through a ref.
          if (previous && previous.args !== null) { checkIds.push(checkId); continue; }
          if ("criterion" in check) {
            const binding = criteria.find(entry => entry.promiseId === check.criterion.promiseId && entry.criterionIndex === check.criterion.criterionIndex);
            if (binding) {
              if (previous) {
                const requirement = this.verificationEvidence.snapshot(false).requirements.find(entry => entry.checkId === binding.checkId)!;
                this.verificationEvidence.adopt({ ...requirement, checkId, ownerId: declarationOwner, mapTargets: item.mapTargets ?? undefined });
                this.verificationEvidence.setCriterionPassed(checkId, binding.passed);
              }
              checkIds.push(previous ? checkId : binding.checkId);
            } else adoptPending(checkId);
          } else {
            // Retain plan ownership without adding mapId to project/quest/troop/scenario inputs.
            if (item.mapTargets?.length && getTool(name)?.parameters.properties?.mapId
              && (typeof check.args.mapId !== "string" || !item.mapTargets.includes(check.args.mapId))) {
              adoptPending(checkId);
              continue;
            }
            // Only an exact criterion scope can stand in for an explicit declaration.
            // A retained checkId keeps its own ownership, even for identical args.
            const binding = !previous && criteria.find(entry => acceptanceFingerprint(entry.args) === acceptanceFingerprint(check.args));
            if (binding) {
              checkIds.push(binding.checkId);
              continue;
            }
            this.verificationEvidence.adopt({ checkId, ownerId: declarationOwner, name, args: check.args,
              mapTargets: item.mapTargets ?? undefined, interactionTargets: check.interactionTargets,
              initialState: this.verificationInitialState(name) });
            checkIds.push(checkId);
          }
        }
      }
      this.verificationOwners.set(item, { ownerId, checkIds });
    }
  }

  private async executeVerificationTool(name: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const tool = getTool(name);
    if (name !== "run_action_combat_test" || !tool) return runTool(this.ctx, name, args, { dryRun: false });
    const errors = validateArgs(tool.parameters, args);
    if (errors.length > 0 || typeof args.mapId !== "string") return {
      ok: false, summary: "액션 전투 검증 인자 오류", issues: errors.map(message => ({ severity: "error", code: "invalid-args", message })),
    };
    try {
      const { runActionCombatTest } = await operation.wait(import("@/editor/actionCombatRuntimeProbe"));
      const receipt = await operation.wait(runActionCombatTest(this.ctx.project, { mapId: args.mapId, signal }));
      this.acceptance?.captureActionProof(receipt, this.ctx.project, args.mapId);
      return { ok: true, summary: receipt.pass ? "실제 액션 전투 검증 통과" : `실제 액션 전투 검증 미통과: ${receipt.reason ?? receipt.status}`, data: receipt };
    } catch (cause) {
      operation.assertCurrent();
      this.acceptance?.captureActionProof(null, this.ctx.project, args.mapId);
      const message = cause instanceof Error ? cause.message : String(cause);
      return { ok: false, summary: message, issues: [{ severity: "error", code: "verification-execution-failed", message }] };
    }
  }

  private async correctVerification(args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const correction = Object.keys(args).every(key => key === "checkId" || key === "args")
      ? this.verificationEvidence.correction(args.checkId, args.args, this.ctx.project) : null;
    if (!correction || typeof args.checkId !== "string") return { ok: false, summary: "Unknown check or incompatible correction",
      issues: [{ severity: "error", code: "invalid-verification-correction", message: "Use an existing checkId and compatible original-tool args; accepted checks cannot be replaced." }],
      data: { verification: this.getVerificationSnapshot(false) } };
    const amended = this.verificationEvidence.snapshot(false).approaches.some(entry => entry.checkId === args.checkId);
    if (amended && (signal?.aborted || !this.acceptanceAppliedProject
      || acceptanceFingerprint(this.ctx.project) !== acceptanceFingerprint(this.acceptanceAppliedProject))) return {
      ok: false, summary: "접근 보정은 현재 적용된 내용에서 새로 검증해야 합니다.",
      issues: [{ severity: "error", code: "unapplied-approach-verification", message: "Apply current content before executing the approved approach." }],
    };
    // The bounded amendment is a synchronous native scene read. Observe its
    // receipt before any await can interleave an applied write, undo or cancel.
    const result = amended ? runTool(this.ctx, correction.name, correction.args, { dryRun: false })
      : await operation.wait(this.executeVerificationTool(correction.name, correction.args, signal));
    this.recordToolResult(correction.name, correction.args, result, true, args.checkId);
    return { ...result, data: { ...(isRecord(result.data) ? result.data : {}), checkId: args.checkId,
      tool: correction.name, verification: this.getVerificationSnapshot(false) } };
  }

  private acceptanceOpen(): boolean {
    return this.acceptance !== null && this.acceptance.getSnapshot().status !== "verified";
  }

  private explicitVerificationOpen(): boolean {
    return this.turnComposerMode !== "ask" && !this.lastTurnPlanOnly && this.verificationEvidence.problems("blocking").length > 0;
  }

  private acceptanceIncompleteText(): string {
    const snapshot = this.getAcceptanceSnapshot();
    return `완료 검증이 아직 미완성입니다.\n${snapshot?.items.filter(item => item.required !== false && !item.withdrawal && item.status !== "verified")
      .map(item => `- ${item.title}: ${item.reason ?? "unverified"}\n${[
        ...(item.issues ?? []).map(issue => `  ${JSON.stringify(issue)}`),
        ...item.evidence.filter(e => !e.passed).flatMap(e => [`  ${e.expected} → ${e.observed}`, ...(e.issues ?? []).map(issue => `  ${JSON.stringify(issue)}`)]),
      ].join("\n")}`).join("\n") ?? ""}`;
  }

  private applyAcceptanceTool(name: string, args: Record<string, unknown>): ToolResult {
    const allowed = name === "repair_acceptance" ? ["itemId", "criteria"] : ["itemId", "note", "verdict"];
    const extra = Object.keys(args).find(key => !allowed.includes(key));
    const result = extra ? { ok: false, code: "invalid-arguments", issues: [{ field: extra, code: "unknown-field",
      expected: `only ${allowed.join(", ")}`, example: ACCEPTANCE_EXAMPLES.mapCount }] }
      : !this.acceptance ? { ok: false, code: "unknown-item", issues: [{ field: "itemId", code: "unknown-item",
        expected: "an adopted acceptance item ID", example: ACCEPTANCE_EXAMPLES.mapCount }] }
      : name === "repair_acceptance" ? this.acceptance.repair(args.itemId, args.criteria)
        : this.acceptance.reviewResult(args.itemId, args.note, this.ctx.project, args.verdict);
    this.publishAcceptance();
    return { ok: result.ok, summary: result.ok ? "Acceptance evidence updated"
      : `Acceptance unchanged (${result.code}): ${result.issues.map(issue => `${issue.field}: ${issue.expected}`).join("; ")}`,
      issues: result.issues.map(issue => ({ severity: "error", code: issue.code, message: `${issue.field}: ${issue.expected}` })),
      data: { code: result.code, issues: result.issues, acceptance: this.getAcceptanceSnapshot() } };

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
      const issues = errors.map((issue) => ({ severity: "error" as const, code: issue.code ?? "spec-invalid", message: issue.message }));
      // Select repairs from diagnostics, never from localized prose or model-authored asset IDs.
      const recovery = {
        newPlanOverlap: errors.some((issue) => issue.code === "spec-new-plan-overlap"),
        remedyFields: SPEC_REMEDY_FIELDS.filter((field) => errors.some((issue) => issue.code ===
          (field === "overExisting" ? "spec-existing-content" : "spec-destroy-confirmation"))),
      };
      const demanded = recovery.remedyFields;
      const fieldList = demanded.join("·");
      // 경계 밖 에셋을 "영역을 좁히세요"로만 돌려주면 모델은 맵을 키우는 선택지를 영영 보지 못한다
      // (2026-09-15 진단: 「마을 넓혀줘」가 맵 크기를 한 번도 안 바꾸던 네 원인 중 하나).
      // 확장으로 풀 수 있으면 필요한 크기를 코드가 계산해 resize_map 경로와 함께 내려보낸다.
      const growth = errors.some((issue) => issue.code === "spec-asset-out-of-map") && Array.isArray(spec.assets)
        ? this.plannedGrowthFor(spec.mapId, spec.assets)
        : null;
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
        // Keep spec-invalid on every rejection: the existing target retry budget aggregates it.
        message: [
          ...(discarded ? [`검증 ${this.specRejections}회 실패 — 이 계획은 폐기하고 새 명세를 제출하세요.`] : []),
          ...(demanded.length > 0 ? [`기존 내용 충돌로 지적된 에셋에 ${fieldList} 필드를 넣어 set_build_spec을 재제출하세요. 보존할 내용은 영역에서 제외하세요. 이 선언은 새 에셋 간 교차를 해결하지 않습니다.`] : []),
          ...(recovery.newPlanOverlap ? [
            "새 에셋 간 교차를 고치세요: 실제 도로는 kind:\"road\"로 명시하면 road-road 교차가 허용됩니다. 같은 층 terrain-road는 buildOrder에 두 kind를 모두 넣고 terrain을 먼저 두어야 합니다. id·style·재료 라벨로 kind는 바뀌지 않습니다. terrain-terrain 겹침·중복은 어떤 순서나 overExisting으로도 허용되지 않으므로 영역을 비겹침으로 분할하세요. clear와 후속 배치의 겹침은 두 kind를 모두 넣고 clear를 먼저 두세요. 수정한 set_build_spec을 재제출하세요.",
          ] : []),
          ...(!recovery.newPlanOverlap && demanded.length === 0 ? ["지적된 필드·맵 크기·좌표를 고쳐 set_build_spec을 재제출하세요."] : []),
          ...(growth ? [growthGuidanceLine(spec.mapId, growth)] : []),
        ].join(" "),
      });
      return {
        ok: false,
        summary: `밑그림 검증 실패(${this.specRejections}회)${repeated ? " — 직전과 동일" : ""}${discarded ? " — 계획 폐기" : ""}`,
        issues,
        data: { rejections: this.specRejections, repeated, discarded, recovery },
      };
    }
    // 검증기는 "22" 같은 숫자 문자열을 받아주지만 게이트는 저장된 값을 그대로 더한다 — 경계에서 정수로 굳혀 저장한다.
    const normalized = normalizeBuildSpec(spec);
    this.rememberSpec(normalized);
    // Preserve the map-keyed turn-start snapshots for historical scope warnings.
    this.specRejections = 0;
    this.lastRejectedSpecFingerprint = null;
    const kinds = [...new Set(normalized.assets.map((asset) => asset.kind))].join("·");
    return {
      ok: true,
      summary: `밑그림 확정: ${normalized.title ?? normalized.mapId} — 에셋 ${normalized.assets.length}개(${kinds})`,
      data: normalized,
    };
  }

  /**
   * 이 에셋들을 담으려면 맵이 얼마여야 하는가 — 확장이 필요 없거나 맵을 모르면 null.
   * 숫자는 코드가 계산해 거부 응답에 실어 보낸다(모델 창작 아님).
   */
  private plannedGrowthFor(mapId: string, assets: readonly SpecAsset[]): { width: number; height: number } | null {
    const map = this.ctx.project.maps[mapId];
    if (!map) return null;
    return plannedGrowthForSpec(map, { assets: [...assets] });
  }

  // 공간 쓰기 툴 게이트. 통과하면 warning 목록, 차단이면 사유가 담긴 ToolResult.
  //
  // 두 가지 다른 계약이 겹쳐 있다:
  //  1. 스코프(밑그림 필수·자동 확장) — SPATIAL_BUILD_TOOLS 만. 명세 밖 빈 영역은 자동 확장 warning 으로 통과.
  //  2. 기존 내용 보호 — 타일을 쓰는 모든 툴(SPATIAL 의 타일 쓰기 + TILE_WRITE_TOOLS 의 v3 프리미티브).
  //     기준선(사용자 맵)에 이미 있던 지어진 칸은 밑그림 **안이라도** 에셋 선언(clear+confirmDestroy,
  //     overExisting) 없이는 덮지 않는다. 메타데이터 없는 증분 시공은 세션 안에서 다시 손댈 수 있다.
  //  3. 완성된 집 보호 — toolRunner가 현재 프로젝트의 집 메타데이터와 실제 셀을 전역 비교한다.
  //     같은 턴·새 맵도 보호하며, 선택 영역·밑그림 덮어쓰기 선언으로 해제되지 않는다.
  //     2026-09-03 적대적 리뷰: 보호가 제출 시점에만 돌아 밑그림 안에 지은 집을 같은 턴 clear 가 지웠고,
  //     확정 뒤 사용자가 판 호수를 다음 턴 채우기가 덮었고, 게이트 밖 tile_erase 가 절벽을 지웠다.
  /**
   * 2026-09-17 밑그림 스펙 게이트 해체.
   *
   * 실측(PR #892 후속 코멘트): 조수에게 마을을 맡긴 세 런에서 author_village 는 12회 중 0회 성공했다.
   * 첫 거부 사유가 "에셋 'h_1'와 'road_main'가 교차합니다" — 집 앞까지 길이 오는 게 마을인데
   * 게이트는 그 겹침을 오류로 보고, 모델이 3회 안에 규칙을 못 맞춰 계획이 폐기됐다.
   * 빌더는 집·길 좌표를 코드가 계산하는 도구인데 게이트는 그 도구 앞에서 모델이 좌표를 먼저 찍으라고
   * 요구했다. 둘 중 하나만 있어야 한다.
   *
   * 남긴 것은 하나 — 기존 구조물·물·절벽을 선언 없이 덮지 않는다. set_build_spec 은 선택 사항으로 남아
   * confirmDestroy / overExisting 을 선언하는 용도로만 쓰인다. 밑그림이 없다는 이유로 막지 않는다.
   */
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
    if (!toolWritesTiles(name)) return { warnings: [] };
    const regions = this.gateRegions(name, args);
    if (regions.length === 0) return { warnings: [] };
    const mapId = regions[0].mapId;
    const baseline = this.baselineProject.maps[mapId];
    if (!baseline) return { warnings: [] }; // 이 턴에 만든 새 맵 — 보호할 사용자 자산이 없다.
    const tileset = this.baselineProject.tilesets[baseline.tilesetId];
    const overwriteAssets = [this.getActiveSpec(mapId), this.turnImplicitSpec]
      .filter((spec): spec is BuildSpec => spec !== null && spec.mapId === mapId)
      .flatMap(spec => spec.assets);
    const guarded = protectedCellsInRegions(baseline, regions, overwriteAssets, tileset);
    if (guarded.count === 0) return { warnings: [] };
    const at = guarded.sample ? `, 예: (${guarded.sample.x},${guarded.sample.y})` : "";
    return specGateResult(`기존 구조물 보호: '${name}' 차단 — 기존 구조물·지형 ${guarded.count}칸을 덮습니다${at}`, [
      "일반 구조물·물·절벽은 선언 없이 덮지 않습니다. 메타데이터로 기록된 완성된 집은 별도로 보호됩니다.",
      "완성된 집 밖의 철거가 의도면 clear 에셋에 confirmDestroy:true 를, 그 위에 지을 거면 배치 에셋에 overExisting:\"clear\"|\"keep\" 을 넣은 set_build_spec 을 제출하세요.",
      "기존 것을 피하려면 영역을 좁히세요.",
    ]);
  }

  private gateRegions(name: string, args: Record<string, unknown>): AffectedRegion[] {
    if (name === "paint_tiles" && args.mode === "fill" && typeof args.mapId === "string") {
      const map = this.ctx.project.maps[args.mapId];
      if (map) return [{ mapId: args.mapId, x: 0, y: 0, w: map.width, h: map.height }];
    }
    return affectedRegions(name, args);
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
      runIdentity: this.getRunIdentity(),
      model: this.config.model,
      ...(this.config.liteModel ? { liteModel: this.config.liteModel } : {}),
      maxTokens: this.config.maxTokens,
      messages: this.messages.map((message) => ({ ...message })),
      audit: [...this.audit],
      workPlan: this.workPlan ? structuredClone(this.workPlan) : null,
      acceptance: this.getAcceptanceSnapshot(),
      verification: this.getVerificationSnapshot(),
      runEndProof: this.getRunEndProof(),
      resultReview: this.getResultReview(),
      runOutcome: this.getRunOutcome(),
    };
  }

  async sendUserMessage(
    text: string,
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal,
    opts?: SessionTurnOptions,
  ): Promise<TurnResult> {
    // Capture content eligibility before replacement retires the previous review's signal.
    const reviewedDraftAtEntry = this.isDraftReviewApproved() ? this.approvedReviewIdentity : null;
    const operation = this.beginRunOperation(signal);
    if (!operation) return { assistantText: "", proposedCalls: [], stoppedReason: "aborted",
      runOutcome: deriveRunOutcome({ execution: "cancelled", acceptance: null, hasPendingDraft: false, hasApplied: false, persistence: "none" }) };
    signal = operation.signal;
    this.eventCommandScope = opts?.eventCommandScope ? structuredClone(opts.eventCommandScope) : undefined;
    this.recoveryOperation = opts?.driverContinue && this.recoveredCheckpoint ? operation : null;
    if (this.recoveryOperation !== operation) { this.recoveredCheckpoint = null; this.recoveryBudget = null; }
    const subscriber = onEvent;
    let authoring = true;
    onEvent = event => {
      if (!authoring || operation.signal.aborted || owner.settled) return;
      // 사건마다 캡처하면 쓰기마다 프로젝트 여러 벌이 복제된다 — 실측(2026-09-09,
      // late-cancel A/B): 이 한 줄이 실행 시간의 30초를 썼다(144.6초 → 112.8초).
      // 저작 결과가 실제로 바뀌는 사건(tool_call)만 남긴다. work_plan·acceptance 변화는
      // 다음 tool_call 이나 적용·저장·증명 경계의 캡처에 그대로 실린다.
      if (event.type === "tool_call") this.captureCheckpoint();
      subscriber(event);
      operation.assertCurrent();
    };
    // 자율 드라이버: opts.autonomous === true 일 때만 진입한다(명시 플래그 — 플래그 없는 기존
    // 호출처(영역 작업·클러스터 모달·평가 러너)는 종전대로 턴 1개로 끝난다). 패널·MCP 브리지는
    // 패널의 sendText 가 autonomous:true 를 주므로 같은 진입점을 공유하고, 브리지 코드는 불변이다.
    // 사용자의 수동 진입(새 sendUserMessage 호출)은 예산 카운터를 0으로 되돌린다(re-arm).
    // 마일스톤 자동 적용도 같은 명시 플래그로만 켠다. 직전 턴의 커밋 게이트 실패는
    // 현재 자율 런만 중단하는 상태이므로 새 사용자 메시지에서 반드시 재가동한다.
    this.verificationEvidence.expireApproachPreview();
    this.activeTurnSignal = signal;
    // A send owns a new attempt even when preparation fails before the writer loop.
    // Keep detached work/evidence for authorized resume, never prior apply authority.
    this.reviewTurn = null;
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    this.resultReview = null;
    this.consumedApprovedRevision = null;
    this.runResult = { current: null, settled: false };
    const owner = this.runResult;
    this.runSubscriber = subscriber;
    this.runRecapAuditIndex = null;
    // Explicit Ask owns publication even if preparation fails before intent is declared.
    this.turnComposerMode = opts?.composerMode ?? "do";
    const entryInstruction = (opts?.instruction ?? stripContextFooter(text)).trim();
    const retainsAppliedDelivery = opts?.composerMode !== "ask" && opts?.goalAction !== "new-goal"
      && (opts?.goalAction === "resume" || isContinuationText(entryInstruction));
    // Establish delivery ownership before context/image/intent work can await or fail.
    if (!retainsAppliedDelivery) this.clearAppliedDelivery();
    this.runExecution = "response-final";
    const startsGoal = opts?.goalAction === "new-goal" && opts.composerMode !== "ask";
    if (startsGoal) {
      // Retire the canonical owner before preparatory awaits (or rebase) can fail.
      // Archive its last immutable assessment, not a new evaluation under this request.
      const previous = this.getAcceptanceSnapshot();
      if (previous) this.acceptanceHistory.push(previous);
      this.imageEvidence.clear();
      this.acceptance = null;
      this.acceptanceAppliedProject = null;
      this.workPlan = null;
      this.verificationEvidence.clear();
      this.statefulNpcRequirement = false;
      this.reviewAttempts = 0;
      this.lastReviewFailure = null;
      this.reviewToolResults = [];
      // Retire both pending apply authority and its detached payload before preparation.
      // Applied store content survives; detached sessions keep their own accepted baseline.
      this.rebaseProject(this.storeBacked ? store.getCurrent() : this.baselineProject);
      this.reviewBaseline = structuredClone(this.ctx.project);
      this.originalContext = null;
      this.readEvidence.begin(undefined);
      this.rebuildSystemPrompt();
    }
    this.milestoneAutoApply = opts?.autonomous === true && !this.eventCommandScope;
    if (this.milestoneApplyFailed && !this.staleProposal) {
      // 실패한 proposed draft를 다음 턴으로 가져가면 같은 커밋 오류가 반복된다. 저장소는 실패
      // 당시 바뀌지 않았으므로 canonical store에서 세션 draft를 다시 시작한다.
      this.rebaseProject(store.getCurrent());
    } else {
      this.milestoneApplyFailed = false;
    }
    const startedAt = Date.now();
    const usageBefore = this.usageTotals;
    const auditFrom = this.audit.length;
    let cancelled: TurnResult | undefined;
    const cancel = (): TurnResult => {
      if (owner.settled && owner.current) return owner.current;
      if (cancelled) return cancelled;
      this.runExecution = "cancelled";
      this.removeOrchestrationMessages();
      this.settleCancelledToolCalls();
      cancelled = this.withTurnLedger({ assistantText: "", proposedCalls: this.finalizeProposals(this.turnProposals), stoppedReason: "aborted" });
      cancelled = this.finishRunRecap(cancelled, startedAt, usageBefore, auditFrom, subscriber);
      return cancelled;
    };
    this.cancelPendingRun = cancel;
    const turnOptions: SessionTurnOptions = {
      ...(opts?.goalAction ? { goalAction: opts.goalAction } : {}),
      ...(opts?.instruction !== undefined ? { instruction: opts.instruction } : {}),
      scope: opts?.scope ?? null,
      composerMode: opts?.composerMode ?? "do",
      ...(this.recoveryOperation === operation ? { driverContinue: true } : {}),
    };
    // 백그라운드 탭이 얼면 런이 통째로 선다(fetch 기반이라 타이머 스로틀로는 설명되지 않는다).
    // 런 수명 — 플래너 라운드부터 자율 드라이버·회수까지 — 동안만 keep-alive 를 쥔다.
    // 획득 실패는 런을 막지 않는다: 이 가드는 편의일 뿐 실행 조건이 아니다.
    const releaseFreezeGuard = await this.freezeGuard().catch(() => () => {});
    try {
      // Refresh before any tool can author NPC dialogue; never silently use stale host mappings.
      if (typeof window !== "undefined" && typeof location !== "undefined") {
        await refreshSharedCharacterGraphics(signal);
        operation.assertCurrent();
      }
      await this.beginCheckpoint(entryInstruction, text, turnOptions);
      operation.assertCurrent();
      if (this.recoveryOperation === operation && (this.workPlan ? isWorkPlanComplete(this.workPlan)
        : this.recoveredCheckpoint?.applied !== null || this.recoveredCheckpoint?.pending?.stage === "applying")) {
        // Scheduling already finished before interruption. Assess current content, never rerun old creates.
        return await this.finishAssessedRunRecap(this.withTurnLedger({ assistantText: "복원된 변경은 다시 적용하지 않았습니다.",
          proposedCalls: [], stoppedReason: "final" }), startedAt, usageBefore, auditFrom, subscriber);
      }
      if (startsGoal) {
        this.acceptanceRequestBaseline = structuredClone(this.baselineProject);
        this.acceptanceRequestSource = { requestId: `request-${this.currentTurnIndex + 1}`, text: entryInstruction,
          scope: turnOptions.scope ? structuredClone(turnOptions.scope) : null };
        // This is the new host-owned goal retirement, not late authoring publication.
        subscriber({ type: "acceptance", snapshot: null });
      }
      operation.assertCurrent();
      if (!this.verificationEvidence.hasLintBaseline()) {
        // Pin actual host lint against the existing pre-write project baseline before
        // preparation/model tools can mutate or rebase it. Only a new goal clears it.
        try {
          this.verificationEvidence.captureLintBaseline({ ok: true, ...runProjectLint(this.baselineProject, {}) });
        } catch (cause) {
          this.verificationEvidence.captureLintBaseline({ ok: false });
          const text = `verification:baseline-unavailable ${cause instanceof Error ? cause.message : String(cause)}`;
          this.pushAudit({ kind: "status", text });
          onEvent({ type: "status", text });
        }
      }
      operation.assertCurrent();
      const first = await operation.wait(this.executeUserTurn(text, onEvent, signal, turnOptions, reviewedDraftAtEntry));
      const last = opts?.autonomous === true && !this.eventCommandScope && !this.lastTurnPlanOnly && this.turnComposerMode !== "ask"
        ? await operation.wait(this.runAutonomousDriver(first, onEvent, signal, turnOptions)) : first;
      if (signal?.aborted) this.runExecution = "cancelled";
      return await this.finishAssessedRunRecap(last, startedAt, usageBefore, auditFrom, subscriber);
    } catch (cause) {
      if (owner.settled && owner.current) {
        if (isLlmAbortError(cause)) return owner.current;
        throw cause;
      }
      if (operation.signal.aborted) return cancelled ?? cancel();
      this.runExecution = signal?.aborted || isLlmAbortError(cause) ? "cancelled" : "failed";
      const error = cause instanceof Error ? cause.message : String(cause);
      this.pushAudit({ kind: "status", text: `turn-boundary-error ${error}` });
      return await this.finishAssessedRunRecap(this.withTurnLedger({ assistantText: "", error,
        proposedCalls: this.finalizeProposals(this.turnProposals),
        stoppedReason: this.runExecution === "cancelled" ? "aborted" : "error",
      }), startedAt, usageBefore, auditFrom, subscriber);
    } finally {
      releaseFreezeGuard();
      authoring = false;
      if (this.cancelPendingRun === cancel) this.cancelPendingRun = undefined;
    }
  }

  /**
   * 자율 실행 드라이버 — 턴이 끝난 뒤 조건이 유지되는 동안 하니스가 스스로 다음 턴을 송신한다.
   * 사용자의 수동 진입(다음 sendUserMessage 호출)은 예산 카운터를 0으로 되돌린다(re-arm).
   */
  private async runAutonomousDriver(
    first: TurnResult,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal,
    options: SessionTurnOptions = {},
  ): Promise<TurnResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    if (this.recoveryOperation !== operation) this.autoRunSteps = 0;
    let last = first;
    while (this.shouldAutoContinue(last, onEvent, signal)) {
      this.autoRunSteps += 1;
      this.pushAudit({ kind: "status", text: `agent_run:auto-continue step=${this.autoRunSteps}/${AGENT_RUN_MAX_TOTAL_STEPS}` });
      onEvent({
        type: "status",
        text: `자율 실행 계속 (${this.autoRunSteps}/${AGENT_RUN_MAX_TOTAL_STEPS})`,
      });
      const next = await operation.wait(this.executeUserTurn("계속", onEvent, signal, { ...options, instruction: "계속", driverContinue: true }));
      if (next.stoppedReason === "aborted" || next.stoppedReason === "error") return next;
      last = next;
    }
    if (last.stoppedReason !== "aborted" && last.stoppedReason !== "error") {
      await operation.wait(this.maybeRunEndProof(onEvent, signal));
    }
    return last;
  }

  /** 드라이버 계속 판정 — 계획 미완료 && 예산 잔여 && 사용자 대기 없음 && 중단 아님. */
  private shouldAutoContinue(last: TurnResult, onEvent: (event: SessionEvent) => void, signal?: AbortSignal): boolean {
    if (signal?.aborted) { this.runExecution = "cancelled"; return false; }
    if (last.stoppedReason === "aborted" || last.stoppedReason === "error") return false;
    // 저장소를 바꾸지 못한 마일스톤이 있으면 현재 자율 런을 멈춘다. 승인 UI는 없으며,
    // 다음 사용자 메시지가 새 턴을 시작하면 다시 적용을 시도할 수 있다.
    if (this.milestoneApplyFailed) {
      this.pushAudit({ kind: "status", text: "agent_run:stopped-apply-failed — 마일스톤 적용 실패로 현재 자율 실행을 멈춥니다 (프로젝트 저장소 변경 없음)" });
      return false;
    }
    if (this.reviewAttempts >= MAX_RALPH_ATTEMPTS_PER_ITEM || this.acceptanceRepairAttempts >= MAX_RALPH_ATTEMPTS_PER_ITEM) return false;
    const acceptanceOpen = this.acceptanceOpen();
    const verificationOpen = this.explicitVerificationOpen();
    const volumeOpen = this.volumeUnmetNow();
    if ((!this.workPlan || isWorkPlanComplete(this.workPlan)) && !volumeOpen && !acceptanceOpen && !verificationOpen) return false;
    if (this.autoRunSteps >= AGENT_RUN_MAX_TOTAL_STEPS) {
      this.runExecution = "budget-exhausted";
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
      this.runExecution = "awaiting-user";
      this.pushAudit({ kind: "status", text: "agent_run:paused-user-message — 대기 중 사용자 메시지가 자동 계속보다 우선합니다" });
      return false;
    }
    // Ralph 지속 판정을 그대로 재사용(두 번째 휴리스틱을 만들지 않는다). autoStepsUsed=0 은
    // 다음 턴을 시작해도 되는가(턴 시작 시점)의 판정이고, assistantText 는 직전 턴이 사용자
    // 질문으로 끝났는지 판별한다 — 질문이면 false(문의 대기, 자동 송신 금지).
    const assistantText = this.rawLastTurnAssistantText(last);
    if (this.workPlan && !isWorkPlanComplete(this.workPlan)) {
      return this.recordWorkPlanDecision(ralphContinuationDecision(this.workPlan, { autoStepsUsed: 0, assistantText }));
    }
    // 계획이 끝났거나 없어도 볼륨 막대가 비면 코드가 다음 턴을 연다. 사용자 「계속」이 아니다.
    if (volumeOpen && assistantTextLooksLikeQuestion(assistantText)) {
      this.runExecution = "awaiting-user";
      return false;
    }
    return volumeOpen || acceptanceOpen || verificationOpen;
  }

  /** Carry the actual scheduling decision; never run another text classifier for projection. */
  private recordWorkPlanDecision(decision: RalphContinuationDecision): boolean {
    const executionByDecision = {
      continue: null, complete: null, blocked: "blocked", "budget-exhausted": "budget-exhausted", "awaiting-user": "awaiting-user",
    } as const satisfies Record<RalphContinuationDecision, RunOutcome["execution"] | null>;
    const execution = executionByDecision[decision];
    if (execution !== null) this.runExecution = execution;
    return decision === "continue";
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
    reviewedDraftAtEntry: string | null = null,
  ): Promise<TurnResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    this.runExecution = "response-final";
    this.acceptanceApplyPending = false;
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
    const userContent = await operation.wait(this.buildUserTurnContent(text));
    this.messages.push({ role: "user", content: userContent });
    this.pushAudit({ kind: "user", text, context: turnContext });
    // 사용자 발화만 따로 든다. `[컨텍스트]` footer 는 코드가 아는 사실이라 모델에는 그대로 가지만,
    // 의도 선언·툴 이름 언급·능력 승격의 입력은 사용자 말이어야 한다 — 기계 텍스트가 이 자리에
    // 섞여 들어 라우팅이 어긋났던 것이 2026-09-03 감사의 근인이었다.
    const instruction = (options.instruction ?? stripContextFooter(text)).trim();
    // 합성 "계속"은 라우팅 입력일 뿐이다. 검수·완성도 검사에는 이 런의 원래 요청을 유지한다.
    if ((!options.driverContinue && !isContinuationText(instruction)) || !this.currentTurnRequestText) {
      this.currentTurnInstruction = instruction;
      this.currentTurnRequestText = text;
    }
    this.turnScope = options.scope ?? null;
    this.turnComposerMode = options.composerMode ?? "do";
    this.turnFullCatalogFallback = false;
    this.planAuthoredThisTurn = false;
    this.lastTurnPlanOnly = false;
    this.turnIsDriverContinue = options.driverContinue === true;
    this.skipPlannerRoundOnly = false;
    if (this.prepareProjectWiki && !this.turnIsDriverContinue && !this.eventCommandScope) {
      const owner = this.runResult;
      try {
        const world = await operation.wait(this.prepareProjectWiki({
          text: instruction,
          mapId: turnContext.mapId,
          composerMode: this.turnComposerMode,
          signal,
          onDelivery: (milestone) => {
            if (owner !== this.runResult) return;
            if (milestone.kind === "applied") {
              this.wikiDelivery = { owner, project: milestone.project, receipt: null };
              if (milestone.project) this.checkpointCurrentIdentity = this.identityOf(milestone.project);
              this.lastAppliedProject = null;
              this.runReceipt = null;
            } else if (this.wikiDelivery?.owner === owner && this.wikiDelivery.project === milestone.project
              && store.isPersistenceReceiptForProject(milestone.receipt, milestone.project)) {
              this.wikiDelivery.receipt = milestone.receipt;
            }
            this.publishRunOutcome();
          },
        }));
        if (world && "kind" in world) {
          const text = `wiki:deferred ${world.reason} — 프로젝트 기록 갱신을 보류했습니다. 기존 기록으로 요청을 계속합니다.`;
          this.pushAudit({ kind: "status", text });
          onEvent({ type: "status", text });
        } else if (world) {
          this.baselineProject.world = structuredClone(world);
          this.ctx.project.world = structuredClone(world);
          this.observedLiveWorld = structuredClone(world);
        } else {
          delete this.baselineProject.world;
          delete this.ctx.project.world;
          this.observedLiveWorld = undefined;
        }
        // Deferral never bypasses the live authored-baseline gate or adopts a late patch.
        if (!this.draftBaselineCurrent || !this.draftBaseline.matches(this.baselineProject)) {
          throw new Error("independent-review-stale-baseline: regenerate from the current project before review");
        }
        this.draftBaseline = new AuthoredProjectBaseline(this.baselineProject);
        this.rebuildSystemPrompt();
      } catch (cause) {
        operation.assertCurrent();
        const error = cause instanceof Error ? cause.message : String(cause);
        const stoppedReason = signal?.aborted ? "aborted" : "error";
        this.runExecution = signal?.aborted ? "cancelled" : "failed";
        this.pushAudit({ kind: "status", text: `프로젝트 기록 준비 실패: ${error}` });
        onEvent({ type: "status", text: `프로젝트 기록을 확인하지 못했습니다: ${error}` });
        return { assistantText: "", proposedCalls: [], stoppedReason, error };
      }
    }
    // 의도 선언: 모델이 한 번 읽어 구조화한다(수정/생성·실내/야외·시설·되묻기·계획·툴). 코드는 이 선언만
    // Neutral fallback retains the full tool catalog when declaration is unavailable.
    // 질문 모드는 사용자가 직접 고른 사실이라 선언의 create/modify 를 덮어쓴다 — 안 그러면 플래너·쓰기 기대가 문장 판정으로 돈다.
    const intent = this.applyComposerModeToIntent(await operation.wait(this.declareTurnIntent(instruction, onEvent, signal)));
    this.turnIntent = intent;
    // A failed routing declaration has no safe domain hint. Preserve the old
    // reliability behavior for that turn; normal LLM declarations use the
    // control plane and can discover missing schemas incrementally.
    this.turnFullCatalogFallback = intent.source === "fallback";
    if (intent.mode === "question") this.turnComposerMode = "ask";
    const question = this.turnComposerMode === "ask";
    const userAction = !this.turnIsDriverContinue && !question;
    if (userAction && this.staleProposal) {
      // A rejected preview remains inspectable through Ask. A new authorized
      // authoring turn recalculates from live data; it never replays old calls.
      this.rebaseProject(store.getCurrent());
      // The new review compares AI work with the latest human-authored base,
      // never mistakes those human edits for unreviewed AI changes.
      this.reviewBaseline = structuredClone(this.ctx.project);
      this.reviewToolResults = [];
      this.originalContext = null;
      this.readEvidence.begin(undefined);
      this.rebuildSystemPrompt();
    }
    // The public entry already established this owner; model routing cannot undo it.
    const startsGoal = !this.turnIsDriverContinue && options.goalAction === "new-goal" && options.composerMode !== "ask";
    const resumesGoal = userAction && (options.goalAction === "resume" || isContinuationText(instruction));
    const newRequest = userAction && !resumesGoal && intent.source !== "continuation";
    // Delivery follows host-authorized continuation, never a model's source claim or a fresh query.
    if (!this.turnIsDriverContinue && (!resumesGoal || startsGoal)) this.clearAppliedDelivery();
    if (newRequest && !startsGoal) {
      // New-goal entry captured before awaits; continuations and questions retain their baseline.
      this.acceptanceRequestBaseline = structuredClone(this.baselineProject);
      this.acceptanceRequestSource = { requestId: `request-${this.currentTurnIndex + 1}`, text: instruction,
        scope: this.turnScope ? structuredClone(this.turnScope) : null };
    }
    if (resumesGoal || startsGoal) {
      this.ralphAttemptsByItemId.clear();
      this.lastBlockReasonByItemId.clear();
      this.repeatedToolFailures.clear();
      this.acceptanceRepairAttempts = 0;
      this.reviewAttempts = 0;
      this.lastReviewFailure = null;
      this.acceptance?.resume();
      if (resumesGoal && this.workPlan) {
        const revived = reactivateBlockedWorkItems(this.workPlan);
        if (revived > 0) {
          this.pushAudit({ kind: "status", text: `work-item:reactivated ${revived}건 — 사용자 메시지로 재시도` });
          this.emitWorkPlan(onEvent);
        }
      }
      this.publishAcceptance(onEvent);
    }
    if (newRequest || startsGoal) {
      this.adventureRequirements = intent.adventure;
      this.npcRewardRequirements = intent.npcRewards === undefined ? undefined : structuredClone(intent.npcRewards);
      this.npcRewardWitnesses.clear();
      this.adventureIconRecords.clear();
      this.readEvidence.begin(intent.readBeforeWrite);
      this.completionQualityRequired = false;
    }
    if (userAction && !startsGoal && intent.source === "llm") {
      const source: AcceptanceSource = { requestId: `request-${this.currentTurnIndex + 1}`, text: instruction,
        scope: this.turnScope ? structuredClone(this.turnScope) : null };
      const refinements = intent.functionalRefinements ?? [];
      const refined = this.acceptance?.refineFunctionals(refinements, source) === true;
      for (const refinement of refinements) {
        this.pushAudit({ kind: "status", text: `functional:refinement-${refined ? "accepted" : "rejected"} ${refinement.requirementId}:${refinement.criterionIndex ?? 0}` });
      }
      this.publishAcceptance(onEvent);
    }
    const functional: FunctionalCriterion[] = [];
    if (!question && (newRequest || startsGoal)) {
      if (intent.functionalAcceptance) functional.push(...parseFunctionalRequirements(intent.functionalAcceptance));
      const rewards = this.npcRewardRequirements;
      if (rewards) {
        if ("invalidReason" in rewards) functional.push({ kind: "functionalUnresolved", reason: rewards.invalidReason });
        else if (rewards.length === 0) functional.push({ kind: "functionalUnresolved", reason: "npcRewards: missing requirements" });
        else functional.push(...rewards.map((requirement): FunctionalCriterion => ({ kind: "npcReward", requirement })));
      }
      if (functional.length) this.adoptAcceptance(functional.map((criterion, index) => ({
        id: `${this.acceptanceRequestSource.requestId}:functional:${index}`, title: criterion.kind,
        required: true, criteria: [criterion],
      })), onEvent);
    }
    if (userAction && intent.requestRequirements?.length) {
      // Reuse the canonical functional promise when the independent audit agrees;
      // missing clauses add obligations, never a second completion system.
      const source: AcceptanceSource = { requestId: `request-${this.currentTurnIndex + 1}`, text: instruction,
        scope: this.turnScope ? structuredClone(this.turnScope) : null };
      const declared = new Set(functional.map(criterion => acceptanceFingerprint(criterion)));
      const coverage = intent.requestRequirements?.flatMap((requirement, index) => requirement.criteria
        .flatMap((criterion, criterionIndex) => declared.has(acceptanceFingerprint(criterion)) ? [] : [{
          id: `${source.requestId}:coverage:${index}:${criterionIndex}`, title: requirement.text,
          required: true, criteria: [criterion],
        }]));
      if (coverage?.length) this.adoptAcceptance(coverage, onEvent, {
        source, baseline: newRequest || startsGoal ? this.acceptanceRequestBaseline : this.baselineProject,
      });
    }
    if (!question && intent.statefulNpcs === true) this.statefulNpcRequirement = true;
    if (intent.actionCombat && intent.mode !== "question") {
      this.adoptAcceptance([], onEvent);
      this.acceptance?.requireActionCombat(intent.actionCombat.targets, this.acceptanceRequestBaseline);
      this.publishAcceptance(onEvent);
    }
    beginAssistantToolDomainTurn(intent);

    // 스펙 게이트 턴 초기화: 사용자 선택 영역([컨텍스트])은 이 턴의 암묵적 명세가 된다.
    this.currentTurnIndex += 1;
    const continuesGoal = !startsGoal && (question || resumesGoal || this.turnIsDriverContinue || intent.source === "continuation");
    this.turnImplicitSpec = implicitSpecFromContext(text)
      ?? implicitSpecFromScope(options.scope);
    if (!continuesGoal) {
      this.turnViewSpec = this.turnImplicitSpec ? null : this.implicitSpecFromViewPhrase(instruction);
      this.turnViewSpecWorkItemId = null;
    }
    this.carryoverSpecsForTurn = new Map([...this.specsByMap]
      .filter(([, entry]) => entry.turnIndex < this.currentTurnIndex)
      .map(([mapId, entry]) => [mapId, structuredClone(entry.spec)]));
    this.carryoverWarningsAdded.clear();
    this.specRejections = 0;
    this.lastRejectedSpecFingerprint = null;
    if (!continuesGoal) {
      // Retain an unchanged previously reviewed draft as content, not apply authority.
      // The entry already retired that authority; unreviewed unrelated drafts still drop.
      if (this.turnProposals.size > 0 && reviewedDraftAtEntry !== JSON.stringify(this.ctx.project)) this.ctx = { project: cloneDetachedDraft(this.baselineProject) };
      this.reviewBaseline = structuredClone(this.ctx.project);
      this.reviewToolResults = [];
      this.resultReview = null;
      this.approvedReviewIdentity = null;
      this.approvedAuthoredIdentity = null;
      this.consumedApprovedRevision = null;
      this.reviewAttempts = 0;
      this.lastReviewFailure = null;
    }
    const retainsOriginal = !startsGoal && (resumesGoal || this.turnIsDriverContinue || intent.source === "continuation");
    if (!retainsOriginal || !this.originalContext) {
      const scope = this.turnScope;
      this.originalContext = new OriginalContextStore(extractOriginalContext(this.ctx.project, {
        snapshotId: `original-${this.currentTurnIndex}`,
        currentMapId: resolveContextMapId(this.contextOptions) ?? turnContext.mapId ?? undefined,
        selection: scope ? { mapId: scope.mapId, ...scope.region } : turnContext.selection,
        intent,
      }));
    }
    // A tool budget splits execution, not the work item. Keep unapplied calls and
    // artifact evidence until that item completes (or a different goal starts).
    if (!continuesGoal) this.turnProposals = new Map();
    // Delivery is already owned by host intent above, including explicit Continue.
    // Detached appearance handoffs remain turn-scoped, not delivery authority.
    if (!options.driverContinue) this.turnAppearanceGeneration = undefined;

    this.turnWriteDedupe = new Map();
    this.turnToolStartedCount = 0;
    this.turnEscalatedToolNames = [];
    this.compactionAttemptedThisTurn = false;
    if (!continuesGoal) this.resetWorkItemEvidence();
    this.syncSuccessfulToolsToCurrentWorkItem();
    // 볼륨 막대는 플래너가 계획과 함께 선언한 것만 남는다. 이어가기(계속)는 유지, 새 요청은 풀어 준다.
    if (!question && !resumesGoal) this.releaseVolumeContractForNewRequest(intent);
    if (this.recoveryOperation !== operation) this.volumeContinueUsed = 0;
    this.eventBaseProposalKeys = new Map();
    this.skipPlannerThisTurn = false;

    const rewardRequirements = question ? undefined : this.npcRewardRequirements;
    if (rewardRequirements && ("invalidReason" in rewardRequirements || rewardRequirements.length === 0)) {
      const reason = "invalidReason" in rewardRequirements ? rewardRequirements.invalidReason : "npcRewards: missing requirements";
      const assistantText = `보상 요구사항을 해석하지 못해 편집을 시작하지 않았습니다.\n${reason}\n다시 시도해 주세요.`;
      this.lastTurnFailed = true;
      this.messages.push({ role: "assistant", content: assistantText });
      this.runExecution = "failed";
      this.pushAudit({ kind: "status", text: `intent:invalid-npc-rewards ${reason}` });
      this.pushAudit({ kind: "assistant", text: assistantText });
      onEvent({ type: "assistant_message", content: assistantText });
      return { assistantText, proposedCalls: [], stoppedReason: "error" };
    }

    // 되묻기: 선언이 질문을 냈을 때만, chat 모드에서만 멈춘다.
    // F-05: auto/orchestrated 모드에서는 멈추지 않고 진행한다 — 의도 노트가 「되묻지 말고 택하라」고 알린다.
    let clarifyBypassed = false;
    if (intent.clarify) {
      const shouldBypassClarify = this.config.agentMode === "auto" || this.orchestrationEnabled();
      if (shouldBypassClarify) {
        clarifyBypassed = true;
        this.pushAudit({ kind: "status", text: `의도 확인 건너뜀: ${intent.clarify} — auto/orchestrated` });
      } else {
        this.runExecution = "awaiting-user";
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
    // 대상 맵의 실제 크기는 코드가 아는 사실이다 — 노트가 "지금 얼마인데 얼마가 필요하다"를 말할 수 있게 넘긴다.
    const noteTargetMapId = intent.targetMapId ?? resolveContextMapId(this.contextOptions) ?? null;
    const noteTargetMap = noteTargetMapId ? this.ctx.project.maps[noteTargetMapId] : undefined;
    const intentNote = formatIntentNote(intent, {
      clarifyBypassed,
      targetMap: noteTargetMap ? { id: noteTargetMap.id, width: noteTargetMap.width, height: noteTargetMap.height } : null,
    });
    if (intentNote) this.pushOrchestrationMessage(intentNote);
    const actionRecipe = selectActionArenaAuthoringRecipe(intent);
    if (actionRecipe) this.pushOrchestrationMessage(buildActionArenaAuthoringGuide(actionRecipe));
    // 선택 사각형은 사실이다 — 선언이 그 안에서 작업한다고 했으면 경계를, 새 맵/실내 시공이면 참고용임을 알린다.
    if (this.turnScope) this.pushOrchestrationMessage(formatScopeNote(this.turnScope, intent));

    // Orchestrator (main LLM): multi-step plan decision — harness does not regex-plan.
    if (this.recoveryOperation !== operation) this.workPlanAutoStepsThisUserMessage = 0;
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
        await operation.wait(this.runOrchestratorPlanner(text, onEvent, signal));
      } catch (cause) {
        operation.assertCurrent();
        // 플래너 라운드 중 사용자 중단 — 본문 루프의 중단 계약(stoppedReason "aborted")과
        // 동일하게 반환한다. agentMode=auto 로 플래너가 상시 돌면서 이 경로가 도달 가능해졌다.
        if (isLlmAbortError(cause) || signal?.aborted) {
          this.lastTurnFailed = false;
          this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
          this.runExecution = "cancelled";
          return { assistantText: "", proposedCalls: [], stoppedReason: "aborted", error: "사용자가 중단했습니다" };
        }
        throw cause;
      }
    }

    // 다이얼 confirm(planOnly): 계획 모드와 같은 종료 — 계획만 세우고 「계속」을 기다린다.
    // 이미 세운 계획이 있는 「계속」 턴(resume)은 그대로 실행된다(finishPlanOnlyTurn 은
    // 미완성 계획에만 해당하므로 재진입 시 실행 경로로 떨어진다).
    const autonomyPlanOnly = this.autonomy()?.planOnly === true;
    if ((this.turnComposerMode === "plan" || autonomyPlanOnly) && this.planAuthoredThisTurn && this.workPlan && !isWorkPlanComplete(this.workPlan)) {
      this.removeOrchestrationMessages();
      return this.finishPlanOnlyTurn(onEvent);
    }

    try {
      const result = await operation.wait(this.runTurnLoop(onEvent, signal));
      return this.withTurnLedger(this.withWorkPlanResult(result));
    } finally {
      if (this.runOperation === operation) this.removeOrchestrationMessages();
    }
  }

  /** 질문 모드는 선언을 「질문·단일 단계」로 고정한다. 다른 모드는 선언 그대로. */
  private applyComposerModeToIntent(intent: IntentDeclaration): IntentDeclaration {
    if (this.turnComposerMode !== "ask") return intent;
    if (intent.mode === "question" && !intent.needsPlan && !intent.npcRewards && !intent.functionalAcceptance && !intent.functionalRefinements && !intent.requestRequirements) return intent;
    this.pushAudit({ kind: "status", text: `composer:ask 선언 mode=${intent.mode}→question needsPlan=${intent.needsPlan}→false` });
    return { ...intent, mode: "question", needsPlan: false, npcRewards: undefined, functionalAcceptance: undefined, functionalRefinements: undefined, requestRequirements: undefined };
  }

  /** 계획 모드: 계획 카드를 내고 실행 없이 턴을 끝낸다. 「계속」이 다음 턴에서 resume 으로 실행한다. */
  private finishPlanOnlyTurn(onEvent: (event: SessionEvent) => void): TurnResult {
    this.runExecution = "awaiting-user";
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
    const operation = this.runOperation;
    operation.assertCurrent();
    if (!instruction) return emptyIntentDeclaration();
    const hasActivePlan = Boolean(this.workPlan && !isWorkPlanComplete(this.workPlan)) || this.acceptanceOpen() || this.explicitVerificationOpen();
    const scope = this.turnScope;
    const selection = scope
      ? { mapId: scope.mapId, x: scope.region.x, y: scope.region.y, width: scope.region.width, height: scope.region.height }
      : this.getTurnSelection?.() ?? null;
    const facts = buildIntentFacts({
      project: this.ctx.project,
      // 코드가 붙인 `[컨텍스트]` footer 는 사용자 발화가 아니다. 이걸 그대로 두면 커버리지 감사가
      // "인용되지 않은 요청 텍스트" 로 계산해 **닫을 수 없는** functionalUnresolved 항목을 만들고,
      // 모델이 그걸 닫으려다 라운드 예산을 태운다(실측 2026-09-16: DB 턴 16라운드 중 repair_acceptance
      // 실패 5회, 초안이 검토에 닿지 못했다). footer 의 사실은 currentMapId·selection 으로 따로 간다.
      userText: stripContextFooter(instruction),
      currentMapId: resolveContextMapId(this.contextOptions) ?? null,
      selection,
      hasActivePlan,
      unresolvedFunctional: this.acceptance?.getUnresolvedFunctional(),
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
    const outcome = await operation.wait(declareIntentCached(this.declareIntent, facts, signal));
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
    // 다이얼 confirm(planOnly): 계획 모드처럼 플래너를 항상 돌린다 — 그래야 계획만 세우고
    // 멈추는 확인 중심 턴이 성립한다. 미지정 config 는 아래 종래 스킵 그대로.
    if (this.autonomy()?.planOnly) return null;
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
    const operation = this.runOperation;
    operation.assertCurrent();
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
      this.npcRewardNote() ?? "",
    ].join("\n");

    let raw = "";
    try {
      // Always main model — not lite. No tools. Planner is pure cognition.
      const result = await operation.wait(this.chatWithTransientRetry(
        this.config,
        {
          messages: buildGroundedRequest([
            { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildOrchestratorUserPayload({
                userText: text,
                activePlan: this.workPlan,
                projectSummary,
                // 선언이 이미 정한 신축/수정·다단계 여부를 플래너도 봐야 한다 — 안 실으면 플래너는
                // 짧은 신축 요청("마을을 만들어")을 파사드 한 호출로 읽고 1항목을 낸다(2026-09-09 진단).
                intent: this.turnIntent,
              }),
            },
          ], [], this.config, this.originalContext!).messages,
        },
        onEvent,
        signal,
        false
      ));
      raw = typeof result.message.content === "string" ? result.message.content : "";
    } catch (cause) {
      operation.assertCurrent();
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
    const plan = workPlanFromOrchestratorDecision(decision, new Date(), this.planTargetMapId(text));
    const rejection = this.preflightWorkPlan(plan);
    if (rejection) {
      const text = JSON.stringify(rejection);
      this.pushOrchestrationMessage(text);
      onEvent({ type: "status", text });
      this.emitWorkPlan(onEvent);
      return;
    }
    this.workPlan = plan;
    this.adoptPlanAcceptance(onEvent);
    this.resetWorkItemEvidence();
    this.lastMilestoneCompletionItemId = null;
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
    this.adoptPlanAcceptance(onEvent);
    this.resetWorkItemEvidence();
    this.lastMilestoneCompletionItemId = null;
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

  /** Retry budgets are target-scoped, unlike Ralph's consecutive lack-of-progress counter. */
  private noteToolRetryResult(name: string, args: Record<string, unknown>, result: ToolResult): void {
    const currentItemId = this.workPlan?.currentItemId;
    if (this.turnComposerMode === "ask" || !currentItemId || (getTool(name)?.mode !== "write" && name !== "set_build_spec")) return;
    // A fresh missing-lookup refusal is a correctable attempt, even though it did not execute.
    // Only downstream dependency deferrals (and already-exhausted targets) are free retries.
    if (isDeferredToolResult(result) && !result.issues?.some((issue) => issue.code === "read-before-write-required")) return;
    const target = toolRetryTarget(name, args);
    const entries = this.repeatedToolFailures.get(currentItemId) ?? new Map<string, { target: string; count: number; summary: string }>();
    if (result.ok) {
      for (const [key, entry] of entries) if (entry.target === target) entries.delete(key);
    } else {
      const codes = result.issues?.filter((issue) => issue.severity === "error").map((issue) => issue.code) ?? [];
      for (const code of new Set(codes.length > 0 ? codes : ["tool-failure"])) {
        const key = JSON.stringify([target, code]);
        entries.set(key, { target, count: (entries.get(key)?.count ?? 0) + 1, summary: result.summary });
      }
    }
    this.repeatedToolFailures.set(currentItemId, entries);
  }

  private repeatedToolFailureStall(target?: string): { summary: string } | undefined {
    const currentItemId = this.workPlan?.currentItemId;
    if (this.turnComposerMode === "ask" || !currentItemId) return undefined;
    return [...(this.repeatedToolFailures.get(currentItemId)?.values() ?? [])]
      .find((entry) => entry.count >= MAX_REPEATED_TOOL_FAILURES_PER_ITEM && (target === undefined || entry.target === target));
  }

  /** 막힌 항목으로 턴을 끝낼 때 사용자에게 보내는 문장 — 무엇이 막혔고 무엇을 하면 되는지. */
  private blockedTurnText(blocked: WorkItem, modelText = ""): string {
    return this.npcRewardFinalText([
      modelText.trim(),
      `**${blocked.title}** 에서 막혔습니다 — ${blocked.note ?? ""}`.trim(),
      "무엇을 바꿔야 할지 알려 주시면 그 지점부터 다시 진행합니다. 이 단계를 빼려면 「건너뛰기」 라고 보내세요.",
    ]
      .filter((part) => part.length > 0)
      .join("\n\n"));
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
    // 2026-09-17 해제. "맵 하나만 더" 계약이 마을 빌더의 실내 맵을 막았고(런 2: undeclared map),
    // 미달 재주입은 예산만 태웠다. 산출량은 사용자가 결과를 보고 판단한다.
    if (bar) this.pushAudit({ kind: "status", text: "volume-contract:disabled — 플래너 선언을 기록만 하고 강제하지 않습니다" });
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
    if (this.milestoneApplyFailed || this.turnComposerMode === "ask") return false;
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
      const proposed = workPlanFromSetToolArgs(args);
      if (!proposed) {
        return {
          ok: false,
          summary: "set_work_plan 인자 오류: goal + layers[{title, items[{title, instruction}]}] 필요",
        };
      }
      const rejection = this.preflightWorkPlan(proposed);
      if (rejection) return rejection;
      const repair = this.workPlan ? repairWorkPlan(this.workPlan, proposed) : null;
      if (repair && !repair.ok) return { ok: false, summary: repair.reason };
      const plan = repair?.plan ?? proposed;
      if (repair && this.workPlan) for (const item of plan.layers.flatMap(layer => layer.items)) {
        const previous = findWorkItemById(this.workPlan, item.id);
        const owner = previous && this.verificationOwners.get(previous);
        if (previous && owner
          && acceptanceFingerprint(workPlanVerificationInputs(this.workPlan).filter(input => input.itemId === item.id))
            === acceptanceFingerprint(workPlanVerificationInputs(plan).filter(input => input.itemId === item.id))
          && acceptanceFingerprint(previous.verificationChecks) === acceptanceFingerprint(item.verificationChecks)
          && acceptanceFingerprint(previous.mapTargets) === acceptanceFingerprint(item.mapTargets)
          && acceptanceFingerprint(previous.successTools?.filter(name => VERIFICATION_TOOL_NAMES.has(name)))
            === acceptanceFingerprint(item.successTools?.filter(name => VERIFICATION_TOOL_NAMES.has(name)))) {
          this.verificationOwners.set(item, owner);
        }
      }
      this.workPlan = plan;
      this.adoptPlanAcceptance();
      if (repair) {
        // Same goal/item: retain successful calls, verification and artifact evidence.
        this.syncSuccessfulToolsToCurrentWorkItem();
      } else {
        this.lastMilestoneCompletionItemId = null;
        this.resetWorkItemEvidence();
      }
      const progress = summarizeWorkPlan(plan);
      return {
        ok: true,
        summary: `WorkPlan 설정: ${progress.layersTotal}레이어 / ${progress.itemsTotal}항목. 현재: ${progress.current?.itemTitle ?? "(완료)"}`,
        data: { plan: structuredClone(plan), progress, acceptance: this.getAcceptanceSnapshot(), verification: this.getVerificationSnapshot(false) },
      };
    }
    // 조회는 계획이 없어도 실패가 아니다 — "없음"은 정확한 답이다. ok:false 로 돌려주면 정상 상태가
    // 실패 통계에 섞이고 모델이 교정할 것도 없는 실패를 재시도한다(2026-08-23 실측).
    if (name === "get_work_plan") {
      if (!this.workPlan) {
        return { ok: true, summary: "활성 WorkPlan 없음. 다단계 작업이면 set_work_plan으로 계획을 세우세요.", data: { plan: null, verification: this.getVerificationSnapshot(false) } };
      }
      return {
        ok: true,
        summary: formatWorkPlanUserVisible(this.workPlan).slice(0, 500),
        data: { plan: structuredClone(this.workPlan), progress: summarizeWorkPlan(this.workPlan), acceptance: this.getAcceptanceSnapshot(), verification: this.getVerificationSnapshot(false) },
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
      // 빈 문자열·null 을 보내는 모델을 "id 미지정" 과 같게 읽는다 — 값이 없다는 뜻은 둘이 같다.
      const idOmitted = args.itemId === undefined || args.itemId === null
        || (typeof args.itemId === "string" && !args.itemId.trim());
      if (!id && idOmitted && this.workPlan.layers.every((layer) => layer.items.every((item) => item.status === "done"))) {
        const rewards = this.npcRewardOutcome();
        if (!rewards.ok) return { ok: false, summary: rewards.reason, issues: [{ severity: "error", code: "npc-reward-incomplete", message: rewards.reason }] };
        const pending = [...this.adventureProblems(), ...this.verificationEvidence.problems("blocking")];
        if (pending.length > 0) {
          const summary = pending.join("\n");
          return { ok: false, summary, issues: [{ severity: "error", code: "work-item-incomplete", message: summary }] };
        }
        if (this.acceptanceOpen()) {
          const summary = this.acceptanceIncompleteText();
          return { ok: false, summary, issues: [{ severity: "error", code: "acceptance-incomplete", message: summary }] };
        }
        return { ok: true, summary: "작업 계획은 이미 완료되었습니다. 다시 적용하지 않습니다.", data: { alreadyComplete: true, progress: summarizeWorkPlan(this.workPlan) } };
      }
      if (!id) {
        // 정보 0 인 거부는 모델을 추측으로 몰았다(항목 id 를 지어낸다). 계획 상태와 다음 행동을 같이 준다.
        const open = openWorkItemIds(this.workPlan);
        const progress = summarizeWorkPlan(this.workPlan);
        const summary = [`완료할 항목 id가 없습니다 — 현재 항목이 비어 있습니다(완료 ${progress.itemsDone}/${progress.itemsTotal}).`,
          open.length > 0
            ? `아직 열린 항목 id: ${open.join(", ")} — itemId 로 명시해 다시 호출하세요.`
            : "남은 항목이 없습니다(건너뛴 항목 포함). 더 할 일이 있으면 set_work_plan 으로 계획을 새로 세우고, 없으면 마무리하세요."].join("\n");
        return { ok: false, summary, issues: [{ severity: "error", code: "work-item-id-missing", message: summary }],
          data: { progress, openItemIds: open } };
      }
      const note = typeof args.note === "string" ? args.note : undefined;
      this.syncSuccessfulToolsToCurrentWorkItem();
      // completeWorkItemById's already-done shortcut must not bypass changed rewards.
      const item = findWorkItemById(this.workPlan, id);
      const rewards: WorkItemOutcomeVerdict = item ? this.npcRewardOutcome(item) : { ok: true };
      if (!rewards.ok) return { ok: false, summary: rewards.reason, issues: [{ severity: "error", code: "npc-reward-incomplete", message: rewards.reason }] };
      let result = completeWorkItemById(this.workPlan, id, note, {
        successfulTools: [...this.turnSuccessfulTools],
        outcomeGate: this.outcomeGate(),
      });
      // 두 번째 거부부터는 산출물을 근거로 인정한다. 첫 번째 거부는 그대로 남겨 모델이 먼저 선언대로
      // 고쳐볼 기회를 갖고, 검증 툴이 빠진 경우는 제외된다 — 검증은 산출물 검사가 대신해 줄 수 있는 것이 아니다.
      if (!result.ok && result.missingTools?.length && this.lastBlockReasonByItemId.has(id)
        && !result.missingTools.some((tool) => VERIFICATION_TOOL_NAMES.has(tool))) {
        const waived = completeWorkItemById(this.workPlan, id, note, {
          successfulTools: [...this.turnSuccessfulTools],
          outcomeGate: this.outcomeGate(),
          waiveMissingTools: true,
        });
        if (waived.ok) {
          this.pushAudit({ kind: "status", text: `work-item-tools-waived ${id} ← ${result.missingTools.join(",")}` });
          result = waived;
        }
      }
      if (!result.ok) {
        // 「필수 successTools 중 X 성공 기록이 없습니다」만 보내면 모델은 **이미 성공한** X 를 다시
        // 돌린다 — 성공 기록은 검증 미충족 시 지워지는데(아래 verification:unmet 분기) 그 사실이
        // 이 문구에 없기 때문이다. 2026-09-10 로그가 그 결과다: run_lint 21회·check_reachability
        // 15회를 같은 인자로 반복 성공시키고도 complete_work_item 7/12 거부, 예산 소진으로 종료.
        // 지워진 **이유**는 검증 증거만 알고 있으므로(스펙 미지정·재검증 필요·미통과) 같은 툴
        // 결과에 실어 보낸다. 이 채널이 모델이 실제로 읽는 유일한 채널이다 —
        // problems() 는 그 외에 감사 행과 사용자 노출 문구로만 나간다.
        const blocking = this.verificationEvidence.problems("blocking")
          .filter((problem) => (item?.successTools ?? []).some((tool) => problem.startsWith(`${tool}: `)));
        const reason = blocking.length ? `${result.reason}\n검증 상태: ${blocking.join("\n")}` : result.reason;
        this.lastBlockReasonByItemId.set(id, reason);
        return {
          ok: false,
          summary: reason,
          issues: [{ severity: "error", code: "work-item-incomplete", message: reason }],
          data: { targetIssues: result.item ? workTargetIssues(result.item, this.workItemToolOutcomes, this.workPlan) : [] },
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
      const item = findWorkItemById(this.workPlan, id);
      if (item && item.status !== "done" && item.status !== "skipped"
        && item.successTools?.some(tool => VERIFICATION_TOOL_NAMES.has(tool))) {
        return { ok: false, summary: `검증 항목은 건너뛸 수 없습니다: ${id}. 보고된 문제를 수정하고 필수 검증을 다시 실행하거나 막힌 이유를 보고하세요.` };
      }
      const note = typeof args.note === "string" ? args.note : undefined;
      const rewards: WorkItemOutcomeVerdict = item ? this.npcRewardOutcome(item) : { ok: true };
      if (!rewards.ok) return { ok: false, summary: rewards.reason, issues: [{ severity: "error", code: "npc-reward-incomplete", message: rewards.reason }] };
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
    this.resetWorkItemEvidence();
  }

  private resetWorkItemEvidence(): void {
    this.turnSuccessfulTools.clear();
    this.workItemToolOutcomes = [];
    this.workItemProposals.clear();
    // 산출물 추적도 항목 단위다 — 이전 항목이 만든 맵을 다음 항목이 채울 책임으로 물려받지 않는다.
    this.turnItemCreatedMapIds.clear();
    this.turnItemAuthoredTroopIds.clear();
    this.turnItemBattleSimulations.clear();
    this.turnItemQuestIds.clear();
    this.turnItemPlacedNpcIds.clear();
    this.npcRewardItemBaseline.clear();
    if (this.npcRewardRequirements && !("invalidReason" in this.npcRewardRequirements)) {
      const project = this.getProposedProject();
      for (const requirement of this.npcRewardRequirements) {
        this.npcRewardItemBaseline.set(requirement, npcRewardTargetSnapshot(project, requirement));
      }
    }
    this.lastOutcomeBlockedKey = null;
    this.successfulToolsWorkItemId = this.workPlan?.currentItemId ?? null;
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
    return (item) => {
      const targetIssues = workTargetIssues(item, this.workItemToolOutcomes, this.workPlan ?? undefined);
      if (targetIssues.length) return { ok: false, reason: targetIssues.map(issue => issue.message).join(" ") };
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
      const rewards = this.npcRewardOutcome(item);
      if (!rewards.ok) return rewards;
      return verifyPlacedNpcsHaveStatePages(project, this.turnItemPlacedNpcIds, this.statefulNpcRequirement);
    };
  }

  private finishesWorkPlan(itemId: string): boolean {
    return this.workPlan?.layers.every((layer) => layer.items.every((item) =>
      item.id === itemId || item.status === "done" || item.status === "skipped")) ?? false;
  }

  private npcRewardOutcome(item?: WorkItem): WorkItemOutcomeVerdict {
    const captured = this.npcRewardRequirements;
    const active = this.acceptance?.getFunctionalCriteria().filter(criterion => criterion.kind === "npcReward");
    const retained = captured && !("invalidReason" in captured) && active
      ? captured.filter(requirement => active.some(criterion => criterion.kind === "npcReward"
        && acceptanceFingerprint(criterion.requirement) === acceptanceFingerprint(requirement))) : captured;
    const required = Array.isArray(retained) && retained.length === 0 ? undefined : retained;
    if (required === undefined || this.turnComposerMode === "ask" || this.lastTurnPlanOnly) return { ok: true };
    const project = this.getProposedProject();
    if (!item || this.finishesWorkPlan(item.id)) return verifyNpcRewardsPlayable(project, required, this.npcRewardWitnesses);
    if ("invalidReason" in required) return { ok: true }; // No resolvable item target; whole-goal closure still fails.
    const changed = required.filter((requirement) =>
      this.npcRewardItemBaseline.get(requirement) !== npcRewardTargetSnapshot(project, requirement));
    return verifyNpcRewardsPlayable(project, changed.length ? changed : undefined, this.npcRewardWitnesses);
  }

  private npcRewardNote(): string | null {
    if (this.turnComposerMode === "ask") return null;
    const functionalAcceptance = this.acceptance?.getFunctionalCriteria();
    if (this.npcRewardRequirements === undefined) return functionalAcceptance?.length
      ? formatIntentNote({ ...emptyIntentDeclaration(), source: "llm", functionalAcceptance }) : null;
    return formatIntentNote({
      ...emptyIntentDeclaration(), source: "llm", npcRewards: this.npcRewardRequirements,
      functionalAcceptance,
    }) + "\nNPC reward indices: " + JSON.stringify("invalidReason" in this.npcRewardRequirements ? []
      : this.npcRewardRequirements.map((requirement, requirementIndex) => ({ requirementIndex, target: requirement.target })))
      + "\nverify_npc_reward requirementIndex is the zero-based index in this immutable npcRewards array. "
      + "Author prerequisite maps/chests first, transfer links in separate linking items next, then the reward NPC and its journey verification. "
      + "Keep one-map authoring items. Supply only physical prelude actions from authored start, with mapId asserting the current map. "
      + "Do not seed keys, change reward timing, skip obligations or reset acceptance baselines. This proves the chosen reachable route, not every game path.";
  }

  private verifyNpcRewardTool(input: unknown, signal?: AbortSignal): ToolResult {
    const required = this.npcRewardRequirements;
    if (!isVerifyNpcRewardInput(input) || !required || "invalidReason" in required || !required[input.requirementIndex]) {
      return { ok: false, summary: "Invalid verify_npc_reward input or captured requirementIndex", data: { executed: false } };
    }
    const requirement = required[input.requirementIndex];
    const project = this.getProposedProject();
    const matches = npcRewardTargetMatches(project, requirement.target);
    const match = matches[0];
    const previous = this.npcRewardWitnesses.get(requirement);
    if (matches.length !== 1 || !match || (previous && (previous.target.mapId !== match.map.id || previous.target.eventId !== match.event.id))) {
      return { ok: false, summary: "NPC reward target must uniquely resolve to its original map/event pair", data: { executed: false } };
    }
    const witness: NpcRewardWitness = structuredClone({ target: { mapId: match.map.id, eventId: match.event.id }, prelude: input.prelude });
    // Select before replay: a valid but failing replacement cannot inherit the old pass.
    this.npcRewardWitnesses.set(requirement, witness);
    const verdict = verifyNpcRewardsPlayable(project, [requirement], this.npcRewardWitnesses, signal);
    return { ok: verdict.ok, summary: verdict.ok ? "NPC reward prerequisite replay verified" : verdict.reason,
      data: { executed: true, requirementIndex: input.requirementIndex, target: { ...witness.target }, ...verdict } };
  }

  private npcRewardFinalText(text: string): string {
    const rewards = this.npcRewardOutcome();
    return rewards.ok ? text : `NPC 보상이 아직 미완성입니다.\n- ${rewards.reason}`;
  }

  private completionProblems(): string[] {
    const rewards = this.npcRewardOutcome();
    return [...this.adventureProblems(), ...(rewards.ok ? [] : [rewards.reason])];
  }

  private adventureProblems(): string[] {
    if (!this.adventureRequirements || this.turnComposerMode === "ask") return [];
    const project = this.getProposedProject();
    const problems = adventureCompletionProblems(project, this.adventureRequirements);
    for (const { collection, id } of this.adventureIconRecords.values()) {
      const item = project.database[collection].find(i => i.id === id);
      if (item && !item.iconResourceId) problems.push(`${collection} ${id}에 그림이 없습니다. list_resources로 그림을 조회하고 ${collection === "equipment" ? "upsert_equipment" : "upsert_item"}의 iconResourceId를 지정하세요.`);
    }
    const receipts = this.imageEvidence.current(project);
    for (const map of Object.values(project.maps)) {
      const regions: string[] = [];
      for (let y = 0; y < map.height; y += 24) for (let x = 0; x < map.width; x += 24) {
        const w = Math.min(24, map.width - x), h = Math.min(24, map.height - y);
        if (!coveredByImages(receipts, map, { x, y, w, h })) regions.push(JSON.stringify({ mapId: map.id, x, y, w, h }));
      }
      if (regions.length === 0) continue;
      problems.push(`마지막 변경 후 맵 ${map.id}의 시각 확인 누락 영역입니다. 각각 show_map_region으로 조회하세요: ${regions.join("; ")}`);
    }
    return problems;
  }

  private invalidateVerificationAfterWrite(): void {
    this.verificationEvidence.invalidateAfterWrite();
    for (const previous of this.turnSuccessfulTools) {
      if (VERIFICATION_TOOL_NAMES.has(previous)) this.turnSuccessfulTools.delete(previous);
    }
  }

  private recordSuccessfulTool(name: string): void {
    this.syncSuccessfulToolsToCurrentWorkItem();
    this.imageEvidence.current(this.ctx.project);
    if (getTool(name)?.mode === "write") this.invalidateVerificationAfterWrite();
    this.turnSuccessfulTools.add(name);
    // 교착 판정은 **연속** 무진행이다 — 이 항목에서 쓰기가 하나라도 성공했으면 진행이 있었으므로
    // 시도 수를 0으로 돌린다. 그러지 않으면 여러 턴에 걸쳐 정상 진행하는 큰 항목이 누적으로 막힌다.
    const currentItemId = this.workPlan?.currentItemId;
    if (currentItemId && getTool(name)?.mode === "write") {
      this.ralphAttemptsByItemId.delete(currentItemId);
      this.lastBlockReasonByItemId.delete(currentItemId);
    }
  }

  /** Keep transport/execution ok intact; only actual passing checks satisfy successTools. */
  private recordToolResult(name: string, args: Record<string, unknown>, result: ToolResult, countAsSuccess = true, checkId?: string): void {
    this.reviewToolResults.push(structuredClone({ name, args, result }));
    this.syncSuccessfulToolsToCurrentWorkItem();
    if (name === EVALUATE_GAME_QUALITY_TOOL) this.completionQualityRequired = true;
    if (result.ok) for (const [tool, field, collection] of [["upsert_item", "item", "items"], ["upsert_equipment", "equipment", "equipment"]] as const) {
      const record = args[field] as { id?: unknown } | undefined;
      if (name === tool && record && typeof record.id === "string") this.adventureIconRecords.set(`${collection}/${record.id}`, { collection, id: record.id });
    }
    this.adoptVerificationRequirements();
    const item = this.workPlan ? getCurrentWorkItem(this.workPlan) : null;
    const owner = item ? this.verificationOwners.get(item) : undefined;
    const verdict = this.verificationEvidence.observe(name, args, result, countAsSuccess ? "explicit" : "advisory", owner?.ownerId, checkId,
      this.verificationInitialState(name), owner?.checkIds);
    if (!countAsSuccess) return;
    const passed = !verdict || this.verificationEvidence.passed(name, owner?.checkIds, owner?.ownerId);
    const outcome = workToolOutcome(name, args, result.ok && passed, result.data);
    if (outcome.mapIds.length) {
      this.workItemToolOutcomes = this.workItemToolOutcomes.filter(previous =>
        previous.name !== name || previous.mapIds.length !== outcome.mapIds.length
        || previous.mapIds.some((mapId, index) => mapId !== outcome.mapIds[index]));
      this.workItemToolOutcomes.push(outcome);
    }
    if (!passed) {
      this.turnSuccessfulTools.delete(name);
      this.pushAudit({ kind: "status", text: `verification:unmet ${name} — ${this.verificationEvidence.problems().join("; ")}` });
    } else if (result.ok) {
      this.recordSuccessfulTool(name);
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
      const itemCalls = [...this.workItemProposals.values()];
      if (itemCalls.length === 0) return { ok: true };
      const spatialCalls = this.turnWriteLedger(this.finalizeProposals(this.turnProposals));
      const buildSpecs = this.getCompletionSpecs(itemCalls, item);
      const warnings = [...new Set([...proposalCompletenessWarnings({
        requestText: item.instruction,
        intent: this.turnIntent,
        calls: itemCalls,
      }), ...buildSpecs.flatMap(spec => buildSpecCompletenessWarnings(spec, spatialCalls, true, this.ctx.project)),
      ...this.inferredViewWarnings(spatialCalls, item)])];
      if (warnings.length === 0) return { ok: true };
      return {
        ok: false,
        reason: `완성도 경고 ${warnings.length}건 — ${warnings.slice(0, 3).join(" / ")}`,
      };
    };
  }

  private async noteSuccessfulTools(names: readonly string[], onEvent: (event: SessionEvent) => void): Promise<void> {
    const operation = this.runOperation;
    operation.assertCurrent();
    if (this.turnComposerMode === "ask" || !this.workPlan || names.length === 0) return;
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
      await operation.wait(this.maybeAutoApplyMilestone(completed, onEvent));
      // 레이어 검증 게이트(todo 5): 완료 항목이 속한 레이어가 끝났으면 canonical 테이블대로 검증.
      await operation.wait(this.sweepFinishedLayers(onEvent));
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
    const operation = this.runOperation;
    operation.assertCurrent();
    // Item completion is not authority to mutate the store. Batch completed items
    // until the independent reviewer approves the final current draft.
    if (!this.milestoneAutoApply || this.turnComposerMode === "ask" || !this.isDraftReviewApproved()) return;
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
    // 맵 규모 파괴는 자동 적용하지 않는다 — 이 경로에는 모달을 띄울 사람이 없다. 초안은 그대로
    // 남겨 두고, 턴이 끝날 때 표면(aiProposalCard)의 적용 경로에서 사용자가 확인하고 적용한다.
    // 조용히 통과시키면 "무엇이 사라졌는지 화면에서 봤다"는 승인 전제가 사라진다.
    const proposed = this.getProposedProject();
    // 이름으로 못 잡는 소실(맵 삭제·이벤트 전멸)도 같은 이유로 자동 적용하지 않는다. 이름만 보던
    // 시절에는 `remove_map` 이 그냥 지나갔다. 여기서 막지 않으면 applyProposedProject 의 안전망이
    // 거절하고, 그 거절은 failMilestoneApply 로 가 **자율 런 전체를 중단**시킨다 — 조용히 건너뛰고
    // 사용자가 표면에서 확인하게 하는 편이 옳다.
    const mapDestruction = calls.find((call) => isMapDestruction(call.name));
    const loses = mapLossConfirmRequest(this.baselineProject, proposed);
    if (mapDestruction || loses) {
      const what = mapDestruction ? mapDestruction.name : "맵·이벤트 소실";
      this.pushAudit({
        kind: "status",
        text: `agent_run:map-destruction-needs-approval "${completed.title}" — ${what} 는 자동 적용하지 않습니다 (프로젝트 저장소 변경 없음)`,
      });
      onEvent({ type: "status", text: `맵·이벤트가 사라지는 변경은 자동 적용하지 않습니다 — 확인 후 적용하세요: ${completed.title}` });
      return;
    }
    await this.prepareCheckpointApply();
    operation.assertCurrent();
    const applied = await operation.wait(applyProposedProject(proposed, {
      base: this.proposalBase,
      operation,
      onApplied: applied => {
        if (this.runOperation !== operation) return;
        this.recordAppliedMutation(applied);
      },
      baseline: this.draftBaseline,
      source: "agent-milestone",
      agentName: this.config.model,
      summary: `마일스톤: ${completed.title}`,
      toolNames: calls.map((call) => call.name),
      snapshotLabel: `마일스톤: ${completed.title}`,
      reason: calls.map((call) => call.reason).filter(isUsableToolReason).join(" · ") || `마일스톤 적용: ${completed.title}`,
    }));
    if (!applied.ok) {
      if (applied.reason === "stale-base" || applied.reason === "stale-baseline") this.staleProposal = true;
      if (applied.reason === "stale-baseline" || applied.reason === "stale-base") {
        this.draftBaselineCurrent = false;
        this.approvedReviewIdentity = null;
        this.approvedAuthoredIdentity = null;
        this.consumedApprovedRevision = null;
        this.resultReview = { status: "error", revision: this.reviewRevision, findings: [], summary: applied.issue ?? applied.reason };
      }
      // 커밋 게이트 차단 — 저장소는 그대로 두고 현재 자율 런만 중단한다.
      this.failMilestoneApply(completed, `적용 검증 실패: ${applied.issue ?? "무결성 오류"}`, [], onEvent);
      return;
    }
    this.recordAppliedProject(applied);
    operation.assertCurrent();

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
    //
    // clear 전에 원장에 남긴다: 이 호출들은 **저장소에 들어갔다**. 검수 단계와 패널의 완성도
    // 린트가 `turnProposals` 만 보면 여기서 지운 몫이 "변경 없음" 으로 뒤집힌다.
    this.turnProposals.clear();
    this.rebaseProject(applied.applied);
    this.publishAcceptance(onEvent);
  }

  /** 툴 실행 직전 신호를 알린다(1-based 서수). 실행 로직은 건드리지 않는다. */
  private emitToolStarted(onEvent: (event: SessionEvent) => void, name: string, args: Record<string, unknown>): void {
    this.turnToolStartedCount += 1;
    onEvent({ type: "tool_started", name, args, index: this.turnToolStartedCount });
  }

  /** 라이브 행·고스트가 한 프레임을 그릴 틈을 준다. 중단이면 양보하지 않는다. */
  private async yieldForUi(signal?: AbortSignal): Promise<void> {
    const operation = this.runOperation;
    operation.assertCurrent();
    if (signal?.aborted) return;
    await operation.wait(this.yieldToUi());
  }

  private failMilestoneApply(
    completed: WorkItem,
    reason: string,
    warnings: readonly string[],
    onEvent: (event: SessionEvent) => void,
  ): void {
    this.milestoneApplyFailed = true;
    this.runExecution = "failed";
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
    onEvent: (event: SessionEvent) => void,
    scope: "layer" | "completion" = "layer",
  ): Promise<LayerVerdictInput[]> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const calls = selectVerificationCalls(layer, this.verificationHistory);
    const results: LayerVerdictInput[] = [];
    for (const call of calls) {
      this.emitToolStarted(onEvent, call.name, call.args);
      await operation.wait(this.yieldForUi(this.activeTurnSignal));
      const reason = harnessToolReason("verification", call.name);
      const result = runTool(this.ctx, call.name, call.args);
      // Advisory checks report problems but never donate success to another work item.
      this.recordToolResult(call.name, call.args, result, false);
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
      onEvent({ type: "tool_call", name: call.name, args: call.args, result, reason });
    }
    const verdict = parseLayerVerdict(results);
    const layerId = layer.id ?? "";
    const label = layerId !== "" ? layerId : layer.title;
    const auditPrefix = scope === "layer" ? "agent_run:verification" : "agent_run:completion-check";
    if (verdict.pass) {
      this.pushAudit({
        kind: "status",
        text: `${auditPrefix}-pass layer=${label} calls=${calls.map((c) => c.name).join(",")} warnings=${verdict.warnings.length}`,
      });
      return results;
    }
    this.pushAudit({
      kind: "status",
      text: `${auditPrefix}-advisory layer=${label} blocking=${verdict.blockingIssues.length} warnings=${verdict.warnings.length} — 자문이므로 런을 중단하지 않는다`,
    });
    for (const issue of verdict.blockingIssues.slice(0, 8)) {
      this.pushAudit({ kind: "status", text: `${auditPrefix}-note layer=${label} — ${issue}` });
    }
    onEvent({ type: "status", text: `검증 지적 ${verdict.blockingIssues.length}건 (자문) — 진행은 계속합니다.` });
    return results;
  }

  /**
   * 완료된 레이어를 순서대로 1회씩 자문 검증한다. 이미 본 레이어는 다시 보지 않는다
   * (markLayerVerified). 반환값이 없다 — 이 스윕은 런 제어에 관여하지 않는다.
   */
  private async sweepFinishedLayers(onEvent: (event: SessionEvent) => void): Promise<void> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const plan = this.workPlan;
    if (!plan || !this.milestoneAutoApply) return;
    for (let li = 0; li < plan.layers.length; li += 1) {
      const layer = plan.layers[li]!;
      if (!this.isLayerFinished(layer)) continue;
      if (this.isLayerVerified(layer.id)) continue;
      await operation.wait(this.executeVerificationAdvisory({
        id: layer.id,
        title: layer.title,
        isFinal: li === plan.layers.length - 1,
        assessGameQuality: Boolean(this.ctx.project.endings?.length),
        items: layer.items,
      }, onEvent));
      this.markLayerVerified(layer.id);
    }
  }

  /** Read-only final checks are independent of the once-per-layer milestone sweep. */
  private async completionChecks(onEvent: (event: SessionEvent) => void): Promise<LayerVerdictInput[]> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const finalLayer = this.workPlan?.layers.at(-1);
    const layer: LayerDescriptor = {
      id: finalLayer?.id, title: "Final artifact", isFinal: true,
      assessGameQuality: this.completionQualityRequired || Boolean(this.ctx.project.endings?.length),
    };
    return this.turnComposerMode !== "ask" && this.turnIntent?.mode !== "question" && !this.lastTurnPlanOnly
      && selectVerificationCalls(layer, this.verificationHistory).length > 1
      ? await operation.wait(this.executeVerificationAdvisory(layer, onEvent, "completion")) : [];
  }

  private captureCompletionAssessment(onEvent: (event: SessionEvent) => void, checks: LayerVerdictInput[] = []): CompletionAssessment {
    this.publishAcceptance(onEvent);
    const assessment: CompletionAssessment = {
      acceptance: this.getAcceptanceSnapshot(), adventure: this.completionProblems(),
      verification: this.verificationEvidence.problems(), blockingVerification: this.verificationEvidence.problems("blocking"), checks,
    };
    onEvent({ type: "completion_assessment", assessment });
    return assessment;
  }

  private async assessCompletion(onEvent: (event: SessionEvent) => void): Promise<CompletionAssessment> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const checks = await operation.wait(this.completionChecks(onEvent));
    return this.captureCompletionAssessment(onEvent, checks);
  }

  private completionIncompleteText(assessment: CompletionAssessment): string {
    return [
      ...(assessment.acceptance && assessment.acceptance.status !== "verified" ? [this.acceptanceIncompleteText()] : []),
      ...(assessment.adventure.length ? [`모험 구성이 아직 미완성입니다.\n${assessment.adventure.map(problem => `- ${problem}`).join("\n")}`] : []),
      ...(assessment.blockingVerification.length ? [`검증이 아직 통과되지 않았습니다.\n${assessment.blockingVerification.map(problem => `- ${problem}`).join("\n")}`] : []),
    ].join("\n\n");
  }

  /** Completion schedules proof only after all pending writes have actually been applied. */
  private async maybeRunEndProof(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<void> {
    const operation = this.runOperation;
    operation.assertCurrent();
    if (!this.workPlan || !this.milestoneAutoApply || this.milestoneApplyFailed) return;
    if (!isWorkPlanComplete(this.workPlan) || this.acceptanceOpen() || this.explicitVerificationOpen() || this.turnProposals.size > 0 || signal?.aborted) return;
    await operation.wait(this.proveAppliedRevision(onEvent, signal));
  }

  private clearAppliedDelivery(): void {
    // Intent-time reset may retire previous work, but not this run's awaited wiki apply.
    if (this.wikiDelivery?.owner !== this.runResult) this.wikiDelivery = null;
    this.runReceipt = null;
    this.lastAppliedProject = null;
    this.turnAppliedMilestoneCalls = [];
  }

  /** Keep only metadata from the actual apply, never a newest-commit query. */
  recordAppliedProject(applied: Extract<ApplyProposedProjectResult, { ok: true }>): void {
    this.recordApplication(applied);
  }

  /** Preserve actual local milestones even when their commit/save notification is retired. */
  recordAppliedMutation(applied: Extract<ApplyProposedProjectResult, { ok: true }>): void {
    this.recordApplication(applied, true);
  }

  private recordApplication(applied: Extract<ApplyProposedProjectResult, { ok: true }>, mutation = false): void {
    // The approval consumed by this successful apply keeps its recorded verdict
    // (revision included). This never grants authority: it is only read back by
    // getResultReview, while every apply path requires isDraftReviewApproved().
    if (this.isDraftReviewApproved(applied.applied)) this.acceptanceAppliedProject = structuredClone(applied.applied);
    if (this.resultReview?.status === "approved") this.consumedApprovedRevision = this.resultReview.revision;
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    this.reviewTurn = null;
    this.lastAppliedProject = applied.commitProject
      ? { project: applied.commitProject, commitId: applied.commit.commitId } : null;
    this.runReceipt = null;
    if (this.wikiDelivery) {
      this.wikiDelivery.project = undefined;
      this.wikiDelivery.receipt = null;
    }
    this.turnAppliedMilestoneCalls.push(...this.finalizeProposals(this.turnProposals));
    this.turnProposals.clear();
    if (mutation && this.checkpointKey) {
      this.checkpointCurrentIdentity = this.identityOf(applied.applied);
      this.checkpointApplied = { operationId: `${this.checkpointKey.runId}:${this.checkpointKey.epoch}:apply`,
        contentIdentity: this.identityOf(applied.applied), commitId: null, calls: [...this.turnAppliedMilestoneCalls] };
      this.checkpointPending = null;
    } else if (this.checkpointApplied) {
      this.checkpointApplied = { ...this.checkpointApplied, commitId: applied.commit.commitId };
    }
    this.captureCheckpoint(); // Before publish can synchronously cancel or replace this owner.
    this.publishRunOutcome();
  }

  /** Only an acceptance-only stop with finished scheduling can settle after its pending apply. */
  private stopForAcceptance(): void {
    this.runExecution = "blocked";
    this.acceptanceApplyPending = this.turnProposals.size > 0 && (!this.workPlan || isWorkPlanComplete(this.workPlan));
  }

  /** Ordinary apply rejection is an execution decision, not a model verdict. */
  recordApplyRejected(onEvent?: (event: SessionEvent) => void, reason?: Extract<ApplyProposedProjectResult, { ok: false }>["reason"]): void {
    if (reason === "stale-base" || reason === "stale-baseline") this.staleProposal = true;
    this.reviewTurn = null;
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    this.runExecution = "failed";
    this.checkpointPending = null;
    this.captureCheckpoint();
    this.publishRunOutcome(onEvent);
  }

  getRunOutcome(): RunOutcome | null {
    if (!this.runResult.current) return null;
    const assessment = this.getAcceptanceSnapshot();
    // A retained canonical pass is usable only for its assessed applied revision.
    // Do not evaluate requirements or mutate their evidence in a read-only getter.
    const assessmentCurrent = (!this.storeBacked && !this.lastAppliedProject) || !this.acceptanceAppliedProject
      || acceptanceFingerprint(this.acceptanceAppliedProject) === acceptanceFingerprint(store.getCurrent());
    const proof = this.getRunEndProof();
    const receipt = this.runReceipt ?? this.wikiDelivery?.receipt ?? null;
    return deriveRunOutcome({
      execution: this.runExecution,
      acceptance: assessment ? assessment.status === "verified" && !assessmentCurrent ? "verifying" : assessment.status : null,
      hasPendingDraft: this.turnComposerMode !== "ask" && this.turnProposals.size > 0,
      hasApplied: this.turnAppliedMilestoneCalls.length > 0 || this.wikiDelivery !== null,
      persistence: receipt === null ? "none"
        : proof?.receipt === receipt && proof.verified ? "verified-current" : "accepted",
      // 전달 사실은 이 실행의 이미지 원장이 소유한다. 조회했다/품질을 봤다와 다른 축이고,
      // 여기서 새로 만들어내지 않는다 — 원장이 이미 아는 것을 그대로 투영한다.
      visualDelivery: this.imageEvidence.deliveryFacts(),
    });
  }

  /** Update the original returned handle before publication; getters never settle state. */
  private publishRunOutcome(onEvent?: (event: SessionEvent) => void): void {
    const result = this.runResult.current;
    const runOutcome = this.getRunOutcome();
    if (!result || !runOutcome) return;
    // Retention is not authorization: questions keep the draft for a later resume,
    // but must not offer its calls to ordinary apply or claim it as query delivery.
    result.proposedCalls = this.turnComposerMode === "ask" ? [] : this.finalizeProposals(this.turnProposals);
    result.appliedCalls = [...this.turnAppliedMilestoneCalls];
    result.runOutcome = runOutcome;
    if (result.recap) {
      result.recap = { ...result.recap, runOutcome };
      if (this.runRecapAuditIndex !== null) {
        const previous = this.audit[this.runRecapAuditIndex];
        this.audit[this.runRecapAuditIndex] = { kind: "status", at: previous?.at,
          text: `run-recap ${serializeRunRecap(result.recap)}` };
      }
    }
    (onEvent ?? this.runSubscriber)?.({ type: "run_outcome", runOutcome });
  }

  /** Historical success is not authority for a newer editor revision. */
  getRunEndProof(): RunEndProofState | null {
    const state = this.runEndProof;
    return state ? this.projectRunEndProof(state) : null;
  }

  private projectRunEndProof(state: RunEndProofState): RunEndProofState {
    return { ...state, verified: state.status === "succeeded" && !!state.receipt
      && store.isPersistenceReceiptCurrent(state.receipt) };
  }

  private emitRunEndProof(state: RunEndProofState, onEvent: (event: SessionEvent) => void): void {
    if (state.status === "succeeded") this.checkpointPending = null;
    this.captureCheckpoint();
    onEvent({ type: "persistence_proof", state: this.projectRunEndProof(state) });
  }

  /** Shared by autonomous completion and ordinary applied proposals; failures remain retryable. */
  async proveAppliedRevision(
    onEvent: (event: SessionEvent) => void = () => {},
    signal?: AbortSignal,
  ): Promise<RunEndProofState> {
    const outcomeOwner = this.runResult;
    const acceptance = this.acceptance;
    const functionalDraftPending = (): boolean => Boolean(acceptance?.hasReloadCriteria() && this.turnProposals.size > 0
      && acceptanceFingerprint(this.ctx.project) !== acceptanceFingerprint(store.getCurrent()));
    const previous = this.getRunEndProof();
    if (!signal?.aborted && previous?.verified && !this.acceptanceOpen() && !functionalDraftPending()
      && (acceptance?.functionalProblems(store.getCurrent()).length ?? 0) === 0) {
      this.publishRunOutcome(onEvent);
      return previous;
    }
    let receipt: ProjectPersistenceReceipt | undefined;
    let commitId: string | null = null;
    // Each attempt owns only its last published state. A newer invocation replaces it.
    let state: RunEndProofState = { status: "attempted", verified: false };
    this.runEndProof = state;
    const retired = (): RunEndProofState => ({ status: "failed", verified: false, reason: "retired-run", receipt, commitId });
    const fail = (reason: string, proof?: ProjectPersistenceProof, publish = onEvent): RunEndProofState => {
      if (outcomeOwner !== this.runResult) return retired();
      if (outcomeOwner === this.runResult && reason === "cancelled") this.runExecution = "cancelled";
      state = { status: "failed", verified: false, reason, receipt, commitId, proof };
      this.emitRunEndProof(this.runEndProof = state, publish);
      if (outcomeOwner !== this.runResult) return retired();
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      this.pushAudit({ kind: "status", text: `agent_run:proof-failed reason=${reason} revision=${receipt?.revisionId ?? "none"}` });
      publish({ type: "status", text: `저장 증명 미완료(${reason}) — 다시 검증할 수 있습니다.` });
      if (outcomeOwner === this.runResult) this.publishRunOutcome(publish);
      return this.projectRunEndProof(this.runEndProof);
    };
    if (signal?.aborted) return fail("cancelled");
    if (functionalDraftPending()) return fail("unapplied-functional-draft");
    if (!store.isRemotePersistenceEnabled()) {
      this.pushAudit({ kind: "status", text: "agent_run_local_only — remote persistence 비활성으로 저장 증명을 건너뜁니다" });
      return fail("disabled");
    }
    this.emitRunEndProof(state, onEvent);
    if (outcomeOwner !== this.runResult) return retired();
    if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
    if (signal?.aborted) return fail("cancelled");
    let proofRetired = false;
    const cancelProof = (publish = onEvent) => {
      if (this.runEndProof !== state || outcomeOwner !== this.runResult || proofRetired) return;
      proofRetired = true;
      fail("cancelled", undefined, publish);
    };
    this.cancelPendingProof = cancelProof;
    try {
      const applied = this.lastAppliedProject ?? (this.wikiDelivery?.project
        ? { project: this.wikiDelivery.project, commitId: null } : null);
      if (this.checkpointKey) {
        this.checkpointPending = { operationId: `${this.checkpointKey.runId}:save`, stage: "saving", proposal: null };
        this.captureCheckpoint();
        // 체크포인트는 복구 편의이고, 저장·증명은 사용자 작업물의 정본이다. 기록 실패로 저장을
        // 건너뛰면 회복 장치가 원래 기능을 죽인다 — 실패는 경고로 남기고 저장은 진행한다.
        await this.checkpointBestEffort();
        if (outcomeOwner !== this.runResult || signal?.aborted) return retired();
      }
      const flushResult = await store.flush();
      if (proofRetired) return this.projectRunEndProof(state);
      if (outcomeOwner !== this.runResult) return retired();
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      if (flushResult.kind !== "saved") return fail(signal?.aborted ? "cancelled" : flushResult.kind);
      receipt = flushResult.receipt;
      if (!receipt) return fail(signal?.aborted ? "cancelled" : "missing-receipt");
      // Correlate accepted history to the submitted owner even if newer edits now exist.
      // A catch-up save of a human revision cannot borrow that apply's metadata.
      if (applied && store.isPersistenceReceiptForProject(receipt, applied.project)) {
        commitId = applied.commitId;
        if (outcomeOwner === this.runResult) {
          this.runReceipt = receipt;
          if (store.isPersistenceReceiptCurrent(receipt)) this.checkpointCurrentIdentity = this.identityOf(store.getCurrent());
        }
      }
      state = { status: "attempted", verified: false, receipt, commitId };
      this.emitRunEndProof(this.runEndProof = state, onEvent);
      if (outcomeOwner !== this.runResult) return retired();
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      if (signal?.aborted) return fail("cancelled");
      if (this.checkpointKey) {
        this.checkpointPending = { operationId: `${this.checkpointKey.runId}:proof`, stage: "proving", proposal: null };
        this.captureCheckpoint();
        // 같은 이유로 증명도 체크포인트 실패에 볼모로 잡히지 않는다(저장 증명이 곧 사용자 증거다).
        await this.checkpointBestEffort();
        if (outcomeOwner !== this.runResult || signal?.aborted) return retired();
      }
      const proof = await store.verifyPersistedRevision(receipt, { signal, validate: project => {
        if (functionalDraftPending()) return "unapplied-functional-draft";
        const problems = acceptance?.functionalProblems(project) ?? [];
        return problems.length ? `Functional acceptance incomplete on canonical reload: ${problems.join("; ")}` : undefined;
      } });
      if (proofRetired) return this.projectRunEndProof(state);
      if (outcomeOwner !== this.runResult) return retired();
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      if (signal?.aborted) return fail("cancelled", proof);
      if (proof.kind !== "verified") return fail(proof.kind === "mismatch" ? `mismatch-${proof.reason}` : proof.kind, proof);
      if (!proof.isCurrent || !store.isPersistenceReceiptCurrent(receipt)) return fail("stale", proof);
      state = { status: "succeeded", verified: true, receipt, commitId, proof };
      this.emitRunEndProof(this.runEndProof = state, onEvent);
      if (outcomeOwner !== this.runResult) return retired();
      // Recheck ownership before freshness: an obsolete attempt cannot replace newer state.
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      if (!store.isPersistenceReceiptCurrent(receipt) || signal?.aborted) return fail(signal?.aborted ? "cancelled" : "stale", proof);
      if (functionalDraftPending()) return fail("unapplied-functional-draft", proof);
      this.pushAudit({
        kind: "status",
        text: `agent_run_saved projectId=${receipt.projectId} revision=${receipt.revisionId} contentIdentity=${receipt.contentIdentity} sha256=${receipt.sha256 ?? "none"} commit=${commitId ?? "unavailable"} verified=true`,
      });
      onEvent({ type: "status", text: `저장 증명 완료 — projectId=${receipt.projectId} revision=${receipt.revisionId}` });
      if (outcomeOwner === this.runResult) this.publishRunOutcome(onEvent);
      return this.projectRunEndProof(this.runEndProof);
    } catch (error) {
      if (proofRetired) return this.projectRunEndProof(state);
      if (outcomeOwner !== this.runResult) return retired();
      if (this.runEndProof !== state) return this.projectRunEndProof(this.runEndProof);
      this.pushAudit({ kind: "status", text: `agent_run:save-failed — ${error instanceof Error ? error.message : String(error)}` });
      return fail(signal?.aborted ? "cancelled" : "failed");
    } finally {
      if (this.cancelPendingProof === cancelProof) this.cancelPendingProof = undefined;
    }
  }

  /**
   * 마일스톤으로 이미 적용된 호출을 턴 결과에 싣는다. 모든 반환 경로가 지나는 한 자리다.
   *
   * 이게 없으면 패널(aiTurnRunner)은 `proposedCalls` 만 보고 마일스톤로 다 지은 턴을
   * "변경 없음(0건)" 으로 보고하고, 밑그림 이행 여부도 지지 않은 것으로 판정한다.
   */
  private withTurnLedger(result: TurnResult): TurnResult {
    if (this.turnComposerMode === "ask") return { ...result, proposedCalls: [] };
    const review = this.getResultReview();
    if (this.turnProposals.size > 0 && (!this.isDraftReviewApproved() || result.stoppedReason !== "final")) {
      const error = result.error ?? "결정적 검사(lint error 0)를 통과하지 못해 초안을 적용하지 않았습니다.";
      result = { ...result, assistantText: error, error, review: review ?? { status: "unapproved", revision: this.reviewRevision,
        summary: error, findings: [] } };
    } else if (review) result = { ...result, review };
    return {
      ...result,
      ...(this.turnAppliedMilestoneCalls.length > 0 ? { appliedCalls: [...this.turnAppliedMilestoneCalls] } : {}),
      ...(this.turnAppearanceGeneration ? { appearanceGeneration: this.turnAppearanceGeneration } : {}),
    };
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
    const operation = this.beginRunOperation(signal);
    if (!operation) return { assistantText: "", proposedCalls: [], stoppedReason: "aborted",
      runOutcome: deriveRunOutcome({ execution: "cancelled", acceptance: null, hasPendingDraft: false, hasApplied: false, persistence: "none" }) };
    this.runResult = { current: this.runResult.current, settled: false };
    const owner = this.runResult;
    this.runSubscriber = onEvent;
    signal = operation.signal;
    this.activeTurnSignal = signal;
    const startedAt = Date.now();
    const usageBefore = this.usageTotals;
    const auditFrom = this.audit.length;
    let cancelled: TurnResult | undefined;
    const cancel = (): TurnResult => {
      if (owner.settled && owner.current) return owner.current;
      if (cancelled) return cancelled;
      this.runExecution = "cancelled";
      this.removeOrchestrationMessages();
      this.settleCancelledToolCalls();
      cancelled = this.withTurnLedger({ assistantText: "", proposedCalls: this.finalizeProposals(this.turnProposals), stoppedReason: "aborted" });
      cancelled = this.finishRunRecap(cancelled, startedAt, usageBefore, auditFrom, onEvent);
      return cancelled;
    };
    this.cancelPendingRun = cancel;
    const publish = (event: SessionEvent) => {
      if (operation.signal.aborted || owner.settled) return;
      onEvent(event);
      operation.assertCurrent();
    };
    // 재시도도 사용자가 자리를 비운 채 도는 런이다 — 송신 경로와 같게 얼지 않도록 쥔다.
    const releaseFreezeGuard = await this.freezeGuard().catch(() => () => {});
    try {
      operation.assertCurrent();
      if (!this.lastTurnFailed && !(this.turnProposals.size > 0 && !this.isDraftReviewApproved())) {
        if (this.runEndProof?.status === "failed" && this.turnProposals.size === 0
          && this.turnComposerMode !== "ask" && !this.lastTurnPlanOnly) {
          await operation.wait(this.proveAppliedRevision(publish, signal));
        }
        return await this.finishAssessedRunRecap(this.withTurnLedger({ assistantText: "", proposedCalls: this.finalizeProposals(this.turnProposals), stoppedReason: "final" }), startedAt, usageBefore, auditFrom, onEvent);
      }
      if (typeof window !== "undefined" && typeof location !== "undefined") {
        await refreshSharedCharacterGraphics(signal);
        operation.assertCurrent();
      }
      this.runExecution = "response-final";
      this.pushAudit({ kind: "status", text: "오류 후 재시도(retryLastTurn)" });
      const result = this.withTurnLedger(await operation.wait(this.runTurnLoop(publish, signal)));
      if (result.stoppedReason !== "aborted" && result.stoppedReason !== "error"
        && this.turnComposerMode !== "ask" && !this.lastTurnPlanOnly) {
        await operation.wait(this.maybeRunEndProof(publish, signal));
      }
      return await this.finishAssessedRunRecap(result, startedAt, usageBefore, auditFrom, onEvent);
    } catch (cause) {
      if (owner.settled && owner.current) {
        if (isLlmAbortError(cause)) return owner.current;
        throw cause;
      }
      if (operation.signal.aborted) return cancelled ?? cancel();
      throw cause;
    } finally {
      releaseFreezeGuard();
      if (this.cancelPendingRun === cancel) this.cancelPendingRun = undefined;
      if (this.runOperation === operation) this.removeOrchestrationMessages();
    }
  }

  /** Close only unanswered protocol slots; cancellation never replays their tools. */
  private settleCancelledToolCalls(): void {
    let index = this.messages.length - 1;
    while (index >= 0 && this.messages[index]?.role !== "assistant") index -= 1;
    const calls = this.messages[index]?.tool_calls ?? [];
    const answered = new Set(this.messages.slice(index + 1).map(message => message.tool_call_id));
    for (const call of calls) {
      if (answered.has(call.id)) continue;
      this.messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name,
        content: JSON.stringify({ ok: false, code: "run-cancelled", summary: "Run cancelled before tool completion" }) });
    }
  }

  /** 사용자 목표가 끝날 때 토큰·경과·과정을 감사에 남기고 채팅용 한 줄을 보낸다. */
  private async finishAssessedRunRecap(
    result: TurnResult,
    startedAt: number,
    usageBefore: SessionUsageTotals,
    auditFrom: number,
    onEvent: (event: SessionEvent) => void,
  ): Promise<TurnResult> {
    const operation = this.runOperation;
    const owner = this.runResult;
    const cancel = this.cancelPendingRun;
    const events: SessionEvent[] = [];
    let checks: LayerVerdictInput[];
    try {
      // Checks may yield; no terminal callback can observe half-settled accounting.
      checks = await operation.wait(this.completionChecks(event => events.push(event)));
    } catch (cause) {
      if (operation.signal.aborted) {
        if (owner.settled && owner.current) return owner.current;
        if (cancel) return cancel();
      }
      throw cause;
    }
    return this.finishRunRecap(result, startedAt, usageBefore, auditFrom, onEvent, checks, events);
  }

  private finishRunRecap(
    result: TurnResult,
    startedAt: number,
    usageBefore: SessionUsageTotals,
    auditFrom: number,
    onEvent: (event: SessionEvent) => void,
    checks: LayerVerdictInput[] = [],
    events: SessionEvent[] = [],
  ): TurnResult {
    const owner = this.runResult;
    const operation = this.runOperation;
    if (owner.settled && owner.current) return owner.current;
    // Prepare the complete terminal snapshot before allowing synchronous reentry.
    const subscriber = onEvent;
    onEvent = event => events.push(event);
    if (result.stoppedReason === "aborted") this.cancelPendingProof?.(onEvent);
    // 예산으로 멈춘 런은 여기서 딱 한 번 안내한다(턴 루프는 내지 않는다 — BUDGET_STOP_REASONS).
    if (BUDGET_STOP_REASONS.has(result.stoppedReason)) onEvent({ type: "status", text: TOKEN_BUDGET_STATUS_TEXT });
    this.publishAcceptance(onEvent);
    if (this.acceptanceOpen() && !this.lastTurnPlanOnly && this.turnComposerMode !== "ask" && !this.isDraftReviewApproved()) {
      this.acceptance?.stop();
    }
    // Budget termination can bypass the model's final response entirely.
    const assessment = this.captureCompletionAssessment(onEvent, checks);
    const notice = this.lastTurnPlanOnly ? "" : this.completionIncompleteText(this.turnComposerMode === "ask"
      ? { ...assessment, acceptance: null, adventure: [] } : assessment);
    if (notice) {
      const prefix = result.stoppedReason === "final" ? "" : result.assistantText.trim();
      result = { ...result, assistantText: [prefix, notice].filter(Boolean).join("\n\n") };
      onEvent({ type: "assistant_message", content: result.assistantText });
    }
    if (this.runExecution === "response-final" && this.turnComposerMode !== "ask"
      && (this.acceptanceOpen() || this.explicitVerificationOpen())) this.stopForAcceptance();
    if (assessment.adventure.length > 0) {
      this.acceptanceApplyPending = false;
      if (this.runExecution === "response-final" && this.turnComposerMode !== "ask") this.runExecution = "blocked";
    }
    const reportedOnly = assessment.verification.filter(problem => !assessment.blockingVerification.includes(problem));
    if (reportedOnly.length && !this.lastTurnPlanOnly) {
      result = { ...result, assistantText: `${result.assistantText}\n\n선재 린트 지적 (자문):\n${reportedOnly.map(problem => `- ${problem}`).join("\n")}` };
      onEvent({ type: "assistant_message", content: result.assistantText });
    }
    result = { ...result, completionAssessment: assessment };
    this.runResult.current = result;
    this.publishRunOutcome(onEvent);
    // Bridge/history consumers read the latest audited response, not the live
    // assistant_message event. Keep the authoritative final verdict there too.
    const lastAssistant = [...this.audit].reverse().find(entry => entry.kind === "assistant");
    if (result.assistantText.trim() && lastAssistant?.text !== result.assistantText) {
      this.pushAudit({ kind: "assistant", text: result.assistantText });
    }
    const recap = buildRunRecap({
      elapsedMs: Date.now() - startedAt,
      usage: usageDelta(usageBefore, this.usageTotals),
      audit: this.audit.slice(auditFrom),
      stoppedReason: result.stoppedReason,
      proposedWrites: result.proposedCalls.length + (result.appliedCalls?.length ?? 0),
      runOutcome: result.runOutcome,
    });
    this.runRecapAuditIndex = this.audit.length;
    this.pushAudit({ kind: "status", text: `run-recap ${serializeRunRecap(recap)}` });
    result.recap = recap;
    onEvent({ type: "run_recap", recap });
    this.publishRunOutcome(onEvent);
    owner.settled = true;
    this.captureCheckpoint();
    this.cancelPendingRun = undefined;
    if (result.stoppedReason === "aborted") operation.retire();
    for (const event of events) {
      if (this.runResult !== owner) break;
      subscriber(event);
    }
    return result;
  }

  // 감사 항목에 ISO 타임스탬프를 붙여 기록한다(결함 ⑬ — 타임라인 export).
  private diagnosticAuditToken: symbol | undefined;
  private pushAudit(entry: AuditEntry): void {
    if (entry.kind === "user") this.diagnosticAuditToken = diagnosticToken();
    if (this.diagnosticAuditToken && this.diagnosticAuditToken === diagnosticToken() && diagnosticObserved("conversation")
      && (entry.kind === "user" || entry.kind === "assistant")) {
      publishDiagnostic({ category: "conversation", phase: entry.kind, count: entry.text.length });
    }
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
    const operation = this.runOperation;
    operation.assertCurrent();
    await operation.wait(this.runCompaction(onEvent, signal, false));
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
    const operation = this.runOperation;
    operation.assertCurrent();
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
      const result = await operation.wait(this.chat(this.config, {
        messages: buildSummarizationRequest(this.messages.slice(1, cutPoint.firstKeptIndex), findPreviousSummary(this.messages)),
        disableTransientRetry: true,
        signal,
      }));
      const text = result.message.content;
      summary = typeof text === "string" && text.trim().length > 0 ? text.trim() : null;
    } catch (cause) {
      operation.assertCurrent();
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
    if (target.fullMap === true || args.fullMap === true) return args;
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
    if (!SPATIAL_BUILD_TOOLS.has(proposal.name)) return proposal;
    const mapId = toolTargetMapId(proposal.args);
    const spec = mapId ? this.carryoverSpecsForTurn.get(mapId) : undefined;
    if (!spec || this.carryoverWarningsAdded.has(spec.mapId)) return proposal;
    // carryover는 diff 생성 전 시점에 붙는다 — tilesChanged 기준으로 거르면 아직 0이라 누락된다.
    // previous-turn spec의 같은 맵에 다시 쓰는 공간 쓰기면 1회 경고를 붙인다.
    // paint_tiles 등 from/to 직사각형이 regionsFromKnownCall에서 0-폭으로 잡히는 레거시
    // 버그로 proposalHasChangedMap이 false가 되던 케이스가 있어 same-map fast path 필수.
    const callerMapId = (proposal.args as unknown as { readonly mapId?: unknown })?.mapId;
    const isSameMapWrite = typeof callerMapId === "string" && callerMapId === spec.mapId;
    if (!isSameMapWrite && !proposalHasChangedMap([proposal], spec.mapId)) return proposal;

    this.carryoverWarningsAdded.add(spec.mapId);
    const label = buildSpecPlanLabel(spec);
    const warning = proposalScopeCarryoverWarning(this.carryoverSpecsForTurn.size > 1 ? `${spec.mapId}: ${label}` : label);
    return { ...proposal, result: appendDiffWarning(proposal.result, warning) };
  }

  // 턴 종료 시 누적된 제안을 배열로 넘긴다(과거엔 보류 시공을 여기서 첨부했으나
  // soft-allow 전환으로 그 기계가 도달 불가가 되어 제거됐다 — 2026-07-11).
  private finalizeProposals(proposedByKey: Map<string, ProposedCall>): ProposedCall[] {
    return [...proposedByKey.values()];
  }

  private upsertProposal(proposedByKey: Map<string, ProposedCall>, proposal: ProposedCall): void {
    this.workItemProposals.set(proposalKey(proposal), proposal);
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    this.consumedApprovedRevision = null;
    this.reviewRevision += 1;
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

  /**
   * 자율성 다이얼 해석. config.autonomyLevel 이 명시됐을 때만 레벨을 돌려준다 —
   * 미지정(구형 blob/직접 주입 config)은 null 로 종래 동작을 그대로 유지한다.
   * 직접 주입된 이상한 값은 balanced 로 스냅한다(loadAiConfig 는 이미 검증한다).
   */
  private autonomy(): AutonomyResolution | null {
    const raw = this.config.autonomyLevel;
    if (raw === undefined) return null;
    return resolveAutonomy(isAutonomyLevel(raw) ? raw : "balanced");
  }

  private orchestrationEnabled(): boolean {
    // 자율성 다이얼이 명시됐으면 그 agentMode 가 이긴다 — agentMode 단독 설정 UI 가 없고
    // 다이얼이 플래너 모드의 정본이다. 미지정(구형 blob/직접 주입)은 종래 판정 그대로.
    // effort 는 세션이 덮지 않는다 — 다이얼 선택 시 호출자가 이미 저장에 반영했다.
    const levelMode = this.autonomy()?.agentMode;
    if (levelMode === "auto") return true;
    // 다이얼 confirm(planOnly)은 플래너를 항상 돌려야 계획만 세우고 멈출 수 있다.
    if (this.autonomy()?.planOnly === true) return true;
    if (this.config.agentMode === "auto") return true;
    const main = this.config.model.trim();
    const lite = this.config.liteModel?.trim();
    return Boolean(main && lite && lite !== main);
  }

  private phaseConfig(phase: AssistantPhase): AiConfig {
    // Balanced keeps the fast executor. Explicit autonomous/max runs retain the
    // saved reasoning choice instead of silently disabling it when models switch.
    if (phase === "execute") {
      if (this.config.roleModels?.deep) return configForRole(this.config, "deep");
      const executor = configForLiteModel(this.config);
      return this.config.autonomyLevel === "autonomous" || this.config.autonomyLevel === "max"
        ? { ...executor, reasoningEffort: this.config.reasoningEffort }
        : executor;
    }
    return this.config;
  }

  /** 사용자 텍스트 + 뷰포트 블록 + (브라우저) 뷰포트 맵 이미지. */
  private async buildUserTurnContent(text: string): Promise<string | ContentPart[]> {
    const operation = this.runOperation;
    operation.assertCurrent();
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
      const images = await operation.wait(this.renderImages(this.ctx.project, "show_map_region", payload));
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
      operation.assertCurrent();
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
    return [...this.specsByMap.values()].some(({ spec, turnIndex }) => turnIndex === this.currentTurnIndex && spec.assets.length > 0);
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
    if (this.eventCommandScope) return 0;
    const assets = [...this.specsByMap.values()]
      .filter(({ turnIndex }) => turnIndex === this.currentTurnIndex)
      .flatMap(({ spec }) => spec.assets.filter(asset => asset.kind === "npc").map(asset => ({ mapId: spec.mapId, asset })));

    let placed = 0;
    for (const { mapId, asset } of assets) {
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
      this.emitToolStarted(onEvent, "place_npc", args);
      if (this.activeTurnSignal?.aborted) break;
      const reason = harnessToolReason("spec-npc", name);
      const result = this.readEvidence.beforeWrite(this.ctx.project, "place_npc", args)
        ?? runTool(this.ctx, "place_npc", args, { dryRun: false });
      this.pushAudit({
        kind: "tool",
        name: "place_npc",
        args,
        ok: result.ok,
        summary: `${result.summary} (밑그림 npc 에셋 자동 실행)`,
        reason,
        ...(result.issues && result.issues.length > 0 ? { issues: result.issues.map((issue) => issue.message) } : {}),
      });
      if (!result.ok || !result.diff) {
        onEvent({ type: "tool_call", name: "place_npc", args, result, reason });
        continue;
      }
      this.recordToolResult("place_npc", args, result);
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
      onEvent({ type: "tool_call", name: "place_npc", args, result, reason });
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
    const operation = this.runOperation;
    operation.assertCurrent();
    if (signal?.aborted || this.eventCommandScope) return "none";
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
        worldCanon: this.ctx.project.worldCanon,
        existingCast: existingCastOnMap(this.ctx.project, mapId, new Set(residents.map((npc) => npc.eventId))),
        residents,
      };
      onEvent({ type: "status", text: `주민 ${residents.length}명의 이름·대사를 쓰는 중…` });
      const sheet = await operation.wait(this.requestCastSheet(ctx, signal));
      if (!sheet.ok) {
        this.rekickPendingNpcDialogue(onEvent, mapId, residents.map((npc) => npc.eventId), sheet.issues);
        outcome = "rekick";
        continue;
      }
      const args: Record<string, unknown> = { mapId, residents: sheet.sheet.residents };
      this.emitToolStarted(onEvent, "author_npc_cast", args);
      if (signal?.aborted) return "none";
      const reason = harnessToolReason("npc-cast", `${ctx.mapName} 주민 ${residents.length}명`);
      const result = this.readEvidence.beforeWrite(this.ctx.project, "author_npc_cast", args)
        ?? runTool(this.ctx, "author_npc_cast", args, { dryRun: false });
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
        onEvent({ type: "tool_call", name: "author_npc_cast", args, result, reason });
        this.rekickPendingNpcDialogue(onEvent, mapId, residents.map((npc) => npc.eventId), [result.summary]);
        outcome = "rekick";
        continue;
      }
      this.recordToolResult("author_npc_cast", args, result);
      this.upsertProposal(proposedByKey, { name: "author_npc_cast", args, summary: result.summary, result, destructive: false, requiresApproval: false, reason });
      this.pushAudit({ kind: "status", text: `npc-cast:applied map=${mapId} residents=${sheet.sheet.residents.map((resident) => resident.name).join(",")}` });
      if (outcome === "none") outcome = "applied";
      onEvent({ type: "tool_call", name: "author_npc_cast", args, result, reason });
    }
    return outcome;
  }

  /** lite 모델에 시트를 요청한다 — 검증 실패면 사유를 붙여 1회 재요청. 어떤 예외도 밖으로 내지 않는다. */
  private async requestCastSheet(ctx: CastContext, signal: AbortSignal | undefined): Promise<ReturnType<typeof parseCastSheet>> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const messages = buildCastWriterMessages(ctx);
    let issues: readonly string[] = [];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await operation.wait(this.chat(this.config.roleModels?.writer ? configForRole(this.config, "writer") : configForLiteModel(this.config), {
          messages: issues.length === 0
            ? messages
            : [...messages, { role: "user", content: `이전 시트는 거부되었습니다. 아래를 고쳐 JSON 전체를 다시 쓰세요:\n- ${issues.join("\n- ")}` }],
          response_format: { type: "json_object" },
          temperature: 0.8,
          signal,
          disableTransientRetry: true,
        }));
        const text = typeof result.message.content === "string" ? result.message.content : "";
        const parsed = parseCastSheet(text, ctx);
        if (parsed.ok) return parsed;
        issues = parsed.issues;
        this.pushAudit({ kind: "status", text: `npc-cast:rejected attempt=${attempt + 1} — ${issues.join(" / ").slice(0, 600)}` });
      } catch (cause) {
        operation.assertCurrent();
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

  /** Shared by session review/auto-completion and panel completion accounting.
   * Only changed maps participate; precedence is applied independently per map.
   */
  getCompletionSpecs(calls: readonly ProposalCompletenessCall[], item?: WorkItem): BuildSpec[] {
    const mapIds = new Set([...this.specsByMap.keys(), ...this.carryoverSpecsForTurn.keys()]);
    if (this.turnImplicitSpec) mapIds.add(this.turnImplicitSpec.mapId);
    const viewSpec = this.turnViewSpec && (!item || this.inferredViewSpecForItem(item)) ? this.turnViewSpec : null;
    if (viewSpec) mapIds.add(viewSpec.mapId);
    const specs: BuildSpec[] = [];
    for (const mapId of [...mapIds].sort()) {
      if (!proposalHasChangedMap(calls, mapId)) continue;
      const entry = this.specsByMap.get(mapId);
      const spec = (entry?.turnIndex === this.currentTurnIndex ? entry.spec : null)
        ?? (this.turnImplicitSpec?.mapId === mapId ? this.turnImplicitSpec : null)
        ?? (viewSpec?.mapId === mapId ? viewSpec : null)
        ?? this.carryoverSpecsForTurn.get(mapId)
        ?? (this.turnExpectsChange() ? entry?.spec : null);
      if (spec) specs.push(spec);
    }
    return specs;
  }

  private inferredViewWarnings(calls: readonly ProposedCall[], item?: WorkItem): string[] {
    const spec = this.turnViewSpec;
    if (!spec || (item && !this.inferredViewSpecForItem(item))) return [];
    // An NPC touching the pond's rectangle is not evidence of terrain placement.
    return buildSpecCompletenessWarnings(spec,
      calls.filter(call => spec.assets.some(asset =>
        asset.kind === "selection" ? SPATIAL_BUILD_TOOLS.has(call.name) : asset.kind === autoExpandedAssetKind(call.name))),
    );
  }

  private inferredViewSpecForItem(item: WorkItem | null): BuildSpec | null {
    const spec = this.turnViewSpec;
    if (!spec || !item) return null;
    if (this.turnViewSpecWorkItemId !== null) return this.turnViewSpecWorkItemId === item.id ? spec : null;
    const asset = spec.assets[0];
    const placement = implicitSpecFromViewLocation({ mapId: spec.mapId, requestText: item.instruction, rect: asset });
    return placement?.assets.some(candidate => candidate.kind === asset.kind) ? spec : null;
  }

  /**
   * 이 턴이 실제로 만든 쓰기 전체 — 마일스톤으로 적용을 끝낸 몫 + 아직 적용 전인 제안.
   *
   * 판정(완성도 린트·diff 요약·밑그림 이행)은 반드시 이 합집합을 봐야 한다. 적용(재실행)은
   * `proposedCalls` 만 봐야 한다 — 원장의 호출은 이미 저장소에 들어가 있다.
   */
  private turnWriteLedger(pending: readonly ProposedCall[]): ProposedCall[] {
    return [...this.turnAppliedMilestoneCalls, ...pending];
  }

  /**
   * 2026-09-17 독립 검수(LLM 재심사) 해체 → 결정적 검사.
   *
   * 실측: 검수 모델이 요약에는 "요청 조건대로 배치되고 검증되었습니다" 라 쓰고 판정은 changes_requested 를
   * 냈다(rev 9). 필수 문제 목록에는 리사이즈 전 좌표로 만든 stale reachability finding, 24칸 단위 이미지
   * 확인 누락, 수용 원장 항목이 섞여 있어 모델이 고칠 수 없는 것을 고치라고 했고, 수리 단계는 읽기 도구만
   * 41회 돌리다 예산을 다 썼다. 세 런 모두 초안이 통째로 버려졐다.
   *
   * 지금 승인 기준은 하나다: 변경된 맵의 lint error 가 0 이다. 이미지 확인·검증 원장·수용 항목은
   * 승인 조건이 아니다. lint error 가 있으면 그 목록을 findings 로 돌려 모델이 고치게 한다.
   */
  private async reviewCurrentDraft(onEvent: (event: SessionEvent) => void, signal: AbortSignal | undefined,
    _remainingTokens: number): Promise<ResultReview> {
    const operation = this.runOperation;
    operation.assertCurrent();
    let revision = this.reviewRevision;
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    this.consumedApprovedRevision = null;
    const owner = this.reviewTurn;
    let candidate: { identity: string; acceptance: AcceptanceSnapshot | null } | null = null;
    let review: ResultReview;
    try {
      if (signal?.aborted) throw new Error("independent-review-cancelled");
      if (!this.draftBaselineCurrent) throw new Error("independent-review-stale-baseline: regenerate from the current project before review");
      const wikiSync = syncDraftWikiWithLive(this.ctx.project.world, this.baselineProject.world, this.observedLiveWorld);
      if (wikiSync.changed) {
        this.ctx.project = { ...this.ctx.project, world: wikiSync.world };
        revision = ++this.reviewRevision;
        this.invalidateVerificationAfterWrite();
        this.imageEvidence.current(this.ctx.project);
      }
      if (this.reviewDraftTransform) {
        const prepared = this.reviewDraftTransform(this.getProposedProject());
        if (JSON.stringify(prepared) !== JSON.stringify(this.ctx.project)) {
          this.ctx.project = prepared;
          revision = ++this.reviewRevision;
          this.invalidateVerificationAfterWrite();
          this.imageEvidence.current(prepared);
        }
      }
      const identity = JSON.stringify(this.ctx.project);
      this.emitPhase(onEvent, "review");
      const draftAcceptance = this.acceptance?.evaluateForReview(this.ctx.project, this.verificationEvidence) ?? null;
      const changedMapIds = [...new Set([...Object.keys(this.reviewBaseline.maps), ...Object.keys(this.ctx.project.maps)])]
        .filter(id => acceptanceFingerprint(this.reviewBaseline.maps[id]) !== acceptanceFingerprint(this.ctx.project.maps[id]));
      const findings = deterministicDraftFindings(this.ctx.project, changedMapIds, this.reviewBaseline);
      const wikiFindings = wikiSync.conflicts.map((id, index): ReviewFinding => ({ id: `wiki-${index + 1}`, target: `world/${id}`,
        problem: "draft edits a wiki-owned document without a coordinator receipt", requestedChange: "regenerate from the current project", validation: "no wiki conflict" }));
      const all = [...findings, ...wikiFindings];
      review = all.length === 0
        ? { status: "approved", revision, findings: [], summary: `결정적 검사 통과 — 변경 맵 ${changedMapIds.length}개, lint error 0건.` }
        : { status: "changes_requested", revision, findings: all, summary: `결정적 검사 미통과 — lint error ${all.length}건: ${all.slice(0, 3).map(f => f.problem).join(" / ")}${all.length > 3 ? " …" : ""}` };
      if (review.status === "approved") candidate = { identity, acceptance: draftAcceptance };
    } catch (cause) {
      review = { status: "error", revision, findings: [], summary: cause instanceof Error ? cause.message : String(cause) };
    }
    if (owner !== this.reviewTurn) return { status: "error", revision, findings: [], summary: "independent-review-superseded" };
    this.resultReview = review;
    this.pushAudit({ kind: "status", text: `deterministic-review ${JSON.stringify(review)}` });
    onEvent({ type: "result_review", review });
    if (candidate && owner === this.reviewTurn && !signal?.aborted && candidate.identity === JSON.stringify(this.ctx.project)) {
      this.approvedReviewIdentity = candidate.identity;
      this.approvedAuthoredIdentity = authoredIdentity(this.ctx.project);
      for (const item of candidate.acceptance?.items ?? []) this.acceptance?.review(item.id, review.summary, this.ctx.project, "pass");
    }
    return review;
  }

  private async chatWithTransientRetry(
    config: AiConfig,
    req: ChatRequest,
    onEvent: (event: SessionEvent) => void,
    signal?: AbortSignal,
    emitTokens = true
  ): Promise<ChatResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
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
        const result = await operation.wait(this.chat(config, {
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
        }));
        tokenGuard?.flush();
        return result;
      } catch (cause) {
        operation.assertCurrent();
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
        await operation.wait(sleep(LLM_RETRY_BACKOFF_MS * attempt));
      }
    }
  }

  private async runTurnLoop(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<TurnResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    const owner = { signal };
    this.reviewTurn = owner;
    this.approvedReviewIdentity = null;
    this.approvedAuthoredIdentity = null;
    let completed = false;
    try {
      const result = await operation.wait(this.executeTurnLoop(onEvent, signal));
      completed = result.stoppedReason === "final" && !signal?.aborted && !this.milestoneApplyFailed;
      return result;
    } finally {
      // Includes thrown subscribers/tool errors, not just returned stop reasons.
      // An older attempt must not retire a newer attempt's review authority.
      if (!completed && this.reviewTurn === owner) {
        this.approvedReviewIdentity = null;
        this.approvedAuthoredIdentity = null;
        this.reviewTurn = null;
      }
    }
  }

  private async executeTurnLoop(onEvent: (event: SessionEvent) => void, signal?: AbortSignal): Promise<TurnResult> {
    const operation = this.runOperation;
    operation.assertCurrent();
    this.lastTurnFailed = false;
    // WorkPlan 툴(set/get_work_plan, complete/skip_work_item)은 **계획을 실제로 쓰는 턴에만**
    // 붙인다. 예전에는 무조건 붙어서, 오케스트레이션이 꺼진 기본 설정(감독=실행 모델 동일)에서
    // 플래너가 돌지도 않는데 4개가 매 요청에 실려 갔다(실측: 45개 중 4개).
    // 조건은 아래 `orchestrated` 와 같아야 한다 — 계획 단계를 알리면서 계획 툴을 숨기면 모순이다.
    const planToolsOn = (this.orchestrationEnabled() || Boolean(this.workPlan)) && !this.skipPlannerThisTurn;
    const proposedByKey = this.turnProposals;
    let assistantText = "";
    const orchestrated = (this.orchestrationEnabled() || Boolean(this.workPlan)) && !this.skipPlannerThisTurn;
    let phase: AssistantPhase = this.workPlan ? "execute" : "plan";
    let executionStarted = Boolean(this.workPlan);
    let writeToolAttempts = 0;
    let zeroChangeRekickUsed = false;
    let npcCastRekickUsed = false;
    let turnTheme = "";
    if (orchestrated) this.emitPhase(onEvent, phase);
    if (this.workPlan) this.addExecutionHintIfNeeded();
    // 에이전틱 예산: 사용자 제한은 출력 토큰 하나뿐. 루프 깊이는 사실상 무제한이고
    // (maxToolCalls 기본 2000은 폭주 방지 안전핀), 누적 출력 토큰이 maxTokens를 넘으면 멈춘다.
    // 다이얼 명시 시 레벨의 budgetCap 을 추가로 씌운다 — 미지정 config 는 종래 상한 그대로.
    const autonomyCap = this.autonomy()?.budgetCap;
    const originalRoundCap = autonomyCap === undefined ? this.config.maxToolCalls : Math.min(this.config.maxToolCalls, autonomyCap);
    const roundCap = Math.min(originalRoundCap, this.recoveryBudget?.remainingToolCalls ?? originalRoundCap);
    const outputLimit = Math.min(this.config.maxTokens, this.recoveryBudget?.remainingOutputTokens ?? this.config.maxTokens);
    this.recoveryBudget = null;
    this.checkpointRoundLimit = roundCap;
    this.checkpointOutputLimit = outputLimit;
    this.checkpointRoundsUsed = 0;
    this.checkpointOutputStart = this.estimatedOutputTotal;
    let spentOutputTokens = 0;
    // Turn-local: a failed/dropped request cannot revive these captures on a later turn.
    let pendingImages: { parts: ImageUrlPart[]; receipts: AcceptanceImageReceipt[] } | null = null;
    const outputAtStart = this.estimatedOutputTotal;

    for (let round = 0; round < roundCap; round += 1) {
      // 라운드 예산만 갱신한다. 쓰기는 저작 결과가 바뀌는 tool_call 과 적용·저장·증명 경계가
      // 담당하고, 갱신된 예산은 그 다음 쓰기에 함께 실린다. 라운드마다 또 쓰면 같은 라운드에
      // 두 번 쓰는 셈이고, 한 번의 쓰기가 프로젝트 여러 벌을 복제·재검증한다 —
      // 실측(2026-09-09): 검증만 1회 약 120ms, 사건 캡처 한 줄이 30초였다.
      this.checkpointRoundsUsed = round + 1;
      if (signal?.aborted) {
        this.runExecution = "cancelled";
        this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
      }
      spentOutputTokens = this.estimatedOutputTotal - outputAtStart;
      if (spentOutputTokens >= outputLimit) {
        this.runExecution = "budget-exhausted";
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "token-budget" };
      }
      let result: ChatResult;
      // Start with a small control plane plus intent/plan/discovery candidates.
      // A discovery miss or neutral routing flips turnFullCatalogFallback and
      // restores the complete native catalog on the next round.
      const tools = [
        ...buildSessionRegistryTools({
          requestText: this.currentTurnInstruction,
          intent: this.turnIntent,
          discoveredToolNames: this.turnEscalatedToolNames,
          requiredReadTools: this.readEvidence.requiredReadTools(),
          workPlan: this.workPlan,
          fullCatalogFallback: this.eventCommandScope ? true : this.turnFullCatalogFallback,
        }),
        GET_ORIGINAL_CONTEXT_TOOL,
        CORRECT_VERIFICATION_TOOL,
        ...(this.npcRewardRequirements ? [VERIFY_NPC_REWARD_TOOL] : []),
        SET_BUILD_SPEC_TOOL,
        ...(planToolsOn ? WORK_PLAN_TOOLS : []),
        ...(this.acceptance ? ACCEPTANCE_TOOLS : []),
      ]
        .filter((tool) => !this.eventCommandScope || eventScopeAllowsTool(tool.function.name))
        .filter((tool) => this.turnComposerMode !== "ask" || !isWriteToolName(tool.function.name))
        .map((tool) => tool.function.name === "verify_npc_reward" ? tool : injectToolReasonIntoOpenAiTool(tool));
      const toolsChars = JSON.stringify(tools).length;
      // 카탈로그는 라운드마다 거의 그대로다. 매번 227개 이름을 찍으면 clipText 상한(4KB)에 걸린
      // 행이 라운드마다 쌓여 AUDIT_BUDGET_BYTES(384KB)를 상수 문자열로 다 먹고, fitWithinBudget 이
      // 가운데를 버려 **실제 대화 기록이 축출된다**(2026-09-10 실측: 대화 472건 유실, planner:replan
      // 원문 소실). 변경될 때만 전체 목록을 남기고 그 외에는 개수만 남긴다.
      const toolCatalog = tools.map((tool) => tool.function.name).join(",");
      const catalogChanged = toolCatalog !== this.lastAuditedToolCatalog;
      this.lastAuditedToolCatalog = toolCatalog;
      this.pushAudit({
        kind: "status",
        text: catalogChanged
          ? `tools:exposed ${tools.length} — ${toolCatalog}`
          : `tools:exposed ${tools.length} (카탈로그 동일)`,
      });
      // 컨텍스트 압축(요약)은 요청 조립보다 **먼저** 돈다: 대화 자체를 줄이지 못하면
      // 아래 문자 클램프가 오래된 assistant/tool 을 통째로 버려 기억이 소리 없이 사라진다.
      await operation.wait(this.maybeCompactConversation(onEvent, signal));
      let requestMessages: ChatMessage[] = [];
      try {
        const rewardNote = this.npcRewardNote();
        const grounded = buildGroundedRequest(
          rewardNote ? [...this.messages, { role: "user", content: rewardNote }] : this.messages,
          tools,
          this.phaseConfig(phase),
          this.originalContext!,
        );
        requestMessages = grounded.messages;
        this.pushAudit({ kind: "status", text: `context:grounded ${JSON.stringify(grounded.budget)} originals=${grounded.includedIds.length}/${this.originalContext!.context.entries.length}` });
        result = await operation.wait(this.chatWithTransientRetry(
          this.phaseConfig(phase),
          { messages: requestMessages, tools, tool_choice: "auto" },
          onEvent,
          signal,
          this.turnComposerMode === "ask" || this.turnIntent?.mode === "question"
        ));
        // Only exact originals and native/monster reads in a successful writer request count.
        this.originalContext!.observeDelivered(requestMessages, grounded.includedIds, this.readEvidence);
        this.readEvidence.observeDelivered(requestMessages);
      } catch (cause) {
        operation.assertCurrent();
        if (isLlmAbortError(cause) || signal?.aborted) {
          this.lastTurnFailed = false;
          this.pushAudit({ kind: "status", text: "턴 중단(aborted): 사용자가 중단했습니다" });
          this.runExecution = "cancelled";
          return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted", error: "사용자가 중단했습니다" };
        }
        const rawError = cause instanceof Error ? cause.message : String(cause);
        const error = isRetryableLlmError(cause) && !isOhMyPiWorkerCrash(cause)
          ? appendTransientRetryGuidance(rawError)
          : rawError;
        this.runExecution = "failed";
        this.lastTurnFailed = true; // 수동 재시도(retryLastTurn) 허용 상태로 표시.
        this.pushAudit({ kind: "status", text: `턴 중단(error): ${error} · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error", error };
      }
      if (pendingImages) {
        const delivered = new Set(result.imageDelivery?.flatMap(({ messageIndex, partIndex }) => {
          const content = requestMessages[messageIndex]?.content;
          return Array.isArray(content) && content[partIndex]?.type === "image_url" ? [content[partIndex]] : [];
        }));
        if (!signal?.aborted && pendingImages.parts.every(part => delivered.has(part))) {
          this.imageEvidence.current(this.ctx.project);
          this.imageEvidence.deliver(pendingImages.receipts);
        } else {
          const text = "Image delivery was not acknowledged; render and send the map again before review_acceptance.";
          this.pushAudit({ kind: "status", text: `acceptance:image-delivery-failed ${text}` });
          onEvent({ type: "status", text });
          this.pushOrchestrationMessage(text);
        }
        pendingImages = null;
      }
      spentOutputTokens = this.estimatedOutputTotal - outputAtStart;
      // 문자↔토큰 보정 관측(usage 없으면 조용히 스킵). review 단계 요청에는 tools가 없다.
      this.recordPromptUsage(result, toolsChars, requestMessages);

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

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        const finalText = sanitizeAssistantText(messageText ?? "");
        // Before the first project write, retain the existing bounded acceptance
        // repair path. There is no result for an independent reviewer yet.
        this.adoptAcceptance(undefined, onEvent);
        const assessment = await operation.wait(this.assessCompletion(onEvent));
        const noWriteProblems = proposedByKey.size === 0
          ? [...assessment.adventure, ...assessment.blockingVerification] : [];
        if (proposedByKey.size === 0 && this.turnComposerMode !== "ask" && this.turnIntent?.mode !== "question"
          && (this.acceptanceOpen() || noWriteProblems.length > 0)) {
          if (this.acceptanceRepairAttempts < MAX_RALPH_ATTEMPTS_PER_ITEM && spentOutputTokens < this.config.maxTokens) {
            this.acceptanceRepairAttempts += 1;
            phase = "execute";
            this.emitPhase(onEvent, "execute");
            this.pushOrchestrationMessage(`Repair the original acceptance and completion requirements with actual tools. Fix failed explicit checks and rerun stale checks after the last write. Do not skip, shrink or recreate completed content.\n${JSON.stringify({ acceptance: this.getAcceptanceSnapshot(), completionProblems: noWriteProblems })}`);
            continue;
          }
          if (this.milestoneApplyFailed) this.runExecution = "failed";
          else this.stopForAcceptance();
          this.acceptance?.stop();
          this.publishAcceptance(onEvent);
          const error = this.acceptanceOpen() ? this.acceptanceIncompleteText()
            : `요청한 구성이 아직 미완성입니다.\n${noWriteProblems.map(problem => `- ${problem}`).join("\n")}`;
          return { assistantText: error, error, proposedCalls: [], stoppedReason: "error" };
        }
        // Ralph loop: incomplete WorkPlan → re-inject current item; do not early-exit.
        // 단, 현재 턴의 마일스톤 적용이 실패했으면 저장소와 draft가 어긋난 채 다음 항목을
        // 저작하지 않는다. 새 사용자 메시지가 실패 상태를 해제한 뒤 이어갈 수 있다.
        const workPlanDecision = !this.milestoneApplyFailed && this.turnComposerMode !== "ask"
          ? ralphContinuationDecision(this.workPlan, { autoStepsUsed: this.workPlanAutoStepsThisUserMessage, assistantText: finalText })
          : null;
        if (workPlanDecision === "continue") {
          // 같은 항목을 상한만큼 밀어붙였는데도 안 되면 재주입을 멈추고 사용자에게 넘긴다.
          const stalled = this.blockStalledWorkItem(onEvent);
          if (stalled) {
            this.runExecution = "blocked";
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
          const cast = await operation.wait(this.authorPendingNpcCast(onEvent, signal, proposedByKey, turnTheme || this.getActiveSpec()?.title || ""));
          if (cast === "rekick") {
            npcCastRekickUsed = true;
            phase = "execute";
            executionStarted = true;
            continue;
          }
        }
        // 레이어 검증(자문): 최종 응답 전에 1회 돌려 지적을 근거로 남긴다. 런은 멈추지 않는다.
        await operation.wait(this.sweepFinishedLayers(onEvent));
        if (workPlanDecision !== null) this.recordWorkPlanDecision(workPlanDecision);
        if (signal?.aborted) return { assistantText: "사용자가 중단했습니다", proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted" };
        if (this.turnComposerMode !== "ask" && proposedByKey.size > 0) {
          // 결정적 검사는 LLM 라운드도 출력 토큰도 쓰지 않는다 — 예산이 바닥이어도 돌린다.
          spentOutputTokens = this.estimatedOutputTotal - outputAtStart;
          this.adoptAcceptance(undefined, onEvent);
          this.captureCheckpoint();
          await operation.wait(this.checkpointBestEffort());
          const review = await operation.wait(this.reviewCurrentDraft(onEvent, signal, outputLimit - spentOutputTokens));
          if (signal?.aborted) return { assistantText: "사용자가 중단했습니다", proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted" };
          if (review.status !== "approved") {
            const failure = JSON.stringify([this.ctx.project, review.findings.map(({ target, problem, requestedChange }) => ({ target, problem, requestedChange }))]);
            const stalled = failure === this.lastReviewFailure;
            this.lastReviewFailure = failure;
            this.reviewAttempts += 1;
            if (review.status === "error" || stalled || this.reviewAttempts >= MAX_RALPH_ATTEMPTS_PER_ITEM) {
              this.runExecution = review.status === "error" ? "failed" : "blocked";
              const error = `결정적 검사 미통과: ${review.summary}${stalled ? " (동일 실패 반복)" : ""}`;
              this.lastTurnFailed = review.status === "error";
              onEvent({ type: "assistant_message", content: error });
              return { assistantText: error, error, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error" };
            }
            phase = "execute";
            this.emitPhase(onEvent, "execute");
            this.pushOrchestrationMessage(`Repair this same draft using the structured independent findings. Read current records before changing them; do not recreate the project or weaken requirements. Then finish for a new independent review.\n${JSON.stringify(review)}`);
            continue;
          }
          await operation.wait(this.maybeAutoApplyMilestone({ id: `review-${review.revision}`, title: this.workPlan?.goal ?? this.currentTurnInstruction,
            instruction: "Apply independently approved draft", status: "done" }, onEvent));
          if (!this.draftBaselineCurrent) return { assistantText: this.resultReview?.summary ?? "Stale authored baseline",
            error: this.resultReview?.summary, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "error" };
        }
        // 모델의 마지막 말이 사용자에게 가는 본문이다(질문·[선택지] 포함 — 드라이버의 일시정지 판정도 이 텍스트를 본다).
        // 결정적 검사 결과는 그 뒤에 한 줄로 붙인다. 옛 LLM 검수는 자기 요약으로 본문을 갈아치웠다.
        assistantText = this.npcRewardFinalText(this.turnComposerMode !== "ask" && (proposedByKey.size > 0 || this.turnAppliedMilestoneCalls.length > 0)
          ? [sanitizeAssistantText(finalText).trim(), this.resultReview?.summary ?? ""].filter(Boolean).join("\n\n") : finalText);
        onEvent({ type: "assistant_message", content: assistantText });
        this.pushAudit({ kind: "status", text: `턴 종료(final) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return { assistantText, proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "final" };
      }

      const startsWriteThisRound = toolCalls.some((call) => isWriteToolName(call.function.name));
      // 이번 라운드에 렌더된 비전 이미지(있으면 툴 메시지 뒤에 user 메시지로 주입).
      const roundImages: RenderedToolImage[] = [];
      const acceptanceImages: AcceptanceImageReceipt[] = [];
      // Capture before any complete/skip/set tools mutate the cursor.
      const workItemIdAtRoundStart = this.workPlan?.currentItemId ?? null;
      // 이 응답 안의 읽기가 실패하면 이후 쓰기는 다음 모델 응답까지 보류한다.
      // 같은 배치의 인자는 실패 결과를 보기 전에 만들어졌다. 뒤쪽 읽기가 성공해도
      // 모델이 그 결과를 소비한 것은 아니므로 현재 배치의 쓰기를 다시 열지 않는다.
      let failedReadInBatch: string | null = null;
      const failedSpecMaps = new Set<string>();
      const failedRecords = new Map<string, BatchRecordTarget>();
      const failedWriteTargets = new Map<string, string>();
      const successfulWriteTargets = new Set<string>();
      // 각 tool_call 실행 → role:"tool" 메시지로 결과 반환.
      for (const call of toolCalls) {
        const parsedCall = parseToolCall(call);
        const name = parsedCall.name;
        const split = splitToolCallReason(this.resolveToolCallArgs(name, parsedCall.args));
        const args = split.args;
        const callReason = split.reason;
        const tool = getTool(name);
        if (typeof args.theme === "string" && args.theme.trim()) turnTheme = args.theme.trim();
        this.emitToolStarted(onEvent, name, args);
        await operation.wait(this.yieldForUi(signal));
        if (tool?.mode === "write" || name === APPEARANCE_GENERATION_TOOL || name === OPENING_IMAGE_TOOL || name === GAME_OVER_IMAGE_TOOL || name === IMAGE_ASSET_TOOL) writeToolAttempts += 1;
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
          if (tool?.mode === "read") this.readEvidence.queue({ toolCallId: call.id, name, args, result });
        };
        try {
          // Tool subscribers may synchronously replace this run. Publish only after
          // the completed tool's proposal, audit and protocol response are recorded.
          const toolEvents: SessionEvent[] = [];
          const publishToolEvent = (event: SessionEvent) => { toolEvents.push(event); };
          let completedItem: WorkItem | null = null;
          // 스펙 게이트: set_build_spec은 세션이 직접 처리(검증·활성화)하고,
          // 공간 쓰기 툴은 검증된 밑그림의 할당 영역 안에서만 실행한다(구간 격리).
          let toolResult: ToolResult;
          const recordedReason = isUsableToolReason(callReason)
            ? callReason
            : "이유 없음 — 모델이 reason 을 생략함";
          if (split.missing && parsedCall.parseError === null) {
            this.pushAudit({ kind: "status", text: `tool-args:missing-reason ${name}` });
          }
          const recordDependency = tool?.mode === "write" ? failedRecordReference(args, failedRecords) : undefined;
          if (signal?.aborted) {
            toolResult = deferredToolResult("cancelled", "사용자가 중단하여 실행하지 않았습니다.");
          } else if (parsedCall.parseError !== null) {
            toolResult = invalidJsonArgsResult(name, call.function.arguments ?? "", parsedCall.parseError);
            this.pushAudit({ kind: "status", text: `tool-args:invalid-json ${name} — ${parsedCall.parseError}` });
          } else if (this.eventCommandScope && eventScopeRefusal(this.eventCommandScope, name, args)) {
            toolResult = eventScopeRefusal(this.eventCommandScope, name, args)!;
          } else if (this.turnComposerMode === "ask" && isWriteToolName(name)) {
            // 노출 목록은 감사용이고 실행은 이름으로 한다 — 모델이 외워 둔 쓰기 툴을 불러도 여기서 막는다.
            toolResult = composerAskRefusal(name);
            this.pushAudit({ kind: "status", text: `composer:ask 쓰기 툴 거부 ${name}` });
          } else if (failedReadInBatch && isWriteToolName(name)) {
            const summary = `${failedReadInBatch} 조회가 실패하여 같은 응답의 ${name} 실행을 보류했습니다. 조회를 성공시키고 반환값을 확인한 다음 다시 호출하세요.`;
            toolResult = deferredToolResult("read-dependency-failed", summary);
          } else if ((SPATIAL_BUILD_TOOLS.has(name) || TILE_WRITE_TOOLS.has(name)) && failedSpecMaps.has(toolTargetMapId(args) ?? "")) {
            toolResult = deferredToolResult("build-spec-dependency-failed", `${name}: 이 응답의 대상 맵 밑그림이 거부되어 실행을 보류했습니다. set_build_spec을 고쳐 제출하세요.`);
          } else if (recordDependency) {
            toolResult = deferredToolResult("record-dependency-failed", `${name}: ${recordDependency.kind} ${recordDependency.id} 생성이 실패하여 실행을 보류했습니다. 생성·조회 후 다시 호출하세요.`);
          } else if (name === "complete_work_item" && failedWriteTargets.size > 0) {
            toolResult = deferredToolResult("work-dependency-failed", `이 응답에서 ${[...new Set(failedWriteTargets.values())].join(", ")} 실행이 실패하여 완료 처리를 보류했습니다. 실패를 교정한 뒤 완료하세요.`);
          } else if (this.repeatedToolFailureStall(toolRetryTarget(name, args))) {
            toolResult = deferredToolResult("tool-retry-exhausted", `${name}: 같은 대상의 실패 상한에 도달하여 실행을 보류했습니다. 사용자 지시가 필요합니다.`);
          } else if (name === "correct_verification") {
            toolResult = await operation.wait(this.correctVerification(args, signal));
          } else if (VERIFICATION_TOOL_NAMES.has(name)) {
            toolResult = await operation.wait(this.executeVerificationTool(name, args, signal));
          } else if (name === "verify_npc_reward") {
            // Validate raw args, before generic reason stripping or target normalization.
            toolResult = this.verifyNpcRewardTool(parsedCall.args, signal);
          } else if (name === "get_original_context") {
            toolResult = this.originalContext!.read(args);
          } else if (name === "repair_acceptance" || name === "review_acceptance") {
            toolResult = this.applyAcceptanceTool(name, args);
            this.publishAcceptance(publishToolEvent);
          } else if (name === "set_build_spec") {
            toolResult = this.applyBuildSpec(args);
          } else if (name === OPENING_IMAGE_TOOL) {
            const { generateOpeningStill } = await operation.wait(import("@/editor/openingImageGeneration"));
            const still = await operation.wait(generateOpeningStill(args, { signal }));
            if (!still.ok) {
              toolResult = { ok: false, summary: still.summary, issues: [{ severity: "error", code: still.code, message: still.summary }] };
            } else {
              // 등록은 기존 쓰기 툴로 — 제안·diff 회계를 그대로 타고 dataUrl 은 전사에 남지 않는다.
              const applied = runTool(this.ctx, "upsert_resource", {
                resource: { id: still.resourceId, name: still.name, kind: "backdrop", dataUrl: still.dataUrl },
              }, { dryRun: false });
              toolResult = applied.ok
                ? {
                  ...applied,
                  summary: `오프닝 그림 ${still.resourceId} 를 만들어 등록했습니다. image 장면의 resourceId 로 쓰세요.`,
                  data: { status: "generated", resourceId: still.resourceId, name: still.name },
                }
                : applied;
            }
          } else if (name === GAME_OVER_IMAGE_TOOL) {
            const { generateGameOverStill } = await operation.wait(import("@/editor/openingImageGeneration"));
            const still = await operation.wait(generateGameOverStill(args, { signal }));
            if (!still.ok) {
              toolResult = { ok: false, summary: still.summary, issues: [{ severity: "error", code: still.code, message: still.summary }] };
            } else {
              const applied = runTool(this.ctx, "upsert_resource", {
                resource: { id: still.resourceId, name: still.name, kind: "backdrop", dataUrl: still.dataUrl },
              }, { dryRun: false });
              toolResult = applied.ok
                ? {
                  ...applied,
                  summary: `게임오버 그림 ${still.resourceId} 를 만들어 등록했습니다. set_game_over의 backgroundResourceId로 연결하세요.`,
                  data: { status: "generated", resourceId: still.resourceId, name: still.name },
                }
                : applied;
            }
          } else if (name === IMAGE_ASSET_TOOL) {
            const { generateImageAsset } = await operation.wait(import("@/editor/imageAssetGeneration"));
            const asset = await operation.wait(generateImageAsset(args, { signal }));
            if (!asset.ok) {
              toolResult = { ok: false, summary: asset.summary, issues: [{ severity: "error", code: asset.code, message: asset.summary }] };
            } else {
              const applied = runTool(this.ctx, "upsert_resource", {
                resource: {
                  id: asset.resourceId, name: asset.name, kind: asset.kind, dataUrl: asset.dataUrl,
                  ...(asset.kind === "monster" ? { monsterMetadata: { name: asset.name, tags: asset.tags, description: asset.prompt } } : {}),
                },
              }, { dryRun: false });
              toolResult = applied.ok
                ? {
                  ...applied,
                  summary: `${asset.kind} 그림 ${asset.resourceId} 를 만들어 등록했습니다. ${asset.kind === "monster" ? "get_monster_resource로 상세를 조회한 뒤 enemy.monsterResourceId와 appearanceTags에 연결하세요." : "관련 DB/시스템 레코드에 resourceId를 연결하세요."}`,
                  data: { status: "generated", kind: asset.kind, resourceId: asset.resourceId, name: asset.name, tags: asset.tags },
                }
                : applied;
            }
          } else if (name === APPEARANCE_GENERATION_TOOL) {
            const { startAppearanceGenerationFromAssistant } = await operation.wait(import("@/editor/characterAppearanceGeneration"));
            const handoff = await operation.wait(startAppearanceGenerationFromAssistant(this.ctx.project, args, this.appearanceProjectIdentity, signal));
            toolResult = handoff;
            if (handoff.ok && handoff.data?.status === "generating") this.turnAppearanceGeneration = handoff.data;
          } else if (
            name === "get_work_plan" ||
            name === "set_work_plan" ||
            name === "complete_work_item" ||
            name === "skip_work_item"
          ) {
            toolResult = this.applyWorkPlanTool(name, args);
            if (toolResult.ok) {
              this.emitWorkPlan(publishToolEvent);
              this.publishAcceptance(publishToolEvent);
              if (name === "set_work_plan" && this.workPlan) {
                executionStarted = true;
                phase = "execute";
                this.emitPhase(publishToolEvent, "execute");
                this.injectWorkPlanOrchestration();
              }
              // 명시 complete_work_item 완료 경로 — 마일스톤 자동 적용을 같은 단위로 트리거한다.
              if (name === "complete_work_item" && this.workPlan) {
                const completedId = completedWorkItemIdFromResult(toolResult);
                completedItem = completedId ? findWorkItemById(this.workPlan, completedId) : null;
              }
            }
          } else {
            const readGate = tool?.mode === "write" ? this.readEvidence.beforeWrite(this.ctx.project, name, args) : null;
            const dedupeKey = writeDedupeKey(name, args);
            const cached = dedupeKey ? this.turnWriteDedupe.get(dedupeKey) : undefined;
            if (readGate) {
              toolResult = { ...readGate, data: { code: "tool-deferred", executed: false, reason: "read-before-write-required" } };
            } else if (cached) {
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
              if (isSpecGatePass(gate)) {
                const before = this.ctx.project;
                toolResult = name === EVENT_COMMAND_ASSIST_TOOL
                  ? await operation.wait(runToolAsync(this.ctx, name, args, {
                    dryRun: false, signal: operation.signal, config: this.config, chat: this.chat,
                    projectScopeKey: this.contextOptions.projectScopeKey, eventCommandScope: this.eventCommandScope,
                  }))
                  : runTool(this.ctx, name, args, { dryRun: false });
                if (toolResult.ok) {
                  gate.commitExpansion?.();
                  this.pruneRemovedMapSpecs(before, this.ctx.project, name === "reset_project");
                }
                toolResult = withSpecGateWarnings(toolResult, gate.warnings);
              } else {
                toolResult = gate;
              }
              if (dedupeKey && toolResult.ok) this.turnWriteDedupe.set(dedupeKey, toolResult);
            }
          }
          if (tool?.mode === "write" || name === "set_build_spec") {
            const target = toolRetryTarget(name, args);
            if (toolResult.ok) {
              successfulWriteTargets.add(target);
              failedWriteTargets.delete(target);
            } else if (!successfulWriteTargets.has(target)
              && (!isDeferredToolResult(toolResult) || toolResult.issues?.some((issue) => issue.code === "read-before-write-required"))) {
              failedWriteTargets.set(target, name);
            }
          }
          if (!isDeferredToolResult(toolResult)) {
            if (name === "set_build_spec" && typeof args.mapId === "string") {
              if (toolResult.ok) failedSpecMaps.delete(args.mapId);
              else failedSpecMaps.add(args.mapId);
            }
          }
          // Dependencies require an available record, even when its producer never executed.
          // Track deferred creations too so missing IDs propagate transitively without charging dependents.
          const record = batchRecordTarget(name, args);
          if (record) {
            if (toolResult.ok) failedRecords.delete(record.key);
            else if (!this.ctx.project.database[record.collection].some((entry) => entry.id === record.id)) failedRecords.set(record.key, record);
          }
          if (tool?.mode === "read" || name === "get_original_context") {
            if (!toolResult.ok) failedReadInBatch ??= name;
          }
          // 읽기 툴도 기록한다 — 플래너가 `successTools:["get_map_region"]` 같은 확인 항목을 자주 쓰는데
          // 쓰기만 세면 그 항목은 무슨 짓을 해도 완료할 수 없는 게이트가 된다(2026-08-23 실측: 2회 거부 후 skip).
          this.recordToolResult(name, args, toolResult);
          if (VERIFICATION_TOOL_NAMES.has(name)) toolResult = { ...toolResult,
            data: { ...(isRecord(toolResult.data) ? toolResult.data : {}), verification: this.getVerificationSnapshot(false) } };
          this.publishAcceptance(publishToolEvent);
          this.noteToolRetryResult(name, args, toolResult);
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
          const relocationAvailable = toolResult.issues?.some(issue => issue.relocation !== undefined) === true;
          if (name === "find_tools" || relocationAvailable) {
            const discovered = [...(name === "find_tools" ? discoveredToolNames(toolResult) : []),
              ...(relocationAvailable ? ["move_event"] : [])];
            const next = [...this.turnEscalatedToolNames];
            for (const toolName of discovered) {
              const existing = next.indexOf(toolName);
              if (existing >= 0) next.splice(existing, 1);
              next.push(toolName);
            }
            this.turnEscalatedToolNames = next.slice(-MAX_ESCALATED_TOOLS_PER_TURN);
            if (discovered.length > 0) {
              this.pushAudit({ kind: "status", text: `tools:escalated ${discovered.join(",")}` });
            } else if (name === "find_tools" && toolResult.ok) {
              // A successful search with no matches is the only safe signal
              // that routing did not find the requested capability. Retry the
              // next model round with every active schema instead of claiming
              // the editor cannot do the work.
              this.turnFullCatalogFallback = true;
              this.pushAudit({ kind: "status", text: "tools:fallback full-catalog (discovery-empty)" });
            }
          }
          if (toolResult.ok && tool) recordAssistantToolDomainUse(tool.domains);
          this.pushAudit({
            kind: "tool",
            name,
            args,
            ok: toolResult.ok,
            summary: toolResult.summary,
            reason: recordedReason,
            ...(isDeferredToolResult(toolResult) ? { deferred: true } : {}),
            ...(toolResult.issues?.length ? { issueCodes: toolResult.issues.map((issue) => issue.code) } : {}),
            // 실패/경고 원인은 감사 로그에도 남긴다 — summary만으로 원인 추적이 안 되던 문제 방지.
            ...(toolResult.issues && toolResult.issues.length > 0 ? { issues: toolResult.issues.map((issue) => issue.message) } : {}),
          });
          // 검증 히스토리 기록(todo 5): 쓰기 툴 + play_walkthrough 만 — questId/시나리오 선택에 쓴다.
          // (검증 게이트가 직접 실행한 툴콜은 여기로 오지 않는다 — 모델 저작 히스토리만.)
          if (tool && (tool.mode === "write" || name === PLAY_WALKTHROUGH_TOOL)) {
            this.verificationHistory.push({
              name, args,
              ok: toolResult.ok && (name !== PLAY_WALKTHROUGH_TOOL || this.turnSuccessfulTools.has(name)),
              layerId: this.verificationLayerId(),
            });
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
            // R2: persistent soft-vocabulary origin/source normalization lands in the
            // draft the moment its write succeeds — strictly before review, and before
            // later show_map_region captures, so visual receipts stay valid.
            if (softConfirm) applyVocabSoftConfirmApprovals(this.ctx.project, [softConfirm]);
          }

          respond(toolResult);
          this.publishAcceptance(publishToolEvent);
          for (const event of toolEvents) onEvent(event);
          onEvent({ type: "tool_call", name, args, result: toolResult, reason: recordedReason });
          if (completedItem) {
            await operation.wait(this.maybeAutoApplyMilestone(completedItem, onEvent));
            await operation.wait(this.sweepFinishedLayers(onEvent));
          }

          // 비전(BUG C): '보여줘' 계열 툴이면 이미지를 렌더해 모아둔다. 렌더 실패는 무시(텍스트로 진행).
          if (this.renderImages && VISION_TOOLS.has(name) && toolResult.ok && toolResult.data !== undefined) {
            try {
              const receipt = name === "show_map_region" ? this.imageEvidence.capture(this.ctx.project, toolResult.data) : null;
              const images = await operation.wait(this.renderImages(this.ctx.project, name, toolResult.data));
              roundImages.push(...images);
              if (images.length > 0 && receipt && !signal?.aborted) {
                acceptanceImages.push(receipt);
                this.reviewImages.set(receipt, images);
              }
            } catch (cause) {
              operation.assertCurrent();
              this.pushAudit({ kind: "status", text: `acceptance:image-render-failed ${cause instanceof Error ? cause.message : String(cause)}` });
            }
          }
        } catch (cause) {
          operation.assertCurrent();
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
        pendingImages = { parts: parts.filter(part => part.type === "image_url"), receipts: acceptanceImages };
      }

      if (orchestrated && startsWriteThisRound && !executionStarted) {
        executionStarted = true;
        phase = "execute";
        this.emitPhase(onEvent, "execute");
        this.addExecutionHintIfNeeded();
      }

      if (signal?.aborted) return { assistantText: "사용자가 중단했습니다", proposedCalls: this.finalizeProposals(proposedByKey), stoppedReason: "aborted" };
      // WorkPlan advance: successTools auto-complete OR complete/skip tools moved the cursor.
      await operation.wait(this.noteSuccessfulTools([...this.turnSuccessfulTools], onEvent));
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

      // A different write succeeding in this batch cannot erase an exhausted target's budget.
      const retryStall = this.repeatedToolFailureStall();
      if (retryStall && this.workPlan) {
        const currentItemId = this.workPlan.currentItemId;
        const reason = retryStall.summary;
        const blocked = currentItemId ? blockWorkItemById(this.workPlan, currentItemId, reason) : null;
        if (blocked) {
          this.runExecution = "blocked";
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
      // 사용자용 안내는 여기서 내지 않는다 — 런이 실제로 멈출 때 finishRunRecap 이 한 번 낸다.
      if (spentOutputTokens >= outputLimit) {
        this.runExecution = "budget-exhausted";
        this.pushAudit({ kind: "status", text: `턴 종료(token-budget) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
        return await this.settleExhaustedDraft(onEvent, signal, proposedByKey, {
          assistantText: truncatedTurnText(assistantText, proposedByKey.size, "출력 토큰 예산", this.turnAppliedMilestoneCalls.length),
          proposedCalls: this.finalizeProposals(proposedByKey),
          stoppedReason: "token-budget",
        });
      }
    }

    // 라운드 안전핀 도달 — 현재까지의 changeset을 제시.
    this.runExecution = "budget-exhausted";
    this.pushAudit({ kind: "status", text: `턴 종료(max-tool-calls) — 제안 ${proposedByKey.size}건 · 출력 토큰 ~${spentOutputTokens}` });
    return await this.settleExhaustedDraft(onEvent, signal, proposedByKey, {
      assistantText: truncatedTurnText(assistantText, proposedByKey.size, "도구 호출 예산", this.turnAppliedMilestoneCalls.length),
      proposedCalls: this.finalizeProposals(proposedByKey),
      stoppedReason: "max-tool-calls",
    });
  }

  /**
   * 2026-09-17 예산 소진 = 초안 전량 폐기 규칙 폐지.
   *
   * 실측: 균형 16, 최대 48, 「계속」 두 번 — 모두 max-tool-calls 로 끝나 3분간 그린 고스트가 빈 맵으로
   * 돌아갔다. 예산이 바닥났다는 것은 모델이 더 못 한다는 뜻이지 지은 것이 틀렸다는 뜻이 아니다.
   * 여기서 결정적 검사를 한 번 돌리고, 통과하면 final 로 바꿔 지금까지의 초안을 적용한다.
   * 미통과면 원래대로 미적용으로 끝나되 무엇이 왜 남았는지 findings 를 싣는다.
   */
  private async settleExhaustedDraft(onEvent: (event: SessionEvent) => void, signal: AbortSignal | undefined,
    proposedByKey: Map<string, ProposedCall>, exhausted: TurnResult): Promise<TurnResult> {
    if (this.turnComposerMode === "ask" || proposedByKey.size === 0 || signal?.aborted) return exhausted;
    const review = await this.runOperation.wait(this.reviewCurrentDraft(onEvent, signal, 0));
    if (signal?.aborted || review.status !== "approved" || !this.draftBaselineCurrent) {
      this.pushAudit({ kind: "status", text: `예산 소진 초안 미적용 — ${review.summary}` });
      return { ...exhausted, error: `예산이 소진됐고 결정적 검사를 통과하지 못해 초안을 적용하지 않았습니다: ${review.summary}` };
    }
    this.pushAudit({ kind: "status", text: `예산 소진 초안 적용 — ${review.summary}` });
    const text = `${exhausted.assistantText.trim()}\n\n예산이 소진되어 여기까지의 초안을 적용합니다(${review.summary}).`;
    onEvent({ type: "assistant_message", content: text });
    return { ...exhausted, assistantText: text, stoppedReason: "final" };
  }
}
