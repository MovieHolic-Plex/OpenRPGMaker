// ai/v2/story/samePerson.ts
// 청사진 단계의 «누구» — 같은 사람은 한 몸, 물건은 사람이 아니다. blueprintPath(고리 짓기)와 puzzle(사슬 빌더)이 쓴다. 결정적.
//
// 왜(2026-11-13 r3b-fun·r3s-fun 플레이):
//  - 1단계 «촌장» 과 7단계 «촌장 귀환» 이 같은 마을에 두 몸으로 늘 서 있었다. 같은 장소의 같은 who 는 한 사람이다 — 뒤 단계는 앞 단계 이벤트의
//    페이지로 이어진다(먼저 선 자리 그대로). 사람 앞의 안내 「Z 대화 · 촌장 귀환」 도 사라진다(이벤트가 하나다).
//  - 고르기 단계 «기관 제어대»(who 제어대)가 주민 칩으로 서서 «제어대: 제어대 앞에 섰다…» 고 말했다. who 가 물건이면 그 단계의 글은 서술이다.
import type { GameBlueprintStep } from "@/project/gameBlueprint";
import { norm } from "./blueprintPathNames";
import { isPersonName } from "./personName";

type Obj = Record<string, unknown>;

/** 말로 만나는 단계(talk·choice) k 와 같은 사람(who)이 앞에서 말로 만난 단계 — here(i) 가 참인 것(같은 장소 · 이번에 짓는 단계)만. 없으면 -1. */
export function samePersonStep(steps: readonly Pick<GameBlueprintStep, "kind" | "who">[], k: number, here: (i: number) => boolean): number {
  const who = norm(steps[k]?.who ?? "");
  if (!who) return -1;
  return steps.findIndex((st, i) => i < k && (st.kind === "talk" || st.kind === "choice") && norm(st.who ?? "") === who && here(i));
}

/**
 * 고르기 단계가 사람이 아니라 물건 앞에서 고르는 것인가(제어대·제단·갈림길 표지). 낱말 표로 가르지 않는다 — 그 단계가 스스로 말한 것만 본다:
 *  - 모델이 그 단계가 앉을 그림을 골랐다(text.on), 또는
 *  - 그 단계의 글(lines)이 who 를 이름으로 부른다(«제어대 앞에 섰다») — 제 말 속에서 제 이름을 부르는 것은 그 사람의 말이 아니라 그것에 대한 서술이다.
 * 직함·호칭이 든 이름(선장 브라스 · 촌장)은 늘 사람이다.
 */
export function choiceAtThing(step: Pick<GameBlueprintStep, "who" | "event">, text: { readonly on?: string | null; readonly lines?: readonly string[] | null } | undefined): boolean {
  const who = step.who?.trim();
  if (!who || isPersonName(who) || isPersonName(step.event)) return false;
  return !!text?.on?.trim() || (text?.lines ?? []).some((line) => line.includes(who));
}

/**
 * 같은 사람의 뒤 단계 페이지를 앞 단계 이벤트의 페이지 뒤에 잇는다(뒤 페이지가 조건이 맞으면 이긴다 — 페이지 고르기 규칙 그대로).
 * locked = 뒤 단계의 첫 페이지가 «아직» 안내(조건 없음)다 — 잇지 않는다(그때는 앞 단계의 뒷말이 그 사람의 말이다).
 * 조건 없는 페이지는 앞 단계가 끝난 뒤(앞 이벤트 마지막 페이지의 조건)에만 뜬다.
 */
export function joinPersonPages(hostPages: readonly Obj[], pages: readonly Obj[], locked: boolean): Obj[] {
  const after = ((hostPages.at(-1)?.conditions as Obj[] | undefined) ?? []).map((c) => ({ ...c }));
  const own = (locked ? pages.slice(1) : pages).map((page) => ((page.conditions as Obj[] | undefined)?.length ? page : { ...page, conditions: after.map((c) => ({ ...c })) }));
  return [...hostPages.map((page) => structuredClone(page)), ...own];
}
