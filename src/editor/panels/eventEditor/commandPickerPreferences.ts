const FAVORITES_KEY = "rpgzzu.eventCommandPicker.favorites";
const RECENTS_KEY = "rpgzzu.eventCommandPicker.recents";
const RECENT_LIMIT = 8;

export type EventCommandPickerPreferences = {
  readonly favorites: readonly string[];
  readonly recents: readonly string[];
};

export function readEventCommandPickerPreferences(): EventCommandPickerPreferences {
  return {
    favorites: readStringList(FAVORITES_KEY),
    recents: readStringList(RECENTS_KEY),
  };
}

export function toggleEventCommandFavorite(commandId: string): boolean {
  const current = [...readStringList(FAVORITES_KEY)];
  const index = current.indexOf(commandId);
  const favorite = index < 0;
  if (favorite) current.push(commandId);
  else current.splice(index, 1);
  writeStringList(FAVORITES_KEY, current);
  return favorite;
}

export function recordRecentEventCommand(commandId: string): void {
  const next = [commandId, ...readStringList(RECENTS_KEY).filter((entry) => entry !== commandId)]
    .slice(0, RECENT_LIMIT);
  writeStringList(RECENTS_KEY, next);
}

function readStringList(key: string): readonly string[] {
  try {
    const raw = browserStorage()?.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))];
  } catch {
    return [];
  }
}

function writeStringList(key: string, values: readonly string[]): void {
  try {
    browserStorage()?.setItem(key, JSON.stringify(values));
  } catch {
    // Private browsing/storage denial must not block command authoring.
  }
}

function browserStorage(): Storage | null {
  try {
    return (globalThis as { readonly localStorage?: Storage }).localStorage ?? null;
  } catch {
    return null;
  }
}
