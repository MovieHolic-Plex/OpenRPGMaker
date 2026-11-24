import { describe, expect, it } from "vitest";
import { getTool, type ToolContext } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_ITEM_ID } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { compileQuest } from "@/project/quest/questCompiler";
import type { QuestDef } from "@/project/quest/questDef";
import type { GameEvent, GameMap, Project, Command, EventPage, StoryFlagDef } from "@/project/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { pendingQuestCandidates, registerQuestCandidate } from "@/project/quest/questCandidates";
import { buildQuestTableRows, filterQuestTableRows, questTableCounts, resolveQuestJumpTarget } from "@/project/quest/questTable";
import { explainEvent } from "@/project/storyEventExplain";
import { buildStoryFlagUsageIndex, usageBucketFor } from "@/project/storyFlagUsage";
import { normalizeQuestGraph, lintQuestGraph, generateQuestWalkthrough } from "@/project/quest/questGraph";
import { projectLint } from "@/project/lint/projectLint";
import { startSession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

// 퀘스트 컴파일러 배치 통행 가능성 계약.
// 왜: questCompiler는 저작 좌표를 그대로 믿고 이벤트를 만들었고, 강 위에 컴파일하면
// 물 속에 선 NPC와 절대 밟을 수 없는 도달 마커가 생겼다.
// RM2K3 의미: 캐릭터형(기버·대화 NPC·몬스터)과 밟아서 발동하는 마커(playerTouch + priority !== "same")는
// 반드시 통행 가능 칸에 서야 하고, action 트리거 마커/차단 게이트는 벽 위에 있어도 되지만 도달 가능해야 한다.
describe("aiPlacementQuestCompiler", () => {
  isolateTimers();
  const QUEST_KEY = "q_river";
  // 저작 좌표(전부 강 위) — 물이라서 계약대로면 전부 보정/보고돼야 한다.
  const AUTHORED = {
    giver: { x: 7, y: 10 },
    talk: { x: 8, y: 4 },
    kill: { x: 8, y: 2 },
    reach: { x: 8, y: 7 },
    gate: { x: 9, y: 12 },
  } as const;
  function fixture(): { project: Project; map: GameMap; mapId: string } {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    return { project, map, mapId };
  }
  /** x 열 전체를 물로 채워 남북으로 흐르는 강을 만든다. */
  function carveRiver(map: GameMap, columns: readonly number[]): void {
    for (const x of columns) {
      for (let y = 0; y < map.height; y += 1) {
        map.lowerTiles[y * map.width + x] = TILE.WATER;
        map.upperTiles[y * map.width + x] = TILE.EMPTY;
      }
    }
  }
  function troopId(project: Project): string {
    const id = project.database.troops[0]?.id;
    if (!id) throw new Error("fixture troop missing");
    return id;
  }
  function itemId(project: Project): string {
    const id = project.database.items[0]?.id;
    if (!id) throw new Error("fixture item missing");
    return id;
  }
  function questDef(project: Project, mapId: string): QuestDef {
    return {
      key: QUEST_KEY,
      title: "강 건너 심부름",
      summary: "강가 사람들의 부탁을 처리한다.",
      // 의뢰인 제 말 — 없으면 create_quest 가 «요약문을 서술로 띄웠다» 고 알린다(r6 P7). 이 파일은 좌표만 본다.
      dialogue: { offer: "강 건너 일 좀 맡아 주겠나?", accepted: "고맙네, 조심해서 다녀오게." },
      giver: {
        create: {
          mapId,
          x: AUTHORED.giver.x,
          y: AUTHORED.giver.y,
          name: "뱃사공 나루",
          textureKey: "tex_easyrpg_charset_people1",
          characterIndex: 6,
        },
      },
      steps: [
        {
          kind: "talk",
          target: {
            create: {
              mapId,
              x: AUTHORED.talk.x,
              y: AUTHORED.talk.y,
              name: "낚시꾼 도리",
              textureKey: "tex_easyrpg_charset_people1",
              characterIndex: 2,
            },
          },
          lines: ["강 상류가 시끄럽다네."],
        },
        {
          kind: "kill",
          troopId: troopId(project),
          at: { mapId, x: AUTHORED.kill.x, y: AUTHORED.kill.y, graphicQuery: "슬라임" },
        },
        { kind: "reach", mapId, x: AUTHORED.reach.x, y: AUTHORED.reach.y },
        {
          kind: "collect",
          itemId: itemId(project),
          count: 1,
          sources: [{ kind: "pickup", mapId, x: 3, y: 3, lookText: "무언가 반짝인다." }],
        },
      ],
      gates: [
        {
          mapId,
          x: AUTHORED.gate.x,
          y: AUTHORED.gate.y,
          requiresStep: 0,
          lockedText: "아직 건널 수 없다.",
        },
      ],
    };
  }
  function eventById(map: GameMap, id: string): GameEvent {
    const found = map.events.find((entry) => entry.id === id);
    if (!found) throw new Error(`event not found: ${id}`);
    return found;
  }
  describe("questCompiler 통행 가능 착지", () => {
    it("강 위에 컴파일해도 새로 만든 대화 NPC는 통행 가능 칸에 선다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);
      expect(isPassable(project, map, AUTHORED.talk.x, AUTHORED.talk.y)).toBe(false);

      getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

      const npc = eventById(map, `ev_${QUEST_KEY}_talk0`);
      expect(isPassable(project, map, npc.x, npc.y)).toBe(true);
    });

    it("playerTouch 도달 마커는 밟을 수 있는 칸으로 옮긴다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);
      expect(isPassable(project, map, AUTHORED.reach.x, AUTHORED.reach.y)).toBe(false);

      getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

      const marker = eventById(map, `ev_${QUEST_KEY}_reach2`);
      expect(isPassable(project, map, marker.x, marker.y)).toBe(true);
    });

    it("기버 NPC와 전투 블로커도 통행 가능 칸에 선다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);
      expect(isPassable(project, map, AUTHORED.giver.x, AUTHORED.giver.y)).toBe(false);
      expect(isPassable(project, map, AUTHORED.kill.x, AUTHORED.kill.y)).toBe(false);

      getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

      const giver = eventById(map, `ev_${QUEST_KEY}_giver`);
      const blocker = eventById(map, `ev_${QUEST_KEY}_kill1`);
      expect(isPassable(project, map, giver.x, giver.y)).toBe(true);
      expect(isPassable(project, map, blocker.x, blocker.y)).toBe(true);
    });

    it("물 위 게이트는 통행 가능 칸으로 착지하거나 경고로 보고된다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);
      expect(isPassable(project, map, AUTHORED.gate.x, AUTHORED.gate.y)).toBe(false);

      const result = compileQuest(project, questDef(project, mapId));

      const gate = eventById(map, `ev_${QUEST_KEY}_gate0`);
      expect([gate.x, gate.y]).toEqual([AUTHORED.gate.x, AUTHORED.gate.y]);
      expect(result.warnings.some(
        (warning) => warning.includes(`(${AUTHORED.gate.x}, ${AUTHORED.gate.y})`),
      )).toBe(true);
    });

    it("create_quest 툴이 컴파일러의 자동 착지 경고를 반환한다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);

      const result = getTool("create_quest")!.run(project, { def: questDef(project, mapId) });

      expect(result.warnings?.some(
        (warning) => warning.includes(`(${AUTHORED.giver.x}, ${AUTHORED.giver.y})`) && warning.includes("→"),
      )).toBe(true);
    });

    it("평지에 컴파일하면 저작 좌표를 하나도 건드리지 않는다", () => {
      const { project, map, mapId } = fixture();

      const result = compileQuest(project, questDef(project, mapId));

      expect([eventById(map, `ev_${QUEST_KEY}_giver`).x, eventById(map, `ev_${QUEST_KEY}_giver`).y]).toEqual([
        AUTHORED.giver.x,
        AUTHORED.giver.y,
      ]);
      expect([eventById(map, `ev_${QUEST_KEY}_talk0`).x, eventById(map, `ev_${QUEST_KEY}_talk0`).y]).toEqual([
        AUTHORED.talk.x,
        AUTHORED.talk.y,
      ]);
      expect([eventById(map, `ev_${QUEST_KEY}_kill1`).x, eventById(map, `ev_${QUEST_KEY}_kill1`).y]).toEqual([
        AUTHORED.kill.x,
        AUTHORED.kill.y,
      ]);
      expect([eventById(map, `ev_${QUEST_KEY}_reach2`).x, eventById(map, `ev_${QUEST_KEY}_reach2`).y]).toEqual([
        AUTHORED.reach.x,
        AUTHORED.reach.y,
      ]);
      expect([eventById(map, `ev_${QUEST_KEY}_gate0`).x, eventById(map, `ev_${QUEST_KEY}_gate0`).y]).toEqual([
        AUTHORED.gate.x,
        AUTHORED.gate.y,
      ]);
      expect(result.warnings ?? []).toEqual([]);
    });

    it("컴파일 결과 경고가 옮긴 이벤트마다 원래 좌표와 최종 좌표를 알려준다", () => {
      const { project, map, mapId } = fixture();
      carveRiver(map, [7, 8, 9]);

      const result = compileQuest(project, questDef(project, mapId));

      const warnings = result.warnings ?? [];
      for (const authored of [AUTHORED.giver, AUTHORED.talk, AUTHORED.kill, AUTHORED.reach]) {
        const moved = warnings.find((warning) => warning.includes(`(${authored.x}, ${authored.y})`));
        expect(moved, `(${authored.x}, ${authored.y}) 경고 누락: ${warnings.join(" | ")}`).toBeTruthy();
        expect(moved).toContain("→");
      }
      // 컴파일 카운트는 정직하게 유지된다(대화 1 + 전투 1 + 도달 1 + 수집 1 + 기버 1 + 게이트 1).
      expect(result.eventsCreated).toBe(6);
    });
  });
});

