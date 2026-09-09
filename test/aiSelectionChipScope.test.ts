// 선택 칩을 × 로 해제하면 그 턴의 스코프도 사라져야 한다 — 2026-09-03 적대적 리뷰 13(해제 뒤에도 옛 영역 안에만 시공).
// 대기 상태에서도 선택 칩은 보인다. 힌트 CSS 는 14-assistant-ux-repair 가 아니라 현재 데크 경로다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;
let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
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
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    authMode: "apiKey",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    agentMode: "chat",
  }));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  resetMapEditHistory();
  editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
  harness = installAdmitClient();
});

afterEach(() => {
  teardownAiChatPanel();
  editorState.set({ selection: null });
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("선택 칩 해제와 턴 스코프", () => {
  it("× 로 해제한 뒤 보내면 세션 스코프가 null 이고 영역 실행부를 타지 않는다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    expect(findByTestId(panel, "ai-selection-chip")).toBeTruthy();
    (findByTestId(panel, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(findByTestId(panel, "ai-selection-chip")).toBeFalsy();

    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "나무 세 그루 심어줘";
    const pending = harness.nextAdmitted();
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    const admitted = await pending;
    expect(admitted.input.family).toBe("assistant");
    expect(admitted.input.payload.selection).toBeUndefined();
    const turn = admitted.input.payload.turn as { scope?: unknown } | undefined;
    expect(turn?.scope ?? null).toBeNull();
    expect(String(admitted.input.payload.instruction)).not.toContain("사용자 선택 영역");
  });

  it("칩이 살아 있으면 영역 실행부로 간다(대조군)", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "여기 물 채워줘";
    const pending = harness.nextAdmitted();
    (findByTestId(panel, "ai-send") as unknown as HTMLElement).click();
    const admitted = await pending;
    expect(admitted.input.family).toBe("region");
    expect(admitted.input.target).toMatchObject({ mapId, region: { x: 2, y: 2, width: 4, height: 4 } });
  });
});

describe("대기 상태에서도 선택 칩은 보인다", () => {
  it("선택 칩이 붙으면 칩 호스트에 has-selection-scope 가 서고, 해제하면 내려간다", () => {
    const panel = renderAiChatPanel() as unknown as FakeElement;
    const mapId = store.getCurrent().startMapId;
    const host = findByTestId(panel, "ai-context-chips") as unknown as HTMLElement;
    expect(host.classList.contains("has-selection-scope")).toBe(false);
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(host.classList.contains("has-selection-scope")).toBe(true);
    (findByTestId(panel, "ai-selection-chip-clear") as unknown as HTMLElement).click();
    expect(host.classList.contains("has-selection-scope")).toBe(false);
  });

  it("idle 패널에서 has-selection-scope 칩 호스트의 사용 display 는 none 이 아니다", () => {
    const css = readFileSync(resolve("src/styles/database/tabs-b-assistant-panel/12-assistant-temperature.css"), "utf8");
    const window = new Window();
    try {
      const doc = window.document;
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.append(style);
      const panel = doc.createElement("aside");
      panel.className = "ai-chat-panel is-assistant-idle";
      const plain = doc.createElement("div");
      plain.className = "ai-context-chips";
      const scoped = doc.createElement("div");
      scoped.className = "ai-context-chips has-selection-scope";
      panel.append(plain, scoped);
      doc.body.append(panel);
      expect(window.getComputedStyle(scoped).display).not.toBe("none");
    } finally {
      window.close();
    }
  });
});

describe("컴포저 힌트는 숨을 때 자리를 비운다", () => {
  it("14-assistant-ux-repair 는 없고, 남은 힌트 규칙은 display:none 이다", () => {
    expect(existsSync(resolve("src/styles/database/tabs-b-assistant-panel/14-assistant-ux-repair.css"))).toBe(false);
    const composer = readFileSync(resolve("src/styles/database/assistant-composer.css"), "utf8");
    expect(composer).toContain("키 힌트(.ai-composer-hint)는 2026-09-03 에 걷었다");
    const studio = readFileSync(resolve("src/styles/database/tabs-b-assistant-panel/08-studio-mode-start-screen.css"), "utf8");
    const window = new Window();
    try {
      const doc = window.document;
      const style = doc.createElement("style");
      style.textContent = studio;
      doc.head.append(style);
      const panel = doc.createElement("aside");
      panel.className = "ai-chat-panel chat-dock-float is-studio";
      const hint = doc.createElement("span");
      hint.className = "ai-composer-hint";
      panel.append(hint);
      doc.body.append(panel);
      expect(window.getComputedStyle(hint).display).toBe("none");
    } finally {
      window.close();
    }
  });
});
