// editor/panels/aiChatPanel.ts
// LLM 어시스턴트 채팅 dock. 대화 히스토리 + 입력 + 스트리밍 표시 + 제안(changeset) 카드 + 설정 폼.
// - 이 파일만 브라우저/스토어에 의존한다. 세션 로직(assistantSession)/클라이언트(llmClient)는 순수.
// - 제안 수락은 세션 draft를 store에 반영 → projectLint 게이트 → undo 체크포인트.
// - API 키는 설정 폼에서만 입력(localStorage). 소스/프로젝트 JSON에 하드코딩 금지.

import { getMapEditHistoryState, MAP_EDIT_HISTORY_EVENT, recordProjectSnapshot, undoMapEdit } from "@/editor/mapEditHistory";
import { editorState } from "@/editor/editorState";
import { focusAcceptedAgentChanges } from "@/editor/agentFocus";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { buildDemonstrationMessage, type DemonstrationPayload } from "@/ai/demonstrationPrompt";
import { openDemoTeachModal, type DemoTeachSeed } from "@/editor/panels/demoTeachCanvas";
import { openStructureReviewModal } from "@/editor/panels/structureReviewModal";
import { openToolBrowserModal, totalToolCount } from "@/editor/panels/toolBrowserModal";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import type { TerrainTemplateDraft } from "@/editor/tools/terrainTemplateExtract";
import type { ToolResult } from "@/editor/tools";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { currentAgentEditorIdentity } from "@/project/editorIdentity";
import { projectLint } from "@/project/lint/projectLint";
import { combineDiffs, recordProjectCommitFireAndForget, resetManualProjectCommitBaseline } from "@/project/projectCommitLog";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import {
  AssistantSession,
  METADATA_ONLY_TOOLS,
  proposalApprovalWarnings,
  proposalNeedsExplicitApproval,
  ruleToolRejectionText,
  type AuditEntry,
  type ProposedCall,
  type SessionEvent,
  type TurnResult,
} from "@/ai/assistantSession";
import type { BuildSpec } from "@/ai/buildSpec";
import {
  proposalCompletenessWarningLines,
  proposalCompletenessWarnings,
  proposalHasChangedMap,
  requestLikelyExpectsChange,
} from "@/ai/proposalCompleteness";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { renderMarkdown } from "@/util/markdown";
import {
  deriveTitle,
  loadConversation,
  loadLatestConversation,
  projectConversationContextKey,
  saveConversation,
  type ConversationRecord,
} from "@/ai/conversationStore";
import { parseQuickReplies } from "@/ai/interviewPrompt";
import { listAllSkills, pinnedSkills, recordSkillUse, type SkillArgValue, type SkillDef, type SkillRunContext } from "@/ai/skills";
import { openSkillPalette, renderSkillDrawer, renderSlashList } from "@/editor/panels/aiSkillDrawer";
import { DEFAULT_BASE_URL, DEFAULT_LITE_MODEL, DEFAULT_MODEL, defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig } from "@/ai/llmClient";

const SESSION_BACKUP_KEY = "rpg-zzu:ai-session-backup";
const PANEL_COLLAPSED_KEY = "rpg-zzu:ai-panel-collapsed";
const PANEL_SIZE_KEY = "rpg-zzu:ai-panel-size";
const AI_PROGRESS_TOOL_LIMIT = 30;
const DRAFT_DESTRUCTIVE_TOOL_NAMES = new Set(["remove_map", "remove_event", "clear_region", "delete_tile_group"]);

export interface AiChatPanelOptions {
  readonly clock?: () => number;
}

type AiAssistDetail =
  | { readonly kind: "cluster-edit"; readonly tilesetId: string; readonly groupId: string }
  | { readonly kind: "unclassified-analysis"; readonly tilesetId: string; readonly sampleTiles: readonly number[]; readonly total: number };

let cleanupAiAssistBridge: (() => void) | null = null;

// 패널 크기 커스텀 — 좌상단 코너 드래그로 조절하고 localStorage에 유지한다.
export interface PanelSize {
  width: number;
  height: number;
}

export const PANEL_SIZE_LIMITS = { minWidth: 280, maxWidth: 960, minHeight: 320, maxHeight: 940 } as const;

