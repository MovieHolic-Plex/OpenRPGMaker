// 조수 실증(2026-10-21): 에디터 조수(Pi 에이전트 실행기 — 채팅 창과 같은 도구·게이트)가 jp_city 맵에 숲을 잘 까는가.
// 새 SQLite 프로젝트 폴더를 만들고(「새 프로젝트」와 같은 createBlankProject + ensureBundledTilesets), 빈 jp_city 맵 한 장을 만든 뒤
// 실제 모델(기본 argonproxy/gemini-4-argon-high, 강도 medium)을 한 번 돌린다. 도구 호출을 모두 적고, 같은 저장소에 저장하고, 다시 열어 비교하고, 1배 그림을 남긴다.
//
//   bun scripts/qa/jp-forest-assistant-run.mts --label shrine --task "신사 옆 숲 …" [--model argonproxy/gemini-4-argon-high] [--effort medium]
//
// 모델 설정은 ~/.omp/agent/models.yml 에서 읽는다 — 키는 프로세스 밖으로 나가지 않고 증거에 쓰지 않는다. 증거 → verify-shots/jp-forest-assistant/<label>/.
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
import { JP_CITY_EXPOSED_TOOLS } from "../../src/ai/jpCityPolicy.ts";
import { checkJpForest } from "../../src/editor/jpCity/forestPainter.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const label = arg("label", "run")!;
const task = arg("task")!;
if (!task) throw new Error("--task 가 필요하다");
const mapId = arg("map", "jp_forest_test")!;
const [w, h] = (arg("size", "50x36")!).split("x").map(Number) as [number, number];
const [provider, modelId] = (arg("model", "argonproxy/gemini-4-argon-high")!).split("/") as [string, string];
const effort = arg("effort", "medium")!;
const maxTurns = Number(arg("max-turns", "60"));
const OUT = `verify-shots/jp-forest-assistant/${label}`;
const projectDir = path.resolve(arg("project", `/tmp/jpf/assistant-proj-${label}`)!);
fs.rmSync(projectDir, { recursive: true, force: true });
fs.mkdirSync(projectDir, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const cfg = (Bun as unknown as { YAML: { parse(s: string): any } }).YAML.parse(fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8"));
const prov = (cfg.providers ?? cfg)[provider];
if (!prov) throw new Error(`provider ${provider} not in ~/.omp/agent/models.yml`);
const md = prov.models.find((m: { id: string }) => m.id === modelId);
if (!md) throw new Error(`model ${modelId} not in provider ${provider}`);
const model = buildModel({ id: md.id, name: md.name, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: md.reasoning, thinking: md.thinking,
  input: md.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: md.contextWindow, maxTokens: md.maxTokens,
  compat: { ...prov.compat, ...md.compat } } as never);
const apiKey: string = prov.apiKey;

// ---- 새 프로젝트 → SQLite 저장 → 빈 jp_city 맵 ----
let store = await initLocalProjectStore({ projectDir });
const projectId = store.info().projectId;
store.close();
let project = createBlankProject() as Project;
ensureBundledTilesets(project);
{
  const ctx = { project };
  const r = runTool(ctx, "create_map", { id: mapId, name: "일본 숲 시험", width: w, height: h, tilesetId: "jp_city" });
  if (!r.ok) throw new Error(`create_map: ${r.summary}`);
  project = ctx.project;
}
const jp = project.tilesets.jp_city!;
const setup = {
  forestGroup: Boolean((jp.autotileGroups ?? []).find((g) => g.id === "jp-forest4-bl")?.composer),
  referenceCategories: (jp.referenceDocuments ?? []).map((c) => c.id),
  count: jp.count,
};

const intent = { mode: "create", space: "outdoor", facility: null, targetMapId: mapId, useSelection: false, clarify: null, clarifyOptions: [],
  needsPlan: true, resetsContext: false, summary: task, source: "llm", tools: [...JP_CITY_EXPOSED_TOOLS] };
const initialToolNames = buildSessionRegistryTools({ requestText: task, intent: intent as never }).map((t) => t.function.name);
fs.writeFileSync(`${OUT}/exposed-tools.json`, JSON.stringify(initialToolNames, null, 1));
const trace: { i: number; name: string; ok: boolean; summary: string; args: string }[] = [];
const log: string[] = [];
const started = Date.now();
const done = await runPiAgent(
  { provider, model: modelId, task, mapIds: [mapId], currentMapId: mapId, project, maxTurns, thinkingLevel: effort as never, initialToolNames },
  {
    model: model as never, apiKey,
    renderToolImage: async (p: Project, _n: string, data: unknown) => renderToolRegionPngBase64(p, data),
    onToolCall: (r) => { trace.push({ i: trace.length + 1, name: r.name, ok: r.result.ok, summary: String(r.result.summary ?? "").slice(0, 500), args: JSON.stringify(r.args).slice(0, 800) }); },
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

// ---- 같은 저장소에 저장 → 닫고 다시 열기 → 비교 → 1배 그림 ----
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
const mapEqual = JSON.stringify(m) === JSON.stringify(result.maps[mapId]);
const { png, note } = renderMapPng(reloaded, m);
fs.writeFileSync(`${OUT}/render-1x.png`, png);
const forest = reloaded.tilesets[m.tilesetId]?.autotileGroups?.find((g) => g.id === "jp-forest4-bl");
const floorSet = new Set(forest?.memberTileIds ?? []);
const own = new Set<number>([...(forest?.composer?.sprites ?? []).flatMap((s) => s.tiles), ...(forest?.composer?.ground?.apronTiles ?? [])].filter((t) => t >= 0));
const layer = (k: "lowerTiles" | "lowerOverlayTiles" | "upperTiles" | "upperOverlayTiles") => (m as unknown as Record<string, number[] | undefined>)[k] ?? [];
const forestFloor = layer("lowerTiles").filter((t) => floorSet.has(t)).length;
const treeCells = [layer("lowerOverlayTiles"), layer("upperTiles"), layer("upperOverlayTiles")].flat().filter((t) => own.has(t)).length;
const counts = (name: string) => trace.filter((t) => t.name === name).length;
const summary = {
  label, projectId, projectDir, mapId, size: [m.width, m.height], tilesetId: m.tilesetId, setup,
  model: `${provider}/${modelId}`, effort, task, ms, exposedTools: initialToolNames.length, paintJpForestExposed: initialToolNames.includes("paint_jp_forest"),
  reloadMapEqual: mapEqual, reloadProjectDeepEqual: isDeepStrictEqual(reloaded, JSON.parse(JSON.stringify(result))),
  reloadProjectDiffKeys: [...new Set([...Object.keys(reloaded), ...Object.keys(result)])].filter((k) => !isDeepStrictEqual((reloaded as any)[k], JSON.parse(JSON.stringify((result as any)[k] ?? null)))),
  forestCheck: checkJpForest(m, reloaded.tilesets[m.tilesetId]!), renderNote: note ?? null,
  toolCalls: trace.length, failed: trace.filter((t) => !t.ok).length,
  byTool: Object.fromEntries([...new Set(trace.map((t) => t.name))].map((n) => [n, counts(n)])),
  forestFloorCells: forestFloor, forestTreeLayerCells: treeCells,
  treeKitStamps: trace.filter((t) => t.name === "stamp_object" && t.ok && /tree|forest|rg-sugi|bamboo/.test(t.args)).length,
  finalText: log.filter((l) => l.startsWith("assistant:")).slice(-1)[0] ?? "",
};
fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n");
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
fs.writeFileSync(`${OUT}/map.json`, JSON.stringify(m));
console.log(JSON.stringify(summary, null, 1));
