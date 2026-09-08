import { uiLabel } from "@/editor/uiCopy";
import type { ProductTerminology, TerminologyEntry, TerminologyIssue } from "./terminologyTypes";

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/;

/**
 * Well-formedness of the map itself. Deliberately does *not* scan product
 * source strings — that would be a different, much larger gate, and this one
 * has to stay cheap enough to run on every change.
 */
export function checkProductTerminology(terminology: ProductTerminology): readonly TerminologyIssue[] {
  const issues: TerminologyIssue[] = [];
  const entries = terminology.entries;

  pushKeyIssues(issues, entries);
  pushEmptyFieldIssues(issues, entries);
  pushCollisionIssues(issues, entries, (entry) => entry.en, "duplicate-english-without-note", "English");
  pushCollisionIssues(issues, entries, (entry) => entry.ko, "duplicate-korean-without-note", "Korean");
  pushAliasIssues(issues, entries);
  pushUiCopyIssues(issues, entries);
  pushSupportIssues(issues, terminology);

  return issues;
}

function pushKeyIssues(issues: TerminologyIssue[], entries: readonly TerminologyEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) issues.push({ code: "duplicate-key", message: `${entry.key} is defined more than once` });
    seen.add(entry.key);
    if (!KEY_PATTERN.test(entry.key)) {
      issues.push({ code: "malformed-key", message: `${entry.key} must look like area.concept in lower camel case` });
    }
  }
}

function pushEmptyFieldIssues(issues: TerminologyIssue[], entries: readonly TerminologyEntry[]): void {
  for (const entry of entries) {
    for (const [field, value] of [["ko", entry.ko], ["en", entry.en]] as const) {
      if (value.trim().length === 0) issues.push({ code: "empty-term", message: `${entry.key} has an empty ${field} term` });
    }
    if (entry.note !== undefined && entry.note.trim().length === 0) {
      issues.push({ code: "empty-note", message: `${entry.key} has an empty note; omit the field instead` });
    }
    if (entry.sources.length === 0) {
      issues.push({ code: "missing-source", message: `${entry.key} cites no source path` });
    }
    for (const optional of [entry.shortKo, entry.shortEn]) {
      if (optional !== undefined && optional.trim().length === 0) {
        issues.push({ code: "empty-short-label", message: `${entry.key} has an empty short label; omit the field instead` });
      }
    }
    if (entry.shortKo !== undefined && entry.shortKo === entry.ko) {
      issues.push({ code: "redundant-short-label", message: `${entry.key} repeats its Korean term as a short label` });
    }
    if (entry.shortEn !== undefined && entry.shortEn.toLowerCase() === entry.en.toLowerCase()) {
      issues.push({ code: "redundant-short-label", message: `${entry.key} repeats its English term as a short label` });
    }
  }
}

/**
 * Two entries may share a term only if both explain the difference. This is the
 * rule that stops map/scene, event/command, and tile/tileset from silently
 * merging once somebody translates them.
 */
function pushCollisionIssues(
  issues: TerminologyIssue[],
  entries: readonly TerminologyEntry[],
  term: (entry: TerminologyEntry) => string,
  code: string,
  language: string,
): void {
  const grouped = new Map<string, TerminologyEntry[]>();
  for (const entry of entries) {
    const normalized = term(entry).trim().toLowerCase();
    const bucket = grouped.get(normalized);
    if (bucket) bucket.push(entry);
    else grouped.set(normalized, [entry]);
  }
  for (const [normalized, bucket] of grouped) {
    if (bucket.length < 2) continue;
    const unexplained = bucket.filter((entry) => (entry.note ?? "").trim().length === 0);
    if (unexplained.length === 0) continue;
    issues.push({
      code,
      message: `${language} term "${normalized}" is shared by ${bucket.map((entry) => entry.key).join(", ")} but ${unexplained
        .map((entry) => entry.key)
        .join(", ")} carries no disambiguation note`,
    });
  }
}

