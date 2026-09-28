// MV 팩 프리셋 맵(REFMAP 세트 등)의 구조·통행·빈 공간 검사.
//
// 세트 맵을 사람이 검수하며 모은 규칙이다(openwiki/refmap-town-outside.md 3~7차): 천장 밑에는 벽면, 벽면은 2줄 이상,
// 입구에서 모든 바닥·가구에 닿는다, 침대는 긴 옆면으로 닿는다, 벽 가구는 벽에, 벽걸이는 벽면에, 큰 물체끼리 겹치지 않는다,
// 물은 네모가 아니다, 그리고 「공간이 남으면 공간이 너무 큰 것이다」(빈 바닥 직사각형 상한).
// 게시 스크립트(scripts/content/refmap/lib.mts)는 맵 기술에서, 편집기·조수(check_pack_map, Pi 끝 배치 점검)는 실제 맵 칸에서
// 같은 입력(PackLintInput)을 만들어 이 함수를 부른다 — 규칙은 여기 한 곳에만 있다.

import { passabilityOf } from "../collision";
import type { GameMap, PassFlag, Project, TilesetDef } from "../types";
import type { MvObjectKind } from "./packPreset";
import { MV_PACK_PRESETS } from "./packs";

/** 칸 하나의 재료. key 가 같으면 같은 재료다(오토타일 모양은 무시). */
export interface PackLintMaterial {
  readonly key: string;
  readonly name: string;
  /** 프리셋 재료 역할(water·roof·wall·fence·plant·road·ground…). 모르면 없음. */
  readonly role?: string;
  /** 시트 부분 A1~A5. 평타일은 A5. */
  readonly part: string;
  /** 오토타일 종류 번호(A3·A4 는 짝수 줄 = 윗면, 홀수 줄 = 벽면). */
  readonly kind?: number;
  readonly flat: boolean;
}

export interface PackLintObject {
  readonly id: string;
  readonly kind: MvObjectKind;
  readonly h: number;
  readonly solid?: readonly (readonly [number, number])[];
}

export interface PackLintPlaced {
  readonly o: PackLintObject;
  readonly x: number;
  readonly y: number;
  readonly cells: readonly (readonly [number, number])[];
}

export interface PackLintInput {
  readonly w: number;
  readonly h: number;
  /** 1층·2층 재료(칸마다). */
  readonly m1: readonly (PackLintMaterial | null)[];
  readonly m2: readonly (PackLintMaterial | null)[];
  readonly placed: readonly PackLintPlaced[];
  /** 엔진 통행(네 층, collision.ts passabilityOf). */
  readonly pass: readonly PassFlag[];
  /** 1층만의 통행 — 막힌 땅 위를 걷게 만든 칸(누수)을 찾는다. */
  readonly basePass: readonly PassFlag[];
  /** 3·4층에 무엇이든 있는 칸. */
  readonly occupied: readonly boolean[];
  /** 입구. 없으면 starts, 그것도 없으면 맵 가장자리의 걸을 수 있는 칸 전부. */
  readonly entry?: readonly [number, number];
  /** 입구 후보 칸 번호(y*w+x) 여럿. */
  readonly starts?: readonly number[];
}

const PASSWAY = /stair|step|bridge|ladder|entrance|gate|passage|plank|hatch|doorway|arch_door|cave/;
/** 빈 바닥으로 세는 바닥 결 무늬. */
export const FLOOR_NOISE = /shadow|fade|void|black_fill|pebble|crack|moss_tuft|leaf_tuft|stain|puddle/;
const NATURE = /tree|conifer|palm|rock|stalag|boulder|spire|bush|stump|mound|pine|broadleaf|fern|grass|flower|mushroom|log|drift|pile/;
// 탁자·카운터 위에 올리는 한 칸 소품. 밑 탁자가 한 칸이면 그림에 완전히 가려 되찾을 수 없으므로 닿기 검사에서 뺀다.
const TABLETOP = /teapot|wine_set|teacup|candelabra|flower_vase|open_book|book_pile|table_lamp|plates|fruit_bowl|cutting_board|egg_pan|stock_pots|pan_kettle|bread_basket|potion|jars|crystal_ball|root_herbs|green_books|crystals_bones|desk_top/;
const WALL_FURNITURE = /shelf|bookshelf|cupboard|dresser|cabinet|clock|fireplace|stove|wardrobe|armor|banner|curtain|_bed|^bed/;
const openOf = (p: PassFlag) => p.up || p.down || p.left || p.right;
const at = (x: number, y: number) => `(${x},${y})`;

