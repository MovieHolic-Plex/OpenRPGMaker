// 전국·에도 실내 QA — 방 구성(program) 7개와 방 하나 요청 몇 개를 **조수 도구 그대로**(build_hand_interior_room, tileset sengoku_edo) 지어
// 엔진 통행·도구 경고를 보고 PNG 를 쓴다. 종료 코드 = WARN+FAIL 수.
//   node_modules/.bin/vite-node scripts/content/sengoku-edo/qa/check-sengoku-interiors.mts -- [--out /tmp/se-int]
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "../../../../src/editor/tools/handInteriorTools.ts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/se-int"); fs.mkdirSync(OUT, { recursive: true });
const project: any = createEmptyToolProject("chk"); ensureBundledTilesets(project);
const CASES: [string, Record<string, unknown>][] = [
  ["samurai-house", { floor: "se-floor-tatami", wall: "se-wall-fusuma", layout: { program: "samurai-house" } }],
  ["ryokan-1f", { floor: "se-floor-wood", wall: "se-wall-shoji", layout: { program: "ryokan-1f" } }],
  ["ryokan-2f", { floor: "se-floor-tatami", wall: "se-wall-shoji", layout: { program: "ryokan-2f" } }],
  ["castle-hall", { floor: "se-floor-tatami-gold", wall: "se-wall-fusuma-gold", layout: { program: "castle-hall" } }],
  ["machiya", { floor: "se-floor-wood", wall: "se-wall-board", layout: { program: "machiya" } }],
  ["minka", { floor: "se-floor-doma", wall: "se-wall-plaster", layout: { program: "minka" } }],
  ["dojo", { floor: "se-floor-wood", wall: "se-wall-board", layout: { program: "dojo" } }],
  ["tea", { floor: "se-floor-tatami", wall: "se-wall-shoji", layout: { rooms: [{ kind: "tea" }] } }],
];
let bad = 0;
for (const [id, a] of CASES) {
  try {
    const r: any = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, { tileset: "sengoku_edo", mapId: `chk-${id}`, name: id, ...a });
    const w = [...(r.warnings ?? [])];
    if (w.length) bad++;
    const m = project.maps[`chk-${id}`]!;
    fs.writeFileSync(`${OUT}/${id}.png`, renderMapPng(project, m).png);
    console.log(`${w.length ? "WARN" : "OK  "} ${id} ${m.width}x${m.height} ${r.summary.slice(0, 220)}${w.length ? "\n  - " + w.join("\n  - ") : ""}`);
    if (r.data?.layout?.picture) console.log(String(r.data.layout.picture));
  } catch (e: any) { bad++; console.log(`FAIL ${id}: ${String(e.message ?? e).slice(0, 500)}`); }
}
process.exit(bad);
