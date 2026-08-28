// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일은 패널 조립/배선(orchestration)을 소유한다. 순수 헬퍼·카드·설정·로그 렌더는 형제 모듈로 분리.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - ChatGPT OAuth 토큰은 브라우저에 저장하지 않는다. API 키 폴백만 설정 localStorage를 쓴다.

import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, peekPreviousProject, undoMapEdit } from "@/editor/mapEditHistory";
import {
  clearAiApplyCompletion,
  publishAiApplyCompletion,
  subscribeAiApplyCompletion,
  type AiApplyCompletionContext,
} from "@/editor/aiApplyCompletion";
import type { AiDocument, ChangeSummary, Project } from "@/project/types";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
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
import { classifyApproval, resolveProposalApplyMode } from "@/ai/approvalPolicy";
import { classifyProposalSafety } from "@/editor/proposalSafety";
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
  deriveTitle,
  loadLatestConversation,
  projectConversationContextKey,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { recordAiActivity } from "@/ai/activityLog";
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
import { createComposerElements, type ComposerElements, type ComposerPopover } from "./aiComposer";
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
import { applyAiFontSize, loadAiFontSize } from "./aiPanelLayout";
import { formatAiRunningStatus, parseAutonomousRunBudget, renderWorkPlanChecklist, type AutonomousRunBudget } from "./aiChatRenderers";
import {
  createConversationLogHost,
  renderStreamedMarkdown,
} from "./aiConversationLog";
import { createProposalModalElements } from "./aiProposalModal";
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
  let panelRoot: HTMLElement | null = null;
  // 빈 로그 껍데기(.ai-glass-log·.ai-history-log-mount)를 접고 시작 블록을 가운데로 올리는 CSS 훅.
  // 턴 행 testid 가 아니라 **로그의 자식 유무**로 판정해야 한다 — 복원된 대화는 그 testid 를 달지
  // 않아 testid 로 세면 복원된 로그를 숨긴다. `:empty` 로도 못 잡는다 — 껍데기 안에 빈
  // .ai-chat-log 엘리먼트가 실제로 들어 있다.
  const syncConversationState = (): void => {
    if (panelRoot) panelRoot.dataset.aiConversation = log.childElementCount > 0 ? "active" : "empty";
  };
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
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
  let runningPhaseStatus: string | null = null;
  // 접힘 상태(`collapsed` · `collapseAfterAiWork` · `autoCollapseTimer`)는 2026-08-29 에
  // 삭제됐다. 유휴가 56px 띠 하나이면 접을 대상이 없고, "턴이 끝나면 자동으로 접는다" 는
  // 이미 무효화된 정책이었다(AUTO_COLLAPSE_AFTER_AI_MS = 0, scheduleCollapseAfterAiWork 가
  // 플래그만 내리고 실제로 접지 않았다).
  let volatileZone: HTMLElement | null = null;
  // 원탭 답변 칩 — 컨트롤러보다 먼저 만들어 질문 대기 중 페이드를 막는다.
  const chipsHost = el("div", { class: "ai-quick-replies", dataset: { testid: "ai-quick-replies" } });
  // 자람은 syncRisen 이 소유한다. 이 함수는 "턴이 시작됐으니 지금 펼쳐라" 는 즉시 요청 —
  // syncRisen 이 패널 크롬 조립 후에 바인딩되므로 늦은 바인딩으로 둔다.
  const revealVolatileZone = (): void => {
    if (volatileZone) volatileZone.hidden = false;
    syncRisen();
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
  // 이 파일이 이미 쓰는 패턴(syncRisen 등)과 동일.
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

  const conversationLog = createConversationLogHost({
    log,
    revealVolatileZone,
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
    openProposalModal,
    closeProposalModal,
    controller,
    appendBubble,
    setStatus,
    onApplied: (result) => {
      const selection = editorState.get().selection;
      // 수동 승인 경로도 같은 변경 카드를 남긴다. 적용 직전 통이 undo 스택 상단이므로
      // peekPreviousProject(1) 이 before, 현재 store 가 after 다.
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
      if (!turnBusy) syncRisen();
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
    closeToolActivity();
    for (const entry of record.entries) renderConversationEntry(entry);
    const lastAssistant = [...record.entries].reverse().find((entry) => entry.kind === "assistant" && entry.text.trim());
    if (lastAssistant?.kind === "assistant") renderQuickReplies(lastAssistant.text);
    setStatus(source === "auto" ? "대화 복원됨" : "이전 대화");
    // 복원된 대화는 로그에 들어가지만 syncGlassIdle 이 다시 돌지 않으면 패널이 is-glass-idle 로
    // 남아 .ai-glass-log 가 display:none 이라 사용자에게 보이지 않는다(실보 2026-08-27).
    syncRisen();
    refreshExportButton();
    syncConversationState();
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
    syncRisen();
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
    syncRisen();
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
    if (!opts?.replay) appendBubble("user", displayAs ?? trimmed);
    const session = ensureSession();
    // 자율 드라이버 진입: agentMode "auto" 에서만 켠다(전송 시점 설정 기준 — 위 autoApprove 판정과 같은 관례).
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
    const abortController = new AbortController();
    activeAbortController = abortController;
    abortNoticeShown = false;
    const ownsTurn = (allowAborted = false): boolean =>
      !disposed
      && activeAbortController === abortController
      && (allowAborted || !abortController.signal.aborted);
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
      // 승인 카드는 파괴적·재료합의 변경과 자동 적용 off 에만 남는다. 안전 분류와 완성도 린트
      // 경고는 더 이상 게이트가 아니다 — 되돌리기가 있는 변경을 카드로 막으면 마찰만 남는다.
      const applyMode = resolveProposalApplyMode({
        callCount: result.proposedCalls.length,
        autoApplyEnabled: autoApproveEnabled,
        approvalDecision: verdict.decision,
        turnErrored: result.stoppedReason === "error",
      });
      if (applyMode === "apply-now") {
        // 적용을 먼저 하고 그 결과를 기다린 다음에 카드를 붙인다 — 배치 검증·커밋 게이트가 적용을
        // 거부하면 store 는 그대로이므로 "자동 적용 N건" 은 거짓이 된다(사유는 acceptProposal 이
        // 이미 ❌ 버블로 남긴다).
        // 자동 적용도 전/후 비교를 보여준다. 이전엔 한 줄 시스템 버블 + 3초 뒤 setTimeout 으로
        // 사라지는 실행취소 버튼이 전부여서, 사용자는 무엇이 바뀌었는지 보지 못한 채 3초 안에
        // 판단해야 했다. 이제 전/후 큰 비교 카드를 로그에 남기고 넓은 화면으로 열 수 있다.
        const appliedSummary = result.proposedCalls.map((call) => call.summary || call.name).join(" · ");
        // 게이트에서 내린 경고는 정보로 남긴다 — 적용을 막지는 않되 삼키지도 않는다.
        if (completenessWarnings.length > 0) appendBubble("system", completenessWarnings.join("\n"));
        const applied = await acceptProposal(result.proposedCalls);
        setStatus(applied ? "대기" : "적용 실패");
        // 변경 카드는 proposalApi.onApplied 가 모든 적용 경로(자동·수동)에서 한 장만 남긴다.
        // 여기서 또 emitChangeCard 를 부를면 자동 적용 한 턴에 카드가 다 장 밥는다(e2e 로 잡혀다).
        if (applied && !currentMapId) {
          appendBubble("system", `자동 적용됨 ${result.proposedCalls.length}건 — ${appliedSummary}`);
        }
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
      // 턴 결과 점(초록=완료, 빨강=오류). 다음 턴 시작(beginTurnProgress)이나 입력 포커스에서
      // 소거된다 — 예전에는 `if (collapsed)` 로 접힘 상태에만 달았고, 접힘이 사라졌으므로
      // 조건 없이 단다. 점 3종은 스펙 §1 의 생존 상태다.
      panel.classList.add(turnFailed ? "is-turn-error" : "is-turn-attention");
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
      syncRisen();
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
      if (!cancelled) panel.classList.add(regionFailed ? "is-turn-error" : "is-turn-attention");
      persistConversation();
      if (!cancelled) notifyIfObscuredByTestPlay();
      drainPendingSends();
      syncRisen();
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
    input.style.height = `${input.scrollHeight + 2}px`; // +2: 테두리로 인한 1줄 스크롤 잔상 방지
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
    // 단일 띠라 도크·대기화면 게이팅이 없다. 초대 문구는 "대화가 비었고 한가하고 입력도
    // 비었을 때"만 — 즉 유휴 56px 상태에서만 보인다.
    const show = !busy && input.value.trim() === "";
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
  // 추천 칩 팝오버는 입력창이 비어 있고 포커스가 있을 때만 뜬다. 흐름 밖이라
  // 열림/닫힘이 바 높이를 건드리지 않는다(구 도크별 분기 삭제 — 표면이 하나다).
  const syncSuggestPopover = (): void => {
    if (typeof document === "undefined") return;
    const focused = document.activeElement === input;
    const wantOpen =
      focused
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

  // 접기 · 복귀 알약 · 도크 전환 4종 · 툴 브라우저 · 하네스 는 2026-08-29 에 삭제됐다.
  //
  // 접기: 유휴가 56px 띠 하나이면 접을 대상이 없다. 구 복귀 알약은 실측 [14,930,132,48] 인데
  // 좌측 레일이 0~73px 를 덮어 이미 `…수` 로 잘려 있었다(기존 결함).
  // 도크 전환: 도크 3종을 폐기했으므로 전환할 대상이 없다.
  // 툴 브라우저·하네스: 숨은 툴바(hidden + inert + `.is-empty`)에만 있어 도달 경로가 없었다.
  //   하네스는 `window.__oprnAiHarness()` 로 계속 접근 가능하다(아래 harnessAccessor).
  let syncRisen: () => void = () => {};
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
  let historyOpen = false;
  let applyHistoryOpen: (next: boolean) => void = () => {};
  // 전체 기록 ⑧ — 띠에 상시 노출되는 진입점. 예전에는 숨은 툴바에만 있어 도달 불가였고,
  // 그래서 이 testid 를 참조하는 테스트가 0건이다(스펙 검증 전략 §4).
  const historyButton = el("button", {
    class: "ai-chat-icon-btn ai-chat-history-btn",
    text: "🕒",
    attrs: { type: "button", title: "전체 기록 열기", "aria-label": "전체 기록 열기", "aria-expanded": "false" },
    dataset: { testid: "ai-chat-history" },
  }) as HTMLButtonElement;
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
  // (글자 크기 순환 버튼 삭제 — 숨은 툴바에만 있어 도달 불가였고, 저장된 크기는
  //  부팅 시 applyAiFontSize 로 계속 적용된다. 변경 경로는 AI 설정 모달이 갖는다.)

  // 헤더 햄버거 메뉴(`ai-more-menu` · `ai-more-menu-toggle` · `ai-more-actions`)는 2026-08-29 에
  // 삭제됐다. 그 메뉴는 숨은 툴바(`hidden` + `inert`) 안의 `moreWrap` 에 살았으므로 열 방법이
  // 없었다 — 항목 8개를 두 벌로 만들면서 도크 라벨 갱신도 두 곳에서 하고 있었다.
  // 이제 ☰ 는 컴포저 액션 행의 것 하나뿐이고, 항목 구현은 aiActionMenu.ts 가 계속 소유한다.

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
    undoLast: () => undoLastButton.click(),
    exportAudit: () => exportButton?.click(),
    openHistory: () => applyHistoryOpen(true),
    openTools: () => {
      void openToolBrowserModal();
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
  // 숨은 툴바(`ai-chat-toolbar.is-empty` + hidden + inert)는 2026-08-29 에 삭제됐다.
  //
  // 그 컨테이너가 13개 버튼을 담고 있었고 `03-three-tier-ia.css:73` 이 `:not(.is-empty)` 를
  // 요구했다 — TS 는 항상 `is-empty` 를 붙였으므로 두 조건이 영구히 상충했고, 13개 전부가
  // 도달 불가였다. "테스트가 참조하니 지우면 안 된다"는 주석이 붙어 있었지만, 그 참조들은
  // 대부분 `findByTestId(...)?.click()` 이라 요소가 사라지면 조용히 통과한다. 즉 스위트는
  // 삭제 대상을 지키고 생존 대상(`ai-chat-history`·`ai-chat-new-session` 참조 0건)은 놓쳤다.
  //
  // 이제 남은 진입점은 세 곳이며 전부 화면에 있다:
  //   ⑧ 전체 기록 · ⌫ 새 대화 → 컴포저 액션 행 (아래 createComposerElements)
  //   되돌리기 → 완료 카드 인라인(`ai-completion-host`) + 컴포저 ☰ 항목
  //   내보내기 → 기록 오버레이 안의 액션
  // 하네스는 화면 버튼 대신 `window.__oprnAiHarness()` 로 남는다.
  exportButton.hidden = false;
  exportButton.removeAttribute("aria-hidden");
  undoLastButton.hidden = false;
  undoLastButton.removeAttribute("aria-hidden");

  // 하단 컴포저: 입력 + 고정 액션 행 한 줄(세로 레일 없음).
  // 추천 칩·액션 메뉴는 흐름 밖 팝오버 — 바 높이는 입력 줄 수만 따른다.
  const composerShell: ComposerElements = createComposerElements({
    input,
    sendButton,
    abortButton,
    contextChips,
    composerChips,
    queueIndicator,
    statusGroup,
    historyButton,
    newSessionButton,
    onPopoverChange: () => syncCommandBarClearance(),
  });
  const commandBar = composerShell.commandBar;
  const commandMenu = composerShell.commandMenu;
  openComposerPopover = composerShell.openPopover;
  composerPopoverKind = composerShell.openKind;
  const volatileLogMount = el("div", {
    class: "ai-rising-volatile-zone",
    dataset: { testid: "ai-rising-volatile-zone" },
    children: [log],
  });
  volatileZone = volatileLogMount;
  volatileZone.classList.add("ai-volatile-dashed");
  volatileZone.setAttribute("title", "휘발 영역 — 마지막 한 턴만 띠 안에 남고, 그 이전은 전체 기록에서 본다");
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
  // 오버레이는 **휘발 로그 전용**이다. 제안 pill·완료 스트립(stickyProposalZone)은 여기 두지
  // 않는다 — 예전에는 오버레이가 사이드 도크에서만 마운트돼서, 기본 도크인 유리·float 에서는
  // 스티키 존이 문서에서 통째로 빠져 pill 과 완료 스트립이 사라졌다(2026-08-23 실측).
  // 이제 도크가 없으므로 오버레이는 항상 마운트되고, 스티키 존도 항상 패널 자식이다.
  const risingOverlay = el("div", {
    class: "ai-rising-overlay",
    dataset: { testid: "ai-rising-overlay" },
    children: [volatileLogMount],
  });
  const historyLogMount = el("div", { class: "ai-history-log-mount" });
  // 구 `ai-glass-log` 마운트는 유리 도크와 함께 삭제됐다. 로그 슬롯은 둘뿐이다:
  // 자람 상태의 휘발 존(`ai-rising-volatile-zone`) 과 기록 오버레이(`ai-history-log-mount`).
  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [nextSteps, historyLogMount, chipsHost],
  });
  const body = el("div", { class: "ai-chat-body", children: [mainColumn] });

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "조수" },
    dataset: {
      testid: "ai-panel",
      uiDensity: "shared",
      aiConversation: "empty",
    },
    children: [body, risingOverlay, pinHost, stickyProposalZone, commandBar, proposalModalRoot],
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

  // 유리 카드 전용 리사이즈 핸들(`ai-resize-handle`)과 `applySize`/`loadDockPanelSize` 는
  // 2026-08-29 에 삭제됐다. 띠는 폭 640px 고정 · 높이 auto(상한 480px)이며, 그 두 값이
  // 곧 계약이다(스펙 §2 기하). 사용자가 크기를 저장할 표면이 없으므로 저장할 것도 없다.
  //
  // 구 구현은 어차피 죽은 코드였다: `resizableDock()` 이 glass 를 요구했지만 `applySize` 는
  // 세 도크 전부에서 인라인 스타일을 비우고 빠져나갔고, 실측 결과 유리 카드는 부팅·포커스·
  // 타이핑·도크 순환 내내 360x620 에 고정돼 있었다.

  /**
   * 로그 배치의 **단일 상태 함수**. 기록 오버레이가 열려 있으면 `history`, 아니면 `volatile`.
   *
   * 예전에는 (도크 3종 × 기록 × 스튜디오) 조합을 `applyComposerViewPolicy`·`applyHistoryOpen`·
   * `applyStudio` 세 곳이 제각기 `remove()` + `append()` 로 재부모화했다 — 기록을 닫으면 휘발
   * 존에 넣었다가 바로 뒤이어 도크 정책이 유리 마운트로 다시 집어오는 식이었다. 슬롯이 둘이면
   * 그 경쟁 자체가 없다. (`ai-glass-log` 는 유리 도크와 함께 사라졌다.)
   *
   * 슬롯은 `panel.dataset.logSlot` 으로 노출한다 — 부모 체인을 뒤지지 않고 현재 배치를
   * 읽을 수 있게 하는 단일 지표다.
   */
  const mountLog = (): void => {
    const slot = historyOpen ? "history" : "volatile";
    const target = slot === "history" ? historyLogMount : volatileLogMount;
    panel.dataset.logSlot = slot;
    if (log.parentElement === target) return;
    log.remove();
    target.append(log);
  };
  /**
   * 띠의 유일한 기하 상태. `is-risen` 이 붙으면 내용만큼 자라고(상한 480px), 없으면 유휴 56px 다.
   *
   * 왜 클래스 하나인가: 구 상태 기계는 13종이었고 (도크 3 × 대기화면 3 × 스튜디오 × 접힘 ×
   * 기록 × 턴 4) 조합 288칸을 CSS 가 커버하려 했다. 유휴/자람은 **한 축**이므로 클래스 하나로
   * 표현하고, 유휴 상태는 그 클래스의 **부재**로 읽는다(구 `is-assistant-idle`·`is-glass-idle`·
   * `is-map-first-idle` 3종이 같은 한 축을 세 벌로 들고 있었다).
   */
  syncRisen = (): void => {
    const hasTurn = Boolean(log.querySelector("[data-testid=ai-command-row-assistant]"))
      || Boolean(log.querySelector("[data-testid=ai-command-row-user]"));
    const risen = hasTurn
      || panel.classList.contains("is-turn-running")
      || Boolean(panel.querySelector("[data-testid=ai-proposal-pin]"))
      || Boolean(turnBusy || runningProgress)
      || (typeof document !== "undefined" && document.activeElement === input)
      || input.value.trim() !== "";
    panel.classList.toggle("is-risen", risen);
    // 결과 점은 사용자가 입력을 잡는 순간 "확인한 것"으로 본다. 예전에는 접힘을 펼치는
    // 동작이 그 역할을 했다.
    if (typeof document !== "undefined" && document.activeElement === input) {
      panel.classList.remove("is-turn-attention", "is-turn-error");
    }
    // 휘발 존은 자람 상태에서만 존재한다 — 유휴 56px 에 빈 로그 껍데기를 두면 그 높이가
    // 그대로 공백이 된다(구 600px 공백의 원인 축).
    if (volatileZone) volatileZone.hidden = !risen;
    refreshNextSteps();
  };
  const applyComposerViewPolicy = (): void => {
    mountLog();
    syncRisen();
  };
  // 입력 포커스/블러가 자람을 켠다. 스펙 §2: 칩 행은 유휴 56px 에 들어가지 않고
  // `is-risen` 과 함께 나타나는 첫 줄에 있다.
  input.addEventListener("focus", () => syncRisen());
  input.addEventListener("blur", () => syncRisen());

  refreshSendEnabled(); // 부트 직후도 보낼 게 없으므로 전송은 비활성에서 시작해야 한다.
  if (typeof document !== "undefined" && document.body) document.body.classList.add("ai-command-bar-active");

  let completionStripHandle: AiCompletionStripHandle | null = null;
  const renderCompletion = (context: AiApplyCompletionContext | null): void => {
    completionStripHandle?.dispose();
    completionStripHandle = null;
    completionHost.replaceChildren();
    if (!context || disposed) return;
    completionStripHandle = buildAiCompletionStrip({ context });
    completionHost.append(completionStripHandle.element);
    // 되돌리기는 완료 카드 인라인이 집이다(스펙 §3). 카드가 서면 함께 붙는다.
    completionHost.append(undoLastButton);
    refreshUndoLastButton();
  };
  const unsubscribeCompletion = subscribeAiApplyCompletion(renderCompletion);

  // 기록 오버레이 — 우측 520px 전면. 내보내기는 여기 사는 액션이다(스펙 §3 이관).
  const historyActions = el("div", {
    class: "ai-history-actions",
    dataset: { testid: "ai-history-actions" },
    children: [exportButton],
  });
  historyLogMount.before(historyActions);
  applyHistoryOpen = (next: boolean): void => {
    historyOpen = next;
    // `is-docked` 는 삭제됐다 — 구 구현은 fixed 오버레이용 body inset 과 side flex 열을 같이
    // 다루려고 이 클래스를 도크별로 켜고 껐다(35곳). 오버레이가 한 종류면 클래스도 하나다.
    panel.classList.toggle("is-history-open", historyOpen);
    historyButton.textContent = historyOpen ? "×" : "🕒";
    historyButton.setAttribute("title", historyOpen ? "전체 기록 닫기" : "전체 기록 열기");
    historyButton.setAttribute("aria-label", historyOpen ? "전체 기록 닫기" : "전체 기록 열기");
    historyButton.setAttribute("aria-expanded", String(historyOpen));
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("ai-panel-docked");
      document.body.classList.add("ai-command-bar-active");
    }
    applyComposerViewPolicy();
  };
  historyButton.addEventListener("click", () => applyHistoryOpen(!historyOpen));

  // 컴포저 ☰ — 항목 구현은 aiActionMenu.ts 가 소유한다(헤더 ☰ 가 사라진 뒤 유일한 표면).
  // 열림 상태는 컴포저 셸이 소유하므로 직접 hidden 을 만지지 않는다(두 곳이 상태를 들면
  // aria-expanded 가 실제와 갈라진다).
  const closeCommandMenu = (): void => {
    if (composerPopoverKind() === "menu") openComposerPopover(null);
  };
  const composerMenu = createAiActionMenuItems({
    close: closeCommandMenu,
    actions: sharedMenuActions,
  });
  commandMenu.replaceChildren(...composerMenu.items);

  applyHistoryOpen(false);
  syncCommandBarClearance();

  const handleAiAssist = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!isAiAssistDetail(detail)) return;
    // 클러스터 킥오프는 AI 작업 — 자동 펼침 후 턴 종료 시 다시 접힐 수 있다.
    revealVolatileZone();
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
    open: () => revealVolatileZone(),
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

    unsubscribeContextEditor();
    unsubscribeContextStore();
    unsubscribeCompletion();
    completionStripHandle?.dispose();
    completionStripHandle = null;
    commandBarClearanceObserver?.disconnect();
    composerShell.dispose();

    if (typeof window !== "undefined") {
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