/** A4 천장·A3 지붕: 윗면의 남쪽 끝 밑에는 벽면, 벽면 위는 윗면(또는 벽면), 벽면은 2줄 이상. */
export function lintPackStructure(input: Pick<PackLintInput, "w" | "h" | "m1" | "m2">): string[] {
  const { w, h } = input;
  // flat = 평타일 벽(「못 박힌 판자 벽 위/아래」 같은 A5). 천장 밑 벽면으로는 인정하지만, 다락 단 앞벽처럼 위가 바닥이어도 되므로
  // 그 자신은 검사하지 않는다. cover = 윗면 위에 덮은 수풀·바위(게시할 때 1층으로 합쳐져 밑 윗면이 안 보인다).
  type Role = "top" | "face" | "flat" | "cover" | null;
  const roleOf = (m: PackLintMaterial | null, part: "A3" | "A4"): Role => {
    if (!m || m.flat || m.part !== part || m.kind === undefined) return null;
    return Math.floor(m.kind / 8) % 2 === 0 ? "top" : "face";
  };
  const flatWall = (m: PackLintMaterial | null | undefined) => !!m && m.flat && (m.role === "wall" || /벽/.test(m.name));
  const cover = (m: PackLintMaterial | null | undefined) => !!m && !m.flat && m.role === "plant";
  const out: string[] = [];
  for (const [part, label, cells] of [["A4", "천장", input.m1], ["A3", "지붕", input.m2]] as const) {
    const role = (x: number, y: number): Role | "out" => {
      if (x < 0 || y < 0 || x >= w || y >= h) return "out";
      const i = y * w + x;
      const r = roleOf(cells[i] ?? null, part);
      if (r || part !== "A4") return r;
      // 절벽에서 떨어지는 폭포(물·용암)도 벽면 자리다.
      const fall = (m: PackLintMaterial | null | undefined) => !!m && !m.flat && m.role === "water" && /폭포/.test(m.name);
      return flatWall(input.m1[i]) || flatWall(input.m2[i]) || fall(input.m1[i]) ? "flat" : cover(input.m1[i]) || cover(input.m2[i]) ? "cover" : null;
    };
    const bad: Record<string, [number, number][]> = {};
    const add = (msg: string, x: number, y: number) => (bad[msg] ??= []).push([x, y]);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const r = role(x, y);
      if (r === "top") {
        const s = role(x, y + 1);
        if (s !== "top" && s !== "face" && s !== "flat" && s !== "out") add(`${label} 밑에 벽면 없음`, x, y);
      } else if (r === "face") {
        const n = role(x, y - 1);
        if (n !== "top" && n !== "face" && n !== "cover" && n !== "out") add(`벽면 위에 ${label} 없음`, x, y);
        if (n !== "face") { let run = 0; while (role(x, y + run) === "face" || (run > 0 && role(x, y + run) === "flat")) run += 1; if (run < 2) add(`${label} 벽면이 1줄뿐`, x, y); }
      }
    }
    for (const [msg, list] of Object.entries(bad)) out.push(`구조: ${msg} ${list.length}칸 — ${list.slice(0, 8).map(([x, y]) => at(x, y)).join(" ")}${list.length > 8 ? " …" : ""}`);
  }
  return out;
}

