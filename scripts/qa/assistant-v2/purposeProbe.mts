// 목적 재기(모델 없음): 저장된 게임(project.json)의 바깥 맵마다 «건물이 무엇을 위해 서 있는가»와 «길이 맵의 얼마를 쓰는가»를 사실로 잰다.
// 맵에 남은 꼬리표를 읽지 않는다 — main 에서 지은 판과 목적표로 지은 판을 같은 자로 재려고, 누구나 볼 수 있는 사실만 쓴다:
//   건물      = 칩셋이 선언한 입구(place/entrances.ts)를 가진 건물(옆으로 이어진 문 칸은 한 채)
//   들어감    = 그 문 칸이나 문 앞 칸에 이동 이벤트가 있다
//   문 앞 사람 = 문 앞 칸 둘레(옆 한 칸·아래 한 줄)에 사람 이벤트가 서 있다
//   역할 건물 = 들어감 또는 문 앞 사람 · 채움 = 나머지
//   길        = 들어오는 칸에서 이 맵의 할 일(이동 칸·사람·청사진 단계 이벤트·역할 건물 문 앞)까지의 가장 짧은 길들을 합친 칸
//   길 몫     = 길 칸 ÷ 걸을 수 있는 칸 · 길 곁 = 길에서 3칸 안에 드는 걸을 수 있는 칸의 몫(나머지는 길이 한 번도 가까이 가지 않는 땅)
//   bun scripts/qa/assistant-v2/purposeProbe.mts <[이름=]project.json>… [--json out.json] [--mark outDir]   (--mark: 건물 종류와 길을 맵 PNG 위에 그린다)
import fs from "node:fs";
import path from "node:path";
import { buildingEntrances } from "../../../src/ai/v2/place/entrances.ts";
import { isPassable } from "../../../src/project/collision.ts";

const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const files = argv.filter((a, i) => !a.startsWith("--") && !["--json", "--mark"].includes(argv[i - 1] ?? ""));
const jsonOut = opt("--json"), markDir = opt("--mark");

type Cell = { x: number; y: number };
const hasTransfer = (e: any): boolean => JSON.stringify([e.commands ?? [], ...(e.pages ?? []).map((p: any) => p.commands ?? [])]).includes('"kind":"transfer"');
const spriteOf = (e: any): string => JSON.stringify((e.pages ?? []).map((p: any) => p.graphic ?? {}));
const isPerson = (e: any): boolean => !hasTransfer(e) && /charset|appearanceId/iu.test(spriteOf(e)) && !/monster|object|vehicle|chest/iu.test(spriteOf(e)) && !/_wfoe\d+$|chest|_rest$/u.test(String(e.id));
const norm = (s: string): string => s.normalize("NFC").replace(/\s+/gu, "");

