/** @vitest-environment happy-dom */
// 선택 칩을 × 로 해제하면 그 턴의 스코프도 사라져야 한다 — 2026-09-03 적대적 리뷰 13(해제 뒤에도 옛 영역 안에만 시공).
// 그리고 대기 상태(idle)에서도 선택 칩은 보여야 한다 — 스코프가 붙는지 사용자가 볼 수 있어야 × 를 누를 수 있다.
import { resolve } from "node:path";
import { preprocessCSS, resolveConfig } from "vite";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

let shippedCss: string;

beforeAll(async () => {
  // Preserve the shipped assistant import order, including the late shell constraints.
  // Unrelated runtime/database sheets make happy-dom's selector scans prohibitively slow.
  const filename = resolve("src/styles/index.css");
  const css = [
    '@import "./tokens.css";',
    '@import "./database/tabs-b-assistant-panel.css";',
    '@import "./shell/editor-ui-modes.css";',
  ].join("\n");
  const config = await resolveConfig({ configFile: false, envFile: false }, "serve", "test");
  shippedCss = (await preprocessCSS(css, filename, config)).code;
});

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  localStorage.clear();
  // The real panel runs, but neither model nor persistence may reach a network.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network disabled in selection UI tests")));
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", agentMode: "chat" }));
  editorState.set({ selection: null, currentMapId: store.getCurrent().startMapId });
});