/** 통행·벽걸이·겹침·물 모양. */
export function lintPackPassage(input: PackLintInput): string[] {
  const { w, h, m1, m2, placed, pass } = input;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const blocks = (m: PackLintMaterial | null, base: boolean) => {
    if (!m) return base;
    if (m.flat) return /어둠|벽|기둥/.test(m.name);
    if (!m.role) return m.part === "A1" || m.part === "A3" || m.part === "A4";
    if (m.role === "water" || m.role === "roof" || m.role === "wall" || m.role === "fence") return true;
    return m.role === "plant" && /바위|덤불|수풀/.test(m.name);
  };
  const isFace = (m: PackLintMaterial | null) => {
    if (!m) return false;
    if (m.flat) return /벽/.test(m.name);
    return m.role === "wall" || ((m.part === "A4" || m.part === "A3") && m.kind !== undefined && Math.floor(m.kind / 8) % 2 === 1);
  };
  const isRoof = (m: PackLintMaterial | null) => !!m && !m.flat && (m.role === "roof" || m.part === "A3");
  const face = (x: number, y: number) => isFace(m1[y * w + x] ?? null) || isFace(m2[y * w + x] ?? null);
  const hangable = (x: number, y: number) => face(x, y) || isRoof(m1[y * w + x] ?? null) || isRoof(m2[y * w + x] ?? null);
  const wallish = (x: number, y: number) => !inside(x, y) || face(x, y) || blocks(m1[y * w + x] ?? null, true);
  const open = (i: number) => openOf(pass[i]!);
  const out: string[] = [];

  // 누수: 1층 땅은 막혔는데(물·벽·천장) 위층 물체·무늬가 길을 튼 칸. 계단·다리·문 밑줄은 뺀다.
  const legit = new Set<number>();
  for (const p of placed) if ((p.o.kind === "decal" || p.o.kind === "door") && PASSWAY.test(p.o.id)) p.cells.forEach(([dx, dy]) => {
    if (p.o.kind === "door" && dy !== p.o.h - 1) return;
    const x = p.x + dx, y = p.y + dy; if (inside(x, y)) legit.add(y * w + x);
  });
  // 물 위 2층 길·징검다리·발판은 건널목(여울)이다.
  const crossingAt = (i: number) => {
    const a = m2[i]; if (!a || a.flat) return false;
    if (/징검|다리|발판/.test(a.name)) return true;
    return a.role === "road" && m1[i]?.role === "water";
  };
  const leaks: string[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (!open(i) || legit.has(i) || crossingAt(i)) continue;
    if (!openOf(input.basePass[i]!)) leaks.push(at(i % w, Math.floor(i / w)));
  }
  // 막혀야 할 물체 칸(prop 전부·tall 밑줄·solid)이 엔진에서 뚫린 곳.
  const holes: string[] = [];
  for (const p of placed) {
    const want = p.o.solid ?? (p.o.kind === "prop" ? p.cells : p.o.kind === "tall" ? p.cells.filter(([, dy]) => dy === p.o.h - 1) : []);
    for (const [dx, dy] of want) { const x = p.x + dx, y = p.y + dy; if (inside(x, y) && open(y * w + x)) holes.push(`${p.o.id}${at(x, y)}`); }
  }
  if (holes.length) out.push(`통행: 막혀야 할 물체 칸이 뚫림 ${holes.length} — ${holes.slice(0, 8).join(" ")}`);
  // 땅에 서는 물체(키 큰 물체·두 줄 이상 가구)의 밑줄은 걷는 바닥 위여야 한다 — 벽·천장·물 위에 서면 벽을 뚫고 선 것처럼 보인다.
  const floating: string[] = [];
  for (const p of placed) {
    if ((p.o.kind !== "tall" && p.o.kind !== "prop") || p.o.h < 2 || NATURE.test(p.o.id) || p.o.id.startsWith("tile:") || /tunnel|hole|cave|mouth|exit/.test(p.o.id)) continue;
    const bottom = p.cells.filter(([, dy]) => dy === p.o.h - 1);
    if (bottom.some(([dx, dy]) => { const x = p.x + dx, y = p.y + dy; return inside(x, y) && !openOf(input.basePass[y * w + x]!) && m1[y * w + x]?.role !== "fence" && m2[y * w + x]?.role !== "fence"; })) floating.push(`${p.o.id}${at(p.x, p.y)}`);
  }
  if (floating.length) out.push(`통행: 밑줄이 벽·천장·물 위에 선 물체 ${floating.length} — ${floating.slice(0, 8).join(" ")}`);
  // 네모 물: 물 덩이가 바운딩 상자를 거의 꽉 채우면(80% 이상, 6칸 이상) 욕조처럼 보인다. 수조·수로는 일부러 네모다.
  const isWater = (i: number) => [m1[i], m2[i]].some((m) => !!m && !m.flat && m.role === "water" && !/수조|수로|분수|욕탕/.test(m.name));
  const wseen = new Array<boolean>(w * h).fill(false); const boxes: string[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (wseen[i] || !isWater(i)) continue;
    const st = [i]; wseen[i] = true; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (st.length) {
      const j = st.pop()!, x = j % w, y = Math.floor(j / w); n += 1;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) { const k = ny * w + nx; if (inside(nx, ny) && !wseen[k] && isWater(k)) { wseen[k] = true; st.push(k); } }
    }
    const touchesEdge = x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1;
    if (n >= 6 && !touchesEdge && n / ((x1 - x0 + 1) * (y1 - y0 + 1)) >= 0.8) boxes.push(`${x1 - x0 + 1}×${y1 - y0 + 1}@${at(x0, y0)}`);
  }
  if (boxes.length) out.push(`모양: 네모난 물 덩이 ${boxes.length} — ${boxes.join(" ")}`);
  if (leaks.length) out.push(`통행: 막힌 땅(물·벽·천장) 위를 걷게 만든 칸 ${leaks.length} — ${leaks.slice(0, 10).join(" ")}${leaks.length > 10 ? " …" : ""}`);

  const hung: string[] = [], loose: string[] = [];
  const onTop = new Array<number>(w * h).fill(0);
  for (const p of placed) {
    const { o } = p;
    if (o.kind === "prop") (o.solid ?? p.cells).forEach(([dx, dy]) => { const x = p.x + dx, y = p.y + dy; if (inside(x, y)) onTop[y * w + x] += 1; });
    if (o.kind === "wallmount" && p.cells.some(([dx, dy]) => { const x = p.x + dx, y = p.y + dy; return inside(x, y) && !hangable(x, y); })) hung.push(`${o.id}${at(p.x, p.y)}`);
    if ((o.kind === "tall" || o.kind === "prop") && WALL_FURNITURE.test(o.id)) {
      const top = Math.min(...p.cells.map(([, dy]) => dy));
      // 가로 침대(_h)는 머리판이 서쪽 끝이다 — 윗변 대신 머리 쪽 옆 칸이 벽이면 붙은 것으로 본다.
      const headWest = /bed.*_h$/.test(o.id) && p.cells.filter(([dx]) => dx === 0).every(([, dy]) => wallish(p.x - 1, p.y + dy));
      const against = headWest || p.cells.filter(([, dy]) => dy === top).every(([dx]) => wallish(p.x + dx, p.y + top - 1) || face(p.x + dx, p.y + top));
      if (!against) loose.push(`${o.id}${at(p.x, p.y)}`);
    }
  }
  // 큰 물체끼리 겹침(탁자 위 소품·1칸 물체는 뺀다).
  const owner = new Map<number, string>(); const overlaps: string[] = [];
  for (const p of placed) {
    if ((p.o.kind !== "prop" && p.o.kind !== "tall") || p.cells.length < 2 || p.o.id.startsWith("tile:") || /quilt|blanket/.test(p.o.id)) continue;
    const blocking = p.o.solid ?? (p.o.kind === "tall" ? p.cells.filter(([, dy]) => dy === p.o.h - 1) : p.cells);
    for (const [dx, dy] of blocking) {
      const x = p.x + dx, y = p.y + dy; if (!inside(x, y)) continue;
      const i = y * w + x; if (m1[i]?.role === "fence" || m2[i]?.role === "fence") continue;
      const prev = owner.get(i); const me = `${p.o.id}${at(p.x, p.y)}`;
      if (prev && prev !== me) { overlaps.push(`${prev}×${me}`); break; }
      owner.set(i, me);
    }
  }
  if (overlaps.length) out.push(`겹침: 큰 물체끼리 겹침 ${overlaps.length} — ${overlaps.slice(0, 6).join(" ")}`);
  if (hung.length) out.push(`벽걸이: 벽면 밖에 건 물체 ${hung.length} — ${hung.slice(0, 8).join(" ")}`);
  if (loose.length) out.push(`벽걸이: 벽에 안 붙은 벽 가구 ${loose.length} — ${loose.slice(0, 8).join(" ")}`);

  // 입구에서 엔진 규칙(방향 통행)으로 닿는 칸.
  const seen = new Array<boolean>(w * h).fill(false);
  const queue: number[] = [];
  const start = (x: number, y: number) => { const i = y * w + x; if (inside(x, y) && open(i) && !seen[i]) { seen[i] = true; queue.push(i); } };
  if (input.entry) start(input.entry[0], input.entry[1]);
  else if (input.starts?.length) input.starts.forEach((i) => start(i % w, Math.floor(i / w)));
  else {
    for (let x = 0; x < w; x += 1) { start(x, 0); start(x, h - 1); }
    for (let y = 0; y < h; y += 1) { start(0, y); start(w - 1, y); }
  }
  while (queue.length) {
    const i = queue.pop()!, x = i % w, y = Math.floor(i / w), p = pass[i]!;
    const step = (nx: number, ny: number, go: boolean, into: "up" | "down" | "left" | "right") => {
      if (go && inside(nx, ny) && pass[ny * w + nx]![into]) start(nx, ny);
    };
    step(x + 1, y, p.right, "left"); step(x - 1, y, p.left, "right"); step(x, y + 1, p.down, "up"); step(x, y - 1, p.up, "down");
  }
  // 키 큰 물체(tall) 윗칸은 엔진상 걷지만 몸통을 뚫고 지나는 것처럼 보인다 — 그 칸을 막아도 닿는지 따로 잰다.
  const tallTop = new Set<number>();
  for (const p of placed) if (p.o.kind === "tall" && !NATURE.test(p.o.id)) p.cells.forEach(([dx, dy]) => {
    if (dy === p.o.h - 1 || (p.o.solid ?? []).some(([sx, sy]) => sx === dx && sy === dy)) return;
    const x = p.x + dx, y = p.y + dy; if (inside(x, y) && m1[y * w + x] && !face(x, y)) tallTop.add(y * w + x);
  });
  if (tallTop.size) {
    const strict = new Array<boolean>(w * h).fill(false); const q: number[] = [];
    const go = (i: number) => { if (!strict[i] && seen[i] && !tallTop.has(i)) { strict[i] = true; q.push(i); } };
    if (input.entry) go(input.entry[1] * w + input.entry[0]);
    else if (input.starts?.length) input.starts.forEach(go);
    else for (let i = 0; i < w * h; i += 1) { const x = i % w, y = Math.floor(i / w); if (x === 0 || y === 0 || x === w - 1 || y === h - 1) go(i); }
    while (q.length) { const i = q.pop()!, x = i % w, y = Math.floor(i / w); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) if (inside(nx, ny)) go(ny * w + nx); }
    const lost = [...Array(w * h).keys()].filter((i) => seen[i] && !tallTop.has(i) && !strict[i]);
    if (lost.length) out.push(`통행: 키 큰 물체 몸통(윗칸)을 지나야만 닿는 바닥 ${lost.length}칸 — ${lost.slice(0, 8).map((i) => at(i % w, Math.floor(i / w))).join(" ")}`);
  }
  // 침대는 긴 옆면 한쪽이 비어 닿아야 한다(발치로만 닿으면 안 된다).
  const beds: string[] = [];
  for (const p of placed) {
    if (!/(^|_)bed($|_)/.test(p.o.id) || p.o.kind !== "prop" || !p.cells.length) continue;
    const cols = [...new Set(p.cells.map(([dx]) => dx))], rows = p.cells.map(([, dy]) => dy);
    const y0 = Math.min(...rows), y1 = Math.max(...rows), x0 = p.x + Math.min(...cols), x1 = p.x + Math.max(...cols);
    const side = (x: number) => { for (let y = p.y + y0; y <= p.y + y1; y += 1) if (x >= 0 && x < w && seen[y * w + x]) return true; return false; };
    if (!side(x0 - 1) && !side(x1 + 1)) beds.push(`${p.o.id}${at(p.x, p.y)}`);
  }
  if (beds.length) out.push(`통행: 옆으로 못 가는 침대(발치로만 닿음) ${beds.length} — ${beds.join(" ")}`);
  // 입구에서 닿지 않는 바닥 덩이.
  const done = new Array<boolean>(w * h).fill(false);
  const pockets: string[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (!open(i) || seen[i] || done[i]) continue;
    const stack = [i]; done[i] = true; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (stack.length) {
      const j = stack.pop()!, x = j % w, y = Math.floor(j / w); n += 1;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const k = ny * w + nx;
        if (inside(nx, ny) && open(k) && !seen[k] && !done[k]) { done[k] = true; stack.push(k); }
      }
    }
    pockets.push(`${n}칸 ${at(x0, y0)}~${at(x1, y1)}`);
  }
  if (pockets.length) out.push(`통행: 입구에서 못 가는 바닥 ${pockets.length}덩이 — ${pockets.slice(0, 6).join(" · ")}`);
  // 쓰는 가구(침대·의자·탁자·상자 등)에 닿을 칸.
  const unreachable: string[] = [];
  for (const p of placed) {
    if (p.o.kind !== "prop" && p.o.kind !== "tall") continue;
    if (NATURE.test(p.o.id) || (p.cells.length === 1 && TABLETOP.test(p.o.id))) continue;
    // 탁자·카운터·다른 가구 위에 올린 소품은 그 가구로 닿는다.
    if (p.cells.every(([dx, dy]) => { const x = p.x + dx, y = p.y + dy; if (!inside(x, y)) return true; return onTop[y * w + x]! >= 2 || m1[y * w + x]?.role === "fence" || m2[y * w + x]?.role === "fence"; })) continue;
    const touch = p.cells.some(([dx, dy]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ax, ay]) => {
      const x = p.x + dx + ax!, y = p.y + dy + ay!; return inside(x, y) && seen[y * w + x];
    }));
    if (!touch) unreachable.push(`${p.o.id}${at(p.x, p.y)}`);
  }
  if (unreachable.length) out.push(`통행: 닿을 수 없는 물체 ${unreachable.length} — ${unreachable.slice(0, 8).join(" ")}`);
  return out;
}

