// 실내 방 모양 — 모양 낱말에서 평면을 짜고(composeShape) 구역별 바닥·벽 재질을 정한다(roomMaterials).
import { type HandInteriorSpec } from "@/editor/handInterior/builder";
import { hashText, roomCharacters, seeded } from "@/editor/handInterior/vignettes";
import type { HandInteriorNotch } from "@/editor/handInterior/rooms";

export interface RoomShape {
  readonly label: string; readonly w: number; readonly h: number; readonly notches: HandInteriorNotch[]; readonly exitAt: number;
  readonly floor?: string; readonly wall?: string; readonly characters: string[];
  readonly annex?: { readonly id: string; readonly kind: string; readonly purpose: string; readonly w: number; readonly h: number };
}

/** 성격 → 재질 후보(바닥, 벽면). 칩셋 v5 견본이 쓰는 재질만. */
const SHAPE_MATERIALS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  noble: [["dplank", "plaster"], ["dplank", "marblewall"]],
  arcane: [["dplank", "stone"], ["flag", "stone"]],
  astro: [["dplank", "stone"], ["dplank", "plaster"]],
  scholar: [["dplank", "plaster"], ["plank", "log"]],
  elf: [["elfstone", "livewood"]],
  plain: [["dplank", "plaster"], ["plank", "log"], ["plank", "plaster"]],
};

/** 성격 → 곁방(종류, 용도 글). */
const SHAPE_ANNEX: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  arcane: [["alchemy", "마법사의 연금 구석"], ["library", "마법서 서고"]],
  astro: [["library", "별 지도 서고"]],
  scholar: [["library", "학자의 서고"]],
  noble: [["library", "저택 서고"]],
  plain: [["library", "서고"]],
};

/**
 * 조합 방 모양 — 씨앗(게임 열쇠·장소·구역)과 크기 낱말로 고른다. 묶음 발자국으로 정한 바닥 넓이(base)를 지키며 모양만 바꾼다:
 * 네모(4:3·가로로 긴·세로로 깊은) · ㄱ/ㄴ자(한 귀퉁이 도려 냄) · 창가 돌출(북쪽 두 귀퉁이를 도려 가운데가 북으로 나온 방) ·
 * ㅗ자(남쪽 두 귀퉁이, 출구는 가운데) · 곁방(서고·연금 구석이 딸린 2실). 작은 방은 네모·ㄱ자만.
 */
