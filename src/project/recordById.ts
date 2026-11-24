/**
 * `list.find((record) => record.id === id)` 와 같은 답(같은 id 가 여럿이면 첫 번째)을 색인으로 낸다.
 * 전투 모의(끝맺음의 보스·몬스터 맞추기, 수천 판)가 기술 조회마다 DB 기술 전체를 훑었다 —
 * 2026-11-24 draft-10min 프로파일: 몬스터 첫 MVP 끝맺음 280초 중 skills.find 콜백만 약 64초.
 * 색인은 배열 정체성에 묶고, 조회마다 그 자리 원소의 id 를 확인해 배열이 제자리에서 바뀌었으면 다시 만든다.
 * 못 찾으면 늘 다시 만들어 확인한다(제자리 교체·push 뒤에도 find 와 같은 답).
 */
const indexes = new WeakMap<readonly { readonly id: string }[], Map<string, number>>();

function buildIndex<T extends { readonly id: string }>(list: readonly T[]): Map<string, number> {
  const index = new Map<string, number>();
  list.forEach((record, at) => { if (!index.has(record.id)) index.set(record.id, at); });
  indexes.set(list, index);
  return index;
}

export function recordById<T extends { readonly id: string }>(list: readonly T[], id: string): T | undefined {
  let index = indexes.get(list) ?? buildIndex(list);
  let at = index.get(id);
  if (at === undefined || list[at]?.id !== id || (at > 0 && index.size !== list.length && firstAt(list, id) !== at)) {
    index = buildIndex(list);
    at = index.get(id);
  }
  return at === undefined ? undefined : list[at];
}

/** 색인의 자리가 아직 «첫 번째» 인지 — 앞쪽에 같은 id 가 새로 끼어든 경우(중복 id 가 있는 배열에서만 본다). */
function firstAt(list: readonly { readonly id: string }[], id: string): number {
  return list.findIndex((record) => record.id === id);
}
