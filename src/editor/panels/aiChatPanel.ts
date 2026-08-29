// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일은 패널 조립/배선(orchestration)을 소유한다. 순수 헬퍼·카드·설정·로그 렌더는 형제 모듈로 분리.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - ChatGPT OAuth 토큰은 브라우저에 저장하지 않는다. API 키 폴백만 설정 localStorage를 쓴다.

import {
  getMapEditHistoryMarker,
  getMapEditHistoryState,
  MAP_EDIT_HISTORY_EVENT,
  peekPreviousProject,
  revertToHistoryMarker,
  undoMapEdit,
} from "@/editor/mapEditHistory";
import {
  clearAiApplyCompletion,
  publishAiApplyCompletion,
  subscribeAiApplyCompletion,
  type AiApplyCompletionContext,
} from "@/editor/aiApplyCompletion";
import type { AiDocument, ChangeSummary, Project } from "@/project/types";
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
  clearAgentGhostPreview,
  createThrottledAgentGhostPreviewUpdater,
  setAgentGhostDraftMapProvider,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import {
  beginAgentBlueprintTurn,
  clearAgentBlueprint,
  commitAgentBlueprintProgress,
  markAgentBlueprintProgress,
  setAgentBlueprintFromSpec,
  settleAgentBlueprintTurn,
  syncAgentBlueprintWithSpec,
} from "@/editor/agentBlueprint";
import { appliedBlueprintRegions } from "@/editor/agentBlueprintRegions";
import { resolveProposalApplyMode } from "@/ai/approvalPolicy";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { COMMAND_PALETTE_OPEN_EVENT, openCommandPalette } from "./commandPalette";
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { isRegionEscapingIntent } from "@/editor/regionTask/regionIntentRouter";
import { describeRegionTaskResult, runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { store } from "@/project/store";
import { combineDiffs } from "@/project/projectCommitLog";
import { el } from "@/util/dom";
import { renderMarkdown } from "@/util/markdown";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  AGENT_RUN_MAX_TOTAL_STEPS,
  type AuditEntry,
  type ProposedCall,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import type { WorkPlan } from "@/ai/workPlan";
import type { BuildSpec } from "@/ai/buildSpec";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { getEditorMapViewport } from "@/editor/editorMapViewport";
import {
  conversationScopeKey,
  deriveTitle,
  loadLatestConversation,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { serializeAuditTranscript } from "@/ai/conversationReplay";
import { EMPTY_SESSION_USAGE } from "@/ai/sessionUsage";
import { createAiContextMeter, type AiContextMeterHandle, type AiContextSnapshot } from "./aiContextMeter";
import { openAiConversationHistoryModal } from "./aiConversationHistoryModal";
import { openAiInstructionsModal } from "./aiInstructionsModal";
import { recordAiActivity } from "@/ai/activityLog";
import { buildConversationTurnContext } from "@/ai/conversationTurnContext";
import {
  buildInterviewKickoff,
  buildStructureLearnKickoff,
  parseQuickReplies,
  QUICK_REPLY_MARKER,
  stripQuickReplyLine,
} from "@/ai/interviewPrompt";
import { buildDemonstrationMessage } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal, type DemoTeachSeed } from "@/editor/panels/demoTeachCanvas";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { buildClusterEditKickoff, buildUnclassifiedAnalysisKickoff, type ClusterGroupSnapshot } from "@/ai/clusterAssistPrompt";
import { loadAiConfig } from "@/ai/llmClient";
import { createAiActionMenuItems, type AiActionMenuActions } from "./aiActionMenu";
import { createAssistantTemperatureMenuSection } from "./aiTemperatureMenu";
import { createComposerElements, type ComposerElements, type ComposerPopover } from "./aiComposer";
import { createDirectorRestoreButton } from "./aiDirectorChrome";
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
  PANEL_SIZE_LIMITS,
  SIDE_CHAT_WIDTH,
  saveAiFontSize,
  saveDockPanelSize,
  savePanelCollapsed,
  type AiFontSize,
} from "./aiPanelLayout";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderWorkPlanChecklist, type AutonomousRunBudget } from "./aiChatRenderers";
import {
  createConversationLogHost,
  renderStreamedMarkdown,
} from "./aiConversationLog";
import { anchoredPopupPosition } from "./popupPosition";
import { createProposalHost, setAssistantMessageBadge } from "./aiProposalCard";
import { changePreviewChips, renderChangePreviewCard } from "./aiChangePreview";
import { proposalHumanSummaryLine } from "./aiProposalSummary";
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
  readonly onSideWidthPreview?: (width: number, panelHeight: number) => void;
  readonly onSideWidthCommit?: (width: number, panelHeight: number) => void;
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
  const initialProjectIdentity = store.getProjectIdentity();
  const currentProjectContextKey = conversationScopeKey(initialProjectIdentity, store.getCurrent());
  const latestConversation = loadLatestConversation();
  const autoRestoreConversation =
    latestConversation?.projectContextKey === currentProjectContextKey ? latestConversation : null;
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
  type ConversationPersistTarget = {
    readonly id: string;
    readonly scope: string;
    readonly entries: readonly AuditEntry[];
  };
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
    if (record) controller.statusTimeline.push({ at: new Date().toISOString(), status: text });
  };
  const log = el("div", { class: "ai-chat-log", dataset: { testid: "ai-chat-log" } });
  let panelRoot: HTMLElement | null = null;
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
  let dockToggleLock: HTMLButtonElement | null = null;
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
  let runningPhaseStatus: string | null = null;
  // AI 턴/영역 작업이 끝나면 맵 우선으로 다시 접을지. 오류면 열린 상태를 유지한다.
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
    appendChangeCard,
    renderConversationEntry,
    clearLastReasoning,
    isLastReasoningBox,
  } = conversationLog;

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
        undoMapEdit();
      },
    });
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
        config: loadAiConfig(),
        ...(priorTranscript ? { priorTranscript } : {}),
        contextOptions: {
          currentMapId: editorState.get().currentMapId ?? undefined,
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
   * 새 대화 시작 — 헤더의 ＋, 액션 모드(모든 도키에서 열림), 그리고 프로젝트 전환이 공유하는 한 경로.
   * 닫혀지는 대화는 **자기 프로젝트 키**로 보관된 뒤에 새 스코프로 갈아끓는다.
   */
  const startNewConversation = (reason: "manual" | "project-switch"): void => {
    // 버릴 것이 있었는지를 보관 전에 재다 — 부팅 지연 로드도 프로젝트 전환으로 보이므로,
    // 할 이야기가 없는 전환은 조용하게 재스코프만 한다.
    const hadConversation = [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])].length > 0;
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
    conversationId = genId("conv");
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
    ensureStartScreen();
    setStatus(reason === "project-switch" ? "새 프로젝트 — 새 대화" : "새 대화");
    refreshExportButton();
    syncGlassIdle();
    syncConversationState();
    if (reason === "manual") {
      toast("새 대화를 시작했습니다. 이전 대화는 기록에 저장됐습니다.", "ok");
    } else if (hadConversation) {
      toast("프로젝트가 바뀌어 새 대화를 시작합니다. 이전 대화는 그 프로젝트 기록에 저장됐습니다.", "ok");
    }
    refreshContextMeter();
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
      } else {
        appendBubble("system", `압축하지 않았습니다 — ${outcome.reason}`);
        setStatus("압축 건너뜀");
      }
    } catch (error) {
      appendBubble("system", `압축 실패: ${error instanceof Error ? error.message : String(error)}`);
      setStatus("압축 실패");
    } finally {
      compacting = false;
      refreshContextMeter();
      refreshExportButton();
    }
  };

  const undoContextCompaction = (): void => {
    const session = controller.session;
    if (!session || !sessionMethod("undoLastCompaction") || turnBusy || compacting) return;
    if (!session.undoLastCompaction()) {
      toast("되돌릴 압축이 없습니다.", "info");
      return;
    }
    appendBubble("system", "직전 압축을 되돌렸습니다. 요약 전 원문 대화로 돌아갔습니다.");
    setStatus("압축 되돌림");
    refreshContextMeter();
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
      return;
    }
    const reverted = revertToHistoryMarker(turn.marker);
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
    revealVolatileZone();
    if (!opts?.replay) attachRewindAffordance(appendBubble("user", displayAs ?? trimmed), trimmed);
    const session = ensureSession();
    // 자율 드라이버 진입: agentMode "auto" 에서만 켠다(전송 시점 설정 기준).
    // "chat" 은 종전대로 턴 1개(수동 「계속」). opts.autonomous 는 세션 진입점의 명시 오버라이드(브리지/테스트).
    const autonomous = loadAiConfig().agentMode === "auto";
    // 자율 런 표면 시작: 새 런마다 이전 계획/예산/피드를 버리고 0부터 시작한다.
    if (autonomous) beginAutonomousRun();
    await executeTurn(session, trimmed, (onEvent, signal) =>
      session.sendUserMessage(`${trimmed}\n\n${contextFooter()}`, onEvent, signal, { autonomous }),
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
    const turnConversationId = conversationId;
    const turnConversationScope = conversationScope;
    const auditHistoryAtTurnStart = [...controller.auditHistory];
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
    refreshContextMeter(); // 진행 중에는 압축 버튼이 잠긴다(busy) — 그 상태를 즉시 반영한다.
    sendButton.disabled = true;
    const activeSpecAtTurnStart = session.getActiveSpec();
    // 지난 턴의 "이번 턴에 올린 칸" 기록을 끊는다 — 아래 두 곳의 `!ownsTurn(true)` 반환은 정산을
    // 지나지 않으므로(소유권을 잃은 턴) 그 기록이 이번 턴 정산까지 살아남아 손대지도 않은 칸을
    // planned 로 되돌릴 수 있다. 지금은 dropSession/dispose 가 청사진을 함께 지워서 드러나지
    // 않지만 그건 결합에 의한 안전이다.
    beginAgentBlueprintTurn();
    // 청사진을 세션 스펙에 다시 맞춘다 — set_build_spec 은 계획을 세운 턴에만 오므로(스펙은
    // 턴 간 유지된다) 이 재동기화가 없으면 두 번째 턴부터 맵에 밑그림이 사라진다.
    syncAgentBlueprintWithSpec(activeSpecAtTurnStart);
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
        // 청사진 진행 — 이번 호출이 어느 칸을 짓고 있는지로 planned/building/done 을 옮긴다.
        // 쓰기 여부를 같이 넘긴다: 이 훅은 성공한 **모든** 툴콜에서 발화하므로 읽기 툴
        // (show_map_region 등)이 그대로 통과하면 확인 호출이 진행을 앞당긴다.
        if (event.result.ok) markAgentBlueprintProgress(event.name, event.args, { write: isWriteTool(event.name) });
        assistantBubble = null; // 툴 이후 새 assistant 응답은 새 버블.
        reasoningBox = null; // 툴 이후 새 추론은 새 상자.
        currentStreamNodes = [];
        // 밑그림(스펙) 확정: 짧은 요약 + 접힌 상세(채팅 노이즈 감소).
        if (event.name === "set_build_spec" && event.result.ok && event.result.data) {
          const spec = event.result.data as BuildSpec;
          confirmedBuildSpecThisTurn = spec;
          // 밑그림을 맵에도 깐다 — 지금까지는 이 접힌 텍스트가 계획을 볼 수 있는 유일한 창이었다.
          setAgentBlueprintFromSpec(spec);
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
        // 자율 런은 턴 도중에 저장소로 커밋한다 — 여기까지의 진행은 실제로 들어갔으므로 확정한다.
        // 확정하지 않으면 뒤이은 중단이 이미 들어간 시공까지 planned 로 되돌린다(마일스톤 적용은
        // turnProposals 를 비우므로 턴 끝의 정산은 그 호출들을 볼 수 없다).
        commitAgentBlueprintProgress();
      } else if (event.type === "proposal_paused") {
        appendMilestoneFeedLine("apply-failed", event.reason, "프로젝트 저장소 변경 없음");
      }
    };

    /**
     * 턴이 끝났다 — 이번 턴에 올린 칸을 **적용이 실제로 들어갔는지**로 정산한다.
     *
     * **모든** 종료 경로(정상·중단·오류·throw·변경 없음)에서 부르되, 넘기는 것은 종료 분기가
     * 아니라 저장소에 들어간 호출이다(`null` = 아무것도 안 들어갔다). 다섯 경로 중 셋 —
     * 중단 return 과 catch 두 개 — 은 applyProposal **앞에서** 끝나므로 초안이 그대로 버려진다.
     * 종전처럼 그 자리에서 building 을 done 으로 올리면 손도 안 댄 타일 위에 회색 ✓ "완료" 가
     * 박히고, markAgentBlueprintProgress 는 planned 가 아닌 칸을 다시 올리지 않으므로 세션이
     * 죽을 때까지 풀리지 않는다(실측: 같은 툴콜을 정상 종료/중단으로 각각 돌려 store 변경
     * true/false, 청사진은 양쪽 다 done · 로그에는 "적용됨" 이 없었다).
     *
     * 판정 근거는 완성도 린트(⚠ 미이행)가 쓰는 함수 그대로다 — 채팅이 "미이행" 이라고 말하는
     * 에셋에 맵이 "완료 ✓" 를 그리면 사용자는 어느 쪽도 믿을 수 없다.
     */
    const settleBlueprintForTurnEnd = (appliedCalls: readonly ProposedCall[] | null): void => {
      settleAgentBlueprintTurn(
        appliedCalls === null ? { regions: [], wholeTargetMapIds: [] } : appliedBlueprintRegions(appliedCalls)
      );
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
        // 중단은 초안을 버린다(적용 경로에 닿지 못한다) — 이번 턴에 올린 칸을 되돌린다.
        // 자율 런에서 턴 도중 커밋된 마일스톤 몫은 milestone_applied 에서 이미 확정됐다.
        settleBlueprintForTurnEnd(null);
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
      // 정산은 아래 적용 분기가 끝난 뒤에 한다 — 오류로 끝난 턴도 제안이 남아 있으면 적용된다.
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
      const currentMapId = editorState.get().currentMapId ?? beforeProject.startMapId ?? null;
      // 승인 카드는 없다 — 쓰기가 있으면 그대로 적용하고, 복구는 되돌리기다(approvalPolicy 머리말).
      const applyMode = resolveProposalApplyMode({ callCount: result.proposedCalls.length });
      if (applyMode === "apply-now") {
        // 적용을 먼저 하고 그 결과를 기다린 다음에 로그를 붙인다 — 배치 검증·커밋 게이트가 적용을
        // 거부하면 store 는 그대로이므로 "적용됨 N건" 은 거짓이 된다(사유는 applyProposal 이
        // 이미 ❌ 버블로 남긴다).
        const appliedSummary = result.proposedCalls.map((call) => call.summary || call.name).join(" · ");
        // 게이트에서 내린 경고는 정보로 남긴다 — 적용을 막지는 않되 삼키지도 않는다.
        if (completenessWarnings.length > 0) appendBubble("system", completenessWarnings.join("\n"));
        applyingProposal = true;
        let applied: boolean;
        try {
          applied = await applyProposal(result.proposedCalls, assistantBubble);
        } finally {
          applyingProposal = false;
          projectIdentityId = store.getProjectIdentity().id;
        }
        // 적용 결과가 나온 다음에 청사진을 정산한다 — 배치 검증·커밋 게이트가 거부하면
        // (applied === false) 저장소는 그대로이므로 done 은 거짓이다.
        settleBlueprintForTurnEnd(applied ? result.proposedCalls : null);
        setStatus(applied ? "대기" : "적용 실패");
        // 변경 카드는 proposalApi.onApplied 가 한 장만 남긴다. 여기서 또 emitChangeCard 를 부르면
        // 한 턴에 카드가 두 장 붙는다(e2e 로 잡혔다).
        if (applied && !currentMapId) {
          appendBubble("system", `적용됨 ${result.proposedCalls.length}건 — ${appliedSummary}`);
        }
      } else {
        // 쓰기 제안이 0건이면 적용할 것이 없다 — 진행 표시만 남으면 거짓이 된다.
        settleBlueprintForTurnEnd(null);
        noteNoChanges(result, completenessWarnings);
        if (result.stoppedReason !== "error") {
          const silenced = result.assistantText ? ` — ${result.assistantText.slice(0, 80)}` : "";
          const emptyLabel = completenessWarnings.length > 0 ? `변경 없음(린트 경고 ${completenessWarnings.length}건)` : `변경 없음(0건)${silenced ? " · 되묻기/재시도 필요" : ""}`;
          setStatus(emptyLabel);
        } else {
          setStatus("오류");
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
        settleBlueprintForTurnEnd(null);
        setStatus("대기");
        return;
      }
      turnFailed = true;
      turnCatchError = cause instanceof Error ? cause.message : String(cause);
      endTurnProgress();
      ghostPreviewUpdater.cancel();
      clearAgentGhostPreview();
      // throw 로 끝난 턴은 적용 경로에 닿지 못했다 — 초안과 함께 진행 표시도 되돌린다.
      settleBlueprintForTurnEnd(null);
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
      const turnEntries = [...auditHistoryAtTurnStart, ...session.getAuditEntries()];
      if (!ownsTurn(true)) {
        // 프로젝트 전환이 ownership을 먼저 끊어도 늦게 정착한 결과는 시작 당시 대화에만 저장한다.
        if (!disposed) persistConversation({ id: turnConversationId, scope: turnConversationScope, entries: turnEntries });
        return;
      }
      endTurnProgress();
      if (activeAbortController === abortController) activeAbortController = null;
      turnBusy = false;
      refreshAbortButton();
      // 턴이 끝나면 맥락/사용량이 움직였다 — 게이지는 여기서만 갱신하면 항상 최신이다.
      refreshContextMeter();
      // 자율 런 종료(정상 완료·중단·적용 실패 포함): 런 표면을 정리하고 자동 접기를 재개한다.
      // 다음 사용자 턴이 autonomous 로 시작되면 beginAutonomousRun 이 새 표면을 만든다.
      if (runOpts?.autonomous) endAutonomousRun();
      // 접힌 채로 턴이 끝나면 레일 점으로 알린다(초록=완료, 빨강=오류 — 펼치는 순간 소거).
      if (collapsed) panel.classList.add(turnFailed ? "is-turn-error" : "is-turn-attention");
      persistConversation({ id: turnConversationId, scope: turnConversationScope, entries: turnEntries }); // 시작 당시 대화 범위로 저장한다.
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
        projectContextKey: turnConversationScope,
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
    const regionConversationId = conversationId;
    const regionConversationScope = conversationScope;
    const auditHistoryAtRegionStart = [
      ...controller.auditHistory,
      ...(controller.session?.getAuditEntries() ?? []),
    ];
    const regionAuditEntries: AuditEntry[] = [];
    const recordRegionAudit = (entry: AuditEntry): void => {
      regionAuditEntries.push(entry);
      controller.auditHistory.push(entry);
    };
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
    recordRegionAudit({
      kind: "user",
      text,
      at: new Date().toISOString(),
      context: buildConversationTurnContext(store.getCurrent(), {
        mapId: selection.mapId,
        viewport: getEditorMapViewport(),
        selection: { mapId: selection.mapId, ...selection.region },
      }),
    });
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
      recordRegionAudit({ kind: "assistant", text: content, at: new Date().toISOString() });
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
        recordRegionAudit({
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
        recordRegionAudit({ kind: "status", text: event.text, at: new Date().toISOString() });
        if (shouldShowStatusInChat(event.text)) appendBubble("system", event.text);
      }
    };

    try {
      const result = await runRegion({
        mapId: selection.mapId,
        region: selection.region,
        instruction: text,
        gate: "immediate",
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
      recordRegionAudit({ kind: "status", text: summary, at: new Date().toISOString() });
      setStatus(result.ok ? (result.applied ? "적용됨" : "완료") : "오류");
      if (!result.ok && result.error) toast(`영역 작업 실패: ${result.error}`, "error");
    } catch (cause) {
      if (!ownsRegionRun()) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus("오류");
      appendBubble("system", `오류: ${message}`);
      recordRegionAudit({ kind: "status", text: `오류: ${message}`, at: new Date().toISOString() });
    } finally {
      const regionEntries = [...auditHistoryAtRegionStart, ...regionAuditEntries];
      if (!ownsRegionRun(true)) {
        if (!disposed) {
          persistConversation({
            id: regionConversationId,
            scope: regionConversationScope,
            entries: regionEntries,
          });
        }
        return;
      }
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
      persistConversation({
        id: regionConversationId,
        scope: regionConversationScope,
        entries: regionEntries,
      });
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
    // Escape 우선순위: 열린 팝오버 → 선택 영역 작업. 팝오버가 떠 있는데 선택 컨텍스트가
    // 먼저 해제돼 사용자가 "무엇이 닫혔는지" 알 수 없던 문제를 없앤다.
    if (event.key === "Escape") {
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
    syncConversationState();
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
        examples: AI_AUTHORING_EXAMPLES.slice(0, 4),
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
    refreshDockLabels();
    refreshTemperatureChrome();
  });
  const unsubscribeContextStore = store.subscribe(() => {
    refreshContextChips();
    refreshComposerChips();
    // 프로젝트가 바뀌었으면(새 프로젝트 생성·다른 작업 열기·로엄 복원) 대화를 새로 시작한다 —
    // 이전 프로젝트의 계획·제안·맵 좌표는 새 프로젝트에서 전부 무의미하거나 해롭다.
    const identity = store.getProjectIdentity();
    if (identity.id === projectIdentityId) return;
    if (applyingProposal) {
      projectIdentityId = identity.id;
      return;
    }
    startNewConversation("project-switch");
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
  collapsedRestore.setAttribute("aria-expanded", String(!collapsed));

  // 1차 크롬은 없다 — 얼굴 명패(createDirectorPlate)와 헤더는 폐기됐다.
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
  // 시연으로 가르치기: AI 추측이 틀렸을 때 말 대신 샌드박스에 직접 깔아서 보여준다.
  // 붓질 순서+설명이 메시지로 전달되고, 시연 결과는 채팅에 그리드 이미지로 남는다.
  const startDemoTeach = (seed: DemoTeachSeed | null): void => {
    openDemoTeachModal({
      seed,
      onSend: (payload) => {
        appendTileGrid({
          tilesetId: DEFAULT_TILESET_ID,
          x: payload.seed?.x ?? 0,
          y: payload.seed?.y ?? 0,
          w: payload.w,
          h: payload.h,
          lower: payload.lower,
          upper: payload.upper,
        });
        void sendText(
          buildDemonstrationMessage(payload),
          `✍️ 시연 — 직접 깐 타일(${payload.strokes.length}회 붓질)로 보여줬습니다.`,
        );
      },
    });
  };

  const sharedMenuActions: AiActionMenuActions = {
    startNewChat: () => startNewConversation("manual"),
    undoLast: () => undoLastButton.click(),
    exportAudit: () => exportButton?.click(),
    toggleDock: () => onDockToggleClick(),
    openHistory: () => {
      historyButton.click();
      applyHistoryOpen(true);
    },
    openTools: () => toolsButton.click(),
    openConversations: openConversationHistory,
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
    // 가르치기 진입점 — 사라진 스킬 서러에 업혀 있었지만 기능 자신은 살아 있다.
    startInterview: () => {
      const state = editorState.get();
      const mapId = state.currentMapId ?? store.getCurrent().startMapId ?? null;
      void sendText(
        buildInterviewKickoff(mapId),
        "🎓 맵 인터뷰 시작 — 현재 맵의 타일 의밌를 가르츠 주세요.",
      );
    },
    learnStructure: () => {
      const selection = editorState.get().selection;
      if (!selection) {
        toast("맵에서 배울 여역을 먼저 선택하세요.", "error");
        return;
      }
      void sendText(
        buildStructureLearnKickoff(selection.mapId, selection),
        "📐 선택 여역 학습 — 구조밌을 배워 주세요.",
      );
    },
    startDemoTeach: () => {
      const selection = editorState.get().selection;
      startDemoTeach(
        selection
          ? { mapId: selection.mapId, x: selection.x, y: selection.y, w: selection.width, h: selection.height }
          : null,
      );
    },
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

  // 헤더는 없다 (2026-08-28 감독 지시). `.ai-chat-header` 밴드와 그 안의 얼굴 명패를
  // 통째로 걷었다 — 실측 518×73px 이 담고 있던 실기능은 ☰ 와 ▾ 뿐이었다.
  // 남은 버튼들은 아래 숨은 훅 컨테이너(`ai-chat-toolbar`)로 옮긴다. 화면에는 없고
  // (hidden + inert + display:none) 접기 상태 기계와 테스트 계약만 살아 있다.
  // 감독 판단: 이 진입점들(더보기 9종·새 대화·도크·떼기)의 소실은 수용됨.
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
    children: [
      toolsButton, harnessButton, studioButton, historyButton, dockToggleButton, exportButton, undoLastButton, fontButton,
      // 구 헤더 잔류물. 접기 버튼은 실제 컴포저 액션 행으로 이동했고, 나머지는
      // 화면에서는 사라졌지만 테스트와 메뉴 위임용 훅으로 남는다.
      newSessionButton, dockModeButton, detachButton, moreWrap,
    ],
  });
  toolbar.inert = true;

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
  // 추천 칩·액션 메뉴는 흐름 밖 팝오버 — 바 높이는 입력 줄 수만 따른다.
  const composerShell: ComposerElements = createComposerElements({
    input,
    collapseButton,
    sendButton,
    abortButton,
    contextChips,
    composerChips,
    queueIndicator,
    statusGroup,
    contextMeterButton: contextMeter.button,
    contextMeterPopover: contextMeter.popover,
    onNewChat: () => startNewConversation("manual"),
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
    // 적용 완료 액션과 0건 알림을 맵 위에서 잃지 않는 고정 영역에 둔다.
    children: [completionHost, proposalNoticeHost],
  });
  // 오버레이는 **휘발 로그 전용**이다. 완료 스트립/알림(stickyProposalZone)은 여기 두면
  // 안 된다 — 오버레이는 사이드 도크에서만 마운트되므로 기본 도크인 유리와 float 에서는
  // 스티키 존이 문서에서 빠진다. 도크와 무관하게 패널 자식으로 붙이고 위치는 CSS가 잡는다.
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
  const body = el("div", { class: "ai-chat-body", children: [mainColumn] });

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "조수" },
    dataset: {
      testid: "ai-panel",
      uiDensity: "shared",
      chatDock: currentChatDock(),
      temperature: readTemperature(),
      aiConversation: "empty",
    },
    children: [toolbar, body, collapsedRestore, risingOverlay, stickyProposalZone, commandBar],
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
  // 헤드리스/콘솔 디버깅용 하네스 접근점: window.__oprnAiHarness() → 주입 포함 원본 메시지 + 감사 로그.
  const harnessAccessor = () => controller.session?.getHarnessSnapshot() ?? null;
  if (typeof window !== "undefined") {
    window.__oprnAiHarness = harnessAccessor;
  }

  // 도크마다 사용자가 실제로 보는 크기 소유자가 다르다: glass는 카드, side는 에디터
  // 셸 컬럼, float은 컴포저 캡슐이다. 저장은 기존 도크별 PanelSize 키를 그대로 쓴다.
  const resizableDock = (): boolean =>
    !panel.classList.contains("is-studio")
    && !panel.classList.contains("is-docked")
    && !collapsed;
  const viewportNow = (): { width: number; height: number } =>
    typeof window === "undefined"
      ? { width: 1280, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight };
  const dockSizes: Record<ChatDock, { width: number; height: number } | null> = {
    glass: loadDockPanelSize("glass"),
    side: loadDockPanelSize("side"),
    float: loadDockPanelSize("float"),
  };
  const sizeProps = ["width", "height", "maxWidth", "maxHeight"] as const;
  const clearPanelSize = (): void => {
    for (const prop of sizeProps) panel.style[prop] = "";
  };
  const floatWidthLimits = (): { min: number; max: number } => ({
    min: PANEL_SIZE_LIMITS.minWidth,
    max: Math.max(PANEL_SIZE_LIMITS.minWidth, Math.min(PANEL_SIZE_LIMITS.maxWidth, viewportNow().width - 24)),
  });
  const clampWidthForDock = (dock: ChatDock, width: number): number => {
    const limits = dock === "side" ? SIDE_CHAT_WIDTH : floatWidthLimits();
    return Math.round(Math.min(limits.max, Math.max(limits.min, width)));
  };
  const measuredSurface = (dock: ChatDock): DOMRect | { width: number; height: number } =>
    (dock === "float" ? commandBar : panel).getBoundingClientRect?.() ?? { width: dock === "float" ? 640 : 360, height: 120 };
  const resizeHandle = el("div", {
    class: "ai-chat-resize-handle",
    attrs: {
      role: "separator",
      tabindex: "0",
      "aria-orientation": "vertical",
      title: "드래그하거나 방향키로 조수 크기 조절",
      "aria-label": "조수 크기 조절",
    },
    dataset: { testid: "ai-resize-handle" },
  });
  const syncResizeAria = (): void => {
    const dock = currentChatDock();
    const limits = dock === "glass"
      ? { min: PANEL_SIZE_LIMITS.minWidth, max: PANEL_SIZE_LIMITS.maxWidth }
      : dock === "side" ? SIDE_CHAT_WIDTH : floatWidthLimits();
    const rect = measuredSurface(dock);
    resizeHandle.setAttribute("aria-valuemin", String(limits.min));
    resizeHandle.setAttribute("aria-valuemax", String(limits.max));
    resizeHandle.setAttribute("aria-valuenow", String(Math.round(rect.width || dockSizes[dock]?.width || limits.min)));
  };
  const applySize = (): void => {
    const dock = currentChatDock();
    clearPanelSize();
    commandBar.style.removeProperty("--ai-float-bar-width");
    if (!resizableDock()) return;
    if (dock === "glass" && dockSizes.glass) {
      const fitted = clampPanelSizeToViewport(dockSizes.glass, viewportNow());
      panel.style.width = `${fitted.width}px`;
      panel.style.height = `${fitted.height}px`;
      panel.style.maxWidth = `${fitted.width}px`;
      panel.style.maxHeight = `${fitted.height}px`;
    } else if (dock === "float" && dockSizes.float) {
      const width = clampWidthForDock("float", dockSizes.float.width);
      commandBar.style.setProperty("--ai-float-bar-width", `${width}px`);
    }
  };
  const mountResizeHandle = (): void => {
    const dock = currentChatDock();
    resizeHandle.remove();
    resizeHandle.classList.toggle("is-corner-end", dock === "glass");
    resizeHandle.classList.toggle("is-edge-start", dock !== "glass");
    resizeHandle.setAttribute("aria-orientation", dock === "glass" ? "horizontal" : "vertical");
    resizeHandle.setAttribute(
      "aria-label",
      dock === "glass" ? "조수 카드 폭과 높이 조절" : dock === "side" ? "조수 사이드 폭 조절" : "조수 입력줄 폭 조절",
    );
    (dock === "float" ? commandBar : panel).append(resizeHandle);
    syncResizeAria();
  };
  const updateDockSize = (dock: ChatDock, width: number, height: number, commit: boolean): void => {
    if (dock === "glass") {
      dockSizes.glass = clampPanelSize({ width, height });
    } else {
      const next = { width: clampWidthForDock(dock, width), height: Math.round(height) };
      dockSizes[dock] = next;
      if (dock === "side") {
        if (commit) options.onSideWidthCommit?.(next.width, next.height);
        else options.onSideWidthPreview?.(next.width, next.height);
      }
    }
    applySize();
    syncResizeAria();
    if (commit && dockSizes[dock]) {
      // editor callback is the side shell's owner; direct panel renders still persist for unit/embedded use.
      if (dock !== "side" || !options.onSideWidthCommit) saveDockPanelSize(dock, dockSizes[dock]!);
    }
  };
  let activeResizeCleanup: (() => void) | null = null;
  resizeHandle.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!resizableDock()) return;
    event.preventDefault();
    activeResizeCleanup?.();
    const dock = currentChatDock();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = measuredSurface(dock);
    const startWidth = rect.width || dockSizes[dock]?.width || (dock === "float" ? 640 : 360);
    const startHeight = rect.height || dockSizes[dock]?.height || 620;
    const onMove = (move: PointerEvent): void => {
      const dx = move.clientX - startX;
      const dy = move.clientY - startY;
      updateDockSize(dock, startWidth + (dock === "glass" ? dx : -dx), startHeight + (dock === "glass" ? dy : 0), false);
    };
    const cleanupResize = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (activeResizeCleanup === cleanupResize) activeResizeCleanup = null;
    };
    const onUp = (): void => {
      cleanupResize();
      const size = dockSizes[dock];
      if (size) updateDockSize(dock, size.width, size.height, true);
    };
    activeResizeCleanup = cleanupResize;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  resizeHandle.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!resizableDock()) return;
    const dock = currentChatDock();
    const step = event.shiftKey ? 32 : 8;
    const rect = measuredSurface(dock);
    const current = dockSizes[dock] ?? { width: rect.width || (dock === "float" ? 640 : 360), height: rect.height || 620 };
    let width = current.width;
    let height = current.height;
    if (event.key === "ArrowLeft") width += dock === "glass" ? -step : step;
    else if (event.key === "ArrowRight") width += dock === "glass" ? step : -step;
    else if (dock === "glass" && event.key === "ArrowUp") height -= step;
    else if (dock === "glass" && event.key === "ArrowDown") height += step;
    else return;
    event.preventDefault();
    updateDockSize(dock, width, height, true);
  });
  applySize();
  mountResizeHandle();
  // 반응형: 창이 좁아지면 저장 크기는 보존하고 실제 표면만 viewport에 맞춘다.
  const onViewportResize = (): void => {
    applySize();
    syncResizeAria();
  };
  if (typeof window !== "undefined") window.addEventListener("resize", onViewportResize);

  const remountComposerTail = (includeOverlay: boolean): void => {
    const tail: HTMLElement[] = includeOverlay
      ? [risingOverlay, stickyProposalZone, commandBar]
      : [stickyProposalZone, commandBar];
    for (const node of tail) node.remove();
    panel.append(...tail);
    mountResizeHandle();
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
    // 오버레이(휘발 존)는 사이드 도크만 가진다. 유리는 카드 본문에 로그를 달고,
    // float도 유리 로그 마운트를 사용한다 — 테스트 계약이다.
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
      studioButton.setAttribute("aria-label", "AI 스튜디오 되돌리기");
      applyComposerViewPolicy();
    } else {
      panel.classList.remove("is-studio");
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
    applySize();
    mountResizeHandle();
  };
  refreshDockLabels();
  commandMenuToggle.addEventListener("click", () => {
    if (!commandMenu.hidden) refreshMoreMenuDockLabel();
  });
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

    if (typeof window !== "undefined") {
      window.removeEventListener("resize", onViewportResize);
      window.removeEventListener(AI_SELECTION_CONTEXT_EVENT, handleSelectionContextEvent);
      window.removeEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndoLastButton);
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
      document.body?.classList.remove("ai-command-bar-active", "ai-panel-docked");
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
