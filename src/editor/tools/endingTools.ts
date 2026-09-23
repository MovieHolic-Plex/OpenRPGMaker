import { validateEndingPresentation } from "@/project/io/shapeDatabaseFields";
import type { EndingPresentation } from "@/project/cinematicSettings";
import { compileCutscene, CutsceneValidationError, type CutsceneBeat } from "@/editor/cutscene";
import { collectEndingWarnings } from "@/project/endings";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { EndingCondition, EndingDef, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { CONDITION_SCHEMA, CUTSCENE_BEAT_SCHEMA } from "./schemaShapes";

const VARIABLE_OPS = new Set(["==", ">=", "<=", ">", "<", "!="]);

const defineEnding: ToolDefinition = {
  name: "define_ending",
  description:
    '엔딩 정의만 저장한다. define_ending이나 setSwitch만으로는 실행되지 않는다. ' +
    '도달 가능한 이벤트 commands에 {"kind":"triggerEnding","endingId":"조회한 엔딩 id"}를 넣으면 해당 엔딩을 직접 실행한다. ' +
    'endingId 없는 {"kind":"triggerEnding"}은 switch/variable conditions를 만족한 엔딩 중 priority가 가장 높은 항목을 선택한다. ' +
    'epilogue는 script_cutscene beat 배열이다. 아이템을 소비하는 출구는 완료 스위치로 선택되는 상위 페이지를 두어 재조사 시 재잠김·중복 소비를 막는다. ' +
    '정의 후 연결 전은 유효한 중간 편집이지만, 완료 전에는 실제 에필로그·종료와 재조사를 플레이로 검증해야 한다.',
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      conditions: { type: "array", description: "switch/variable 조건", items: CONDITION_SCHEMA },
      priority: { type: "integer", description: "높을수록 우선. 기본 0" },
      presentation: {
        type: "object", additionalProperties: false,
        description: "에필로그 뒤의 마지막 화면. credits는 줄바꿈을 유지하는 크레딧. tone은 warm 또는 dark.",
        properties: { musicResourceId: { type: "string" }, tone: { type: "string", enum: ["warm", "dark"] }, credits: { type: "string", maxLength: 20000 }, backgroundResourceId: { type: "string" } },
      },
      epilogue: { type: "array", description: "CutsceneBeat[]", items: CUTSCENE_BEAT_SCHEMA },
    },
    required: ["id", "name", "conditions"],
  },
  invalidArgsExample: {
    id: "ending_true",
    name: "진 엔딩",
    priority: 10,
    conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
    epilogue: [{ kind: "say", speaker: "나", text: "문이 열렸다." }],
  },
  run(draft, args): ToolExecResult {
    const id = cleanId(args.id);
    const name = cleanName(args.name);
    const flagWarnings: string[] = [];
    const conditions = parseEndingConditions(draft, args.conditions, flagWarnings);
    const priority = typeof args.priority === "number" ? Math.trunc(args.priority) : 0;
    const epilogue = parseEpilogue(draft, args.epilogue);
    const prior = draft.endings?.find(entry => entry.id === id);
    const presentation = args.presentation === undefined ? prior?.presentation : args.presentation as EndingPresentation;
    if (presentation !== undefined) {
      try { validateEndingPresentation(presentation); } catch (error) { throw new ToolError(String(error), { code: "invalid-args" }); }
      if (presentation.musicResourceId && !collectResourceIds(draft).has(presentation.musicResourceId)) throw new ToolError("엔딩 음악 리소스를 찾을 수 없습니다.", { code: "invalid-args" });
      if (presentation.backgroundResourceId && !collectResourceIds(draft).has(presentation.backgroundResourceId)) throw new ToolError("엔딩 배경 리소스를 찾을 수 없습니다.", { code: "invalid-args" });
    }
    const ending: EndingDef = {
      id,
      name,
      conditions,
      priority,
      ...(epilogue ? { epilogue } : {}),
      ...(presentation ? { presentation: structuredClone(presentation) } : {}),
    };
    draft.endings ??= [];
    const index = draft.endings.findIndex((entry) => entry.id === id);
    if (index >= 0) draft.endings[index] = ending;
    else draft.endings.push(ending);
    const warnings = [...flagWarnings, ...collectEndingWarnings(draft.endings)];
    return {
      summary: `엔딩 '${name}' 정의 ${index >= 0 ? "수정" : "추가"} — 조건 ${conditions.length}개, priority ${priority}. 이벤트 commands의 triggerEnding 호출이 있어야 실행됩니다.`,
      data: { ending, warnings },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const listEndings: ToolDefinition = {
  name: "list_endings",
  description: "프로젝트 엔딩 레지스트리를 나열하고 조건 충돌/priority 그림자 warning을 함께 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {},
  },
  run(project): ToolExecResult {
    const endings = project.endings ?? [];
    const warnings = collectEndingWarnings(endings);
    return {
      summary: `엔딩 ${endings.length}개`,
      data: { endings, warnings },
    };
  },
};

function cleanId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError("id(문자열)가 필요합니다.", { code: "ending-id" });
  return value.trim();
}

