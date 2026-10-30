// 칩셋 목록 카드 생성기 — 손 목록 없이 칩셋 메타데이터(roomKit 역할표 · 예제 방 표 · 조립 킷 기물)만으로 영어 목록을 만든다.
//
// 왜(2026-10-31, agent/bbox-chipsets scripts/experiments/bbox-chipsets/catalog.mts·spec.mts): roomKit 이 있는 칩셋이면 어느 것이든
// 같은 칸 배치 길로 지을 수 있게. 요청 낱말이 맞는 방 종류(spec.rooms.kinds 의 이름·별칭)의 예제 표 기물을 «이 장소에 맞는 것»으로 먼저,
// 그다음 낱말 검색(searchParts) 결과를, 그다음 칩셋 전체 목록(종류별)을 싣는다. 목록 글은 영어 id·크기·놓는 규칙뿐이다.
import { roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { searchParts } from "@/editor/handInterior/parts";
import { kitHandObjects } from "@/project/roomKit";
import type { TilesetDef } from "@/project/types";
import { layoutCatalog } from "./interiorLayout";

/** 칩셋의 실효 방 사양 — roomKit 역할표(roomSpecOf), 가구 표가 비면 조립 킷 기물(kitHandObjects). 편집기 도구 specFor 와 같은 규칙. */
export function effectiveSpec(tileset: TilesetDef | undefined): HandInteriorSpec | undefined {
  const base = roomSpecOf(tileset);
  if (!base) return undefined;
  const kits = Object.keys(base.objects).length ? {} : kitHandObjects(tileset);
  return Object.keys(kits).length ? { ...base, objects: { ...base.objects, ...kits } as HandInteriorSpec["objects"] } : base;
}

const RULE: Record<string, string> = { floor: "f", wall: "w", hang: "h", flat: "d", door: "door", sidedoor: "sidedoor" };
const entry = (S: HandInteriorSpec, id: string): string | undefined => {
  const o = S.objects[id]; if (!o) return undefined;
  const up = Math.round((o.up ?? 0) / 16);
  const k = o.stairs ? `s${o.stairs === "up" ? "u" : "d"}` : RULE[o.kind] ?? "f";
  return `${id} ${o.w}x${Math.max(1, o.h)} ${k}${up > 0 ? `^${up}` : ""}`;
};

/** 요청 낱말에 맞는 방 종류 키(이름·한국어 이름·별칭이 낱말에 들어 있다). */
export function roomKindsFor(S: HandInteriorSpec, text: string): string[] {
  const t = text.toLowerCase();
  return Object.entries(S.rooms?.kinds ?? {}).filter(([k, v]) => {
    const words = [k.replace(/_/gu, " "), v.ko, ...(v.alias ?? [])].filter((w) => w && w.length >= 2);
    return words.some((w) => t.includes(w.toLowerCase()));
  }).map(([k]) => k);
}

/** 이 장소에 맞는 기물 — 맞는 방 종류의 예제 표(많이 쓰인 순) → 낱말 검색. 최대 max 개. */
export function suggestedPieces(S: HandInteriorSpec, text: string, max = 70): { kinds: string[]; ids: string[]; sized: string[] } {
  const kinds = roomKindsFor(S, text);
  const used = new Map<string, number>(); const sized = new Set<string>();
  for (const [, , room, items] of S.rooms?.examples ?? []) if (kinds.includes(room)) for (const [id, n] of items) used.set(id, (used.get(id) ?? 0) + n);
  const ids: string[] = [];
  for (const [id] of [...used].sort((a, b) => b[1] - a[1])) {
    const m = /^([a-z-]+) (\d+)x(\d+)$/u.exec(id);
    if (S.objects[id]) ids.push(id); else if (m && S.tables[m[1]!]) sized.add(id);
  }
  if (text.trim()) {
    const r = searchParts(text, "", S);
    const ranked = [...r.hits].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    for (const id of ranked) { if (ids.length >= max) break; if (!ids.includes(id)) ids.push(id); }
  }
  return { kinds, ids: ids.slice(0, max), sized: [...sized].slice(0, 12) };
}

const cache = new Map<string, string>();
/** 목록 카드 글(영어). 같은 칩셋·같은 방 종류면 캐시한다. */
export function chipsetCatalog(tileset: TilesetDef | undefined, text = ""): string | undefined {
  const S = effectiveSpec(tileset);
  if (!tileset || !S || !Object.keys(S.objects).length) return undefined;
  const sug = suggestedPieces(S, text);
  const key = `${tileset.id}|${Object.keys(S.objects).length}|${sug.kinds.join(",")}|${sug.ids.slice(0, 8).join(",")}`;
  const hit = cache.get(key); if (hit) return hit;
  const suggested = sug.ids.map((id) => entry(S, id)).filter(Boolean);
  const out = [
    `[Interior catalog — chipset ${tileset.id}, 16px cells; exact ids for make_place spec.layout. Generated from the chipset's own room tables and pieces.]`,
    ...(suggested.length ? [`suggested for this request${sug.kinds.length ? ` (room examples: ${sug.kinds.join(", ")})` : ""}: ${suggested.join(", ")}${sug.sized.length ? `; sized pieces used there: ${sug.sized.join(", ")}` : ""}`] : []),
    layoutCatalog(S),
  ].join("\n");
  cache.set(key, out);
  return out;
}
