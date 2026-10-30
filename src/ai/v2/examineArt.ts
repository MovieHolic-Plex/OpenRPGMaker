// 조수 v2 — 조사 이벤트가 말하는 물건을 «그림으로» 보이게 한다.
//
// 왜(2026-10-28 interior 장부 39): 「서쪽 책상 위의 낡은 일기장을 읽어라」인데 책상 상판에 일기장 그림이 없었다 — 퍼즐 사슬은 새 조사 이벤트를
// 투명 그림({})으로 세우고, upsert_event 도 「일기장」에 맞는 칩 그림을 못 찾아 투명으로 두었다. 플레이어는 빈 책상을 조사해야 했다.
// 그래서: 이벤트 이름의 물건 낱말(일기장·편지·열쇠·두루마리…) → 손 도트 실내의 «탁상 물건»(4층)을 이벤트 칸 책상 윗면에 얹는다.
// 이벤트가 책상 바로 앞 바닥에 있으면 옆 책상 윗면에 얹는다(이벤트 자리는 eventReach 가 정하므로 옮기지 않는다). 둘 다 아니면 바닥 소품(일기장 받침·책 더미)을
// 이벤트 칸에 세우되, 걸어 닿는 칸이 줄면 되돌린다. 이미 그 물건 그림 위에 선 이벤트(금고·책장)는 건드리지 않는다.
// 문·상자 같은 칩 그림 사물은 조사하면 플레이어 쪽으로 «돌아서» 다른 방향 줄(열린 문짝)을 보였다 — 그림을 고정한다(fixedGraphic).
import { roomSpecOf, surfaceRowOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import type { GameMap } from "@/project/types";
import { objectEventFit } from "./placementRules";
import { access, handObjectKitId } from "./builders/dressRoom";
import { unreachableEvents } from "./eventReach";
import { PERSON_SPOT_BAD, personSpotContext, personSpotCost } from "./people";
import type { BuildRun } from "./types";

/** 물건 낱말 → 탁상 물건(goods) 후보, 바닥 소품(objects) 후보. 앞이 먼저. */
const THINGS: readonly [RegExp, readonly string[], readonly string[]][] = [
  [/일기|diary|journal|수첩|노트|notebook/iu, ["openbook", "book"], ["diary stand", "book pile"]],
  [/마도서|마법서|spell ?book|grimoire/iu, ["openbook", "bookb"], ["spellbook stand", "floating book", "book pile"]],
  [/책|book|서적|장부|ledger/iu, ["book", "bookstack", "openbook"], ["book pile"]],
  [/편지|letter|쪽지|메모|memo|note|서류|문서|기록|record|paper|사진|photo|유서|계약서|신문|newspaper|전단/iu, ["papers", "openbook"], ["book pile"]],
  [/두루마리|scroll|지도|\bmap\b|설계도|도면/iu, ["scroll"], ["scroll pile"]],
  [/열쇠|key/iu, ["keys"], []],
  [/물약|약병|potion|약|bottle|병\b/iu, ["potion", "bottle", "vial"], []],
  [/촛대|양초|candle/iu, ["candlestick", "candle"], []],
  [/보석|브로치|반지|목걸이|gem|jewel|ring|brooch|necklace/iu, ["gem", "gemr"], []],
  [/동전|금화|coin|돈/iu, ["coins"], []],
  [/작은 ?상자|보석함|함\b|box|casket/iu, ["sealbox", "box"], []],
  // 「비밀번호 입력」「자물쇠」처럼 이름이 물건이 아닌 번호 자물쇠 단계 — 문맥 낱말(examineSpot.examineHint)로 금고를 세운다(2026-10-29 flash).
  [/금고|자물쇠|비밀번호|암호|safe|lock|password|code/iu, ["cashbox", "sealbox"], ["safe", "royal chest"]],
  [/상자|궤짝|chest|crate/iu, ["sealbox", "box"], ["chest", "sea chest", "crate"]],
  [/찻잔|잔\b|컵|cup|mug/iu, ["cup", "mug"], []],
  // 추리 단서(2026-10-29 vm mystery 「젖은 장화 자국 위치를 못 찾았다」) — 바닥 자국은 물웅덩이, 천·단추는 옷감, 장물·돈주머니는 자루.
  [/장화|발자국|자국|진흙|흙탕|물기|젖은|footprint|mud|boot/iu, [], ["drip puddle", "straw pile"]],
  [/천\s*조각|옷감|헝겊|단추|소매|cloth|button|fabric/iu, ["clothfold", "spools", "yarn"], ["luggage trunk"]],
  [/장물|돈주머니|금주머니|주머니|보물|금시계|시계|pouch|loot/iu, ["coins", "gem"], ["loot sacks", "coin pile"]],
  [/증거품|증거|단서|흔적|evidence|clue/iu, ["sealbox", "papers"], ["luggage trunk", "chest"]],
  [/깃펜|펜\b|quill|잉크|ink/iu, ["quill", "inkwell"], []],
];

/** 윗면 그림 칸 타일(책상·탁자·카운터·협탁의 윗면) — 빌더의 surfaceCells 와 같은 눈. */
const surfaceCache = new WeakMap<HandInteriorSpec, Set<number>>();
function surfaceTiles(spec: HandInteriorSpec): Set<number> {
  const hit = surfaceCache.get(spec);
  if (hit) return hit;
  const out = new Set<number>();
  for (const [id, o] of Object.entries(spec.objects)) {
    if (!(o.surface || /counter|table|desk|booth|zashiki|kotatsu|chabudai|reception|teller/iu.test(id))) continue;
    const row = surfaceRowOf(id, o as { surfaceRow?: number });
    for (const [, dy, tile] of o.cells) if (row !== undefined ? dy === row : dy >= 0 && dy < Math.max(1, o.h)) out.add(tile);
  }
  for (const t of Object.values(spec.tables ?? {})) for (const cells of Object.values(t.pieces)) for (const c of cells) out.add(c[2]);
  surfaceCache.set(spec, out);
  return out;
}

function at(map: GameMap, x: number, y: number): { l3: number; l4: number } | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  const i = y * map.width + x;
  return { l3: map.upperTiles[i] ?? -1, l4: map.upperOverlayTiles?.[i] ?? -1 };
}

