import type { RecentProjectEntry } from "./start";

export type RecentProjectSort = "opened" | "name";

export function filterRecentProjects<T extends Pick<RecentProjectEntry, "projectDir" | "title" | "lastOpenedAt">>(
  entries: readonly T[],
  query: string,
  sort: RecentProjectSort,
  locale = "ko",
): T[] {
  const fold = (value: string): string => value.normalize("NFC").toLocaleLowerCase(locale);
  const needle = fold(query.trim());
  const byName = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const openedAt = (entry: T): number => {
    const at = Date.parse(entry.lastOpenedAt ?? "");
    return Number.isFinite(at) ? at : Number.MIN_SAFE_INTEGER;
  };
  return entries.filter((entry) => fold(entry.title).includes(needle) || fold(entry.projectDir).includes(needle))
    .sort((a, b) => (sort === "opened" ? openedAt(b) - openedAt(a) : byName.compare(a.title, b.title)));
}

export function withoutRecentProject<T extends { readonly projectDir: string }>(entries: readonly T[], projectDir: string): T[] {
  return entries.filter((entry) => entry.projectDir !== projectDir);
}

export function upsertRecentProject<T extends { readonly projectDir: string }>(entries: readonly T[], entry: T, limit: number): T[] {
  return [entry, ...withoutRecentProject(entries, entry.projectDir)].slice(0, limit);
}
