// Round 2 (2026-09-29): the task now forbids copying the original layout; the result is measured with scripts/content/lib/beodeul-metrics.ts
// (originality vs the canon and vs the two reference layouts, district presence, reach, defects). Evidence → verify-shots/beodeul-assistant-r2/<label>/.
// Proof run: can the in-editor assistant (Pi agent runtime, same tools and gates as the chat panel) lay down a town
// like 버들항 v6 using only what it sees through its tools? Loads a canonical SQLite project (fresh or existing),
// runs the real model once, records every tool call (args + ok + summary), saves the result back to the SAME store,
// reloads it and renders the target map with the repo renderer.
//
//   bun scripts/qa/beodeul-assistant-run.mts --project .oprn-projects/<dir> --label fresh|existing --map <id> [--new WxH]
//        [--model klb/claude-opus-5.5] [--task "..."] [--max-turns 120]
//
// The model comes from the user's local ~/.omp/agent/models.yml (the klb provider is not in the bundled catalog);
// its key never leaves the process and is not written to the evidence. Evidence → verify-shots/beodeul-assistant/<label>/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { buildSessionRegistryTools } from "../../src/ai/sessionToolExposure.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";
import { analyzeBeodeul, type Stamp } from "../content/lib/beodeul-metrics.ts";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const projectDir = path.resolve(arg("project")!);
const label = arg("label", "run")!;
const mapId = arg("map", "beodeul_like")!;
const size = arg("new");
const [provider, modelId] = (arg("model", "klb/claude-opus-5.5")!).split("/") as [string, string];
const task0 = arg("task", "버들항 비슷한 로마풍 항구 도시를 깔아줘. 맵 전체(100×100)를 채우는 큰 도시로 — 성, 귀족 저택, 포룸 광장, 항구와 잔교, 풍차, 강과 다리, 성 밖 나무집 마을이 있어야 해. 단, 원본 버들항을 그대로 복제하면 안 돼: 구역 키트를 원본 좌표(원점)에 찍지 말고, 성·저택·광장·항구의 자리와 길·강의 흐름을 원본과 다르게 새로 설계해. 참고문서의 배치 규칙과 예시 배치 두 가지를 읽고 그 규칙대로 하되, 예시 배치를 그대로 베끼지도 마.")!;
const maxTurns = Number(arg("max-turns", "150"));
// round 3: the same task "블록 키트로" (whole-block kits on a street grid) + the emptiness measure (≤40% open floor per 20×15 screen)
const round = arg("round", "r3")!;
const task = round === "r2" ? task0 : `${task0} 블록 키트로 — 길 격자(대로·거리·골목)를 먼저 깔고, 블록 키트(bd-block-*)로 블록을 통째로 채워서 빈 풀밭을 남기지 마.`;
const OUT = `verify-shots/beodeul-assistant-${round}/${label}`;
fs.mkdirSync(OUT, { recursive: true });

