// 헤드리스 게임 생성 — 브라우저 새 프로젝트 마법사의 「이 기획으로 시작」과 같은 씨앗·지시·계획 턴·역할 모델로
// Pi 에이전트를 돌리고, 모든 툴 호출을 녹화한다(재생은 replay.mts).
//
//   bun scripts/qa-game/gen.mts --brief scripts/qa-game/briefs/lighthouse-jrpg.json --out qa-runs/lighthouse-1
//
// 옵션: --provider/--model/--lite-model/--brain-model  AiConfig 덮어쓰기(기본은 브라우저 기본 설정 defaultAiConfig)
//       --autonomy balanced|autonomous|max   --apply default|auto|yolo   --timeout-ms N   --no-check
//
// 브라우저 경로와 같은 함수를 부른다:
//   씨앗          createNewProjectSeed(packId, title) + gameDesignBrief(generationPending) → 저장·다시 읽기
//   기동 준비      projectInterviewStartup 과 같은 변경(generationPending 해제, 기본 오프닝 → briefOpeningSequence)
//   지시문         buildWelcomeGenrePresetPrompt(preset, brief)
//   평문 턴 분류    classifyPlainPiTurn(의도 선언 → 계획·노출 툴·의도 노트)  ← 패널과 같은 함수
//   계획/실행 요청  buildUltrabrainPlanRequest / buildPiRunRequest  ← runPiCommand 와 같은 함수
//   실시간 적용     createPiPublication → applyProposedProject(스토어 커밋 게이트)  ← 패널과 같은 함수
// 다른 점은 meta.json 의 differences 에 적는다.

import fs from "node:fs";
import path from "node:path";
import { runPiAgent } from "../lib/piAgentRuntime.ts";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { createPiRunRecorder } from "./lib/recorder.ts";
import { buildBrowserSeed, type QaBrief } from "./lib/seed.ts";
export { buildBrowserSeed, type QaBrief };
import { store } from "../../src/project/store.ts";
import { serialize } from "../../src/project/io.ts";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "../../src/editor/welcomeGenrePresets.ts";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "../../src/ai/llmClient.ts";
import { createLlmIntentDeclarer } from "../../src/ai/intentDeclarationClient.ts";
import { resolveAutonomy, type AutonomyLevel } from "../../src/ai/autonomyLevels.ts";
import { classifyPlainPiTurn, buildPiRunRequest, buildUltrabrainPlanRequest, needsUltrabrainPlanTurn, withUltrabrainPlan } from "../../src/ai/piAgent/plainTurn.ts";
import { composePiTask, DEFAULT_PI_TEAM } from "../../src/ai/piAgent/executionRoute.ts";
import { normalizePiApplyMode } from "../../src/ai/piAgent/applyMode.ts";
import { configForUltrabrain } from "../../src/ai/ultrabrainConfig.ts";
import { modelForRole } from "../../src/ai/modelRoles.ts";
import { mergesMapBundles, plainPiCommand } from "../../src/editor/panels/aiPiAgentCommand.ts";
import { createPiPublication } from "../../src/editor/panels/aiPiPublication.ts";
import { creationSubject } from "../../src/editor/panels/aiCreationChoice.ts";
import { applyProposedProject, captureApplyAuthority } from "../../src/editor/tools/applyChangesetToStore.ts";
import { adoptSpatialToolProof } from "../../src/editor/tools/spatialToolState.ts";
import { changedProjectKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest } from "../../src/ai/piAgent/protocol.ts";
import type { Project } from "../../src/project/types.ts";
import { renderToolRegionPngBase64 } from "./render.mts";

let ARGV: readonly string[] = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = ARGV.indexOf(`--${name}`); return i >= 0 ? ARGV[i + 1] : undefined; };
const flag = (name: string): boolean => ARGV.includes(`--${name}`);