function cleanName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new ToolError("name(문자열)가 필요합니다.", { code: "ending-name" });
  return value.trim();
}

function parseEndingConditions(project: Project, value: unknown, warnings: string[]): EndingCondition[] {
  if (!Array.isArray(value)) throw new ToolError("conditions는 switch/variable 조건 배열이어야 합니다.", { code: "ending-conditions" });
  return value.map((entry, index) => parseEndingCondition(project, entry, index, warnings));
}

function parseEndingCondition(project: Project, value: unknown, index: number, warnings: string[]): EndingCondition {
  try {
    validateConditionShape(`conditions[${index}]`, value);
  } catch (cause) {
    throw new ToolError(`conditions[${index}] 형식이 올바르지 않습니다: ${cause instanceof Error ? cause.message : String(cause)}`, {
      code: "ending-condition-shape",
    });
  }
  const condition = value as EndingCondition;
  if (condition.kind !== "switch" && condition.kind !== "variable") {
    throw new ToolError(`conditions[${index}]는 switch 또는 variable 조건이어야 합니다.`, { code: "ending-condition-kind" });
  }
  // 아직 없는 플래그를 참조하면 만들어 준다. 엔딩 조건은 보통 "앞으로 켜질" 플래그를 가리키므로
  // 존재 여부로 막으면 순서 교착이 생긴다(2026-08-23 실측: 존재하지 않는 sw_clear 로 define_ending 거부).
  // create_quest/compile_puzzle 이 쓰는 ensureNamed* 와 같은 방침이다.
  if (condition.kind === "switch" && !project.switches.some((entry) => entry.id === condition.switchId)) {
    ensureNamedSwitch(project, condition.switchId, `엔딩 조건: ${condition.switchId}`);
    warnings.push(`conditions[${index}].switchId '${condition.switchId}' 가 없어 새로 만들었습니다.`);
  }
  if (condition.kind === "variable") {
    if (!project.variables.some((entry) => entry.id === condition.variableId)) {
      ensureNamedVariable(project, condition.variableId, `엔딩 조건: ${condition.variableId}`);
      warnings.push(`conditions[${index}].variableId '${condition.variableId}' 가 없어 새로 만들었습니다.`);
    }
    if (!VARIABLE_OPS.has(condition.op)) {
      throw new ToolError(
        `conditions[${index}].op가 잘못되었습니다: ${condition.op}. 허용: ${[...VARIABLE_OPS].join(", ")}`,
        { code: "ending-variable-op" },
      );
    }
  }
  return structuredClone(condition);
}

function parseEpilogue(project: Project, value: unknown): Record<string, unknown>[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ToolError("epilogue는 beat 배열이어야 합니다.", { code: "ending-epilogue" });
  const beats = value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ToolError(`epilogue[${index}]는 객체여야 합니다.`, { code: "ending-epilogue-beat" });
    }
    return structuredClone(entry) as Record<string, unknown>;
  });
  const eventIds = new Set<string>();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) eventIds.add(event.id);
  }
  try {
    compileCutscene(beats as CutsceneBeat[], { context: { eventIds, resourceIds: collectResourceIds(project) } });
  } catch (cause) {
    if (cause instanceof CutsceneValidationError) {
      throw new ToolError(`epilogue 검증 실패: ${cause.reasons.join(" / ")}`, { code: "ending-epilogue-validation" });
    }
    throw cause;
  }
  return beats;
}

export const ENDING_TOOLS: readonly ToolDefinition[] = [defineEnding, listEndings];
