#!/usr/bin/env node
// jp_city 방 구성(program) 시험 — 조수와 같은 길: build_hand_interior_room({tileset:"jp_city", layout:{program}}) 만 주고 도구가 방·칸막이·문·가구를 짜게 한다.
//   node scripts/content/jp-city/qa/program-rooms.mjs [program …]   (기본: 병원·학교·사무실 6가지)
// → maps/out/program-<program>.{map,report}.json + verify-shots/jp-city/program/<program>-{1x,x3}.png. 보고: 경고·도달 칸·layout.picture.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { underTsx, ROOT, OUT } from "../maps/kitmap.mjs";
underTsx(import.meta.url);

const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { BUILD_HAND_INTERIOR_ROOM_TOOL } = await imp("src/editor/tools/handInteriorTools.ts");
const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");

const args = process.argv.slice(2);
const PROGRAMS = args.length ? args : ["school-2f", "school-1f", "office-floor", "office-free", "hospital-1f", "hospital-2f"];
const project = createEmptyToolProject("jp-program");
const SHOTS = join(ROOT, "verify-shots/jp-city/program");
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const program of PROGRAMS) {
  const mapId = `jp-program-${program}`;
  let r;
  // floor·wall 은 도구 필수 인자 — 조수처럼 같은 이름 예제 맵의 바닥·벽(없으면 사무 카펫·벽)을 준다. 방마다 바닥·벽은 견본이 덮는다.
  const exPath = join(ROOT, "tiledata/jp-city/interior/examples", `${program}.json`);
  const ex = fs.existsSync(exPath) ? JSON.parse(fs.readFileSync(exPath, "utf8")) : { floor: "of-carpet-tile", wall: "of-wall" };
  try { r = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "jp_city", mapId, name: `program ${program}`, floor: ex.floor, wall: ex.wall, exitWidth: 2, layout: { program } }); }
  catch (e) { console.log(`FAIL ${program}: ${e.message}`); bad++; continue; }
  const MAP = project.maps[mapId];
  const report = { program, size: [MAP.width, MAP.height], summary: r.summary, warnings: r.warnings ?? [], layout: r.data?.layout };
  fs.writeFileSync(join(OUT, `program-${program}.map.json`), JSON.stringify(MAP));
  fs.writeFileSync(join(OUT, `program-${program}.report.json`), JSON.stringify(report, null, 1));
  const rr = spawnSync("python3", ["scripts/content/jp-city/maps/render.py", join(OUT, `program-${program}.map.json`), `program/${program}`], { cwd: ROOT, encoding: "utf8" });
  if (rr.status !== 0) { console.error(rr.stderr); process.exit(2); }
  console.log(`${report.warnings.length ? "WARN" : "OK  "} ${program} ${MAP.width}x${MAP.height} — ${r.summary}`);
  for (const w of report.warnings) console.log(`      ${w}`);
  if (report.warnings.length) bad++;
}
process.exit(bad ? 1 : 0);
