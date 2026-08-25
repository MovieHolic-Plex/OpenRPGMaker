import type { GameEvent, MapId, Project } from "@/project/types";
import { supabaseProjectConfig } from "@/project/supabaseProjectConfig";

export type EventDraftVaultEntry = {
  readonly mapId: MapId;
  readonly event: GameEvent;
  readonly updatedAt: number;
};

const vault = new Map<string, EventDraftVaultEntry>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DELAY_MS = 250;

export function eventDraftVaultKey(mapId: MapId, eventId: string): string {
  return `${mapId}::${eventId}`;
}

export function clearEventDraftVault(): void {
  vault.clear();
  scheduleEventDraftVaultPersist();
}

export function forgetEventDraftVaultEntry(mapId: MapId, eventId: string): void {
  if (!vault.delete(eventDraftVaultKey(mapId, eventId))) return;
  scheduleEventDraftVaultPersist();
}

export function rememberEventDraftVaultEntry(mapId: MapId, event: GameEvent): void {
  if (!event.draft) {
    forgetEventDraftVaultEntry(mapId, event.id);
    return;
  }
  vault.set(eventDraftVaultKey(mapId, event.id), {
    mapId,
    event: structuredClone(event),
    updatedAt: Date.now(),
  });
  scheduleEventDraftVaultPersist();
}

export function syncEventDraftVaultFromProject(project: Project): void {
  const liveKeys = new Set<string>();
  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events) {
      if (!event.draft) continue;
      const key = eventDraftVaultKey(mapId, event.id);
      liveKeys.add(key);
      vault.set(key, {
        mapId,
        event: structuredClone(event),
        updatedAt: Date.now(),
      });
    }
  }
  // Do not drop vault entries that are only temporarily missing from project —
  // reapply path restores them. Explicit forget/clear handles intentional discard.
  if (liveKeys.size > 0) scheduleEventDraftVaultPersist();
}

export function listEventDraftVaultEntries(): readonly EventDraftVaultEntry[] {
  return [...vault.values()].map((entry) => ({
    mapId: entry.mapId,
    event: structuredClone(entry.event),
    updatedAt: entry.updatedAt,
  }));
}

/** Restore an in-memory vault snapshot after an aborted local project switch. */
export function restoreEventDraftVaultEntries(entries: readonly EventDraftVaultEntry[]): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  vault.clear();
  for (const entry of entries) {
    vault.set(eventDraftVaultKey(entry.mapId, entry.event.id), {
      mapId: entry.mapId,
      event: structuredClone(entry.event),
      updatedAt: entry.updatedAt,
    });
  }
}

export function getEventDraftVaultEntry(mapId: MapId, eventId: string): EventDraftVaultEntry | null {
  const entry = vault.get(eventDraftVaultKey(mapId, eventId));
  if (!entry) return null;
  return {
    mapId: entry.mapId,
    event: structuredClone(entry.event),
    updatedAt: entry.updatedAt,
  };
}

/**
 * Re-apply every vaulted open draft onto a project snapshot that may have lost them
 * (autosave merge, undo/replace, AI accept, remote reload).
 */
export function applyEventDraftVault(project: Project): Project {
  if (vault.size === 0) return project;
  const next = structuredClone(project);
  for (const entry of vault.values()) {
    const map = next.maps[entry.mapId];
    if (!map) continue;
    if (!entry.event.draft) continue;
    const index = map.events.findIndex((event) => event.id === entry.event.id);
    if (index >= 0) {
      map.events[index] = structuredClone(entry.event);
    } else {
      map.events.push(structuredClone(entry.event));
    }
  }
  return next;
}

/**
 * Merge live project drafts with vault, then apply vault onto `incoming`.
 * Live in-flight editor edits win; vault covers drafts missing from `live`
 * (e.g. after a remote snapshot already wiped them).
 */
export function preserveEventDraftsOnProject(incoming: Project, live: Project): Project {
  // Refresh vault from live first so in-flight editor edits win over stale vault rows.
  for (const [mapId, map] of Object.entries(live.maps)) {
    for (const event of map.events) {
      if (!event.draft) continue;
      vault.set(eventDraftVaultKey(mapId, event.id), {
        mapId,
        event: structuredClone(event),
        updatedAt: Date.now(),
      });
    }
  }
  const withLiveDrafts = projectWithLiveDrafts(incoming, live);
  return applyEventDraftVault(withLiveDrafts);
}

function projectWithLiveDrafts(incoming: Project, live: Project): Project {
  const next = structuredClone(incoming);
  for (const [mapId, liveMap] of Object.entries(live.maps)) {
    const targetMap = next.maps[mapId];
    if (!targetMap) continue;
    for (const liveEvent of liveMap.events) {
      if (!liveEvent.draft) continue;
      const index = targetMap.events.findIndex((event) => event.id === liveEvent.id);
      if (index >= 0) {
        targetMap.events[index] = structuredClone(liveEvent);
      } else {
        targetMap.events.push(structuredClone(liveEvent));
      }
    }
  }
  return next;
}

export function restoreEventFromVaultIntoProject(
  project: Project,
  mapId: MapId,
  eventId: string
): GameEvent | null {
  const entry = getEventDraftVaultEntry(mapId, eventId);
  if (!entry) return null;
  const map = project.maps[mapId];
  if (!map) return null;
  const index = map.events.findIndex((event) => event.id === eventId);
  if (index >= 0) {
    map.events[index] = structuredClone(entry.event);
  } else {
    map.events.push(structuredClone(entry.event));
  }
  return structuredClone(entry.event);
}

export function eventDraftVaultStorageKey(projectId = resolveVaultProjectId()): string {
  return `oprn:event-draft-vault:${projectId}`;
}

export function persistEventDraftVaultNow(projectId = resolveVaultProjectId()): void {
  const localStorage = browserLocalStorage();
  if (!localStorage) return;
  const key = eventDraftVaultStorageKey(projectId);
  try {
    if (vault.size === 0) {
      localStorage.removeItem(key);
      return;
    }
    const payload = {
      version: 1 as const,
      savedAt: Date.now(),
      entries: listEventDraftVaultEntries(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn("[eventDraftVault] localStorage persist failed:", error);
  }
}

export function loadEventDraftVaultFromLocalStorage(projectId = resolveVaultProjectId()): number {
  const localStorage = browserLocalStorage();
  if (!localStorage) return 0;
  const raw = localStorage.getItem(eventDraftVaultStorageKey(projectId));
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as {
      version?: number;
      entries?: Array<{ mapId?: string; event?: GameEvent; updatedAt?: number }>;
    };
    if (!Array.isArray(parsed.entries)) return 0;
    let loaded = 0;
    for (const item of parsed.entries) {
      if (!item?.mapId || !item.event?.id || !item.event.draft) continue;
      vault.set(eventDraftVaultKey(item.mapId, item.event.id), {
        mapId: item.mapId,
        event: structuredClone(item.event),
        updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
      });
      loaded += 1;
    }
    return loaded;
  } catch (error) {
    console.warn("[eventDraftVault] localStorage restore failed:", error);
    return 0;
  }
}

export function scheduleEventDraftVaultPersist(projectId = resolveVaultProjectId()): void {
  if (!browserLocalStorage()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistEventDraftVaultNow(projectId);
  }, PERSIST_DELAY_MS);
}

function browserLocalStorage(): Storage | null {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

/** @internal */
export function _resetEventDraftVaultForTest(): void {
  vault.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function resolveVaultProjectId(): string {
  return supabaseProjectConfig()?.projectId ?? "local";
}
