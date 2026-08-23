// editor/tools/questTools.ts
// 퀘스트 골격 툴(Phase 1). 본격 DSL 컴파일러는 Phase 3.
// create_quest_flags: 스위치 sw_<key>_started/_done + 변수 var_<key>_progress 자동 등록.

import { compileQuest } from "@/project/quest/questCompiler";
import {
  extractQuestGraphConditions,
  generateQuestWalkthrough,
  lintQuestById,
  normalizeQuestGraph,
} from "@/project/quest/questGraph";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { storyFlagById } from "@/project/storyFlags";
import type { Project } from "@/project/types";
import { questDefId, type QuestDef, type QuestGraphDef } from "@/project/quest/questDef";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";
import { CONDITION_SCHEMA } from "./schemaShapes";

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
  description: "선언적 QuestDef를 컴파일한다 — 스위치/변수 + 기버 다중 페이지 + 수집물/블로커/게이트 이벤트 생성 + project.quests 메타 보존.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      def: {
        type: "object",
        description: "QuestDef(key/title/summary/giver/steps/rewards?/gates?)",
        properties: {
          key: { type: "string", description: "영문/숫자/밑줄" },
          title: { type: "string" },
          summary: { type: "string" },
          giver: {
            type: "object",
            description: "기존 이벤트 참조 {mapId,eventId} 또는 신규 생성 {create:{...}}",
            properties: {
              mapId: { type: "string" },
              eventId: { type: "string" },
              create: { type: "object", description: "QuestNpcSpec", additionalProperties: true },
            },
          },
          steps: {
            type: "array",
            description: "QuestStep[] — kind: talk|collect|kill|reach",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["talk", "collect", "kill", "reach"] },
                mapId: { type: "string" },
                x: { type: "integer" },
                y: { type: "integer" },
                itemId: { type: "string" },
                troopId: { type: "string" },
                lines: { type: "array", items: { type: "string" } },
              },
              required: ["kind"],
              additionalProperties: true,
            },
          },
          rewards: {
            type: "object",
            properties: {
              gold: { type: "integer" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: { itemId: { type: "string" }, count: { type: "integer" } },
                  required: ["itemId", "count"],
                },
              },
            },
          },
          gates: {
            type: "array",
            description: "단계 게이트",
            items: {
              type: "object",
              properties: {
                mapId: { type: "string" },
                x: { type: "integer" },
                y: { type: "integer" },
                requiresStep: { type: "integer", description: "0-기반 단계 인덱스" },
                lockedText: { type: "string" },
              },
              required: ["mapId", "x", "y", "requiresStep", "lockedText"],
            },
          },
        },
        required: ["key", "title", "summary", "giver", "steps"],
      },
    },
    required: ["def"],
  },
  run(draft, args): ToolExecResult {
    const def = args.def as QuestDef;
    if (!def || typeof def.key !== "string") throw new ToolError("def.key(문자열)가 필요합니다.", { code: "quest-def" });
    try {
      const result = compileQuest(draft, def);
      return {
        summary: `퀘스트 '${def.title}' 컴파일 — 이벤트 ${result.eventsCreated}개, 단계 ${def.steps.length}개`,
        data: { flags: result.flags, eventsCreated: result.eventsCreated },
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
  invalidArgsHint: "id/title/nodes/edges가 필요하고 completesWhen은 조건 객체 또는 {all:[조건...]}입니다.",
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
            completesWhen: {
              ...CONDITION_SCHEMA,
              description: "조건 객체 또는 {kind:'all', conditions:[...]}",
            },
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
      throw new ToolError(`퀘스트 그래프 정의 실패: ${cause instanceof Error ? cause.message : String(cause)}`, { code: "quest-graph-define" });
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
  description: "generate_walkthrough 결과를 즉시 run_scene_test로 실행해 성공/실패와 실패 스텝을 반환한다.",
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
      return {
        summary: result.ok
          ? `quest verify 성공: ${questId} (${result.stepsRun}/${result.totalSteps} steps)`
          : `quest verify 실패: ${questId} step ${result.failedStepIndex} — ${result.failureReason}`,
        data: {
          ok: result.ok,
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
