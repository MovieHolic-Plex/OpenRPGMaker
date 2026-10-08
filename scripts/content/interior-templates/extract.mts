// 실내 방 견본 — 제작자 예제 맵을 방 단위로 잘라 「방 크기·바닥·벽면·가구 배치(방 안 상대 좌표)」를 뽑는다.
// 조수는 집 전체를 베끼지 않고, 방 배치는 layout.ts 가 새로 짜고, 방마다 이 견본의 가구 한 벌을 옮겨 심는다(furnish.ts).
// 산출 src/assets/interiorRoomTemplates.json. 위키: openwiki/atlas-biome-interior.md 「방 구성표·배치 후보·견본 가구」.
//   bun scripts/content/interior-templates/extract.mts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { analyseHandInteriorPlan, buildHandInteriorLayers, HAND_INTERIOR_SPECS, type HandInteriorInput } from "../../../src/editor/handInterior/builder.ts";
import { createAtlasBiomeInteriorTileset } from "../../../src/project/defaults/atlasBiomeInterior.ts";
import { createJpCityTileset } from "../../../src/project/defaults/jpCity.ts";
import type { InteriorRoomTemplate, InteriorTemplateItem } from "../../../src/editor/handInterior/templates.ts";

const OUT = "src/assets/interiorRoomTemplates.json";

/** '#' 로 나뉜 방 분할 — tiledata/hand-interior/v5/notes6.py segment 와 같다(1~3칸 문 틈은 어느 방에도 넣지 않는다). */
function segment(plan: readonly string[]) {
  const H = plan.length, W = plan[0]!.length;
  const op = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && plan[y]![x] !== "#";
  const gap = new Set<string>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    if (!op(x, y)) { x++; continue; }
    const x0 = x; while (x < W && op(x, y)) x++;
    let all = true; for (let i = x0; i < x; i++) if (!(op(i, y - 1) && op(i, y + 1))) all = false;
    if (x - x0 <= 3 && x0 > 0 && x < W && all && ((op(x0 - 1, y - 1) && op(x0 - 1, y + 1)) || (op(x, y - 1) && op(x, y + 1)))) for (let i = x0; i < x; i++) gap.add(`${i},${y}`);
  }
  for (let x = 0; x < W; x++) for (let y = 0; y < H;) {
    if (!op(x, y)) { y++; continue; }
    const y0 = y; while (y < H && op(x, y)) y++;
    let all = true; for (let j = y0; j < y; j++) if (!(op(x - 1, j) && op(x + 1, j))) all = false;
    if (y - y0 <= 3 && y0 > 0 && y < H && all && ((op(x - 1, y0 - 1) && op(x + 1, y0 - 1)) || (op(x - 1, y) && op(x + 1, y)))) for (let j = y0; j < y; j++) gap.add(`${x},${j}`);
  }
  const comp = new Map<string, number>(); const seeds: string[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = `${x},${y}`;
    if (!op(x, y) || gap.has(k) || comp.has(k)) continue;
    const n = seeds.length; seeds.push(k); comp.set(k, n); const st = [[x, y]];
    while (st.length) {
      const [a, b] = st.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = `${a! + dx!},${b! + dy!}`;
        if (op(a! + dx!, b! + dy!) && !gap.has(c) && !comp.has(c)) { comp.set(c, n); st.push([a! + dx!, b! + dy!]); }
      }
    }
  }
  return { comp, seeds, gap };
}

/**
 * 예제가 방 사각형(칸막이 포함)을 들고 있으면 그것으로 방을 나눈다 — 일본 집은 4칸 넘는 트인 틈·한쪽만 열린 문 틈이 많아 segment 가 방을 합친다.
 * 사각형 변 줄이 절반 넘게 막혀 있으면 그 줄은 칸막이이고, 그 줄의 열린 칸(문 틈)은 방에 넣지 않는다. seed = 방 종류 이름.
 */
