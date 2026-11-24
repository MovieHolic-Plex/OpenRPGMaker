import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runAutoPlay } from "@/qa/gameCheck/autoPlay";
import { eventsCutOffBy } from "@/project/eventPassageBlock";
import { runGameCheck } from "@/qa/gameCheck";
import { buildMapGraph, checkMapGraph } from "@/qa/gameCheck/mapGraph";
import type { Project, GameEvent } from "@/project/types";
import { jrpgCompletionGateApplies, jrpgCompletionGaps } from "@/qa/gameCheck/jrpgCompletion";
import { isRateLimitMessage, rateLimitedUnresolved } from "../scripts/lib/piTeamRuntime";
import { checkJrpg } from "@/qa/gameCheck/jrpg";
import { enemyBattlers } from "@/battle/battleBattlers";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { checkProgression } from "@/qa/gameCheck/progression";
import { monsterBattleStatsForSpecies, monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import { isolateTimers } from "./mergedTeardown";

// 꿈 세계 도그푸딩 2026-09-24: 볼 꼬집기가 type special + switchId 라 사용해도 안 깨고,
// 출구 없는 꿈 맵에 갇힌 채 자동 플레이가 「가는 문이 없다」로 막혔다.
describe("dreamPinchWake", () => {
  isolateTimers();
  function passableNear(project: ReturnType<typeof createBlankProject>, mapId: string, x: number, y: number, avoid: { x: number; y: number }[] = []): { x: number; y: number } {
    const map = project.maps[mapId]!;
    const blocked = new Set(avoid.map((cell) => `${cell.x},${cell.y}`));
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const candidate = { x: x + dx, y: y + dy };
        if (candidate.x < 0 || candidate.y < 0 || candidate.x >= map.width || candidate.y >= map.height) continue;
        if (blocked.has(`${candidate.x},${candidate.y}`)) continue;
        if (dx === 0 && dy === 0) continue;
        if (isPassable(project, map, candidate.x, candidate.y)) return candidate;
      }
    }
    throw new Error(`통행 칸 없음 ${mapId} (${x},${y})`);
  }
  function firstPassable(project: ReturnType<typeof createBlankProject>, mapId: string): { x: number; y: number } {
    const map = project.maps[mapId]!;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (isPassable(project, map, x, y)) return { x, y };
      }
    }
    throw new Error(`통행 칸 없음 ${mapId}`);
  }
  describe("꿈에서 깨는 스위치 아이템", () => {
    it("switchId 만 있는 special 아이템은 switch 로 저장한다", () => {
      const project = createBlankProject();
      project.switches.push({ id: "sw_wake", name: "깨기" });
      const ctx: ToolContext = { project };
      const result = runTool(ctx, "upsert_item", {
        item: { id: "item_pinch", name: "볼 꼬집기", type: "special", switchId: "sw_wake", occasion: "field", consumable: false, scope: "none" },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.items.find((item) => item.id === "item_pinch")).toMatchObject({ type: "switch", switchId: "sw_wake" });
      expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("switch");
    });

    it("출구 없는 맵에서 꼬집으면 방으로 돌아와 다음 맵의 엔딩까지 간다", () => {
      const project = createBlankProject();
      project.switches.push({ id: "sw_wake", name: "깨기" }, { id: "sw_seen", name: "봄" });
      const ctx: ToolContext = { project };
      expect(runTool(ctx, "create_map", { id: "map_trap", name: "함정", width: 8, height: 8 }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_goal", name: "결말", width: 8, height: 8 }).ok).toBe(true);
      expect(runTool(ctx, "upsert_item", {
        item: { id: "item_pinch", name: "볼 꼬집기", type: "special", switchId: "sw_wake", occasion: "field", consumable: false, scope: "none" },
      }).ok).toBe(true);
      expect(runTool(ctx, "upsert_common_event", {
        id: "ce_wake", name: "깨기", trigger: "auto", conditionSwitchId: "sw_wake",
        commands: [
          { kind: "setSwitch", switchId: "sw_wake", value: false },
          { kind: "transfer", mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y, fade: "none" },
        ],
      }).ok).toBe(true);
      expect(runTool(ctx, "set_session_start", { inventory: { item_pinch: 1 }, partyActorIds: project.session.partyActorIds }).ok).toBe(true);

      const live = () => ctx.project;
      const trapLand = firstPassable(live(), "map_trap");
      const goalLand = firstPassable(live(), "map_goal");
      const trapMark = passableNear(live(), "map_trap", trapLand.x, trapLand.y);
      const goalMark = passableNear(live(), "map_goal", goalLand.x, goalLand.y);
      const door = passableNear(live(), live().startMapId, live().startPos.x, live().startPos.y);
      const goalDoor = passableNear(live(), live().startMapId, live().startPos.x, live().startPos.y, [door]);
      const touch = (id: string, name: string, at: { x: number; y: number }, mapId: string, land: { x: number; y: number }) => ({
        id, name, x: at.x, y: at.y,
        pages: [{
          conditions: [], graphic: { transparent: true }, priority: "below", overlapForbidden: false,
          trigger: { kind: "playerTouch" },
          commands: [{ kind: "transfer", mapId, x: land.x, y: land.y, fade: "none" }],
        }],
      });
      const trapDoor = runTool(ctx, "upsert_event", { mapId: live().startMapId, event: touch("ev_to_trap", "함정문", door, "map_trap", trapLand) });
      expect(trapDoor.ok, trapDoor.summary).toBe(true);
      const goalDoorEvent = runTool(ctx, "upsert_event", { mapId: live().startMapId, event: touch("ev_to_goal", "결말문", goalDoor, "map_goal", goalLand) });
      expect(goalDoorEvent.ok, goalDoorEvent.summary).toBe(true);
      const mark = runTool(ctx, "upsert_event", {
        mapId: "map_trap",
        event: {
          id: "ev_mark", name: "표식", x: trapMark.x, y: trapMark.y,
          pages: [{
            conditions: [], graphic: { transparent: true }, priority: "below", overlapForbidden: false,
            trigger: { kind: "action" },
            commands: [{ kind: "setSwitch", switchId: "sw_seen", value: true }],
          }],
        },
      });
      expect(mark.ok, mark.summary).toBe(true);
      live().endings = [{ id: "ending_wake", name: "끝", conditions: [], priority: 1 }];
      const endingEvent = runTool(ctx, "upsert_event", {
        mapId: "map_goal",
        event: {
          id: "ev_end", name: "거울", x: goalMark.x, y: goalMark.y,
          pages: [{
            conditions: [{ kind: "switch", switchId: "sw_seen", value: true }],
            graphic: { transparent: true }, priority: "below", overlapForbidden: false,
            trigger: { kind: "action" },
            commands: [{ kind: "triggerEnding", endingId: "ending_wake" }],
          }],
        },
      });
      expect(endingEvent.ok, endingEvent.summary).toBe(true);

      const woken = runSceneTest(live(), {
        mapId: "map_trap", start: trapLand,
        steps: [{ kind: "useItem", itemId: "item_pinch" }, { kind: "expect", mapId: live().startMapId }],
      });
      expect(woken.ok, woken.failureReason).toBe(true);

      const lateOff = runTool(ctx, "upsert_common_event", {
        id: "ce_wake", name: "깨기", trigger: "auto", conditionSwitchId: "sw_wake",
        commands: [
          { kind: "transfer", mapId: live().startMapId, x: live().startPos.x, y: live().startPos.y, fade: "none" },
          { kind: "setSwitch", switchId: "sw_wake", value: false },
        ],
      });
      expect(lateOff.ok, lateOff.summary).toBe(true);
      const stillOnce = runSceneTest(live(), {
        mapId: "map_trap", start: trapLand,
        steps: [{ kind: "useItem", itemId: "item_pinch" }, { kind: "face", dir: "up" }, { kind: "expect", mapId: live().startMapId }],
      });
      expect(stillOnce.ok, stillOnce.failureReason).toBe(true);

      const report = runAutoPlay(live(), { budgetMs: 20_000 });
      expect(report.runs[0]?.ok, report.runs[0]?.failure?.detail).toBe(true);
      expect(report.runs[0]?.endingReached).toBe("ending_wake");
    });
  });
});

// 한 칸 문간에 세운 막는 이벤트가 너머를 끊으면, 문이 아닌 이벤트는 옆 칸으로 옮긴다.
// 2026-09-24 갤러리 호러 r5: 출구 회랑 문간의 가면 인형이 출구 그림과 두 엔딩을 막았다. 경고만으로는 안 옮겨졌다.
describe("eventPassageBlock", () => {
  isolateTimers();
  function twoRooms(): { ctx: { project: Project }; mapId: string; door: { x: number; y: number } } {
    const ctx: { project: Project } = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const map = ctx.project.maps[mapId]!;
    const { x: sx, y: sy } = ctx.project.startPos;
    const wallX = sx + 2;
    for (let y = 0; y < map.height; y += 1) if (y !== sy) map.lowerTiles[y * map.width + wallX] = -1;
    return { ctx, mapId, door: { x: wallX, y: sy } };
  }
  const warningsOf = (result: unknown): string => JSON.stringify(result);
  describe("passage-blocking event warning", () => {
    it("moves a non-door NPC off the one-tile doorway", () => {
      const { ctx, mapId, door } = twoRooms();
      const painting = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "그림." }] }] } });
      expect(painting.ok, painting.summary).toBe(true);
      expect(warningsOf(painting)).not.toContain("통로를 막아");
      const doll = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_doll", name: "가면 인형", x: door.x, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [{ kind: "text", body: "..." }] }] } });
      expect(doll.ok, doll.summary).toBe(true);
      expect(warningsOf(doll)).toContain("통로를 막아");
      expect(warningsOf(doll)).toContain("옮겼습니다");
      expect(warningsOf(doll)).toContain("출구 그림");
      const map = ctx.project.maps[mapId]!;
      const placed = map.events.find((event) => event.id === "ev_doll")!;
      expect(placed.x === door.x && placed.y === door.y).toBe(false);
      expect(eventsCutOffBy(ctx.project, map, placed)).toEqual([]);
    });

    it("leaves a transfer door in the doorway and only warns", () => {
      const { ctx, mapId, door } = twoRooms();
      runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "그림." }] }] } });
      const gate = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_door", name: "잠긴 문", x: door.x, y: door.y,
          pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 }, commands: [{ kind: "transfer", mapId, x: door.x - 2, y: door.y }] }],
        },
      });
      expect(gate.ok, gate.summary).toBe(true);
      const placed = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_door")!;
      expect(placed.x).toBe(door.x);
      expect(placed.y).toBe(door.y);
      expect(warningsOf(gate)).toContain("통로를 막아");
      expect(warningsOf(gate)).not.toContain("옮겼습니다");
    });

    it("does not count the leftover blank seed map as a blocker once start has moved", () => {
      const project = createBlankProject();
      const seed = project.maps[project.startMapId]!;
      project.maps.map_gallery = { ...seed, id: "map_gallery", name: "푸른 회랑", events: [] };
      project.startMapId = "map_gallery";
      const findings = checkMapGraph(project, buildMapGraph(project));
      const orphan = findings.find((finding) => finding.code === "orphan-empty-map" && finding.where?.mapId === "map_blank_start");
      expect(orphan?.severity).toBe("warning");
      expect(findings.some((finding) => finding.severity === "blocker" && finding.code === "orphan-empty-map")).toBe(false);
    });

    it("stays quiet when the NPC stands beside the doorway or steps aside on a later page", () => {
      const { ctx, mapId, door } = twoRooms();
      runTool(ctx, "upsert_event", { mapId, event: { id: "ev_exit", name: "출구 그림", x: door.x + 2, y: door.y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [] }] } });
      const beside = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_doll", x: door.x - 1, y: door.y - 1, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [] }] } });
      expect(warningsOf(beside)).not.toContain("통로를 막아");
      const map = ctx.project.maps[mapId]!;
      const stepsAside = { id: "ev_doll2", x: door.x, y: door.y, pages: [
        { trigger: { kind: "action" }, conditions: [], priority: "same", commands: [] },
        { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_talked", value: true }], priority: "below", commands: [] },
      ] } as unknown as Parameters<typeof eventsCutOffBy>[2];
      expect(eventsCutOffBy(ctx.project, map, stepsAside)).toEqual([]);
    });

    // 2026-09-24 몬스터 수집 r2: 마을 북쪽 게이트(32,0) 는 랜딩 셀 (32,1) 이 유일한 접근 칸이고,
    // 그 랜딩이 transfer 씨앗이라 cut 판정이 복도 안(32,2)으로의 이동을 수락해 문을 끊었다.
    // 재현: 1칸 복도 + 랜딩이 문 바로 앞 + 복도가 방으로 이어지는 구조.
    it("does not settle the relief inside the one-tile corridor a landing seed masks", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const map = ctx.project.maps[mapId]!;
      // (5,0) 문, 복도 (5,1)·(5,2), 방은 y>=3. 좌우는 전부 벽 — 접근은 (5,1) 하나뿐.
      for (const [wx, wy] of [[4, 0], [6, 0], [4, 1], [6, 1], [4, 2], [6, 2]] as const) {
        map.lowerTiles[wy * map.width + wx] = -1;
        map.upperTiles[wy * map.width + wx] = 0;
      }
      // transfer 랜딩 = (5,1) — cut 판정의 씨앗이 문 바로 앞에 놓인다.
      runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_arrival", x: 3, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "transfer", mapId, x: 5, y: 1 }] }] },
      });
      runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_door", name: "북쪽 문", x: 5, y: 0, pages: [{ trigger: { kind: "playerTouch" }, conditions: [], priority: "same", overlapForbidden: false, commands: [{ kind: "transfer", mapId, x: 3, y: 5 }] }] },
      });
      const sign = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_sign", name: "길 안내판", x: 5, y: 1, pages: [{ trigger: { kind: "action" }, conditions: [], priority: "same", commands: [{ kind: "text", body: "북쪽으로." }] }] },
      });
      expect(sign.ok, sign.summary).toBe(true);
      expect(warningsOf(sign)).toContain("옮겼습니다");
      const placed = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_sign")!;
      expect(placed.x === 5 && placed.y <= 3).toBe(false);
      expect(eventsCutOffBy(ctx.project, map, placed)).toEqual([]);
    });
  });
  describe("fork else ending", () => {
    it("turns on the switch a false-condition fork is avoiding before the else ending", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const { x, y } = ctx.project.startPos;
      ctx.project.endings = [{ id: "ending_lonely", name: "쓸쓸", priority: 1, conditions: [] }];
      const setter = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_doll", name: "가면 인형", x: x + 1, y,
          pages: [{
            trigger: { kind: "action" }, conditions: [], priority: "same",
            commands: [{ kind: "text", body: "장미를 내놔." }, { kind: "setSwitch", switchId: "sw_gave", value: true }],
          }],
        },
      });
      expect(setter.ok, setter.summary).toBe(true);
      const exit = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_exit", name: "출구 그림", x, y: y + 1,
          pages: [{
            trigger: { kind: "action" }, conditions: [], priority: "same",
            commands: [{
              kind: "fork",
              condition: { kind: "switch", switchId: "sw_gave", value: false },
              then: [{ kind: "text", body: "함께 나간다." }],
              else: [{ kind: "triggerEnding", endingId: "ending_lonely" }],
            }],
          }],
        },
      });
      expect(exit.ok, exit.summary).toBe(true);
      const report = runGameCheck(ctx.project, { autoPlayBudgetMs: 20_000 });
      const run = report.autoPlay?.runs.find((entry) => entry.label === "기본 경로");
      expect(run?.ok, run?.failure?.detail).toBe(true);
      expect(run?.endingReached).toBe("ending_lonely");
    });
  });
});

