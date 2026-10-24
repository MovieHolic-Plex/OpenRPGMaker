/**
 * 폴른 스타 숲 맵 조사 — 데모를 지어 숲 맵마다 크기·통행 격자·이벤트·이동·조우를 찍는다.
 *   node --max-old-space-size=12000 node_modules/vite-node/dist/cli.mjs --script scripts/content/fallen-forest-probe.mts [mapId…]
 * 격자: # 막힘 · . 통행 · = 모랫길 · T 이동 · E 이벤트 · ? 이동 칸에서 닿지 않는 통행 칸
 */
import { createFlagshipDemoProject } from "@/project/flagship";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

const want = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const { project } = createFlagshipDemoProject("chrono-bell");
const ids = want.length ? want : Object.keys(project.maps).filter((id) => /forest/.test(id)).concat(["fs_hub"].filter(() => process.env.PROBE_HUB));
const transfersOf = (map: GameMap) => map.events.flatMap((e) => JSON.stringify(e.pages ?? []).match(/"kind":"transfer"[^}]*/g)?.map((t) => ({ e, t })) ?? []);
function dump(p: Project, map: GameMap): void {
  const W = map.width, H = map.height;
  const meta = (p.tilesets[map.tilesetId] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
  const trail = (i: number) => (meta[map.lowerTiles[i]!]?.label ?? "").startsWith("버들항 · 모랫길");
  const ev = new Map(map.events.map((e) => [e.y * W + e.x, e]));
  const tcells = new Set(transfersOf(map).map(({ e }) => e.y * W + e.x));
  // 이동 칸에서 BFS
  const seen = new Set<number>(); const q = [...tcells];
  for (const c of q) seen.add(c);
  for (let k = 0; k < q.length; k++) { const c = q[k]!; const x = c % W, y = Math.floor(c / W);
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; const n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !isPassable(p, map, nx, ny)) continue; seen.add(n); q.push(n); } }
  console.log(`\n== ${map.id} «${map.name}» ${W}x${H} bgm=${JSON.stringify(map.bgm ?? null).slice(0, 60)} light=${JSON.stringify(map.defaultLighting ?? null).slice(0, 90)} atm=${(map.atmosphereEffects ?? []).length} table=${JSON.stringify(map.encounterTable ?? [])} enc=${map.encounterRate} encounters=${JSON.stringify((map as unknown as { encounters?: unknown }).encounters ?? null).slice(0, 160)}`);
  for (let y = 0; y < H; y++) { let row = "";
    for (let x = 0; x < W; x++) { const i = y * W + x;
      row += tcells.has(i) ? "T" : ev.has(i) ? "E" : !isPassable(p, map, x, y) ? "#" : !seen.has(i) ? "?" : trail(i) ? "=" : "."; }
    console.log(String(y).padStart(2) + " " + row); }
  for (const e of map.events) console.log(`  ev ${e.id} «${e.name}» (${e.x},${e.y})`);
  for (const { e, t } of transfersOf(map)) console.log(`  T (${e.x},${e.y}) ${t}`);
}
for (const id of ids) if (project.maps[id]) dump(project, project.maps[id]!);
