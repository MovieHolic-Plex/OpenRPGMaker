// bun scripts/content/interior-authored/build.mts — rooms.mts → src/assets/interiorAuthoredRoomTemplates.json
import fs from "node:fs";
import path from "node:path";
import type { AuthoredRoom } from "./lib.mts";
import { lintReach, lintTemplate, toTemplate } from "./lib.mts";
import spec from "../../../src/assets/handInteriorSpec.json";
const out = path.resolve(import.meta.dirname, "../../../src/assets/interiorAuthoredRoomTemplates.json");
const keep = process.argv.includes("--accepted-only") ? new Set(JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "accepted.json"), "utf8")) as string[]) : undefined;
// rooms.mts + rooms-<묶음>.mts(용도 묶음마다 따로 짠 파일) 를 모두 모은다. id 는 겹치면 안 된다.
const files = fs.readdirSync(import.meta.dirname).filter((f) => /^rooms(-[a-z0-9-]+)?\.mts$/u.test(f)).sort();
const ROOMS: AuthoredRoom[] = [];
for (const f of files) ROOMS.push(...((await import(path.join(import.meta.dirname, f))) as { ROOMS: AuthoredRoom[] }).ROOMS);
const dup = ROOMS.map((r) => r.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dup.length) { console.log(`duplicate room ids: ${dup.join(", ")}`); process.exit(1); }
const templates = ROOMS.filter((r) => !keep || keep.has(r.id)).map(toTemplate);
let bad = 0;
const skipBad = process.argv.includes("--skip-bad"); // 묶음을 나눠 동시에 짤 때: 남의 파일의 미완성 견본은 빼고 굽는다(마지막 굽기는 엄격하게)
const badIds = new Set<string>();
for (const t of templates) { const e = [...lintTemplate(t, (spec as unknown as { objects: never }).objects), ...lintReach(t, (spec as unknown as { objects: never }).objects)]; if (e.length) { bad++; badIds.add(t.id); console.log(`${t.id}:\n  ${e.join("\n  ")}`); } }
if (bad && !process.argv.includes("--force") && !skipBad) { console.log(`${bad} templates with drawing overlaps — fix rooms.mts (or --force)`); process.exit(1); }
if (skipBad) templates.splice(0, templates.length, ...templates.filter((t) => !badIds.has(t.id)));
const data = { version: 1, source: "scripts/content/interior-authored/rooms*.mts — 칩셋에 있는 기물로 손으로 짠 방 견본(견본이 없거나 약한 용도)", templates: { atlas_biome_interior: templates }, programs: {} };
fs.writeFileSync(out, `{"version":1,"source":${JSON.stringify(data.source)},"templates":{"atlas_biome_interior":[\n${templates.map((t) => JSON.stringify(t)).join(",\n")}\n]},"programs":{}}\n`);
console.log(`${templates.length} templates → ${out}`);
