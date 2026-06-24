import { clearChildren, el } from "@/util/dom";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { renderRecordTab } from "@/editor/panels/databaseRecordViews";
import { databaseWorkbenchStatusText, type DatabaseWorkbenchSummary } from "@/editor/panels/databaseWorkbench";
import {
  renderCommonEventsTab,
  renderSwitchesTab,
  renderSystemTab,
  renderTermsTab,
  renderVariablesTab,
} from "@/editor/panels/databaseUtilityViews";
import { renderTilesetsTab } from "@/editor/panels/tilesetSettingsPanel";

export type DatabaseTab =
  | DatabaseCollection
  | "animations"
  | "commonEvents"
  | "system"
  | "terms"
  | "switches"
  | "tilesets"
  | "variables";

const tabs: readonly { readonly id: DatabaseTab; readonly label: string; readonly testid: string }[] = [
  { id: "actors", label: "주인공", testid: "db-tab-actors" },
  { id: "classes", label: "직업", testid: "db-tab-classes" },
  { id: "skills", label: "스킬", testid: "db-tab-skills" },
  { id: "items", label: "아이템", testid: "db-tab-items" },
  { id: "equipment", label: "장비", testid: "db-tab-equipment" },
  { id: "enemies", label: "몬스터", testid: "db-tab-enemies" },
  { id: "troops", label: "적 그룹", testid: "db-tab-troops" },
  { id: "states", label: "상태", testid: "db-tab-states" },
  { id: "animations", label: "전투 애니메이션", testid: "db-tab-animations" },
  { id: "tilesets", label: "타일셋", testid: "db-tab-tilesets" },
  { id: "commonEvents", label: "공통 이벤트", testid: "db-tab-common-events" },
  { id: "system", label: "시스템", testid: "db-tab-system" },
  { id: "terms", label: "용어", testid: "db-tab-terms" },
  { id: "switches", label: "스위치", testid: "db-tab-switches" },
  { id: "variables", label: "변수", testid: "db-tab-variables" },
];

const DATABASE_ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";

let activeTab: DatabaseTab = readStoredActiveTab();

export function renderDatabasePanel(container: HTMLElement): void {
  clearChildren(container);
  const activeTabMeta = tabMeta(activeTab);
  const header = el("div", { class: "db-tabs" });
  for (const tab of tabs) {
    header.append(
      el("button", {
        class: `db-tab${activeTab === tab.id ? " active" : ""}`,
        text: tab.label,
        dataset: { testid: tab.testid },
        on: {
          click: () => {
            setActiveTab(tab.id);
            renderDatabasePanel(container);
          },
        },
      })
    );
  }

  const body = el("div", { class: "db-body" });
  renderActiveTab(body, container);
  const status = el("div", {
    class: "db-workbench-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-workbench-status" },
    text: databaseWorkbenchStatusText(activeTabSummary(activeTabMeta, body)),
  });
  container.append(header, status, body);
}

function renderActiveTab(body: HTMLElement, container: HTMLElement): void {
  switch (activeTab) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      renderRecordTab(body, activeTab, () => renderDatabasePanel(container));
      return;
    case "animations":
      renderRecordTab(body, "battleAnimations", () => renderDatabasePanel(container));
      return;
    case "switches":
      renderSwitchesTab(body, () => renderDatabasePanel(container));
      return;
    case "variables":
      renderVariablesTab(body, () => renderDatabasePanel(container));
      return;
    case "commonEvents":
      renderCommonEventsTab(body, () => renderDatabasePanel(container));
      return;
    case "tilesets":
      renderTilesetsTab(body, () => renderDatabasePanel(container));
      return;
    case "system":
      renderSystemTab(body);
      return;
    case "terms":
      renderTermsTab(body);
      return;
  }
}

function setActiveTab(tab: DatabaseTab): void {
  activeTab = tab;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DATABASE_ACTIVE_TAB_KEY, tab);
}

function tabMeta(tabId: DatabaseTab): { readonly id: DatabaseTab; readonly label: string } {
  return tabs.find((tab) => tab.id === tabId) ?? tabs[0];
}

function activeTabSummary(tab: { readonly id: DatabaseTab; readonly label: string }, body: HTMLElement): DatabaseWorkbenchSummary {
  const activeRow = recordCollectionForTab(tab.id) ? body.querySelector<HTMLElement>(".db-list-row.active") : null;
  return {
    recordId: activeRow?.dataset.recordId,
    recordName: activeRow?.dataset.recordName,
    selectedIndex: numericDataset(activeRow, "recordIndex"),
    tabId: tab.id,
    tabLabel: tab.label,
    totalCount: numericDataset(activeRow, "recordTotal"),
  };
}

function numericDataset(node: HTMLElement | null, key: string): number | undefined {
  if (!node) return undefined;
  const value = node.dataset[key];
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordCollectionForTab(tab: DatabaseTab): DatabaseCollection | undefined {
  switch (tab) {
    case "actors":
    case "classes":
    case "skills":
    case "items":
    case "equipment":
    case "enemies":
    case "troops":
    case "states":
      return tab;
    case "animations":
      return "battleAnimations";
    case "commonEvents":
    case "switches":
    case "system":
    case "terms":
    case "tilesets":
    case "variables":
      return undefined;
  }
  return undefined;
}

function readStoredActiveTab(): DatabaseTab {
  if (typeof window === "undefined") return "actors";
  const stored = window.localStorage.getItem(DATABASE_ACTIVE_TAB_KEY);
  return isDatabaseTab(stored) ? stored : "actors";
}

function isDatabaseTab(value: string | null): value is DatabaseTab {
  return tabs.some((tab) => tab.id === value);
}
