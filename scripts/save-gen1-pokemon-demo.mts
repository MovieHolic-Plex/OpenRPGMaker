/**
 * Persists the canonical Gen1 Pokemon demo to its dedicated Supabase row and
 * proves the save by loading that same project id back through the app adapter.
 */
import { loadEnv } from "vite";
import { createScarloxyPokemonDemoProject } from "../src/project/defaults.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

const PROJECT_ID = "rpg-zzu-pokemon-gen1-demo";
const env = loadEnv("development", process.cwd(), "");
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: PROJECT_ID,
};

if (!config.url || !config.anonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required");
}

const project = createScarloxyPokemonDemoProject();
const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "created" && saved.kind !== "saved") {
  throw new Error(`Supabase save failed: ${saved.kind}`);
}

const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("Supabase reload returned no project");

const typeCount = reloaded.system.typeChart?.types.length ?? 0;
const speciesCount = reloaded.database.monsterSpecies?.length ?? 0;
const finiteMoves = reloaded.database.skills.filter((skill) => (skill.maxPp ?? 0) > 0).length;
const trainerTroops = reloaded.database.troops.filter((troop) => troop.trainerBattle === true).length;
const captureBalls = reloaded.database.items.filter((item) => item.captureProfile?.ballClass).length;
const fireLabel = reloaded.database.elements?.find((element) => element.id === "fire")?.name;
const mapCount = Object.keys(reloaded.maps).length;

if (
  reloaded.system.battleModel !== "gen1"
  || reloaded.system.battleParty !== "monsters"
  || reloaded.system.activeSlots !== 1
  || typeCount !== 15
  || speciesCount < 15
  || finiteMoves === 0
  || trainerTroops === 0
  || captureBalls === 0
  || fireLabel !== "불꽃"
  || mapCount === 0
) {
  throw new Error("Reloaded Gen1 demo failed structural verification");
}

console.log(JSON.stringify({
  projectId: PROJECT_ID,
  saveKind: saved.kind,
  reloaded: true,
  title: reloaded.meta.title,
  battleModel: reloaded.system.battleModel,
  battleParty: reloaded.system.battleParty,
  activeSlots: reloaded.system.activeSlots,
  typeCount,
  speciesCount,
  finiteMoves,
  trainerTroops,
  captureBalls,
  fireLabel,
  mapCount,
}, null, 2));
