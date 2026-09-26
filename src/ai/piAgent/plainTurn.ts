// 평문 조수 턴의 순수 부분 — 의도 선언 → 실행 계획, 그리고 Pi 요청(계획 턴·실행 턴) 조립.
//
// 채팅 패널(`aiChatPanel.plainPiTurn` + `aiPiAgentCommand.runPiCommand`)과 헤드리스 생성기
// (`scripts/qa-game/gen.mts`)가 **같은 함수**를 부른다. 문장·상수를 두 곳에 베끼면 헤드리스 결과가
// 브라우저 결과를 대표하지 못한다 — 여기 하나만 고치면 두 경로가 같이 바뀐다.

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
// 정의는 잎 모듈(`./thinkingLevel`)에 둔다 — Bun 워커가 같은 함수를 권위 경계에서 부르는데, 이 파일은
// 편집기 모듈(sessionToolExposure·authorVillageScope)을 끌고 와서 워커가 임포트하면 그 프로세스가 깨질 수 있다.
// 기존 호출자·테스트가 이 모듈에서 쓰던 이름을 그대로 쓰도록 다시 내보낸다.
export { normalizePiThinkingLevel } from "./thinkingLevel";
import { normalizePiThinkingLevel } from "./thinkingLevel";
import { resolveVillageContract, type VillageContract } from "./villageContract";
import { MODERN_MAP_INITIAL_TOOLS, requestsModernMap } from '../modernTilesetPolicy';

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
    intentNote = buildPiIntentNote({
      project,
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
    plan = { ...plan, villageContract: requestsModernMap(project, text, currentMapId ? [currentMapId] : []) ? undefined : resolveVillageContract(project, declared.intent, currentMapId, selection ?? null, text) };
    if (declared.intent.mode === "question") {
      plan = { ...plan, readOnly: true };
      questionPromoted = true;
    } else {
      // Send exact intent/adventure candidates through the real Pi request path.
      // This is exposure only: discovery can expand it, including full fallback.
      initialToolNames = requestsModernMap(project, text, currentMapId ? [currentMapId] : [])
        ? [...MODERN_MAP_INITIAL_TOOLS]
        : buildSessionRegistryTools({ requestText: text, intent: declared.intent }).map(tool => tool.function.name);
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
  readonly approvedTilesetFamilies?: readonly string[];
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly maxTurns?: number;
  readonly initialToolNames?: readonly string[];
}): PiAgentRequest {
  return {
    mode: "single", provider: input.brain.providerId!, model: input.brain.model,
    task: `${PLAN_ONLY_PREFIX}${input.modelTask}`, mapIds: input.mapIds,
    ...(input.currentMapId ? { currentMapId: input.currentMapId } : {}), project: input.project,
    ...(input.approvedTilesetFamilies?.length ? { approvedTilesetFamilies: input.approvedTilesetFamilies } : {}),
    scopeStrict: input.scopedByUser,
    readOnly: true, maxTurns: Math.min(input.maxTurns ?? PLAN_MAX_TURNS, PLAN_MAX_TURNS),
    thinkingLevel: input.brain.reasoningEffort as PiAgentThinkingLevel,
    ...(input.initialToolNames ? { initialToolNames: [...new Set([...input.initialToolNames, ...PLAN_READ_TOOLS])] } : {}),
  };
}

/**
 * 자율성 다이얼이 역할 저장값(Deep)을 이겨도 되는가. 「저장값이 있나」로는 판정할 수 없다 —
 * 설정 모달의 `collect()` 가 저장마다 역할 3개를 모두 쓰므로(aiSettingsModal), 설정을 한 번이라도
 * 만진 사용자는 전원 `roleModels.deep` 을 갖는다. 그래서 「저장값이 폴백과 다른가」로 본다:
 * 세 항목(공급자·모델·사고 강도)이 폴백과 같으면 사용자가 고른 것이 아니라 모달이 적어 준 값이다.
 * `derived` 는 호출자가 `modelForRole({ ...config, roleModels: undefined }, "deep")` 로 넘긴다.
 */
export function prefersCallerThinking(stored: RoleModel | undefined, derived: RoleModel): boolean {
  if (!stored) return true;
  return stored.provider === derived.provider && stored.model === derived.model
    && stored.thinkingLevel === derived.thinkingLevel;
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
  readonly approvedTilesetFamilies?: readonly string[];
  readonly project: Project;
  readonly scopedByUser: boolean;
  readonly mapBundleMerge: boolean;
  readonly maxTurns?: number;
  readonly toolDomains?: readonly string[];
  readonly initialToolNames?: readonly string[];
  readonly teamSpec?: PiTeamSpec;
  /** 자율성 다이얼이 푼 사고 강도(`resolvePiRunPlan(...).thinkingLevel`). `preferCallerThinking` 없이는 쓰이지 않는다. */
  readonly callerThinkingLevel?: PiAgentThinkingLevel;
  /** 다이얼을 역할·Ultrabrain 설정보다 앞세운다. 두 입력을 다 비운 옛 호출자는 예전 그대로 역할 값을 쓴다. */
  readonly preferCallerThinking?: boolean;
}): PiAgentRequest {
  const brainRun = input.planOnly || input.team;
  const effectiveProvider = brainRun ? input.brain.providerId! : input.deep.provider;
  // 다이얼을 안 실은 턴은 여전히 역할 값이다 — 계획·팀 턴은 Ultrabrain 강도로 돌아서 계획을 몰래 낮추지 않는다.
  const roleLevel = (brainRun ? input.brain.reasoningEffort : input.deep.thinkingLevel) as PiAgentThinkingLevel;
  // 다이얼은 **실행 턴만** 움직인다 — brainRun(계획 턴·팀 턴)은 다이얼을 실어도 Ultrabrain 강도를 지킨다.
  // 자율성 「확인」은 planOnly + reasoningEffort "low" 로 풀리고 패널은 그때도 preferCallerThinking 을
  // 같이 실으므로(aiPiAgentCommand 의 실행 턴 요청), brainRun 을 안 빼면 Ultrabrain 계획이 high → low 로
  // 조용히 떨어진다(2026-09-26 리뷰 실측). 두 입력을 다 비운 옛 호출자는 여전히 역할 값 그대로다.
  const level = !brainRun && input.preferCallerThinking && input.callerThinkingLevel ? input.callerThinkingLevel : roleLevel;
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
    ...(input.approvedTilesetFamilies?.length ? { approvedTilesetFamilies: input.approvedTilesetFamilies } : {}),
    project: input.project,
    // 평문 턴의 기본 대상 맵은 계약이 아니다 — 계약으로 읽히면 모델이 DB·시스템을 손대지 않는다.
    scopeStrict: input.scopedByUser,
    ...(input.mapBundleMerge ? { mapBundleMerge: true } : {}),
    ...(input.readOnly ? { readOnly: true } : {}),
    ...(input.maxTurns === undefined ? {} : { maxTurns: input.maxTurns }),
    thinkingLevel: normalizePiThinkingLevel(effectiveProvider, level),
    ...(input.toolDomains && input.toolDomains.length > 0 ? { toolDomains: input.toolDomains } : {}),
    ...(input.initialToolNames ? { initialToolNames: input.initialToolNames } : {}),
    ...(input.teamSpec ? { team: input.teamSpec } : {}),
  };
}
