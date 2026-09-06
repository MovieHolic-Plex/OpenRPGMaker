import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDatabaseActiveTab,
  renderDatabasePanel,
  setDatabaseActiveTab,
  TAB_GROUPS,
} from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly window: typeof globalThis.window | undefined;
};

// TAB_GROUPS 의 id → testid 역참조. sidebar nav 테스트가 하드코딩 기대 순서를 잡고
// 이 테스트는 "DOM 순서 = 그룹 파생 순서" 계약을 TAB_GROUPS 로부터 직접 파생해 고정한다.
const TAB_TESTID: Record<string, string> = {
  overview: "db-tab-overview",
  worldCanon: "db-tab-world-canon",
  worldCodex: "db-tab-world-codex",
  actors: "db-tab-actors",
  characterAppearances: "db-tab-character-appearances",
  classes: "db-tab-classes",
  promotionTree: "db-tab-promotion-tree",
  skills: "db-tab-skills",
  skillTrees: "db-tab-skill-trees",
  items: "db-tab-items",
  elements: "db-tab-elements",
  states: "db-tab-states",
  animations: "db-tab-animations",
  battleScreen: "db-tab-battle-screen",
  battleCommands: "db-tab-battle-commands",
  enemies: "db-tab-enemies",
  monsterSpecies: "db-tab-monster-species",
  troops: "db-tab-troops",
  factions: "db-tab-factions",
  crops: "db-tab-crops",
  characters: "db-tab-characters",
  lifeCrafting: "db-tab-life-crafting",
  dailyWeather: "db-tab-daily-weather",
  farmAnimals: "db-tab-farm-animals",
  lifeCollections: "db-tab-life-collections",
  farmSpatial: "db-tab-farm-spatial",
  worldGen: "db-tab-world-gen",
  terrain: "db-tab-terrain",
  tilesets: "db-tab-tilesets",
  tilesetAutotile: "db-tab-tileset-autotile",
  tilesetUnlabeled: "db-tab-tileset-unlabeled",
  structureKits: "db-tab-structure-kits",
  tilesetSpaces: "db-tab-tileset-spaces",
  scratchConcepts: "db-tab-scratch-concepts",
  villages: "db-tab-villages",
  commonEvents: "db-tab-common-events",
  system: "db-tab-system",
  terms: "db-tab-terms",
  switches: "db-tab-switches",
  variables: "db-tab-variables",
};

function tabOrderTestIds(): string[] {
  return [
    "db-tab-overview",
    ...TAB_GROUPS.flatMap((group) => group.tabs.map((id) => TAB_TESTID[id])),
  ];
}

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

function sidebarButtons(panelRoot: FakeElement): FakeElement[] {
  return panelRoot.querySelectorAll(".db-tab");
}

describe("database sidebar keyboard navigation", () => {
  it("pins Tab focus order: sidebar DOM order = overview entry + TAB_GROUPS order", () => {
    const panelRoot = renderPanelHost();
    const buttons = sidebarButtons(panelRoot);

    // 포커스 순서 계약: 네이티브 버튼의 Tab 순서는 DOM 순서를 따른다. fakeDom 은 실제
    // tab-order 탐색을 흉내내지 않으므로, tabbable 요소(.db-tab button)의 DOM 순서가
    // tabOrder 파생 그룹 순서와 정확히 일치함을 고정한다.
    const expected = tabOrderTestIds();
    expect(buttons.length).toBe(expected.length);
    expect(buttons.map((button) => button.dataset.testid)).toEqual(expected);

    // 모든 탭은 네이티브로 탭 가능한 button 이어야 하고, 비활성/탭오더 이탈이 없어야 한다.
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.disabled).toBe(false);
    }

    // 그룹 헤더는 탭 순서에 들어오면 안 된다(div, 포커스 대상 아님).
    const groups = panelRoot.querySelectorAll(".db-tab-group");
    expect(groups.length).toBe(TAB_GROUPS.length);
    for (const group of groups) {
      expect(group.tagName).toBe("DIV");
    }

    // 첫 탭은 상단 고정 개요 엔트리, 마지막은 시스템 그룹의 변수 탭.
    expect(buttons[0]?.dataset.testid).toBe("db-tab-overview");
    expect(buttons.at(-1)?.dataset.testid).toBe("db-tab-variables");
  });

  it("activates the focused tab through the click handler on Enter (keydown path inert)", () => {
    const panelRoot = renderPanelHost();
    const buttons = sidebarButtons(panelRoot);
    const overview = buttons[0];
    if (!overview) throw new Error("missing overview tab");

    overview.focus();
    expect(document.activeElement).toBe(overview);
    expect(getDatabaseActiveTab()).toBe("actors");

    // 합성 keydown 은 브라우저와 달리 네이티브 버튼 활성화를 일으키지 않는다 — 사이드바는
    // 커스텀 keydown 처리기가 없으므로 Enter 는 브라우저의 클릭 합성 경로에 한 번 맡긴다.
    // (fakeDom 은 KeyboardEvent 전역이 없으니 버블 키다운 이벤트를 직접 만든다.)
    overview.dispatchEvent(new Event("keydown", { key: "Enter", bubbles: true }));
    expect(getDatabaseActiveTab()).toBe("actors");
    expect(overview.classList.contains("active")).toBe(false);

    // 브라우저가 포커스된 버튼의 Enter 에 합성할 클릭을 모사 — 클릭 핸들러가 활성화를 수행한다.
    overview.click();
    expect(getDatabaseActiveTab()).toBe("overview");
    expect(overview.classList.contains("active")).toBe(true);
  });

  it("activates the focused tab on Space via the click handler, one active tab at a time", () => {
    const panelRoot = renderPanelHost();
    const buttons = sidebarButtons(panelRoot);
    const system = buttons.find((button) => button.dataset.testid === "db-tab-system");
    if (!system) throw new Error("missing system tab");

    system.focus();
    expect(document.activeElement).toBe(system);
    system.dispatchEvent(new Event("keydown", { key: " ", bubbles: true }));
    expect(getDatabaseActiveTab()).toBe("actors");

    system.click();
    expect(getDatabaseActiveTab()).toBe("system");
    expect(system.classList.contains("active")).toBe(true);

    const activeTabs = buttons.filter((button) => button.classList.contains("active"));
    expect(activeTabs).toEqual([system]);
  });

  it("keeps every sidebar tab reachable in sequence when walked with Tab-style focus", () => {
    const panelRoot = renderPanelHost();
    const buttons = sidebarButtons(panelRoot);
    const expected = tabOrderTestIds();

    // fakeDom 은 tabindex 탐색이 없으므로 순차 포커스 이동을 직접 흉내낸다 — 각 버튼이
    // 순서대로 포커스 가능하고 document.activeElement 가 따라오는지 고정한다.
    for (const button of buttons) {
      button.focus();
      expect(document.activeElement).toBe(button);
    }
    expect(buttons.map((button) => button.dataset.testid)).toEqual(expected);
  });
});
