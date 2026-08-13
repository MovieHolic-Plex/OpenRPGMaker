import { beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import type { Command, GameEvent } from "@/project/types";

const ARC_ARGS = {
  id: "first-steps",
  title: "First Steps",
  mapId: "map_blank_start",
  eventId: "ev_first_steps",
  at: { x: 5, y: 5 },
  opening: ["Welcome."],
  tutorialObjectives: [
    { id: "listen", text: "Listen to the guide." },
    { id: "decide", text: "Make a choice." },
  ],
  branchChoices: [
    { id: "help", label: "Help", lines: ["Find the passage."] },
    { id: "leave", label: "Leave", lines: ["Leave for now."] },
  ],
  twist: {
    enabled: true,
    flagId: "guide-is-royal",
    description: "The guide is royal.",
    discoverInBranchId: "help",
    reveal: ["The guide was royal."],
  },
} as const;

type ArcData = {
  readonly eventId: string;
  readonly questId: string;
  readonly objectiveFlagIds: readonly string[];
  readonly choiceVariableId: string;
  readonly twistFlagId?: string;
  readonly twistSwitchId?: string;
};

describe("author_story_arc", () => {
  it("creates a serializable tutorial with two executable branches and a twist write/read", () => {
    const context = { project: createBlankProject() };
    const result = runTool(context, "author_story_arc", ARC_ARGS);
    expect(result.ok, result.summary).toBe(true);
    const ids = result.data as ArcData;
    const commands = context.project.maps.map_blank_start?.events.find((event) => event.id === ids.eventId)?.pages?.[0]?.commands ?? [];
    const choices = commands.find((command) => command.kind === "choices");
    expect(choices?.kind === "choices" ? choices.options : []).toHaveLength(2);
    expect(choices?.kind === "choices" && choices.options.every((option) => option.branch.some((command) => command.kind === "setVariable"))).toBe(true);
    expect(commands.some((command) => command.kind === "fork" && command.condition.kind === "switch" && command.condition.switchId === ids.twistSwitchId)).toBe(true);
    expect(projectLint(context.project).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(deserialize(serialize(context.project)).quests?.some((quest) => ("id" in quest ? quest.id : quest.key) === ids.questId)).toBe(true);
  });

  it("rejects structurally dead objectives and branches", () => {
    const deadObjective = structuredClone(ARC_ARGS) as Record<string, unknown>;
    deadObjective.tutorialObjectives = [{ id: "empty", text: "" }];
    expect(runTool({ project: createBlankProject() }, "author_story_arc", deadObjective).issues?.[0]?.code).toBe("story-arc-dead-objective");
    const deadBranch = structuredClone(ARC_ARGS) as Record<string, unknown>;
    deadBranch.branchChoices = [{ id: "help", label: "Help", lines: [] }, { id: "leave", label: "Leave", lines: ["Go."] }];
    expect(runTool({ project: createBlankProject() }, "author_story_arc", deadBranch).issues?.[0]?.code).toBe("story-arc-dead-branch");
  });
});

describe("evaluate_game_quality", () => {
  it("traverses every owner and nested branch family without mutation", () => {
    const project = createBlankProject();
    const nested: Command[] = [{
      kind: "choices",
      options: [{ text: "A", branch: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [{ kind: "text", body: "then" }], else: [{ kind: "text", body: "else" }] }] }],
      cancelBehavior: "branch",
      cancelBranch: [{ kind: "loop", body: [{ kind: "breakLoop" }] }],
    }];
    const event: GameEvent = { id: "ev_quality", x: 2, y: 2, trigger: { kind: "action" }, commands: nested, pages: [{ id: "page_quality", name: "quality", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "page" }] }] };
    project.maps[project.startMapId]?.events.push(event);
    project.commonEvents.push({ id: "ce_quality", name: "quality", trigger: "none", commands: [{ kind: "text", body: "common" }] });
    project.database.troops[0]?.battleEventPages.push({ id: "tp_quality", name: "quality", span: "turn", conditions: [], commands: [{ kind: "text", body: "troop" }] });
    const before = serialize(project);
    const result = runTool({ project }, "evaluate_game_quality", { walkthroughResults: [{ id: "main", ok: true }] });
    expect(serialize(project)).toBe(before);
    const data = result.data as { coverage: { commandOwners: Record<string, number>; nestedBranches: Record<string, number> }; limitations: string[] };
    expect(data.coverage.commandOwners).toMatchObject({ legacyEvent: 1, eventPage: 1, commonEvent: 1, troopPage: 1 });
    expect(data.coverage.nestedBranches).toMatchObject({ choiceOption: 1, choiceCancel: 1, forkThen: 1, forkElse: 1, loopBody: 1 });
    expect(data.limitations.join(" ")).toContain("fun");
    expect(JSON.stringify(data)).not.toMatch(/"score"\s*:/u);
  });

  it("blocks only on objective lint errors and always reports limitations", () => {
    const advisoryProject = createBlankProject();
    advisoryProject.world = { entities: [{ id: "bad-ref", type: "place", name: "Bad", summary: "Broken", origin: "user", refs: [{ kind: "map", id: "missing" }] }], relations: [] };
    const advisory = runTool({ project: advisoryProject }, "evaluate_game_quality", {}).data as { verdict: { blocked: boolean }; limitations: string[] };
    expect(advisory.verdict.blocked).toBe(false);
    expect(advisory.limitations).toHaveLength(5);
    const broken = createBlankProject();
    broken.startMapId = "missing";
    const blocked = runTool({ project: broken }, "evaluate_game_quality", {}).data as { verdict: { blocked: boolean; objectiveErrorCount: number } };
    expect(blocked.verdict.blocked).toBe(true);
    expect(blocked.verdict.objectiveErrorCount).toBeGreaterThan(0);
  });
});

describe("routing and policy", () => {
  beforeEach(() => resetAssistantToolDomainMemory());
  it("exposes both tools for their wording", () => {
    const narrative = computeActiveToolDomains("tutorial story branch twist");
    expect(narrative.has("event") && narrative.has("quest")).toBe(true);
    expect(toOpenAiTools(undefined, { domains: narrative }).map((tool) => tool.function.name)).toContain("author_story_arc");
    const quality = computeActiveToolDomains("evaluate game quality");
    expect(quality.has("system")).toBe(true);
    expect(toOpenAiTools(undefined, { domains: quality }).map((tool) => tool.function.name)).toContain("evaluate_game_quality");
  });
  it("registers and recommends the facades", () => {
    expect(getTool("author_story_arc")?.mode).toBe("write");
    expect(getTool("evaluate_game_quality")?.mode).toBe("read");
    const prompt = buildSystemPrompt(createBlankProject());
    expect(prompt).toContain("author_story_arc로 작성");
    expect(prompt).toContain("evaluate_game_quality");
  });
});