function pushAliasIssues(issues: TerminologyIssue[], entries: readonly TerminologyEntry[]): void {
  const canonicalKo = new Map(entries.map((entry) => [entry.ko, entry.key]));
  const canonicalEn = new Map(entries.map((entry) => [entry.en.trim().toLowerCase(), entry.key]));
  for (const entry of entries) {
    const accepted = entry.acceptedKoAliases ?? [];
    const deprecated = entry.deprecatedKoAliases ?? [];
    for (const alias of [...accepted, ...deprecated]) {
      if (alias.trim().length === 0) {
        issues.push({ code: "empty-alias", message: `${entry.key} lists an empty Korean alias` });
        continue;
      }
      if (alias === entry.ko) {
        issues.push({ code: "alias-equals-canonical", message: `${entry.key} lists its own canonical term "${alias}" as an alias` });
      }
      const owner = canonicalKo.get(alias);
      if (owner && owner !== entry.key) {
        issues.push({
          code: "alias-shadows-canonical",
          message: `${entry.key} claims "${alias}" as an alias but it is the canonical Korean term of ${owner}`,
        });
      }
    }
    for (const alias of accepted) {
      if (deprecated.includes(alias)) {
        issues.push({ code: "alias-both-states", message: `${entry.key} lists "${alias}" as both accepted and deprecated` });
      }
    }
    for (const rejected of entry.rejectedEnAliases ?? []) {
      const normalized = rejected.trim().toLowerCase();
      if (normalized.length === 0) {
        issues.push({ code: "empty-alias", message: `${entry.key} lists an empty rejected English alias` });
        continue;
      }
      if (normalized === entry.en.trim().toLowerCase()) {
        issues.push({ code: "alias-equals-canonical", message: `${entry.key} rejects its own English term "${rejected}"` });
      }
      // Refusing a word another entry owns is the point of the field — but the
      // reader has to be told which concept won it.
      const owner = canonicalEn.get(normalized);
      if (owner && owner !== entry.key && (entry.note ?? "").trim().length === 0) {
        issues.push({
          code: "refused-word-without-note",
          message: `${entry.key} refuses "${rejected}" which is the English term of ${owner}, but carries no disambiguation note`,
        });
      }
    }
    for (const rejected of entry.rejectedKoAliases ?? []) {
      if (rejected.trim().length === 0) {
        issues.push({ code: "empty-alias", message: `${entry.key} lists an empty rejected Korean alias` });
        continue;
      }
      if (rejected === entry.ko) {
        issues.push({ code: "alias-equals-canonical", message: `${entry.key} rejects its own Korean term "${rejected}"` });
      }
      if (accepted.includes(rejected) || deprecated.includes(rejected)) {
        issues.push({ code: "alias-both-states", message: `${entry.key} both rejects and allows "${rejected}"` });
      }
    }
  }
}

/** The map must not drift away from the Korean label registry it describes. */
function pushUiCopyIssues(issues: TerminologyIssue[], entries: readonly TerminologyEntry[]): void {
  const claimed = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.uiCopyKey) continue;
    const owner = claimed.get(entry.uiCopyKey);
    if (owner) {
      issues.push({
        code: "duplicate-ui-copy-key",
        message: `${entry.key} and ${owner} both claim uiCopy key ${entry.uiCopyKey}`,
      });
    } else {
      claimed.set(entry.uiCopyKey, entry.key);
    }
    const published = [uiLabel(entry.uiCopyKey, "plain"), uiLabel(entry.uiCopyKey, "technical")];
    if (published.includes(entry.ko)) continue;
    issues.push({
      code: "ui-copy-disagreement",
      message: `${entry.key} says "${entry.ko}" but uiCopy ${entry.uiCopyKey} publishes ${published.map((value) => `"${value}"`).join(" / ")}`,
    });
  }
}

function pushSupportIssues(issues: TerminologyIssue[], terminology: ProductTerminology): void {
  const localeIds = new Set<string>();
  for (const surface of terminology.localeSensitiveSurfaces) {
    if (localeIds.has(surface.id)) {
      issues.push({ code: "duplicate-locale-surface", message: `${surface.id} is defined more than once` });
    }
    localeIds.add(surface.id);
    if (surface.sources.length === 0) {
      issues.push({ code: "missing-source", message: `locale surface ${surface.id} cites no source path` });
    }
  }
  const boundaryIds = new Set<string>();
  for (const rule of terminology.translationBoundary) {
    if (boundaryIds.has(rule.id)) {
      issues.push({ code: "duplicate-boundary-rule", message: `${rule.id} is defined more than once` });
    }
    boundaryIds.add(rule.id);
    if (rule.examples.length === 0) {
      issues.push({ code: "missing-boundary-example", message: `boundary rule ${rule.id} gives no example` });
    }
  }
  for (const rule of terminology.translationBoundary) {
    if (rule.owner === "author" && rule.translated) {
      issues.push({
        code: "author-content-marked-translatable",
        message: `boundary rule ${rule.id} would let a translation pass rewrite user-authored content`,
      });
    }
  }
  if (!terminology.translationBoundary.some((rule) => rule.translated)) {
    issues.push({ code: "missing-translated-boundary", message: "no boundary rule marks anything as product-owned text" });
  }
  if (!terminology.translationBoundary.some((rule) => rule.owner === "author")) {
    issues.push({ code: "missing-untranslated-boundary", message: "no boundary rule protects user-authored content" });
  }
}
