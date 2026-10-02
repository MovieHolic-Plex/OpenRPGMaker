// editor/hotkeys.ts
// 에디터 단축키 매핑.
// 도구/레이어/줌/저장/실행취소를 키보드로 조작한다.
// F키 레이어 전환은 데스크톱 타일 에디터의 일반 관례를 웹 키보드 규칙에 맞게 재구성했다.
//   - F5/F6/F7: 하위/상위/이벤트 레이어
//   - 1~7: 도구 순서 (연필/채우기/스포이트/이동/선택/통행/이벤트)
//   - 숫자/+-: 정수 줌
//   - Ctrl+S: 저장, Ctrl+Z/Y: 실행취소/다시실행, Ctrl+C/V: 복사/붙여넣기
//
// 텍스트 입력 모달/폼이 포커스를 가지면 단축키가 텍스트를 가로채지 않도록
// shouldIgnoreEditorShortcut() 로 가드한다.

import { deleteSelectedEditorEvent } from "@/editor/eventDeletion";
import { EDITOR_ZOOM_LEVELS, editorState, type EditorState, type Layer, type Tool } from "@/editor/editorState";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { dismissLocationDrawModeForLayer, dismissLocationDrawModeForTool } from "@/editor/locationDrawMode";
import { pendingHistoryLabels, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import { toast } from "@/util/toast";

const WALK_ENCOUNTER_DIALOG_SELECTOR = '[data-testid="walk-encounter-modal"], [data-testid="walk-encounter-list"]';

/**
 * 플레이 서피스가 키보드를 소유하고 있는가 — 시연 실행 / 이벤트 테스트 / 전투 테스트 창,
 * 또는 플레이 셸이 마운트된 모든 경우.
 *
 * 이런 서피스가 살아 있는 동안 키보드는 **게임의 것**이다. 편집 Phaser 게임은 창 뒤에서
 * 계속 살아 있고(`testPlayModal.ts` 는 `trackGlobalGame: false` 로 플레이 게임을 별도 소유한다)
 * 그 키보드 플러그인은 `window` 를 듣기 때문에, 가드가 없으면 게임에서 걸으려고 누른 방향키가
 * `EditScene.panWithArrowKey` 로도 들어가 편집 카메라를 한 번에 6타일(Shift 16타일) 밀어낸다.
 * 플레이를 조금 하다 닫으면 편집 캔버스가 맵 경계 밖으로 밀려 «맵이 사라진» 것처럼 보인다
 * (2026-08-30 실측: 방향키 24+12회 뒤 닫으면 편집 카메라 scrollX 가 323→1123 으로 밀려
 * 100×100 맵이 우하단 모서리 조각만 남는다). 방향키만이 아니다 — 1~7 도구, F5~F7 레이어,
 * +/- 줌, Ctrl+Z 되돌리기가 전부 같은 경로다. 포인터는 `installPlayPointerBlocker` 가 이미 막는다.
 *
 * 두 조건을 OR 로 본다. 둘 다 필수다:
 * - `.test-play-modal-backdrop`: `openTestPlayShell` 을 지나는 모든 테스트 셸. 전투 테스트 셸은
 *   `renderPlayer` 를 거치지 않아(`mountBattleScene` 직통) 아래 조건으로 잡힐 수 없다.
 * - `.player-layout`: `renderPlayer` 가 마운트하는 플레이 셸. 모달 없는 전역 플레이
 *   (`enterMode("play")`) 까지 덮는다 — 지금 그 경로는 `teardownEditor()` 로 편집 게임을
 *   파괴하므로 새지 않지만, 소유권 판정이 한 모달의 생산 관례에 업혀 있으면 안 된다.
 */
export function isPlaySurfaceOwningKeyboard(): boolean {
  if (typeof document === "undefined") return false;
  if (document.querySelector(".test-play-modal-backdrop")) return true;
  return Boolean(document.querySelector(".player-layout"));
}

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
    // 대화 스크롤러와 자식은 탐색 키만 소유한다. 저장·도구·히스토리는 계속 라우팅한다.
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)
      && target.closest('[data-editor-navigation-owner="true"]')) return true;
    // 모달/팝업/메뉴가 열려 있으면 충돌 방지를 위해 단축키를 끈다.
    if (target.closest("[data-testid^='menu-popup-']")) return true;
    // 공용 confirm/alert/prompt 는 .app-modal-overlay 를 쓴다(modal.ts:61/179,
    // persistenceRecoveryUi.ts:111, aiGateModal.ts:65). 이 셀렉터가 목록에 없어서
    // 확인창이 떠 있는데도 도구 키·Delete 가 배경 편집기에 적용됐다.
    if (target.closest(".app-modal-overlay")) return true;
    if (target.closest(".oprn-modal") || target.closest(".modal-backdrop")) return true;
  }
  // 데이터베이스/리소스/이벤트 명령 모달이 열려 있으면 document 기준으로 가드.
  if (typeof document !== "undefined") {
    if (document.querySelector(WALK_ENCOUNTER_DIALOG_SELECTOR)) return true;
    // 도크 모드는 가드하지 않는다 — 도크의 존재 이유가 "맵을 그대로 조작"이라
    // 존재만 보면 도크를 켜 둔 내내 맵 도구·레이어 단축키가 전면 침묵했다
    // (2026-09-19 리뷰 P0-3c). 창 모드는 여전히 가드한다.
    if (document.querySelector("[data-testid='database-modal']:not(.is-docked)")) return true;
    if (document.querySelector("[data-testid='resource-modal']")) return true;
    if (document.querySelector("[data-testid='world-panel-modal']")) return true;
    // 공방(전면 오버레이)이 떠 있으면 키는 공방의 것이다 — 배경 맵 편집기로 새면 안 된다.
    if (document.querySelector("[data-testid='workshop-host']")) return true;
    if (document.querySelector("[data-testid='event-command-catalog-modal']")) return true;
    // 이벤트 에디터 모달은 자체 undo/redo 핸들러를 두므로 EditScene 단축키가 새지 않게 가드.
    if (document.querySelector("[data-testid='event-editor-modal']:not([hidden])")) return true;
  }
  // 플레이 서피스가 떠 있으면 키보드는 게임의 것이다.
  if (isPlaySurfaceOwningKeyboard()) return true;
  return false;
}

