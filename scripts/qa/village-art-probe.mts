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
  mining: { theme: "river", water: "none", terrain: "terraces", form: "scatter", roofs: "log", forestType: "conifer", houseCount: 3, width: 60, height: 48 },
  vineyard: { theme: "river", water: "none", terrain: "terraces", form: "scatter", roofs: "red", forestType: "broadleaf", houseCount: 4, width: 64, height: 48 },
  "temple-ruins": { theme: "river", water: "none", terrain: "flat", form: "scatter", roofs: "moss", forestType: "mixed", houseCount: 3, width: 60, height: 46 },
  "walled-market": { theme: "river", water: "none", form: "scatter", roofs: "red", houseCount: 4, width: 56, height: 44 },
};
// 실험: VA_TOWN='{"mining":{"form":"scatter"}}' 로 마을 인자를 덮어 시험한다.
if (process.env.VA_TOWN) for (const [k, v] of Object.entries(JSON.parse(process.env.VA_TOWN) as Record<string, Record<string, unknown>>)) TOWN[k] = { ...TOWN[k], ...v };
const rows: unknown[] = [];
for (const c of arg("cases", "mining:7,vineyard:3,temple-ruins:5,settlement:1,ruined-city:2,shanty:3").split(",")) {
  const [kind, seedS] = c.split(":"); const seed = Number(seedS ?? 1);
  const ctx = { project: JSON.parse(baseJson) as Project };
  let mapId = ""; const log: string[] = [];
  if (TOWN[kind!]) {
    const r = runTool(ctx, "author_beodeul_town", { ...TOWN[kind!], ...(kind === "walled-market" ? {} : { quarter: kind }), seed, id: `v_${kind}` } as never);
    log.push(`town ${r.ok} ${r.summary.slice(0, 160)}`);
    if (!r.ok) { rows.push({ c, log }); console.log(c, log); continue; }
    mapId = (r.data as { mapId: string }).mapId;
    const q = runTool(ctx, "dress_village_quarter", { mapId, quarter: kind } as never);
    log.push(`quarter ${q.ok} ${q.summary.slice(0, 300)}`);
  } else if (kind === "cyberpunk" || kind === "steampunk") {
    // 비교용(다른 칩셋 시대 마을) — 폐허가 이들의 복사본처럼 보이지 않는지 나란히 본다.
    const ts = kind === "cyberpunk" ? "sf_station" : "steampunk_city";
    const m = runTool(ctx, "create_map", { name: kind, tilesetId: ts, width: 48, height: kind === "cyberpunk" ? 30 : 40 } as never);
    mapId = (m.data as { mapId?: string; id?: string })?.mapId ?? (m.data as { id?: string })?.id ?? "";
    const q = kind === "cyberpunk" ? runTool(ctx, "compose_sf_station_map", { mapId, kind: "street", seed } as never) : runTool(ctx, "compose_steampunk_city_map", { mapId, style: "industrial", seed } as never);
    log.push(`compare ${q.ok} ${q.summary.slice(0, 160)}`);
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
  if (map && process.env.VA_DUMP) fs.writeFileSync(`${OUT}/${kind}-${seed}.map.json`, JSON.stringify(map));
  rows.push({ c, log }); console.log(c, log.join(" | "));
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
