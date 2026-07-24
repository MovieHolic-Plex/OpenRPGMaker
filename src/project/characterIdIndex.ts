import type { CharacterProfile, MapId, Project } from "@/project/types";

export type CharacterIdUsageHost = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
};

export type CharacterIdIndexEntry = {
  readonly characterId: string;
  readonly profile?: CharacterProfile;
  /** True when a profile object exists under project.characters[characterId]. */
  readonly hasProfile: boolean;
  readonly hosts: readonly CharacterIdUsageHost[];
  readonly usageCount: number;
  readonly mapCount: number;
  /** Event-used id with no project.characters profile. */
  readonly isOrphan: boolean;
  /** Profile exists but no map event currently uses this id. */
  readonly isUnusedProfile: boolean;
};

function trimCharacterId(value: string | undefined | null): string | undefined {
  const id = value?.trim();
  return id ? id : undefined;
}

/**
 * Collect every CharacterId used by map events or present in project.characters.
 * Shared by the event picker dialog and database character catalog.
 */
export function listCharacterIdIndex(project: Project): CharacterIdIndexEntry[] {
  const hostsById = new Map<string, CharacterIdUsageHost[]>();

  for (const [mapId, map] of Object.entries(project.maps)) {
    for (const event of map.events) {
      const characterId = trimCharacterId(event.characterId);
      if (!characterId) continue;
      const list = hostsById.get(characterId) ?? [];
      list.push({
        mapId,
        eventId: event.id,
        x: event.x,
        y: event.y,
      });
      hostsById.set(characterId, list);
    }
  }

  const ids = new Set<string>([...hostsById.keys(), ...Object.keys(project.characters ?? {})]);
  const entries: CharacterIdIndexEntry[] = [];

  for (const characterId of ids) {
    const profile = project.characters?.[characterId];
    const hosts = hostsById.get(characterId) ?? [];
    const mapCount = new Set(hosts.map((host) => host.mapId)).size;
    const hasProfile = profile !== undefined;
    entries.push({
      characterId,
      profile,
      hasProfile,
      hosts,
      usageCount: hosts.length,
      mapCount,
      isOrphan: !hasProfile && hosts.length > 0,
      isUnusedProfile: hasProfile && hosts.length === 0,
    });
  }

  entries.sort((a, b) => {
    const aName = a.profile?.displayName?.trim() || a.characterId;
    const bName = b.profile?.displayName?.trim() || b.characterId;
    return aName.localeCompare(bName, "ko") || a.characterId.localeCompare(b.characterId, "ko");
  });

  return entries;
}

// ── Client-side cache ─────────────────────────────────────────────
// store.update() / updateMap() / replace() all produce a new project
// reference (structuredClone or object spread), so reference identity is a
// perfect cache key.  During rapid interactions (autocomplete keystrokes,
// dialog re-renders) the same project reference is returned and the expensive
// full-scan is skipped entirely.

let _cachedProject: Project | null = null;
let _cachedEntries: CharacterIdIndexEntry[] = [];

/**
 * Cached version of {@link listCharacterIdIndex}.
 *
 * Returns the same array instance when `project` has not changed (by
 * reference), avoiding repeated O(maps × events) scans during autocomplete
 * typing and dialog re-renders.  The cache is invalidated automatically
 * whenever a different project reference is passed — which happens on every
 * store mutation because the store clones before emit.
 */
export function getCachedCharacterIdIndex(project: Project): CharacterIdIndexEntry[] {
  if (_cachedProject === project) return _cachedEntries;
  _cachedProject = project;
  _cachedEntries = listCharacterIdIndex(project);
  return _cachedEntries;
}

/** Drop the cache.  Useful in tests that swap project references manually. */
export function invalidateCharacterIdIndexCache(): void {
  _cachedProject = null;
  _cachedEntries = [];
}

export function findCharacterIdEntry(
  project: Project,
  characterId: string | undefined | null
): CharacterIdIndexEntry | undefined {
  const id = trimCharacterId(characterId);
  if (!id) return undefined;
  return listCharacterIdIndex(project).find((entry) => entry.characterId === id);
}

export function characterIdExists(project: Project, characterId: string | undefined | null): boolean {
  const id = trimCharacterId(characterId);
  if (!id) return false;
  if (project.characters?.[id] !== undefined) return true;
  for (const map of Object.values(project.maps)) {
    if (map.events.some((event) => trimCharacterId(event.characterId) === id)) return true;
  }
  return false;
}
