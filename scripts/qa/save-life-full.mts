// Task 19: prove an isolated remote save + reload for the life-full fixture.
//
//   ./node_modules/.bin/vite-node scripts/qa/save-life-full.mts --project-id <id>
//
// Isolation contract: the project id is explicit and life-full specific, so the shared
// rpg-zzu-stardew-demo row and every other project row are untouched. Credentials come
// from the environment and are NEVER printed — the receipt records only the host origin.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectFromSupabase, saveProjectToSupabase } from "@/project/supabaseProjectSync";
import type { SupabaseProjectConfig } from "@/project/supabaseProjectConfig";
import { serialize } from "@/project/io";
import { validateProjectReferences } from "@/project/io/references";
import { sha256HexText } from "@/util/sha256";
import { createLifeFullFixture } from "../../test/fixtures/life-full/lifeFullProject";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectId = arg("--project-id");
if (!projectId) throw new Error("--project-id <id> is required; refusing to write a default/shared row");
if (!projectId.startsWith("rpg-zzu-life-full-")) {
  throw new Error(`refusing id ${projectId}: task19 requires an rpg-zzu-life-full-* isolated id`);
}

// Vite injects .env.local into process.env, so `env -u` cannot simulate "unset".
// An explicit flag is the only honest way to exercise the not-configured path
// without writing anything (measured: env -u still produced a real remote write).
const simulateUnconfigured = process.argv.includes("--simulate-unconfigured");
const url = simulateUnconfigured ? undefined : process.env.VITE_SUPABASE_URL?.trim();
const anonKey = simulateUnconfigured ? undefined : process.env.VITE_SUPABASE_ANON_KEY?.trim();
const receiptPath = join(dirname(fileURLToPath(import.meta.url)), "../../.omo/evidence/life-full-20260906/19/remote-receipt.json");
mkdirSync(dirname(receiptPath), { recursive: true });

function writeReceipt(body: Record<string, unknown>): void {
  writeFileSync(receiptPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  console.log(`receipt: ${receiptPath}`);
}

// Failure receipt: unset or wrong credentials must report 0 writes and no success.
if (!url || !anonKey) {
  writeReceipt({
    task: 19, projectId, ok: false, writes: 0,
    reason: "supabase-not-configured",
    detail: "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY absent from the environment",
    at: new Date().toISOString(),
  });
  console.error("supabase not configured — wrote a failure receipt with 0 writes");
  process.exitCode = 2;
  throw new Error("supabase not configured");
}

const config: SupabaseProjectConfig = { anonKey, projectId, url };
const host = new URL(url).origin;

const project = createLifeFullFixture();
validateProjectReferences(project);
const localText = serialize(project);
const localSha = await sha256HexText(localText);

const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "saved") {
  writeReceipt({ task: 19, projectId, host, ok: false, writes: 0, reason: saved.kind, at: new Date().toISOString() });
  process.exitCode = 1;
  throw new Error(`save did not succeed: ${saved.kind}`);
}

// Reload the SAME id and compare meaning, not just bytes.
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("reload returned null for the id we just wrote");
validateProjectReferences(reloaded);

const lifeDefinitions = (p: typeof project) => ({
  craftRecipes: (p.system.craftRecipes ?? []).map((r) => r.id).sort(),
  itemUpgrades: (p.system.itemUpgrades ?? []).map((r) => r.id).sort(),
  makers: (p.system.makers ?? []).map((r) => r.id).sort(),
  bundles: (p.system.bundles ?? []).map((r) => r.id).sort(),
  worldUnlocks: (p.system.worldUnlocks ?? []).map((r) => r.id).sort(),
  lifeSkills: (p.database.lifeSkills ?? []).map((r) => r.id).sort(),
  crops: (p.database.crops ?? []).map((r) => r.id).sort(),
  shippingAllowed: (p.system.shipping?.allowedItemIds ?? []).slice().sort(),
  energy: p.system.energy,
  // The remote round-trip legitimately FILLS schema defaults (measured: timeSystem gains
  // minutesPerRealSecond and daysPerSeason). Compare only the fields this fixture pins,
  // so a real value change still fails while normalization does not.
  timeSystem: {
    enabled: p.system.timeSystem?.enabled,
    dayStartHour: p.system.timeSystem?.dayStartHour,
    dayEndHour: p.system.timeSystem?.dayEndHour,
    forceSleep: p.system.timeSystem?.forceSleep,
  },
});
const startPlacement = (p: typeof project) => ({
  startPos: p.startPos,
  startMapId: p.startMapId,
  // Key ORDER is not meaning; compare as sorted entries (measured: only order differed).
  inventory: Object.entries(p.session.inventory).sort(([a], [b]) => a.localeCompare(b)),
  placeables: Object.keys(p.session.placeables ?? {}).sort(),
});

const localDefs = JSON.stringify(lifeDefinitions(project));
const remoteDefs = JSON.stringify(lifeDefinitions(reloaded));
const localStart = JSON.stringify(startPlacement(project));
const remoteStart = JSON.stringify(startPlacement(reloaded));

const definitionsMatch = localDefs === remoteDefs;
const placementMatch = localStart === remoteStart;

writeReceipt({
  task: 19, projectId, host,
  ok: definitionsMatch && placementMatch,
  writes: 1,
  savedSha256: saved.sha256,
  localSerializedSha256: localSha,
  reloadValidated: true,
  definitionsMatch,
  placementMatch,
  ...(definitionsMatch ? {} : { localDefinitions: JSON.parse(localDefs), remoteDefinitions: JSON.parse(remoteDefs) }),
  ...(placementMatch ? {} : { localStart: JSON.parse(localStart), remoteStart: JSON.parse(remoteStart) }),
  isolation: "explicit rpg-zzu-life-full-* id; no other project row is read or written by this script",
  at: new Date().toISOString(),
});

// Task 19 acceptance: the RELOADED data must be usable as the task18 player input.
// Write it out so `qa:runtime --project <path>` runs the real scenario against remote data.
const reloadDump = arg("--write-reloaded");
if (reloadDump) {
  writeFileSync(reloadDump, `${serialize(reloaded)}\n`, "utf8");
  console.log(`reloaded-project: ${reloadDump}`);
}

if (!definitionsMatch || !placementMatch) {
  process.exitCode = 1;
  throw new Error("reloaded project diverged from the saved fixture");
}
console.log(`saved+reloaded ${projectId} sha256=${saved.sha256}`);
