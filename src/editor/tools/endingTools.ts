import { compileCutscene, CutsceneValidationError, type CutsceneBeat } from "@/editor/cutscene";
import { collectEndingWarnings } from "@/project/endings";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { EndingCondition, EndingDef, Project } from "@/project/types";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const VARIABLE_OPS = new Set(["==", ">=", "<=", ">", "<", "!="]);

const defineEnding: ToolDefinition = {
  name: "define_ending",
  description:
    "프로젝트 엔딩을 선언한다. conditions는 switch/variable 조건 배열이며, triggerEnding은 조건을 만족한 엔딩 중 priority가 가장 높은 엔딩을 선택한다. epilogue는 script_cutscene beat 배열이다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      conditions: { type: "array", items: { type: "object" } },
      priority: { type: "integer", description: "높을수록 우선. 기본 0" },
      epilogue: { type: "array", description: "CutsceneBeat[]", items: { type: "object" } },
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
    const conditions = parseEndingConditions(draft, args.conditions);
    const priority = typeof args.priority === "number" ? Math.trunc(args.priority) : 0;
    const epilogue = parseEpilogue(draft, args.epilogue);
    const ending: EndingDef = {
      id,
      name,
      conditions,
      priority,
      ...(epilogue ? { epilogue } : {}),
    };
    draft.endings ??= [];
    const index = draft.endings.findIndex((entry) => entry.id === id);
    if (index >= 0) draft.endings[index] = ending;
    else draft.endings.push(ending);
    const warnings = collectEndingWarnings(draft.endings);
    return {
      summary: `엔딩 '${name}' 정의 ${index >= 0 ? "수정" : "추가"} — 조건 ${conditions.length}개, priority ${priority}`,
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

function parseEndingConditions(project: Project, value: unknown): EndingCondition[] {
  if (!Array.isArray(value)) throw new ToolError("conditions는 switch/variable 조건 배열이어야 합니다.", { code: "ending-conditions" });
  return value.map((entry, index) => parseEndingCondition(project, entry, index));
}

function parseEndingCondition(project: Project, value: unknown, index: number): EndingCondition {
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
  if (condition.kind === "switch" && !project.switches.some((entry) => entry.id === condition.switchId)) {
    throw new ToolError(`conditions[${index}].switchId가 존재하지 않습니다: ${condition.switchId}`, { code: "ending-switch" });
  }
  if (condition.kind === "variable") {
    if (!project.variables.some((entry) => entry.id === condition.variableId)) {
      throw new ToolError(`conditions[${index}].variableId가 존재하지 않습니다: ${condition.variableId}`, { code: "ending-variable" });
    }
    if (!VARIABLE_OPS.has(condition.op)) {
      throw new ToolError(`conditions[${index}].op가 잘못되었습니다: ${condition.op}`, { code: "ending-variable-op" });
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
