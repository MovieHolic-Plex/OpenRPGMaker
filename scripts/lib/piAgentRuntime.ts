import { piTimer } from './piRunTiming.mjs';
import { PiInteriorCompletion } from '../../src/ai/piAgent/interiorCompletion.ts';
import type { InteriorRequirements } from '../../src/project/interiorPlacementAudit.ts';
import { randomUUID } from "node:crypto";
import { PiTilesetReferenceGate } from "../../src/ai/piAgent/tilesetReferenceGate.ts";
import { TILESET_REFERENCE_READ_TOOLS } from "../../src/editor/tools/tilesetReferenceTools.ts";
import { SET_BUILD_SPEC_TOOL } from "../../src/ai/session/sessionTools.ts";
import { normalizeBuildSpec, plannedGrowthForSpec, validateBuildSpec, type BuildSpec } from "../../src/ai/buildSpec.ts";
import { growthGuidanceLine } from "../../src/ai/session/buildSpecGate.ts";
import { assertVillageContractArgs, validateVillageContract, villageContractBlocker, villageContractReleaseNotice, villageDraftReceipt, type VillageDraftReceipt } from "../../src/ai/piAgent/villageContract.ts";
import { connectContractVillage } from "../../src/ai/piAgent/villageConnection.ts";
import type { ActivityVisual } from "../../src/ai/activityVisual";
import { authoredVillageMapId, inspectPiVillageCompletion, piVillageRepairPrompt } from "../../src/ai/piAgent/villageCompletion.ts";
import { inspectPiLayoutQuality, piLayoutRepairPrompt } from "../../src/ai/piAgent/layoutQuality.ts";
import { PiRepeatBreaker } from "../../src/ai/piAgent/repeatBreaker.ts";
import { inspectPromptPayload } from "../../src/ai/authoring/promptInspection.ts";
import { activityPayload } from "../../src/ai/activityTrace.ts";
import { finishSpatialToolAcceptance, authorMergedSpatialProposal } from "../../src/editor/tools/spatialToolState.ts";
import { mergeMapBundles } from "../../src/ai/piAgent/mapBundle.ts";
import type { PiProjectCheckpoint } from "../../src/ai/piAgent/protocol.ts";
import { createWriterTool } from "./piWriterTool.ts";
import { completeProvider } from "./ohMyPiPiAiRuntime.ts";
// Bun 전용 Pi 에이전트 런타임. `@oh-my-pi/pi-agent-core` 루프에 레지스트리 툴을 붙여 프로젝트
// 사본 위에서 작업을 끝까지 돈다. 결과 프로젝트는 `done` 이벤트로 돌려주고, 적용(커밋 게이트·
// undo·저장)은 호출자(브라우저 패널 또는 CLI)가 맡는다.
//
// 이 파일만 oh-my-pi 코어를 알고 있다. 어댑터(src/ai/piAgent/*)는 순수라서, 코어를 바꾸려면
// 이 파일 하나를 다시 쓰면 된다.

import { Agent, type StreamFn } from "@oh-my-pi/pi-agent-core";
import { resolveOhMyPiModel } from "./ohMyPiModel.ts";
import {
  createPiToolset,
  selectPiToolDefinitions,
  harvestFindToolsNames,
  resolvePiToolShape,
  type PiToolCallRecord,
  type PiToolShape,
} from "../../src/ai/piAgent/toolAdapter.ts";
import { buildToolCapabilityIndex } from "../../src/ai/toolCapabilityIndex.ts";
import { exportSpatialToolProof } from "../../src/editor/tools/spatialToolState.ts";
import { createDeltaRelay } from "../../src/ai/piAgent/deltaRelay.ts";
import { applyMapDeltas, diffMapsForDelta } from "../../src/ai/piAgent/mapDelta.ts";
import { buildPiAgentSystemPrompt } from "../../src/ai/piAgent/systemPrompt.ts";
import { gameDesignBriefContext } from "../../src/project/gameDesignBrief.ts";
import { createModernTilesetPolicy, modernTilesetPolicyPrompt, requestsModernMap } from '../../src/ai/modernTilesetPolicy.ts';
import { isTransientProviderStreamError, PI_PROVIDER_STREAM_RETRY_LIMIT, providerStreamResumePrompt } from "../../src/ai/piAgent/providerRetry.ts";
import { PLAN_EXECUTION_REKICK, ULTRABRAIN_PLAN_HEADING } from "../../src/ai/piAgent/planExecution.ts";
import { addPiAgentUsage, changedProjectKeys, PI_AGENT_DEFAULT_TIMEOUT_MS, piMapScopeGuard, restoreCheckpointProject, slimCheckpointProject, slimProjectForWire, snapshotProjectKeepingHeavy, slimDoneEvent, unchangedHeavyKeys, type PiAgentDoneEvent, type PiAgentEvent, type PiAgentRequest, type PiAgentUsage, type PiCheckpointHeavyKey } from "../../src/ai/piAgent/protocol.ts";
import { normalizePiThinkingLevel } from "../../src/ai/piAgent/thinkingLevel.ts";
import { antigravityToolEnumPayload } from "./ohMyPiToolEnums.ts";
import { searchWebWithCodex } from "./codexWebSearchRuntime.ts";
import { WEB_SEARCH_TOOL } from "../../src/editor/tools/webSearchTool.ts";
import { CODEX_PROVIDER_ID } from "../../src/ai/oauth/credentials.ts";
import { setWorldmapBuilder } from "../../src/editor/worldmap/worldmapBuild.ts";
import { buildWorldmap } from "./worldmapBuild.mjs";
import type { GameMap, Project } from "../../src/project/types.ts";
import type { ToolContext } from "../../src/editor/tools/types.ts";

// 조수 도구는 이 Bun 일꾼 안에서 돈다 — 편집기 기본값(상대 /v1 fetch)은 여기서 닿지 않으므로 월드맵 빌드를 프로세스 안에서 부른다.
setWorldmapBuilder(buildWorldmap);

