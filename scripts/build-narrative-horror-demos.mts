/**
 * Build three 10-min narrative/horror vertical slices and save to Supabase.
 * Project id: rpg-zzu-narrative-horror-demos
 */
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../src/project/defaults.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import type { ToolContext } from "../src/editor/tools/types.ts";
import {
  loadProjectFromSupabase,
  saveProjectToSupabase,
} from "../src/project/supabaseProjectSync.ts";
import type { Project } from "../src/project/types.ts";

const PROJECT_ID = "rpg-zzu-narrative-horror-demos";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
  return env;
}

function assertTool(result: { ok: boolean; summary: string }, label: string): void {
  if (!result.ok) {
    console.error(`[fail] ${label}`, result.summary);
    process.exit(1);
  }
  console.log(`[ok] ${label}: ${result.summary}`);
}

const env = loadEnv();
const config = {
  url: (env.VITE_SUPABASE_URL ?? "").replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
  projectId: PROJECT_ID,
};
if (!config.url || !config.anonKey) {
  console.error(".env.local needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  process.exit(2);
}

const project: Project = createBlankProject();
project.meta.title = "연출·호러 10분 데모 (Moon / Witch / Ib)";
project.meta.description =
  "script_cutscene_preset · make_horror_loop · make_gallery_room vertical slices";

const ctx: ToolContext = { project };
const startMapId = project.startMapId;

// --- Map A: Moon cutscene on start map ---
assertTool(
  runTool(ctx, "script_cutscene_preset", {
    mapId: startMapId,
    preset: "memory_opening",
    eventId: "ev_demo_memory",
    x: 2,
    y: 2,
    lines: ["그날 밤을 기억한다.", "창밖의 달빛만이 남아 있었다."],
  }),
  "moon memory",
);
assertTool(
  runTool(ctx, "script_cutscene_preset", {
    mapId: startMapId,
    preset: "ending_fade",
    eventId: "ev_demo_ending",
    x: 5,
    y: 2,
    endingId: "ending_demo_moon",
    endingName: "달빛 엔딩",
    lines: ["문을 닫는다.", "그래도 기억은 남는다."],
  }),
  "moon ending",
);

// --- Map B: Witch horror ---
assertTool(
  runTool(ctx, "create_map", {
    name: "호러 저택 복도",
    width: 24,
    height: 16,
    id: "map_demo_witch",
  }),
  "witch map",
);
assertTool(
  runTool(ctx, "make_horror_loop", {
    mapId: "map_demo_witch",
    origin: { x: 4, y: 6 },
    trapCount: 4,
    includeChase: true,
    chaserAt: { x: 14, y: 6 },
    safeZone: { x: 1, y: 1, w: 3, h: 3 },
    mood: true,
  }),
  "witch loop",
);

// --- Map C: Ib gallery ---
assertTool(
  runTool(ctx, "create_map", {
    name: "갤러리 전시실",
    width: 20,
    height: 16,
    id: "map_demo_ib",
  }),
  "ib map",
);
const itemId = project.database.items[0]?.id;
if (!itemId) {
  console.error("no item for gallery gate");
  process.exit(1);
}
assertTool(
  runTool(ctx, "make_gallery_room", {
    mapId: "map_demo_ib",
    origin: { x: 2, y: 3 },
    hotspotCount: 8,
    puzzleKind: "item-gate",
    requiredItemId: itemId,
    solveSwitchId: "sw_demo_gallery_open",
    includeMood: true,
  }),
  "ib gallery",
);

// Transfers from start to demos
assertTool(
  runTool(ctx, "create_transfer_pair", {
    a: { mapId: startMapId, x: 8, y: 4 },
    b: { mapId: "map_demo_witch", x: 2, y: 8 },
  }),
  "transfer witch",
);
assertTool(
  runTool(ctx, "create_transfer_pair", {
    a: { mapId: startMapId, x: 10, y: 4 },
    b: { mapId: "map_demo_ib", x: 2, y: 8 },
  }),
  "transfer ib",
);

const saved = await saveProjectToSupabase(ctx.project, config);
console.log("[saved]", saved.kind, "projectId=", PROJECT_ID);
if (saved.kind !== "saved" && saved.kind !== "created") {
  console.error(saved);
  process.exit(1);
}

const verify = await loadProjectFromSupabase(config);
if (!verify) {
  console.error("reload failed");
  process.exit(1);
}
const mapIds = Object.keys(verify.maps);
console.log("[reload]", verify.meta?.title, "maps=", mapIds.join(","));
const need = [startMapId, "map_demo_witch", "map_demo_ib"];
for (const id of need) {
  if (!verify.maps[id]) {
    console.error("missing map after reload", id);
    process.exit(1);
  }
}
const witchEvents = verify.maps.map_demo_witch!.events.length;
const ibEvents = verify.maps.map_demo_ib!.events.length;
const startEvents = verify.maps[startMapId]!.events.length;
console.log("[counts] start events", startEvents, "witch", witchEvents, "ib", ibEvents);

const report = {
  schemaVersion: 1,
  kind: "api-package-test-report",
  projectId: PROJECT_ID,
  saveKind: saved.kind,
  title: verify.meta?.title,
  maps: need,
  eventCounts: { start: startEvents, witch: witchEvents, ib: ibEvents },
  endings: (verify.endings ?? []).map((e) => e.id),
  reloaded: true,
};
fs.mkdirSync("artifacts", { recursive: true });
fs.writeFileSync(
  path.join("artifacts", "narrative-horror-supabase-demo-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log("[report] artifacts/narrative-horror-supabase-demo-report.json");
console.log("DONE");
