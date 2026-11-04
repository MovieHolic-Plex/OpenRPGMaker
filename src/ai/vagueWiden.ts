// 모호한 생성 요청 넓히기 — 수식어 표(vagueWidenCatalog)에서 «이 프로젝트에 그림이 있는» 것만 남기고, 같은 프로젝트에서 이미 쓴 것을 피해 하나를 고른다.
// 순수 함수만 둔다. 이력 저장(localStorage)은 vagueWidenHistory.ts, 경로 배선은 piAgent/plainTurn.ts 가 맡는다.
import type { Project } from "@/project/types";
import { adapterCaps, adapterSupports } from "@/editor/dungeonKit/capabilities";
import type { DungeonType } from "@/editor/dungeonKit/types";
import { WIDEN_MODIFIERS, WIDEN_SUBJECTS, type WidenModifier, type WidenNeed, type WidenSubject } from "./vagueWidenCatalog";

export function isWidenSubject(value: unknown): value is WidenSubject {
  return typeof value === "string" && (WIDEN_SUBJECTS as readonly string[]).includes(value);
}

function needMet(project: Project, need: WidenNeed): boolean {
  if (need.kind === "tileset") return Boolean(project.tilesets[need.id]);
  if (need.kind === "kit") return Boolean(project.tilesets[need.tileset]?.structureKits?.some((kit) => kit.id === need.id));
  return adapterSupports(adapterCaps("beodeul"), need.type as DungeonType);
}

/** 그 주제에서 프로젝트가 실제로 지을 수 있는 수식어 — 필요한 타일셋·키트·던전 종류가 하나라도 없으면 뺀다. */
export function feasibleModifiers(project: Project, subject: WidenSubject, catalog: readonly WidenModifier[] = WIDEN_MODIFIERS): WidenModifier[] {
  return catalog.filter((modifier) => modifier.subject === subject && modifier.needs.every((need) => needMet(project, need)));
}

/**
 * 실현 가능한 것 중 하나를 무작위로 고른다. 이력에 없는 것을 먼저 고르고, 다 썼으면 가장 오래전에 쓴 쪽부터 다시 쓴다
 * (이력은 오래된 것 → 최근 것 순서). 고를 것이 없으면 null — 호출자는 넓히지 않고 원래 경로로 간다.
 */
export function pickWidenModifier(feasible: readonly WidenModifier[], history: readonly string[], rand: () => number = Math.random): WidenModifier | null {
  if (feasible.length === 0) return null;
  const unused = feasible.filter((modifier) => !history.includes(modifier.id));
  if (unused.length > 0) return unused[Math.floor(rand() * unused.length)] ?? unused[0]!;
  const oldestFirst = [...feasible].sort((a, b) => history.lastIndexOf(a.id) - history.lastIndexOf(b.id));
  return oldestFirst[0]!;
}

/** 사용자에게 보이는 시작 한 줄. 막지 않는다 — 다음 말로 바꿀 수 있다고만 알린다. */
export function widenStartLine(modifier: WidenModifier): string {
  const last = modifier.label.charCodeAt(modifier.label.length - 1) - 0xac00;
  const jong = last >= 0 && last < 11172 ? last % 28 : 0;
  const particle = jong === 0 || jong === 8 ? "로" : "으로";
  return `${modifier.label}${particle} 만들게요. 다른 느낌이면 말해 주세요.`;
}

/** 본문 모델에게 가는 지시 — 고른 장면을 그대로 짓게 한다. 되묻지 않는다. */
export function formatWidenNote(modifier: WidenModifier): string {
  return [
    `[넓힌 요청] 사용자는 대상만 말했다(무엇을 만들지 모호). 묻지 말고 이 장면으로 바로 짓는다: 「${modifier.label}」 — ${modifier.traits.join(" · ")}.`,
    `짓는 법: ${modifier.recipe}. 이 장면이 정한 인자는 사용자가 말한 것으로 보고 그대로 보낸다(말하지 않은 나머지 선택과 seed 는 보내지 않는다).`,
    "이 장면의 그림은 이 프로젝트에 있는 것만 골랐다 — 다른 칩셋·없는 키트로 바꾸지 않는다. 맵 이름에 장면 이름을 쓴다.",
    `답의 첫 문장은 「${widenStartLine(modifier)}」 그대로 쓴다.`,
  ].join("\n");
}

/** 장면 짓는 법에 이름이 나온 도구 — 첫 요청부터 보이게 한다. */
export function widenToolNames(modifier: WidenModifier): string[] {
  return [...new Set([...modifier.recipe.matchAll(/\b([a-z][a-z_]+)\(/gu)].map((match) => match[1]!))];
}

export interface WidenDecision {
  readonly modifier: WidenModifier;
  readonly note: string;
  readonly startLine: string;
}

/** 주제 하나 → 넓힌 결정(고를 수 없으면 null). */
export function decideWiden(project: Project, subject: WidenSubject, history: readonly string[], rand?: () => number): WidenDecision | null {
  const modifier = pickWidenModifier(feasibleModifiers(project, subject), history, rand);
  return modifier ? { modifier, note: formatWidenNote(modifier), startLine: widenStartLine(modifier) } : null;
}
