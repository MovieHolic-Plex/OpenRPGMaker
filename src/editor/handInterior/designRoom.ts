// 모델이 설계한 방(RoomDesign)을 그대로 짓고, 함수는 «조화·검사»만 한다(2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」).
//
// 누가 무엇을 정하나:
//  - 모델: 방 모양(네모·ㄱ자·ㅗ자·창가 돌출)·바닥 크기·문 자리·바닥/벽 재질, 가구 묶음(무엇을·몇 개·묶음 안 상대 자리)과 묶음마다 놓을 벽·모서리·가운데·벽을 따라 몇 % 자리, 깔개.
//  - 함수(이 파일): 칩셋에 없는 기물 이름을 가까운 이름으로 맞추거나 빼기, 묶음 안 겹침 풀기, 책상·탁자 옆 의자 방향 맞추기, 벽 가구(책장)는 북벽에만·걸이는 벽면 윗줄에만,
//    방 안·도려 낸 귀퉁이·문 앞 통로를 피해 가장 가까운 자리로 밀기, 놓을 때마다 조립기 도달 검사(닿지 못하는 바닥이 늘면 다음 자리), 끝내 못 놓으면 빼기.
//    고친 것은 모두 fixes 에 한 줄씩 남겨 모델에게 돌려준다 — 모델이 보고 설계를 고쳐 다시 지을 수 있다.
// 함수는 가구를 더하지 않는다(빈 바닥은 알리기만 한다).
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import { notchRect } from "./rooms";
import type { LayoutRoom } from "./layout";
import type { InteriorTemplateItem } from "./templates";
import { doorwayCells } from "./furnish";
import { blocks, box, cellsOfBox, wallColumns, withItems } from "./vignettes";
import type { TilesetDef } from "@/project/types";

export type DesignAt = "north" | "south" | "west" | "east" | "center" | "nw" | "ne" | "sw" | "se";
export interface RoomDesignItem {
  /** 칩셋 기물 id(예: "bookshelf 3w", "desk 3x1", "chair N") 또는 탁상 물건 id. */
  readonly id: string;
  /** 묶음 안 상대 칸(왼쪽 위 = 0,0). 생략하면 앞 기물 옆(북·남·가운데 묶음은 오른쪽으로, 서·동 묶음은 아래로) 이어 붙인다. */
  readonly dx?: number; readonly dy?: number;
  /** 같은 기물을 몇 개 잇대어(기본 1, 최대 8). */
  readonly count?: number;
}
export interface RoomDesignGroup {
  /** 묶음 이름(모델이 붙인다): 「책상 자리」「독서 구석」「책장 벽」. */
  readonly name?: string;
  /** 놓는 곳. 기본 center. */
  readonly at?: DesignAt;
  /** 그 벽을 따라 0(서·북 끝)~1(동·남 끝). 기본 0.5. */
  readonly pos?: number;
  /** 바닥 칸 좌표(바닥 왼쪽 위 = 0,0 — 벽면 두 줄 아래 첫 바닥 줄). 주면 at·pos 보다 먼저. */
  readonly x?: number; readonly y?: number;
  /** 묶음 밑 깔개 — "rug red|royal|blue|green|purple|brown" 또는 색 낱말. */
  readonly rug?: string;
  readonly items: readonly RoomDesignItem[];
}
export interface RoomDesign {
  /** rect 네모 · L ㄱ자(corner 귀퉁이를 도려 냄) · T ㅗ자(남쪽 두 귀퉁이) · bay 창가 돌출(북쪽 두 귀퉁이). */
  readonly shape?: "rect" | "L" | "T" | "bay";
  /** 바닥 가로·세로(벽면 줄 빼고). */
  readonly w?: number; readonly h?: number;
  readonly corner?: "nw" | "ne" | "sw" | "se";
  /** 남쪽 출구 자리. */
  readonly door?: "left" | "center" | "right";
  readonly floor?: string; readonly wall?: string;
  readonly groups?: readonly RoomDesignGroup[];
}
export interface DesignRoomReport { placed: string[]; fixes: string[]; blockedShare: number; floor: number; items: number }
export interface DesignFurnishResult { readonly input: HandInteriorInput; readonly perRoom: Record<string, DesignRoomReport> }

