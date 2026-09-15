import fs from "node:fs";
import path from "node:path";
import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { ToolContext } from "../src/editor/tools/types.ts";
import { evaluateVillageLook } from "../src/editor/tools/villageEvaluate.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";

const PROJECT_ID = "rpg-zzu-natural-village-harness-v2";
const SEED = 20_260_716;

class HarnessPersistenceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "HarnessPersistenceError";
  }
}

function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match?.[1] || match[2] === undefined) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(".env.local");
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: PROJECT_ID,
};
if (!config.url || !config.anonKey) {
  throw new HarnessPersistenceError("missing-env", ".env.local에 Supabase URL과 anon key가 필요합니다.");
}

const context: ToolContext = { project: createEmptyToolProject("자연 마을 하네스 v2") };
const built = runTool(context, "build_village", {
  seed: SEED,
  width: 64,
  height: 56,
  name: "하네스 생성 — 숲 가장자리 생활 장터 마을",
  theme: "숲 가장자리 생활 장터 마을",
  pathStyle: "dirt",
  kitMix: "mixed",
  yardStyle: "mixed",
  plazaStyle: "market",
  edgeTrees: "dense",
  plazaLayout: "center",
  settlementLayout: "clusters",
  roadWidth: 2,
  roadNaturalness: 0.85,
  houses: 10,
  fences: true,
  decor: true,
  interior: false,
  windows: { spacing: 2 },
});
if (!built.ok) throw new HarnessPersistenceError("build-failed", built.summary);

const data = built.data as {
  mapId: string;
  housesBuilt: number;
  npcCount: number;
  houses: readonly { front: { x: number; y: number } }[];
};
const map = context.project.maps[data.mapId];
if (!map || data.housesBuilt !== 10 || data.npcCount !== 12) {
  throw new HarnessPersistenceError("build-mismatch", `map=${Boolean(map)} houses=${data.housesBuilt} npcs=${data.npcCount}`);
}
context.project.meta.title = "자연 마을 하네스 v2 — 직접 저작 문법 재현";
context.project.meta.author = "OPRN village harness";
context.project.system = {
  ...context.project.system,
  timeSystem: { enabled: true, minutesPerRealSecond: 2, dayStartHour: 6, dayEndHour: 24, daysPerSeason: 28 },
};
context.project.villageInfoDocuments = [{
  id: "village_info_harness_v2",
  mapId: data.mapId,
  title: "직접 저작 참조본에서 배운 생성 규칙",
  markdown: [
    "# 자연 마을 하네스 v2",
    "",
    "집 형태와 키트를 중복 전에 순환하고, 다층 창 사이에 빈 벽 행을 둔다.",
    "중앙 녹지를 두른 길 고리에서 네 맵 경계까지 굽은 출구를 연결한다.",
    "침엽수와 2×2 활엽수, 마당과 장터 생활 소품을 섞는다.",
    "모든 주민은 아침·낮·저녁 장소와 활동을 가지며 고정/배회 이동을 혼합한다.",
  ].join("\n"),
}];

const localEvaluation = evaluateVillageLook({
  project: context.project,
  mapId: data.mapId,
  doorFronts: data.houses.map((house) => house.front),
});
if (!localEvaluation.ok) {
  throw new HarnessPersistenceError("quality-gate", localEvaluation.feedbackForLlm);
}

const saved = await saveProjectToSupabase(context.project, config);
if (saved.kind !== "saved" && saved.kind !== "created") {
  throw new HarnessPersistenceError("save-failed", `Supabase 저장 실패: ${saved.kind}`);
}
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new HarnessPersistenceError("reload-failed", "Supabase 재로드 결과가 없습니다.");
const reloadedMap = reloaded.maps[data.mapId];
if (!reloadedMap) throw new HarnessPersistenceError("reload-mismatch", `재로드 후 ${data.mapId}가 없습니다.`);
const reloadedEvaluation = evaluateVillageLook({
  project: reloaded,
  mapId: data.mapId,
  doorFronts: data.houses.map((house) => house.front),
});
if (!reloadedEvaluation.ok || reloadedMap.events.filter((event) => (event.schedule?.length ?? 0) >= 3).length !== 12) {
  throw new HarnessPersistenceError("reload-quality", reloadedEvaluation.feedbackForLlm);
}

const evidence = {
  schemaVersion: 1,
  projectId: PROJECT_ID,
  saveKind: saved.kind,
  reloaded: true,
  mapId: data.mapId,
  mapSize: { width: reloadedMap.width, height: reloadedMap.height },
  housesBuilt: data.housesBuilt,
  npcCount: data.npcCount,
  scheduledNpcs: reloadedEvaluation.metrics.scheduledNpcs,
  qualityGate: { ok: reloadedEvaluation.ok, score: reloadedEvaluation.score, metrics: reloadedEvaluation.metrics },
};
const evidenceDir = path.join("output", "evidence", "natural-village");
fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "harness-supabase.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify(evidence));
