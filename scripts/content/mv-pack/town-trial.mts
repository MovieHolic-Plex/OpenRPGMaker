// 팩 도시 타일셋 마을 한 줄 요청을 편집기 채팅 패널과 같은 경로(의도 선언 → 계획 턴 → 실행 턴)로 헤드리스 실행하고,
// 결과를 저장·다시 읽어 check_town_map 과 렌더 PNG 로 채점한다. 그림은 저장소 밖(--out)에만 쓴다(재배포 금지 팩).
//
//   bun scripts/content/mv-pack/town-trial.mts --project base.json --map town \
//     --task "라삭 모던 타일셋으로 50x40 자연스러운 미국풍 동네 하나 만들어줘" --out ~/rasak-modern/lanes/trials/run-1
//
// 산출: classification.json · plan.txt · log.txt(툴 호출) · project.json(저장본) · town.png · score.json
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { runPiAgent } from "../../lib/piAgentRuntime.ts";
import { resolveRequestApiKey } from "../../lib/aiAuthRuntime.ts";
import { completeProvider } from "../../lib/ohMyPiPiAiRuntime.ts";
import { renderToolRegionPngBase64 } from "../../qa-game/render.mts";
import { store } from "../../../src/project/store.ts";
import { serialize } from "../../../src/project/io.ts";
import { loadHeadlessProject } from "../../../src/headless/index.ts";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "../../../src/ai/llmClient.ts";
import { createLlmIntentDeclarer } from "../../../src/ai/intentDeclarationClient.ts";
import { resolveAutonomy } from "../../../src/ai/autonomyLevels.ts";
import { classifyPlainPiTurn, buildPiRunRequest, buildUltrabrainPlanRequest, needsUltrabrainPlanTurn, withUltrabrainPlan } from "../../../src/ai/piAgent/plainTurn.ts";
import { composePiTask } from "../../../src/ai/piAgent/executionRoute.ts";
import { normalizePiApplyMode } from "../../../src/ai/piAgent/applyMode.ts";
import { configForUltrabrain } from "../../../src/ai/ultrabrainConfig.ts";
import { modelForRole } from "../../../src/ai/modelRoles.ts";
import { plainPiCommand } from "../../../src/editor/panels/aiPiAgentCommand.ts";
import { checkTownMap } from "../../../src/editor/tools/packTownTools.ts";
import { renderMvMap } from "../../../src/project/rpgmakerMv/tilesetPreset.ts";
import type { PiAgentEvent } from "../../../src/ai/piAgent/protocol.ts";

const arg = (name: string): string | undefined => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const projectFile = arg("project"), mapId = arg("map") ?? "town", task = arg("task"), out = arg("out");
if (!projectFile || !task || !out) throw new Error("--project <json> --task <요청> --out <폴더> 가 필요합니다");
fs.mkdirSync(out, { recursive: true });
const logFile = fs.openSync(path.join(out, "log.txt"), "w");
const log = (line: string) => { fs.writeSync(logFile, `${line}\n`); console.log(line); };

// 브라우저 chatCompletion 대신 같은 몸통을 워커 completeProvider 로 보낸다(scripts/qa-game/gen.mts 와 같다).
const keys = new Map<string, string | undefined>();
const keyFor = async (provider: string) => { if (!keys.has(provider)) keys.set(provider, await resolveRequestApiKey(provider)); return keys.get(provider); };
const chat = async (config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
  const body: Record<string, unknown> = { model: config.model, messages: req.messages, stream: false, max_tokens: config.maxTokens };
  if (req.tools?.length) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
  if (req.response_format) body.response_format = req.response_format;
  if (typeof req.temperature === "number") body.temperature = req.temperature;
  if (config.reasoningEffort && config.reasoningEffort !== "off") body.reasoning = { effort: config.reasoningEffort };
  const provider = config.providerId || "google-antigravity";
  const { completion } = await completeProvider(provider, body, { apiKey: await keyFor(provider), signal: req.signal }) as { completion: { choices: { message: ChatResult["message"]; finish_reason: string | null }[]; usage?: ChatResult["usage"] } };
  const choice = completion.choices[0]!;
  return { message: choice.message, finishReason: choice.finish_reason, ...(completion.usage ? { usage: completion.usage } : {}) };
};
const toolCalls: { phase: string; name: string; ok: boolean; summary: string }[] = [];
const onEvent = (phase: string) => (event: PiAgentEvent) => {
  if (event.type === "tool_start") log(`[${phase}]   ARGS ${event.name} ${JSON.stringify(event.args).slice(0, 400)}`);
  else if (event.type === "tool_end") {
    toolCalls.push({ phase, name: event.name, ok: event.ok, summary: String(event.summary).slice(0, 300) });
    log(`[${phase}] ${event.ok ? "OK  " : "FAIL"} ${event.name} — ${String(event.summary).replace(/\s+/g, " ").slice(0, 300)}`);
  } else if (event.type === "assistant") log(`[${phase}] assistant: ${event.text.replace(/\s+/g, " ").slice(0, 400)}`);
  else if (event.type === "error") log(`[${phase}] ERROR ${event.message.slice(0, 400)}`);
  else if (event.type === "start") log(`[${phase}] start ${event.provider}/${event.model} tools=${event.toolCount}`);
};

