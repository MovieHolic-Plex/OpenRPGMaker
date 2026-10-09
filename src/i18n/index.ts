// i18n/index.ts
// 편집기 표시 언어 진입점. 부팅 때 언어를 정하고(locale.ts), 카탈로그를 불러 DOM 번역을 켠다.
// 한국어는 원문이라 카탈로그도 번역 계층도 없다 — 한국어 사용자에게는 아무 비용이 없다.

import {
  detectLocale,
  LOCALE_HTML_LANG,
  saveLocalePreference,
  SOURCE_LOCALE,
  type SupportedLocale,
} from "@/i18n/locale";
import { createTranslator, type Catalog, type Translator } from "@/i18n/translator";
import { installDomTranslator, type DomTranslator } from "@/i18n/domTranslator";

export { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/locale";
export { sourceAttributeOf, sourceTextOf } from "@/i18n/domTranslator";

const CATALOG_LOADERS: Record<Exclude<SupportedLocale, "ko">, () => Promise<{ default: Catalog }>> = {
  en: () => import("@/i18n/catalogs/en.json"),
  ja: () => import("@/i18n/catalogs/ja.json"),
  zh: () => import("@/i18n/catalogs/zh.json"),
};

let currentLocale: SupportedLocale = SOURCE_LOCALE;
let currentTranslator: Translator | null = null;
let domTranslator: DomTranslator | null = null;

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function t(source: string): string {
  return currentTranslator?.translate(source) ?? source;
}

async function loadTranslator(locale: SupportedLocale): Promise<Translator | null> {
  if (locale === "ko") return null;
  try {
    const module = await CATALOG_LOADERS[locale]();
    return createTranslator(module.default);
  } catch (error) {
    console.error(`[i18n] ${locale} 카탈로그를 불러오지 못해 한국어로 표시합니다.`, error);
    return null;
  }
}

function applyDocumentLocale(locale: SupportedLocale): void {
  document.documentElement.lang = LOCALE_HTML_LANG[locale];
  document.documentElement.dataset.locale = locale;
}

// bootApp 보다 먼저 await 해야 첫 화면이 한국어로 깜빡이지 않는다.
export async function initI18n(): Promise<SupportedLocale> {
  if (typeof document === "undefined") return currentLocale;
  const locale = detectLocale();
  currentLocale = locale;
  applyDocumentLocale(locale);
  currentTranslator = await loadTranslator(locale);
  if (currentTranslator) domTranslator = installDomTranslator(document.body, currentTranslator);
  return locale;
}

export async function setLocale(locale: SupportedLocale): Promise<void> {
  saveLocalePreference(locale);
  if (locale === currentLocale) return;
  currentLocale = locale;
  applyDocumentLocale(locale);
  currentTranslator = await loadTranslator(locale);
  if (domTranslator) domTranslator.retranslate(currentTranslator);
  else if (currentTranslator) domTranslator = installDomTranslator(document.body, currentTranslator);
}
