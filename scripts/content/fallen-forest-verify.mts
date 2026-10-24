/**
 * 구운 폴른 스타(dist/demos/chrono-bell.{project,play}.json)를 다시 읽어 숲 여섯 맵을 확인한다 — 재로드 검증.
 *   node node_modules/vite-node/dist/cli.mjs --script scripts/content/fallen-forest-verify.mts [dist/demos]
 * 확인: 맵 존재·이름, 숲 맵 사이 모든 이동의 목적지가 맵 안·걸을 수 있는 칸이고 짝 문이 있다, 출구끼리 걸어서 이어진다,
 * 상자, 조우, 떠도는 짐승의 추격(부채꼴 시야·「!」·복귀).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deserialize } from "@/project/io";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

const dir = process.argv[2] ?? "dist/demos";
const FOREST = ["fs_forest_edge", "fs_forest_stream", "fs_forest_thicket", "fs_forest_shrine", "fs_forest_glade", "fs_forest"];
let bad = 0;
const fail = (m: string) => { bad += 1; console.log("FAIL", m); };
const transfers = (map: GameMap) => map.events.flatMap((e) => (e.pages ?? []).flatMap((p) => p.commands).filter((c) => c.kind === "transfer").map((c) => ({ e, t: c as unknown as { mapId: string; x: number; y: number; direction?: string } })));
function reach(p: Project, map: GameMap, from: { x: number; y: number }): Set<number> {
  const W = map.width, seen = new Set([from.y * W + from.x]), q = [from];
  for (let k = 0; k < q.length; k++) { const c = q[k]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = c.x + dx, y = c.y + dy, i = y * W + x;
      if (x < 0 || y < 0 || x >= W || y >= map.height || seen.has(i) || !isPassable(p, map, x, y)) continue; seen.add(i); q.push({ x, y }); } }
  return seen;
}
for (const file of ["chrono-bell.project.json", "chrono-bell.play.json"]) {
  const p = deserialize(readFileSync(join(dir, file), "utf8"));
  console.log(`\n# ${file}: maps ${Object.keys(p.maps).length}`);
  for (const id of FOREST) {
    const map = p.maps[id];
    if (!map) { fail(`${file} ${id} 없음`); continue; }
    const doors = transfers(map);
    const chests = map.events.filter((e) => /_chest$/.test(e.id)).length;
    const foes = map.events.filter((e) => /_foe\d+$/.test(e.id));
    const chase = foes.filter((e) => (e.pages ?? []).some((pg) => pg.movement.type === "chase" && pg.movement.sight?.facing === "cone" && pg.movement.sightAlert && pg.movement.pursuit?.onLost === "return"));
    console.log(`${id} «${map.name}» ${map.width}x${map.height} doors=${doors.length} chests=${chests} foes=${foes.length} chase=${chase.length} enc=${map.encounterRate} table=${(map.encounterTable ?? []).length}`);
    if (chase.length !== foes.length) fail(`${id} 추격 아닌 짐승 ${foes.length - chase.length}`);
    for (const { e, t } of doors) {
      const to = p.maps[t.mapId];
      if (!to) { fail(`${id} (${e.x},${e.y}) → 없는 맵 ${t.mapId}`); continue; }
      if (t.x < 0 || t.y < 0 || t.x >= to.width || t.y >= to.height || !isPassable(p, to, t.x, t.y)) fail(`${id} (${e.x},${e.y}) → ${t.mapId} (${t.x},${t.y}) 못 서는 칸`);
      if (!transfers(to).some((b) => b.t.mapId === id)) fail(`${id} → ${t.mapId} 짝 문 없음`);
    }
    // 첫 문 앞에서 모든 문·상자에 닿는가.
    const first = doors[0];
    if (first) {
      const r = reach(p, map, { x: first.e.x, y: first.e.y });
      for (const { e } of doors) if (!r.has(e.y * map.width + e.x)) fail(`${id} 문 (${e.x},${e.y}) 에 못 닿음`);
      for (const c of map.events.filter((ev) => /_chest$/.test(ev.id))) {
        const near = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => r.has((c.y + dy!) * map.width + c.x + dx!));
        if (!near) fail(`${id} 상자 (${c.x},${c.y}) 에 못 닿음`);
      }
    }
  }
  const hubDoor = transfers(p.maps.fs_hub!).filter(({ t }) => FOREST.includes(t.mapId));
  console.log(`fs_hub → ${hubDoor.map(({ t }) => `${t.mapId}(${t.x},${t.y},${t.direction})`).join(" ")}`);
  if (!hubDoor.length || hubDoor.some(({ t }) => t.mapId !== "fs_forest_edge")) fail("왕도 동문이 어귀로 가지 않는다");
  const allFoes = Object.values(p.maps).flatMap((m) => m.events.filter((e) => /_foe\d+$/.test(e.id)).map((e) => `${m.id}:${e.id}:${(e.pages ?? [])[0]?.movement.type}`));
  console.log(`all foes: ${allFoes.join(" ")}`);
}
console.log(bad ? `\n${bad} FAIL` : "\nOK");
process.exit(bad ? 1 : 0);