export interface PackEmptyRect { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/**
 * 「공간이 남으면 공간이 너무 큰 것이다.」 걸을 수 있는 바닥(A2·A5)인데 물체도 가구(2층 탁자·카운터)도 없는 칸에서
 * 가장 큰 빈 직사각형을 차례로 찾는다. 러그·얼룩 같은 2층 바닥 무늬는 빈 칸으로 센다. minSide 로 폭 1~2 복도를 뺄 수 있다.
 */
export function packEmptyRects(input: Pick<PackLintInput, "w" | "h" | "m1" | "m2" | "occupied"> & { readonly pass?: readonly PassFlag[] }, minArea = 12, limit = 5, minSide = 1): PackEmptyRect[] {
  const { w, h } = input;
  // 바닥 = A2 오토타일 바닥과 A5 평바닥. 걸을 수 있는 A4 윗면(계단참·대지)은 세지 않는다 — 게시 맵 41장 대조로 정했다.
  const isFloor = (m: PackLintMaterial | null, i: number) => (!input.pass || openOf(input.pass[i]!)) && !!m && (m.flat ? !/어둠|벽|기둥/.test(m.name) : m.part === "A2");
  const isDecor = (m: PackLintMaterial | null) => !m || (!m.flat && m.part === "A2" && !/탁자|카운터|울타리|생울타리|덤불|키 큰 풀/.test(m.name));
  const free = Array.from({ length: w * h }, (_, i) => isFloor(input.m1[i] ?? null, i) && isDecor(input.m2[i] ?? null) && !input.occupied[i]);
  const out: PackEmptyRect[] = [];
  while (out.length < limit) {
    let best = { x: 0, y: 0, w: 0, h: 0 };
    const hist = new Array<number>(w).fill(0);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) hist[x] = free[y * w + x] ? hist[x]! + 1 : 0;
      for (let x = 0; x < w; x += 1) {
        let mh = Infinity;
        for (let x2 = x; x2 < w && hist[x2]! > 0; x2 += 1) {
          mh = Math.min(mh, hist[x2]!);
          // 높이를 줄여 가며 폭·높이가 모두 minSide 이상인 가장 큰 사각형.
          const rw = x2 - x + 1;
          if (rw < minSide || mh < minSide) continue;
          if (rw * mh > best.w * best.h) best = { x, y: y - mh + 1, w: rw, h: mh };
        }
      }
    }
    if (best.w * best.h < minArea) break;
    out.push(best);
    for (let y = best.y; y < best.y + best.h; y += 1) for (let x = best.x; x < best.x + best.w; x += 1) free[y * w + x] = false;
  }
  return out;
}

