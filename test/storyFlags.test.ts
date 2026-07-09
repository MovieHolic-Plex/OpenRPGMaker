import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { explainEvent } from "@/project/storyEventExplain";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { projectLint } from "@/project/lint/projectLint";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project, StoryFlagDef } from "@/project/types";

function page(id: string, conditions: EventPage["conditions"], commands: Command[] = []): EventPage {
  return {
    id,
    name: id,
    conditions,
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function event(id: string, pages: EventPage[], commands: Command[] = []): GameEvent {
  return {
    id,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands,
    pages,
  };
}

function firstMap(project: Project) {
  return project.maps[project.startMapId]!;
}

function addEvent(project: Project, gameEvent: GameEvent): void {
  firstMap(project).events.push(gameEvent);
}

function declareFlag(project: Project, flag: StoryFlagDef): void {
  project.storyFlags ??= [];
  project.storyFlags.push(flag);
}

function issueCodes(project: Project): string[] {
  return projectLint(project).map((issue) => issue.code);
}

describe("story flag registry tools", () => {
  it("declares a story flag and auto-allocates an unused switch target", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = runTool(ctx, "declare_story_flag", {
      id: "met-mayor",
      kind: "switch",
      description: "시장과 처음 만남",
    });

    expect(result.ok).toBe(true);
    expect(ctx.project.storyFlags?.[0]).toMatchObject({
      id: "met-mayor",
      kind: "switch",
      targetId: "sw_0001",
      description: "시장과 처음 만남",
    });
    expect(ctx.project.switches[0]?.name).toBe("시장과 처음 만남");
  });

  it("rejects duplicate id and duplicate target", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    expect(runTool(ctx, "declare_story_flag", { id: "met-mayor", kind: "switch", targetId: "sw_0003", description: "시장" }).ok).toBe(true);

    const duplicateId = runTool(ctx, "declare_story_flag", { id: "met-mayor", kind: "variable", description: "중복" });
    expect(duplicateId.ok).toBe(false);
    expect(duplicateId.issues?.[0]?.code).toBe("story-flag-duplicate-id");

    const duplicateTarget = runTool(ctx, "declare_story_flag", { id: "met-chief", kind: "switch", targetId: "sw_0003", description: "중복 target" });
    expect(duplicateTarget.ok).toBe(false);
    expect(duplicateTarget.issues?.[0]?.code).toBe("story-flag-duplicate-target");
  });

  it("renames and retires story flags, warning when usage remains", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    expect(runTool(ctx, "declare_story_flag", { id: "met-mayor", kind: "switch", targetId: "sw_0003", description: "시장" }).ok).toBe(true);
    const renamed = runTool(ctx, "declare_story_flag", { action: "rename", id: "met-mayor", newId: "met-chief" });
    expect(renamed.ok).toBe(true);
    expect(ctx.project.storyFlags?.[0]?.id).toBe("met-chief");

    addEvent(ctx.project, event("ev_usage", [
      page("p1", [{ kind: "switch", switchId: "sw_0003", value: true }], [{ kind: "setSwitch", switchId: "sw_0003", value: true }]),
    ]));
    const retired = runTool(ctx, "declare_story_flag", { action: "retire", id: "met-chief" });
    expect(retired.ok).toBe(true);
    expect(ctx.project.storyFlags?.[0]?.retired).toBe(true);
    expect(retired.diff?.warnings.join("\n")).toContain("사용처 2건");
  });
});

describe("story flag usage index and lint", () => {
  it("indexes page conditions, forks, writes, common events, move routes, and troop events", () => {
    const project = createBlankProject();
    addEvent(project, event("ev_story", [
      page("p1", [{ kind: "switch", switchId: "sw_0003", value: true }], [
        { kind: "fork", condition: { kind: "variable", variableId: "var_0001", op: ">=", value: 2 }, then: [], else: [] },
        { kind: "setSwitch", switchId: "sw_0004", value: true },
        { kind: "setVariable", variableId: "var_0001", op: "=", value: { kind: "var", id: "var_0002" } },
        { kind: "moveEvent", eventId: "this-event", route: { repeat: false, moves: [{ kind: "setSwitch", switchId: "sw_0005", value: true }] } },
      ]),
    ]));
    project.commonEvents.push({
      id: "ce_story",
      name: "공통",
      trigger: "parallel",
      conditionSwitchId: "sw_0003",
      commands: [{ kind: "inputNumber", variableId: "var_0003", digits: 2 }],
    });
    project.database.troops[0]!.battleEventPages = [{
      id: "battle_page",
      name: "전투",
      span: "turn",
      conditions: [{ kind: "switch", switchId: "sw_0004", value: true }, { kind: "variable", variableId: "var_0001", op: ">=", value: 1 }],
      commands: [{ kind: "setSwitch", switchId: "sw_0003", value: false }],
    }];

    const index = buildStoryFlagUsageIndex(project);
    expect(usageBucketFor(index, "switch", "sw_0003").reads).toHaveLength(2);
    expect(usageBucketFor(index, "switch", "sw_0003").writes).toHaveLength(1);
    expect(usageBucketFor(index, "switch", "sw_0005").writes[0]?.detail).toBe("move route setSwitch");
    expect(usageBucketFor(index, "variable", "var_0001").reads).toHaveLength(2);
    expect(usageBucketFor(index, "variable", "var_0001").writes).toHaveLength(1);
    expect(usageBucketFor(index, "variable", "var_0002").reads).toHaveLength(1);
    expect(usageBucketFor(index, "variable", "var_0003").writes).toHaveLength(1);
  });

  it("warns read-without-write, write-without-read, undeclared usage, and keeps legacy projects quiet", () => {
    const readOnly = createBlankProject();
    declareFlag(readOnly, { id: "read-only", kind: "switch", targetId: "sw_0001", description: "읽기" });
    addEvent(readOnly, event("ev_read", [page("p1", [{ kind: "switch", switchId: "sw_0001", value: true }])]));
    expect(issueCodes(readOnly)).toContain("story-flag:read-without-write");

    const writeOnly = createBlankProject();
    declareFlag(writeOnly, { id: "write-only", kind: "switch", targetId: "sw_0001", description: "쓰기" });
    addEvent(writeOnly, event("ev_write", [page("p1", [], [{ kind: "setSwitch", switchId: "sw_0001", value: true }])]));
    expect(issueCodes(writeOnly)).toContain("story-flag:write-without-read");

    const undeclared = createBlankProject();
    declareFlag(undeclared, { id: "known", kind: "switch", targetId: "sw_0001", description: "선언됨" });
    addEvent(undeclared, event("ev_undeclared", [page("p1", [{ kind: "switch", switchId: "sw_0002", value: true }])]));
    expect(issueCodes(undeclared)).toContain("story-flag:undeclared");

    const legacy = createBlankProject();
    addEvent(legacy, event("ev_legacy", [page("p1", [{ kind: "switch", switchId: "sw_0002", value: true }])]));
    expect(issueCodes(legacy)).not.toContain("story-flag:undeclared");
  });
});

