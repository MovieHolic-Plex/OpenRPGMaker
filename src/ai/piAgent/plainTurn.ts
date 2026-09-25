// 평문 조수 턴의 순수 부분 — 의도 선언 → 실행 계획, 그리고 Pi 요청(계획 턴·실행 턴) 조립.
//
// 채팅 패널(`aiChatPanel.plainPiTurn` + `aiPiAgentCommand.runPiCommand`)과 헤드리스 생성기
// (`scripts/qa-game/gen.mts`)가 **같은 함수**를 부른다. 문장·상수를 두 곳에 베끼면 헤드리스 결과가
// 브라우저 결과를 대표하지 못한다 — 여기 하나만 고치면 두 경로가 같이 바뀐다.

import { packTownTargetFor } from "./packTownRoute";
import type { AutonomyResolution } from "@/ai/autonomyLevels";
import type { IntentSelectionFact } from "@/ai/intentDeclaration";
import { buildIntentFacts, declareIntentCached, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { RoleModel } from "@/ai/modelRoles";
import { buildSessionRegistryTools } from "@/ai/sessionToolExposure";
import { isLivedMap } from "@/editor/tools/authorVillageScope";
import type { Project } from "@/project/types";
import type { PiApplyMode } from "./applyMode";
import { buildPiIntentNote, resolvePiRunPlan, type PiRunPlan } from "./executionRoute";
import type { PiAgentMode, PiAgentRequest, PiAgentThinkingLevel } from "./protocol";
import type { PiTeamSpec } from "./teamSpec";
import { resolveVillageContract, type VillageContract } from "./villageContract";

/**
 * 계획 턴의 지시문 머리. Pi 에는 세션 플래너가 없으므로 «실행하지 말고 계획만» 을 말로 만든다 —
 * 강제는 툴 목록이 한다(request.readOnly). 계획은 도구 결과가 아니라 말로 남으므로 항목 목록을 요구한다.
 */
export const PLAN_ONLY_PREFIX = "[계획 턴] 이번 실행에서는 프로젝트를 바꾸지 않는다. 쓰기 도구가 제공되지 않는다. "
  + "요청을 실행 순서가 있는 항목 목록으로만 보고하라. 각 항목은 «무엇을 · 어디에 · 왜» 를 담고, 마지막에 예상 위험을 한 줄로 적어라. ";

/**
 * 계획 턴의 턴 상한. 계획은 말로만 남고 읽은 도구 결과는 실행 턴에 넘어가지 않는다 — 실행 턴이 어차피
 * 다시 읽는다. 예전엔 실행과 같은 상한(최대 200턴)을 받아 계획 하나에 수십 번 읽기가 쌓였다.
 */
export const PLAN_MAX_TURNS = 30;
/** 계획 턴이 의도 목록과 상관없이 쥐는 읽기 도구. 나머지는 find_tools 로 찾는다. */
export const PLAN_READ_TOOLS = ["get_project_summary", "get_map_region", "tile_query", "find_tools"] as const;

export interface PlainPiTurnInput {
  readonly project: Project;
  readonly text: string;
  readonly currentMapId: string | null;
  readonly selection: IntentSelectionFact | null;
  readonly hasActivePlan: boolean;
  readonly autonomy: AutonomyResolution;
  /** 쓰기 턴에서만 부른다(읽기 전용 다이얼은 선언을 건너뛴다). */
  readonly declarer: () => IntentDeclarer;
  readonly piTeam: boolean;
  /** 선언 호출 직전 — 패널은 「의도 읽는 중…」 을 띄운다. */
  readonly onDeclaring?: () => void;
}

export interface PlainPiTurnClassification {
  readonly mode: PiAgentMode;
  readonly plan: PiRunPlan;
  readonly questionPromoted: boolean;
  readonly initialToolNames?: readonly string[];
  readonly intentNote: string | null;
}

/** 평문 한 줄 → 실행 계획. 팀 비트는 설정에서, 읽기 전용·계획은 자율성 다이얼에서 온다. */
export async function classifyPlainPiTurn(input: PlainPiTurnInput): Promise<PlainPiTurnClassification> {
  let plan = resolvePiRunPlan(input.autonomy);
  let questionPromoted = false;
  let initialToolNames: readonly string[] | undefined;
  let intentNote: string | null = null;
  if (!plan.readOnly) {
    input.onDeclaring?.();
    const { project, text, currentMapId, selection } = input;
    const declared = await declareIntentCached(input.declarer(), buildIntentFacts({
      project,
      userText: text,
      currentMapId,
      selection,
      hasActivePlan: input.hasActivePlan,
    }));
    if (declared.intent.source === "fallback") throw new Error(declared.error ?? "요청 범위를 확정하지 못했습니다. 다시 시도해 주세요.");
    // 선언이 확정한 것을 본문도 읽게 한다 — 세션 경로의 pushOrchestrationMessage(intentNote) 와 같은 자리.
    // Pi 이관(2026-09-11)에서 빠져 author_village·권장 크기·선택 사각형 지시가 모델에 닿지 않았다(2026-09-17 실측).
    const noteTargetMapId = declared.intent.targetMapId ?? currentMapId;
    const noteTargetMap = noteTargetMapId ? project.maps[noteTargetMapId] : undefined;
    // 선언이 숲마을 도구를 고른 «마을» 요청일 때만 — 팩 맵에서 가로등 하나 고치는 요청에 마을 노트를 붙이지 않는다.
    const packTown = declared.intent.tools.includes("author_village") ? packTownTargetFor(project, text, noteTargetMapId) : null;
    intentNote = buildPiIntentNote({
      project,
      packTown,
      intent: declared.intent,
      targetMap: noteTargetMap
        ? { id: noteTargetMap.id, width: noteTargetMap.width, height: noteTargetMap.height, lived: isLivedMap(noteTargetMap) }
        : null,
      selection: selection ?? null,
    });
    // 계획 필요 여부가 규모 기준이다. 단순 생성도 수정과 같은 경로를 쓰며 실패·모호함은 제외한다.
    plan = { ...plan, routineEdit: !declared.error && declared.intent.source === "llm"
      && (declared.intent.mode === "create" || declared.intent.mode === "modify")
      && declared.intent.needsPlan === false
      && declared.intent.clarify === null };
    plan = { ...plan, villageContract: resolveVillageContract(project, declared.intent, currentMapId, selection ?? null, text) };
    if (declared.intent.mode === "question") {
      plan = { ...plan, readOnly: true };
      questionPromoted = true;
    } else {
      // Send exact intent/adventure candidates through the real Pi request path.
      // This is exposure only: discovery can expand it, including full fallback.
      initialToolNames = buildSessionRegistryTools({ requestText: text, intent: declared.intent })
        .map(tool => tool.function.name);
    }
  }
  const team = input.piTeam && !plan.readOnly;
  return { mode: team ? "team" : "single", plan, questionPromoted, ...(initialToolNames ? { initialToolNames } : {}), intentNote };
}

/** Ultrabrain 계획 턴을 먼저 돌리는가 — 단독·쓰기·비일상 실행만. */
export function needsUltrabrainPlanTurn(input: {
  readonly villageContract?: VillageContract;
  readonly readOnly: boolean;
  readonly team: boolean;
  readonly routineEdit: boolean;
  readonly applyMode: PiApplyMode;
}): boolean {
  return !input.villageContract && !input.readOnly && !input.team && !input.routineEdit && input.applyMode !== "yolo";
}

export interface UltrabrainModel {
  readonly providerId?: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}

/** 계획 턴 요청(읽기 전용). */
export function buildUltrabrainPlanRequest(input: {
  readonly brain: UltrabrainModel;
  readonly modelTask: string;
  readonly mapIds: readonly string[];
  readonly currentMapId?: string;
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly maxTurns?: number;
  readonly initialToolNames?: readonly string[];
}): PiAgentRequest {
  return {
    mode: "single", provider: input.brain.providerId!, model: input.brain.model,
    task: `${PLAN_ONLY_PREFIX}${input.modelTask}`, mapIds: input.mapIds,
    ...(input.currentMapId ? { currentMapId: input.currentMapId } : {}), project: input.project,
    scopeStrict: input.scopedByUser,
    readOnly: true, maxTurns: Math.min(input.maxTurns ?? PLAN_MAX_TURNS, PLAN_MAX_TURNS),
    thinkingLevel: input.brain.reasoningEffort as PiAgentThinkingLevel,
    ...(input.initialToolNames ? { initialToolNames: [...new Set([...input.initialToolNames, ...PLAN_READ_TOOLS])] } : {}),
  };
}

/** 실행 턴이 읽는 지시문 = 모델 지시 + Ultrabrain 계획. */
export function withUltrabrainPlan(modelTask: string, plan: string): string {
  return `${modelTask}\n\nUltrabrain 실행 계획:\n${plan}`;
}

/** 실행 턴(또는 계획 전용 턴) 요청. */
export function buildPiRunRequest(input: {
  readonly team: boolean;
  readonly planOnly?: boolean;
  readonly readOnly: boolean;
  readonly applyMode: PiApplyMode;
  readonly villageContract?: VillageContract;
  readonly brain: UltrabrainModel;
  readonly deep: RoleModel;
  readonly writer: RoleModel;
  readonly modelTask: string;
  readonly executionTask: string;
  readonly mapIds: readonly string[];
  readonly currentMapId?: string;
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly mapBundleMerge: boolean;
  readonly maxTurns?: number;
  readonly toolDomains?: readonly string[];
  readonly initialToolNames?: readonly string[];
  readonly teamSpec?: PiTeamSpec;
}): PiAgentRequest {
  const brainRun = input.planOnly || input.team;
  return {
    mode: input.team ? "team" : "single",
    applyMode: input.applyMode,
    villageContract: input.villageContract,
    provider: brainRun ? input.brain.providerId! : input.deep.provider,
    model: brainRun ? input.brain.model : input.deep.model,
    ...(!input.planOnly ? { roleModels: { deep: input.deep, writer: input.writer } } : {}),
    task: input.planOnly ? `${PLAN_ONLY_PREFIX}${input.modelTask}` : input.executionTask,
    mapIds: input.mapIds,
    ...(input.currentMapId ? { currentMapId: input.currentMapId } : {}),
    project: input.project,
    // 평문 턴의 기본 대상 맵은 계약이 아니다 — 계약으로 읽히면 모델이 DB·시스템을 손대지 않는다.
    scopeStrict: input.scopedByUser,
    ...(input.mapBundleMerge ? { mapBundleMerge: true } : {}),
    ...(input.readOnly ? { readOnly: true } : {}),
    ...(input.maxTurns === undefined ? {} : { maxTurns: input.maxTurns }),
    thinkingLevel: (brainRun ? input.brain.reasoningEffort : input.deep.thinkingLevel) as PiAgentThinkingLevel,
    ...(input.toolDomains && input.toolDomains.length > 0 ? { toolDomains: input.toolDomains } : {}),
    ...(input.initialToolNames ? { initialToolNames: input.initialToolNames } : {}),
    ...(input.teamSpec ? { team: input.teamSpec } : {}),
  };
}