/**
 * 빈 바닥 한도: 두 변이 모두 3 이상인 빈 직사각형 넓이. 게시한 세트 맵 41장에서 쟀다(2026-09-28) —
 * 집 실내는 4×3 구석까지(12), 동굴·던전은 20, 야외는 48(석호 모래밭 12×5 = 60 은 QA 가 「모래와 물뿐」이라 지적했다).
 */
export const PACK_EMPTY_LIMIT = { interior: 12, cave: 20, outdoor: 48 } as const;
export type PackSpaceKind = keyof typeof PACK_EMPTY_LIMIT;
/** 프리셋으로 맵 종류를 가른다. 설원·화산은 A4 를 절벽에 써서 천장 유무로는 실내를 못 가린다. */
export function packSpaceKind(presetId: string | undefined, hasCeiling: boolean): PackSpaceKind {
  if (presetId === "refmap-interior") return "interior";
  if (hasCeiling && /dungeon|volcano|cave/.test(presetId ?? "")) return "cave";
  return "outdoor";
}

// ── 편집기 맵 → 검사 입력 ──

const PART_KIND = /^mvpack-.+-(A[1-5])-.+-(\d+)$/;

interface TilesetIndex {
  readonly material: Map<number, PackLintMaterial>;
  /** 물체 칸 타일 → (물체, dx, dy) 후보. */
  readonly objectTile: Map<number, { kit: KitShape; dx: number; dy: number }[]>;
}
interface KitShape { readonly o: PackLintObject; readonly w: number; readonly h: number; readonly tiles: readonly number[] }

const indexCache = new WeakMap<TilesetDef, TilesetIndex>();

