import type { DatabaseCollection } from "@/editor/databaseActions";
import type { DatabaseTab } from "@/editor/panels/database";
import type { DatabaseWorkbenchSummary } from "@/editor/panels/databaseWorkbench";
import { selectedUtilityRecordIndex } from "@/editor/panels/databaseUtilityRecordControls";
import { store } from "@/project/store";

export function activeTabSummary(tab: { readonly id: DatabaseTab; readonly label: string }, body: HTMLElement): DatabaseWorkbenchSummary {
  const utilitySummary = utilityDatabaseSummary(tab);
  if (utilitySummary) return utilitySummary;
  if (tab.id === "switches" || tab.id === "variables") {
    const activeRow = body.querySelector<HTMLElement>(".db-utility-row.active");
    return {
      recordId: activeRow?.dataset.recordId,
      recordName: activeRow?.dataset.recordName,
      selectedIndex: numericDataset(activeRow, "recordIndex"),
      tabId: tab.id,
      tabLabel: tab.label,
      totalCount: numericDataset(activeRow, "recordTotal"),
    };
  }
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
    case "battleCommands":
    case "battleScreen":
    case "commonEvents":
    case "elements":
    case "switches":
    case "system":
    case "terms":
    case "terrain":
    case "tilesets":
    case "variables":
      return undefined;
  }
  return undefined;
}

function utilityDatabaseSummary(tab: { readonly id: DatabaseTab; readonly label: string }): DatabaseWorkbenchSummary | undefined {
  const database = store.getCurrent().database;
  switch (tab.id) {
    case "elements": {
      const index = selectedUtilityRecordIndex("elements");
      const record = database.elements?.[index] ?? database.elements?.[0];
      return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: tab.id, tabLabel: tab.label, totalCount: database.elements?.length };
    }
    case "terrain": {
      const index = selectedUtilityRecordIndex("terrain");
      const record = database.terrains?.[index] ?? database.terrains?.[0];
      return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: tab.id, tabLabel: tab.label, totalCount: database.terrains?.length };
    }
    case "battleCommands": {
      const index = selectedUtilityRecordIndex("battleCommands");
      const record = database.battleCommands?.[index] ?? database.battleCommands?.[0];
      return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: tab.id, tabLabel: tab.label, totalCount: database.battleCommands?.length };
    }
    default:
      return undefined;
  }
}
