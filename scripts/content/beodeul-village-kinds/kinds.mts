// 마을 종류 탐침(모델 없음): 종류마다 그 종류에 맞는 터의 마을을 진짜 도구(author_beodeul_town)로 짓고, 장면이 청한 수·통째로 선 수·자리 없어 못 놓은 수,
// 새 기물·장면이 끊은 걷는 칸(0 이어야 한다), 들를 곳 사이 걸음이 늘어난 칸 수를 적는다. 1배 그림과 주 장면 2배 조각(주인공이 선 칸에 표시)도 남긴다.
//   bun scripts/content/beodeul-village-kinds/kinds.mts <결과 폴더> [--only id,id] [--key 이름] [--seed N] [--no-png] [--why] [--hero 24x32.png]
//   --why = 자리 없어 못 놓은 장면의 속(후보·무더기 조건·조각·길 돌림) · --hero = 2배 조각의 설 칸에 그 그림(24×32 주인공)을 세운다
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../../src/editor/tools/index.ts";
import { renderMapPng } from "../../qa-game/render.mts";
import { isPassable } from "../../../src/project/collision.ts";
import { computeReachableCells } from "../../../src/project/lint/reachability.ts";
import { BEODEUL_VILLAGE_KINDS, type VillageKind } from "../../../src/editor/tools/beodeulVillageKinds.ts";

const argv = process.argv.slice(2);
const opt = (name: string, d: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1]! : d; };
const out = argv[0] && !argv[0].startsWith("--") ? argv[0] : "";
if (!out) throw new Error("kinds.mts <결과 폴더> [--only id,id] [--key 이름] [--seed N] [--no-png]");
const only = opt("only", "").split(",").filter(Boolean), keyName = opt("key", "ashvale"), seed0 = Number(opt("seed", "11")), png = !argv.includes("--no-png");
fs.mkdirSync(out, { recursive: true });
const heroFile = opt("hero", ""); const hero = heroFile ? PNG.sync.read(fs.readFileSync(heroFile)) : null;
const base = createBlankProject(); ensureBundledTilesets(base); const TEMPLATE = JSON.stringify(base);
const key = JSON.stringify(["project", `variety-${keyName}`]);

/** 그 종류에 맞는 터의 요청(도구 인자). 집 수는 급이 정한다 — 읍은 자리를 넉넉히. */
export function argsFor(kind: VillageKind, seed: number): Record<string, unknown> {
  const sea = kind.fit.water[0] === "sea", town = kind.rank === "town", village = kind.rank === "village";
  const a: Record<string, unknown> = { theme: sea ? "coast" : "river", kind: kind.id, seed, id: `k_${kind.id.replace(/-/g, "_")}`, name: kind.ko };
  if (!sea) a.water = kind.fit.water[0] === "none" ? "none" : "river";
  if (kind.fit.tiers === "hill") { a.landform = "hill"; a.tiers = 1; } else if (kind.fit.tiers === "flat") a.landform = "flat";
  if (kind.fit.woods === "dense") a.woods = "dense";
  if (kind.fit.walls) a.walls = true;
  if (kind.fit.square) a.form = "plaza";
  if (kind.fit.harbour) a.harbour = true;
  [a.width, a.height] = kind.fit.harbour ? [84, 40] : town ? [64, 52] : village ? [56, 48] : [44, 40];
  if (kind.rank === "hamlet") a.houseCount = 4;
  return a;
}

