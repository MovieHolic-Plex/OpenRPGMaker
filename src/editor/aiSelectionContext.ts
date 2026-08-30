// editor/aiSelectionContext.ts
// 캔버스·팔레트·컨텍스트 메뉴가 "이 선택으로 조수에게 작업을 시킨다" 를 요청하는 **단일** 브리지.
// 예전에는 진입점마다 영역 작업 팝오버를 직접 열었고(6곳), 그 팝오버가 조수와 별개의 AI 엔진을
// 돌렸다. 이제 진입점은 이 이벤트 하나만 쏘고, 실행은 조수 세션이 한다.
import type { TileSelection } from "@/editor/editorState";

export const AI_SELECTION_CONTEXT_EVENT = "oprn:ai-selection-context";

export interface AiSelectionContextDetail {
  readonly focus?: boolean;
  readonly selection: TileSelection | null;
  /** 조수 입력창에 미리 채울 지시문(진입점이 준비한 문구). */
  readonly instruction?: string;
  /** true 면 프리필 직후 바로 전송한다(칩·버튼이 "한 번 눌러 실행" 인 경우). */
  readonly autoRun?: boolean;
}

export interface AiSelectionContextRequest {
  readonly focus?: boolean;
  readonly instruction?: string;
  readonly autoRun?: boolean;
}

export function requestAiSelectionContext(
  selection: TileSelection | null,
  focusOrOptions: boolean | AiSelectionContextRequest = true,
): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const options: AiSelectionContextRequest =
    typeof focusOrOptions === "boolean" ? { focus: focusOrOptions } : focusOrOptions;
  const detail: AiSelectionContextDetail = {
    focus: options.focus !== false,
    selection,
    ...(options.instruction !== undefined ? { instruction: options.instruction } : {}),
    ...(options.autoRun !== undefined ? { autoRun: options.autoRun } : {}),
  };
  let event: Event;
  if (typeof CustomEvent === "function") {
    event = new CustomEvent<AiSelectionContextDetail>(AI_SELECTION_CONTEXT_EVENT, { detail });
  } else {
    event = new Event(AI_SELECTION_CONTEXT_EVENT);
    Object.defineProperty(event, "detail", { configurable: true, value: detail });
  }
  window.dispatchEvent(event);
}

export function aiSelectionContextDetail(event: Event): AiSelectionContextDetail | null {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== "object" || detail === null) return null;
  const candidate = detail as Partial<AiSelectionContextDetail>;
  if (candidate.selection !== null && !isTileSelection(candidate.selection)) return null;
  const instruction = typeof candidate.instruction === "string" ? candidate.instruction : undefined;
  return {
    focus: candidate.focus === false ? false : true,
    selection: candidate.selection ?? null,
    ...(instruction !== undefined ? { instruction } : {}),
    // autoRun 은 채울 지시문이 있을 때만 의미가 있다 — 빈 입력창을 자동 전송하면 아무 일도 없다.
    ...(candidate.autoRun === true && instruction ? { autoRun: true } : {}),
  };
}

function isTileSelection(value: unknown): value is TileSelection {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<TileSelection>;
  return (
    typeof candidate.mapId === "string" &&
    Number.isInteger(candidate.x) &&
    Number.isInteger(candidate.y) &&
    Number.isInteger(candidate.width) &&
    Number.isInteger(candidate.height)
  );
}
