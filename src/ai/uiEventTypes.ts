// AI 프론트 액션 로그의 타입과 계약. 값 모듈(uiEventLog)과 분리해 두면 계측 지점(패널·모달)이
// 리스너 설치 코드를 끌어오지 않고 이름만 가져다 쓸 수 있다.

export interface AiUiEvent {
  readonly at: string;
  /** 단조 증가. 턴 구간 절단(takeAiUiEventsSince)의 기준. */
  readonly seq: number;
  readonly surface: string;
  /** 위임 수집은 `click:<testid>`, 의미 이벤트는 AI_UI_ACTIONS 의 이름. */
  readonly action: string;
  readonly testid?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly detail?: Record<string, unknown>;
}

export interface AiUiEventInput {
  readonly surface: string;
  readonly action: string;
  readonly testid?: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly detail?: Record<string, unknown>;
  readonly at?: string;
}

/**
 * 위임 수집이 «AI 표면» 으로 인정하는 선택자 → 표면 이름.
 *
 * 맵 캔버스·타일 팔레트·DB 스튜디오는 일부러 빼 둔다. 조수와 무관한 조작까지 남기면 로그량이
 * 수십 배로 늘고, 맵 드래그 같은 연속 입력은 별도 샘플링이 필요하다(승인된 범위 밖).
 * 위쪽에 있는 항목이 먼저 매치한다 — 모달이 패널 안에 있을 수 있으므로 좁은 것을 앞에 둔다.
 */
export const AI_UI_EVENT_SURFACES: readonly (readonly [string, string])[] = [
  [".ai-history-window", "history-modal"],
  [".ai-instructions-window", "instructions-modal"],
  ["[data-testid='ai-harness-modal']", "harness-modal"],
  [".ai-context-panel", "context-panel"],
  [".ai-command-menu", "command-menu"],
  [".ai-suggest-popover", "suggest-popover"],
  [".ai-composer", "composer"],
  [".ai-chat-panel", "panel"],
];

/**
 * 의미 이벤트 이름 — 클릭 사실만으로 결과를 알 수 없는 액션들. `detail` 에 결과 수치를 싣는다.
 * test/aiUiEventContract.test.ts 가 이 목록과 실제 호출 지점의 일치를 소스 원문에서 잠근다.
 *
 * 「제안 승인/거절」은 없다 — 승인 카드는 설계상 제거됐고(approvalPolicy: 쓰기는 그대로 적용하고
 * 복구는 되돌리기다), 남은 게이트(pendingRegionApply)는 DOM 어포던스가 없는 콘솔/E2E 훅이라
 * 누를 버튼 자체가 존재하지 않는다. 그 경로의 결과는 턴 행의 toolCalls·proposedCalls 에 남는다.
 */
export const AI_UI_ACTIONS = {
  contextCompact: "context-compact",
  contextCompactUndo: "context-compact-undo",
  conversationRestore: "conversation-restore",
  conversationDelete: "conversation-delete",
  conversationExport: "conversation-export",
  instructionsSave: "instructions-save",
  turnRewind: "turn-rewind",
  panelCollapse: "panel-collapse",
  newConversation: "new-conversation",
  turnAbort: "turn-abort",
  turnRetry: "turn-retry",
  temperatureSwitch: "temperature-switch",
} as const;

export type AiUiActionName = (typeof AI_UI_ACTIONS)[keyof typeof AI_UI_ACTIONS];
