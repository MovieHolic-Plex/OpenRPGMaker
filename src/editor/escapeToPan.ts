// editor/escapeToPan.ts
// Esc 한 번의 **소유권 사슬**과, 아무도 가져가지 않았을 때의 마지막 소비자(화면 밀기).
//
// 왜 별도 모듈인가: 이 저장소에서 Esc 는 세 번 회귀했다. 매번 파일명이나 호출자로 범위를
// 좁혀 찾다가 실제 핸들러를 놓쳤기 때문이다. 그래서 판정을 EditScene 안에 묻지 않고
// **순서 자체가 읽히는** 순수 함수로 꺼냈다. Esc 를 쓰는 새 표면을 만들 때 여기부터 읽어라.
//
// ── Esc keydown 이 실제로 지나가는 순서 (2026-09-09 src/ 전수 grep) ──
// DOM 은 capture(window→document→…→target) → bubble(target→…→document→window) 로 흐르고,
// EditScene 은 Phaser 키보드 플러그인을 통해 **window bubble** 에서 듣는다. 그리고 Phaser
// KeyboardManager 는 `event.defaultPrevented` 면 아예 발화하지 않는다
// (node_modules/phaser/src/input/keyboard/KeyboardManager.js:188). 즉 앞의 누군가가
// preventDefault 만 해도 EditScene 은 그 Esc 를 **보지 못한다** — 이것이 "마지막 소비자"
// 성질의 근거이고, 아래 4단이 그 성질이 새는 유일한 구멍이다.
//
//  1. document capture 리스너 (전부 preventDefault + stopPropagation → 여기서 끝난다)
//     - src/editor/ui/modalStack.ts:25,33      최상위 모달 한 겹 닫기 (registerModal 사용자 전부)
//     - src/editor/panels/eventEditor/customSelect.ts:512   열린 커스텀 셀렉트
//     - src/editor/panels/tilesetTileContextMenu.ts:140,309
//     - src/editor/panels/structureKitEditorDialog.ts:611
//     - src/editor/panels/databaseEnemyRecordSupport.ts:193, databaseEnemyRecordView.ts:1054
//     - src/editor/panels/databaseCinematicPreview.ts:100
//  2. 요소 스코프 리스너 — 포커스가 그 요소 안에 있을 때만 온다. 모달 카드/백드롭/메뉴/입력창
//     (eventEditor/modal.ts:352, menu.ts:589, mapContextMenu.ts:66, commandPalette.ts:121,
//      resourceModal.ts:75, subdialog.ts:70, … 전부 preventDefault)
//  3. document bubble 리스너 — preventDefault 하는 쪽 (역시 여기서 끝난다)
//     - src/editor/panels/menu.ts:622            상단 메뉴 팝업
//     - src/editor/panels/tileToolbarMenus.ts:84 툴바 드롭다운
//     - src/editor/panels/sidebarSurface.ts:59   사이드바 서피스
//     - src/editor/panels/regionTaskModal.ts:2182 영역 작업 창
//     - src/editor/panels/testPlayModal.ts:468, clusterAiModal.ts:373,
//       tilesetAiWorkspaceModal.ts:51, aiChangePreview.ts:272(카드 경로)
//  4. document bubble 리스너 — **preventDefault 를 하지 않는** 쪽. 함정은 여기다: 이들은
//     Esc 를 소비해 자기 표면을 닫으면서도 이벤트에 표시를 남기지 않아, 같은 Esc 가
//     EditScene 까지 그대로 흘러온다(한 번 눌러 두 가지가 일어난다). ESCAPE_OWNER_SELECTORS
//     가 그 표면들을 DOM 으로 되짚어 화면 밀기 전환을 양보하는 이유다.
//     - src/editor/panels/basicLeftRail.ts:106   기본 모드 레일 플라이아웃
//     - src/editor/panels/aiHarnessModal.ts:333  ┐
//     - src/editor/panels/toolBrowserModal.ts:246 ├ 셋 다 .database-modal-backdrop
//     - src/editor/panels/villageInfoModal.ts:80 ┘
//     - src/editor/panels/aiChangePreview.ts:272 변경 비교 오버레이(.ai-change-wide)
//     - src/editor/panels/aiComposer.ts:478      조수 컴포저 팝오버 3종
//     - src/editor/panels/aiChatPanel.ts:2157    ☰ 더보기 메뉴
//  5. src/editor/EditScene.ts:1089 → EditScene.handleEscapeKey() → 이 모듈. **마지막 소비자.**
//     그 앞 src/editor/hotkeys.ts:51 shouldIgnoreEditorShortcut 가 텍스트 포커스와
//     데이터베이스/리소스/월드/이벤트 에디터 모달을 이미 걷어낸다.
//
// 규칙: Esc 를 소비하는 새 표면을 만들면 **반드시 preventDefault 를 부르거나**(권장,
// 그러면 이 모듈을 건드릴 필요가 없다) 4단 목록과 ESCAPE_OWNER_SELECTORS 에 함께 추가한다.

