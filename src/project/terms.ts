import { defaultTerms } from "@/project/defaults/defaultDatabase";
import type { Project, Terms } from "@/project/types";

export const TERM_KEYS = [
  "attack",
  "skill",
  "item",
  "capture",
  "defend",
  "escape",
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
