import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { readLatestRunCheckpoint } from "@/ai/runCheckpointStore";
import { reconcileRunCheckpoint, type RunRecovery } from "@/ai/runRecovery";
// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일은 패널 조립/배선(orchestration)을 소유한다. 순수 헬퍼·카드·설정·로그 렌더는 형제 모듈로 분리.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - ChatGPT OAuth 토큰은 브라우저에 저장하지 않는다. API 키 폴백만 설정 localStorage를 쓴다.

import {
  getMapEditHistoryDebugEntries,
  getMapEditHistoryMarker,
  getMapEditHistoryState,
  MAP_EDIT_HISTORY_EVENT,
  peekPreviousProject,
  revertToHistoryMarker,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import {
  clearAiApplyCompletion,
  completionUndoIsCurrent,
  publishAiApplyCompletion,
  subscribeAiApplyCompletion,
  type AiApplyCompletionContext,
} from "@/editor/aiApplyCompletion";
import type { ChangeSummary, Project, TilesetDef } from "@/project/types";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
import {
  parseAssistantTemperature,
  persistAssistantTemperature,
  type AssistantTemperature,
} from "@/editor/assistantTemperature";
import { editorState } from "@/editor/editorState";
import { AI_SELECTION_CONTEXT_EVENT, aiSelectionContextDetail } from "@/editor/aiSelectionContext";
import {
  clearAgentGhostPreview,
  clearAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import {
  clearAgentBlueprint,
} from "@/editor/agentBlueprint";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { COMMAND_PALETTE_OPEN_EVENT, openCommandPalette } from "./commandPalette";
import { filterToolCategories, openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { getPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { formatMaterialLabelHint } from "@/ai/turnGuide";
import { createLlmIntentDeclarer } from "@/ai/intentDeclarationClient";
import type { SessionTurnScope } from "@/ai/assistantSession";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel, type AutonomyResolution } from "@/ai/autonomyLevels";
import { isAutonomyLevel, loadAiConfig, saveAiConfig, type AiConfig } from "@/ai/llmClient";
import { store } from "@/project/store";
import { parsePiCommand, runPiCommand } from "./aiPiAgentCommand";
import { createTeamPanel } from "./aiTeamPanel";
import { DEFAULT_EXECUTION_ROUTE, EXECUTION_ROUTE_LABEL, resolveExecutionRoute } from "@/ai/piAgent/executionRoute";
import { combineDiffs } from "@/project/projectCommitLog";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { createPendingWorkTracker } from "@/util/pendingWork";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS,
  type ProposedCall,
} from "@/ai/assistantSession";
import { isWorkPlanComplete, type WorkPlan } from "@/ai/workPlan";
import { createAiStickyChecklist } from "./aiStickyChecklist";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import {
  conversationScopeKey,
  deriveTitle,
  loadLatestConversationForScope,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { noteAiChangeUndone } from "@/ai/preferenceSignals";
import type { AuditEntry } from "@/ai/assistantSession";
import { serializeAuditTranscript } from "@/ai/conversationReplay";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";
import { RunOperation } from "@/ai/runOperation";
import { EMPTY_SESSION_USAGE } from "@/ai/sessionUsage";
import { createAiContextMeter, type AiContextMeterHandle, type AiContextSnapshot } from "./aiContextMeter";
import { closeAiConversationHistoryModal, openAiConversationHistoryModal } from "./aiConversationHistoryModal";
import { openAiInstructionsModal } from "./aiInstructionsModal";
import { aiActivityPersistenceState, extractCommitIdsFromAudit } from "@/ai/activityLog";
import { listAiUiEvents, recordAiUiEvent } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import { parseQuickReplies } from "@/ai/interviewPrompt";
import { buildClusterEditKickoff, buildUnclassifiedAnalysisKickoff, type ClusterGroupSnapshot } from "@/ai/clusterAssistPrompt";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { AI_STUDIO_TOGGLE_EVENT, publishAiStudioChange } from "@/editor/aiStudioMode";
import { createAiActionMenuItems, type AiActionMenuActions } from "./aiActionMenu";
import { downloadAiUsageLogText } from "./aiUsageLogDownload";
import { createAssistantTemperatureMenuSection } from "./aiTemperatureMenu";
import { createComposerElements, type ComposerElements, type ComposerMode, type ComposerPopover } from "./aiComposer";
import { deckIcon } from "./aiDeckIcons";
import { createDeckRail, deckStateOfTone, type DeckState } from "./aiDeckRail";
import { regionFromToolCall, renderMapChip } from "./aiMapChip";
import { toolIconKey } from "./aiToolLabels";
import { renderPreferenceMemorySettings } from "./aiPreferenceMemorySettings";
import { createCollapsedUndoButton, createDirectorRestoreButton, setRestoreButtonState } from "./aiDirectorChrome";
import { getEditorUiMode } from "@/editor/editorUiMode";
import { openAiSettingsModal, registerAiSettingsPanel, type AiSettingsExtraSection } from "./aiSettingsModal";
import { getTool } from "@/editor/tools/toolRegistry";
import {
  formatComposerPlaceholder,
  readAgentBrief,
} from "./aiAgentBrief";
import {
  isAiAssistantBridgeConnected,
  registerAiAssistantBridge,
  setAiBridgeLastStatus,
  unregisterAiAssistantBridge,
  withdrawAiRequirement,
  type AiBridgeAuditEntry,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import { registerAiBootIntentTarget } from "@/editor/aiBootIntent";
import { createChatResizeChrome } from "./aiChatResizeChrome";
import {
  applyAiBackgroundOpacity,
  loadAiBackgroundOpacity,
  applyAiFontSize,
  loadAiFontSize,
  loadPanelCollapsed,
  saveAiFontSize,
  savePanelCollapsed,
  stepAiFontSize,
  type AiFontSize,
} from "./aiPanelLayout";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { formatAiRunningStatus, formatToolActivityLine, renderToolActivityEntry, renderWorkPlanChecklist, renderRunOutcome, type AutonomousRunBudget } from "./aiChatRenderers";
import { closeWorkPlanBook, openWorkPlanBook, updateWorkPlanBook } from "./aiWorkPlanModal";
import {
  createConversationLogHost,
} from "./aiConversationLog";
import { anchoredPopupPosition } from "./popupPosition";
import { createProposalHost, setAssistantMessageBadge } from "./aiProposalCard";
import { changePreviewChips, renderChangePreviewCard, type ChangePreviewInput } from "./aiChangePreview";
import { createStudioShell, type StudioShell } from "./aiStudioShell";
import { proposalHumanSummaryLine } from "./aiProposalSummary";
import { createAiTurnRunner } from "./aiTurnRunner";
import { openLocalDiagnosticsDialog } from "./localDiagnosticsDialog";
import { createAiRegionTaskRunner } from "./aiRegionTaskRunner";
import type { AiRunSurface, ConversationPersistTarget as ConversationPersistTargetContract } from "./aiRunSurface";
import {
  backupProjectSnapshot,
  dropSession,
  isAiAssistDetail,
  isAiConfigReady,
  statusToneOf,
  STUDIO_MODE_KEY,
  type ChatController,
} from "./aiChatPanelHelpers";

// ── 테스트/외부 호환 re-export (기존 import 경로 유지) ──────────────
export {
  AI_FONT_SIZE_KEY,
  AI_FONT_SIZE_ORDER,
  AI_FONT_SIZE_PERCENT,
  AI_FONT_SIZE_SCALE,
  AUTO_COLLAPSE_AFTER_AI_MS,
  MAP_FIRST_MIGRATION_KEY,
  PANEL_SIZE_LIMITS,
  applyAiFontSize,
  clampPanelSize,
  clampPanelSizeToViewport,
  loadAiFontSize,
  loadPanelBarSize,
  loadPanelCollapsed,
  loadPanelSize,
  saveAiFontSize,
  savePanelBarSize,
  savePanelCollapsed,
  savePanelSize,
  stepAiFontSize,
  type AiFontSize,
  type PanelSize,
} from "./aiPanelLayout";
export {
  fallbackDiffParts,
  proposalDependencyIndexes,
  proposalHumanSummaryLine,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  proposalDecisionTitle,
  proposalDetailsToggleLabel,
  enforceProposalDependencies,
  eventIdsCreatedByCall,
  eventIdsReferencedByCall,
  mapIdCreatedByCall,
  mapIdsReferencedByCall,
  reassembleSelectedProposalProject,
} from "./aiProposalSummary";
export {
  applyVocabularyCardEdits,
  callsWithVocabularyEdits,
  failedToolRetrySummary,
  failedToolVisibleSummary,
  formatAiRunningStatus,
  formatToolActivityLine,
  hasVocabularyEdits,
  isDraftDestructiveTool,
  reasoningToggleText,
  renderToolActivityEntry,
  renderToolCallDetail,
  renderVocabularyCardList,
  renderWorkPlanChecklist,
  vocabularyCardsData,
  type ToolDetailSource,
  type VocabularyCardEdit,
} from "./aiChatRenderers";
export {
  EMPTY_PROPOSAL_NOTICE_DISMISS_MS,
  combineAuditJson,
  displayUserAuditText,
  hasDestructiveCall,
  isAiConfigReady,
  isMetadataOnlyProposal,
  isReadOnlyToolNoise,
  phaseStatusText,
  proposalHasMapTileChanges,
  proposalPreviewMapId,
  renderEmptyProposalNotice,
  shouldShowStatusInChat,
  type StatusTransition,
} from "./aiChatPanelHelpers";

/** 컴포저가 AI 에게 넘기는 현재 맵/선택 영역 컨텍스트. */
interface PanelMapContext {
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly selection: {
    readonly mapId: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  } | null;
}

/** 클러스터 킥오프 프롬프트에 넣을 그룹 스냅샷 — 없으면 null(프롬프트가 초안부터 시작한다). */
function clusterGroupSnapshot(project: Project, tilesetId: string, groupId: string): ClusterGroupSnapshot | null {
  const group = project.tilesets[tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) return null;
  return {
    id: group.id,
    name: group.name,
    role: group.role,
    defaultLayer: group.defaultLayer,
    tileIds: [...group.tileIds],
    description: group.description,
    placementRules: group.placementRules,
    patternGrammar: group.patternGrammar ? { kind: group.patternGrammar.kind } : null,
  };
}

// 말풍선 사후 장식은 aiBubbleDecorations.ts 가 소유한다(순수 DOM — 패널 클로저가 필요 없다).
// 기존 소비자(test/aiChatMentionThumbs.test.ts 등)를 위해 이름은 여기서도 계속 내보낸다.
export { decorateAssistantMentions, foldWorkLogs } from "./aiBubbleDecorations";

export const AI_ACTIVITY_MIN_DWELL_MS = 400;

export type AiActivityScheduler = (callback: () => void, delayMs: number) => () => void;

export interface AiChatPanelOptions {
  readonly clock?: () => number;
  readonly activityScheduler?: AiActivityScheduler;
  readonly getAssistantTemperature?: () => AssistantTemperature;
  readonly onAssistantTemperatureChange?: (next: AssistantTemperature) => void;
  readonly regionTaskRunner?: (options: RegionTaskOptions) => Promise<RegionTaskResult>;
}

let cleanupAiAssistBridge: (() => void) | null = null;
let activeAiChatPanelCleanup: (() => void) | null = null;
// 패널이 띄운 비동기 저장·복원 작업. 대화 기록이 IndexedDB 로 가면서 «렌더 직후» 에는 아직 복원이
// 안 끝나 있다 — 테스트·헤드리스 하네스는 이걸로 정착을 기다린다.
const panelPendingWork = createPendingWorkTracker();

/** 패널의 비동기 저장·복원·프로젝트 전환 처리가 모두 끝날 때까지 기다린다. */
export function whenAiChatPanelSettled(): Promise<void> {
  return panelPendingWork.settled();
}

export function teardownAiChatPanel(): void {
  const cleanup = activeAiChatPanelCleanup;
  activeAiChatPanelCleanup = null;
  cleanup?.();
  cleanupAiAssistBridge?.();
  cleanupAiAssistBridge = null;
  unregisterAiAssistantBridge();
  registerAiBootIntentTarget(null);
  clearAiApplyCompletion();
}

export function renderAiChatPanel(options: AiChatPanelOptions = {}): HTMLElement {
  teardownAiChatPanel();
  const now = options.clock ?? (() => Date.now());
  const scheduleActivity = options.activityScheduler ?? ((callback: () => void, delayMs: number): (() => void) => {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      const timer = window.setTimeout(callback, delayMs);
      return () => window.clearTimeout(timer);
    }
    const timer = globalThis.setTimeout(callback, delayMs);
    return () => globalThis.clearTimeout(timer);
  });
  const runRegion = options.regionTaskRunner ?? runRegionTask;
  const readTemperature = (): AssistantTemperature =>
    parseAssistantTemperature(options.getAssistantTemperature?.() ?? editorState.get().assistantTemperature);
  let refreshTemperatureChrome: () => void = () => {};
  const controller: ChatController = { session: null, auditHistory: [], statusTimeline: [] };
  const outcomeSlot = el("div");
  const refreshRunOutcome = (): void => {
    const outcome = controller.session?.getRunOutcome();
    outcomeSlot.replaceChildren(...(outcome ? [renderRunOutcome(outcome)] : []));
  };
  let refreshAcceptanceMenus: () => void = () => {};
  const stickyChecklist = createAiStickyChecklist({
    onWithdraw: withdrawAiRequirement,
    onReviewApproach: checkId => {
      if (disposed || turnBusy || !controller.session) return null;
      controller.session.refreshAcceptance(store.getCurrent());
      return controller.session.previewApproachCorrection(checkId);
    },
    onConfirmApproach: preview => {
      if (disposed || turnBusy || !controller.session) return false;
      const session = controller.session;
      session.refreshAcceptance(store.getCurrent());
      const accepted = session.confirmApproachCorrection(preview);
      stickyChecklist.update(session.getAcceptanceSnapshot());
      refreshRunOutcome();
      return accepted;
    },
    onChange: () => refreshAcceptanceMenus(),
    onHide: () => {
      const opener = moreMenuToggle.isConnected && !moreMenuToggle.closest("[hidden]")
        && moreMenuToggle.getClientRects().length > 0 ? moreMenuToggle : input;
      if (opener.isConnected) opener.focus();
    },
  });
  let disposed = false;
  const initialProjectIdentity = store.getProjectIdentity();
  const currentProjectContextKey = conversationScopeKey(initialProjectIdentity, store.getCurrent());
  // 이 패널(대화 세션) 전체를 하나의 기록으로 저장할 id — 매 턴 끝에 누적 감사 로그를 저장한다.
  // '새 대화' 시 재발급되고, 부팅 복원(패널 조립 끝의 restoreLatestForBoot)이 이어받은 대화의 id 로 바꾼다.
  let conversationId = genId("conv");
  // 이 대화가 속한 프로젝트. 저장 시점의 store 를 다시 읽으면, 프로젝트를 바꾼 직후 저장되는
  // 이전 대화가 **새 프로젝트 키로** 기록돼 다음 부팅에서 남의 프로젝트에 복원된다.
  let conversationScope = currentProjectContextKey;
  // 프로젝트 전환 리셋은 저장 범위 키가 아니라 런타임 identity id로 판정한다. 같은 모양의 새
  // 로컬 프로젝트는 scope가 같아도 새 identity를 발급받으므로 반드시 대화를 갈아야 한다.
  let projectIdentityId = initialProjectIdentity.id;
  // 조수가 적용하는 동안의 정체성 교체는 전환이 아니다. reset_project 는 바로 이 턴에서 새
  // identity 를 발급받으므로, 이 표식이 없으면 전환 리셋이 방금 붙은 「적용됨」 카드와
  // 그 턴의 대화를 통째로 지운다(스토어 구독은 applyProposal 안에서 동기로 터진다).
  let applyingProposal = false;
  type ConversationPersistTarget = ConversationPersistTargetContract;
  // 현재까지의 전체 대화(폐기된 세션 + 현재 세션)를 대화 기록 저장소에 저장한다.
  // 캡처한 id/scope를 지정할 때는 같은 시점의 entries도 반드시 함께 넘겨 대화 간 오염을 막는다.
  // 저장 공간 고갈 안내는 패널 수명 동안 한 번 — 매 툴콜마다 저장하므로 그대로 두면 토스트가 쏟아진다.
  let storageFailureToasted = false;
  const persistConversation = (target?: ConversationPersistTarget): void => {
    const owner = controller.session;
    const operation = owner?.getRunOperation();
    const id = target?.id ?? conversationId;
    const entries = target
      ? [...target.entries]
      : [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    if (entries.length === 0) return;
    // saveConversation 은 던지지 않는다(실측 2026-09-03: localStorage quota 예외가 툴콜 스트리밍 도중
    // 여기서 터져 「오류: Failed to execute 'setItem' …」 말풍선과 함께 턴이 끊겼다). 최신 1건도 못
    // 남긴 완전 실패만 사용자에게 알린다 — 조용히 메모리에만 남으면 새로 고친 뒤 대화가 사라진 이유를 모른다.
    void panelPendingWork.track(
      saveConversation({
        id: target?.id ?? conversationId,
        title: deriveTitle(entries),
        model: loadAiConfig().model,
        savedAt: Date.now(),
        entries: [...entries],
        projectContextKey: target?.scope ?? conversationScope,
      }).then((outcome) => {
        // IndexedDB 가 있는 브라우저인데 거기 남지 않았다 — 새로 고치면 사라진다는 사실을 한 번 알린다.
        // IndexedDB 자체가 없는 환경(Node 테스트)은 알릴 곳도, 잃을 것도 없다.
        const lostOnReload = !outcome.ok || (!outcome.durable && typeof indexedDB !== "undefined");
        if (disposed || conversationId !== id || controller.session !== owner || owner?.getRunOperation() !== operation) {
          if (lostOnReload) console.warn("[aiConversation] Retired owner's conversation could not be persisted", id);
          return;
        }
        if (lostOnReload && !storageFailureToasted) {
          storageFailureToasted = true;
          toast("대화 기록을 이 브라우저에 저장할 수 없습니다. 이번 대화는 화면에만 남고 새로 고치면 사라집니다.", "error");
        }
      }),
    );
    refreshExportButton();
  };

  const status = el("span", {
    class: "ai-assistant-status",
    text: "대기",
    dataset: { testid: "ai-status", statusTone: "idle" },
  });
  // 상태 배지 전이를 타임라인에 기록한다(결함 ⑬) — 적용 실패 같은 멈춤을 로그 export로 진단한다.
  const setStatus = (text: string, record = true): void => {
    status.textContent = text;
    status.dataset.statusTone = statusToneOf(text);
    setAiBridgeLastStatus(text);
    studioShell?.setStatus(text);
    syncDeckState();
    if (record) controller.statusTimeline.push({ at: new Date().toISOString(), status: text });
  };
  const log = el("div", { class: "ai-chat-log", attrs: { tabindex: "0", role: "region", "aria-label": "조수 대화" }, dataset: { testid: "ai-chat-log", editorNavigationOwner: "true" } });
  let panelRoot: HTMLElement | null = null;
  let studioShell: StudioShell | null = null;
  const studioToolLines: string[] = [];
  let lastStudioChange: ChangePreviewInput | null = null;
  // 빈 로그 껍데기(.ai-glass-log·.ai-history-log-mount)를 접고 시작 블록을 가운데로 올리는 CSS 훅.
  // 턴 행 testid 가 아니라 **로그의 자식 유무**로 판정해야 한다 — 복원된 대화는 그 testid 를 달지
  // 않아 testid 로 세면 복원된 로그를 숨긴다. `:empty` 로도 못 잡는다 — 껍데기 안에 빈
  // .ai-chat-log 엘리먼트가 실제로 들어 있다.
  const syncConversationState = (): void => {
    if (!panelRoot) return;
    panelRoot.dataset.aiConversation = log.childElementCount > 0 ? "active" : "empty";
    panelRoot.dataset.aiConversationId = conversationId;
  };
  // 변경 0건 알림 전용 호스트 — 쓰기가 있는 턴은 승인 없이 바로 적용되므로 결정 카드·핀·모달이 없다.
  const proposalNoticeHost = el("div", { class: "ai-proposal-notice-host" });
  let turnBusy = false;
  const idleWaiters = new Set<() => void>();
  // 전송 버튼은 "보낼 것이 있고 한가할 때"만 준버된 상태로 보이며, 이전엔 turnBusy 만 보서
  // 보낼 게 없을 때도 흔함 없이 활성이었고, 눌러도 send() 가 `if (!text) return` 으로
  // 조용하게 끝나 아무 피드백도 없었다.
  //
  // 미입력 상태를 진짜 `disabled` 로 만들지않는 이유(실측): disabled 버튼은 tab
  // 순서에서 버리니 키보드 사용자에게는 "전송이 어때 사라진" 것이 되고 이유도
  // 설명하지 못하며(test/aiPanelChrome 탭 순서 계약이 이걸 직접 잡았다), 프로그램으로
  // 값을 넣고 click 하는 호출자도 조용하게 사망한다. 그래서 항상 초점·클릭 가능한
  // 상태로 두고, 준버 여부는 aria-disabled + 클래스로 말하고, 눌렸을 때는 send() 가
  // 이유를 돌려준다. 진짜 disabled 는 턴 진행 중(turnBusy)에만 쓴다.
  const refreshSendEnabled = (): void => {
    const empty = input.value.trim() === "";
    sendButton.disabled = turnBusy;
    sendButton.classList.toggle("is-not-ready", empty && !turnBusy);
    sendButton.setAttribute("aria-disabled", String(turnBusy || empty));
  };
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
  let runningPhaseStatus: string | null = null;
  let runningActivity: {
    readonly toolName: string;
    readonly row: HTMLElement;
    readonly line: HTMLElement;
  } | null = null;
  type PendingActivitySwap = {
    cancel: () => void;
    readonly finalize: () => void;
  };
  const pendingActivitySwaps: PendingActivitySwap[] = [];
  // AI 턴/영역 작업이 끝나면 맵 우선으로 다시 접을지. 오류면 열린 상태를 유지한다.
  let collapseAfterAiWork = false;
  // executeTurn/영역 작업 콜백은 패널 크롬을 만들기 전에 정의되므로, 접힘 상태도
  // 같은 초기화 구간에 둔다. 아래 크롬 구간에서 선언하면 자동 복원 sendText가
  // TDZ 상태의 collapsed를 읽어 턴을 시작하기 전에 실패한다.
  let collapsed = loadPanelCollapsed();
  let autoCollapseTimer: number | null = null;
  // Pending questions keep the conversation engaged even without promoted reply chips.
  let pendingQuestion = false;
  const hasPendingQuestion = (): boolean => pendingQuestion;
  // applyCollapsed 정의 전에 턴이 잡혀도 안전한 바인딩(런타임 호출은 패널 마운트 이후).
  let expandForAiWork: () => void = () => {};
  let scheduleCollapseAfterAiWork: () => void = () => {};
  let clearAutoCollapseTimer: () => void = () => {};
  // 휘발 존(ai-rising-volatile-zone)은 사이드 도크 전용 오버레이였다. 도크가 하나가
  // 되면서 마운트되는 곳이 없어져 이 두 훅은 아무 데도 닿지 않는다 — 계약만 남긴다.
  let exportButton: HTMLButtonElement | null = null;
  const refreshExportButton = (): void => {
    if (!exportButton) return;
    exportButton.disabled = false;
    exportButton.setAttribute("aria-disabled", "false");
  };

  const input = el("textarea", {
    class: "ai-assistant-input",
    attrs: { placeholder: formatComposerPlaceholder(readAgentBrief()), rows: "1" },
    dataset: { testid: "ai-input" },
  }) as HTMLTextAreaElement;

  const sendButton = el("button", {
    class: "ai-assistant-action ai-chat-send",
    attrs: { type: "button", title: "보낼 지시를 입력하세요", "aria-label": "보내기" },
    dataset: { testid: "ai-send" },
    children: [deckIcon("arrow-up")],
  }) as HTMLButtonElement;

  // 컴포저 셸은 파일 하단에서 조립된다(입력·전송·칩이 모두 있어야 하므로).
  // 그 전에 정의되는 핸들러들이 팝오버/실측을 부를 수 있어 늦은 바인딩으로 노출한다 —
  // 이 파일이 이미 쓰는 패턴(applyAssistantViewPolicy, syncGlassIdle 등)과 같다.
  let openComposerPopover: (kind: ComposerPopover | null) => void = () => {};
  let composerPopoverKind: () => ComposerPopover | null = () => null;
  let syncCommandBarClearance: () => void = () => {};
  /** 데크 상태(idle|run|attention|done|error)를 레일·패널·알약에 함께 바른다. 데크 조립 뒤 바인딩. */
  let syncDeckState: () => void = () => {};
  /** 레일의 「· 현재 맵」 문구. 컨텍스트 칩과 같은 구독에서 갱신한다. */
  let syncRailContext: () => void = () => {};
  /**
   * 턴의 composerMode 는 **자율성 다이얼에서 유도한다** — 지시줄에 모드 칩이 없다.
   *
   * `readonly` 레벨만 세션의 ask 레일(쓰기 툴 미노출·호출 거부·초안 불변)로 보낸다. 그 밖에는
   * `do` 이고, 질문 판정은 세션이 의도 선언의 `mode=question` 으로 자동 승격한다. 예전 「계획」
   * 칩의 일은 레벨의 `planOnly` 가 그대로 한다(세션이 두 경로를 OR 로 처리한다).
   *
   * 매번 저장소에서 다시 읽는다 — 다이얼은 설정 모달에서도 바뀌고, 전송 시점 값이 정본이다.
   */
  const currentAutonomy = (): AutonomyResolution => {
    const raw = loadAiConfig().autonomyLevel;
    return resolveAutonomy(isAutonomyLevel(raw) ? raw : "balanced");
  };
  const derivedComposerMode = (): ComposerMode => (currentAutonomy().readOnly ? "ask" : "do");
  const applyPanelFontSize = (size: AiFontSize): void => {
    applyAiFontSize(panel, size);
  };

  // 설정은 전용 모달로 연다(채팅 본문 인라인 폼 제거 — UX P0/P1).
  // 저장 시 진행 중 세션 config도 즉시 갱신한다.
  // 설정 모달에 실리는 패널 소유 절(대기 화면 3분기 — 제안서 D6). 데크 조립 뒤 채운다.
  let settingsExtraSections: readonly AiSettingsExtraSection[] = [];
  const unregisterSettingsPanel = registerAiSettingsPanel(() => ({
    fontRoot: panel,
    onSaved: (config) => {
      controller.session?.updateConfig(config);
      composerShell.setModelLabel(modelChipLabel());
      composerShell.syncEffort(isAutonomyLevel(config.autonomyLevel) ? config.autonomyLevel : "balanced");
    },
    extraSections: settingsExtraSections,
  }));
  const openAiSettings = (focusTarget: "first" | "apiKey" = "first"): void => {
    // The menu item is hidden before its action runs; restore to its visible opener instead.
    if (commandMenu.contains(document.activeElement)) composerShell.menuToggle.focus();
    openAiSettingsModal({ focusTarget });
  };

  // 시작 화면(빈 대화) — 첫 콘텐츠가 붙는 순간 제거된다.
  let startScreen: HTMLElement | null = null;
  const removeStartScreen = (): void => {
    startScreen?.remove();
    startScreen = null;
  };
  // 휘발 존이 사라져 접을 것이 없다(사이드 도크 전용이었다). 호출부 계약만 유지한다.
  const hideVolatileIfIdle = (): void => {};

  const conversationLog = createConversationLogHost({
    log,
    removeStartScreen,
    // 행 앞 맵 칩 — 툴 인자/결과의 좌표를 현재 프로젝트에서 잘라 그린다(제안서 「show the work」).
    renderChip: (name, args, result) => {
      const region = regionFromToolCall(args, result);
      if (!region) return null;
      const project = store.getCurrent();
      const argMapId = typeof args?.mapId === "string" ? args.mapId : null;
      const mapId = argMapId && project.maps[argMapId] ? argMapId : (mapContext().mapId ?? project.startMapId);
      if (!mapId || !project.maps[mapId]) return null;
      return renderMapChip({ project, mapId, region, icon: toolIconKey(name) });
    },
  });
  const {
    appendBubble,
    appendReasoning,
    closeToolActivity,
    appendToolLine,
    appendTileThumbs,
    appendTileGrid,
    appendAiDocument,
    appendChangeCard,
    renderConversationEntry,
    clearLastReasoning,
    isLastReasoningBox,
  } = conversationLog;

  const refreshLiveActivity = (): void => {
    if (!runningActivity) return;
    const narration = narrateAiActivity({ toolName: runningActivity.toolName });
    // aria-live 영역은 같은 문자열을 다시 써도 재낭독될 수 있다. 문구가 실제로 바뀔 때만 쓴다.
    if (runningActivity.line.textContent !== narration.line) {
      runningActivity.line.textContent = narration.line;
    }
  };
  const flushPendingActivitySwapsThrough = (target?: PendingActivitySwap): void => {
    const lastIndex = target ? pendingActivitySwaps.indexOf(target) : pendingActivitySwaps.length - 1;
    if (lastIndex < 0) return;
    const ready = pendingActivitySwaps.splice(0, lastIndex + 1);
    for (const pending of ready) {
      pending.cancel();
      pending.finalize();
    }
  };
  const flushPendingActivitySwaps = (): void => flushPendingActivitySwapsThrough();
  const startLiveActivity = (toolName: string, index: number): void => {
    // 동기 도구가 연달아 오면 앞 행을 먼저 확정해 기록 순서를 지키고 마지막 행만 머문다.
    flushPendingActivitySwaps();
    runningActivity?.row.remove();
    if (runningProgress) runningProgress.toolCount = Math.max(runningProgress.toolCount, index);
    const line = el("span", { class: "ai-activity-live-line" });
    const row = el("div", {
      class: "ai-activity-live",
      attrs: { role: "status", "aria-live": "polite" },
      dataset: { testid: "ai-activity-live", tool: toolName },
      children: [
        el("span", { class: "ai-activity-live-spinner ai-deck-spin", attrs: { "aria-hidden": "true" } }),
        line,
      ],
    });
    runningActivity = { toolName, row, line };
    refreshLiveActivity();
    log.append(row);
    log.scrollTop = log.scrollHeight;
    refreshRunningStatus(false);
  };
  const completeLiveActivity = (
    toolName: string,
    result: Parameters<typeof appendToolLine>[1],
    args?: Record<string, unknown>,
  ): void => {
    const matchedLiveActivity = runningActivity?.toolName === toolName;
    if (!matchedLiveActivity) bumpToolProgress();
    const before = new Set<Element>(log.querySelectorAll(".ai-tool-activity-line"));
    studioToolLines.unshift(formatToolActivityLine(toolName, result));
    if (studioToolLines.length > 40) studioToolLines.length = 40;
    studioShell?.setToolLines(studioToolLines);
    appendToolLine(toolName, result, args, { live: true });
    const rendered = [...log.querySelectorAll<HTMLElement>(".ai-tool-activity-line")].find((entry) => !before.has(entry))
      ?? renderToolActivityEntry(toolName, result);
    if (!runningActivity || runningActivity.toolName !== toolName) return;

    const activity = runningActivity;
    const liveRow = activity.row;
    const completedHost = rendered.parentElement;
    if (!completedHost) {
      liveRow.remove();
      if (runningActivity === activity) runningActivity = null;
      refreshRunningStatus(false);
      log.scrollTop = log.scrollHeight;
      return;
    }
    rendered.remove();
    const finalize = (): void => {
      if (result.ok) {
        // 라이브 행이 완료 행의 모양(칩 · 라벨/요약 · 상태)을 그대로 이어받는다 — textContent 로 평탄화하면
        // 데크 타임라인 행의 세 칸 구조가 사라진다.
        liveRow.className = rendered.className;
        liveRow.dataset.testid = "ai-tool-entry";
        if (rendered.dataset.tool) liveRow.dataset.tool = rendered.dataset.tool;
        if (rendered.title) liveRow.title = rendered.title;
        liveRow.removeAttribute("role");
        liveRow.removeAttribute("aria-live");
        liveRow.replaceChildren(...Array.from(rendered.childNodes));
      } else {
        liveRow.className = "ai-activity-completed";
        liveRow.dataset.testid = "ai-tool-entry";
        liveRow.removeAttribute("role");
        liveRow.removeAttribute("aria-live");
        liveRow.replaceChildren(rendered);
      }
      liveRow.remove();
      completedHost.append(liveRow);
      if (runningActivity === activity) runningActivity = null;
      refreshRunningStatus(false);
      log.scrollTop = log.scrollHeight;
    };
    const pending: PendingActivitySwap = { cancel: () => {}, finalize };
    pendingActivitySwaps.push(pending);
    // 동기 도구 실행 중 흐른 벽시계 시간은 브라우저가 그린 시간이 아니다. 완료 이벤트 뒤부터
    // 온전한 표시 시간을 예약해야 긴 동기 작업도 최소 한 프레임 이상 사용자에게 보인다.
    pending.cancel = scheduleActivity(
      () => flushPendingActivitySwapsThrough(pending),
      AI_ACTIVITY_MIN_DWELL_MS,
    );
  };

  // 사용자가 보고 싶은 것은 툴 호출 목록이 아니라 “무엇이 어떻게 바뀌었는가” 다. 자동 적용·수동
  // 재생 없이 상통 상태로 넘어가는 모든 적용 경로가 이 카드 하나로 모인다.
  const emitChangeCard = (input: {
    readonly before: Project;
    readonly after: Project;
    readonly mapId: string;
    readonly title: string;
    readonly detail?: string;
    readonly calls: readonly ProposedCall[];
  }): void => {
    const diffs = input.calls
      .map((call) => call.result?.diff)
      .filter((diff): diff is ChangeSummary => Boolean(diff));
    const card = renderChangePreviewCard({
      before: input.before,
      after: input.after,
      mapId: input.mapId,
      title: input.title,
      ...(input.detail ? { detail: input.detail } : {}),
      chips: diffs.length > 0 ? changePreviewChips(combineDiffs(diffs)) : [],
      onUndo: () => {
        // 성향 신호(가장 강한 부정): 채팅 제안은 자동 적용되므로 수락 버튼이 없다 — 되돌리기가
        // "이건 원하는 게 아니었다"는 유일한 명시적 반응이다. 이 카드는 AI 변경 1건에 1:1로 붙어
        // 있어서 대상을 정확히 알고, 사람이 직접 그린 타일의 undo 와 섞이지 않는다.
        noteAiChangeUndone({ toolNames: input.calls.map((call) => call.name) });
        undoMapEdit();
      },
    });
    lastStudioChange = {
      before: input.before,
      after: input.after,
      mapId: input.mapId,
      title: input.title,
      ...(input.detail ? { detail: input.detail } : {}),
      chips: diffs.length > 0 ? changePreviewChips(combineDiffs(diffs)) : [],
      onUndo: () => {
        noteAiChangeUndone({ toolNames: input.calls.map((call) => call.name) });
        undoMapEdit();
      },
    };
    studioShell?.setChangePreview(lastStudioChange);
    appendChangeCard(card);
  };

  /**
   * 다음 세션에 주입할 이전 대화 기록. 대화 복원·턴 되감기가 채우고, 세션이 만들어질 때
   * 한 번 소비된다(새 대화는 비운다).
   *
   * 이것이 없으면 복원은 **화면만** 복원이다: 복원 경로는 dropSession 을 지나므로 다음 턴의
   * 세션은 시스템 프롬프트 하나로 시작하고, 사용자에게는 대화가 이어진 것처럼 보이는데 모델은
   * 직전에 무엇을 했는지 전혀 모른다.
   */
  let pendingPriorTranscript: string | null = null;

  let recoveryGeneration = 0;
  let recoveryNotice: HTMLElement | null = null;
  const clearRecovery = (): void => { recoveryGeneration++; recoveryNotice?.remove(); recoveryNotice = null; };

  const loadConversationCheckpoint = async (): Promise<void> => {
    const generation = ++recoveryGeneration;
    const id = conversationId, scope = conversationScope, identity = store.getProjectIdentity().id;
    const current = (): boolean => !disposed && generation === recoveryGeneration && conversationId === id
      && conversationScope === scope && store.getProjectIdentity().id === identity;
    const paint = (recovery: RunRecovery): void => {
      if (!current()) return;
      recoveryNotice?.remove();
      const labels = { resumable: "중단된 실행 기록이 있습니다. 남은 작업만 계속할 수 있습니다.",
        "needs-reconciliation": "적용 또는 저장 상태를 확인해야 합니다. 현재 프로젝트를 확인하세요.",
        terminal: "이 실행은 종료되었거나 사용자 입력을 기다립니다. 새 요청을 입력하세요.",
        unsupported: "대화 기록만 복원했습니다. 안전한 실행 복구 기록은 없습니다." };
      const notice = el("div", { class: "ai-retry-row", dataset: { testid: "ai-run-recovery", state: recovery.kind, next: recovery.next },
        children: [el("span", { text: labels[recovery.kind] })] });
      recoveryNotice = notice;
      if (recovery.kind === "resumable") notice.append(el("button", {
        text: "남은 작업 계속", attrs: { type: "button" }, dataset: { testid: "ai-run-continue" },
        on: { click: () => {
          void panelPendingWork.track((async () => {
            if (!current() || turnBusy || !ensureConfigReadyForSend()) return;
            const latest = await readLatestRunCheckpoint(id, identity, scope);
            if (!current() || turnBusy || controller.session !== null) return;
            if (latest.kind !== "found") { paint(reconcileRunCheckpoint(latest, store.getCurrent())); return; }
            const decision = reconcileRunCheckpoint(latest, store.getCurrent());
            if (decision.kind !== "resumable") { paint(decision); return; }
            const session = ensureSession();
            const admitted = session.restoreCheckpoint(latest.checkpoint, latest.durable);
            if (admitted.kind !== "resumable") { paint(admitted); return; }
            const runtime = latest.checkpoint.runtime;
            if (!runtime) return;
            clearRecovery();
            // 복구 턴은 체크포인트에 직렬화된 모드를 그대로 되쓴다(현재 다이얼로 유도하지 않는다) —
            // 중단된 런이 어떤 레일에서 돌던 중이었는지가 정본이다.
            const plan = session.getWorkPlan();
            if (plan) showWorkPlan(plan);
            stickyChecklist.update(session.getAcceptanceSnapshot());
            await executeTurn(session, runtime.instruction, (onEvent, signal) => session.resumeRecoveredRun(onEvent, signal),
              { composerMode: runtime.composerMode, autonomous: runtime.autonomous });
          })().catch(cause => {
            if (current()) setStatus(`실행 복구 실패: ${cause instanceof Error ? cause.message : String(cause)}`);
            else console.warn("[aiRunRecovery] Retired recovery failed", cause);
          }));
        } },
      }));
      else notice.append(el("button", { text: recovery.kind === "needs-reconciliation" ? "현재 프로젝트 확인" : "새 요청 입력",
        attrs: { type: "button" }, dataset: { testid: "ai-run-recovery-choice" }, on: { click: () => { clearRecovery(); input.focus(); } } }));
      log.append(notice);
    };
    const read = await readLatestRunCheckpoint(id, identity, scope);
    if (!current() || turnBusy || controller.session !== null) return;
    paint(reconcileRunCheckpoint(read, store.getCurrent()));
  };



  // 맥락 게이지는 컴포저가 만들어질 때(파일 아래쪽) 붙는다. 복원·턴 종료 같은 이른 경로도
  // 갱신을 호출하므로 홀더 + 널 가드 한 겹을 둔다(선언 순서에 걸려 TDZ 로 죽지 않게).
  let contextMeter: AiContextMeterHandle | null = null;
  const refreshContextMeter = (): void => {
    // 갱신은 DOM 노드를 만든다 — 문서가 없으면(테스트 해체 이후에 늦게 정착한 턴 등) 그릴
    // 대상이 없다. 이 지점은 턴 정산(finally) 안에서도 불리므로, 여기서 던지면 표시가 턴을 죽인다.
    if (typeof document === "undefined") return;
    contextMeter?.refresh();
  };

  const ensureSession = (): AssistantSession => {
    if (!controller.session) {
      backupProjectSnapshot();
      const priorTranscript = pendingPriorTranscript;
      pendingPriorTranscript = null;
      controller.session = new AssistantSession(store.getCurrent(), {
        checkpoint: { conversationId, projectId: store.getProjectIdentity().id, projectContextKey: conversationScope },
        config: resolveSurfaceAiConfig("chat"),
        prepareProjectWiki: input => createProjectWikiCoordinator({
          getConfig: () => resolveSurfaceAiConfig("chat"),
          status: (text) => { if (!disposed && !input.signal?.aborted) setStatus(text); },
        }).prepare(input),
        // 턴 시작에 사용자 발화를 모델이 한 번 읽어 의도(수정/생성·실내/야외·시설·되묻기·계획·툴)를 선언한다.
        // 되묻기·플래너·툴 노출은 그 선언만 소비한다 — 문장 키워드 스캔은 없다(2026-09-03 의도 라우터 감사).
        declareIntent: createLlmIntentDeclarer(),
        ...(priorTranscript ? { priorTranscript } : {}),
        contextOptions: {
          currentMapId: editorState.get().currentMapId ?? undefined,
          // 프로젝트 한정 성향 조회 키. 전역 성향은 이 값과 무관하게 항상 붙는다.
          projectScopeKey: conversationScope,
          getViewport: () => getEditorMapViewport(),
          // 맵 이동은 세션을 끊지 않지만 시스템 프롬프트는 톨려야 한다 — 고정 값이면
          // 타일 어휘·구조 키트·맵 요약이 세션 시작 맵에 머버 라이브 뷰포트와 어긋난다.
          getCurrentMapId: () => editorState.get().currentMapId ?? null,
        },
        // 감사 항목에 남길 턴 상황의 선택 영역 — 컨텍스트 꼬리표와 같은 조건(활성 선택만).
        getTurnSelection: () => (selectionTaskActive ? mapContext().selection : null),
        // 자율 실행 드라이버(todo 2): 패널 세션은 플래그 autonomous 로 진입하고
        // pendingSends 큐를 peek 전용 훅으로 노출한다 — 드라이버가 대기 메시지를 보면
        // 자동 계속을 양보하고 이 드레인 루프가 메시지를 전달한다(사용자 우선, 이중 전송 불가).
        // 주입 시점에 pendingSends 가 아직 선언돼 있지 않아도 참조 시점엔 항상 존재한다(클로저).
        peekPendingUserMessage: () => pendingSends[0]?.text ?? null,
        // 비전(BUG C): '보여줘' 툴 이미지를 렌더해 비전 모델에 전달한다(브라우저 전용).
        renderImages: renderToolImages,
        // 컨텍스트 모드 스코핑(§2.2): 활성 UI 상태에서 결정론으로 계산 — 턴마다 재평가된다.
        toolMode: computeAssistantToolMode,
      });
    }
    return controller.session;
  };

  const proposalApi = createProposalHost({
    proposalNoticeHost,
    controller,
    appendBubble,
    setStatus,
    onApplied: (result) => {
      const selection = editorState.get().selection;
      const applied = proposalApi.lastAppliedProposalMessage;
      const before = peekPreviousProject(1);
      if (before && applied) {
        emitChangeCard({
          before,
          after: store.getCurrent(),
          mapId: result.mapId,
          title: proposalHumanSummaryLine(applied.calls) || result.summary,
          detail: result.summary,
          calls: applied.calls,
        });
      }
      publishAiApplyCompletion({
        mapId: result.mapId,
        selection: selection?.mapId === result.mapId ? selection : null,
        instruction: result.instruction,
        summary: result.summary,
      });
    },
    onProposalSettled: () => {
      // 검토 카드가 닫힌 뒤 — 자동 펼침이었다면 맵으로 화면을 되돌린다.
      if (!turnBusy) scheduleCollapseAfterAiWork();
    },
  });
  const noteNoChanges = proposalApi.noteNoChanges;
  const applyProposal = proposalApi.applyProposal;
  // pending/last-applied message state is owned by proposalApi (getters/setters).
  const setPendingProposalMessage = (value: typeof proposalApi.pendingProposalMessage) => {
    proposalApi.pendingProposalMessage = value;
  };
  const getLastAppliedProposalMessage = () => proposalApi.lastAppliedProposalMessage;
  const setLastAppliedProposalMessage = (value: typeof proposalApi.lastAppliedProposalMessage) => {
    proposalApi.lastAppliedProposalMessage = value;
  };

  const retireConversationTurn = (): void => {
    activeAbortController?.abort();
    controller.session?.retireRun();
    retireMaintenance();
    activeAbortController = null;
    activeSelectionRegionController = null;
    activeSelectionRegionKey = null;
    pendingSends.length = 0;
    refreshQueueIndicator();
    turnBusy = false;
    for (const resolve of idleWaiters) resolve();
    endTurnProgress();
    refreshAbortButton();
  };

  const restoreConversationRecord = (record: ConversationRecord, source: "auto" | "manual" | "project-switch"): void => {
    if (source === "manual") {
      retireConversationTurn();
      persistConversation();
    }
    dropSession(controller, getPendingRegionApply());
    clearWorkPlanSurface(); // 대화 전환 — 다른 대화의 할 일 목록이 남으면 안 된다(스테일 상태 방지).
    // 화면만 복원하면 사용자는 이어졌다고 믿고 모델은 아무것도 모른다 — 다음 세션에 기록 요약을
    // 함께 밀어 넣어 "이어가기"를 모델 쪽에서도 참으로 만든다.
    pendingPriorTranscript = serializeAuditTranscript(record.entries) || null;
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    pendingQuestion = false;
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    for (const entry of record.entries) renderConversationEntry(entry);
    const lastAssistant = [...record.entries].reverse().find((entry) => entry.kind === "assistant" && entry.text.trim());
    if (lastAssistant?.kind === "assistant") renderQuickReplies(lastAssistant.text);
    setStatus(source === "manual" ? "이전 대화" : "대화 복원됨");
    // 복원된 대화는 로그에 들어가지만 syncGlassIdle 이 다시 돌지 않으면 패널이 is-glass-idle 로
    // 남아 .ai-glass-log 가 display:none 이라 사용자에게 보이지 않는다(실보 2026-08-27).
    syncGlassIdle();
    refreshExportButton();
    syncConversationState();
    if (source === "manual") appendBubble("system", "이전 대화를 열었습니다.");
    void panelPendingWork.track(loadConversationCheckpoint());
    refreshContextMeter();
  };

  /**
   * 대화 리셋 코어 — 진행 중인 턴을 포기하고, 닫히는 대화를 **자기 프로젝트 키**로 보관한 뒤,
   * 세션·표면·기록 주입을 정리하고 현재 프로젝트 스코프로 재발급한다.
   *
   * 반환값은 "버릴 이야기가 있었는가" 다 — 호출자가 안내 문구를 정하는 데 쓴다. 이 함수는
   * 안내(toast)를 하지 않는다: 사용자가 누른 새 대화와 프로젝트 전환은 같은 정리를 하지만
   * 사용자에게 할 말이 다르다.
   */
  const resetConversationState = (
    reason: "manual" | "project-switch",
    /**
     * 리셋 직후 이어받을 대화(있으면). 왜 인자로 받는가: 예전에는 리셋이 무조건 새 id 를 발급하고
     * 시작 화면을 깔고 `newConversation` UI 이벤트를 남긴 다음 곧바로 복원이 그것을 부쉈다.
     * 버려질 id·시작 화면은 낭비고, **이어받은 전환이 새 대화로 기록되는 것은 거짓 계측**이다 —
     * 「대화가 사라졌다」 신고를 가르는 증거가 그 이벤트다(openwiki/editor-observability.md).
     */
    resumeTarget: ConversationRecord | null = null,
  ): boolean => {
    closeAiConversationHistoryModal();
    clearRecovery();
    // 버릴 것이 있었는지를 보관 전에 재다 — 부팅 지연 로드도 프로젝트 전환으로 보이므로,
    // 할 이야기가 없는 전환은 조용하게 재스코프만 한다.
    const discardedEntries = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])].length;
    const hadConversation = discardedEntries > 0;
    // 새 대화는 진행 중인 턴을 포기한다 — 그 사실과 버린 칸 수를 남긴다. 「대화가 사라졌다」는
    // 신고가 새 대화 클릭인지 다른 결함인지 가르는 유일한 증거다.
    recordAiUiEvent({
      surface: "panel",
      action: AI_UI_ACTIONS.newConversation,
      detail: {
        reason,
        discardedEntries,
        abortedTurn: turnBusy,
        droppedQueue: pendingSends.length,
        resumed: resumeTarget !== null,
      },
    });
    // 먼저 ownership을 끊고 abort한 뒤 큐를 버린다. 새 대화는 이유와 무관하게 진행 중인 턴을
    // 포기하며, 늦은 finally는 시작 당시 캡처한 대화와 감사 항목에만 저장한다.
    retireConversationTurn();
    persistConversation();
    dropSession(controller, getPendingRegionApply());
    clearWorkPlanSurface(); // 새 대화 — 이전 대화의 할 일 목록/예산/피드를 버린다.
    // 새 대화는 정말로 빈 대화다 — 복원/되감기가 예약해 둔 기록 주입이 남아 있으면 버린다.
    pendingPriorTranscript = null;
    controller.auditHistory = [];
    controller.statusTimeline = [];
    // 이어받을 대화가 있으면 그 id 로 곧장 간다 — 버릴 id 를 발급하지 않는다.
    conversationId = resumeTarget?.id ?? genId("conv");
    const nextIdentity = store.getProjectIdentity();
    projectIdentityId = nextIdentity.id;
    conversationScope = conversationScopeKey(nextIdentity, store.getCurrent());
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    // #211 이 승인 게이트를 걷어내 인라인 삹인 버튼과 제안 모달이 없다 — 남은 자운은 안내뿐이다.
    proposalNoticeHost.replaceChildren();
    pendingQuestion = false;
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    studioToolLines.length = 0;
    lastStudioChange = null;
    studioShell?.setToolLines(studioToolLines);
    studioShell?.setChangePreview(null);
    studioShell?.setWorkPlan(null, false);
    // 이어받는 전환은 시작 화면을 깔지 않는다 — 곧 복원된 대화가 그 자리를 채운다(깜빡임 제거).
    if (!resumeTarget) ensureStartScreen();
    setStatus(resumeTarget ? "이전 대화" : reason === "project-switch" ? "새 프로젝트 — 새 대화" : "새 대화");
    refreshExportButton();
    syncGlassIdle();
    syncConversationState();
    refreshContextMeter();
    return hadConversation;
  };

  /**
   * 새 대화 시작 — 컴포저의 ＋ 와 액션 메뉴가 공유하는 **유일한** 진입점.
   *
   * 새 대화는 **사용자가 명시적으로 누를 때만** 생긴다. 프로젝트 전환은 이 경로를 쓰지 않는다
   * (adoptConversationForCurrentProject 참조) — 의식하지 않은 리셋이 곧 "새 세션 강요" 로 보인다.
   */
  const startNewConversation = (reason: "manual"): void => {
    resetConversationState(reason);
    toast("새 대화를 시작했습니다. 이전 대화는 기록에 저장됐습니다.", "ok");
  };

  /**
   * 프로젝트가 바뀌었을 때 — **새 세션을 강요하지 않고** 그 프로젝트의 마지막 대화를 이어받는다.
   *
   * 왜: 이전 프로젝트의 계획·제안·맵 좌표는 새 프로젝트에서 무의미하므로 대화를 갈아야 하는 것은
   * 맞다. 그런데 갈아 끼울 자리에 **빈 대화**를 넣던 것이 문제였다 — 부팅 지연 로드(로컬 신원 →
   * 원격 durable id)도 전환으로 보이므로, 방금 자동 복원한 대화가 부팅마다 다시 비워졌다.
   * 새 스코프의 저장본이 있으면 그것을 열고, 없을 때만 빈 대화로 남는다.
   */
  let adoptGeneration = 0;
  const adoptConversationForCurrentProject = async (): Promise<void> => {
    closeAiConversationHistoryModal();
    // 새 스코프를 먼저 읽어 이어받을 대화를 정한다 — 리셋이 그 사실을 알아야 버릴 id·시작 화면·
    // 거짓 계측을 만들지 않는다. 리셋 자체는 여전히 **옛** scope/id 로 닫히는 대화를 보관한다.
    // 조회는 비동기(IndexedDB)다. 그 사이 또 전환됐으면 뒤의 전환이 처리한다 — 낡은 결과로 리셋하지 않는다.
    const generation = ++adoptGeneration;
    const nextScope = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const resumed = await loadLatestConversationForScope(nextScope);
    if (disposed || generation !== adoptGeneration) return;
    const hadConversation = resetConversationState("project-switch", resumed);
    if (resumed) {
      restoreConversationRecord(resumed, "project-switch");
      // 부팅 지연 로드에서도 매번 뜨면 소음이다 — 정말 다른 대화를 밀어냈을 때만 알린다.
      if (hadConversation) toast("프로젝트를 바꿔 그 프로젝트의 이전 대화를 이어갑니다.", "ok");
      return;
    }
    if (hadConversation) {
      toast("프로젝트가 바뀌어 새 대화를 시작합니다. 이전 대화는 그 프로젝트 기록에 저장됐습니다.", "ok");
    }
  };

  // 수동 대화 복원의 호출 지점. 감독 콘솔 전환에서 오버레이 시작 화면의 '이전 대화 이어가기'
  // 버튼과 기록 검색 카드가 함께 사라져 `loadConversation`/`searchConversations` 가 죽은 코드로
  // 남아 있었다(저장 쪽은 계속 돌고 있었다). 모달이 그 조합을 되살린다.
  const openConversationHistory = (): void => {
    // 지금 대화를 먼저 보관한다 — 열기 직후 dropSession 이 세션을 버리므로 여기서 저장하지
    // 않으면 방금까지의 턴이 어디에도 남지 않는다.
    persistConversation();
    const capturedScope = conversationScope;
    const capturedIdentityId = projectIdentityId;
    const historyIdentity = store.getProjectIdentity().id;
    const historyConversationId = conversationId;
    const project = store.getCurrent();
    const stateMapId = editorState.get().currentMapId;
    const currentMapId = stateMapId && project.maps[stateMapId] ? stateMapId : project.startMapId;
    openAiConversationHistoryModal({
      scopeKey: capturedScope,
      currentConversationId: historyConversationId,
      currentMapId,
      knownMaps: Object.values(project.maps).map((map) => ({ id: map.id, name: map.name })),
      isCurrent: () => !disposed && store.getProjectIdentity().id === historyIdentity &&
        conversationScopeKey(store.getProjectIdentity(), store.getCurrent()) === capturedScope &&
        conversationId === historyConversationId,
      onOpen: (record) => {
        if (disposed) return;
        if (projectIdentityId !== capturedIdentityId) return;
        if (conversationScope !== capturedScope) return;
        if ((record.projectContextKey ?? null) !== capturedScope) return;
        restoreConversationRecord(record, "manual");
      },
    });
  };

  // 수동 압축은 요약 LLM 콜 1회다 — 진행 중 턴과 겹치면 같은 messages 배열을 두 곳이 만진다.
  let compacting = false;
  let maintenance: RunOperation | null = null;
  const retireMaintenance = () => {
    maintenance?.retire();
    maintenance = null;
    compacting = false;
  };

  /**
   * 세션이 그 표면을 실제로 갖췄는지 보고 부른다.
   *
   * 왜 낙관적으로 부르지 않는가 (실측): 이 패널의 세션 슬롯에는 전체 AssistantSession 대신
   * 부분 대역이 들어오는 경로가 있다(브리지 테스트가 sendUserMessage 만 가진 객체를 꽂는다).
   * 게이지는 읽기 전용 표시인데, 없는 메서드를 부르면 그 예외가 턴 정산(finally)까지 타고
   * 올라가 **턴 자체를 죽인다** — 표시가 실행을 죽이는 방향은 절대 허용하지 않는다.
   */
  const sessionMethod = (name: string): boolean =>
    typeof (controller.session as unknown as Record<string, unknown> | null | undefined)?.[name] === "function";

  const readContextSnapshot = (): AiContextSnapshot => {
    const session = controller.session;
    return {
      usage: session && sessionMethod("getContextUsage") ? session.getContextUsage() : null,
      totals: session && sessionMethod("getUsageTotals") ? session.getUsageTotals() : EMPTY_SESSION_USAGE,
      summary: session && sessionMethod("getLatestCompactionSummary") ? session.getLatestCompactionSummary() : null,
      canUndoCompaction: session !== null && sessionMethod("canUndoCompaction") && session.canUndoCompaction(),
      busy: turnBusy || compacting,
    };
  };
  const compactContextNow = async (): Promise<void> => {
    const session = controller.session;
    if (!session || !sessionMethod("compactNow")) {
      toast("압축할 대화가 없습니다.", "info");
      return;
    }
    if (turnBusy || compacting) {
      toast("진행 중인 응답이 끝난 뒤 압축하세요", "info");
      return;
    }
    compacting = true;
    const operation = new RunOperation();
    maintenance = operation;
    const owns = () => !disposed && maintenance === operation && controller.session === session;
    setStatus("맥락 압축 중…");
    refreshContextMeter();
    try {
      const outcome = await session.compactNow((event) => {
        if (owns() && event.type === "status") setStatus(event.text);
      }, operation.signal);
      if (!owns()) return;
      if (outcome.kind === "done") {
        appendBubble(
          "system",
          `맥락을 압축했습니다: ${outcome.beforeTokens.toLocaleString()} → ${outcome.afterTokens.toLocaleString()} 토큰 (요약 1건으로 접음).`,
        );
        setStatus("압축 완료");
        toast("맥락을 압축했습니다.", "ok");
        // 압축은 클릭 사실만으로 결과를 모른다 — 얼마가 줄었는지가 이 액션의 전부다.
        recordAiUiEvent({
          surface: "context-panel",
          action: AI_UI_ACTIONS.contextCompact,
          testid: "ai-context-compact",
          detail: { kind: "done", beforeTokens: outcome.beforeTokens, afterTokens: outcome.afterTokens },
        });
      } else {
        appendBubble("system", `압축하지 않았습니다 — ${outcome.reason}`);
        setStatus("압축 건너뜀");
        recordAiUiEvent({
          surface: "context-panel",
          action: AI_UI_ACTIONS.contextCompact,
          testid: "ai-context-compact",
          detail: { kind: "skipped", reason: outcome.reason },
        });
      }
    } catch (error) {
      if (!owns()) { console.warn("[aiContext] Retired compaction settled", error); return; }
      appendBubble("system", `압축 실패: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("압축 실패");
      recordAiUiEvent({
        surface: "context-panel",
        action: AI_UI_ACTIONS.contextCompact,
        testid: "ai-context-compact",
        detail: { kind: "error", error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      if (owns()) {
        retireMaintenance();
        refreshContextMeter();
        refreshExportButton();
      }
    }
  };

  const undoContextCompaction = (): void => {
    const session = controller.session;
    if (!session || !sessionMethod("undoLastCompaction") || turnBusy || compacting) return;
    const beforeTokens = sessionMethod("getContextUsage") ? (session.getContextUsage()?.contextTokens ?? null) : null;
    if (!session.undoLastCompaction()) {
      toast("되돌릴 압축이 없습니다.", "info");
      recordAiUiEvent({ surface: "context-panel", action: AI_UI_ACTIONS.contextCompactUndo, testid: "ai-context-compact-undo", disabled: true, detail: { kind: "nothing-to-undo" } });
      return;
    }
    appendBubble("system", "직전 압축을 되돌렸습니다. 요약 전 원문 대화로 돌아갔습니다.");
    setStatus("압축 되돌림");
    refreshContextMeter();
    recordAiUiEvent({
      surface: "context-panel",
      action: AI_UI_ACTIONS.contextCompactUndo,
      testid: "ai-context-compact-undo",
      detail: {
        kind: "done",
        beforeTokens,
        afterTokens: sessionMethod("getContextUsage") ? (session.getContextUsage()?.contextTokens ?? null) : null,
      },
    });
  };

  /**
   * 턴 되감기 — 이 지시 **직전** 상태로 대화와 프로젝트를 함께 되돌린다.
   *
   * 왜 둘을 같이 되돌리는가: 대화만 자르면 그 턴이 맵에 깔아 놓은 타일은 남는다. 사용자가 보는
   * "여기서 다시" 는 "그 시도를 없던 일로" 이므로 편집 기록 마커(mapEditHistory)도 같은 지점으로
   * 되감는다. 되돌릴 스냅샷이 없으면(그 턴이 아무것도 안 바꿨거나 링버퍼에서 밀려났으면)
   * 대화만 자르고 그 사실을 말한다 — 조용히 반쪽만 되감는 것이 가장 나쁘다.
   */
  const rewindToTurn = (turn: {
    readonly marker: number;
    readonly entries: readonly AuditEntry[];
    readonly text: string;
  }): void => {
    if (turnBusy || compacting) {
      toast("진행 중인 응답이 끝난 뒤 되감으세요", "info");
      // 거절도 남긴다. 실측(2026-08-30 진단 스펙)에서 이 경로가 조용해서, 되감기 버튼을 눌렀는데
      // 위임 수집의 `click:ai-turn-rewind` 만 있고 의미 이벤트가 없는 «반쪽 기록» 이 나왔다.
      recordAiUiEvent({
        surface: "panel",
        action: AI_UI_ACTIONS.turnRewind,
        testid: "ai-turn-rewind",
        disabled: true,
        detail: { reason: turnBusy ? "turn-busy" : "compacting" },
      });
      return;
    }
    const historyDepthBefore = getMapEditHistoryDebugEntries().length;
    const reverted = revertToHistoryMarker(turn.marker);
    const entriesBefore = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])].length;
    // 클릭 사실만으로는 «실제로 되돌아갔는지» 를 알 수 없다 — 되돌린 스냅샷 수와 대화 절단
    // 위치를 함께 남긴다. 되돌릴 기록이 없어 대화만 잘린 경우(revertedSnapshots 0)가 특히 중요하다.
    recordAiUiEvent({
      surface: "panel",
      action: AI_UI_ACTIONS.turnRewind,
      testid: "ai-turn-rewind",
      detail: {
        reverted,
        revertedSnapshots: Math.max(0, historyDepthBefore - getMapEditHistoryDebugEntries().length),
        entriesBefore,
        entriesAfter: turn.entries.length,
      },
    });
    dropSession(controller);
    clearWorkPlanSurface();
    // 잘린 대화도 모델에게는 이어져야 한다 — 남긴 앞부분을 다음 세션에 다시 주입한다.
    pendingPriorTranscript = serializeAuditTranscript(turn.entries) || null;
    controller.auditHistory = [...turn.entries];
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    proposalNoticeHost.replaceChildren();
    pendingQuestion = false;
    retireMaintenance();
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    for (const entry of turn.entries) renderConversationEntry(entry);
    appendBubble(
      "system",
      reverted
        ? "이 지시 직전으로 되감았습니다. 그 뒤의 편집은 되돌렸고 지시는 입력창에 돌려놨습니다."
        : "이 지시 직전으로 대화를 되감았습니다. 되돌릴 편집 기록은 남아 있지 않았습니다.",
    );
    setStatus("되감음");
    input.value = turn.text;
    input.focus?.();
    syncGlassIdle();
    refreshExportButton();
    syncConversationState();
    persistConversation();
    refreshContextMeter();
  };

  /**
   * 사용자 버블에 「여기서 다시」를 붙인다. 마커와 앞부분 기록은 **버블을 만드는 순간**(=이 턴이
   * 아무것도 하기 전)에 캡처해야 한다 — 클릭 시점에 다시 읽으면 이미 이 턴의 결과가 섞여 있다.
   */
  const attachRewindAffordance = (bubble: HTMLElement, text: string): void => {
    const marker = getMapEditHistoryMarker();
    const entries = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    const button = el("button", {
      class: "ai-assistant-action ai-turn-rewind",
      text: "여기서 다시",
      attrs: {
        type: "button",
        title: "이 지시 이후의 대화와 편집을 되돌리고 지시를 입력창에 돌려놓습니다",
      },
      dataset: { testid: "ai-turn-rewind" },
      on: { click: () => rewindToTurn({ marker, entries, text }) },
    });
    bubble.append(el("div", { class: "ai-retry-row ai-turn-rewind-row", children: [button] }));
  };

  // Choices stay in the transcript as text, never promoted to preset-like buttons.
  // Preserve the question engagement lock so a pending answer does not auto-collapse.
  const renderQuickReplies = (assistantText: string): void => {
    pendingQuestion = parseQuickReplies(assistantText).length > 0;
  };

  let selectionTaskActive = false;
  const currentSelectionForRegionTask = ():
    | { readonly mapId: string; readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } }
    | null => {
    if (!selectionTaskActive) return null;
    const state = editorState.get();
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId ?? null;
    const selection = state.selection;
    if (!mapId || !selection || selection.mapId !== mapId || !project.maps[selection.mapId]) return null;
    return {
      mapId: selection.mapId,
      region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
    };
  };

  // 사용자 메시지에 현재 맵/선택 영역을 자동 첨부한다 — "여기에 지어줘"의 '여기'를
  // 모델이 좌표로 받는다(공간 산파법의 짝: 사용자가 영역을 지정하면 그게 곧 답).
  const contextFooter = (scopeMapId?: string): string => {
    const ctx = mapContext();
    const parts = [`현재 맵: ${ctx.mapName ?? "없음"}${ctx.mapId ? ` (${ctx.mapId})` : ""}`];
    // 재료 라벨 예시는 현재 맵 타일셋의 사실이다 — 빠지면 모델이 그룹 id 를 재료로 쓰는 실수로 돌아간다.
    const tileset = tilesetForTurn(scopeMapId);
    if (tileset) parts.push(formatMaterialLabelHint(tileset).replace(/^- /, ""));
    // 선택 영역은 '현재 맵의 것'이고 맵 범위 안에 있을 때만 첨부한다.
    // 맵을 전환해도 남아 있던 이전 맵의 선택(예: 10×10 맵에 (11,9))이 모델에 새 좌표로 오인되던 문제(BUG F) 방지.
    const sel = ctx.selection;
    if (selectionTaskActive && sel && sel.mapId === ctx.mapId) {
      const map = ctx.mapId ? store.getCurrent().maps[ctx.mapId] : undefined;
      const inBounds = !map || (sel.x >= 0 && sel.y >= 0 && sel.x < map.width && sel.y < map.height);
      if (inBounds) parts.push(`사용자 선택 영역: (${sel.x},${sel.y}) ${sel.width}×${sel.height}`);
    }
    // 컴포저 모드(제안서 D4·§06). 강제는 세션이 한다(sendUserMessage 옵션 composerMode — 쓰기 툴 미노출·
    // 거부, 계획만 수립). 여기 한 절은 모델이 상황을 알게 하는 안내일 뿐이다. 지시(기본)는 덧붙이지 않는다 —
    // 기계 텍스트가 사용자 채널에 실리던 「도구 규칙」 사고(2026-09-03 의도 라우터 감사)를 되풀이하지 않기 위해.
    const autonomy = currentAutonomy();
    if (autonomy.readOnly) parts.push("모드: 읽기 전용 — 변경 도구는 제공되지 않는다. 조회 도구로만 답한다");
    else if (autonomy.planOnly) parts.push("모드: 확인 — 이 턴은 계획만 세운다. 사용자가 「계속」이라고 하면 실행한다");
    return `[컨텍스트] ${parts.join(" · ")}`;
  };

  // AI busy 중 입력 큐(도그푸딩 결함 ⑨): 처리 중 들어온 메시지는 동시 실행(레이스) 대신
  // 큐에 쌓고 "기다리는 메시지 N개"로 표시한 뒤, 현재 턴이 끝나면 순서대로 전송한다.
  const pendingSends: { text: string; displayAs?: string }[] = [];
  const queueIndicator = el("div", { class: "ai-pending-queue", dataset: { testid: "ai-pending-queue" } });
  queueIndicator.hidden = true;
  const refreshQueueIndicator = (): void => {
    queueIndicator.hidden = pendingSends.length === 0;
    queueIndicator.textContent =
      pendingSends.length > 0 ? `기다리는 메시지 ${pendingSends.length}개` : "";
  };
  const drainPendingSends = (): void => {
    const next = pendingSends.shift();
    refreshQueueIndicator();
    if (next) void sendText(next.text, next.displayAs);
  };

  // ── 할 일 목록 표면(작업 계획 체크리스트) ─────────────────────────────────
  // 수명은 **계획**에 묶인다 — 런이 아니다(2026-09-03). 예전에는 자율 런 동안만 살고 턴이 끝나면 걷혔는데,
  // 그러면 사용자는 조수가 뭐를 했고 뭐가 남았는지 읽을 틈이 없고 chat 모드에서는 아예 보지 못했다.
  // 지금은: 턴이 시작하면 세션의 미완료 계획을 이어받고(끝난 계획은 버린다), work_plan 이벤트마다 항목에 체크가 붙고,
  // Live chrome ends with its owner turn; the session retains the plan and audit history.
  // 마일스톤 피드(milestone_applied/proposal_paused)와 예산(used/48)은
  // 자율 런에만 있고 「자세히」 서랍에 든다. active 인 동안은 패널 자동 접기(AUTO_COLLAPSE_AFTER_AI_MS)를 막는다.
  let workPlanSurfaceState: { active: boolean; stoppedReason?: string; plan: WorkPlan | null; budget: AutonomousRunBudget | null } | null = null;
  let workPlanSurface: HTMLElement | null = null;
  let workPlanFeedHost: HTMLElement | null = null;
  // 진행 중 항목 아래 보이는 현재 툴 라벨 — tool_started 마다 그 줄만 갈아 끼운다(체크리스트 전체 재렌더 금지 — 툴콜은 수백 번 온다).
  let workPlanActivity = "";
  const removeWorkPlanSurfaceDom = (): void => {
    workPlanSurface?.remove();
    workPlanSurface = null;
    workPlanFeedHost = null;
    panel.classList.remove("is-autonomous-run");
  };
  /** 대화 경계 — 목록을 완전히 걷는다(새 대화·전환·되감기·해제). */
  const clearWorkPlanSurface = (): void => {
    outcomeSlot.replaceChildren();
    stickyChecklist.update(null);
    workPlanSurfaceState = null;
    workPlanActivity = "";
    closeWorkPlanBook();
    removeWorkPlanSurfaceDom();
    studioShell?.setWorkPlan(null, false);
  };
  /**
   * 턴 시작 — 세션이 들고 있는 미완료 계획은 이어받고(사용자 「계속」·중간 지시), 끝난 계획은 버린다.
   * 예산은 자율 진입에만 세운다(드라이버가 이어 보내는 턴 수). 새 계획은 work_plan 이벤트로 들어온다.
   * 다이얼 명시 시 예산 total 은 레벨 cap — 미지정 config 는 종래 48 그대로.
   */
  const runBudgetTotal = (): number => {
    const raw = loadAiConfig().autonomyLevel;
    return isAutonomyLevel(raw) ? Math.min(resolveAutonomy(raw).budgetCap, AGENT_RUN_MAX_TOTAL_STEPS) : AGENT_RUN_MAX_TOTAL_STEPS;
  };
  const beginWorkPlanTurn = (opts: { readonly autonomous: boolean; readonly carriedPlan: WorkPlan | null }): void => {
    outcomeSlot.replaceChildren();
    stickyChecklist.setBusy(true);
    const carried = opts.carriedPlan && !isWorkPlanComplete(opts.carriedPlan) ? opts.carriedPlan : null;
    workPlanSurfaceState = {
      active: true,
      plan: carried,
      budget: opts.autonomous ? { used: 0, total: runBudgetTotal(), exhausted: false } : null,
    };
    workPlanActivity = "";
    removeWorkPlanSurfaceDom();
    if (carried) refreshWorkPlanSurface();
    else studioShell?.setWorkPlan(null, false);
  };
  /** End live chrome, retaining plan/budget state for history and continuation. */
  const settleWorkPlanTurn = (): void => {
    refreshRunOutcome();
    stickyChecklist.setBusy(false);
    stickyChecklist.setActivity("");
    const focused = document.activeElement;
    const restoreComposerFocus = workPlanSurface?.contains(focused)
      || document.querySelector("[data-testid='ai-plan-book-overlay']")?.contains(focused);
    if (workPlanSurfaceState) workPlanSurfaceState.active = false;
    workPlanActivity = "";
    closeWorkPlanBook();
    removeWorkPlanSurfaceDom();
    studioShell?.setWorkPlan(null, false);
    if (restoreComposerFocus) input.focus();
  };
  const ensureWorkPlanSurface = (): HTMLElement => {
    if (!workPlanSurface) {
      workPlanFeedHost = el("div", { class: "ai-autonomous-feed", dataset: { testid: "ai-autonomous-feed" } });
      workPlanSurface = el("div", {
        class: "ai-autonomous-run-surface",
        dataset: { testid: "ai-autonomous-run-surface" },
      });
      mainColumn.prepend(workPlanSurface);
    }
    panel.classList.add("is-autonomous-run");
    return workPlanSurface;
  };
  const bookInput = (): {
    plan: WorkPlan;
    active: boolean;
    activity: string;
    onStop: () => void;
  } | null => {
    const state = workPlanSurfaceState;
    if (!state?.plan) return null;
    return {
      plan: state.plan,
      active: state.active,
      activity: workPlanActivity,
      onStop: () => abortActiveTurn(),
    };
  };
  const openPlanBook = (): void => {
    const input = bookInput();
    if (!input) return;
    openWorkPlanBook(input);
  };
  // 계획 도착 시마다 앞면과(열려 있으면) 책 모달을 갱신한다.
  const refreshWorkPlanSurface = (): void => {
    if (!workPlanSurfaceState?.active || !workPlanSurfaceState.plan) return;
    const surface = ensureWorkPlanSurface();
    const checklist = renderWorkPlanChecklist(workPlanSurfaceState.plan, {
      active: workPlanSurfaceState.active,
      stoppedReason: workPlanSurfaceState.stoppedReason,
      budget: workPlanSurfaceState.budget ?? undefined,
      activity: workPlanActivity,
      onStop: () => abortActiveTurn(),
      onOpenBook: openPlanBook,
    });
    checklist.querySelector<HTMLElement>("[data-testid='ai-run-details']")?.append(workPlanFeedHost!);
    surface.replaceChildren(checklist);
    studioShell?.setWorkPlan(workPlanSurfaceState.plan, workPlanSurfaceState.active);
    const input = bookInput();
    if (input) updateWorkPlanBook(input);
  };
  /** work_plan 이벤트 — 어느 모드의 턴이든 계획이 오면 보인다. 턴 밖에서 오면(소유권 없는 늦은 이벤트) 무시한다.
   * 계획 책 모달은 자동으로 띄우지 않는다(2026-09: plan 팝업 제거 정책) — 앞면 체크리스트와
   * 「계획 책」 버튼으로 직접 열어본다. */
  const showWorkPlan = (plan: WorkPlan): void => {
    if (!workPlanSurfaceState) return;
    workPlanSurfaceState.plan = plan;
    refreshWorkPlanSurface();
  };
  /** tool_started — 진행 중 항목의 활동 줄만 갱신. 목록이 아직 없으면 다음 렌더가 가져가게 기억만 해 둔다. */
  const noteWorkPlanActivity = (label: string): void => {
    workPlanActivity = label;
    const notes = [
      ...(workPlanSurface?.querySelectorAll<HTMLElement>("[data-testid='ai-work-item-activity']") ?? []),
      ...document.querySelectorAll<HTMLElement>("[data-testid='ai-plan-book'] [data-testid='ai-work-item-activity']"),
    ];
    for (const note of notes) note.textContent = label;
  };
  // 마일스톤 자동 적용/적용 실패 — 목록의 「자세히」 피드에 한 줄씩 쌓는다(피드는 표면과 함께 정리된다).
  const appendMilestoneFeedLine = (kind: "applied" | "apply-failed", title: string, detail: string): void => {
    if (!workPlanSurfaceState) return;
    ensureWorkPlanSurface();
    refreshWorkPlanSurface();
    workPlanFeedHost!.append(
      el("div", {
        class: `ai-autonomous-feed-line is-${kind}`,
        dataset: { testid: `ai-milestone-feed-${kind}` },
        children: [
          el("span", { class: "ai-autonomous-feed-mark", text: kind === "applied" ? "✓" : "!" }),
          el("span", {
            class: "ai-autonomous-feed-text",
            text: `${kind === "applied" ? "마일스톤 적용" : "적용 실패"}: ${title}${detail ? ` — ${detail}` : ""}`,
          }),
        ],
      })
    );
  };

  let keyPromptBubble: HTMLElement | null = null;
  const appendOpenSettingsButton = (bubble: HTMLElement, focusTarget: "first" | "apiKey" = "apiKey"): void => {
    const button = el("button", {
      class: "ai-assistant-action ai-error-open-settings",
      text: "설정 열기",
      attrs: { type: "button", title: "어시스턴트 설정을 열고 API 키 입력으로 이동합니다" },
      dataset: { testid: "ai-error-open-settings" },
      on: { click: () => openAiSettings(focusTarget) },
    });
    bubble.append(el("div", { class: "ai-retry-row", children: [button] }));
  };
  const showMissingKeyPrompt = (): void => {
    openAiSettings("apiKey");
    if (keyPromptBubble?.parentNode) return;
    keyPromptBubble = appendBubble("system", "API 키가 필요합니다. 설정을 열어 LLM API 키와 baseUrl을 입력하세요.");
    appendOpenSettingsButton(keyPromptBubble, "apiKey");
  };
  const ensureConfigReadyForSend = (): boolean => {
    const config = loadAiConfig();
    if (isAiConfigReady(config)) return true;
    if (config.authMode === "chatgpt") {
      openAiSettings("first");
      toast("AI 설정에서 ChatGPT 연결과 모델을 확인하세요.", "error");
      return false;
    }
    showMissingKeyPrompt();
    toast("AI 설정에서 API 키를 먼저 입력하세요.", "error");
    return false;
  };
  let abortButton: HTMLButtonElement | null = null;
  let activeAbortController: AbortController | null = null;
  let activeSelectionRegionController: AbortController | null = null;
  /** `/pi` 실행 중인 Pi 에이전트의 취소 컨트롤러. 선택 영역 작업처럼 직접 abort 한다. */
  let piRunController: AbortController | null = null;
  let activeSelectionRegionKey: string | null = null;
  const abortActiveSelectionRegionTask = (): void => {
    const regionController = activeSelectionRegionController;
    if (!regionController || regionController.signal.aborted) return;
    regionController.abort();
    if (activeAbortController === regionController) {
      setStatus("중단 중…");
      refreshAbortButton();
    }
  };
  let abortNoticeShown = false;
  let progressTimer: number | null = null;
  const refreshAbortButton = (): void => {
    if (!abortButton) return;
    const running = Boolean(activeAbortController && !activeAbortController.signal.aborted);
    abortButton.hidden = !turnBusy;
    abortButton.disabled = !running;
    abortButton.setAttribute("aria-disabled", String(!running));
    // 전송은 항상 마운트 — 진행 중엔 비활성(disabled)으로 두고 중단은 형제로 노출한다.
    sendButton.hidden = false;
    refreshSendEnabled();
    // 도크 버튼을 턴 중에 잠그던 배선은 걷었다 — 바꿀 도크가 없으니 잠글 것도 없다.
  };
  const refreshRunningStatus = (record = false): void => {
    if (!runningProgress) return;
    refreshLiveActivity();
    const activityLine = runningActivity
      ? narrateAiActivity({ toolName: runningActivity.toolName }).line
      : undefined;
    // 분모는 세션의 실제 안전핀(config.maxToolCalls) — 하드코딩 분모를 쓰지 마라(실한도와 어긋나 "77/30" 같은 모순 표기를 냈다).
    setStatus(formatAiRunningStatus(
      runningProgress.startedAt,
      now(),
      runningProgress.toolCount,
      loadAiConfig().maxToolCalls,
      runningPhaseStatus,
      activityLine,
    ), record);
  };
  const beginTurnProgress = (): void => {
    runningPhaseStatus = null;
    runningActivity = null;
    runningProgress = { startedAt: now(), toolCount: 0 };
    // 접힘 레일의 상태 점: 진행 중 표시를 켜고 직전 턴의 알림 점은 지운다.
    panel.classList.add("is-turn-running");
    panel.classList.remove("is-turn-attention", "is-turn-error");
    syncGlassIdle();
    refreshRunningStatus(true);
    if (typeof window !== "undefined" && typeof window.setInterval === "function") {
      progressTimer = window.setInterval(() => refreshRunningStatus(false), 1000);
    }
  };
  const bumpToolProgress = (): void => {
    if (!runningProgress) return;
    runningProgress.toolCount += 1;
    refreshRunningStatus(false);
  };
  const endTurnProgress = (): void => {
    // 정상·중단·오류 어느 종료든 예약된 완료 행을 먼저 확정해 스피너와 기록 유실을 막는다.
    flushPendingActivitySwaps();
    if (progressTimer !== null && typeof window !== "undefined") window.clearInterval(progressTimer);
    progressTimer = null;
    runningProgress = null;
    runningPhaseStatus = null;
    clearAgentGhostRunningTool();
    runningActivity?.row.remove();
    runningActivity = null;
    panel.classList.remove("is-turn-running");
    syncGlassIdle();
  };
  const abortActiveTurn = (): void => {
    if (!activeAbortController || activeAbortController.signal.aborted) return;
    const regionOwner = activeAbortController === activeSelectionRegionController || activeAbortController === piRunController;
    // 중단 시점의 진행 정도를 함께 남긴다 — 툴 0개에서 끊긴 것과 40개 돌다 끊긴 것은 다른 사건이다.
    const toolsSoFar = (controller.session?.getAuditEntries() ?? []).filter((entry) => entry.kind === "tool").length;
    const droppedQueue = pendingSends.length;
    pendingSends.length = 0;
    refreshQueueIndicator();
    if (regionOwner) activeAbortController.abort();
    else turnRunner.abortTurn();
    if (!abortNoticeShown) {
      appendBubble("system", "사용자가 중단했습니다.");
      abortNoticeShown = true;
    }
    setStatus(regionOwner ? "중단 중…" : "대기");
    refreshAbortButton();
    recordAiUiEvent({ surface: "panel", action: AI_UI_ACTIONS.turnAbort, detail: { toolsSoFar, droppedQueue } });
  };

  // 이 턴이 손댈 범위 — 현재 맵의 선택 사각형(사실). 그 안에서 작업할지, 새 맵 시공이라 참고용인지는
  // 세션의 의도 선언(useSelection)이 정한다. 예전에는 실내 낱말 정규식으로 스코프를 버렸다.
  const resolveTurnScope = (): SessionTurnScope | null => {
    // 칩을 ×로 끈 선택은 스코프가 아니다 — 끄고 보낸 「나무 세 그루」가 옛 영역 안에만 심기던 결함(2026-09-03).
    if (!selectionTaskActive) return null;
    const state = editorState.get();
    const selection = state.selection;
    if (!selection) return null;
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId ?? null;
    if (!mapId || selection.mapId !== mapId || !project.maps[selection.mapId]) return null;
    return {
      mapId: selection.mapId,
      region: { x: selection.x, y: selection.y, width: selection.width, height: selection.height },
    };
  };

  // 재료 라벨 예시를 뽑을 타일셋. 스코프가 없으면 현재 열린 맵 것을 쓴다 — 라벨 힌트가 빠지면
  // 모델이 그룹 id 를 재료로 쓰는 실수로 돌아간다.
  const tilesetForTurn = (scopeMapId?: string): TilesetDef | undefined => {
    const project = store.getCurrent();
    const mapId = scopeMapId ?? editorState.get().currentMapId ?? project.startMapId ?? null;
    if (!mapId) return undefined;
    const map = project.maps[mapId];
    return map ? project.tilesets[map.tilesetId] : undefined;
  };

  const sendText = async (
    text: string,
    displayAs?: string,
    opts?: { readonly replay?: boolean; readonly onSettled?: () => void },
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!ensureConfigReadyForSend()) return;
    clearRecovery();
    if (activeAbortController?.signal.aborted && activeAbortController !== activeSelectionRegionController) turnRunner.abortTurn();
    if (turnBusy) {
      pendingSends.push({
        text: trimmed,
        ...(displayAs !== undefined ? { displayAs } : {}),
      });
      refreshQueueIndicator();
      return;
    }
    pendingQuestion = false;
    closeToolActivity();
    if (!opts?.replay) attachRewindAffordance(appendBubble("user", displayAs ?? trimmed), trimmed);
    const session = ensureSession();
    // 두 턴 사이에 사용자가 데이터베이스(개념 꾸러미 등)를 고쳤을 수 있다 — 승인 대기 제안이 없으면
    // 세션 기준을 저장소 최신으로 맞춘다. 안 그러면 조수는 옛 나무를 읽는다(2026-09-02 실측).
    if (!opts?.replay && proposalApi.pendingProposalMessage === null) {
      session.syncBaselineFromStoreIfClean(store.getCurrent());
    }
    // 자율 드라이버 진입: agentMode "auto" 에서만 켠다(전송 시점 설정 기준).
    // "chat" 은 종전대로 턴 1개(수동 「계속」). opts.autonomous 는 세션 진입점의 명시 오버라이드(브리지/테스트).
    const autonomous = loadAiConfig().agentMode === "auto";
    // 계획 모드의 첫 턴은 계획만 세우고 멈춘다(세션이 강제). 활성 계획이 있는 채 「계속」이면 실행 턴이다.
    const activePlan = session.getWorkPlan();
    const planPreview = currentAutonomy().planOnly && (!activePlan || isWorkPlanComplete(activePlan));
    // 사용자 발화 + 사실(footer: 현재 맵·선택 영역·재료 라벨 예)만 보낸다. 예전에 여기 붙던 「도구 규칙」
    // 17줄은 툴 설명으로 옮겼다 — 기계 텍스트가 사용자 채널에 실려 되묻기·플래너 스킵·툴 노출을 어긋나게
    // 했던 근인이다(2026-09-03 의도 라우터 감사). 선택 사각형은 스코프 인자로 따로 넘긴다.
    const turnScope = resolveTurnScope();
    const payload = [trimmed, contextFooter(turnScope?.mapId)].filter((part) => part.length > 0).join("\n\n");
    const composerMode = derivedComposerMode();
    await executeTurn(session, trimmed, (onEvent, signal) =>
      // instruction: 사용자 발화 원문 — 의도 선언·툴 이름 언급·능력 승격은 이것만 본다.
      session.sendUserMessage(payload, onEvent, signal, { autonomous, instruction: trimmed, scope: turnScope, composerMode }),
      { autonomous: autonomous && !planPreview, composerMode, onSettled: opts?.onSettled }
    );
  };

  // 한 턴 실행 공통부: 최초 전송(sendUserMessage)과 오류 후 수동 재시도(retryLastTurn)가
  // 같은 스트리밍/제안/상태 처리를 공유한다(도그푸딩 결함 ⑥).
  // ── 실행 표면 ────────────────────────────────────────────────────────────
  // 채팅 턴(aiTurnRunner)과 선택 영역 작업(aiRegionTaskRunner)이 공유하는 표면. 가변 필드는
  // 접근자로 넘겨 상태의 소유권을 이 클로저에 남긴다 — 실행부는 사용자일 뿐이다.
  // 요소(panel 등)는 이 지점보다 아래에서 만들어지므로 getter 로 늦게 읽는다(TDZ 회피).
  const runSurface: AiRunSurface = {
    get panel() { return panel; },
    get log() { return log; },
    get sendButton() { return sendButton; },
    get controller() { return controller; },
    get turnBusy() { return turnBusy; },
    set turnBusy(value) {
      turnBusy = value;
      if (!value) for (const resolve of idleWaiters) resolve();
    },
    get disposed() { return disposed; },
    get abortNoticeShown() { return abortNoticeShown; },
    set abortNoticeShown(value) { abortNoticeShown = value; },
    get activeAbortController() { return activeAbortController; },
    set activeAbortController(value) { activeAbortController = value; },
    get collapseAfterAiWork() { return collapseAfterAiWork; },
    set collapseAfterAiWork(value) { collapseAfterAiWork = value; },
    get collapsed() { return collapsed; },
    get conversationId() { return conversationId; },
    get conversationScope() { return conversationScope; },
    get runningPhaseStatus() { return runningPhaseStatus; },
    set runningPhaseStatus(value) { runningPhaseStatus = value; },
    get runningProgress() { return runningProgress; },
    setStatus: (text, record) => setStatus(text, record),
    beginTurnProgress: () => beginTurnProgress(),
    endTurnProgress: () => endTurnProgress(),
    refreshRunningStatus: (record) => refreshRunningStatus(record),
    refreshAbortButton: () => refreshAbortButton(),
    startLiveActivity: (toolName, index) => startLiveActivity(toolName, index),
    completeLiveActivity: (toolName, result, args) => completeLiveActivity(toolName, result, args),
    expandForAiWork: () => expandForAiWork(),
    scheduleCollapseAfterAiWork: () => scheduleCollapseAfterAiWork(),
    notifyIfObscuredByTestPlay: () => notifyIfObscuredByTestPlay(),
    drainPendingSends: () => drainPendingSends(),
    persistConversation: (target) => persistConversation(target),
    // 「계속」이 모드를 do 로 리셋하던 코드는 없앴다. 모드가 턴 단위였을 때는 무해했지만
    // 이제 정본은 지속 설정인 자율성 다이얼이다 — 「계속」이 사용자의 읽기 전용을 몰래 풀면
    // 다음 턴부터 쓰기 툴이 붙는다. 읽기 전용에서 「계속」은 읽기를 계속하는 뜻이다.
    sendText: (text, displayAs, opts) => sendText(text, displayAs, opts),
    appendBubble: (role, text) => appendBubble(role, text),
    appendReasoning: () => appendReasoning(),
    closeToolActivity: () => closeToolActivity(),
    clearLastReasoning: () => clearLastReasoning(),
    isLastReasoningBox: (node) => isLastReasoningBox(node),
  };

  // 한 턴 실행 공통부: 최초 전송(sendUserMessage)과 오류 후 수동 재시도(retryLastTurn)가
  // 같은 스트리밍/제안/상태 처리를 공유한다(도그푸딩 결함 ⑥). 본문은 aiTurnRunner.ts.
  const turnRunner = createAiTurnRunner({
    surface: runSurface,
    get applyingProposal() { return applyingProposal; },
    set applyingProposal(value) { applyingProposal = value; },
    get projectIdentityId() { return projectIdentityId; },
    set projectIdentityId(value) { projectIdentityId = value; },
    get workPlanSurfaceState() { return workPlanSurfaceState; },
    applyProposal: (calls, assistantBubble) => applyProposal(calls, assistantBubble),
    noteNoChanges: (result, extraWarnings) => noteNoChanges(result, extraWarnings),
    beginWorkPlanTurn: (opts) => beginWorkPlanTurn(opts),
    settleWorkPlanTurn: () => settleWorkPlanTurn(),
    refreshWorkPlanSurface: () => refreshWorkPlanSurface(),
    showWorkPlan: (plan) => showWorkPlan(plan),
    showAcceptance: (snapshot) => stickyChecklist.update(snapshot),
    noteWorkPlanActivity: (label) => { noteWorkPlanActivity(label); stickyChecklist.setActivity(label); },
    appendMilestoneFeedLine: (kind, title, detail) => appendMilestoneFeedLine(kind, title, detail),
    appendTileThumbs: (tilesetId, tiles) => appendTileThumbs(tilesetId, tiles),
    appendTileGrid: (data) => appendTileGrid(data),
    appendAiDocument: (documentData) => appendAiDocument(documentData),
    hasPendingQuestion: () => hasPendingQuestion(),
    openAiSettings: (focusTarget) => openAiSettings(focusTarget),
    renderQuickReplies: (assistantText) => renderQuickReplies(assistantText),
    refreshContextMeter: () => refreshContextMeter(),
  });
  const executeTurn = turnRunner.executeTurn;

  // 선택 영역 작업 — 본문은 aiRegionTaskRunner.ts(같은 실행 표면, 다른 이벤트 원천).
  const regionTaskRunner = createAiRegionTaskRunner({
    surface: runSurface,
    get status() { return status; },
    get selectionTaskActive() { return selectionTaskActive; },
    set selectionTaskActive(value) { selectionTaskActive = value; },
    get activeSelectionRegionController() { return activeSelectionRegionController; },
    set activeSelectionRegionController(value) { activeSelectionRegionController = value; },
    get activeSelectionRegionKey() { return activeSelectionRegionKey; },
    set activeSelectionRegionKey(value) { activeSelectionRegionKey = value; },
    currentSelectionForRegionTask: () => currentSelectionForRegionTask(),
    refreshContextChips: () => refreshContextChips(),
    runRegion: (options) => runRegion(options),
  });
  const sendSelectionRegionTask = (text: string): Promise<void> =>
    regionTaskRunner.sendSelectionRegionTask(text);

  // 풀스크린 시연 실행 창이 AI 패널을 가리고 있으면, 턴 완료를 사용자에게 알린다
  // (도그푸딩 결함 ④ — 모달 뒤에서 턴/프로포절이 조용히 진행되던 문제). 자동으로 창을
  // 닫거나 열지 않는다: 완료 알림 + 기존 수동 버튼(편집으로/닫기)으로 확인하게 한다.
  const notifyIfObscuredByTestPlay = (): void => {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
    if (!document.querySelector('[data-testid="test-play-window"]')) return;
    toast("AI 응답 완료 — 시연 실행 창 뒤에 결과/제안이 있습니다. '편집으로'를 눌러 확인하세요.", "info");
  };

  const send = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text) {
      // 조용한 return 은 "버튼이 고장났나" 로 읽혔다. 무엇이 부족한지 말하고 초점을 준다.
      toast("보낼 지시를 입력하세요", "info");
      try {
        input.focus();
      } catch {
        // headless DOM may not implement focus
      }
      return;
    }
    if (!ensureConfigReadyForSend()) return;
    if (selectionTaskActive && currentSelectionForRegionTask() && turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    input.value = "";
    syncInputHeight();
    refreshSendEnabled();
    // 실행 경로: 컴포저 셀렉트(설정과 같은 값)가 기본을 정하고, 질문·계획·선택 영역은 기존 조수로 간다.
    // `/pi …` 는 언제나 명시적 Pi 경로다.
    const decision = resolveExecutionRoute({
      text,
      // The composer no longer carries mode chips (#731); the autonomy dial derives it.
      composerMode: derivedComposerMode(),
      preferred: loadAiConfig().executionRoute ?? DEFAULT_EXECUTION_ROUTE,
      selectionTaskActive: Boolean(selectionTaskActive && currentSelectionForRegionTask()),
    });
    const explicit = parsePiCommand(text, store.getCurrent(), editorState.get().currentMapId ?? null);
    const piCommand = explicit
      ?? (decision.route === "session"
        ? null
        : parsePiCommand(`/pi ${decision.route === "pi-team" ? "team " : ""}${text}`, store.getCurrent(), editorState.get().currentMapId ?? null));
    if (piCommand) {
      if (turnBusy) {
        toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
        return;
      }
      appendBubble("user", text);
      // 기존 턴과 같은 중단 버튼을 쓴다 — 컨트롤러를 활성 자리에 앉히고 실행 중 표시(turnBusy)를 켠다.
      piRunController = new AbortController();
      activeAbortController = piRunController;
      abortNoticeShown = false;
      runSurface.turnBusy = true;
      refreshAbortButton();
      // 유휴 판정을 갱신해야 로그 카드가 펼쳐진다 — 이 경로는 세션 턴 러너를 거치지 않아 스스로 부른다.
      syncGlassIdle();
      try {
        await runPiCommand(piCommand, {
          appendBubble: (role, line) => appendBubble(role, line),
          appendCard: (element) => { appendChangeCard(element); log.scrollTop = log.scrollHeight; },
          setStatus,
          getCurrentMapId: () => editorState.get().currentMapId ?? null,
          signal: piRunController.signal,
        });
      } finally {
        if (activeAbortController === piRunController) activeAbortController = null;
        piRunController = null;
        runSurface.turnBusy = false;
        refreshAbortButton();
        syncGlassIdle();
      }
      return;
    }
    if (selectionTaskActive && currentSelectionForRegionTask()) await sendSelectionRegionTask(text);
    else await sendText(text);
  };

  sendButton.addEventListener("click", () => void send());
  input.addEventListener("keydown", (event) => {
    // 엔터 = 즉시 전송, Shift+Enter = 줄바꿈. IME 조합 중(한글 입력 확정)에는 전송하지 않는다.
    const composing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
    // Escape 우선순위: **사용자가 연** 팝오버 → 선택 영역 작업. 팝오버가 떠 있는데 선택
    // 컨텍스트가 먼저 해제돼 사용자가 "무엇이 닫혔는지" 알 수 없던 문제를 없앤다.
    if (event.key === "Escape") {
      const popover = composerPopoverKind();
      if (popover !== null) {
        event.preventDefault();
        openComposerPopover(null);
        return;
      }
      if (selectionTaskActive) {
        event.preventDefault();
        clearSelectionTaskContext();
      }
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !composing) {
      event.preventDefault();
      void send();
    }
  });

  // 컴포저가 AI 에게 넘기는 현재 맵/선택 영역 컨텍스트(컨텍스트 푸터·칩의 단일 소스).
  const mapContext = (): PanelMapContext => {
    const state = editorState.get();
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId ?? null;
    return {
      mapId,
      mapName: mapId ? project.maps[mapId]?.name ?? null : null,
      selection: state.selection
        ? { mapId: state.selection.mapId, x: state.selection.x, y: state.selection.y, width: state.selection.width, height: state.selection.height }
        : null,
    };
  };

  // Empty conversations do not promote authored example prompts.
  const ensureStartScreen = (): void => {};

  // 여러 줄 입력 자동 성장 — 고정 높이 창에 30줄이 갇혀 끝부분만 보이던 결함(적대 평가 P1).
  // 내용 높이에 맞춰 늘리고, 상한(요소 max-height)부터는 스크롤로 전환한다.
  // 바 높이가 변하는 유일한 경로이므로 여기서만 clearance 를 다시 잰다.
  const syncInputHeight = (): void => {
    input.style.height = "auto";
    const minHeight = typeof getComputedStyle === "function"
      ? Number.parseFloat(getComputedStyle(input).minHeight) || 0
      : 0;
    input.style.height = `${Math.max(minHeight, input.scrollHeight)}px`;
    syncCommandBarClearance();
  };
  input.addEventListener("input", () => {
    syncInputHeight();
    refreshComposerPlaceholder();
    refreshSendEnabled();
  });
  input.addEventListener("blur", () => hideVolatileIfIdle());

  // AI가 지금 무엇을 보고 있는지 — 현재 맵 + 선택 영역 칩.
  const contextChips = el("div", { class: "ai-context-chips", dataset: { testid: "ai-context-chips" } });
  const refreshComposerPlaceholder = (): void => {
    const placeholder = formatComposerPlaceholder(readAgentBrief());
    if (input.getAttribute("placeholder") !== placeholder) input.setAttribute("placeholder", placeholder);
    syncConversationState();
  };
  const clearSelectionTaskContext = (): void => {
    abortActiveSelectionRegionTask();
    if (!selectionTaskActive) return;
    selectionTaskActive = false;
    dismissedSelectionKey = selectionKeyOf(editorState.get().selection);
    refreshContextChips();
  };
  const renderSelectionTaskChip = (
    selection: NonNullable<ReturnType<typeof currentSelectionForRegionTask>>
  ): HTMLElement =>
    el("span", {
      class: "ai-context-chip ai-selection-chip",
      dataset: { testid: "ai-selection-chip" },
      children: [
        el("span", { text: `선택 (${selection.region.x},${selection.region.y}) ${selection.region.width}×${selection.region.height}` }),
        el("button", {
          class: "ai-selection-chip-clear",
          children: [deckIcon("x", { size: 15 })],
          attrs: { type: "button", title: "선택 영역 AI 작업 해제", "aria-label": "선택 영역 AI 작업 해제" },
          dataset: { testid: "ai-selection-chip-clear" },
          on: {
            click: (event) => {
              event.preventDefault();
              event.stopPropagation();
              clearSelectionTaskContext();
              input.focus();
            },
          },
        }),
      ],
    });
  // 선택 영역 칩 자동 부착(스펙 §4 3-C): 새 선택은 자동 활성, ×로 끈 선택은 키가 같는 동안 재부착 금지.
  let dismissedSelectionKey: string | null = null;
  const selectionKeyOf = (sel: { mapId: string; x: number; y: number; width: number; height: number } | null): string | null =>
    sel ? `${sel.mapId}:${sel.x}:${sel.y}:${sel.width}:${sel.height}` : null;
  const refreshContextChips = (): void => {
    if (typeof document === "undefined") return; // fakeDom 해제 후 잔존 구독 가드(테스트).
    const state = editorState.get();
    const project = store.getCurrent();
    const currentSelection = state.selection;
    const currentKey = selectionKeyOf(currentSelection);
    const currentMapId = state.currentMapId ?? project.startMapId ?? null;
    const runnableSelectionKey = currentSelection
      && currentMapId === currentSelection.mapId
      && project.maps[currentSelection.mapId]
      ? currentKey
      : null;
    if (activeSelectionRegionKey && activeSelectionRegionKey !== runnableSelectionKey) {
      abortActiveSelectionRegionTask();
    }
    if (currentKey && currentKey !== dismissedSelectionKey) selectionTaskActive = true;
    if (!currentKey) dismissedSelectionKey = null;
    const ctx = mapContext();
    const chips = [el("span", { class: "ai-context-chip", text: ctx.mapName ?? "맵 없음" })];
    const selection = currentSelectionForRegionTask();
    if (selectionTaskActive && !selection) selectionTaskActive = false;
    if (selection) {
      chips.push(renderSelectionTaskChip(selection));
    }
    // idle 상태는 컨텍스트 칩을 숨기지만, 선택 스코프가 붙어 있으면 그 칩만은 보여야 한다 —
    // 안 보이면 사용자는 스코프가 붙는지 모르고 ×도 누를 수 없다(2026-09-03 실측 7건 전부 display:none).
    contextChips.classList.toggle("has-selection-scope", selection !== null);
    contextChips.replaceChildren(...chips);
    syncRailContext();
  };
  refreshContextChips();
  refreshComposerPlaceholder();
  const unsubscribeContextEditor = editorState.subscribe(() => {
    refreshContextChips();
    refreshComposerPlaceholder();
    applyAssistantViewPolicy();
    refreshTemperatureChrome();
    if (studioShell?.attached()) {
      studioShell.refreshScenes();
      studioShell.refreshMonitor();
    }
  });
  const unsubscribeContextStore = store.subscribe(() => {
    refreshContextChips();
    refreshComposerPlaceholder();
    if (studioShell?.attached()) {
      studioShell.refreshScenes();
      studioShell.refreshMonitor();
    }
    // 프로젝트가 바뀌었으면(새 프로젝트 생성·다른 작업 열기·로엄 복원) 대화를 새로 시작한다 —
    // 이전 프로젝트의 계획·제안·맵 좌표는 새 프로젝트에서 전부 무의미하거나 해롭다.
    const identity = store.getProjectIdentity();
    if (identity.id === projectIdentityId) {
      const session = controller.session;
      const owner = activeAbortController;
      if (session && stickyChecklist.hasSnapshot() && !disposed && !owner?.signal.aborted) {
        session.refreshAcceptance(store.getCurrent(), (event) => {
          if (!disposed && controller.session === session && activeAbortController === owner
            && !owner?.signal.aborted && event.type === "acceptance") stickyChecklist.update(event.snapshot);
        });
        stickyChecklist.update(session.getAcceptanceSnapshot());
      }
      if (!turnBusy && !disposed) refreshRunOutcome();
      return;
    }
    stickyChecklist.update(null);
    if (applyingProposal) {
      projectIdentityId = identity.id;
      return;
    }
    // 스토어가 로드 중 여러 번 알리므로 표식을 먼저 갱신해 같은 전환이 여러 번 채택되지 않게 한다.
    projectIdentityId = identity.id;
    closeAiConversationHistoryModal();
    // Settle the outgoing owner before async history loading. A new project's draft may
    // arrive during that lookup and must survive the later chat reset/restore.
    activeAbortController?.abort();
    activeAbortController = null;
    getPendingRegionApply()?.discard();
    void panelPendingWork.track(adoptConversationForCurrentProject());
  });
  const activateSelectionTaskContext = (focus = true): void => {
    if (!editorState.get().selection) return;
    selectionTaskActive = true;
    refreshContextChips();
    if (focus) input.focus();
  };
  const handleSelectionContextEvent = (event: Event): void => {
    const detail = aiSelectionContextDetail(event);
    if (!detail?.selection) {
      clearSelectionTaskContext();
      return;
    }
    activateSelectionTaskContext(detail.focus !== false);
  };
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener(AI_SELECTION_CONTEXT_EVENT, handleSelectionContextEvent);
  }

  // 접기 토글 — 상태는 localStorage에 유지되어 새로고침/모드 전환 후에도 기억된다.
  const collapseButton = el("button", {
    class: "ai-chat-collapse ai-composer-menu-btn",
    attrs: { type: "button", title: "AI 패널 접기", "aria-label": "AI 패널 접기", "aria-expanded": String(!collapsed) },
    dataset: { testid: "ai-collapse" },
  }) as HTMLButtonElement;
  const collapsedRestore = createDirectorRestoreButton();
  // 접힘 상태에서도 되돌리기가 남아야 한다 — 컴포저 행은 접히면 display:none 이다.
  // 클릭을 컴포저 버튼으로 위임해 동작·배지·말풍선이 한 경로만 지나게 한다.
  const collapsedUndo = createCollapsedUndoButton(() => {
    undoAppliedButton.click();
  });
  collapsedRestore.setAttribute("aria-expanded", String(!collapsed));

  // 1차 크롬은 없다 — 얼굴 명패(createDirectorPlate)와 헤더는 폐기됐다.
  const openToolsBrowser = (): void => {
    void openToolBrowserModal();
  };
  const openHarness = (): void => {
    const audit = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    void openHarnessModal({
      audit,
      statusTimeline: controller.statusTimeline,
      getSnapshot: () => controller.session?.getHarnessSnapshot() ?? null,
      // 프론트 액션은 오래된 순서로 온다 — 타임라인 병합이 시각으로 정렬하므로 그대로 넘긴다.
      uiActions: listAiUiEvents(),
      getUsage: () => (sessionMethod("getUsageTotals") ? (controller.session?.getUsageTotals() ?? EMPTY_SESSION_USAGE) : EMPTY_SESSION_USAGE),
      commitIds: extractCommitIdsFromAudit(audit),
      persistence: aiActivityPersistenceState(),
    });
  };
  // testid 호환용 숨은 트리거 (메뉴/테스트가 click 위임).
  const toolsButton = el("button", {
    class: "ai-chat-tools-button",
    text: "도구",
    attrs: { type: "button", hidden: "", "aria-hidden": "true" },
    dataset: { testid: "ai-tools-browser" },
    on: { click: openToolsBrowser },
  });
  const harnessButton = el("button", {
    class: "ai-chat-tools-button",
    text: "진단",
    attrs: { type: "button", hidden: "", "aria-hidden": "true" },
    dataset: { testid: "ai-harness" },
    on: { click: openHarness },
  });
  let applyAssistantViewPolicy: () => void = () => {};
  let syncGlassIdle: () => void = () => {};
  const applyTemperature = (next: AssistantTemperature): void => {
    const from = readTemperature();
    const parsed = parseAssistantTemperature(next);
    if (options.onAssistantTemperatureChange) options.onAssistantTemperatureChange(parsed);
    else {
      editorState.set({ assistantTemperature: parsed });
      persistAssistantTemperature(parsed);
    }
    refreshTemperatureChrome();
    // 같은 지시가 온도에 따라 다르게 끝난다 — 어느 온도로 돌았는지가 사후 재현의 전제다.
    recordAiUiEvent({ surface: "command-menu", action: AI_UI_ACTIONS.temperatureSwitch, detail: { from, to: parsed } });
  };
  // 도크 전환 진입점 5개(`chat-dock-toggle` 숨은 토글 · `ai-dock-mode-btn` 모드 배지 ·
  // `ai-chat-detach` 떼기 · 두 ☰ 메뉴의 「도크 전환」 항목)는 전부 걷었다. 남겨 두면
  // 「입력줄」이라고만 적힌 채 눌러도 토스트만 뜨는 노드가 되어, 있지도 않은 선택지를
  // 광고한다. 대신 `panel.dataset.chatDock` 은 `"float"` 로 고정 노출한다 — 레이아웃
  // 테스트가 "어디에 붙었나"를 읽는 단일 창구다.
  // z-layers: panel 30 / bar 40 / overlay 41 / palette 80 — 56/50/62 난장 정리
  const exportAudit = (): void => {
    openLocalDiagnosticsDialog();
  };
  exportButton = el("button", {
    class: "ai-assistant-action ai-export-button",
    text: "내보내기",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "로컬 진단 보고서", "aria-label": "로컬 진단 보고서" },
    dataset: { testid: "ai-export" },
    on: { click: exportAudit },
  }) as HTMLButtonElement;
  refreshExportButton();
  const undoLastButton = el("button", {
    class: "ai-assistant-action ai-undo-last",
    text: "되돌리기",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "직전 변경 되돌리기(Ctrl+Z)" },
    dataset: { testid: "ai-undo-last" },
    on: {
      click: () => {
        if (!undoMapEdit()) return;
        const reverted = getLastAppliedProposalMessage();
        if (reverted) {
          appendBubble("system", `제안 ${reverted.calls.length}건(${reverted.summary})을 되돌렸습니다.`);
          setAssistantMessageBadge(reverted.assistantBubble, "reverted");
          setLastAppliedProposalMessage(null);
        }
        toast("되돌렸습니다", "ok");
      },
    },
  }) as HTMLButtonElement;
  const refreshUndoLastButton = (): void => {
    const canUndo = getMapEditHistoryState().canUndo;
    undoLastButton.disabled = !canUndo;
    undoLastButton.setAttribute("aria-disabled", String(!canUndo));
  };
  refreshUndoLastButton();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoLastButton);

  // 적용 직후 되돌리기 — 컴포저 액션 행에 사는 유일한 상시 표면. 맵 위 `ai-completion-strip`
  // 밴드를 대체한다(2026-08-30). 밴드가 하던 두 일 중 요약은 변경 카드 제목이 이미 같은
  // 문장(proposalHumanSummaryLine)으로 들고 있어 중복이었고, 남은 하나가 이 버튼이다.
  // 동작은 ☰ 메뉴·숨은 툴바 훅과 같은 `undoLastButton` 으로 위임한다 — 되돌리기 경로가
  // 갈라지면 배지("되돌림")와 시스템 말풍선이 진입점마다 달라진다.
  let appliedCompletion: AiApplyCompletionContext | null = null;
  const undoAppliedButton = el("button", {
    class: "ai-composer-undo",
    text: "되돌리기",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "방금 적용한 AI 변경 되돌리기" },
    dataset: { testid: "ai-composer-undo" },
    on: {
      click: () => {
        const context = appliedCompletion;
        if (!context || !completionUndoIsCurrent(context)) {
          refreshUndoApplied();
          return;
        }
        undoLastButton.click();
        clearAiApplyCompletion(context);
      },
    },
  }) as HTMLButtonElement;
  // 되돌릴 수 있을 때만 존재한다 — 히스토리 top 이 AI 체크포인트가 아니게 되면(사용자가
  // 직접 편집했거나 이미 되돌렸다) 누를 수 없는 버튼을 남기지 않고 행에서 빼 버린다.
  const refreshUndoApplied = (): void => {
    const context = appliedCompletion;
    const active = Boolean(context && completionUndoIsCurrent(context));
    undoAppliedButton.hidden = !active;
    undoAppliedButton.setAttribute("aria-hidden", String(!active));
    // 접힌 레일 쪽 진입점도 같은 신호로 여닫는다. 둘이 갈라지면 접었을 때만 되돌리기가
    // 남아 있는(또는 사라지는) 어긋난 상태가 된다.
    collapsedUndo.hidden = !active;
    collapsedUndo.setAttribute("aria-hidden", String(!active));
    if (active && context) {
      const label = `방금 적용한 변경 되돌리기 — ${context.summary}`;
      undoAppliedButton.setAttribute("title", label);
      collapsedUndo.setAttribute("title", label);
    }
  };
  refreshUndoApplied(); // 부트 직후는 되돌릴 AI 변경이 없다 — 속성과 프로퍼티를 함께 맞춘다.
  let studio = typeof localStorage !== "undefined" && localStorage.getItem(STUDIO_MODE_KEY) === "1";
  let historyOpen = false;
  let applyHistoryOpen: (next: boolean) => void = () => {};
  let applyStudio: (next: boolean) => void = () => {};
  const studioButton = el("button", {
    class: "ai-chat-tools-button",
    text: "스튜디오",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "AI 스튜디오", "aria-label": "AI 스튜디오 펼치기" },
    dataset: { testid: "ai-studio-toggle" },
  });
  const historyButton = el("button", {
    class: "ai-chat-tools-button",
    text: "기록",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "전체 기록", "aria-label": "전체 기록 열기" },
    dataset: { testid: "ai-dock-toggle" },
  });
  const newSessionButton = el("button", {
    class: "ai-chat-icon-btn ai-new-session",
    children: [deckIcon("plus")],
    attrs: {
      type: "button",
      title: "새 대화",
      "aria-label": "새 대화 시작",
    },
    dataset: { testid: "ai-new-session" },
    on: { click: () => startNewConversation("manual") },
  });
  abortButton = el("button", {
    class: "ai-assistant-action ai-abort-button",
    attrs: { type: "button", title: "멈추기 (Esc) — 진행 중인 AI 응답을 중단합니다", "aria-label": "AI 응답 중단" },
    children: [deckIcon("stop")],
    dataset: { testid: "ai-abort" },
    on: { click: abortActiveTurn },
  }) as HTMLButtonElement;
  abortButton.hidden = true;
  abortButton.disabled = true;
  abortButton.setAttribute("aria-disabled", "true");
  // 중단 버튼은 액션 행에서 전송 버튼과 자리를 나눠 쓴다(refreshAbortButton) —
  // 상태 그룹에 함께 두면 전송·중단 두 슬래브가 동시에 서 있었다.
  const statusGroup = el("div", {
    class: "ai-status-group",
    dataset: { testid: "ai-status-group" },
    children: [status],
  });
  const fontButton = el("button", {
    class: "ai-chat-tools-button",
    text: "글자 크기",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "글자 크기 전환", "aria-label": "글자 크기 전환" },
    dataset: { testid: "ai-font-cycle" },
    on: {
      click: () => {
        const order: AiFontSize[] = ["small", "normal", "large"];
        const next = order[(order.indexOf(loadAiFontSize()) + 1) % order.length] ?? "normal";
        saveAiFontSize(next);
        applyPanelFontSize(next);
      },
    },
  });

  // 헤더 햄버거 메뉴 (2차 액션 통합).
  const moreMenu = el("div", {
    class: "ai-more-menu",
    attrs: { role: "menu", hidden: "" },
    dataset: { testid: "ai-more-menu" },
  });
  // (구 `refreshMoreMenuDockLabel` + `moreMenuDockItem`/`commandDockItem` 삭제 — 두 ☰ 메뉴의
  //  「도크 전환」 항목 텍스트를 현재 도크에 맞춰 매번 갈아 끼우던 함수와 그 핸들이다.
  //  항목 자체가 없어졌다.)
  const closeMoreMenu = (): void => {
    moreMenu.hidden = true;
    moreMenuToggle.setAttribute("aria-expanded", "false");
  };
  const positionMoreMenu = (): void => {
    const anchor = moreMenuToggle.getBoundingClientRect();
    const width = moreMenu.offsetWidth || 228;
    const height = moreMenu.offsetHeight || 180;
    const viewport = {
      width: typeof window === "undefined" ? 1280 : window.innerWidth,
      height: typeof window === "undefined" ? 800 : window.innerHeight,
    };
    const position = anchoredPopupPosition(anchor, { width, height }, viewport);
    moreMenu.classList.add("is-viewport-anchored");
    moreMenu.style.left = `${position.left}px`;
    moreMenu.style.top = `${position.top}px`;
  };
  const moreMenuToggle = el("button", {
    class: "ai-chat-icon-btn",
    children: [deckIcon("more")],
    attrs: { type: "button", title: "더보기", "aria-label": "더보기 메뉴", "aria-expanded": "false", "aria-haspopup": "menu" },
    dataset: { testid: "ai-more-menu-toggle" },
    on: {
      click: () => {
        const open = moreMenu.hidden;
        moreMenu.hidden = !open;
        moreMenuToggle.setAttribute("aria-expanded", String(open));
        if (open) {
          refreshTemperatureChrome();
          positionMoreMenu();
        }
      },
    },
  }) as HTMLButtonElement;
  const onMoreMenuPointerDown = (event: PointerEvent): void => {
    if (moreMenu.hidden) return;
    if (event.target instanceof Node && (moreMenu.contains(event.target) || moreMenuToggle.contains(event.target))) return;
    closeMoreMenu();
  };
  const onMoreMenuKeyDown = (event: KeyboardEvent): void => {
    if (!moreMenu.hidden && event.key === "Escape") closeMoreMenu();
  };
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("pointerdown", onMoreMenuPointerDown);
    document.addEventListener("keydown", onMoreMenuKeyDown);
  }
  // 두 메뉴가 공유하는 항목의 유일한 구현(aiActionMenu.ts). 컨테이너·열림 상태만 표면마다 다르다.
  const sharedMenuActions: AiActionMenuActions = {
    showAcceptanceChecklist: () => stickyChecklist.show(),
    refreshWiki: () => {
      if (turnBusy) { toast("현재 작업이 끝난 뒤 기록을 정리해주세요.", "info"); return; }
      retireMaintenance();
      const operation = new RunOperation();
      maintenance = operation;
      const session = controller.session;
      const owns = () => !disposed && maintenance === operation && controller.session === session;
      const coordinator = createProjectWikiCoordinator({
        getConfig: () => resolveSurfaceAiConfig("chat"), status: (text) => { if (owns()) setStatus(text); },
      });
      void panelPendingWork.track(coordinator.backfill(operation.signal).then((count) => {
        if (!owns()) return;
        session?.syncBaselineFromStoreIfClean(store.getCurrent());
        appendBubble("system", `이 프로젝트의 이전 대화에서 설정집 문서 ${count}개를 정리했습니다.`);
        setStatus("기록 정리 완료");
      }, (cause: unknown) => {
        if (!owns()) { console.warn("[projectWiki] Retired maintenance settled", cause); return; }
        const message = cause instanceof Error ? cause.message : String(cause);
        appendBubble("system", `설정집 정리를 완료하지 못했습니다: ${message}`);
        setStatus("기록 정리 실패");
      }).finally(() => { if (owns()) retireMaintenance(); }));
    },
    openSettings: () => openAiSettings("first"),
    exportAudit,
    downloadUsageLog: () => {
      downloadAiUsageLogText();
    },
    openHistory: () => {
      historyButton.click();
    },
    openTools: () => toolsButton.click(),
    openInstructions: () => {
      openAiInstructionsModal({
        // 진행 중인 세션의 시스템 프롬프트를 그 자리에서 갈아끼운다 — 저장했는데 다음 대화까지
        // 기다려야 적용되는 지침은 "항상 주는 규칙" 이라고 할 수 없다.
        onSaved: () => controller.session?.refreshProjectContext(store.getCurrent()),
      });
    },
    compactContext: () => {
      void compactContextNow();
    },
  };
  // 더보기: 일상 액션 + 설정. 스튜디오·하네스·글자 크기는 숨은 툴바 훅으로 유지(고급).
  const headerMenu = createAiActionMenuItems({
    variant: "header",
    close: closeMoreMenu,
    actions: sharedMenuActions,
  });
  const headerTemperatureSection = createAssistantTemperatureMenuSection({
    variant: "header",
    current: readTemperature,
    close: closeMoreMenu,
    onChange: applyTemperature,
  });
  // after.html: 헤더 ☰ 는 대기 화면 3줄을 먼저 보인다. 되돌리기·도크 등은 작업 접기 안에 둔다.
  const headerActionsFold = el("details", {
    class: "ai-more-actions",
    dataset: { testid: "ai-more-actions" },
    children: [
      el("summary", {
        class: "ai-more-actions-summary",
        text: "작업",
        attrs: { title: "되돌리기·내보내기·기록·툴" },
      }),
      ...headerMenu.items,
    ],
  });

  moreMenu.replaceChildren(headerTemperatureSection, headerActionsFold);
  const moreWrap = el("div", {
    class: "ai-more-wrap",
    children: [moreMenuToggle, moreMenu],
  });

  // 헤더는 없다 (2026-08-28 감독 지시). `.ai-chat-header` 밴드와 그 안의 얼굴 명패를
  // 통째로 걷었다 — 실측 518×73px 이 담고 있던 실기능은 ☰ 와 ▾ 뿐이었다.
  // 남은 버튼들은 아래 숨은 훅 컨테이너(`ai-chat-toolbar`)로 옮긴다. 화면에는 없고
  // (hidden + inert + display:none) 접기 상태 기계와 테스트 계약만 살아 있다.
  // "죽은 버튼" 이 아니다 — 여기 담긴 것들은 테스트가 직접 참조하거나(ai-tools-browser ·
  // ai-studio-toggle · ai-dock-toggle · ai-export · ai-undo-last · ai-harness · ai-font-cycle)
  // ☰ 메뉴 항목이 이 버튼의 click() 을 눌러 동작한다. 지우려면 테스트 계약부터 옮겨야 한다.
  // 2026-08-31 에 도크 3종(chat-dock-toggle · ai-dock-mode-btn · ai-chat-detach)은 빠졌다 —
  // 세 개 모두 도크 축이 없어진 뒤로는 누를 곳이 아니라 광고판이었다.
  const toolbar = el("div", {
    class: "ai-chat-toolbar is-empty",
    dataset: { testid: "ai-chat-toolbar" },
    attrs: { hidden: "" },
    children: [
      toolsButton, harnessButton, studioButton, historyButton, exportButton, undoLastButton, fontButton,
      // 구 헤더 잔류물. 접기 버튼은 실제 컴포저 액션 행으로 이동했고, 나머지는
      // 화면에서는 사라졌지만 테스트와 메뉴 위임용 훅으로 남는다.
      newSessionButton, moreWrap,
    ],
  });
  toolbar.inert = true;

  // "AI 가 기억한 내 성향" — 컴포저 ⌾ 버튼이 여는 팝오버의 내용.
  // 스코프를 **함수로** 넘긴다. `conversationScope` 는 '새 대화'·프로젝트 전환에서 재대입되는
  // let 이라, 값으로 굳히면 프로젝트를 바꾼 뒤에도 이전 프로젝트 성향이 목록에 남는다.
  const preferenceMemory = renderPreferenceMemorySettings({
    projectScopeKey: () => conversationScope,
  });

  // 맥락 게이지: 숫자는 전부 세션이 계산한다(자동 압축 임계와 동일 입력). 세션이 아직 없으면
  // usage 는 null 이고 게이지는 "맥락 —" 으로 남는다.
  contextMeter = createAiContextMeter({
    read: readContextSnapshot,
    onCompact: () => {
      void compactContextNow();
    },
    onUndoCompaction: undoContextCompaction,
    onToggle: () => {
      openComposerPopover?.(composerPopoverKind?.() === "context" ? null : "context");
      contextMeter?.refresh();
    },
  });

  // 하단 컴포저: 입력 + 고정 액션 행 한 줄(세로 레일 없음).
  // 추천 칩·액션 메뉴·성향은 흐름 밖 팝오버 — 바 높이는 입력 줄 수만 따른다.
  let deckRoot: HTMLElement | null = null;
  // 모델 칩(제안서 D4): 초보 모드에서는 숨기고 표준·전문가에서 현재 모델 id 를 보인다.
  // 다이얼 명시 시 레벨 라벨을 함께 싣는다(읽기 전용 표시 — 동작은 세션 배선이 정한다).
  const modelChipLabel = (): string | null => {
    if (getEditorUiMode() === "beginner") return null;
    const config = loadAiConfig();
    const model = config.model.trim();
    if (model.length === 0) return null;
    const level = AUTONOMY_LEVELS.find((entry) => entry.id === config.autonomyLevel);
    return level ? `${model} · ${level.label}` : model;
  };
  // 지시줄 effort 셀렉트(자율성·추론 강도) — 설정 모달을 열지 않고 바로 고른다.
  // 자율성은 resolveAutonomy 프리셋으로 추론·작업모드까지 함께 저장한다(설정 모달 다이얼과 같은 동작).
  // 추론 강도는 수동값 그대로 저장하고, 세션도 그 값을 쓴다(다이얼 덮어쓰기 없음 — phaseConfig 주석 참조).
  const applyComposerEffortConfig = (next: AiConfig): void => {
    saveAiConfig(next);
    controller.session?.updateConfig(next);
    composerShell.setModelLabel(modelChipLabel());
  };
  const effortInitial = loadAiConfig();
  const initialAutonomy: AutonomyLevel = isAutonomyLevel(effortInitial.autonomyLevel)
    ? effortInitial.autonomyLevel
    : "balanced";
  const composerShell: ComposerElements = createComposerElements({
    input,
    collapseButton,
    sendButton,
    abortButton,
    undoAppliedButton,
    contextChips,
    composerChips: el("div"),
    nextSteps: el("div"),
    queueIndicator,
    statusGroup,
    contextMeterButton: contextMeter.button,
    contextMeterPopover: contextMeter.popover,
    onNewChat: () => startNewConversation("manual"),
    onOpenConversations: () => openConversationHistory(),
    onPopoverChange: () => syncCommandBarClearance(),
    preferenceContent: preferenceMemory.element,
    // 대화 중 증류가 목록을 바꾼다 — 열 때마다 다시 읽어야 방금 배운 성향이 보인다.
    onPreferenceOpen: () => preferenceMemory.refresh(),
    // 바깥 클릭 판정은 데크 전체 — 레일의 ⋯ 가 바 밖에 있다(데크 조립 전엔 바 기준).
    isInside: (target) => (deckRoot ?? composerShell.commandBar).contains(target),
    routeChips: {
      initial: loadAiConfig().executionRoute ?? DEFAULT_EXECUTION_ROUTE,
      onChange: (route) => {
        saveAiConfig({ ...loadAiConfig(), executionRoute: route });
        setStatus(`지시 경로: ${EXECUTION_ROUTE_LABEL[route]}`);
      },
    },
    effortChips: {
      initialAutonomy,
      onAutonomyChange: (level) => {
        const resolved = resolveAutonomy(level);
        applyComposerEffortConfig({
          ...loadAiConfig(),
          autonomyLevel: level,
          reasoningEffort: resolved.reasoningEffort,
          agentMode: resolved.agentMode,
        });
        composerShell.syncEffort(level);
      },
    },
    modelLabel: modelChipLabel(),
  });
  const commandBar = composerShell.commandBar;
  const commandMenu = composerShell.commandMenu;
  openComposerPopover = composerShell.openPopover;
  composerPopoverKind = composerShell.openKind;
  const stickyProposalZone = el("div", {
    class: "ai-rising-sticky-zone",
    dataset: { testid: "ai-rising-sticky-zone" },
    // 0건 알림을 맵 위에서 잃지 않는 고정 영역. 적용 완료 스트립(`ai-completion-host`)은
    // 여기 살았지만 2026-08-30 에 걷었다 — 요약은 변경 카드가, 되돌리기는 컴포저 액션
    // 행의 `ai-composer-undo` 가 맡는다(맵 위 떠 있는 밴드는 팔레트도 어긋났다).
    children: [proposalNoticeHost],
  });
  // `.ai-rising-overlay` + 그 안의 휘발 로그 존은 사이드 도크에서만 마운트되던 표면이다.
  // 도크가 하나가 되면서 마운트 조건이 영구히 거짓이 되어 통째로 걷었다. 완료 스트립과
  // 0건 알림은 원래도 여기 두면 안 됐고(스티키 존), 지금도 패널 직속 자식이다.
  const historyLogMount = el("div", { class: "ai-history-log-mount" });
  // AI 표면은 기본/전문가 공통 — expert-only board 없음. 시작 화면·스킬·기록이 동일.
  const glassLogMount = el("div", {
    class: "ai-glass-log",
    dataset: { testid: "ai-glass-log" },
    // 로그의 최초 부모. 예전에는 휘발 존이 들고 있다가 mountLog 가 즉시 옮겨 왔다.
    children: [log],
  });
  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [glassLogMount, historyLogMount],
  });
  const body = el("div", {
    class: "ai-chat-body",
    dataset: { testid: "ai-chat-body" },
    children: [mainColumn],
  });
  const setLogFontSize = (delta: number): void => {
    const next = stepAiFontSize(loadAiFontSize(), delta);
    saveAiFontSize(next);
    applyPanelFontSize(next);
  };
  // 기록 줌 스테퍼(− 100% +)는 데크에서 걷었다(제안서 §01-4). 글자 크기는 설정 모달과 Ctrl+휠.
  body.addEventListener("wheel", (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setLogFontSize(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });

  // ── 데크: 레일 → 기록 → 컴포저를 한 유리 표면에 담는다(제안서 A, D1) ──
  const rail = createDeckRail();
  // 레일 아이콘 슬롯 — 컴포저가 만든 버튼을 옮긴다(두 벌 금지). 순서: 맥락 % · 새 대화 · 이전 대화 · 성향 · 더보기 · 접기.
  rail.actions.append(
    contextMeter.button,
    composerShell.newChatButton,
    ...(composerShell.conversationsButton ? [composerShell.conversationsButton] : []),
    ...(composerShell.preferenceToggle ? [composerShell.preferenceToggle] : []),
    composerShell.menuToggle,
    collapseButton,
  );
  // 상태 문장은 레일이 든다 — 컴포저 행의 상태 그룹은 멈추기 버튼 자리만 남는다.
  rail.statusSlot.append(status);
  // ⋯ 메뉴·성향·맥락 팝오버는 토글이 있는 레일 아래 오른쪽에 붙는다 — 열림/닫힘 기계는 컴포저 것 그대로.
  // 컴포저 위로 띄우면 기록과 레일을 덮어 토글 자신이 가려진다(실측 2026-09-03).
  rail.root.append(commandMenu, composerShell.preferencePopover, contextMeter.popover);
  // 팀 패널: 레일 아래 접힌 막대. 유휴 상태(본문 숨김)에서도 「누가 무엇을 하는지」 한 줄이 보인다.
  const teamPanel = createTeamPanel();
  const deck = el("div", {
    class: "ai-deck",
    dataset: { testid: "ai-deck" },
    children: [rail.root, teamPanel.root, body, outcomeSlot, commandBar],
  });
  deckRoot = deck;

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "조수" },
    dataset: {
      testid: "ai-panel",
      uiDensity: "shared",
      chatDock: "float",
      temperature: readTemperature(),
      aiConversation: "empty",
    },
    children: [toolbar, deck, collapsedRestore, collapsedUndo, stickyProposalZone],
  });
  teamPanel.onToggle((open) => panel.classList.toggle("is-team-open", open));
  panelRoot = panel;
  // 오버레이가 컴포저를 덮지 않도록 "바 + 열린 팝오버"의 최상단까지를 실측해 CSS 변수로 흘린다.
  // (bottom 76px 고정은 칩 행 + 여러 줄 입력으로 커진 바를 덮었다 — H01 실측.)
  // 하단 여백(--ai-command-bar-inset)도 같은 실측에서 나온다 — 144px 하드코딩은 실제
  // 바 높이와 어긋나 있었고, 두 값이 서로 다른 소스를 보면 반드시 갈라진다.
  // 데크가 표면 하나이므로 clearance 도 데크 사각형 하나에서 나온다(열린 팝오버 포함).
  syncCommandBarClearance = (): void => {
    const rect = deck.getBoundingClientRect();
    if (rect.height <= 0 || typeof window === "undefined") return;
    const top = Math.min(rect.top, composerShell.measuredTop());
    const clearance = Math.max(60, Math.ceil(window.innerHeight - top) + 12);
    panel.style.setProperty("--ai-command-bar-clearance", `${clearance}px`);
    document.body?.style.setProperty("--ai-command-bar-inset", `${Math.max(72, Math.ceil(rect.height) + 24)}px`);
  };
  const commandBarClearanceObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncCommandBarClearance) : null;
  commandBarClearanceObserver?.observe(deck);
  // 저장된 글자 크기를 부팅 시 즉시 적용(영속 — V3C).
  applyAiFontSize(panel, loadAiFontSize());
  applyAiBackgroundOpacity(panel, loadAiBackgroundOpacity());
  // 헤드리스/콘솔 디버깅용 하네스 접근점: window.__oprnAiHarness() → 주입 포함 원본 메시지 + 감사 로그.
  const harnessAccessor = () => controller.session?.getHarnessSnapshot() ?? null;
  if (typeof window !== "undefined") {
    window.__oprnAiHarness = harnessAccessor;
  }

  // 크기 소유자는 하나다: 컴포저 캡슐(commandBar)의 폭. 예전에는 glass=카드(폭+높이),
  // side=에디터 셸 컬럼, float=캡슐 3가지를 도크별 localStorage 키로 따로 들고 있었고
  // 리사이즈 핸들의 방향·앵커·aria 도 도크마다 갈렸다.
  const resizableDock = (): boolean =>
    !panel.classList.contains("is-studio")
    && !panel.classList.contains("is-docked")
    && !collapsed;
  // 크기 조절 크롬은 aiChatResizeChrome.ts 가 갖는다. 패널은 상태 세 질문만 넘긴다 —
  // 접힘·유리 접힘 같은 가변 플래그는 여기 `let` 이 계속 소유하므로 게터로 준다.
  const resizeChrome = createChatResizeChrome({
    panel,
    deck,
    resizable: resizableDock,
  });
  const applySize = resizeChrome.applySize;
  const mountResizeHandle = resizeChrome.mountHandle;

  /**
   * 로그 배치의 **단일 상태 함수**. (도크 × 기록/스튜디오) → 슬롯 하나.
   *
   * 예전에는 같은 `log` 엘리먼트를 `applyComposerViewPolicy`·`applyHistoryOpen`·`applyStudio`
   * 세 곳에서 제각 `remove()` + `append()` 로 재부모화해서, 어떤 상태에서 로그가 어떤
   * 마운트에 사는지를 코드만 보고는 알 수 없었다 — 기록을 닫으면 혼발 존에 넣었다가
   * 바로 뒤이어 도크 정책이 다시 유리 마운트로 집어오는 식이었다. 이제 배치는 이 둠만 정한다.
   *
   * 슬롯은 `panel.dataset.logSlot` 으로 노출한다 — 부모 체인을 뒤지지 않고 현재 배치를
   * 읽을 수 있게 하는 단일 지표다.
   */
  const mountLog = (): void => {
    // 슬롯은 둘이다: 기록/스튜디오가 열려 있으면 기록 마운트, 아니면 유리 마운트.
    // (도크 × 기록/스튜디오 3×2 표가 이 한 줄로 줄었다. "volatile" 슬롯은 사이드
    // 도크와 함께 사라졌다.)
    const slot = historyOpen || studio ? "history" : "glass";
    const target = slot === "history" ? historyLogMount : glassLogMount;
    panel.dataset.logSlot = slot;
    if (log.parentElement === target) return;
    log.remove();
    target.append(log);
  };
  /**
   * 조수가 **일하는 중이거나 사용자의 결정을 기다리는 중**인가 — 유휴 판정의 단일 소스.
   *
   * 왜 한 곳에 모으는가 (실측 결함): 유휴 접힘(GLASS_FOLD_IDLE_MS)과 유휴 레이아웃
   * (is-glass-idle)이 각자 "바쁨"을 따로 세고 있었고, 둘 다 진행 중인 **턴**만 봤다. 그래서
   * 턴이 끝난 뒤 8초가 지나면, 결정을 기다리는 제안 카드가 붙어 있든 대기 큐에 다음 지시가
   * 남아 있든 자율 런 표면이 살아 있든 상관없이 본문이 접혔다 — 사용자에게는 "작동 중인데
   * 닫혔다" 로 보인다. 접힘은 대화 본문(.ai-chat-body)을 통째로 접으므로 그 안에 있는 제안
   * 카드·런 체크리스트가 함께 사라진다.
   *
   * 위치: `panel` 이 만들어진 **뒤**에 둔다. 위쪽(런 표면 선언부)에 두면 조립 중 어떤 경로가
   * 이 함수를 부르는 순간 `const panel` 의 TDZ 를 읽어 ReferenceError 로 패널 전체가 죽는다 —
   * 지금 호출자는 아래 두 곳(syncGlassIdle·canScheduleGlassFold)뿐이지만, 그 사실에 기대는
   * 대신 선언 순서로 못 박는다.
   */
  const assistantEngaged = (): boolean =>
    turnBusy
    || runningProgress !== null
    || panel.classList.contains("is-turn-running")
    || compacting
    || workPlanSurfaceState?.active === true
    || pendingSends.length > 0
    || applyingProposal
    || proposalApi.pendingProposalMessage !== null
    || hasPendingQuestion();
  const syncComposerFocus = (): void => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    panel.classList.toggle("is-composer-focused", Boolean(active && commandBar.contains(active)));
  };
  syncGlassIdle = (): void => {
    const busy = assistantEngaged()
      || Boolean(log.querySelector("[data-testid=ai-command-row-assistant]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-user]"))
      || log.childElementCount > 0;
    const idle = !busy;
    // `is-glass-idle`(glass 전용)과 `is-map-first-idle`(dock !== "float" 조건)은 둘 다
    // float 단일 도크에서 절대 참이 될 수 없어 삭제했다. 남는 축은 하나다.
    // 유휴·빈 대화는 입력줄을 좁히고, 턴·대화가 있으면 로그 카드를 펼친다.
    panel.classList.toggle("is-assistant-idle", idle);
    panel.classList.toggle("is-assistant-log-open", !idle);
    syncComposerFocus();
    syncConversationState();
    syncDeckState();
  };
  // 데크 상태 하나가 레일 점·문장, 패널 data-ai-state, 접힘 알약을 함께 움직인다(제안서 P4).
  // 「확인 필요」 는 상태 배지 톤이 아니라 승인 대기·질문 대기·접힘 중 알림 점에서 나온다.
  syncDeckState = (): void => {
    const pendingApproval = proposalApi.pendingProposalMessage !== null || hasPendingQuestion();
    const attention = pendingApproval || panel.classList.contains("is-turn-attention");
    const state: DeckState = panel.classList.contains("is-turn-error")
      ? "error"
      : attention
        ? "attention"
        : deckStateOfTone(statusToneOf(status.textContent ?? ""));
    rail.setState(state);
    panel.dataset.aiState = state;
    setRestoreButtonState(collapsedRestore, state, status.textContent ?? "", pendingApproval ? 1 : 0);
  };
  syncRailContext = (): void => {
    rail.setContext(mapContext().mapName);
  };
  syncRailContext();
  syncDeckState();
  refreshTemperatureChrome = (): void => {
    const current = readTemperature();
    panel.dataset.temperature = current;
    for (const button of panel.querySelectorAll<HTMLElement>(".ai-temperature-option")) {
      button.setAttribute("aria-checked", button.dataset.temperature === current ? "true" : "false");
    }
    syncGlassIdle();
  };
  const applyComposerViewPolicy = (): void => {
    if (!historyOpen && !studio) removeStartScreen();
    mountLog();
    syncConversationState();
  };

  // 셰브론이 여닫는 것은 하나다: 패널 전체(칩 접힘). glass 도크의 본문 접힘(fold)이
  // 두 번째 축이었고 함께 사라졌다.
  const syncCollapseButtonChrome = (): void => {
    const shut = collapsed;
    const label = shut ? "AI 패널 펼치기" : "AI 패널 접기";
    collapseButton.replaceChildren(deckIcon(shut ? "chevron-right" : "chevron-down"));
    collapseButton.setAttribute("title", label);
    collapseButton.setAttribute("aria-label", label);
    collapseButton.setAttribute("aria-expanded", String(!shut));
  };
  const applyCollapsed = (): void => {
    if (collapsed) panel.classList.add("is-collapsed");
    else {
      panel.classList.remove("is-collapsed");
      // 접힌 동안 쌓인 알림 점(완료/오류)은 펼치는 순간 확인한 것으로 보고 지운다.
      panel.classList.remove("is-turn-attention", "is-turn-error");
    }
    syncCollapseButtonChrome();
    collapsedRestore.setAttribute("aria-expanded", String(!collapsed));
    if (typeof document !== "undefined" && document.body) document.body.classList.add("ai-command-bar-active");
    applySize(); // 접힘 상태에서는 커스텀 크기를 해제한다.
    syncDeckState();
  };
  clearAutoCollapseTimer = (): void => {
    if (autoCollapseTimer !== null && typeof window !== "undefined") window.clearTimeout(autoCollapseTimer);
    autoCollapseTimer = null;
  };
  // 접힌 패널을 AI 작업용으로 펼친다. 이미 열려 있으면 폭만 유지하고 종료 후 재접기 플래그는 유지.
  // 자동 경로 — 사용자의 저장된 접힘 선택(savePanelCollapsed)은 건드리지 않는다.
  expandForAiWork = (): void => {
    clearAutoCollapseTimer();
    if (!collapsed) return;
    collapsed = false;
    if (studio) applyStudio(false);
    applyCollapsed();
  };
  // 턴이 끝나면 조수를 열어 둔다. 예전에는 유리/입력줄이 0ms 로 다시 접혀
  // 답장이 48px 얼굴 뒤로 사라졌다. 접기는 접기 버튼만.
  scheduleCollapseAfterAiWork = (): void => {
    clearAutoCollapseTimer();
    collapseAfterAiWork = false;
  };
  const toggleCollapsed = (): void => {
    clearAutoCollapseTimer();
    collapsed = !collapsed;
    // 수동으로 접으면 예약 취소. 수동으로 펼치면 다음 AI 턴 전까지는 연 상태 유지.
    collapseAfterAiWork = false;
    if (collapsed && studio) applyStudio(false); // 접으면 스튜디오도 해제.
    if (collapsed && historyOpen) applyHistoryOpen(false);
    savePanelCollapsed(collapsed);
    applyCollapsed();
    // 턴 중에 접혔는지가 「답장이 안 보였다」류 신고의 갈림길이다.
    recordAiUiEvent({ surface: "panel", action: AI_UI_ACTIONS.panelCollapse, detail: { collapsed, turnBusy, via: "toggle" } });
  };
  const restoreCollapsed = (): void => {
    // 공개 진입점("조수 열기" · openAiAssistantPanel · 브리지 open)이 여기로 온다.
    if (!collapsed) return;
    clearAutoCollapseTimer();
    collapsed = false;
    collapseAfterAiWork = false; // 레일 클릭으로 연 직후 타이머에 다시 접히지 않게
    savePanelCollapsed(false);
    applyCollapsed();
    recordAiUiEvent({ surface: "panel", action: AI_UI_ACTIONS.panelCollapse, detail: { collapsed: false, turnBusy, via: "rail" } });
  };
  collapseButton.addEventListener("click", toggleCollapsed);
  collapsedRestore.addEventListener("click", restoreCollapsed);
  commandBar.addEventListener("focusin", syncGlassIdle);
  commandBar.addEventListener("focusout", () => {
    // focusout 은 다음 포커스보다 먼저 난다 — 같은 틱의 새 activeElement 를 읽게 미룬다.
    queueMicrotask(syncGlassIdle);
  });
  // pointerenter/leave + keydown·input·focusin·wheel·scroll 5종 리스너는 유휴 자동
  // 접힘 타이머를 다시 세기 위한 배선이었다. 타이머가 사라져 리스너도 사라진다.
  applyCollapsed();
  refreshSendEnabled(); // 부트 직후도 보낼 게 없으므로 전송은 비활성에서 시작해야 한다.

  // 적용 결과 스토어는 이제 컴포저의 되돌리기 버튼 하나만 구동한다(맵 위 밴드 없음).
  // 히스토리 이벤트도 같이 듣는다 — 사용자가 직접 편집하면 AI 체크포인트가 top 에서
  // 밀리므로 그 순간 버튼이 사라져야 한다(`completionUndoIsCurrent`).
  const renderCompletion = (context: AiApplyCompletionContext | null): void => {
    appliedCompletion = disposed ? null : context;
    refreshUndoApplied();
  };
  const unsubscribeCompletion = subscribeAiApplyCompletion(renderCompletion);
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoApplied);

  applyHistoryOpen = (next: boolean): void => {
    historyOpen = next;
    headerMenu.setHistoryOpen(next);
    composerMenu.setHistoryOpen(next);
    if (historyOpen) {
      panel.classList.add("is-history-open");
      panel.classList.add("is-docked");
      historyButton.replaceChildren(deckIcon("x"));
      historyButton.setAttribute("title", "전체 기록 닫기");
      historyButton.setAttribute("aria-label", "전체 기록 닫기");
    } else {
      panel.classList.remove("is-history-open", "is-docked");
      historyButton.replaceChildren(deckIcon("clock"));
      historyButton.setAttribute("title", "전체 기록 열기");
      historyButton.setAttribute("aria-label", "전체 기록 열기");
    }
    if (typeof document !== "undefined" && document.body) {
      // fixed 오버레이 inset 도킹 body 클래스는 쓰지 않는다(이중 패딩 흔들림).
      document.body.classList.remove("ai-panel-docked");
      document.body.classList.add("ai-command-bar-active");
    }
    applySize();
    applyComposerViewPolicy();
  };
  historyButton.addEventListener("click", () => applyHistoryOpen(!historyOpen));

  // 스튜디오 모드: 타일 에디터를 덮는 장면|모니터|채팅+덱 셸. 기본 입력줄 캡슐은 그대로 둔다.
  applyStudio = (next: boolean): void => {
    studio = next;
    if (typeof localStorage !== "undefined") localStorage.setItem(STUDIO_MODE_KEY, studio ? "1" : "0");
    if (studio) {
      clearAutoCollapseTimer();
      if (collapsed) {
        collapsed = false;
        collapseAfterAiWork = false; // 스튜디오 진입은 사용자 의도 — 자동 재접기 안 함
        savePanelCollapsed(false);
        applyCollapsed();
      }
      panel.classList.add("is-studio");
      applySize(); // 크기만 해제하고 배경 농도·글자 크기 설정은 유지한다.
      // 로그 슬롯은 기록 마운트. is-history-open 은 다른 오버레이라 붙이지 않는다.
      historyOpen = true;
      panel.classList.remove("is-docked", "is-history-open");
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.remove("ai-panel-docked");
        document.body.classList.add("ai-studio-open");
      }
      studioShell?.attach(panel, { historyLogMount, commandBar });
      studioShell?.setStatus(status.textContent ?? "");
      studioShell?.setWorkPlan(workPlanSurfaceState?.active ? workPlanSurfaceState.plan : null, workPlanSurfaceState?.active === true);
      studioShell?.setChangePreview(lastStudioChange);
      studioShell?.setToolLines(studioToolLines);
      studioButton.setAttribute("aria-label", "AI 스튜디오 되돌리기");
      publishAiStudioChange(true);
      applyComposerViewPolicy();
    } else {
      studioShell?.detach();
      panel.classList.remove("is-studio");
      studioButton.setAttribute("aria-label", "AI 스튜디오 펼치기");
      if (typeof document !== "undefined" && document.body) document.body.classList.remove("ai-studio-open");
      publishAiStudioChange(false);
      applyHistoryOpen(false);
    }
  };
  const fillStudioInput = (text: string): void => {
    input.value = text;
    input.dispatchEvent(new Event("input"));
    refreshSendEnabled();
    input.focus();
  };
  studioShell = createStudioShell({
    onExit: () => applyStudio(false),
    onFontZoom: (delta) => setLogFontSize(delta),
    onUseTool: (tool) => {
      const lead = tool.description.split(/[.\n]/u)[0]?.trim() || tool.name;
      fillStudioInput(`${lead} (${tool.name})`);
    },
  });
  studioButton.addEventListener("click", () => applyStudio(!studio));
  const onStudioToggleRequest = (): void => applyStudio(!studio);
  if (typeof window !== "undefined") window.addEventListener(AI_STUDIO_TOGGLE_EVENT, onStudioToggleRequest);

  // float 컴포저 ☰ — 헤더 햄버거와 **동일한 항목 구현**(aiActionMenu.ts) + 스킬 찾기·설정.
  // 열림 상태는 컴포저 셸이 소유하므로 직접 hidden 을 만지지 않는다(두 곳이 상태를 들면
  // aria-expanded 가 실제와 갈라진다).
  const closeCommandMenu = (): void => {
    if (composerPopoverKind() === "menu") openComposerPopover(null);
  };
  const composerMenu = createAiActionMenuItems({
    meta: {
      compact: () => contextMeter.button.textContent?.trim() || null,
      tools: () => String(filterToolCategories("").reduce((count, category) => count + category.tools.length, 0)),
      settings: () => modelChipLabel(),
    },
    variant: "composer",
    close: closeCommandMenu,
    actions: sharedMenuActions,
  });
  refreshAcceptanceMenus = () => {
    const available = stickyChecklist.hasSnapshot();
    // lib.dom 의 hidden 은 `boolean | "until-found"` 다 — 그대로 넘기면 build 의
    // tsc --noEmit 이 막는다(HEAD 에서도 깨져 있던 2건). "until-found" 는 숨은 상태이므로
    // 불리언으로 좁히는 것이 의미도 맞다.
    const hidden = Boolean(stickyChecklist.root.hidden);
    headerMenu.setAcceptanceState(available, hidden);
    composerMenu.setAcceptanceState(available, hidden);
  };
  refreshAcceptanceMenus();
  // 대기 화면 3분기(추천 함께 / 조수만 / 입력창만)는 취향 설정이다 — ☰ 메뉴 최상단이 아니라 설정 모달의
  // 한 절로 옮겼다(제안서 D6). testid(ai-command-temperature-*)와 동작은 그대로다.
  const composerTemperatureSection = createAssistantTemperatureMenuSection({
    variant: "composer",
    current: readTemperature,
    close: () => {},
    onChange: applyTemperature,
  });
  settingsExtraSections = [{
    id: "temperature",
    title: "대기 화면",
    description: "조수가 쉬는 동안 무엇을 보일지 정합니다.",
    content: composerTemperatureSection,
  }];
  // 구 이름은 `refreshDockLabels` 였다 — 도크별 버튼 라벨을 다시 계산하는 일이 본업이었고,
  // 그 일이 없어진 지금 남은 것은 "패널 표면을 현재 상태에 맞춰 다시 그린다" 하나다.
  applyAssistantViewPolicy = (): void => {
    panel.dataset.chatDock = "float";
    applyComposerViewPolicy();
    syncCommandBarClearance();
    applySize();
    mountResizeHandle();
  };
  applyAssistantViewPolicy();
  commandMenu.replaceChildren(...composerMenu.items);
  refreshTemperatureChrome();

  // 초기 적용: 스튜디오가 켜져 있으면 스튜디오가 이기고, 아니면 기록 패널은 숨긴다.
  if (studio) applyStudio(true);
  else applyHistoryOpen(false);

  const handleAiAssist = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!isAiAssistDetail(detail)) return;
    // 클러스터 킥오프는 AI 작업 — 자동 펼침 후 턴 종료 시 다시 접힐 수 있다.
    expandForAiWork();
    if (sendButton.disabled) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요");
      return;
    }
    const config = loadAiConfig();
    if (!isAiConfigReady(config)) {
      openAiSettings("apiKey");
      toast("AI 설정(엔드포인트/키)을 먼저 완료하세요", "error");
      return;
    }
    const kickoff = detail.kind === "cluster-edit"
      ? {
        prompt: buildClusterEditKickoff({
          tilesetId: detail.tilesetId,
          groupId: detail.groupId,
          group: clusterGroupSnapshot(store.getCurrent(), detail.tilesetId, detail.groupId),
        }),
        displayAs: `클러스터 수정 — ${detail.groupId}`,
      }
      : {
        prompt: buildUnclassifiedAnalysisKickoff({
          tilesetId: detail.tilesetId,
          sampleTiles: detail.sampleTiles,
          total: detail.total,
        }),
        displayAs: `미분류 분석 — ${detail.total}개`,
      };
    if (!kickoff.prompt.trim()) {
      toast("AI 분석을 시작할 수 없습니다.", "error");
      return;
    }
    void sendText(kickoff.prompt, kickoff.displayAs);
  };

  if (typeof window !== "undefined") {
    cleanupAiAssistBridge?.();
    const targetWindow = window;
    targetWindow.addEventListener("oprn:ai-assist", handleAiAssist);
    cleanupAiAssistBridge = () => targetWindow.removeEventListener("oprn:ai-assist", handleAiAssist);
  }

  // Ctrl/Cmd+K — 통합 커맨드 팔레트(명령+맵). 패널 수명주기와 함께 등록/해제한다.
  const onCommandPaletteKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette();
    }
  };
  // 단축키를 모르는 사용자를 위한 클릭 경로 — 탑바의 ⌘K 칩이 이 이벤트를 쏜다.
  // 단축키 등록을 이 패널의 수명주기가 소유하므로 열기 요청도 여기서 처리한다.
  const onCommandPaletteRequest = (): void => {
    openCommandPalette();
  };
  let ownsCommandPaletteHotkey = false;
  if (typeof window !== "undefined" && !(window as { __oprnCommandPaletteHotkey?: boolean }).__oprnCommandPaletteHotkey) {
    (window as { __oprnCommandPaletteHotkey?: boolean }).__oprnCommandPaletteHotkey = true;
    ownsCommandPaletteHotkey = true;
    document.addEventListener?.("keydown", onCommandPaletteKeyDown);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onCommandPaletteRequest);
  }

  // MCP/외부 에이전트 브리지: 같은 채팅 세션으로 send·로그·하네스 공유.
  const waitUntilIdle = (timeoutMs: number): Promise<boolean> => {
    if (!turnBusy) return Promise.resolve(!disposed);
    return new Promise(resolve => {
      const settle = (idle: boolean) => {
        clearTimeout(deadline);
        idleWaiters.delete(onIdle);
        resolve(idle && !disposed);
      };
      const onIdle = () => settle(true);
      const deadline = setTimeout(() => settle(false), timeoutMs);
      idleWaiters.add(onIdle);
    });
  };
  const collectAudit = (): readonly AiBridgeAuditEntry[] => {
    const merged = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    return merged.map((entry) => {
      const kind = entry.kind;
      if (kind === "tool") {
        // 브리지 소비자(DB AI 바)가 읽기·쓰기와 성공·실패를 가를 수 있게 모드와 결과를 실어 준다.
        return { kind: "tool", name: entry.name, summary: entry.summary, at: entry.at, mode: getTool(entry.name)?.mode, ok: entry.ok };
      }
      if (kind === "assistant" || kind === "user" || kind === "status") {
        return { kind, text: "text" in entry ? entry.text : undefined, at: entry.at };
      }
      return { kind: String(kind) };
    });
  };
  const lastAssistantFromAudit = (): string | undefined => {
    const audit = collectAudit();
    for (let i = audit.length - 1; i >= 0; i -= 1) {
      if (audit[i]?.kind === "assistant" && audit[i]?.text) return audit[i]?.text;
    }
    return undefined;
  };
  registerAiAssistantBridge({
    send: async (text: string): Promise<AiBridgeTurnResult> => {
      const trimmed = text.trim();
      const requestedConversation = conversationId;
      const entryStatus = { ready: true, turnBusy, configReady: isAiConfigReady(loadAiConfig()),
        lastStatus: status.textContent ?? "대기", bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true };
      if (!trimmed) {
        return { ok: false, error: "빈 메시지", status: {
          ready: true, turnBusy, configReady: isAiConfigReady(loadAiConfig()), lastStatus: status.textContent ?? "대기",
          bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
        }, audit: collectAudit(), harness: controller.session?.getHarnessSnapshot() ?? null };
      }
      if (!isAiConfigReady(loadAiConfig())) {
        openAiSettings("apiKey");
        return {
          ok: false,
          error: "AI 설정(API 키)이 필요합니다. 에디터 설정 모달을 확인하세요.",
          status: {
            ready: true, turnBusy, configReady: false, lastStatus: status.textContent ?? "대기",
            bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
          },
          audit: collectAudit(),
          harness: null,
        };
      }
      const idle = await waitUntilIdle(120_000);
      if (!idle || disposed || requestedConversation !== conversationId) {
        return {
          ok: false,
          error: "이전 턴이 끝나지 않아 전송하지 못했습니다.",
          status: { ...entryStatus, turnBusy: false }, audit: [], harness: null,
        };
      }
      try {
        let result: AiBridgeTurnResult | undefined;
        await sendText(trimmed, undefined, { onSettled: () => {
          const audit = collectAudit();
          result = {
            ok: true,
            status: {
              ready: true, turnBusy, configReady: true, lastStatus: status.textContent ?? "대기",
              bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
            },
            audit,
            harness: controller.session?.getHarnessSnapshot() ?? null,
            lastAssistantText: lastAssistantFromAudit(),
            runOutcome: controller.session?.getRunOutcome() ?? null,
          };
        } });
        if (!result) throw new Error("AI turn ownership retired before publication");
        return result;
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
          status: { ...entryStatus, turnBusy: false }, audit: [], harness: null,
        };
      }
    },
    getStatus: () => ({
      ready: true,
      turnBusy,
      configReady: isAiConfigReady(loadAiConfig()),
      lastStatus: status.textContent ?? "대기",
      bridgeConnected: isAiAssistantBridgeConnected(),
      panelMounted: true,
    }),
    getAudit: () => collectAudit(),
    getHarness: () => controller.session?.getHarnessSnapshot() ?? null,
    withdrawRequirement: (action) => {
      if (disposed || turnBusy) return false;
      const session = controller.session;
      if (!session) return false;
      const accepted = session.withdrawRequirement(action);
      stickyChecklist.update(session.getAcceptanceSnapshot());
      refreshRunOutcome();
      return accepted;
    },
    abort: () => abortActiveTurn(),
    // DB 모달 AI 바 등 외부 진입점이 "채팅 도크 열기"를 요청할 때 — 접힘만 해제한다.
    openPanel: () => {
      restoreCollapsed();
      try {
        input.focus();
      } catch {
        // headless DOM 에서 focus 미지원은 펼침 자체를 막지 않는다.
      }
    },
  });

  // Welcome boot target — prefill and optional auto-send (writes still proposal-gated).
  registerAiBootIntentTarget({
    open: () => restoreCollapsed(),
    getDraft: () => input.value,
    prefill: (text: string) => {
      input.value = text;
      syncInputHeight();
      refreshComposerPlaceholder();
      refreshSendEnabled();
      try {
        input.focus();
      } catch {
        // ignore focus failures in headless tests
      }
    },
    send: async (text: string) => {
      // Project creation emits before IndexedDB conversation adoption finishes. Its reset
      // must complete before the preset enters the composer or starts a turn.
      await whenAiChatPanelSettled();
      if (disposed) return;
      input.value = text;
      try {
        input.focus();
      } catch {
        /* headless */
      }
      await sendText(text);
    },
  });
  // 부팅 복원 — 이 프로젝트 범위의 최신 대화를 이어받는다. 전역 최신 하나만 집어 스코프를 대조하는
  // 예전 방식은, 다른 프로젝트의 대화가 더 최근이면 내 대화가 있어도 복원을 포기해 새 세션이 강요되는
  // 것처럼 보였다. 조회는 비동기(IndexedDB)라 패널 조립이 끝난 뒤 도착한다 — 그 사이 사용자가 먼저
  // 움직였으면(입력·전송·프로젝트 전환) 복원하지 않는다. 진행 중인 새 대화를 덮어쓰는 것이 더 나쁘다.
  // Transcript adoption is not execution admission; an interrupted request must not be resent at boot.
  const restoreLatestForBoot = async (): Promise<void> => {
    const record = await loadLatestConversationForScope(currentProjectContextKey);
    if (disposed || !record) return;
    if (conversationScope !== currentProjectContextKey) return; // 프로젝트가 바뀌었다 — adopt 가 처리했다.
    if (turnBusy || controller.session !== null || controller.auditHistory.length > 0 || input.value.trim().length > 0) return;
    restoreConversationRecord(record, "auto");
  };
  void panelPendingWork.track(restoreLatestForBoot());

  activeAiChatPanelCleanup = () => {
    if (disposed) return;
    disposed = true;
    closeAiConversationHistoryModal();
    unregisterSettingsPanel();
    persistConversation();

    const turnController = activeAbortController;
    const regionController = activeSelectionRegionController;
    turnController?.abort();
    controller.session?.retireRun();
    retireMaintenance();
    if (regionController && regionController !== turnController) regionController.abort();
    activeAbortController = null;
    activeSelectionRegionController = null;
    activeSelectionRegionKey = null;
    turnBusy = false;
    for (const resolve of idleWaiters) resolve();
    pendingSends.length = 0;
    clearWorkPlanSurface(); // 패널 해제 — 할 일 목록 정리.
    stickyChecklist.dispose();
    endTurnProgress();
    clearAutoCollapseTimer();
    resizeChrome.dispose();
    studioShell?.dispose();
    studioShell = null;

    unsubscribeContextEditor();
    unsubscribeContextStore();
    unsubscribeCompletion();
    appliedCompletion = null;
    commandBarClearanceObserver?.disconnect();
    composerShell.dispose();

    if (typeof window !== "undefined") {
      window.removeEventListener(AI_SELECTION_CONTEXT_EVENT, handleSelectionContextEvent);
      window.removeEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoLastButton);
      window.removeEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoApplied);
      window.removeEventListener(AI_STUDIO_TOGGLE_EVENT, onStudioToggleRequest);
      if (window.__oprnAiHarness === harnessAccessor) delete window.__oprnAiHarness;
      if (ownsCommandPaletteHotkey) {
        document.removeEventListener?.("keydown", onCommandPaletteKeyDown);
        window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onCommandPaletteRequest);
        delete (window as { __oprnCommandPaletteHotkey?: boolean }).__oprnCommandPaletteHotkey;
      }
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", onMoreMenuPointerDown);
      document.removeEventListener("keydown", onMoreMenuKeyDown);
      document.body?.classList.remove("ai-command-bar-active", "ai-panel-docked", "ai-studio-open");
    }

    cleanupAiAssistBridge?.();
    cleanupAiAssistBridge = null;
    unregisterAiAssistantBridge();
    registerAiBootIntentTarget(null);
    clearAgentGhostPreview();
    // 패널이 사라지면 계획도 화면에 남을 이유가 없다(청사진은 더 이상 고스트에 얹혀 있지 않다).
    clearAgentBlueprint();
    panel.remove();
  };

  installDelayedTooltips(panel);
  return panel;
}
