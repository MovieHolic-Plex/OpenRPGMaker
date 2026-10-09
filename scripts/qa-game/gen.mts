// 헤드리스 게임 생성 — 브라우저 새 프로젝트 마법사의 「이 기획으로 시작」과 같은 씨앗·지시·계획 턴·역할 모델로
// Pi 에이전트를 돌리고, 모든 툴 호출을 녹화한다(재생은 replay.mts).
//
//   bun scripts/qa-game/gen.mts --brief scripts/qa-game/briefs/lighthouse-jrpg.json --out qa-runs/lighthouse-1
//
// 옵션: --provider/--model/--lite-model/--brain-model  AiConfig 덮어쓰기(기본은 브라우저 기본 설정 defaultAiConfig)
//       --ai-config <file>  역할 모델 설정 파일 통째로 덮기(조수 하네스 ai-configs 와 같은 형식)
//       --autonomy balanced|autonomous|max   --apply default|auto|yolo   --timeout-ms N   --no-check
//       --concept-card <card.json>  굽기 전 개념 카드를 이 실행에만 얹는다(슈퍼하네스 조수 시험)
//       --text "<채팅 한 줄>"  기획 지시문 대신 조수 채팅에 친 문장 하나를 그대로 보낸다(씨앗은 --brief 의 새 프로젝트, 기획서는 뺀다)
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
import { runPiTeam } from "../lib/piTeamRuntime.ts";
import { defaultTeamSpec } from "../../src/ai/piAgent/teamSpec.ts";
import { resolveRequestApiKey } from "../lib/aiAuthRuntime.ts";
import { completeProvider } from "../lib/ohMyPiPiAiRuntime.ts";
import { createPiRunRecorder } from "./lib/recorder.ts";
import { buildBrowserSeed, type QaBrief } from "./lib/seed.ts";
import { overrideConceptCards } from "../../src/ai/conceptCards.ts";
export { buildBrowserSeed, type QaBrief };
import { store } from "../../src/project/store.ts";
import { deserialize, serialize } from "../../src/project/io.ts";
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
import { setCutsceneArtGenerator } from "../../src/editor/tools/cutsceneArtTools.ts";
import { headlessFetchAsset, headlessGenerateImage } from "./lib/headlessImage.mts";
import { generateOpeningStill } from "../../src/editor/openingImageGeneration.ts";
import { resolveAssetResourceUrl } from "../../src/assets/generatedAssetResourceResolver.ts";
import { setCutsceneAssetFetcher } from "../../src/editor/cutsceneArt/charsetFrames.ts";
import { setWorldmapBuilder } from "../../src/editor/worldmap/worldmapBuild.ts";
import { buildWorldmap as headlessBuildWorldmap } from "../lib/worldmapBuild.mjs";

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

