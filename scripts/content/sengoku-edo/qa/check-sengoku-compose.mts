// compose_sengoku_edo_map / link_sengoku_edo_interior 를 조수 도구 그대로(runTool) 돌려 엔진 통행·자동 키우기·이동 이음을 보고, 엔진 렌더러로 PNG 를 쓴다.
//   node_modules/.bin/vite-node scripts/content/sengoku-edo/qa/check-sengoku-compose.mts -- [--out /tmp/se-compose] [--seeds 6]
// 종료 코드 = 실패 수.
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../../../src/editor/tools/index.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/se-compose"); fs.mkdirSync(OUT, { recursive: true });
const SEEDS = Number(arg("seeds", "6"));
const ctx: any = { project: createEmptyToolProject("chk") }; ensureBundledTilesets(ctx.project);
let bad = 0;
const call = (tool: string, args: any, quiet = false) => { const r: any = runTool(ctx, tool, args); if (!r.ok && !quiet) { bad++; console.log("FAIL", tool, JSON.stringify(args).slice(0, 120), "→", JSON.stringify(r).slice(0, 800)); } return r; };
const STYLES = ["castle_town", "inn_street", "samurai", "castle", "temple", "village"];
for (const style of STYLES) {
  for (let seed = 0; seed < SEEDS; seed++) {
    // 빈 20×15 맵 → 도구가 기본 크기로 키운다
    const cm: any = call("create_map", { name: `${style}-${seed}`, width: 20, height: 15, tilesetId: "sengoku_edo" });
    if (!cm.ok) continue;
    const mapId = cm.data.mapId;
    const r = call("compose_sengoku_edo_map", { mapId, style, seed });
    if (!r.ok) continue;
    const m = ctx.project.maps[mapId]!;
    console.log("OK  ", style, seed, `${m.width}x${m.height}`, `seed→${r.data.seed}`, `건물 ${r.data.buildings.length} 소품 ${r.data.props}`);
    if (seed < 2) fs.writeFileSync(`${OUT}/${style}-${seed}.png`, renderMapPng(ctx.project, m).png);
    if (style === "samurai" && seed === 0) {
      const b = r.data.buildings.find((x: any) => x.kit === "se-samurai-house") ?? r.data.buildings[0];
      const ir = call("build_hand_interior_room", { tileset: "sengoku_edo", name: "무가 저택 안", floor: "se-floor-tatami", wall: "se-wall-fusuma", layout: { program: "samurai-house" } });
      if (ir.ok) {
        const lr = call("link_sengoku_edo_interior", { mapId, door: b.doors[0], width: b.doors.length, interiorMapId: ir.data.mapId });
        if (lr.ok) console.log("LINK", lr.summary.slice(0, 220));
      }
    }
  }
}
// 칠한 맵은 replace 없이 거부
const anyMap = Object.values(ctx.project.maps).find((m: any) => m.tilesetId === "sengoku_edo" && m.width > 40) as any;
const rej = call("compose_sengoku_edo_map", { mapId: anyMap.id, style: "village" }, true);
console.log(rej.ok ? "FAIL replace 없이 덮어씀" : "OK   replace 없이 거부 — " + String(rej.error?.message ?? JSON.stringify(rej)).slice(0, 100));
if (rej.ok) bad++;
process.exit(bad);
