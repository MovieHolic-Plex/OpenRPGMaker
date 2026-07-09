// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일만 브라우저/스토어에 의존한다. 세션 로직(assistantSession)/클라이언트(llmClient)는 순수.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - API 키는 설정 폼에서만 입력(localStorage). 소스/프로젝트 JSON에 하드코딩 금지.

import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, recordProjectSnapshot, undoMapEdit } from "@/editor/mapEditHistory";
import { computeAssistantToolMode } from "@/editor/assistantToolMode";
import { editorState, type ChatDock } from "@/editor/editorState";
import { AI_SELECTION_CONTEXT_EVENT, aiSelectionContextDetail } from "@/editor/aiSelectionContext";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { clearAgentGhostPreview, createThrottledAgentGhostPreviewUpdater } from "@/editor/agentGhostPreview";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal, type DemoTeachSeed } from "@/editor/panels/demoTeachCanvas";
import { openToolBrowserModal, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import { describeRegionTaskResult, runRegionTask, type RegionTaskOptions, type RegionTaskResult } from "@/editor/regionTask/runRegionTask";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { commitChangeset, getTool, summarizeChanges, type ToolResult } from "@/editor/tools";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { currentAgentEditorIdentity } from "@/project/editorIdentity";
import { combineDiffs, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { showConfirm } from "@/editor/ui/modal";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  METADATA_ONLY_TOOLS,
  proposalApprovalWarnings,
  proposalNeedsExplicitApproval,
  type AuditEntry,
  type ProposedCall,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import type { BuildSpec } from "@/ai/buildSpec";
import {
  proposalCompletenessWarnings,
  proposalHasChangedMap,
  requestLikelyExpectsChange,
} from "@/ai/proposalCompleteness";
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
import { DEFAULT_BASE_URL, DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig } from "@/ai/llmClient";
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
import {
  enforceProposalDependencies,
  mapIdCreatedByCall,
  mapIdsReferencedByCall,
  positive,
  proposalDependencyIndexes,
  proposalHumanSummaryLine,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  reassembleSelectedProposalProject,
} from "./aiProposalSummary";
import {
  collectPendingBuilds,
  proposalAcceptButtonLabel,
  rebindPendingBuildArgs,
  runPendingBuilds,
  type PendingBuildOutcome,
} from "./aiProposalFusion";
import {
  callsWithVocabularyEdits,
  formatAiRunningStatus,
  hasVocabularyEdits,
  renderToolActivityEntry,
  renderVocabularyCardList,
  reasoningToggleText,
  vocabularyCardsData,
  type VocabularyCardEdit,
} from "./aiChatRenderers";
import { appendConversationBubble, renderStreamedMarkdown, type AiBubbleRole } from "./aiConversationLog";
import { createProposalModalElements } from "./aiProposalModal";
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

const SESSION_BACKUP_KEY = "rpg-zzu:ai-session-backup";
const VOLATILE_OVERLAY_IDLE_MS = 6000;
const MAP_TILE_TOOLS = new Set([
  "paint_tiles", "paint_road", "scatter_object", "stamp_structure", "build_house", "clear_region", "resize_map",
  "tile_paint", "tile_road", "tile_scatter", "tile_structure",
  // 타일 v3 공정 프리미티브(V3B)
  "build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase",
]);

function isWriteTool(name: string): boolean {
  return getTool(name)?.mode === "write";
}

export interface AiChatPanelOptions {
  readonly clock?: () => number;
  readonly getChatDock?: () => ChatDock;
  readonly onChatDockToggle?: () => void;
  readonly regionTaskRunner?: (options: RegionTaskOptions) => Promise<RegionTaskResult>;
}

type AiAssistDetail =
  | { readonly kind: "cluster-edit"; readonly tilesetId: string; readonly groupId: string }
  | { readonly kind: "unclassified-analysis"; readonly tilesetId: string; readonly sampleTiles: readonly number[]; readonly total: number };

let cleanupAiAssistBridge: (() => void) | null = null;

export function isAiConfigReady(config: AiConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.model.trim() && config.apiKey.trim());
}

function phaseStatusText(phase: Extract<SessionEvent, { type: "phase" }>["value"]): string {
  if (phase === "plan") return "계획 중(m3)";
  if (phase === "execute") return "실행 중(flash)";
  return "검수 중(m3)";
}

export function displayUserAuditText(text: string): string {
  return text.split(/\n\n\[컨텍스트\]/u)[0] ?? text;
}

// 세션 시작 시 프로젝트 스냅샷 1회 백업(기존 자동저장과 별도 슬롯). 용량 초과 시 조용히 생략.
function backupProjectSnapshot(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      SESSION_BACKUP_KEY,
      JSON.stringify({ at: new Date().toISOString(), project: store.getCurrent() })
    );
  } catch {
    /* quota 초과 등 — 백업 실패는 치명적이지 않으므로 무시 */
  }
}

export function proposalHasMapTileChanges(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => MAP_TILE_TOOLS.has(call.name) && positive(call.result.diff?.tilesChanged) > 0);
}

export function proposalPreviewMapId(calls: readonly ProposedCall[], before: Project, after: Project): string | null {
  if (!proposalHasMapTileChanges(calls)) return null;
  for (const call of calls) {
    for (const mapId of mapIdsReferencedByCall(call)) {
      if (before.maps[mapId] || after.maps[mapId]) return mapId;
    }
    const created = mapIdCreatedByCall(call);
    if (created && after.maps[created]) return created;
  }
  return after.startMapId && after.maps[after.startMapId] ? after.startMapId : null;
}

export function hasDestructiveCall(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => call.destructive);
}

function aiHistoryLabel(calls: readonly ProposedCall[]): string {
  const first = calls[0];
  const summary = first?.summary.trim() || first?.name || "변경";
  const short = summary.length > 28 ? `${summary.slice(0, 28)}…` : summary;
  return calls.length > 1 ? `AI: ${short} 외 ${calls.length - 1}건` : `AI: ${short}`;
}

