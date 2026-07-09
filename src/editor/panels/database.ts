import type { DatabaseCollection } from "@/editor/databaseActions";
import { renderCommonEventsTab } from "@/editor/panels/databaseCommonEventViews";
import { renderCropTab } from "@/editor/panels/databaseCropView";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
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
  renderBattlerAnimationsTab,
  renderElementsTab,
  renderTerrainTab,
} from "@/editor/panels/databaseUtilityRecordViews";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";
import { clearChildren, el } from "@/util/dom";

export type DatabaseTab =
  | DatabaseCollection
  | "animations"
  | "battleCommands"
  | "battleScreen"
  | "battlerAnimations"
  | "commonEvents"
  | "crops"
  | "elements"
  | "monsterSpecies"
  | "system"
  | "terms"
  | "terrain"
  | "switches"
  | "tilesets"
  | "variables";

const tabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = [
  { id: "elements", label: "속성", testid: "db-tab-elements" },
  { id: "terrain", label: "지형", testid: "db-tab-terrain" },
  { id: "battleScreen", label: "전투 화면", testid: "db-tab-battle-screen" },
  { id: "battleCommands", label: "전투 명령", testid: "db-tab-battle-commands" },
  { id: "battlerAnimations", label: "애니메이션 2", testid: "db-tab-battler-animations" },
  { id: "actors", label: "주인공", testid: "db-tab-actors" },
  { id: "classes", label: "직업", testid: "db-tab-classes" },
  { id: "skills", label: "스킬", testid: "db-tab-skills" },
  { id: "items", label: "아이템", testid: "db-tab-items" },
  { id: "crops", label: "작물", testid: "db-tab-crops" },
  { id: "equipment", label: "장비", testid: "db-tab-equipment" },
  { id: "enemies", label: "몬스터", testid: "db-tab-enemies" },
  { id: "monsterSpecies", label: "Species", testid: "db-tab-monster-species" },
  { id: "troops", label: "적 그룹", testid: "db-tab-troops" },
  { id: "states", label: "상태", testid: "db-tab-states" },
  { id: "animations", label: "전투 애니메이션", testid: "db-tab-animations" },
  { id: "tilesets", label: "타일셋", testid: "db-tab-tilesets" },
  { id: "commonEvents", label: "공용 이벤트", testid: "db-tab-common-events" },
  { id: "system", label: "시스템", testid: "db-tab-system" },
  { id: "terms", label: "용어", testid: "db-tab-terms" },
  { id: "switches", label: "스위치", testid: "db-tab-switches" },
  { id: "variables", label: "변수", testid: "db-tab-variables" },
];

const tabOrder: readonly DatabaseTab[] = [
  "actors",
  "classes",
  "skills",
  "items",
  "crops",
  "equipment",
  "enemies",
  "monsterSpecies",
  "troops",
  "elements",
  "states",
  "animations",
  "battlerAnimations",
  "battleScreen",
  "battleCommands",
  "terrain",
  "tilesets",
  "commonEvents",
  "system",
  "terms",
  "switches",
  "variables",
];

const orderedTabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = tabOrder.map((id) => {
  const tab = tabs.find((candidate) => candidate.id === id);
  if (!tab) throw new Error(`Missing database tab metadata: ${id}`);
  return tab;
});

const DATABASE_ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";

let activeTab: DatabaseTab = readStoredActiveTab();

export function setDatabaseActiveTab(tab: DatabaseTab): void {
  activeTab = tab;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATABASE_ACTIVE_TAB_KEY, tab);
}

export function renderDatabasePanel(container: HTMLElement): void {
  clearChildren(container);
  const groupTabs = el("div", {
    class: "db-classic-group-tabs",
    dataset: { testid: "db-classic-group-tabs" },
    children: [
      classicGroupTab("용어"),
      classicGroupTab("시스템"),
      classicGroupTab("시스템 2"),
      classicGroupTab("공용 이벤트"),
    ],
  });
  const header = el("div", { class: "db-tabs" });
  const body = el("div", { class: "db-body" });
  for (const tab of orderedTabs) {
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

  renderActiveTab(body, container);
  container.append(groupTabs, header, body);
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

function updateTabButtons(header: HTMLElement): void {
  const activeTestId = orderedTabs.find((tab) => tab.id === activeTab)?.testid;
  for (const button of Array.from(header.querySelectorAll(".db-tab"))) {
    if (!(button instanceof HTMLElement)) continue;
    if (button.dataset.testid === activeTestId) button.classList.add("active");
    else button.classList.remove("active");
  }
}

function classicGroupTab(label: string): HTMLElement {
  return el("span", { class: "db-classic-group-tab", text: label });
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
    case "battlerAnimations":
      renderBattlerAnimationsTab(body);
      return;
    case "monsterSpecies":
      renderMonsterSpeciesTab(body, rerender);
      return;
    case "crops":
      renderCropTab(body, rerender);
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
    case "system":
      renderSystemTab(body);
      return;
    case "terms":
      renderTermsTab(body);
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
