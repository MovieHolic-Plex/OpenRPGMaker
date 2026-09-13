// 확인/경고 모달이 떠 있는데도 에디터 단축키가 그 뒤에서 발동했다.
//
// 회귀 배경: hotkeys.ts 의 가드가 알고 있는 모달 셀렉터는 .oprn-modal / .modal-backdrop
// 뿐이었고, 공용 confirm·alert·prompt 가 쓰는 .app-modal-overlay 는 목록에 없었다
// (modal.ts:61/179, aiGateModal.ts:65, persistenceRecoveryUi.ts:111 등이 이 클래스를 쓴다).
// 그래서 맵 삭제 확인창이 떠 있는 상태에서 도구 키(F키·숫자)·Delete 가 배경 편집기에
// 적용되고, Ctrl+Z 는 가드보다 먼저 처리되어(EditScene.handleKeyDown) 프로젝트를 바꿨다.
//
// 이 파일은 두 가드를 각각 잠근다:
//  1) shouldIgnoreEditorShortcut — .app-modal-overlay 소유권 인식
//  2) historyHotkeyOwnedByPanel  — 모달 계층이 살아 있으면 히스토리 키 소유권 양보
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleHistoryHotkey, historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { registerModal, resetModalStackForTest, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  resetModalStackForTest();
  restoreDom?.();
  restoreDom = undefined;
});

function keyEvent(key: string, target: unknown, opts: { ctrl?: boolean } = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: Boolean(opts.ctrl),
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

function overlayWithButton(): { overlay: HTMLElement; button: HTMLElement } {
  const overlay = el("div", { class: "app-modal-overlay" });
  const button = el("button", { text: "삭제" });
  overlay.append(button);
  document.body.append(overlay);
  return { overlay, button };
}

describe("에디터 단축키는 .app-modal-overlay 뒤에서 발동하지 않는다", () => {
  it("확인 모달 안의 버튼에 포커스가 있으면 도구 키를 무시한다", () => {
    const { button } = overlayWithButton();

    expect(shouldIgnoreEditorShortcut(keyEvent("F5", button))).toBe(true);
    expect(shouldIgnoreEditorShortcut(keyEvent("2", button))).toBe(true);
    expect(shouldIgnoreEditorShortcut(keyEvent("Delete", button))).toBe(true);
  });

  it("모달이 없으면 같은 키를 막지 않는다(과차단 방지)", () => {
    const plain = el("button", { text: "일반" });
    document.body.append(plain);

    expect(shouldIgnoreEditorShortcut(keyEvent("F5", plain))).toBe(false);
  });
});

describe("히스토리 단축키는 열린 모달 계층에 소유권을 양보한다", () => {
  it("모달이 등록되어 있으면 Ctrl+Z 를 에디터가 가져가지 않는다", () => {
    expect(historyHotkeyOwnedByPanel()).toBe(false);

    const { overlay } = overlayWithButton();
    const close = registerModal(overlay, () => {});

    expect(historyHotkeyOwnedByPanel()).toBe(true);
    expect(handleHistoryHotkey(keyEvent("z", overlay, { ctrl: true }))).toBe(false);

    close();
    unregisterModal(overlay);
    expect(historyHotkeyOwnedByPanel()).toBe(false);
  });
});
