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
import type { Project } from "@/project/types";
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
  { id: "structureKits", label: "구조물", testid: "db-tab-structure-kits" },
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
  { label: "생활", tabs: ["crops", "characters", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections"] },
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

type DatabaseTabRenderCache = {
  readonly project: Project;
  readonly views: Map<DatabaseTab, readonly Node[]>;
};

// Each mounted Database panel owns detached DOM for tabs it has already rendered.
// ProjectStore replaces the Project object on every mutation, which gives the cache
// a cheap and exact invalidation boundary without hashing large database records.
const tabRenderCaches = new WeakMap<HTMLElement, DatabaseTabRenderCache>();

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
  tabRenderCaches.delete(container);
  const header = el("div", { class: "db-tabs" });
  const body = el("div", {
    class: "db-body db-shared-workspace",
    dataset: { testid: "db-shared-workspace" },
  });
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
      header.append(groupHeader(group, header));
      for (const id of group.tabs) appendTabButton(header, body, container, tabFor(id));
    }
    applyGroupCollapse(header);
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
    renderActiveTab(body, container, { forceFresh: true });
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
      return project.switches.filter((record) => record.name.trim().length > 0).length;
    case "variables":
      return project.variables.filter((record) => record.name.trim().length > 0).length;
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
    attrs: { type: "search", placeholder: "탭 검색", title: "탭 검색", "aria-label": "탭 검색" },
    dataset: { testid: "db-tab-search" },
    on: { input: () => applyTabFilter(header, input.value) },
  });
  header.append(input);
}

function applyTabFilter(header: HTMLElement, rawQuery: string): void {
  const query = rawQuery.trim().toLowerCase();
  // 검색 중에는 접힘을 일시 중단한다. 접힌 그룹 안의 일치 항목이 그대로 숨어 있으면
  // 29 개 중 24 개가 검색으로 도달 불가능해진다.
  if (query !== "") header.dataset.filtering = "1";
  else delete header.dataset.filtering;

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
  if (query === "") applyGroupCollapse(header);
}

// ---------------------------------------------------------------------------
// 사이드바 그룹 접기
//
// 29 개 탭 + 5 개 그룹 헤더 + 검색은 1050px 뷰포트의 레일(≈798px)을 400px 가까이 넘겨,
// 아래쪽 그룹이 아무 신호 없이 접힘선 밖으로 밀려나 있었다.
//
// DOM 계약은 그대로 둔다 — databaseSidebarKeyboard.test.ts 가 `.db-tab` 버튼 정확히 29 개,
// `.db-tab-group` 정확히 5 개이며 전부 DIV 일 것을 고정하고, databaseNavMode.test.ts 는
// 탭이 `<details>` 안에 들어가면 안 된다고 못박는다. 그래서 그룹을 <details> 로 감싸거나
// 헤더를 <button> 으로 바꾸지 않고, **그룹 div 의 자식**으로 토글 버튼을 넣고 형제
// `.db-tab` 들에 `hidden` 을 건다 — applyTabFilter 가 이미 쓰는 것과 같은 메커니즘이라
// 검색과 접힘이 자연스럽게 합성된다.
// ---------------------------------------------------------------------------

const DATABASE_NAV_COLLAPSED_KEY = "oprn:database.navCollapsed";

/**
 * 기본값은 **전부 펼침**이다. 한때 "전부 접힘"을 기본으로 뒀는데, 접힌 탭은
 * `display: none` 이라 첫 화면에서 29 개 중 24 개가 상자 크기 0 이 된다 — 사람에게는
 * 안 보이는 게 문제고, Playwright 는 `click({ force: true })` 조차 빈 상자에는 못 쏘므로
 * 탭 전환으로 시작하는 e2e 스펙이 전부 첫 줄에서 죽었다(qa-crops, common-events 등에서
 * 실측 확인). 접기는 사용자가 고르는 밀도 도구로 남기고, 선택은 그대로 저장한다.
 */
function readCollapsedGroups(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DATABASE_NAV_COLLAPSED_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((entry): entry is string => typeof entry === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsedGroups(collapsed: ReadonlySet<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATABASE_NAV_COLLAPSED_KEY, JSON.stringify(Array.from(collapsed)));
  } catch {
    // 저장 실패는 접힘 상태를 세션 한정으로 만들 뿐이라 조용히 넘긴다.
  }
}