afterEach(() => {
  teardownAiChatPanel();
  editorState.set({ selection: null });
  document.body.replaceChildren();
  document.head.replaceChildren();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderPanel(options: Parameters<typeof renderAiChatPanel>[0] = {}): HTMLElement {
  const style = document.createElement("style");
  style.textContent = shippedCss;
  document.head.append(style);
  const panel = renderAiChatPanel(options);
  document.body.append(panel);
  return panel;
}

function control<T extends HTMLElement = HTMLElement>(panel: HTMLElement, id: string): T {
  const node = panel.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control: ${id}`);
  return node;
}

async function sendAndFinish(panel: HTMLElement, text: string): Promise<void> {
  const input = control<HTMLTextAreaElement>(panel, "ai-input");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  let sawRunning = false;
  let cancel = () => {};
  const finished = new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver((records) => {
      const running = panel.classList.contains("is-turn-running");
      // oldValue also catches a complete transition delivered in one mutation batch.
      sawRunning ||= running || records.some((record) => record.oldValue?.split(/\s+/).includes("is-turn-running"));
      if (sawRunning && !running) resolve();
    });
    observer.observe(panel, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
    const timeout = setTimeout(() => reject(new Error("Panel did not finish a running turn")), 2000);
    cancel = () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  });
  try {
    control<HTMLButtonElement>(panel, "ai-send").click();
    await finished;
  } finally {
    cancel();
  }
}

describe("선택 칩 해제와 턴 스코프", () => {
  it("× 로 해제한 뒤 보내면 세션 스코프가 null 이고 영역 실행부를 타지 않는다", async () => {
    const sendSpy = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue({
      assistantText: "",
      proposedCalls: [],
      stoppedReason: "final",
    });
    const regionRunner = vi.fn();
    const panel = renderPanel({ regionTaskRunner: regionRunner });
    const mapId = store.getCurrent().startMapId;
    const selection = { mapId, x: 2, y: 2, width: 4, height: 4 };
    editorState.set({ selection });
    expect(control(panel, "ai-selection-chip").isConnected).toBe(true);
    control<HTMLButtonElement>(panel, "ai-selection-chip-clear").click();
    expect(panel.querySelector('[data-testid="ai-selection-chip"]')).toBeNull();
    // Dismissing AI scope must not clear the editor's actual selection.
    expect(editorState.get().selection).toEqual(selection);

    const text = "나무 세 그루 심어줘";
    await sendAndFinish(panel, text);

    expect(regionRunner).not.toHaveBeenCalled();
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const options = sendSpy.mock.calls[0]?.[3];
    expect(options?.scope).toBeNull();
    // The entire payload must match an unselected send, without pinning prompt prose.
    editorState.set({ selection: null });
    await sendAndFinish(panel, text);
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(sendSpy.mock.calls[0]?.[0]).toBe(sendSpy.mock.calls[1]?.[0]);
    expect(regionRunner).not.toHaveBeenCalled();
  });

  it("칩이 살아 있으면 영역 실행부로 간다(대조군)", async () => {
    const sendSpy = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue({
      assistantText: "",
      proposedCalls: [],
      stoppedReason: "final",
    });
    const regionRunner = vi.fn(async () => ({
      ok: true, applied: false, changedCells: 0, changedEvents: 0, mapsAdded: 0, clippedCells: 0, proposedCalls: 0, assistantText: "",
    }));
    const panel = renderPanel({ regionTaskRunner: regionRunner });
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 2, y: 2, width: 4, height: 4 } });
    await sendAndFinish(panel, "여기 물 채워줘");
    expect(regionRunner).toHaveBeenCalledTimes(1);
    expect(regionRunner).toHaveBeenCalledWith(expect.objectContaining({
      mapId, region: { x: 2, y: 2, width: 4, height: 4 }, instruction: "여기 물 채워줘", gate: "immediate",
    }));
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("대기 상태에서도 선택 칩은 보인다", () => {
  it("선택 칩이 붙으면 칩 호스트에 has-selection-scope 가 서고, 해제하면 내려간다", () => {
    const panel = renderPanel();
    const mapId = store.getCurrent().startMapId;
    const host = control(panel, "ai-context-chips");
    expect(host.classList.contains("has-selection-scope")).toBe(false);
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(host.classList.contains("has-selection-scope")).toBe(true);
    control<HTMLButtonElement>(panel, "ai-selection-chip-clear").click();
    expect(host.classList.contains("has-selection-scope")).toBe(false);
  });

  it("idle: the map pin is visible, selection hides only sibling chips, and clearing restores the map pin", () => {
    const panel = renderPanel();
    const host = control(panel, "ai-context-chips");
    const mapId = store.getCurrent().startMapId;
    const mapChip = () => {
      const chip = host.querySelector<HTMLElement>(".ai-context-chip:not(.ai-selection-chip)");
      if (!chip) throw new Error("Missing current-map pin");
      expect(chip.textContent).toBe(store.getCurrent().maps[mapId]?.name);
      return chip;
    };
    expect(panel.classList.contains("is-assistant-idle")).toBe(true);
    expect(getComputedStyle(host).display).toBe("flex");
    expect(getComputedStyle(mapChip()).display).toBe("inline-flex");

    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(panel.classList.contains("is-assistant-idle")).toBe(true);
    expect(getComputedStyle(host).display).toBe("flex");
    expect(getComputedStyle(host).order).toBe("-1");
    expect(getComputedStyle(mapChip()).display).toBe("none");
    expect(getComputedStyle(control(panel, "ai-selection-chip")).display).toBe("inline-flex");
    const clear = control<HTMLButtonElement>(panel, "ai-selection-chip-clear");
    expect(getComputedStyle(clear).display).toBe("inline-flex");
    expect(clear.disabled).toBe(false);

    clear.click();
    expect(panel.querySelector('[data-testid="ai-selection-chip"]')).toBeNull();
    expect(getComputedStyle(host).display).toBe("flex");
    expect(getComputedStyle(mapChip()).display).toBe("inline-flex");
    expect(document.activeElement).toBe(control(panel, "ai-input"));
  });
});

describe("composer keyboard help does not occupy the action row", () => {
  it("keeps help on the input title and the shipped action row intact before focus, during focus, and after blur", () => {
    const panel = renderPanel();
    const input = control<HTMLTextAreaElement>(panel, "ai-input");
    const actions = control(panel, "ai-composer-actions");
    const help = input.title;
    expect(help.trim().length).toBeGreaterThan(0);
    // Nonempty input keeps suggestions out of this focus/row-space regression.
    input.value = "나무 세 그루 심어줘";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const assertRow = () => {
      expect(input.title).toBe(help);
      expect(panel.querySelector(".ai-composer-hint")).toBeNull();
      expect(actions.textContent).not.toContain(help);
      expect(getComputedStyle(actions).display).toBe("flex");
      expect(getComputedStyle(actions).minHeight).toBe("36px");
      // happy-dom omits unset initial values; test the authored nowrap rule on the lead.
      const lead = actions.querySelector<HTMLElement>(".ai-composer-actions-lead");
      if (!lead) throw new Error("Missing composer action lead");
      expect(getComputedStyle(lead).whiteSpace).toBe("nowrap");
      expect(actions.contains(control(panel, "ai-send"))).toBe(true);
      expect(getComputedStyle(control(panel, "ai-send")).display).not.toBe("none");
    };
    expect(actions.classList.contains("is-input-focused")).toBe(false);
    assertRow();
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(actions.classList.contains("is-input-focused")).toBe(true);
    assertRow();
    input.blur();
    expect(actions.classList.contains("is-input-focused")).toBe(false);
    assertRow();
  });
});