describe("jrpgCompletionGaps", () => {
  isolateTimers();
  // jrpg-real-1 J04/J05: 기본 제목·빈 시작 마을·부르지 않는 시간 엔딩은 뼈대 엔딩 도달만으로 통과하던 구멍이다.
  function jrpg(overrides: Record<string, unknown> = {}): Project {
    const talk = (id: string, x: number) => ({ id, name: id, x, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands: [{ kind: "text", body: "안녕" }] }] });
    return {
      meta: { title: "버들나루의 봉인" },
      system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" } },
      startMapId: "m1",
      maps: { m1: { id: "m1", name: "마을", events: [talk("a", 1), talk("b", 3)] } },
      endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }, { id: "ending_time", name: "시간의 끝" }],
      commonEvents: [],
      ...overrides,
    } as unknown as Project;
  }
  describe("jrpgCompletionGaps", () => {
    it("reports default title, empty start town and uninvoked endings", () => {
      const project = jrpg({ meta: { title: "새 게임" }, system: { genre: "adventure-jrpg", titleScreen: { title: "새 게임" } }, maps: { m1: { id: "m1", name: "마을", events: [] } } });
      const gaps = jrpgCompletionGaps(project, "");
      expect(gaps.some((gap) => gap.includes("기본값"))).toBe(true);
      expect(gaps.some((gap) => gap.includes("말을 거는 인물"))).toBe(true);
      expect(gaps.some((gap) => gap.includes("정의만 있고"))).toBe(true);
    });

    it("needs a non-skeleton ending for a time story", () => {
      const project = jrpg({ endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }] });
      expect(jrpgCompletionGaps(project, "시간을 넘나드는 이야기").some((gap) => gap.includes("첫 구간 끝"))).toBe(true);
    });

    it("a project with no database does not throw out of the balance check (jrpg-real-1 J06 gate is best-effort)", () => {
      expect(() => jrpgCompletionGaps(jrpg(), "")).not.toThrow();
    });

    it("ignores non-JRPG projects", () => {
      expect(jrpgCompletionGaps({ system: { genre: "monster-collect" }, maps: {}, startMapId: "x" } as unknown as Project, "")).toEqual([]);
    });
  });
  describe("채팅 한 줄 JRPG 요청 (jrpg-loop-1)", () => {
    it("applies to a chat-line JRPG request, not to an unrelated small edit", () => {
      expect(jrpgCompletionGateApplies(jrpg(), "크로노 트리거처럼 시간여행 JRPG 만들어 줘")).toBe(true);
      expect(jrpgCompletionGateApplies({ system: {} } as unknown as Project, "파이널판타지6 같은 게임 만들어 줘")).toBe(true);
      expect(jrpgCompletionGateApplies(jrpg(), "여관 하나만 더 지어 줘")).toBe(false);
      expect(jrpgCompletionGateApplies(jrpg(), "이 게임을 처음부터 다시 만들어 줘")).toBe(true);
    });

    it("flags an opening that is only the title card", () => {
      const only = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: true, scenes: [{ id: "s", kind: "text", narration: "— 새 게임 —", durationMs: 4200 }] } } });
      expect(jrpgCompletionGaps(only, "").some((gap) => gap.includes("오프닝"))).toBe(true);
      const written = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: true, scenes: [{ id: "s", kind: "text", narration: "옛날 옛적에 별이 떨어졌다.", durationMs: 4200 }, { id: "t", kind: "text", narration: "— 버들나루의 봉인 —", durationMs: 4200 }] } } });
      expect(jrpgCompletionGaps(written, "").some((gap) => gap.includes("오프닝"))).toBe(false);
      const off = jrpg({ system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, opening: { enabled: false, scenes: [{ id: "s", kind: "text", narration: "— 새 게임 —" }] } } });
      expect(jrpgCompletionGaps(off, "").some((gap) => gap.includes("오프닝"))).toBe(false);
    });

    it("flags the seed fishing village (lighthouse) left under a non-harbor name — 6 of 6 loop projects kept it", () => {
      const lighthouse = [{ kitId: "bd-pick-fishing-port-lighthouse", x: 1, y: 1 }];
      const bad = jrpg({ startMapId: "m1", maps: { m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] } } });
      expect(jrpgCompletionGaps(bad, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
      const harbor = jrpg({ startMapId: "m1", maps: { m1: { id: "m1", name: "푸른 항구 마을", structurePlacements: lighthouse, events: [] } } });
      expect(jrpgCompletionGaps(harbor, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(false);
    });

    it("ignores the old seed map once the start moved to a new town and nothing transfers into it (loop-3: protected houses cannot be erased)", () => {
      const lighthouse = [{ kitId: "bd-pick-fishing-port-lighthouse", x: 1, y: 1 }];
      const moved = jrpg({ startMapId: "m2", maps: {
        m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] },
        m2: { id: "m2", name: "눈 덮인 요새", events: [] },
      } });
      expect(jrpgCompletionGaps(moved, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(false);
      const linked = jrpg({ startMapId: "m2", maps: {
        m1: { id: "m1", name: "잿빛 설원 · 저항군 전초기지", structurePlacements: lighthouse, events: [] },
        m2: { id: "m2", name: "눈 덮인 요새", events: [{ id: "e", x: 0, y: 0, pages: [{ commands: [{ kind: "transfer", mapId: "m1", x: 1, y: 1 }] }] }] },
      } });
      expect(jrpgCompletionGaps(linked, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
      const renamedRetiredSeed = jrpg({ startMapId: "m2", maps: {
        map_blank_start: { id: "map_blank_start", name: "(구) 포구 외곽 — 폐쇄 구역", structurePlacements: lighthouse, events: [] },
        m2: { id: "m2", name: "눈 덮인 요새", events: [{ id: "e", x: 0, y: 0, pages: [{ commands: [{ kind: "transfer", mapId: "map_blank_start", x: 1, y: 1 }] }] }] },
      } });
      expect(jrpgCompletionGaps(renamedRetiredSeed, "").some((gap) => gap.includes("씨앗 어촌"))).toBe(true);
    });

    it("does not emit unreachable-map blocker when startMapId moved off map_blank_start and map_blank_start still has seed events (r3-ff1)", () => {
      const project = {
        startMapId: "m2",
        startPos: { x: 0, y: 0 },
        maps: {
          map_blank_start: { id: "map_blank_start", name: "옛 씨앗 마을", width: 10, height: 10, tilesetId: "t", lowerTiles: new Array(100).fill(0), upperTiles: new Array(100).fill(-1), events: [{ id: "ev_seed", name: "촌장", x: 1, y: 1, pages: [] }] },
          m2: { id: "m2", name: "새 시작 마을", width: 10, height: 10, tilesetId: "t", lowerTiles: new Array(100).fill(0), upperTiles: new Array(100).fill(-1), events: [] },
        },
        tilesets: { t: { id: "t", name: "t", tileWidth: 16, tileHeight: 16, passability: {} } },
      } as unknown as Project;
      // 맵 그래프 검사는 이제 시작 칸 통행도 본다(collision.isPassable) — 옛 `data` 배열 대신 실제 맵 모양(lowerTiles·upperTiles)으로 둔다.
      const findings = checkMapGraph(project, buildMapGraph(project));
      expect(findings.some((finding) => finding.code === "unreachable-map" && finding.where?.mapId === "map_blank_start")).toBe(false);
    });

    it("uses the request text as part of the brief for the time-ending check", () => {
      const project = jrpg({ endings: [{ id: "ending_first_segment", name: "첫 구간 끝" }] });
      expect(jrpgCompletionGaps(project, "", { task: "과거와 미래를 오가는 RPG 만들어 줘" }).some((gap) => gap.includes("첫 구간 끝"))).toBe(true);
    });
  });
  describe("429 handling in the team runtime", () => {
    it("recognises rate-limit messages", () => {
      expect(isRateLimitMessage("HTTP 429 Too Many Requests")).toBe(true);
      expect(isRateLimitMessage("map not found")).toBe(false);
    });

    it("keeps a cut-off assignment unresolved until the same map succeeds later", () => {
      const cut = { agentId: "builder-1", mapId: "m1", ok: false, summary: "429 rate limit" };
      expect(rateLimitedUnresolved(new Map([["builder-1", cut]]))).toHaveLength(1);
      const retried = new Map([["builder-1", cut], ["builder-2", { agentId: "builder-2", mapId: "m1", ok: true, summary: "done" }]]);
      expect(rateLimitedUnresolved(retried)).toHaveLength(0);
    });
  });
  describe("요청한 규모 — 탈것·붕괴 전후 (jrpg-loop-1 D13)", () => {
    const ask = "마법으로 평화롭던 세계가 무너져서 폐허가 된 뒤에 동료 모아서 반격하는 JRPG. 비공정 같은 탈것도 있으면 좋겠어요";
    it("비공정을 말했는데 탈것이 없고 붕괴 후 맵도 없으면 둘 다 막는다", () => {
      const gaps = jrpgCompletionGaps(jrpg(), "", { task: ask });
      expect(gaps.some((gap) => gap.includes("place_vehicle"))).toBe(true);
      expect(gaps.some((gap) => gap.includes("derive_map_variant"))).toBe(true);
    });
    it("비행선을 세우고 붕괴 후 맵을 만들면 통과한다", () => {
      const project = jrpg({
        system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, vehicles: [{ id: "airship", characterIndex: 2, mapId: "m1", x: 1, y: 1 }] },
        maps: { m1: { id: "m1", name: "마을", events: [] }, m2: { id: "m2", name: "마을 (붕괴 후)", defaultLighting: { ambient: 0.5, color: "#223" }, events: [] } },
      });
      const gaps = jrpgCompletionGaps(project, "", { task: ask });
      expect(gaps.some((gap) => gap.includes("place_vehicle"))).toBe(false);
      expect(gaps.some((gap) => gap.includes("derive_map_variant"))).toBe(false);
    });
    it("이름만 「폐허」인 맵은 붕괴 후로 세지 않는다(jrpg-loop-2 ff2)", () => {
      const project = jrpg({
        system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, vehicles: [{ id: "airship", characterIndex: 2, mapId: "m1", x: 1, y: 1 }] },
        maps: { m1: { id: "m1", name: "마을", events: [] }, m2: { id: "m2", name: "에덴의 폐허 거점", events: [] } },
      });
      expect(jrpgCompletionGaps(project, "", { task: ask }).some((gap) => gap.includes("derive_map_variant"))).toBe(true);
    });
  });
  describe("동료 약속 (jrpg-loop-2 ct2)", () => {
    it("requires two joining companions when the request promises companions (ct2 had none)", () => {
      const talk = (id: string, commands: unknown[]) => ({ id, name: id, x: 1, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands }] });
      const none = jrpg();
      expect(jrpgCompletionGaps(none, "", { task: "시대마다 동료를 만나는 RPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(true);
      const two = jrpg({ maps: { m1: { id: "m1", name: "마을", events: [talk("a", [{ kind: "changeParty", action: "add", actorId: "x1" }]), talk("b", [{ kind: "changeParty", action: "add", actorId: "x2" }])] } } });
      expect(jrpgCompletionGaps(two, "", { task: "시대마다 동료를 만나는 RPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(false);
      expect(jrpgCompletionGaps(none, "", { task: "그냥 JRPG" }).some((gap) => gap.includes("합류하는 인물"))).toBe(false);
    });

    it("flags when changeParty add companions are already pre-populated in the starting party (r3-ff1, r3-ct1)", () => {
      const talk = (id: string, commands: unknown[]) => ({ id, name: id, x: 1, y: 2, pages: [{ id: `${id}_p`, trigger: { kind: "action" }, commands }] });
      const prePopulated = jrpg({
        system: { genre: "adventure-jrpg", titleScreen: { title: "버들나루의 봉인" }, startActorIds: ["hero", "x1", "x2"], party: ["hero", "x1", "x2"] },
        maps: { m1: { id: "m1", name: "마을", events: [talk("a", [{ kind: "changeParty", action: "add", actorId: "x1" }]), talk("b", [{ kind: "changeParty", action: "add", actorId: "x2" }])] } },
      });
      const gaps = jrpgCompletionGaps(prePopulated, "", { task: "시대마다 동료를 만나는 RPG" });
      expect(gaps.some((gap) => gap.includes("set_party") && gap.includes("시작 파티"))).toBe(true);
    });

    it("strips [의도 메모] system guidance from options.task so coast/era instructions do not trigger harborExempt or TIME_BRIEF (jrpg-loop-4 ff1, ff2)", () => {
      const seededHarbor = jrpg({
        startMapId: "map_blank_start",
        system: { genre: "adventure-jrpg", titleScreen: { title: "잿불의 성흔" } },
        endings: [{ id: "ending_first_segment", name: "첫 구간 끝", conditions: [] }],
        maps: {
          map_blank_start: {
            id: "map_blank_start",
            name: "잿불 해안 거점 (구 버들항 유적)",
            structurePlacements: [{ kitId: "bd-pick-fishing-port-lighthouse", x: 40, y: 20 }],
            events: [
              { id: "e1", name: "장로", x: 1, y: 1, pages: [{ id: "p1", trigger: { kind: "action" }, commands: [{ kind: "text", body: "가자" }] }] },
              { id: "e2", name: "상인", x: 2, y: 1, pages: [{ id: "p2", trigger: { kind: "action" }, commands: [{ kind: "text", body: "물건" }, { kind: "triggerEnding", endingId: "ending_first_segment" }] }] },
            ],
          },
        },
      });
      const taskWithIntentMemo = "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로\n\n[의도 메모 — 아래는 사용자 글이 아니라 시스템 지침]\ntheme 은 말에서 고른다: 항구·포구·어촌·바닷가 = coast. 시대·평행세계처럼 같은 지리를 여러 벌 쓰는 게임은 derive_map_variant 를 쓴다.";
      const gaps = jrpgCompletionGaps(seededHarbor, "", { task: taskWithIntentMemo });
      expect(gaps.some((gap) => gap.includes("씨앗 어촌(등대·항구)"))).toBe(true);
      expect(gaps.some((gap) => gap.includes("시간·시대 이야기를 요청했는데"))).toBe(false);
    });
  });
});

// jrpg-loop-1 D7: 조수가 만든 JRPG 파티원은 전부 기본 곡선(HP514·MP43…)이라 같은 몸이었다 — 도구가 즉시 알리고 검사가 평평한 파티도 잡는다.
describe("jrpgPartyRoleCurves", () => {
  isolateTimers();
  function party(curves: Array<Record<string, number[]> | undefined>): { project: Project; warnings: string[][] } {
    const ctx = { project: createBlankProject() };
    ctx.project.system.genre = "adventure-jrpg";
    const warnings: string[][] = [];
    const ids: string[] = [];
    curves.forEach((parameterCurves, index) => {
      const id = `actor_t${index}`;
      ids.push(id);
      const result = runTool(ctx as never, "upsert_actor", { actor: { id, name: `배우${index}`, classId: ctx.project.database.classes[0]!.id, ...(parameterCurves ? { parameterCurves } : {}) } });
      warnings.push(result.ok ? (result.diff.warnings ?? []) : [String(result.summary)]);
    });
    expect(runTool(ctx as never, "set_party", { scope: "start", actorIds: ids }).ok).toBe(true);
    return { project: ctx.project, warnings };
  }
  describe("JRPG 파티 역할 곡선", () => {
    // #2890 부터 upsert_actor 는 parameterCurves 를 생략하면 역할별 [Lv1, Lv99] 곡선을 스스로 채운다 — 「완전히 같습니다」 경고는 그때 걷혔다.
    it("곡선을 생략한 배우는 기본 곡선(HP514) 대신 역할 곡선을 받는다", () => {
      const { project } = party([undefined, undefined]);
      for (const id of ["actor_t0", "actor_t1"]) {
        const curves = project.database.actors.find((actor) => actor.id === id)?.parameterCurves;
        expect(curves?.maxHp?.length, id).toBe(99);
        expect(curves?.maxHp?.[0], id).not.toBe(514);
      }
    });
    it("역할별 곡선을 주면 같은 몸 경고도 평평한 파티 경고도 없다", () => {
      const { project, warnings } = party([
        { maxHp: [640, 6200], defense: [90, 900], attack: [70, 780] },
        { maxHp: [380, 3600], maxMp: [75, 980], mind: [95, 950] },
        { agility: [85, 950], attack: [65, 760], maxHp: [470, 4600] },
      ]);
      expect(warnings.flat().some((text) => text.includes("완전히 같습니다"))).toBe(false);
      const codes = checkJrpg(project).map((finding) => finding.code);
      expect(codes).not.toContain("jrpg-party-identical-stats");
      expect(codes).not.toContain("jrpg-party-flat-roles");
    });
    it("같은 몸 셋에 다른 몸 하나가 섞여도 identical-stats 로 잡는다(jrpg-loop-3: 탈것 배우 합류가 가렸다)", () => {
      const { project } = party([undefined, undefined, undefined, { maxHp: [437, 4000], maxMp: [39, 400] }]);
      const found = checkJrpg(project).find((finding) => finding.code === "jrpg-party-identical-stats");
      expect(found).toBeDefined();
      expect(found!.message).toContain("배우0");
      expect(found!.message).not.toContain("배우3");
    });
    it("세 명 이상인데 곡선이 거의 같으면 flat-roles 로 잡는다", () => {
      const { project } = party([
        { maxHp: [520, 5000] },
        { maxHp: [530, 5050] },
        { maxHp: [510, 4980] },
      ]);
      const codes = checkJrpg(project).map((finding) => finding.code);
      expect(codes.includes("jrpg-party-identical-stats") || codes.includes("jrpg-party-flat-roles")).toBe(true);
    });
  });
});

// 몬스터 파티 게임의 종 적은 종족+레벨 공식으로 싸우고, 액터 파티 기준 보스 하한을 받지 않는다(gen5 실측).
// 행동이 비면 그 레벨의 습득 기술을 넣는다. 빈 목록은 Struggle 만 쓰고, 포획본은 기술을 잃는다(gen6 경고 실측).
describe("monsterEnemySpeciesScale", () => {
  isolateTimers();
  function monsterProject() {
    const project = createNewProjectSeed(newProjectChoiceById("monster-collect")!.packId, "적 척도");
    project.system.battleParty = "monsters";
    return project;
  }
  describe("upsert_enemy species scale", () => {
    it("replaces hand stats with the species formula at the enemy level", () => {
      const context = { project: monsterProject() };
      const speciesId = context.project.database.monsterSpecies![0]!.id;
      const result = runTool(context, "upsert_enemy", { enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 4, stats: { maxHp: 30, attack: 12 } } });
      expect(result.ok, result.summary).toBe(true);
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
      const formula = monsterBattleStatsForSpecies(monsterSpeciesById(context.project, speciesId), 4, undefined);
      expect(enemy.stats.maxHp).toBe(formula.maxHp);
      expect(enemy.stats.attack).toBe(formula.attack);
    }, 60_000);

    it("does not lift a species boss to the actor-party threat floor", () => {
      const context = { project: monsterProject() };
      const speciesId = context.project.database.monsterSpecies![0]!.id;
      const result = runTool(context, "upsert_enemy", { role: "boss", enemy: { id: "enemy_gym_boss", name: "관장 몬스터", monsterResourceId: "generated-enemy-slime-01", speciesId, level: 12 } });
      expect(result.ok, result.summary).toBe(true);
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_gym_boss")!;
      expect(enemy.stats).toEqual(monsterBattleStatsForSpecies(monsterSpeciesById(context.project, speciesId), 12, undefined));
      expect(result.summary).not.toContain("보스 위협 하한");
    }, 60_000);

    it("leaves non-monster games alone", () => {
      const context = { project: createBlankProject() };
      const result = runTool(context, "upsert_enemy", { enemy: { id: "enemy_y", name: "Y", monsterResourceId: "generated-enemy-slime-01", stats: { maxHp: 30, attack: 12 } } });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.enemies.find((entry) => entry.id === "enemy_y")!.stats.maxHp).toBe(30);
    }, 60_000);

    it("fills an empty species enemy with the moves learned by that level", () => {
      const context = { project: monsterProject() };
      const speciesId = "species_leafling";
      const species = monsterSpeciesById(context.project, speciesId)!;
      const result = runTool(context, "upsert_enemy", {
        enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-leafling-01", speciesId, level: 4 },
      });
      expect(result.ok, result.summary).toBe(true);
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
      const learned = monsterSkillIdsAtLevel(species, 4);
      expect(learned.length).toBeGreaterThan(1);
      expect(enemy.skillIds).toEqual(learned);
      expect(enemy.actions.map((action) => action.skillId)).toEqual(learned);
      expect(monsterSkillIdsAtLevel(species, 1)).not.toEqual(learned);

      const again = runTool(context, "upsert_enemy", { enemy: { id: "enemy_wild_x", level: 4 } });
      expect(again.ok, again.summary).toBe(true);
      expect(context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!.skillIds).toEqual(learned);
    }, 60_000);

    it("keeps an authored damaging moveset instead of appending the learnset", () => {
      const context = { project: monsterProject() };
      const result = runTool(context, "upsert_enemy", {
        enemy: {
          id: "enemy_custom",
          name: "맞춤",
          monsterResourceId: "generated-enemy-leafling-01",
          speciesId: "species_leafling",
          level: 4,
          actions: [{ skillId: "skill_fire", priority: 5, condition: { kind: "always" } }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_custom")!;
      expect(enemy.skillIds).toEqual(["skill_fire"]);
    }, 60_000);

    it("battle battlers and the no-damage check use the learnset when the saved actions are still empty", () => {
      const context = { project: monsterProject() };
      const species = monsterSpeciesById(context.project, "species_leafling")!;
      runTool(context, "upsert_enemy", {
        enemy: { id: "enemy_wild_x", name: "야생 X", monsterResourceId: "generated-enemy-leafling-01", speciesId: species.id, level: 4 },
      });
      runTool(context, "upsert_troop", { troop: { id: "troop_wild_x", name: "야생", enemyIds: ["enemy_wild_x"] } });
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_wild_x")!;
      enemy.actions = [];
      enemy.skillIds = [];
      const troop = context.project.database.troops.find((entry) => entry.id === "troop_wild_x")!;
      expect(enemyBattlers(context.project, troop)[0]?.skillIds).toEqual(monsterSkillIdsAtLevel(species, 4));

      const map = context.project.maps[context.project.startMapId]!;
      map.events.push({
        id: "ev_test_battle",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "battleProcessing", troopId: "troop_wild_x" }],
      } as GameEvent);
      expect(checkProgression(context.project).some((finding) => finding.code === "enemy-no-damage" && finding.message.includes("enemy_wild_x"))).toBe(false);

      enemy.speciesId = undefined;
      expect(checkProgression(context.project).some((finding) => finding.code === "enemy-no-damage" && finding.message.includes("enemy_wild_x"))).toBe(true);
    }, 60_000);
  });
});
