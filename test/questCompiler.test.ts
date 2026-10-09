// test/questCompiler.test.ts
// 퀘스트 DSL → 컴파일 검증. 잿불의 유산 Q(약초 수집 + 전투 + 대화)를 QuestDef로 역표현해
// 빈 마을에 컴파일 → projectLint 0 error + 도달성 통과 + 직렬화 왕복 보존.

import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import { isStepQuestDef, type QuestDef } from "@/project/quest/questDef";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

const VILLAGE = "m_village";

// 잿불의 유산 Q2(달빛 약초) + 전투를 역표현한 선언적 퀘스트.
function furnaceQuest(): QuestDef {
  return {
    key: "q_furnace",
    title: "꺼진 화로",
    summary: "마을 화로가 꺼졌다. 약초를 모으고 길을 막은 슬라임을 처치해 불씨를 되살려라.",
    giver: { create: { mapId: VILLAGE, x: 10, y: 8, name: "촌장 로안", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
    steps: [
      { kind: "talk", target: { create: { mapId: VILLAGE, x: 5, y: 5, name: "약초꾼 세라", graphicQuery: "여관 주인" } }, lines: ["반짝이는 풀을 찾아 주세요."] },
      { kind: "collect", itemId: "it_herb", count: 2, sources: [
        { kind: "pickup", mapId: VILLAGE, x: 3, y: 11, lookText: "은은히 빛나는 풀이다." },
        { kind: "pickup", mapId: VILLAGE, x: 16, y: 3 },
      ] },
      { kind: "kill", troopId: "tr_slime", at: { mapId: VILLAGE, x: 14, y: 12, graphicQuery: "슬라임", intro: ["슬라임이 길을 막았다!"], victory: ["길이 열렸다."] } },
    ],
    rewards: { gold: 100, items: [{ itemId: "it_reward", count: 1 }] },
  };
}

function buildProjectWithQuest(): { project: Project; questResultOk: boolean } {
  const ctx: ToolContext = { project: createEmptyToolProject("퀘스트 컴파일 테스트") };
  const steps: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "create_map", args: { name: "잿불 마을", width: 20, height: 16, id: VILLAGE } },
    { name: "set_start_position", args: { mapId: VILLAGE, x: 10, y: 10 } },
    { name: "upsert_item", args: { item: { id: "it_herb", name: "달빛 약초", price: 0 } } },
    { name: "upsert_item", args: { item: { id: "it_reward", name: "수호 부적", price: 0 } } },
    { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임", stats: { maxHp: 40 } } } },
    { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
  ];
  for (const step of steps) {
    const result = runTool(ctx, step.name, step.args, { dryRun: false });
    if (!result.ok) throw new Error(`셋업 실패 ${step.name}: ${JSON.stringify(result.issues)}`);
  }
  const questResult = runTool(ctx, "create_quest", { def: furnaceQuest() }, { dryRun: false });
  return { project: ctx.project, questResultOk: questResult.ok };
}

describe("questCompiler", () => {
  const { project, questResultOk } = buildProjectWithQuest();

  it("create_quest가 커밋 게이트를 통과한다", () => {
    expect(questResultOk).toBe(true);
  });

  it("projectLint error가 0이다", () => {
    const errors = projectLint(project).filter((issue) => issue.severity === "error");
    expect(errors).toEqual([]);
  });

  it("퀘스트 플래그와 이벤트가 생성된다", () => {
    const switchIds = new Set(project.switches.map((entry) => entry.id));
    expect(switchIds.has("sw_q_furnace_started")).toBe(true);
    expect(switchIds.has("sw_q_furnace_done")).toBe(true);
    expect(switchIds.has("sw_q_furnace_step0")).toBe(true);
    const eventIds = project.maps[VILLAGE].events.map((event) => event.id);
    expect(eventIds).toContain("ev_q_furnace_giver");
    expect(eventIds).toContain("ev_q_furnace_talk0");
    expect(eventIds).toContain("ev_q_furnace_kill2");
  });

  it("project.quests 메타가 직렬화 왕복에서 보존된다", () => {
    expect(project.quests?.length).toBe(1);
    const round = deserialize(serialize(project));
    expect(round.quests?.length).toBe(1);
    const quest = round.quests?.[0];
    expect(isStepQuestDef(quest)).toBe(true);
    if (!isStepQuestDef(quest)) throw new Error("step quest expected");
    expect(quest.key).toBe("q_furnace");
    expect(quest.steps.length).toBe(3);
  });

  it("퀘스트 이벤트가 시작 지점에서 도달 가능하다", () => {
    const targets = project.maps[VILLAGE].events.map((event) => ({ x: event.x, y: event.y }));
    const spec: ReachabilitySpec = { mapId: VILLAGE, from: project.startPos, targets };
    const reachErrors = projectLint(project, { reachability: [spec] }).filter((issue) => issue.code === "reachability");
    expect(reachErrors).toEqual([]);
  });
});
