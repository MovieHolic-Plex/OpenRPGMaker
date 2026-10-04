// Real Pi assistant, real configured model, isolated SQLite store. No scripted responses.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { openLocalProjectStore } from "../../electron/local-store/store.ts";
import { buildSessionRegistryTools } from "../../src/ai/sessionToolExposure.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import type { Project } from "../../src/project/types.ts";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1]!;
};
const folder = path.resolve(arg("project", ".vite-cache/terrain-ai/baseline-project"));
const out = path.resolve(arg("out", "verify-shots/terrain-assistant-live/baseline"));
const mapId = arg("map", "terrain_ai");
const [provider, modelId] = arg("model", "klb/claude-opus-5.5").split("/");
const task = fs.readFileSync(arg("task", ".vite-cache/terrain-ai/task.txt"), "utf8");
fs.mkdirSync(out, { recursive: true });
const cfg = Bun.YAML.parse(fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8")) as any;
const prov = (cfg.providers ?? cfg)[provider!];
const md = prov?.models.find((m: any) => m.id === modelId);
if (!md || !prov.apiKey) throw new Error("Configured model or credential missing");
const model = buildModel({ ...md, provider, api: prov.api, baseUrl: prov.baseUrl,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: { ...prov.compat, ...md.compat } } as never);
let store = await openLocalProjectStore({ projectDir: folder });
const project = store.loadSnapshot()!.project as Project;
const projectId = store.info().projectId;
store.close();
const intent = { mode: "create", space: "none", facility: null, targetMapId: mapId, useSelection: false,
  clarify: null, clarifyOptions: [], needsPlan: true, resetsContext: false, summary: task, source: "llm",
  tools: ["fill_region", "paint_tiles", "paint_road", "stamp_object", "show_map_region", "get_map_region",
    "check_reachability", "list_tileset_references", "read_tileset_reference", "tile_query", "get_tile_info"] };
// Same exposure/discovery and execution core as the editor. This CLI does not exercise the UI intent request.
const initialToolNames = buildSessionRegistryTools({ requestText: task, intent: intent as never, contextWindow: model.contextWindow })
  .map(t => t.function.name);
const trace: unknown[] = [], events: unknown[] = [];
const started = Date.now();
const record = () => {
  fs.writeFileSync(path.join(out, "trace.json"), JSON.stringify(trace, null, 2));
  fs.writeFileSync(path.join(out, "events.json"), JSON.stringify(events, null, 2));
};
fs.writeFileSync(path.join(out, "task.txt"), task);
fs.writeFileSync(path.join(out, "exposed-tools.json"), JSON.stringify(initialToolNames, null, 2));
const done = await runPiAgent({ provider: provider!, model: modelId!, task, mapIds: [mapId], currentMapId: mapId,
  project, maxTurns: Number(arg("max-turns", "65")), thinkingLevel: "high" as never, initialToolNames }, {
  apiKey: prov.apiKey, model: model as never, timeoutMs: Number(arg("timeout-ms", "720000")),
  renderToolImage: async (p, _name, data) => renderToolRegionPngBase64(p, data),
  onToolCall: r => { trace.push({ name: r.name, args: r.args, ok: r.result.ok, summary: r.result.summary, data: r.result.data }); record(); },
  onCheckpoint: async checkpoint => {
    fs.writeFileSync(path.join(out, "checkpoint.json"), JSON.stringify(checkpoint));
  },
  onEvent: e => {
    // Never archive provider prompt payloads or private reasoning.
    if (["assistant", "tool_start", "tool_end", "error", "execution_status"].includes(e.type)) { events.push(e); record(); }
    if (e.type === "tool_end") console.log(`${e.ok ? "OK" : "FAIL"} ${e.name}: ${String(e.summary).slice(0, 220)}`);
    else if (e.type === "assistant") console.log(`assistant: ${e.text.replace(/\n/g, " ").slice(0, 700)}`);
    else if (e.type === "error") console.log(`ERROR: ${e.message.slice(0, 500)}`);
  },
});
store = await openLocalProjectStore({ projectDir: folder });
try {
  const saved = await store.saveSerialized(JSON.stringify(done.project), store.loadSnapshot()!.sha256);
  if (saved.kind !== "saved") throw new Error(`SQLite save: ${saved.kind}`);
} finally { store.close(); }
store = await openLocalProjectStore({ projectDir: folder });
const reloaded = store.loadSnapshot()!;
store.close();
const map = reloaded.project.maps[mapId]!;
const same = JSON.stringify(map) === JSON.stringify(done.project.maps[mapId]);
const counts = Object.fromEntries([...new Set(trace.map((t: any) => t.name))].map(name => [name, trace.filter((t: any) => t.name === name).length]));
const summary = { realModel: true, provider, modelId, uiIntentRequestExercised: false, folder, projectId, mapId,
  elapsedSeconds: (Date.now() - started) / 1000, reloadMapEqual: same, revision: reloaded.revision, counts,
  maxHeight: Math.max(0, ...(map.relief?.levels ?? [])), rampCells: map.relief?.ramps?.filter(n => n >= 1 && n <= 4).length ?? 0,
  stairs: map.relief?.ramps?.filter(n => n >= 5 && n <= 8).length ?? 0, placements: map.structurePlacements?.map(p => ({id:p.id,kitId:p.kitId,x:p.x,y:p.y,w:p.w,h:p.h})), stats: done.stats };
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, "project.json"), JSON.stringify(reloaded.project));
// Engine relief strips and tile lift are included when the map has terrain height.
fs.writeFileSync(path.join(out, "tiles.png"), renderMapPng(reloaded.project, map).png);
console.log(JSON.stringify(summary, null, 2));
if (!same) process.exitCode = 1;
