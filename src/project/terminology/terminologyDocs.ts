import { terminologyEnglishCollisions, terminologyKoreanCollisions, terminologyReservedEnglishWords } from "./terminologyQuery";
import type { ProductTerminology, TerminologyEntry } from "./terminologyTypes";

const AREA_ORDER = [
  "EditorShell",
  "MapEditing",
  "TilesetSemantics",
  "EventAuthoring",
  "DatabaseRecords",
  "BattleRuntime",
  "ResourcePipeline",
  "AssistantStudio",
  "ProjectPersistence",
] as const;

export function generatedProductTerminologyMarkdown(terminology: ProductTerminology): string {
  return [
    "# Korean-English Product Terminology",
    "",
    "> Generated from `src/project/terminology/`. Do not hand-edit — run",
    "> `npm run terminology:docs` after changing the source, and",
    "> `npm run terminology:check` to validate it.",
    "",
    `- Terminology schema: ${terminology.metadata.schemaVersion}`,
    `- Document language: ${terminology.metadata.documentLanguage}`,
    `- Updated: ${terminology.metadata.updatedAt}`,
    `- Entries: ${terminology.entries.length}`,
    "",
    ...terminology.metadata.notes.map((note) => `> ${note}`),
    "",
    "## How to reference a term",
    "",
    "Cite the semantic key, never the string. `map.layerGround` stays correct after",
    "any relabelling; \"바닥\" does not. Resolve a key with `terminologyByKey`, and go",
    "the other way with `terminologyByKorean` / `terminologyByEnglish`.",
    "",
    "## Terms",
    "",
    ...AREA_ORDER.flatMap((area) => areaMarkdown(area, terminology.entries.filter((entry) => entry.area === area))),
    "## English collisions",
    "",
    "Entries sharing an English rendering. Read both notes before choosing a word.",
    "",
    ...collisionMarkdown(terminologyEnglishCollisions(terminology), (entry) => entry.en),
    "",
    "## Korean collisions",
    "",
    "One Korean word, two concepts. English must keep them apart.",
    "",
    ...collisionMarkdown(terminologyKoreanCollisions(terminology), (entry) => entry.ko),
    "",
    "## Reserved and refused English words",
    "",
    "Words that would have made two concepts read alike. Do not reach for these;",
    "use the owner's term instead.",
    "",
    ...terminologyReservedEnglishWords(terminology).map(
      (reserved) =>
        `- **${reserved.word}** — refused by ${reserved.refusedBy.map(code).join(", ")}; ${reserved.ownedBy ? `owned by \`${reserved.ownedBy}\`` : "owned by no entry"}`
    ),
    "",
    "## Locale-sensitive surfaces",
    "",
    "Formatting and ordering, inventoried apart from labels. Translating a label",
    "does not fix any of these, and fixing these translates nothing.",
    "",
    ...terminology.localeSensitiveSurfaces.map(
      (surface) => `- \`${surface.id}\` (${surface.kind}, ${surface.locale}): ${surface.description} — ${surface.sources.map(code).join(", ")}`
    ),
    "",
    "## Translation boundary",
    "",
    ...terminology.translationBoundary.map(
      (rule) =>
        `- \`${rule.id}\` — **${rule.owner === "product" ? "product-owned" : "user-authored"}, ${rule.translated ? "translatable" : "never translated"}**: ${rule.description} (${rule.examples.join(", ")})`
    ),
    "",
  ].join("\n");
}

function areaMarkdown(area: string, entries: readonly TerminologyEntry[]): readonly string[] {
  if (entries.length === 0) return [];
  return [
    `### ${area}`,
    "",
    "| key | 한국어 | English | role | surface | note |",
    "| --- | --- | --- | --- | --- | --- |",
    ...entries.map(rowMarkdown),
    "",
  ];
}

function rowMarkdown(entry: TerminologyEntry): string {
  const cells = [
    `\`${entry.key}\``,
    koCell(entry),
    enCell(entry),
    entry.partOfSpeech,
    entry.surface,
    noteCell(entry),
  ];
  return `| ${cells.join(" | ")} |`;
}

function koCell(entry: TerminologyEntry): string {
  return entry.shortKo ? `${entry.ko} (짧게: ${entry.shortKo})` : entry.ko;
}

function enCell(entry: TerminologyEntry): string {
  return entry.shortEn ? `${entry.en} (short: ${entry.shortEn})` : entry.en;
}

function noteCell(entry: TerminologyEntry): string {
  const extras = [
    aliasNote("accepted 한국어", entry.acceptedKoAliases),
    aliasNote("retired 한국어", entry.deprecatedKoAliases),
    aliasNote("refused 한국어", entry.rejectedKoAliases),
    aliasNote("never in English", entry.rejectedEnAliases),
    entry.assistantToolNames ? `tools: ${entry.assistantToolNames.map(code).join(", ")}` : "",
  ].filter((part) => part.length > 0);
  return [entry.note ?? "", ...extras].filter((part) => part.length > 0).join(" · ");
}

function aliasNote(label: string, aliases: readonly string[] | undefined): string {
  if (!aliases || aliases.length === 0) return "";
  return `${label}: ${aliases.join(", ")}`;
}

function collisionMarkdown(
  buckets: readonly (readonly TerminologyEntry[])[],
  term: (entry: TerminologyEntry) => string,
): readonly string[] {
  if (buckets.length === 0) return ["- none"];
  return buckets.map((bucket) => `- **${term(bucket[0])}** — ${bucket.map((entry) => `\`${entry.key}\``).join(" vs ")}`);
}

function code(value: string): string {
  return `\`${value}\``;
}
