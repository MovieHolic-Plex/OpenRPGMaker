// 컴포저 입력 경로 UX 회귀 (감독 지시 2026-08-25: "명령어 입력하면 UX 가 너무 구림").
//
// 실측한 결함 3개:
//  E1) `ai-send` 는 turnBusy 일 때만 disabled 였다. 빈 입력에서도 준비된 것처럼 보이고
//      누르면 `send()` 가 `if (!text) return` 으로 조용히 끝났다 — 피드백 0.
//      이제 준비 여부는 aria-disabled + `is-not-ready` 로 말한다. 진짜 `disabled` 는
//      쓰지 않는다: disabled 버튼은 tab 순서에서 버려지고(aiPanelChrome 탭 순서 계약이
//      이걸 직접 잡는다) 왜 못 보내는지 설명도 못 한다. 진짜 disabled 는 턴 진행 중에만.
//  E3) "Enter 전송 · Shift+Enter 줄바꿈" 힌트가 액션 행을 영구 점유했다(실측 160x15).
//      포커스 중에만 보여야 하고, 바 높이 = f(textarea 줄 수) 불변식을 지키려면
//      display 가 아니라 visibility 로 숨겨야 한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function renderPanel(dock: "glass" | "side" | "float" = "glass"): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000}) as unknown as FakeElement;
}

function typeInto(input: HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("E1 전송 버튼은 보낼 게 있을 때만 준비된 상태", () => {
  it("빈 입력이면 미준비, 글자가 들어오면 준비, 지우면 다시 미준비", () => {
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

    expect(send.getAttribute("aria-disabled")).toBe("true");
    expect(send.className).toContain("is-not-ready");

    typeInto(input, "대장간 하나 지어줘");
    expect(send.getAttribute("aria-disabled")).toBe("false");
    expect(send.className).not.toContain("is-not-ready");

    typeInto(input, "");
    expect(send.getAttribute("aria-disabled")).toBe("true");
    expect(send.className).toContain("is-not-ready");
  });

  it("미준비 상태여도 초점·클릭은 살린다 — 진짜 disabled 로 만들지 않는다", () => {
    const panel = renderPanel();
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement & { disabled: boolean };

    expect(send.disabled).toBe(false);
  });

  it("공백만 입력한 경우도 보낼 게 없다고 본다", () => {
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

    typeInto(input, "   \n  ");
    expect(send.getAttribute("aria-disabled")).toBe("true");
  });

  it("왜 보낼 수 없는지 title 로 알려준다", () => {
    const panel = renderPanel();
    const send = findByTestId(panel, "ai-send") as unknown as FakeElement;

    expect(send.getAttribute("title")).toBe("보낼 지시를 입력하세요");
  });
});

describe("E3 힌트는 포커스 중에만", () => {
  it("포커스 전에는 액션 행에 포커스 표시가 없고, 포커스하면 붙고 blur 하면 떨어진다", () => {
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const actions = findByTestId(panel, "ai-composer-actions") as unknown as FakeElement;

    expect(actions.className).not.toContain("is-input-focused");

    input.dispatchEvent(new Event("focus"));
    expect(actions.className).toContain("is-input-focused");

    input.dispatchEvent(new Event("blur"));
    expect(actions.className).not.toContain("is-input-focused");
  });
});
