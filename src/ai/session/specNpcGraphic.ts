// ai/session/specNpcGraphic.ts
// 밑그림 npc 에셋 자동 배치(buildSpecNpcAssetsDirectly)가 place_npc 에 넘길 그래픽 검색어를 고른다.
//
// 왜: 밑그림의 style 은 「잡화점 상인」처럼 수식어가 붙은 자유 문구다. 2026-09-27 부터 그래픽 검색은 못 찾으면 다른 그림으로
// 대체하지 않고 거절한다(eventCompile.resolveGraphicQuery). 그래서 전체 문구만 넣으면 자동 배치가 거의 늘 실패했다.
// 사다리: 전체 문구 → 역할 명사(마지막 낱말, 한국어 명사구의 머리말). 둘 다 못 찾으면 대체 없이 실패를 알린다.
// 무관한 그림으로 바꾸지 않는 규칙은 그대로다 — 역할 명사는 같은 인물을 가리키는 더 짧은 이름일 뿐이다.

import { pickNpcGraphic } from "@/assets/charsetQuery";

export type SpecNpcGraphicTerm = "full" | "role";

export interface SpecNpcGraphicMatch {
  readonly query: string;
  readonly term: SpecNpcGraphicTerm;
}

/** 시도할 검색어 — 전체 문구, 그리고 그와 다를 때만 역할 명사. */
export function specNpcGraphicLadder(name: string): readonly { readonly query: string; readonly term: SpecNpcGraphicTerm }[] {
  const full = name.trim();
  if (!full) return [];
  const words = full.split(/\s+/u);
  const role = words.at(-1) ?? full;
  return role !== full ? [{ query: full, term: "full" }, { query: role, term: "role" }] : [{ query: full, term: "full" }];
}

/** 사다리에서 처음 맞는 검색어. 아무것도 맞지 않으면 null — 호출자는 대체 그림 없이 실패를 알린다. */
export function resolveSpecNpcGraphic(
  name: string,
  matches: (query: string) => boolean = (query) => pickNpcGraphic(query) !== null,
): SpecNpcGraphicMatch | null {
  for (const step of specNpcGraphicLadder(name)) {
    if (matches(step.query)) return step;
  }
  return null;
}
