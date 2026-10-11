// author_beodeul_town 마을 형태(form) 프로브 — LLM 없이 theme × form × seed 로 짓고 렌더·통계를 남긴다.
//   bun scripts/qa/beodeul-village-forms-probe.mts [--out output/evidence/village-forms] [--seeds 3,7,11] [--themes river,coast] [--forms riverbank] [--size 88x56]
// 결과: <out>/<theme>-<form>-<seed>.png, <out>/report.json(문 앞 도달·막다른 칸·울타리·경고)
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { analyzeCityForm } from "../../src/editor/tools/cityForm.ts";
import { BEODEUL_VILLAGE_THEMES, allowedVillageForms, type BeodeulVillageTheme } from "../../src/editor/tools/beodeulVillage.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "output/evidence/village-forms");
const seeds = arg("seeds", "3,7,11").split(",").map(Number);
const themes = arg("themes", BEODEUL_VILLAGE_THEMES.join(",")).split(",") as BeodeulVillageTheme[];
const forms = arg("forms", "").split(",").filter(Boolean);
const size = arg("size", ""); // 예: 88x56 (생략 = theme 기본 크기)
const [sw, sh] = size ? size.split("x").map(Number) : [];
fs.mkdirSync(OUT, { recursive: true });
const base = createBlankProject() as Project; ensureBundledTilesets(base);
const baseJson = JSON.stringify(base);
const rows: Record<string, unknown>[] = [];
for (const theme of themes) for (const form of allowedVillageForms(theme)) {
  if (forms.length && !forms.includes(form)) continue;
  for (const seed of seeds) {
    const ctx = { project: JSON.parse(baseJson) as Project };
    const t0 = Date.now();
    const r = runTool(ctx, "author_beodeul_town", { theme, form, seed, id: `v_${theme}_${form}_${seed}`, ...(sw ? { width: sw, height: sh } : {}) } as never);
    const name = `${theme}-${form}-${seed}${size ? `-${size}` : ""}`;
    if (!r.ok) { rows.push({ name, ok: false, summary: r.summary }); console.log(name, "FAIL", r.summary); continue; }
    const d = r.data as any; const map = ctx.project.maps[d.mapId]!;
    fs.writeFileSync(`${OUT}/${name}.png`, renderMapPng(ctx.project, map).png);
    const cf = analyzeCityForm(ctx.project, map);
    const doors = d.doors as { reached: boolean }[];
    const row = { name, ok: true, ms: Date.now() - t0, form: d.form, gathering: d.gathering, houses: d.houses, distinct: d.distinctHouses,
      doors: doors.length, unreached: doors.filter((x) => !x.reached).length, deadCells: cf.deadEnds.filter((x) => x.kind === "cell").length,
      deadStreets: cf.deadEnds.filter((x) => x.kind === "street").length,
      longStraight: cf.lines.longStraight.map((l) => `${l.orient}${l.len}@${l.from.join(",")}`), isolated: cf.graph.isolated.length, fields: d.fields, fenceCells: d.fenceCells, trees: d.trees,
      stampFailed: d.stampFailed, warnings: ((r as any).diff?.warnings ?? r.warnings ?? []), summary: r.summary };
    rows.push(row);
    console.log(name, JSON.stringify({ ms: row.ms, houses: row.houses, unreached: row.unreached, dead: row.deadCells, deadSt: row.deadStreets, long: row.longStraight, iso: row.isolated, fence: row.fenceCells, fail: row.stampFailed, relief: d.relief ? `${d.relief.edge}${d.relief.cells}/${d.relief.high}${d.relief.stairs ? "+계단" : ""}` : 0, warn: (((r as any).diff?.warnings ?? r.warnings ?? [])).length }));
  }
}
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(rows, null, 1));
