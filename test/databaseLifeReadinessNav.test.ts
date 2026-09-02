import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import { resetRequestedSystemSection } from "@/editor/panels/databaseSystemView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
  readonly requestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = {
    requestAnimationFrame: globalThis.requestAnimationFrame,
    window: globalThis.window,
  };
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearTimeout,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
  resetRequestedSystemSection();
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  resetRequestedSystemSection();
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
  restoreBrowserGlobal("requestAnimationFrame", previousBrowserGlobals.requestAnimationFrame);
});

function restoreBrowserGlobal<Key extends keyof FakeBrowserGlobals>(key: Key, value: FakeBrowserGlobals[Key]): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, key);
    return;
  }
  Object.defineProperty(globalThis, key, { configurable: true, value });
}

function renderPanel(tab: Parameters<typeof setDatabaseActiveTab>[0]): FakeElement {
  setDatabaseActiveTab(tab);
  const panelRoot = document.createElement("div") as unknown as FakeElement;
  panelRoot.className = "database-modal-body";
  renderDatabasePanel(panelRoot as unknown as HTMLElement);
  return panelRoot;
}

function sectionNode(host: FakeElement, slug: string): FakeElement {
  const node = host.querySelector(`[data-system-section="${slug}"]`);
  if (!node) throw new Error(`missing section ${slug}`);
  return node;
}

describe("database life readiness chip navigation", () => {
  it("makes the gift readiness chip itself a button that opens system 시작 설정", () => {
    const panel = renderPanel("characters");
    const card = findByTestId(panel, "db-character-readiness-gifts");
    expect(card?.tagName).toBe("BUTTON");
    expect(card?.dataset.state).toBe("needs-setup");
    expect(findByTestId(panel, "db-character-readiness-gifts-action")).toBeTruthy();

    card?.click();

    expect(getDatabaseActiveTab()).toBe("system");
    expect(findByTestId(panel, "db-tab-system")?.classList.contains("active")).toBe(true);
    expect(findByTestId(panel, "db-system-nav-startup")?.classList.contains("active")).toBe(true);
    expect(sectionNode(panel, "startup").hidden).toBe(false);
    expect(sectionNode(panel, "overview").hidden).toBe(true);
    expect(findByTestId(panel, "db-field-system-gift-system")).toBeTruthy();
  });

  it("opens system 시간 from the birthday chip body, not only the arrow", () => {
    const panel = renderPanel("characters");
    findByTestId(panel, "db-character-readiness-calendar")?.click();

    expect(getDatabaseActiveTab()).toBe("system");
    expect(findByTestId(panel, "db-system-nav-time")?.classList.contains("active")).toBe(true);
    expect(sectionNode(panel, "time").hidden).toBe(false);
    expect(findByTestId(panel, "db-field-system-time-enabled")).toBeTruthy();
  });

  it("opens system 시간 from the crop time chip", () => {
    const panel = renderPanel("crops");
    const card = findByTestId(panel, "db-crop-readiness-time");
    expect(card?.tagName).toBe("BUTTON");
    card?.click();

    expect(getDatabaseActiveTab()).toBe("system");
    expect(findByTestId(panel, "db-system-nav-time")?.classList.contains("active")).toBe(true);
    expect(sectionNode(panel, "time").hidden).toBe(false);
  });

  it("opens items from the crop tools chip body", () => {
    const panel = renderPanel("crops");
    findByTestId(panel, "db-crop-readiness-tools")?.click();
    expect(getDatabaseActiveTab()).toBe("items");
    expect(findByTestId(panel, "db-tab-items")?.classList.contains("active")).toBe(true);
  });

  it("opens system 시작 설정 from the monster-species mode chip", () => {
    const panel = renderPanel("monsterSpecies");
    const card = findByTestId(panel, "db-monster-pipeline-mode");
    expect(card?.tagName).toBe("BUTTON");
    card?.click();

    expect(getDatabaseActiveTab()).toBe("system");
    expect(findByTestId(panel, "db-system-nav-startup")?.classList.contains("active")).toBe(true);
    expect(sectionNode(panel, "startup").hidden).toBe(false);
    expect(findByTestId(panel, "db-field-system-monster-collection")).toBeTruthy();
  });

  it("opens enemies from the monster pipeline chip body", () => {
    const panel = renderPanel("monsterSpecies");
    findByTestId(panel, "db-monster-pipeline-links")?.click();
    expect(getDatabaseActiveTab()).toBe("enemies");
    expect(findByTestId(panel, "db-tab-enemies")?.classList.contains("active")).toBe(true);
  });

  it("keeps the legacy action testid clickable after the chip becomes the button", () => {
    const panel = renderPanel("characters");
    findByTestId(panel, "db-character-readiness-gifts-action")?.click();
    expect(getDatabaseActiveTab()).toBe("system");
    expect(sectionNode(panel, "startup").hidden).toBe(false);
  });
});
