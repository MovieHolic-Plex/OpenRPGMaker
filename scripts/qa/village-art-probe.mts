// village-art 프로브(2026-10-22) — LLM 없이 마을 종류 표의 recipe 를 그대로 돌려 1배 렌더·도달을 남긴다.
//   bun scripts/qa/village-art-probe.mts --out <dir> [--cases mining:7,vineyard:3,temple-ruins:5,settlement:1,ruined-city:2,shanty:3]
// 버들항 쓰임 덩이(mining·vineyard·temple-ruins·walled-market)는 author_beodeul_town(표 recipe) → dress_village_quarter,
// 폐허(settlement·ruined-city·shanty)는 create_map(wasteland_ruins) → compose_wasteland_map.
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { WASTELAND_DEFAULT_SIZE, type WastelandKind } from "../../src/project/wastelandComposer.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/va/probe");
fs.mkdirSync(OUT, { recursive: true });
const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const TOWN: Record<string, Record<string, unknown>> = {
  mining: { theme: "river", water: "none", terrain: "highland", form: "scatter", roofs: "log", forestType: "conifer", houseCount: 4, width: 56, height: 44 },
  vineyard: { theme: "river", water: "none", form: "scatter", roofs: "red", houseCount: 4, width: 56, height: 44 },
  "temple-ruins": { theme: "river", water: "none", form: "scatter", roofs: "red", houseCount: 4, width: 56, height: 44 },
  "walled-market": { theme: "river", water: "none", form: "scatter", roofs: "red", houseCount: 4, width: 56, height: 44 },
};
const rows: unknown[] = [];
for (const c of arg("cases", "mining:7,vineyard:3,temple-ruins:5,settlement:1,ruined-city:2,shanty:3").split(",")) {
  const [kind, seedS] = c.split(":"); const seed = Number(seedS ?? 1);
  const ctx = { project: JSON.parse(baseJson) as Project };
  let mapId = ""; const log: string[] = [];
  if (TOWN[kind!]) {
    const r = runTool(ctx, "author_beodeul_town", { ...TOWN[kind!], seed, id: `v_${kind}` } as never);
    log.push(`town ${r.ok} ${r.summary.slice(0, 160)}`);
    if (!r.ok) { rows.push({ c, log }); console.log(c, log); continue; }
    mapId = (r.data as { mapId: string }).mapId;
    const q = runTool(ctx, "dress_village_quarter", { mapId, quarter: kind } as never);
    log.push(`quarter ${q.ok} ${q.summary.slice(0, 300)}`);
  } else {
    const sz = WASTELAND_DEFAULT_SIZE[kind as WastelandKind];
    const m = runTool(ctx, "create_map", { name: kind, tilesetId: "wasteland_ruins", width: sz.w, height: sz.h } as never);
    log.push(`create ${m.ok} ${m.summary.slice(0, 120)}`);
    mapId = (m.data as { mapId?: string; id?: string })?.mapId ?? (m.data as { id?: string })?.id ?? "";
    const q = runTool(ctx, "compose_wasteland_map", { mapId, kind, seed } as never);
    log.push(`compose ${q.ok} ${q.summary.slice(0, 300)}`);
  }
  const map = ctx.project.maps[mapId];
  if (map) fs.writeFileSync(`${OUT}/${kind}-${seed}.png`, renderMapPng(ctx.project, map).png);
  rows.push({ c, log }); console.log(c, log.join(" | "));
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
