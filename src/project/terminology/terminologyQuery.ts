import type { ProductTerminology, TerminologyArea, TerminologyEntry } from "./terminologyTypes";

/**
 * The documented way for UI, help text, documentation, and assistant vocabulary
 * to reach the same concept. Prose cites the key; these helpers resolve it.
 */
export function terminologyByKey(terminology: ProductTerminology, key: string): TerminologyEntry | null {
  return terminology.entries.find((entry) => entry.key === key) ?? null;
}

/** Resolve a Korean string a surface already shows, including its aliases. */
export function terminologyByKorean(terminology: ProductTerminology, korean: string): readonly TerminologyEntry[] {
  const needle = korean.trim();
  return terminology.entries.filter((entry) =>
    entry.ko === needle ||
    entry.shortKo === needle ||
    (entry.acceptedKoAliases ?? []).includes(needle) ||
    (entry.deprecatedKoAliases ?? []).includes(needle)
  );
}

/** Resolve an English term, so a translator can find what a word is already committed to. */
export function terminologyByEnglish(terminology: ProductTerminology, english: string): readonly TerminologyEntry[] {
  const needle = english.trim().toLowerCase();
  return terminology.entries.filter((entry) =>
    entry.en.toLowerCase() === needle || (entry.shortEn ?? "").toLowerCase() === needle
  );
}

export function terminologyByArea(terminology: ProductTerminology, area: TerminologyArea): readonly TerminologyEntry[] {
  return terminology.entries.filter((entry) => entry.area === area);
}

/** Entries an assistant tool id is published under. */
export function terminologyByAssistantTool(terminology: ProductTerminology, toolName: string): readonly TerminologyEntry[] {
  return terminology.entries.filter((entry) => (entry.assistantToolNames ?? []).includes(toolName));
}

/**
 * Terms whose English rendering is shared with another entry. These are the
 * pairs a translator must read the note for before choosing a word.
 */
export function terminologyEnglishCollisions(terminology: ProductTerminology): readonly (readonly TerminologyEntry[])[] {
  return collisions(terminology.entries, (entry) => entry.en.trim().toLowerCase());
}

/** Terms whose Korean wording is shared with another entry. */
export function terminologyKoreanCollisions(terminology: ProductTerminology): readonly (readonly TerminologyEntry[])[] {
  return collisions(terminology.entries, (entry) => entry.ko.trim());
}

export type ReservedEnglishWord = {
  /** The English word, lower-cased. */
  readonly word: string;
  /** Keys that refuse the word. */
  readonly refusedBy: readonly string[];
  /** Key whose canonical English term is this word, when one owns it. */
  readonly ownedBy: string | null;
};

/**
 * English words a translator must not reach for, and who owns them instead.
 *
 * Most of this map's disambiguation work shows up here rather than in
 * `terminologyEnglishCollisions`: two concepts that would have collided in
 * English were given different words, and the loser is recorded as refused.
 */
export function terminologyReservedEnglishWords(terminology: ProductTerminology): readonly ReservedEnglishWord[] {
  const owners = new Map(terminology.entries.map((entry) => [entry.en.trim().toLowerCase(), entry.key]));
  const refusals = new Map<string, string[]>();
  for (const entry of terminology.entries) {
    for (const rejected of entry.rejectedEnAliases ?? []) {
      const word = rejected.trim().toLowerCase();
      const bucket = refusals.get(word);
      if (bucket) bucket.push(entry.key);
      else refusals.set(word, [entry.key]);
    }
  }
  return [...refusals.entries()]
    .map(([word, refusedBy]) => ({ word, refusedBy, ownedBy: owners.get(word) ?? null }))
    .sort((left, right) => left.word.localeCompare(right.word));
}

function collisions(
  entries: readonly TerminologyEntry[],
  term: (entry: TerminologyEntry) => string,
): readonly (readonly TerminologyEntry[])[] {
  const grouped = new Map<string, TerminologyEntry[]>();
  for (const entry of entries) {
    const normalized = term(entry);
    const bucket = grouped.get(normalized);
    if (bucket) bucket.push(entry);
    else grouped.set(normalized, [entry]);
  }
  return [...grouped.values()].filter((bucket) => bucket.length > 1);
}
