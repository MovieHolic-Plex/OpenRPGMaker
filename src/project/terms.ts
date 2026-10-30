import { defaultTerms } from "@/project/defaults/defaultDatabase";
import type { Project, Terms } from "@/project/types";
import { withJosa } from "@/util/josa";

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

export function resolveTerms(project: Pick<Project, "meta">): ResolvedTerms {
  return resolveTermOverrides(project.meta.terms);
}

export function resolveTermOverrides(terms: Terms | undefined): ResolvedTerms {
  const resolved = { ...defaultTerms() };
  if (!terms) return resolved;
  for (const key of TERM_KEYS) {
    const value = terms[key];
    if (value !== undefined) resolved[key] = value;
  }
  return resolved;
}

export function defaultTermValue(key: TermKey): string {
  return defaultTerms()[key];
}

const NAME_PLACEHOLDER = /\{name(은|이|을)?\}/gu;
const JOSA_PAIRS = { 은: "은/는", 이: "이/가", 을: "을/를" } as const;

/**
 * 전투 명령 질문 줄(terms.battleCommandPrompt)을 채운다. `{name}` 은 이름 그대로,
 * `{name은}`·`{name이}`·`{name을}` 은 받침에 맞춘 조사를 붙인다.
 * lineBreakAfterName(포켓몬 화면)이면 이름 자리표시자 바로 뒤 첫 빈칸 하나를 줄바꿈으로 바꾼다 —
 * 기본 문구에서는 예전 「○○는\n무엇을 할까?」와 글자 하나까지 같다.
 */
export function formatBattleCommandPrompt(template: string, name: string, lineBreakAfterName = false): string {
  const source = lineBreakAfterName ? template.replace(/(\{name(?:은|이|을)?\}) /u, "$1\n") : template;
  return source.replace(NAME_PLACEHOLDER, (_match, particle: keyof typeof JOSA_PAIRS | undefined) =>
    particle ? withJosa(name, JOSA_PAIRS[particle]) : name);
}