function currentHistoryMapId(): string | null {
  const project = store.getCurrent();
  return editorState.get().currentMapId ?? project.startMapId ?? null;
}

// 타일 지식(메타데이터) 전용 툴 목록은 assistantSession과 공유한다(제안 카드 없이 즉시 반영되는 계열).
export function isMetadataOnlyProposal(calls: readonly ProposedCall[]): boolean {
  return calls.length > 0 && calls.every((call) => METADATA_ONLY_TOOLS.has(call.name));
}

// 커스텀 인앱 모달(§2.4) — 네이티브 confirm 대체. 경고가 없으면 동기 true를 돌려
// 수락 경로가 마이크로태스크로 미뤄지지 않게 한다(적용 직후 상태를 읽는 흐름 보존).
function confirmRuleApproval(warnings: readonly string[]): true | Promise<boolean> {
  if (warnings.length === 0) return true;
  return showConfirm({ title: "승인 확인", message: `${warnings.join("\n")}\n\n이 규칙을 적용할까요?`, confirmLabel: "적용" });
}

function attachCompletenessWarnings(calls: readonly ProposedCall[], warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  const diff = calls.find((call) => call.result.diff)?.result.diff;
  if (!diff) return;
  for (const warning of warnings) {
    if (!diff.warnings.includes(warning)) diff.warnings.push(warning);
  }
}

function completenessSpecForProposal(
  confirmedThisTurn: BuildSpec | null,
  activeAtTurnStart: BuildSpec | null,
  calls: readonly ProposedCall[],
  requestText: string
): BuildSpec | null {
  if (confirmedThisTurn) return calls.length > 0 || requestLikelyExpectsChange(requestText) ? confirmedThisTurn : null;
  if (!activeAtTurnStart) return null;
  if (proposalHasChangedMap(calls, activeAtTurnStart.mapId)) return activeAtTurnStart;
  if (calls.length === 0 && requestLikelyExpectsChange(requestText)) return activeAtTurnStart;
  return null;
}

// UI 상태 배지 전이 기록(결함 ⑬) — "검토 대기" 멈춤 같은 문제를 export 로그로 진단 가능하게.
export interface StatusTransition {
  readonly at: string;
  readonly status: string;
}

// 누적 히스토리 + 현재 세션의 감사 항목(타임스탬프 포함) + UI 상태 전이 타임라인을 합쳐
// 내보내기 JSON을 만든다. 비었으면 null. (결함 ⑬ — 구조화 세션 로그 export)
export function combineAuditJson(
  history: readonly AuditEntry[],
  session: AssistantSession | null,
  model: string,
  statusTimeline: readonly StatusTransition[] = []
): string | null {
  const entries = [...history, ...(session?.getAuditEntries() ?? [])];
  if (entries.length === 0 && statusTimeline.length === 0) return null;
  return JSON.stringify({ model, exportedAt: new Date().toISOString(), entries, statusTimeline }, null, 2);
}

function exportCombinedAudit(controller: ChatController): string | null {
  return combineAuditJson(controller.auditHistory, controller.session, loadAiConfig().model, controller.statusTimeline);
}

// 0건 프로포절 비블로킹 알림(도그푸딩 결함 ⑤): 세션을 "검토 대기"로 잡아두는 검토 카드 대신
// 자동 소거되는 패시브 알림을 쓴다. 완성도 린트 경고는 대화 로그(system 버블)에 남는다(호출자 책임).
// 전용 testid: ai-proposal-empty-notice / ai-proposal-dismiss (기존 ai-proposal-reject 재사용 제거).
export const EMPTY_PROPOSAL_NOTICE_DISMISS_MS = 8000;

export function renderEmptyProposalNotice(lines: readonly string[], onDismiss: () => void): HTMLElement {
  return el("div", {
    class: "ai-proposal-card ai-proposal-empty",
    dataset: { testid: "ai-proposal-empty-notice" },
    children: [
      el("div", { class: "ai-proposal-title", text: "변경 제안 없음 (0건)" }),
      ...(lines.length > 0
        ? [el("div", {
            class: "ai-proposal-lines",
            children: lines.map((line) => el("div", { class: "ai-proposal-line", text: line })),
          })]
        : []),
      el("div", {
        class: "ai-proposal-actions",
        children: [
          el("button", {
            class: "ai-assistant-action",
            text: "닫기",
            attrs: { type: "button", title: "이 알림은 잠시 후 자동으로 사라집니다" },
            dataset: { testid: "ai-proposal-dismiss" },
            on: { click: onDismiss },
          }),
        ],
      }),
    ],
  });
}

type AiMessageBadgeState = "proposal" | "applied" | "discarded" | "reverted";

const AI_MESSAGE_BADGE_LABELS: Record<AiMessageBadgeState, string> = {
  proposal: "제안",
  applied: "적용됨",
  discarded: "폐기됨",
  reverted: "되돌려짐",
};

function setAssistantMessageBadge(bubble: HTMLElement | null, state: AiMessageBadgeState): void {
  if (!bubble) return;
  bubble.querySelector(".ai-msg-badge")?.remove();
  bubble.classList.remove("is-proposal", "is-applied", "is-discarded", "is-reverted");
  bubble.classList.add(`is-${state}`);
  const badge = el("span", {
    class: `ai-msg-badge is-${state}`,
    text: AI_MESSAGE_BADGE_LABELS[state],
    dataset: { testid: `ai-msg-badge-${state}` },
  });
  bubble.prepend(badge);
}

function appendSkillPromptToggle(bubble: HTMLElement, prompt: string): void {
  const details = el("details", {
    class: "ai-skill-prompt-details",
    dataset: { testid: "ai-skill-prompt-details" },
    children: [
      el("summary", { text: "실제 지시 보기", dataset: { testid: "ai-skill-prompt-toggle" } }),
      el("pre", { class: "ai-skill-prompt-raw", text: prompt, dataset: { testid: "ai-skill-prompt-raw" } }),
    ],
  });
  bubble.append(details);
}

