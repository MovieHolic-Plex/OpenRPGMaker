import type { DatabaseCollection } from "@/editor/databaseActions";
import { getEditorChrome } from "@/editor/editorUiMode";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { renderDailyWeatherTab } from "@/editor/panels/databaseDailyWeatherView";
import { renderFarmAnimalsTab } from "@/editor/panels/databaseFarmAnimalsView";
import { renderFarmSpatialTab } from "@/editor/panels/databaseFarmSpatialView";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { renderRecordTab } from "@/editor/panels/databaseRecordViews";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import {
  renderSwitchesTab,
  renderTermsTab,
  renderVariablesTab,
} from "@/editor/panels/databaseUtilityViews";
import {
  renderBattleCommandsTab,
  renderBattleScreenTab,
  renderElementsTab,
  renderTerrainTab,
} from "@/editor/panels/databaseUtilityRecordViews";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { renderStructureKitsTab } from "@/editor/panels/structureKitDbTab";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { uiLabel } from "@/editor/uiCopy";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";

export type DatabaseTab =
  | "overview"
  | DatabaseCollection
  | "animations"
  | "battleCommands"
  | "battleScreen"
  | "commonEvents"
  | "characters"
  | "crops"
  | "lifeCrafting"
  | "dailyWeather"
  | "farmAnimals"
  | "farmSpatial"
  | "lifeCollections"
  | "elements"
  | "monsterSpecies"
  | "structureKits"
  | "system"
  | "terms"
  | "terrain"
  | "switches"
  | "tilesets"
  | "variables";

const tabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = [
  { id: "overview", label: "개요", testid: "db-tab-overview" },
  { id: "elements", label: "속성", testid: "db-tab-elements" },
  { id: "terrain", label: "지형", testid: "db-tab-terrain" },
  { id: "battleScreen", label: "전투 화면", testid: "db-tab-battle-screen" },
  { id: "battleCommands", label: "전투 명령", testid: "db-tab-battle-commands" },
  { id: "actors", label: "주인공", testid: "db-tab-actors" },
  { id: "classes", label: "직업", testid: "db-tab-classes" },
  { id: "skills", label: "스킬", testid: "db-tab-skills" },
  { id: "items", label: "아이템", testid: "db-tab-items" },
  { id: "crops", label: "농사·작물", testid: "db-tab-crops" },
  { id: "characters", label: "주민 관계", testid: "db-tab-characters" },
  { id: "lifeCrafting", label: "생활 기술·제작", testid: "db-tab-life-crafting" },
  { id: "dailyWeather", label: "계절·날씨", testid: "db-tab-daily-weather" },
  { id: "farmAnimals", label: "동물·축사", testid: "db-tab-farm-animals" },
  { id: "farmSpatial", label: "농장 건물·집 꾸미기", testid: "db-tab-farm-spatial" },
  { id: "lifeCollections", label: "낚시·채집·박물관", testid: "db-tab-life-collections" },
  { id: "equipment", label: "장비", testid: "db-tab-equipment" },
  { id: "enemies", label: "몬스터", testid: "db-tab-enemies" },
  { id: "monsterSpecies", label: "몬스터 종족", testid: "db-tab-monster-species" },
  { id: "troops", label: "적 그룹", testid: "db-tab-troops" },
  { id: "states", label: "상태", testid: "db-tab-states" },
  { id: "animations", label: "전투 애니메이션", testid: "db-tab-animations" },
  { id: "tilesets", label: "타일셋", testid: "db-tab-tilesets" },
  { id: "structureKits", label: "스탬프", testid: "db-tab-structure-kits" },
  { id: "commonEvents", label: "공용 이벤트", testid: "db-tab-common-events" },
  { id: "system", label: "시스템", testid: "db-tab-system" },
  { id: "terms", label: "용어", testid: "db-tab-terms" },
  { id: "switches", label: "스위치", testid: "db-tab-switches" },
  { id: "variables", label: "변수", testid: "db-tab-variables" },
];

const tabOrder: readonly DatabaseTab[] = [
  "overview",
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "monsterSpecies",
  "troops",
  "elements",
  "states",
  "animations",
  "battleScreen",
  "battleCommands",
  "terrain",
  "crops",
  "characters",
  "lifeCrafting",
  "dailyWeather",
  "farmAnimals",
  "lifeCollections",
  "farmSpatial",
  "tilesets",
  "structureKits",
  "commonEvents",
  "system",
  "terms",
  "switches",
  "variables",
];

const orderedTabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = tabOrder.map(tabFor);
const COMMON_TAB_IDS: readonly DatabaseTab[] = ["overview", "actors", "items", "enemies", "troops", "system"];