describe("explain_event and story state read tools", () => {
  it("evaluates every event page condition kind", () => {
    const project = createBlankProject();
    const map = firstMap(project);
    const conditions: EventPage["conditions"] = [
      { kind: "switch", switchId: "sw_0001", value: true },
      { kind: "variable", variableId: "var_0001", op: ">=", value: 5 },
      { kind: "selfSwitch", key: "A", value: true },
      { kind: "actor", actorId: DEFAULT_ACTOR_ID, present: true },
      { kind: "item", itemId: DEFAULT_ITEM_ID, present: true },
      { kind: "gold", op: ">=", amount: 10 },
      { kind: "timer", timerId: "timer1", seconds: 15 },
      { kind: "timePhase", phase: "day" },
      { kind: "season", season: "spring" },
      { kind: "npcActivity", activity: "work" },
      { kind: "friendshipAtLeast", npcKey: "mayor", value: 100 },
    ];
    addEvent(project, event("ev_all", [page("p1", conditions)]));
    const session = startSession(project);
    session.switches.sw_0001 = true;
    session.variables.var_0001 = 5;
    session.selfSwitches.ev_all = { A: true };
    session.inventory[DEFAULT_ITEM_ID] = 1;
    session.gold = 10;
    session.timers.timer1 = 10;
    session.gameTime = { minute: 0, hour: 12, day: 1, season: "spring", year: 1 };
    session.npcActivities = { ev_all: "work" };
    session.friendship = { mayor: 100 };

    const explanation = explainEvent(project, map.id, "ev_all", session, "live-play-session");
    expect(explanation.activePageNumber).toBe(1);
    expect(explanation.pages[0]?.conditions.map((condition) => [condition.kind, condition.ok])).toEqual(
      conditions.map((condition) => [condition.kind, true])
    );
  });

  it("keeps get_story_state/find_flag_usage concise and explains S3=off blocking page 2", () => {
    const project = createBlankProject();
    declareFlag(project, { id: "met-mayor", kind: "switch", targetId: "sw_0003", description: "시장과 만남", questId: "mayor-quest" });
    declareFlag(project, { id: "has-letter", kind: "switch", targetId: "sw_0004", description: "편지 보유" });
    declareFlag(project, { id: "mayor-trust", kind: "variable", targetId: "var_0001", description: "시장 신뢰도" });
    addEvent(project, event("ev_mayor", [
      page("p1", [], [{ kind: "setSwitch", switchId: "sw_0004", value: true }]),
      page("p2", [{ kind: "switch", switchId: "sw_0003", value: true }], [
        { kind: "setVariable", variableId: "var_0001", op: "+=", value: 1 },
      ]),
    ]));
    const ctx: ToolContext = { project };

    const state = runTool(ctx, "get_story_state", {});
    expect(state.ok).toBe(true);
    const flags = (state.data as { flags: Array<{ line: string; reads: number; writes: number }> }).flags;
    expect(flags.find((flag) => flag.line.includes("met-mayor"))?.line).toContain("S3=off");
    expect(flags.find((flag) => flag.line.includes("met-mayor"))?.reads).toBe(1);

    const usage = runTool(ctx, "find_flag_usage", { flagId: "met-mayor" });
    expect(usage.ok).toBe(true);
    expect(JSON.stringify(usage.data)).toContain("pages[1].conditions[0]");

    const explanation = runTool(ctx, "explain_event", { mapId: project.startMapId, eventId: "ev_mayor" });
    expect(explanation.ok).toBe(true);
    const data = explanation.data as { activePageNumber: number; summary: string };
    expect(data.activePageNumber).toBe(1);
    expect(data.summary).toContain("S3=off");
    expect(data.summary).toContain("페이지 2 비활성");
  });
});
