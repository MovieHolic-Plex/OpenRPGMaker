// 평문 「마을 만들어 줘」 헤드리스 시험 — 조수 패널과 같은 classifyPlainPiTurn(실제 LLM 의도 선언) → composePiTask → buildPiRunRequest → runPiAgent 경로를
// /tmp 프로젝트 폴더(정본 SQLite 저장소 API)에 돌린다. 모델은 ~/.omp/agent/models.yml(klb). 키는 증거에 쓰지 않는다.
//
//   bun scripts/qa/beodeul-village-plain.mts --label fresh|combined --project /tmp/<dir> [--text "마을 만들어 줘"] [--combined] [--model klb/claude-opus-5.5] [--round r1]
//     --combined  새 프로젝트 대신 기존 combined_town 마을이 있는 프로젝트(보는 맵이 combined_town)에서 시작한다(계열 규칙 시험).
// 증거 → verify-shots/assistant-beodeul-village/<round>/<label>/ (summary.json, trace.json, log.txt, classification.json, render.png)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { runTool } from "../../src/editor/tools/index.ts";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store.ts";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../src/project/defaults.ts";
import type { Project } from "../../src/project/types.ts";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "../../src/ai/llmClient.ts";
import { createLlmIntentDeclarer } from "../../src/ai/intentDeclarationClient.ts";
import { resolveAutonomy } from "../../src/ai/autonomyLevels.ts";
import { classifyPlainPiTurn, buildPiRunRequest } from "../../src/ai/piAgent/plainTurn.ts";
import { composePiTask, DEFAULT_PI_TEAM } from "../../src/ai/piAgent/executionRoute.ts";
import { normalizePiApplyMode } from "../../src/ai/piAgent/applyMode.ts";
import { configForUltrabrain } from "../../src/ai/ultrabrainConfig.ts";
import { modelForRole } from "../../src/ai/modelRoles.ts";
import { plainPiCommand } from "../../src/editor/panels/aiPiAgentCommand.ts";
import { analyzeBeodeul, type Stamp } from "../content/lib/beodeul-metrics.ts";

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const label = arg("label", "fresh")!;
const projectDir = path.resolve(arg("project", `/tmp/oprn-village-${label}`)!);
const text = arg("text", "마을 만들어 줘")!;
const combined = process.argv.includes("--combined");
const round = arg("round", "r1")!;
const [provider, modelId] = (arg("model", "opencodex/gpt-6-astra")!).split("/") as [string, string];
const OUT = `verify-shots/assistant-beodeul-village/${round}/${label}`;
fs.mkdirSync(OUT, { recursive: true });