function rectComponents(plan: readonly string[], rects: readonly { room: string; x0: number; y0: number; x1: number; y1: number }[]) {
  const op = (x: number, y: number) => (plan[y]?.[x] ?? "#") !== "#";
  const comp = new Map<string, number>(); const seeds: string[] = [];
  rects.forEach((r, n) => {
    const lines: ((x: number, y: number) => boolean)[] = [];
    const blockedShare = (cells: [number, number][]) => cells.filter(([x, y]) => !op(x, y)).length / Math.max(1, cells.length);
    const col = (x: number) => Array.from({ length: r.y1 - r.y0 + 1 }, (_, i) => [x, r.y0 + i] as [number, number]);
    const row = (y: number) => Array.from({ length: r.x1 - r.x0 + 1 }, (_, i) => [r.x0 + i, y] as [number, number]);
    for (const x of [r.x0, r.x1]) if (blockedShare(col(x)) >= 0.5) lines.push((cx) => cx === x);
    for (const y of [r.y0, r.y1]) if (blockedShare(row(y)) >= 0.5) lines.push((_cx, cy) => cy === y);
    seeds.push(`${r.room}#${n}`);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      if (!op(x, y) || lines.some((f) => f(x, y)) || comp.has(`${x},${y}`)) continue;
      comp.set(`${x},${y}`, n);
    }
  });
  return { comp, seeds, gap: new Set<string>() };
}

interface FullInput extends HandInteriorInput { rooms?: { room: string; x0: number; y0: number; x1: number; y1: number }[] }

/** 예제 한 맵 → 방 견본들. labelOf(방 칸들) = 방 종류(모르면 null). */
function templatesOf(tilesetId: string, map: string, building: string, input: FullInput, labelOf: (cells: string[], seed: string) => string | null): InteriorRoomTemplate[] {
  const S = HAND_INTERIOR_SPECS[tilesetId]!;
  const { comp, seeds } = input.rooms ? rectComponents(input.plan, input.rooms) : segment(input.plan);
  const A = analyseHandInteriorPlan(input.plan);
  const cellsOf = seeds.map(() => [] as string[]);
  for (const [k, n] of comp) cellsOf[n]!.push(k);
  const roomAt = (x: number, y: number, down = [0, 1, 2, -1]) => { for (const d of down) { const n = comp.get(`${x},${y + d}`); if (n !== undefined) return n; } return undefined; };
  const items = seeds.map(() => [] as InteriorTemplateItem[]);
  const isDoor = (id: string) => { const k = S.objects[id]?.kind; return k === "door" || k === "sidedoor"; };
  for (const o of input.objects ?? []) {
    if (isDoor(o.id) || o.id === "doormat" || o.id === "genkan-door") continue;
    const n = roomAt(o.x, o.y); if (n !== undefined) items[n]!.push({ t: "o", id: o.id, x: o.x, y: o.y });
  }
  for (const t of input.tables ?? []) { const n = roomAt(t.x, t.y); if (n !== undefined) items[n]!.push({ t: "t", id: t.style, x: t.x, y: t.y, w: t.w, h: t.h }); }
  for (const g of input.goods ?? []) { const n = roomAt(g.x, g.y, [0]); if (n !== undefined) items[n]!.push({ t: "g", id: g.id, x: g.x, y: g.y }); }
  for (const d of input.daises ?? []) { const n = roomAt(d.x, d.y); if (n !== undefined) items[n]!.push({ t: "d", id: d.id, x: d.x, y: d.y, w: d.w, h: d.h }); }
  for (const l of input.lines ?? []) {
    const cells = l.cells ?? (l.rect ? Array.from({ length: (Math.abs(l.rect.x1 - l.rect.x0) + 1) * (Math.abs(l.rect.y1 - l.rect.y0) + 1) }, (_, i) => {
      const w = Math.abs(l.rect!.x1 - l.rect!.x0) + 1; return { x: Math.min(l.rect!.x0, l.rect!.x1) + (i % w), y: Math.min(l.rect!.y0, l.rect!.y1) + Math.floor(i / w) }; }) : []);
    const byRoom = new Map<number, { x: number; y: number }[]>();
    for (const c of cells) { const n = comp.get(`${c.x},${c.y}`); if (n !== undefined) (byRoom.get(n) ?? byRoom.set(n, []).get(n)!).push(c); }
    for (const [n, cs] of byRoom) items[n]!.push({ t: "l", id: l.id, x: 0, y: 0, cells: cs.map((c) => [c.x, c.y] as [number, number]) });
  }
  const zoneAt = (x: number, y: number) => { let f = input.floor, w = input.wall; for (const z of input.zones ?? []) if (z.x0 <= x && x <= z.x1 && z.y0 <= y && y <= z.y1) { f = z.floor || f; w = z.wall || w; } return { f, w }; };
  const out: InteriorRoomTemplate[] = [];
  seeds.forEach((seed, n) => {
    const cells = cellsOf[n]!;
    const kind = labelOf(cells, seed);
    if (!kind) return;
    const xs = cells.map((k) => +k.split(",")[0]!), ys = cells.map((k) => +k.split(",")[1]!);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const set = new Set(cells);
    const mask = Array.from({ length: y1 - y0 + 1 }, (_, y) => Array.from({ length: x1 - x0 + 1 }, (_, x) => (set.has(`${x0 + x},${y0 + y}`) ? "." : "#")).join(""));
    const rect = mask.every((r) => !r.includes("#"));
    // 바닥·벽면 = 방 칸 다수(벽면은 벽면 칸에서)
    const fc = new Map<string, number>(), wc = new Map<string, number>();
    for (const k of cells) {
      const [x, y] = k.split(",").map(Number) as [number, number]; const z = zoneAt(x, y);
      if (A.isFloor(x, y)) fc.set(z.f, (fc.get(z.f) ?? 0) + 1); else wc.set(z.w, (wc.get(z.w) ?? 0) + 1);
    }
    const top = (m: Map<string, number>, d: string) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? d;
    const rel = items[n]!.map((it) => it.t === "l" ? { ...it, cells: it.cells!.map(([x, y]) => [x - x0, y - y0] as [number, number]) } : { ...it, x: it.x - x0, y: it.y - y0 });
    out.push({ id: `${map}:${seed}`, map, building, kind, w: x1 - x0 + 1, h: y1 - y0 + 1, ...(rect ? {} : { mask }), floor: top(fc, input.floor), wall: top(wc, input.wall), items: rel });
  });
  return out;
}

