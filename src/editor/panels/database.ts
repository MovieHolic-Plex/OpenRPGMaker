import type { DatabaseCollection } from "@/editor/databaseActions";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { renderCharactersTab } from "@/editor/panels/databaseCharacterView";
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
  { id: "crops", label: "작물", testid: "db-tab-crops" },
  { id: "characters", label: "캐릭터", testid: "db-tab-characters" },
  { id: "equipment", label: "장비", testid: "db-tab-equipment" },
  { id: "enemies", label: "몬스터", testid: "db-tab-enemies" },
  { id: "monsterSpecies", label: "종족", testid: "db-tab-monster-species" },
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
  "crops",
  "characters",
  "enemies",
  "monsterSpecies",
  "troops",
  "elements",
  "states",
  "animations",
  "battleScreen",
  "battleCommands",
  "terrain",
  "tilesets",
  "structureKits",
  "commonEvents",
  "system",
  "terms",
  "switches",
  "variables",
];

const orderedTabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = tabOrder.map(tabFor);

export type DatabaseTabGroup = {
  readonly label: string;
  readonly tabs: readonly DatabaseTab[];
};

// 사이드바 그룹 라벨/순서만 정의한다 — 탭 id는 tabs/tabOrder 레지스트리에서 역참조하므로
// 라벨·testid는 여기서 중복 정의하지 않는다.
export const TAB_GROUPS: readonly DatabaseTabGroup[] = [
  {
    label: "전투",
    tabs: ["actors", "classes", "skills", "items", "equipment", "elements", "states", "animations", "battleScreen", "battleCommands"],
  },
  { label: "수집", tabs: ["enemies", "monsterSpecies", "troops", "crops", "characters"] },
  { label: "세계", tabs: ["terrain", "tilesets", "structureKits", "commonEvents"] },
  { label: "시스템", tabs: ["system", "terms", "switches", "variables"] },
];

function tabFor(id: DatabaseTab): { readonly id: DatabaseTab; readonly label: string; readonly testid: string } {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Missing database tab metadata: ${id}`);
  return tab;
}

const DATABASE_ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";

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
  // 세로 사이드바: 상단 고정 '개요' 엔트리(그룹 밖, todo 13) 아래 그룹 라벨(.db-tab-group)과
  // 기존 .db-tab 버튼이 이어진다. 버튼의 testid/라벨/.active 토글 계약(G006 + databaseCrossTabNav)은 그대로다.
  appendTabButton(header, body, container, tabFor("overview"));
  for (const group of TAB_GROUPS) {
    header.append(el("div", { class: "db-tab-group", text: group.label }));
    for (const id of group.tabs) {
      appendTabButton(header, body, container, tabFor(id));
    }
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
    return;
  }
  renderDatabasePanel(container);
}

function appendTabButton(
  header: HTMLElement,
  body: HTMLElement,
  container: HTMLElement,
  tab: { readonly id: DatabaseTab; readonly label: string; readonly testid: string },
): void {
  header.append(
    el("button", {
      class: `db-tab${activeTab === tab.id ? " active" : ""}`,
      text: tab.label,
      dataset: { testid: tab.testid },
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
  const rerender = (): void => renderActiveTab(body, container);
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

function readStoredActiveTab(): DatabaseTab {
  if (typeof window === "undefined") return "actors";
  const stored = window.localStorage.getItem(DATABASE_ACTIVE_TAB_KEY);
  return isDatabaseTab(stored) ? stored : "actors";
}

function isDatabaseTab(value: string | null): value is DatabaseTab {
  return orderedTabs.some((tab) => tab.id === value);
}