function renderProposalMapThumbnail(project: Project, mapId: string, kind: "before" | "after"): HTMLElement {
  const map = project.maps[mapId];
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "ai-proposal-thumb-canvas";
  const wrap = el("div", {
    class: "ai-proposal-thumb",
    attrs: { role: "img", "aria-label": `${kind === "before" ? "현재" : "초안"} 미니맵` },
    dataset: { testid: `ai-proposal-thumb-${kind}` },
    children: [
      el("span", { class: "ai-proposal-thumb-label", text: kind === "before" ? "현재" : "초안" }),
      canvas,
    ],
  });
  if (!map || typeof canvas.getContext !== "function") {
    wrap.dataset.fallback = "true";
    return wrap;
  }
  const zoom = Math.min(1, 104 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1));
  const selection = { x: -1, y: -1, zoom };
  void drawTransferMapPreview({ canvas, project, mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
    drawTransferFallback({ canvas, map, selection });
  });
  return wrap;
}

interface ChatController {
  session: AssistantSession | null;
  // 폐기된(수락/거부) 세션들의 감사 항목 누적 — 내보내기가 세션 폐기 후에도 동작해야 한다.
  auditHistory: AuditEntry[];
  // UI 상태 배지 전이 타임라인(결함 ⑬) — 로그 export에 포함된다.
  statusTimeline: StatusTransition[];
}

function isAiAssistDetail(value: unknown): value is AiAssistDetail {
  if (typeof value !== "object" || value === null) return false;
  const detail = value as Partial<AiAssistDetail>;
  if (detail.kind === "cluster-edit") {
    return typeof detail.tilesetId === "string" && typeof detail.groupId === "string";
  }
  if (detail.kind !== "unclassified-analysis") return false;
  return (
    typeof detail.tilesetId === "string" &&
    Array.isArray(detail.sampleTiles) &&
    detail.sampleTiles.every((tile) => Number.isInteger(tile)) &&
    typeof detail.total === "number" &&
    Number.isInteger(detail.total)
  );
}

// show_tile_grid 툴 결과 페이로드(패널 렌더 계약).
interface TileGridData {
  tilesetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lower: number[][];
  upper: number[][];
}

