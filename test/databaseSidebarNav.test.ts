import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
};

// tabs 레지스트리(database.ts)에 정의된 35개 testid — 타일셋 폴더 자식 3면 포함.
// 폴더 버튼 `db-tileset-folder` 는 .db-tab 이 아니라 이 목록에 없다.
// '개요' 엔트리 이후에도 전부 정확히 한 번씩 사이드바에 존재해야 한다(G006 + e2e 스윕 계약).
// 순서는 `TAB_GROUPS` 파생이다(tabOrder 는 더 이상 손으로 쓰지 않는다).
const EXPECTED_TABS = [
  // 상단 고정 (그룹 밖)
  "db-tab-overview",
  // 파티
  "db-tab-actors",
  "db-tab-classes",
  "db-tab-skills",
  "db-tab-items",
  "db-tab-equipment",
  // 몬스터 — 포획 종족도 이 도메인에 둔다
  "db-tab-enemies",
  "db-tab-monster-species",
  "db-tab-troops",
  "db-tab-factions",
  // 전투 규칙
  "db-tab-elements",
  "db-tab-states",
  "db-tab-animations",
  "db-tab-battle-screen",
  "db-tab-battle-commands",
  // 생활
  "db-tab-crops",
  "db-tab-characters",
  "db-tab-life-crafting",
  "db-tab-daily-weather",
  "db-tab-farm-animals",
  "db-tab-farm-spatial",
  "db-tab-life-collections",
  // 세계 — 타일셋 폴더 자식 + 마을·지형
  "db-tab-world-gen",
  "db-tab-tilesets",
  "db-tab-tileset-autotile",
  "db-tab-tileset-unlabeled",
  "db-tab-structure-kits",
  "db-tab-tileset-spaces",
  "db-tab-villages",
  "db-tab-terrain",
  "db-tab-common-events",
  // 시스템
  "db-tab-system",
  "db-tab-terms",
  "db-tab-switches",
  "db-tab-variables",
];

const EXPECTED_GROUPS = ["파티", "몬스터", "전투 규칙", "생활", "세계", "시스템"];
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
    expect(groups.map((group) => group.querySelector(".db-tab-group-label")?.textContent)).toEqual(EXPECTED_GROUPS);
  });

  // Break caught: life-skill, weather, and animal records remain hidden behind System counts.
  it("keeps all 35 tab testids, including faction and life authoring surfaces", () => {
    const panelRoot = renderPanelHost();
    const buttons = panelRoot.querySelectorAll(".db-tab");
    expect(buttons.length).toBe(EXPECTED_TABS.length);
    expect(EXPECTED_TABS.length).toBe(35);
    expect(buttons.map((button) => button.dataset.testid)).toEqual(EXPECTED_TABS);
    // 중복 없음 — 등장 순서 자체가 기대 순서와 일치하면 중복이 섞일 수 없다(배열 비교).
    expect(new Set(EXPECTED_TABS).size).toBe(35);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      const label = (button.textContent ?? "").trim();
      expect(button.getAttribute("title"), `${button.dataset.testid} title`).toBe(label);
      expect(button.getAttribute("aria-label"), `${button.dataset.testid} aria-label`).toBe(label);
      // 아이콘은 SVG 첫 자식이다 — CSS `content` 글리프도 아니고 `data-short` 한글 첫 글자도 아니다.
      // <svg> 는 텍스트 노드를 안 가지므로 위의 라벨 계약이 그대로 성립한다.
      const icon = button.children[0];
      expect(icon?.tagName.toLowerCase(), `${button.dataset.testid} icon tag`).toBe("svg");
      expect(icon?.getAttribute("class"), `${button.dataset.testid} icon class`).toBe("db-tab-icon");
      expect(button.dataset.short, `${button.dataset.testid} data-short`).toBeUndefined();
    }
  });

  it("uses domain-specific labels for monster, farming, and resident authoring", () => {
    const panelRoot = renderPanelHost();
    expect(findTab(panelRoot, "db-tab-monster-species").textContent).toBe("몬스터 종족");
    expect(findTab(panelRoot, "db-tab-crops").textContent).toBe("농사·작물");
    expect(findTab(panelRoot, "db-tab-characters").textContent).toBe("주민 관계");
    expect(findTab(panelRoot, "db-tab-daily-weather").textContent).toBe("계절·날씨");
    expect(findTab(panelRoot, "db-tab-farm-animals").textContent).toBe("동물·축사");
  });

  // Break caught: the new navigation entry has no aggregate count or routed view.
  it("shows the aggregate life-record count and opens its structured workspace", () => {
    store.update((project) => {
      project.database.lifeSkills = [{ id: "life", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] }];
      project.system.sellPrices = [{ itemId: project.database.items[0]?.id ?? "", price: 10 }];
      project.system.energy = { max: 100 };
      project.system.shipping = { enabled: false };
      project.system.worldUnlocks = [{ id: "unlock" }];
      project.system.bundles = [];
      project.system.makers = [{ id: "maker", inputs: [], outputs: [], durationMinutes: 60 }];
    });
    const panelRoot = renderPanelHost();
    const tab = findTab(panelRoot, "db-tab-life-crafting");
    expect(tab.dataset.count).toBe("6");

    tab.click();

    expect(findByTestId(panelRoot, "db-life-workspace")).toBeTruthy();
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
