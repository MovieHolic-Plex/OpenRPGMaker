import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { QUEST_TOOLS } from "@/editor/tools/questTools";
import { parseQuestDef, QUEST_DEF_EXAMPLE } from "@/editor/tools/questToolSchemas";
import { runTool } from "@/editor/tools/toolRunner";
import { isStepQuestDef } from "@/project/quest/questDef";
import type { JsonSchema } from "@/editor/tools/types";

const MAP = "map_blank_start";
const base = () => ({
  key: "q_contract", title: "안부 전하기", summary: "약초꾼에게 안부를 전해주세요.",
  giver: { create: { mapId: MAP, x: 5, y: 5, name: "촌장" } },
  steps: [{ kind: "talk", target: { create: { mapId: MAP, x: 8, y: 5, name: "약초꾼" } } }],
});
const schema = (name: string) => QUEST_TOOLS.find((tool) => tool.name === name)!.parameters;
function field(root: JsonSchema, ...path: string[]): JsonSchema {
  return path.reduce((node, key) => key === "[]" ? node.items! : node.properties![key], root);
}

describe("quest model-facing contract", () => {
  it("노출 스키마가 컴파일러의 중첩 입력과 실제 graph 조건만 설명한다", () => {
    const create = schema("create_quest");
    expect(field(create, "def", "giver", "create").required).toEqual(["mapId", "x", "y", "name"]);
    expect(field(create, "def", "steps", "[]", "target", "create").required).toContain("name");
    expect(field(create, "def", "steps", "[]", "at").required).toEqual(["mapId", "x", "y"]);
    expect(field(create, "def", "steps", "[]", "sources", "[]", "troopId").type).toBe("string");
    const condition = field(schema("define_quest"), "nodes", "[]", "completesWhen");
    expect(field(condition, "kind").enum).toEqual(["switch", "variable", "storyFlag"]);
    expect(field(condition, "all", "[]", "kind").enum).toEqual(["switch", "variable", "storyFlag"]);
    expect(field(condition, "value").description).toContain("boolean");
    expect(field(condition, "flagId").type).toBe("string");
  });

  it.each([
    [{ kind: "kill", troopId: "tr_wolves", mapId: MAP, x: 12, y: 10 }, "def.steps[0].at"],
    [{ kind: "talk", mapId: MAP, x: 14, y: 17, lines: ["보고합니다."] }, "def.steps[0].target"],
    [{ kind: "collect", itemId: "it_herb", count: 2 }, "def.steps[0].sources"],
    [{ kind: "collect", itemId: "it_herb", count: 0, sources: [] }, "def.steps[0].count"],
    [{ kind: "collect", itemId: "it_herb", count: 1, sources: [{ kind: "drop", mapId: MAP, x: 1, y: 1 }] }, "def.steps[0].sources[0].troopId"],
    [{ kind: "kill", troopId: "tr_wolves", at: { mapId: MAP, x: null, y: 1 } }, "def.steps[0].at.x"],
    [{ kind: "talk", target: { create: {} } }, "def.steps[0].target.create.mapId"],
    [{ kind: "reach", mapId: MAP, x: 1 }, "def.steps[0].y"],
  ])("잘못된 단계는 %j에서 누락 경로와 정답 구조를 반환한다", (step, path) => {
    const project = createBlankProject();
    const before = JSON.stringify(project);
    const ctx = { project };
    const result = runTool(ctx, "create_quest", { def: { ...base(), steps: [step] } }, { dryRun: false });
    expect(result.ok).toBe(false);
    const message = JSON.stringify(result);
    expect(message).toContain(path);
    expect(message).toContain("troopId");
    expect(message).toContain("at");
    expect(message).not.toMatch(/Cannot read properties|후처리 실패|TypeError/);
    expect(ctx.project).toBe(project);
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each([
    [{ create: {} }, "def.giver.create.mapId"],
    [{ mapId: MAP }, "def.giver.eventId"],
    [null, "def.giver"],
  ])("잘못된 giver도 컴파일 전에 거부한다", (giver, path) => {
    expect(() => parseQuestDef({ ...base(), giver })).toThrow(path);
  });

  it("최소 정답 예시가 실제 create_quest를 통과하고 steps 메타를 보존한다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_quest", QUEST_DEF_EXAMPLE, { dryRun: false });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.data).toMatchObject({ questId: "village_errand", kind: "steps", stepCount: 1 });
    expect(ctx.project.quests).toHaveLength(1);
    expect(isStepQuestDef(ctx.project.quests?.[0])).toBe(true);
  });

  it("reach의 flat 좌표는 kill at 정규화 때문에 거부되지 않는다", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "create_quest", { def: { ...base(), steps: [{ kind: "reach", mapId: MAP, x: 8, y: 5 }] } }, { dryRun: false });
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  it("같은 ID의 1노드 graph로 원래 단계 정의를 지울 수 없다", () => {
    const ctx = { project: createBlankProject() };
    const created = runTool(ctx, "create_quest", { def: base() }, { dryRun: false });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    const before = JSON.stringify(ctx.project);
    const result = runTool(ctx, "define_quest", {
      id: "q_contract", title: "축소된 퀘스트",
      nodes: [{ id: "start", description: "수락", completesWhen: { kind: "switch", switchId: "sw_q_contract_started", value: true } }],
      edges: [],
    }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("quest-kind-conflict");
    expect(JSON.stringify(ctx.project)).toBe(before);
  });

  it.each(["gold", "item", "selfSwitch", "all"])("graph의 미지원 %s 조건에는 지원 형태를 안내한다", (kind) => {
    const result = runTool({ project: createBlankProject() }, "define_quest", {
      id: "q_invalid", title: "입력 오류",
      nodes: [{ id: "reward", description: "보상", completesWhen: { kind, amount: 100 } }], edges: [],
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain("storyFlag");
    expect(JSON.stringify(result)).toContain("지원하지 않습니다");
  });

  it("all 조건과 storyFlag의 boolean/number 값이 실제 graph 정의에 도달한다", () => {
    const project = createBlankProject();
    project.switches.push({ id: "sw_q_ready", name: "수락" });
    project.variables.push({ id: "var_q_count", name: "수집" });
    project.storyFlags = [{ id: "quest_count", kind: "variable", targetId: "var_q_count", description: "수집 개수" }];
    // Schema + graph parser only: write-site lint belongs to the normal runner and is covered by questGraph.test.ts.
    const tool = QUEST_TOOLS.find((entry) => entry.name === "define_quest")!;
    const result = tool.run(project, {
      id: "q_all", title: "여러 조건",
      nodes: [{ id: "all", description: "수락 후 수집", completesWhen: { all: [
        { kind: "switch", switchId: "sw_q_ready", value: true },
        { kind: "storyFlag", flagId: "quest_count", op: ">=", value: 2 },
      ] } }], edges: [],
    });
    expect(result.summary).toContain("1 nodes");
  });
});
