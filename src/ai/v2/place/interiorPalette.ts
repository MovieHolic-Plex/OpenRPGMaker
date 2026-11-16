// 실내 칸 배치의 게임 색 — 같은 뼈대를 보내도 게임마다 같은 방이 되지 않게(2026-11-16 감독 «조수가 짓는 게임이 매번 비슷하다»).
//
// 왜: r6·r7a·r7 세 판의 대성당이 같은 뼈대(24칸 폭 · x=17 칸막이 · 붉은 융단 · 긴 의자 줄)였고, 칸 배치 길은 받은 그대로 깔아
// 같은 배치는 화소까지 같은 방이 됐다(탐침: 게임 열쇠 여섯에 같은 해시 5014e498).
// 무엇을: 그림 칸 크기·통행·놓는 규칙이 같고 색 낱말 하나만 다른 기물(깃발·침대·2인 침대)과 깔개 줄을 «색 한 벌» 로 보고,
// 게임(열쇠+세션)마다 색 한 벌을 골라 그 색으로 깐다 — 한 방 안의 붉은 것은 모두 같은 새 색이 된다(어울림이 깨지지 않는다).
// 모델이 쓰지 않는 칸인 천장 색도 게임마다 고른다.
// 색 낱말은 손으로 적지 않는다: 그 칩셋의 깔개 줄 id(«rug red» · «rug blue» …)의 끝 낱말이 색 낱말이다. 색 한 벌도 칩셋 표에서 찾는다
// (머리 id 가 같고, 범주·놓는 방식·칸 크기·솟음·칸 모양·쓰임·바라보는 쪽이 같고, 끝 낱말만 색 낱말로 다른 기물들).
// 모델이 «요청이 말한 것»(layout.required 의 ids)으로 적은 기물은 그대로 둔다 — 요청이 «빨간 깃발» 을 말했으면 빨간 깃발이다.
import type { HandInteriorSpec } from "@/editor/handInterior/builder";
import { hashText } from "@/editor/handInterior/vignettes";

export interface InteriorPalette {
  /** 원래 id → 이 게임의 id(바뀌는 것만). */
  readonly swap: ReadonlyMap<string, string>;
  /** 천장(모델이 쓰지 않는 칸) — 칩셋에 천장이 둘 이상일 때만. */
  readonly ceiling?: string;
  /** 색 낱말 → 이 게임의 색 낱말(보고용). */
  readonly colours: ReadonlyMap<string, string>;
}

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
    if (!o || o.kind === "door" || o.kind === "sidedoor" || o.stairs || o.states?.length) return undefined;
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

/**
 * 이 게임의 색 한 벌. key 가 비면 아무것도 바꾸지 않는다(사람 편집·옛 호출). 같은 key 면 늘 같은 색이다.
 * 색 낱말을 섞어 짝짓는다(색 → 다른 색, 겹치지 않게) — 한 색만 쓴 방도, 여러 색을 쓴 방도 게임마다 다른 색 조합이 된다.
 */
export function interiorPalette(S: HandInteriorSpec, key: string | undefined): InteriorPalette {
  const none: InteriorPalette = { swap: new Map(), colours: new Map() };
  if (!key?.trim()) return none;
  const colours = paletteColours(S);
  const shuffled = [...colours].sort((a, b) => hashText(`palette|${key}|${a}`) - hashText(`palette|${key}|${b}`) || a.localeCompare(b));
  const to = new Map(colours.map((c, i) => [c, shuffled[i]!] as const));
  const swap = new Map<string, string>();
  for (const members of paletteFamilies(S).values()) {
    for (const [colour, id] of members) {
      // 그 한 벌에 없는 색이 나오면 그 한 벌 안에서 다음 색으로(같은 섞음 차례) — 침대에는 보라가 없다.
      const order = [to.get(colour)!, ...shuffled];
      const pick = order.find((c) => members.has(c));
      if (pick && pick !== colour) swap.set(id, members.get(pick)!);
    }
  }
  const ceilings = Object.keys(S.ceilings ?? {});
  const ceiling = ceilings.length > 1 ? ceilings[hashText(`ceiling|${key}`) % ceilings.length] : undefined;
  return { swap, colours: new Map([...to].filter(([a, b]) => a !== b)), ...(ceiling ? { ceiling } : {}) };
}

/**
 * 이 글이 말한 색의 기물 id — 그 색은 «정한 것» 이라 바꾸지 않는다. 색 낱말은 칩셋 표에서 온다: 영어는 id 의 끝 낱말, 한국어는 한 벌의
 * 이름(ko)에서 다른 식구와 다른 마디(«깃발 빨강» 의 빨강 · «붉은 양탄자(자동 타일)» 의 붉은). 손으로 적은 낱말 목록은 없다.
 */
export function colourNamedIds(S: HandInteriorSpec, text: string): Set<string> {
  const t = text.toLowerCase();
  const words = (ko: string) => ko.replace(/\([^)]*\)/gu, " ").split(/\s+/u).filter(Boolean);
  const families = [...paletteFamilies(S).values()];
  // 색 낱말 → 그 색을 부르는 말들(영어 색 낱말 + 모든 한 벌에서 그 색 식구만 가진 한국어 마디: «파랑»·«파란»).
  const said = new Map<string, Set<string>>();
  for (const members of families) {
    const kos = [...members.values()].map((id) => words(S.objects[id]?.ko ?? S.lines?.[id]?.ko ?? ""));
    const shared = kos.reduce<string[]>((acc, w) => acc.filter((x) => w.includes(x)), kos[0] ?? []);
    [...members.keys()].forEach((colour, i) => {
      const set = said.get(colour) ?? said.set(colour, new Set([colour])).get(colour)!;
      for (const w of kos[i]!) if (!shared.includes(w) && w.length >= 2) set.add(w);
    });
  }
  const named = new Set([...said].filter(([, ws]) => [...ws].some((w) => (/^[a-z]+$/u.test(w) ? new RegExp(`\\b${w}\\b`, "u").test(t) : t.includes(w)))).map(([c]) => c));
  const out = new Set<string>();
  for (const members of families) for (const [colour, id] of members) if (named.has(colour)) out.add(id);
  return out;
}

/** 짓기 인자(objects · lines)에 색 한 벌을 입힌다. keep = 요청이 말한 것으로 적힌 id(그대로 둔다). */
export function applyInteriorPalette<T extends { objects?: readonly { id: string }[]; lines?: readonly { id: string }[] }>(input: T, palette: InteriorPalette, keep: ReadonlySet<string>): { input: T; swapped: number } {
  let swapped = 0;
  const re = <E extends { id: string }>(list: readonly E[] | undefined): E[] | undefined => list?.map((e) => {
    const next = keep.has(e.id) ? undefined : palette.swap.get(e.id);
    if (!next) return e;
    swapped += 1;
    return { ...e, id: next };
  });
  return { input: { ...input, ...(input.objects ? { objects: re(input.objects) } : {}), ...(input.lines ? { lines: re(input.lines) } : {}) }, swapped };
}
