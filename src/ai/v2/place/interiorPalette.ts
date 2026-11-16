// 실내의 게임 색 — 같은 방 종류의 요청이 게임마다 같은 방이 되지 않게(2026-11-16 감독 «조수가 짓는 게임이 매번 비슷하다»).
//
// 무엇을: 그림 칸 크기·통행·놓는 규칙이 같고 색 낱말 하나만 다른 기물(깃발·침대·꽃병)과 깔개 줄을 «색 한 벌» 로 보고, 게임마다 천 색 하나를 고른다.
// 그 색은 모델이 읽는 목록 카드(interiorCatalog.ts 의 «이 게임의 평면» 줄과 «이 요청에 맞는 기물» 의 차례)로만 건넨다 — 모델이 그 id 를 직접 적는다.
// 짓기는 받은 id 를 그대로 깐다(2026-11-16 감독: «모델이 고른 것이 있으면 그대로, 기본값은 모델이 고르지 않은 곳에만» — 이야기가 붉은 깃발을 말해
// 모델이 banner red 를 적었는데 짓기가 green 으로 바꾸면 안 된다). 모델이 쓰지 않는 칸인 천장만 짓기가 게임마다 고른다(interiorCeiling).
// 색 낱말은 손으로 적지 않는다: 그 칩셋의 깔개 줄 id(«rug red» · «rug blue» …)의 끝 낱말이 색 낱말이다. 색 한 벌도 칩셋 표에서 찾는다
// (머리 id 가 같고, 범주·놓는 방식·칸 크기·솟음·칸 모양·쓰임·바라보는 쪽이 같고, 끝 낱말만 색 낱말로 다른 기물들).
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { hashText } from "@/editor/handInterior/vignettes";

const lastWord = (id: string) => id.slice(id.lastIndexOf(" ") + 1);
const head = (id: string) => id.slice(0, Math.max(0, id.lastIndexOf(" ")));

/** 칩셋의 색 낱말 — 바닥에 까는 깔개 줄(«<머리> <색>») 가운데 머리가 같은 것이 셋 이상인 무리의 끝 낱말. */
export function paletteColours(S: HandInteriorSpec): string[] {
  const byHead = new Map<string, string[]>();
  for (const [id, line] of Object.entries(S.lines ?? {})) {
    if (line.kind !== "flat" || !id.includes(" ")) continue;
    (byHead.get(head(id)) ?? byHead.set(head(id), []).get(head(id))!).push(lastWord(id));
  }
  const best = [...byHead.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  return best.length >= 3 ? [...best].sort() : [];
}

/** 색 한 벌 — 머리 id → (색 낱말 → 기물 id). 깔개 줄도 한 벌이다. 둘 이상의 색이 있는 것만. */
export function paletteFamilies(S: HandInteriorSpec): Map<string, Map<string, string>> {
  const colours = new Set(paletteColours(S));
  const out = new Map<string, Map<string, string>>();
  if (!colours.size) return out;
  const shape = (id: string): string | undefined => {
    const o = S.objects[id] as (typeof S.objects)[string] | undefined;
    if (!o || o.kind === "door" || o.kind === "sidedoor" || o.stairs || o.states) return undefined; // 상태가 있는 기물(열림·닫힘 — states.others 가 다른 id)은 한 벌이 아니다
    // 칸 모양은 자리(dx,dy)·층만 견준다 — 칸 번호는 색마다 다르다.
    const cells = (o.cells ?? []).map((c) => `${c[0]},${c[1]},${c[3]}`).sort().join(";");
    return JSON.stringify([o.category, o.kind, o.w, o.h, o.up ?? 0, o.facing ?? "", !!o.animated, !!o.surface, [...(o.use ?? [])].sort(), cells]);
  };
  const groups = new Map<string, Map<string, string>>();
  for (const id of Object.keys(S.objects)) {
    if (!id.includes(" ") || /[:#]/u.test(id) || !colours.has(lastWord(id))) continue;
    const s = shape(id); if (!s) continue;
    const key = `${head(id)}|${s}`;
    (groups.get(key) ?? groups.set(key, new Map()).get(key)!).set(lastWord(id), id);
  }
  for (const [key, members] of groups) if (members.size >= 2) out.set(`object:${key.slice(0, key.indexOf("|"))}`, members);
  const lines = new Map<string, Map<string, string>>();
  for (const [id, line] of Object.entries(S.lines ?? {})) {
    if (line.kind !== "flat" || !colours.has(lastWord(id))) continue;
    (lines.get(head(id)) ?? lines.set(head(id), new Map()).get(head(id))!).set(lastWord(id), id);
  }
  for (const [h, members] of lines) if (members.size >= 2) out.set(`line:${h}`, members);
  return out;
}

/** 이 게임의 천 색 — 칩셋의 색 낱말 가운데 하나와, 그 색을 가진 한 벌마다의 id(깔개 줄 먼저). key 가 비면 없다. 같은 key 면 늘 같다. */
export function gameColour(S: HandInteriorSpec, key: string | undefined): { colour: string; ids: string[] } | undefined {
  if (!key?.trim()) return undefined;
  const colours = paletteColours(S);
  if (!colours.length) return undefined;
  const colour = colours[hashText(`colour|${key}`) % colours.length]!;
  const ids = [...paletteFamilies(S)].sort(([a], [b]) => Number(b.startsWith("line:")) - Number(a.startsWith("line:")) || a.localeCompare(b))
    .flatMap(([, members]) => (members.has(colour) ? [members.get(colour)!] : []));
  return { colour, ids };
}

/** 이 게임의 천장(모델이 쓰지 않는 칸) — 칩셋에 천장이 둘 이상일 때만. key 가 비면 없다. */
export function interiorCeiling(S: HandInteriorSpec, key: string | undefined): string | undefined {
  if (!key?.trim()) return undefined;
  const ceilings = Object.keys(S.ceilings ?? {});
  return ceilings.length > 1 ? ceilings[hashText(`ceiling|${key}`) % ceilings.length] : undefined;
}
