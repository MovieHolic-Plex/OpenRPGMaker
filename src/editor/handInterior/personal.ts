// 사는 사람의 물건 — 견본 한 벌을 심은 뒤, 그 집의 열쇠(게임·집 이름)와 집 이름에 든 직업으로 작은 물건 몇 점을 더 놓는다.
// 오너 2026-11-15 「괜찮네. 근데 뭐 다양하게 만드는 게 중요하니까」: 같은 견본으로 지은 두 집이 같은 방이 아니게(아이 있는 집·사냥꾼 집·어지른 집·치운 집).
// 무엇을 놓을지는 칩셋 사양의 표(`personal`)가 정한다 — 묶음(아이·고양이·기도·빨래·사냥꾼·어부…)마다 조각 목록과, 직업 묶음이면 집 이름에서 찾을 별칭.
// 자리는 벽 쪽(북쪽 줄·옆 줄)과 빈 벽면·빈 탁자 위뿐이고, 넣을 때마다 견본 가구와 같은 검사(문 앞·겹침·조립기 오류·닿지 못하는 바닥)를 지난다(furnish.ts).
import type { HandInteriorSpec } from "./builder";
import { hashText, mixHash } from "./vignettes";

/** cat = 그 방이 든 집의 갈래(바깥 집 킷의 cat: 태그 — 구조 자료), text = 집·방 이름. 직업 묶음은 cat 이 먼저 부르고, 없으면 이름의 별칭, 그것도 없으면 살림 묶음만. */
export interface PersonalAsk { readonly key: string; readonly text?: string; readonly cat?: string }
export interface PersonalPlan { readonly sets: readonly string[]; readonly pieces: readonly string[]; readonly count: number }

const byHash = <T>(list: readonly T[], salt: string, name: (v: T) => string): T[] => [...list].sort((a, b) => hashText(`${salt}|${name(a)}`) - hashText(`${salt}|${name(b)}`) || name(a).localeCompare(name(b)));

/** 이 방에 놓을 묶음·조각 차례·점 수. 표가 없거나 그 방 종류가 아니면 undefined. 같은 열쇠면 같은 답. */
export function personalPlan(S: HandInteriorSpec, kind: string, ask: PersonalAsk): PersonalPlan | undefined {
  const P = S.personal;
  if (!P || !P.kinds.includes(kind)) return undefined;
  const text = (ask.text ?? "").toLowerCase();
  const ids = Object.keys(P.sets).sort();
  const hit = (id: string) => Math.max(0, ...(P.sets[id]!.alias ?? []).filter((a) => text.includes(a.toLowerCase())).map((a) => a.length));
  const byCat = ask.cat ? ids.filter((id) => P.sets[id]!.cats?.includes(ask.cat!)).sort()[0] : undefined;
  const byName = ids.filter((id) => hit(id) > 0).sort((a, b) => hit(b) - hit(a) || a.localeCompare(b))[0];
  // 직업 묶음: 집의 갈래(구조 자료)가 먼저, 그다음 집 이름의 별칭 — 둘 다 있으면 둘 다(농장의 사냥꾼 집). 어느 것도 없으면 살림 묶음(아이·짐승·기도·빨래…) 둘을 열쇠가 고른다.
  const roles = [...new Set([byCat, byName].filter((v): v is string => !!v))];
  const household = byHash(ids.filter((id) => !P.sets[id]!.alias?.length && !P.sets[id]!.cats?.length), ask.key, (v) => v).slice(0, roles.length ? 1 : 2);
  const sets = [...roles, ...household].slice(0, 3);
  const known = (id: string) => !!S.objects[id] || S.goods[id] !== undefined;
  const lists = sets.map((id) => byHash(P.sets[id]!.pieces.filter(known), `${ask.key}|${id}`, (v) => v));
  const pieces: string[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length && !pieces.includes(l[i]!)) pieces.push(l[i]!);
  const [lo, hi] = P.count;
  return { sets, pieces, count: lo + (mixHash(hashText(`${ask.key}|count`)) % Math.max(1, hi - lo + 1)) };
}
