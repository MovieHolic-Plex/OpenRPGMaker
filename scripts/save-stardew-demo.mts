import fs from "node:fs";
import path from "node:path";
import { createFarmingDemoProject } from "../src/project/defaults/defaultProject.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

const DEFAULT_PROJECT_ID = "rpg-zzu-stardew-demo";
const RESIDENT_IDS = [
  "char_mayor",
  "char_seed_merchant",
  "char_miner",
  "char_carpenter",
  "char_herbalist",
] as const;

function loadEnvFiles(filePaths: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {};
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      const key = match?.[1];
      const rawValue = match?.[2];
      if (!key || rawValue === undefined) continue;
      env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function validateStardewDemo(project: Project) {
  const crops = project.database.crops ?? [];
  const residents = project.characters ?? {};
  const events = Object.values(project.maps).flatMap((map) => map.events);
  const mine = project.maps.map_mine_1f;
  const spawns = mine?.fieldSpawns ?? [];
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((species) => species.id));
  const troops = new Map(project.database.troops.map((troop) => [troop.id, troop]));
  const enemies = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy]));

  const residentProfilesReady = RESIDENT_IDS.every((characterId) => {
    const profile = residents[characterId];
    return Boolean(
      profile?.birthday
      && profile.giftPrefs?.loved?.length
      && profile.giftPrefs?.liked?.length
      && profile.giftPrefs?.disliked?.length
      && events.some((event) => event.characterId === characterId),
    );
  });
  const spawnedEnemies = spawns.flatMap((spawn) => (troops.get(spawn.troopId)?.enemyIds ?? []).map((enemyId) => enemies.get(enemyId)));
  const monsterPipelineReady = spawnedEnemies.length > 0 && spawnedEnemies.every((enemy) => Boolean(
    enemy
    && speciesIds.has(enemy.speciesId ?? "")
    && itemIds.has(enemy.rewards.dropItemId ?? "")
    && (enemy.rewards.dropRatePercent ?? 0) > 0,
  ));

  const facts = {
    cropCount: crops.length,
    giftSystem: project.system.giftSystem === true,
    residentCount: RESIDENT_IDS.filter((characterId) => residents[characterId]).length,
    residentProfilesReady,
    mineSpawnCount: spawns.length,
    mineTroopCount: new Set(spawns.map((spawn) => spawn.troopId)).size,
    monsterPipelineReady,
    stamina: project.session.variables.var_stamina,
  };
  const ok = facts.cropCount === 8
    && facts.giftSystem
    && facts.residentCount === RESIDENT_IDS.length
    && facts.residentProfilesReady
    && facts.mineSpawnCount >= 2
    && facts.mineTroopCount >= 2
    && facts.monsterPipelineReady
    && facts.stamina === 100;
  if (!ok) throw new Error(`Stardew demo contract mismatch: ${JSON.stringify(facts)}`);
  return facts;
}

const fileEnv = loadEnvFiles([".env", ".env.local"]);
const config = {
  url: (process.env.VITE_SUPABASE_URL ?? fileEnv.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: process.env.VITE_SUPABASE_ANON_KEY ?? fileEnv.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: process.env.RPG_ZZU_STARDEW_PROJECT_ID ?? DEFAULT_PROJECT_ID,
};
if (!config.url || !config.anonKey) throw new Error("Supabase URL and anon key are required in .env or .env.local");

const project = createFarmingDemoProject();
const authoredFacts = validateStardewDemo(project);
const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "saved") throw new Error(`Supabase save failed: ${saved.kind}`);

const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error(`Supabase reload failed: ${config.projectId}`);
const reloadedFacts = validateStardewDemo(reloaded);

const evidence = {
  schemaVersion: 1,
  projectId: config.projectId,
  saveKind: saved.kind,
  sha256: saved.sha256 ?? null,
  reloaded: true,
  title: reloaded.meta.title,
  authored: authoredFacts,
  reloadedFacts,
};
const evidenceDir = path.join("output", "evidence", "stardew");
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "stardew-supabase.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify(evidence, null, 2));