// ── 손 도트 v5: 예제 26맵(tiledata/hand-interior/v5-maps) + 방 이름표(notes6.py LABELS: 방 첫 칸 → 종류) ──
const v5maps = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const v5buildings = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/buildings.json", "utf8")) as { id: string; maps: { id: string; items: { id: string; x: number; y: number; w: number; h: number; cells?: number[][]; line?: string; on?: { goods: string; fx: number; fy: number }[] }[]; start?: number[][] }[] }[];
const LABELS = JSON.parse(execFileSync("python3", ["-c", "import json,notes6;print(json.dumps(notes6.LABELS))"], { cwd: "tiledata/hand-interior/v5" }).toString()) as Record<string, Record<string, string>>;
const templates: Record<string, InteriorRoomTemplate[]> = { atlas_biome_interior: [], jp_city: [] };
const programs: Record<string, Record<string, { map: string; kinds: string[] }[]>> = { atlas_biome_interior: {}, jp_city: {} };
const v5tileset = createAtlasBiomeInteriorTileset();
for (const p of v5maps.plans as { key: string; plan: string[]; floor: string; wall: string; zones: [number, number, number, number, string | null, string | null][]; ceil: string }[]) {
  const b = v5buildings.find((bb) => bb.maps.some((m) => m.id === p.key))!;
  const mm = b.maps.find((m) => m.id === p.key)!;
  const A = analyseHandInteriorPlan(p.plan);
  const objects: { id: string; x: number; y: number }[] = [], lines: { id: string; cells: { x: number; y: number }[] }[] = [], goods: { id: string; x: number; y: number }[] = [];
  for (const it of mm.items) {
    if (it.cells) { lines.push({ id: it.line!, cells: it.cells.map(([a, c]) => ({ x: it.x + a!, y: it.y + c! })).filter((c) => A.isFloor(c.x, c.y)) }); continue; }
    objects.push({ id: it.id, x: it.x, y: it.y });
    for (const g of it.on ?? []) { const w = Math.max(1, it.w), h = Math.max(1, it.h); goods.push({ id: g.goods, x: it.x + Math.min(w - 1, Math.floor(g.fx * w)), y: it.y + Math.min(h - 1, Math.max(0, Math.ceil(g.fy * h) - 1)) }); }
  }
  const zones = p.zones.map(([x0, y0, x1, y1, floor, wall]) => ({ x0, y0, x1, y1, ...(floor ? { floor } : {}), ...(wall ? { wall } : {}) }));
  const input: FullInput = { plan: p.plan, floor: p.floor, wall: p.wall, zones, objects, lines, goods };
  // 도구가 앉히지 못하는 탁상 물건은 뺀다(prepare-references.mts 와 같다)
  const bad = new Set(buildHandInteriorLayers(input, v5tileset).issues.filter((i) => i.code.startsWith("goods")).map((i) => `${i.x},${i.y}`));
  input.goods = goods.filter((g) => !bad.has(`${g.x},${g.y}`));
  const labels = LABELS[p.key] ?? {};
  const got = templatesOf("atlas_biome_interior", p.key, b.id, input, (_c, seed) => labels[seed] ?? null);
  templates.atlas_biome_interior!.push(...got);
  (programs.atlas_biome_interior![b.id] ??= []).push({ map: p.key, kinds: got.map((t) => t.kind) });
}