/** 브라우저 chatCompletion 대신 — 동반 서비스의 /v1/chat/completions 가 워커 /complete 로 넘기는 것과 같은 몸통. */
function headlessChat(keys: Map<string, string | undefined>) {
  return async (config: AiConfig, req: ChatRequest): Promise<ChatResult> => {
    const body: Record<string, unknown> = { model: config.model, messages: req.messages, stream: false, max_tokens: config.maxTokens };
    if (req.tools?.length) { body.tools = req.tools; body.tool_choice = req.tool_choice ?? "auto"; }
    if (req.response_format) body.response_format = req.response_format;
    if (typeof req.temperature === "number") body.temperature = req.temperature;
    if (config.reasoningEffort && config.reasoningEffort !== "off") body.reasoning = { effort: config.reasoningEffort };
    const provider = config.providerId || "google-antigravity";
    if (!keys.has(provider)) keys.set(provider, await resolveRequestApiKey(provider));
    const { completion } = await completeProvider(provider, body, { apiKey: keys.get(provider), signal: req.signal }) as { completion: { choices: { message: ChatResult["message"]; finish_reason: string | null }[]; usage?: ChatResult["usage"] } };
    const choice = completion.choices[0]!;
    return { message: choice.message, finishReason: choice.finish_reason, ...(completion.usage ? { usage: completion.usage } : {}) };
  };
}

/** 동반 서비스 runAgent 와 같은 자격 해석: 제공자 키 + 역할 모델 제공자 키 + 웹 검색용 Codex 키. */
async function agentKeys(request: PiAgentRequest, cache: Map<string, string | undefined>) {
  const get = async (provider: string) => { if (!cache.has(provider)) cache.set(provider, await resolveRequestApiKey(provider)); return cache.get(provider); };
  const apiKey = await get(request.provider);
  const providerApiKeys: Record<string, string | undefined> = { [request.provider]: apiKey };
  for (const role of ["deep", "writer"] as const) {
    const selected = request.roleModels?.[role];
    if (selected?.provider && !(selected.provider in providerApiKeys)) providerApiKeys[selected.provider] = await get(selected.provider);
  }
  let codexApiKey: string | undefined;
  if (!("openai-codex" in providerApiKeys)) { try { codexApiKey = await get("openai-codex"); } catch { codexApiKey = undefined; } }
  return { apiKey, providerApiKeys, codexApiKey };
}

function logLine(prefix: string, event: PiAgentEvent): void {
  if (event.type === "tool_end") console.log(`${prefix} ${event.ok ? "OK  " : "FAIL"} ${event.name} — ${String(event.summary).replace(/\s+/g, " ").slice(0, 160)}`);
  else if (event.type === "assistant") console.log(`${prefix} assistant: ${event.text.replace(/\s+/g, " ").slice(0, 200)}`);
  else if (event.type === "error") console.log(`${prefix} ERROR ${event.message.slice(0, 300)}`);
  else if (event.type === "start") console.log(`${prefix} start ${event.provider}/${event.model} tools=${event.toolCount}`);
}