// 자료집 개요 「퀘스트」 표의 행 모델 — 등록 퀘스트와 제안을 한 목록으로, 상태·보상·이동 대상을 고정 프로젝트로 잰다.
describe("questTable", () => {
  isolateTimers();
  const DIR = fileURLToPath(new URL("./fixtures/quest-candidates", import.meta.url));
  type FixtureMap = { id: string; name: string; events: GameEvent[] };
  function fixture(game: string): Project {
    const raw = JSON.parse(readFileSync(join(DIR, "projects", `${game}.json`), "utf8")) as { maps: Record<string, FixtureMap>; quests: Project["quests"] };
    const ctx = { project: createEmptyToolProject(game) };
    for (const map of Object.values(raw.maps)) {
      const width = Math.max(20, ...map.events.map((event) => event.x + 2));
      const height = Math.max(15, ...map.events.map((event) => event.y + 2));
      const result = runTool(ctx, "create_map", { name: map.name || map.id, width, height, id: map.id });
      if (!result.ok) throw new Error(result.summary);
    }
    for (const map of Object.values(raw.maps)) ctx.project.maps[map.id]!.events = map.events;
    ctx.project.quests = raw.quests;
    return ctx.project;
  }
  function event(id: string, x: number, commands: GameEvent["pages"][number]["commands"]): GameEvent {
    return {
      id, name: id, x, y: 3,
      pages: [{ id: `${id}_p0`, name: "0", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", commands }],
    } as GameEvent;
  }
  /** 그래프 퀘스트 셋: 정상(시작·보고·보상), 보고 값을 켜는 이벤트가 사라진 것, 공용 이벤트에서만 진행하는 것. */
  function graphProject(): Project {
    const ctx = { project: createEmptyToolProject("quest-table") };
    const made = runTool(ctx, "create_map", { name: "광장", width: 20, height: 15, id: "hub" });
    if (!made.ok) throw new Error(made.summary);
    const project = ctx.project;
    project.database.items.push({ id: "it_herb", name: "약초" } as Project["database"]["items"][number]);
    project.maps.hub!.events = [
      event("ev_baker", 2, [{ kind: "setSwitch", switchId: "sw_bread_on", value: true }]),
      event("ev_gate", 5, [
        { kind: "fork", condition: { kind: "switch", switchId: "sw_bread_on", value: true }, then: [
          { kind: "setSwitch", switchId: "sw_bread_done", value: true },
          { kind: "changeGold", op: "+=", amount: 120 },
          { kind: "changeItem", itemId: "it_herb", op: "+=", amount: 2 },
        ], else: [] },
      ]),
    ];
    project.commonEvents = [{ id: "ce_bell", name: "종소리", trigger: "none", commands: [{ kind: "setSwitch", switchId: "sw_bell_on", value: true }] }];
    const node = (id: string, switchId: string) => ({ id, description: id, completesWhen: { kind: "switch" as const, switchId, value: true } });
    project.quests = [
      { kind: "graph", id: "q_bread", title: "빵 나르기", nodes: [node("a", "sw_bread_on"), node("b", "sw_bread_done")], edges: [{ from: "a", to: "b" }] },
      { kind: "graph", id: "q_lost", title: "가 사라진 보고", nodes: [node("a", "sw_bread_on"), node("b", "sw_nobody_sets_this")], edges: [{ from: "a", to: "b" }] },
      { kind: "graph", id: "q_bell", title: "나 종소리", nodes: [node("a", "sw_bell_on")], edges: [] },
    ];
    return project;
  }
  describe("퀘스트 표 — 행 모델", () => {
    it("그래프 퀘스트의 시작·보고·보상·상태를 이벤트에서 찾는다", () => {
      const rows = buildQuestTableRows(graphProject());
      const summary = rows.map((row) => ({
        id: row.id,
        status: row.status,
        giver: row.giver?.eventId ?? null,
        turnIn: row.turnIn?.eventId ?? null,
        giverJump: row.giverJump.ok ? row.giverJump.eventId : row.giverJump.reason,
        turnInJump: row.turnInJump.ok ? `${row.turnInJump.mapId}/${row.turnInJump.eventId}@${row.turnInJump.x},${row.turnInJump.y}` : row.turnInJump.reason,
        reward: row.reward,
      }));
      expect(summary).toEqual([
        {
          id: "q_lost", status: "unreachable", giver: "ev_baker", turnIn: null,
          giverJump: "ev_baker", turnInJump: "진행 값 sw_nobody_sets_this 을(를) 켜는 이벤트가 없습니다", reward: null,
        },
        {
          id: "q_bell", status: "registered", giver: null, turnIn: null,
          giverJump: "공용 이벤트 「종소리」에서 진행합니다 — 맵 위치가 없습니다",
          turnInJump: "공용 이벤트 「종소리」에서 진행합니다 — 맵 위치가 없습니다", reward: null,
        },
        {
          id: "q_bread", status: "registered", giver: "ev_baker", turnIn: "ev_gate",
          giverJump: "ev_baker", turnInJump: "hub/ev_gate@5,3",
          reward: { gold: 120, items: [{ itemId: "it_herb", name: "약초", count: 2 }] },
        },
      ]);
    });

    it("같은 보상을 두 페이지에 갈래로 두면 한 번만 센다", () => {
      const project = graphProject();
      const gate = project.maps.hub!.events.find((entry) => entry.id === "ev_gate")!;
      gate.pages = [gate.pages[0]!, { ...gate.pages[0]!, id: "ev_gate_p1" }];
      const row = buildQuestTableRows(project).find((entry) => entry.id === "q_bread")!;
      expect(row.reward).toEqual({ gold: 120, items: [{ itemId: "it_herb", name: "약초", count: 2 }] });
    });

    it("Terra 고양이 게임: 퀘스트 0개면 제안 한 행, 등록하면 같은 자리의 등록 행 하나", () => {
      const project = fixture("L6__L__fun-cat-1");
      const before = buildQuestTableRows(project);
      expect(before.map((row) => [row.status, row.title, row.giver?.eventId, row.turnIn?.eventId, row.giverJump.ok, row.turnInJump.ok, row.registrable]))
        .toEqual([["suggested", "도토리의 부탁", before[0]!.candidate!.giver.eventId, before[0]!.candidate!.turnIn.eventId, true, true, true]]);
      expect(before[0]!.confidence).toBe(pendingQuestCandidates(project)[0]!.confidence);

      registerQuestCandidate(project, before[0]!.candidate!);
      const after = buildQuestTableRows(project);
      expect(after.map((row) => [row.status, row.id, row.giverJump.ok, row.turnInJump.ok])).toEqual([["registered", before[0]!.candidate!.id, true, true]]);
      expect(questTableCounts(after)).toEqual({ registered: 1, suggested: 0, unreachable: 0 });
    });

    it("거르기: 등록됨은 닿지 않음까지, 제안은 제안만", () => {
      const project = graphProject();
      const rows = buildQuestTableRows(project);
      expect(filterQuestTableRows(rows, "registered").map((row) => row.id)).toEqual(["q_lost", "q_bell", "q_bread"]);
      expect(filterQuestTableRows(rows, "suggested")).toEqual([]);
      expect(filterQuestTableRows(rows, "all")).toHaveLength(3);
    });
  });
  describe("퀘스트 표 — 이동 대상", () => {
    it("맵이나 이벤트가 없으면 이유와 함께 막는다", () => {
      const project = graphProject();
      expect(resolveQuestJumpTarget(project, { mapId: "hub", eventId: "ev_gate", mapName: "광장", eventName: "ev_gate" }))
        .toEqual({ ok: true, mapId: "hub", eventId: "ev_gate", x: 5, y: 3 });
      expect(resolveQuestJumpTarget(project, { mapId: "gone", eventId: "ev_gate", mapName: "gone", eventName: "ev_gate" }))
        .toEqual({ ok: false, reason: "맵 gone 이(가) 프로젝트에 없습니다" });
      expect(resolveQuestJumpTarget(project, { mapId: "hub", eventId: "ev_gone", mapName: "광장", eventName: "ev_gone" }))
        .toEqual({ ok: false, reason: "맵 「광장」에 이벤트 ev_gone 이(가) 없습니다" });
      expect(resolveQuestJumpTarget(project, null, "x")).toEqual({ ok: false, reason: "x" });
    });

    it("단계 퀘스트의 부탁 이벤트가 지워지면 닿지 않음으로 분류한다", () => {
      const project = graphProject();
      project.quests = [{ key: "q_step", title: "단계", summary: "", giver: { mapId: "hub", eventId: "ev_deleted" }, steps: [], rewards: { gold: 50 } }];
      const [row] = buildQuestTableRows(project);
      expect([row!.status, row!.giverJump.ok, row!.turnInJump.ok, row!.reward]).toEqual(["unreachable", false, false, { gold: 50, items: [] }]);
    });
  });
});

describe("storyFlags", () => {
  isolateTimers();
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
    it("updates a description without changing its identity, usage, retirement or progress", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      expect(runTool(ctx, "declare_story_flag", {
        id: "camp-ridge", kind: "switch", targetId: "sw_0003", description: "산길 조사",
        questId: "camp", tags: ["camp"],
      }).ok).toBe(true);
      ctx.project.storyFlags![0]!.retired = true;
      ctx.project.session.switches.sw_0003 = true;
      addEvent(ctx.project, event("camp-reader", [page("p1", [
        { kind: "switch", switchId: "sw_0003", value: true },
      ])]));
      const before = structuredClone(ctx.project);

      expect(runTool(ctx, "declare_story_flag", {
        action: "update", id: "camp-ridge", description: "새솔마을 조사",
      }).ok).toBe(true);
      expect(ctx.project.storyFlags).toEqual([{ ...before.storyFlags![0], description: "새솔마을 조사" }]);
      expect(ctx.project.session).toEqual(before.session);
      expect(ctx.project.switches).toEqual(before.switches);
      expect(ctx.project.maps).toEqual(before.maps);
      expect(ctx.project.quests).toEqual(before.quests);
    });

    it("rejects missing descriptions, unknown flags and attempts to retarget an update", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      expect(runTool(ctx, "declare_story_flag", {
        id: "camp-ridge", kind: "switch", targetId: "sw_0003", description: "산길 조사",
      }).ok).toBe(true);
      const before = structuredClone(ctx.project.storyFlags);
      for (const patch of [
        { description: "" },
        { description: "새솔마을", targetId: "sw_0004" },
        { description: "새솔마을", newId: "other-camp" },
        { description: "새솔마을", retired: false },
        { description: "새솔마을", id: "missing-camp" },
      ]) {
        expect(runTool(ctx, "declare_story_flag", { action: "update", id: "camp-ridge", ...patch }).ok).toBe(false);
        expect(ctx.project.storyFlags).toEqual(before);
      }
    });

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
    it("indexes reads and writes inside nested battle outcome branches", () => {
      const project = createBlankProject();
      addEvent(project, event("ev_outcomes", [page("p1", [], [{
        kind: "choices", options: [{ text: "Battle", branch: [{
          kind: "battleProcessing", troopId: project.database.troops[0]!.id,
          canEscape: true, canLose: true, branchOnResult: true,
          victoryBranch: [{ kind: "setSwitch", switchId: "sw_0003", value: true }],
          defeatBranch: [{ kind: "setVariable", variableId: "var_0001", op: "=", value: { kind: "var", id: "var_0002" } }],
          escapeBranch: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_0004", value: true },
            then: [{ kind: "setSwitch", switchId: "sw_0005", value: true }] }],
        }] }],
      }])]));
      const index = buildStoryFlagUsageIndex(project);
      const victory = usageBucketFor(index, "switch", "sw_0003").writes;
      expect(victory).toHaveLength(1);
      expect(victory[0]).toMatchObject({ eventId: "ev_outcomes", pageId: "p1", commandPath: "pages[0].commands[0].options[0].branch[0].victoryBranch[0]" });
      expect(usageBucketFor(index, "variable", "var_0001").writes).toHaveLength(1);
      expect(usageBucketFor(index, "variable", "var_0002").reads).toHaveLength(1);
      expect(usageBucketFor(index, "switch", "sw_0004").reads).toHaveLength(1);
      expect(usageBucketFor(index, "switch", "sw_0005").writes[0]?.commandPath).toContain(".escapeBranch[0].then[0]");
      const quest = normalizeQuestGraph(project, {
        id: "battle-result", title: "Battle result", edges: [],
        nodes: [{ id: "victory", description: "Win", completesWhen: { kind: "switch", switchId: "sw_0003", value: true } }],
      });
      expect(lintQuestGraph(project, quest).filter((issue) => issue.code === "quest-graph:dead-end-node")).toEqual([]);
      project.quests = [quest];
      const walkthrough = generateQuestWalkthrough(project, quest.id);
      expect(walkthrough.nodes[0]?.automatic).toBe(false);
      expect(walkthrough.manualHints).not.toHaveLength(0);
    });

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
});
