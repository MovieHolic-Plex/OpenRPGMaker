export { PRODUCT_TERMINOLOGY, TERMINOLOGY_ENTRIES } from "./productTerminology";
export { checkProductTerminology } from "./terminologyCheck";
export { generatedProductTerminologyMarkdown } from "./terminologyDocs";
export { LOCALE_SENSITIVE_SURFACES, TRANSLATION_BOUNDARY } from "./terminologyLocaleSurfaces";
export {
  terminologyByArea,
  terminologyByAssistantTool,
  terminologyByEnglish,
  terminologyByKey,
  terminologyByKorean,
  terminologyEnglishCollisions,
  terminologyKoreanCollisions,
  terminologyReservedEnglishWords,
} from "./terminologyQuery";
export type { ReservedEnglishWord } from "./terminologyQuery";
export type {
  LocaleSensitiveSurface,
  ProductTerminology,
  TerminologyArea,
  TerminologyEntry,
  TerminologyIssue,
  TerminologyMetadata,
  TerminologyPartOfSpeech,
  TerminologySurface,
  TranslationBoundaryRule,
} from "./terminologyTypes";