export function clampPanelSize(size: PanelSize): PanelSize {
  return {
    width: Math.round(Math.min(PANEL_SIZE_LIMITS.maxWidth, Math.max(PANEL_SIZE_LIMITS.minWidth, size.width))),
    height: Math.round(Math.min(PANEL_SIZE_LIMITS.maxHeight, Math.max(PANEL_SIZE_LIMITS.minHeight, size.height))),
  };
}

export function loadPanelSize(): PanelSize | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PANEL_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null;
    return clampPanelSize({ width: parsed.width, height: parsed.height });
  } catch {
    return null;
  }
}

export function savePanelSize(size: PanelSize): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(clampPanelSize(size)));
}

export function formatAiRunningStatus(startedAt: number, now: number, toolCount: number, maxTools = AI_PROGRESS_TOOL_LIMIT): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `생각 중… ${elapsedSeconds}초 · 도구 ${toolCount}/${maxTools}`;
}

export function isDraftDestructiveTool(name: string): boolean {
  return DRAFT_DESTRUCTIVE_TOOL_NAMES.has(name);
}

export function failedToolRetrySummary(summary: string): string {
  const counts = [...summary.matchAll(/(\d+)회/gu)]
    .map((match) => Number(match[1]))
    .filter((count) => Number.isFinite(count) && count > 0);
  const retryCount = counts.length > 0 ? Math.max(...counts) : 1;
  return `내부 재시도 ${retryCount}회`;
}

export function formatToolActivityLine(name: string, result: ToolResult): string {
  const mark = result.ok ? "✓" : "✗";
  const draftPrefix = result.ok && isDraftDestructiveTool(name) ? "(초안) " : "";
  return ruleToolRejectionText(name, result) ?? `${draftPrefix}${mark} ${name} — ${result.summary}`;
}

export function reasoningToggleText(count: number, collapsed: boolean): string {
  const label = count > 1 ? `💭 추론 ${count}회` : "💭 추론";
  return collapsed ? `${label} 보기 ▸` : `${label} ▾`;
}

export function isAiConfigReady(config: AiConfig): boolean {
  return Boolean(config.baseUrl.trim() && config.model.trim() && config.apiKey.trim());
}

export function displayUserAuditText(text: string): string {
  return text.split(/\n\n\[컨텍스트\]/u)[0] ?? text;
}

export function renderToolActivityEntry(name: string, result: ToolResult): HTMLElement {
  if (result.ok) return el("div", { class: "ai-tool-activity-line", text: formatToolActivityLine(name, result) });
  const draftPrefix = isDraftDestructiveTool(name) ? "(초안) " : "";
  return el("details", {
    class: "ai-tool-activity-line ai-tool-failure",
    dataset: { testid: "ai-tool-failure" },
    children: [
      el("summary", {
        text: `${draftPrefix}✗ ${name} — ${failedToolRetrySummary(result.summary)}`,
        dataset: { testid: "ai-tool-failure-summary" },
      }),
      el("div", {
        class: "ai-tool-failure-body",
        text: "이 단계는 자동으로 다시 시도했습니다. 최종 결과만 확인해 주세요.",
      }),
    ],
  });
}

function loadPanelCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PANEL_COLLAPSED_KEY) === "1";
}

