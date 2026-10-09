import type { DatabaseTab } from "@/editor/panels/database";
import type { WorldTabKey } from "@/editor/panels/worldManager";

const CODEX_URL_TABS: readonly WorldTabKey[] = [
  "overview",
  "character",
  "place-faction",
  "event",
  "item-concept",
  "guideline",
  "place",
  "faction",
  "item",
  "concept",
];

export const WORLD_ENTRY_TAB: DatabaseTab = "worldCanon";
export const WORLD_CODEX_ENTRY_TAB: DatabaseTab = "worldCodex";

export function openWorldPanel(): Promise<void> {
  return openWorldEntryTab(WORLD_ENTRY_TAB);
}

export function openWorldCodexPanel(): Promise<void> {
  return openWorldEntryTab(WORLD_CODEX_ENTRY_TAB);
}

function openWorldEntryTab(tab: DatabaseTab): Promise<void> {
  return import("./databaseModal").then(({ openDatabaseModal }) => {
    openDatabaseModal(tab);
  });
}

export const CODEX_URL_TAB_PARAM = "codexTab";
export const CODEX_URL_ENTITY_PARAM = "codexEntity";

export type CodexUrlEntry = { readonly tab: WorldTabKey; readonly entityId: string };

export function readCodexEntryFromUrl(search: string): CodexUrlEntry | null {
  const params = parseSearch(search);
  if (!params) return null;
  const tab = (params.get(CODEX_URL_TAB_PARAM) ?? "").trim();
  const entityId = (params.get(CODEX_URL_ENTITY_PARAM) ?? "").trim();
  if (!tab || !entityId) return null;
  if (!CODEX_URL_TABS.includes(tab as WorldTabKey)) return null;
  return { tab: tab as WorldTabKey, entityId };
}

export function writeCodexEntryToUrl(tab: WorldTabKey, entityId: string | null): void {
  if (typeof window === "undefined" || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (entityId) {
      url.searchParams.set(CODEX_URL_TAB_PARAM, tab);
      url.searchParams.set(CODEX_URL_ENTITY_PARAM, entityId);
    } else {
      url.searchParams.delete(CODEX_URL_TAB_PARAM);
      url.searchParams.delete(CODEX_URL_ENTITY_PARAM);
    }
    window.history.replaceState({ codexTab: tab, codexEntityId: entityId }, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* malformed location — deep link is best-effort */
  }
}

function parseSearch(search: string): URLSearchParams | null {
  try {
    return new URLSearchParams(search.startsWith("?") || search === "" ? search : `?${search}`);
  } catch {
    return null;
  }
}
