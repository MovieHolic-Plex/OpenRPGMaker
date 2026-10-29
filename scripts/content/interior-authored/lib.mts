// 손으로 짠 방 견본(atlas_biome_interior) — 견본이 없거나 약한 용도(교실·잡화점·연구실·감옥·작은 예배당·작은 서재·작은 침실·방탈출 작은 방)를
// 칩셋에 이미 있는 기물만으로 새로 짠다(새 그림 없음). rooms.mts 의 글자 그림 → src/assets/interiorAuthoredRoomTemplates.json.
//   글자 그림: wall = 벽면 윗줄(y 0)에 거는 것(창·칠판·선반), plan = 바닥 줄(y 2 부터). 기물 글자는 그 기물 왼쪽 위 칸에만 쓴다(나머지 칸 '.').
//   lines 글자(예 '~')는 깔개·창살 같은 줄 기물 칸. goods 는 [x, 바닥 줄 번호, 탁상 물건 id].
import type { InteriorRoomTemplate, InteriorTemplateItem } from "../../../src/editor/handInterior/templates.ts";

export interface AuthoredRoom {
  readonly id: string; readonly kind: string; readonly style: "town" | "noble" | "fantasy";
  readonly floor: string; readonly wall: string;
  readonly hang: string;
  readonly plan: readonly string[];
  readonly legend: Readonly<Record<string, string>>;
  readonly lines?: Readonly<Record<string, string>>;
  readonly goods?: readonly (readonly [number, number, string])[];
  readonly note?: string;
}

export const AUTHORED_MAP_PREFIX = "authored-";

export function toTemplate(r: AuthoredRoom): InteriorRoomTemplate {
  const w = r.plan[0]!.length, h = r.plan.length + 2;
  if (r.hang.length !== w) throw new Error(`${r.id}: hang 폭 ${r.hang.length} ≠ ${w}`);
  const items: InteriorTemplateItem[] = [];
  const lineCells = new Map<string, [number, number][]>();
  const put = (ch: string, x: number, y: number) => {
    if (ch === "." || ch === " ") return;
    const line = r.lines?.[ch];
    if (line) { (lineCells.get(line) ?? lineCells.set(line, []).get(line)!).push([x, y]); return; }
    const id = r.legend[ch];
    if (!id) throw new Error(`${r.id}: 글자 '${ch}' (${x},${y}) 의 기물이 없다`);
    items.push({ t: "o", id, x, y });
  };
  [...r.hang].forEach((ch, x) => put(ch, x, 0));
  r.plan.forEach((row, j) => { if (row.length !== w) throw new Error(`${r.id}: plan ${j} 폭 ${row.length} ≠ ${w}`); [...row].forEach((ch, x) => put(ch, x, j + 2)); });
  for (const [x, j, id] of r.goods ?? []) items.push({ t: "g", id, x, y: j + 2 });
  for (const [id, cells] of lineCells) items.push({ t: "l", id, x: 0, y: 0, cells });
  return { id: `${AUTHORED_MAP_PREFIX}${r.id}`, map: `${AUTHORED_MAP_PREFIX}${r.style}-${r.id}`, building: `authored-${r.style}`, kind: r.kind, w, h, floor: r.floor, wall: r.wall, items };
}

/**
 * 그림 겹침 검사 — 기물마다 실제로 그려지는 칸(사양 cells 의 dx·dy, 키 큰 기물은 위 칸까지)이 다른 기물의 그림 칸과 겹치면 오류.
 * 검수에서 잡힌 것: 책장 위에 건 창·지도가 가려짐, 두루마리 통이 위 칸 책상을 덮음, 지구본이 마법진에 박힘(2026-10-29 1판 적대 검수).
 */