export type DatabaseTabGroup = {
  readonly label: string;
  readonly tabs: readonly DatabaseTab[];
};

// 사이드바 그룹 라벨/순서만 정의한다 — 탭 id는 tabs/tabOrder 레지스트리에서 역참조하므로
// 라벨·testid는 여기서 중복 정의하지 않는다.
export const TAB_GROUPS: readonly DatabaseTabGroup[] = [
  { label: "파티", tabs: ["actors", "classes", "skills", "items", "equipment"] },
  {
    label: "전투·몬스터",
    tabs: ["enemies", "monsterSpecies", "troops", "elements", "states", "animations", "battleScreen", "battleCommands", "terrain"],
  },
  { label: "생활", tabs: ["crops", "characters", "lifeCrafting", "dailyWeather", "farmAnimals", "lifeCollections", "farmSpatial"] },
  { label: "맵", tabs: ["tilesets", "structureKits", "commonEvents"] },
  { label: "시스템", tabs: ["system", "terms", "switches", "variables"] },
];

function tabFor(id: DatabaseTab): { readonly id: DatabaseTab; readonly label: string; readonly testid: string } {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Missing database tab metadata: ${id}`);
  return tab;
}

const DATABASE_ACTIVE_TAB_KEY = "oprn:database.activeTab";

let activeTab: DatabaseTab = readStoredActiveTab();

export function setDatabaseActiveTab(tab: DatabaseTab): void {
  activeTab = tab;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATABASE_ACTIVE_TAB_KEY, tab);
}
export function switchDatabaseActiveTab(tab: DatabaseTab, panelRoot: HTMLElement): void {
  setDatabaseActiveTab(tab);
  const header = panelRoot.querySelector(".db-tabs");
  if (header instanceof HTMLElement) updateTabButtons(header);
  // panelRoot must be the modal host passed to renderDatabasePanel (e.g. .database-modal-body),
  // not the inner .db-body alone — refreshDatabasePanel looks up .db-body under the host.
  refreshDatabasePanel(panelRoot);
}

export function getDatabaseActiveTab(): DatabaseTab {
  return activeTab;
}

export function databaseTabLabel(tab: DatabaseTab): string {
  return tabs.find((entry) => entry.id === tab)?.label ?? tab;
}

export function renderDatabasePanel(container: HTMLElement): void {
  clearChildren(container);
  const header = el("div", { class: "db-tabs" });
  const body = el("div", { class: "db-body" });
  // 버튼의 testid/라벨/.active 토글 계약(G006 + databaseCrossTabNav)은 모드와 무관하게 유지한다.
  const chrome = getEditorChrome();
  if (chrome.databaseNav === "common") {
    for (const id of COMMON_TAB_IDS) appendTabButton(header, body, container, tabFor(id));

    const allTabs = el("details", { dataset: { testid: "db-nav-all" } });
    allTabs.append(el("summary", { text: `모든 ${uiLabel("databaseShort", chrome.jargonStyle)}` }));
    for (const tab of orderedTabs) {
      if (!COMMON_TAB_IDS.includes(tab.id)) appendTabButton(allTabs, body, container, tab);
    }
    header.append(allTabs);
  } else if (chrome.databaseNav === "grouped") {
    appendTabSearch(header);
    appendTabButton(header, body, container, tabFor("overview"));
    for (const group of TAB_GROUPS) {
      header.append(el("div", { class: "db-tab-group", text: group.label }));
      for (const id of group.tabs) appendTabButton(header, body, container, tabFor(id));
    }
  } else {
    appendTabSearch(header);
    for (const tab of orderedTabs) appendTabButton(header, body, container, tab);
  }

  renderActiveTab(body, container);
  container.append(header, body);
  revealActiveTab(header);
  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => revealActiveTab(header));
    observer.observe(header);
  }
}

// 이미 마운트된 패널을 부분 갱신한다(본문만 다시 그림). undo/redo 재렌더 경로용.
export function refreshDatabasePanel(container: HTMLElement): void {
  const body = container.querySelector(".db-body");
  if (body instanceof HTMLElement) {
    renderActiveTab(body, container);
    refreshTabCounts(container);
    return;
  }
  renderDatabasePanel(container);
}

// 사이드바 탭의 레코드 카운트 — 컬렉션이 아닌 탭(개요/시스템/용어 등)은 null.
// data-count 어트리뷰트로만 노출한다(버튼 textContent 는 라벨 계약 유지 — G006).
function databaseTabCount(tab: DatabaseTab): number | null {
  const project = store.getCurrent();
  const database = project.database;
  switch (tab) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      return database[tab].length;
    case "animations":
      return database.battleAnimations.length;
    case "monsterSpecies":
      return database.monsterSpecies?.length ?? 0;
    case "crops":
      return database.crops?.length ?? 0;
    case "characters":
      return Object.keys(project.characters ?? {}).length;
    case "lifeCrafting":
      return (database.lifeSkills?.length ?? 0)
        + (project.system.craftRecipes?.length ?? 0)
        + (project.system.itemUpgrades?.length ?? 0)
        + (project.system.sellPrices?.length ?? 0)
        + (project.system.toolActions?.length ?? 0)
        + (project.system.energy ? 1 : 0)
        + (project.system.shipping ? 1 : 0)
        + (project.system.worldUnlocks?.length ?? 0)
        + (project.system.bundles?.length ?? 0)
        + (project.system.makers?.length ?? 0);
    case "dailyWeather":
      return Object.values(project.system.dailyWeather?.seasons ?? {}).reduce((sum, rules) => sum + (rules?.length ?? 0), 0);
    case "farmAnimals":
      return (database.farmAnimalSpecies?.length ?? 0)
        + (project.system.farmAnimalBuildings?.length ?? 0)
        + (project.session.farmAnimals?.length ?? 0);
    case "farmSpatial":
      return (database.farmBuildingTypes?.length ?? 0)
        + (database.homeDecorationTypes?.length ?? 0)
        + (project.session.farmBuildingPlacements?.length ?? 0)
        + (project.session.homeDecorationPlacements?.length ?? 0);
    case "lifeCollections":
      return (database.fishSpecies?.length ?? 0)
        + (project.system.fishing?.spots.length ?? 0)
        + (project.system.seasonalForage?.areas.length ?? 0)
        + (project.system.museum?.rewards.length ?? 0);
    case "switches":
      return project.switches.length;
    case "variables":
      return project.variables.length;
    case "commonEvents":
      return project.commonEvents.length;
    case "tilesets":
      return Object.keys(project.tilesets).length;
    case "structureKits":
      return Object.values(project.tilesets).reduce(
        (sum, tileset) => sum + (tileset.structureKits?.length ?? 0),
        0,
      );
    default:
      return null;
  }
}

function refreshTabCounts(container: HTMLElement): void {
  const header = container.querySelector(".db-tabs");
  if (!(header instanceof HTMLElement)) return;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    const tab = orderedTabs.find((entry) => entry.testid === button.dataset.testid);
    if (!tab) continue;
    const count = databaseTabCount(tab.id);
    if (count === null) delete button.dataset.count;
    else button.dataset.count = String(count);
  }
}

// 사이드바 상단 탭 검색 — 라벨 부분 일치로 탭을 거르고, 매치가 없는 그룹 라벨은
// 함께 숨긴다. DOM 계약(직계 자식 button.db-tab)은 유지 — hidden 토글만 한다.
function appendTabSearch(header: HTMLElement): void {
  const input = el("input", {
    class: "db-tab-search",
    attrs: { type: "search", placeholder: "탭 검색", "aria-label": "탭 검색" },
    dataset: { testid: "db-tab-search" },
    on: { input: () => applyTabFilter(header, input.value) },
  });
  header.append(input);
}

function applyTabFilter(header: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLowerCase();
  let currentGroup: HTMLElement | null = null;
  let groupHasMatch = false;
  const closeGroup = (): void => {
    if (currentGroup) currentGroup.hidden = query !== "" && !groupHasMatch;
  };
  for (const child of Array.from(header.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("db-tab-group")) {
      closeGroup();
      currentGroup = child;
      groupHasMatch = false;
      continue;
    }
    if (!child.classList.contains("db-tab")) continue;
    const matches = query === "" || (child.textContent ?? "").toLowerCase().includes(query);
    child.hidden = !matches;
    if (matches) groupHasMatch = true;
  }
  closeGroup();
}

function appendTabButton(
  header: HTMLElement,
  body: HTMLElement,
  container: HTMLElement,
  tab: { readonly id: DatabaseTab; readonly label: string; readonly testid: string },
): void {
  const count = databaseTabCount(tab.id);
  header.append(
    el("button", {
      class: `db-tab${activeTab === tab.id ? " active" : ""}`,
      text: tab.label,
      attrs: { type: "button", title: tab.label, "aria-label": tab.label },
      dataset:
        count === null
          ? { testid: tab.testid, short: tab.label.slice(0, 1) }
          : { testid: tab.testid, short: tab.label.slice(0, 1), count: String(count) },
      on: {
        click: () => {
          if (activeTab === tab.id) return;
          setDatabaseActiveTab(tab.id);
          // 탭 헤더/스캐폴드는 유지하고 본문만 다시 그린다(전체 재빌드 회피).
          updateTabButtons(header);
          renderActiveTab(body, container);
        },
      },
    }),
  );
}

function updateTabButtons(header: HTMLElement): void {
  const activeTestId = orderedTabs.find((tab) => tab.id === activeTab)?.testid;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    if (button.dataset.testid === activeTestId) button.classList.add("active");
    else button.classList.remove("active");
  }
  revealActiveTab(header);
}

function revealActiveTab(header: HTMLElement): void {
  const active = header.querySelector(".db-tab.active");
  if (!(active instanceof HTMLElement) || typeof active.scrollIntoView !== "function") return;
  active.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderActiveTab(body: HTMLElement, container: HTMLElement): void {
  clearChildren(body);
  const rerender = (): void => {
    renderActiveTab(body, container);
    refreshTabCounts(container);
  };
  if (activeTab === "enemies" || activeTab === "monsterSpecies" || activeTab === "troops") {
    const banner = collectionGateBanner(container);
    if (banner) body.append(banner);
  }
  switch (activeTab) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      renderRecordTab(body, activeTab, rerender);
      return;
    case "animations":
      renderRecordTab(body, "battleAnimations", rerender);
      return;
    case "elements":
      renderElementsTab(body);
      return;
    case "terrain":
      renderTerrainTab(body);
      return;
    case "battleScreen":
      renderBattleScreenTab(body);
      return;
    case "battleCommands":
      renderBattleCommandsTab(body);
      return;
    case "monsterSpecies":
      renderMonsterSpeciesTab(body, rerender);
      return;
    case "crops":
      renderCropTab(body, rerender);
      return;
    case "characters":
      renderCharactersTab(body, rerender);
      return;
    case "lifeCrafting":
      renderLifeCraftingTab(body, rerender);
      return;
    case "dailyWeather":
      renderDailyWeatherTab(body, rerender);
      return;
    case "farmAnimals":
      renderFarmAnimalsTab(body, rerender);
      return;
    case "farmSpatial":
      renderFarmSpatialTab(body, rerender);
      return;
    case "lifeCollections":
      renderLifeCollectionsTab(body, rerender);
      return;
    case "switches":
      renderSwitchesTab(body, rerender);
      return;
    case "variables":
      renderVariablesTab(body, rerender);
      return;
    case "commonEvents":
      renderCommonEventsTab(body, rerender);
      return;
    case "tilesets":
      renderTilesetsTab(body, rerender);
      return;
    case "structureKits":
      renderStructureKitsTab(body, rerender);
      return;
    case "system":
      renderSystemTab(body, rerender);
      return;
    case "terms":
      renderTermsTab(body);
      return;
    case "overview":
      renderOverviewTab(body, rerender);
      return;
  }
}

/**
 * 몬스터 데이터를 저작했는데 시스템 탭에서 몬스터 수집이 꺼져 있으면 포획 명령이 전투에
 * 나오지 않는다 — 몬스터/종족/적 그룹 탭 상단에 경고와 시스템 탭 점프를 준다.
 */
function collectionGateBanner(container: HTMLElement): HTMLElement | null {
  const project = store.getCurrent();
  if (project.system.monsterCollection === true) return null;
  const hasSpecies = (project.database.monsterSpecies?.length ?? 0) > 0;
  const hasCaptureItem = project.database.items.some((item) => item.captureProfile !== undefined);
  if (!hasSpecies && !hasCaptureItem) return null;
  return el("div", {
    class: "db-collection-gate-warn",
    dataset: { testid: "db-collection-gate-warn" },
    children: [
      el("span", { text: "몬스터 수집이 시스템 탭에서 꺼져 있어 포획 명령이 전투에 나오지 않습니다." }),
      el("button", {
        class: "btn small",
        attrs: { type: "button" },
        text: "시스템 탭 열기",
        dataset: { testid: "db-collection-gate-open-system" },
        on: { click: () => switchDatabaseActiveTab("system", container) },
      }),
    ],
  });
}

function readStoredActiveTab(): DatabaseTab {
  if (typeof window === "undefined") return "actors";
  const stored = window.localStorage.getItem(DATABASE_ACTIVE_TAB_KEY);
  return isDatabaseTab(stored) ? stored : "actors";
}

function isDatabaseTab(value: string | null): value is DatabaseTab {
  return orderedTabs.some((tab) => tab.id === value);
}
