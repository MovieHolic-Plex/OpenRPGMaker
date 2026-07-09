// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일은 패널 조립/배선(orchestration)을 소유한다. 순수 헬퍼·카드·설정·로그 렌더는 형제 모듈로 분리.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - API 키는 설정 폼에서만 입력(localStorage). 소스/프로젝트 JSON에 하드코딩 금지.

import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
import { editorState, type ChatDock } from "@/editor/editorState";
import { AI_SELECTION_CONTEXT_EVENT, aiSelectionContextDetail } from "@/editor/aiSelectionContext";
import { clearAgentGhostPreview, createThrottledAgentGhostPreviewUpdater } from "@/editor/agentGhostPreview";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal, type DemoTeachSeed } from "@/editor/panels/demoTeachCanvas";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { openToolBrowserModal, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { describeRegionTaskResult, runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  proposalNeedsExplicitApproval,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import type { BuildSpec } from "@/ai/buildSpec";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import { renderToolImages } from "@/ai/toolImageRenderer";
import {
  deriveTitle,
  loadConversation,
  loadLatestConversation,
  projectConversationContextKey,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { parseQuickReplies } from "@/ai/interviewPrompt";
import { listAllSkills, recordSkillUse, type SkillArgValue, type SkillDef, type SkillRunContext } from "@/ai/skills";
import { renderSkillDrawer, renderSlashList, slashSkillMatches } from "@/editor/panels/aiSkillDrawer";
import { loadAiConfig } from "@/ai/llmClient";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { createCommandBarElements } from "./aiCommandBar";
import {
  applyAiFontSize,
  clampPanelSize,
  loadAiFontSize,
  loadPanelCollapsed,
  loadPanelSize,
  saveAiFontSize,
  savePanelCollapsed,
  savePanelSize,
  type AiFontSize,
} from "./aiPanelLayout";
import { formatAiRunningStatus } from "./aiChatRenderers";
import {
  appendSkillPromptToggle,
  createConversationLogHost,
  renderStreamedMarkdown,
} from "./aiConversationLog";
import { createProposalModalElements } from "./aiProposalModal";
import { createProposalHost, setAssistantMessageBadge } from "./aiProposalCard";
import { renderSettingsForm } from "./aiSettingsForm";
import {
  attachCompletenessWarnings,
  backupProjectSnapshot,
  completenessSpecForProposal,
  downloadJson,
  dropSession,
  exportCombinedAudit,
  isAiAssistDetail,
  isAiConfigReady,
  isMetadataOnlyProposal,
  isWriteTool,
  phaseStatusText,
  STUDIO_MODE_KEY,
  VOLATILE_OVERLAY_IDLE_MS,
  type ChatController,
  type TileGridData,
} from "./aiChatPanelHelpers";

// ── 테스트/외부 호환 re-export (기존 import 경로 유지) ──────────────
export {
  AI_FONT_SIZE_KEY,
  AI_FONT_SIZE_SCALE,
  PANEL_SIZE_LIMITS,
  applyAiFontSize,
  clampPanelSize,
  loadAiFontSize,
  loadPanelCollapsed,
  loadPanelSize,
  saveAiFontSize,
  savePanelCollapsed,
  savePanelSize,
  type AiFontSize,
  type PanelSize,
} from "./aiPanelLayout";
export {
  fallbackDiffParts,
  proposalDependencyIndexes,
  proposalHumanSummaryLine,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  enforceProposalDependencies,
  eventIdsCreatedByCall,
  eventIdsReferencedByCall,
  mapIdCreatedByCall,
  mapIdsReferencedByCall,
  reassembleSelectedProposalProject,
} from "./aiProposalSummary";
export {
  collectPendingBuilds,
  proposalAcceptButtonLabel,
  rebindPendingBuildArgs,
  runPendingBuilds,
  type PendingBuildOutcome,
  type SelectedPendingBuild,
} from "./aiProposalFusion";
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
  proposalHasMapTileChanges,
  proposalPreviewMapId,
  renderEmptyProposalNotice,
  type StatusTransition,
} from "./aiChatPanelHelpers";

export interface AiChatPanelOptions {
  readonly clock?: () => number;
  readonly getChatDock?: () => ChatDock;
  readonly onChatDockToggle?: () => void;
  readonly regionTaskRunner?: (options: RegionTaskOptions) => Promise<RegionTaskResult>;
}

let cleanupAiAssistBridge: (() => void) | null = null;

export function renderAiChatPanel(options: AiChatPanelOptions = {}): HTMLElement {
  const now = options.clock ?? (() => Date.now());
  const runRegion = options.regionTaskRunner ?? runRegionTask;
  const controller: ChatController = { session: null, auditHistory: [], statusTimeline: [] };
  const currentProjectContextKey = projectConversationContextKey(store.getCurrent());
  const latestConversation = loadLatestConversation();
  const autoRestoreConversation =
    latestConversation?.projectContextKey === currentProjectContextKey ? latestConversation : null;
  const resumeCandidate = autoRestoreConversation ? null : latestConversation;
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

  const status = el("span", { class: "ai-assistant-status", text: "대기", dataset: { testid: "ai-status" } });
  // 상태 배지 전이를 타임라인에 기록한다(결함 ⑬) — 로그 export로 "검토 대기" 멈춤을 진단 가능.
  const setStatus = (text: string, record = true): void => {
    status.textContent = text;
    if (record) controller.statusTimeline.push({ at: new Date().toISOString(), status: text });
  };
  const log = el("div", { class: "ai-chat-log", dataset: { testid: "ai-chat-log" } });
  // ③ 액션 존(§2.3): 지금 결정이 필요한 제안 카드만 — 비면 숨김(CSS :empty).
  const proposalHost = el("div", { class: "ai-proposal-host ai-action-zone", dataset: { testid: "ai-proposal-host" } });

  // ── 변경 제안 몰입 모달: 제안 카드는 중앙 모달에서 검토한다(채팅 오버레이에 얹으면 답답하다는 UX 피드백).
  // proposalHost가 모달 본문에 상주하므로 카드 렌더/승인/융합 로직은 그대로다.
  // '나중에'(Esc/백드롭 포함)는 최소화 — 커맨드 바 위 pill로 남아 승인 대기를 잃지 않는다. 폐기는 오직 [거부] 버튼.
  const proposalModal = createProposalModalElements(proposalHost);
  const proposalNoticeHost = proposalModal.noticeHost;
  const proposalPill = proposalModal.pill;
  const proposalModalCount = proposalModal.count;
  const proposalModalRoot = proposalModal.root;
  const openProposalModal = proposalModal.open;
  const closeProposalModal = proposalModal.close;
  let turnBusy = false;
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
  let runningPhaseStatus: string | null = null;
  let volatileFadeTimer: number | null = null;
  let volatileZone: HTMLElement | null = null;
  const revealVolatileZone = (): void => {
    if (!volatileZone) return;
    volatileZone.hidden = false;
    volatileZone.classList.remove("is-faded");
    if (volatileFadeTimer !== null && typeof window !== "undefined") window.clearTimeout(volatileFadeTimer);
    volatileFadeTimer = null;
  };
  const scheduleVolatileFade = (): void => {
    if (!volatileZone || turnBusy || runningProgress) return;
    if (volatileFadeTimer !== null && typeof window !== "undefined") window.clearTimeout(volatileFadeTimer);
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
    volatileFadeTimer = window.setTimeout(() => {
      volatileFadeTimer = null;
      if (turnBusy || runningProgress || !volatileZone) return;
      volatileZone.classList.add("is-faded");
    }, VOLATILE_OVERLAY_IDLE_MS);
  };
  // 원탭 답변 칩(맵 인터뷰 등 "[선택지] a | b" 마커가 있는 응답에 표시).
  const chipsHost = el("div", { class: "ai-quick-replies", dataset: { testid: "ai-quick-replies" } });
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
    attrs: { placeholder: "요청을 입력하세요 — Enter로 전송, Shift+Enter 줄바꿈 · /스킬 검색", rows: "2" },
    dataset: { testid: "ai-input" },
  }) as HTMLTextAreaElement;

  const sendButton = el("button", {
    class: "ai-assistant-action ai-chat-send",
    text: "보내기",
    attrs: { type: "button" },
    dataset: { testid: "ai-send" },
  }) as HTMLButtonElement;

  // 설정 저장 시 진행 중인 세션에도 즉시 반영한다 — 세션이 생성 시점 설정(빈 API 키 등)을
  // 계속 쓰는 바람에 키를 저장해도 인증 실패가 반복되던 문제를 막는다.
  const settings = renderSettingsForm(
    (config) => {
      controller.session?.updateConfig(config);
    },
    // 글자 크기 변경 즉시 패널에 반영(패널은 아래에서 생성되지만 콜백은 사용자 조작 시점에만 호출된다).
    (size) => applyAiFontSize(panel, size)
  );
  // 설정은 한 번 쓰고 안 쓰는 요소라 기본 접힘 — 헤더 ⚙로 펼친다(전면 재배치 2026-07-05).
  let settingsOpen = false;
  const applySettingsOpen = (): void => {
    if (settingsOpen) settings.element.classList.remove("ai-config-collapsed");
    else settings.element.classList.add("ai-config-collapsed");
  };
  applySettingsOpen();
  const openAiSettings = (focusTarget: "first" | "apiKey" = "first"): void => {
    settingsOpen = true;
    settings.element.classList.remove("ai-config-collapsed");
    settings.element.setAttribute("open", "");
    (settings.element as HTMLDetailsElement).open = true;
    if (focusTarget === "apiKey") settings.focusApiKey();
    else settings.focusFirstInput();
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
    volatileZone.classList.remove("is-faded");
    if (volatileFadeTimer !== null && typeof window !== "undefined") window.clearTimeout(volatileFadeTimer);
    volatileFadeTimer = null;
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
    renderConversationEntry,
    clearLastReasoning,
    isLastReasoningBox,
  } = conversationLog;

  const ensureSession = (): AssistantSession => {
    if (!controller.session) {
      backupProjectSnapshot();
      controller.session = new AssistantSession(store.getCurrent(), {
        config: loadAiConfig(),
        contextOptions: { currentMapId: editorState.get().currentMapId ?? undefined },
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
    proposalNoticeHost,
    proposalModalCount,
    proposalPill,
    openProposalModal,
    closeProposalModal,
    controller,
    appendBubble,
    setStatus,
  });
  const renderProposal = proposalApi.renderProposal;
  const acceptProposal = proposalApi.acceptProposal;
  const applyMetadataKeepSession = proposalApi.applyMetadataKeepSession;
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
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    setPendingProposalMessage(null);
    setLastAppliedProposalMessage(null);
    proposalHost.replaceChildren();
    closeProposalModal();
    chipsHost.replaceChildren();
    log.replaceChildren();
    startScreen = null;
    closeToolActivity();
    for (const entry of record.entries) renderConversationEntry(entry);
    setStatus(source === "auto" ? "대화 복원됨" : "이전 대화");
    refreshExportButton();
    if (source === "manual") appendBubble("system", "이전 대화를 열었습니다.");
  };

  const restoreConversationById = (id: string): void => {
    const record = loadConversation(id);
    if (!record) {
      toast("이전 대화를 찾을 수 없습니다.", "error");
      return;
    }
    restoreConversationRecord(record, "manual");
  };

  const renderQuickReplies = (assistantText: string): void => {
    chipsHost.replaceChildren();
    const options = parseQuickReplies(assistantText);
    if (options.length === 0) return;
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
  // 큐에 쌓고 "대기 중 N건"으로 표시한 뒤, 현재 턴이 끝나면 순서대로 전송한다.
  const pendingSends: { text: string; displayAs?: string }[] = [];
  const queueIndicator = el("div", { class: "ai-pending-queue", dataset: { testid: "ai-pending-queue" } });
  queueIndicator.hidden = true;
  const refreshQueueIndicator = (): void => {
    queueIndicator.hidden = pendingSends.length === 0;
    queueIndicator.textContent =
      pendingSends.length > 0 ? `⏳ 대기 중 ${pendingSends.length}건 — 현재 응답이 끝나면 순서대로 전송됩니다` : "";
  };
  const drainPendingSends = (): void => {
    const next = pendingSends.shift();
    refreshQueueIndicator();
    if (next) void sendText(next.text, next.displayAs);
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
    keyPromptBubble = appendBubble("system", "API 키가 필요합니다. 설정을 열어 OpenRouter 키를 입력하세요.");
    appendOpenSettingsButton(keyPromptBubble, "apiKey");
  };
  const ensureConfigReadyForSend = (): boolean => {
    if (isAiConfigReady(loadAiConfig())) return true;
    showMissingKeyPrompt();
    toast("AI 설정에서 API 키를 먼저 입력하세요.", "error");
    return false;
  };
  let abortButton: HTMLButtonElement | null = null;
  let activeAbortController: AbortController | null = null;
  let abortNoticeShown = false;
  let progressTimer: number | null = null;
  const refreshAbortButton = (): void => {
    if (!abortButton) return;
    const running = Boolean(activeAbortController && !activeAbortController.signal.aborted);
    abortButton.hidden = !turnBusy;
    abortButton.disabled = !running;
    abortButton.setAttribute("aria-disabled", String(!running));
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

  const sendText = async (text: string, displayAs?: string): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!ensureConfigReadyForSend()) return;
    if (turnBusy) {
      pendingSends.push({ text: trimmed, ...(displayAs !== undefined ? { displayAs } : {}) });
      refreshQueueIndicator();
      return;
    }
    chipsHost.replaceChildren();
    closeToolActivity();
    revealVolatileZone();
    const userBubble = appendBubble("user", displayAs ?? trimmed);
    if (displayAs !== undefined && displayAs !== trimmed) appendSkillPromptToggle(userBubble, trimmed);
    const session = ensureSession();
    await executeTurn(session, trimmed, (onEvent, signal) =>
      session.sendUserMessage(`${trimmed}\n\n${contextFooter()}`, onEvent, signal)
    );
  };

  // 한 턴 실행 공통부: 최초 전송(sendUserMessage)과 오류 후 수동 재시도(retryLastTurn)가
  // 같은 스트리밍/제안/상태 처리를 공유한다(도그푸딩 결함 ⑥).
  const executeTurn = async (
    session: AssistantSession,
    requestText: string,
    exec: (onEvent: (event: SessionEvent) => void, signal: AbortSignal) => Promise<TurnResult>
  ): Promise<void> => {
    if (turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    turnBusy = true;
    const abortController = new AbortController();
    activeAbortController = abortController;
    abortNoticeShown = false;
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
    let confirmedBuildSpecThisTurn: BuildSpec | null = null;
    let turnFailed = false; // 접힘 레일 알림 점의 색(완료=초록/오류=빨강) 결정용.
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
      } else if (event.type === "tool_call") {
        bumpToolProgress();
        appendToolLine(event.name, event.result, event.args);
        ghostPreviewUpdater.handleToolCall(event);
        assistantBubble = null; // 툴 이후 새 assistant 응답은 새 버블.
        reasoningBox = null; // 툴 이후 새 추론은 새 상자.
        currentStreamNodes = [];
        // 밑그림(스펙) 확정: 중간과정 가시화 — 에셋별 할당 영역을 카드로 보여준다.
        if (event.name === "set_build_spec" && event.result.ok && event.result.data) {
          const spec = event.result.data as BuildSpec;
          confirmedBuildSpecThisTurn = spec;
          const lines = [
            `📐 밑그림 — ${spec.title ?? spec.mapId}`,
            ...(spec.buildOrder && spec.buildOrder.length > 0 ? [`건설 순서: ${spec.buildOrder.join(" → ")}`] : []),
            ...spec.assets.map((asset) => `· ${asset.id} (${asset.kind}) 영역 (${asset.x},${asset.y}) ${asset.w}×${asset.h}${asset.style ? ` — ${asset.style}` : ""}`),
          ];
          const meta = [
            spec.pathWidth ? `통로 ${spec.pathWidth}칸` : null,
            spec.density ?? null,
            spec.layoutStyle ?? null,
          ].filter(Boolean);
          if (meta.length > 0) lines.push(meta.join(" · "));
          const bubble = appendBubble("system", lines.join("\n"));
          bubble.style.whiteSpace = "pre-wrap";
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
        // 인터뷰 진행률: 분석 결과의 커버리지를 상태줄에 표시.
        if (event.name === "analyze_map_tile_usage" && event.result.ok) {
          const data = event.result.data as { coverage?: { used: number; described: number } };
          if (data.coverage) setStatus(`타일 설명 ${data.coverage.described}/${data.coverage.used}`);
        }
      } else if (event.type === "status") {
        appendBubble("system", event.text);
      }
    };

    try {
      const result = await exec(onEvent, abortController.signal);
      endTurnProgress();
      if (result.stoppedReason === "aborted") {
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
      streamedBubbles.forEach(renderStreamedMarkdown); // 스트리밍 원문을 마크다운으로 다시 렌더.
      if (result.assistantText && !assistantBubble) assistantBubble = appendBubble("assistant", result.assistantText);
      if (result.proposedCalls.length > 0 && completenessWarnings.length === 0 && result.stoppedReason !== "error" && isMetadataOnlyProposal(result.proposedCalls) && !proposalNeedsExplicitApproval(result.proposedCalls)) {
        // 타일 지식만 바뀌었으면 검토 카드 없이 저장하고 세션(인터뷰 대화)을 이어간다.
        applyMetadataKeepSession(result.proposedCalls);
      } else if (result.proposedCalls.length > 0 && completenessWarnings.length === 0 && loadAiConfig().autoApprove === true && result.stoppedReason !== "error" && !proposalNeedsExplicitApproval(result.proposedCalls)) {
        // 자동 승인 모드: 제안을 즉시 적용한다(검토 카드 생략). 되돌리기는 Ctrl+Z.
        appendBubble("system", `자동 승인 — 변경 ${result.proposedCalls.length}건을 바로 적용합니다.`);
        acceptProposal(result.proposedCalls);
      } else {
        renderProposal(result, result.proposedCalls.length === 0 ? completenessWarnings : [], assistantBubble);
        // 0건 프로포절은 더 이상 "검토 대기"로 세션을 잡아두지 않는다(결함 ⑤ — 비블로킹).
        setStatus(
          result.stoppedReason === "error"
            ? "오류"
            : result.proposedCalls.length > 0
            ? "검토 대기"
            : completenessWarnings.length > 0
            ? "완료 — 변경 없음(린트 경고)"
            : !runningProgress
            ? "완료"
            : status.textContent ?? ""
        );
      }
      if (result.assistantText) renderQuickReplies(result.assistantText);
      // 밑그림 상태 표시 — 확정된 스펙이 있으면 사용자도 본다(다음 빌드가 이 영역 안에서만 실행됨).
      const activeSpec = session.getActiveSpec();
      if (activeSpec && result.proposedCalls.length === 0 && completenessWarnings.length === 0 && result.stoppedReason !== "error") {
        setStatus(`밑그림 확정 — 에셋 ${activeSpec.assets.length}개`);
      }
      if (result.error) appendErrorWithRetry(result.error, session, requestText);
    } catch (cause) {
      turnFailed = true;
      endTurnProgress();
      ghostPreviewUpdater.cancel();
      clearAgentGhostPreview();
      setStatus("오류");
      appendBubble("system", `오류: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      ghostPreviewUpdater.cancel();
      endTurnProgress();
      if (activeAbortController === abortController) activeAbortController = null;
      sendButton.disabled = false;
      turnBusy = false;
      refreshAbortButton();
      // 접힌 채로 턴이 끝나면 레일 점으로 알린다(초록=완료, 빨강=오류 — 펼치는 순간 소거).
      if (collapsed) panel.classList.add(turnFailed ? "is-turn-error" : "is-turn-attention");
      persistConversation(); // 매 턴 끝에 대화 기록을 저장한다(대화 기록 뷰어에서 다시 볼 수 있다).
      notifyIfObscuredByTestPlay(); // 결함 ④: 테스트 플레이 창이 패널을 가린 채 턴이 끝나면 알림.
      drainPendingSends(); // 결함 ⑨: 대기 큐의 다음 메시지를 순서대로 전송.
      if (pendingSends.length === 0) scheduleVolatileFade();
    }
  };

  // LLM 오류 버블 + 수동 [재시도] 버튼(도그푸딩 결함 ⑥). 오류 메시지에는 llmClient가
  // 만든 원인(네트워크/429/5xx/인증 등)이 그대로 담긴다. 자동 재시도 1회(지수 백오프)는
  // llmClient.chatCompletion이 이미 수행했고, 여기의 버튼은 그 이후의 수동 재개다.
  const appendErrorWithRetry = (message: string, session: AssistantSession, requestText: string): void => {
    const bubble = appendBubble("system", `오류: ${message}`);
    const actions: HTMLElement[] = [];
    if (message.includes("API 키") || message.includes("인증 실패") || message.includes("401")) {
      const settingsAction = el("button", {
        class: "ai-assistant-action ai-error-open-settings",
        text: "설정 열기",
        attrs: { type: "button", title: "어시스턴트 설정을 열고 API 키 입력으로 이동합니다" },
        dataset: { testid: "ai-error-open-settings" },
        on: { click: () => openAiSettings("apiKey") },
      });
      actions.push(settingsAction);
    }
    if (!session.canRetryLastTurn()) {
      if (actions.length > 0) bubble.append(el("div", { class: "ai-retry-row", children: actions }));
      return;
    }
    const retry = el("button", {
      class: "ai-assistant-action ai-retry-turn",
      text: "재시도",
      attrs: { type: "button", title: "끊긴 턴을 같은 문맥에서 다시 시도합니다" },
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
  };

  const sendSelectionRegionTask = async (text: string): Promise<void> => {
    const selection = currentSelectionForRegionTask();
    if (!selection) {
      selectionTaskActive = false;
      refreshContextChips();
      await sendText(text);
      return;
    }
    if (turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
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
        appendBubble("system", event.text);
        controller.auditHistory.push({ kind: "status", text: event.text, at: new Date().toISOString() });
      }
    };

    try {
      const result = await runRegion({
        mapId: selection.mapId,
        region: selection.region,
        instruction: text,
        onEvent,
      });
      streamedBubbles.forEach(renderStreamedMarkdown);
      if (result.assistantText && !assistantMessageDisplayed) appendAssistantText(result.assistantText);
      const summary = describeRegionTaskResult(result);
      appendBubble("system", summary);
      controller.auditHistory.push({ kind: "status", text: summary, at: new Date().toISOString() });
      setStatus(result.ok ? (result.applied ? "적용됨" : "완료") : "오류");
      if (!result.ok && result.error) toast(`영역 작업 실패: ${result.error}`, "error");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus("오류");
      appendBubble("system", `오류: ${message}`);
      controller.auditHistory.push({ kind: "status", text: `오류: ${message}`, at: new Date().toISOString() });
    } finally {
      endTurnProgress();
      sendButton.disabled = false;
      turnBusy = false;
      refreshAbortButton();
      persistConversation();
      notifyIfObscuredByTestPlay();
      drainPendingSends();
      if (pendingSends.length === 0) scheduleVolatileFade();
    }
  };

  // 풀스크린 테스트 플레이 창이 AI 패널을 가리고 있으면, 턴 완료를 사용자에게 알린다
  // (도그푸딩 결함 ④ — 모달 뒤에서 턴/프로포절이 조용히 진행되던 문제). 자동으로 창을
  // 닫거나 열지 않는다: 완료 알림 + 기존 수동 버튼(편집으로/닫기)으로 확인하게 한다.
  const notifyIfObscuredByTestPlay = (): void => {
    if (typeof document === "undefined" || typeof document.querySelector !== "function") return;
    if (!document.querySelector('[data-testid="test-play-window"]')) return;
    toast("AI 응답 완료 — 테스트 플레이 창 뒤에 결과/제안이 있습니다. '편집으로'를 눌러 확인하세요.", "info");
  };

  // 마지막으로 직접 입력한 요청 — "내 스킬로 저장"의 기본 템플릿이 된다.
  let lastTypedMessage = "";
  const send = async (): Promise<void> => {
    const text = input.value.trim();
    if (!text) return;
    if (!ensureConfigReadyForSend()) return;
    if (selectionTaskActive && currentSelectionForRegionTask() && turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    lastTypedMessage = text;
    input.value = "";
    refreshSlash();
    if (selectionTaskActive && currentSelectionForRegionTask()) await sendSelectionRegionTask(text);
    else await sendText(text);
  };

  sendButton.addEventListener("click", () => void send());
  input.addEventListener("keydown", (event) => {
    // 엔터 = 즉시 전송, Shift+Enter = 줄바꿈. IME 조합 중(한글 입력 확정)에는 전송하지 않는다.
    const composing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
    if (event.key === "Escape" && selectionTaskActive) {
      event.preventDefault();
      selectionTaskActive = false;
      refreshContextChips();
      return;
    }
    if (input.value.startsWith("/") && !composing) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const count = slashSkillMatches(input.value).length;
        if (count > 0) slashActiveIndex = (slashActiveIndex + 1) % count;
        refreshSlash();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const count = slashSkillMatches(input.value).length;
        if (count > 0) slashActiveIndex = (slashActiveIndex - 1 + count) % count;
        refreshSlash();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        slashHost.replaceChildren();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
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
    void sendText(prompt, skill.displayAs?.(args) ?? `${skill.icon} ${skill.name}`);
  };

  // 빈 대화 시작 화면 — 인사 + 큰 스킬 카드. 위상에 맞는 첫인상.
  const buildStartScreen = (): HTMLElement => {
    const featured = ["interview", "build-house", "map-audit", "build-village", "demo-teach", "quest-builder"];
    const byId = new Map(listAllSkills().map((skill) => [skill.id, skill]));
    const featuredSkills = featured
      .map((id) => byId.get(id))
      .filter((skill): skill is SkillDef => Boolean(skill));
    const cards = featuredSkills.map((skill) =>
      el("button", {
        class: "ai-start-card",
        attrs: { type: "button", title: skill.description },
        dataset: { testid: `ai-start-${skill.id}` },
        children: [
          el("span", { class: "ai-start-card-icon", text: skill.icon }),
          el("span", { class: "ai-start-card-name", text: skill.name }),
        ],
        on: { click: () => drawer.run(skill) },
      })
    );
    const guideItems = featuredSkills.map((skill) =>
      el("li", {
        children: [
          el("strong", { text: skill.name }),
          " — ",
          el("span", { text: skill.description }),
        ],
      })
    );
    const resume = resumeCandidate
      ? [el("button", {
          class: "ai-assistant-action ai-resume-conversation",
          text: "이전 대화 이어가기",
          attrs: { type: "button", title: "저장된 직전 AI 대화를 엽니다" },
          dataset: { testid: "ai-resume-conversation" },
          on: { click: () => restoreConversationById(resumeCandidate.id) },
        })]
      : [];
    return el("div", {
      class: "ai-start-screen",
      dataset: { testid: "ai-start-screen" },
      children: [
        el("div", { class: "ai-start-title", text: "무엇을 만들까요?" }),
        el("div", { class: "ai-start-sub", text: "자연어로 요청하거나, 스킬로 시작하세요. (입력창 / · Ctrl+K)" }),
        ...resume,
        el("div", { class: "ai-start-grid", children: cards }),
        el("div", {
          class: "ai-start-guide",
          dataset: { testid: "ai-start-guide" },
          children: [
            el("details", {
              children: [
                el("summary", { text: "ⓘ 스킬 안내" }),
                el("ul", { children: guideItems }),
              ],
            }),
          ],
        }),
      ],
    });
  };
  if (autoRestoreConversation) restoreConversationRecord(autoRestoreConversation, "auto");
  else {
    startScreen = buildStartScreen();
    log.append(startScreen);
  }

  const skillToggle = el("button", {
    class: "ai-assistant-action ai-skill-toggle",
    text: "/",
    attrs: { type: "button", title: "스킬 검색 열기", "aria-label": "스킬 검색 열기" },
    dataset: { testid: "ai-skill-slash-toggle" },
    on: {
      click: () => {
        input.value = "/";
        input.focus();
        slashActiveIndex = 0;
        refreshSlash();
      },
    },
  });

  // 슬래시 자동완성: "/집"처럼 입력하면 입력창 위에 스킬 목록이 뜬다.
  const slashHost = el("div", { class: "ai-slash-host", dataset: { testid: "ai-slash-host" } });
  let slashActiveIndex = 0;
  const refreshSlash = (): void => {
    const value = input.value;
    if (!value.startsWith("/")) {
      slashHost.replaceChildren();
      slashActiveIndex = 0;
      return;
    }
    const matches = slashSkillMatches(value);
    slashActiveIndex = Math.max(0, Math.min(slashActiveIndex, Math.max(0, matches.length - 1)));
    slashHost.replaceChildren(
      renderSlashList(
        value,
        (skill) => {
          input.value = "";
          slashHost.replaceChildren();
          drawer.run(skill);
        },
        {
          activeIndex: slashActiveIndex,
          onViewAll: () => {
            input.value = "";
            slashHost.replaceChildren();
            if (drawer.element.hidden) drawer.toggle();
            else drawer.refresh();
          },
        }
      )
    );
  };
  const pickActiveSlashSkill = (): boolean => {
    if (!input.value.startsWith("/")) return false;
    const skill = slashSkillMatches(input.value)[slashActiveIndex];
    if (!skill) return false;
    input.value = "";
    slashHost.replaceChildren();
    drawer.run(skill);
    return true;
  };
  input.addEventListener("input", () => {
    slashActiveIndex = 0;
    refreshSlash();
  });
  // 입력창 포커스 시 휘발 존(웰컴/대화)을 펼치고, 빈 대화 상태로 포커스를 잃으면 접어 맵을 비운다.
  input.addEventListener("focus", () => revealVolatileZone());
  input.addEventListener("blur", () => {
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
    // 오버레이 안(스킬 카드 등) 클릭이 blur보다 먼저 처리되도록 잠깐 늦춘 뒤 접는다.
    window.setTimeout(() => {
      if (typeof document !== "undefined" && document.activeElement === input) return;
      hideVolatileIfIdle();
    }, 160);
  });

  // AI가 지금 무엇을 보고 있는지 — 현재 맵 + 선택 영역 칩.
  const contextChips = el("div", { class: "ai-context-chips", dataset: { testid: "ai-context-chips" } });
  const clearSelectionTaskContext = (): void => {
    if (!selectionTaskActive) return;
    selectionTaskActive = false;
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
  const refreshContextChips = (): void => {
    if (typeof document === "undefined") return; // fakeDom 해제 후 잔존 구독 가드(테스트).
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
  editorState.subscribe(() => refreshContextChips());
  store.subscribe(() => refreshContextChips());
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
  let collapsed = loadPanelCollapsed();
  const collapseButton = el("button", {
    class: "ai-chat-collapse",
    attrs: { type: "button", title: "패널 접기/펼치기", "aria-label": "AI 패널 접기/펼치기", "aria-expanded": String(!collapsed) },
    dataset: { testid: "ai-collapse" },
  }) as HTMLButtonElement;
  const collapsedRestore = el("button", {
    class: "ai-collapsed-restore",
    attrs: { type: "button", title: "AI 패널 펼치기", "aria-label": "AI 패널 펼치기" },
    dataset: { testid: "ai-collapsed-restore" },
    children: [
      // 상태 점: 접힌 동안에도 진행(호박 펄스)/완료(초록)/오류(빨강)를 알린다.
      el("span", { class: "ai-collapsed-restore-dot", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "ai-collapsed-restore-float", text: "🤖 AI ▸" }),
      el("span", { class: "ai-collapsed-restore-rail-icon", text: "🤖" }),
      el("span", { class: "ai-collapsed-restore-rail-label", text: "AI 어시스턴트" }),
    ],
  }) as HTMLButtonElement;

  const titleEl = el("h2", { text: "AI 어시스턴트" });
  // 사용자에게 "AI한테 뭘 시킬 수 있는지"를 보여주는 툴 브라우저.
  const toolsButton = el("button", {
    class: "ai-chat-tools-button",
    text: "🧰",
    attrs: { type: "button", title: `AI가 쓸 수 있는 툴 ${totalToolCount()}개 보기`, "aria-label": "AI 도구 보기" },
    dataset: { testid: "ai-tools-browser" },
    on: { click: () => void openToolBrowserModal() },
  });
  // 하네스 뷰어(🔬): plan→execute→review 전환, 오케스트레이션 주입 원문, 툴 인자/결과, 토큰 사용의 관측 지점.
  const harnessButton = el("button", {
    class: "ai-chat-tools-button",
    text: "🔬",
    attrs: { type: "button", title: "하네스 — AI 내부 동작 타임라인(단계 전환·주입·툴·토큰)", "aria-label": "AI 하네스 뷰어 열기" },
    dataset: { testid: "ai-harness" },
    on: {
      click: () =>
        void openHarnessModal({
          audit: [...controller.auditHistory, ...(controller.session?.getAuditEntries() ?? [])],
          statusTimeline: controller.statusTimeline,
          getSnapshot: () => controller.session?.getHarnessSnapshot() ?? null,
        }),
    },
  });
  const settingsButton = el("button", {
    class: "ai-chat-tools-button",
    text: "⚙",
    attrs: { type: "button", title: "엔드포인트/모델/API 키 설정", "aria-label": "AI 설정 열기" },
    dataset: { testid: "ai-settings-toggle" },
    on: {
      click: () => {
        applyHistoryOpen(true);
        openAiSettings("first");
      },
    },
  });
  const currentChatDock = (): ChatDock => options.getChatDock?.() ?? editorState.get().chatDock;
  const refreshDockToggleButton = (button: HTMLButtonElement): void => {
    const mode = currentChatDock();
    button.textContent = mode === "side" ? "⇣" : "⇥";
    button.setAttribute("title", mode === "side" ? "맵 하단 플로팅으로 이동" : "우측 사이드패널로 이동");
    button.setAttribute("aria-label", mode === "side" ? "채팅을 맵 하단 플로팅으로 이동" : "채팅을 우측 사이드패널로 이동");
    button.setAttribute("aria-pressed", String(mode === "side"));
  };
  const refreshDockToggleButtons = (): void => {
    refreshDockToggleButton(dockToggleButton);
    refreshDockToggleButton(commandBarDockButton);
  };
  const onDockToggleClick = (): void => {
    if (options.onChatDockToggle) options.onChatDockToggle();
    else editorState.set({ chatDock: currentChatDock() === "side" ? "float" : "side" });
    refreshDockToggleButtons();
  };
  const dockToggleButton = el("button", {
    class: "ai-chat-tools-button",
    attrs: { type: "button" },
    dataset: { testid: "chat-dock-toggle" },
    on: { click: onDockToggleClick },
  }) as HTMLButtonElement;
  // float 모드에선 헤더가 숨겨져 헤더 토글로는 전환 불가 — 커맨드바에도 같은 토글을 둔다.
  const commandBarDockButton = el("button", {
    class: "ai-chat-tools-button ai-command-bar-dock-toggle",
    attrs: { type: "button" },
    dataset: { testid: "chat-dock-toggle-bar" },
    on: { click: onDockToggleClick },
  }) as HTMLButtonElement;
  refreshDockToggleButtons();
  // 감사 로그 내보내기 — 도구줄에 라벨 달아 상주(중요 기능이라 잘 보이게, #5).
  exportButton = el("button", {
    class: "ai-assistant-action ai-export-button",
    text: "내보내기",
    attrs: { type: "button", title: "이 대화의 감사 로그를 JSON으로 내보내기 — 무엇을 했는지 기록", "aria-label": "대화 내보내기" },
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
    text: "↶ 되돌리기",
    attrs: { type: "button", title: "직전 변경 되돌리기(Ctrl+Z)" },
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
  // AI 스튜디오 모드 — 에디터를 덮는 넓은 워크스페이스(좌: 대화, 우: 스킬 레일).
  let studio = typeof localStorage !== "undefined" && localStorage.getItem(STUDIO_MODE_KEY) === "1";
  let historyOpen = false;
  let applyHistoryOpen: (next: boolean) => void = () => {};
  let applyStudio: (next: boolean) => void = () => {};
  const studioButton = el("button", {
    class: "ai-chat-tools-button",
    text: "⛶",
    attrs: { type: "button", title: "AI 스튜디오 — 넓게 펼치기/되돌리기", "aria-label": "AI 스튜디오 펼치기" },
    dataset: { testid: "ai-studio-toggle" },
  });
  // 구 도크 버튼은 전체 기록 패널 토글로 역할을 바꾼다. testid는 호환을 위해 유지한다.
  const historyButton = el("button", {
    class: "ai-chat-tools-button",
    text: "🕒",
    attrs: { type: "button", title: "전체 기록 열기", "aria-label": "전체 기록 열기" },
    dataset: { testid: "ai-dock-toggle" },
  });
  // 새 대화(#6): 현재 대화를 기록에 저장하고 문맥을 비운다. 대화가 길수록 비용이 늘어나므로 새 주제는 새 대화로.
  const newSessionButton = el("button", {
    class: "ai-assistant-action ai-new-session",
    text: "🆕 새 대화",
    attrs: { type: "button", title: "새 대화 시작 — 대화가 길어지면 토큰 비용이 늘어납니다. 새 주제는 새 대화로 시작하세요(이전 대화는 기록에 저장됨)." },
    dataset: { testid: "ai-new-session" },
    on: {
      click: () => {
        persistConversation(); // 비우기 전에 현재 대화를 기록 저장.
        dropSession(controller);
        controller.auditHistory = [];
        conversationId = genId("conv");
        setPendingProposalMessage(null);
        setLastAppliedProposalMessage(null);
        proposalHost.replaceChildren();
        closeProposalModal();
        chipsHost.replaceChildren();
        log.replaceChildren();
        startScreen = buildStartScreen();
        log.append(startScreen);
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
  // 제목줄(항상 보임): 제목·상태·접기. 아이콘 뭉침을 걷어내 접었을 때도 깔끔하게.
  const statusGroup = el("div", {
    class: "ai-status-group",
    dataset: { testid: "ai-status-group" },
    children: [status, abortButton, commandBarDockButton],
  });
  const fontButton = el("button", {
    class: "ai-chat-tools-button",
    text: "가",
    attrs: { type: "button", title: "글자 크기 전환 (작게 → 보통 → 크게)", "aria-label": "글자 크기 전환" },
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
  const header = el("div", {
    class: "ai-chat-header",
    children: [
      titleEl,
      el("span", { class: "ai-header-actions", children: [fontButton, settingsButton, dockToggleButton, historyButton] }),
      collapseButton,
    ],
  });
  // 도구줄(접으면 숨김): 새 대화 · 되돌리기 · 로그 | 툴 · 스튜디오 (설정/도킹은 헤더로 이동 — §2.3 ①).
  const toolbar = el("div", {
    class: "ai-chat-toolbar",
    dataset: { testid: "ai-chat-toolbar" },
    children: [
      newSessionButton,
      undoLastButton,
      exportButton,
      el("span", { class: "ai-toolbar-sep" }),
      toolsButton,
      harnessButton,
      studioButton,
    ],
  });

  const inputRow = el("div", {
    class: "ai-chat-input-row",
    children: [skillToggle, input, sendButton],
  });
  const { commandBar, commandMenu, commandMenuToggle } = createCommandBarElements({
    slashHost,
    contextChips,
    queueIndicator,
    inputRow,
    statusGroup,
  });
  const volatileLogMount = el("div", {
    class: "ai-rising-volatile-zone",
    dataset: { testid: "ai-rising-volatile-zone" },
    children: [log],
  });
  volatileZone = volatileLogMount;
  // 초기(빈 대화)엔 휘발 존을 접어 맵을 가리지 않는다. 입력 포커스/첫 콘텐츠에서 펼쳐진다.
  volatileLogMount.hidden = true;
  const stickyProposalZone = el("div", {
    class: "ai-rising-sticky-zone",
    dataset: { testid: "ai-rising-sticky-zone" },
    // 제안 카드 본체는 몰입 모달에 상주 — 여기엔 0건 알림과 '검토 대기' pill만 남는다.
    children: [proposalNoticeHost, proposalPill],
  });
  const risingOverlay = el("div", {
    class: "ai-rising-overlay",
    dataset: { testid: "ai-rising-overlay" },
    children: [volatileLogMount, stickyProposalZone],
  });
  const historyLogMount = el("div", { class: "ai-history-log-mount" });
  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [
      settings.element,
      historyLogMount,
      chipsHost,
    ],
  });
  const body = el("div", { class: "ai-chat-body", children: [mainColumn, drawer.element] });

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "AI 어시스턴트 채팅" },
    dataset: { testid: "ai-panel" },
    children: [header, toolbar, body, collapsedRestore, risingOverlay, commandBar, proposalModalRoot],
  });
  // 저장된 글자 크기를 부팅 시 즉시 적용(영속 — V3C).
  applyAiFontSize(panel, loadAiFontSize());
  // 헤드리스/콘솔 디버깅용 하네스 접근점: window.__rpgzzuAiHarness() → 주입 포함 원본 메시지 + 감사 로그.
  if (typeof window !== "undefined") {
    window.__rpgzzuAiHarness = () => controller.session?.getHarnessSnapshot() ?? null;
  }

  // 크기 커스텀: 좌상단 코너 핸들 드래그(오른쪽·아래가 고정이라 왼쪽·위로 끌면 커진다).
  let panelSize = loadPanelSize();
  const applySize = (): void => {
    if (
      collapsed ||
      !panelSize ||
      panel.classList.contains("is-studio") ||
      panel.classList.contains("is-docked") ||
      panel.classList.contains("chat-dock-float") ||
      panel.classList.contains("chat-dock-side")
    ) {
      panel.setAttribute("style", "");
      return;
    }
    panel.setAttribute("style", `width:${panelSize.width}px;height:${panelSize.height}px;`);
  };
  const resizeHandle = el("div", {
    class: "ai-chat-resize-handle",
    attrs: { title: "드래그로 패널 크기 조절", "aria-label": "패널 크기 조절" },
    dataset: { testid: "ai-resize-handle" },
  });
  resizeHandle.addEventListener("pointerdown", (event: PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = panel.getBoundingClientRect ? panel.getBoundingClientRect() : { width: 320, height: 480 };
    const startWidth = panelSize?.width ?? rect.width;
    const startHeight = panelSize?.height ?? rect.height;
    const onMove = (move: PointerEvent): void => {
      panelSize = clampPanelSize({
        width: startWidth + (startX - move.clientX),
        height: startHeight + (startY - move.clientY),
      });
      applySize();
    };
    const onUp = (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (panelSize) savePanelSize(panelSize);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
  panel.append(resizeHandle);

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
  const toggleCollapsed = (): void => {
    collapsed = !collapsed;
    if (collapsed && studio) applyStudio(false); // 접으면 스튜디오도 해제.
    savePanelCollapsed(collapsed);
    applyCollapsed();
  };
  const restoreCollapsed = (): void => {
    if (!collapsed) return;
    collapsed = false;
    savePanelCollapsed(false);
    applyCollapsed();
  };
  collapseButton.addEventListener("click", toggleCollapsed);
  collapsedRestore.addEventListener("click", restoreCollapsed);
  applyCollapsed();

  applyHistoryOpen = (next: boolean): void => {
    historyOpen = next;
    if (historyOpen) {
      panel.classList.add("is-history-open");
      if (!panel.classList.contains("chat-dock-side")) panel.classList.add("is-docked");
      historyLogMount.append(log);
      historyButton.textContent = "×";
      historyButton.setAttribute("title", "전체 기록 닫기");
      historyButton.setAttribute("aria-label", "전체 기록 닫기");
    } else {
      panel.classList.remove("is-history-open", "is-docked");
      volatileLogMount.append(log);
      historyButton.textContent = "🕒";
      historyButton.setAttribute("title", "전체 기록 열기");
      historyButton.setAttribute("aria-label", "전체 기록 열기");
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.classList.remove("ai-panel-docked");
      document.body.classList.add("ai-command-bar-active");
    }
    applySize();
  };
  historyButton.addEventListener("click", () => applyHistoryOpen(!historyOpen));

  // 스튜디오 모드 적용: 넓은 레이아웃 + 스킬 레일 상시 노출.
  applyStudio = (next: boolean): void => {
    studio = next;
    if (typeof localStorage !== "undefined") localStorage.setItem(STUDIO_MODE_KEY, studio ? "1" : "0");
    if (studio) {
      if (collapsed) {
        collapsed = false;
        savePanelCollapsed(false);
        applyCollapsed();
      }
      panel.classList.add("is-studio");
      panel.setAttribute("style", ""); // 커스텀 크기 대신 전체 폭.
      // 스튜디오는 전체 오버레이라 기록 패널을 넓은 워크스페이스로 전환한다.
      historyOpen = true;
      historyLogMount.append(log);
      panel.classList.remove("is-docked");
      if (typeof document !== "undefined" && document.body) document.body.classList.remove("ai-panel-docked");
      drawer.element.hidden = false;
      drawer.refresh();
      studioButton.textContent = "🗗";
      studioButton.setAttribute("aria-label", "AI 스튜디오 되돌리기");
    } else {
      panel.classList.remove("is-studio");
      drawer.element.hidden = true;
      studioButton.textContent = "⛶";
      studioButton.setAttribute("aria-label", "AI 스튜디오 펼치기");
      applyHistoryOpen(false);
    }
  };
  studioButton.addEventListener("click", () => applyStudio(!studio));

  commandMenu.replaceChildren(
    el("button", {
      class: "ai-command-menu-item",
      text: "🕒 전체 기록",
      attrs: { type: "button", role: "menuitem" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); applyHistoryOpen(true); } },
    }),
    el("button", {
      class: "ai-command-menu-item",
      text: "➕ 새 대화",
      attrs: { type: "button", role: "menuitem" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); newSessionButton.click(); } },
    }),
    // 되돌리기/내보내기/툴은 구 헤더 툴바가 기본(바 전용) 상태에서 숨겨지며 도달 불가가 됐던 것 — 메뉴로 복원.
    el("button", {
      class: "ai-command-menu-item",
      text: "↩️ 되돌리기",
      attrs: { type: "button", role: "menuitem", title: "마지막 AI 적용 되돌리기" },
      dataset: { testid: "ai-command-menu-undo" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); undoLastButton.click(); } },
    }),
    el("button", {
      class: "ai-command-menu-item",
      text: "📤 대화 내보내기",
      attrs: { type: "button", role: "menuitem", title: "대화 로그 내보내기" },
      dataset: { testid: "ai-command-menu-export" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); exportButton?.click(); } },
    }),
    el("button", {
      class: "ai-command-menu-item",
      text: "🧰 툴 브라우저",
      attrs: { type: "button", role: "menuitem" },
      dataset: { testid: "ai-command-menu-tools" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); toolsButton.click(); } },
    }),
    el("button", {
      class: "ai-command-menu-item",
      text: "⚙️ 설정",
      attrs: { type: "button", role: "menuitem" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); applyHistoryOpen(true); openAiSettings("first"); } },
    }),
    el("button", {
      class: "ai-command-menu-item",
      text: "🎬 스튜디오",
      attrs: { type: "button", role: "menuitem" },
      on: { click: () => { commandMenu.hidden = true; commandMenuToggle.setAttribute("aria-expanded", "false"); applyStudio(true); } },
    })
  );

  // 초기 적용: 스튜디오가 켜져 있으면 스튜디오가 이기고, 아니면 기록 패널은 숨긴다.
  if (studio) applyStudio(true);
  else applyHistoryOpen(false);

  const handleAiAssist = (event: Event): void => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    if (!isAiAssistDetail(detail)) return;
    restoreCollapsed();
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
    targetWindow.addEventListener("rpgzzu:ai-assist", handleAiAssist);
    cleanupAiAssistBridge = () => targetWindow.removeEventListener("rpgzzu:ai-assist", handleAiAssist);
  }

  // Ctrl/Cmd+K — 스킬 팔레트(검색+Enter 실행). 전역 1회만 등록.
  if (typeof window !== "undefined" && !(window as { __rpgzzuSkillHotkey?: boolean }).__rpgzzuSkillHotkey) {
    (window as { __rpgzzuSkillHotkey?: boolean }).__rpgzzuSkillHotkey = true;
    document.addEventListener?.("keydown", (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.focus();
        revealVolatileZone();
      }
    });
  }

  return panel;
}