function isTransparent(graphic: unknown): boolean {
  const g = graphic as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown; tileId?: unknown } | undefined;
  return !g || g.transparent === true || (!g.sprite && !g.appearanceId && g.tileId === undefined);
}

/** 칩 그림 사물(문·상자·철창…)인가 — 사람 칩이 아니라 Object 시트. */
export function isObjectSheetGraphic(graphic: unknown): boolean {
  const id = String((graphic as { sprite?: { id?: string } } | undefined)?.sprite?.id ?? "");
  return /charset_object|_object\d|objects?$/iu.test(id);
}

/**
 * 조사 이벤트 하나의 물건을 보이게 한다. 바꾼 것을 한 줄로 돌려준다(안 바꿨으면 undefined).
 * 손 도트 실내 칩셋이 아니거나, 이벤트가 이미 보이는 그림(칩)을 가졌거나, 이름이 아는 물건이 아니면 아무것도 안 한다.
 */
export function showExaminedThing(run: BuildRun, mapId: string, eventId: string, hint = ""): string | undefined {
  const map0 = run.ctx.project.maps[mapId];
  const ev0 = map0?.events.find((e) => e.id === eventId);
  if (!map0 || !ev0) return undefined;
  const spec = roomSpecOf(run.ctx.project.tilesets[map0.tilesetId]);
  if (!spec) return undefined;
  if (!(ev0.pages ?? []).every((p) => isTransparent(p.graphic))) return undefined;
  const name = ev0.name ?? "";
  // 이름에 물건이 없으면(「조사 시작」) 문맥 낱말(단계 역할·대사 — examineSpot.examineHint)로 고른다.
  const thing = THINGS.find(([re]) => re.test(name)) ?? (hint ? THINGS.find(([re]) => re.test(hint)) : undefined);
  if (!thing) return undefined;
  // 이미 그 물건 그림 위·앞에 섰다(금고 위의 금고 이벤트) — 그대로.
  if (objectEventFit(run.ctx.project, map0, ev0)?.ok) return undefined;
  const goods = thing[1].map((g) => [g, spec.goods[g]] as const).find(([, t]) => t !== undefined);
  const surfaces = surfaceTiles(spec);
  // 책상 윗면에 다른 탁상 물건(지구의·촛대)이 이미 있으면 바꿔 얹는다 — 「일기장」 자리에 지구의가 있으면 그 칸을 조사할 까닭이 안 보인다.
  const goodsTiles = new Set(Object.values(spec.goods));
  const paintGoods = (x: number, y: number): boolean => {
    if (!goods) return false;
    const res = run.call("paint_tiles", { mapId, layer: "4", mode: "cells", tile: goods[1], cells: [{ x, y }] });
    return res.ok;
  };
  const onSurface = (x: number, y: number): boolean => { const c = at(run.ctx.project.maps[mapId]!, x, y); return !!c && c.l3 >= 0 && surfaces.has(c.l3) && (c.l4 < 0 || goodsTiles.has(c.l4)); };
  // 1) 이벤트 칸이 책상 윗면이다 — 그 위에 얹는다.
  if (goods && onSurface(ev0.x, ev0.y) && paintGoods(ev0.x, ev0.y)) return `「${name}」 — 책상 윗면 (${ev0.x},${ev0.y}) 에 ${goods[0]} 그림을 얹었다`;
  // 2) 이벤트가 책상 앞 바닥이다 — 바로 옆 책상 윗면에 그림만 얹는다. 이벤트 자리는 옮기지 않는다(자리는 eventReach 가 정본).
  for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
    const x = ev0.x + dx, y = ev0.y + dy;
    if (!goods || !onSurface(x, y)) continue;
    if (paintGoods(x, y)) return `「${name}」 — 바로 옆 책상 윗면 (${x},${y}) 에 ${goods[0]} 그림을 얹었다`;
  }
  // 3) 맨바닥이다 — 바닥 소품(일기장 받침·책 더미)을 이벤트 칸에 세운다. 걸어 닿는 칸이 줄면 되돌린다.
  const map = run.ctx.project.maps[mapId]!;
  const cell = at(map, ev0.x, ev0.y);
  if (!cell || cell.l3 >= 0 || cell.l4 >= 0 || !isPassable(run.ctx.project, map, ev0.x, ev0.y)) return undefined;
  // 큰 양탄자(통로 러너·홀 카펫)·문 곁·가구의 하나뿐인 접근 칸이면 소품을 세우기 전에 이벤트를 곁의 괜찮은 맨바닥으로 옮긴다 —
  // 추리 단서 받침대·상자가 여관 홀 붉은 카펫 한가운데 서서 통로를 막고 사람과 겹쳤다(2026-10-29 vm4 argon·flash mystery).
  // 옮길 칸이 없으면 소품을 세우지 않는다(반짝이로 남긴다).
  const spot0 = personSpotContext(run.ctx.project, map, eventId);
  let ev = ev0;
  const rollback = run.ctx.project;
  if (personSpotCost(run.ctx.project, map, ev0, spot0) >= PERSON_SPOT_BAD) {
    const unreached0 = unreachableEvents(run.ctx.project, mapId).length;
    const cands: { x: number; y: number; s: number }[] = [];
    for (let y = ev0.y - 3; y <= ev0.y + 3; y++) for (let x = ev0.x - 3; x <= ev0.x + 3; x++) {
      const d = Math.abs(x - ev0.x) + Math.abs(y - ev0.y);
      if (!d || d > 3) continue;
      const c = at(map, x, y);
      if (!c || c.l3 >= 0 || c.l4 >= 0 || !isPassable(run.ctx.project, map, x, y) || !spot0.reach[y * map.width + x]) continue;
      if (map.events.some((e) => e.x === x && e.y === y)) continue;
      const sc = personSpotCost(run.ctx.project, map, { x, y }, spot0);
      if (sc < PERSON_SPOT_BAD) cands.push({ x, y, s: d + sc });
    }
    cands.sort((a, b) => a.s - b.s);
    let moved = false;
    for (const c of cands.slice(0, 12)) {
      const res = run.call("move_event", { mapId, eventId, x: c.x, y: c.y });
      if (res.ok && unreachableEvents(run.ctx.project, mapId).length <= unreached0) { moved = true; break; }
      run.ctx.project = rollback;
    }
    if (!moved) return undefined;
    ev = run.ctx.project.maps[mapId]!.events.find((e) => e.id === eventId)!;
  }
  const before = access(run.ctx.project, mapId);
  for (const id of thing[2]) {
    const o = spec.objects[id];
    const kitId = o && o.w === 1 ? handObjectKitId(run.ctx.project, map.tilesetId, id) : undefined;
    if (!o || !kitId) continue;
    const minDx = Math.min(...o.cells.map((c) => c[0])), minDy = Math.min(...o.cells.map((c) => c[1]));
    const snapshot = run.ctx.project;
    const res = run.call("stamp_object", { objectId: `kit:${map.tilesetId}/${kitId}`, mapId, x: ev.x + minDx, y: ev.y + minDy });
    const now = res.ok ? access(run.ctx.project, mapId) : undefined;
    if (!res.ok || !now || now.stranded > before.stranded || now.cutOff > before.cutOff || unreachableEvents(run.ctx.project, mapId, [eventId]).length) { run.ctx.project = snapshot; continue; }
    return `「${name}」 — 바닥 (${ev.x},${ev.y}) 에 ${o.ko} 그림을 세웠다${ev !== ev0 ? `(양탄자·문 곁 (${ev0.x},${ev0.y}) 에서 옮김)` : ""}`;
  }
  if (ev !== ev0) run.ctx.project = rollback;
  return undefined;
}

/** 칩 그림 사물 이벤트의 페이지 그림을 고정한다 — 조사할 때 플레이어 쪽으로 돌아 다른 줄(열린 문짝·열린 상자)이 보이지 않게. */
export function fixObjectSheetFacing(run: BuildRun, mapId: string, eventId: string): boolean {
  const ev = run.ctx.project.maps[mapId]?.events.find((e) => e.id === eventId);
  if (!ev) return false;
  let changed = false;
  for (const [pageIndex, page] of (ev.pages ?? []).entries()) {
    if (!isObjectSheetGraphic(page.graphic)) continue;
    const anim = (page as { animationType?: string }).animationType;
    if (anim === "fixedGraphic" || anim === "fixedDirection" || anim === "fixedDirectionStep") continue;
    const res = run.call("patch_event_page", { mapId, eventId, pageIndex, set: { animationType: "fixedGraphic" } });
    changed = changed || res.ok;
  }
  return changed;
}
