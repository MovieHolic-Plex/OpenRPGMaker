// AI 채팅 패널 메타 진입점 도달성 회귀.
//
// 왜 이 파일이 필요한가 (실측, 2026-08-30 test/e2e/_aichat-bug-hunt):
// 기본 도크(glass, DEFAULT_CHAT_DOCK)와 side 에서 `.ai-command-menu-toggle` 이
// `display:none` 이었다 — rect 0x0. float 만 30x30. ☰ 는 aiComposer 의 문서가 말하는
// **유일한 메타 진입점**이고(헤더는 2026-08-28 에 제거됐다), 그 안에 되돌리기·내보내기·
// 도크 전환·전체 기록·툴 브라우저·가르치기 3종·설정이 들어 있다. 즉 기본 상태에서 그
// 전부가 도달 불가였고, side 로 들어가면 `.ai-dock-mode-btn`(숨은 훅 컨테이너 안)도 없어
// 도크를 되돌릴 수단조차 없었다.
//
// 여기서는 두 층을 함께 못박는다: (1) CSS 가 ☰ 를 다시 숨기지 못한다, (2) 세 도크 모두에서
// 메뉴 항목이 패널 DOM 에 실재한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { DEFAULT_CHAT_DOCK, type ChatDock } from "@/editor/chatDock";
import { clearConversations } from "@/ai/conversationStore";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const DOCK_CSS = path.resolve("src/styles/database/tabs-b-assistant-panel/02-chat-dock.css");

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
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
  clearConversations();
});

afterEach(() => {
  teardownAiChatPanel();
  clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(dock: ChatDock): FakeElement {
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test" }));
  return renderAiChatPanel({ clock: () => 1_000, getChatDock: () => dock }) as unknown as FakeElement;
}

describe("☰ 메타 메뉴는 어느 도크에서도 숨지 않는다", () => {
  it("기본 도크는 glass 다 — 여기서 메뉴가 숨으면 기본 상태의 메타 기능 전부가 사라진다", () => {
    expect(DEFAULT_CHAT_DOCK).toBe("glass");
  });

  it("02-chat-dock.css 의 어떤 display:none 블록도 .ai-command-menu-toggle 을 겨냥하지 않는다", () => {
    const css = readFileSync(DOCK_CSS, "utf8");
    const hidingBlocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/gu)].filter(([, , body]) =>
      /display\s*:\s*none/u.test(body)
    );
    const offenders = hidingBlocks
      .map(([, selector]) => selector.replace(/\/\*[\s\S]*?\*\//gu, "").trim())
      .filter((selector) => selector.includes(".ai-command-menu-toggle"));
    expect(offenders).toEqual([]);
  });

  it.each(["glass", "side", "float"] as const)("%s 도크에서도 메뉴 토글과 항목이 패널에 있다", (dock) => {
    const panel = renderPanel(dock);
    expect(findByTestId(panel, "ai-command-menu-toggle")).toBeTruthy();
    for (const testid of [
      "ai-command-menu-new-chat",
      "ai-command-menu-undo",
      "ai-command-menu-export",
      "ai-command-menu-dock",
      "ai-command-menu-tools",
      "ai-settings-toggle",
      "ai-command-menu-interview",
      "ai-command-menu-learn-structure",
      "ai-command-menu-demo-teach",
    ]) {
      expect(findByTestId(panel, testid), `${dock}/${testid}`).toBeTruthy();
    }
  });
});

describe("설정 진입점", () => {
  it("☰ 의 설정 항목은 aria-label 을 갖고 전용 설정 모달을 연다", () => {
    const panel = renderPanel("glass");
    const settings = findByTestId(panel, "ai-settings-toggle") as unknown as FakeElement;
    expect(settings.getAttribute("aria-label")).toBe("AI 설정 열기");
    settings.click();
    expect(findByTestId(document.body as unknown as FakeElement, "ai-settings-modal")).toBeTruthy();
  });
});
