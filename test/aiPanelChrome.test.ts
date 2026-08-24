import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
import {
  assistantIdleHints,
  formatComposerPlaceholder,
  readAgentBrief,
} from "@/editor/panels/aiAgentBrief";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  const mapId = store.getCurrent().startMapId;
  editorState.set({
    currentMapId: mapId,
    layer: "lower",
    tool: "paint",
    selection: null,
    chatDock: "float",
    assistantTemperature: "quiet-gold",
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

function findByTag(root: FakeElement, tagName: string): FakeElement | null {
  if (root.tagName === tagName.toUpperCase()) return root;
  for (const child of root.childNodes) {
    if (child instanceof FakeElement) {
      const match = findByTag(child, tagName);
      if (match) return match;
    }
  }
  return null;
}

function findByAttr(root: FakeElement, name: string, value: string): FakeElement | null {
  if (root.getAttribute(name) === value) return root;
  for (const child of root.childNodes) {
    if (child instanceof FakeElement) {
      const match = findByAttr(child, name, value);
      if (match) return match;
    }
  }
  return null;
}

const TAB_ORDER_TAGS = new Set(["BUTTON", "TEXTAREA", "INPUT"]);
const IDLE_FLOAT_TAB_STOPS = [
  "ai-command-menu-toggle",
  "ai-skill-slash-toggle",
  "ai-input",
  "ai-send",
  "ai-settings-command-bar",
] as const;

function collectTabOrderableControls(root: FakeElement): FakeElement[] {
  const stops: FakeElement[] = [];
  const walk = (node: FakeElement): void => {
    if (node.inert) return;
    if (TAB_ORDER_TAGS.has(node.tagName) && !node.disabled) {
      const rawTabIndex = node.getAttribute("tabindex");
      if (rawTabIndex === null || Number(rawTabIndex) >= 0) stops.push(node);
    }
    for (const child of node.childNodes) {
      if (child instanceof FakeElement) walk(child);
    }
  };
  walk(root);
  return stops;
}

/** 접힌 채 부팅한 경우 복귀 버튼으로 펼침 (이미 펼쳐져 있으면 no-op). */
function expandPanel(panel: FakeElement): void {
  if (!panel.classList.contains("is-collapsed")) return;
  findByTestId(panel, "ai-collapsed-restore")?.click();
  expect(panel.classList.contains("is-collapsed")).toBe(false);
}

describe("AI 패널 크롬", () => {
  it("제목을 클릭해도 패널이 접히지 않는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const title = findByTag(panel, "h2");
    if (!title) throw new Error("AI panel title missing");

    title.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
  });

  it("헤더 플레이트는 접근 이름이 조수이고 제목이 AI 어시스턴트가 아니다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const header = panel.querySelector(".ai-chat-header");
    if (!header) throw new Error("AI header missing");
    const title = findByTag(header, "h2");
    const face = findByAttr(header, "aria-label", "조수");
    const plate = findByTestId(panel, "ai-director-plate");

    expect(title?.textContent).toBe("조수");
    expect(title?.textContent).not.toContain("AI 어시스턴트");
    expect(face?.getAttribute("role")).toBe("img");
    expect(face?.getAttribute("aria-label")).toBe("조수");
    expect(plate?.textContent ?? "").not.toContain("🤖");
    expect(plate?.textContent ?? "").not.toMatch(/지시|질문|계획/u);
  });

  it("헤더 존재 줄은 대기 한 줄이다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const line = findByTestId(panel, "ai-director-line");

    expect(line?.textContent).toBe("이 맵에 무엇을 둘까요");
  });

  it("선택이 있으면 존재 줄이 그 칸을 묻는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const line = findByTestId(panel, "ai-director-line");
    if (!line) throw new Error("director line missing");
    const mapId = store.getCurrent().startMapId;

    editorState.set({ selection: { mapId, x: 1, y: 2, width: 3, height: 4 } });

    expect(line.textContent).toBe("선택한 칸에 무엇을 둘까요");
  });

  it("첫 방문(저장값 없음)은 펼친 채 부팅한다", () => {
    // Break: loadPanelCollapsed() still returns true when the key is missing.
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.has("oprn:ai-panel-collapsed")).toBe(false);
  });

  it("부팅 시 저장된 접힘 선택('1')을 복원한다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
  });

  it("접기 버튼은 커맨드 바 인셋을 유지하고, 복귀 타깃 클릭으로 펼친다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);

    collapse.click();

    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    const restore = findByTestId(panel, "ai-collapsed-restore");
    const restoreFace = restore?.querySelector(".ai-director-face");
    expect(restore).toBeTruthy();
    expect(restore?.getAttribute("type")).toBe("button");
    expect(restore?.getAttribute("aria-label")).toBe("AI 어시스턴트");
    expect(restore?.style.width).toBe("48px");
    expect(restore?.style.height).toBe("48px");
    expect(restore?.textContent ?? "").not.toContain("🤖");
    expect(restore?.querySelector(".ai-collapsed-restore-float")).toBeNull();
    expect(restore?.querySelector(".ai-collapsed-restore-rail-icon")).toBeNull();
    expect(restore?.querySelector(".ai-collapsed-restore-rail-label")).toBeNull();
    expect(restoreFace).toBeTruthy();
    expect(restoreFace?.style.width).toBe("48px");
    expect(restoreFace?.style.height).toBe("48px");
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("1");

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("떠 있는 말풍선으로 접어도 48px 얼굴 복귀가 남는다", () => {
    // Break: restore is still the 🤖 AI ▸ pill, or aria-label is not AI 어시스턴트.
    storage.set("oprn:ai-panel-docked", "0");
    const panel = renderPanel();
    expandPanel(panel);
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");

    collapse.click();

    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore?.getAttribute("aria-label")).toBe("AI 어시스턴트");
    expect(restore?.style.width).toBe("48px");
    expect(restore?.style.height).toBe("48px");
    expect(restore?.textContent ?? "").not.toContain("🤖");
    expect(restore?.querySelector(".ai-collapsed-restore-float")).toBeNull();
    expect(restore?.querySelector(".ai-director-face")).toBeTruthy();
  });

  it("스튜디오에서 접어도 화면 안 복귀 타깃이 남는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const studio = findByTestId(panel, "ai-studio-toggle");
    const collapse = findByTestId(panel, "ai-collapse");
    if (!studio || !collapse) throw new Error("studio or collapse button missing");

    studio.click();
    collapse.click();

    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(panel.classList.contains("is-studio")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore).toBeTruthy();
  });

  it("빈 플로트 부팅은 오버레이 빈 키트와 중복 칩이 없다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const chips = findByTestId(panel, "ai-composer-chips");
    const input = findByTestId(panel, "ai-input");

    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(chips?.hidden).toBe(true);
    expect(chips?.querySelectorAll("button").length ?? 0).toBe(0);
    expect(input?.getAttribute("placeholder")).toBe(formatComposerPlaceholder(readAgentBrief()));
    expect(findByTestId(panel, "ai-next-steps")?.hidden).toBe(true);
  });

  it("유리 대기는 Quiet Gold 힌트 둘이고 갤러리는 없다", () => {
    editorState.set({ chatDock: "glass" });
    const panel = renderPanel();
    expandPanel(panel);
    const steps = findByTestId(panel, "ai-next-steps");
    const expected = assistantIdleHints(readAgentBrief());

    expect(panel.dataset.temperature).toBe("quiet-gold");
    expect(steps?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-next-steps-hint")).toBeNull();
    expect(findByTestId(panel, "ai-idle-hints")).toBeTruthy();
    expect(steps?.querySelectorAll("button").length).toBe(2);
    expect(findByTestId(panel, `ai-idle-hint-${expected[0]?.id ?? "river"}`)?.textContent).toContain("@>");
    expect(findByTestId(panel, `ai-idle-hint-${expected[0]?.id ?? "river"}`)?.textContent).toContain(expected[0]?.label);
  });

  it("⋯ 메뉴에서 온도 B/C를 고르면 대기 크롬이 바뀌고 레이아웃에 저장된다", () => {
    editorState.set({ chatDock: "glass" });
    const panel = renderPanel();
    expandPanel(panel);
    findByTestId(panel, "ai-more-menu-toggle")?.click();

    expect(findByTestId(panel, "ai-temperature-quiet-gold")).toBeTruthy();
    expect(findByTestId(panel, "ai-temperature-ink-only")).toBeTruthy();
    expect(findByTestId(panel, "ai-temperature-map-first")).toBeTruthy();
    expect(findByTestId(panel, "ai-temperature-quiet-gold")?.getAttribute("aria-checked")).toBe("true");

    findByTestId(panel, "ai-temperature-ink-only")?.click();
    expect(panel.dataset.temperature).toBe("ink-only");
    expect(editorState.get().assistantTemperature).toBe("ink-only");
    expect(findByTestId(panel, "ai-next-steps")?.hidden).toBe(true);
    expect(JSON.parse(storage.get("oprn:editor-layout:v4") ?? "{}")).toMatchObject({ assistantTemperature: "ink-only" });

    findByTestId(panel, "ai-more-menu-toggle")?.click();
    findByTestId(panel, "ai-temperature-map-first")?.click();
    expect(panel.dataset.temperature).toBe("map-first");
    expect(panel.classList.contains("is-map-first-idle")).toBe(true);
    expect(findByTestId(panel, "ai-command-bar-face")).toBeTruthy();
  });

  it("복귀 타깃으로 펼치면 저장값이 0이 된다", () => {
    storage.set("oprn:ai-panel-collapsed", "1");
    const panel = renderPanel();
    const restore = findByTestId(panel, "ai-collapsed-restore");

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore).toBeTruthy();

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("oprn:ai-panel-collapsed")).toBe("0");
  });

  it("툴바에 직전 변경 되돌리기 진입점을 제공한다", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("테스트 편집", mapId);
    const panel = renderPanel();
    const undo = findByTestId(panel, "ai-undo-last");
    if (!undo) throw new Error("AI undo button missing");

    expect(undo.textContent).toContain("되돌리기");
    expect(undo.disabled).toBe(false);

    undo.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("펼친 플로트에서 숨은 툴바·서랍 버튼은 tab 순서에 없다", () => {
    const panel = renderPanel();
    expandPanel(panel);

    const stops = collectTabOrderableControls(panel);
    const stopIds = stops.map((stop) => stop.dataset.testid).filter((id): id is string => Boolean(id));

    expect(stops.some((stop) => stop.closest("[data-testid=ai-chat-toolbar]") !== null)).toBe(false);
    expect(stops.some((stop) => stop.closest("[data-testid=ai-skill-drawer]") !== null)).toBe(false);
    expect(stopIds).toEqual(expect.arrayContaining([...IDLE_FLOAT_TAB_STOPS]));
  });

  it("float dock does not mount the work log or rising overlay", () => {
    // Break: applyComposerViewPolicy still leaves .ai-chat-log / ai-rising-overlay
    // under the float panel (even if CSS display:none hides them).
    const panel = renderPanel();
    expandPanel(panel);

    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeNull();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(panel.querySelector(".ai-chat-log")).toBeNull();
  });

  it("side dock mounts the work log, and switching back to float unmounts it", () => {
    // Break: dock toggle only flips classes / display:none and never remounts the log.
    const panel = renderPanel();
    expandPanel(panel);
    const toggle = findByTestId(panel, "chat-dock-toggle");
    if (!toggle) throw new Error("dock toggle missing");

    toggle.click();
    expect(findByTestId(panel, "ai-glass-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();

    toggle.click();

    const sideLog = findByTestId(panel, "ai-chat-log");
    expect(sideLog).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")?.contains(sideLog)).toBe(true);
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-director-plate")).toBeTruthy();
    expect(sideLog?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.classList.contains("is-faded")).toBe(false);
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.hidden).toBe(false);

    toggle.click();

    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeNull();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });

  it("float history remounts the work log outside the rising overlay", () => {
    // Break: history-open float still keeps the log unmounted, or remounts the overlay.
    const panel = renderPanel();
    expandPanel(panel);
    const history = findByTestId(panel, "ai-dock-toggle");
    if (!history) throw new Error("history toggle missing");

    history.click();

    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(panel.classList.contains("is-history-open")).toBe(true);
  });
});