export interface RunPiAgentOptions {
  /** Trusted request requirements for direct-authoring observations; no layout coordinates. */
  readonly interiorRequirements?: Record<string, InteriorRequirements>;
  readonly onCheckpoint?: (checkpoint: PiProjectCheckpoint, signal?: AbortSignal) => Promise<Project | void>;
  readonly apiKey?: string;
  readonly providerApiKeys?: Record<string, string | undefined>;
  readonly onEvent?: (event: PiAgentEvent) => void;
  /**
   * 레지스트리 툴 호출 하나의 전체 기록(인자·결과 원본). `tool_end` 이벤트의 결과는 활동 로그용으로 잘려 있다 —
   * 헤드리스 녹화(scripts/qa-game)가 재생에 쓸 원본은 여기서만 나온다. 관찰 전용: 실행을 바꾸지 않는다.
   */
  readonly onToolCall?: (record: PiToolCallRecord) => void;
  readonly signal?: AbortSignal;
  /** 전체 실행 상한(ms). 기본 PI_AGENT_DEFAULT_TIMEOUT_MS(3000초). */
  readonly timeoutMs?: number;
  /** 역할별 툴 범위. 레지스트리 선택에 더해 팀 런타임의 커스텀 툴(assign_map_agent 등)을 붙인다. */
  readonly readOnlyTools?: boolean;
  /**
   * 웹 검색 전용 Codex access 토큰. 조수 제공자가 Antigravity 여도 검색은 Codex 백엔드가 하므로
   * 제공자 키와 **별개로** 해결해 넘긴다(없으면 툴이 "Codex 로그인 필요" 로 정직하게 실패한다).
   */
  readonly codexApiKey?: string;
  readonly renderToolImage?: (project: Project, toolName: string, data: unknown, signal?: AbortSignal) => Promise<string>;
  /**
   * Headless runners only: a model object resolved outside the bundled catalog (e.g. a provider from the user's local
   * ~/.omp/agent/models.yml, scripts/qa/beodeul-assistant-run.mts). Absent = the exact catalog resolution below.
   */
  readonly model?: ReturnType<typeof resolveOhMyPiModel>;
  readonly toolNames?: readonly string[];
  readonly extraTools?: readonly PiToolShape[];
  /** 모델 스트림 대체 — 테스트가 네트워크 없이 진짜 Agent 루프를 돌릴 때 쓰는 시임. */
  readonly streamFn?: StreamFn;
  /** Team mailbox notifications, delivered through the core steering queue at a tool boundary. */
  readonly subscribeTeamMessages?: (notify: () => void) => () => void;
}

const DEFAULT_MAX_TURNS = 200;
const DEFAULT_TIMEOUT_MS = PI_AGENT_DEFAULT_TIMEOUT_MS;
/** 제공자 끊김 뒤 이어 가기 전 대기(시도마다 곱). 끊김 직후 같은 엔드포인트를 바로 두드리면 또 끊기기 쉽다. */
const PROVIDER_RETRY_DELAY_MS = 1500;

/** 읽기 전용 실행에 덧붙이는 한 줄. 강제는 툴 목록이 하고(쓰기 툴 미제공), 이 문장은 이유를 말한다. */
const READ_ONLY_INSTRUCTION =
  "이번 실행은 읽기 전용이다. 쓰기 도구가 제공되지 않는다. 조회한 사실과 근거만 보고하고, 고칠 거리는 문장으로만 제안한다.";

/**
 * 레지스트리의 `web_search` 를 실제 네트워크 실행으로 갈아 끼우는 실행 셰이프.
 *
 * 왜 오버라이드인가: 레지스트리 툴은 **순수 함수**여야 한다(types.ts 머리말 — 브라우저 전역 접근 금지).
 * 그래서 레지스트리 쪽 `run` 은 `status:"ui-required"` 핸드오프만 만들고, 진짜 검색은 자격을 아는
 * 서버 경계가 한다 — `generate_image_asset` 이 `imageAssetGeneration` 을 거치는 것과 같은 분업이다.
 * 여기는 Bun 워커라 Codex 자격과 fetch 가 있고, 자격은 절대 브라우저로 나가지 않는다.
 */
function createWebSearchTool(options: {
  readonly codexApiKey?: string;
  readonly onCall?: (record: PiToolCallRecord) => void;
}): PiToolShape {
  return {
    name: WEB_SEARCH_TOOL,
    label: "웹 검색",
    concurrency: "shared",
    description: [
      "인터넷을 검색해 최신 사실과 출처 URL을 가져온다.",
      "학습 시점 이후의 정보(최신 버전·릴리스·요금·뉴스·현행 표준)나 실존 작품의 구체 사실이 필요할 때 쓴다.",
      "프로젝트 안의 사실(맵·이벤트·DB·위키)은 이 툴이 아니라 프로젝트 조회 툴로 읽는다.",
      "검색은 프로젝트를 바꾸지 않는다. 답을 사용자에게 전할 때는 근거 URL을 함께 밝힌다.",
    ].join(" "),
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: {
          type: "string",
          minLength: 2,
          maxLength: 400,
          description: "찾을 내용을 한 문장이나 검색어로.",
        },
      },
    },
    async execute(toolCallId, params, signal) {
      const args = params && typeof params === "object" ? (params as Record<string, unknown>) : {};
      const outcome = await searchWebWithCodex(args.query, { apiKey: options.codexApiKey }, signal);
      if (!outcome.ok) {
        options.onCall?.({
          toolCallId, name: WEB_SEARCH_TOOL, args,
          result: { ok: false, summary: outcome.answer, issues: [{ severity: "error", code: outcome.code ?? "web-search-failed", message: outcome.answer }] },
        });
        // 어댑터와 같은 규약 — 실패는 throw 로 나가고 본문에 issues 가 실린다.
        throw new Error(JSON.stringify({
          ok: false,
          summary: outcome.answer,
          issues: [{ severity: "error", code: outcome.code ?? "web-search-failed", message: outcome.answer }],
        }));
      }
      const summary = `웹 검색 결과 ${outcome.sources.length}개 출처`;
      options.onCall?.({
        toolCallId, name: WEB_SEARCH_TOOL, args,
        result: { ok: true, summary, data: { queries: outcome.queries, sources: outcome.sources } },
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            ok: true,
            summary,
            answer: outcome.answer,
            queries: outcome.queries,
            sources: outcome.sources,
            hint: "답을 사용자에게 전할 때 근거 URL을 함께 밝히고, 검색 결과를 프로젝트 사실처럼 단정하지 마라.",
          }),
        }],
        details: { queries: outcome.queries, sources: outcome.sources },
      };
    },
  };
}

/** Shared exact model resolution for Pi and completion requests. */
export const resolvePiModel = resolveOhMyPiModel;

/** pi-agent-core 가 실패한 도구 결과에 싣는 첫 텍스트(인자 검증 오류·throw 메시지). */
function toolErrorText(result: unknown): string {
  const content = (result as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) return "";
  const part = content.find((entry): entry is { type: "text"; text: string } => !!entry && typeof entry === "object" && (entry as { type?: unknown }).type === "text" && typeof (entry as { text?: unknown }).text === "string");
  return part ? trimText(part.text.trim(), 300) : "";
}

function withErrorDetail(summary: string, detail: string): string {
  return detail ? `${summary}: ${detail}` : summary;
}

function trimText(value: unknown, max: number): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * 워커는 브라우저 부팅을 안 거치므로 공용 카탈로그(장소·지역 참고·공용 콘텐츠)를 스스로 설치한다. 판본이 같으면 다시 읽지 않는다.
 *
 * 왜(2026-10-03 실측): 실행마다 2.4GB shared-content.sqlite 의 모든 payload(505MB) 를 두 번 읽어 파싱했다 — 실행 준비 41.4s 중
 * 거의 전부였고, 동기 SQLite 라 그동안 워커가 응답 헤더도 못 보냈다(브라우저는 「작업 중」만 보며 40초 넘게 기다렸다).
 * 판본은 행 판본만 읽어 센다(payload 안 읽음). 게시 스크립트가 행을 바꾸면 판본이 바뀌어 다음 실행이 다시 설치한다.
 * 팀 모드는 팀원 실행이 동시에 들어오므로 한 번만 읽게 묶는다.
 */
