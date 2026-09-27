// i18n/locale.ts
// 편집기 표시 언어 결정. 한국어가 원문(정본)이고 영어·일본어·중국어(간체)는 번역 카탈로그다.
//
// 결정 순서 (첫 번째로 알아볼 수 있는 값이 이긴다):
//   1. URL `?lang=xx`  — QA·공유 링크용. 저장하지 않는다.
//   2. 사용자가 「보기 ▾ → 언어」에서 고른 값 (localStorage `oprn:locale`).
//   3. 자동화 브라우저(navigator.webdriver)면 한국어 — e2e 스펙 수백 개가 한국어 라벨을 누른다.
//      Playwright 기본 로캘은 en-US 라서 이 가드가 없으면 전부 깨진다. `?localeDetect=1` 로 끈다.
//   4. 브라우저·OS 언어 목록(navigator.languages) 중 처음 지원하는 것.
//   5. 그 밖의 언어는 영어.

export const SUPPORTED_LOCALES = ["ko", "en", "ja", "zh"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const SOURCE_LOCALE: SupportedLocale = "ko";
export const FALLBACK_LOCALE: SupportedLocale = "en";
export const LOCALE_STORAGE_KEY = "oprn:locale";

export const LOCALE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "简体中文",
};

/** `<html lang>` 값. 중국어는 간체 카탈로그라 zh-CN 으로 밝힌다. */
export const LOCALE_HTML_LANG: Record<SupportedLocale, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  zh: "zh-CN",
};

/** BCP 47 태그(대소문자·밑줄 무관)를 지원 언어로. zh-TW·zh-Hant 도 간체 카탈로그로 보낸다. */
export function matchSupportedLocale(tag: string | null | undefined): SupportedLocale | null {
  if (typeof tag !== "string") return null;
  const base = tag.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as SupportedLocale) : null;
}

export type LocaleInputs = {
  readonly queryLang?: string | null;
  readonly saved?: string | null;
  readonly languages?: readonly string[];
  readonly automation?: boolean;
  readonly forceDetect?: boolean;
};

export function resolveLocale(inputs: LocaleInputs): SupportedLocale {
  const fromQuery = matchSupportedLocale(inputs.queryLang);
  if (fromQuery) return fromQuery;
  const fromSaved = matchSupportedLocale(inputs.saved);
  if (fromSaved) return fromSaved;
  if (inputs.automation === true && inputs.forceDetect !== true) return SOURCE_LOCALE;
  for (const language of inputs.languages ?? []) {
    const match = matchSupportedLocale(language);
    if (match) return match;
  }
  return FALLBACK_LOCALE;
}

function readSavedLocale(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function detectLocale(): SupportedLocale {
  const params = typeof window !== "undefined" && window.location ? new URLSearchParams(window.location.search) : null;
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const languages = nav ? (nav.languages?.length ? nav.languages : nav.language ? [nav.language] : []) : [];
  return resolveLocale({
    queryLang: params?.get("lang"),
    saved: readSavedLocale(),
    languages,
    automation: nav?.webdriver === true,
    forceDetect: params?.get("localeDetect") === "1",
  });
}

export function saveLocalePreference(locale: SupportedLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // 저장 불가 — 다음 부팅은 브라우저 언어로 돌아간다.
  }
}