export async function genMain(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  ARGV = argv;
  const briefFile = arg("brief");
  const out = arg("out");
  if (!briefFile || !out) { console.error("사용법: bun scripts/qa-game/gen.mts --brief <brief.json> --out qa-runs/<id>"); return 2; }
  const input = JSON.parse(fs.readFileSync(briefFile, "utf8")) as QaBrief;
  fs.mkdirSync(out, { recursive: true });
  const started = Date.now();
  const timings: Record<string, number> = {};
  const mark = (label: string, since: number) => { timings[label] = Date.now() - since; };

  const config: AiConfig = {
    ...defaultAiConfig(), ...(input.ai ?? {}),
    ...(arg("provider") ? { providerId: arg("provider")! } : {}),
    ...(arg("model") ? { model: arg("model")! } : {}),
    ...(arg("lite-model") ? { liteModel: arg("lite-model")! } : {}),
    ...(arg("brain-model") ? { ultrabrainModel: arg("brain-model")! } : {}),
    ...(arg("autonomy") ? { autonomyLevel: arg("autonomy") as AutonomyLevel } : {}),
    ...(arg("apply") ? { piApply: arg("apply") as AiConfig["piApply"] } : {}),
  };
  const { project: seed, brief } = buildBrowserSeed(input);
  const preset = welcomeGenrePresetById(input.presetId);
  if (!preset) throw new Error(`첫 화면 프리셋이 없습니다: ${input.presetId}`);
  const instruction = buildWelcomeGenrePresetPrompt(preset, brief);
  fs.writeFileSync(path.join(out, "seed.json"), serialize(seed));
  fs.writeFileSync(path.join(out, "instruction.txt"), instruction);
  store.replaceProject(seed);
  const base = store.getCurrent();
  const currentMapId = base.startMapId;
  const differences: string[] = [
    "조화 검수(reviewMapHarmony)는 돌리지 않는다 — 캔버스 캡처가 필요하고, 기본 적용 모드에서는 결과를 바꾸지 않고 지적만 남긴다(auto 모드의 수리 루프는 미재현).",
    "의도 선언은 브라우저 chatCompletion 대신 같은 몸통을 워커 completeProvider 로 직접 보낸다(제공자 max_tokens 클램프 표는 생략).",
    "실행은 동반 서비스·워커 HTTP 를 거치지 않고 같은 프로세스에서 runPiAgent 를 부른다(체크포인트는 JSON 대신 structuredClone).",
    "show_map_region 이미지는 캔버스 대신 render 와 같은 pngjs 타일 렌더러로 그린다(이벤트는 스프라이트 대신 색 표식).",
  ];
  const subject = creationSubject(instruction);
  if (subject) differences.push(`지시문이 그래픽 선택(${subject})을 띄우는 문장이다 — 헤드리스는 선택 없이 진행했다.`);

  const keys = new Map<string, string | undefined>();
  const chat = headlessChat(keys);
  const autonomy = resolveAutonomy((config.autonomyLevel ?? "balanced") as AutonomyLevel);
  const t0 = Date.now();
  const classified = await classifyPlainPiTurn({
    project: base, text: instruction, currentMapId, selection: null, hasActivePlan: false, autonomy,
    declarer: () => createLlmIntentDeclarer({ chat, audit: chat, getConfig: () => config, timeoutMs: 30_000 }),
    piTeam: config.piTeam ?? DEFAULT_PI_TEAM,
  });
  mark("intent", t0);
  const command = plainPiCommand(instruction, classified.mode, currentMapId);
  const plan = classified.plan;
  const applyMode = normalizePiApplyMode(config.piApply);
  const brain = configForUltrabrain(config);
  const deep = modelForRole(config, "deep");
  const readOnly = plan.readOnly || plan.planOnly;
  const team = command.mode === "team" && !readOnly && !plan.villageContract;
  const routineEdit = plan.routineEdit === true && !readOnly && !team && command.mapIds.length === 1 && Boolean(base.maps[command.mapIds[0]!]);
  const groups = team || plan.planOnly ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
  const mergedFromBundles = mergesMapBundles({ team, mapIds: command.mapIds, scopedByUser: false, groupCount: groups.length });
  if (groups.length !== 1 || team) throw new Error("헤드리스 생성은 단독 실행만 지원합니다(팀·다중 묶음 미지원).");
  const here = currentMapId && base.maps[currentMapId] ? { currentMapId } : {};
  const modelTask = composePiTask(command.task, classified.intentNote);
  fs.writeFileSync(path.join(out, "classification.json"), JSON.stringify({ ...classified, team, routineEdit, applyMode, mergedFromBundles }, null, 2));

  const recorder = createPiRunRecorder(out);
  const stats: Record<string, unknown> = {};
  let planText = "";
  let executionTask = modelTask;
  try {
    if (needsUltrabrainPlanTurn({ villageContract: plan.villageContract, readOnly, team, routineEdit, applyMode })) {
      const t1 = Date.now();
      const request = buildUltrabrainPlanRequest({
        brain, modelTask, mapIds: command.mapIds, ...here, project: base, scopedByUser: false,
        maxTurns: plan.maxTurns, ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
      });
      const phase = recorder.phase("plan");
      let planError = "";
      const planned = await runPiAgent(request, {
        ...await agentKeys(request, keys), readOnlyTools: true, onToolCall: phase.onToolCall,
        onEvent: (event) => { phase.onEvent(event); logLine("[plan]", event); if (event.type === "assistant") planText = event.text; if (event.type === "error") planError = event.message; },
      });
      mark("plan", t1);
      stats.plan = planned.stats;
      if (planError || !planText.trim() || planned.changedKeys.length) throw new Error(planError || "Ultrabrain 계획을 완료하지 못했습니다.");
      executionTask = withUltrabrainPlan(modelTask, planText);
      fs.writeFileSync(path.join(out, "plan.txt"), planText);
    }
    const request = buildPiRunRequest({
      team, planOnly: plan.planOnly, readOnly, applyMode, villageContract: plan.villageContract,
      brain, deep, writer: modelForRole(config, "writer"), modelTask, executionTask, mapIds: groups[0]!, ...here, project: base,
      scopedByUser: false, mapBundleMerge: mergedFromBundles, maxTurns: plan.maxTurns,
      ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
    });
    const runRequest: PiAgentRequest = arg("timeout-ms") ? { ...request, timeoutMs: Number(arg("timeout-ms")) } : request;
    fs.writeFileSync(path.join(out, "request.json"), JSON.stringify({ ...runRequest, project: "(seed.json)" }, null, 2));
    const publication = createPiPublication(base, applyMode, {
      appendBubble: (_role, text) => console.log(`[bubble] ${text}`),
      appendCard: () => undefined,
      setStatus: () => undefined,
      getCurrentMapId: () => currentMapId,
    });
    const phase = recorder.phase("build");
    const t2 = Date.now();
    const readOnlyRun = readOnly;
    const done: PiAgentDoneEvent = await runPiAgent(runRequest, {
      ...await agentKeys(runRequest, keys), onToolCall: phase.onToolCall,
      ...(readOnlyRun ? { readOnlyTools: true } : {}),
      ...(runRequest.timeoutMs ? { timeoutMs: runRequest.timeoutMs } : {}),
      onEvent: (event) => { phase.onEvent(event); logLine("[build]", event); },
      // 브라우저는 캔버스로 show_map_region 이미지를 그린다. 헤드리스는 render 와 같은 타일 렌더러(pngjs)로 대신한다 —
      // 넘기지 않으면 런타임이 「맵 이미지 전달 경로가 없습니다」로 호출을 실패시킨다.
      renderToolImage: async (project, _toolName, data) => renderToolRegionPngBase64(project, data),
      ...(plan.villageContract || readOnlyRun || applyMode === "review" ? {} : { onCheckpoint: (checkpoint) => publication.publish(checkpoint) }),
    });
    mark("build", t2);
    stats.build = done.stats;
    // runPiCommand 의 마무리: 워커 결과를 붙이고 아직 발행 안 된 변경을 한 번에 적용한다.
    adoptSpatialToolProof(done.project, done.spatialProof, base);
    const unpublished = changedProjectKeys(publication.project, done.project).length > 0;
    let finalApply: unknown = "already-published";
    if (unpublished) {
      const { base: proposalBase, baseline } = captureApplyAuthority(base);
      finalApply = await applyProposedProject(done.project, {
        base: publication.count ? publication.authority : proposalBase,
        baseline: publication.count ? publication.baseline : baseline,
        source: "agent", agentName: `pi:${deep.provider}/${config.model}`,
        summary: `Pi 에이전트: ${command.task.slice(0, 80)}`, toolNames: ["pi_agent"],
        mapDestructionApproved: applyMode === "yolo" || applyMode === "auto",
        skipSnapshot: publication.count > 0, snapshotLabel: "Pi 에이전트", snapshotMapId: currentMapId,
      });
    }
    const final = store.getCurrent();
    fs.writeFileSync(path.join(out, "project.json"), serialize(final));
    stats.publications = publication.count;
    stats.finalApply = typeof finalApply === "object" && finalApply ? { ok: (finalApply as { ok: boolean }).ok, reason: (finalApply as { reason?: string }).reason, issue: (finalApply as { issue?: string }).issue } : finalApply;
    stats.changedKeys = changedProjectKeys(base, final);
  } finally {
    recorder.close();
    const usage = (key: string) => ((stats[key] as { usage?: unknown } | undefined)?.usage);
    fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify({
      version: 1, brief: briefFile, title: input.title, presetId: input.presetId,
      config: { providerId: config.providerId, model: config.model, liteModel: config.liteModel, ultrabrain: { provider: brain.providerId, model: brain.model, effort: brain.reasoningEffort }, deep, writer: modelForRole(config, "writer"), autonomyLevel: config.autonomyLevel, piApply: applyMode },
      startedAt: new Date(started).toISOString(), ms: Date.now() - started, timings,
      toolCalls: recorder.calls.length, toolErrors: recorder.calls.filter((call) => !call.ok).length,
      tokens: { plan: usage("plan"), build: usage("build") },
      stats, differences,
    }, null, 2));
  }
  console.log(`[qa-game] gen 완료 ${Math.round((Date.now() - started) / 1000)}s → ${out}`);
  if (!flag("no-check")) {
    const { checkMain } = await import("./check.mts");
    checkMain([out, "--quiet"]);
  }
  return 0;
}

if (import.meta.main) process.exit(await genMain());
