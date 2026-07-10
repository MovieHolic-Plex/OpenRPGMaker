import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleHistoryHotkey, isTextEditingFocus } from "@/editor/hotkeys";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

// P11-C: isTextEditingFocus 가 INPUT 이면 무조건 true 를 반환해 체크박스 토글 직후
// Ctrl+Z 가 씹히던 결함 회귀 방지. 텍스트형 input 만 브라우저 텍스트 undo 에 양보한다.
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function inputTarget(type: string | null): FakeElement {
  const input = new FakeElement("input");
  if (type !== null) input.setAttribute("type", type);
  return input;
}

function ctrlZ(target: unknown): { event: KeyboardEvent; prevented: () => boolean } {
  let prevented = false;
  const event = {
    key: "z",
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as KeyboardEvent;
  return { event, prevented: () => prevented };
}

describe("isTextEditingFocus input type discrimination (P11-C)", () => {
  it("treats checkbox/radio/range/button-like inputs as NOT text editing", () => {
    for (const type of ["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image", "hidden"]) {
      const { event } = ctrlZ(inputTarget(type));
      expect(isTextEditingFocus(event), `type=${type}`).toBe(false);
    }
  });

  it("keeps text-like inputs, textarea, select and contentEditable as text editing", () => {
    for (const type of ["text", "number", "search", "password", "email", "url", "tel"]) {
      const { event } = ctrlZ(inputTarget(type));
      expect(isTextEditingFocus(event), `type=${type}`).toBe(true);
    }
    // type 속성이 없는 input 은 브라우저 기본이 text — 텍스트 편집으로 취급.
    expect(isTextEditingFocus(ctrlZ(inputTarget(null)).event)).toBe(true);
    expect(isTextEditingFocus(ctrlZ(new FakeElement("textarea")).event)).toBe(true);
    expect(isTextEditingFocus(ctrlZ(new FakeElement("select")).event)).toBe(true);
    const editable = new FakeElement("div");
    editable.isContentEditable = true;
    expect(isTextEditingFocus(ctrlZ(editable).event)).toBe(true);
  });
});

describe("handleHistoryHotkey with non-text focus (P11-C)", () => {
  it("processes Ctrl+Z when a checkbox has focus (preventDefault called)", () => {
    const { event, prevented } = ctrlZ(inputTarget("checkbox"));
    handleHistoryHotkey(event);
    expect(prevented()).toBe(true);
  });

  it("still yields to browser text undo when a text input has focus", () => {
    const { event, prevented } = ctrlZ(inputTarget("text"));
    expect(handleHistoryHotkey(event)).toBe(false);
    expect(prevented()).toBe(false);
  });
});
