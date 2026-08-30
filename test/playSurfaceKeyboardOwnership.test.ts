// @vitest-environment jsdom
//
// 시연 실행(테스트 플레이) 창이 떠 있는 동안 키보드가 **게임의 것**이라는 계약.
//
// 왜 이 테스트가 있나 (2026-08-30 실측 결함):
// 편집 Phaser 게임은 테스트 플레이 창 뒤에서 계속 살아 있고, Phaser 키보드 플러그인은
// `window` 를 듣는다. 그래서 게임에서 걸으려고 누른 방향키가 EditScene 의
// `panWithArrowKey` 로도 들어가 편집 카메라를 한 번에 6타일(Shift 16타일) 밀어냈다.
// 플레이를 조금 하다 창을 닫으면 편집 캔버스가 맵 밖으로 밀려 사용자에게는
// "테스트 끝내고 오니 맵이 사라졌다" 로 보였다 — 방향키 24+12회 뒤 100×100 맵이
// 우하단 모서리 조각만 남는 것을 실브라우저에서 확인했다.
//
// 계약은 DOM 한 가지로 판정한다: `test-play-modal-backdrop` 이 문서에 있으면
// 편집기 단축키 경로 전부가 침묵한다. 이 파일은 그 판정과, 그것을 소비하는
// `shouldIgnoreEditorShortcut` / `handleEditorKey` 가 실제로 침묵하는지만 본다
// (Phaser 씬을 띄우지 않으므로 타이밍 요소가 없다).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  handleEditorKey,
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

function mountTestPlayBackdrop(): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "test-play-modal-backdrop";
  backdrop.dataset.testid = "test-play-modal-backdrop";
  document.body.append(backdrop);
  return backdrop;
}

describe("시연 실행 창이 열려 있으면 편집기 키보드 단축키가 침묵한다", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", zoom: 2 });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("백드롭이 없으면 소유권은 편집기에 있다", () => {
    expect(isPlaySurfaceOwningKeyboard()).toBe(false);
    expect(shouldIgnoreEditorShortcut(keyEvent("ArrowRight"))).toBe(false);
  });

  it("백드롭이 붙으면 소유권이 게임으로 넘어간다", () => {
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
});