function groupHeader(group: DatabaseTabGroup, header: HTMLElement): HTMLElement {
  // 태그는 DIV 로 유지해야 한다(키보드 탭 순서 계약). 포커스 가능한 건 안쪽 토글뿐.
  const node = el("div", {
    class: "db-tab-group",
    text: group.label,
    dataset: { group: group.label },
  });
  // 셰브런은 CSS(::before)로 그린다. 버튼에 문자를 넣으면 그룹 div 의 textContent 가
  // "▾파티" 가 되어 databaseSidebarNav.test.ts 의 라벨 동등 비교가 깨진다.
  const toggle = el("button", {
    class: "db-tab-group-toggle",
    attrs: { type: "button", "aria-expanded": "true", "aria-label": `${group.label} 그룹 접기/펼치기` },
    dataset: { testid: `db-tab-group-toggle-${group.label}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        const collapsed = readCollapsedGroups();
        if (collapsed.has(group.label)) collapsed.delete(group.label);
        else collapsed.add(group.label);
        writeCollapsedGroups(collapsed);
        applyGroupCollapse(header);
      },
    },
  });
  node.prepend(toggle);
  return node;
}

/** 그룹별 탭 수를 헤더에 얹는다 — 접혀 있어도 어디에 데이터가 있는지 보이게. */
function groupMemberCount(label: string): number {
  const group = TAB_GROUPS.find((entry) => entry.label === label);
  if (!group) return 0;
  return group.tabs.reduce((sum, id) => sum + (databaseTabCount(id) ?? 0), 0);
}

function applyGroupCollapse(header: HTMLElement): void {
  // 접힘은 `hidden` 속성이 아니라 클래스로 표현한다. `hidden` 은 applyTabFilter 가
  // 검색용으로 이미 쓰고 있어 두 기능이 서로를 덮어쓰고, 좁은 폭(≤799px)의 아이콘
  // 레일에서는 그룹 헤더가 통째로 사라지므로 접힘만 CSS 로 무력화할 수 있어야 한다.
  if (header.dataset.filtering === "1") {
    for (const child of Array.from(header.children)) {
      if (child instanceof HTMLElement) child.classList.remove("db-tab-collapsed");
    }
    return;
  }
  const collapsed = readCollapsedGroups();
  const activeGroup = TAB_GROUPS.find((group) => group.tabs.includes(activeTab))?.label;

  let currentLabel: string | null = null;
  let currentCollapsed = false;
  for (const child of Array.from(header.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.classList.contains("db-tab-group")) {
      currentLabel = child.dataset.group ?? child.textContent ?? "";
      // 지금 보고 있는 탭이 든 그룹은 접혀 있어도 강제로 편다.
      currentCollapsed = collapsed.has(currentLabel) && currentLabel !== activeGroup;
      child.classList.toggle("collapsed", currentCollapsed);
      child.dataset.count = String(groupMemberCount(currentLabel));
      const toggle = child.querySelector(".db-tab-group-toggle");
      if (toggle instanceof HTMLElement) toggle.setAttribute("aria-expanded", currentCollapsed ? "false" : "true");
      continue;
    }
    if (!child.classList.contains("db-tab")) continue;
    if (currentLabel === null) continue; // 개요 엔트리는 그룹 밖이라 항상 보인다.
    child.classList.toggle("db-tab-collapsed", currentCollapsed);
  }
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
  // 새로 활성화된 탭이 접힌 그룹 안이면 그 그룹을 펴 준다.
  applyGroupCollapse(header);
  revealActiveTab(header);
}

function revealActiveTab(header: HTMLElement): void {
  const active = header.querySelector(".db-tab.active");
  if (!(active instanceof HTMLElement) || typeof active.scrollIntoView !== "function") return;
  active.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function renderActiveTab(
  body: HTMLElement,
  container: HTMLElement,
  options: { readonly forceFresh?: boolean } = {},
): void {
  const tab = activeTab;
  let cache = tabRenderCacheFor(container);
  const cached = options.forceFresh ? undefined : cache.views.get(tab);
  if (cached) {
    body.replaceChildren(...cached);
    return;
  }

  body.replaceChildren();
  const rerender = (): void => {
    // A debounced callback from a tab that has since been detached must not repaint
    // whichever tab is currently visible. Its cache entry is simply made cold.
    if (activeTab !== tab) {
      tabRenderCacheFor(container).views.delete(tab);
      return;
    }
    renderActiveTab(body, container, { forceFresh: true });
    refreshTabCounts(container);
  };
  if (tab === "enemies" || tab === "monsterSpecies" || tab === "troops") {
    const banner = collectionGateBanner(container);
    if (banner) body.append(banner);
  }
  switch (tab) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      renderRecordTab(body, tab, rerender);
      break;
    case "animations":
      renderRecordTab(body, "battleAnimations", rerender);
      break;
    case "elements":
      renderElementsTab(body);
      break;
    case "terrain":
      renderTerrainTab(body);
      break;
    case "battleScreen":
      renderBattleScreenTab(body);
      break;
    case "battleCommands":
      renderBattleCommandsTab(body);
      break;
    case "monsterSpecies":
      renderMonsterSpeciesTab(body, rerender);
      break;
    case "crops":
      renderCropTab(body, rerender);
      break;
    case "characters":
      renderCharactersTab(body, rerender);
      break;
    case "lifeCrafting":
      renderLifeCraftingTab(body, rerender);
      break;
    case "dailyWeather":
      renderDailyWeatherTab(body, rerender);
      break;
    case "farmAnimals":
      renderFarmAnimalsTab(body, rerender);
      break;
    case "farmSpatial":
      renderFarmSpatialTab(body, rerender);
      break;
    case "lifeCollections":
      renderLifeCollectionsTab(body, rerender);
      break;
    case "switches":
      renderSwitchesTab(body, rerender);
      break;
    case "variables":
      renderVariablesTab(body, rerender);
      break;
    case "commonEvents":
      renderCommonEventsTab(body, rerender);
      break;
    case "tilesets":
      renderTilesetsTab(body, rerender);
      break;
    case "structureKits":
      renderStructureKitsTab(body, rerender);
      break;
    case "system":
      renderSystemTab(body, rerender);
      break;
    case "terms":
      renderTermsTab(body, rerender);
      break;
    case "overview":
      renderOverviewTab(body, rerender);
      break;
  }

  // A renderer may update the store while normalizing its own view. Re-read the
  // project after rendering so such a mutation invalidates every older tab entry.
  cache = tabRenderCacheFor(container);
  cache.views.set(tab, Array.from(body.childNodes));
}

function tabRenderCacheFor(container: HTMLElement): DatabaseTabRenderCache {
  const project = store.getCurrent();
  const current = tabRenderCaches.get(container);
  if (current?.project === project) return current;
  const next: DatabaseTabRenderCache = { project, views: new Map() };
  tabRenderCaches.set(container, next);
  return next;
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
