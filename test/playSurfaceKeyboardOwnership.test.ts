// @vitest-environment jsdom
//
// 플레이 서피스가 떠 있는 동안 키보드가 **게임의 것**이라는 계약.
//
// 왜 이 테스트가 있나 (2026-08-30 실측 결함):
// 편집 Phaser 게임은 테스트 플레이 창 뒤에서 계속 살아 있고(`testPlayModal.ts` 는
// `trackGlobalGame: false` 로 플레이 게임을 별도 소유한다), Phaser 키보드 플러그인은
// `window` 를 듣는다. 그래서 게임에서 걸으려고 누른 방향키가 `EditScene.panWithArrowKey`
// 로도 들어가 편집 카메라를 한 번에 6타일(Shift 16타일) 밀어냈다. 플레이를 조금 하다
// 창을 닫으면 편집 캔버스가 맵 밖으로 밀려 사용자에게는 "테스트 끝내고 오니 맵이
// 사라졌다" 로 보였다 — 실브라우저에서 방향키 24+12회 뒤 편집 카메라 scrollX 가
// 323→1123 으로 밀려 100×100 맵이 우하단 모서리 조각만 남는 것을 확인했다.
// 방향키뿐이 아니다 — 1~7 도구, F5~F7 레이어, +/- 줌, Ctrl+Z 되돌리기가 전부 같은 경로다.
//
// 소유권 판정은 DOM 으로 한다: `.test-play-modal-backdrop`(openTestPlayShell 을 지나는
// 모든 테스트 셸) 또는 `.player-layout`(renderPlayer 가 마운트하는 플레이 셸, 모달 없는
// 전역 플레이 포함) 중 하나라도 문서에 있으면 편집기 단축키 경로 전부가 침묵한다.
//
// 수정 지점은 `hotkeys.ts` 한 곳이다. `shouldIgnoreEditorShortcut` 이 소유권을 소비하고,
// 히스토리 키(Ctrl+Z/Y)는 `historyHotkeyOwnedByPanel()` 이 넘긴다 — EditScene 은 히스토리
// 키를 일반 가드보다 반드시 먼저 처리하기 때문이다(체크박스 포커스가 되돌리기를 삼키던
// 결함 대응). 그 둘이면 EditScene 은 한 줄도 수정하지 않아도 된다.
// (Phaser 씬을 띄우지 않으므로 타이밍 요소가 없다.)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handleEditorKey,
  historyHotkeyOwnedByPanel,
  isPlaySurfaceOwningKeyboard,
  shouldIgnoreEditorShortcut,
} from "@/editor/hotkeys";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";

function keyEvent(key: string, target: EventTarget | null = document.body): KeyboardEvent {
  return {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

/** openTestPlayShell 이 만드는 백드롭 — 시연 실행·이벤트 테스트·전투 테스트가 공유한다. */
function mountTestPlayBackdrop(): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "test-play-modal-backdrop";
  backdrop.dataset.testid = "test-play-modal-backdrop";
  document.body.append(backdrop);
  return backdrop;
}

/** renderPlayer 가 마운트하는 플레이 셸 — 모달 없는 전역 플레이(enterMode("play")) 경로. */
function mountPlayerLayout(): HTMLElement {
  const layout = document.createElement("div");
  layout.className = "player-layout system-shell";
  document.body.append(layout);
  return layout;
}

describe("플레이 서피스가 열려 있으면 편집기 키보드 단축키가 침묵한다", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", zoom: 2 });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("플레이 서피스가 없으면 소유권은 편집기에 있다", () => {
    expect(isPlaySurfaceOwningKeyboard()).toBe(false);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(false);
    expect(historyHotkeyOwnedByPanel()).toBe(false);
  });

  it("테스트 플레이 백드롭이 붙으면 소유권이 게임으로 넘어간다", () => {
    mountTestPlayBackdrop();
    expect(isPlaySurfaceOwningKeyboard()).toBe(true);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(true);
  });

  it("백드롭이 떨어지면 편집기가 소유권을 되찾는다", () => {
    const backdrop = mountTestPlayBackdrop();
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(true);
    backdrop.remove();
    expect(isPlaySurfaceOwningKeyboard()).toBe(false);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(false);
  });

  it("창이 열려 있는 동안 게임 키가 도구·레이어를 바꾸지 않는다", () => {
    mountTestPlayBackdrop();
    // 1~7 = 도구, F5~F7 = 레이어. 게임에서 흔히 누르는 키들이다.
    for (const key of ["1", "2", "3", "F6", "F7"]) {
      expect(handleEditorKey(keyEvent(key))).toBe(false);
    }
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().layer).toBe("lower");
  });

  it("창을 닫으면 같은 키가 다시 편집기 도구를 바꾼다", () => {
    const backdrop = mountTestPlayBackdrop();
    expect(handleEditorKey(keyEvent("F6"))).toBe(false);
    backdrop.remove();
    expect(handleEditorKey(keyEvent("F6"))).toBe(true);
    expect(editorState.get().layer).toBe("upper");
  });

  it("게임 화면 안쪽 노드가 이벤트 타깃이어도 침묵한다", () => {
    const backdrop = mountTestPlayBackdrop();
    const canvas = document.createElement("canvas");
    backdrop.append(canvas);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowDown", canvas))).toBe(true);
  });

  it("모달 없는 전역 플레이 셸만 있어도 소유권은 게임에 있다", () => {
    // 지금 enterMode("play") 는 teardownEditor() 로 편집 게임을 파괴하므로 새지 않지만,
    // 소유권 판정이 모달 하나의 생산 관례에 업혀 있으면 안 된다.
    const layout = mountPlayerLayout();
    expect(isPlaySurfaceOwningKeyboard()).toBe(true);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(true);
    layout.remove();
    expect(isPlaySurfaceOwningKeyboard()).toBe(false);
  });

  it("전투 테스트 셸은 renderPlayer 를 안 거치므로 백드롭만으로 잡힌다", () => {
    // mountBattleScene 직통 경로는 .player-layout 을 만들지 않는다.
    mountTestPlayBackdrop();
    expect(document.querySelector(".player-layout")).toBeNull();
    expect(isPlaySurfaceOwningKeyboard()).toBe(true);
  });

  it("창이 떠 있는 동안 Ctrl+Z 되돌리기는 편집기의 것이 아니다", () => {
    expect(historyHotkeyOwnedByPanel()).toBe(false);
    const backdrop = mountTestPlayBackdrop();
    // EditScene.handleKeyDown 은 historyHotkeyOwnedByPanel() 이 true 면 히스토리 키를
    // 포기하고 shouldIgnoreEditorShortcut 로 내려가 전적으로 침묵한다.
    expect(historyHotkeyOwnedByPanel()).toBe(true);
    expect(shouldIgnoreEditorShortcut(keyEvent("z"))).toBe(true);
    backdrop.remove();
    expect(historyHotkeyOwnedByPanel()).toBe(false);
  });
});
