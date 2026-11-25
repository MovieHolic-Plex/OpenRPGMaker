// 막히는 신호에 한 번만 보기를 올리자고 말한다(목업 v2). 보기를 스스로 바꾸거나 내리지 않는다.
//  - 쉬움에서 같은 이벤트를 말로 두 번 되돌림 → 보통 제안
//  - 숨은 명령(스크립트) 카드를 펼침, 카드에서 줄 복사·Delete 키 → 고급 제안
// 제안은 맨 아래 「무엇이 바뀌었나」 줄 자리에 한 번 뜨고, 보인 뒤 14일 동안 같은 제안은 다시 안 뜬다.
import {
  EVENT_EDITOR_VIEW_LEVEL_LABEL,
  eventEditorViewLevel,
  type EventEditorViewLevel,
} from "./beginnerChrome";

const HINT_KEY = "oprn.event-editor.level-hint";
export const VIEW_LEVEL_HINT_QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const RANK: Readonly<Record<EventEditorViewLevel, number>> = { easy: 0, normal: 1, advanced: 2 };

export type ViewLevelSignal = "undo-twice" | "hidden-command" | "line-copy" | "line-delete";

const SIGNAL_TARGET: Readonly<Record<ViewLevelSignal, Exclude<EventEditorViewLevel, "easy">>> = {
  "undo-twice": "normal",
  "hidden-command": "advanced",
  "line-copy": "advanced",
  "line-delete": "advanced",
};

const SIGNAL_LEAD: Readonly<Record<ViewLevelSignal, string>> = {
  "undo-twice": "말로 두 번 되돌렸어요.",
  "hidden-command": "카드가 다 못 보여 주는 명령을 열었어요.",
  "line-copy": "줄을 복사하려고 했어요.",
  "line-delete": "줄을 지우려고 했어요.",
};

let memory: Record<string, number> = {};

function readShown(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HINT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return memory;
  }
}

function writeShown(value: Record<string, number>): void {
  memory = value;
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(value));
  } catch {
    // 저장소를 못 쓰면 이번 세션만 기억한다.
  }
}

/**
 * 신호 하나를 받아 보일 제안 문장을 돌려준다. 보일 것이 없으면 null.
 * 이미 그 보기 이상이거나, 같은 제안을 14일 안에 보였으면 null 이다. 돌려줄 때 「보였음」을 적는다.
 */
export function viewLevelHintFor(signal: ViewLevelSignal, now = Date.now()): string | null {
  const target = SIGNAL_TARGET[signal];
  if (RANK[eventEditorViewLevel()] >= RANK[target]) return null;
  const shown = readShown();
  const last = shown[target];
  if (typeof last === "number" && now - last < VIEW_LEVEL_HINT_QUIET_MS) return null;
  writeShown({ ...shown, [target]: now });
  const label = EVENT_EDITOR_VIEW_LEVEL_LABEL[target];
  return `${SIGNAL_LEAD[signal]} 직접 고쳐 보려면 ⋯ › 보기 › ${label}. 이 제안은 14일 동안 다시 안 보여요.`;
}

export function resetViewLevelHintForTest(): void {
  memory = {};
  try { localStorage.removeItem(HINT_KEY); } catch { /* 없음 */ }
}
