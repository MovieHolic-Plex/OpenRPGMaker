import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "@/editor/mapEditHistory";
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

describe("AI 패널 크롬", () => {
  it("제목을 클릭해도 패널이 접히지 않는다", () => {
    const panel = renderPanel();
    const title = findByTag(panel, "h2");
    if (!title) throw new Error("AI panel title missing");

    title.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBeUndefined();
  });

  it("접기 버튼은 커맨드 바 인셋을 유지하고, 복귀 타깃 클릭으로 펼친다", () => {
    const panel = renderPanel();
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);

    collapse.click();

    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    const restore = findByTestId(panel, "ai-collapsed-restore");
    expect(restore).toBeTruthy();
    expect(restore?.getAttribute("title")).toBe("AI 패널 펼치기");
    expect(restore?.querySelector(".ai-collapsed-restore-float")?.textContent).toBe("🤖 AI ▸");
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBe("1");

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(document.body.classList.contains("ai-command-bar-active")).toBe(true);
    expect(document.body.classList.contains("ai-panel-docked")).toBe(false);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBe("0");
  });

  it("떠 있는 말풍선으로 접어도 고대비 복귀 알약이 남는다", () => {
    storage.set("rpg-zzu:ai-panel-docked", "0");
    const panel = renderPanel();
    const collapse = findByTestId(panel, "ai-collapse");
    if (!collapse) throw new Error("collapse button missing");

    collapse.click();

    const restore = findByTestId(panel, "ai-collapsed-restore");
    const floatPill = restore?.querySelector(".ai-collapsed-restore-float");
    expect(panel.classList.contains("is-docked")).toBe(false);
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(floatPill?.textContent).toBe("🤖 AI ▸");
  });

  it("스튜디오에서 접어도 화면 안 복귀 타깃이 남는다", () => {
    const panel = renderPanel();
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

  it("시작 화면은 설명을 카드 밖 안내 블록으로 분리한다", () => {
    const panel = renderPanel();
    const startScreen = findByTestId(panel, "ai-start-screen");
    const guide = findByTestId(panel, "ai-start-guide");
    const card = findByTestId(panel, "ai-start-build-house");
    if (!startScreen || !card) throw new Error("start screen missing");

    const cardTitle = card.getAttribute("title");

    expect(guide).toBeTruthy();
    expect(guide?.querySelector("details")).toBeTruthy();
    expect(guide?.querySelector("summary")?.textContent).toBe("ⓘ 스킬 안내");
    expect(card.querySelector(".ai-start-card-desc")).toBeNull();
    expect(cardTitle).toBeTruthy();
    expect(card.textContent).not.toContain(cardTitle ?? "");
    expect(guide?.textContent).toContain(cardTitle ?? "");
  });

  it("기존 localStorage 접힘 키를 그대로 읽고 쓴다", () => {
    storage.set("rpg-zzu:ai-panel-collapsed", "1");
    const panel = renderPanel();
    const restore = findByTestId(panel, "ai-collapsed-restore");

    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(restore).toBeTruthy();

    restore?.click();

    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expect(storage.get("rpg-zzu:ai-panel-collapsed")).toBe("0");
  });

  it("툴바에 직전 변경 되돌리기 진입점을 제공한다", () => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot("테스트 편집", mapId);
    const panel = renderPanel();
    const undo = findByTestId(panel, "ai-undo-last");
    if (!undo) throw new Error("AI undo button missing");

    expect(undo.textContent).toBe("↶ 되돌리기");
    expect(undo.disabled).toBe(false);

    undo.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});