function tilesetIndex(tileset: TilesetDef): TilesetIndex {
  const cached = indexCache.get(tileset);
  if (cached) return cached;
  const material = new Map<number, PackLintMaterial>();
  const meta = tileset.tileMeta ?? [];
  for (const group of tileset.autotileGroups ?? []) {
    const m = PART_KIND.exec(group.id);
    if (!m) continue;
    const role = meta[group.memberTileIds[0] ?? -1]?.tags?.[0];
    const entry: PackLintMaterial = { key: group.id, name: group.name, ...(role ? { role } : {}), part: m[1]!, kind: Number(m[2]), flat: false };
    for (const tile of group.memberTileIds) material.set(tile, entry);
  }
  const preset = MV_PACK_PRESETS.find((p) => p.id === tileset.mvPack?.presetId);
  const objects = new Map((preset?.objects ?? []).map((o) => [o.id, o]));
  const objectTile = new Map<number, { kit: KitShape; dx: number; dy: number }[]>();
  const objectTiles = new Set<number>();
  for (const kit of tileset.structureKits ?? []) {
    const o = objects.get(kit.id);
    if (!o) continue;
    const tiles = kit.rows.flatMap((row) => row.upperTiles ?? row.tiles.map(() => -1));
    const shape: KitShape = { o: { id: o.id, kind: o.kind, h: o.h, ...(o.solid ? { solid: o.solid } : {}) }, w: kit.width, h: kit.height, tiles };
    tiles.forEach((tile, k) => {
      if (tile < 0) return;
      objectTiles.add(tile);
      const list = objectTile.get(tile) ?? [];
      list.push({ kit: shape, dx: k % kit.width, dy: Math.floor(k / kit.width) });
      objectTile.set(tile, list);
    });
  }
  meta.forEach((entry, tile) => {
    if (material.has(tile) || objectTiles.has(tile) || !entry?.label) return;
    const role = entry.tags?.[0];
    material.set(tile, { key: `#${tile}`, name: entry.label, ...(role ? { role } : {}), part: "A5", flat: true });
  });
  const index = { material, objectTile };
  indexCache.set(tileset, index);
  return index;
}

/** 이 타일셋이 팩 프리셋(재료·물체 이름이 있는 MV 팩)으로 구운 것인가. */
export function isPackPresetTileset(tileset: TilesetDef | undefined): boolean {
  return !!tileset?.mvPack && MV_PACK_PRESETS.some((p) => p.id === tileset.mvPack!.presetId && p.objects.length > 0);
}

/** 3·4층 칸에서 프리셋 물체를 되찾는다 — 물체의 모든 칸이 제자리에 있을 때만 놓인 것으로 본다. */
function recoverObjects(map: GameMap, index: TilesetIndex, occluded?: ReadonlySet<number>): PackLintPlaced[] {
  const { width: w, height: h } = map;
  const layer = (i: number) => [map.upperTiles[i] ?? -1, map.upperOverlayTiles?.[i] ?? -1];
  const has = (x: number, y: number, tile: number) => x >= 0 && y >= 0 && x < w && y < h && layer(y * w + x).includes(tile);
  const found = new Map<string, PackLintPlaced>();
  for (let i = 0; i < w * h; i += 1) {
    const x = i % w, y = Math.floor(i / w);
    for (const tile of layer(i)) {
      if (tile < 0) continue;
      let best: PackLintPlaced | null = null;
      for (const { kit, dx, dy } of index.objectTile.get(tile) ?? []) {
        const ax = x - dx, ay = y - dy;
        // 위에 다른 물체를 올려 칸이 가려진 경우(탁자 위 찻잔)는 그 칸이 무엇이든 차 있으면 놓인 것으로 본다.
        const cells: [number, number][] = [];
        let ok = true, matched = 0;
        kit.tiles.forEach((t, k) => {
          if (!ok || t < 0) return;
          const cx = k % kit.w, cy = Math.floor(k / kit.w), px = ax + cx, py = ay + cy;
          if (has(px, py, t)) { cells.push([cx, cy]); matched += 1; }
          else if (occluded?.has(py * w + px)) cells.push([cx, cy]);
          else ok = false;
        });
        if (ok && matched * 2 >= cells.length && (!best || cells.length > best.cells.length)) best = { o: kit.o, x: ax, y: ay, cells };
      }
      if (best) found.set(`${best.o.id}@${best.x},${best.y}`, best);
    }
  }
  // 큰 물체 안에 통째로 들어 있는 작은 후보(같은 그림 칸을 나눠 쓰는 조각)는 뺀다.
  const all = [...found.values()];
  const covered = (p: PackLintPlaced, q: PackLintPlaced) => q !== p && q.cells.length > p.cells.length
    && p.cells.every(([dx, dy]) => q.cells.some(([qx, qy]) => q.x + qx === p.x + dx && q.y + qy === p.y + dy));
  return all.filter((p) => !all.some((q) => covered(p, q)));
}

/**
 * 두 번 찾는다: 먼저 모든 칸이 제자리인 물체, 다음으로 칸 일부가 그 물체들 그림에 가려진 큰 가구(탁자 위 찻잔·촛대).
 * 가림을 아무 그림으로나 허용하면 겹쳐 선 나무·수풀 조각이 엉뚱한 자리의 물체로 잡힌다(2026-09-28 게시 맵 41장 대조).
 */
