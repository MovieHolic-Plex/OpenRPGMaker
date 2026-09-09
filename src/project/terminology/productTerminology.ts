import { TERMINOLOGY_ENTRIES_AUTHORING } from "./terminologyEntriesAuthoring";
import { TERMINOLOGY_ENTRIES_EDITOR } from "./terminologyEntriesEditor";
import { TERMINOLOGY_ENTRIES_RUNTIME } from "./terminologyEntriesRuntime";
import { LOCALE_SENSITIVE_SURFACES, TRANSLATION_BOUNDARY } from "./terminologyLocaleSurfaces";
import type { ProductTerminology, TerminologyEntry } from "./terminologyTypes";

export const TERMINOLOGY_ENTRIES: readonly TerminologyEntry[] = [
  ...TERMINOLOGY_ENTRIES_EDITOR,
  ...TERMINOLOGY_ENTRIES_AUTHORING,
  ...TERMINOLOGY_ENTRIES_RUNTIME,
];

export const PRODUCT_TERMINOLOGY = {
  metadata: {
    schemaVersion: 1,
    updatedAt: "2026-09-09",
    documentLanguage: "ko",
    notes: [
      "Preparatory localization reference. Adopting an entry never requires editing an existing string.",
      "Korean is canonical: an entry records the term the product already uses, plus the one approved English rendering.",
      "Entries carrying a uiCopyKey must agree with src/editor/uiCopy.ts; the check enforces it.",
      "Not a locale file, not a message catalogue, and not a translation runtime.",
    ],
  },
  entries: TERMINOLOGY_ENTRIES,
  localeSensitiveSurfaces: LOCALE_SENSITIVE_SURFACES,
  translationBoundary: TRANSLATION_BOUNDARY,
} satisfies ProductTerminology;
