// editor/tools/questTools.ts
// 퀘스트 골격 툴(Phase 1). 본격 DSL 컴파일러는 Phase 3.
// create_quest_flags: 스위치 sw_<key>_started/_done + 변수 var_<key>_progress 자동 등록.

import { compileQuest } from "@/project/quest/questCompiler";
import {
  extractQuestGraphConditions,
  findQuestById,
  generateQuestWalkthrough,
  lintQuestById,
  normalizeQuestGraph,
} from "@/project/quest/questGraph";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { storyFlagById } from "@/project/storyFlags";
import type { Project } from "@/project/types";
import { isStepQuestDef, questDefId, type QuestGraphDef } from "@/project/quest/questDef";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { parseQuestDef, QUEST_DEF_SCHEMA, QUEST_DEF_HINT, QUEST_DEF_EXAMPLE, QUEST_GRAPH_CONDITION_SCHEMA, QUEST_GRAPH_HINT } from "./questToolSchemas";

// 호환용 재수출(기존 소비자 대비).
export { ensureNamedVariable };

export function questSwitchIds(questKey: string): { started: string; done: string; progress: string } {
  return {
    started: `sw_${questKey}_started`,
    done: `sw_${questKey}_done`,
    progress: `var_${questKey}_progress`,
  };
}

const createQuestFlags: ToolDefinition = {
  name: "create_quest_flags",
  description: "퀘스트용 스위치(sw_<key>_started/_done)와 진행 변수(var_<key>_progress)를 자동 등록한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      questKey: { type: "string", description: "퀘스트 키(영문/숫자/밑줄)" },
      steps: { type: "integer", description: "총 단계 수(진행 변수 상한 안내용)" },
    },
    required: ["questKey", "steps"],
  },
  run(draft, args): ToolExecResult {
    const questKey = args.questKey as string;
    if (!/^[a-zA-Z0-9_]+$/.test(questKey)) throw new ToolError("questKey는 영문/숫자/밑줄만 허용합니다.", { code: "quest-key" });
    const steps = args.steps as number;
    const ids = questSwitchIds(questKey);
    ensureNamedSwitch(draft, ids.started, `퀘스트 시작: ${questKey}`);
    ensureNamedSwitch(draft, ids.done, `퀘스트 완료: ${questKey}`);
    ensureNamedVariable(draft, ids.progress, `퀘스트 진행: ${questKey} (0~${steps})`);
    return {
      summary: `퀘스트 '${questKey}' 플래그 등록(${ids.started}/${ids.done}, ${ids.progress})`,
      data: { ...ids, steps },
    };
  },
};

const createQuest: ToolDefinition = {
  name: "create_quest",
  description: "선언적 QuestDef로 퀘스트 이벤트·진행 플래그·단계 메타를 함께 만든다. talk는 target, collect는 sources, kill은 at가 필수. 생성 후 같은 ID로 define_quest를 호출하지 마세요. 그래프를 저장하는 도구는 define_quest이고 create_quest는 단계 정의를 보존한다. 단계형 자동 완주 검증은 현재 지원하지 않는다.",
  mode: "write",
  invalidArgsExample: QUEST_DEF_EXAMPLE,
  invalidArgsHint: QUEST_DEF_HINT,
  parameters: {
    type: "object",
    properties: { def: QUEST_DEF_SCHEMA },
    required: ["def"],
  },
  run(draft, args): ToolExecResult {
    const def = parseQuestDef(args.def);
    try {
      const result = compileQuest(draft, def);
      return {
        summary: `퀘스트 '${def.title}' 컴파일 — 이벤트 ${result.eventsCreated}개, 단계 ${def.steps.length}개`,
        data: { questId: def.key, kind: "steps", stepCount: def.steps.length, flags: result.flags, eventsCreated: result.eventsCreated },
        ...(result.warnings.length > 0 ? { warnings: [...result.warnings] } : {}),
      };
    } catch (cause) {
      throw new ToolError(`퀘스트 컴파일 실패: ${cause instanceof Error ? cause.message : String(cause)}`, { code: "quest-compile" });
    }
  },
};

const defineQuest: ToolDefinition = {
  name: "define_quest",
  description: "퀘스트 그래프를 등록한다. 노드 completesWhen은 switch/variable 조건 또는 storyFlag 참조를 받으며, 그래프는 DAG만 허용한다.",
  mode: "write",
  invalidArgsExample: {
    id: "q-mayor-errand",
    title: "촌장의 부탁",
    nodes: [{ id: "talk-chief", description: "촌장과 대화", completesWhen: { kind: "storyFlag", flagId: "talked-chief", value: true } }],
    edges: [],
  },
  invalidArgsHint: QUEST_GRAPH_HINT,
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            description: { type: "string" },
            completesWhen: QUEST_GRAPH_CONDITION_SCHEMA,
            activatesFlags: { type: "array", items: { type: "string" } },
          },
          required: ["id", "description", "completesWhen"],
        },
      },
      edges: {
        type: "array",
        items: {
          type: "object",
          properties: { from: { type: "string" }, to: { type: "string" } },
          required: ["from", "to"],
        },
      },
    },
    required: ["id", "title", "nodes", "edges"],
  },
  run(draft, args): ToolExecResult {
    let graph: QuestGraphDef;
    try {
      graph = normalizeQuestGraph(draft, args);
    } catch (cause) {
      throw new ToolError(`퀘스트 그래프 정의 실패: ${cause instanceof Error ? cause.message : String(cause)} — ${QUEST_GRAPH_HINT}`, { code: "quest-graph-define" });
    }
    if (isStepQuestDef(findQuestById(draft, graph.id))) {
      throw new ToolError(`퀘스트 '${graph.id}'는 create_quest로 저작한 단계 정의입니다. define_quest로 덮으면 기존 단계가 사라지므로 교체할 수 없습니다. 수정은 create_quest의 전체 def를 사용하세요.`, { code: "quest-kind-conflict" });
    }
    linkStoryFlagsToQuest(draft, graph);
    draft.quests = [...(draft.quests ?? []).filter((quest) => questDefId(quest) !== graph.id), graph];
    return {
      summary: `퀘스트 그래프 등록: ${graph.title} (${graph.nodes.length} nodes, ${graph.edges.length} edges)`,
      data: { quest: graph },
    };
  },
};