function recoverAll(map: GameMap, index: TilesetIndex): PackLintPlaced[] {
  const strict = recoverObjects(map, index);
  const w = map.width;
  const occluded = new Set<number>();
  // 가리는 쪽은 한 칸짜리 탁상 소품뿐이다 — 창살문이 창살을 대신하는 것처럼 큰 물체끼리 바꿔 낀 자리는 가림이 아니다.
  for (const p of strict) if (p.cells.length === 1) for (const [dx, dy] of p.cells) occluded.add((p.y + dy) * w + p.x + dx);
  const keyOf = (p: PackLintPlaced) => `${p.o.id}@${p.x},${p.y}`;
  const seen = new Set(strict.map(keyOf));
  const extra = recoverObjects(map, index, occluded).filter((p) => !seen.has(keyOf(p)) && p.o.kind === "prop" && !NATURE.test(p.o.id)
    && !strict.some((q) => p.cells.every(([dx, dy]) => q.cells.some(([qx, qy]) => q.x + qx === p.x + dx && q.y + qy === p.y + dy))));
  return [...strict, ...extra];
}

/** 편집기 맵에서 검사 입력을 만든다. 팩 프리셋 타일셋이 아니면 null. */
export function packLintInputFromMap(project: Project, map: GameMap): PackLintInput | null {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || !isPackPresetTileset(tileset)) return null;
  const index = tilesetIndex(tileset);
  const { width: w, height: h } = map;
  const n = w * h;
  const m1: (PackLintMaterial | null)[] = [], m2: (PackLintMaterial | null)[] = [];
  const pass: PassFlag[] = [], basePass: PassFlag[] = [], occupied: boolean[] = [];
  for (let i = 0; i < n; i += 1) {
    const l1 = map.lowerTiles[i] ?? -1, l2 = map.lowerOverlayTiles?.[i] ?? -1, l3 = map.upperTiles[i] ?? -1, l4 = map.upperOverlayTiles?.[i] ?? -1;
    m1.push(index.material.get(l1) ?? null);
    m2.push(index.material.get(l2) ?? null);
    pass.push(passabilityOf(tileset, l1, l2, l3, l4));
    basePass.push(passabilityOf(tileset, l1, -1, -1, -1));
    // 그림자·얼룩·잔돌 같은 바닥 결(FLOOR_NOISE decal)만 있는 칸은 빈 바닥이다. 계단·깔개·융단은 자리를 차지한다.
    const decalOnly = (t: number) => t < 0 || (index.objectTile.get(t) ?? []).some((c) => c.kit.o.kind === "decal" && FLOOR_NOISE.test(c.kit.o.id));
    occupied.push((l3 >= 0 || l4 >= 0) && !(decalOnly(l3) && decalOnly(l4)));
  }
  // 입구: 맵 가장자리의 열린 칸(실내는 남쪽 출구를 맵 끝까지 잇는다). 가장자리가 모두 막혔으면 이 맵의 시작 위치.
  const border: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = i % w, y = Math.floor(i / w);
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && openOf(pass[i]!)) border.push(i);
  }
  const startHere = project.startMapId === map.id && project.startPos ? [project.startPos.y * w + project.startPos.x] : [];
  return { w, h, m1, m2, placed: recoverAll(map, index), pass, basePass, occupied, starts: border.length ? border : startHere };
}

/**
 * 오토타일 모양이 이웃과 맞는가. 도구로 칠하면 늘 맞지만, 완성 장소 그림(모양이 굳은 래스터 킷)을 다른 칸 위에 찍거나
 * 한 칸만 손으로 바꾸면 테두리가 어긋나 벽 조각·천장 줄이 떠 보인다(2026-09-28 시험: 대장간 킷을 찍고 남은 옛 벽 테 두 줄).
 * A1(물·폭포)은 폭포와 물이 서로 이어지는 규칙이 따로라 뺀다.
 */
export function lintAutotileShapes(project: Project, map: GameMap): string[] {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return [];
  const groupOf = new Map<number, NonNullable<TilesetDef["autotileGroups"]>[number]>();
  for (const group of tileset.autotileGroups ?? []) {
    const m = PART_KIND.exec(group.id);
    if (!m || m[1] === "A1") continue;
    for (const tile of group.memberTileIds) groupOf.set(tile, group);
  }
  const { width: w, height: h } = map;
  const bad: string[] = [];
  for (const layer of [map.lowerTiles, map.lowerOverlayTiles ?? []]) {
    for (let i = 0; i < w * h; i += 1) {
      const tile = layer[i] ?? -1;
      const group = groupOf.get(tile);
      if (!group) continue;
      const x = i % w, y = Math.floor(i / w);
      const members = new Set(group.memberTileIds);
      const same = (dx: number, dy: number) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return group.outsideConnects === true || group.edgeConnects === true;
        return members.has(layer[ny * w + nx] ?? -1);
      };
      let mask = 0;
      if (same(0, -1)) mask |= 1; if (same(1, 0)) mask |= 2; if (same(0, 1)) mask |= 4; if (same(-1, 0)) mask |= 8;
      if ((group.neighborhood ?? 4) === 8) { if (same(1, -1)) mask |= 16; if (same(1, 1)) mask |= 32; if (same(-1, 1)) mask |= 64; if (same(-1, -1)) mask |= 128; }
      const want = group.variantMap[String(mask)];
      if (want !== undefined && want !== tile) bad.push(at(x, y));
    }
  }
  return bad.length ? [`모양: 이웃과 안 맞는 오토타일 ${bad.length}칸 — ${bad.slice(0, 10).join(" ")}${bad.length > 10 ? " …" : ""}. 완성 장소 그림을 다른 칸 위에 찍었거나 한 칸만 바꾼 자리다 — 그 칸들을 fill_region 으로 다시 칠하면 모양이 맞춰진다`] : [];
}