const out: any = { runs: {} };
for (const arg of files) {
  // «이름=경로» 로 주면 그 이름으로 적는다(같은 게임의 전/후를 한 번에 잴 때).
  const named = /^([^=/]+)=(.+)$/u.exec(arg);
  const file = named ? named[2]! : arg;
  const project = JSON.parse(fs.readFileSync(file, "utf8"));
  const run = named ? named[1]! : path.basename(path.dirname(file));
  const steps: any[] = project.gameBlueprint?.steps ?? [];
  const landings = new Map<string, Cell[]>();
  const walkT = (n: any): void => {
    if (Array.isArray(n)) { n.forEach(walkT); return; }
    if (!n || typeof n !== "object") return;
    if (n.kind === "transfer" && typeof n.mapId === "string" && typeof n.x === "number") landings.set(n.mapId, [...(landings.get(n.mapId) ?? []), { x: n.x, y: n.y }]);
    for (const v of Object.values(n)) if (v && typeof v === "object") walkT(v);
  };
  for (const m of Object.values(project.maps) as any[]) walkT(m.events ?? []);
  const rows: any[] = [];
  for (const map of Object.values(project.maps) as any[]) {
    const ents = buildingEntrances(project, map);
    const indoor = map.climate?.mode === "indoor" || map.mapRole === "interior" || map.width * map.height < 450;
    if (indoor) continue;
    const W = map.width, H = map.height;
    const walk = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && isPassable(project, map, x, y);
    // 건물: 같은 줄에 붙은 문 칸은 한 채.
    const groups: { x: number; y: number; w: number; kit: string }[] = [];
    for (const e of ents) { const g = groups.find((o) => o.y === e.y && o.kit === e.kit && e.x === o.x + o.w); if (g) g.w += 1; else groups.push({ x: e.x, y: e.y, w: 1, kit: e.kit }); }
    const events: any[] = map.events ?? [];
    const transfers = events.filter(hasTransfer), people = events.filter(isPerson);
    const span = (g: (typeof groups)[number], x: number, pad: number): boolean => x >= g.x - pad && x <= g.x + g.w - 1 + pad;
    const kinds = groups.map((g) => {
      const enter = transfers.some((t) => span(g, t.x, 0) && (t.y === g.y || t.y === g.y + 1));
      const person = people.some((p) => span(g, p.x, 1) && (p.y === g.y + 1 || p.y === g.y + 2));
      return { ...g, enter, person };
    });
    // 길: 들어오는 칸에서 할 일까지의 가장 짧은 길을 합친다.
    const entryRaw = project.startMapId === map.id && project.startPos ? project.startPos : (landings.get(map.id) ?? [])[0] ?? transfers[0] ?? { x: W >> 1, y: H - 1 };
    const nearWalk = (c: Cell): Cell | undefined => [c, { x: c.x, y: c.y + 1 }, { x: c.x - 1, y: c.y }, { x: c.x + 1, y: c.y }, { x: c.x, y: c.y - 1 }].find((n) => walk(n.x, n.y));
    const entry = nearWalk(entryRaw);
    const prev = new Map<number, number>();
    if (entry) {
      prev.set(entry.y * W + entry.x, -1);
      const q = [entry];
      for (let i = 0; i < q.length; i++) { const c = q[i]!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = c.x + dx, y = c.y + dy, k = y * W + x; if (walk(x, y) && !prev.has(k)) { prev.set(k, c.y * W + c.x); q.push({ x, y }); } } }
    }
    const stepEvents = steps.filter((s) => norm(String(s.place)) === norm(String(map.name))).map((s) => events.find((e) => e.id === s.event || norm(String(e.name ?? "")) === norm(String(s.event)))).filter(Boolean);
    const todo: Cell[] = [...transfers, ...people, ...stepEvents, ...kinds.filter((k) => k.enter || k.person).map((k) => ({ x: k.x, y: k.y + 1 }))].map((e: any) => ({ x: e.x, y: e.y }));
    const route = new Set<number>();
    for (const t of todo) {
      const goal = [t, { x: t.x, y: t.y + 1 }, { x: t.x - 1, y: t.y }, { x: t.x + 1, y: t.y }, { x: t.x, y: t.y - 1 }].find((n) => prev.has(n.y * W + n.x));
      for (let k = goal ? goal.y * W + goal.x : -1; k >= 0; k = prev.get(k)!) route.add(k);
    }
    let walkable = 0, near = 0;
    const routeCells = [...route].map((k) => ({ x: k % W, y: Math.floor(k / W) }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!walk(x, y)) continue;
      walkable += 1;
      if (routeCells.some((r) => Math.abs(r.x - x) <= 3 && Math.abs(r.y - y) <= 3)) near += 1;
    }
    const role = kinds.filter((k) => k.enter || k.person).length;
    rows.push({ name: map.name, w: W, h: H, area: W * H, walkable, buildings: kinds.length, enterable: kinds.filter((k) => k.enter).length, atDoor: kinds.filter((k) => !k.enter && k.person).length, role, filler: kinds.length - role,
      people: people.length, steps: stepEvents.length, route: route.size, routePct: walkable ? Math.round((route.size / walkable) * 100) : 0, nearPct: walkable ? Math.round((near / walkable) * 100) : 0 });
    if (markDir) {
      const { renderMapPng } = await import("../../qa-game/render.mts");
      const { PNG } = await import("pngjs");
      const png = PNG.sync.read(Buffer.from(renderMapPng(project, map).png));
      const T = png.width / W;
      const box = (x: number, y: number, w: number, h: number, rgb: [number, number, number], fill = 0): void => {
        for (let py = Math.round(y * T); py < Math.round((y + h) * T); py++) for (let px = Math.round(x * T); px < Math.round((x + w) * T); px++) {
          if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue;
          const edge = px - Math.round(x * T) < 2 || Math.round((x + w) * T) - px <= 2 || py - Math.round(y * T) < 2 || Math.round((y + h) * T) - py <= 2;
          const a = edge ? 1 : fill;
          if (!a) continue;
          const i = (py * png.width + px) * 4;
          for (let c = 0; c < 3; c++) png.data[i + c] = Math.round(png.data[i + c]! * (1 - a) + rgb[c]! * a);
        }
      };
      for (const r of routeCells) box(r.x + 0.3, r.y + 0.3, 0.4, 0.4, [255, 255, 255], 0.85);
      for (const k of kinds) box(k.x, k.y, k.w, 1, k.enter ? [40, 220, 90] : k.person ? [60, 150, 255] : [240, 60, 60], 0.35);
      for (const p of people) box(p.x, p.y, 1, 1, [60, 150, 255]);
      for (const t of transfers) box(t.x, t.y, 1, 1, [255, 220, 40]);
      fs.mkdirSync(markDir, { recursive: true });
      fs.writeFileSync(path.join(markDir, `${run}-${map.name}.png`), PNG.sync.write(png));
    }
  }
  const sum = (key: string): number => rows.reduce((n, r) => n + r[key], 0);
  const tot = { maps: rows.length, area: sum("area"), walkable: sum("walkable"), buildings: sum("buildings"), enterable: sum("enterable"), atDoor: sum("atDoor"), role: sum("role"), filler: sum("filler"), people: sum("people"), route: sum("route"),
    routePct: sum("walkable") ? Math.round((sum("route") / sum("walkable")) * 100) : 0, indoorMaps: Object.keys(project.maps).length - rows.length };
  out.runs[run] = { total: tot, maps: rows };
  for (const r of rows) console.log(`${run.padEnd(16)} ${String(r.name).padEnd(14)} ${r.w}×${r.h} 건물 ${r.buildings} = 들어감 ${r.enterable} + 문 앞 사람 ${r.atDoor} + 채움 ${r.filler} · 사람 ${r.people} · 걷는 칸 ${r.walkable} · 길 ${r.route}칸(${r.routePct}%) · 길 곁 ${r.nearPct}%`);
  console.log(`${run.padEnd(16)} 합계: 바깥 맵 ${tot.maps} · 넓이 ${tot.area} · 걷는 칸 ${tot.walkable} · 건물 ${tot.buildings} = 들어감 ${tot.enterable} + 문 앞 사람 ${tot.atDoor} + 채움 ${tot.filler} · 사람 ${tot.people} · 길 몫 ${tot.routePct}% · 실내 맵 ${tot.indoorMaps}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