const started = Date.now();
const timings: Record<string, number> = {};
store.replaceProject(loadHeadlessProject(fs.readFileSync(projectFile, "utf8")));
const base = store.getCurrent();
if (!base.maps[mapId]) throw new Error(`맵 없음: ${mapId}`);
const config: AiConfig = { ...defaultAiConfig(), ...(arg("model") ? { model: arg("model")! } : {}) };
const autonomy = resolveAutonomy(config.autonomyLevel ?? "balanced");
let t = Date.now();
const classified = await classifyPlainPiTurn({
  project: base, text: task, currentMapId: mapId, selection: null, hasActivePlan: false, autonomy,
  declarer: () => createLlmIntentDeclarer({ chat, audit: chat, getConfig: () => config, timeoutMs: 60_000, coverageAudit: false }),
  piTeam: false,
});
timings.intent = Date.now() - t;
const command = plainPiCommand(task, classified.mode, mapId);
const plan = classified.plan;
const applyMode = normalizePiApplyMode(config.piApply);
const brain = configForUltrabrain(config);
const deep = modelForRole(config, "deep");
const readOnly = plan.readOnly || plan.planOnly;
const modelTask = composePiTask(command.task, classified.intentNote);
fs.writeFileSync(path.join(out, "classification.json"), JSON.stringify({ ...classified, modelTask }, null, 2));
log(`intent ${timings.intent}ms village=${!!plan.villageContract} routine=${!!plan.routineEdit} initialTools=${classified.initialToolNames?.length ?? "all"} note=${JSON.stringify(classified.intentNote)}`);

let executionTask = modelTask;
const stats: Record<string, unknown> = {};
if (needsUltrabrainPlanTurn({ villageContract: plan.villageContract, readOnly, team: false, routineEdit: !!plan.routineEdit, applyMode })) {
  t = Date.now();
  const request = buildUltrabrainPlanRequest({ brain, modelTask, mapIds: command.mapIds, currentMapId: mapId, project: base, scopedByUser: false, maxTurns: plan.maxTurns, ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}) });
  let planText = "";
  const planned = await runPiAgent(request, { apiKey: await keyFor(request.provider), readOnlyTools: true, onEvent: (e) => { onEvent("plan")(e); if (e.type === "assistant") planText = e.text; } });
  timings.plan = Date.now() - t;
  stats.plan = planned.stats;
  fs.writeFileSync(path.join(out, "plan.txt"), planText);
  if (planText.trim()) executionTask = withUltrabrainPlan(modelTask, planText);
}
t = Date.now();
keys.clear();
const request = buildPiRunRequest({
  team: false, planOnly: plan.planOnly, readOnly, applyMode, villageContract: plan.villageContract,
  brain, deep, writer: modelForRole(config, "writer"), modelTask, executionTask, mapIds: command.mapIds, currentMapId: mapId,
  project: base, scopedByUser: false, mapBundleMerge: false, maxTurns: plan.maxTurns,
  ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
});
const done = await runPiAgent(request, {
  apiKey: await keyFor(request.provider), providerApiKeys: { [request.provider]: await keyFor(request.provider) },
  onEvent: onEvent("build"), renderToolImage: async (project, _name, data) => renderToolRegionPngBase64(project, data),
});
timings.build = Date.now() - t;
stats.build = done.stats;

// 저장 → 다시 읽기: 스토어에 적용한 뒤 직렬화하고, 그 파일을 새로 읽어 맵을 확인한다.
store.replaceProject(done.project);
fs.writeFileSync(path.join(out, "project.json"), serialize(store.getCurrent()));
const reloaded = loadHeadlessProject(fs.readFileSync(path.join(out, "project.json"), "utf8"));
const allMaps = Object.values(reloaded.maps).map((m) => ({ id: m.id, name: m.name, size: `${m.width}x${m.height}`, tilesetId: m.tilesetId, painted: m.lowerTiles.filter((x) => x >= 0).length, events: m.events.length }));
// 조수가 새 맵을 만들었으면 그 맵도 채점한다 — 원래 대상 맵과 새로 칠해진 팩 타일셋 맵 전부.
const scored = allMaps.filter((m) => m.painted > 0 && reloaded.tilesets[m.tilesetId]?.mvPack);
const checks: Record<string, unknown> = {};
for (const m of scored) {
  const map = reloaded.maps[m.id]!;
  checks[m.id] = checkTownMap(reloaded, map);
  const tileset = reloaded.tilesets[map.tilesetId]!;
  const asset = reloaded.assets.uploaded[(tileset.image as { id: string }).id]!;
  const atlas = PNG.sync.read(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64"));
  const img = renderMvMap(map, atlas as never, tileset.tilesPerRow);
  const png = new PNG({ width: img.width, height: img.height }); png.data = Buffer.from(img.data.buffer);
  fs.writeFileSync(path.join(out, `${m.id}.png`), PNG.sync.write(png));
}
const counts: Record<string, number> = {};
for (const call of toolCalls) counts[call.name] = (counts[call.name] ?? 0) + 1;
const score = {
  task, ms: Date.now() - started, timings, toolCalls: toolCalls.length, toolErrors: toolCalls.filter((c) => !c.ok).length, counts,
  villageContract: !!plan.villageContract, initialTools: classified.initialToolNames ?? null,
  maps: allMaps, checks, stats, changedKeys: done.changedKeys,
};
fs.writeFileSync(path.join(out, "score.json"), JSON.stringify(score, null, 2));
log(`DONE ${Math.round(score.ms / 1000)}s tools=${score.toolCalls} errors=${score.toolErrors} maps=${JSON.stringify(allMaps)}`);
process.exit(0);