/**
 * 브라우저 네이티브 텍스트 undo 의 대상이 아닌 input type 목록.
 * 체크박스/라디오/버튼류에 포커스가 있을 때 Ctrl+Z 를 무시하면 사용자 입장에서는
 * "단축키가 그냥 씹힌다" — 이들은 텍스트 편집이 아니므로 히스토리 단축키를 처리한다.
 */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * 포커스가 텍스트 편집 컨트롤(텍스트형 input/textarea/contentEditable)에 있는지 판별.
 * 이 경우 Ctrl+Z/Y 는 브라우저 기본 텍스트 실행취소가 우선되어야 하므로
 * 히스토리 단축키를 처리하지 않는다. checkbox/radio/range/button 형 input 은
 * 텍스트 편집이 아니므로 여기서 제외한다(P11-C: 체크박스 포커스 중 Ctrl+Z 무반응).
 */
export function isTextEditingFocus(event: KeyboardEvent): boolean {
  return isTextEditingElement(event.target);
}

/** isTextEditingFocus 의 요소 판정부 — 포커스 반납(mapSurfaceFocus) 도 같은 규칙을 써야 한다. */
export function isTextEditingElement(target: unknown): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT") {
    // 테스트 더블 등 getAttribute 가 없는 최소 객체도 허용 — type 미상은 text 로 간주.
    const attrType = typeof target.getAttribute === "function" ? target.getAttribute("type") : null;
    const rawType = attrType ?? (target as HTMLInputElement).type ?? "";
    return !NON_TEXT_INPUT_TYPES.has(String(rawType).toLowerCase());
  }
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Ctrl/Cmd+Z · Ctrl/Cmd+Shift+Z · Ctrl/Cmd+Y 인지 — 히스토리 키를 다른 가드보다 먼저 라우팅하려면 필요. */
export function isHistoryHotkeyChord(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  const key = event.key.toLowerCase();
  return key === "z" || key === "y";
}

/**
 * 자체 document/backdrop 리스너로 handleHistoryHotkey 를 이미 부르는 패널이 떠 있는지.
 * 이 경우 맵 씬까지 같은 키를 처리하면 한 번의 Ctrl+Z 가 두 단계를 되돌린다.
 */
export function historyHotkeyOwnedByPanel(): boolean {
  if (typeof document === "undefined") return false;
  // 플레이 서피스가 떠 있으면 Ctrl+Z 도 편집기의 것이 아니다. EditScene 은 히스토리 키를
  // 일반 가드보다 **먼저** 처리하므로(체크박스 포커스가 되돌리기를 삼키던 결함 대응),
  // 이 함수가 소유권을 넘기면 handleKeyDown 이 자연스럽게 shouldIgnoreEditorShortcut 로
  // 내려가 전적으로 침묵한다 — EditScene 에 별도 가드를 넣지 않는 이유다.
  if (isPlaySurfaceOwningKeyboard()) return true;
  if (document.querySelector(WALK_ENCOUNTER_DIALOG_SELECTOR)) return true;
  // 모달 계층이 살아 있으면 히스토리 키도 그 계층의 것이다. EditScene 은 히스토리 키를
  // 일반 가드보다 **먼저** 처리하므로(체크박스 포커스가 되돌리기를 삼키던 결함 대응),
  // 여기서 소유권을 넘기지 않으면 맵 삭제 확인 도중 Ctrl+Z 가 뒤에서 프로젝트를 되돌린다.
  if (hasOpenModalLayer()) return true;
  // 도크는 제외 — 위 일반 가드와 같은 이유다. 창 모드 DB 모달은 자체 Ctrl+Z/Y 를 두므로
  // 여기서 소유권을 넘겨야 하고, 그 경로는 이제 modalStack 등록으로도 함께 막힌다.
  if (document.querySelector("[data-testid='database-modal']:not(.is-docked)")) return true;
  if (document.querySelector("[data-testid='resource-modal']")) return true;
  return Boolean(document.querySelector("[data-testid='event-editor-modal']:not([hidden])"));
}

