// 마을 숲 프로브(2026-10-22 「숲 오토타일을 제대로」) — village-diversity 8건의 author_beodeul_town 인자(+ 결과 seed)를 LLM 없이 다시 지어 1배 렌더.
//   bun scripts/qa/beodeul-village-forest-probe.mts --out /tmp/vf/after
import fs from "node:fs";
import { renderMapPng } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/vf/after");
fs.mkdirSync(OUT, { recursive: true });
const CASES: Record<string, Record<string, unknown>> = {
  fishing: { theme: "coast", form: "street", roofs: "slate", width: 64, height: 40, seed: 83232 },
  forest: { theme: "river", water: "none", form: "scatter", roofs: "moss", forestType: "mixed", woods: "dense", width: 64, height: 40, seed: 13451 },
  mountain: { theme: "river", water: "none", form: "scatter", terrain: "highland", roofs: "log", forestType: "conifer", woods: "dense", width: 64, height: 40, houseCount: 5, seed: 63745 },
  "plain-a": { theme: "river", houseCount: 4, width: 44, height: 32, seed: 65963 },
  "plain-b": { theme: "river", houseCount: 4, width: 42, height: 34, seed: 1383 },
  "river-market": { theme: "river", water: "river", form: "plaza", width: 88, height: 56, seed: 2966 },
  walled: { theme: "river", water: "none", form: "street", width: 64, height: 40, seed: 55025 },
  snow: { theme: "snow", form: "plaza", seed: 7 },
};
const only = arg("cases", "").split(",").filter(Boolean);
for (const [name, a] of Object.entries(CASES)) {
  if (only.length && !only.includes(name)) continue;
  const p = createBlankProject() as Project; ensureBundledTilesets(p);
  const ctx = { project: p };
  const r = runTool(ctx, "author_beodeul_town", { ...a, id: `v_${name}` } as never);
  if (!r.ok) { console.log(name, "FAIL", r.summary); continue; }
  const d = r.data as { mapId: string; seed: number; doors?: { reached: boolean }[] };
  const map = ctx.project.maps[d.mapId]!;
  fs.writeFileSync(`${OUT}/${name}.png`, renderMapPng(ctx.project, map).png);
  console.log(name, "ok seed", d.seed, "unreached", (d.doors ?? []).filter((x) => !x.reached).length, (r as { warnings?: string[] }).warnings?.length ?? 0, "warn");
}
