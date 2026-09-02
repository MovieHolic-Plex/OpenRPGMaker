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
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { buildTurnGuide, type TurnScope } from "@/ai/turnGuide";
import { isRegionEscapingIntent } from "@/editor/regionTask/regionIntentRouter";
import { store } from "@/project/store";
import { combineDiffs } from "@/project/projectCommitLog";
import { el } from "@/util/dom";
import { renderAssistantAnswer } from "@/editor/panels/aiAnswerLinkRender";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS,
  type ProposedCall,
} from "@/ai/assistantSession";
import type { WorkPlan } from "@/ai/workPlan";
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
import { EMPTY_SESSION_USAGE } from "@/ai/sessionUsage";
import { createAiContextMeter, type AiContextMeterHandle, type AiContextSnapshot } from "./aiContextMeter";
import { openAiConversationHistoryModal } from "./aiConversationHistoryModal";
import { openAiInstructionsModal } from "./aiInstructionsModal";
import { aiActivityPersistenceState, extractCommitIdsFromAudit } from "@/ai/activityLog";
import { listAiUiEvents, recordAiUiEvent } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import {
  parseQuickReplies,
  QUICK_REPLY_MARKER,
  stripQuickReplyLine,
} from "@/ai/interviewPrompt";
import { buildClusterEditKickoff, buildUnclassifiedAnalysisKickoff, type ClusterGroupSnapshot } from "@/ai/clusterAssistPrompt";
import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { loadAiConfig } from "@/ai/llmClient";
import { AI_STUDIO_TOGGLE_EVENT, publishAiStudioChange } from "@/editor/aiStudioMode";
import { createAiActionMenuItems, type AiActionMenuActions } from "./aiActionMenu";
import { createAssistantTemperatureMenuSection } from "./aiTemperatureMenu";
import { createComposerElements, type ComposerElements, type ComposerPopover } from "./aiComposer";
import { renderPreferenceMemorySettings } from "./aiPreferenceMemorySettings";
import { createCollapsedUndoButton, createDirectorRestoreButton } from "./aiDirectorChrome";
import { openAiSettingsModal } from "./aiSettingsModal";
import {
  directorStartPrompts,
  formatComposerPlaceholder,
  nextStepHint,
  readAgentBrief,
} from "./aiAgentBrief";
import { AI_AUTHORING_EXAMPLES, buildAiAuthoringExamples } from "./aiStartScreenCards";
import {
  isAiAssistantBridgeConnected,
  registerAiAssistantBridge,
  setAiBridgeLastStatus,
  unregisterAiAssistantBridge,
  type AiBridgeAuditEntry,
  type AiBridgeTurnResult,
} from "@/editor/aiAssistantBridge";
import { registerAiBootIntentTarget } from "@/editor/aiBootIntent";
import { createChatResizeChrome } from "./aiChatResizeChrome";
import {
  AI_FONT_SIZE_PERCENT,
  applyAiFontSize,
  loadAiFontSize,
  loadPanelCollapsed,
  saveAiFontSize,
  savePanelCollapsed,
  stepAiFontSize,
  type AiFontSize,
} from "./aiPanelLayout";
import { narrateAiActivity } from "@/editor/aiActivityNarration";
import { formatAiRunningStatus, formatToolActivityLine, renderToolActivityEntry, renderWorkPlanChecklist, type AutonomousRunBudget } from "./aiChatRenderers";
import {
  createConversationLogHost,
} from "./aiConversationLog";
import { anchoredPopupPosition } from "./popupPosition";
import { createProposalHost, setAssistantMessageBadge } from "./aiProposalCard";
import { changePreviewChips, renderChangePreviewCard, type ChangePreviewInput } from "./aiChangePreview";
import { createStudioShell, type StudioShell } from "./aiStudioShell";
import { proposalHumanSummaryLine } from "./aiProposalSummary";
import { createAiTurnRunner } from "./aiTurnRunner";
import { createAiRegionTaskRunner } from "./aiRegionTaskRunner";
import type { AiRunSurface, ConversationPersistTarget as ConversationPersistTargetContract } from "./aiRunSurface";
import {
  backupProjectSnapshot,
  displayUserAuditText,
  downloadJson,
  dropSession,
  exportCombinedAudit,
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
  DEFAULT_LOG_HEIGHT,
  LOG_HEIGHT_LIMITS,
  MAP_FIRST_MIGRATION_KEY,
  PANEL_SIZE_LIMITS,
  applyAiFontSize,
  clampLogHeight,
  clampPanelSize,
  clampPanelSizeToViewport,
  loadAiFontSize,
  loadLogHeight,
  loadPanelBarSize,
  loadPanelCollapsed,
  loadPanelSize,
  saveAiFontSize,
  saveLogHeight,
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
  let disposed = false;
  const initialProjectIdentity = store.getProjectIdentity();
  const currentProjectContextKey = conversationScopeKey(initialProjectIdentity, store.getCurrent());
  // 이 프로젝트 범위의 최신 대화를 이어받는다. 전역 최신 하나만 집어 스코프를 대조하는 예전 방식은,
  // 다른 프로젝트의 대화가 더 최근이면 내 대화가 있어도 복원을 포기해 새 세션이 강요되는 것처럼 보였다.
  const autoRestoreConversation = loadLatestConversationForScope(currentProjectContextKey);
  // 이 패널(대화 세션) 전체를 하나의 기록으로 저장할 id — 매 턴 끝에 누적 감사 로그를 저장한다.
  // '새 대화' 시 재발급된다.
  let conversationId = autoRestoreConversation?.id ?? genId("conv");
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
  const persistConversation = (target?: ConversationPersistTarget): void => {
    const entries = target
      ? [...target.entries]
      : [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    if (entries.length === 0) return;
    saveConversation({
      id: target?.id ?? conversationId,
      title: deriveTitle(entries),
      model: loadAiConfig().model,
      savedAt: Date.now(),
      entries: [...entries],
      projectContextKey: target?.scope ?? conversationScope,
    });
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
    if (record) controller.statusTimeline.push({ at: new Date().toISOString(), status: text });
  };
  const log = el("div", { class: "ai-chat-log", dataset: { testid: "ai-chat-log" } });
  let panelRoot: HTMLElement | null = null;
  let studioShell: StudioShell | null = null;
  const studioToolLines: string[] = [];
  let lastStudioChange: ChangePreviewInput | null = null;
  // 빈 로그 껍데기(.ai-glass-log·.ai-history-log-mount)를 접고 시작 블록을 가운데로 올리는 CSS 훅.
  // 턴 행 testid 가 아니라 **로그의 자식 유무**로 판정해야 한다 — 복원된 대화는 그 testid 를 달지
  // 않아 testid 로 세면 복원된 로그를 숨긴다. `:empty` 로도 못 잡는다 — 껍데기 안에 빈
  // .ai-chat-log 엘리먼트가 실제로 들어 있다.
  const syncConversationState = (): void => {
    if (panelRoot) panelRoot.dataset.aiConversation = log.childElementCount > 0 ? "active" : "empty";
  };
  // 변경 0건 알림 전용 호스트 — 쓰기가 있는 턴은 승인 없이 바로 적용되므로 결정 카드·핀·모달이 없다.
  const proposalNoticeHost = el("div", { class: "ai-proposal-notice-host" });
  let turnBusy = false;
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
  // 원탭 답변 칩 — 컨트롤러보다 먼저 만들어 질문 대기 중 페이드를 막는다.
  const chipsHost = el("div", { class: "ai-quick-replies", dataset: { testid: "ai-quick-replies" } });
  const hasPendingQuestion = (): boolean => chipsHost.childElementCount > 0;
  // applyCollapsed 정의 전에 턴이 잡혀도 안전한 바인딩(런타임 호출은 패널 마운트 이후).
  let expandForAiWork: () => void = () => {};
  let scheduleCollapseAfterAiWork: () => void = () => {};
  let clearAutoCollapseTimer: () => void = () => {};
  // 휘발 존(ai-rising-volatile-zone)은 사이드 도크 전용 오버레이였다. 도크가 하나가
  // 되면서 마운트되는 곳이 없어져 이 두 훅은 아무 데도 닿지 않는다 — 계약만 남긴다.
  let exportButton: HTMLButtonElement | null = null;
  const hasExportableConversation = (): boolean =>
    [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])].length > 0;
  const refreshExportButton = (): void => {
    if (!exportButton) return;
    const disabled = !hasExportableConversation();
    exportButton.disabled = disabled;
    exportButton.setAttribute("aria-disabled", String(disabled));
  };

  const input = el("textarea", {
    class: "ai-assistant-input",
    attrs: { placeholder: formatComposerPlaceholder(readAgentBrief()), rows: "1" },
    dataset: { testid: "ai-input" },
  }) as HTMLTextAreaElement;

  const sendButton = el("button", {
    class: "ai-assistant-action ai-chat-send",
    text: "↑ 전송",
    attrs: { type: "button", title: "보낼 지시를 입력하세요" },
    dataset: { testid: "ai-send" },
  }) as HTMLButtonElement;

  // 컴포저 셸은 파일 하단에서 조립된다(입력·전송·칩이 모두 있어야 하므로).
  // 그 전에 정의되는 핸들러들이 팝오버/실측을 부를 수 있어 늦은 바인딩으로 노출한다 —
  // 이 파일이 이미 쓰는 패턴(applyAssistantViewPolicy, syncGlassIdle 등)과 같다.
  let openComposerPopover: (kind: ComposerPopover | null) => void = () => {};
  let composerPopoverKind: () => ComposerPopover | null = () => null;
  let syncCommandBarClearance: () => void = () => {};
  let refreshLogZoomChrome: () => void = () => {};
  const applyPanelFontSize = (size: AiFontSize): void => {
    applyAiFontSize(panel, size);
    refreshLogZoomChrome();
  };

  // 설정은 전용 모달로 연다(채팅 본문 인라인 폼 제거 — UX P0/P1).
  // 저장 시 진행 중 세션 config도 즉시 갱신한다.
  const openAiSettings = (focusTarget: "first" | "apiKey" = "first"): void => {
    openAiSettingsModal({
      focusTarget,
      fontRoot: panel,
      onSaved: (config) => {
        controller.session?.updateConfig(config);
      },
      onFontSizeChange: (size) => applyPanelFontSize(size),
    });
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
      dataset: { testid: "ai-activity-live" },
      children: [
        el("span", { class: "ai-activity-live-spinner", attrs: { "aria-hidden": "true" } }),
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
    const before = new Set(log.querySelectorAll(".ai-tool-activity-line"));
    studioToolLines.unshift(formatToolActivityLine(toolName, result));
    if (studioToolLines.length > 40) studioToolLines.length = 40;
    studioShell?.setToolLines(studioToolLines);
    appendToolLine(toolName, result, args);
    const rendered = [...log.querySelectorAll(".ai-tool-activity-line")].find((entry) => !before.has(entry))
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
        liveRow.className = rendered.className;
        liveRow.dataset.testid = "ai-tool-entry";
        liveRow.removeAttribute("role");
        liveRow.removeAttribute("aria-live");
        liveRow.textContent = rendered.textContent ?? "";
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
        config: resolveSurfaceAiConfig("chat"),
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

  const restoreConversationRecord = (record: ConversationRecord, source: "auto" | "manual"): void => {
    dropSession(controller);
    endAutonomousRun(); // 대화 전환 — 진행 중이던 자율 런 표면을 정리한다(스테일 상태 방지).
    // 화면만 복원하면 사용자는 이어졌다고 믿고 모델은 아무것도 모른다 — 다음 세션에 기록 요약을
    // 함께 밀어 넣어 "이어가기"를 모델 쪽에서도 참으로 만든다.
    pendingPriorTranscript = serializeAuditTranscript(record.entries) || null;
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    chipsHost.replaceChildren();
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    for (const entry of record.entries) renderConversationEntry(entry);
    const lastAssistant = [...record.entries].reverse().find((entry) => entry.kind === "assistant" && entry.text.trim());
    if (lastAssistant?.kind === "assistant") renderQuickReplies(lastAssistant.text);
    setStatus(source === "auto" ? "대화 복원됨" : "이전 대화");
    // 복원된 대화는 로그에 들어가지만 syncGlassIdle 이 다시 돌지 않으면 패널이 is-glass-idle 로
    // 남아 .ai-glass-log 가 display:none 이라 사용자에게 보이지 않는다(실보 2026-08-27).
    syncGlassIdle();
    refreshExportButton();
    syncConversationState();
    if (source === "manual") appendBubble("system", "이전 대화를 열었습니다.");
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
    activeAbortController?.abort();
    activeAbortController = null;
    activeSelectionRegionController = null;
    activeSelectionRegionKey = null;
    pendingSends.length = 0;
    refreshQueueIndicator();
    turnBusy = false;
    endTurnProgress();
    refreshAbortButton();
    persistConversation();
    dropSession(controller);
    endAutonomousRun(); // 새 대화 — 이전 자율 런의 계획/예산/피드를 버린다.
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
    chipsHost.replaceChildren();
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
  const adoptConversationForCurrentProject = (): void => {
    // 새 스코프를 먼저 읽어 이어받을 대화를 정한다 — 리셋이 그 사실을 알아야 버릴 id·시작 화면·
    // 거짓 계측을 만들지 않는다. 리셋 자체는 여전히 **옛** scope/id 로 닫히는 대화를 보관한다.
    const nextScope = conversationScopeKey(store.getProjectIdentity(), store.getCurrent());
    const resumed = loadLatestConversationForScope(nextScope);
    const hadConversation = resetConversationState("project-switch", resumed);
    if (resumed) {
      restoreConversationRecord(resumed, "auto");
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
    openAiConversationHistoryModal({
      scopeKey: conversationScope,
      currentConversationId: conversationId,
      onOpen: (record) => {
        restoreConversationRecord(record, "manual");
      },
    });
  };

  // 수동 압축은 요약 LLM 콜 1회다 — 진행 중 턴과 겹치면 같은 messages 배열을 두 곳이 만진다.
  let compacting = false;

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
    setStatus("맥락 압축 중…");
    refreshContextMeter();
    try {
      const outcome = await session.compactNow((event) => {
        if (event.type === "status") setStatus(event.text);
      });
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
      appendBubble("system", `압축 실패: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("압축 실패");
      recordAiUiEvent({
        surface: "context-panel",
        action: AI_UI_ACTIONS.contextCompact,
        testid: "ai-context-compact",
        detail: { kind: "error", error: error instanceof Error ? error.message : String(error) },
      });
    } finally {
      compacting = false;
      refreshContextMeter();
      refreshExportButton();
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
    endAutonomousRun();
    // 잘린 대화도 모델에게는 이어져야 한다 — 남긴 앞부분을 다음 세션에 다시 주입한다.
    pendingPriorTranscript = serializeAuditTranscript(turn.entries) || null;
    controller.auditHistory = [...turn.entries];
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    proposalNoticeHost.replaceChildren();
    chipsHost.replaceChildren();
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

  const renderQuickReplies = (assistantText: string): void => {
    chipsHost.replaceChildren();
    const options = parseQuickReplies(assistantText);
    if (options.length === 0) {
      chipsHost.remove();
      return;
    }
    chipsHost.classList.add("ai-choice-block");
    for (const [index, option] of options.entries()) {
      chipsHost.append(
        el("button", {
          class: "ai-quick-reply-chip",
          text: option,
          attrs: { type: "button" },
          dataset: { testid: `ai-choice-${index + 1}` },
          on: {
            click: () => {
              input.value = option;
              void send();
            },
          },
        })
      );
    }
    // 마커 줄은 본문에서 지우고(칩이 대신한다) 칩을 마지막 어시스턴트 줄 본문 바로 아래에 붙인다.
    const lastAssistant = [...log.querySelectorAll("[data-testid=ai-command-row-assistant]")].at(-1);
    if (lastAssistant) {
      const displayed = lastAssistant.textContent ?? "";
      if (displayed.includes(QUICK_REPLY_MARKER)) {
        lastAssistant.replaceChildren(renderAssistantAnswer(stripQuickReplyLine(assistantText)));
      }
      lastAssistant.after(chipsHost);
    } else {
      log.append(chipsHost);
    }
    // 칩이 로그 하단에 걸려 잘리지 않게 맨 아래로 스크롤.
    log.scrollTop = log.scrollHeight;
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
  const contextFooter = (): string => {
    const ctx = mapContext();
    const parts = [`현재 맵: ${ctx.mapName ?? "없음"}${ctx.mapId ? ` (${ctx.mapId})` : ""}`];
    // 선택 영역은 '현재 맵의 것'이고 맵 범위 안에 있을 때만 첨부한다.
    // 맵을 전환해도 남아 있던 이전 맵의 선택(예: 10×10 맵에 (11,9))이 모델에 새 좌표로 오인되던 문제(BUG F) 방지.
    const sel = ctx.selection;
    if (selectionTaskActive && sel && sel.mapId === ctx.mapId) {
      const map = ctx.mapId ? store.getCurrent().maps[ctx.mapId] : undefined;
      const inBounds = !map || (sel.x >= 0 && sel.y >= 0 && sel.x < map.width && sel.y < map.height);
      if (inBounds) parts.push(`사용자 선택 영역: (${sel.x},${sel.y}) ${sel.width}×${sel.height}`);
    }
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

  // ── 자율 실행 런 표면(todo 6) ───────────────────────────────────────────
  // 활성 자율 런 동안만 사는 라이브 영역: 작업 계획 체크리스트(emitWorkPlan) +
  // 마일스톤 피드(milestone_applied/proposal_paused) + 예산(used/48, status 이벤트).
  // 런이 끝나면 정리되고 다음 런이 시작되면 새로 그린다(스테일 상태 금지).
  // 런 진행 중에는 패널 자동 접기(AUTO_COLLAPSE_AFTER_AI_MS)를 비활성화한다.
  let autonomousRunState: { active: boolean; plan: WorkPlan | null; budget: AutonomousRunBudget } | null = null;
  let autonomousRunSurface: HTMLElement | null = null;
  let autonomousFeedHost: HTMLElement | null = null;
  const clearAutonomousRunSurface = (): void => {
    autonomousRunSurface?.remove();
    autonomousRunSurface = null;
    autonomousFeedHost = null;
    panel.classList.remove("is-autonomous-run");
  };
  const beginAutonomousRun = (): void => {
    // 새 런: 이전 런의 계획/예산/피드를 전부 버리고 0부터 시작한다.
    autonomousRunState = {
      active: true,
      plan: null,
      budget: { used: 0, total: AGENT_RUN_MAX_TOTAL_STEPS, exhausted: false },
    };
    clearAutonomousRunSurface();
  };
  const endAutonomousRun = (): void => {
    autonomousRunState = null;
    clearAutonomousRunSurface();
    studioShell?.setWorkPlan(null, false);
  };
  const ensureAutonomousRunSurface = (): HTMLElement => {
    if (!autonomousRunSurface) {
      autonomousFeedHost = el("div", { class: "ai-autonomous-feed", dataset: { testid: "ai-autonomous-feed" } });
      autonomousRunSurface = el("div", {
        class: "ai-autonomous-run-surface",
        dataset: { testid: "ai-autonomous-run-surface" },
      });
      mainColumn.prepend(autonomousRunSurface);
    }
    panel.classList.add("is-autonomous-run");
    return autonomousRunSurface;
  };
  // 계획 도착 시마다 체크리스트를 갱신한다(진행 요약/현재 레이어가 이벤트마다 재계산된다).
  const refreshAutonomousRunSurface = (): void => {
    if (!autonomousRunState || !autonomousRunState.plan) return;
    const surface = ensureAutonomousRunSurface();
    const checklist = renderWorkPlanChecklist(autonomousRunState.plan, {
      active: autonomousRunState.active,
      budget: autonomousRunState.budget,
    });
    checklist.querySelector<HTMLElement>("[data-testid='ai-run-details']")?.append(autonomousFeedHost!);
    surface.replaceChildren(checklist);
    studioShell?.setWorkPlan(autonomousRunState.plan, autonomousRunState.active);
  };
  // 마일스톤 자동 적용/적용 실패 — 런 표면의 피드에 한 줄씩 쌓는다(피드는 표면과 함께 정리된다).
  const appendMilestoneFeedLine = (kind: "applied" | "apply-failed", title: string, detail: string): void => {
    if (!autonomousRunState) return;
    ensureAutonomousRunSurface();
    refreshAutonomousRunSurface();
    autonomousFeedHost!.append(
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
    activeAbortController.abort();
    // 중단 시점의 진행 정도를 함께 남긴다 — 툴 0개에서 끊긴 것과 40개 돌다 끊긴 것은 다른 사건이다.
    const toolsSoFar = (controller.session?.getAuditEntries() ?? []).filter((entry) => entry.kind === "tool").length;
    const droppedQueue = pendingSends.length;
    pendingSends.length = 0;
    refreshQueueIndicator();
    if (!abortNoticeShown) {
      appendBubble("system", "사용자가 중단했습니다.");
      abortNoticeShown = true;
    }
    setStatus("중단 중…");
    refreshAbortButton();
    recordAiUiEvent({ surface: "panel", action: AI_UI_ACTIONS.turnAbort, detail: { toolsSoFar, droppedQueue } });
  };

  // 이 턴이 손댈 범위. 선택 사각형이 현재 맵의 것이고, 요청이 «영역을 벗어나는 의도»(예: 새 맵
  // 시공)가 아닐 때만 스코프로 쓴다. 없으면 null — 재료·도구 규칙만 붙고 사각형 제약은 빠진다.
  const resolveTurnScope = (instruction: string): TurnScope | null => {
    const state = editorState.get();
    const selection = state.selection;
    if (!selection) return null;
    if (isRegionEscapingIntent(instruction)) return null;
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
    opts?: { readonly replay?: boolean },
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!ensureConfigReadyForSend()) return;
    if (turnBusy) {
      pendingSends.push({
        text: trimmed,
        ...(displayAs !== undefined ? { displayAs } : {}),
      });
      refreshQueueIndicator();
      return;
    }
    chipsHost.replaceChildren();
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
    // 자율 런 표면 시작: 새 런마다 이전 계획/예산/피드를 버리고 0부터 시작한다.
    if (autonomous) beginAutonomousRun();
    // 도구 규칙(재료 라벨·소품/보물상자 구분·shape=circle·길/도로 등)은 **선택 여부와 무관하게**
    // 붙인다. 예전에는 이 규칙이 영역 작업 전용 경로에만 있어서, 선택 영역 없이 조수에게 같은
    // 말을 하면 다른 규칙을 받았다 — 가방 그룹을 재료로 쓰거나, 장식 나무상자를 place_chest 로
    // 놓거나, 원형 호수를 네모로 채우는 실수가 조수 쪽에서만 반복됐다(PR #378 의 관찰).
    // 사각형 제약 문구는 스코프가 있을 때만 더 붙는다.
    const turnScope = resolveTurnScope(trimmed);
    const guide = buildTurnGuide({
      instruction: trimmed,
      ...(tilesetForTurn(turnScope?.mapId) ? { tileset: tilesetForTurn(turnScope?.mapId) } : {}),
      scope: turnScope,
    });
    const payload = [trimmed, guide, contextFooter()].filter((part) => part.length > 0).join("\n\n");
    await executeTurn(session, trimmed, (onEvent, signal) =>
      // instruction: 되묻기 판정용 원문. payload 에는 도구 가이드가 섞여 있어 그걸로 판정하면
      // 가이드 문구의 실내·야외 표지가 매 턴 「집을 어떻게 만들까요?」 되묻기를 유발한다.
      session.sendUserMessage(payload, onEvent, signal, { autonomous }),
      { autonomous }
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
    set turnBusy(value) { turnBusy = value; },
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
    get autonomousRunState() { return autonomousRunState; },
    applyProposal: (calls, assistantBubble) => applyProposal(calls, assistantBubble),
    noteNoChanges: (result, extraWarnings) => noteNoChanges(result, extraWarnings),
    endAutonomousRun: () => endAutonomousRun(),
    refreshAutonomousRunSurface: () => refreshAutonomousRunSurface(),
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
    if (selectionTaskActive && currentSelectionForRegionTask()) await sendSelectionRegionTask(text);
    else await sendText(text);
  };

  sendButton.addEventListener("click", () => void send());
  input.addEventListener("keydown", (event) => {
    // 엔터 = 즉시 전송, Shift+Enter = 줄바꿈. IME 조합 중(한글 입력 확정)에는 전송하지 않는다.
    const composing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
    // Escape 우선순위: **사용자가 연** 팝오버 → 선택 영역 작업. 팝오버가 떠 있는데 선택
    // 컨텍스트가 먼저 해제돼 사용자가 "무엇이 닫혔는지" 알 수 없던 문제를 없앤다.
    //
    // 단 `suggest` 팝오버는 예외다 — 「빈 입력 + 포커스」만으로 저절로 열린다(syncSuggestPopover).
    // 선택 영역을 끌고 오면 칩이 붙으면서 입력창에 포커스가 가므로 이 팝오버가 **항상** 함께
    // 열리는데, 그때 Escape 를 팝오버가 먹으면 감독이 끄려던 칩은 안 꺼지고 두 번 눌러야 한다.
    // (도크가 float 하나가 되기 전에는 이 조건에 `dock === "float"` 이 걸려 있어 유리 카드에서는
    //  팝오버가 안 열렸고, 그래서 이 충돌이 드러나지 않았다.)
    if (event.key === "Escape") {
      const popover = composerPopoverKind();
      if (popover !== null && !(popover === "suggest" && selectionTaskActive)) {
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

  // Overlay empty kit dropped — idle prompts live in the composer as director chips.
  const ensureStartScreen = (): void => {};
  let autoRestoreReplayText: string | null = null;
  if (autoRestoreConversation) {
    const entries = autoRestoreConversation.entries;
    const lastSpeak = [...entries].reverse().find((entry) => entry.kind === "user" || entry.kind === "assistant");
    if (lastSpeak?.kind === "user" && lastSpeak.text.trim()) {
      autoRestoreReplayText = displayUserAuditText(lastSpeak.text);
    }
  }

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
    refreshComposerChips();
    refreshSendEnabled();
  });
  // 입력창 포커스 시 휘발 존(웰컴/대화)을 펼치고, 빈 대화 상태로 포커스를 잃으면 접어 맵을 비운다.
  input.addEventListener("focus", () => {
    syncSuggestPopover();
  });
  input.addEventListener("blur", () => {
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
    // 오버레이 안(스킬 카드 등) 클릭이 blur보다 먼저 처리되도록 잠깐 늦춘 뒤 접는다.
    window.setTimeout(() => {
      if (typeof document !== "undefined" && document.activeElement === input) return;
      if (composerPopoverKind() === "suggest") openComposerPopover(null);
      hideVolatileIfIdle();
    }, 160);
  });

  // AI가 지금 무엇을 보고 있는지 — 현재 맵 + 선택 영역 칩.
  const contextChips = el("div", { class: "ai-context-chips", dataset: { testid: "ai-context-chips" } });
  const composerChips = el("div", { class: "ai-composer-chips", dataset: { testid: "ai-composer-chips" } });
  const nextSteps = el("div", {
    class: "ai-next-steps",
    dataset: { testid: "ai-next-steps" },
  });
  /**
   * 「다음에 뭘 하지」 블록 — 한 줄 안내 + 저작 예제 칩.
   *
   * 2026-08-31: 이 블록은 원래 유리/사이드 카드 **본문**에 붙어 있었고, 그래서 도크 축을
   * 지우면 마운트 조건(`dock === "glass" || dock === "side"`)이 영구히 거짓이 되어 안내와
   * 예제 칩 6개가 통째로 닿을 수 없게 된다. 카드는 없어져도 기능이 없어질 이유는 없으므로
   * **컴포저 추천 팝오버 안으로 옮겼다** — 팝오버가 열리는 조건(입력창 포커스 + 빈 값)이
   * 원래 카드가 뜨던 조건과 같다.
   *
   * 예제는 6개 전부 낸다. 카드 시절에는 `slice(0, 4)` 로 잘랐는데, 자른 이유는 카드 폭이
   * 좁아서였고 팝오버는 캡슐 폭(기본 640px)을 쓴다.
   */
  const refreshNextSteps = (): void => {
    if (typeof document === "undefined") return;
    const brief = readAgentBrief();
    const hasLog = Boolean(log.querySelector("[data-testid=ai-command-row-assistant]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-user]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row]"));
    syncConversationState();
    const busy = hasLog || Boolean(turnBusy || runningProgress);
    const show = readTemperature() === "quiet-gold" && !busy && input.value.trim() === "";
    nextSteps.hidden = !show;
    if (!show) {
      nextSteps.replaceChildren();
      return;
    }
    const pickExample = (instruction: string): void => {
      input.value = instruction;
      input.focus();
      syncInputHeight();
      refreshComposerChips();
    };
    nextSteps.replaceChildren(
      el("p", {
        class: "ai-next-steps-hint",
        dataset: { testid: "ai-next-steps-hint" },
        text: nextStepHint(brief),
      }),
      buildAiAuthoringExamples({ examples: AI_AUTHORING_EXAMPLES, onPick: pickExample }),
    );
  };
  // 추천 칩 팝오버는 입력창이 비어 있고 포커스가 있을 때만 뜬다. 흐름 밖이라 열림/닫힘이
  // 바 높이를 건드리지 않는다.
  const syncSuggestPopover = (): void => {
    if (typeof document === "undefined") return;
    const focused = document.activeElement === input;
    // 팝오버 안에는 감독 프롬프트 칩과 「다음에 뭘 하지」 블록 둘이 산다 — 어느 한쪽에
    // 내용이 있으면 열 이유가 있다. (칩만 보던 시절에는 프롬프트가 0개인 맵에서 안내와
    // 예제 칩이 함께 묻혔다.)
    const wantOpen =
      focused
      && input.value.trim() === ""
      && (composerChips.childElementCount > 0 || !nextSteps.hidden);
    const kind = composerPopoverKind();
    if (wantOpen && kind === null) openComposerPopover("suggest");
    else if (!wantOpen && kind === "suggest") openComposerPopover(null);
  };
  // 칩 집합이 실제로 바뀔 때만 다시 그린다 — 매 키스트로크 replaceChildren 은
  // 흐름 안 칩 행을 껐다 켜며 바 높이를 점프시킨 원인이었다.
  let composerChipsKey = "";
  const refreshComposerChips = (): void => {
    if (typeof document === "undefined") return;
    const brief = readAgentBrief();
    const placeholder = formatComposerPlaceholder(brief);
    if (input.getAttribute("placeholder") !== placeholder) input.setAttribute("placeholder", placeholder);
    const prompts = directorStartPrompts(brief).slice(0, 3);
    const chipsKey = prompts.map((prompt) => `${prompt.id}:${prompt.label}`).join("|");
    if (chipsKey !== composerChipsKey) {
      composerChipsKey = chipsKey;
      composerChips.replaceChildren(
        ...prompts.map((prompt) =>
          el("button", {
            class: "ai-composer-chip",
            text: prompt.label,
            attrs: { type: "button", title: prompt.instruction },
            dataset: { testid: `ai-composer-chip-${prompt.id}` },
            on: {
              click: () => {
                input.value = prompt.instruction;
                input.focus();
                syncInputHeight();
                refreshComposerChips();
              },
            },
          }),
        ),
      );
    }
    composerChips.hidden = prompts.length === 0;
    syncSuggestPopover();
    refreshNextSteps();
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
          text: "×",
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
    const chips = [el("span", { class: "ai-context-chip", text: `🗺 ${ctx.mapName ?? "맵 없음"}` })];
    const selection = currentSelectionForRegionTask();
    if (selectionTaskActive && !selection) selectionTaskActive = false;
    if (selection) {
      chips.push(renderSelectionTaskChip(selection));
    }
    contextChips.replaceChildren(...chips);
  };
  refreshContextChips();
  refreshComposerChips();
  const unsubscribeContextEditor = editorState.subscribe(() => {
    refreshContextChips();
    refreshComposerChips();
    applyAssistantViewPolicy();
    refreshTemperatureChrome();
    if (studioShell?.attached()) {
      studioShell.refreshScenes();
      studioShell.refreshMonitor();
    }
  });
  const unsubscribeContextStore = store.subscribe(() => {
    refreshContextChips();
    refreshComposerChips();
    if (studioShell?.attached()) {
      studioShell.refreshScenes();
      studioShell.refreshMonitor();
    }
    // 프로젝트가 바뀌었으면(새 프로젝트 생성·다른 작업 열기·로엄 복원) 대화를 새로 시작한다 —
    // 이전 프로젝트의 계획·제안·맵 좌표는 새 프로젝트에서 전부 무의미하거나 해롭다.
    const identity = store.getProjectIdentity();
    if (identity.id === projectIdentityId) return;
    if (applyingProposal) {
      projectIdentityId = identity.id;
      return;
    }
    adoptConversationForCurrentProject();
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
    text: "🧰",
    attrs: { type: "button", hidden: "", "aria-hidden": "true" },
    dataset: { testid: "ai-tools-browser" },
    on: { click: openToolsBrowser },
  });
  const harnessButton = el("button", {
    class: "ai-chat-tools-button",
    text: "🔬",
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
  exportButton = el("button", {
    class: "ai-assistant-action ai-export-button",
    text: "내보내기",
    attrs: { type: "button", hidden: "", "aria-hidden": "true", title: "대화 감사 로그 내보내기", "aria-label": "대화 내보내기" },
    dataset: { testid: "ai-export" },
    on: {
      click: () => {
        const json = exportCombinedAudit(controller);
        if (!json) {
          toast("내보낼 대화가 없습니다.", "info");
          recordAiUiEvent({ surface: "panel", action: AI_UI_ACTIONS.conversationExport, testid: "ai-export", disabled: true, detail: { entries: 0 } });
          return;
        }
        downloadJson("ai-session-audit.json", json);
        recordAiUiEvent({
          surface: "panel",
          action: AI_UI_ACTIONS.conversationExport,
          testid: "ai-export",
          detail: {
            format: "json",
            bytes: json.length,
            entries: [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])].length,
          },
        });
      },
    },
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
    text: "＋",
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
    text: "중단",
    attrs: { type: "button", title: "진행 중인 AI 응답을 중단합니다", "aria-label": "AI 응답 중단" },
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
    text: "☰",
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
    openSettings: () => openAiSettings("first"),
    exportAudit: () => exportButton?.click(),
    openHistory: () => {
      historyButton.click();
      applyHistoryOpen(true);
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
  const composerShell: ComposerElements = createComposerElements({
    input,
    collapseButton,
    sendButton,
    abortButton,
    undoAppliedButton,
    contextChips,
    composerChips,
    nextSteps,
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
  // `nextSteps` 는 여기 있지 않다 — 컴포저 추천 팝오버로 옮겼다(위 refreshNextSteps 주석).
  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [glassLogMount, historyLogMount, chipsHost],
  });
  const logZoomOut = el("button", {
    class: "ai-log-zoom-btn",
    text: "−",
    attrs: { type: "button", title: "기록 축소", "aria-label": "기록 글자 축소" },
    dataset: { testid: "ai-log-zoom-out" },
  }) as HTMLButtonElement;
  const logZoomLabel = el("span", {
    class: "ai-log-zoom-label",
    text: AI_FONT_SIZE_PERCENT.normal,
    attrs: { "aria-live": "polite" },
    dataset: { testid: "ai-log-zoom-label" },
  });
  const logZoomIn = el("button", {
    class: "ai-log-zoom-btn",
    text: "+",
    attrs: { type: "button", title: "기록 확대", "aria-label": "기록 글자 확대" },
    dataset: { testid: "ai-log-zoom-in" },
  }) as HTMLButtonElement;
  const logZoom = el("div", {
    class: "ai-log-zoom",
    attrs: { role: "group", "aria-label": "기록 글자 크기" },
    dataset: { testid: "ai-log-zoom" },
    children: [logZoomOut, logZoomLabel, logZoomIn],
  });
  const logChrome = el("div", {
    class: "ai-log-chrome",
    dataset: { testid: "ai-log-chrome" },
    children: [
      el("span", { class: "ai-log-grip", attrs: { "aria-hidden": "true" } }),
      logZoom,
    ],
  });
  const body = el("div", {
    class: "ai-chat-body",
    dataset: { testid: "ai-chat-body" },
    children: [logChrome, mainColumn],
  });
  const setLogFontSize = (delta: number): void => {
    const next = stepAiFontSize(loadAiFontSize(), delta);
    saveAiFontSize(next);
    applyPanelFontSize(next);
  };
  logZoomOut.addEventListener("click", (event) => {
    event.preventDefault();
    setLogFontSize(-1);
  });
  logZoomIn.addEventListener("click", (event) => {
    event.preventDefault();
    setLogFontSize(1);
  });
  body.addEventListener("wheel", (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setLogFontSize(event.deltaY < 0 ? 1 : -1);
  }, { passive: false });
  refreshLogZoomChrome = (): void => {
    const size = loadAiFontSize();
    logZoomLabel.textContent = AI_FONT_SIZE_PERCENT[size];
    logZoomOut.disabled = size === "small";
    logZoomIn.disabled = size === "large";
  };

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
    children: [toolbar, body, collapsedRestore, collapsedUndo, stickyProposalZone, commandBar],
  });
  panelRoot = panel;
  // 오버레이가 컴포저를 덮지 않도록 "바 + 열린 팝오버"의 최상단까지를 실측해 CSS 변수로 흘린다.
  // (bottom 76px 고정은 칩 행 + 여러 줄 입력으로 커진 바를 덮었다 — H01 실측.)
  // 하단 여백(--ai-command-bar-inset)도 같은 실측에서 나온다 — 144px 하드코딩은 실제
  // 바 높이와 어긋나 있었고, 두 값이 서로 다른 소스를 보면 반드시 갈라진다.
  syncCommandBarClearance = (): void => {
    const rect = commandBar.getBoundingClientRect();
    if (rect.height <= 0 || typeof window === "undefined") return;
    const clearance = Math.max(60, Math.ceil(window.innerHeight - composerShell.measuredTop()) + 12);
    panel.style.setProperty("--ai-command-bar-clearance", `${clearance}px`);
    document.body?.style.setProperty("--ai-command-bar-inset", `${Math.max(72, Math.ceil(rect.height) + 24)}px`);
  };
  const commandBarClearanceObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncCommandBarClearance) : null;
  commandBarClearanceObserver?.observe(commandBar);
  // 저장된 글자 크기를 부팅 시 즉시 적용(영속 — V3C).
  applyAiFontSize(panel, loadAiFontSize());
  refreshLogZoomChrome();
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
    commandBar,
    logBody: body,
    resizable: resizableDock,
    logResizable: () =>
      resizableDock()
      && panel.classList.contains("is-assistant-log-open")
      && !panel.classList.contains("is-history-open"),
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
    || autonomousRunState?.active === true
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
    refreshNextSteps();
  };
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
    refreshNextSteps();
  };

  // 셰브론이 여닫는 것은 하나다: 패널 전체(칩 접힘). glass 도크의 본문 접힘(fold)이
  // 두 번째 축이었고 함께 사라졌다.
  const syncCollapseButtonChrome = (): void => {
    const shut = collapsed;
    const label = shut ? "AI 패널 펼치기" : "AI 패널 접기";
    collapseButton.textContent = shut ? "▸" : "▾";
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
    if (historyOpen) {
      panel.classList.add("is-history-open");
      panel.classList.add("is-docked");
      historyButton.textContent = "×";
      historyButton.setAttribute("title", "전체 기록 닫기");
      historyButton.setAttribute("aria-label", "전체 기록 닫기");
    } else {
      panel.classList.remove("is-history-open", "is-docked");
      historyButton.textContent = "🕒";
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
      panel.setAttribute("style", ""); // 커스텀 크기 대신 전체 폭.
      // 로그 슬롯은 기록 마운트. is-history-open 은 다른 오버레이라 붙이지 않는다.
      historyOpen = true;
      panel.classList.remove("is-docked");
      if (typeof document !== "undefined" && document.body) {
        document.body.classList.remove("ai-panel-docked");
        document.body.classList.add("ai-studio-open");
      }
      studioShell?.attach(panel, { historyLogMount, commandBar });
      studioShell?.setStatus(status.textContent ?? "");
      studioShell?.setWorkPlan(autonomousRunState?.plan ?? null, autonomousRunState?.active === true);
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
  studioShell = createStudioShell({
    onExit: () => applyStudio(false),
    onFontZoom: (delta) => setLogFontSize(delta),
    onUseTool: (tool) => {
      const lead = tool.description.split(/[.\n]/u)[0]?.trim() || tool.name;
      input.value = `${lead} (${tool.name})`;
      input.dispatchEvent(new Event("input"));
      refreshSendEnabled();
      input.focus();
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
    variant: "composer",
    close: closeCommandMenu,
    actions: sharedMenuActions,
  });
  const composerTemperatureSection = createAssistantTemperatureMenuSection({
    variant: "composer",
    current: readTemperature,
    close: closeCommandMenu,
    onChange: applyTemperature,
  });
  // 구 이름은 `refreshDockLabels` 였다 — 도크별 버튼 라벨을 다시 계산하는 일이 본업이었고,
  // 그 일이 없어진 지금 남은 것은 "패널 표면을 현재 상태에 맞춰 다시 그린다" 하나다.
  applyAssistantViewPolicy = (): void => {
    panel.dataset.chatDock = "float";
    applyComposerViewPolicy();
    syncSuggestPopover();
    syncCommandBarClearance();
    applySize();
    mountResizeHandle();
  };
  applyAssistantViewPolicy();
  commandMenu.replaceChildren(composerTemperatureSection, ...composerMenu.items);
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
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") window.setTimeout(resolve, ms);
      else resolve();
    });
  const waitUntilIdle = async (timeoutMs: number): Promise<boolean> => {
    const started = Date.now();
    while (turnBusy) {
      if (Date.now() - started > timeoutMs) return false;
      await sleep(150);
    }
    return true;
  };
  const collectAudit = (): readonly AiBridgeAuditEntry[] => {
    const merged = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    return merged.map((entry) => {
      const kind = entry.kind;
      if (kind === "tool") {
        return { kind: "tool", name: entry.name, summary: entry.summary, at: entry.at };
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
      if (!idle) {
        return {
          ok: false,
          error: "이전 턴이 끝나지 않아 전송하지 못했습니다.",
          status: {
            ready: true, turnBusy, configReady: true, lastStatus: status.textContent ?? "대기",
            bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
          },
          audit: collectAudit(),
          harness: controller.session?.getHarnessSnapshot() ?? null,
        };
      }
      try {
        await sendText(trimmed);
        await waitUntilIdle(300_000);
        const audit = collectAudit();
        return {
          ok: true,
          status: {
            ready: true, turnBusy, configReady: true, lastStatus: status.textContent ?? "대기",
            bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
          },
          audit,
          harness: controller.session?.getHarnessSnapshot() ?? null,
          lastAssistantText: lastAssistantFromAudit(),
        };
      } catch (cause) {
        return {
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
          status: {
            ready: true, turnBusy, configReady: true, lastStatus: status.textContent ?? "오류",
            bridgeConnected: isAiAssistantBridgeConnected(), panelMounted: true,
          },
          audit: collectAudit(),
          harness: controller.session?.getHarnessSnapshot() ?? null,
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
    prefill: (text: string) => {
      input.value = text;
      try {
        input.focus();
      } catch {
        // ignore focus failures in headless tests
      }
    },
    send: (text: string) => {
      input.value = text;
      try {
        input.focus();
      } catch {
        /* headless */
      }
      void sendText(text);
    },
  });
  // 복원된 마지막 사용자 메시지는 모든 panel/collapse 콜백이 초기화된 뒤 재생한다.
  // 패널 조립 중 sendText를 호출하면 panel·collapsed TDZ를 건드려 복원이 실패한다.
  if (autoRestoreConversation) restoreConversationRecord(autoRestoreConversation, "auto");
  if (autoRestoreReplayText) {
    void sendText(autoRestoreReplayText, undefined, { replay: true });
  }

  activeAiChatPanelCleanup = () => {
    if (disposed) return;
    disposed = true;
    persistConversation();

    const turnController = activeAbortController;
    const regionController = activeSelectionRegionController;
    turnController?.abort();
    if (regionController && regionController !== turnController) regionController.abort();
    activeAbortController = null;
    activeSelectionRegionController = null;
    activeSelectionRegionKey = null;
    turnBusy = false;
    pendingSends.length = 0;
    endAutonomousRun(); // 진행 중이던 자율 런 표면 정리.
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

  return panel;
}