export function lintTemplate(t: InteriorRoomTemplate, objects: Readonly<Record<string, { cells?: readonly (readonly number[])[]; w: number; h: number; kind: string }>>): string[] {
  const owner = new Map<string, string>();
  const errs: string[] = [];
  for (const it of t.items) {
    if (it.t === "g" || (it.t === "l" && it.id.startsWith("rug"))) continue;   // 탁상 물건·깔개는 아래 층
    const cells: [number, number][] = it.t === "l" ? (it.cells ?? []).map(([x, y]) => [x, y]) : (() => {
      const o = objects[it.id];
      if (!o) { errs.push(`없는 기물 ${it.id}`); return []; }
      const cs = (o.cells ?? []).map((c) => [it.x + c[0]!, it.y + c[1]!] as [number, number]);
      return cs.length ? cs : Array.from({ length: Math.max(1, o.w) * Math.max(1, o.h) }, (_, i) => [it.x + (i % Math.max(1, o.w)), it.y + Math.floor(i / Math.max(1, o.w))] as [number, number]);
    })();
    for (const k of new Set(cells.map(([x, y]) => `${x},${y}`))) {
      const [cx, cy] = k.split(",").map(Number) as [number, number];
      if (cx < 0 || cx >= t.w || cy < 0) { errs.push(`${it.id}(${it.x},${it.y}) 그림이 방 밖 (${cx},${cy})`); continue; }
      const prev = owner.get(k);
      if (prev) errs.push(`${it.id}(${it.x},${it.y}) 그림이 ${prev} 와 (${cx},${cy}) 에서 겹친다`);
      else owner.set(k, `${it.id}(${it.x},${it.y})`);
    }
  }
  return errs;
}

/**
 * 손이 닿는가 — 문 칸(남쪽 벽 x = floor((w-1)/2), 짓기가 그 위 두 줄을 비운다)에서 걸어서 모든 바닥에 닿고, 바닥에 선 기물마다
 * 걸어서 닿는 칸이 하나는 붙어 있어야 한다(2판 적대 검수: 창고 구석 통·잡화점 궤짝·3인 책상 가운데 자리에 닿을 칸이 없었다).
 */
export function lintReach(t: InteriorRoomTemplate, objects: Readonly<Record<string, { w: number; h: number; kind: string }>>): string[] {
  const errs: string[] = [];
  const door = Math.floor((t.w - 1) / 2);
  const blocked = new Map<string, string>();
  const things: { name: string; cells: string[] }[] = [];
  for (const it of t.items) {
    if (it.t === "g") continue;
    if (it.t === "l") { if (!it.id.startsWith("rug")) for (const [x, y] of it.cells ?? []) blocked.set(`${x},${y}`, it.id); continue; }
    const o = objects[it.id];
    if (!o || o.kind === "hang" || o.kind === "flat") continue;
    const cells: string[] = [];
    for (let j = 0; j < Math.max(1, o.h); j++) for (let i = 0; i < Math.max(1, o.w); i++) cells.push(`${it.x + i},${it.y + j}`);
    for (const c of cells) blocked.set(c, it.id);
    things.push({ name: `${it.id}(${it.x},${it.y})`, cells });
  }
  for (const dy of [1, 2]) { const k = `${door},${t.h - dy}`; if (blocked.has(k)) errs.push(`문 앞 칸 (${k}) 을 ${blocked.get(k)} 가 막는다 — 짓기가 빼거나 옮긴다`); }
  // 발깔개는 문 칸과 그 오른쪽 칸(2칸)에 깔린다 — 오른쪽 칸 위 가구가 깔개를 덮어 자른다(3판 검수: 교실 맨 아래 의자).
  { const k = `${door + 1},${t.h - 1}`; if (blocked.has(k)) errs.push(`발깔개 칸 (${k}) 을 ${blocked.get(k)} 가 덮는다`); }
  const seen = new Set<string>([`${door},${t.h - 1}`]);
  const q: [number, number][] = [[door, t.h - 1]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || nx >= t.w || ny < 2 || ny >= t.h || seen.has(k) || blocked.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  for (let y = 2; y < t.h; y++) for (let x = 0; x < t.w; x++) { const k = `${x},${y}`; if (!blocked.has(k) && !seen.has(k)) errs.push(`닿지 못하는 바닥 (${k})`); }
  for (const th of things) {
    const ok = th.cells.some((c) => { const [x, y] = c.split(",").map(Number) as [number, number]; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${x + dx!},${y + dy!}`)); });
    if (!ok) errs.push(`${th.name} 에 걸어서 닿는 칸이 없다`);
  }
  return errs;
}