// 세션을 버리기 전에 감사 항목을 회수한다.
function dropSession(controller: ChatController): void {
  if (controller.session) controller.auditHistory.push(...controller.session.getAuditEntries());
  controller.session = null;
  clearAgentGhostPreview();
}

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

  const appendBubble = (role: AiBubbleRole, text: string): HTMLElement =>
    appendConversationBubble({ log, role, text, revealVolatileZone, removeStartScreen });
  // 모델의 추론(reasoning) 스트림을 접이식 상자로 보여준다 — 기본 접힘(💭), 클릭하면 펼침.
  // 병합(추론 N회) 시 각 추론의 원문 전체를 별도 아이템으로 보존한다 — 펼치면 전부 보인다(V3C).
  let lastReasoning: { box: HTMLElement; body: HTMLElement; toggle: HTMLElement; state: { count: number } } | null = null;
  const appendReasoningItem = (body: HTMLElement): HTMLElement => {
    const item = el("div", { class: "ai-reasoning-item", dataset: { testid: "ai-reasoning-item" } });
    body.append(item);
    return item;
  };
  const appendReasoning = (): { box: HTMLElement; body: HTMLElement } => {
    revealVolatileZone();
    removeStartScreen();
    if (lastReasoning?.box.parentNode === log && log.childNodes[log.childNodes.length - 1] === lastReasoning.box) {
      lastReasoning.state.count += 1;
      lastReasoning.toggle.textContent = reasoningToggleText(lastReasoning.state.count, lastReasoning.body.hidden);
      log.scrollTop = log.scrollHeight;
      return { box: lastReasoning.box, body: appendReasoningItem(lastReasoning.body) };
    }
    const body = el("div", { class: "ai-reasoning-body", dataset: { testid: "ai-reasoning-body" } });
    body.hidden = true;
    const state = { count: 1 };
    const toggle = el("button", {
      class: "ai-reasoning-toggle",
      attrs: { type: "button", title: "모델의 추론 원문 전체 펼치기/접기", "aria-label": "추론 펼치기/접기" },
      text: reasoningToggleText(1, true),
    });
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = reasoningToggleText(state.count, body.hidden);
    });
    const box = el("div", { class: "ai-chat-bubble ai-reasoning", dataset: { testid: "ai-reasoning" }, children: [toggle, body] });
    log.append(box);
    lastReasoning = { box, body, toggle, state };
    log.scrollTop = log.scrollHeight;
    return { box, body: appendReasoningItem(body) };
  };

  // 툴콜을 원문 버블로 쏟지 않고 접이식 한 줄 요약("🔧 툴 N회 실행 ▸")으로 묶는다.
  // 어시스턴트 응답이 끼면 그룹을 끊어 다음 툴부터 새 그룹을 만든다.
  let toolActivity: { list: HTMLElement; toggle: HTMLElement; count: number } | null = null;
  // 도구 상세 아코디언 testid 일련번호(ai-tool-detail-<n>) — 대화 로그 전체에서 1부터 증가.
  let toolDetailSeq = 0;
  const closeToolActivity = (): void => {
    toolActivity = null;
  };
  const appendToolLine = (name: string, result: ToolResult, args?: Record<string, unknown>): void => {
    revealVolatileZone();
    if (!toolActivity) {
      const list = el("div", { class: "ai-tool-activity-list" });
      list.hidden = true;
      const toggle = el("button", {
        class: "ai-tool-activity-toggle",
        attrs: { type: "button", title: "툴 실행 내역 펼치기/접기", "aria-label": "도구 실행 내역 펼치기/접기" },
        dataset: { testid: "ai-tool-activity-toggle" },
      });
      const group = el("div", { class: "ai-chat-bubble ai-chat-tool-activity", dataset: { testid: "ai-tool-activity" }, children: [toggle, list] });
      const current = { list, toggle, count: 0 };
      toggle.addEventListener("click", () => {
        list.hidden = !list.hidden;
        current.toggle.textContent = `🔧 도구 ${current.count}회 실행 ${list.hidden ? "▸" : "▾"}`;
      });
      log.append(group);
      toolActivity = current;
    }
    toolActivity.count += 1;
    toolDetailSeq += 1;
    toolActivity.list.append(renderToolActivityEntry(name, result, { args, index: toolDetailSeq }));
    toolActivity.toggle.textContent = `🔧 도구 ${toolActivity.count}회 실행 ${toolActivity.list.hidden ? "▸" : "▾"}`;
    log.scrollTop = log.scrollHeight;
  };

  const renderConversationEntry = (entry: AuditEntry): void => {
    if (entry.kind === "user") {
      closeToolActivity();
      appendBubble("user", displayUserAuditText(entry.text));
      return;
    }
    if (entry.kind === "assistant" && entry.text.trim()) {
      closeToolActivity();
      appendBubble("assistant", entry.text);
      return;
    }
    if (entry.kind === "tool") {
      appendToolLine(
        entry.name,
        {
          ok: entry.ok,
          summary: entry.summary,
          issues: entry.issues?.map((message) => ({ severity: "error", code: "restored-tool", message })),
        },
        entry.args
      );
    }
  };

  const restoreConversationRecord = (record: ConversationRecord, source: "auto" | "manual"): void => {
    dropSession(controller);
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    pendingProposalMessage = null;
    lastAppliedProposalMessage = null;
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

  // 타일 이미지를 채팅에 렌더한다(show_tiles 툴콜). 사용자가 "어떤 타일인지"를
  // 번호가 아니라 그림으로 확인할 수 있다 — 맵 인터뷰 질문의 필수 시각 자료.
  const appendTileThumbs = (tilesetId: string, tiles: readonly number[]): void => {
    revealVolatileZone();
    removeStartScreen();
    const tileset = store.getCurrent().tilesets[tilesetId] ?? store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    const bubble = el("div", {
      class: "ai-chat-bubble ai-chat-tiles",
      dataset: { testid: "ai-bubble-tiles" },
      children: tiles.map((tile) =>
        el("figure", {
          class: "ai-tile-thumb-item",
          children: [
            el("div", {
              class: "ai-tile-thumb",
              attrs: { style: tilesetTileBackgroundStyle(tileset, tile, 48) },
              dataset: { testid: `ai-tile-thumb-${tile}` },
            }),
            el("figcaption", { class: "ai-tile-thumb-caption", text: String(tile) }),
          ],
        })
      ),
    });
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
  };

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

  type ProposalMessageState = {
    readonly calls: readonly ProposedCall[];
    readonly assistantBubble: HTMLElement | null;
    readonly summary: string;
  };
  let pendingProposalMessage: ProposalMessageState | null = null;
  let lastAppliedProposalMessage: ProposalMessageState | null = null;

  const renderProposal = (result: TurnResult, extraWarnings: readonly string[] = [], assistantBubble: HTMLElement | null = null): void => {
    proposalHost.replaceChildren();
    proposalHost.classList.remove("is-sticky-empty");
    const lines = proposalSummaryLines(result.proposedCalls, extraWarnings);
    if (result.proposedCalls.length === 0 && lines.length === 0) return;

    // 0건 프로포절(결함 ⑤): 모달 없이 스티키 존 자동 소거 알림 + 대화 로그 기록.
    if (result.proposedCalls.length === 0) {
      closeProposalModal();
      appendBubble("system", ["변경 제안 없음(0건) — 완성도 린트:", ...lines].join("\n"));
      const notice = renderEmptyProposalNotice(lines, () => notice.remove());
      proposalNoticeHost.append(notice);
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        window.setTimeout(() => notice.remove(), EMPTY_PROPOSAL_NOTICE_DISMISS_MS);
      }
      return;
    }

    const warnings = proposalApprovalWarnings(result.proposedCalls);
    const beforeProject = store.getCurrent();
    const afterProject = controller.session?.getProposedProject() ?? beforeProject;
    const previewMapId = proposalPreviewMapId(result.proposedCalls, beforeProject, afterProject);
    const dependencies = proposalDependencyIndexes(result.proposedCalls);
    let selected = result.proposedCalls.map(() => true);
    const itemRows: HTMLElement[] = [];
    let acceptButton: HTMLButtonElement | null = null;

    const refreshSelectionUi = (): void => {
      selected = enforceProposalDependencies(selected, dependencies);
      itemRows.forEach((row, index) => {
        const checkbox = row.querySelector("input") as HTMLInputElement | null;
        const note = row.querySelector(".ai-proposal-item-note") as HTMLElement | null;
        const blockedBy = dependencies[index]?.filter((dependency) => !selected[dependency]) ?? [];
        if (checkbox) {
          checkbox.checked = selected[index] === true;
          checkbox.disabled = blockedBy.length > 0;
          checkbox.setAttribute("aria-disabled", String(blockedBy.length > 0));
        }
        if (note) {
          note.textContent = blockedBy.length > 0 ? `상위 항목 ${blockedBy.map((dependency) => dependency + 1).join(", ")} 제외로 함께 제외됨` : "";
          note.hidden = blockedBy.length === 0;
        }
        row.classList[blockedBy.length > 0 || !selected[index] ? "add" : "remove"]("is-excluded");
      });
      if (acceptButton) {
        const count = selected.filter(Boolean).length;
        acceptButton.disabled = count === 0;
        // 보류 시공(§2.1.3)이 선택에 포함되면 라벨이 "승인하고 시공"으로 바뀐다.
        const hasPending = result.proposedCalls.some((call, index) => selected[index] === true && (call.pendingBuilds?.length ?? 0) > 0);
        acceptButton.textContent = proposalAcceptButtonLabel(hasPending, count, result.proposedCalls.length);
      }
    };

    // 어휘 카드 인라인 편집 상태(V3B): call index → (card index → 편집값). 수락 시
    // callsWithVocabularyEdits로 args를 재조립해 편집값이 곧 커밋값이 된다.
    const vocabEditsByCall = new Map<number, Map<number, VocabularyCardEdit>>();
    const itemElements: HTMLElement[] = [];
    let vocabCardNumber = 1;
    result.proposedCalls.forEach((call, index) => {
      const checkbox = el("input", {
        attrs: { type: "checkbox", "aria-label": `${index + 1}번 변경 포함` },
        dataset: { testid: `ai-proposal-item-${index + 1}` },
      }) as HTMLInputElement;
      checkbox.checked = true;
      checkbox.addEventListener("change", () => {
        selected[index] = checkbox.checked;
        if (!checkbox.checked) {
          for (let candidate = 0; candidate < selected.length; candidate += 1) {
            if (dependencies[candidate]?.includes(index)) selected[candidate] = false;
          }
        }
        refreshSelectionUi();
      });
      const row = el("label", {
        class: "ai-proposal-item",
        children: [
          checkbox,
          el("span", { class: "ai-proposal-item-main", text: call.summary || call.name }),
          el("span", { class: "ai-proposal-item-note", attrs: { hidden: "" } }),
        ],
      });
      itemRows.push(row);
      itemElements.push(row);
      // UXD 체크박스(항목 수락/거부)와 결합된 어휘 카드 — 항목 아래에 붙는다.
      const cards = renderVocabularyCardList(beforeProject, call, vocabCardNumber, (cardIndex, field, value) => {
        const edits = vocabEditsByCall.get(index) ?? new Map<number, VocabularyCardEdit>();
        vocabEditsByCall.set(index, edits);
        const entry = edits.get(cardIndex) ?? {};
        entry[field] = value;
        edits.set(cardIndex, entry);
      });
      if (cards) {
        vocabCardNumber += cards.count;
        itemElements.push(cards.element);
      }
    });

    const card = el("div", {
      class: `ai-proposal-card${hasDestructiveCall(result.proposedCalls) ? " is-destructive" : ""}`,
      dataset: { testid: "ai-proposal-card" },
      children: [
        el("div", { class: "ai-proposal-title", text: `변경 제안 (${result.proposedCalls.length}건)` }),
        ...warnings.map((warning) => el("div", {
          class: "ai-proposal-warning",
          text: warning,
          dataset: { testid: "ai-proposal-warning" },
        })),
        el("div", {
          class: "ai-proposal-summary",
          dataset: { testid: "ai-proposal-summary" },
          children: lines.map((line) => el("div", { class: "ai-proposal-line", text: line })),
        }),
        ...(previewMapId
          ? [el("div", {
              class: "ai-proposal-thumbs",
              children: [
                renderProposalMapThumbnail(beforeProject, previewMapId, "before"),
                renderProposalMapThumbnail(afterProject, previewMapId, "after"),
              ],
            })]
          : []),
        el("div", { class: "ai-proposal-items", children: itemElements }),
        el("details", {
          class: "ai-proposal-technical",
          children: [
            el("summary", { text: "기술 상세" }),
            el("div", {
              class: "ai-proposal-lines",
              children: proposalTechnicalDetailLines(result.proposedCalls).map((line) => el("div", { class: "ai-proposal-line", text: line })),
            }),
          ],
        }),
        el("div", {
          class: "ai-proposal-actions",
          children: [
            (acceptButton = el("button", {
              class: "ai-assistant-action ai-proposal-accept",
              text: "수락해서 적용",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-accept" },
              on: {
                click: () =>
                  acceptProposal(
                    callsWithVocabularyEdits(result.proposedCalls, vocabEditsByCall),
                    selected,
                    hasVocabularyEdits(vocabEditsByCall)
                  ),
              },
            }) as HTMLButtonElement),
            el("button", {
              class: "ai-assistant-action ai-proposal-reject",
              text: "거부(초안 폐기)",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-reject" },
              on: { click: () => rejectProposal() },
            }),
          ],
        }),
      ],
    });
    pendingProposalMessage = { calls: result.proposedCalls, assistantBubble, summary: proposalHumanSummaryLine(result.proposedCalls) };
    setAssistantMessageBadge(assistantBubble, "proposal");
    refreshSelectionUi();
    proposalHost.append(card);
    // 몰입 검토: 제안이 준비되면 모달을 연다. pill 라벨도 최신 건수로.
    proposalModalCount.textContent = `${result.proposedCalls.length}건`;
    proposalPill.textContent = `📋 변경 제안 ${result.proposedCalls.length}건 대기 — 검토`;
    openProposalModal();
  };

  const acceptProposal = (calls: readonly ProposedCall[], selectedState?: readonly boolean[], hasEdits = false): void => {
    // 프리뷰 == 적용: 세션이 누적한 draft를 그대로 적용한다(재실행에 따른 id 불일치 방지).
    // 단 어휘 카드가 편집됐으면(hasEdits) 편집된 args가 커밋값이 되도록 반드시 재실행한다.
    const session = controller.session;
    if (!session) return;
    const selected = selectedState ? enforceProposalDependencies(selectedState, proposalDependencyIndexes(calls)) : calls.map(() => true);
    const selectedCalls = calls.filter((_, index) => selected[index]);
    if (selectedCalls.length === 0) return;
    const warnings = proposalApprovalWarnings(selectedCalls);
    const decision = confirmRuleApproval(warnings);
    if (decision !== true) {
      // 모달 확인 후 같은 적용 경로를 이어간다(취소 시 아무것도 하지 않음).
      void decision.then((confirmed) => {
        if (confirmed) applyAcceptedProposal(calls, selected, selectedCalls, hasEdits);
      });
      return;
    }
    applyAcceptedProposal(calls, selected, selectedCalls, hasEdits);
  };

  // acceptProposal 의 적용 본문 — 확인 모달(비동기) 뒤에도 동일 경로를 타도록 분리(§2.4).
  const applyAcceptedProposal = (
    calls: readonly ProposedCall[],
    selected: readonly boolean[],
    selectedCalls: readonly ProposedCall[],
    hasEdits: boolean
  ): void => {
    const session = controller.session;
    if (!session) return;
    const before = store.getCurrent();
    const fullAccept = selectedCalls.length === calls.length && !hasEdits;
    const reassembled = fullAccept
      ? null
      : reassembleSelectedProposalProject(session.baselineProject, calls, selected);
    if (reassembled && !reassembled.ok) {
      setStatus("적용 실패");
      toast(`적용 실패: ${reassembled.message}`, "error");
      return;
    }
    let proposed = reassembled?.ok ? reassembled.project : session.getProposedProject();

    // 승인+시공 융합(§2.1.3): 어휘 커밋(=파츠 생성)이 반영된 draft에 보류 시공을
    // 같은 사용자 제스처 안에서 실행한다. 모델 재호출 없음. 카드 교정으로 그룹 id가
    // 바뀌었으면(재실행 결과 카드 기준) 어휘 id 인자를 리바인드한다.
    const pendingSelections = collectPendingBuilds(calls, selected);
    let fusionOutcomes: PendingBuildOutcome[] = [];
    if (pendingSelections.length > 0) {
      // calls[i] → selectedCalls 내 위치(재실행 결과 인덱스) 매핑.
      const selectedPosition = (callIndex: number): number => {
        let position = -1;
        for (let index = 0; index <= callIndex; index += 1) if (selected[index]) position += 1;
        return position;
      };
      const builds = pendingSelections.map(({ callIndex, pending }) => {
        const call = calls[callIndex];
        const originalCards = vocabularyCardsData(call)?.cards ?? null;
        const committedResult = reassembled?.ok ? reassembled.results[selectedPosition(callIndex)] : null;
        const committedCards = committedResult
          ? vocabularyCardsData({ name: call.name, result: committedResult })?.cards ?? null
          : originalCards;
        return { pending, args: rebindPendingBuildArgs(pending, originalCards, committedCards) };
      });
      const fused = runPendingBuilds(proposed, builds);
      proposed = fused.project;
      fusionOutcomes = fused.outcomes;
      // 실패 사유 표시 — 성공분만 커밋된다(실패 draft는 폐기됨). TODO(4단계): 커스텀 모달로 교체.
      for (const outcome of fusionOutcomes.filter((entry) => !entry.result.ok)) {
        appendBubble("system", `⚠️ 시공 실패 — ${outcome.pending.label}: ${outcome.result.summary}`);
        toast(`시공 실패: ${outcome.pending.label}`, "error");
      }
    }
    const fusionApplied = fusionOutcomes.filter((entry) => entry.result.ok);

    // 커밋 게이트: 합쳐진 최종 draft를 다시 lint. 이 제안이 "새로 만든" error만 반영을 거부한다
    // (선재 오류가 있는 프로젝트에서 무관한 편집까지 막지 않도록 현재 프로젝트를 baseline으로).
    const commit = commitChangeset(proposed, store.getCurrent());
    if (!commit.ok) {
      setStatus("적용 실패");
      const issue = commit.issues.find((entry) => entry.severity === "error");
      toast(`적용 실패: ${issue?.message ?? "무결성 오류"}`, "error");
      return;
    }
    clearAgentGhostPreview();
    recordProjectSnapshot(aiHistoryLabel(selectedCalls), currentHistoryMapId()); // 변경 이전 상태를 undo 스냅샷으로.
    store.replace(proposed); // 자동 저장은 store가 스케줄.
    focusAcceptedAgentChanges(before, proposed);
    const actualDiff = reassembled?.ok
      ? combineDiffs([...reassembled.results, ...fusionApplied.map((entry) => entry.result)].map((result) => result.diff))
      : summarizeChanges(before, proposed);
    recordProjectCommitFireAndForget({
      project: proposed,
      identity: currentAgentEditorIdentity(loadAiConfig().model),
      reviewStatus: "approved",
      summary: aiHistoryLabel(selectedCalls),
      diff: actualDiff,
      toolNames: [...selectedCalls.map((call) => call.name), ...fusionApplied.map((entry) => entry.pending.tool)],
    });
    resetManualProjectCommitBaseline(proposed);
    proposalHost.replaceChildren();
    closeProposalModal();
    setStatus("적용됨");
    const messageState = pendingProposalMessage;
    setAssistantMessageBadge(messageState?.assistantBubble ?? null, "applied");
    lastAppliedProposalMessage = messageState
      ? { ...messageState, calls: selectedCalls, summary: proposalHumanSummaryLine(selectedCalls) }
      : { calls: selectedCalls, assistantBubble: null, summary: proposalHumanSummaryLine(selectedCalls) };
    pendingProposalMessage = null;
    appendBubble("system", `변경 ${selectedCalls.length}건을 프로젝트에 적용했습니다.`);
    // 융합 시공 결과(§2.1.3) — 수락 한 번으로 어휘 승인 + 시공까지 끝났음을 보여준다.
    for (const outcome of fusionApplied) {
      appendBubble("system", `🏗 승인하고 시공 — ${outcome.result.summary}`);
    }
    toast(fusionApplied.length > 0 ? "어휘를 승인하고 바로 시공했습니다." : "AI 변경안을 적용했습니다.", "ok");
    // 대화(기억)를 유지한 채 프로젝트 기준만 갱신한다(#6). 세션을 폐기하지 않으므로 문맥이 이어진다.
    controller.session?.rebaseProject(store.getCurrent());
  };

  const rejectProposal = (): void => {
    proposalHost.replaceChildren();
    closeProposalModal();
    clearAgentGhostPreview();
    setStatus("제안 거부됨");
    setAssistantMessageBadge(pendingProposalMessage?.assistantBubble ?? null, "discarded");
    pendingProposalMessage = null;
    appendBubble("system", "제안을 거부하고 초안을 폐기했습니다.");
    // 오염된 draft만 store 기준으로 되돌리고 대화는 유지한다(#6).
    controller.session?.rebaseProject(store.getCurrent());
  };

  // 타일 지식 전용 변경: 세션을 유지한 채 즉시 저장한다(인터뷰 연속성 — 다음 질문이 같은 대화에서 이어진다).
  // 저장 시점에 store == 세션 draft가 되므로 이후 툴콜과도 일관된다.
  const applyMetadataKeepSession = (calls: readonly ProposedCall[]): void => {
    const session = controller.session;
    if (!session) return;
    const proposed = session.getProposedProject();
    const commit = commitChangeset(proposed, store.getCurrent());
    if (!commit.ok) {
      setStatus("저장 실패");
      const issue = commit.issues.find((entry) => entry.severity === "error");
      toast(`저장 실패: ${issue?.message ?? "무결성 오류"}`, "error");
      return;
    }
    const before = store.getCurrent();
    recordProjectSnapshot(aiHistoryLabel(calls), currentHistoryMapId());
    store.replace(proposed);
    focusAcceptedAgentChanges(before, proposed);
    recordProjectCommitFireAndForget({
      project: proposed,
      identity: currentAgentEditorIdentity(loadAiConfig().model),
      reviewStatus: "approved",
      summary: aiHistoryLabel(calls),
      diff: combineDiffs(calls.map((call) => call.result.diff)),
      toolNames: calls.map((call) => call.name),
    });
    resetManualProjectCommitBaseline(proposed);
    setStatus("저장됨");
    appendBubble("system", `타일 지식 ${calls.length}건 저장됨 (Ctrl+Z로 복구 가능)`);
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

  // 맵 영역을 하위+상위 합성 그리드로 채팅에 렌더 — 구조물 학습 인터뷰의 시각 자료.
  const appendTileGrid = (data: TileGridData): void => {
    revealVolatileZone();
    removeStartScreen();
    const tileset = store.getCurrent().tilesets[data.tilesetId] ?? store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    const rows: HTMLElement[] = [];
    for (let row = 0; row < data.h; row += 1) {
      const cells: HTMLElement[] = [];
      for (let col = 0; col < data.w; col += 1) {
        const lower = data.lower[row]?.[col] ?? -1;
        const upper = data.upper[row]?.[col] ?? -1;
        const children: HTMLElement[] = [];
        if (upper >= 0) {
          children.push(el("div", { class: "ai-tile-grid-upper", attrs: { style: tilesetTileBackgroundStyle(tileset, upper, 24) } }));
        }
        cells.push(
          el("div", {
            class: "ai-tile-grid-cell",
            attrs: { style: lower >= 0 ? tilesetTileBackgroundStyle(tileset, lower, 24) : "", title: `(${data.x + col},${data.y + row}) ${lower >= 0 ? lower : ""}${upper >= 0 ? `/${upper}` : ""}` },
            children,
          })
        );
      }
      rows.push(el("div", { class: "ai-tile-grid-row", children: cells }));
    }
    const bubble = el("div", {
      class: "ai-chat-bubble ai-chat-tile-grid",
      dataset: { testid: "ai-bubble-tile-grid" },
      children: [
        el("div", { class: "ai-tile-grid-caption", text: `(${data.x},${data.y}) ${data.w}×${data.h}` }),
        el("div", { class: "ai-tile-grid", children: rows }),
      ],
    });
    log.append(bubble);
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
      if (lastReasoning && discarded.has(lastReasoning.box)) lastReasoning = null;
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
      if (lastReasoning && discarded.has(lastReasoning.box)) lastReasoning = null;
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
        const reverted = lastAppliedProposalMessage;
        if (reverted) {
          appendBubble("system", `제안 ${reverted.calls.length}건(${reverted.summary})을 되돌렸습니다.`);
          setAssistantMessageBadge(reverted.assistantBubble, "reverted");
          lastAppliedProposalMessage = null;
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
        pendingProposalMessage = null;
        lastAppliedProposalMessage = null;
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
    else panel.classList.remove("is-collapsed");
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

const STUDIO_MODE_KEY = "rpg-zzu:ai-studio";

// ── 설정 폼(접이식) ─────────────────────────────────────────────
// 입력이 바뀌면 즉시 localStorage에 자동 저장한다 — "저장 버튼을 안 눌러서 날아가는" 문제 방지.
// onSaved 콜백으로 진행 중인 세션에도 새 설정을 반영한다.
function renderSettingsForm(
  onSaved: (config: AiConfig) => void,
  onFontSizeChange: (size: AiFontSize) => void = () => {}
): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void } {
  const config = loadAiConfig();
  const baseUrl = textField("엔드포인트", config.baseUrl, "ai-config-baseurl", "text", DEFAULT_BASE_URL);
  const model = textField("감독 모델(계획·검수)", config.model, "ai-config-model", "text", DEFAULT_MODEL);
  const liteModel = textField("실행 모델(툴 작업)", config.liteModel ?? DEFAULT_LITE_MODEL, "ai-config-lite-model", "text", DEFAULT_LITE_MODEL);
  const apiKey = textField("API 키", config.apiKey, "ai-config-apikey", "password", "sk-or-…");
  // 사용자 제한은 출력 토큰 예산 하나뿐 — 툴콜 깊이는 AI가 필요한 만큼 쓴다.
  const maxTokens = textField("최대 토큰", String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute("title", "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산(기본 32768). 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다.");

  // 추론(reasoning) 강도 — 모델이 답하기 전에 생각하는 정도. 기본 '보통'(reasoning 켜짐).
  const reasoningSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-config-reasoning" },
    children: [
      el("option", { attrs: { value: "off" }, text: "끔" }),
      el("option", { attrs: { value: "low" }, text: "낮음" }),
      el("option", { attrs: { value: "medium" }, text: "보통" }),
      el("option", { attrs: { value: "high" }, text: "높음" }),
    ],
  }) as HTMLSelectElement;
  reasoningSelect.value = config.reasoningEffort ?? "medium";
  const reasoningRow = el("label", {
    class: "ai-config-row",
    attrs: { title: "모델이 답/도구 사용 전에 추론(생각)하는 강도. 끔=추론 안 함." },
    children: [el("span", { class: "ai-config-label", text: "추론" }), reasoningSelect],
  });

  // 글자 크기 3단(V3C) — AiConfig와 별개로 localStorage(rpg-zzu:ai-font-size)에 즉시 영속.
  const fontSizeSelect = el("select", {
    class: "ai-config-select",
    dataset: { testid: "ai-font-size" },
    children: [
      el("option", { attrs: { value: "small" }, text: "작게" }),
      el("option", { attrs: { value: "normal" }, text: "보통" }),
      el("option", { attrs: { value: "large" }, text: "크게" }),
    ],
  }) as HTMLSelectElement;
  fontSizeSelect.value = loadAiFontSize();
  fontSizeSelect.addEventListener("change", () => {
    const raw = fontSizeSelect.value;
    const size: AiFontSize = raw === "small" || raw === "large" ? raw : "normal";
    saveAiFontSize(size);
    onFontSizeChange(size);
  });
  const fontSizeRow = el("label", {
    class: "ai-config-row",
    attrs: { title: "채팅 로그·제안 카드·도구 로그의 글자 크기. 즉시 적용되고 저장됩니다." },
    children: [el("span", { class: "ai-config-label", text: "글자 크기" }), fontSizeSelect],
  });

  const autoApprove = el("input", {
    class: "ai-config-checkbox",
    attrs: { type: "checkbox" },
    dataset: { testid: "ai-config-autoapprove" },
  }) as HTMLInputElement;
  autoApprove.checked = config.autoApprove === true;
  const autoApproveRow = el("label", {
    class: "ai-config-row ai-config-check-row",
    attrs: { title: "AI가 만든 변경 제안을 검토 없이 즉시 프로젝트에 적용합니다. 되돌리기는 Ctrl+Z." },
    children: [el("span", { class: "ai-config-label", text: "자동 승인" }), autoApprove],
  });

  const savedHint = el("span", {
    class: "ai-config-saved-hint",
    text: "",
    dataset: { testid: "ai-config-saved-hint" },
  });

  const collect = (): AiConfig => ({
    // 비워 두면 기본값으로 저장한다.
    baseUrl: baseUrl.input.value.trim() || DEFAULT_BASE_URL,
    model: model.input.value.trim() || DEFAULT_MODEL,
    liteModel: liteModel.input.value.trim() || DEFAULT_LITE_MODEL,
    apiKey: apiKey.input.value,
    maxToolCalls: defaultAiConfig().maxToolCalls,
    maxTokens: Math.max(256, Number(maxTokens.input.value) || defaultAiConfig().maxTokens),
    reasoningEffort: (reasoningSelect.value as AiConfig["reasoningEffort"]) || "medium",
    autoApprove: autoApprove.checked,
  });

  let autoSaveTimer: number | null = null;
  const persist = (showToast: boolean): void => {
    const next = collect();
    saveAiConfig(next);
    onSaved(next);
    savedHint.textContent = "자동 저장됨";
    if (showToast) toast("어시스턴트 설정을 저장했습니다.", "ok");
  };
  const scheduleAutoSave = (): void => {
    if (typeof window === "undefined") {
      persist(false);
      return;
    }
    if (autoSaveTimer !== null) window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      autoSaveTimer = null;
      persist(false);
    }, 350);
  };
  for (const field of [baseUrl, model, liteModel, apiKey, maxTokens]) {
    field.input.addEventListener("input", scheduleAutoSave);
    field.input.addEventListener("change", () => persist(false));
  }
  autoApprove.addEventListener("change", () => persist(false));
  reasoningSelect.addEventListener("change", () => persist(false));

  const saveButton = el("button", {
    class: "ai-assistant-action",
    text: "설정 저장",
    attrs: { type: "button" },
    dataset: { testid: "ai-config-save" },
    on: { click: () => persist(true) },
  });

  const details = el("details", {
    class: "ai-config-form",
    dataset: { testid: "ai-config" },
    children: [
      el("summary", { text: "설정 (엔드포인트/모델/API 키)" }),
      baseUrl.row,
      model.row,
      liteModel.row,
      apiKey.row,
      maxTokens.row,
      reasoningRow,
      fontSizeRow,
      autoApproveRow,
      el("div", { class: "ai-config-actions", children: [saveButton, savedHint] }),
    ],
  });
  return {
    element: details,
    focusFirstInput: () => baseUrl.input.focus(),
    focusApiKey: () => apiKey.input.focus(),
  };
}

function textField(
  label: string,
  value: string,
  testid: string,
  type = "text",
  placeholder = ""
): { row: HTMLElement; input: HTMLInputElement } {
  const input = el("input", {
    class: "ai-config-input",
    attrs: placeholder ? { type, placeholder } : { type },
    value,
    dataset: { testid },
  }) as HTMLInputElement;
  const row = el("label", {
    class: "ai-config-row",
    children: [el("span", { class: "ai-config-label", text: label }), input],
  });
  return { row, input };
}

function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { attrs: { href: url, download: filename } });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