const lintQuest: ToolDefinition = {
  name: "lint_quest",
  description: "퀘스트 그래프 하나의 dead-end, 도달 불가, 고아 노드 lint를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { questId: { type: "string" } },
    required: ["questId"],
  },
  run(project, args): ToolExecResult {
    const questId = args.questId as string;
    try {
      const issues = lintQuestById(project, questId);
      const errors = issues.filter((issue) => issue.severity === "error").length;
      const warnings = issues.filter((issue) => issue.severity === "warning").length;
      return { summary: `quest lint ${questId}: error ${errors}건 / warning ${warnings}건`, data: { questId, issues } };
    } catch (cause) {
      throw new ToolError(cause instanceof Error ? cause.message : String(cause), { code: "quest-lint" });
    }
  },
};

const generateWalkthroughTool: ToolDefinition = {
  name: "generate_walkthrough",
  description: "퀘스트 그래프를 위상 순서로 따라가며 run_scene_test 입력 JSON을 생성한다. 자동 유도 불가 구간은 manualHint가 붙은 set 스텝으로 폴백한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { questId: { type: "string" } },
    required: ["questId"],
  },
  run(project, args): ToolExecResult {
    const questId = args.questId as string;
    try {
      const walkthrough = generateQuestWalkthrough(project, questId);
      return {
        summary: `walkthrough 생성: ${questId} (${walkthrough.scenario.steps.length} steps, manual ${walkthrough.manualHints.length})`,
        data: walkthrough,
      };
    } catch (cause) {
      throw new ToolError(`walkthrough 생성 실패: ${cause instanceof Error ? cause.message : String(cause)}`, { code: "quest-walkthrough" });
    }
  },
};

const verifyQuestTool: ToolDefinition = {
  name: "verify_quest",
  description: "퀘스트 그래프의 선언된 노드를 run_scene_test로 실행한다. 수동 debug set이 필요한 구간은 미검증(data.ok=false)이며, 그래프에 선언하지 않은 목표는 검증 범위에 포함되지 않는다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: { questId: { type: "string" } },
    required: ["questId"],
  },
  run(project, args): ToolExecResult {
    const questId = args.questId as string;
    try {
      const walkthrough = generateQuestWalkthrough(project, questId);
      const result = runSceneTest(project, {
        mapId: walkthrough.scenario.mapId,
        start: walkthrough.scenario.start,
        steps: walkthrough.scenario.steps as SceneStep[],
      });
      const manualCount = Math.max(walkthrough.manualHints.length, walkthrough.scenario.steps.filter((step) => step.kind === "set").length);
      const manual = manualCount > 0;
      const verified = result.ok && !manual;
      return {
        summary: manual
          ? `quest verify 미검증: ${questId} — 수동 검증 ${manualCount}건. debug set으로 대체한 단계는 완주 증거가 아닙니다.`
          : result.ok
            ? `quest verify 성공: ${questId} (선언된 노드 ${walkthrough.nodes.length}개, ${result.stepsRun}/${result.totalSteps} steps)`
            : `quest verify 실패: ${questId} step ${result.failedStepIndex} — ${result.failureReason}`,
        ...(manual ? { warnings: [...walkthrough.manualHints] } : {}),
        data: {
          ok: verified,
          simulationOk: result.ok,
          verificationStatus: manual ? "manual-required" : result.ok ? "verified" : "failed",
          verifiedNodeIds: walkthrough.nodes.filter((node) => node.automatic && verified).map((node) => node.nodeId),
          walkthrough,
          failedStepIndex: result.failedStepIndex,
          failedStep: result.failedStep,
          failureReason: result.failureReason,
          finalState: result.finalState,
          log: result.log,
        },
      };
    } catch (cause) {
      throw new ToolError(`quest verify 실패: ${cause instanceof Error ? cause.message : String(cause)}`, { code: "quest-verify" });
    }
  },
};

function linkStoryFlagsToQuest(project: Project, graph: QuestGraphDef): void {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    for (const condition of extractQuestGraphConditions(node.completesWhen)) {
      const record = condition as { readonly kind?: unknown; readonly flagId?: unknown; readonly storyFlagId?: unknown };
      if (record.kind === "storyFlag" && typeof record.flagId === "string") ids.add(record.flagId);
      if (typeof record.storyFlagId === "string") ids.add(record.storyFlagId);
    }
    for (const flagId of node.activatesFlags ?? []) ids.add(flagId);
  }
  for (const flagId of ids) {
    const flag = storyFlagById(project, flagId);
    if (flag && !flag.questId) flag.questId = graph.id;
  }
}

export const QUEST_TOOLS: readonly ToolDefinition[] = [
  createQuestFlags,
  createQuest,
  defineQuest,
  lintQuest,
  generateWalkthroughTool,
  verifyQuestTool,
];
