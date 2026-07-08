import { describe, expect, it } from "vitest";
import { proposalCompletenessWarnings, type ProposalCompletenessCall } from "@/ai/proposalCompleteness";
import { runTool } from "@/editor/tools";
import { projectLint } from "@/project/lint/projectLint";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createBlankProject } from "@/project/defaults";
import type { ChangeSummary } from "@/editor/tools";
import type { ToolResult } from "@/editor/tools";
import type { Command, GameEvent, Project, StoryFlagKind } from "@/project/types";

const MAP_ID = "map_blank_start";

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function proposalCall(name: string, args: Record<string, unknown>): ProposalCompletenessCall {
  return { name, args, result: { ok: true, diff: changeSummary({ switchesAdded: name === "declare_story_flag" ? 1 : 0 }) } };
}

function baseProject(): Project {
  const project = createBlankProject();
  project.startMapId = MAP_ID;
  project.startPos = { x: 5, y: 4 };
  return project;
}

function addFlag(project: Project, id: string, kind: StoryFlagKind, targetId: string): void {
  if (kind === "switch") {
    if (!project.switches.some((entry) => entry.id === targetId)) project.switches.push({ id: targetId, name: id });
    project.session.switches[targetId] = false;
  } else {
    if (!project.variables.some((entry) => entry.id === targetId)) project.variables.push({ id: targetId, name: id });
    project.session.variables[targetId] = 0;
  }
  project.storyFlags ??= [];
  project.storyFlags.push({ id, kind, targetId, description: id });
}

function actionEvent(id: string, x: number, y: number, commands: readonly Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: `${id}_page`,
      name: id,
      conditions: [],
      graphic: { transparent: true },
      trigger: { kind: "action" },
      priority: "same",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [...commands],
    }],
  };
}

function addEvent(project: Project, event: GameEvent): void {
  project.maps[MAP_ID].events.push(event);
}

function runWrite(project: Project, name: string, args: Record<string, unknown>): ToolResult {
  const ctx = { project };
  const result = runTool(ctx, name, args, { dryRun: false });
  if (result.ok) Object.assign(project, ctx.project);
  return result;
}

function defineGraph(project: Project, overrides: Record<string, unknown> = {}) {
  return runWrite(project, "define_quest", {
    id: "q-village",
    title: "촌장의 부탁",
    nodes: [
      { id: "talk-chief", description: "촌장과 대화", completesWhen: { kind: "storyFlag", flagId: "talk-chief", value: true } },
    ],
    edges: [],
    ...overrides,
  });
}

function simpleDialogueProject(): Project {
  const project = baseProject();
  addFlag(project, "talk-chief", "switch", "sw_talk_chief");
  addEvent(project, actionEvent("ev_chief", 5, 5, [{ kind: "setSwitch", switchId: "sw_talk_chief", value: true }]));
  const result = defineGraph(project);
  expect(result.ok, result.summary).toBe(true);
  return project;
}

function integrationProject(): Project {
  const project = baseProject();
  addFlag(project, "talk-chief", "switch", "sw_talk_chief");
  addFlag(project, "got-relic", "variable", "var_relic_count");
  addFlag(project, "reported-chief", "switch", "sw_reported_chief");
  addEvent(project, actionEvent("ev_chief", 5, 5, [{ kind: "setSwitch", switchId: "sw_talk_chief", value: true }]));
  addEvent(project, actionEvent("ev_relic", 6, 5, [
    { kind: "changeItem", itemId: "it_pendant", op: "+=", amount: 1 },
    { kind: "setVariable", variableId: "var_relic_count", op: "+=", value: 1 },
  ]));
  addEvent(project, actionEvent("ev_report", 7, 5, [{ kind: "setSwitch", switchId: "sw_reported_chief", value: true }]));
  const result = defineGraph(project, {
    nodes: [
      { id: "talk-chief", description: "촌장과 대화", completesWhen: { kind: "storyFlag", flagId: "talk-chief", value: true } },
      { id: "get-relic", description: "목걸이 획득", completesWhen: { kind: "storyFlag", flagId: "got-relic", op: ">=", value: 1 } },
      { id: "report-chief", description: "촌장에게 보고", completesWhen: { kind: "storyFlag", flagId: "reported-chief", value: true } },
    ],
    edges: [{ from: "talk-chief", to: "get-relic" }, { from: "get-relic", to: "report-chief" }],
  });
  expect(result.ok, result.summary).toBe(true);
  return project;
}

