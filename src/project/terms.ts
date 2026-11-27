import { detectLocale, type SupportedLocale } from "@/i18n/locale";
import { defaultTerms } from "@/project/defaults/defaultDatabase";
import type { Project, Terms } from "@/project/types";
import { withJosa } from "@/util/josa";
import { normalizeTroopVictoryBanner } from "@/project/databaseEnemyTroopRecordModel";

export const TERM_KEYS = [
  "attack",
  "skill",
  "item",
  "capture",
  "defend",
  "escape",
  "battleVictory",
  "battleCommandPrompt",
  "back",
  "target",
  "shopGreeting",
  "shopBuy",
  "shopSell",
  "shopCancel",
  "shopSellPrompt",
  "innTitle",
  "yes",
  "no",
  "notEnoughGold",
  "gold",
  "goldPrefix",
  "level",
  "hp",
  "mp",
] as const satisfies readonly (keyof Terms)[];

export type TermKey = (typeof TERM_KEYS)[number];
export type ResolvedTerms = Required<Pick<Terms, TermKey>>;

const LOCALIZED_DEFAULT_TERMS: Readonly<Record<Exclude<SupportedLocale, "ko">, ResolvedTerms>> = {
  en: {
    attack: "Attack",
    skill: "Skill",
    item: "Item",
    capture: "Capture",
    defend: "Defend",
    escape: "Escape",
    battleVictory: "Victory!",
    battleCommandPrompt: "What will {name} do?",
    back: "Back",
    target: "Target",
    shopGreeting: "Welcome!",
    shopBuy: "Buy",
    shopSell: "Sell",
    shopCancel: "Cancel",
    shopSellPrompt: "What would you like to sell?",
    innTitle: "Inn",
    yes: "Yes",
    no: "No",
    notEnoughGold: "Not enough gold.",
    gold: "G",
    goldPrefix: "",
    level: "Lv",
    hp: "HP",
    mp: "MP",
  },
  ja: {
    attack: "たたかう",
    skill: "スキル",
    item: "アイテム",
    capture: "ほかく",
    defend: "ぼうぎょ",
    escape: "にげる",
    battleVictory: "勝利！",
    battleCommandPrompt: "{name}はどうする？",
    back: "もどる",
    target: "対象",
    shopGreeting: "いらっしゃいませ。",
    shopBuy: "かう",
    shopSell: "うる",
    shopCancel: "やめる",
    shopSellPrompt: "どれを売りますか？",
    innTitle: "宿屋",
    yes: "はい",
    no: "いいえ",
    notEnoughGold: "お金が足りません。",
    gold: "G",
    goldPrefix: "",
    level: "Lv",
    hp: "HP",
    mp: "MP",
  },
  zh: {
    attack: "攻击",
    skill: "技能",
    item: "物品",
    capture: "捕捉",
    defend: "防御",
    escape: "逃跑",
    battleVictory: "胜利！",
    battleCommandPrompt: "{name}要做什么？",
    back: "返回",
    target: "目标",
    shopGreeting: "欢迎光临。",
    shopBuy: "购买",
    shopSell: "出售",
    shopCancel: "取消",
    shopSellPrompt: "要出售什么？",
    innTitle: "旅馆",
    yes: "是",
    no: "否",
    notEnoughGold: "金币不足。",
    gold: "G",
    goldPrefix: "",
    level: "Lv",
    hp: "HP",
    mp: "MP",
  },
};

/** 언어별 기본 용어 세트. ko 는 기존 defaultTerms() 와 바이트 단위로 같다. */
export function defaultTermsForLocale(locale: SupportedLocale): ResolvedTerms {
  if (locale === "ko") return { ...defaultTerms() };
  return { ...LOCALIZED_DEFAULT_TERMS[locale] };
}

function projectTermsLocale(meta: Project["meta"] | undefined): SupportedLocale {
  const lang = meta?.language;
  if (lang === "ko" || lang === "en" || lang === "ja" || lang === "zh") return lang;
  if (lang === "auto") return detectLocale();
  const dialogueLang = meta?.oprnDialogueSystem?.language;
  if (dialogueLang === "ko" || dialogueLang === "en" || dialogueLang === "ja" || dialogueLang === "zh") return dialogueLang;
  if (dialogueLang === "auto") return detectLocale();
  return "ko";
}

export function resolveTerms(project: Pick<Project, "meta">, locale?: SupportedLocale): ResolvedTerms {
  return resolveTermOverrides(project.meta.terms, locale ?? projectTermsLocale(project.meta));
}

export function resolveTermOverrides(terms: Terms | undefined, locale: SupportedLocale = "ko"): ResolvedTerms {
  const resolved = defaultTermsForLocale(locale);
  if (!terms) return resolved;
  const koDefaults = locale === "ko" ? undefined : defaultTerms();
  for (const key of TERM_KEYS) {
    const value = terms[key];
    if (value === undefined) continue;
    // 비한국어 프로젝트가 빈 프로젝트 생성 시 복사된 기본 한국어 용어를 그대로 두고 있으면 해당 언어 기본 용어를 쓴다.
    if (koDefaults && value === koDefaults[key]) continue;
    resolved[key] = value;
  }
  return resolved;
}

export function defaultTermValue(key: TermKey, locale: SupportedLocale = "ko"): string {
  return defaultTermsForLocale(locale)[key];
}

/**
 * 승리 띠 글자. 우선순위: 이 전투 적 그룹의 victoryBanner → 프로젝트 용어 terms.battleVictory → 언어별 기본 승리 문구.
 * 빈 문자열은 어느 단계에서도 「없음」으로 보고 다음 단계로 넘어간다.
 */
export function resolveVictoryBannerText(project: Pick<Project, "meta" | "database">, troopId: string | undefined): string {
  const troop = troopId ? project.database.troops.find((entry) => entry.id === troopId) : undefined;
  const override = normalizeTroopVictoryBanner(troop?.victoryBanner);
  if (override) return override;
  const locale = projectTermsLocale(project.meta);
  const term = resolveTerms(project, locale).battleVictory;
  return term.trim() ? term : defaultTermValue("battleVictory", locale);
}

const NAME_PLACEHOLDER = /\{name(은|이|을)?\}/gu;
const JOSA_PAIRS = { 은: "은/는", 이: "이/가", 을: "을/를" } as const;

/**
 * 전투 명령 질문 줄(terms.battleCommandPrompt)을 채운다.
 * - 한국어(ko 또는 생략): `{name}` 은 이름 그대로, `{name은}`·`{name이}`·`{name을}` 은 받침에 맞춘 조사를 붙인다.
 * - 한국어 외 언어(en/ja/zh): 한국어 조사(`withJosa`)를 억지로 붙이지 않고 이름만 자연스럽게 치환한다.
 * lineBreakAfterName(포켓몬 화면)이면 이름 자리표시자 바로 뒤 첫 빈칸 하나를 줄바꿈으로 바꾼다.
 */
export function formatBattleCommandPrompt(
  template: string,
  name: string,
  lineBreakAfterName = false,
  locale?: SupportedLocale,
): string {
  const applyKoreanJosa = locale === undefined || locale === "ko";
  const source = lineBreakAfterName ? template.replace(/(\{name(?:은|이|을)?\}) /u, "$1\n") : template;
  return source.replace(NAME_PLACEHOLDER, (_match, particle: keyof typeof JOSA_PAIRS | undefined) =>
    particle && applyKoreanJosa ? withJosa(name, JOSA_PAIRS[particle]) : name);
}
