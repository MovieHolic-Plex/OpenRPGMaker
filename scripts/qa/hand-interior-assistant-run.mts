// 조수 시험: 편집기 조수(Pi 에이전트 런타임, 채팅 패널과 같은 도구·관문)가 실내 요청 하나를 받아 새 SQLite 프로젝트에
// 실내를 짓는다. 칩셋은 조수가 고른다(맵을 미리 만들지 않는다). 기록: 고른 칩셋, 옛 실내 칩셋 시도·거부, 도구 호출,
// 결과 그림(편집기 렌더러), 통행 BFS(엔진 canMove), 저장 → 재로드. 첫 실행이면 노출 도구 목록·참고문서 목록도 덤프한다.
//
//   bun scripts/qa/hand-interior-assistant-run.mts --label bakery --task "빵집 실내를 만들어줘" [--model klb/claude-opus-5.5] [--max-turns 80] [--start-tileset jp_city]
//
// 모델 설정은 ~/.omp/agent/models.yml(키는 증거에 쓰지 않는다). 프로젝트 .oprn-projects/hand-interior-trial-<label>(git 밖),
// 증거 verify-shots/hand-interior-assistant/<label>/.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { runTool, toOpenAiTools } from "../../src/editor/tools/index.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { buildSessionRegistryTools } from "../../src/ai/sessionToolExposure.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import { canMove } from "../../src/project/collision.ts";
import { isRetiredInteriorTileset } from "../../src/project/retiredInteriorTilesets.ts";
import { resolvePiToolShape } from "../../src/ai/piAgent/toolAdapter.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const label = arg("label", "run")!;
const task = arg("task", "빵집 실내를 만들어줘")!;
const [provider, modelId] = (arg("model", "klb/claude-opus-5.5")!).split("/") as [string, string];
const maxTurns = Number(arg("max-turns", "80"));
const OUT = `verify-shots/hand-interior-assistant/${label}`;
const projectDir = path.resolve(`.oprn-projects/hand-interior-trial-${label}`);
fs.rmSync(projectDir, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const cfg = (Bun as unknown as { YAML: { parse(s: string): any } }).YAML.parse(fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8"));
const prov = (cfg.providers ?? cfg)[provider];
const md = prov.models.find((m: { id: string }) => m.id === modelId);
const model = buildModel({ id: md.id, name: md.name, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: md.reasoning, thinking: md.thinking,
  input: md.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: md.contextWindow, maxTokens: md.maxTokens,
  compat: { ...prov.compat, ...md.compat } } as never);

// ---- a new SQLite project (the editor's blank project, saved first) ----
let store = await initLocalProjectStore({ projectDir });
const projectId = store.info().projectId;
{ const r = await store.saveSerialized(JSON.stringify(createBlankProject()), store.loadSnapshot()?.sha256 ?? null); if (r.kind !== "saved") throw new Error(r.kind); }
let project = store.loadSnapshot()!.project as Project;
store.close();
// --start-tileset <id>: 사용자가 그 칩셋 맵을 보고 있는 상태에서 시작(예: jp_city 거리 맵을 보다가 「집 실내」 요청). 없으면 새 프로젝트 기본 맵을 본다.
const startTileset = arg("start-tileset");
let currentMapId: string | undefined;
if (startTileset) {
  const r = runTool({ project }, "create_map", { name: "보고 있는 맵", width: 24, height: 18, tilesetId: startTileset });
  if (!r.ok) throw new Error(`시작 맵 실패: ${r.summary}`);
  currentMapId = Object.keys(project.maps).find((id) => project.maps[id]!.tilesetId === startTileset);
}
const before = new Set(Object.keys(project.maps));

// ---- what the assistant can see ----
const intent = { mode: "create", space: "interior", facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [],
  needsPlan: true, resetsContext: false, summary: task, source: "llm",
  tools: ["create_map", "build_hand_interior_room", "list_hand_interior_parts", "list_tileset_references", "read_tileset_reference", "show_map_region", "get_map_region",
    "check_reachability", "list_spatial_designs", "stamp_object", "import_region_reference", "upsert_event", "tile_query", "get_tile_info"] };
const exposed = buildSessionRegistryTools({ requestText: task, intent: intent as never }).map((t) => t.function.name);
const catalog = toOpenAiTools().map((t) => t.function.name);
const OLD_TOOLS = ["place_concept", "get_concept_facility", "start_interior_room_session", "advance_interior_room_build", "run_interior_room_pipeline", "furnish_interior_space", "evaluate_interior_room", "list_interior_room_demos", "list_interior_room_sessions"];
const refs = runTool({ project }, "list_tileset_references", {});
const refTilesets = ((refs.data as { tilesets?: { tilesetId: string; categories: { id: string }[] }[] })?.tilesets ?? []);
const shared = runTool({ project }, "list_spatial_designs", { limit: 200 });
const sharedRows = ((shared.data as { shared?: { rows: { id: string; tilesetId?: string; kind: string }[]; total: number } })?.shared);
const allShared = [] as { id: string; tilesetId?: string }[];
for (let offset = 0; ; offset += 200) {
  const r = runTool({ project }, "list_spatial_designs", { limit: 200, offset });
  const page = (r.data as { shared: { rows: { id: string; tilesetId?: string }[]; nextOffset?: number } }).shared;
  allShared.push(...page.rows); if (page.nextOffset === undefined) break;
}
const visibility = {
  exposedTools: exposed, oldToolsExposed: OLD_TOOLS.filter((n) => exposed.includes(n)), oldToolsInFullCatalog: OLD_TOOLS.filter((n) => catalog.includes(n)),
  fullCatalogSize: catalog.length, handInteriorToolsInCatalog: ["build_hand_interior_room", "list_hand_interior_parts"].filter((n) => catalog.includes(n)),
  referenceTilesets: refTilesets.map((t) => ({ tilesetId: t.tilesetId, categories: t.categories.map((c) => c.id) })),
  retiredInReferenceList: refTilesets.filter((t) => isRetiredInteriorTileset(t.tilesetId, project.tilesets[t.tilesetId])).map((t) => t.tilesetId),
  interiorLikeReferenceCategories: refTilesets.flatMap((t) => t.categories.filter((c) => /interior|실내|tibo/iu.test(c.id)).map((c) => `${t.tilesetId}/${c.id}`)),
  sharedRowsTotal: allShared.length, sharedRowsWithRetiredTileset: allShared.filter((r) => isRetiredInteriorTileset(r.tilesetId)).map((r) => r.id),
  sharedRowsMentioningTibo: allShared.filter((r) => /tibo|easyrpg_chipset_interior|lpc_wooden/iu.test(`${r.id} ${r.tilesetId ?? ""}`)).map((r) => r.id),
  refsSummary: refs.summary, sharedSummary: shared.summary, sharedTotal: sharedRows?.total,
};
fs.writeFileSync(`${OUT}/visibility.json`, JSON.stringify(visibility, null, 1));
// executor-level proof: the same calls a model would make to reach an old interior chipset (on a throwaway copy)
const probeProject = structuredClone(project);
const tiboKit = Object.values(probeProject.tilesets).find((t) => t.id === "tibo_interior_expanded")?.structureKits?.[0]?.id;
const probes = [
  ["create_map", { name: "여관", width: 14, height: 10, tilesetId: "tibo_interior_expanded" }],
  ["create_map", { name: "여관", width: 14, height: 10, tilesetId: "easyrpg_chipset_interior" }],
  ["create_map", { name: "여관", width: 14, height: 10, tilesetId: "opengameart_lpc_wooden_furniture" }],
  ["list_tileset_references", { tilesetId: "tibo_interior_expanded" }],
  ["read_tileset_reference", { tilesetId: "tibo_interior_expanded", categoryId: "rpg-interiors-inn-homes-v3", documentId: "x" }],
  ["import_region_reference", { id: "reviewed:shared_authored-map_five_more_1_20260921" }],
  ["stamp_object", { objectId: `kit:tibo_interior_expanded/${tiboKit ?? "tibo-bed"}`, mapId: Object.keys(probeProject.maps)[0], x: 1, y: 1 }],
] as const;
const retiredProbe = probes.map(([name, args]) => { const r = runTool({ project: probeProject }, name, args as never); return { name, args, ok: r.ok, code: r.issues?.[0]?.code ?? null, summary: String(r.summary).slice(0, 240) }; });
// the Pi runtime's own resolver (exposure + the fallback for a named-but-unexposed tool): old interior tools do not resolve
const resolvable = Object.fromEntries(OLD_TOOLS.map((n) => [n, resolvePiToolShape({ project: probeProject } as never, n) !== undefined]));
fs.writeFileSync(`${OUT}/retired-probe.json`, JSON.stringify({ executor: retiredProbe, piResolvesOldTool: resolvable }, null, 1));

// ---- run ----
const trace: { i: number; name: string; ok: boolean; summary: string; args: string; code?: string }[] = [];
const log: string[] = [];
const started = Date.now();
const done = await runPiAgent(
  { provider, model: modelId, task, mapIds: currentMapId ? [currentMapId] : [], currentMapId: currentMapId as never, project, maxTurns, thinkingLevel: "high" as never, initialToolNames: exposed },
  {
    model: model as never, apiKey: prov.apiKey,
    renderToolImage: async (p: Project, _n: string, data: unknown) => renderToolRegionPngBase64(p, data),
    onToolCall: (r) => { trace.push({ i: trace.length + 1, name: r.name, ok: r.result.ok, summary: String(r.result.summary ?? "").slice(0, 500), args: JSON.stringify(r.args).slice(0, 4000),
      code: (r.result as { issues?: { code?: string }[] }).issues?.[0]?.code }); },
    onEvent: (e) => {
      const line = e.type === "tool_end" ? `${e.ok ? "OK  " : "FAIL"} ${e.name} — ${String(e.summary).slice(0, 240)}`
        : e.type === "assistant" ? `assistant: ${e.text.replace(/\n/g, " ").slice(0, 500)}`
        : e.type === "error" ? `ERROR ${e.message.slice(0, 300)}` : "";
      if (line) { log.push(line); console.log(`[${label}] ${line}`); }
    },
  },
);
const ms = Date.now() - started;
const result = done.project as Project;
store = await openLocalProjectStore({ projectDir });
let reloaded: Project;
try {
  const saved = await store.saveSerialized(JSON.stringify(result), store.loadSnapshot()?.sha256 ?? null);
  if (saved.kind !== "saved") throw new Error(`save: ${saved.kind}`);
  store.close();
  store = await openLocalProjectStore({ projectDir });
  reloaded = store.loadSnapshot()!.project as Project;
} finally { store.close(); }
const reloadEqual = JSON.stringify(reloaded) === JSON.stringify(JSON.parse(JSON.stringify(result)));
const newMaps = Object.values(reloaded.maps).filter((m) => !before.has(m.id));
const mapsOut = newMaps.map((m) => {
  const { png, note } = renderMapPng(reloaded, m, 2);
  fs.writeFileSync(`${OUT}/map-${m.id}.png`, png);
  // BFS from the bottom-row walkable cells with the runtime move rule
  const start: [number, number][] = [];
  for (let x = 0; x < m.width; x++) if (canMove(reloaded, m, x, m.height - 1, x, m.height - 2) || canMove(reloaded, m, x, m.height - 2, x, m.height - 1)) start.push([x, m.height - 1]);
  const seen = new Set(start.map(([x, y]) => `${x},${y}`)); const q = [...start];
  while (q.length) { const [x, y] = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx!, Y = y + dy!; if (!seen.has(`${X},${Y}`) && canMove(reloaded, m, x, y, X, Y)) { seen.add(`${X},${Y}`); q.push([X, Y]); } } }
  let walkable = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => canMove(reloaded, m, x, y, x + dx!, y + dy!))) walkable++;
  }
  return { id: m.id, name: m.name, tilesetId: m.tilesetId, family: reloaded.tilesets[m.tilesetId]?.family, size: [m.width, m.height], events: m.events.length,
    reachableFromEntrance: start.length ? seen.size : 0, walkableCells: walkable, unreachedWalkable: start.length ? walkable - seen.size : walkable, renderNote: note ?? null,
    upperFilled: m.upperTiles.filter((t) => t >= 0).length + (m.upperOverlayTiles ?? []).filter((t) => t >= 0).length };
});
const RETIRED = /easyrpg_chipset_interior|tibo_interior_expanded|opengameart_lpc_wooden_furniture|kit:tibo|tibo-/u;
const summary = {
  label, task, model: `${provider}/${modelId}`, projectId, projectDir: path.relative(process.cwd(), projectDir), ms, reloadEqual,
  chosenTilesets: [...new Set(newMaps.map((m) => m.tilesetId))], maps: mapsOut,
  retiredAttempts: trace.filter((t) => RETIRED.test(t.args)).map((t) => ({ i: t.i, name: t.name, ok: t.ok, code: t.code, summary: t.summary.slice(0, 200) })),
  retiredRejections: trace.filter((t) => !t.ok && (t.code === "retired-interior-tileset" || /폐기/u.test(t.summary))).length,
  oldToolCalls: trace.filter((t) => OLD_TOOLS.includes(t.name)).map((t) => ({ i: t.i, name: t.name, ok: t.ok, summary: t.summary.slice(0, 160) })),
  toolCalls: trace.length, failed: trace.filter((t) => !t.ok).length,
  byTool: Object.fromEntries([...new Set(trace.map((t) => t.name))].map((n) => [n, trace.filter((t) => t.name === n).length])),
  readReferences: trace.filter((t) => t.name === "read_tileset_reference").map((t) => { try { const a = JSON.parse(t.args); return `${a.tilesetId}/${a.documentId ?? a.imageId}`; } catch { return t.args.slice(0, 80); } }),
  stats: done.stats, finalText: log.filter((l) => l.startsWith("assistant:")).slice(-1)[0] ?? "",
};
fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n");
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, finalText: summary.finalText.slice(0, 300) }, null, 1));