/** 타이틀·오프닝 그림 확인은 등록된 그림 자체를, 나머지는 맵 렌더를 돌려준다. */
function headlessToolImage(project: Project, toolName: string, data: unknown): string {
  const resourceId = (data as { resourceId?: unknown } | undefined)?.resourceId;
  if ((toolName === "show_title_opening" || toolName === "show_opening_image") && typeof resourceId === "string") {
    const url = resolveAssetResourceUrl(resourceId, { project });
    if (url?.startsWith("data:image/")) return url.slice(url.indexOf(",") + 1);
    if (url && /^\/?assets\//u.test(url)) return fs.readFileSync(path.join("public", url.replace(/^\//u, ""))).toString("base64");
    throw new Error(`그림을 찾을 수 없습니다: ${resourceId}`);
  }
  return renderToolRegionPngBase64(project, data);
}

function logLine(prefix: string, event: PiAgentEvent): void {
  if (event.type === "tool_end") console.log(`${prefix} ${event.ok ? "OK  " : "FAIL"} ${event.name} — ${String(event.summary).replace(/\s+/g, " ").slice(0, 160)}`);
  else if (event.type === "assistant") console.log(`${prefix} assistant: ${event.text.replace(/\s+/g, " ").slice(0, 200)}`);
  else if (event.type === "error") console.log(`${prefix} ERROR ${event.message.slice(0, 300)}`);
  else if (event.type === "start") console.log(`${prefix} start ${event.provider}/${event.model} tools=${event.toolCount}`);
}

export async function genMain(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  // generate_cutscene_art 의 그림 생성은 편집기에서는 /v1/images/generations 로 가고, 헤드리스에서는 같은 동반 앱 경로를 프로세스 안에서 부른다.
  setCutsceneArtGenerator(headlessGenerateImage);
  setCutsceneAssetFetcher(headlessFetchAsset);
  // edit_world_terrain 의 월드맵 빌드도 동반 앱 경로(/v1/worldmap/build)를 프로세스 안에서 부른다.
  setWorldmapBuilder(headlessBuildWorldmap);
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
    // --ai-config <file>: 조수 하네스와 같은 역할 모델 설정 파일(harness-data/assistant-capability/ai-configs/*.json)을 덮는다.
    ...(arg("ai-config") ? JSON.parse(fs.readFileSync(arg("ai-config")!, "utf8")) as Partial<AiConfig> : {}),
    ...(arg("provider") ? { providerId: arg("provider")! } : {}),
    ...(arg("model") ? { model: arg("model")! } : {}),
    ...(arg("lite-model") ? { liteModel: arg("lite-model")! } : {}),
    ...(arg("brain-model") ? { ultrabrainModel: arg("brain-model")! } : {}),
    ...(arg("autonomy") ? { autonomyLevel: arg("autonomy") as AutonomyLevel } : {}),
    ...(arg("apply") ? { piApply: arg("apply") as AiConfig["piApply"] } : {}),
  };
  const built = buildBrowserSeed(input);
  // --seed-project <project.json>: 새 프로젝트 대신 이미 있는 프로젝트(예: 포켓몬풍 데모) 위에서 같은 기획을 시킨다.
  const seed = arg("seed-project") ? deserialize(fs.readFileSync(arg("seed-project")!, "utf8")) : built.project;
  const brief = built.brief;
  const preset = welcomeGenrePresetById(input.presetId);
  if (!preset) throw new Error(`첫 화면 프리셋이 없습니다: ${input.presetId}`);
  const chatText = arg("text");
  if (arg("concept-card")) overrideConceptCards([JSON.parse(fs.readFileSync(arg("concept-card")!, "utf8"))]);
  // --text: 기획서 없는 프로젝트에서 사용자가 채팅창에 한 줄을 친 것과 같게 — 지시문은 그 문장 그대로.
  if (chatText) delete seed.gameDesignBrief;
  const instruction = chatText ?? buildWelcomeGenrePresetPrompt(preset, brief);
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
    "오프닝 그림 도구 이미지는 합성 대신 쓰인 그림 리소스를 이어 붙인 것이다(애니메틱 시간 표본 합성 아님).",
    "맵 소실 확인은 사람 대신 규칙으로 답한다 — 이 실행에서 만든 맵만 허용, 씨앗 맵은 거절.",
  ];
  const subject = creationSubject(instruction);
  if (subject) differences.push(`지시문이 그래픽 선택(${subject})을 띄우는 문장이다 — 헤드리스는 선택 없이 진행했다.`);

  const keys = new Map<string, string | undefined>();
  const chat = headlessChat(keys);
  const autonomy = resolveAutonomy((config.autonomyLevel ?? "balanced") as AutonomyLevel);
  const t0 = Date.now();
  const classified = await classifyPlainPiTurn({
    project: base, text: instruction, currentMapId, selection: null, hasActivePlan: false, autonomy,
    declarer: () => createLlmIntentDeclarer({ chat, audit: chat, getConfig: () => config, timeoutMs: 30_000, coverageAudit: false }),
    piTeam: config.piTeam ?? DEFAULT_PI_TEAM,
  });
  mark("intent", t0);
  const command = plainPiCommand(instruction, classified.mode, currentMapId);
  const plan = classified.plan;
  const applyMode = normalizePiApplyMode(config.piApply);
  const brain = configForUltrabrain(config);
  const deep = modelForRole(config, "deep");
  const readOnly = plan.readOnly || plan.planOnly;
  const team = command.mode === "team" && !readOnly;
  const routineEdit = plan.routineEdit === true && !readOnly && !team && command.mapIds.length === 1 && Boolean(base.maps[command.mapIds[0]!]);
  const groups = team || plan.planOnly ? [command.mapIds] : command.mapIds.length > 0 ? command.mapIds.map((id) => [id]) : [[] as string[]];
  const mergedFromBundles = mergesMapBundles({ team, mapIds: command.mapIds, scopedByUser: false, groupCount: groups.length });
  // 팀(장르 프리셋 첫 제작)은 브라우저처럼 runPiTeam 으로 돈다. 다중 묶음 병렬은 여전히 미지원.
  if (groups.length !== 1) throw new Error("헤드리스 생성은 묶음 하나만 지원합니다(다중 묶음 병렬 미지원).");
  const here = currentMapId && base.maps[currentMapId] ? { currentMapId } : {};
  const modelTask = composePiTask(command.task, classified.intentNote);
  fs.writeFileSync(path.join(out, "classification.json"), JSON.stringify({ ...classified, team, routineEdit, applyMode, mergedFromBundles }, null, 2));

  const recorder = createPiRunRecorder(out);
  const stats: Record<string, unknown> = {};
  let planText = "";
  let executionTask = modelTask;
  try {
    if (needsUltrabrainPlanTurn({ readOnly, team, routineEdit, applyMode })) {
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
      team, planOnly: plan.planOnly, readOnly, applyMode,
      brain, deep, writer: modelForRole(config, "writer"), modelTask, executionTask, mapIds: groups[0]!, ...here, project: base,
      scopedByUser: false, mapBundleMerge: mergedFromBundles, maxTurns: plan.maxTurns,
      ...(classified.initialToolNames ? { initialToolNames: classified.initialToolNames } : {}),
      ...(team ? { teamSpec: config.piTeam ?? defaultTeamSpec() } : {}),
    });
    // QA_IMAGE_PROVIDER=codex — Google 이미지 용량(429)이 막혔을 때 타이틀 키아트도 GPT Image 로(headlessGenerateImage 와 같은 스위치).
    const viaCodexImages = process.env.QA_IMAGE_PROVIDER === "codex";
    const runRequest: PiAgentRequest = { ...request, ...(arg("timeout-ms") ? { timeoutMs: Number(arg("timeout-ms")) } : {}),
      ...(viaCodexImages ? { imageProvider: "openai-codex", imageModel: "codex-image-default" } : {}) };
    fs.writeFileSync(path.join(out, "request.json"), JSON.stringify({ ...runRequest, project: "(seed.json)" }, null, 2));
    const publication = createPiPublication(base, applyMode, {
      appendBubble: (_role, text) => console.log(`[bubble] ${text}`),
      appendCard: () => undefined,
      setStatus: () => undefined,
      getCurrentMapId: () => currentMapId,
      // 맵 소실 확인: 화면이 없어 카드를 띄우면 document 없음으로 실행 전체가 죽었다(2026-10-07 장르 시험, gemini JRPG remove_map).
      // 사람 대신 정해진 규칙으로 답한다 — 이 실행에서 새로 만든 맵만 지우게 두고, 씨앗에 있던 맵은 거절한다.
      decide: async ({ title, lostMapIds }) => {
        const accepted = lostMapIds.length > 0 && lostMapIds.every((id) => !seed.maps[id]);
        console.log(`[decide] ${title} — ${lostMapIds.join(", ") || "(대상 없음)"} → ${accepted ? "허용(이 실행에서 만든 맵)" : "거절"}`);
        return accepted;
      },
    });
    const phase = recorder.phase("build");
    const t2 = Date.now();
    const readOnlyRun = readOnly;
    // 계획 턴(수 분)에서 푼 OAuth 토큰을 그대로 들고 가면 긴 실행 도중 만료된다 — 동반 서비스처럼 실행 요청마다 새로 푼다.
    keys.clear();
    // 팀원 이벤트는 agent_event 로 싸여 온다 — 도구 기록이 팀원 것까지 잡히게 풀고 id 에 팀원을 붙인다.
    const unwrapTeam = (event: PiAgentEvent): PiAgentEvent => event.type === "agent_event" && "id" in event.event
      ? { ...event.event, id: `${event.agentId}:${(event.event as { id: string }).id}` } as PiAgentEvent : event.type === "agent_event" ? event.event : event;
    const runner = team ? runPiTeam : runPiAgent;
    const runKeys = await agentKeys(runRequest, keys);
    if (viaCodexImages && runKeys.codexApiKey) runKeys.providerApiKeys["openai-codex"] = runKeys.codexApiKey;
    const done: PiAgentDoneEvent = await runner(runRequest, {
      ...runKeys, onToolCall: phase.onToolCall,
      ...(readOnlyRun ? { readOnlyTools: true } : {}),
      ...(runRequest.timeoutMs ? { timeoutMs: runRequest.timeoutMs } : {}),
      onEvent: (event) => { phase.onEvent(team ? unwrapTeam(event) : event); logLine(team && event.type === "agent_event" ? `[${event.agentId}]` : "[build]", team && event.type === "agent_event" ? event.event : event); },
      // 브라우저는 캔버스로 show_map_region 이미지를 그린다. 헤드리스는 render 와 같은 타일 렌더러(pngjs)로 대신한다 —
      // 넘기지 않으면 런타임이 「맵 이미지 전달 경로가 없습니다」로 호출을 실패시킨다.
      renderToolImage: async (project, toolName, data) => headlessToolImage(project, toolName, data),
      // 브라우저는 호스트가 오프닝 스틸을 그려 돌려준다(piRenderBroker). 헤드리스는 같은 함수에 이미지 제공자를 직접 건다.
      generateOpeningImage: (project, args, signal) => generateOpeningStill(args, { project, signal, generateImage: headlessGenerateImage,
        resolveReference: async (id) => `data:image/png;base64,${headlessToolImage(project, "show_opening_image", { resourceId: id })}` }),
      ...(readOnlyRun || applyMode === "review" ? {} : { onCheckpoint: (checkpoint) => publication.publish(checkpoint) }),
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
  } catch (error) {
    // 실패한 판도 그때까지 발행된 결과를 남긴다 — 어디까지 지어졌는지가 분석의 절반이다.
    fs.writeFileSync(path.join(out, "project.json"), serialize(store.getCurrent()));
    fs.writeFileSync(path.join(out, "error.txt"), error instanceof Error ? error.stack ?? error.message : String(error));
    stats.error = error instanceof Error ? error.message : String(error);
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
