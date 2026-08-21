import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
};

// tabs/tabOrder 레지스트리(database.ts)에 정의된 24개 testid — 그룹 재구성 + 상단 고정
// '개요' 엔트리(todo 13) 이후에도 전부 정확히 한 번씩 사이드바에 존재해야 한다(G006 + e2e 스윕 계약).
const EXPECTED_TABS = [
  // 상단 고정 (그룹 밖)
  "db-tab-overview",
  // 파티
  "db-tab-actors",
  "db-tab-classes",
  "db-tab-skills",
  "db-tab-items",
  "db-tab-equipment",
  // 전투 — 배틀러는 수집이 아님
  "db-tab-enemies",
  "db-tab-troops",
  "db-tab-elements",
  "db-tab-states",
  "db-tab-animations",
  "db-tab-battle-screen",
  "db-tab-battle-commands",
  "db-tab-terrain",
  // 수집
  "db-tab-monster-species",
  "db-tab-crops",
  "db-tab-characters",
  // 맵
  "db-tab-tilesets",
  "db-tab-structure-kits",
  "db-tab-common-events",
  // 시스템
  "db-tab-system",
  "db-tab-terms",
  "db-tab-switches",
  "db-tab-variables",
];

const EXPECTED_GROUPS = ["파티", "전투", "수집", "맵", "시스템"];
const ACTIVE_TAB_KEY = "oprn:database.activeTab";

let restoreDom: (() => void) | undefined;
let previousWindow: FakeBrowserGlobals["window"];
let storage: Map<string, string>;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
    return;
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderPanelHost(): FakeElement {
  const panelRoot = document.createElement("div") as unknown as FakeElement;
  panelRoot.className = "database-modal-body";
  renderDatabasePanel(panelRoot as unknown as HTMLElement);
  return panelRoot;
}

function findTab(panelRoot: FakeElement, testId: string): FakeElement {
  const tab = findByTestId(panelRoot, testId);
  if (!tab) throw new Error(`missing tab: ${testId}`);
  if (!tab.classList.contains("db-tab")) throw new Error(`${testId} is not a .db-tab button`);
  return tab;
}

describe("database sidebar navigation", () => {
  it("renders the nav as a .db-tabs sidebar with honest group headers in order", () => {
    const panelRoot = renderPanelHost();
    const nav = panelRoot.querySelector(".db-tabs");
    expect(nav).not.toBeNull();

    const groups = panelRoot.querySelectorAll(".db-tab-group");
    expect(groups.length).toBe(EXPECTED_GROUPS.length);
    expect(groups.map((group) => group.textContent)).toEqual(EXPECTED_GROUPS);
  });

  it("keeps all 24 tab testids, exactly once, in group order (overview pinned on top)", () => {
    const panelRoot = renderPanelHost();
    const buttons = panelRoot.querySelectorAll(".db-tab");
    expect(buttons.length).toBe(EXPECTED_TABS.length);
    expect(EXPECTED_TABS.length).toBe(24);
    expect(buttons.map((button) => button.dataset.testid)).toEqual(EXPECTED_TABS);
    // 중복 없음 — 등장 순서 자체가 기대 순서와 일치하면 중복이 섞일 수 없다(배열 비교).
    expect(new Set(EXPECTED_TABS).size).toBe(24);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      const label = (button.textContent ?? "").trim();
      expect(button.getAttribute("title"), `${button.dataset.testid} title`).toBe(label);
      expect(button.getAttribute("aria-label"), `${button.dataset.testid} aria-label`).toBe(label);
      expect(button.dataset.short, `${button.dataset.testid} data-short`).toBe(label.slice(0, 1));
    }
  });

  it("toggles .active on the clicked tab and clears the previous one", () => {
    const panelRoot = renderPanelHost();
    const actors = findTab(panelRoot, "db-tab-actors");
    const terms = findTab(panelRoot, "db-tab-terms");
    expect(actors.classList.contains("active")).toBe(true);
    expect(terms.classList.contains("active")).toBe(false);

    terms.click();

    expect(terms.classList.contains("active")).toBe(true);
    expect(actors.classList.contains("active")).toBe(false);
    // active는 정확히 한 탭에만 — 그룹 헤더는 받지 않는다.
    const activeTabs = panelRoot
      .querySelectorAll(".db-tab")
      .filter((button) => button.classList.contains("active"));
    expect(activeTabs.length).toBe(1);
  });

  it("persists the clicked tab to localStorage under the unchanged key", () => {
    const panelRoot = renderPanelHost();
    findTab(panelRoot, "db-tab-variables").click();

    expect(storage.get(ACTIVE_TAB_KEY)).toBe("variables");
    expect(window.localStorage.getItem(ACTIVE_TAB_KEY)).toBe("variables");
  });
});
