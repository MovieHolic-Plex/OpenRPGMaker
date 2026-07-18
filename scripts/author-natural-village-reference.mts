import fs from "node:fs";
import path from "node:path";
import { buildNaturalVillageReference } from "./natural-village/build.ts";
import { FINAL_MAP_ID, REFERENCE_PROJECT_ID, STAGE_MAP_IDS } from "./natural-village/blueprint.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { evaluateVillageLook } from "../src/editor/tools/villageEvaluate.ts";

class NaturalVillagePersistenceError extends Error {
  constructor(readonly code: "missing-env" | "save-failed" | "reload-failed" | "reload-mismatch", message: string) {
    super(message);
    this.name = "NaturalVillagePersistenceError";
  }
}

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    const key = match?.[1];
    const rawValue = match?.[2];
    if (!key || rawValue === undefined) continue;
    env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(".env.local");
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: REFERENCE_PROJECT_ID,
};
if (!config.url || !config.anonKey) {
  throw new NaturalVillagePersistenceError("missing-env", ".env.local에 Supabase URL과 anon key가 필요합니다.");
}

const project = buildNaturalVillageReference();
const saved = await saveProjectToSupabase(project, config);
if (saved.kind !== "saved" && saved.kind !== "created") {
  throw new NaturalVillagePersistenceError("save-failed", `Supabase 저장 실패: ${saved.kind}`);
}

const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new NaturalVillagePersistenceError("reload-failed", "Supabase 재로드 결과가 없습니다.");
const missingMaps = STAGE_MAP_IDS.filter((mapId) => reloaded.maps[mapId] === undefined);
const finalMap = reloaded.maps[FINAL_MAP_ID];
if (missingMaps.length > 0 || !finalMap || finalMap.events.length !== 12) {
  throw new NaturalVillagePersistenceError(
    "reload-mismatch",
    `재로드 불일치: missing=${missingMaps.join(",") || "none"}, villagers=${finalMap?.events.length ?? 0}`,
  );
}
const doorFronts = finalMap.layoutPlan?.regions
  .filter((region) => region.role === "house" && region.front)
  .map((region) => region.front!) ?? [];
const quality = evaluateVillageLook({ project: reloaded, mapId: FINAL_MAP_ID, doorFronts });

const evidence = {
  schemaVersion: 1,
  projectId: REFERENCE_PROJECT_ID,
  saveKind: saved.kind,
  reloaded: true,
  title: reloaded.meta.title,
  mapIds: STAGE_MAP_IDS,
  finalMapId: FINAL_MAP_ID,
  finalMapSize: { width: finalMap.width, height: finalMap.height },
  finalEventCount: finalMap.events.length,
  houseCount: finalMap.layoutPlan?.regions.filter((region) => region.role === "house").length ?? 0,
  quality: { ok: quality.ok, score: quality.score, metrics: quality.metrics },
};
const evidenceDir = path.join("output", "evidence", "natural-village");
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "reference-supabase.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify(evidence));