// ---- model from the local omp config (no key in logs/evidence) ----
const cfg = (Bun as unknown as { YAML: { parse(s: string): any } }).YAML.parse(fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8"));
const prov = (cfg.providers ?? cfg)[provider];
if (!prov) throw new Error(`provider ${provider} not in ~/.omp/agent/models.yml`);
const md = prov.models.find((m: { id: string }) => m.id === modelId);
if (!md) throw new Error(`model ${modelId} not in provider ${provider}`);
const model = buildModel({ id: md.id, name: md.name, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: md.reasoning, thinking: md.thinking,
  input: md.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: md.contextWindow, maxTokens: md.maxTokens,
  compat: { ...prov.compat, ...md.compat } } as never);
const apiKey: string = prov.apiKey;

// ---- project from the store ----
let store = await initLocalProjectStore({ projectDir });
const snap = store.loadSnapshot();
const projectId = store.info().projectId;
// an empty store (a brand-new project folder) starts from the editor's blank project, like 「새 프로젝트」
let project = (snap?.project ?? createBlankProject()) as Project;
const freshStore = !snap;
store.close();
// the editor's load path (src/project/store.ts) runs ensureBundledTilesets: an older save gains beodeul_city + its references here
const hadBeodeul = Boolean(project.tilesets.beodeul_city);
ensureBundledTilesets(project);
const loadUpgrade = { freshStore, hadBeodeulBefore: hadBeodeul, hasAfter: Boolean(project.tilesets.beodeul_city),
  references: project.tilesets.beodeul_city?.referenceDocuments?.map((c) => c.id) ?? [], existingMaps: Object.keys(project.maps).length };
if (size) {
  const [w, h] = size.split("x").map(Number);
  const ctx = { project };
  const r = runTool(ctx, "create_map", { id: mapId, name: "버들항 비슷한 도시 (조수)", width: w, height: h, tilesetId: "beodeul_city" });
  if (!r.ok) throw new Error(`create_map: ${r.summary}`);
  project = ctx.project;
}
if (!project.maps[mapId]) throw new Error(`map ${mapId} missing`);

// Tool exposure: the chat panel asks an LLM intent declarer for likely tools, then sends core + discovery + those
// (plainTurn.ts → buildSessionRegistryTools). Headless, the declaration is fixed to what a map-building request gets;
// find_tools still widens it, and a named unexposed tool still runs (resolveFallbackTool).
const intent = { mode: "create", space: "none", facility: null, targetMapId: mapId, useSelection: false, clarify: null, clarifyOptions: [],
  needsPlan: true, resetsContext: false, summary: task, source: "llm",
  tools: ["create_map", "fill_region", "paint_tiles", "paint_road", "stamp_object", "list_spatial_designs", "get_spatial_design", "show_map_region",
    "get_map_region", "check_reachability", "lay_path", "list_tileset_references", "read_tileset_reference", "tile_query", "get_tile_info", "upsert_event", "tile_erase"] };
const initialToolNames = buildSessionRegistryTools({ requestText: task, intent: intent as never }).map((t) => t.function.name);
fs.writeFileSync(`${OUT}/exposed-tools.json`, JSON.stringify(initialToolNames, null, 1));
const trace: { i: number; name: string; ok: boolean; summary: string; args: string }[] = [];
const log: string[] = [];
const started = Date.now();
const done = await runPiAgent(
  { provider, model: modelId, task, mapIds: [mapId], currentMapId: mapId, project, maxTurns, thinkingLevel: "high" as never, initialToolNames },
  {
    model: model as never, apiKey,
    renderToolImage: async (p: Project, _n: string, data: unknown) => renderToolRegionPngBase64(p, data),
    onToolCall: (r) => { trace.push({ i: trace.length + 1, name: r.name, ok: r.result.ok, summary: String(r.result.summary ?? "").slice(0, 400), args: JSON.stringify(r.args).slice(0, 600) }); },
    onEvent: (e) => {
      const line = e.type === "tool_end" ? `${e.ok ? "OK  " : "FAIL"} ${e.name} — ${String(e.summary).slice(0, 200)}`
        : e.type === "assistant" ? `assistant: ${e.text.replace(/\n/g, " ").slice(0, 400)}`
        : e.type === "error" ? `ERROR ${e.message.slice(0, 300)}` : e.type === "execution_status" ? `STATUS ${e.name} ${String(e.summary).slice(0, 200)}` : "";
      if (line) { log.push(line); console.log(`[${label}] ${line}`); }
    },
  },
);
const ms = Date.now() - started;
const result = done.project as Project;
// ---- save back to the same store, reload, render ----
store = await openLocalProjectStore({ projectDir });
let reloaded: Project;
try {
  const before = store.loadSnapshot();
  const saved = await store.saveSerialized(JSON.stringify(result), before?.sha256 ?? null);
  if (saved.kind !== "saved") throw new Error(`save: ${saved.kind}`);
  store.close();
  store = await openLocalProjectStore({ projectDir });
  reloaded = store.loadSnapshot()!.project as Project;
} finally { store.close(); }
const m = reloaded.maps[mapId]!;
const same = JSON.stringify(m) === JSON.stringify(result.maps[mapId]);
const resultJson = JSON.parse(JSON.stringify(result));
const projectEqual = isDeepStrictEqual(reloaded, resultJson);
// where a whole-project mismatch lives (the store may normalise fields on load)
const projectDiff = projectEqual ? [] : [...new Set([...Object.keys(reloaded), ...Object.keys(resultJson)])].filter((k) => !isDeepStrictEqual((reloaded as any)[k], resultJson[k]))
  .map((k) => { const a = (reloaded as any)[k], b = resultJson[k]; if (a && b && typeof a === "object" && typeof b === "object") return `${k}: ${[...new Set([...Object.keys(a), ...Object.keys(b)])].filter((j) => !isDeepStrictEqual(a[j], b[j])).slice(0, 6).join(",")}`; return k; });
const { png, note } = renderMapPng(reloaded, m);
fs.writeFileSync(`${OUT}/render.png`, png);
const counts = (name: string) => trace.filter((t) => t.name === name).length;
// ---- round 2 measurements ----
const canonMap = JSON.parse(fs.readFileSync("tiledata/beodeul-city/map.json", "utf8"));
const stamps: Stamp[] = trace.filter((t) => t.name === "stamp_object" && t.ok).map((t) => { const a = JSON.parse(t.args); return { objectId: String(a.objectId), x: Number(a.x), y: Number(a.y) }; });
const metrics = analyzeBeodeul(reloaded, mapId, stamps, { lower: canonMap.lowerTiles, upper: canonMap.upperTiles });
const vsExamples: Record<string, number> = {};
for (const ex of ["hilltop", "estuary", "blocks"]) {
  const f = `verify-shots/beodeul-layouts/${ex}/map.json`; if (!fs.existsSync(f)) continue;
  const e = JSON.parse(fs.readFileSync(f, "utf8")); let same = 0; for (let i = 0; i < m.width * m.height; i += 1) if (m.lowerTiles[i] === e.lowerTiles[i] && m.upperTiles[i] === e.upperTiles[i]) same += 1;
  vsExamples[ex] = +(same / (m.width * m.height)).toFixed(4);
}
const summary = {
  label, projectId, loadUpgrade, projectDir: path.relative(process.cwd(), projectDir), mapId, size: [m.width, m.height], tilesetId: m.tilesetId,
  model: `${provider}/${modelId}`, task, ms, exposedTools: initialToolNames.length, stats: done.stats, reloadEqual: same, reloadProjectDeepEqual: projectEqual, reloadProjectDiff: projectDiff, renderNote: note ?? null,
  toolCalls: trace.length, failed: trace.filter((t) => !t.ok).length,
  byTool: Object.fromEntries([...new Set(trace.map((t) => t.name))].map((n) => [n, counts(n)])),
  readReferences: { list: counts("list_tileset_references"), read: counts("read_tileset_reference"),
    beodeulDocs: [...new Set(trace.filter((t) => t.name === "read_tileset_reference" && t.args.includes("beodeul")).map((t) => JSON.parse(t.args).documentId ?? JSON.parse(t.args).imageId))] },
  blocksStamped: trace.filter((t) => t.name === "stamp_object" && t.ok && t.args.includes("bd-block-")).length,
  kitsStamped: trace.filter((t) => t.name === "stamp_object" && t.ok).map((t) => JSON.parse(t.args).objectId),
  metrics, vsExampleLayouts: vsExamples,
  filled: { lower: m.lowerTiles.filter((t) => t >= 0).length, upper: m.upperTiles.filter((t) => t >= 0).length, cells: m.width * m.height },
  finalText: (done as { text?: string }).text ?? log.filter((l) => l.startsWith("assistant:")).slice(-1)[0] ?? "",
};
fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n");
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
fs.writeFileSync(`${OUT}/map.json`, JSON.stringify({ id: m.id, width: m.width, height: m.height, tilesetId: m.tilesetId, lowerTiles: m.lowerTiles, upperTiles: m.upperTiles, events: m.events.length }));
console.log(JSON.stringify(summary, null, 1));