// ── 일본 집 실내: tiledata/jp-city/interior/examples/*.json 의 rooms 사각형이 방 종류 ──
const EX = "tiledata/jp-city/interior/examples";
const places2 = JSON.parse(fs.readFileSync(`${EX}/places2.json`, "utf8")) as { file: string; building: string }[];
const jpMaps: [string, string][] = [["house-1f", "jp_house"], ["house-2f", "jp_house"], ["apartment-1k", "jp_apartment"], ...places2.map((p) => [p.file, p.building] as [string, string])];
for (const [file, building] of jpMaps) {
  const ex = JSON.parse(fs.readFileSync(`${EX}/${file}.json`, "utf8")) as FullInput;
  const rooms = ex.rooms ?? [];
  const label = (_cells: string[], seed: string) => (rooms.length ? seed.split("#")[0]! : null);
  const got = templatesOf("jp_city", file, building, ex, label);
  templates.jp_city!.push(...got);
  (programs.jp_city![building] ??= []).push({ map: file, kinds: got.map((t) => t.kind) });
}

// 견본마다 옮겨 심기 시험: 같은 크기 네모 방 하나에 심어 오류가 없어야 한다(실패면 그 가구만 빼고 기록).
const jpTileset = createJpCityTileset();
let dropped = 0; const reasons = new Map<string, number>();
for (const [tid, list] of Object.entries(templates)) {
  const tileset = tid === "jp_city" ? jpTileset : v5tileset;
  for (const t of list) {
    const plan = ["#".repeat(t.w + 2), ...(t.mask ?? Array.from({ length: t.h }, () => ".".repeat(t.w))).map((r) => `#${r}#`), "#".repeat(t.w + 2)];
    plan[plan.length - 1] = plan[plan.length - 1]!.slice(0, 1 + Math.floor(t.w / 2)) + "." + plan[plan.length - 1]!.slice(2 + Math.floor(t.w / 2));
    const put = (it: InteriorTemplateItem) => ({ ...it, x: it.x + 1, y: it.y + 1 });
    const keep: InteriorTemplateItem[] = [];
    for (const it of t.items) {
      const trial = [...keep, it].map(put);
      const input: HandInteriorInput = { plan, floor: t.floor, wall: t.wall,
        objects: trial.filter((i) => i.t === "o").map((i) => ({ id: i.id, x: i.x, y: i.y })),
        tables: trial.filter((i) => i.t === "t").map((i) => ({ style: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! })),
        goods: trial.filter((i) => i.t === "g").map((i) => ({ id: i.id, x: i.x, y: i.y })),
        daises: trial.filter((i) => i.t === "d").map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! })),
        lines: trial.filter((i) => i.t === "l").map((i) => ({ id: i.id, cells: i.cells!.map(([x, y]) => ({ x: x + 1, y: y + 1 })) })) };
      const errs = buildHandInteriorLayers(input, tileset, HAND_INTERIOR_SPECS[tid]).issues.filter((i) => i.severity === "error" && i.code !== "no-entrance"); // 출입 틈 자리는 시험용이라 실제 배치에서 다시 본다
      if (errs.length) { dropped++; reasons.set(errs[0]!.code, (reasons.get(errs[0]!.code) ?? 0) + 1); continue; }
      keep.push(it);
    }
    t.items = keep;
  }
}
fs.writeFileSync(OUT, JSON.stringify({ version: 1, templates, programs }) + "\n");
console.log(Object.entries(templates).map(([k, v]) => `${k}: 방 견본 ${v.length} · 종류 ${new Set(v.map((t) => t.kind)).size} · 건물 ${Object.keys(programs[k]!).length}`).join("\n"), `\n홀로 세우면 오류라 뺀 가구 ${dropped}`, Object.fromEntries(reasons));
