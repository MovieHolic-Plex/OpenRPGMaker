// editor/hotkeys.ts
// RM2K3 스타일 에디터 단축키 매핑.
// 도구/레이어/줌/저장/실행취소를 키보드로 조작한다.
// RPG Maker 계열 에디터의 F키 레이어 전환 관례를 웹 키보드 규칙에 맞게 재구성했다.
//   - F5/F6/F7: 하위/상위/이벤트 레이어
//   - 1~7: 도구 순서 (연필/채우기/스포이트/이동/선택/통행/이벤트)
//   - 숫자/+-: 정수 줌
//   - Ctrl+S: 저장, Ctrl+Z/Y: 실행취소/다시실행, Ctrl+C/V: 복사/붙여넣기
//
// 텍스트 입력 모달/폼이 포커스를 가지면 단축키가 텍스트를 가로채지 않도록
// shouldIgnoreEditorShortcut() 로 가드한다.

import { EDITOR_ZOOM_LEVELS, editorState, type EditorState, type Layer, type Tool } from "@/editor/editorState";

/**
 * 현재 포커스가 폼 컨트롤이거나 모달이 열려 있어 에디터 단축키를 무시해야 하는지 판별.
 * Phaser 키보드 플러그인은 캡처 단계 document 리스너로 동작하므로, 텍스트 필드에
 * 타이핑하는 동안 F키/숫자키가 도구를 바꿔버리는 일을 막아야 한다.
 */
export function shouldIgnoreEditorShortcut(event: KeyboardEvent): boolean {
  const target = event.target;
  // DOM 이 없는 환경(SSR/테스트 node)에서는 가드를 건너뛴다.
  if (typeof HTMLElement !== "undefined" && target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (target.isContentEditable) return true;
    // 모달/팝업/메뉴가 열려 있으면 충돌 방지를 위해 단축키를 끈다.
    if (target.closest("[data-testid^='menu-popup-']")) return true;
    if (target.closest(".rm2k3-modal") || target.closest(".modal-backdrop")) return true;
  }
  // 데이터베이스/리소스/이벤트 명령 모달이 열려 있으면 document 기준으로 가드.
  if (typeof document !== "undefined") {
    if (document.querySelector("[data-testid='database-modal']")) return true;
    if (document.querySelector("[data-testid='resource-modal']")) return true;
    if (document.querySelector("[data-testid='event-command-catalog-modal']")) return true;
  }
  return false;
}

/** 툴 순서: 숫자키 1..7 로 선택. tilePalette TOOLS 순서와 일치시킨다. */
const TOOL_HOTKEYS: readonly Tool[] = ["paint", "fill", "eyedropper", "pan", "select", "collision", "event"];

/** 레이어 전환 시 이벤트 레이어면 도구를 event로, 나가면 paint로 되돌린다. */
export function applyLayer(layer: Layer): void {
  const state = editorState.get();
  if (layer === "event") {
    editorState.set({ layer, tool: "event" });
    return;
  }
  if (state.tool === "event") {
    editorState.set({ layer, tool: "paint", paintShape: "pen" });
    return;
  }
  editorState.set({ layer });
}

/** Ctrl 없이 누른 키에 대한 에디터 전역 단축키 처리. true=처리함. */
export function handleEditorKey(event: KeyboardEvent): boolean {
  if (shouldIgnoreEditorShortcut(event)) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  // F5/F6/F7: 레이어 (하위/상위/이벤트).
  if (event.code === "F5") {
    event.preventDefault();
    applyLayer("lower");
    return true;
  }
  if (event.code === "F6") {
    event.preventDefault();
    applyLayer("upper");
    return true;
  }
  if (event.code === "F7") {
    event.preventDefault();
    applyLayer("event");
    return true;
  }

  // F2/F3/F4: 그리드/줌 단축 보조(그리드 토글은 별도). 여기선 무시.

  // 숫자키 1..7: 도구.
  const toolIndex = "1234567".indexOf(event.key);
  if (toolIndex >= 0 && toolIndex < TOOL_HOTKEYS.length) {
    event.preventDefault();
    const tool = TOOL_HOTKEYS[toolIndex];
    // 이벤트 도구는 이벤트 레이어로 강제. 그 외 도구는 이벤트 레이어에서 타일 도구로 빠지지 않게 가드.
    const state = editorState.get();
    if (tool === "event") {
      editorState.set({ tool: "event", layer: "event" });
    } else if (state.layer === "event") {
      // 이벤트 레이어에서 타일 도구를 고르면 하위 레이어로 나간다.
      editorState.set(toolPatch(tool, "lower"));
    } else {
      editorState.set(toolPatch(tool));
    }
    return true;
  }

  // 줌: +/- 와 < > (RM2K3 는 +/- 사용). 정수 스텝만.
  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    stepZoom(+1);
    return true;
  }
  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    stepZoom(-1);
    return true;
  }

  return false;
}

/** 현재 줌에서 한 단계 위/아래로. 허용 줌 레벨 범위 안에서만. */
function stepZoom(direction: 1 | -1): void {
  const current = editorState.get().zoom;
  const idx = EDITOR_ZOOM_LEVELS.indexOf(current);
  const next = Math.max(0, Math.min(EDITOR_ZOOM_LEVELS.length - 1, idx + direction));
  const zoom = EDITOR_ZOOM_LEVELS[next];
  if (zoom === undefined) return;
  editorState.set({ zoom });
}

function toolPatch(tool: Exclude<Tool, "event">, layer?: Layer): Partial<EditorState> {
  if (tool === "paint") {
    return layer ? { tool, layer, paintShape: "pen" } : { tool, paintShape: "pen" };
  }
  return layer ? { tool, layer } : { tool };
}
