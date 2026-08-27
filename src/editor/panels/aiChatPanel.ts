// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일은 패널 조립/배선(orchestration)을 소유한다. 순수 헬퍼·카드·설정·로그 렌더는 형제 모듈로 분리.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - ChatGPT OAuth 토큰은 브라우저에 저장하지 않는다. API 키 폴백만 설정 localStorage를 쓴다.

import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import {
  clearAiApplyCompletion,
  publishAiApplyCompletion,
  subscribeAiApplyCompletion,
  type AiApplyCompletionContext,
} from "@/editor/aiApplyCompletion";
import type { AiDocument, Project } from "@/project/types";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
import {
  parseAssistantTemperature,
  persistAssistantTemperature,
  type AssistantTemperature,
} from "@/editor/assistantTemperature";
import { chatDockHint, cycleChatDock, nextChatDockActionLabel, type ChatDock } from "@/editor/chatDock";
import { editorState } from "@/editor/editorState";
import { AI_SELECTION_CONTEXT_EVENT, aiSelectionContextDetail } from "@/editor/aiSelectionContext";
import {
  agentGhostPreviewsForMap,
  clearAgentGhostPreview,
  createThrottledAgentGhostPreviewUpdater,
  getAgentGhostPreviewState,
  hasAgentGhostPreviewSubscribers,
  setAgentGhostDraftMapProvider,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import { classifyApproval } from "@/ai/approvalPolicy";
import { classifyProposalSafety } from "@/editor/proposalSafety";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal, type DemoTeachSeed } from "@/editor/panels/demoTeachCanvas";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { COMMAND_PALETTE_OPEN_EVENT, openCommandPalette } from "./commandPalette";
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { isRegionEscapingIntent } from "@/editor/regionTask/regionIntentRouter";
import { describeRegionTaskResult, runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import type { WorkPlan } from "@/ai/workPlan";
import type { BuildSpec } from "@/ai/buildSpec";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import {
  deriveTitle,
  loadLatestConversation,
  projectConversationContextKey,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { recordAiActivity } from "@/ai/activityLog";
import { parseQuickReplies, QUICK_REPLY_MARKER, stripQuickReplyLine } from "@/ai/interviewPrompt";
import { listAllSkills, recordSkillUse, type SkillArgValue, type SkillDef, type SkillRunContext } from "@/ai/skills";
import { currentTilesetSkillContext, renderSkillDrawer, renderSlashList, slashSkillMatches } from "@/editor/panels/aiSkillDrawer";
import { loadAiConfig } from "@/ai/llmClient";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { createAiActionMenuItems, type AiActionMenuActions } from "./aiActionMenu";
import { createAssistantTemperatureMenuSection } from "./aiTemperatureMenu";
import { createComposerElements, type ComposerElements, type ComposerPopover } from "./aiComposer";
import { createDirectorPlate, createDirectorRestoreButton } from "./aiDirectorChrome";
// queueController extracted for future use — reserved (aiQueueController.ts).
import { buildAiCompletionStrip, type AiCompletionStripHandle } from "./aiCompletionStrip";
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
import {
  applyAiFontSize,
  clampPanelSize,
  clampPanelSizeToViewport,
  loadAiFontSize,
  loadDockPanelSize,
  loadPanelCollapsed,
  saveAiFontSize,
  saveDockPanelSize,
  savePanelCollapsed,
  type AiFontSize,
} from "./aiPanelLayout";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderWorkPlanChecklist, type AutonomousRunBudget } from "./aiChatRenderers";
import {
  appendSkillPromptToggle,
  createConversationLogHost,
  renderStreamedMarkdown,
} from "./aiConversationLog";
import { createProposalModalElements } from "./aiProposalModal";
import { anchoredPopupPosition } from "./popupPosition";
import { createProposalHost, renderAppliedComparison, setAssistantMessageBadge } from "./aiProposalCard";
import { findEntityMentions, renderEntityMentionStrip } from "./aiEntityMentions";
import {
  attachCompletenessWarnings,
  backupProjectSnapshot,
  completenessSpecForProposal,
  displayUserAuditText,
  downloadJson,
  dropSession,
  exportCombinedAudit,
  isAiAssistDetail,
  isAiConfigReady,
  isWriteTool,
  phaseStatusText,
  shouldShowStatusInChat,
  statusToneOf,
  STUDIO_MODE_KEY,
  type ChatController,
  type TileGridData,
} from "./aiChatPanelHelpers";

// ── 테스트/외부 호환 re-export (기존 import 경로 유지) ──────────────
export {
  AI_FONT_SIZE_KEY,
  AI_FONT_SIZE_SCALE,
  AUTO_COLLAPSE_AFTER_AI_MS,
  MAP_FIRST_MIGRATION_KEY,
  PANEL_SIZE_LIMITS,
  applyAiFontSize,
  clampPanelSize,
  clampPanelSizeToViewport,
  clearDockPanelSize,
  loadAiFontSize,
  loadDockPanelSize,
  loadPanelCollapsed,
  loadPanelSize,
  saveAiFontSize,
  saveDockPanelSize,
  savePanelCollapsed,
  savePanelSize,
  type AiFontSize,
  type PanelDock,
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
export { proposalAcceptButtonLabel } from "./aiProposalFusion";
export {
  applyVocabularyCardEdits,
  callsWithVocabularyEdits,
  failedToolRetrySummary,
  failedToolVisibleSummary,
  formatAiRunningStatus,
  formatToolActivityLine,
  hasVocabularyEdits,
  isDraftDestructiveTool,
  parseAutonomousRunBudget,
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

export function foldWorkLogs(bubble: HTMLElement | null): void {
  if (!bubble) return;
  const preElements = Array.from(bubble.querySelectorAll("pre"));
  for (const pre of preElements) {
    if (pre.parentElement?.tagName === "DETAILS") continue;
    const text = pre.textContent ?? "";
    const isWorkLog = /lint|warning|error|품질|검사|오류|경고|출입구\s*쌍|id\s+map_|✓/i.test(text);
    if (!isWorkLog) continue;
    const errMatch = text.match(/(?:error|오류)\s*[:=]?\s*(\d+)/i);
    const warnMatch = text.match(/(?:warning|경고)\s*[:=]?\s*(\d+)/i);
    const infoMatch = text.match(/(?:info|정보)\s*[:=]?\s*(\d+)/i);
    const parts: string[] = ["작업 기록"];
    if (errMatch) parts.push(`오류 ${errMatch[1]}`);
    if (warnMatch) parts.push(`경고 ${warnMatch[1]}`);
    else if (infoMatch) parts.push(`안내 ${infoMatch[1]}`);
    const summaryText = parts.join(" · ");

    const details = el("details", {
      class: "work ai-work-log",
      dataset: { testid: "ai-work-log" },
      children: [el("summary", { text: summaryText })],
    });
    pre.replaceWith(details);
    details.append(pre);
  }
}

/**
 * 이미지 리치 장식 — 어시스턴트 문장이 언급한 통산 자료(몬스터·아이템·등장인물)의
 * 썸네일을 그 문장 밑에 붙인다. 이름만 나오는 답변은 "어느 슬라임?" 을 다시 물게 하고,
 * 에디터는 이미 그 그림을 지고 있다(databaseRecordThumbnails.recordListThumbnail).
 *
 * 마크다운을 다시 그리는 renderStreamedMarkdown 뒤에 부를것을 전제한다 — 그 전에 붙이면
 * 본문이 다시 쓰이면서 스트립이 터진다. 같은 버블을 다시 장식해도 덧붙이지 않는다.
 */
export function decorateAssistantMentions(
  bubble: HTMLElement | null,
  assistantText: string,
  project: Project,
): void {
  if (!bubble) return;
  foldWorkLogs(bubble);
  const previous = bubble.querySelector?.("[data-testid=ai-mention-strip]");
  previous?.remove();
  if (!assistantText.trim()) return;
  const strip = renderEntityMentionStrip(findEntityMentions(assistantText, project), project);
  if (strip) bubble.append(strip);
}

export interface AiChatPanelOptions {
  readonly clock?: () => number;
  readonly getChatDock?: () => ChatDock;
  readonly onChatDockToggle?: () => void;
  readonly onChatDockChange?: (next: ChatDock) => void;
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
  const runRegion = options.regionTaskRunner ?? runRegionTask;
  const readChatDock = (): ChatDock => options.getChatDock?.() ?? editorState.get().chatDock;
  const readTemperature = (): AssistantTemperature =>
    parseAssistantTemperature(options.getAssistantTemperature?.() ?? editorState.get().assistantTemperature);
  let refreshTemperatureChrome: () => void = () => {};
  const controller: ChatController = { session: null, auditHistory: [], statusTimeline: [] };
  let disposed = false;
  const currentProjectContextKey = projectConversationContextKey(store.getCurrent());
  const latestConversation = loadLatestConversation();
  const autoRestoreConversation =
    latestConversation?.projectContextKey === currentProjectContextKey ? latestConversation : null;
  // 이 패널(대화 세션) 전체를 하나의 기록으로 저장할 id — 매 턴 끝에 누적 감사 로그를 저장한다.
  // '새 대화' 시 재발급된다.
  let conversationId = autoRestoreConversation?.id ?? genId("conv");
  // 현재까지의 전체 대화(폐기된 세션 + 현재 세션)를 대화 기록 저장소에 저장한다.
  const persistConversation = (): void => {
    const entries = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])];
    if (entries.length === 0) return;
    saveConversation({
      id: conversationId,
      title: deriveTitle(entries),
      model: loadAiConfig().model,
      savedAt: Date.now(),
      entries: [...entries],
      projectContextKey: projectConversationContextKey(store.getCurrent()),
    });
    refreshExportButton();
  };

  const status = el("span", {
    class: "ai-assistant-status",
    text: "대기",
    dataset: { testid: "ai-status", statusTone: "idle" },
  });
  // 상태 배지 전이를 타임라인에 기록한다(결함 ⑬) — 로그 export로 "검토 대기" 멈춤을 진단 가능.
  const setStatus = (text: string, record = true): void => {
    status.textContent = text;
    status.dataset.statusTone = statusToneOf(text);
    setAiBridgeLastStatus(text);
    if (record) controller.statusTimeline.push({ at: new Date().toISOString(), status: text });
  };
  const log = el("div", { class: "ai-chat-log", dataset: { testid: "ai-chat-log" } });
  const pinHost = el("div", {
    class: "ai-proposal-pin-host",
    dataset: { testid: "ai-proposal-pin-host" },
  });
  // ③ 액션 존(§2.3): 지금 결정이 필요한 제안 카드만 — 비면 숨김(CSS :empty).
  const proposalHost = el("div", { class: "ai-proposal-host ai-action-zone", dataset: { testid: "ai-proposal-host" } });

  // ── 변경 제안 몰입 모달: 제안 카드는 중앙 모달에서 검토한다(채팅 오버레이에 얹으면 답답하다는 UX 피드백).
  // proposalHost가 모달 본문에 상주하므로 카드 렌더/승인/융합 로직은 그대로다.
  // '나중에'(Esc/백드롭 포함)는 최소화 — 커맨드 바 위 pill로 남아 승인 대기를 잃지 않는다. 폐기는 오직 [거부] 버튼.
  const proposalModal = createProposalModalElements(proposalHost);
  const proposalNoticeHost = proposalModal.noticeHost;
  const proposalPill = proposalModal.pill;
  const proposalModalCount = proposalModal.count;
  const proposalModalBody = proposalModal.body;
  const proposalModalRoot = proposalModal.root;
  const openProposalModal = proposalModal.open;
  const closeProposalModal = proposalModal.close;
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
  let dockToggleLock: HTMLButtonElement | null = null;
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
  let runningPhaseStatus: string | null = null;
  // AI 턴/영역 작업이 끝나면 맵 우선으로 다시 접을지. 검토 대기·오류면 유지.
  let collapseAfterAiWork = false;
  // executeTurn/영역 작업 콜백은 패널 크롬을 만들기 전에 정의되므로, 접힘 상태도
  // 같은 초기화 구간에 둔다. 아래 크롬 구간에서 선언하면 자동 복원 sendText가
  // TDZ 상태의 collapsed를 읽어 턴을 시작하기 전에 실패한다.
  let collapsed = loadPanelCollapsed();
  let autoCollapseTimer: number | null = null;
  let volatileZone: HTMLElement | null = null;
  // 원탭 답변 칩 — 컨트롤러보다 먼저 만들어 질문 대기 중 페이드를 막는다.
  const chipsHost = el("div", { class: "ai-quick-replies", dataset: { testid: "ai-quick-replies" } });
  const hasPendingQuestion = (): boolean => chipsHost.childElementCount > 0;
  // applyCollapsed 정의 전에 턴이 잡혀도 안전한 바인딩(런타임 호출은 패널 마운트 이후).
  let expandForAiWork: () => void = () => {};
  let scheduleCollapseAfterAiWork: () => void = () => {};
  let clearAutoCollapseTimer: () => void = () => {};
  const revealVolatileZone = (): void => {
    if (!volatileZone) return;
    volatileZone.hidden = false;
  };
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
  // 이 파일이 이미 쓰는 패턴(refreshDockLabels, syncGlassIdle 등)과 동일.
  let openComposerPopover: (kind: ComposerPopover | null) => void = () => {};
  let composerPopoverKind: () => ComposerPopover | null = () => null;
  let syncCommandBarClearance: () => void = () => {};

  // 설정은 전용 모달로 연다(채팅 본문 인라인 폼 제거 — UX P0/P1).
  // 저장 시 진행 중 세션 config도 즉시 갱신한다.
  const openAiSettings = (focusTarget: "first" | "apiKey" = "first"): void => {
    openAiSettingsModal({
      focusTarget,
      fontRoot: panel,
      onSaved: (config) => {
        controller.session?.updateConfig(config);
      },
      onFontSizeChange: (size) => applyAiFontSize(panel, size),
    });
  };

  // 시작 화면(빈 대화) — 첫 콘텐츠가 붙는 순간 제거된다.
  let startScreen: HTMLElement | null = null;
  const removeStartScreen = (): void => {
    startScreen?.remove();
    startScreen = null;
  };
  // 대화가 비어 있고(시작 화면만) 진행 중이 아니면 휘발 존을 접어 맵을 가리지 않는다.
  // (입력창 포커스 시에는 revealVolatileZone으로 다시 펼쳐 웰컴/스킬 카드를 보여준다.)
  const hideVolatileIfIdle = (): void => {
    if (startScreen === null || turnBusy || runningProgress || !volatileZone) return;
    volatileZone.hidden = true;
  };

  const conversationLog = createConversationLogHost({
    log,
    revealVolatileZone,
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
    renderConversationEntry,
    clearLastReasoning,
    isLastReasoningBox,
  } = conversationLog;

  const ensureSession = (): AssistantSession => {
    if (!controller.session) {
      backupProjectSnapshot();
      controller.session = new AssistantSession(store.getCurrent(), {
        config: loadAiConfig(),
        contextOptions: {
          currentMapId: editorState.get().currentMapId ?? undefined,
          getViewport: () => getEditorMapViewport(),

        },
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
    proposalHost,
    pinHost,
    proposalNoticeHost,
    proposalModalCount,
    proposalPill,
    proposalModalBody,
    getChatDock: readChatDock,
    openProposalModal,
    closeProposalModal,
    controller,
    appendBubble,
    setStatus,
    onApplied: (result) => {
      const selection = editorState.get().selection;
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
  const renderProposal = proposalApi.renderProposal;
  const acceptProposal = proposalApi.acceptProposal;
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
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    proposalApi.clearInlineActionsIfMine();
    proposalHost.replaceChildren();
    closeProposalModal();
    chipsHost.replaceChildren();
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    for (const entry of record.entries) renderConversationEntry(entry);
    const lastAssistant = [...record.entries].reverse().find((entry) => entry.kind === "assistant" && entry.text.trim());
    if (lastAssistant?.kind === "assistant") renderQuickReplies(lastAssistant.text);
    setStatus(source === "auto" ? "대화 복원됨" : "이전 대화");
    refreshExportButton();
    if (source === "manual") appendBubble("system", "이전 대화를 열었습니다.");
  };

  // 수동 대화 복원(id 지정)은 호출 지점이 없다 — 감독 콘솔 전환에서 오버레이 시작 화면의
  // '이전 대화 이어가기' 버튼과 대화 기록 검색 카드가 함께 사라졌기 때문. 부팅 시 자동 복원
  // (restoreConversationRecord(..., "auto"))만 남아 있다. 기록 열기 UI를 다시 붙일 때
  // loadConversation + restoreConversationRecord(record, "manual") 조합을 되살리면 된다.

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
        lastAssistant.replaceChildren(renderMarkdown(stripQuickReplyLine(assistantText)));
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
    const ctx = getSkillContext();
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
  const pendingSends: { text: string; displayAs?: string; explicitSkillId?: string }[] = [];
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
    if (next) {
      void sendText(
        next.text,
        next.displayAs,
        next.explicitSkillId ? { explicitSkillId: next.explicitSkillId } : undefined,
      );
    }
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
  };
  // 마일스톤 자동 적용/승인 대기 — 런 표면의 피드에 한 줄씩 쌓는다(피드는 표면과 함께 정리된다).
  const appendMilestoneFeedLine = (kind: "applied" | "paused", title: string, detail: string): void => {
    if (!autonomousRunState) return;
    ensureAutonomousRunSurface();
    refreshAutonomousRunSurface();
    autonomousFeedHost!.append(
      el("div", {
        class: `ai-autonomous-feed-line is-${kind}`,
        dataset: { testid: `ai-milestone-feed-${kind}` },
        children: [
          el("span", { class: "ai-autonomous-feed-mark", text: kind === "applied" ? "✓" : "⏸" }),
          el("span", {
            class: "ai-autonomous-feed-text",
            text: `${kind === "applied" ? "마일스톤 적용" : "승인 대기"}: ${title}${detail ? ` — ${detail}` : ""}`,
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
    if (dockToggleLock) {
      dockToggleLock.disabled = turnBusy;
      dockToggleLock.setAttribute("aria-disabled", String(turnBusy));
      if (turnBusy) dockToggleLock.setAttribute("title", "작업이 끝난 뒤에 위치를 바꿀 수 있습니다.");
    }
  };
  const refreshRunningStatus = (record = false): void => {
    if (!runningProgress) return;
    // 분모는 세션의 실제 안전핀(config.maxToolCalls) — 하드코딩 30은 실한도(200)와 어긋나 "77/30" 같은 모순 표기를 냈다.
    setStatus(formatAiRunningStatus(runningProgress.startedAt, now(), runningProgress.toolCount, loadAiConfig().maxToolCalls, runningPhaseStatus), record);
  };
  const beginTurnProgress = (): void => {
    runningPhaseStatus = null;
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
    if (progressTimer !== null && typeof window !== "undefined") window.clearInterval(progressTimer);
    progressTimer = null;
    runningProgress = null;
    runningPhaseStatus = null;
    panel.classList.remove("is-turn-running");
    syncGlassIdle();
  };
  const abortActiveTurn = (): void => {
    if (!activeAbortController || activeAbortController.signal.aborted) return;
    activeAbortController.abort();
    pendingSends.length = 0;
    refreshQueueIndicator();
    if (!abortNoticeShown) {
      appendBubble("system", "사용자가 중단했습니다.");
      abortNoticeShown = true;
    }
    setStatus("중단 중…");
    refreshAbortButton();
  };

  const sendText = async (
    text: string,
    displayAs?: string,
    opts?: { readonly explicitSkillId?: string | null; readonly replay?: boolean },
  ): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!ensureConfigReadyForSend()) return;
    if (turnBusy) {
      pendingSends.push({
        text: trimmed,
        ...(displayAs !== undefined ? { displayAs } : {}),
        ...(opts?.explicitSkillId ? { explicitSkillId: opts.explicitSkillId } : {}),
      });
      refreshQueueIndicator();
      return;
    }
    chipsHost.replaceChildren();
    closeToolActivity();
    revealVolatileZone();
    if (!opts?.replay) {
      const userBubble = appendBubble("user", displayAs ?? trimmed);
      if (displayAs !== undefined && displayAs !== trimmed) appendSkillPromptToggle(userBubble, trimmed);
    }
    const session = ensureSession();
    // 자율 드라이버 진입: agentMode "auto" 에서만 켠다(전송 시점 설정 기준 — 위 autoApprove 판정과 같은 관례).
    // "chat" 은 종전대로 턴 1개(수동 「계속」). opts.autonomous 는 세션 진입점의 명시 오버라이드(브리지/테스트).
    const autonomous = loadAiConfig().agentMode === "auto";
    // 자율 런 표면 시작: 새 런마다 이전 계획/예산/피드를 버리고 0부터 시작한다.
    if (autonomous) beginAutonomousRun();
    await executeTurn(session, trimmed, (onEvent, signal) =>
      session.sendUserMessage(`${trimmed}\n\n${contextFooter()}`, onEvent, signal, {
        explicitSkillId: opts?.explicitSkillId,
        autonomous,
      }),
      { autonomous }
    );
  };

  // 한 턴 실행 공통부: 최초 전송(sendUserMessage)과 오류 후 수동 재시도(retryLastTurn)가
  // 같은 스트리밍/제안/상태 처리를 공유한다(도그푸딩 결함 ⑥).
  const executeTurn = async (
    session: AssistantSession,
    requestText: string,
    exec: (onEvent: (event: SessionEvent) => void, signal: AbortSignal) => Promise<TurnResult>,
    runOpts?: { readonly autonomous?: boolean }
  ): Promise<void> => {
    if (turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    turnBusy = true;
    const abortController = new AbortController();
    activeAbortController = abortController;
    abortNoticeShown = false;
    const ownsTurn = (allowAborted = false): boolean =>
      !disposed
      && activeAbortController === abortController
      && (allowAborted || !abortController.signal.aborted);
    // 접혀 시작한 턴만 종료 후 재접기. 이미 열린 첫 방문/펼침은 열린 채 유지.
    collapseAfterAiWork = collapsed;
    expandForAiWork();
    revealVolatileZone();
    beginTurnProgress();
    refreshAbortButton();
    sendButton.disabled = true;
    const activeSpecAtTurnStart = session.getActiveSpec();
    const ghostPreviewUpdater = createThrottledAgentGhostPreviewUpdater({
      getBaseProject: () => store.getCurrent(),
      getDraftProject: () => session.getProposedProject(),
      isWriteTool,
    });
    // 고스트 렌더러가 승인 전 초안 맵을 에디터 컴포지터 경로로 합성해 찍도록 공급한다.
    setAgentGhostDraftMapProvider((mapId) => session.getProposedProject().maps[mapId]);
    let confirmedBuildSpecThisTurn: BuildSpec | null = null;
    let turnFailed = false; // 접힘 레일 알림 점의 색(완료=초록/오류=빨강) 결정용.
    let turnResult: TurnResult | null = null;
    let turnCatchError: string | undefined;
    let assistantBubble: HTMLElement | null = null;
    let reasoningBox: { box: HTMLElement; body: HTMLElement } | null = null;
    const streamedBubbles: HTMLElement[] = [];
    let currentStreamNodes: HTMLElement[] = [];
    const trackCurrentStreamNode = (node: HTMLElement): void => {
      if (!currentStreamNodes.includes(node)) currentStreamNodes.push(node);
    };
    const clearCurrentStreamAttempt = (): void => {
      const discarded = new Set(currentStreamNodes);
      currentStreamNodes.forEach((node) => node.remove());
      for (let index = streamedBubbles.length - 1; index >= 0; index -= 1) {
        if (discarded.has(streamedBubbles[index])) streamedBubbles.splice(index, 1);
      }
      for (const node of discarded) { if (isLastReasoningBox(node)) clearLastReasoning(); }
      currentStreamNodes = [];
      assistantBubble = null;
      reasoningBox = null;
    };
    const onEvent = (event: SessionEvent): void => {
      if (!ownsTurn()) return;
      if (event.type === "phase") {
        runningPhaseStatus = phaseStatusText(event.value);
        if (runningProgress) refreshRunningStatus(true);
        else setStatus(runningPhaseStatus);
        return;
      }
      if (event.type === "assistant_stream_reset") {
        clearCurrentStreamAttempt();
        return;
      }
      if (event.type === "reasoning_token") {
        if (!reasoningBox) {
          reasoningBox = appendReasoning();
          trackCurrentStreamNode(reasoningBox.box);
        }
        reasoningBox.body.textContent = (reasoningBox.body.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
        return;
      }
      if (event.type === "assistant_token") {
        reasoningBox = null; // 답변이 시작되면 다음 추론은 새 상자.
        if (!assistantBubble) {
          assistantBubble = appendBubble("assistant", "");
          streamedBubbles.push(assistantBubble);
          trackCurrentStreamNode(assistantBubble);
          closeToolActivity(); // 응답이 시작되면 다음 툴은 새 그룹으로.
        }
        assistantBubble.textContent = (assistantBubble.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
      } else if (event.type === "assistant_message") {
        if (!event.content.trim()) return;
        if (!assistantBubble) {
          assistantBubble = appendBubble("assistant", event.content);
        } else {
          assistantBubble.textContent = event.content;
        }
        currentStreamNodes = [];
      } else if (event.type === "tool_started") {
        // 상태칩이 실행 중 도구를 즉시 반영 (tool_started는 실행 직전에 발화된다).
        setAgentGhostRunningTool(event.name);
      } else if (event.type === "tool_call") {
        bumpToolProgress();
        appendToolLine(event.name, event.result, event.args);
        ghostPreviewUpdater.handleToolCall(event);
        assistantBubble = null; // 툴 이후 새 assistant 응답은 새 버블.
        reasoningBox = null; // 툴 이후 새 추론은 새 상자.
        currentStreamNodes = [];
        // 밑그림(스펙) 확정: 짧은 요약 + 접힌 상세(채팅 노이즈 감소).
        if (event.name === "set_build_spec" && event.result.ok && event.result.data) {
          const spec = event.result.data as BuildSpec;
          confirmedBuildSpecThisTurn = spec;
          const title = spec.title ?? spec.mapId;
          const detailLines = [
            ...(spec.buildOrder && spec.buildOrder.length > 0 ? [`건설 순서: ${spec.buildOrder.join(" → ")}`] : []),
            ...spec.assets.map(
              (asset) =>
                `· ${asset.id} (${asset.kind}) (${asset.x},${asset.y}) ${asset.w}×${asset.h}${asset.style ? ` — ${asset.style}` : ""}`
            ),
          ];
          const details = el("details", {
            class: "ai-chat-bubble ai-chat-system ai-build-spec-summary",
            dataset: { testid: "ai-build-spec-summary" },
            children: [
              el("summary", { text: `📐 밑그림 확정 — ${title} · 에셋 ${spec.assets.length}개` }),
              el("pre", {
                class: "ai-build-spec-detail",
                text: detailLines.length > 0 ? detailLines.join("\n") : "(영역 상세 없음)",
              }),
            ],
          });
          log.append(details);
          log.scrollTop = log.scrollHeight;
          setStatus(`밑그림 확정 — 에셋 ${spec.assets.length}개`);
        }
        // 인터뷰 하이라이트: 강조 툴콜을 에디터 selection으로 반영해 맵 위에 사각형을 그린다.
        if (event.name === "highlight_map_region" && event.result.ok) {
          const region = event.result.data as { mapId: string; x: number; y: number; w: number; h: number };
          editorState.set({ selection: { mapId: region.mapId, x: region.x, y: region.y, width: region.w, height: region.h } });
        }
        // 타일 이미지 표시 요청: 채팅 버블에 썸네일로 렌더.
        if (event.name === "show_tiles" && event.result.ok) {
          const data = event.result.data as { tilesetId: string; tiles: number[] };
          appendTileThumbs(data.tilesetId, data.tiles);
        }
        // 맵 영역 그리드 표시: 하위+상위 합성 이미지로 렌더(구조물 학습의 시각 자료).
        if (event.name === "show_tile_grid" && event.result.ok) {
          appendTileGrid(event.result.data as TileGridData);
        }
        // AI 리치 문서(present_doc): 구조화 블록/샌드박스 HTML을 채팅에 렌더.
        if (event.name === "present_doc" && event.result.ok) {
          const data = event.result.data as { document?: AiDocument };
          if (data?.document) appendAiDocument(data.document);
        }
        // 인터뷰 진행률: 분석 결과의 커버리지를 상태줄에 표시.
        if (event.name === "analyze_map_tile_usage" && event.result.ok) {
          const data = event.result.data as { coverage?: { used: number; described: number } };
          if (data.coverage) setStatus(`타일 설명 ${data.coverage.described}/${data.coverage.used}`);
        }
      } else if (event.type === "status") {
        // 대부분은 상태줄만. 재시도·오류 등 행동 신호만 말풍선.
        setStatus(event.text);
        // 자율 런 예산(used/48) 표시 갱신 — 드라이버의 계속/소진 status 이벤트에서 파싱.
        const budget = parseAutonomousRunBudget(event.text);
        if (budget && autonomousRunState) {
          autonomousRunState.budget = budget;
          refreshAutonomousRunSurface();
        }
        if (event.text.includes("예산 소진") || event.text.includes("agent_run_budget_exhausted")) {
          if (!log.querySelector("[data-testid=ai-continue-run]")) {
            const continueRow = el("div", { class: "ai-retry-row" });
            const continueBtn = el("button", {
              class: "ai-assistant-action",
              text: "계속",
              attrs: { type: "button" },
              dataset: { testid: "ai-continue-run" },
              on: { click: () => { void sendText("계속"); } },
            });
            continueRow.append(continueBtn);
            log.append(continueRow);
            log.scrollTop = log.scrollHeight;
          }
        }
        if (shouldShowStatusInChat(event.text)) appendBubble("system", event.text);
      } else if (event.type === "work_plan") {
        const s = event.plan;
        const items = Array.isArray(s.layers)
          ? s.layers.flatMap((layer) => (Array.isArray(layer.items) ? layer.items : []))
          : [];
        const done = items.filter((i) => i.status === "done" || i.status === "skipped").length;
        setStatus(`작업 계획 ${done}/${items.length}`);
        // 자율 런 라이브 체크리스트: emitWorkPlan 이벤트마다 항목 진행/현재 레이어를 갱신한다.
        if (autonomousRunState) {
          autonomousRunState.plan = s;
          refreshAutonomousRunSurface();
        }
      } else if (event.type === "milestone_applied") {
        appendMilestoneFeedLine("applied", event.title, `도구 ${event.toolCount}건${event.commitId ? ` · 커밋 ${event.commitId}` : ""}`);
      } else if (event.type === "proposal_paused") {
        appendMilestoneFeedLine("paused", event.reason, "");
      }
    };

    try {
      const result = await exec(onEvent, abortController.signal);
      if (!ownsTurn(true)) {
        ghostPreviewUpdater.cancel();
        return;
      }
      turnResult = result;
      endTurnProgress();
      if (abortController.signal.aborted || result.stoppedReason === "aborted") {
        ghostPreviewUpdater.cancel();
        clearAgentGhostPreview();
        setStatus("대기");
        streamedBubbles.forEach(renderStreamedMarkdown);
        return;
      }
      if (result.stoppedReason === "error") {
        turnFailed = true;
        ghostPreviewUpdater.cancel();
        clearAgentGhostPreview();
      } else {
        ghostPreviewUpdater.flush();
      }
      const completenessWarnings = result.stoppedReason === "error"
        ? []
        : proposalCompletenessWarnings({
            requestText,
            assistantText: result.assistantText,
            buildSpec: completenessSpecForProposal(confirmedBuildSpecThisTurn, activeSpecAtTurnStart, result.proposedCalls, requestText),
            calls: result.proposedCalls,
      });
      attachCompletenessWarnings(result.proposedCalls, completenessWarnings);
      streamedBubbles.forEach((bubble) => {
        renderStreamedMarkdown(bubble);
        foldWorkLogs(bubble);
      }); // 스트리밍 원문을 마크다운으로 다시 렌더.
      if (result.assistantText && !assistantBubble) {
        assistantBubble = appendBubble("assistant", result.assistantText);
        foldWorkLogs(assistantBubble);
      }
      const beforeProject = store.getCurrent();
      const afterProject = session.getProposedProject();
      const currentMapId = editorState.get().currentMapId ?? beforeProject.startMapId ?? null;
      const autoApproveEnabled = loadAiConfig().agentMode === "auto" || loadAiConfig().autoApprove === true;
      const verdict = classifyApproval(result.proposedCalls, { autoApproveEnabled });
      const explicitApprovalRequired = verdict.decision === "require_approval";
      const safety = classifyProposalSafety({
        calls: result.proposedCalls,
        before: beforeProject,
        after: afterProject,
        currentMapId,
        warnings: completenessWarnings,
      });
      const hasCurrentMapGhost = currentMapId && hasAgentGhostPreviewSubscribers()
        ? agentGhostPreviewsForMap(getAgentGhostPreviewState(), currentMapId).length > 0
        : false;
      const canvasFirst = safety.safe && !explicitApprovalRequired && hasCurrentMapGhost;
      if (
        result.proposedCalls.length > 0
        && completenessWarnings.length === 0
        && autoApproveEnabled
        && verdict.decision === "auto"
        && result.stoppedReason !== "error"
        && !explicitApprovalRequired
        && safety.safe
      ) {
        // 자동 적용도 전/후 비교를 보여준다. 이전엔 한 줄 시스템 버블 + 3초 뒤 setTimeout 으로
        // 사라지는 실행취소 버튼이 전부여서, 사용자는 무엇이 바뀌었는지 보지 못한 채 3초 안에
        // 판단해야 했다. 전/후 썸네일·자동 적용 토글·되돌리기를 한 카드에 모아 로그에 남긴다.
        const appliedSummary = result.proposedCalls.map((call) => call.summary || call.name).join(" · ");
        const appliedBubble = appendBubble("system", "");
        if (currentMapId) {
          appliedBubble.append(
            renderAppliedComparison({
              before: beforeProject,
              after: afterProject,
              mapId: currentMapId,
              summary: appliedSummary,
              appliedCount: result.proposedCalls.length,
              onUndo: () => {
                try {
                  undoMapEdit();
                  appliedBubble.remove();
                } catch {
                  // undo 스택이 버어진 경우는 카드를 남긴다 — 재시도할 수 있어야 한다.
                }
              },
            }),
          );
        } else {
          appliedBubble.textContent = `자동 적용됨 ${result.proposedCalls.length}건 — ${appliedSummary}`;
        }
        setStatus("대기");
        acceptProposal(result.proposedCalls);
      } else {
        renderProposal(
          result,
          result.proposedCalls.length === 0 ? completenessWarnings : [],
          assistantBubble,
          canvasFirst ? "canvas" : "modal",
        );
        if (result.proposedCalls.length === 0 && result.stoppedReason !== "error") {
          const silenced = result.assistantText ? ` — ${result.assistantText.slice(0, 80)}` : "";
          const emptyLabel = completenessWarnings.length > 0 ? `변경 없음(린트 경고 ${completenessWarnings.length}건)` : `변경 없음(0건)${silenced ? " · 되묻기/재시도 필요" : ""}`;
          setStatus(emptyLabel);
        } else {
          setStatus(
            result.stoppedReason === "error"
              ? "오류"
              : result.proposedCalls.length > 0
              ? "검토 대기"
              : !runningProgress
              ? "완료"
              : status.textContent ?? ""
          );
        }
      }
      if (result.assistantText) {
        renderQuickReplies(result.assistantText);
        // 마킹어 재렌더(위 streamedBubbles.forEach) 뒤에서 붙여야 쓸려나가지 않는다.
        decorateAssistantMentions(assistantBubble, result.assistantText, store.getCurrent());
      }
      // 밑그림 상태 표시 — 확정된 스펙이 있으면 사용자도 본다(다음 빌드가 이 영역 안에서만 실행됨).
      const activeSpec = session.getActiveSpec();
      if (activeSpec && result.proposedCalls.length === 0 && completenessWarnings.length === 0 && result.stoppedReason !== "error") {
        setStatus(`밑그림 확정 — 에셋 ${activeSpec.assets.length}개`);
      }
      if (result.error) appendErrorWithRetry(result.error, session, requestText);
    } catch (cause) {
      if (!ownsTurn(true)) return;
      if (abortController.signal.aborted) {
        setStatus("대기");
        return;
      }
      turnFailed = true;
      turnCatchError = cause instanceof Error ? cause.message : String(cause);
      endTurnProgress();
      ghostPreviewUpdater.cancel();
      clearAgentGhostPreview();
      setStatus("오류");
      const errorBubble = appendBubble("system", `오류: ${turnCatchError}`);
      // Any transport throw mounts settings opener — covers connection refused / 401 / network throw
      {
        const settingsBtn = el("button", {
          class: "ai-assistant-action ai-error-open-settings",
          text: "설정 열기",
          attrs: { type: "button", title: "어시스턴트 설정을 엽니다" },
          dataset: { testid: "ai-error-open-settings" },
          on: { click: () => openAiSettings("first") },
        });
        errorBubble.append(el("div", { class: "ai-retry-row", children: [settingsBtn] }));
      }
    } finally {
      ghostPreviewUpdater.cancel();
      if (!ownsTurn(true)) return;
      endTurnProgress();
      if (activeAbortController === abortController) activeAbortController = null;
      turnBusy = false;
      refreshAbortButton();
      // 자율 런 종료(정상 완료·중단·승인 대기 포함): 런 표면을 정리하고 자동 접기를 재개한다.
      // 다음 사용자 턴이 autonomous 로 시작되면 beginAutonomousRun 이 새 표면을 만든다.
      if (runOpts?.autonomous) endAutonomousRun();
      // 접힌 채로 턴이 끝나면 레일 점으로 알린다(초록=완료, 빨강=오류 — 펼치는 순간 소거).
      if (collapsed) panel.classList.add(turnFailed ? "is-turn-error" : "is-turn-attention");
      persistConversation(); // 매 턴 끝에 대화 기록을 저장한다(대화 기록 뷰어에서 다시 볼 수 있다).
      // 채팅 턴마다 활동 로그(로컬 + Supabase best-effort). 영역 작업은 runRegionTask 쪽에서 별도 기록.
      const cfg = loadAiConfig();
      const audit = session.getAuditEntries();
      const toolFromAudit = audit
        .filter((entry): entry is Extract<typeof entry, { kind: "tool" }> => entry.kind === "tool")
        .map((entry) => ({
          name: entry.name,
          args: entry.args,
          ok: entry.ok,
          summary: entry.summary,
        }));
      const toolFromProposed = (turnResult?.proposedCalls ?? []).map((call) => ({
        name: call.name,
        args: call.args,
        ok: call.result.ok,
        summary: call.summary,
      }));
      void recordAiActivity({
        channel: "chat",
        instruction: requestText,
        projectContextKey: projectConversationContextKey(store.getCurrent()),
        model: cfg.model,
        liteModel: cfg.liteModel,
        result: {
          ok: !turnFailed && turnResult?.stoppedReason !== "error" && !turnCatchError,
          error: turnCatchError ?? turnResult?.error,
          stoppedReason: turnResult?.stoppedReason,
          proposedCalls: turnResult?.proposedCalls.length,
          assistantText: turnResult?.assistantText,
        },
        toolCalls: toolFromAudit.length > 0 ? toolFromAudit : toolFromProposed,
        audit,
      }).catch(() => {
        /* ignore */
      });
      notifyIfObscuredByTestPlay(); // 결함 ④: 테스트 플레이 창이 패널을 가린 채 턴이 끝나면 알림.
      drainPendingSends(); // 결함 ⑨: 대기 큐의 다음 메시지를 순서대로 전송.
      // 접혀 시작한 턴만 종료 후 재접기. 이미 열린 패널은 그대로 둔다.
      if (collapseAfterAiWork) {
        if (turnFailed) {
          collapseAfterAiWork = false;
        } else if ((status.textContent ?? "") === "검토 대기") {
          /* stay open until onProposalSettled */
        } else if (hasPendingQuestion()) {
          /* AI가 답을 기다리는 중 — 사용자가 답하거나 직접 접을 때까지 열어 둔다
             (2026-08-18 UX 리뷰 P1-4: 질문이 자동 접힘으로 증발하던 결함) */
        } else {
          scheduleCollapseAfterAiWork();
        }
      }
    }
  };

  // LLM 오류 버블 + 수동 [재시도] 버튼(도그푸딩 결함 ⑥). 오류 메시지에는 llmClient가
  // 만든 원인(네트워크/429/5xx/인증 등)이 그대로 담긴다. 자동 재시도 1회(지수 백오프)는
  // llmClient.chatCompletion이 이미 수행했고, 여기의 버튼은 그 이후의 수동 재개다.
  const appendErrorWithRetry = (message: string, session: AssistantSession, requestText: string): void => {
    const bubble = appendBubble("system", `오류: ${message}`);
    const actions: HTMLElement[] = [];
    // Any transport failure mounts settings opener — do not threshold on message content.
    {
      const chatGptMode = loadAiConfig().authMode === "chatgpt";
      const settingsAction = el("button", {
        class: "ai-assistant-action ai-error-open-settings",
        text: "설정 열기",
        attrs: { type: "button", title: chatGptMode ? "ChatGPT 연결 설정을 엽니다" : "어시스턴트 설정을 열고 API 키 입력으로 이동합니다" },
        dataset: { testid: "ai-error-open-settings" },
        on: { click: () => openAiSettings(chatGptMode ? "first" : "apiKey") },
      });
      actions.push(settingsAction);
    }
    if (!session.canRetryLastTurn()) {
      if (actions.length > 0) bubble.append(el("div", { class: "ai-retry-row", children: actions }));
      log.scrollTop = log.scrollHeight;
      return;
    }
    const retry = el("button", {
      class: "ai-assistant-action ai-retry-turn",
      text: "재시도 — 같은 문맥에서 1회 재시도",
      attrs: { type: "button", title: "끊긴 턴을 같은 문맥에서 다시 시도합니다 (429/5xx는 자동 재시도 1회 후 수동 재시도로 이어짐)" },
      dataset: { testid: "ai-retry-turn" },
      on: {
        click: () => {
          retry.disabled = true;
          void executeTurn(session, requestText, (onEvent, signal) => session.retryLastTurn(onEvent, signal));
        },
      },
    }) as HTMLButtonElement;
    actions.unshift(retry);
    bubble.append(el("div", { class: "ai-retry-row", children: actions }));
    // 오류·복구 버튼이 로그 하단 잘림으로 반쯤 가려지던 결함(적대 평가 P1) — 끝까지 스크롤.
    log.scrollTop = log.scrollHeight;
  };

  const sendSelectionRegionTask = async (text: string): Promise<void> => {
    const selection = currentSelectionForRegionTask();
    if (!selection) {
      selectionTaskActive = false;
      refreshContextChips();
      await sendText(text);
      return;
    }
    // 실내/새 맵은 선택 영역 하드 클립에 담기지 않는다(audit 18: create_map 후 0칸 폐기).
    // 일반 채팅 전량 경로로 우회해 start_interior_room_session 등이 제안으로 남게 한다.
    if (isRegionEscapingIntent(text)) {
      selectionTaskActive = false;
      refreshContextChips();
      toast("실내·새 맵 요청은 선택 영역 밖 작업이라 일반 채팅으로 진행합니다", "info");
      await sendText(text);
      return;
    }
    if (turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    const abortController = new AbortController();
    const selectionKey = `${selection.mapId}:${selection.region.x}:${selection.region.y}:${selection.region.width}:${selection.region.height}`;
    activeAbortController = abortController;
    activeSelectionRegionController = abortController;
    activeSelectionRegionKey = selectionKey;
    abortNoticeShown = false;
    const ownsRegionRun = (allowAborted = false): boolean =>
      !disposed
      && activeAbortController === abortController
      && activeSelectionRegionController === abortController
      && activeSelectionRegionKey === selectionKey
      && (allowAborted || !abortController.signal.aborted);
    turnBusy = true;
    sendButton.disabled = true;
    collapseAfterAiWork = collapsed;
    expandForAiWork();
    revealVolatileZone();
    closeToolActivity();
    appendBubble("user", text);
    controller.auditHistory.push({ kind: "user", text, at: new Date().toISOString() });
    beginTurnProgress();
    refreshAbortButton();
    setStatus("영역 작업 중…");
    let assistantBubble: HTMLElement | null = null;
    let reasoningBox: { box: HTMLElement; body: HTMLElement } | null = null;
    let assistantMessageDisplayed = false;
    const streamedBubbles: HTMLElement[] = [];
    let currentStreamNodes: HTMLElement[] = [];
    const trackCurrentStreamNode = (node: HTMLElement): void => {
      if (!currentStreamNodes.includes(node)) currentStreamNodes.push(node);
    };
    const clearCurrentStreamAttempt = (): void => {
      const discarded = new Set(currentStreamNodes);
      currentStreamNodes.forEach((node) => node.remove());
      for (let index = streamedBubbles.length - 1; index >= 0; index -= 1) {
        if (discarded.has(streamedBubbles[index])) streamedBubbles.splice(index, 1);
      }
      for (const node of discarded) { if (isLastReasoningBox(node)) clearLastReasoning(); }
      currentStreamNodes = [];
      assistantBubble = null;
      reasoningBox = null;
    };
    const appendAssistantText = (content: string): void => {
      if (!content.trim()) return;
      assistantMessageDisplayed = true;
      closeToolActivity();
      appendBubble("assistant", content);
      controller.auditHistory.push({ kind: "assistant", text: content, at: new Date().toISOString() });
    };
    const onEvent = (event: SessionEvent): void => {
      if (!ownsRegionRun()) return;
      if (event.type === "phase") {
        runningPhaseStatus = phaseStatusText(event.value);
        if (runningProgress) refreshRunningStatus(true);
        else setStatus(runningPhaseStatus);
        return;
      }
      if (event.type === "assistant_stream_reset") {
        clearCurrentStreamAttempt();
        return;
      }
      if (event.type === "reasoning_token") {
        if (!reasoningBox) {
          reasoningBox = appendReasoning();
          trackCurrentStreamNode(reasoningBox.box);
        }
        reasoningBox.body.textContent = (reasoningBox.body.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
        return;
      }
      if (event.type === "assistant_token") {
        reasoningBox = null;
        if (!assistantBubble) {
          assistantBubble = appendBubble("assistant", "");
          streamedBubbles.push(assistantBubble);
          trackCurrentStreamNode(assistantBubble);
          closeToolActivity();
        }
        assistantBubble.textContent = (assistantBubble.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
        return;
      }
      if (event.type === "assistant_message") {
        if (!event.content.trim()) return;
        assistantMessageDisplayed = true;
        if (assistantBubble) {
          assistantBubble.textContent = event.content;
          currentStreamNodes = [];
        } else {
          appendAssistantText(event.content);
        }
        return;
      }
      if (event.type === "tool_call") {
        bumpToolProgress();
        appendToolLine(event.name, event.result, event.args);
        controller.auditHistory.push({
          kind: "tool",
          name: event.name,
          args: event.args,
          ok: event.result.ok,
          summary: event.result.summary,
          issues: event.result.issues?.map((issue) => issue.message),
          at: new Date().toISOString(),
        });
        assistantBubble = null;
        reasoningBox = null;
        currentStreamNodes = [];
        return;
      }
      if (event.type === "status") {
        setStatus(event.text);
        controller.auditHistory.push({ kind: "status", text: event.text, at: new Date().toISOString() });
        if (shouldShowStatusInChat(event.text)) appendBubble("system", event.text);
      }
    };

    try {
      const result = await runRegion({
        mapId: selection.mapId,
        region: selection.region,
        instruction: text,
        signal: abortController.signal,
        onEvent,
      });
      if (!ownsRegionRun()) {
        result.pending?.discard();
        return;
      }
      streamedBubbles.forEach(renderStreamedMarkdown);
      if (result.assistantText && !assistantMessageDisplayed) appendAssistantText(result.assistantText);
      const summary = describeRegionTaskResult(result);
      appendBubble("system", summary);
      controller.auditHistory.push({ kind: "status", text: summary, at: new Date().toISOString() });
      setStatus(result.ok ? (result.applied ? "적용됨" : "완료") : "오류");
      if (!result.ok && result.error) toast(`영역 작업 실패: ${result.error}`, "error");
    } catch (cause) {
      if (!ownsRegionRun()) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus("오류");
      appendBubble("system", `오류: ${message}`);
      controller.auditHistory.push({ kind: "status", text: `오류: ${message}`, at: new Date().toISOString() });
    } finally {
      if (!ownsRegionRun(true)) return;
      const cancelled = abortController.signal.aborted;
      activeSelectionRegionController = null;
      activeSelectionRegionKey = null;
      if (activeAbortController === abortController) activeAbortController = null;
      if (cancelled) setStatus("대기");
      const regionFailed = !cancelled && (status.textContent ?? "") === "오류";
      endTurnProgress();
      turnBusy = false;
      refreshAbortButton();
      if (collapsed && !cancelled) panel.classList.add(regionFailed ? "is-turn-error" : "is-turn-attention");
      persistConversation();
      if (!cancelled) notifyIfObscuredByTestPlay();
      drainPendingSends();
      if (collapseAfterAiWork) {
        if (regionFailed) collapseAfterAiWork = false;
        else scheduleCollapseAfterAiWork();
      }
    }
  };

  // 풀스크린 시연 실행 창이 AI 패널을 가리고 있으면, 턴 완료를 사용자에게 알린다
  // (도그푸딩 결함 ④ — 모달 뒤에서 턴/프로포절이 조용히 진행되던 문제). 자동으로 창을
  // 닫거나 열지 않는다: 완료 알림 + 기존 수동 버튼(편집으로/닫기)으로 확인하게 한다.
  const notifyIfObscuredByTestPlay = (): void => {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
    if (!document.querySelector('[data-testid="test-play-window"]')) return;
    toast("AI 응답 완료 — 시연 실행 창 뒤에 결과/제안이 있습니다. '편집으로'를 눌러 확인하세요.", "info");
  };

  // 마지막으로 직접 입력한 요청 — "내 스킬로 저장"의 기본 템플릿이 된다.
  let lastTypedMessage = "";
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
    lastTypedMessage = text;
    input.value = "";
    syncInputHeight();
    refreshSlash();
    refreshSendEnabled();
    if (selectionTaskActive && currentSelectionForRegionTask()) await sendSelectionRegionTask(text);
    else await sendText(text);
  };

  sendButton.addEventListener("click", () => void send());
  input.addEventListener("keydown", (event) => {
    // 엔터 = 즉시 전송, Shift+Enter = 줄바꿈. IME 조합 중(한글 입력 확정)에는 전송하지 않는다.
    const composing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
    // Escape 우선순위: 열린 팝오버 → 선택 영역 작업. 팝오버가 떠 있는데 선택 컨텍스트가
    // 먼저 해제돼 사용자가 "무엇이 닫혔는지" 알 수 없던 문제를 없앤다.
    if (event.key === "Escape") {
      if (composerPopoverKind() === "slash") {
        event.preventDefault();
        slashDismissed = true;
        refreshSlash();
        return;
      }
      if (composerPopoverKind() !== null) {
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
    // 방향키·Tab 가로채기는 **슬래시 목록이 열려 있을 때만**. 이전엔 값이 "/" 로
    // 시작하기만 하면 항상 가로채 여러 줄 입력의 캐럿 이동이 죽었다.
    if (composerPopoverKind() === "slash" && !composing) {
      const query = slashQuery();
      const count = query === null ? 0 : slashSkillMatches(query).length;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (count > 0) slashActiveIndex = (slashActiveIndex + 1) % count;
        refreshSlash();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (count > 0) slashActiveIndex = (slashActiveIndex - 1 + count) % count;
        refreshSlash();
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        if (pickActiveSlashSkill()) {
          event.preventDefault();
          return;
        }
      }
    }
    if (event.key === "Enter" && !event.shiftKey && !composing) {
      event.preventDefault();
      void send();
    }
  });

  // 시연으로 가르치기: AI 추측이 틀렸을 때 말 대신 샌드박스에 직접 깔아서 보여준다.
  // 붓질 순서+설명이 메시지로 전달되고, 시연 결과는 채팅에 그리드 이미지로 남는다.
  const startDemoTeach = (seed: DemoTeachSeed | null): void => {
    openDemoTeachModal({
      seed,
      onSend: (payload: DemonstrationPayload) => {
        appendTileGrid({
          tilesetId: DEFAULT_TILESET_ID,
          x: payload.seed?.x ?? 0,
          y: payload.seed?.y ?? 0,
          w: payload.w,
          h: payload.h,
          lower: payload.lower,
          upper: payload.upper,
        });
        void sendText(buildDemonstrationMessage(payload), `✍️ 시연 — 직접 깐 타일(${payload.strokes.length}회 붓질)로 보여줬습니다.`);
      },
    });
  };

  // ── 스킬 서랍 + 슬래시 + 컨텍스트 칩(전면 재배치 2026-07-05) ─────
  const getSkillContext = (): SkillRunContext => {
    const state = editorState.get();
    const project = store.getCurrent();
    const mapId = state.currentMapId ?? project.startMapId ?? null;
    return {
      mapId,
      mapName: mapId ? project.maps[mapId]?.name ?? null : null,
      selection: state.selection
        ? { mapId: state.selection.mapId, x: state.selection.x, y: state.selection.y, width: state.selection.width, height: state.selection.height }
        : null,
      tileset: currentTilesetSkillContext(),
    };
  };

  const drawer = renderSkillDrawer({
    getContext: getSkillContext,
    onRunPrompt: (prompt, displayAs) => {
      void sendText(prompt, displayAs);
    },
    onAction: (skillId) => {
      if (skillId !== "demo-teach") return;
      const selection = editorState.get().selection;
      startDemoTeach(selection ? { mapId: selection.mapId, x: selection.x, y: selection.y, w: selection.width, h: selection.height } : null);
    },
    getSavePrefill: () => lastTypedMessage,
  });

  const runSkillPrompt = (skill: SkillDef, args: Record<string, SkillArgValue>): void => {
    const prompt = skill.buildPrompt?.(args, getSkillContext()) ?? "";
    if (!prompt.trim()) {
      toast("AI 스킬을 시작할 수 없습니다.", "error");
      return;
    }
    recordSkillUse(skill.id);
    drawer.element.hidden = true;
    drawer.element.inert = drawer.element.hidden;
    // 채팅 표시도 TUI 명령 줄 — "🏠 집 짓기" 같은 앱 라벨 쓰지 않음.
    // explicitSkillId: 집/실내 되묻기 게이트를 건너뛰고 스킬이 고른 경로를 신뢰한다.
    void sendText(prompt, `/${skill.id}`, { explicitSkillId: skill.id });
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

  // 스킬 검색은 ☰ 메뉴 항목이다. 컴포저 하단에 `/` 단독 버튼으로 서 있던 것을 걷었다
  // (감독 지시 2026-08-21: 유리·사이드에서 레일 한 열이 이 버튼 하나만 담아 난장판).
  // 키보드 경로(입력창에 "/" 타이핑)가 주 진입점이고 이 항목은 발견 가능성용이다.
  const skillToggle = el("button", {
    class: "ai-command-menu-item ai-skill-toggle",
    html: '스킬 찾기<span class="ai-command-menu-key">/</span>',
    attrs: { type: "button", role: "menuitem", title: "스킬 검색 (/)", "aria-label": "스킬 검색 열기", "aria-expanded": "false" },
    dataset: { testid: "ai-skill-slash-toggle" },
    on: {
      click: () => {
        if (composerPopoverKind() === "slash") {
          slashDismissed = true;
          refreshSlash();
          return;
        }
        // 슬래시 질의의 단일 소스는 입력창이다. 버튼이 별도 질의 상태를 들면 목록과
        // 실제 전송될 문자열이 갈라지므로, 버튼도 같은 입력창에 "/" 를 채운다.
        if (!input.value.startsWith("/")) input.value = "/";
        input.focus();
        slashDismissed = false;
        slashActiveIndex = 0;
        refreshSlash();
      },
    },
  });

  // 슬래시 자동완성: "/집"처럼 입력하면 컴포저 위 팝오버로 스킬 목록이 뜬다.
  // (구조: 흐름 안이 아니라 absolute 팝오버 — 목록이 바를 밀어올려 입력창 위치가
  //  움직이던 결함 수정. aiComposer.ts 주석 참조.)
  const slashHost = el("div", { class: "ai-slash-host", dataset: { testid: "ai-slash-host" } });
  let slashActiveIndex = 0;
  // Escape 로 목록만 닫는다 — 입력은 지우지 않는다. 다시 타이핑하면 해제된다.
  let slashDismissed = false;
  /** 슬래시 질의(단일 소스 = 입력창). 여러 줄이면 슬래시 모드가 아니다 —
   *  값이 "/" 로 시작하기만 하면 ↑↓ 를 가로채 캐럿 이동을 먹던 결함 수정. */
  const slashQuery = (): string | null => {
    const value = input.value;
    if (!value.startsWith("/") || value.includes("\n")) return null;
    return value;
  };
  const refreshSlash = (): void => {
    const query = slashDismissed ? null : slashQuery();
    if (query === null) {
      slashHost.replaceChildren();
      slashActiveIndex = 0;
      if (composerPopoverKind() === "slash") openComposerPopover(null);
      ensureStartScreen();
      return;
    }
    if (startScreen?.closest(".ai-rising-overlay")) {
      removeStartScreen();
    }
    const matches = slashSkillMatches(query);
    slashActiveIndex = Math.max(0, Math.min(slashActiveIndex, Math.max(0, matches.length - 1)));
    slashHost.replaceChildren(
      renderSlashList(
        query,
        (skill) => {
          input.value = "";
          refreshSlash();
          drawer.run(skill);
        },
        {
          activeIndex: slashActiveIndex,
          onViewAll: () => {
            input.value = "";
            refreshSlash();
            if (drawer.element.hidden) drawer.toggle();
            else drawer.refresh();
          },
        }
      )
    );
    openComposerPopover("slash");
  };
  const pickActiveSlashSkill = (): boolean => {
    const query = slashQuery();
    if (query === null) return false;
    const skill = slashSkillMatches(query)[slashActiveIndex];
    if (!skill) return false;
    input.value = "";
    refreshSlash();
    drawer.run(skill);
    return true;
  };
  // 여러 줄 입력 자동 성장 — 고정 높이 창에 30줄이 갇혀 끝부분만 보이던 결함(적대 평가 P1).
  // 내용 높이에 맞춰 늘리고, 상한(요소 max-height)부터는 스크롤로 전환한다.
  // 바 높이가 변하는 유일한 경로이므로 여기서만 clearance 를 다시 잰다.
  const syncInputHeight = (): void => {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight + 2}px`; // +2: 테두리로 인한 1줄 스크롤 잔상 방지
    syncCommandBarClearance();
  };
  input.addEventListener("input", () => {
    slashActiveIndex = 0;
    slashDismissed = false; // 다시 타이핑하면 Escape 로 닫은 목록이 돌아온다.
    refreshSlash();
    syncInputHeight();
    refreshComposerChips();
    refreshSendEnabled();
  });
  // 입력창 포커스 시 휘발 존(웰컴/대화)을 펼치고, 빈 대화 상태로 포커스를 잃으면 접어 맵을 비운다.
  input.addEventListener("focus", () => {
    revealVolatileZone();
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
  const refreshNextSteps = (): void => {
    if (typeof document === "undefined") return;
    const brief = readAgentBrief();
    const hasLog = Boolean(log.querySelector("[data-testid=ai-command-row-assistant]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-user]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row]"));
    const busy = hasLog || Boolean(turnBusy || runningProgress);
    const dock = readChatDock();
    const show = (dock === "glass" || dock === "side")
      && readTemperature() === "quiet-gold"
      && !busy
      && input.value.trim() === "";
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
    const children: HTMLElement[] = [
      el("p", {
        class: "ai-next-steps-hint",
        dataset: { testid: "ai-next-steps-hint" },
        text: nextStepHint(brief),
      }),
      buildAiAuthoringExamples({
        examples: AI_AUTHORING_EXAMPLES.slice(0, 2),
        onPick: pickExample,
      }),
    ];

    nextSteps.replaceChildren(...children);
  };
  // 추천 칩 팝오버는 입력창이 비어 있고 포커스가 있을 때만 뜬다(float 전용 —
  // 유리·사이드는 ai-next-steps 카드가 같은 일을 한다). 흐름 밖이라 열림/닫힘이
  // 바 높이를 건드리지 않는다.
  const syncSuggestPopover = (): void => {
    if (typeof document === "undefined") return;
    const focused = document.activeElement === input;
    const wantOpen =
      readChatDock() === "float"
      && focused
      && input.value.trim() === ""
      && composerChips.childElementCount > 0;
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
    const ctx = getSkillContext();
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
    refreshDockLabels();
    refreshTemperatureChrome();
  });
  const unsubscribeContextStore = store.subscribe(() => {
    refreshContextChips();
    refreshComposerChips();
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
    class: "ai-chat-collapse",
    attrs: { type: "button", title: "패널 접기/펼치기", "aria-label": "AI 패널 접기/펼치기", "aria-expanded": String(!collapsed) },
    dataset: { testid: "ai-collapse" },
  }) as HTMLButtonElement;
  const collapsedRestore = createDirectorRestoreButton();

  const directorPlate = createDirectorPlate();
  // 1차 크롬: ＋ 새 대화 · ☰ 더보기 · 접기. AI 설정은 앱 헤더가 단독 소유한다.
  const openToolsBrowser = (): void => {
    void openToolBrowserModal();
  };
  const openHarness = (): void => {
    void openHarnessModal({
      audit: [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])],
      statusTimeline: controller.statusTimeline,
      getSnapshot: () => controller.session?.getHarnessSnapshot() ?? null,
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
  const currentChatDock = (): ChatDock => readChatDock();
  let refreshDockLabels: () => void = () => {};
  let syncGlassIdle: () => void = () => {};
  const applyTemperature = (next: AssistantTemperature): void => {
    const parsed = parseAssistantTemperature(next);
    if (options.onAssistantTemperatureChange) options.onAssistantTemperatureChange(parsed);
    else {
      editorState.set({ assistantTemperature: parsed });
      persistAssistantTemperature(parsed);
    }
    refreshTemperatureChrome();
  };
  const changeDock = (next: ChatDock): void => {
    if (options.onChatDockChange) options.onChatDockChange(next);
    else editorState.set({ chatDock: next });
    refreshDockLabels();
  };
  const onDockToggleClick = (): void => {
    if (turnBusy || runningProgress) {
      toast("작업이 끝난 뒤에 위치를 바꿀 수 있습니다.", "info");
      return;
    }
    if (options.onChatDockToggle) options.onChatDockToggle();
    else changeDock(cycleChatDock(currentChatDock()));
    refreshDockLabels();
  };
  // testid 호환용 숨은 토글(레이아웃 테스트·E2E).
  const dockToggleButton = el("button", {
    class: "ai-chat-tools-button",
    attrs: { type: "button", hidden: "", "aria-hidden": "true" },
    dataset: { testid: "chat-dock-toggle" },
    on: { click: onDockToggleClick },
  }) as HTMLButtonElement;
  // (구 `chat-dock-toggle-bar` 훅 삭제 — src/ test/ 어디에서도 참조가 없었고
  //  같은 동작을 `chat-dock-toggle` 이 이미 제공한다. 실측: grep 참조 0건.)
  // 도킹은 2모드만(float/side) — studio/collapsed는 별도 상태이며 도크 선택에 노출하지 않는다.
  // z-layers: panel 30 / bar 40 / overlay 41 / palette 80 — 56/50/62 난장 정리
  // 도크 모드 토글: 플로팅 커맨드 바와 더보기 메뉴에만 둔다(헤더 뱃지 제거 = 시각 소음 감소).
  const dockModeButton = el("button", {
    class: "ai-dock-mode-btn",
    attrs: { type: "button" },
    dataset: { testid: "ai-dock-mode-btn", dockMode: currentChatDock() },
    on: { click: onDockToggleClick },
  }) as HTMLButtonElement;
  dockToggleLock = dockModeButton;
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
          return;
        }
        downloadJson("ai-session-audit.json", json);
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
    on: {
      click: () => {
        persistConversation();
        dropSession(controller);
        endAutonomousRun(); // 새 대화 — 이전 자율 런의 계획/예산/피드를 버린다.
        controller.auditHistory = [];
        conversationId = genId("conv");
        setPendingProposalMessage(null);
        setLastAppliedProposalMessage(null);
        proposalApi.clearInlineActionsIfMine();
        proposalHost.replaceChildren();
        closeProposalModal();
        chipsHost.replaceChildren();
        log.replaceChildren();
        startScreen = null;
        ensureStartScreen();
        setStatus("새 대화");
        refreshExportButton();
        toast("새 대화를 시작했습니다. 이전 대화는 기록에 저장됐습니다.", "ok");
      },
    },
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
        const next = order[(order.indexOf(loadAiFontSize()) + 1) % order.length];
        saveAiFontSize(next);
        applyAiFontSize(panel, next);
      },
    },
  });

  // 헤더 햄버거 메뉴 (2차 액션 통합).
  const moreMenu = el("div", {
    class: "ai-more-menu",
    attrs: { role: "menu", hidden: "" },
    dataset: { testid: "ai-more-menu" },
  });
  // 도크 항목은 두 메뉴가 각자 하나씩 갖는다(같은 빌더 산출물). 메뉴 조립 후 대입된다.
  let moreMenuDockItem: HTMLButtonElement | null = null;
  let commandDockItem: HTMLButtonElement | null = null;
  const applyDockModeChrome = (mode: ChatDock): void => {
    const actionLabel = nextChatDockActionLabel(mode);
    const nextHint = chatDockHint(mode);
    directorPlate.setName("조수");
    dockModeButton.textContent = actionLabel;
    dockModeButton.dataset.dockMode = mode;
    dockModeButton.setAttribute("title", nextHint);
    dockModeButton.setAttribute("aria-label", nextHint);
    for (const item of [moreMenuDockItem, commandDockItem]) {
      if (!item) continue;
      item.textContent = actionLabel;
      item.setAttribute("title", nextHint);
    }
  };
  const refreshMoreMenuDockLabel = (): void => {
    applyDockModeChrome(currentChatDock());
  };
  refreshMoreMenuDockLabel();
  const closeMoreMenu = (): void => {
    moreMenu.hidden = true;
    moreMenuToggle.setAttribute("aria-expanded", "false");
  };
  const positionMoreMenu = (): void => {
    const isGlass = currentChatDock() === "glass";
    if (isGlass) {
      moreMenu.classList.remove("is-viewport-anchored");
      moreMenu.style.left = "";
      moreMenu.style.top = "";
      moreMenu.style.right = "0";
      return;
    }
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
          refreshMoreMenuDockLabel();
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
  // 두 메뉴가 공유하는 5개 항목의 유일한 구현(aiActionMenu.ts). 컨테이너·열림 상태만 표면마다 다르다.
  const sharedMenuActions: AiActionMenuActions = {
    undoLast: () => undoLastButton.click(),
    exportAudit: () => exportButton?.click(),
    toggleDock: () => onDockToggleClick(),
    openHistory: () => {
      historyButton.click();
      applyHistoryOpen(true);
    },
    openTools: () => toolsButton.click(),
  };
  // 더보기: 일상 액션 + 설정. 스튜디오·하네스·글자 크기는 숨은 툴바 훅으로 유지(고급).
  const headerMenu = createAiActionMenuItems({
    variant: "header",
    close: closeMoreMenu,
    actions: sharedMenuActions,
  });
  moreMenuDockItem = headerMenu.dockItem;
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
        attrs: { title: "되돌리기·내보내기·도크·기록·툴" },
      }),
      ...headerMenu.items,
    ],
  });
  moreMenu.replaceChildren(headerTemperatureSection, headerActionsFold);
  const detachButton = el("button", {
    class: "ai-chat-icon-btn ai-chat-detach-btn",
    text: "↗",
    attrs: { type: "button", title: "조수 패널 떼기", "aria-label": "조수 패널 떼기" },
    dataset: { testid: "ai-chat-detach" },
    on: { click: () => changeDock("float") },
  });
  const moreWrap = el("div", {
    class: "ai-more-wrap",
    children: [moreMenuToggle, moreMenu],
  });

  const header = el("div", {
    class: "ai-chat-header",
    children: [
      el("div", {
        class: "ai-header-title-row",
        children: [directorPlate.element],
      }),
      el("span", {
        class: "ai-header-actions",
        children: [newSessionButton, dockModeButton, detachButton, moreWrap],
      }),
      collapseButton,
    ],
  });
  // 숨은 훅 컨테이너(화면에 안 보임: hidden + inert + CSS display:none).
  // "죽은 버튼" 이 아니다 — 실측(2026-08-22) 결과 여기 담긴 9개 중 8개는 테스트가 직접
  // 참조하고(ai-tools-browser 3파일 · ai-studio-toggle 3 · ai-dock-toggle 3 ·
  // chat-dock-toggle 3 · ai-export 2 · ai-undo-last 2 · ai-harness 1 · ai-font-cycle 1),
  // ☰ 메뉴 항목들도 이 버튼의 click() 을 눌러 동작한다. 참조가 0건이던 것은
  // chat-dock-toggle-bar 하나뿐이라 그것만 걷었다. 지우려면 테스트 계약부터 옮겨야 한다.
  const toolbar = el("div", {
    class: "ai-chat-toolbar is-empty",
    dataset: { testid: "ai-chat-toolbar" },
    attrs: { hidden: "" },
    children: [toolsButton, harnessButton, studioButton, historyButton, dockToggleButton, exportButton, undoLastButton, fontButton],
  });
  toolbar.inert = true;

  // 하단 컴포저: 입력 + 고정 액션 행 한 줄(세로 레일 없음).
  // 슬래시 목록·추천 칩·액션 메뉴는 흐름 밖 팝오버 — 바 높이는 입력 줄 수만 따른다.
  const composerShell: ComposerElements = createComposerElements({
    input,
    sendButton,
    abortButton,
    skillToggle,
    slashHost,
    contextChips,
    composerChips,
    queueIndicator,
    statusGroup,
    onPopoverChange: () => syncCommandBarClearance(),
  });
  const commandBar = composerShell.commandBar;
  const commandMenu = composerShell.commandMenu;
  const commandMenuToggle = composerShell.commandMenuToggle;
  openComposerPopover = composerShell.openPopover;
  composerPopoverKind = composerShell.openKind;
  dockModeButton.hidden = false;
  dockModeButton.removeAttribute("aria-hidden");
  const volatileLogMount = el("div", {
    class: "ai-rising-volatile-zone",
    dataset: { testid: "ai-rising-volatile-zone" },
    children: [log],
  });
  volatileZone = volatileLogMount;
  volatileZone.classList.add("ai-volatile-dashed");
  volatileZone.setAttribute("title", "휘발 영역 — 대화가 비어 있을 때 접히고, 입력 포커스 시 펼쳐집니다");
  volatileLogMount.hidden = true;
  const completionHost = el("div", {
    class: "ai-completion-host",
    dataset: { testid: "ai-completion-host" },
  });
  const stickyProposalZone = el("div", {
    class: "ai-rising-sticky-zone",
    dataset: { testid: "ai-rising-sticky-zone" },
    // 적용 완료 액션과 0건 알림, '검토 대기' pill은 맵 위에서 잃지 않는 고정 영역이다.
    children: [completionHost, proposalNoticeHost, proposalPill],
  });
  // 오버레이는 **휘발 로그 전용**이다. 제안 pill·완료 스트립(stickyProposalZone)은 여기 두면
  // 안 된다 — 오버레이는 사이드 도크에서만 마운트되므로, 기본 도크인 유리와 float 에서는
  // 스티키 존이 문서에서 통째로 빠져 "나중에" 로 최소화한 pill 과 적용 완료 스트립이 사라졌다
  // (2026-08-23 실측: glass/float 에서 .ai-proposal-pill 조회 결과 없음). 그래서 스티키 존은
  // 도크와 무관하게 패널 자식으로 붙이고, 위치는 CSS 가 도크별로 잡는다.
  const risingOverlay = el("div", {
    class: "ai-rising-overlay",
    dataset: { testid: "ai-rising-overlay" },
    children: [volatileLogMount],
  });
  const historyLogMount = el("div", { class: "ai-history-log-mount" });
  // AI 표면은 기본/전문가 공통 — expert-only board 없음. 시작 화면·스킬·기록이 동일.
  const glassLogMount = el("div", {
    class: "ai-glass-log",
    dataset: { testid: "ai-glass-log" },
  });
  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [nextSteps, glassLogMount, historyLogMount, chipsHost],
  });
  const body = el("div", { class: "ai-chat-body", children: [mainColumn, drawer.element] });

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "조수" },
    dataset: {
      testid: "ai-panel",
      uiDensity: "shared",
      chatDock: currentChatDock(),
      temperature: readTemperature(),
    },
    children: [header, toolbar, body, collapsedRestore, risingOverlay, pinHost, stickyProposalZone, commandBar, proposalModalRoot],
  });
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
  // 헤드리스/콘솔 디버깅용 하네스 접근점: window.__oprnAiHarness() → 주입 포함 원본 메시지 + 감사 로그.
  const harnessAccessor = () => controller.session?.getHarnessSnapshot() ?? null;
  if (typeof window !== "undefined") {
    window.__oprnAiHarness = harnessAccessor;
  }

  // 크기 커스텀 — **유리 카드 전용**. 예전 applySize 는 chat-dock-float / -glass / -side 세
  // 경우 전부에서 style 을 비우고 빠져나갔고, ChatDock 은 언제나 그 셋 중 하나(chatDock.ts)라
  // 저장된 PanelSize 가 어떤 상태에서도 적용되지 않는 죽은 코드였다(실측: 유리 카드가
  // 부팅·포커스·타이핑·도크 순환 내내 360x620 고정).
  //
  // 유리만 여는 이유: 사이드는 폭을 에디터 셸의 열(`chat-side-panel`)이 들고 있어 패널
  // 인라인 폭으로는 열이 좁아지지 않고, float 은 inset:0 전면 오버레이라 패널 크기 자체가
  // 의미를 갖지 않는다(바 위치는 CSS 가 잡는다). 크기는 도크별 키로 저장한다 — 360px 카드와
  // 533px 열을 한 값으로 담을 수 없기 때문이다.
  // 도크 판정은 `currentChatDock()` 을 본다 — `chat-dock-*` **클래스**는 에디터 셸(editorLayout)이
  // 부여하므로 패널만 마운트하는 단위 환경에서는 붙지 않았다. 패널이 항상 소유하는
  // 것은 dataset.chatDock 과 이 접근자다.
  const resizableDock = (): boolean =>
    currentChatDock() === "glass"
    && !panel.classList.contains("is-studio")
    && !panel.classList.contains("is-docked");
  const viewportNow = (): { width: number; height: number } =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  let panelSize = loadDockPanelSize("glass");
  // 크기만 건드린다. 이전 구현은 `setAttribute("style", "")` 로 인라인을 통째 지웠고,
  // 그러면 syncCommandBarClearance 가 같은 인라인에 실어놓는 --ai-command-bar-clearance 까지
  // 함까 날아간다 — 둥지리에 사는 두 사용자가 서로를 지우는 구조였다.
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  const applySize = (): void => {
    if (collapsed || !panelSize || !resizableDock()) {
      for (const prop of sizeProps) panel.style[prop] = "";
      return;
    }
    const fitted = clampPanelSizeToViewport(panelSize, viewportNow());
    // max-width/max-height 도 같이 푼다 — 유리 CSS 가 카드를 min(260px, 28%) 로 묶고 있어
    // 폭만 인라인으로 줘도 상한이 이겨 실제로 커지지 않는다(02-chat-dock.css:96).
    panel.style.width = `${fitted.width}px`;
    panel.style.height = `${fitted.height}px`;
    panel.style.maxWidth = `${fitted.width}px`;
    panel.style.maxHeight = `${fitted.height}px`;
  };
  const resizeHandle = el("div", {
    class: "ai-chat-resize-handle is-corner-end",
    attrs: { title: "드래그로 조수 카드 크기 조절", "aria-label": "조수 카드 크기 조절" },
    dataset: { testid: "ai-resize-handle" },
  });
  let activeResizeCleanup: (() => void) | null = null;
  resizeHandle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizableDock()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : { width: 320, height: 480 };
    const startWidth = panelSize?.width ?? (rect.width || 360);
    const startHeight = panelSize?.height ?? (rect.height || 620);
    const onMove = (move: PointerEvent): void => {
      // 유리 카드는 왼상단에 고정된다(`inset: 12px auto auto 12px`). 그러니 코너를
      // 오른쪽·아래로 끌 때 커지는 것이 문자대로 자연하다. 이전 식은 `startX - clientX` 로
      // 왼쪽으로 끌 때 커지는 우하단 야커 가정이어서 서로 반대였다.
      panelSize = clampPanelSize({
        width: startWidth + (move.clientX - startX),
        height: startHeight + (move.clientY - startY),
      });
      applySize();
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (activeResizeCleanup === cleanupResize) activeResizeCleanup = null;
    };
    const onUp = (): void => {
      cleanupResize();
      if (panelSize) saveDockPanelSize("glass", panelSize);
    };
    activeResizeCleanup = cleanupResize;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  panel.append(resizeHandle);
  // 반응형: 창이 좁아지면 자장된 크기를 화면 안으로 다시 맞춘다(생손된 값은 그대로 남긴다).
  const onViewportResize = (): void => applySize();
  if (typeof window !== "undefined") window.addEventListener("resize", onViewportResize);

  const remountComposerTail = (includeOverlay: boolean): void => {
    const tail: HTMLElement[] = includeOverlay
      ? [risingOverlay, pinHost, stickyProposalZone, commandBar, proposalModalRoot, resizeHandle]
      : [pinHost, stickyProposalZone, commandBar, proposalModalRoot, resizeHandle];
    for (const node of tail) node.remove();
    panel.append(...tail);
  };
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
  const logSlotForDock = (mode: ChatDock): "glass" | "volatile" | "none" => {
    switch (mode) {
      case "glass":
        return "glass";
      case "side":
        return "volatile";
      case "float":
        // float 도 유리 마운트에 로그를 유지한다 — 바와 로그를 함께 유지해 상태/오류가 증발하지 않게.
        return "glass";
      default: {
        const unreachable: never = mode;
        throw new Error(`unknown chat dock: ${String(unreachable)}`);
      }
    }
  };
  const mountLog = (): void => {
    const slot = historyOpen || studio ? "history" : logSlotForDock(readChatDock());
    const target = slot === "history"
      ? historyLogMount
      : slot === "glass"
        ? glassLogMount
        : slot === "volatile" ? volatileLogMount : null;
    panel.dataset.logSlot = slot;
    if (log.parentElement === target) return;
    log.remove();
    target?.append(log);
  };
  syncGlassIdle = (): void => {
    const busy = panel.classList.contains("is-turn-running")
      || Boolean(panel.querySelector("[data-testid=ai-proposal-pin]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-assistant]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-user]"))
      || Boolean(turnBusy || runningProgress);
    const idle = !busy;
    const dock = readChatDock();
    panel.classList.toggle("is-assistant-idle", idle);
    panel.classList.toggle("is-glass-idle", idle && dock === "glass");
    panel.classList.toggle("is-map-first-idle", idle && dock !== "float" && readTemperature() === "map-first");
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
    const mode = readChatDock();
    if (!historyOpen && !studio) removeStartScreen();
    // 오버레이(혼발 존 + 고정 제안 영역)는 사이드 도크만 가진다. 유리는 카드 본밸에
    // 로그를 단고, float 은 바만 남긴다 — 테스트 계약이다(aiPanelChrome:
    // "side dock mounts the work log, and switching back to float unmounts it").
    if (mode === "side") {
      if (!panel.contains(risingOverlay)) remountComposerTail(true);
    } else {
      risingOverlay.remove();
    }
    mountLog();
    if (panel.dataset.logSlot === "volatile" && volatileZone) {
      volatileZone.hidden = false;
    }
    if (mode === "glass") {
      syncGlassIdle();
      return;
    }
    panel.classList.remove("is-glass-idle");
    refreshNextSteps();
  };

  const applyCollapsed = (): void => {
    if (collapsed) panel.classList.add("is-collapsed");
    else {
      panel.classList.remove("is-collapsed");
      // 접힌 동안 쌓인 알림 점(완료/오류)은 펼치는 순간 확인한 것으로 보고 지운다.
      panel.classList.remove("is-turn-attention", "is-turn-error");
    }
    collapseButton.textContent = collapsed ? "▸" : "▾";
    collapseButton.setAttribute("title", collapsed ? "AI 패널 펼치기" : "AI 패널 접기");
    collapseButton.setAttribute("aria-label", collapsed ? "AI 패널 펼치기" : "AI 패널 접기");
    collapseButton.setAttribute("aria-expanded", String(!collapsed));
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
  };
  const restoreCollapsed = (): void => {
    if (!collapsed) return;
    clearAutoCollapseTimer();
    collapsed = false;
    collapseAfterAiWork = false; // 레일 클릭으로 연 직후 타이머에 다시 접히지 않게
    savePanelCollapsed(false);
    applyCollapsed();
  };
  collapseButton.addEventListener("click", toggleCollapsed);
  collapsedRestore.addEventListener("click", restoreCollapsed);
  applyCollapsed();
  refreshSendEnabled(); // 부트 직후도 보낼 게 없으므로 전송은 비활성에서 시작해야 한다.

  let completionStripHandle: AiCompletionStripHandle | null = null;
  const renderCompletion = (context: AiApplyCompletionContext | null): void => {
    completionStripHandle?.dispose();
    completionStripHandle = null;
    completionHost.replaceChildren();
    if (!context || disposed) return;
    completionStripHandle = buildAiCompletionStrip({ context });
    completionHost.append(completionStripHandle.element);
  };
  const unsubscribeCompletion = subscribeAiApplyCompletion(renderCompletion);

  applyHistoryOpen = (next: boolean): void => {
    historyOpen = next;
    if (historyOpen) {
      panel.classList.add("is-history-open");
      // side flex 도크에서는 본문이 곧 기록 영역 — fixed is-docked 오버레이를 켜지 않는다.
      if (!panel.classList.contains("chat-dock-side")) panel.classList.add("is-docked");
      else panel.classList.remove("is-docked");
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
      // side/float 공통: fixed 오버레이 inset 도킹 body 클래스는 쓰지 않는다(이중 패딩 흔들림).
      document.body.classList.remove("ai-panel-docked");
      document.body.classList.add("ai-command-bar-active");
    }
    applySize();
    applyComposerViewPolicy();
  };
  historyButton.addEventListener("click", () => applyHistoryOpen(!historyOpen));

  // 스튜디오 모드 적용: 넓은 레이아웃 + 스킬 레일 상시 노출.
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
      // 스튜디오는 전체 오버레이라 기록 패널을 넓은 워크스페이스로 전환한다.
      historyOpen = true;
      panel.classList.remove("is-docked");
      if (typeof document !== "undefined" && document.body) document.body.classList.remove("ai-panel-docked");
      drawer.element.hidden = false;
      drawer.element.inert = drawer.element.hidden;
      drawer.refresh();
      studioButton.setAttribute("aria-label", "AI 스튜디오 되돌리기");
      applyComposerViewPolicy();
    } else {
      panel.classList.remove("is-studio");
      drawer.element.hidden = true;
      drawer.element.inert = drawer.element.hidden;
      studioButton.setAttribute("aria-label", "AI 스튜디오 펼치기");
      applyHistoryOpen(false);
    }
  };
  studioButton.addEventListener("click", () => applyStudio(!studio));

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
  commandDockItem = composerMenu.dockItem;
  refreshDockLabels = (): void => {
    const mode = currentChatDock();
    panel.dataset.chatDock = mode;
    applyDockModeChrome(mode);
    applyComposerViewPolicy();
    // 유리·사이드는 레일에서 ✨ 를 숨긴다(ai-next-steps 카드가 대신) — 도크를 바꿀 때
    // 떠 있던 추천 팝오버를 정리하지 않으면 보이지 않는 팝오버가 남는다.
    syncSuggestPopover();
    syncCommandBarClearance();
    applySize(); // 도크가 바뀌면 유리 전용 크기를 다시 잡는다(유리로 들어오면 적용, 나가면 해제).
  };
  refreshDockLabels();
  commandMenuToggle.addEventListener("click", () => {
    if (!commandMenu.hidden) refreshMoreMenuDockLabel();
  });
  commandMenu.replaceChildren(
    composerTemperatureSection,
    // 스킬 찾기가 첫 항목 — `/` 단독 버튼을 걷은 뒤 이 메뉴가 유일한 마우스 진입점이다.
    skillToggle,
    ...composerMenu.items,
  );
  refreshTemperatureChrome();

  // 초기 적용: 스튜디오가 켜져 있으면 스튜디오가 이기고, 아니면 기록 패널은 숨긴다.
  if (studio) applyStudio(true);
  else applyHistoryOpen(false);

  const handleAiAssist = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!isAiAssistDetail(detail)) return;
    // 스킬 킥오프는 AI 작업 — 자동 펼침 후 턴 종료 시 다시 접힐 수 있다.
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
    const skillId = detail.kind === "cluster-edit" ? "cluster-edit" : "unclassified-analysis";
    const skill = listAllSkills().find((entry) => entry.id === skillId);
    if (!skill) {
      toast("AI 스킬을 찾을 수 없습니다.", "error");
      return;
    }
    const args: Record<string, SkillArgValue> =
      detail.kind === "cluster-edit"
        ? { tilesetId: detail.tilesetId, groupId: detail.groupId }
        : { tilesetId: detail.tilesetId, sampleTiles: detail.sampleTiles, total: detail.total };
    runSkillPrompt(skill, args);
  };

  if (typeof window !== "undefined") {
    cleanupAiAssistBridge?.();
    const targetWindow = window;
    targetWindow.addEventListener("oprn:ai-assist", handleAiAssist);
    cleanupAiAssistBridge = () => targetWindow.removeEventListener("oprn:ai-assist", handleAiAssist);
  }

  // Ctrl/Cmd+K — 통합 커맨드 팔레트(명령+맵+스킬). 패널 수명주기와 함께 등록/해제한다.
  const onCommandPaletteKeyDown = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openCommandPalette({ runSkill: (skill) => drawer.run(skill) });
    }
  };
  // 단축키를 모르는 사용자를 위한 클릭 경로 — 탑바의 ⌘K 칩이 이 이벤트를 쏜다.
  // 팔레트를 열려면 스킬 실행기(drawer)가 필요하고 그건 이 패널만 갖고 있으므로,
  // 열기 요청은 이벤트로 받고 실제 열기는 여기서 한다.
  const onCommandPaletteRequest = (): void => {
    openCommandPalette({ runSkill: (skill) => drawer.run(skill) });
  };
  let ownsCommandPaletteHotkey = false;
  if (typeof window !== "undefined" && !(window as { __oprnSkillHotkey?: boolean }).__oprnSkillHotkey) {
    (window as { __oprnSkillHotkey?: boolean }).__oprnSkillHotkey = true;
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
      revealVolatileZone();
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
    activeResizeCleanup?.();
    activeResizeCleanup = null;

    unsubscribeContextEditor();
    unsubscribeContextStore();
    unsubscribeCompletion();
    completionStripHandle?.dispose();
    completionStripHandle = null;
    commandBarClearanceObserver?.disconnect();
    composerShell.dispose();
    directorPlate.dispose();

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener(AI_SELECTION_CONTEXT_EVENT, handleSelectionContextEvent);
      window.removeEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoLastButton);
      if (window.__oprnAiHarness === harnessAccessor) delete window.__oprnAiHarness;
      if (ownsCommandPaletteHotkey) {
        document.removeEventListener?.("keydown", onCommandPaletteKeyDown);
        window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onCommandPaletteRequest);
        delete (window as { __oprnSkillHotkey?: boolean }).__oprnSkillHotkey;
      }
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("pointerdown", onMoreMenuPointerDown);
      document.removeEventListener("keydown", onMoreMenuKeyDown);
      document.body?.classList.remove("ai-command-bar-active", "ai-panel-docked");
    }

    cleanupAiAssistBridge?.();
    cleanupAiAssistBridge = null;
    unregisterAiAssistantBridge();
    registerAiBootIntentTarget(null);
    proposalApi.clearInlineActionsIfMine();
    closeProposalModal();
    clearAgentGhostPreview();
    panel.remove();
  };

  return panel;
}
