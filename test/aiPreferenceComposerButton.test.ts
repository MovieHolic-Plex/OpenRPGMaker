// test/aiPreferenceComposerButton.test.ts
// "AI 가 기억한 내 성향" 의 진입점이 **채팅 컴포저의 ⌾ 버튼** 이라는 계약 (2026-08-30 감독 지시).
//
// 왜 이 테스트가 있나: 성향은 대화에서 배우고 "기억했습니다" 알림도 채팅 버블로 뜬다. 확인·삭제가
// AI 설정 모달에 있으면 배운 자리와 고치는 자리가 갈라진다. 진입점이 설정 모달로 옮겨가거나
// (또는 양쪽에 중복되거나) 팝오버가 배타성을 잃으면 여기서 깨진다.
//
// 팝오버는 흐름 밖(absolute)이라는 것도 계약이다 — 컴포저 바 높이는 textarea 줄 수만
// 따라야 하고, 성향 목록이 흐름 안에 들어오면 열 때마다 바가 튀어 rising overlay 하단과
// 맵 여백까지 같이 흔들린다(assistant-composer.css 주석의 실측 근거).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { renderAiSettingsForm } from "@/editor/panels/aiSettingsModal";
import { editorState } from "@/editor/editorState";
import { savePreferenceFacts, type PreferenceFact } from "@/ai/preferenceMemory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

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

function fact(id: string, text: string, extra: Partial<PreferenceFact> = {}): PreferenceFact {
  return {
    id,
    text,
    scope: "global",
    strength: "medium",
    evidence: 2,
    source: "observed",
    updatedAt: 1_000,
    ...extra,
  };
}

// fakeDom 에는 KeyboardEvent 가 없다 — 기존 fakeDom 테스트와 같은 관례로 Event 에 key 를 심는다.
function keydown(key: string): Event {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  return event;
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

describe("성향 진입점은 컴포저의 ⌾ 버튼", () => {
  it("액션 행에 토글이 있고, 닫힌 팝오버가 컴포저 바의 자식으로 함께 있다", () => {
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle");
    const popover = findByTestId(panel, "ai-preference-popover");

    expect(toggle).not.toBeNull();
    expect(popover).not.toBeNull();
    expect(popover?.hidden).toBe(true);
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    // 상시 노출 버튼 줄 안에 있어야 한다 — 걷힌 헤더나 inert 툴바에 있으면 손이 닿지 않는다.
    expect(findByTestId(panel, "ai-composer-actions")?.contains(toggle!)).toBe(true);
  });

  it("스크린리더에 목적을 말한다 — ⌾ 글리프만으로는 읽히지 않는다", () => {
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle");

    expect(toggle?.getAttribute("aria-label")).toBe("AI 가 기억한 내 성향");
    expect(toggle?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(toggle?.getAttribute("title")).toContain("성향");
  });

  it("누르면 열리고 aria-expanded 가 따라오며, 다시 누르면 닫힌다", () => {
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle")!;
    const popover = findByTestId(panel, "ai-preference-popover")!;

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(popover.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.className).toContain("is-active");

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(popover.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.className).not.toContain("is-active");
  });

  it("성향 목록을 실제로 담는다 — 껍데기만 열리면 안 된다", () => {
    savePreferenceFacts([fact("p1", "마을은 집 4채 이하로 작게 유지한다")]);
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle")!;

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    const popover = findByTestId(panel, "ai-preference-popover")!;
    expect(findByTestId(popover, "ai-preference-settings")).not.toBeNull();
    expect(popover.querySelectorAll("[data-testid='ai-preference-row']")).toHaveLength(1);
  });

  it("열 때마다 목록을 다시 읽는다 — 대화 중 증류가 저장한 성향이 보여야 한다", () => {
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle")!;
    const popover = findByTestId(panel, "ai-preference-popover")!;

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(popover.querySelectorAll("[data-testid='ai-preference-row']")).toHaveLength(0);
    toggle.dispatchEvent(new Event("click", { bubbles: true }));

    // 턴이 돌면서 증류가 저장한 상황.
    savePreferenceFacts([fact("p2", "적은 항상 3마리 이하로 배치해 줘")]);

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(popover.querySelectorAll("[data-testid='ai-preference-row']")).toHaveLength(1);
  });
});

describe("팝오버 3종은 서로 배타적", () => {
  it("☰ 메뉴가 열려 있으면 ⌾ 를 누를 때 ☰ 가 닫힌다", () => {
    const panel = renderPanel();
    const menuToggle = findByTestId(panel, "ai-command-menu-toggle")!;
    const menu = findByTestId(panel, "ai-command-menu")!;
    const prefToggle = findByTestId(panel, "ai-preference-toggle")!;
    const prefPopover = findByTestId(panel, "ai-preference-popover")!;

    menuToggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(menu.hidden).toBe(false);

    prefToggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(prefPopover.hidden).toBe(false);
    expect(menu.hidden).toBe(true);
    expect(menuToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape 로 닫힌다", () => {
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle")!;
    const popover = findByTestId(panel, "ai-preference-popover")!;

    toggle.dispatchEvent(new Event("click", { bubbles: true }));
    expect(popover.hidden).toBe(false);

    document.dispatchEvent(keydown("Escape"));
    expect(popover.hidden).toBe(true);
  });

  it("바깥 클릭으로 닫히고, 안쪽 클릭으로는 닫히지 않는다", () => {
    savePreferenceFacts([fact("p1", "어둡고 음침한 분위기를 선호한다")]);
    const panel = renderPanel();
    const toggle = findByTestId(panel, "ai-preference-toggle")!;
    const popover = findByTestId(panel, "ai-preference-popover")!;

    toggle.dispatchEvent(new Event("click", { bubbles: true }));

    // 안쪽(고정 버튼)을 눌러도 열려 있어야 한다 — 한 항목 고정하고 다음 항목을 보려면
    // 팝오버가 살아 있어야 한다.
    findByTestId(popover, "ai-preference-pin")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(popover.hidden).toBe(false);

    // 부모 없는 요소는 fakeDom 에서 곧바로 document 로 버블한다(FakeNode.dispatchEvent).
    // 컴포저 바 밖이라는 사실만 필요하므로 붙일 자리는 중요하지 않다.
    const outside = document.createElement("div");
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(popover.hidden).toBe(true);
  });
});

describe("AI 설정 모달에는 더 이상 없다", () => {
  it("설정 폼이 성향 섹션을 렌더하지 않는다 — 진입점이 둘이면 어느 쪽이 정본인지 알 수 없다", () => {
    savePreferenceFacts([fact("p1", "마을은 집 4채 이하로 작게 유지한다")]);
    const form = renderWithFakeDom(() => renderAiSettingsForm({}).element);

    expect(findByTestId(form, "ai-preference-settings")).toBeNull();
    expect(findByTestId(form, "ai-preference-list")).toBeNull();
    // 로그인 설정은 그대로 있어야 한다 — 성향만 빼는 것이지 폼을 부순 게 아니다.
    expect(findByTestId(form, "ai-config")).not.toBeNull();
  });
});