const RUG_WORDS: readonly [RegExp, string][] = [[/royal|진홍|왕/iu, "rug royal"], [/red|붉|빨/iu, "rug red"], [/blue|파랑|파란|푸른/iu, "rug blue"], [/green|초록|녹/iu, "rug green"], [/purple|보라/iu, "rug purple"], [/brown|갈색|밤색/iu, "rug brown"]];
const SURFACE_RE = /desk|table|counter|roundtable|dining|bench|altar|stand|lectern/iu;
const FACE_RE = /^(.*) ([NSEW])$/u;

/** 칩셋에 있는 이름으로 맞춘다: 정확히 → 대소문자 무시 → 한국어 이름 → 낱말 포함(가장 짧은 것). */
export function resolveDesignItem(raw: string, S: HandInteriorSpec): { t: "o" | "g"; id: string } | undefined {
  const id = String(raw ?? "").trim();
  if (!id) return undefined;
  if (S.objects[id]) return { t: "o", id };
  if (S.goods[id] !== undefined) return { t: "g", id };
  const low = id.toLowerCase();
  const objs = Object.entries(S.objects);
  const exact = objs.find(([k, o]) => k.toLowerCase() === low || o.ko === id);
  if (exact) return { t: "o", id: exact[0] };
  const good = Object.keys(S.goods).find((k) => k.toLowerCase() === low);
  if (good) return { t: "g", id: good };
  const words = low.split(/[\s_·,/-]+/u).filter((w) => w.length >= 2);
  if (!words.length) return undefined;
  const hits = objs.filter(([k, o]) => { const hay = `${k} ${o.ko}`.toLowerCase(); return words.every((w) => hay.includes(w)); }).sort((a, b) => a[0].length - b[0].length);
  return hits[0] ? { t: "o", id: hits[0][0] } : undefined;
}
const rugId = (word: string | undefined, S: HandInteriorSpec): string | undefined => {
  if (!word) return undefined;
  if (S.lines[word]) return word;
  const hit = RUG_WORDS.find(([re]) => re.test(word));
  const id = hit?.[1] ?? "rug red";
  return S.lines[id] ? id : Object.keys(S.lines).find((k) => k.startsWith("rug"));
};

interface LocalItem { it: InteriorTemplateItem; hang: boolean; wallKind: boolean }

