// 마당과 집의 관계 재기 — village-code-terrain-probe.mts 가 남긴 <n>-C.data.json · <n>-C.project.json · <n>-C.png 를 읽는다(모델 없음, 다시 짓지 않는다).
//   bun scripts/qa/village-yard-measure.mts --in <dir>[,<dir>…] [--mark] [--json <file>]
// 판마다: 문 앞 ↔ 모이는 곳 거리(가운데값·최대) · 마당에서 6칸 안·같은 단에 문을 낸 집 수 · 모이는 곳과 같은 단의 집 몫 ·
//         건물 하나당 맵 칸 · 마을 몸(건물을 감싸는 네모) 넓이와 그 안의 건물 몫.
// 마당: 결과에 data.layout.yard(자동 배치의 마당 네모·날개·길가 앞마당)가 있으면 그 칸, 없으면 모이는 곳 둘레 5×5(예전 배치가 비워 두던 자리).
// --mark: <n>-C.mark.png — 마당 테두리(노랑) · 길가 앞마당(주황) · 문 앞 칸(빨강) · 우물 자리(하늘)를 그린 사본.
import fs from "node:fs";
import { PNG } from "pngjs";
import { reliefMapView } from "../../src/editor/reliefMapView.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const dirs = arg("in", "").split(",").filter(Boolean);
const mark = process.argv.includes("--mark");
const TS = 16;
type Rect = { x0: number; y0: number; x1: number; y1: number };
const med = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
const rows: Record<string, unknown>[] = [];
for (const dir of dirs) for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-C.data.json")).sort((a, b) => parseInt(a) - parseInt(b))) {
  const { n, ask, data: d } = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  const pj = JSON.parse(fs.readFileSync(`${dir}/${n}-C.project.json`, "utf8"));
  const map = pj.project.maps[pj.mapId]; const W: number = map.width, H: number = map.height;
  const lv: number[] = map.relief?.levels ?? new Array(W * H).fill(0);
  const L = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? lv[y * W + x]! : -1);
  const g = d.layout?.gather ?? d.gathering?.door ?? { x: Math.round(W / 2), y: Math.round(H / 2) };
  const yard = d.layout?.yard as (Rect & { lobes: Rect[]; courts: Rect[]; frame: unknown[] }) | undefined;
  const cells = new Set<number>(), court = new Set<number>();
  const add = (r: Rect, to: Set<number>) => { for (let y = r.y0; y <= r.y1; y += 1) for (let x = r.x0; x <= r.x1; x += 1) if (x >= 0 && y >= 0 && x < W && y < H) to.add(y * W + x); };
  if (yard) { add(yard, cells); for (const l of yard.lobes) add(l, cells); for (const c of yard.courts) add(c, court); }
  else add({ x0: g.x - 2, y0: g.y - 2, x1: g.x + 2, y1: g.y + 2 }, cells);
  const gl = L(g.x, g.y);
  const anchors = new Set<string>(d.anchors ?? []);
  const doors = (d.doors ?? []) as { kit: string; x: number; y: number; reached: boolean }[];
  const houses = doors.filter((x) => !anchors.has(x.kit));
  const dist = (p: { x: number; y: number }) => Math.hypot(p.x - g.x, p.y - g.y);
  /** 문 앞에서 마당 칸까지 가장 가까운 거리(같은 단의 마당 칸만). */
  const toYard = (p: { x: number; y: number }, set: Set<number>) => { let b = Infinity; for (const c of set) { const x = c % W, y = (c - x) / W; if (L(x, y) !== L(p.x, p.y)) continue; b = Math.min(b, Math.max(Math.abs(x - p.x), Math.abs(y - p.y))); } return b; };
  const near = houses.filter((h) => toYard(h, cells) <= 6).length;
  const nearAny = houses.filter((h) => Math.min(toYard(h, cells), toYard(h, court)) <= 3).length;
  // 건물 사각형: 문 앞 칸 바로 위에 아랫줄이 닿는 찍은 키트
  const blds: Rect[] = [];
  for (const dr of doors) { const p = (map.structurePlacements ?? []).find((q: { kitId: string; x: number; y: number; w: number; h: number }) => q.kitId === dr.kit && dr.x >= q.x && dr.x < q.x + q.w && dr.y === q.y + q.h); if (p) blds.push({ x0: p.x, y0: p.y, x1: p.x + p.w - 1, y1: p.y + p.h - 1 }); }
  const area = blds.reduce((s, b) => s + (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1), 0);
  const bx0 = Math.min(...blds.map((b) => b.x0)), bx1 = Math.max(...blds.map((b) => b.x1)), by0 = Math.min(...blds.map((b) => b.y0)), by1 = Math.max(...blds.map((b) => b.y1));
  const body = blds.length ? (bx1 - bx0 + 1) * (by1 - by0 + 1) : 0;
  const row = { dir: dir.split("/").slice(-2).join("/"), n, ask, size: `${W}x${H}`, buildings: blds.length, houses: houses.length, unreached: doors.filter((x) => !x.reached).length,
    doorMed: +med(doors.map(dist)).toFixed(1), doorMax: +Math.max(0, ...doors.map(dist)).toFixed(1), houseMed: +med(houses.map(dist)).toFixed(1), houseMax: +Math.max(0, ...houses.map(dist)).toFixed(1),
    near, nearOk: near >= Math.min(3, houses.length), nearAny, sameTier: houses.filter((h) => L(h.x, h.y) === gl).length, yard: !!yard,
    cellsPerBuilding: blds.length ? Math.round((W * H) / blds.length) : 0, body, bodyShare: body ? +(body / (W * H)).toFixed(2) : 0, builtInBody: body ? +(area / body).toFixed(2) : 0 };
  rows.push(row);
  console.log(`${row.dir} #${n} ${row.size} 건물 ${row.buildings} 집 ${row.houses} | 문↔모이는 곳 가운데 ${row.doorMed} 최대 ${row.doorMax} (집 ${row.houseMed}/${row.houseMax}) | 마당 6칸 안 집 ${near}/${houses.length}${row.nearOk ? "" : " ✗"} · 마당·앞마당 3칸 안 ${nearAny} | 같은 단 ${row.sameTier}/${houses.length} | 건물당 ${row.cellsPerBuilding}칸 · 몸 ${body}칸(${Math.round(row.bodyShare * 100)}%) 안 건물 ${Math.round(row.builtInBody * 100)}%${yard ? "" : " (마당 없음)"}`);
  if (mark && fs.existsSync(`${dir}/${n}-C.png`)) {
    const png = PNG.sync.read(fs.readFileSync(`${dir}/${n}-C.png`));
    // 그림은 단마다 칸을 들어 올려 그린다(높은 단이 위로) — 칸의 화면 줄은 렌더러와 같은 계산으로 얻는다
    const view = reliefMapView(map, TS);
    const top = (x: number, y: number) => Math.round(view?.rows[y]?.cells[x]?.y ?? y * TS);
    const px = (x: number, y: number, c: [number, number, number], a = 1) => { if (x < 0 || y < 0 || x >= png.width || y >= png.height) return; const i = (y * png.width + x) * 4; for (let k = 0; k < 3; k += 1) png.data[i + k] = Math.round(png.data[i + k]! * (1 - a) + c[k]! * a); png.data[i + 3] = 255; };
    const outline = (set: Set<number>, c: [number, number, number]) => { for (const cell of set) { const x = cell % W, y = (cell - x) / W;
      const has = (X: number, Y: number) => X >= 0 && Y >= 0 && X < W && Y < H && set.has(Y * W + X);
      const Y = top(x, y);
      for (let t = 0; t < 2; t += 1) for (let i = 0; i < TS; i += 1) {
        if (!has(x, y - 1)) px(x * TS + i, Y + t, c); if (!has(x, y + 1)) px(x * TS + i, Y + TS - 1 - t, c);
        if (!has(x - 1, y)) px(x * TS + t, Y + i, c); if (!has(x + 1, y)) px(x * TS + TS - 1 - t, Y + i, c);
      }
      for (let j = 0; j < TS; j += 1) for (let i = 0; i < TS; i += 1) px(x * TS + i, Y + j, c, 0.12); } };
    outline(cells, [255, 226, 64]); outline(court, [255, 150, 40]);
    for (const dr of doors) for (let j = 2; j < TS - 2; j += 1) for (let i = 2; i < TS - 2; i += 1) px(dr.x * TS + i, top(dr.x, dr.y) + j, [235, 40, 40], i < 4 || j < 4 || i >= TS - 4 || j >= TS - 4 ? 1 : 0.45);
    for (let j = -3; j < TS + 3; j += 1) for (let i = -3; i < TS + 3; i += 1) if (Math.abs(Math.hypot(i - TS / 2 + 0.5, j - TS / 2 + 0.5) - 9) < 1.2) px(g.x * TS + i, top(g.x, g.y) + j, [70, 220, 255]);
    fs.writeFileSync(`${dir}/${n}-C.mark.png`, PNG.sync.write(png));
  }
}
const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
if (rows.length) console.log(`합계 ${rows.length}판: 집 ${sum("houses")} · 마당 6칸 안 집 ${sum("near")} · 목표(3채 또는 전부) 채운 판 ${rows.filter((r) => r.nearOk).length}/${rows.length} · 같은 단 집 ${sum("sameTier")}/${sum("houses")} · 문↔모이는 곳 가운데값의 가운데 ${med(rows.map((r) => Number(r.doorMed))).toFixed(1)} · 최대의 가운데 ${med(rows.map((r) => Number(r.doorMax))).toFixed(1)} · 건물당 맵 칸 ${Math.round(rows.reduce((s, r) => s + Number(String(r.size).split("x")[0]) * Number(String(r.size).split("x")[1]), 0) / Math.max(1, sum("buildings")))} · 몸 안 건물 몫 가운데 ${Math.round(med(rows.map((r) => Number(r.builtInBody))) * 100)}%`);
if (arg("json", "")) fs.writeFileSync(arg("json", ""), JSON.stringify(rows, null, 1));
