// editor/tools/questTools.ts
// 퀘스트 골격 툴(Phase 1). 본격 DSL 컴파일러는 Phase 3.
// create_quest_flags: 스위치 sw_<key>_started/_done + 변수 var_<key>_progress 자동 등록.

import { compileQuest } from "@/project/quest/questCompiler";
import type { QuestDef } from "@/project/quest/questDef";
import { ensureNamedSwitch, ensureNamedVariable } from "./flagHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

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
      def: { type: "object", description: "QuestDef(key/title/summary/giver/steps/rewards?/gates?)" },
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

export const QUEST_TOOLS: readonly ToolDefinition[] = [createQuestFlags, createQuest];