export interface PackMapLintResult {
  readonly interior: boolean;
  readonly kind: PackSpaceKind;
  readonly warnings: readonly string[];
  /** 짧은 변 3 이상인 빈 바닥 직사각형(큰 순). */
  readonly empty: readonly PackEmptyRect[];
  readonly emptyLimit: number;
  readonly objects: number;
}

/** 팩 프리셋 맵 한 장을 검사한다. 경고가 없고 빈 직사각형이 한도 안이면 합격. */
/** 늘 여럿 두는 가구(의자·창·촛대·문·침대·탁자·선반·기둥 등)는 반복을 세지 않는다. */
const REPEAT_OK = /chair|stool|bench|window|sconce|candle|torch|door|bed|table|desk|bars|column|pillar|banner|curtain|plant|shelf|armor|portrait|painting|grave|headstone|cross|fence|chimney/;

/**
 * 같은 소품을 방에 여러 번 흩는 것 — 목적 없는 채우기의 가장 흔한 꼴(2026-09-28 조수 시험: 재봉사 집 14×12 에 옷감 두루마리 7개).
 * 게시 실내·던전 38곳은 이 기준에 하나도 걸리지 않는다: 소품 하나가 4번 이상이면서 맵 30칸마다 1개를 넘을 때만.
 */
export function lintPackRepeats(input: PackLintInput, kind: PackSpaceKind): string[] {
  if (kind === "outdoor") return [];
  const counts = new Map<string, number>();
  for (const p of input.placed) {
    const id = p.o.id;
    if (id.startsWith("tile:") || NATURE.test(id) || TABLETOP.test(id) || REPEAT_OK.test(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const over = [...counts].filter(([, n]) => n >= 4 && n * 30 >= input.w * input.h);
  return over.length
    ? [`반복: ${over.map(([id, n]) => `「${id}」 ${n}개`).join(", ")} — 같은 소품을 여러 번 흩지 않는다. 구역마다 기준 물체 하나 + 서로 다른 곁들이 2~4개로 줄인다`]
    : [];
}

/**
 * 방이 통째로 네모 하나(ㅁ자)인 실내. 바닥 덩이가 자기 테두리 상자를 0.8 이상 채우면 경고한다.
 * 게시 실내 20곳은 0.43~0.74, 조수가 칸막이 없이 깐 집은 0.89~0.92였다(2026-09-28). 작은 방(40칸 미만)은 네모여도 된다.
 */
export function lintBoxRooms(input: Pick<PackLintInput, "w" | "h" | "m1">): string[] {
  const { w, h } = input;
  const floor = (i: number) => { const m = input.m1[i]; return !!m && (m.flat ? !/어둠|벽|기둥/.test(m.name) : m.part === "A2"); };
  const seen = new Uint8Array(w * h);
  const out: string[] = [];
  for (let i = 0; i < w * h; i += 1) {
    if (seen[i] || !floor(i)) continue;
    const stack = [i]; seen[i] = 1;
    let n = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (stack.length) {
      const c = stack.pop()!; n += 1;
      const x = c % w, y = Math.floor(c / w);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!seen[j] && floor(j)) { seen[j] = 1; stack.push(j); }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (n >= 40 && n / (bw * bh) >= 0.8) out.push(`구조: 방이 네모 하나(ㅁ자) — 바닥 ${n}칸이 ${bw}×${bh}@(${x0},${y0}) 상자를 ${Math.round((100 * n) / (bw * bh))}% 채운다. 구석에 천장 덩이를 들여 ㄱ·ㄷ자로 만들거나 칸막이(천장 덩이 + 벽면 2줄)·알코브로 방을 나눈다(게시 장소는 75% 이하)`);
  }
  return out;
}

export function lintPackMap(project: Project, map: GameMap): PackMapLintResult | null {
  const input = packLintInputFromMap(project, map);
  if (!input) return null;
  const hasCeiling = input.m1.some((m) => m?.part === "A4" && m.kind !== undefined && Math.floor(m.kind / 8) % 2 === 0);
  const kind = packSpaceKind(project.tilesets[map.tilesetId]?.mvPack?.presetId, hasCeiling);
  const interior = kind === "interior";
  const emptyLimit = PACK_EMPTY_LIMIT[kind];
  const empty = packEmptyRects(input, emptyLimit + 1, 3, 3);
  const warnings = [...lintPackStructure(input), ...lintPackPassage(input), ...lintAutotileShapes(project, map)];
  if (input.m1.every((m) => !m)) warnings.unshift("재료: 1층에 이 팩 재료가 하나도 없다 — 팩 재료로 칠한 맵이 아니다");
  if (!input.starts?.length) warnings.unshift("통행: 입구가 없다 — 맵 가장자리에 열린 바닥이 없다. 실내는 남쪽 벽 천장 테를 1~2칸 비워 바닥을 맵 끝까지 잇는다");
  warnings.push(...lintPackRepeats(input, kind));
  if (interior) warnings.push(...lintBoxRooms(input));
  if (empty.length) warnings.push(`공간: 가구·물체 없는 빈 바닥 ${empty.map((r) => `${r.w}×${r.h}@(${r.x},${r.y})`).join(" ")} — ${kind === "interior" ? "집 실내" : kind === "cave" ? "동굴·던전" : "야외"} 한도 ${emptyLimit}칸. 물체로 메우지 말고 방·맵을 줄인다(또는 그 자리에 용도 있는 구역을 둔다)`);
  return { interior, kind, warnings, empty, emptyLimit, objects: input.placed.length };
}
