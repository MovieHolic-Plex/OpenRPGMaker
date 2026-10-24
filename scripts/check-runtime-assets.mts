/**
 * Guard: every runtime asset the player or the web export declares must exist under public/.
 *
 * Why: the 2026-10-07 copyright purge deleted the EasyRPG chipsets, but the export still declared
 * `assets/easyrpg-chipset-combined-town-transparent.png` for every project, so every Web ZIP export
 * failed with "A declared player runtime asset is unavailable". Nothing caught it.
 *
 * Checks (no browser, no build):
 *   1. src/player/runtimeAssets.json (the player SDK inventory), and that every public file the runtime
 *      CSS references by URL is declared there (otherwise the export does not ship it)
 *   2. every bundled image catalog entry (BUNDLED_IMAGE_ASSETS: chipsets, charsets, placeable overlays)
 *   3. ids the runtime plays or draws from source tables (UI/battle sounds, retro pixel-fx) resolve to a file
 *   4. the web export asset list and release dependency list for a blank project and the fixture
 *      projects below — the same lists the editor fetches when exporting.
 *
 * Usage: npm run check:runtime-assets
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import runtimeAssetInventory from "../src/player/runtimeAssets.json" with { type: "json" };
import { BUNDLED_IMAGE_ASSETS } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/blankProject";
import { deserialize } from "@/project/io";
import { prepareWebExport } from "@/project/webExport";
import { collectReleaseDependencies } from "@/project/releaseDependencyCollector";
import type { Project } from "@/project/types";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { RETRO_PIXEL_FX_KEYS, RETRO_PIXEL_FX_SOUNDS, retroPixelFxResourceId } from "@/assets/retroPixelAnimations";
import { retroTimelineSoundIds } from "@/battle/retroSkillTimeline";
import { PLAYER_RUNTIME_AUDIO_RESOURCE_IDS } from "@/player/playerRuntimeAudioIds";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURES = ["test/fixtures/projects/editor-authored-demo-v3.json"];

const missing = new Map<string, Set<string>>();
let checked = 0;

function check(path: string, source: string): void {
  if (/^(?:https?:|data:)/i.test(path)) return;
  checked += 1;
  const local = path.replace(/^\//, "");
  if (existsSync(resolve(ROOT, "public", local))) return;
  const sources = missing.get(local) ?? new Set<string>();
  sources.add(source);
  missing.set(local, sources);
}

const inventory = new Set((runtimeAssetInventory as { paths: string[] }).paths);
for (const path of inventory) check(path, "src/player/runtimeAssets.json");

// Runtime CSS fetches public files by absolute URL; Vite leaves those out of the player bundle, so the
// export only ships them if the inventory declares them (Galmuri9.woff2 was missing: 404 in every export).
const undeclared = new Map<string, string>();
for (const file of readdirSync(resolve(ROOT, "src/styles/runtime"), { recursive: true }) as string[]) {
  if (!file.endsWith(".css")) continue;
  const css = readFileSync(resolve(ROOT, "src/styles/runtime", file), "utf8");
  for (const match of css.matchAll(/url\(\s*["']?\/(assets\/[^"')?#]+)/g)) {
    const path = match[1]!;
    check(path, `src/styles/runtime/${file}`);
    if (!inventory.has(path)) undeclared.set(path, `src/styles/runtime/${file}`);
  }
}
for (const asset of BUNDLED_IMAGE_ASSETS) check(asset.path, `BUNDLED_IMAGE_ASSETS ${asset.textureKey}`);

// Ids the runtime plays/draws from source tables (not project data) must resolve to a real file.
const unresolved: string[] = [];
const runtimeIds = [
  ...PLAYER_RUNTIME_AUDIO_RESOURCE_IDS,
  ...retroTimelineSoundIds(),
  ...Object.values(RETRO_PIXEL_FX_SOUNDS),
  ...RETRO_PIXEL_FX_KEYS.map(retroPixelFxResourceId),
];
for (const id of new Set(runtimeIds)) {
  const url = resolveAssetResourceUrl(id);
  if (!url) unresolved.push(id);
  else check(url, `runtime id ${id}`);
}

// The retro timeline also plays literal ids inline; every one must be in the list the export ships.
const timelineIds = new Set(retroTimelineSoundIds());
for (const match of readFileSync(resolve(ROOT, "src/battle/retroSkillTimeline.ts"), "utf8").matchAll(/"(easyrpg-sound-[a-z0-9-]+)"/g)) {
  if (!timelineIds.has(match[1]!)) unresolved.push(`${match[1]} (src/battle/retroSkillTimeline.ts literal not in retroTimelineSoundIds)`);
}

const retroBlank = createBlankProject();
retroBlank.system.battleUiStyle = "retro2003";
const projects: Array<[string, Project]> = [["blank project", createBlankProject()], ["blank project (retro2003 battle)", retroBlank]];
for (const fixture of FIXTURES) projects.push([fixture, deserialize(readFileSync(resolve(ROOT, fixture), "utf8"))]);

for (const [label, project] of projects) {
  const prepared = prepareWebExport(project);
  for (const asset of prepared.assets) if (asset.kind === "public") check(asset.sourcePath, `web export of ${label}`);
  for (const dependency of collectReleaseDependencies(prepared.projectJson)) {
    if (dependency.dataUrl === undefined) check(dependency.path, `release dependencies of ${label}`);
  }
  const skipped = prepared.summary.skippedRetiredResources;
  console.log(`${label}: ${prepared.assets.length} export assets, ${skipped.length} retired reference(s) skipped${skipped.length ? ` (${skipped.join(", ")})` : ""}`);
}

if (unresolved.length > 0) {
  console.error(`\nFAIL: ${unresolved.length} runtime-played id(s) resolve to no file: ${unresolved.join(", ")}`);
}
if (undeclared.size > 0) {
  console.error(`\nFAIL: ${undeclared.size} runtime CSS asset(s) not declared in src/player/runtimeAssets.json (the export would not ship them):`);
  for (const [path, source] of undeclared) console.error(`  ${path}  (${source})`);
}
if (missing.size > 0) {
  console.error(`\nFAIL: ${missing.size} declared runtime asset(s) missing under public/:`);
  for (const [path, sources] of missing) console.error(`  ${path}\n      declared by: ${[...sources].join("; ")}`);
  console.error("\nRestore the file, or drop the declaration. Deleted art belongs in src/assets/retiredAssets.ts.");
}
if (missing.size > 0 || undeclared.size > 0 || unresolved.length > 0) process.exit(1);
console.log(`OK: ${checked} declared runtime asset references, all present under public/.`);