export function composeShape(key: string, size: string | undefined, text: string, base: { w: number; h: number }, single: boolean): RoomShape {
  const r = seeded(hashText(`${key}|shape`));
  const said = roomCharacters(text);
  const characters = said.length ? said : ["plain"];
  const main = characters[0]!;
  // 바닥 넓이는 크기 낱말로 — 손 서재 견본의 바닥(7×5 35칸 · 8×6 48칸 · 9×6 54칸)과 같은 띠, 씨앗으로 ±15%. 묶음 발자국 넓이(base)는
  // 큰 벽 묶음(책장+벽난로+책장) 하나로 방이 14×11 로 부풀어 맨바닥 40% 넘는 빈 방이 됐다(2026-10-29 study-variety 첫 판) — 그보다 크게 잡지 않는다.
  // 2판(감독 눈 검수 「맨바닥 30%」): 띠를 한 단 줄였다 — 남는 바닥은 메우지 않고 방을 줄인다(맨바닥 15% 한도).
  const band = size === "small" ? [18, 26] : size === "large" ? [42, 60] : [28, 44];
  const floorArea = Math.min(base.w * Math.max(3, base.h - 2), Math.round(band[0]! + r() * (band[1]! - band[0]!)));
  const small = size === "small";
  const kinds: [string, number][] = [["rect", 2], ["wide", 1.5], ["deep", 1], ["L", 2.5], ...(small ? [] : [["bay", 1.5], ["T", 1.5], ...(single ? [["annex", 2] as [string, number]] : [])] as [string, number][])];
  const total = kinds.reduce((n, [, w]) => n + w, 0);
  let roll = r() * total, kindPick = "rect";
  for (const [k, w] of kinds) { if ((roll -= w) < 0) { kindPick = k; break; } }
  // 바닥은 6줄 이상 — 북벽 책장 줄·그 앞 통로·책상·책상을 보는 의자·문 앞 통로가 한 줄씩(5줄이면 의자가 문 앞 칸에 걸려 책상이 빠졌다).
  const dims = (ratio: number, extra = 0) => { const a = floorArea + extra; const w = Math.max(7, Math.round(Math.sqrt(a * ratio))); return { w, h: Math.max(6, Math.ceil(a / w)) + 2 }; };
  const mats = SHAPE_MATERIALS[main] ?? SHAPE_MATERIALS.plain!;
  const [floor, wall] = mats[Math.floor(r() * mats.length)]!;
  const exitAt = 0.25 + r() * 0.5;
  const out = (label: string, d: { w: number; h: number }, notches: HandInteriorNotch[], extra: Partial<RoomShape> = {}): RoomShape => ({ label, ...d, notches, exitAt, floor, wall, characters, ...extra });
  switch (kindPick) {
    case "wide": return out("가로로 긴 네모", dims(2.1), []);
    case "deep": return out("깊은 네모", dims(0.85), []);
    case "L": {
      const north = r() < 0.4, west = r() < 0.5;
      const n: HandInteriorNotch = { corner: `${north ? "n" : "s"}${west ? "w" : "e"}` as HandInteriorNotch["corner"], w: 3, h: north ? 2 : 3 };
      const d = dims(1.5, n.w * n.h);
      return out(north ? "ㄱ자(북쪽 귀퉁이 벽장)" : "ㄴ자(남쪽 귀퉁이 도려 냄)", { w: Math.max(d.w, 8), h: Math.max(d.h, north ? 7 : 8) }, [n]);
    }
    case "bay": {
      // 가운데 북벽에 책장 줄이 설 만큼(6칸↑) 넓게 — 3칸씩 도려 낸 10칸 방은 가운데가 4칸이라 책장이 하나도 못 섰다.
      const nw = 2;
      const d = dims(1.7, 2 * nw * 2);
      return out("창가 돌출(북쪽 가운데가 나온 방)", { w: Math.max(d.w, 2 * nw + 10), h: Math.max(d.h, 8) }, [{ corner: "nw", w: nw, h: 2 }, { corner: "ne", w: nw, h: 2 }]);
    }
    case "T": {
      const d = dims(1.8, 2 * 2 * 2);
      return { ...out("ㅗ자(남쪽 두 귀퉁이 도려 냄)", { w: Math.max(d.w, 10), h: Math.max(d.h, 8) }, [{ corner: "sw", w: 2, h: 2 }, { corner: "se", w: 2, h: 2 }]), exitAt: 0.5 };
    }
    case "annex": {
      const list = SHAPE_ANNEX[main] ?? SHAPE_ANNEX.plain!;
      const [kind, purpose] = list[Math.floor(r() * list.length)]!;
      const d = dims(1.4, -6);
      return out(`곁방 딸린 2실`, { w: Math.max(6, d.w), h: Math.max(7, d.h) }, [], { annex: { id: `${kind}-annex`, kind, purpose, w: 5 + Math.floor(r() * 2), h: 7 } });
    }
    default: return out("네모", dims(0.9 + r() * 0.9), []);
  }
}

/** 이미 지어진 맵의 바닥·벽면 재질 id(칩셋 사양의 타일 목록에서 찾는다) — 고치기가 원래 재질을 지키게. */
function materialAt(spec: HandInteriorSpec, tiles: readonly (number | null | undefined)[], width: number, x: number, y: number, family: "floors" | "walls"): string | undefined {
  const t = tiles[y * width + x];
  if (t === undefined || t === null || t < 0) return undefined;
  for (const [id, def] of Object.entries((spec as unknown as Record<string, Record<string, { tiles?: number[] }>>)[family] ?? {})) if (def.tiles?.includes(t)) return id;
  return undefined;
}

export function roomMaterials(spec: HandInteriorSpec, map: { width: number; lowerTiles: readonly (number | null | undefined)[] }, rect: { x: number; y: number; w: number; h: number }): { floor?: string; wall?: string } {
  const cx = rect.x + Math.floor(rect.w / 2);
  const floor = materialAt(spec, map.lowerTiles, map.width, cx, rect.y + Math.min(rect.h - 1, 3), "floors") ?? materialAt(spec, map.lowerTiles, map.width, cx, rect.y + rect.h - 1, "floors");
  const wall = materialAt(spec, map.lowerTiles, map.width, cx, rect.y + 1, "walls") ?? materialAt(spec, map.lowerTiles, map.width, cx, rect.y, "walls");
  return { ...(floor ? { floor } : {}), ...(wall ? { wall } : {}) };
}
