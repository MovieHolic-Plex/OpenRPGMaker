// bbox-dungeon baseline: the current v2 dungeon path (model writes spec.dungeonDesign from dungeon_parts → builder author_dungeon).
//   bun v2.mts parts <theme word>                 → JSON {parts, schema} (what the v2 verb shows the model)
//   bun v2.mts build <design.json> <theme> <out>  → <out>/map.png, <out>/v2.json  (same builder call as make_place type dungeon)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { createBuildRun } from "../../../src/ai/v2/buildRun";
import { builderFor } from "../../../src/ai/v2/builders/index";
import { dungeonParts, DUNGEON_DESIGN_SCHEMA } from "../../../src/ai/v2/dungeonParts";
import type { PlaceSpec } from "../../../src/ai/v2/types";

const [mode, a, b, c] = process.argv.slice(2);
if (mode === "parts") { console.log(JSON.stringify({ parts: dungeonParts(a!, "bbox-dungeon"), schema: DUNGEON_DESIGN_SCHEMA })); process.exit(0); }
const design = JSON.parse(readFileSync(a!, "utf8"));
const out = c!; mkdirSync(out, { recursive: true });
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as never as { project: typeof project; currentMapId: string };
const spec = { type: "dungeon", name: design.name ?? "dungeon", theme: b, variety: `bbox|${out}`, dungeonDesign: design.dungeonDesign ?? design } as PlaceSpec;
const res = builderFor(spec)!.build(createBuildRun(ctx as never), spec);
const m = res.mapIds[0] ? ctx.project.maps[res.mapIds[0]] : undefined;
const { renderReviewMapPng } = await import("../../qa-game/render.mts");
if (m) writeFileSync(resolve(out, "map.png"), renderReviewMapPng(ctx.project, m, 1).png as Buffer);
const r = { ok: res.ok && !!m, size: m ? `${m.width}x${m.height}` : "", summary: res.summary.slice(0, 400), warnings: res.warnings.slice(0, 20) };
writeFileSync(resolve(out, "v2.json"), JSON.stringify(r, null, 1));
console.log(JSON.stringify(r));
