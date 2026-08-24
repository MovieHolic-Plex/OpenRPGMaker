/** Persisted Phase 4 pack identifiers. Keep this leaf module easy to replace with the Phase 2 registry adapter. */
export const OFFICIAL_GENRE_PACK_IDS = [
  "adventure-jrpg",
  "monster-collect",
  "horror-chase",
  "story-cutscene",
  "farm-life",
] as const;

export type OfficialGenrePackId = (typeof OFFICIAL_GENRE_PACK_IDS)[number];

export function isOfficialGenrePackId(value: string): value is OfficialGenrePackId {
  return (OFFICIAL_GENRE_PACK_IDS as readonly string[]).includes(value);
}

export function verifyExactOfficialGenrePackIds(observed: readonly string[]): Readonly<{
  ok: boolean;
  missing: readonly string[];
  extra: readonly string[];
  duplicate: readonly string[];
}> {
  const expected = OFFICIAL_GENRE_PACK_IDS as readonly string[];
  const missing = expected.filter((id) => !observed.includes(id));
  const extra = observed.filter((id) => !expected.includes(id));
  const duplicate = observed.filter((id, index) => observed.indexOf(id) !== index);
  return {
    ok: observed.length === expected.length && missing.length === 0 && extra.length === 0 && duplicate.length === 0,
    missing,
    extra,
    duplicate,
  };
}
