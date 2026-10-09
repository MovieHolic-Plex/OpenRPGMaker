import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deserialize, serialize } from "../../src/project/io/serialize";
import { createBlankProject } from "../../src/project/defaults/blankProject";
import { createScarloxyDemoProject } from "../../src/project/defaults/defaultProject";
import { applyGenrePreset } from "../../src/project/genrePresets";
import { GENRE_PACK_IDS } from "../../src/project/genrePackId";
import { normalizeItemRecord } from "../../src/project/databaseRecordModel";
import { ensureBundledResourceProfiles } from "../../src/project/defaults/defaultAssets";
import { activeItemEffects, itemAllowsMenu, itemAllowsBattle } from "../../src/project/itemUsage";
import { CC0_ICON_ASSETS } from "../../src/assets/cc0IconAssets";
import type { Project } from "../../src/project/types";

const registered = new Set(CC0_ICON_ASSETS.map((a) => a.id));
function summarize(project: Project) {
  const items = project.database.items;
  const skills = new Set(project.database.skills.map((r) => r.id));
  const states = new Set(project.database.states.map((r) => r.id));
  const animations = new Set(project.database.battleAnimations.map((r) => r.id));
  const switches = new Set(project.switches.map((r) => r.id));
  const unresolved: string[] = [];
  for (const item of items) {
    for (const id of [item.iconResourceId, item.imageResourceId]) if (id && !registered.has(id)) unresolved.push(`${item.id}: image ${id}`);
    for (const id of [item.activateSkillId, item.learnedSkillId]) if (id && !skills.has(id)) unresolved.push(`${item.id}: skill ${id}`);
    for (const effect of item.stateEffects) if (!states.has(effect.stateId)) unresolved.push(`${item.id}: state ${effect.stateId}`);
    if (item.animationId && !animations.has(item.animationId)) unresolved.push(`${item.id}: animation ${item.animationId}`);
    if (item.switchId && !switches.has(item.switchId)) unresolved.push(`${item.id}: switch ${item.switchId}`);
  }
  const shared = items.filter((r) => r.id.startsWith("item_shared_"));
  const seeds = shared.filter((r) => r.type === "seed");
  const effectlessSeeds = seeds.filter((r) => !Object.values(activeItemEffects(r).seedParameterBonuses).some((n) => n > 0)).map((r) => r.id);
  const normalizedReload = JSON.parse(JSON.stringify(items)).map(normalizeItemRecord);
  const pictureProfiles = project.resourceProfiles.filter((p) => p.assetId && registered.has(p.assetId));
  return { items: items.length, equipment: project.database.equipment.length, uniqueIds: new Set(items.map((r) => r.id)).size,
    uniqueNames: new Set(items.map((r) => r.name)).size, shared: shared.length, unresolved,
    growthSeeds: seeds.length, effectlessSeeds,
    revivalItems: shared.filter((r) => r.onlyEffectiveOnDeadActors).length,
    misleadingBattleSettings: shared.filter((r) => r.occasionBattle && !itemAllowsBattle(r)).map((r) => r.id),
    misleadingFieldSettings: shared.filter((r) => r.occasionField && !itemAllowsMenu(r)).map((r) => r.id),
    normalizedReloadCount: normalizedReload.length,
    normalizedReloadEqual: JSON.stringify(normalizedReload) === JSON.stringify(items),
    iconProfiles: pictureProfiles.length, incorrectIconDimensions: pictureProfiles.filter((p) => p.imageWidth !== 32 || p.imageHeight !== 32).map((p) => p.assetId) };
}
const blank = createBlankProject();
const blankSummary = summarize(blank);
const serializedBlank = serialize(blank);
await mkdir("output/item-catalog", { recursive: true });
await writeFile("output/item-catalog/new-project-export.json", serializedBlank);
const reloadedBlank = deserialize(await readFile("output/item-catalog/new-project-export.json", "utf8"));
const wireRoundtrip = { bytes: Buffer.byteLength(serializedBlank), items: reloadedBlank.database.items.length, itemsEqual: JSON.stringify(reloadedBlank.database.items) === JSON.stringify(blank.database.items) };
const example = createScarloxyDemoProject();
const exampleSummary = summarize(example);
const exampleItemsEqual = JSON.stringify(example.database.items) === JSON.stringify(reloadedBlank.database.items);
const genres = Object.fromEntries(GENRE_PACK_IDS.map((id) => { applyGenrePreset(blank, id); return [id, blank.database.items.length]; }));
// Asset convergence must not restore item records removed by an author.
blank.database.items = blank.database.items.filter((r) => r.id !== "item_shared_healing_mugwort-1");
ensureBundledResourceProfiles(blank);
const manifest = JSON.parse(await readFile("assets/item-catalog/generation-manifest.json", "utf8")) as { entries: Record<string, { path: string; sha256: string }> };
const unfinishedArt: string[] = [];
for (const asset of CC0_ICON_ASSETS) {
  const entry = manifest.entries[asset.id];
  if (!entry) { unfinishedArt.push(asset.id); continue; }
  try {
    const bytes = await readFile(`public/${asset.path}`);
    if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) unfinishedArt.push(asset.id);
  } catch { unfinishedArt.push(asset.id); }
}
const deletedReload = deserialize(serialize(blank));
const report = { blank: blankSummary, example: exampleSummary, exampleItemsEqual, genres, wireRoundtrip,
  deletedItemRemainsAbsentAfterWireReload: !deletedReload.database.items.some((r) => r.id === "item_shared_healing_mugwort-1"),
  deletedItemRemainsAbsent: !blank.database.items.some((r) => r.id === "item_shared_healing_mugwort-1"),
  artwork: { total: CC0_ICON_ASSETS.length, completed: CC0_ICON_ASSETS.length - unfinishedArt.length, unfinished: unfinishedArt.length },
  artGenerationComplete: unfinishedArt.length === 0 };
await mkdir("output/item-catalog", { recursive: true });
await writeFile("output/item-catalog/default-factory-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
if (!exampleItemsEqual || !wireRoundtrip.itemsEqual || !report.deletedItemRemainsAbsentAfterWireReload || !report.deletedItemRemainsAbsent
  || Object.values(genres).some(count => count !== 1000)
  || [blankSummary, exampleSummary].some(s => s.items !== 1000 || s.uniqueIds !== 1000 || s.unresolved.length || s.effectlessSeeds.length
    || s.misleadingBattleSettings.length || s.misleadingFieldSettings.length || s.incorrectIconDimensions.length || !s.normalizedReloadEqual)) process.exitCode = 1;