let sharedCatalogs: { revision: string; loading: Promise<void> } | null = null;
async function ensureWorkerSharedCatalogs(): Promise<void> {
  const { sharedTileReferencesRevision } = await import('./sharedTileReferencesSqlite');
  const revision = sharedTileReferencesRevision();
  if (sharedCatalogs?.revision === revision) return sharedCatalogs.loading;
  const loading = (async () => {
    // 같은 행을 두 번 읽어 두 번 파싱하지 않는다(readSharedCatalogsOnce 주석).
    const { readSharedCatalogsOnce } = await import('./sharedTileReferencesSqlite');
    const { tileReferences, content } = readSharedCatalogsOnce();
    const { installSharedSpatialReferences } = await import('../../src/project/sharedSpatialReferences');
    installSharedSpatialReferences(tileReferences.spatial);
    const { installSharedContent } = await import('../../src/project/sharedContent');
    await installSharedContent(content);
  })();
  sharedCatalogs = { revision, loading };
  // 실패한 설치를 기억하면 다음 실행도 같은 실패를 그냥 넘긴다 — 지우고 다시 시도하게 한다.
  loading.catch(() => { if (sharedCatalogs?.loading === loading) sharedCatalogs = null; });
  return loading;
}

export async function runPiAgent(request: PiAgentRequest, options: RunPiAgentOptions = {}): Promise<PiAgentDoneEvent> {
  const setupTimer = piTimer("worker runPiAgent setup");
  await ensureWorkerSharedCatalogs();
  setupTimer.mark("sharedCatalogs");
  const emit = (event: PiAgentEvent) => options.onEvent?.({ ...event, at: event.at ?? Date.now() });
  const base = request.project;
  const modernTilesetPolicy = request.modernTilesetOnly || requestsModernMap(base, request.task, [...request.mapIds, ...(request.currentMapId ? [request.currentMapId] : [])]) ? createModernTilesetPolicy(base) : undefined;
  // 지금 보는 맵·승인 계열은 실행기의 칩셋 계열 검사와 create_map 기본 칩셋이 읽는다(ToolContext 주석).
  const ctx: ToolContext = {
    project: structuredClone(base) as Project,
    ...(request.currentMapId && base.maps[request.currentMapId] ? { currentMapId: request.currentMapId } : {}),
    ...(request.approvedTilesetFamilies?.length ? { approvedTilesetFamilies: [...request.approvedTilesetFamilies] } : {}),
  };
  setupTimer.mark("clone");
  const referenceGate = new PiTilesetReferenceGate();
  const model = options.model ?? resolvePiModel(request.provider, request.model);
  // 어댑터와 코어 이벤트의 호출 id로 결과를 연결한다. 같은 이름의 병렬 호출도 섞지 않는다.
  const pendingSummaries = new Map<string, { ok: boolean; summary: string; result: unknown; visuals?: readonly ActivityVisual[] }>();
  const toolStartedAt = new Map<string, number>();
  // `tools` 는 Agent.initialState 에 참조로 들어가 state.tools === context.tools 가 된다.
  // 코어 루프가 매 턴 이 배열에서 요청을 만들므로, in-place push 가 곧 다음 턴의 선언이다 —
  // 배열 교체(setTools)는 진행 중 루프에 닿지 않는다(컨텍스트가 같은 배열을 잡고 있어서다).
  const tools: PiToolShape[] = [];
  const exposed = new Set<string>();
  const villageMapIds = new Set<string>();
  const interiorCompletion = new PiInteriorCompletion(!request.readOnly && !options.readOnlyTools && (!!modernTilesetPolicy || !!options.interiorRequirements), options.interiorRequirements);
  // let: 얼린 인자가 도구 규칙에 막히면 실행 도중 계약을 푼다(releaseContract). 풀린 뒤에는 일반 실행과 같다.
  let contract = request.readOnly || options.readOnlyTools || modernTilesetPolicy ? undefined : request.villageContract;
  let receipt: VillageDraftReceipt | undefined;
  let contractReleased: { readonly code: string; readonly message: string } | undefined;
  // 계약 지시가 든 시스템 프롬프트 줄. 계약을 풀면 이 줄을 해제 안내로 바꾼다 — 남겨 두면 「인자를 그대로 유지하라」가 계속 읽힌다.
  let contractPromptIndex = -1;
  const releaseContract = (blocker: { readonly code: string; readonly message: string }): void => {
    if (!contract) return;
    const released = contract;
    contract = undefined;
    contractReleased = blocker;
    if (contractPromptIndex >= 0) {
      systemPrompt[contractPromptIndex] = villageContractReleaseNotice(released, blocker);
      agent.setSystemPrompt([...systemPrompt]);
    }
    emit({ type: "execution_status", name: "village.contract_released", ok: false,
      summary: `마을 계약 해제 — 고정한 인자가 도구 규칙(${blocker.code})에 막혀 일반 실행으로 전환합니다: ${trimText(blocker.message, 240)}`,
      data: { code: blocker.code, target: released.args.target } });
  };
  // 묶음 실행이면 호출 시점에 묶음 밖 맵 변경을 거부한다(병합의 「범위 밖 변경 버림」은 최후 안전망으로 남는다).
  // 계약 범위거나 호출자가 병합한다고 알린 실행(mapBundleMerge)이면 켠다 — 판정은 piMapScopeGuard 한 곳.
  const scopeGuard = piMapScopeGuard(request);
  const allowedDefinitions = selectPiToolDefinitions(undefined, {
    readOnly: request.readOnly || options.readOnlyTools, toolNames: options.toolNames,
  });
  const shapeFor = (name: string): PiToolShape | undefined => {
    // 웹 검색은 레지스트리 셰이프가 순수 핸드오프라 네트워크가 없다 — 발견 경로도 실제 실행으로 보낸다.
    if (name === WEB_SEARCH_TOOL) {
      return allowedDefinitions.some(tool => tool.name === WEB_SEARCH_TOOL)
        ? wrapTool(createWebSearchTool({ codexApiKey: options.codexApiKey, onCall: recordCall }))
        : undefined;
    }
    const shape = resolvePiToolShape(ctx, name, {
      readOnly: request.readOnly || options.readOnlyTools,
      toolNames: options.toolNames,
      onCall: recordCall,
      referenceGate,
      modernTilesetPolicy,
      ...scopeGuard,
    });
    return shape ? wrapTool(shape) : undefined;
  };
  // Every discovered allowed schema must be declared; a silent quota breaks reachability.
  const declare = (shape: PiToolShape): void => {
    if (exposed.has(shape.name)) return;
    tools.push(shape);
    exposed.add(shape.name);
  };
  const recordCall = (record: PiToolCallRecord): void => {
    interiorCompletion.record(ctx.project, record);
    try { options.onToolCall?.(record); } catch { /* recording must never change the run */ }
    if (record.toolCallId) pendingSummaries.set(record.toolCallId, { ok: record.result.ok, summary: trimText(record.result.summary, 400), result: activityPayload(record.result), visuals: record.visuals });
    const villageMapId = authoredVillageMapId(record);
    if (villageMapId) villageMapIds.add(villageMapId);
    if (contract && !receipt) {
      receipt = villageDraftReceipt(record, ctx.project);
      // 「위로 올라가면 마을」: 새 마을이 서면 곧바로 출발 맵과 잇는다. 계약 실행은 모델의 출입구 쓰기를 막으므로
      // 코드가 한다. 연결까지 끝난 상태가 이후 「지형 불변」 검사의 기준이다(receipt.built).
      if (receipt && contract.connection) {
        const linked = connectContractVillage(ctx, base, {
          fromMapId: contract.connection.fromMapId,
          villageMapId: receipt.data.village.exteriorMapId,
          side: contract.connection.side,
          doorFronts: receipt.data.village.doorFronts ?? [],
        });
        emit({ type: "execution_status", name: "village.connection", ok: linked.ok, summary: linked.summary });
        if (linked.ok) receipt = { ...receipt, built: structuredClone(ctx.project), connection: linked.connection };
      }
      // 계약 인자 그대로 부른 시공이 대상·범위·칩셋·설계서 규칙에 거부되면 몇 번을 다시 불러도 같다 — 계약을 푼다.
      // 2026-09-28: 풀 길이 없어서 village-requires-scope 로 5번 헛돌았다.
      const blocker = receipt ? undefined : villageContractBlocker(contract, record);
      if (blocker) releaseContract(blocker);
    }
    // find_tools 수확 — 발견된 이름을 다음 턴 요청부터 실제로 선언한다(세션의 에스컬레이션 이식).
    // 빈 검색은 아무것도 얹지 않는다. 예전엔 전체 카탈로그(248개·≈113k 토큰)를 복원해 그 뒤 모든 호출이
    // 그만큼 무거워졌다. 이름을 아는 툴은 미노출이어도 직접 호출이 폴백으로 구제되고, 모르는 툴은 다른
    // 말로 다시 찾으면 된다 — 결과 요약이 그렇게 안내한다.
    if (record.name === "find_tools") {
      const names = harvestFindToolsNames(record.result);
      for (const name of names) {
        if (exposed.has(name)) continue;
        const shape = shapeFor(name);
        if (shape) declare(shape);
      }
    }
  };
  const incremental = !contract && !!request.applyMode && request.applyMode !== "review" && !request.readOnly && !options.readOnlyTools && !!options.onCheckpoint;
  let accepted = snapshotProjectKeepingHeavy(ctx.project);
  setupTimer.mark("snapshot");
  setupTimer.done();
  let rejected = false;
  const checkpoint = async (label: string, toolName: string, signal?: AbortSignal): Promise<void> => {
    if (!incremental || changedProjectKeys(accepted, ctx.project).length === 0) return;
    const scoped = request.scopeStrict !== false && request.mapIds.length > 0;
    const project = scoped ? mergeMapBundles(accepted, [{ mapIds: request.mapIds, project: ctx.project }]).project : ctx.project;
    if (scoped) authorMergedSpatialProposal(project, accepted);
    if (changedProjectKeys(accepted, project).length === 0) return;
    // 쓰기 도구는 매번 createDraft 로 전체를 복제하므로 정체성은 늘 다르다 — 내용으로 판정한다.
    // 안 그러면 타일셋 이미지(수십 MB)가 쓰기마다 체크포인트 한 줄에 실려 오간다.
    // tilesets 가 바뀌어도(마을이 숲 타일셋 하나에 이식을 더한다) 그대로인 타일셋은 빼고 보낸다(unchangedTilesetIds).
    const wire = slimProjectForWire(accepted, project);
    const unchangedKeys: PiCheckpointHeavyKey[] = wire.unchangedKeys;
    try {
      const published = await options.onCheckpoint!({
        project: structuredClone(wire.project) as Project,
        label, toolName, spatialProof: exportSpatialToolProof(project), unchangedKeys,
        ...(wire.unchangedTilesetIds.length ? { unchangedTilesetIds: wire.unchangedTilesetIds } : {}),
      }, signal ?? options.signal);
      // ACK 는 같은 모양으로 돌아온다 — 뺀 타일셋은 이쪽 사본에서 다시 붙인다.
      const merged = restoreCheckpointProject(project, published ?? project, unchangedKeys, wire.unchangedTilesetIds);
      ctx.project = merged;
      accepted = snapshotProjectKeepingHeavy(merged);
      finishSpatialToolAcceptance(ctx.project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // 내용 무결성 거부(commit-rejected)는 방금 그 도구의 변경 탓이다 — 체크포인트는 쓰기마다 돈다.
      // 실행 전체를 죽이지 말고 그 변경만 되돌린 뒤 도구 실패로 모델에게 돌려준다(2026-09-24:
      // upsert_event 하나의 movement.speed 누락이 38호출짜리 실행을 통째로 버렸다).
      // 권위·기준선·파괴 승인·중단은 실행 단위 문제라 그대로 중단한다.
      if (/^적용 실패\(commit-rejected\)/u.test(message) && !options.signal?.aborted) {
        ctx.project = snapshotProjectKeepingHeavy(accepted);
        throw new Error(`${message} — 이 도구의 변경은 적용 검증에서 거부돼 되돌렸습니다. 인자를 고쳐 다시 호출하세요.`);
      }
      rejected = true;
      fatal = message;
      agent.abort(fatal);
      throw error;
    }
  };
  const wrapTool = (tool: PiToolShape): PiToolShape => !incremental && !contract && tool.name !== "show_map_region" && tool.name !== "inspect_interior_layout" ? tool : ({ ...tool,
    async execute(id, params, signal) {
      // The core owns ordering: consecutive reads overlap; writes hold an exclusive
      // barrier through publication. A second queue here would serialize reads too.
      if (rejected) throw new Error("적용이 중단되었습니다.");
      signal?.throwIfAborted();
      if (contract && allowedDefinitions.some(def => def.name === tool.name && def.mode === "write")) {
        if (tool.name === "author_village" && !receipt) assertVillageContractArgs(contract, params);
        else if (tool.name !== "author_npc_cast" || !receipt) throw new Error("마을 계약: author_village로 시공하고 주민 대사만 보충하세요. 다른 쓰기는 별도 요청으로 진행합니다.");
      }
      const heldContract = !!contract;
      let result: Awaited<ReturnType<PiToolShape["execute"]>>;
      try {
        result = await tool.execute(id, params, signal);
      } catch (error) {
        // 이 호출이 계약을 풀었으면 모델이 읽는 바로 그 실패 결과에 해제 사실을 붙인다 — 다음 수를 여기서 정한다.
        if (heldContract && !contract && contractReleased) {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`${message}\n${systemPrompt[contractPromptIndex] ?? ""}`);
        }
        throw error;
      }
      if (tool.name === "show_map_region" || (tool.name === "inspect_interior_layout" && options.renderToolImage)) {
        if (!options.renderToolImage) throw new Error("맵 이미지 전달 경로가 없습니다. 배열만으로 시각 검토를 완료할 수 없습니다.");
        const inspectedMap = tool.name === 'inspect_interior_layout' ? ctx.project.maps[String((params as { mapId?: unknown }).mapId)] : undefined;
        const data = inspectedMap ? { mapId: inspectedMap.id, x: 0, y: 0, w: inspectedMap.width, h: inspectedMap.height } : (result.details as { data?: unknown } | undefined)?.data;
        const png = await options.renderToolImage(structuredClone(ctx.project), tool.name, data, signal ?? options.signal);
        result.content.push({ type: "image", mimeType: "image/png", data: png });
        if (png && data && typeof data === "object") interiorCompletion.recordPreview(ctx.project, data);
        options.onEvent?.({ type: "execution_status", name: "map.image.delivered", ok: true, summary: "현재 초안 이미지를 모델 도구 응답에 포함했습니다.", data: { toolCallId: id, base64Length: png.length } });
      }
      if (tool.concurrency === "exclusive" && request.applyMode !== "step") await checkpoint(tool.name, tool.name, signal);
      return result;
    },
  });
  const registryTools = createPiToolset(ctx, {
    domains: request.initialToolNames ? undefined : request.toolDomains,
    readOnly: request.readOnly || options.readOnlyTools,
    toolNames: request.initialToolNames
      ? allowedDefinitions.filter(tool => request.initialToolNames!.includes(tool.name) || TILESET_REFERENCE_READ_TOOLS.some(name => name === tool.name)).map(tool => tool.name)
      : options.toolNames,
    onCall: recordCall,
    referenceGate,
    modernTilesetPolicy,
    ...scopeGuard,
  });
  // 레지스트리 쪽 web_search 는 순수 핸드오프라 네트워크가 없다 — 아래 실제 실행 셰이프가 대신한다.
  // 둘을 함께 선언하면 같은 이름이 두 번 나가고 어느 쪽이 도는지가 순서에 달린다.
  tools.push(
    ...registryTools.filter(tool => tool.name !== WEB_SEARCH_TOOL).map(wrapTool),
    ...(options.extraTools ?? []),
  );
  if (allowedDefinitions.some(tool => tool.name === WEB_SEARCH_TOOL)) {
    // Codex 자격이 없어도 선언한다 — 툴이 실패 이유를 말하는 편이 "없는 툴" 보다 정직하다.
    declare(wrapTool(createWebSearchTool({ codexApiKey: options.codexApiKey, onCall: recordCall })));
  }
  if (incremental && request.applyMode === "step") tools.push(wrapTool({
    name: "finish_stage", label: "단계 적용",
    concurrency: "exclusive",
    description: "지형·건물/길·NPC/이벤트 등 의미 있는 한 단계를 마친 뒤 호출한다. 사용자 승인 전에는 다음 단계로 진행하지 않는다.",
    parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
    async execute(_id, params, signal) {
      await checkpoint(String((params as { title?: string }).title || "작업 단계"), "finish_stage", signal);
      return { content: [{ type: "text", text: "단계가 적용되었습니다. 다음 단계로 진행하세요." }] };
    },
  }));
  if (!request.readOnly && !options.readOnlyTools) tools.push({
    name: "set_build_spec", label: "공간 밑그림",
    description: "시공 전에 맵 위에 영역과 순서를 표시하는 밑그림을 제출한다. 타일을 변경하거나 시공을 승인하지 않는다. 실제 배치는 별도 쓰기 도구로 실행한다.",
    parameters: SET_BUILD_SPEC_TOOL.function.parameters,
    async execute(_id, params) {
      // Pi 의 밑그림은 표시용이다 — 타일을 바꾸지도, 시공을 승인·차단하지도 않는다. 그래서 형식이 깨진 명세
      // (코드 없는 오류: mapId·assets·필드 타입)만 거부하고, 맵 경계·교차·기존 내용 판정(코드 있는 오류)은
      // 표시한 뒤 경고로 돌려준다. r0735: 20×15 맵에 author_village 가 키울 64×40 마을을 그렸다가
      // 「맵 크기 밖」으로 통째로 거부됐고, 거부는 아무것도 지키지 않았다(밑그림 없이 시공은 그대로 진행).
      const issues = validateBuildSpec(ctx.project, params);
      const errors = issues.filter(issue => issue.severity === "error");
      const malformed = errors.filter(issue => !issue.code);
      if (malformed.length) throw new Error(`set_build_spec 형식 오류 — ${malformed.map(issue => issue.message).join(" / ")}`);
      const spec = normalizeBuildSpec(params as BuildSpec);
      const map = ctx.project.maps[spec.mapId];
      const growth = map && !spec.plannedMap && errors.some(issue => issue.code === "spec-asset-out-of-map") ? plannedGrowthForSpec(map, spec) : null;
      const advisories = [
        ...errors.map(issue => issue.message),
        ...(growth ? [growthGuidanceLine(spec.mapId, growth)] : []),
      ];
      emit({ type: "execution_status", name: "set_build_spec", ok: true, summary: "밑그림을 맵에 표시했습니다.", data: spec });
      const text = advisories.length
        ? `밑그림을 표시했습니다. 다만 지금 맵 기준으로 맞지 않는 곳이 있습니다(시공은 막지 않음):\n- ${advisories.join("\n- ")}\n시공 도구의 결과로 확인하세요.`
        : "밑그림을 표시했습니다. 이제 실제 시공 도구를 실행하세요.";
      return { content: [{ type: "text", text }] };
    },
  });
  for (const tool of tools) exposed.add(tool.name);
  const writer = contract ? undefined : request.roleModels?.writer;
  if (writer && !options.toolNames) {
    const writerTool = createWriterTool(writer, completeProvider,
      options.providerApiKeys?.[writer.provider] ?? (writer.provider === request.provider ? options.apiKey : undefined),
      gameDesignBriefContext(base.gameDesignBrief));
    tools.push(writerTool);
    exposed.add(writerTool.name);
  }
  const systemPrompt = request.systemPrompt
    ? [...request.systemPrompt]
    : buildPiAgentSystemPrompt(base, request.mapIds, request.scopeStrict !== false);
  if (modernTilesetPolicy) systemPrompt.push(modernTilesetPolicyPrompt(modernTilesetPolicy));
  if (allowedDefinitions.some(tool => tool.name === "find_tools")) {
    systemPrompt.push(buildToolCapabilityIndex(allowedDefinitions));
  }
  // 읽기 전용은 툴 목록으로 강제된다(options.readOnlyTools). 이 한 줄은 모델이 "왜 답만 하는지" 알게 한다 —
  // 이유를 모르면 쓰기를 시도하며 턴을 태운다.
  if (contract) contractPromptIndex = -1 + systemPrompt.push("[확정 마을 계약] 완료 검사는 코드가 자동 수행한다. evaluate_village_look는 요청을 모르는 미감 참고 도구이므로 이 작업에서는 호출하지 않는다. 시공과 대사가 성공하면 보고하고 종료한다. 별도 계획/미감 검수 없이 author_village → 주민 대사 → 완료 검사 순서로 진행한다. 다음 인자는 반드시 그대로 유지하고, 취향·테마·residents 대사는 사용자의 요청에 맞춰 추가한다. 처음부터 residents에 충분한 대사를 넣으면 추가 호출이 줄어든다. 구조 시공 성공 후에는 author_npc_cast로 누락 대사만 보충한다. " + JSON.stringify(contract.args) + (contract.residentDialogue === false ? " 사용자가 무언 주민을 요청했으므로 대사를 추가하지 않는다." : "")
    + (contract.referenceId ? ` author_village 에 referenceId:${JSON.stringify(contract.referenceId)} 를 함께 넘긴다 — 결과가 그 완성 마을 사례 그림과 크기·집 수 비교를 돌려준다. 보고에 사례와의 차이를 한 줄 적는다.` : "")
    + (contract.connection ? ` 이 마을은 새 맵이다. 시공이 성공하면 코드가 ${contract.connection.fromMapId}의 ${contract.connection.side} 끝과 마을의 반대쪽 끝을 양방향 출입구로 잇고 게임 시작을 ${contract.connection.fromMapId}에 둔다 — 출입구·시작 위치를 직접 만들지 말고, 보고할 때 두 맵이 이어졌다고 알린다.` : ""));
  if (request.readOnly) systemPrompt.push(READ_ONLY_INSTRUCTION);
  if (!request.readOnly && !options.readOnlyTools) systemPrompt.push("집·마을처럼 여러 영역을 시공할 때는 먼저 set_build_spec으로 실제 좌표와 buildOrder를 제출하여 사용자가 맵에서 밑그림을 보게 하라. 밑그림은 타일 배치가 아니다. 제출 후 반드시 실제 시공 도구를 실행하라. 단순 한 영역 칠하기는 도구 좌표로 작업 영역을 표시하므로 생략할 수 있다.");
  if (incremental && request.applyMode === "step") systemPrompt.push("작업을 지형, 건물·길, NPC·이벤트 등 의미 있는 단계로 나누고 각 단계를 끝낼 때 반드시 finish_stage를 호출하라. 승인 결과를 받기 전 다음 단계의 쓰기 도구를 호출하지 마라. 도구 호출마다 승인받지 말고 작업 단위로 묶어라.");
  if (request.applyMode === "yolo") systemPrompt.push("YOLO: 별도 검수·승인 요청 없이 요청한 변경을 최대한 실행하라. 사용자 범위와 데이터 형식은 지켜라.");
  if (writer && tools.some(tool => tool.name === "consult_writer")) systemPrompt.push("You are Deep, responsible for careful implementation and validation. For story, lore, NPC dialogue or quest prose, consult_writer delegates authorship to Writer. Pass relevant context, then apply its output using project tools. Do not call Writer for mechanical work.");
  const apiKey = options.providerApiKeys ? options.providerApiKeys[request.provider] : options.apiKey;
  // 사고 강도는 여기서 한 번 낮춘다 — 레인·팀·CLI 호출자가 자기 요청을 짜도 antigravity 실행이 죽지 않게 한다.
  // 실측(2026-09-26): "off" 를 보내면 HTTP 200 스트림에 error 이벤트 `Thinking effort off is not supported by
  // google-antigravity/gemini-3.8-flash. Supported efforts: minimal, low, medium, high` 가 실려 첫 턴에서 끝난다.
  const thinkingLevel = normalizePiThinkingLevel(request.provider, request.thinkingLevel);
  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      ...(thinkingLevel ? { thinkingLevel: thinkingLevel as never } : {}),
      tools: tools as never,
    },
    ...(apiKey ? { getApiKey: () => apiKey as never } : {}),
    ...(options.streamFn ? { streamFn: options.streamFn } : {}),
    // 실행 하나 = 캐시 세션 하나. 제공자 프롬프트 캐시(prompt_cache_key 등)가 이 id 로 같은 접두부를 묶는다 —
    // 없으면 매 호출 도구 스키마·시스템 프롬프트 전체가 새로 과금됐다.
    sessionId: `oprn-${randomUUID()}`,
    onPayload: ((payload: unknown) => {
      const outgoing = request.provider === "google-antigravity"
        ? antigravityToolEnumPayload(String((model as { id?: string }).id ?? ""), tools)(payload)
        : payload;
      referenceGate.payload(outgoing);
      // Observe the actual provider payload after normalization, not a rebuilt prompt.
      try {
        emit({ type: "prompt_inspection", snapshot: inspectPromptPayload(outgoing,
          "Pi provider payload · 전송 시도", String((model as { id?: string }).id ?? ""),
          [apiKey ?? "", ...Object.values(options.providerApiKeys ?? {}).filter((key): key is string => Boolean(key))]) });
      } catch { /* inspection must never change provider behavior */ }
      return outgoing;
    }) as never,
    // 미노출 툴 호출 구제 — 축소 노출(core+도메인) 아래서 모델이 find_tools 없이 곧바로 이름을
    // 쳐도, 레지스트리에 있고 실행 경계(readOnly·toolNames) 안이면 실제로 실행된다.
    // 경계 밖 이름은 undefined → 평범한 "tool not found" 결과가 모델의 자가수정을 돌린다.
    resolveFallbackTool: (name: string) => {
      const shape = shapeFor(name);
      if (shape && !exposed.has(name)) declare(shape);
      return shape as never;
    },
  });
  const maxTurns = request.maxTurns ?? DEFAULT_MAX_TURNS;
  let turns = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let usage: PiAgentUsage | undefined;
  let fatal: string | undefined;
  // 제공자 스트림이 도중에 끊긴 오류. 실행을 끝내지 않고 같은 기록 위에서 이어 가기 턴을 연다(providerRetry.ts).
  let resumeAfter: string | undefined;
  let providerRetries = 0;
  const started = Date.now();
  emit({ type: "start", provider: request.provider, model: String((model as { id?: string }).id ?? ""), toolCount: tools.length });
  // 모델 스트림 조각은 버리지 않고 합쳐 중계한다 — 이게 없어서 모델이 생각하는 동안 와이어가 비었다(실측 2026-09-14).
  const deltas = createDeltaRelay(emit);
  // 캔버스 시공 표시(고스트)의 재료. 결과 프로젝트는 맨 끝 `done` 에만 실리므로, 툴마다 «바뀐 칸만»
  // 흘리지 않으면 브라우저 캔버스는 턴이 끝날 때까지 조용하다(2026-09-17 회귀: Pi 가 조수 채팅의
  // 유일한 실행 경로가 된 뒤 시공 표시가 통째로 사라졌다).
  //
  // 섀도우를 한 번만 복제하고 증분으로 따라가는 이유: 툴마다 전체를 다시 복제하면 43맵 프로젝트에서
  // 툴 호출 하나가 수십 MB 복제가 된다. 여기서는 diff 가 어차피 훑는 것만 훑고, 적용은 바뀐 칸뿐이다.
  let ghostShadow = structuredClone(base.maps ?? {}) as Record<string, GameMap>;
  const emitMapDelta = (): number => {
    const changes = diffMapsForDelta(ghostShadow, ctx.project.maps ?? {});
    if (changes.length === 0) return 0;
    ghostShadow = applyMapDeltas(ghostShadow, changes);
    emit({ type: "map_delta", maps: changes });
    return changes.length;
  };
  const repeats = new PiRepeatBreaker();
  const toolArgs = new Map<string, unknown>();
  const unsubscribe = agent.subscribe((event: { type: string; [key: string]: unknown }) => {
    if (event.type === "message_update") {
      const part = event.assistantMessageEvent as { type?: string; delta?: unknown } | undefined;
      if (part?.type === "thinking_delta" || part?.type === "text_delta") {
        deltas.push(part.type === "thinking_delta" ? "thinking" : "text", typeof part.delta === "string" ? part.delta : "");
      }
      return;
    }
    if (event.type === "turn_start" || event.type === "tool_execution_start" || event.type === "message_end") deltas.flush();
    if (event.type === "turn_start") {
      turns += 1;
      emit({ type: "turn", index: turns });
      if (turns > maxTurns) {
        // abort 에 사유를 실어야 한다. 사유 없이 부르면 pi-agent-core 가 합성하는 aborted 메시지의
        // errorMessage 가 일반 문구 "Request was aborted" 가 되고, 아래 message_end 가 그것을 사용자에게
        // 보낸다(실측 2026-09-17: 「마을 만들어달라」가 균형 레벨 16턴을 넘길 때마다 그 영문만 보였다).
        fatal = `턴 상한(${maxTurns})을 넘어 중단했습니다.`;
        agent.abort(fatal);
      }
      return;
    }
    if (event.type === "tool_execution_start") {
      toolCalls += 1;
      toolStartedAt.set(String(event.toolCallId ?? ""), Date.now());
      emit({ type: "tool_start", id: String(event.toolCallId ?? ""), name: String(event.toolName ?? ""), args: event.args });
      toolArgs.set(String(event.toolCallId ?? ""), event.args);
      return;
    }
    if (event.type === "tool_execution_end") {
      if (event.isError) toolErrors += 1;
      const name = String(event.toolName ?? "");
      const callId = String(event.toolCallId ?? "");
      const record = pendingSummaries.get(callId);
      pendingSummaries.delete(callId);
      const toolAt = toolStartedAt.get(callId);
      toolStartedAt.delete(callId);
      // A registry write can succeed but its publication can still be rejected.
      // In that case the core's failure must override the earlier draft receipt.
      const publicationFailed = event.isError && record?.ok;
      emit({
        type: "tool_end",
        result: publicationFailed ? activityPayload(event.result) : record?.result ?? activityPayload(event.result),
        visuals: record?.visuals,
        ...(toolAt === undefined ? {} : { durationMs: Date.now() - toolAt }),
        id: String(event.toolCallId ?? ""),
        name,
        ok: !event.isError && (record?.ok ?? true),
        // 실패 사유를 요약에 싣는다 — 일반 문구만 남기면 녹화(tools.jsonl)로 원인을 알 수 없었다
        // (r0735: rename_switch·set_build_spec 의 인자 오류, show_map_region 의 이미지 경로 부재).
        summary: withErrorDetail(
          publicationFailed ? "변경 적용 실패 또는 실행 중단" : record?.summary ?? (event.isError ? "실행 실패(인자 검증 또는 예외)" : ""),
          event.isError && (publicationFailed || !record) ? toolErrorText(event.result) : "",
        ),
      });
      // 순서 계약: 무엇을 했나(tool_end) 다음에 무엇이 바뀌었나(map_delta). 브라우저 다리가
      // 실행 중 도구 이름을 먼저 세우고 그 아래 칸을 그린다.
      const changed = emitMapDelta() > 0;
      const args = toolArgs.get(callId);
      toolArgs.delete(callId);
      const repeat = repeats.observe(name, args, changed);
      if (repeat?.action === "steer") {
        emit({ type: "execution_status", name: "repeat_guard", ok: false, summary: repeat.message });
        agent.steer({ role: "user", content: [{ type: "text", text: repeat.message }], timestamp: Date.now() });
      } else if (repeat?.action === "stop") {
        fatal = fatal ?? repeat.message;
        agent.abort(fatal);
      }
      return;
    }
    if (event.type === "message_end") {
      const message = event.message as { role?: string; content?: unknown[]; usage?: unknown; stopReason?: string; errorMessage?: string } | undefined;
      if (!message || message.role !== "assistant") return;
      referenceGate.complete(message.stopReason !== "error" && message.stopReason !== "aborted" && !message.errorMessage && !options.signal?.aborted);
      const text = (message.content ?? [])
        .filter((part): part is { type: "text"; text: string } => !!part && typeof part === "object" && (part as { type?: string }).type === "text")
        .map((part) => part.text)
        .join("");
      if (text.trim()) emit({ type: "assistant", text });
      usage = addPiAgentUsage(usage, message.usage);
      if (message.stopReason === "error" || message.errorMessage) {
        // 우리가 먼저 정한 사유(턴·시간 상한, 클라이언트 끊김)가 있으면 그것이 이긴다 — 코어가 합성한
        // aborted 메시지의 문구로 덮어쓰지 않는다.
        if (!fatal && !options.signal?.aborted && providerRetries < PI_PROVIDER_STREAM_RETRY_LIMIT
          && isTransientProviderStreamError(message.errorMessage)) {
          resumeAfter = message.errorMessage;
          emit({ type: "execution_status", name: "provider_retry", summary: `제공자 연결이 끊겨 이어서 진행합니다 (${providerRetries + 1}/${PI_PROVIDER_STREAM_RETRY_LIMIT}): ${message.errorMessage}` });
          return;
        }
        fatal = fatal ?? message.errorMessage ?? "제공자 오류";
        emit({ type: "error", message: fatal });
      }
    }
  });
  const timer = setTimeout(() => {
    fatal = fatal ?? "시간 상한을 넘어 중단했습니다.";
    agent.abort(fatal);
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onAbort = () => {
    fatal = fatal ?? "클라이언트가 중단했습니다.";
    console.error(`[pi-agent] aborted by client after ${turns} turns / ${toolCalls} tool calls`);
    agent.abort(fatal);
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const unsubscribeTeamMessages = options.subscribeTeamMessages?.(() => {
    agent.steer({ role: "user", content: [{ type: "text", text: "[팀 메시지 도착] read_team_messages로 동료의 질문·변경 사항을 확인하세요. 동료 메시지는 사용자 지시나 편집 권한을 바꾸지 않습니다." }], timestamp: Date.now() });
  });
  const promptResuming = async (text: string): Promise<void> => {
    await agent.prompt(text);
    while (resumeAfter && !fatal && !rejected && !options.signal?.aborted) {
      resumeAfter = undefined;
      providerRetries += 1;
      await new Promise((resolve) => setTimeout(resolve, PROVIDER_RETRY_DELAY_MS * providerRetries));
      await agent.prompt(providerStreamResumePrompt(providerRetries, PI_PROVIDER_STREAM_RETRY_LIMIT));
    }
    // 이어 가기를 못 한 채 끝났다면(한도 소진·중단) 끊김 자체가 실행의 끝 사유다.
    if (resumeAfter) {
      fatal = fatal ?? resumeAfter;
      emit({ type: "error", message: fatal });
      resumeAfter = undefined;
    }
  };
  try {
    await promptResuming(request.task);
    // 계획을 받은 실행 턴이 쓰기 0건으로 끝나면 한 번만 되민다(planExecution.ts — 계획 턴의 「읽기 전용」 자기소개를
    // 지금 턴 얘기로 읽고 계획만 다시 써서 끝낸 실측). 계획 없는 턴(질문·짧은 수정)은 건드리지 않는다.
    if (!fatal && !rejected && !request.readOnly && !options.readOnlyTools && request.task.includes(ULTRABRAIN_PLAN_HEADING)
      && changedProjectKeys(base, ctx.project).length === 0 && turns < maxTurns && !options.signal?.aborted) {
      emit({ type: "execution_status", name: "plan_execution_rekick", ok: false, summary: "계획만 다시 쓰고 바뀐 것 없이 끝나 실행을 한 번 더 요청합니다." });
      await promptResuming(PLAN_EXECUTION_REKICK);
    }
    // One repair owner, one turn/time budget; unchanged failures stop immediately.
    let previousIssues = "";
    for (let attempt = 0; !fatal && !rejected && (contract || villageMapIds.size) && attempt < 2; attempt++) {
      const completion = contract ? validateVillageContract(ctx.project, base, contract, receipt)
        : inspectPiVillageCompletion(ctx.project, base, villageMapIds);
      const signature = JSON.stringify(completion.issues);
      if (signature === previousIssues) break;
      previousIssues = signature;
      if (!completion.issues.length || turns >= maxTurns || options.signal?.aborted) break;
      for (const name of ["author_npc_cast", "find_events", "get_event", "find_tools"]) {
        const shape = shapeFor(name);
        if (shape) declare(shape);
      }
      await promptResuming(piVillageRepairPrompt(ctx.project, base, completion, receipt?.data.village.residentEventIds));
    }
    // 배치 품질은 권고 한 번뿐이다 — 거부하지 않고, 두 번째 결과는 숫자만 알린다(layoutQuality.ts).
    if (!fatal && !rejected && !contract && !request.readOnly && turns < maxTurns && !options.signal?.aborted) {
      const describe = (issues: typeof layout) => issues.map(i => `${i.mapId} ${[...i.problems, ...(i.pack ?? [])].join(", ")}`).join(" / ");
      let layout = inspectPiLayoutQuality(ctx.project, base, request.mapIds, villageMapIds);
      // 팩 세트 맵(check_pack_map)은 좌표가 붙은 확실한 결함이라 한 번 더 권고한다(같은 결과면 멈춘다). 나머지는 한 번뿐.
      for (let round = 0; layout.length && round < 2 && turns < maxTurns && !options.signal?.aborted; round++) {
        if (round > 0 && !layout.some(i => i.pack?.length)) break;
        emit({ type: "execution_status", name: "layout_quality", ok: false, summary: `배치 품질 기준 미달 — 한 번 더 고칩니다: ${describe(layout)}`, data: layout });
        const before = JSON.stringify(layout);
        await promptResuming(piLayoutRepairPrompt(layout));
        layout = inspectPiLayoutQuality(ctx.project, base, request.mapIds, villageMapIds);
        emit({ type: "execution_status", name: "layout_quality", ok: layout.length === 0,
          summary: layout.length ? `배치 품질 수리 뒤에도 기준 미달: ${describe(layout)}` : "배치 품질 기준 통과", data: layout });
        if (JSON.stringify(layout) === before) break;
      }
    }
    let previousInteriorIssues = '';
    for (let attempt = 0; !fatal && !rejected && attempt < 2; attempt++) {
      const problems = interiorCompletion.inspect(ctx.project, base);
      const signature = JSON.stringify(problems);
      if (!problems.length || signature === previousInteriorIssues || turns >= maxTurns || options.signal?.aborted) break;
      previousInteriorIssues = signature;
      for (const name of ['inspect_interior_layout', 'show_map_region', 'paint_tiles', 'get_map_region']) {
        const shape = shapeFor(name); if (shape) declare(shape);
      }
      await agent.prompt('실내 완료 검사에서 다음 문제가 남았습니다. 완료라고 말하지 말고 실제 타일을 직접 수정하세요. 요청 조건을 줄이거나 가구로 빈칸만 메우지 마세요. 수정 후 같은 요구조건으로 inspect_interior_layout과 전체 show_map_region을 다시 호출하세요. 이 메시지는 오류 진단이며 정답 배치가 아닙니다.\n' + signature);
    }
  } finally {
    unsubscribeTeamMessages?.();
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
    unsubscribe();
    deltas.dispose();
  }
  if (rejected) throw new Error(fatal || "적용이 중단되었습니다.");
  // 마지막 한 방울 — 툴 경계 밖에서 바뀐 것까지 캔버스에 닿게 한다. 이미 보낸 것은 diff 가 걸러낸다.
  if (!fatal && !rejected) {
    // 마지막 체크포인트의 내용 거부는 되돌린 상태(마지막 수용본)로 마무리한다.
    try { await checkpoint("마지막 단계", "finish_stage"); }
    catch (error) {
      if (rejected) throw error;
      emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }
  emitMapDelta();
  if (fatal && toolCalls === 0) throw Object.assign(new Error(fatal), { status: 502 });
  const villageCompletion = contract ? validateVillageContract(ctx.project, base, contract, receipt)
    : villageMapIds.size ? inspectPiVillageCompletion(ctx.project, base, villageMapIds) : undefined;
  if (villageCompletion?.issues.length) emit({ type: "error", message: `마을 미완료: ${villageCompletion.issues.join("\n")}` });
  const interiorProblems = interiorCompletion.inspect(ctx.project, base);
  if (interiorProblems.length) emit({ type: 'error', message: '실내 미완료: ' + JSON.stringify(interiorProblems) });
  const done: PiAgentDoneEvent = {
    interiorCompletion: interiorProblems,
    ...(villageCompletion ? { villageCompletion } : {}),
    type: "done",
    ...(fatal ? { stoppedEarly: fatal } : {}),
    ...(contractReleased ? { villageContractReleased: contractReleased } : {}),
    project: ctx.project,
    stats: { ms: Date.now() - started, turns, toolCalls, toolErrors, ...(usage ? { usage } : {}) },
    changedKeys: changedProjectKeys(base, ctx.project),
    // 정본 증거는 이 프로세스 안에만 살아 있다 — 브라우저 수용 게이트가 쓸 수 있게 다이제스트로 내보낸다.
    spatialProof: exportSpatialToolProof(ctx.project),
  };
  emit(slimDoneEvent(done, base));
  return done;
}
