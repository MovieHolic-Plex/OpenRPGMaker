import { requestsEmeraldMonsterGame, MONSTER_GAME_INITIAL_TOOLS, MONSTER_GAME_PRODUCTION_PROMPT } from './monsterGameRequest';
// 평문 조수 턴의 순수 부분 — 의도 선언 → 실행 계획, 그리고 Pi 요청(계획 턴·실행 턴) 조립.
//
// 채팅 패널(`aiChatPanel.plainPiTurn` + `aiPiAgentCommand.runPiCommand`)과 헤드리스 생성기
// (`scripts/qa-game/gen.mts`)가 **같은 함수**를 부른다. 문장·상수를 두 곳에 베끼면 헤드리스 결과가
// 브라우저 결과를 대표하지 못한다 — 여기 하나만 고치면 두 경로가 같이 바뀐다.

import { conceptCardsForText } from "../conceptCards";
import { packTownTargetFor } from "./packTownRoute";
import { beodeulTownTargetFor } from "./beodeulTownRoute";
import type { AutonomyResolution } from "@/ai/autonomyLevels";
import { formatIntentAudit, type IntentSelectionFact } from "@/ai/intentDeclaration";
import { buildIntentFacts, declareIntentCached, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { RoleModel } from "@/ai/modelRoles";
import { buildSessionRegistryTools } from "@/ai/sessionToolExposure";
import { isLivedMap } from "@/editor/tools/livedMap";
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
import { MODERN_MAP_INITIAL_TOOLS, requestsModernMap } from '../modernTilesetPolicy';
import { JP_CITY_EXPOSED_TOOLS, jpCityTargetFor } from '../jpCityPolicy';
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { KIT_AREA_EXPOSED_TOOLS, kitAreaNote } from "@/editor/tools/kitAreaTools";
import { PLAN_EXECUTION_PREAMBLE, ULTRABRAIN_PLAN_HEADING } from "./planExecution";

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

const GENRE_PRESET_ROUTING = "intent:skipped(genre-preset) → 게임 전체 저작";
/** 계획 턴이 의도 목록과 상관없이 쥐는 읽기 도구. 나머지는 find_tools 로 찾는다. */
export const PLAN_READ_TOOLS = ["get_project_summary", "get_map_region", "tile_query", "find_tools"] as const;

export interface PlainPiTurnInput {
  readonly project: Project;
  readonly text: string;
  readonly currentMapId: string | null;
  readonly selection: IntentSelectionFact | null;
  readonly hasActivePlan: boolean;
  readonly autonomy: AutonomyResolution;
  /** 계획 전용 턴 이외에 요청 의도와 위치 안내 권한을 읽는다. */
  readonly declarer: () => IntentDeclarer;
  readonly piTeam: boolean;
  /** 선언 호출 직전 — 패널은 「의도 읽는 중…」 을 띄운다. */
  readonly onDeclaring?: () => void;
  /** 실행 모델의 컨텍스트 창. 주면 폴백 의도라도 창에 안 들어가는 전체 카탈로그를 보내지 않는다(buildSessionRegistryTools). */
  readonly contextWindow?: number;
}

export interface PlainPiTurnClassification {
  readonly mode: PiAgentMode;
  readonly plan: PiRunPlan;
  readonly questionPromoted: boolean;
  readonly initialToolNames?: readonly string[];
  readonly intentNote: string | null;
  /**
   * 이 턴을 어떻게 읽었는지 한 줄(`intent:llm mode=… construction=… → 마을 계약 …`). 활동 로그의 첫 상태 행이 된다.
   * 2026-09-28 실측: 「위로 올라가면 마을」이 잘못 읽혀 5번 헛돌았는데 사용 로그에는 판정이 한 줄도 없어서
   * 원인을 코드로 역추적해야 했다. 선언을 부르지 않은 턴(장르 프리셋·읽기 전용)은 그 사실을 적는다.
   */
  readonly routingAudit: string;
}

/** 평문 한 줄 → 실행 계획. 팀 비트는 설정에서, 읽기 전용·계획은 자율성 다이얼에서 온다. */
export async function classifyPlainPiTurn(input: PlainPiTurnInput): Promise<PlainPiTurnClassification> {
  let plan = resolvePiRunPlan(input.autonomy);
  let questionPromoted = false;
  let initialToolNames: readonly string[] | undefined;
  let intentNote: string | null = null;
  // 장르 프리셋 첫 요청(「장르 프리셋: …」)은 답이 정해져 있다: 게임 전체를 새로 만드는 다단계 작업이다.
  // 의도 선언은 모델을 두 번 불러 10~24초를 쓰고, 30초 창을 넘기면 첫 생성이 시작조차 못 한다(2026-09-27 실측).
  // 도구는 좁히지 않는다(initialToolNames 없음 = 전체) — 게임 전체 저작은 DB·시스템·맵 도구를 모두 쓴다.
  if (!plan.readOnly && requestsEmeraldMonsterGame(input.text)) {
    const routingAudit = "intent:emerald-monster-game → 전체72맵/60종 제작";
    // One producer owns shared world/DB/session; never scatter a fresh campaign across map bundles.
    return { mode: "single", plan: { ...plan, routineEdit: false, routingAudit }, questionPromoted: false,
      initialToolNames: [...MONSTER_GAME_INITIAL_TOOLS], intentNote: MONSTER_GAME_PRODUCTION_PROMPT, routingAudit };
  }
  if (isGenrePresetBriefRequest(input.text)) {
    const team = input.piTeam && !plan.readOnly;
    return { mode: team ? "team" : "single", plan: { ...plan, routineEdit: false, routingAudit: GENRE_PRESET_ROUTING }, questionPromoted: false, intentNote: null,
      routingAudit: GENRE_PRESET_ROUTING };
  }
  let routingAudit = plan.planOnly ? "intent:skipped(plan-only dial)" : "intent:none";
  if (!plan.planOnly) {
    input.onDeclaring?.();
    const { project, text, currentMapId, selection } = input;
    const declared = await declareIntentCached(input.declarer(), buildIntentFacts({
      project,
      userText: text,
      currentMapId,
      selection,
      hasActivePlan: input.hasActivePlan,
    }));
    if (declared.intent.source === "fallback" && !plan.readOnly) throw new Error(declared.error ?? "요청 범위를 확정하지 못했습니다. 다시 시도해 주세요.");
    plan = { ...plan, viewNavigation: declared.intent.source === "llm" && declared.intent.viewNavigation === true };
    // 선언이 확정한 것을 본문도 읽게 한다 — 세션 경로의 pushOrchestrationMessage(intentNote) 와 같은 자리.
    // Pi 이관(2026-09-11)에서 빠져 author_village·권장 크기·선택 사각형 지시가 모델에 닿지 않았다(2026-09-17 실측).
    const noteTargetMapId = declared.intent.targetMapId ?? currentMapId;
    const noteTargetMap = noteTargetMapId ? project.maps[noteTargetMapId] : undefined;
    // 선언이 숲마을 도구를 고른 «마을» 요청일 때만 — 팩 맵에서 가로등 하나 고치는 요청에 마을 노트를 붙이지 않는다.
    const packTown = declared.intent.tools.includes("author_village") ? packTownTargetFor(project, text, noteTargetMapId) : null;
    // 일본 도시(jp_city) — 대상 맵이 jp_city 이거나 사용자가 칩셋·일본 거리를 말했을 때. 숲마을 계약·버들항 노트 대신 jp_city 노트가 간다(jpCityPolicy).
    // 실측(2026-10-04): 새 프로젝트(버들항 맵)에서 「일본 상가 거리」+author_village 선언이면 버들항 마을 노트가 먼저 잡아 jp_city 는 어디에도 안 나왔다 — 그래서 버들항보다 앞선다.
    // PAW 전용 게이트가 켜진 요청은 게이트가 이기고, 팩 도시 타일셋 마을은 그쪽이 이긴다.
    const modernMap = requestsModernMap(project, text, currentMapId ? [currentMapId] : []);
    const jpCity = packTown || modernMap ? null
      : jpCityTargetFor(project, declared.intent, text, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    // 팩 마을·jp_city 가 아니고 대상 계열이 버들항이면 author_beodeul_town — 숲마을 생성기·마을 계약을 건너뛴다(beodeulTownRoute).
    const beodeulTown = packTown || jpCity ? null
      : beodeulTownTargetFor(project, declared.intent, noteTargetMapId, noteTargetMap ? isLivedMap(noteTargetMap) : false);
    intentNote = buildPiIntentNote({
      project,
      packTown,
      beodeulTown,
      jpCity,
      requestText: text,
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
    // 숲마을 author_village 의 「마을 계약」은 2026-10-07 저작권 정리로 시공기와 함께 지웠다 — 마을은 author_beodeul_town 이 짓는다.
    routingAudit = `${formatIntentAudit(declared.intent, declared.elapsedMs)}${declared.error ? ` — 선언 오류: ${declared.error}` : ""}`
      + (beodeulTown ? " → 버들항 마을" : jpCity ? " → 일본 도시 맵" : modernMap ? " → 현대 맵" : "");
    if (declared.intent.mode === "question") {
      plan = { ...plan, readOnly: true };
      questionPromoted = true;
    } else {
      // Send exact intent/adventure candidates through the real Pi request path.
      // This is exposure only: discovery can expand it, including full fallback.
      initialToolNames = modernMap
        ? [...MODERN_MAP_INITIAL_TOOLS]
        : [...new Set([
          ...buildSessionRegistryTools({ requestText: text, intent: declared.intent, contextWindow: input.contextWindow }).map(tool => tool.function.name),
          // jp_city 작업은 첫 요청부터 조립 도구·참고문서·도로 키트 스키마가 보인다 — 자연어 점수 승격은 «이자카야 빌딩 세워줘» 같은 문장을 놓친다.
          ...(jpCity ? JP_CITY_EXPOSED_TOOLS : []),
        ])];
      // 개념 카드 노트가 붙는 요청이면 예제를 짓는 도구를 처음부터 쥐여 준다 — 노트가 이 도구 이름을 부른다.
      if (conceptCardsForText(text).length && !initialToolNames.includes("build_concept_example")) initialToolNames = [...initialToolNames, "build_concept_example"];
      // 키트 시트 야외 맵(몬스터 수집 마을 등)의 빈 터 꾸미기 — 도구를 보이게 하고 노트로 이름을 부른다(2026-10-07 이어 고치기 r8~r11).
      const kitNote = kitAreaNote(project, noteTargetMapId);
      if (kitNote) {
        initialToolNames = [...new Set([...initialToolNames, ...KIT_AREA_EXPOSED_TOOLS])];
        intentNote = intentNote ? `${intentNote}\n\n${kitNote}` : kitNote;
      }
    }
  }
  const team = input.piTeam && !plan.readOnly;
  return { mode: team ? "team" : "single", plan: { ...plan, routingAudit }, questionPromoted, ...(initialToolNames ? { initialToolNames } : {}), intentNote, routingAudit };
}

/** Ultrabrain 계획 턴을 먼저 돌리는가 — 단독·쓰기·비일상 실행만. */
export function needsUltrabrainPlanTurn(input: {
  readonly readOnly: boolean;
  readonly team: boolean;
  readonly routineEdit: boolean;
  readonly applyMode: PiApplyMode;
}): boolean {
  return !input.readOnly && !input.team && !input.routineEdit && input.applyMode !== "yolo";
}

export interface UltrabrainModel {
  readonly providerId?: string;
  readonly model: string;
  readonly reasoningEffort?: string;
}

/** 계획 턴 요청(읽기 전용). */
export function buildUltrabrainPlanRequest(input: {
  readonly projectKey?: string;
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
    mode: "single", provider: input.brain.providerId!, model: input.brain.model, projectKey: input.projectKey,
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

/** 실행 턴이 읽는 지시문 = 모델 지시 + 「지금은 실행 턴」 + Ultrabrain 계획(planExecution.ts). */
export function withUltrabrainPlan(modelTask: string, plan: string): string {
  return `${modelTask}\n\n${PLAN_EXECUTION_PREAMBLE}\n\n${ULTRABRAIN_PLAN_HEADING}\n${plan}`;
}

/** 실행 턴(또는 계획 전용 턴) 요청. */
export function buildPiRunRequest(input: {
  readonly projectKey?: string;
  readonly team: boolean;
  readonly planOnly?: boolean;
  readonly readOnly: boolean;
  readonly applyMode: PiApplyMode;
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
    projectKey: input.projectKey,
    applyMode: input.applyMode,
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