function savePanelCollapsed(collapsed: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
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

// 파괴적 작업 여부에 따라 제안 요약 라인을 만든다(테스트 가능하도록 순수 함수로 분리).
export function proposalSummaryLines(calls: readonly ProposedCall[], extraWarnings: readonly string[] = []): string[] {
  const callLines = calls.map((call) => {
    const flag = call.destructive ? "⚠️ 파괴적 " : "";
    return `${flag}${call.name} — ${call.summary}`;
  });
  return [...callLines, ...proposalCompletenessWarningLines(calls, extraWarnings)];
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

function confirmRuleApproval(warnings: readonly string[]): boolean {
  if (warnings.length === 0) return true;
  if (typeof window === "undefined" || typeof window.confirm !== "function") return true;
  return window.confirm(`${warnings.join("\n")}\n\n이 규칙을 적용할까요?`);
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
  const proposalHost = el("div", { class: "ai-proposal-host", dataset: { testid: "ai-proposal-host" } });
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
  const settings = renderSettingsForm((config) => {
    controller.session?.updateConfig(config);
  });
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

  const appendBubble = (role: "user" | "assistant" | "tool" | "system", text: string): HTMLElement => {
    removeStartScreen();
    const bubble = el("div", {
      class: `ai-chat-bubble ai-chat-${role}`,
      dataset: { testid: `ai-bubble-${role}` },
    });
    // 어시스턴트/시스템 말풍선은 마크다운을 렌더한다(굵게/목록/코드/링크 — 안전한 DOM 생성).
    // 사용자·툴 버블은 원문 그대로. 빈 텍스트(스트리밍 자리표시자)는 그대로 두고 완료 시 렌더한다.
    if (text && (role === "assistant" || role === "system")) bubble.replaceChildren(renderMarkdown(text));
    else if (text) bubble.textContent = text;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  };
  // 스트리밍이 끝난 어시스턴트 버블의 누적 원문을 마크다운으로 다시 렌더한다.
  const renderStreamedMarkdown = (bubble: HTMLElement | null): void => {
    const raw = bubble?.textContent ?? "";
    if (bubble && raw.trim()) bubble.replaceChildren(renderMarkdown(raw));
  };
  // 모델의 추론(reasoning) 스트림을 접이식 상자로 보여준다 — 기본 접힘(💭), 클릭하면 펼침.
  let lastReasoning: { box: HTMLElement; body: HTMLElement; toggle: HTMLElement; count: number } | null = null;
  const appendReasoning = (): { body: HTMLElement } => {
    removeStartScreen();
    if (lastReasoning?.box.parentNode === log && log.childNodes[log.childNodes.length - 1] === lastReasoning.box) {
      lastReasoning.count += 1;
      lastReasoning.body.textContent = `${lastReasoning.body.textContent ?? ""}\n\n`;
      lastReasoning.toggle.textContent = reasoningToggleText(lastReasoning.count, lastReasoning.body.hidden);
      log.scrollTop = log.scrollHeight;
      return { body: lastReasoning.body };
    }
    const body = el("div", { class: "ai-reasoning-body", dataset: { testid: "ai-reasoning-body" } });
    body.hidden = true;
    const toggle = el("button", {
      class: "ai-reasoning-toggle",
      attrs: { type: "button", title: "모델의 추론 펼치기/접기", "aria-label": "추론 펼치기/접기" },
      text: reasoningToggleText(1, true),
    });
    toggle.addEventListener("click", () => {
      body.hidden = !body.hidden;
      toggle.textContent = reasoningToggleText(lastReasoning?.toggle === toggle ? lastReasoning.count : 1, body.hidden);
    });
    const box = el("div", { class: "ai-chat-bubble ai-reasoning", dataset: { testid: "ai-reasoning" }, children: [toggle, body] });
    log.append(box);
    lastReasoning = { box, body, toggle, count: 1 };
    log.scrollTop = log.scrollHeight;
    return { body };
  };

  // 툴콜을 원문 버블로 쏟지 않고 접이식 한 줄 요약("🔧 툴 N회 실행 ▸")으로 묶는다.
  // 어시스턴트 응답이 끼면 그룹을 끊어 다음 툴부터 새 그룹을 만든다.
  let toolActivity: { list: HTMLElement; toggle: HTMLElement; count: number } | null = null;
  const closeToolActivity = (): void => {
    toolActivity = null;
  };
  const appendToolLine = (name: string, result: ToolResult): void => {
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
    toolActivity.list.append(renderToolActivityEntry(name, result));
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
      appendToolLine(entry.name, {
        ok: entry.ok,
        summary: entry.summary,
        issues: entry.issues?.map((message) => ({ severity: "error", code: "restored-tool", message })),
      });
    }
  };

  const restoreConversationRecord = (record: ConversationRecord, source: "auto" | "manual"): void => {
    dropSession(controller);
    controller.auditHistory = [...record.entries];
    conversationId = record.id;
    proposalHost.replaceChildren();
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
      });
    }
    return controller.session;
  };

  const renderProposal = (result: TurnResult, extraWarnings: readonly string[] = []): void => {
    proposalHost.replaceChildren();
    const lines = proposalSummaryLines(result.proposedCalls, extraWarnings);
    if (result.proposedCalls.length === 0 && lines.length === 0) return;

    // 0건 프로포절(결함 ⑤): 블로킹 검토 카드 대신 자동 소거 알림 + 대화 로그 기록.
    if (result.proposedCalls.length === 0) {
      appendBubble("system", ["변경 제안 없음(0건) — 완성도 린트:", ...lines].join("\n"));
      const notice = renderEmptyProposalNotice(lines, () => proposalHost.replaceChildren());
      proposalHost.append(notice);
      if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
        window.setTimeout(() => notice.remove(), EMPTY_PROPOSAL_NOTICE_DISMISS_MS);
      }
      return;
    }

    const warnings = proposalApprovalWarnings(result.proposedCalls);
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
          class: "ai-proposal-lines",
          children: lines.map((line) => el("div", { class: "ai-proposal-line", text: line })),
        }),
        el("div", {
          class: "ai-proposal-actions",
          children: [
            el("button", {
              class: "ai-assistant-action ai-proposal-accept",
              text: "수락해서 적용",
              attrs: { type: "button" },
              dataset: { testid: "ai-proposal-accept" },
              on: { click: () => acceptProposal(result.proposedCalls) },
            }),
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
    proposalHost.append(card);
  };

  const acceptProposal = (calls: readonly ProposedCall[]): void => {
    // 프리뷰 == 적용: 세션이 누적한 draft를 그대로 적용한다(재실행에 따른 id 불일치 방지).
    const session = controller.session;
    if (!session) return;
    const warnings = proposalApprovalWarnings(calls);
    if (warnings.length > 0 && !confirmRuleApproval(warnings)) return;
    const proposed = session.getProposedProject();
    // 커밋 게이트: 합쳐진 최종 draft를 다시 lint. error가 있으면 반영 거부.
    const errors = projectLint(proposed).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      setStatus("적용 실패");
      toast(`적용 실패: ${errors[0].message}`, "error");
      return;
    }
    const before = store.getCurrent();
    clearAgentGhostPreview();
    recordProjectSnapshot(aiHistoryLabel(calls), currentHistoryMapId()); // 변경 이전 상태를 undo 스냅샷으로.
    store.replace(proposed); // 자동 저장은 store가 스케줄.
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
    proposalHost.replaceChildren();
    setStatus("적용됨");
    appendBubble("system", `변경 ${calls.length}건을 프로젝트에 적용했습니다.`);
    toast("AI 변경안을 적용했습니다.", "ok");
    // 대화(기억)를 유지한 채 프로젝트 기준만 갱신한다(#6). 세션을 폐기하지 않으므로 문맥이 이어진다.
    controller.session?.rebaseProject(store.getCurrent());
  };

  const rejectProposal = (): void => {
    proposalHost.replaceChildren();
    clearAgentGhostPreview();
    setStatus("제안 거부됨");
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
    const errors = projectLint(proposed).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      setStatus("저장 실패");
      toast(`저장 실패: ${errors[0].message}`, "error");
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
    for (const option of options) {
      chipsHost.append(
        el("button", {
          class: "ai-quick-reply-chip",
          text: option,
          attrs: { type: "button" },
          dataset: { testid: "ai-quick-reply" },
          on: { click: () => void sendText(option) },
        })
      );
    }
  };

  // 맵 영역을 하위+상위 합성 그리드로 채팅에 렌더 — 구조물 학습 인터뷰의 시각 자료.
  const appendTileGrid = (data: TileGridData): void => {
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

  // 사용자 메시지에 현재 맵/선택 영역을 자동 첨부한다 — "여기에 지어줘"의 '여기'를
  // 모델이 좌표로 받는다(공간 산파법의 짝: 사용자가 영역을 지정하면 그게 곧 답).
  const contextFooter = (): string => {
    const ctx = getSkillContext();
    const parts = [`현재 맵: ${ctx.mapName ?? "없음"}${ctx.mapId ? ` (${ctx.mapId})` : ""}`];
    // 선택 영역은 '현재 맵의 것'이고 맵 범위 안에 있을 때만 첨부한다.
    // 맵을 전환해도 남아 있던 이전 맵의 선택(예: 10×10 맵에 (11,9))이 모델에 새 좌표로 오인되던 문제(BUG F) 방지.
    const sel = ctx.selection;
    if (sel && sel.mapId === ctx.mapId) {
      const map = ctx.mapId ? store.getCurrent().maps[ctx.mapId] : undefined;
      const inBounds = !map || (sel.x >= 0 && sel.y >= 0 && sel.x < map.width && sel.y < map.height);
      if (inBounds) parts.push(`사용자 선택 영역: (${sel.x},${sel.y}) ${sel.width}×${sel.height}`);
    }
    return `[컨텍스트] ${parts.join(" · ")}`;
  };

  // AI busy 중 입력 큐(도그푸딩 결함 ⑨): 처리 중 들어온 메시지는 동시 실행(레이스) 대신
  // 큐에 쌓고 "대기 중 N건"으로 표시한 뒤, 현재 턴이 끝나면 순서대로 전송한다.
  let turnBusy = false;
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
  let runningProgress: { startedAt: number; toolCount: number } | null = null;
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
    setStatus(formatAiRunningStatus(runningProgress.startedAt, now(), runningProgress.toolCount), record);
  };
  const beginTurnProgress = (): void => {
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
    appendBubble("user", displayAs ?? trimmed);
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
    beginTurnProgress();
    refreshAbortButton();
    sendButton.disabled = true;
    const activeSpecAtTurnStart = session.getActiveSpec();
    let confirmedBuildSpecThisTurn: BuildSpec | null = null;
    let assistantBubble: HTMLElement | null = null;
    let reasoningBox: { body: HTMLElement } | null = null;
    const streamedBubbles: HTMLElement[] = [];
    const onEvent = (event: SessionEvent): void => {
      if (event.type === "reasoning_token") {
        if (!reasoningBox) reasoningBox = appendReasoning();
        reasoningBox.body.textContent = (reasoningBox.body.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
        return;
      }
      if (event.type === "assistant_token") {
        reasoningBox = null; // 답변이 시작되면 다음 추론은 새 상자.
        if (!assistantBubble) {
          assistantBubble = appendBubble("assistant", "");
          streamedBubbles.push(assistantBubble);
          closeToolActivity(); // 응답이 시작되면 다음 툴은 새 그룹으로.
        }
        assistantBubble.textContent = (assistantBubble.textContent ?? "") + event.delta;
        log.scrollTop = log.scrollHeight;
      } else if (event.type === "tool_call") {
        bumpToolProgress();
        appendToolLine(event.name, event.result);
        assistantBubble = null; // 툴 이후 새 assistant 응답은 새 버블.
        reasoningBox = null; // 툴 이후 새 추론은 새 상자.
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
        // 구조물 초안 추출 → 넓은 검토 모달 자동 오픈. 좌표·번호 텍스트가 채팅에
        // 쏟아지는 대신, 사용자는 그리드+행 카드에서 확인·수정·저장한다.
        if (event.name === "extract_terrain_template" && event.result.ok) {
          const draft = (event.result.data as { draft: TerrainTemplateDraft }).draft;
          openStructureReviewModal({
            draft,
            onDemoRequest: (region) => startDemoTeach(region),
            onSaved: (saved) => {
              appendBubble("system", `템플릿 '${saved.name}' 저장됨(행 ${saved.savedRows}개, 사용자 확정) — 다음 대화부터 이 지식을 사용합니다.`);
              setStatus("템플릿 저장됨");
              // 세션 draft는 저장 전 스냅샷 기반이라, 이후 제안 수락이 템플릿을 되돌리지 않도록 세션을 정리한다.
              dropSession(controller);
              proposalHost.replaceChildren();
            },
          });
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
        setStatus("대기");
        streamedBubbles.forEach(renderStreamedMarkdown);
        return;
      }
      const completenessWarnings = result.stoppedReason === "error"
        ? []
        : proposalCompletenessWarnings({
            requestText,
            buildSpec: completenessSpecForProposal(confirmedBuildSpecThisTurn, activeSpecAtTurnStart, result.proposedCalls, requestText),
            calls: result.proposedCalls,
          });
      attachCompletenessWarnings(result.proposedCalls, completenessWarnings);
      streamedBubbles.forEach(renderStreamedMarkdown); // 스트리밍 원문을 마크다운으로 다시 렌더.
      if (result.assistantText && !assistantBubble) appendBubble("assistant", result.assistantText);
      if (result.proposedCalls.length > 0 && completenessWarnings.length === 0 && result.stoppedReason !== "error" && isMetadataOnlyProposal(result.proposedCalls) && !proposalNeedsExplicitApproval(result.proposedCalls)) {
        // 타일 지식만 바뀌었으면 검토 카드 없이 저장하고 세션(인터뷰 대화)을 이어간다.
        applyMetadataKeepSession(result.proposedCalls);
      } else if (result.proposedCalls.length > 0 && completenessWarnings.length === 0 && loadAiConfig().autoApprove === true && result.stoppedReason !== "error" && !proposalNeedsExplicitApproval(result.proposedCalls)) {
        // 자동 승인 모드: 제안을 즉시 적용한다(검토 카드 생략). 되돌리기는 Ctrl+Z.
        appendBubble("system", `자동 승인 — 변경 ${result.proposedCalls.length}건을 바로 적용합니다.`);
        acceptProposal(result.proposedCalls);
      } else {
        renderProposal(result, result.proposedCalls.length === 0 ? completenessWarnings : []);
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
      setStatus("오류");
      appendBubble("system", `오류: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      endTurnProgress();
      if (activeAbortController === abortController) activeAbortController = null;
      sendButton.disabled = false;
      turnBusy = false;
      refreshAbortButton();
      persistConversation(); // 매 턴 끝에 대화 기록을 저장한다(대화 기록 뷰어에서 다시 볼 수 있다).
      notifyIfObscuredByTestPlay(); // 결함 ④: 테스트 플레이 창이 패널을 가린 채 턴이 끝나면 알림.
      drainPendingSends(); // 결함 ⑨: 대기 큐의 다음 메시지를 순서대로 전송.
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
    lastTypedMessage = text;
    input.value = "";
    refreshSlash();
    await sendText(text);
  };

  sendButton.addEventListener("click", () => void send());
  input.addEventListener("keydown", (event) => {
    // 엔터 = 즉시 전송, Shift+Enter = 줄바꿈. IME 조합 중(한글 입력 확정)에는 전송하지 않는다.
    const composing = event.isComposing || (event as KeyboardEvent & { keyCode?: number }).keyCode === 229;
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
      refreshPinBar();
      void sendText(prompt, displayAs);
    },
    onAction: (skillId) => {
      if (skillId !== "demo-teach") return;
      refreshPinBar();
      const selection = editorState.get().selection;
      startDemoTeach(selection ? { mapId: selection.mapId, x: selection.x, y: selection.y, w: selection.width, h: selection.height } : null);
    },
    getSavePrefill: () => lastTypedMessage,
  });

  // 자주 쓰는 스킬 핀 바 — 최근 사용순 5개가 입력창 위에 항상 보인다(클릭 1번 실행).
  const pinBar = el("div", { class: "ai-skill-pinbar", dataset: { testid: "ai-skill-pinbar" } });
  const refreshPinBar = (): void => {
    if (typeof document === "undefined") return;
    const pins = pinnedSkills(5).map((skill) =>
      el("button", {
        class: "ai-skill-pin",
        attrs: { type: "button", title: skill.description },
        dataset: { testid: `ai-skill-pin-${skill.id}` },
        text: `${skill.icon} ${skill.name}`,
        on: { click: () => drawer.run(skill) },
      })
    );
    pins.push(
      el("button", {
        class: "ai-skill-pin ai-skill-pin-more",
        attrs: { type: "button", title: "스킬 전체 보기 (Ctrl+K)" },
        dataset: { testid: "ai-skill-pin-more" },
        text: "⋯ 전체",
        on: { click: () => drawer.toggle() },
      })
    );
    pinBar.replaceChildren(...pins);
  };
  refreshPinBar();

  const runSkillPrompt = (skill: SkillDef, args: Record<string, SkillArgValue>): void => {
    const prompt = skill.buildPrompt?.(args, getSkillContext()) ?? "";
    if (!prompt.trim()) {
      toast("AI 스킬을 시작할 수 없습니다.", "error");
      return;
    }
    recordSkillUse(skill.id);
    drawer.element.hidden = true;
    refreshPinBar();
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
    text: "+",
    attrs: { type: "button", title: "스킬 서랍 열기 — 입력창에 /를 쳐도 검색됩니다", "aria-label": "스킬 서랍 열기" },
    dataset: { testid: "ai-skill-drawer-toggle" },
    on: { click: () => drawer.toggle() },
  });

  // 슬래시 자동완성: "/집"처럼 입력하면 입력창 위에 스킬 목록이 뜬다.
  const slashHost = el("div", { class: "ai-slash-host", dataset: { testid: "ai-slash-host" } });
  const refreshSlash = (): void => {
    const value = input.value;
    if (!value.startsWith("/")) {
      slashHost.replaceChildren();
      return;
    }
    slashHost.replaceChildren(
      renderSlashList(value, (skill) => {
        input.value = "";
        slashHost.replaceChildren();
        drawer.run(skill);
      })
    );
  };
  input.addEventListener("input", refreshSlash);

  // AI가 지금 무엇을 보고 있는지 — 현재 맵 + 선택 영역 칩.
  const contextChips = el("div", { class: "ai-context-chips", dataset: { testid: "ai-context-chips" } });
  const refreshContextChips = (): void => {
    if (typeof document === "undefined") return; // fakeDom 해제 후 잔존 구독 가드(테스트).
    const ctx = getSkillContext();
    const chips = [el("span", { class: "ai-context-chip", text: `🗺 ${ctx.mapName ?? "맵 없음"}` })];
    if (ctx.selection) {
      chips.push(el("span", { class: "ai-context-chip", text: `▦ (${ctx.selection.x},${ctx.selection.y}) ${ctx.selection.width}×${ctx.selection.height}` }));
    }
    contextChips.replaceChildren(...chips);
  };
  refreshContextChips();
  editorState.subscribe(() => refreshContextChips());
  store.subscribe(() => refreshContextChips());

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
      click: () => openAiSettings("first"),
    },
  });
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
        if (undoMapEdit()) toast("되돌렸습니다", "ok");
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
  const studioButton = el("button", {
    class: "ai-chat-tools-button",
    text: "⛶",
    attrs: { type: "button", title: "AI 스튜디오 — 넓게 펼치기/되돌리기", "aria-label": "AI 스튜디오 펼치기" },
    dataset: { testid: "ai-studio-toggle" },
  });
  // 오른쪽 사이드바(도킹) ↔ 떠 있는 말풍선 전환. 도킹이 기본값.
  const dockStored = typeof localStorage !== "undefined" ? localStorage.getItem(DOCK_MODE_KEY) : null;
  let docked = dockStored === null ? true : dockStored === "1";
  const dockButton = el("button", {
    class: "ai-chat-tools-button",
    text: "⇥",
    attrs: { type: "button", title: "사이드바 도킹 ↔ 떠 있는 말풍선", "aria-label": "AI 패널 도킹 전환" },
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
        proposalHost.replaceChildren();
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
    children: [status, abortButton],
  });
  const header = el("div", {
    class: "ai-chat-header",
    children: [titleEl, statusGroup, collapseButton],
  });
  // 도구줄(접으면 숨김): 주요 액션을 그룹으로 정리 — 새 대화 · 로그 | 설정 · 툴 | 도킹 · 스튜디오.
  const toolbar = el("div", {
    class: "ai-chat-toolbar",
    dataset: { testid: "ai-chat-toolbar" },
    children: [
      newSessionButton,
      undoLastButton,
      exportButton,
      el("span", { class: "ai-toolbar-sep" }),
      settingsButton,
      toolsButton,
      el("span", { class: "ai-toolbar-sep" }),
      dockButton,
      studioButton,
    ],
  });

  const mainColumn = el("div", {
    class: "ai-chat-main",
    children: [
      settings.element,
      log,
      proposalHost,
      chipsHost,
      slashHost,
      contextChips,
      pinBar,
      queueIndicator,
      el("div", {
        class: "ai-chat-input-row",
        children: [skillToggle, input, sendButton],
      }),
    ],
  });
  const body = el("div", { class: "ai-chat-body", children: [mainColumn, drawer.element] });

  const panel = el("aside", {
    class: "ai-chat-panel",
    attrs: { "aria-label": "AI 어시스턴트 채팅" },
    dataset: { testid: "ai-panel" },
    children: [header, toolbar, body, collapsedRestore],
  });

  // 크기 커스텀: 좌상단 코너 핸들 드래그(오른쪽·아래가 고정이라 왼쪽·위로 끌면 커진다).
  let panelSize = loadPanelSize();
  const applySize = (): void => {
    if (collapsed || !panelSize || panel.classList.contains("is-studio") || panel.classList.contains("is-docked")) {
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
    // 도킹 상태에서 접으면 에디터 인셋(우측 여백)을 해제한다.
    if (typeof document !== "undefined" && document.body) {
      document.body.classList[docked && !collapsed ? "add" : "remove"]("ai-panel-docked");
    }
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

  // 스튜디오 모드 적용: 넓은 레이아웃 + 스킬 레일 상시 노출.
  const applyStudio = (next: boolean): void => {
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
      // 스튜디오는 전체 오버레이라 도킹을 시각적으로 해제한다(도킹 선호는 유지).
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
      applyDock(docked); // 스튜디오 해제 시 도킹 선호를 복원(또는 떠 있는 말풍선).
    }
  };
  studioButton.addEventListener("click", () => applyStudio(!studio));

  // 도킹(오른쪽 사이드바) 적용: body에 클래스를 걸어 에디터를 밀어내고, 패널을 우측 전체 높이로 고정한다.
  const applyDock = (next: boolean): void => {
    docked = next;
    if (typeof localStorage !== "undefined") localStorage.setItem(DOCK_MODE_KEY, docked ? "1" : "0");
    if (docked && studio) {
      applyStudio(false); // 도킹 선택 시 스튜디오 해제(applyStudio가 다시 applyDock을 호출한다).
      return;
    }
    if (docked) {
      panel.classList.add("is-docked");
      dockButton.textContent = "⇤";
      dockButton.setAttribute("title", "떠 있는 말풍선으로 전환");
      dockButton.setAttribute("aria-label", "AI 패널을 떠 있는 말풍선으로 전환");
    } else {
      panel.classList.remove("is-docked");
      dockButton.textContent = "⇥";
      dockButton.setAttribute("title", "오른쪽 사이드바로 도킹");
      dockButton.setAttribute("aria-label", "AI 패널을 오른쪽 사이드바로 도킹");
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.classList[docked && !collapsed ? "add" : "remove"]("ai-panel-docked");
    }
    applySize();
  };
  dockButton.addEventListener("click", () => applyDock(!docked));
  // 초기 적용: 스튜디오가 켜져 있으면 스튜디오가 이기고, 아니면 도킹(기본값) 적용.
  if (studio) applyStudio(true);
  else applyDock(docked);

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
        openSkillPalette((skill) => drawer.run(skill));
      }
    });
  }

  return panel;
}

const STUDIO_MODE_KEY = "rpg-zzu:ai-studio";
const DOCK_MODE_KEY = "rpg-zzu:ai-panel-docked";

// ── 설정 폼(접이식) ─────────────────────────────────────────────
// 입력이 바뀌면 즉시 localStorage에 자동 저장한다 — "저장 버튼을 안 눌러서 날아가는" 문제 방지.
// onSaved 콜백으로 진행 중인 세션에도 새 설정을 반영한다.
function renderSettingsForm(onSaved: (config: AiConfig) => void): { element: HTMLElement; focusFirstInput: () => void; focusApiKey: () => void } {
  const config = loadAiConfig();
  const baseUrl = textField("엔드포인트", config.baseUrl, "ai-config-baseurl", "text", DEFAULT_BASE_URL);
  const model = textField("모델", config.model, "ai-config-model", "text", DEFAULT_MODEL);
  const liteModel = textField("보조 모델(반복 배치)", config.liteModel ?? DEFAULT_LITE_MODEL, "ai-config-lite-model", "text", DEFAULT_LITE_MODEL);
  const apiKey = textField("API 키", config.apiKey, "ai-config-apikey", "password", "sk-or-…");
  // 사용자 제한은 출력 토큰 예산 하나뿐 — 툴콜 깊이는 AI가 필요한 만큼 쓴다.
  const maxTokens = textField("최대 토큰", String(config.maxTokens), "ai-config-maxtokens", "number");
  maxTokens.input.setAttribute("min", "256");
  maxTokens.input.setAttribute("max", "1000000");
  maxTokens.input.setAttribute("title", "한 요청에서 AI가 쓸 수 있는 출력 토큰 예산(기본 10240). 예산이 다 되면 그때까지의 변경을 제안하고 멈춥니다.");

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
