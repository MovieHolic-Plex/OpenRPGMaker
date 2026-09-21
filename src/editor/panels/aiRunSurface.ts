import type { ActivityVisual } from "@/ai/activityVisual";
// editor/panels/aiRunSurface.ts
// 턴 실행이 공유하는 **실행 표면 계약**. 채팅 턴(aiTurnRunner)과 선택 영역 작업
// (aiRegionTaskRunner)이 같은 표면을 쓴다 — 상태 줄, 진행 표시, 중단 버튼, 로그, 접힘/펼침.
//
// 왜 인터페이스로 뽑는가: 두 실행부는 3,422줄 aiChatPanel 클로저 안에서 33개의 지역 변수를
// 직접 읽고 썼다. 그 결합을 이름으로 드러내지 않으면 어느 실행부가 무엇을 흔드는지 알 수 없다.
// 가변 필드는 접근자로 넘긴다 — 실행부는 상태의 **소유자가 아니라 사용자**이고, 소유권은
// 패널의 `let` 에 그대로 남는다.
import type { AuditEntry } from "@/ai/assistantSession";
import type { ToolResult } from "@/editor/tools";
import type { AiBubbleRole } from "./aiConversationLog";
import type { ChatController } from "./aiChatPanelHelpers";

/** 진행 중인 턴의 경과 표시용 상태(진행 줄이 읽는다). */
export interface AiRunProgress {
  readonly startedAt: number;
  toolCount: number;
}

/** 대화 저장 대상 — 생략하면 현재 대화(controller)의 감사 기록을 저장한다. */
export interface ConversationPersistTarget {
  readonly id: string;
  readonly scope: string;
  readonly entries: readonly AuditEntry[];
}

export interface AiRunSurface {
  // ── 요소 ──────────────────────────────────────────────────
  readonly panel: HTMLElement;
  readonly log: HTMLElement;
  readonly sendButton: HTMLButtonElement;
  readonly controller: ChatController;

  // ── 가변 실행 상태(소유자는 패널) ─────────────────────────
  turnBusy: boolean;
  readonly disposed: boolean;
  /** 두 런너는 턴 시작에서 `false` 로 되돌리기만 한다 — 읽는 곳은 패널의 중단 경로다. */
  abortNoticeShown: boolean;
  activeAbortController: AbortController | null;
  collapseAfterAiWork: boolean;
  readonly collapsed: boolean;
  readonly conversationId: string;
  readonly conversationScope: string;
  runningPhaseStatus: string | null;
  readonly runningProgress: AiRunProgress | null;

  // ── 상태 줄 · 진행 · 중단 ────────────────────────────────
  readonly setStatus: (text: string, record?: boolean) => void;
  readonly beginTurnProgress: () => void;
  readonly endTurnProgress: () => void;
  readonly refreshRunningStatus: (record?: boolean) => void;
  readonly refreshAbortButton: () => void;
  readonly startLiveActivity: (toolName: string, index: number, args?: Record<string, unknown>) => void;
  readonly completeLiveActivity: (toolName: string, result: ToolResult, args?: Record<string, unknown>, visuals?: readonly ActivityVisual[]) => void;

  // ── 접힘/펼침 · 알림 ─────────────────────────────────────
  readonly expandForAiWork: () => void;
  readonly scheduleCollapseAfterAiWork: () => void;
  readonly notifyIfObscuredByTestPlay: () => void;

  // ── 큐 · 저장 · 재전송 ───────────────────────────────────
  readonly drainPendingSends: () => void;
  readonly persistConversation: (target?: ConversationPersistTarget) => void;
  readonly sendText: (text: string, displayAs?: string, opts?: { readonly replay?: boolean; readonly userResume?: true }) => Promise<void>;

  // ── 대화 로그 렌더(conversationLog 위임) ─────────────────
  readonly appendBubble: (role: AiBubbleRole, text: string) => HTMLElement;
  readonly appendReasoning: () => { box: HTMLElement; body: HTMLElement };
  readonly closeToolActivity: () => void;
  readonly clearLastReasoning: () => void;
  readonly isLastReasoningBox: (node: HTMLElement) => boolean;
}