/** 묶음 하나를 상대 좌표 기물 목록으로(이름 맞춤·묶음 안 겹침 풀기·의자 방향은 여기서). */
function localGroup(g: RoomDesignGroup, S: HandInteriorSpec, label: string, fixes: string[]): LocalItem[] {
  const vertical = g.at === "west" || g.at === "east";
  const out: LocalItem[] = [];
  const taken = new Set<string>();
  let cursor = 0;
  for (const raw of (g.items ?? []).slice(0, 24)) {
    const r = resolveDesignItem(raw.id, S);
    if (!r) { fixes.push(`${label}: 「${raw.id}」는 칩셋에 없어 뺐다`); continue; }
    if (r.id !== raw.id) fixes.push(`${label}: 「${raw.id}」를 칩셋 이름 「${r.id}」로 맞췄다`);
    const o = r.t === "o" ? S.objects[r.id] : undefined;
    const w = o?.w ?? 1, h = Math.max(1, o?.h ?? 1);
    const hang = o?.kind === "hang";
    const n = Math.max(1, Math.min(8, Math.floor(raw.count ?? 1)));
    for (let k = 0; k < n; k++) {
      let x: number, y: number;
      const given = typeof raw.dx === "number" || typeof raw.dy === "number";
      if (given) { x = Math.round(raw.dx ?? 0) + (vertical ? 0 : k * w); y = Math.round(raw.dy ?? 0) + (vertical ? k * h : 0); }
      else if (vertical) { x = 0; y = cursor; }
      else { x = cursor; y = 0; }
      if (hang) y = typeof raw.dy === "number" ? Math.min(-1, Math.round(raw.dy)) : -2;
      // 묶음 안에서 겹치면 이어 붙이는 쪽으로 민다.
      const cells = (px: number, py: number) => { const c: string[] = []; for (let yy = py; yy < py + (hang ? 1 : h); yy++) for (let xx = px; xx < px + w; xx++) c.push(`${xx},${yy}`); return c; };
      let shifted = 0;
      if (r.t === "o") while (cells(x, y).some((c) => taken.has(c)) && shifted < 12) { if (vertical) y++; else x++; shifted++; }
      if (shifted) fixes.push(`${label}: ${r.id} 가 같은 묶음 기물과 겹쳐 ${shifted}칸 밀었다`);
      if (r.t === "o") for (const c of cells(x, y)) taken.add(`${hang ? "h" : ""}${c}`);
      out.push({ it: { t: r.t, id: r.id, x, y }, hang, wallKind: o?.kind === "wall" });
      if (!given) cursor = vertical ? y + h : x + w;
      else cursor = Math.max(cursor, vertical ? y + h : x + w);
    }
  }
  // 의자 방향: 책상·탁자와 맞닿은 의자는 그쪽을 보게(그 방향 그림이 칩셋에 있을 때).
  for (const li of out) {
    const m = FACE_RE.exec(li.it.id);
    if (!m || !/chair|stool|armchair|sofa|bench/iu.test(m[1]!)) continue;
    const [cx, cy] = [li.it.x, li.it.y];
    const touch = (dx: number, dy: number) => out.some((q) => q !== li && q.it.t === "o" && SURFACE_RE.test(q.it.id) && (() => { const b = box(q.it, S); return cx + dx >= b[0] && cx + dx < b[2] && cy + dy >= b[1] && cy + dy < b[3]; })());
    const want = touch(0, -1) ? "N" : touch(0, 1) ? "S" : touch(-1, 0) ? "W" : touch(1, 0) ? "E" : undefined;
    if (!want || want === m[2]) continue;
    const next = `${m[1]} ${want}`;
    if (!S.objects[next]) continue;
    fixes.push(`${label}: ${li.it.id} 를 맞닿은 책상·탁자 쪽을 보게 ${next} 로 돌렸다`);
    (li as { it: InteriorTemplateItem }).it = { ...li.it, id: next };
  }
  // 바닥 상자 기준으로 0,0 에 맞춘다(걸이는 상대 y 그대로).
  const ground = out.filter((li) => !li.hang && li.it.t === "o");
  const mx = ground.length ? Math.min(...ground.map((li) => li.it.x)) : 0, my = ground.length ? Math.min(...ground.map((li) => li.it.y)) : 0;
  return out.map((li) => ({ ...li, it: { ...li.it, x: li.it.x - mx, y: li.hang ? li.it.y : li.it.y - my } }));
}

