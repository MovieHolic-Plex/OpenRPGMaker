// bun scripts/content/interior-authored/build.mts — rooms.mts → src/assets/interiorAuthoredRoomTemplates.json
import fs from "node:fs";
import path from "node:path";
import { ROOMS } from "./rooms.mts";
import { lintReach, lintTemplate, toTemplate } from "./lib.mts";
import spec from "../../../src/assets/handInteriorSpec.json";
const out = path.resolve(import.meta.dirname, "../../../src/assets/interiorAuthoredRoomTemplates.json");
const keep = process.argv.includes("--accepted-only") ? new Set(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "accepted.json"), "utf8")) as string[]) : undefined;
const templates = ROOMS.filter((r) => !keep || keep.has(r.id)).map(toTemplate);
let bad = 0;
for (const t of templates) { const e = [...lintTemplate(t, (spec as unknown as { objects: never }).objects), ...lintReach(t, (spec as unknown as { objects: never }).objects)]; if (e.length) { bad++; console.log(`${t.id}:\n  ${e.join("\n  ")}`); } }
if (bad && !process.argv.includes("--force")) { console.log(`${bad} templates with drawing overlaps — fix rooms.mts (or --force)`); process.exit(1); }
const data = { version: 1, source: "scripts/content/interior-authored/rooms.mts — 칩셋에 있는 기물로 손으로 짠 방 견본(견본이 없거나 약한 용도)", templates: { atlas_biome_interior: templates }, programs: {} };
fs.writeFileSync(out, `{"version":1,"source":${JSON.stringify(data.source)},"templates":{"atlas_biome_interior":[\n${templates.map((t) => JSON.stringify(t)).join(",\n")}\n]},"programs":{}}\n`);
console.log(`${templates.length} templates → ${out}`);