const rows: Record<string, unknown>[] = [];
let asked = 0, placed = 0, noRoom = 0, noKits = 0, lifted = 0, cut = 0, added = 0;
for (const kind of BEODEUL_VILLAGE_KINDS) {
  if (only.length && !only.includes(kind.id)) continue;
  const build = (withKind: boolean) => {
    const ctx: any = { project: JSON.parse(TEMPLATE), assistantRun: true, lookKey: key };
    const args = argsFor(kind, seed0); if (!withKind) delete args.kind;
    const r = runTool(ctx, "author_beodeul_town", args as never);
    return { ctx, r };
  };
  const { ctx, r } = build(true);
  if (!r.ok) { console.log(`${kind.id}: 짓기 실패 — ${String(r.summary).slice(0, 200)}`); rows.push({ id: kind.id, ok: false, summary: r.summary }); continue; }
  const d: any = r.data, map = ctx.project.maps[d.mapId], W = map.width;
  const sc = d.sceneCount ?? { asked: 0, placed: 0, lifted: 0, skipped: [] };
  const room = (sc.skipped as string[]).filter((s) => s.endsWith(":room") || s.endsWith(":anchor")).length, kits = (sc.skipped as string[]).filter((s) => s.endsWith(":kits")).length;
  // 끊긴 칸: 새 기물·장면의 3층 칸을 지운 사본에서는 입구에서 닿는데 지금은 안 닿는 걷는 칸(기물이 선 칸은 뺀다).
  const start = d.entrance ?? ctx.project.startPos;
  const own = new Set<number>();
  for (const s of d.scenes ?? []) for (let j = 0; j < s.h; j += 1) for (let i = 0; i < s.w; i += 1) own.add((s.y + j) * W + s.x + i);
  const now = computeReachableCells(ctx.project, map, start.x, start.y);
  const bare = JSON.parse(JSON.stringify(map)); for (const c of own) { bare.upperTiles[c] = -1; if (bare.upperOverlayTiles) bare.upperOverlayTiles[c] = -1; }
  const was = computeReachableCells({ ...ctx.project, maps: { ...ctx.project.maps, [map.id]: bare } }, bare, start.x, start.y);
  const has = (s: any, x: number, y: number) => s.has(`${x},${y}`) || s.has(y * W + x);
  let cells = 0; for (let y = 0; y < map.height; y += 1) for (let x = 0; x < W; x += 1) if (!own.has(y * W + x) && isPassable(ctx.project, map, x, y) && has(was, x, y) && !has(now, x, y)) cells += 1;
  const standOk = (d.scenes ?? []).filter((s: any) => has(now, s.stand.x, s.stand.y)).length;
  asked += sc.asked; placed += sc.placed; noRoom += room; noKits += kits; lifted += sc.lifted; cut += cells; added += d.routeAdded ?? 0;
  const row = { id: kind.id, ko: kind.ko, rank: kind.rank, ok: true, size: `${W}x${map.height}`, houses: d.houses, work: d.work?.name ?? null, asked: sc.asked, placed: sc.placed, noRoom: room, noKits: kits, lifted: sc.lifted,
    skipped: sc.skipped, cut: cells, routeAdded: d.routeAdded ?? 0, standReached: `${standOk}/${(d.scenes ?? []).length}`, unreached: (d.doors ?? []).filter((x: any) => !x.reached).length, stampFailed: d.stampFailed,
    scenes: d.scenes, entrance: d.entrance, gather: d.gathering?.door ?? null };
  rows.push(row);
  if (argv.includes("--why")) for (const t of sc.tried ?? []) console.log(`  자리 없음 ${t.id}: 후보 ${t.spots} · 무더기 조건 ${t.group} · 조각 안 들어감 ${t.fit} · 길 돌림 ${t.route}`);
  console.log(`${kind.id} (${kind.rank}) ${row.size} 집 ${d.houses} · 장면 ${sc.placed}/${sc.asked}${room ? ` · 자리 없음 ${room}` : ""}${kits ? ` · 그림 기다림 ${kits}` : ""}${sc.lifted ? ` · 걷음 ${sc.lifted}` : ""} · 끊긴 칸 ${cells} · 걸음 +${d.routeAdded ?? 0} · 설 칸 ${row.standReached} · 못 닿는 문 ${row.unreached} · 찍기 실패 ${d.stampFailed}`);
  if (png) {
    fs.writeFileSync(path.join(out, `${kind.id}.png`), renderMapPng(ctx.project, map).png);
    const main = (d.scenes ?? [])[0];
    if (main) {
      // 주 장면 2배 조각 — 장면 둘레 네 칸, 설 칸에 24×32 주인공 자리(흰 테 네모)를 그린다.
      const full = PNG.sync.read(renderMapPng(ctx.project, map, 2).png);
      const x0 = Math.max(0, main.x - 5), y0 = Math.max(0, main.y - 4), x1 = Math.min(W, main.x + main.w + 5), y1 = Math.min(map.height, main.y + main.h + 5);
      const cw = (x1 - x0) * 32, ch = (y1 - y0) * 32; const crop = new PNG({ width: cw, height: ch });
      PNG.bitblt(full, crop, x0 * 32, y0 * 32, cw, ch, 0, 0);
      if (hero) { // 주인공을 2배로, 발을 설 칸 아랫변에 맞춰
        const hx = (main.stand.x - x0) * 32 + 16 - hero.width, hy = (main.stand.y - y0) * 32 + 32 - hero.height * 2;
        for (let y = 0; y < hero.height * 2; y += 1) for (let x = 0; x < hero.width * 2; x += 1) {
          const si = (Math.floor(y / 2) * hero.width + Math.floor(x / 2)) * 4; if (hero.data[si + 3]! < 128) continue;
          const px = hx + x, py = hy + y; if (px < 0 || py < 0 || px >= cw || py >= ch) continue;
          const di = (py * cw + px) * 4; for (let k = 0; k < 3; k += 1) crop.data[di + k] = hero.data[si + k]!; crop.data[di + 3] = 255;
        }
      }
      fs.writeFileSync(path.join(out, `${kind.id}-scene.png`), PNG.sync.write(crop));
      fs.writeFileSync(path.join(out, `${kind.id}-scene.json`), JSON.stringify({ x0, y0, stand: main.stand, name: main.ko }));
    }
  }
}
fs.writeFileSync(path.join(out, "kinds.json"), JSON.stringify({ key, seed: seed0, rows }, null, 1));
console.log(`종류 ${rows.length} · 장면 청함 ${asked} · 통째로 섬 ${placed} · 자리 없어 못 놓음 ${noRoom} · 그림 기다림 ${noKits} · 깨져서 걷음 ${lifted} · 끊긴 걷는 칸 ${cut} · 들를 곳 걸음 +${added}`);