/** 설계가 있는 방마다 묶음을 놓는다. 다른 방은 건드리지 않는다. */
export function furnishFromDesign(base: HandInteriorInput, rooms: readonly LayoutRoom[], designs: Readonly<Record<string, RoomDesign>>, composed: ComposedRooms, tileset: TilesetDef, S: HandInteriorSpec): DesignFurnishResult {
  const keep = doorwayCells(composed);
  let input = base;
  const first = buildHandInteriorLayers(input, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const solid = new Set<string>(), flat = new Set<string>(), wcols = new Set<string>();
  const perRoom: Record<string, DesignRoomReport> = {};
  for (const room of rooms) {
    const design = designs[room.id];
    if (!design) continue;
    const fixes: string[] = [], placed: string[] = [];
    const fy0 = room.y0 + 2;
    const fw = room.x1 - room.x0 + 1, fh = room.y1 - fy0 + 1;
    const nrs = (room.notches ?? []).map((n) => notchRect(room, n));
    const inNotch = (x: number, y: number) => nrs.some((nr) => x >= nr.x0 && x <= nr.x1 && y >= nr.y0 && y <= nr.y1);
    let floor = 0;
    for (let y = fy0; y <= room.y1; y++) for (let x = room.x0; x <= room.x1; x++) if (!inNotch(x, y)) floor++;
    let blocked = 0, itemCount = 0;
    const groups: { g: RoomDesignGroup; label: string }[] = [];
    (design.groups ?? []).slice(0, 16).forEach((g, i) => {
      const label = `「${g.name ?? `묶음 ${i + 1}`}」`;
      // 벽 가구(책장·진열장)는 북벽 첫 바닥 줄에만 선다 — 다른 벽 묶음에 든 것은 북벽 묶음으로 떼어 낸다.
      if (g.at !== "north" && !(g.at === "nw" || g.at === "ne") && typeof g.y !== "number") {
        const wallItems = (g.items ?? []).filter((it) => { const r = resolveDesignItem(it.id, S); return r?.t === "o" && (S.objects[r.id]?.kind === "wall" || S.objects[r.id]?.kind === "hang"); });
        if (wallItems.length) {
          fixes.push(`${label}: 벽 가구·걸이(${wallItems.map((it) => it.id).join("·")})는 북벽에만 서서 북벽 묶음으로 옮겼다`);
          groups.push({ g: { ...g, items: (g.items ?? []).filter((it) => !wallItems.includes(it)) }, label });
          groups.push({ g: { name: `${g.name ?? `묶음 ${i + 1}`}(북벽)`, at: "north", pos: g.at === "west" || g.at === "sw" ? 0 : g.at === "east" || g.at === "se" ? 1 : g.pos ?? 0.5, items: wallItems.map((it) => ({ id: it.id, count: it.count })) }, label: `「${g.name ?? `묶음 ${i + 1}`}(북벽)」` });
          return;
        }
      }
      groups.push({ g, label });
    });
    for (const { g, label } of groups) {
      if (!(g.items ?? []).length) continue;
      const local = localGroup(g, S, label, fixes);
      if (!local.length) continue;
      const ground = local.filter((li) => !li.hang && li.it.t === "o");
      const gw = ground.length ? Math.max(...ground.map((li) => box(li.it, S)[2])) : Math.max(1, ...local.map((li) => box(li.it, S)[2]));
      const gh = ground.length ? Math.max(...ground.map((li) => box(li.it, S)[3])) : 1;
      if (ground.some((li) => li.wallKind && li.it.y !== 0)) fixes.push(`${label}: 벽 가구는 묶음 맨 윗줄(북벽에 붙는 줄)에 둬야 한다 — 도달 검사가 막으면 빠진다`);
      const at = typeof g.x === "number" && typeof g.y === "number" ? undefined : (g.at ?? "center");
      const pos = Math.max(0, Math.min(1, typeof g.pos === "number" ? g.pos : 0.5));
      const along = (span: number) => Math.round(pos * Math.max(0, span));
      let tx: number, ty: number;
      if (!at) { tx = room.x0 + Math.round(g.x!); ty = fy0 + Math.round(g.y!); }
      else {
        const west = at === "west" || at === "nw" || at === "sw", east = at === "east" || at === "ne" || at === "se";
        const north = at === "north" || at === "nw" || at === "ne", south = at === "south" || at === "sw" || at === "se";
        tx = west ? room.x0 : east ? room.x1 - gw + 1 : room.x0 + along(fw - gw);
        ty = north ? fy0 : south ? room.y1 - gh + 1 : at === "west" || at === "east" ? fy0 + along(fh - gh) : fy0 + Math.round((fh - gh) / 2);
      }
      const onLine = (x: number, y: number) => {
        if (!at) return 0;
        if (at === "north" || at === "nw" || at === "ne") return y === fy0 ? 0 : 4;
        if (at === "south" || at === "sw" || at === "se") return y === room.y1 - gh + 1 ? 0 : 4;
        if (at === "west") return x === room.x0 ? 0 : 4;
        if (at === "east") return x === room.x1 - gw + 1 ? 0 : 4;
        return 0;
      };
      const spots: [number, number, number][] = [];
      for (let y = fy0; y <= room.y1 - gh + 1; y++) for (let x = room.x0; x <= room.x1 - gw + 1; x++) {
        const d = Math.abs(x - tx) + Math.abs(y - ty) + onLine(x, y);
        if (d <= 8) spots.push([x, y, d]);
      }
      spots.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
      let why = "";
      const tryAt = (px: number, py: number): InteriorTemplateItem[] | undefined => {
        const items: InteriorTemplateItem[] = local.map((li) => ({ ...li.it, x: px + li.it.x, y: li.hang ? fy0 + li.it.y : py + li.it.y }));
        const sCells: string[] = [], fCells: string[] = [], cols: string[] = [];
        for (const it of items) {
          const b = box(it, S);
          const hang = it.t === "o" && S.objects[it.id]?.kind === "hang";
          if (hang) { if (b[0] < room.x0 || b[2] - 1 > room.x1 || nrs.some((nr) => b[0] <= nr.x1 && b[2] - 1 >= nr.x0 && nr.y0 === room.y0)) { why = "걸이가 벽 밖"; return undefined; } }
          else if (it.t !== "g") for (let y = b[1]; y < b[3]; y++) for (let x = b[0]; x < b[2]; x++) {
            if (x < room.x0 || x > room.x1 || y < fy0 || y > room.y1 || inNotch(x, y)) { why = "방 밖·도려 낸 귀퉁이"; return undefined; }
          }
          if (it.t === "o" && S.objects[it.id]?.kind === "wall" && b[1] !== fy0) { why = "벽 가구가 북벽에서 떨어짐"; return undefined; }
          if (blocks(it, S)) sCells.push(...cellsOfBox(b));
          else if (!hang && it.t !== "g") fCells.push(...cellsOfBox(b));
          // 벽면 열은 북벽에 붙은 키 큰 가구·걸이만 쓴다(방 가운데·남쪽의 망원경이 북벽 책장 열과 다툰다며 빠졌다 — 2026-10-29 Argon 첫 시험).
          if (hang || b[1] === fy0) cols.push(...wallColumns(it, S));
        }
        if (sCells.some((c) => keep.has(c))) { why = "문 앞 통로"; return undefined; }
        if (sCells.some((c) => solid.has(c) || flat.has(c)) || fCells.some((c) => solid.has(c))) { why = "다른 묶음과 겹침"; return undefined; }
        if (cols.some((c) => wcols.has(c))) { why = "벽면 열을 다른 벽 가구가 씀"; return undefined; }
        // 깔개: 묶음 바닥 상자 전체(가구 밑까지).
        const rug = rugId(g.rug, S);
        const rugCells: [number, number][] = [];
        if (rug) for (let y = py; y < py + gh; y++) for (let x = px; x < px + gw; x++) if (!keep.has(`${x},${y}`) && !flat.has(`${x},${y}`) && !solid.has(`${x},${y}`) && !inNotch(x, y) && x >= room.x0 && x <= room.x1 && y >= fy0 && y <= room.y1) rugCells.push([x, y]);
        const withRug = rug && rugCells.length ? [{ t: "l" as const, id: rug, x: px, y: py, cells: rugCells }, ...items] : items;
        const next = withItems(input, withRug);
        const built = buildHandInteriorLayers(next, tileset, S);
        const e = built.issues.filter((i) => i.severity === "error").length;
        if (e > errors) { why = `조립 오류(${built.issues.find((i) => i.severity === "error")?.message.slice(0, 60)})`; return undefined; }
        if (built.unreachedFloor.length > unreached) { why = "닿지 못하는 바닥이 생김"; return undefined; }
        input = next; errors = e; unreached = built.unreachedFloor.length;
        for (const c of sCells) solid.add(c);
        for (const c of fCells) flat.add(c);
        for (const [x, y] of rugCells) flat.add(`${x},${y}`);
        for (const c of cols) wcols.add(c);
        blocked += new Set(sCells).size;
        return withRug;
      };
      let done: [number, number] | undefined, firstWhy = "";
      for (const [x, y] of spots) {
        if (tryAt(x, y)) { done = [x, y]; break; }
        if (!firstWhy) firstWhy = why;
      }
      if (!done) {
        fixes.push(`${label}: 바닥 (${tx - room.x0},${ty - fy0}) 근처에 놓을 자리가 없어 뺐다(${firstWhy || why || "자리 없음"})`);
        continue;
      }
      itemCount += local.filter((li) => li.it.t === "o").length;
      const [dx, dy] = [done[0] - tx, done[1] - ty];
      if (dx || dy) fixes.push(`${label}: 바닥 (${tx - room.x0},${ty - fy0}) → (${done[0] - room.x0},${done[1] - fy0}) 로 ${Math.abs(dx) + Math.abs(dy)}칸 옮겼다(${firstWhy})`);
      placed.push(`${g.name ?? label} @${done[0] - room.x0},${done[1] - fy0}`);
    }
    // 묶음을 넘는 의자 방향: 다른 묶음의 책상·탁자와 맞닿은 의자도 그쪽을 보게(2026-10-29 flash: 「의자」를 따로 묶어 책상 북쪽에 두어 책장을 보고 앉았다).
    {
      const inRoom = (x: number, y: number) => x >= room.x0 && x <= room.x1 && y >= fy0 && y <= room.y1;
      const surfaces: [number, number, number, number][] = [
        ...(input.objects ?? []).filter((o) => SURFACE_RE.test(o.id) && S.objects[o.id] && inRoom(o.x, o.y)).map((o) => box({ t: "o", id: o.id, x: o.x, y: o.y }, S)),
        ...(input.tables ?? []).filter((t) => inRoom(t.x, t.y)).map((t) => [t.x, t.y, t.x + t.w, t.y + t.h] as [number, number, number, number]),
      ];
      const hit = (x: number, y: number) => surfaces.some((b) => x >= b[0] && x < b[2] && y >= b[1] && y < b[3]);
      const objects = (input.objects ?? []).map((o) => {
        const m = FACE_RE.exec(o.id);
        if (!m || !/chair|stool|armchair|sofa|bench/iu.test(m[1]!) || !inRoom(o.x, o.y)) return o;
        const facing: Record<string, [number, number]> = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };
        if (hit(o.x + facing[m[2]!]![0], o.y + facing[m[2]!]![1])) return o;
        const want = (["N", "S", "W", "E"] as const).find((d) => hit(o.x + facing[d]![0], o.y + facing[d]![1]));
        const next = want ? `${m[1]} ${want}` : undefined;
        if (!next || !S.objects[next]) return o;
        fixes.push(`${o.id}(${o.x - room.x0},${o.y - fy0}) 를 맞닿은 책상·탁자 쪽을 보게 ${next} 로 돌렸다`);
        return { ...o, id: next };
      });
      input = { ...input, objects };
    }
    perRoom[room.id] = { placed, fixes, blockedShare: floor ? Math.round(100 * blocked / floor) / 100 : 0, floor, items: itemCount };
  }
  return { input, perRoom };
}