const cfgYaml = (Bun as unknown as { YAML: { parse(s: string): any } }).YAML.parse(fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8"));
const prov = (cfgYaml.providers ?? cfgYaml)[provider];
const md = prov.models.find((m: { id: string }) => m.id === modelId);
const model = buildModel({ id: md.id, name: md.name, api: prov.api, provider, baseUrl: prov.baseUrl, reasoning: md.reasoning, thinking: md.thinking,
  input: md.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: md.contextWindow, maxTokens: md.maxTokens,
  compat: { ...prov.compat, ...md.compat } } as never);
const apiKey: string = prov.apiKey;

/** 의도 선언용 채팅 — 같은 OpenAI 호환 엔드포인트로 직접 보낸다(브라우저는 동반 서비스가 같은 몸통을 워커로 넘긴다). */
async function chat(_config: AiConfig, req: ChatRequest): Promise<ChatResult> {
  const body: Record<string, unknown> = { model: modelId, messages: req.messages, stream: false, max_tokens: 4096 };
  if (req.tools?.length) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
  // response_format 은 일부 프록시(opencodex)가 "json" 낱말 검사로 거절한다 — 의도 선언은 프롬프트로 JSON 을 요구하므로 뺀다.
  if (req.response_format && provider !== "opencodex") body.response_format = req.response_format;
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  let res = await fetch(`${prov.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), ...(req.signal ? { signal: req.signal } : {}) });
  for (let i = 0; i < 3 && res.status >= 500; i++) { await new Promise((r) => setTimeout(r, 5000 * (i + 1))); res = await fetch(`${prov.baseUrl}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body), ...(req.signal ? { signal: req.signal } : {}) }); }
  if (!res.ok) throw new Error(`intent chat ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json() as { choices: { message: ChatResult["message"]; finish_reason: string | null }[]; usage?: ChatResult["usage"] };
  const c = json.choices[0]!;
  return { message: c.message, finishReason: c.finish_reason, ...(json.usage ? { usage: json.usage } : {}) };
}

// ---- 프로젝트: 새 프로젝트(빈 버들항 맵) 또는 기존 combined_town 마을 ----
let store = await initLocalProjectStore({ projectDir });
const snap = store.loadSnapshot();
let project = (snap?.project ?? createBlankProject()) as Project;
store.close();
ensureBundledTilesets(project);
let currentMapId = project.startMapId;
if (combined && !Object.values(project.maps).some((m) => m.tilesetId === "easyrpg_chipset_combined_town")) {
  const ctx = { project };
  const c = runTool(ctx, "create_map", { id: "old_town", name: "옛 마을", width: 90, height: 50, tilesetId: "easyrpg_chipset_combined_town" });
  if (!c.ok) throw new Error(`create_map: ${c.summary}`);
  const v = runTool(ctx, "author_village", { target: { kind: "existing", mapId: "old_town" }, houseCount: 4, countPolicy: "exact", seed: 3 } as never);
  fs.writeFileSync(`${OUT}/setup.txt`, `create_map: ${c.summary}\nauthor_village: ${v.ok} ${String(v.summary).slice(0, 300)}\n`);
  project = ctx.project;
  currentMapId = "old_town";
}
const before = { maps: Object.fromEntries(Object.values(project.maps).map((m) => [m.id, m.tilesetId])), currentMapId };

const config: AiConfig = { ...defaultAiConfig(), providerId: provider, model: modelId, liteModel: modelId, ultrabrainProviderId: provider, ultrabrainModel: modelId, autonomyLevel: "balanced", piApply: "auto" } as AiConfig;
const autonomy = resolveAutonomy("balanced");
const classified = await classifyPlainPiTurn({
  project, text, currentMapId, selection: null, hasActivePlan: false, autonomy,
  declarer: () => createLlmIntentDeclarer({ chat, audit: chat, getConfig: () => config, timeoutMs: 60_000, coverageAudit: false }),
  piTeam: config.piTeam ?? DEFAULT_PI_TEAM,
});
const command = plainPiCommand(text, classified.mode, currentMapId);
const plan = classified.plan;
const applyMode = normalizePiApplyMode(config.piApply);
const brain = configForUltrabrain(config);
const readOnly = plan.readOnly || plan.planOnly;
const here = currentMapId && project.maps[currentMapId] ? { currentMapId } : {};
const modelTask = composePiTask(command.task, classified.intentNote);
fs.writeFileSync(`${OUT}/classification.json`, JSON.stringify({ intent: (classified as any).intent, plan, initialToolNames: classified.initialToolNames, intentNote: classified.intentNote, before }, null, 2));
const request = buildPiRunRequest({
  team: false, planOnly: plan.planOnly, readOnly, applyMode, villageContract: plan.villageContract,
  brain, deep: modelForRole(config, "deep"), writer: modelForRole(config, "writer"), modelTask, executionTask: modelTask,
  mapIds: command.mapIds, ...here, project, scopedByUser: false, mapBundleMerge: false, maxTurns: Number(arg("max-turns", String(Math.max(plan.maxTurns ?? 0, 100)))),
  ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
});
const trace: { i: number; name: string; ok: boolean; summary: string; args: string }[] = [];
const log: string[] = [];
const started = Date.now();
const done = await runPiAgent(request, {
  model: model as never, apiKey, ...(readOnly ? { readOnlyTools: true } : {}),
  renderToolImage: async (p: Project, _n: string, data: unknown) => renderToolRegionPngBase64(p, data),
  onToolCall: (r) => { trace.push({ i: trace.length + 1, name: r.name, ok: r.result.ok, summary: String(r.result.summary ?? "").slice(0, 400), args: JSON.stringify(r.args).slice(0, 600) }); fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1)); },
  onEvent: (e) => {
    const line = e.type === "tool_end" ? `${e.ok ? "OK  " : "FAIL"} ${e.name} — ${String(e.summary).slice(0, 200)}`
      : e.type === "assistant" ? `assistant: ${e.text.replace(/\n/g, " ").slice(0, 400)}` : e.type === "error" ? `ERROR ${e.message.slice(0, 300)}` : "";
    if (line) { log.push(line); fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n"); console.log(`[${label}] ${line}`); }
  },
});
const ms = Date.now() - started;
const result = done.project as Project;
// Keep the actual model-authored draft if canonical schema validation rejects a save.
fs.writeFileSync(`${OUT}/draft-project.json`,JSON.stringify(result));
// 저장 → 다시 읽기(같은 저장소)
store = await openLocalProjectStore({ projectDir });
let reloaded: Project;
try {
  const b = store.loadSnapshot();
  const saved = await store.saveSerialized(JSON.stringify(result), b?.sha256 ?? null);
  if (saved.kind !== "saved") throw new Error(`save: ${saved.kind}`);
  store.close();
  store = await openLocalProjectStore({ projectDir });
  reloaded = store.loadSnapshot()!.project as Project;
} finally { store.close(); }
const newMaps = Object.values(reloaded.maps).filter((m) => !(m.id in before.maps) || JSON.stringify(m) !== JSON.stringify(project.maps[m.id]));
const target = newMaps.find((m) => trace.some((t) => t.name === "author_beodeul_town" && t.ok && t.args.includes(m.id))) ?? newMaps[0] ?? reloaded.maps[currentMapId];
const { png } = renderMapPng(reloaded, target);
fs.writeFileSync(`${OUT}/render.png`, png);
const canon = JSON.parse(fs.readFileSync("tiledata/beodeul-city/map.json", "utf8"));
const stamps: Stamp[] = [];
let metrics: unknown = null;
try { metrics = analyzeBeodeul(reloaded, target.id, stamps, { lower: canon.lowerTiles, upper: canon.upperTiles }); } catch (e) { metrics = { error: String(e).slice(0, 200) }; }
const byTool = Object.fromEntries([...new Set(trace.map((t) => t.name))].map((n) => [n, trace.filter((t) => t.name === n).length]));
let blank = 0; for (let i = 0; i < target.width * target.height; i += 1) if ((target.lowerTiles[i] ?? -1) < 0 && (target.upperTiles[i] ?? -1) < 0) blank += 1;
const summary = { label, round, text, model: `${provider}/${modelId}`, projectDir, ms, before, afterMaps: Object.fromEntries(Object.values(reloaded.maps).map((m) => [m.id, m.tilesetId])),
  target: { id: target.id, size: [target.width, target.height], tilesetId: target.tilesetId }, blankCellRatioRaw: +(blank / (target.width * target.height)).toFixed(4),
  exposedTools: classified.initialToolNames?.length, villageContract: Boolean(plan.villageContract), toolCalls: trace.length, failed: trace.filter((t) => !t.ok).length, byTool, stats: done.stats, metrics,
  finalText: log.filter((l) => l.startsWith("assistant:")).slice(-1)[0] ?? "" };
fs.writeFileSync(`${OUT}/trace.json`, JSON.stringify(trace, null, 1));
fs.writeFileSync(`${OUT}/log.txt`, log.join("\n") + "\n");
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ ...summary, metrics: undefined }, null, 1));