import { editorState } from "@/editor/editorState";

/**
 * 4단(preventDefault 를 하지 않는 Esc 소비자)이 지금 화면에 떠 있는지 되짚는 선택자.
 * 각 항목은 위 목록의 한 줄과 1:1 대응한다 — 짝 없는 선택자를 늘리지 말 것.
 */
const ESCAPE_OWNER_SELECTORS: readonly string[] = [
  '[data-testid="basic-rail-flyout"]',
  ".database-modal-backdrop",
  '[data-testid="ai-change-wide"]',
  // 팝오버/메뉴는 DOM 에 남아 있고 `hidden` 으로만 닫힌다 — 존재가 아니라 보임을 봐야 한다.
  ".ai-composer-popover:not([hidden])",
  ".ai-more-menu:not([hidden])",
];

/** 지금 Esc 를 소유한 4단 표면이 있는가 — 있으면 화면 밀기 전환을 양보한다. */
export function escapeOwnedByTransientSurface(): boolean {
  if (typeof document === "undefined" || typeof document.querySelector !== "function") return false;
  return ESCAPE_OWNER_SELECTORS.some((selector) => document.querySelector(selector) !== null);
}

/** EditScene 까지 내려온 Esc 를 무엇이 가져가는가. 배열 순서가 곧 우선순위다. */
export type EscapeAction =
  /** 다른 표면이 소유자다. EditScene 은 아무것도 하지 않고 소비하지도 않는다. */
  | "defer-to-owner"
  | "cancel-paste-preview"
  | "clear-selection"
  /** 아무도 가져가지 않았다 → 기존 「화면 밀기」 도구를 켠다. */
  | "enter-pan"
  /** 이미 화면 밀기다. 두 번째 Esc 를 조용히 삼키지 않는다(도구 복귀는 툴바·숫자키의 몫). */
  | "none";

export type EscapeSurfaceState = {
  /** 영역 작업 창은 비모달이라 포커스가 캔버스에 있어도 Esc 가 EditScene 까지 온다. */
  readonly regionTaskModalOpen: boolean;
  /** modalStack 에 등록된 계층(모달·컨텍스트 메뉴)이 살아 있다. */
  readonly modalLayerOpen: boolean;
  /** 4단 표면 — escapeOwnedByTransientSurface() 의 결과. */
  readonly transientOwnerOpen: boolean;
  readonly pastePreviewActive: boolean;
  readonly selectionActive: boolean;
  readonly panToolActive: boolean;
};

/**
 * Esc 소유권 판정. 순수 함수로 두는 이유: 실제 사슬(캡처/버블 + Phaser 가드)은 단위
 * 테스트로 재현하기 어렵지만, **순서**는 회귀가 나는 지점이고 순서만은 고정할 수 있다.
 */
export function resolveEscapeAction(state: EscapeSurfaceState): EscapeAction {
  if (state.regionTaskModalOpen) return "defer-to-owner";
  if (state.modalLayerOpen) return "defer-to-owner";
  if (state.transientOwnerOpen) return "defer-to-owner";
  if (state.pastePreviewActive) return "cancel-paste-preview";
  if (state.selectionActive) return "clear-selection";
  if (state.panToolActive) return "none";
  return "enter-pan";
}

/**
 * 기존 「화면 밀기」 도구를 켠다 — 두 번째 팬 구현을 만들지 않는다.
 * `tool === "pan"` 하나로 CameraPanController.shouldPan(=좌클릭 드래그 팬),
 * body[data-editor-tool="pan"] 커서(grab), 툴바 aria-pressed, 사이드바 상태 배지가 함께 켜진다.
 *
 * panels/tileToolbarActions.selectMapModeTool("pan") 을 쓰지 않는 이유: 그 경로는
 * `layer === "event"` 를 "lower" 로 되돌리고 activePaletteStamp 를 지운다. Esc 는 **화면을
 * 밀겠다**는 뜻이지 레이어를 나가거나 들고 있던 도장을 버리겠다는 뜻이 아니다.
 */
export function enterPanTool(): void {
  editorState.set({ tool: "pan" });
}
