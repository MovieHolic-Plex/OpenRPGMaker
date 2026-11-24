import { describe, it, expect, beforeEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { canMove } from "@/project/collision";
import { rampCode, reliefSlopes } from "@/project/relief/walk";
import { normalizeRelief } from "@/project/relief/edit";
import { computeReachableCells } from "@/project/lint/reachability";
import type { GameMap, Project, Command, EventPage, GameEvent } from "@/project/types";
import { lintSceneStaging } from "@/project/lint/sceneStagingLint";
import { checkSeatedPose } from "@/project/lint/seatedPoseLint";
import { applySeatedPose } from "@/player/seatedPoseRender";
import { characterBaseOrigin } from "@/player/characterOrigin";
import { cellHasChair, normalizeEventPose, SEATED_CLIP_PX, SEATED_LOWER_PX } from "@/project/seatedPose";
import { type LintIssue, projectLint } from "@/project/lint/projectLint";
import { declaredIntent } from "./intentFixture";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

// test/reliefWalk.test.ts
// 높이 지형(map.relief) 걷기 규칙 — canMove 가 단 차를 막고 경사로 축으로만 오르내리게 한다.
describe("reliefWalk", () => {
  isolateTimers();
  // 평지 맵 위에 x ≥ 6 이 2단 대지, (5, 3) 은 동쪽으로 오르는 경사로(낮은 끝 0단).
  function hill(): { project: Project; map: GameMap } {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const levels = new Array(map.width * map.height).fill(0).map((_, i) => ((i % map.width) >= 6 ? 2 : 0));
    const ramps = new Array(map.width * map.height).fill(0);
    ramps[3 * map.width + 5] = rampCode("e");
    map.relief = { width: map.width, height: map.height, levels, ramps };
    return { project, map };
  }
  describe("relief walk rule", () => {
    it("단이 다른 이웃으로는 못 간다", () => {
      const { project, map } = hill();
      expect(canMove(project, map, 5, 1, 6, 1)).toBe(false);
      expect(canMove(project, map, 6, 1, 5, 1)).toBe(false);
    });
    it("같은 단 안에서는 그대로 걷는다", () => {
      const { project, map } = hill();
      expect(canMove(project, map, 2, 1, 3, 1)).toBe(true);
      expect(canMove(project, map, 7, 1, 8, 1)).toBe(true);
    });
    it("경사로 칸에서 오르막 방향으로 윗단에 오르고, 윗단에서 경사로로 내려선다", () => {
      const { project, map } = hill();
      expect(canMove(project, map, 4, 3, 5, 3)).toBe(true);
      expect(canMove(project, map, 5, 3, 6, 3)).toBe(true);
      expect(canMove(project, map, 6, 3, 5, 3)).toBe(true);
    });
    it("경사로 옆구리로는 드나들지 않는다", () => {
      const { project, map } = hill();
      expect(canMove(project, map, 5, 2, 5, 3)).toBe(false);
      expect(canMove(project, map, 5, 3, 5, 4)).toBe(false);
    });
    it("경사로 표기는 불러오기 정규화를 지나도 남고 렌더 사각형이 된다", () => {
      const { map } = hill();
      const back = normalizeRelief(JSON.parse(JSON.stringify(map.relief)), map.width, map.height)!;
      expect(back.ramps?.[3 * map.width + 5]).toBe(rampCode("e"));
      expect(reliefSlopes(back)).toEqual([{ x: 5, y: 3, w: 1, h: 1, dir: "e", lo: 0, hi: 2 }]);
    });
    it("도달성 BFS 도 경사로로만 윗단에 닿는다 — 경사로를 막으면 윗단은 닿지 않는다", () => {
      const { project, map } = hill();
      expect(computeReachableCells(project, map, 1, 1).has("8,1")).toBe(true);
      map.relief!.ramps = new Array(map.width * map.height).fill(0);
      const cut = computeReachableCells(project, map, 1, 1);
      expect(cut.has("8,1")).toBe(false);
      expect(cut.has("5,1")).toBe(true);
    });
    it("relief 가 없는 맵은 예전과 같다", () => {
      const { project, map } = hill();
      delete map.relief;
      expect(canMove(project, map, 5, 1, 6, 1)).toBe(true);
    });
  });
});

describe("sceneTalkStackedLint", () => {
  isolateTimers();
  // 첫사랑 r7 재회: 지후가 서하 두 칸 «아래»(같은 열)에 서서 배율 2 장면이 지후 뒤통수만 찍었다 — 같은 열 세로 1~2칸을 경고한다.
  function page(commands: Command[], extra: Partial<EventPage> = {}): EventPage {
    return {
      id: `p${Math.random().toString(36).slice(2, 7)}`, name: "", conditions: [], graphic: { sprite: { type: "bundled", id: "Actor1" } },
      trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra,
    } as unknown as EventPage;
  }
  const ev = (id: string, x: number, y: number, pages: EventPage[], name = id): GameEvent => ({ id, name, x, y, pages } as unknown as GameEvent);
  const text = (speaker: string, body: string): Command => ({ kind: "text", speaker, body, position: "bottom" } as unknown as Command);
  /** 서하(ev_a)가 지후(ev_b)에게 말한다 — 두 사람의 칸만 바꿔 경고가 나는지 본다. */
  function stackedCodes(a: { x: number; y: number }, b: { x: number; y: number }): string[] {
    const project: Project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    map.events = [
      ev("ev_a", a.x, a.y, [page([{ kind: "text", speaker: "서하", body: "안녕하세요.", position: "bottom", addressee: "ev_b" } as unknown as Command, text("지후", "…네.")])], "서하"),
      ev("ev_b", b.x, b.y, [page([])], "지후"),
    ];
    return lintSceneStaging(project).filter((i) => i.code === "scene-talk-stacked").map((i) => i.code);
  }
  describe("scene-talk-stacked — 위·아래 한 열로 서서 말하면 경고", () => {
    it("바로 아래 칸(세로 1)과 두 칸 아래(세로 2)는 경고", () => {
      expect(stackedCodes({ x: 5, y: 4 }, { x: 5, y: 5 })).toEqual(["scene-talk-stacked"]);
      expect(stackedCodes({ x: 5, y: 4 }, { x: 5, y: 6 })).toEqual(["scene-talk-stacked"]);
    });
    it("같은 줄 한 칸 띄운 옆(16,4)/(18,4)과 비스듬한 (16,4)/(17,6)은 경고 없음", () => {
      expect(stackedCodes({ x: 5, y: 4 }, { x: 7, y: 4 })).toEqual([]);
      expect(stackedCodes({ x: 5, y: 4 }, { x: 6, y: 6 })).toEqual([]);
    });
  });
});

describe("seatedPose", () => {
  isolateTimers();
  // 첫사랑 r7 금요일 회의: 의자 세 개가 서 있는 그림에 완전히 가려 세 사람이 줄 서 있는 것처럼 읽혔다. 의자 칸은 타일 태그(「의자」)로 안다.
  function page(id: string, graphic: Record<string, unknown>, priority = "same"): EventPage {
    return {
      id, name: id, conditions: [], graphic: { sprite: { type: "bundled", id: "Actor1" }, ...graphic },
      trigger: { kind: "action" }, priority, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
    } as unknown as EventPage;
  }
  const ev = (id: string, x: number, y: number, pages: EventPage[]): GameEvent => ({ id, name: id, x, y, pages } as unknown as GameEvent);
  /** 칸 (3,3) 에 의자(태그 「의자」) 타일을 깐 프로젝트. 의자 아닌 칸은 (4,3). */
  function chairProject(events: GameEvent[]): Project {
    const project: Project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    const tileset = project.tilesets[map.tilesetId]!;
    const meta = (tileset.tileMeta ?? (tileset.tileMeta = [])) as unknown as Record<number, { tags?: string[] }>;
    meta[7] = { tags: ["의자"] };
    const tiles = map.upperTiles as unknown as number[];
    tiles[3 * map.width + 3] = 7;
    map.events = events;
    return project;
  }
  function codes(project: Project): string[] {
    const issues: LintIssue[] = [];
    checkSeatedPose(project, issues);
    return issues.map((i) => `${i.code}@${i.eventId}`);
  }
  describe("graphic.pose 정규화", () => {
    it("seated 만 받고 나머지는 생략한다", () => {
      expect(normalizeEventPose("seated")).toBe("seated");
      expect(normalizeEventPose("standing")).toBeUndefined();
      expect(normalizeEventPose(undefined)).toBeUndefined();
    });
  });
  describe("의자 칸 판정은 타일 태그로 한다", () => {
    it("태그가 있는 칸만 의자다", () => {
      const project = chairProject([]);
      const map = Object.values(project.maps)[0]!;
      expect(cellHasChair(project, map, 3, 3)).toBe(true);
      expect(cellHasChair(project, map, 4, 3)).toBe(false);
    });
  });
  describe("scene-seated-standing / scene-seated-off-chair", () => {
    it("의자 칸의 선 그림은 경고한다", () => {
      expect(codes(chairProject([ev("a", 3, 3, [page("p", {})])]))).toEqual(["scene-seated-standing@a"]);
    });
    it("의자 칸의 앉은 그림은 조용하다", () => {
      expect(codes(chairProject([ev("a", 3, 3, [page("p", { pose: "seated" })])]))).toEqual([]);
    });
    it("앉았다 일어서는 인물(같은 칸의 선 페이지가 따로 있어도 앉은 페이지가 있으면)은 조용하다", () => {
      expect(codes(chairProject([ev("a", 3, 3, [page("sit", { pose: "seated" }, "above"), page("up", {})])]))).toEqual([]);
    });
    it("의자가 아닌 칸의 앉은 그림은 경고한다", () => {
      expect(codes(chairProject([ev("a", 4, 3, [page("p", { pose: "seated" })])]))).toEqual(["scene-seated-off-chair@a"]);
    });
    it("투명 페이지는 몸이 없어 보지 않는다", () => {
      expect(codes(chairProject([ev("a", 3, 3, [page("p", { transparent: true, sprite: undefined })])]))).toEqual([]);
    });
  });
  describe("앉은 그림 그리기", () => {
    function stub(frameH: number, scaleY: number) {
      const calls = { origin: [] as number[][], crop: [] as number[][] };
      return {
        calls,
        sprite: {
          scaleY, frame: { realHeight: frameH, realWidth: 24 },
          setOrigin: (x: number, y: number) => { calls.origin.push([x, y]); },
          setCrop: (x: number, y: number, w: number, h: number) => { calls.crop.push([x, y, w, h]); },
        },
      };
    }
    it("16px 타일에서 그림을 5px 내리고 아랫단 8px 을 자른다", () => {
      const { calls, sprite } = stub(32, 1);
      applySeatedPose(sprite, 16);
      expect(SEATED_LOWER_PX).toBe(5);
      expect(SEATED_CLIP_PX).toBe(8);
      expect(calls.origin[0]![0]).toBe(0.5);
      expect(calls.origin[0]![1]).toBeCloseTo(1 - 5 / 32, 6);
      expect(calls.crop[0]).toEqual([0, 0, 24, 24]);
      expect(characterBaseOrigin(sprite).y).toBeCloseTo(1 - 5 / 32, 6);
    });
    it("배율 2·타일 32px 이면 같은 비율로 내리고 자른다(월드 px 는 칸 크기에 비례)", () => {
      const { calls, sprite } = stub(32, 2);
      applySeatedPose(sprite, 32);
      expect(calls.origin[0]![1]).toBeCloseTo(1 - 10 / 64, 6);
      expect(calls.crop[0]).toEqual([0, 0, 24, 24]);
    });
  });
});

describe("storyArcQualityTools", () => {
  isolateTimers();
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
      const narrative = computeActiveToolDomains(declaredIntent({ tools: ["author_story_arc", "define_quest"] }));
      expect(narrative.has("event") && narrative.has("quest")).toBe(true);
      expect(toOpenAiTools(undefined, { domains: narrative }).map((tool) => tool.function.name)).toContain("author_story_arc");
      const quality = computeActiveToolDomains(declaredIntent({ mode: "question", tools: ["evaluate_game_quality"] }));
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
});