/**
 * 모달(데이터베이스/이벤트 에디터) 이 열려 있어도 전역 실행취소/다시실행을 처리한다.
 * 텍스트 입력 필드에 포커스가 있으면(브라우저 텍스트 undo 우선) 무시한다.
 * Ctrl+Z = 실행취소, Ctrl+Y 또는 Ctrl+Shift+Z = 다시실행.
 * 히스토리 키(Ctrl+Z/Y)는 스택이 비어 있어도 브라우저 기본 동작을 막는다.
 * @returns 프로젝트 상태가 실제로 복원/재적용되었으면 true(=재렌더 필요).
 */
export function handleHistoryHotkey(event: KeyboardEvent): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  if (isTextEditingFocus(event)) return false;
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    return event.shiftKey ? runRedoWithFeedback() : runUndoWithFeedback();
  }
  if (key === "y") {
    event.preventDefault();
    return runRedoWithFeedback();
  }
  return false;
}

/**
 * 되돌림에는 반드시 눈에 보이는 응답이 따라야 한다.
 *
 * 예전에는 Ctrl+Z 가 조용히 성공했다. 되돌려진 칸이 화면 밖이거나 변화가 미세하면
 * 감독은 눌렸는지조차 알 수 없어, 확인하려고 한 번 더 눌렀다가 두 단계를 되돌리는
 * 사고가 났다. 스택이 비어 있을 때도 마찬가지로 침묵해서 "고장인가" 로 읽혔다.
 * 성공·실패 양쪽 모두 알린다. 라벨은 pop 전에 읽어야 해서 pendingHistoryLabels() 를 쓴다.
 */
function runUndoWithFeedback(): boolean {
  const label = pendingHistoryLabels().undo;
  if (!undoMapEdit()) {
    toast("되돌릴 작업이 없습니다", "info");
    return false;
  }
  toast(label ? `되돌렸습니다 — ${label}` : "되돌렸습니다", "ok");
  return true;
}

function runRedoWithFeedback(): boolean {
  const label = pendingHistoryLabels().redo;
  if (!redoMapEdit()) {
    toast("다시 실행할 작업이 없습니다", "info");
    return false;
  }
  toast(label ? `다시 실행했습니다 — ${label}` : "다시 실행했습니다", "ok");
  return true;
}

/** 툴 순서: 숫자키 1..7 로 선택. tilePalette TOOLS 순서와 일치시킨다. */
const TOOL_HOTKEYS: readonly Tool[] = ["paint", "fill", "eyedropper", "pan", "select", "collision", "event"];

/** 문자 단축키(스펙 §4 3-B): 아이콘 레일 툴팁·커맨드 팔레트와 표기 일치. */
const TOOL_LETTER_HOTKEYS: Readonly<Record<string, Tool>> = {
  v: "select",
  b: "paint",
  e: "erase",
  g: "fill",
  n: "event",
  i: "eyedropper",
};

/** 레이어 전환 시 이벤트 레이어면 도구를 event로, 나가면 paint로 되돌린다. */
export function applyLayer(layer: Layer): void {
  dismissLocationDrawModeForLayer(layer);
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
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "w") {
    event.preventDefault();
    void import("@/editor/panels/worldEntries").then(({ openWorldPanel }) => { void openWorldPanel(); });
    return true;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  if (handleEditorDeleteKey(event)) return true;

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
    dismissLocationDrawModeForTool(tool);
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

  // 문자키 도구 전환 — 숫자키와 동일한 레이어 가드.
  const letterTool = TOOL_LETTER_HOTKEYS[event.key.toLowerCase()];
  if (letterTool && event.key.length === 1) {
    event.preventDefault();
    const state = editorState.get();
    if (letterTool === "event") {
      dismissLocationDrawModeForTool(letterTool);
      editorState.set({ tool: "event", layer: "event" });
    } else if (state.layer === "event") {
      dismissLocationDrawModeForTool(letterTool);
      editorState.set(toolPatch(letterTool, "lower"));
    } else {
      dismissLocationDrawModeForTool(letterTool);
      editorState.set(toolPatch(letterTool));
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

export function handleEditorDeleteKey(event: KeyboardEvent): boolean {
  if (shouldIgnoreEditorShortcut(event)) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key !== "Delete") return false;
  if (editorState.get().layer !== "event") return false;
  if (!deleteSelectedEditorEvent()) return false;
  event.preventDefault();
  return true;
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
    return { tool, ...(layer ? { layer } : {}), paintShape: "pen", activePaletteStamp: null };
  }
  return layer ? { tool, layer } : { tool };
}
