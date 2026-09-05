/** Add missing concept drafts without replacing authored bundles or maps.
 * Read-only preview: npx tsx scripts/expand-concept-bundles.mts --project <id>
 * Save + reload: append --apply. An intentionally empty bundle list is never seeded.
 * --baseline <bundle-array.json> updates only drafts still equal to the reviewed old version.
 * --tileset-baseline <tileset.json> also merges reviewed furniture and tile metadata.
 * --replace-bundle <id> explicitly replaces only that bundle, including an authored version.
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { cloneConceptFacilityTemplates } from "../src/project/defaults/conceptFacilityTemplates";
import { validateTileset } from "../src/project/io/shapeResourceFields";
import { loadProjectFromSupabase } from "../src/project/supabaseProjectSync";
import type { ConceptBundleRecord, Project, TilesetDef } from "../src/project/types";

import { createBlankProject } from "../src/project/defaults";
import { INTERIOR_OBJECT_CATALOG } from "../src/editor/interiorObjectCatalog";
import { seedInteriorTilesetCatalog } from "../src/editor/interiorRoomVocab";
import { mergeReviewedInterior } from "./lib/merge-reviewed-interior.mts";

const args = process.argv.slice(2);
const replacementIndex = args.indexOf("--replace-bundle");
const replaceBundleId = replacementIndex < 0 ? undefined : args[replacementIndex + 1];
if (replacementIndex >= 0 && (!replaceBundleId || replaceBundleId.startsWith("--"))) throw new Error("Provide --replace-bundle <id> explicitly.");
const projectIndex = args.indexOf("--project");
const projectId = projectIndex < 0 ? "" : args[projectIndex + 1];
if (!projectId || projectId.startsWith("--")) throw new Error("Provide --project <id> explicitly.");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  return match ? [[match[1]!, match[2]!.replace(/^["']|["']$/g, "")]] : [];
}));
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error("Supabase URL and anon key are required.");
const config = { url, anonKey, projectId };
const tilesetId = "easyrpg_chipset_interior";
const headers = {
  apikey: anonKey, Authorization: `Bearer ${anonKey}`,
  "Accept-Profile": "rpg_zzu", "Content-Profile": "rpg_zzu", "Content-Type": "application/json",
};
async function rest(table: string, query: Record<string, string>, method = "GET", body?: unknown): Promise<any[]> {
  const response = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
    method, headers: { ...headers, Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${table} ${method}: HTTP ${response.status}`);
  return await response.json();
}
const projectQuery = { project_id: `eq.${projectId}`, select: "current_json,current_sha256,updated_at" };
const childQuery = { project_id: `eq.${projectId}`, tileset_id: `eq.${tilesetId}`, select: "tileset_json,updated_at" };
const [row] = await rest("projects", projectQuery);
if (!row?.current_json) throw new Error("Configured project does not exist.");
const original = row.current_json as Project;
const originalTileset = original.tilesets[tilesetId];
if (!originalTileset) throw new Error("Project has no supported interior tileset.");
if (originalTileset.scratchConceptBundles?.length === 0 && !replaceBundleId) throw new Error("Bundle list was intentionally emptied; use the editor to select drafts.");
const [child] = await rest("tilesets", childQuery);
if (!child?.tileset_json) throw new Error("Tileset mirror is missing; reconnect/save through the editor first.");
if (!isDeepStrictEqual(child.tileset_json, originalTileset)) throw new Error("Project and tileset mirror differ; reconcile through the editor first.");
// Validate that this is a project the application can actually reload before authoring it.
if (!await loadProjectFromSupabase(config)) throw new Error("Application project load failed.");

const existing = originalTileset.scratchConceptBundles ?? [];
const templates = cloneConceptFacilityTemplates().filter(bundle => !replaceBundleId || bundle.id === replaceBundleId);
if (!templates.length) throw new Error("Unknown replacement bundle id.");
const baselineIndex = args.indexOf("--baseline");
const baseline: ConceptBundleRecord[] = baselineIndex < 0 ? [] : JSON.parse(fs.readFileSync(args[baselineIndex + 1]!, "utf8"));
if (!Array.isArray(baseline)) throw new Error("Baseline must be a concept bundle array.");
const updated: string[] = [];
const preserved = existing.map((bundle) => {
  const previous = baseline.find((entry) => entry.id === bundle.id);
  const next = templates.find((entry) => entry.id === bundle.id);
  if (next && (bundle.id === replaceBundleId || (previous && isDeepStrictEqual(bundle, previous))) && !isDeepStrictEqual(bundle, next)) {
    updated.push(next.label);
    return next;
  }
  return bundle;
});
const occupiedIds = new Set(existing.flatMap((bundle) => [bundle.id, ...bundle.facilities.map((f) => f.id)]));
const occupiedLabels = new Set(existing.flatMap((bundle) => [bundle.label, ...bundle.facilities.map((f) => f.label)]));
const additions = templates.filter((bundle) =>
  !occupiedIds.has(bundle.id) && !occupiedLabels.has(bundle.label));
const bundles: ConceptBundleRecord[] = [...preserved, ...additions];
let tileset: TilesetDef = { ...originalTileset, scratchConceptBundles: bundles };
const tilesetBaselineIndex = args.indexOf("--tileset-baseline");
if (tilesetBaselineIndex >= 0) {
  const reviewed = JSON.parse(fs.readFileSync(args[tilesetBaselineIndex + 1]!, "utf8")) as TilesetDef;
  const defaults = createBlankProject().tilesets[tilesetId]!;
  defaults.scratchConceptBundles = bundles;
  seedInteriorTilesetCatalog(defaults, INTERIOR_OBJECT_CATALOG, []);
  tileset = mergeReviewedInterior(tileset, reviewed, defaults);
}
tileset = JSON.parse(JSON.stringify(tileset)) as TilesetDef;
const tilesetChanged = !isDeepStrictEqual(originalTileset, tileset);
validateTileset(tilesetId, tileset);
const preview = {
  projectId, tilesetId, sourceUpdatedAt: row.updated_at, added: additions.map((bundle) => bundle.label), updated,
  tilesetChanged, structureKits: tileset.structureKits?.length ?? 0,
  totalBundles: bundles.length, totalPlaces: bundles.reduce((sum, bundle) => sum + bundle.places.length, 0),
};
console.log(JSON.stringify(preview, null, 2));
if (!args.includes("--apply")) process.exit(0);

const evidenceIndex = args.indexOf("--evidence");
const out = evidenceIndex < 0 ? "output/evidence/concept-expansion" : args[evidenceIndex + 1]!;
fs.mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`${out}/${stamp}-before.json`, JSON.stringify(original));
if (tilesetChanged) {
  const next = { ...original, tilesets: { ...original.tilesets, [tilesetId]: tileset } };
  const sha = createHash("sha256").update(JSON.stringify(next)).digest("hex");
  // Compare-and-swap protects the shared project against edits since the initial read.
  const saved = await rest("projects", {
    project_id: `eq.${projectId}`, updated_at: `eq.${row.updated_at}`,
    current_sha256: row.current_sha256 === null ? "is.null" : `eq.${row.current_sha256}`,
    select: "project_id",
  }, "PATCH", { current_json: next, current_sha256: sha, updated_at: new Date().toISOString() });
  if (saved.length !== 1) throw new Error("Concurrent project edit detected; no project data was overwritten.");
  const mirrored = await rest("tilesets", {
    project_id: `eq.${projectId}`, tileset_id: `eq.${tilesetId}`,
    updated_at: `eq.${child.updated_at}`, select: "tileset_id",
  }, "PATCH", { tileset_json: tileset, updated_at: new Date().toISOString() });
  if (mirrored.length !== 1) throw new Error("Project saved, but tileset mirror changed concurrently; mirror verification is incomplete.");
}
const [reloaded] = await rest("projects", projectQuery);
const [mirror] = await rest("tilesets", childQuery);
const expected = { ...original, tilesets: { ...original.tilesets, [tilesetId]: tileset } };
if (!isDeepStrictEqual(reloaded?.current_json, expected)) throw new Error("Reload differs from the intended interior-default change.");
if (!isDeepStrictEqual(mirror?.tileset_json, tileset)) throw new Error("Tileset mirror reload differs.");
const appReload = await loadProjectFromSupabase(config);
if (!isDeepStrictEqual(appReload?.tilesets[tilesetId]?.scratchConceptBundles, bundles)) throw new Error("Application reload did not preserve the bundles.");
if (tilesetBaselineIndex >= 0 && !isDeepStrictEqual(appReload?.tilesets[tilesetId]?.structureKits, tileset.structureKits)) throw new Error("Application reload did not preserve furniture kits.");
const proof = { ...preview, saved: true, projectReload: true, tilesetMirrorReload: true, appReload: true, onlyInteriorTilesetChanged: true, verifiedAt: new Date().toISOString() };
fs.writeFileSync(`${out}/supabase-proof.json`, JSON.stringify(proof, null, 2));
console.log(JSON.stringify(proof, null, 2));
