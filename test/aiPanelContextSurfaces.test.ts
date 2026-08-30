// test/aiPanelContextSurfaces.test.ts
// 패널에 새로 붙은 진입점들이 **실제로 화면에 있는지** 확인한다.
//
// 왜 이 테스트인가: 이 기능들의 엔진은 전부 이미 있었다(압축·대화 저장/로드·되돌리기 마커).
// 없던 것은 누를 곳이었다 — `loadConversation` 은 호출 지점이 0 인 죽은 코드였다. 그래서
// 여기서 잠그는 것은 로직이 아니라 **표면의 존재**다: 게이지 버튼 1개, 팝오버 1개,
// ☰ 메뉴 항목 3개(이전 대화 · 맥락 압축 · 감독 지침), 그리고 사용자 버블의 되감기 버튼.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
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

function renderPanel(): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000, getChatDock: () => "glass" }) as unknown as FakeElement;
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

describe("맥락 게이지가 컴포저 액션 행에 산다", () => {
  it("Given 패널 렌더 When 액션 행 확인 Then 게이지 버튼이 스크롤되는 칩들 앞에 있다", () => {
    const panel = renderPanel();

    const lead = findByTestId(panel, "ai-composer-actions")!.querySelector(".ai-composer-actions-lead")!;
    const order = lead.children.map((child) => (child as FakeElement).dataset.testid ?? "");
    expect(order).toContain("ai-context-meter");
    // 컨텍스트 칩보다 앞이어야 한다 — lead 는 overflow-x:auto 라 뒤에 두면 좁은 도크에서
    // 꼬리표가 길어질 때 게이지가 스크롤 밖으로 밀려 사실상 사라진다.
    expect(order.indexOf("ai-context-meter")).toBeLessThan(order.indexOf("ai-context-chips"));
  });

  it("Given 세션 없음 When 게이지 확인 Then 0% 가 아니라 빗금으로 모른다고 말한다", () => {
    const panel = renderPanel();

    const meter = findByTestId(panel, "ai-context-meter")!;
    expect(meter.textContent).toBe("맥락 —");
    expect(meter.dataset.tone).toBe("idle");
  });

  it("Given 게이지 클릭 When 팝오버 Then 열리고 다시 누르면 닫힌다(전면 투명 레이어 없음)", () => {
    const panel = renderPanel();
    const meter = findByTestId(panel, "ai-context-meter")!;
    const popover = findByTestId(panel, "ai-context-panel")!;

    expect(popover.hidden).toBe(true);

    (meter as unknown as HTMLElement).click();
    expect(popover.hidden).toBe(false);
    expect(meter.getAttribute("aria-expanded")).toBe("true");

    (meter as unknown as HTMLElement).click();
    expect(popover.hidden).toBe(true);
  });

  it("Given 게이지 팝오버 열림 When ☰ 클릭 Then 게이지 쪽이 닫힌다(팝오버는 배타적이다)", () => {
    const panel = renderPanel();
    const contextPopover = findByTestId(panel, "ai-context-panel")!;
    const menu = findByTestId(panel, "ai-command-menu")!;

    (findByTestId(panel, "ai-context-meter") as unknown as HTMLElement).click();
    expect(contextPopover.hidden).toBe(false);

    (findByTestId(panel, "ai-command-menu-toggle") as unknown as HTMLElement).click();
    expect(contextPopover.hidden).toBe(true);
    expect(menu.hidden).toBe(false);
  });
});

describe("☰ 메뉴의 새 항목 3개", () => {
  it("Given 컴포저 ☰ When 항목 확인 Then 이전 대화·맥락 압축·감독 지침이 있다", () => {
    const panel = renderPanel();

    const menu = findByTestId(panel, "ai-command-menu")!;
    expect(findByTestId(menu, "ai-command-menu-conversations")!.textContent).toBe("이전 대화");
    expect(findByTestId(menu, "ai-command-menu-compact")!.textContent).toBe("맥락 압축");
    expect(findByTestId(menu, "ai-command-menu-instructions")!.textContent).toBe("감독 지침");
  });

  it("Given 헤더 ☰ When 항목 확인 Then 같은 3개가 legacy testid 로도 있다", () => {
    const panel = renderPanel();

    expect(findByTestId(panel, "ai-more-conversations")).not.toBeNull();
    expect(findByTestId(panel, "ai-more-compact")).not.toBeNull();
    expect(findByTestId(panel, "ai-more-instructions")).not.toBeNull();
  });

  it("Given 이전 대화 항목 클릭 When 모달 Then 대화 목록이 열린다(죽은 코드였던 경로)", () => {
    const panel = renderPanel();

    (findByTestId(panel, "ai-command-menu-conversations") as unknown as HTMLElement).click();

    const body = globalThis.document.body as unknown as FakeElement;
    const modal = findByTestId(body, "ai-history-modal");
    expect(modal).not.toBeNull();
    (findByTestId(modal!, "ai-history-close") as unknown as HTMLElement).click();
  });

  it("Given 감독 지침 항목 클릭 When 모달 Then 지침 편집창이 열린다", () => {
    const panel = renderPanel();

    (findByTestId(panel, "ai-command-menu-instructions") as unknown as HTMLElement).click();

    const body = globalThis.document.body as unknown as FakeElement;
    const modal = findByTestId(body, "ai-instructions-modal");
    expect(modal).not.toBeNull();
    (findByTestId(modal!, "ai-instructions-close") as unknown as HTMLElement).click();
  });
});

describe("턴 되감기 버튼", () => {
  it("Given 지시 전송 When 사용자 버블 Then 「여기서 다시」가 그 버블에 붙는다", async () => {
    // 전송 경로를 통과시키려면 설정이 갖춰져 있어야 한다(미설정이면 설정 모달로 빠진다).
    storage.set(
      AI_CONFIG_STORAGE_KEY,
      JSON.stringify({ ...defaultAiConfig(), authMode: "apiKey", baseUrl: "https://example.invalid/v1", apiKey: "sk-test" }),
    );
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement & FakeElement;
    input.value = "마을 입구에 우물을 놔줘";
    input.dispatchEvent(new Event("input"));

    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();

    // 버블과 되감기 버튼은 요청을 기다리지 않고 즉시 붙는다(요청은 이 환경에서 실패한다).
    const bubble = findByTestId(panel, "ai-command-row-user")!;
    expect(bubble.textContent).toContain("우물");
    const rewind = findByTestId(bubble, "ai-turn-rewind");
    expect(rewind).not.toBeNull();
    expect(rewind!.textContent).toBe("여기서 다시");

    // 시작된 턴은 이 환경에서 전송 단계에서 실패한다. 정산(finally)까지 가짜 DOM 안에서
    // 끝내 준다 — 해체 뒤에 정산이 돌면 document 없는 상태의 미처리 거부로 남는다.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
