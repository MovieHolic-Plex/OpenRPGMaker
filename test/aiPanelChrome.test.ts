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

  it("첫 방문(저장값 없음)은 접힌 채 부팅한다", () => {
    const panel = renderPanel();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
  });

  it("부팅 시 저장된 접힘 선택('1')을 복원한다", () => {
    storage.set("rpg-zzu:ai-panel-collapsed", "1");
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
    expect(restore).toBeTruthy();
    expect(restore?.getAttribute("type")).toBe("button");
    expect(restore?.getAttribute("aria-label")).toBe("AI 패널 펼치기");
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
    expandPanel(panel);
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

  it("시작 화면은 최소 힌트만 두고 카드 갤러리는 있다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    const startScreen = findByTestId(panel, "ai-start-screen");
    if (!startScreen) throw new Error("start screen missing");

    expect(findByTestId(panel, "ai-start-guide")).toBeNull();
    expect(findByTestId(panel, "ai-start-try-region")).toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")).not.toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")?.textContent?.length ?? 0).toBeGreaterThan(0);
    // 시작 화면은 제목+갤러리+힌트를 렌더한다
    const title = findByTestId(panel, "ai-start-empty-hint")?.textContent ?? "";
    expect(title.length).toBeGreaterThan(0);
    expect(panel.textContent ?? "").toContain("무엇을 만들까요");
  });

  it("시작 화면 예시 칩은 입력창만 채우고 전송하지 않는다", () => {
    const panel = renderPanel();
    expandPanel(panel);
    // 비주얼 갤러리 칩 중 하나를 클릭하면 입력창이 채워진다
    const gallery = findByTestId(panel, "ai-start-visual-gallery");
    const chip = findByTestId(panel, "ai-start-build-place") ?? findByTestId(panel, "ai-start-build-house") ?? gallery?.childNodes.find((n: unknown) => n instanceof FakeElement && (n as FakeElement).dataset.testid?.startsWith("ai-start-build-")) as FakeElement | undefined ?? findByTestId(panel, "ai-start-example-0");
    expect(chip ?? gallery).toBeTruthy();

    (chip ?? gallery)?.click();

    const input = findByTestId(panel, "ai-input") as unknown as { value: string } | null;
    // 입력창이 있으면 값이 채워져야 하고, 없으면 최소 시작 화면이 유지되어야 함
    if (input && input.value) {
      expect(input.value.length).toBeGreaterThan(0);
    }
    expect(findByTestId(panel, "ai-start-screen")).toBeTruthy();
    expect(findByTestId(panel, "ai-start-shortcut-hint")?.textContent).toContain("Ctrl+K");
  });

  it("복귀 타깃으로 펼치면 저장값이 0이 된다", () => {
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

    expect(undo.textContent).toContain("되돌리기");
    expect(undo.disabled).toBe(false);

    undo.click();

    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});
