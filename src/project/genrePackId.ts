export const GENRE_PACK_IDS = [
  "adventure-jrpg",
  "monster-collect",
  "horror-chase",
  "story-cutscene",
  "farm-life",
] as const;

export type GenrePackId = (typeof GENRE_PACK_IDS)[number];

const GENRE_PACK_ID_SET: ReadonlySet<string> = new Set(GENRE_PACK_IDS);

export function isGenrePackId(value: unknown): value is GenrePackId {
  return typeof value === "string" && GENRE_PACK_ID_SET.has(value);
}
