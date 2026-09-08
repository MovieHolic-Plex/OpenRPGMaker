import type { UiCopyKey } from "@/editor/uiCopy";

/**
 * Owning product area for a term.
 *
 * The first seven values are the `ONTOLOGY_CAPABILITIES` ids on purpose: a
 * concept and the code that owns it must be filed under the same name in both
 * registries. `EditorShell` and `AssistantStudio` are terminology-only areas —
 * the development ontology has no capability for chrome or assistant surfaces.
 */
export type TerminologyArea =
  | "AssistantStudio"
  | "BattleRuntime"
  | "DatabaseRecords"
  | "EditorShell"
  | "EventAuthoring"
  | "MapEditing"
  | "ProjectPersistence"
  | "ResourcePipeline"
  | "TilesetSemantics";

/** Grammatical role. English labels drift most when an action is translated as a noun. */
export type TerminologyPartOfSpeech = "action" | "noun" | "property";

/** Where the term is visible. `editor` terms must never leak into a played game, and vice versa. */
export type TerminologySurface = "both" | "editor" | "runtime";

export type TerminologyEntry = {
  /** Stable semantic key. Never renamed; renaming a key is a breaking change for every referrer. */
  readonly key: string;
  /** Approved Korean term exactly as it is written on the product surface. */
  readonly ko: string;
  /** Approved English term. Translators use this and nothing else. */
  readonly en: string;
  readonly area: TerminologyArea;
  readonly partOfSpeech: TerminologyPartOfSpeech;
  readonly surface: TerminologySurface;
  /**
   * One-line disambiguation. Required whenever another entry shares the same
   * English or Korean term, and otherwise used to record why a near-synonym was
   * rejected.
   */
  readonly note?: string;
  /** Short Korean label, only when the surface genuinely uses a shorter form. */
  readonly shortKo?: string;
  /** Short English label, only when the full English term does not fit a control. */
  readonly shortEn?: string;
  /** Korean wordings that are accepted on some surface but are not the canonical term. */
  readonly acceptedKoAliases?: readonly string[];
  /** Korean wordings that were retired. Reintroducing one is terminology drift. */
  readonly deprecatedKoAliases?: readonly string[];
  /**
   * Korean wordings considered and refused for this concept — usually because
   * another entry already owns the word. Unlike a deprecated alias, this was
   * never the term.
   */
  readonly rejectedKoAliases?: readonly string[];
  /** English wordings that must not be used, with the reason implied by `note`. */
  readonly rejectedEnAliases?: readonly string[];
  /**
   * `UiCopyKey` this concept is already published under. When set, the Korean
   * term here must equal one of the two `uiCopy` registers for that key, so the
   * two registries cannot disagree.
   */
  readonly uiCopyKey?: UiCopyKey;
  /** Assistant tool ids that expose this concept to a model. */
  readonly assistantToolNames?: readonly string[];
  /** Where the Korean term was observed. At least one repository path. */
  readonly sources: readonly string[];
};

export type TerminologyMetadata = {
  readonly schemaVersion: number;
  readonly updatedAt: string;
  readonly documentLanguage: string;
  readonly notes: readonly string[];
};

/** A locale-sensitive behavior, which is *not* a translatable label. */
export type LocaleSensitiveSurface = {
  readonly id: string;
  readonly kind: "collation" | "currency" | "date" | "documentLanguage" | "number" | "time";
  readonly locale: string;
  readonly description: string;
  readonly sources: readonly string[];
};

/**
 * The line between product-owned text and untranslated user-authored project
 * content.
 *
 * `owner` and `translated` are separate axes on purpose: identifiers are
 * product-owned yet must never be translated, which a single boolean cannot say.
 */
export type TranslationBoundaryRule = {
  readonly id: string;
  readonly owner: "author" | "product";
  readonly translated: boolean;
  readonly description: string;
  readonly examples: readonly string[];
};

export type ProductTerminology = {
  readonly metadata: TerminologyMetadata;
  readonly entries: readonly TerminologyEntry[];
  readonly localeSensitiveSurfaces: readonly LocaleSensitiveSurface[];
  readonly translationBoundary: readonly TranslationBoundaryRule[];
};

export type TerminologyIssue = {
  readonly code: string;
  readonly message: string;
};
