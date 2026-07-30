// editor/panels/aiChatPanelHelpers.ts
// aiChatPanel 순수 헬퍼·타입·감사 로그 유틸. DOM 클로저 밖 재사용 가능 로직만 둔다.

import {
  AssistantSession,
  METADATA_ONLY_TOOLS,
  type AuditEntry,
  type ProposedCall,
  type SessionEvent,
} from "@/ai/assistantSession";
import type { BuildSpec } from "@/ai/buildSpec";
import {
  proposalHasChangedMap,
  requestLikelyExpectsChange,
} from "@/ai/proposalCompleteness";
import { isProxyAuth, loadAiConfig } from "@/ai/llmClient";
import type { AiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { getTool } from "@/editor/tools";
import { showConfirm } from "@/editor/ui/modal";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import {
  mapIdCreatedByCall,
  mapIdsReferencedByCall,
  positive,
} from "./aiProposalSummary";

export const SESSION_BACKUP_KEY = "rpg-zzu:ai-session-backup";
export const VOLATILE_OVERLAY_IDLE_MS = 6000;
export const STUDIO_MODE_KEY = "rpg-zzu:ai-studio";

export const MAP_TILE_TOOLS = new Set([
  "paint_tiles", "paint_road", "scatter_object", "stamp_structure", "build_house", "clear_region", "resize_map",
  "tile_paint", "tile_road", "tile_scatter", "tile_structure",
  // 타일 v3 공정 프리미티브(V3B)
  "build_wall", "build_roof", "place_door", "place_window", "lay_path", "place_props", "fill_region", "tile_erase",
]);

export function isWriteTool(name: string): boolean {
  return getTool(name)?.mode === "write";
}

export function isAiConfigReady(config: AiConfig): boolean {
  if (!config.model.trim()) return false;
  if (config.authMode === "chatgpt") return true;
  // baseUrl 은 항상 필요. 단, 상대 baseUrl(동일 오리진 vite 프록시)은 서버가 Authorization 을
  // 주입하므로(isProxyAuth) 클라이언트 apiKey 를 요구하지 않는다. 이전에는 여기서 키를 무조건
  // 요구해 프록시 환경에서 AI 채팅 전송이 막혔다(중복 검사가 면제를 빼먹은 결함).
  // 올바른 참조 구현: editor/panels/aiConnectionStatus.ts — 판정은 llmClient.isProxyAuth 로 통일.
  if (isProxyAuth(config)) return Boolean(config.baseUrl.trim());
  return Boolean(config.baseUrl.trim() && config.apiKey.trim());
}

export function phaseStatusText(phase: Extract<SessionEvent, { type: "phase" }>["value"]): string {
  // 모델 코드(m3/flash)는 상태줄 노이즈 — 사용자에게는 단계만.
  if (phase === "plan") return "계획 중";
  if (phase === "execute") return "실행 중";
  return "검수 중";
}

/** 채팅 말풍선으로 올릴 가치가 있는 status 문구인지. 대부분은 상태줄만으로 충분. */
export function shouldShowStatusInChat(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 재시도·예산 소진·사용자 중단처럼 행동 변경이 필요할 때만 로그에 남긴다.
  if (/재시도|중단|오류|실패|토큰|예산|API 키|인증|일부만 제안|이어서 요청|요청이 커서/u.test(t)) return true;
  return false;
}

/** 조회성(읽기) 툴 — 펼친 도구 목록에서 줄여 보여 쓰기 작업 위주로 읽히게 한다. */
export function isReadOnlyToolNoise(name: string): boolean {
  return /^(get_|list_|show_|query_|analyze_|tile_query|lint_)/u.test(name);
}

export function displayUserAuditText(text: string): string {
  return text.split(/\n\n\[컨텍스트\]/u)[0] ?? text;
}

// 세션 시작 시 프로젝트 스냅샷 1회 백업(기존 자동저장과 별도 슬롯). 용량 초과 시 조용히 생략.
export function backupProjectSnapshot(): void {
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

export function aiHistoryLabel(calls: readonly ProposedCall[]): string {
  const first = calls[0];
  const summary = first?.summary.trim() || first?.name || "변경";
  const short = summary.length > 28 ? `${summary.slice(0, 28)}…` : summary;
  return calls.length > 1 ? `AI: ${short} 외 ${calls.length - 1}건` : `AI: ${short}`;
}

export function currentHistoryMapId(): string | null {
  const project = store.getCurrent();
  return editorState.get().currentMapId ?? project.startMapId ?? null;
}

// 타일 지식(메타데이터) 전용 툴 목록은 assistantSession과 공유한다(제안 카드 없이 즉시 반영되는 계열).
export function isMetadataOnlyProposal(calls: readonly ProposedCall[]): boolean {
  return calls.length > 0 && calls.every((call) => METADATA_ONLY_TOOLS.has(call.name));
}

/** 제안 카드 본문이 이미 확인 UI인 경고 — 이중 「승인 확인」 모달을 띄우지 않는다. */
export function isCardLevelApprovalWarning(warning: string): boolean {
  return (
    warning.includes("이대로 적용")
    || warning.includes("맵만 적용")
    || warning.includes("재료 합의")
    || warning.includes("맵 배치 초안")
    || warning.includes("목업")
    || warning.includes("자동 적용되지 않습니다")
    || warning.includes("맵에 이렇게 놓습니다")
  );
}

// 커스텀 인앱 모달(§2.4) — 네이티브 confirm 대체. 경고가 없으면 동기 true를 돌려
// 수락 경로가 마이크로태스크로 미뤄지지 않게 한다(적용 직후 상태를 읽는 흐름 보존).
// soft-confirm/재료 합의 경고만 있으면 카드의 [이대로 적용]이 확인이므로 모달을 건너뛴다.
export function confirmRuleApproval(warnings: readonly string[]): true | Promise<boolean> {
  if (warnings.length === 0) return true;
  if (warnings.every(isCardLevelApprovalWarning)) return true;
  return showConfirm({ title: "승인 확인", message: `${warnings.join("\n")}\n\n이 규칙을 적용할까요?`, confirmLabel: "적용" });
}

export function attachCompletenessWarnings(calls: readonly ProposedCall[], warnings: readonly string[]): void {
  if (warnings.length === 0) return;
  const diff = calls.find((call) => call.result.diff)?.result.diff;
  if (!diff) return;
  for (const warning of warnings) {
    if (!diff.warnings.includes(warning)) diff.warnings.push(warning);
  }
}

export function completenessSpecForProposal(
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

export interface ChatController {
  session: AssistantSession | null;
  // 폐기된(수락/거부) 세션들의 감사 항목 누적 — 내보내기가 세션 폐기 후에도 동작해야 한다.
  auditHistory: AuditEntry[];
  // UI 상태 배지 전이 타임라인(결함 ⑬) — 로그 export에 포함된다.
  statusTimeline: StatusTransition[];
}

export function exportCombinedAudit(controller: ChatController): string | null {
  return combineAuditJson(controller.auditHistory, controller.session, loadAiConfig().model, controller.statusTimeline);
}

// 세션을 버리기 전에 감사 항목을 회수한다.
export function dropSession(controller: ChatController): void {
  if (controller.session) controller.auditHistory.push(...controller.session.getAuditEntries());
  controller.session = null;
  clearAgentGhostPreview();
}

export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", { attrs: { href: url, download: filename } });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

// 0건 프로포절 비블로킹 알림(도그푸딩 결함 ⑤)
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

// show_tile_grid 툴 결과 페이로드(패널 렌더 계약).
export interface TileGridData {
  tilesetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lower: number[][];
  upper: number[][];
}

export type AiAssistDetail =
  | { readonly kind: "cluster-edit"; readonly tilesetId: string; readonly groupId: string }
  | { readonly kind: "unclassified-analysis"; readonly tilesetId: string; readonly sampleTiles: readonly number[]; readonly total: number };

export function isAiAssistDetail(value: unknown): value is AiAssistDetail {
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

/** 상태 배지·접힘 FAB 점과 맞추는 톤. UI 폴리시(제안 6). */
export type AiStatusTone = "idle" | "running" | "review" | "error" | "ok";

export function statusToneOf(text: string): AiStatusTone {
  const t = text.trim();
  if (!t) return "idle";
  if (t === "오류" || t.startsWith("오류") || t.includes("실패")) return "error";
  if (t.includes("검토 대기")) return "review";
  if (
    t === "적용됨" ||
    t === "완료" ||
    t.startsWith("완료") ||
    t.includes("밑그림 확정") ||
    t.includes("대화 복원")
  ) {
    return "ok";
  }
  if (
    t.includes("초") ||
    t.includes("도구") ||
    t.includes("계획") ||
    t.includes("실행") ||
    t.includes("검수") ||
    t.includes("생각") ||
    t.includes("영역 작업") ||
    t.includes("중단") ||
    t.endsWith("중…") ||
    t.endsWith("중...")
  ) {
    return "running";
  }
  // 대기 / 새 대화 / 이전 대화 등
  return "idle";
}

export function aiDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatAiDayLabel(date: Date): string {
  try {
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return aiDayKey(date);
  }
}

export function parseAiDayDate(at?: Date | string | null): Date {
  if (at instanceof Date && !Number.isNaN(at.getTime())) return at;
  if (typeof at === "string" && at.trim()) {
    const parsed = new Date(at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