describe("quest graph", () => {
  it("DAG 검증에서 사이클을 거부한다", () => {
    const project = simpleDialogueProject();
    const result = defineGraph(project, {
      id: "q-cycle",
      nodes: [
        { id: "a", description: "A", completesWhen: { kind: "storyFlag", flagId: "talk-chief", value: true } },
        { id: "b", description: "B", completesWhen: { kind: "storyFlag", flagId: "talk-chief", value: true } },
      ],
      edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.message).toContain("사이클");
  });

  it("데드엔드, 도달 불가, 고아 노드를 lint한다", () => {
    const project = baseProject();
    addFlag(project, "written", "switch", "sw_written");
    addFlag(project, "missing", "switch", "sw_missing");
    addEvent(project, actionEvent("ev_writer", 5, 5, [{ kind: "setSwitch", switchId: "sw_written", value: true }]));
    project.quests = [{
      kind: "graph",
      id: "q-lint",
      title: "린트",
      nodes: [
        { id: "start", description: "시작", completesWhen: { kind: "storyFlag", flagId: "written", value: true } },
        { id: "dead", description: "막힘", completesWhen: { kind: "storyFlag", flagId: "missing", value: true } },
        { id: "orphan", description: "고아", completesWhen: { kind: "storyFlag", flagId: "written", value: true } },
      ],
      edges: [{ from: "start", to: "dead" }],
    }];

    const issues = projectLint(project);
    expect(issues.some((issue) => issue.code === "quest-graph:dead-end-node" && issue.severity === "error")).toBe(true);
    expect(issues.some((issue) => issue.code === "quest-graph:unreachable-node" && issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.code === "quest-graph:orphan-node" && issue.severity === "warning")).toBe(true);
  });

  it("storyFlag completesWhen을 레지스트리 target write site로 해석한다", () => {
    const project = simpleDialogueProject();
    const result = runTool({ project }, "lint_quest", { questId: "q-village" });
    expect(result.ok, result.summary).toBe(true);
    const issues = (result.data as { issues: Array<{ code: string }> }).issues;
    expect(issues.some((issue) => issue.code === "quest-graph:dead-end-node")).toBe(false);
  });

  it("간단 대화 퀘스트 walkthrough를 run_scene_test 스키마로 생성하고 실행한다", () => {
    const project = simpleDialogueProject();
    const generated = runTool({ project }, "generate_walkthrough", { questId: "q-village" });
    expect(generated.ok, generated.summary).toBe(true);
    const scenario = (generated.data as { scenario: { mapId: string; start: { x: number; y: number }; steps: [] } }).scenario;
    const result = runSceneTest(project, scenario);
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("전투 승리 write site는 manualHint set 폴백으로 생성한다", () => {
    const project = baseProject();
    addFlag(project, "boss-down", "switch", "sw_boss_down");
    expect(runWrite(project, "upsert_enemy", { enemy: { id: "en_boss", name: "보스" } }).ok).toBe(true);
    expect(runWrite(project, "upsert_troop", { troop: { id: "tr_boss", name: "보스", enemyIds: ["en_boss"] } }).ok).toBe(true);
    addEvent(project, actionEvent("ev_boss", 5, 5, [
      { kind: "battleProcessing", troopId: "tr_boss", canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: "sw_boss_down", value: true },
    ]));
    const define = defineGraph(project, {
      id: "q-boss",
      nodes: [{ id: "boss", description: "보스 처치", completesWhen: { kind: "storyFlag", flagId: "boss-down", value: true } }],
    });
    expect(define.ok, define.summary).toBe(true);

    const generated = runTool({ project }, "generate_walkthrough", { questId: "q-boss" });
    expect(generated.ok, generated.summary).toBe(true);
    const data = generated.data as {
      scenario: { mapId: string; start: { x: number; y: number }; steps: Array<{ kind: string; manualHint?: string }> };
      manualHints: string[];
    };
    expect(data.manualHints[0]).toContain("전투 승리");
    expect(data.scenario.steps.some((step) => step.kind === "set" && step.manualHint)).toBe(true);
    const result = runSceneTest(project, data.scenario as Parameters<typeof runSceneTest>[1]);
    expect(result.ok, result.failureReason).toBe(true);
  });

  it("verify_quest는 성공과 실패 스텝을 보고한다", () => {
    const successProject = simpleDialogueProject();
    const success = runTool({ project: successProject }, "verify_quest", { questId: "q-village" });
    expect(success.ok, success.summary).toBe(true);
    expect((success.data as { ok: boolean }).ok).toBe(true);

    const failProject = baseProject();
    addFlag(failProject, "counted", "variable", "var_counted");
    addEvent(failProject, actionEvent("ev_count", 5, 5, [{ kind: "setVariable", variableId: "var_counted", op: "+=", value: 1 }]));
    const define = defineGraph(failProject, {
      id: "q-fail",
      nodes: [{ id: "count", description: "두 번 카운트", completesWhen: { kind: "storyFlag", flagId: "counted", op: ">=", value: 2 } }],
    });
    expect(define.ok, define.summary).toBe(true);
    const failure = runTool({ project: failProject }, "verify_quest", { questId: "q-fail" });
    expect(failure.ok, failure.summary).toBe(true);
    expect((failure.data as { ok: boolean; failedStepIndex?: number }).ok).toBe(false);
    expect((failure.data as { ok: boolean; failedStepIndex?: number }).failedStepIndex).toBeGreaterThanOrEqual(0);
  });

  it("3노드 픽스처는 generate_walkthrough에서 run_scene_test까지 통과하고 write site 삭제 변형은 dead-end error를 낸다", () => {
    const project = integrationProject();
    const generated = runTool({ project }, "generate_walkthrough", { questId: "q-village" });
    expect(generated.ok, generated.summary).toBe(true);
    const scenario = (generated.data as { scenario: { mapId: string; start: { x: number; y: number }; steps: [] } }).scenario;
    const result = runSceneTest(project, scenario);
    expect(result.ok, result.failureReason).toBe(true);

    const broken = structuredClone(project);
    const event = broken.maps[MAP_ID].events.find((entry) => entry.id === "ev_relic");
    if (!event?.pages?.[0]) throw new Error("fixture event missing");
    event.pages[0].commands = event.pages[0].commands.filter((command) => command.kind !== "setVariable");
    const issues = projectLint(broken);
    expect(issues.some((issue) => issue.code === "quest-graph:dead-end-node" && issue.message.includes("get-relic"))).toBe(true);
  });

  it("storyFlag 3개 등록 턴에 define_quest가 없으면 퀘스트 그래프 권장 warning을 낸다", () => {
    const warnings = proposalCompletenessWarnings({
      calls: [
        proposalCall("declare_story_flag", { id: "a" }),
        proposalCall("declare_story_flag", { id: "b" }),
        proposalCall("declare_story_flag", { id: "c" }),
      ],
    });
    expect(warnings).toContain("⚠ 미이행: 퀘스트 그래프 등록 권장 — 이번 턴에서 storyFlag 3개를 새로 등록했지만 define_quest가 없습니다.");

    const quiet = proposalCompletenessWarnings({
      calls: [
        proposalCall("declare_story_flag", { id: "a" }),
        proposalCall("declare_story_flag", { id: "b" }),
        proposalCall("declare_story_flag", { id: "c" }),
        proposalCall("define_quest", { id: "q" }),
      ],
    });
    expect(quiet).toEqual([]);
  });
});
