import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { runSceneTest, isSceneTestInput, sceneTestInputProblem } from "@/testing/sceneTestRunner";
import { deserialize, serialize } from "@/project/io";
import type { Project, EventPage, Trigger, GameEvent } from "@/project/types";
import type { BattleEventPageRecord } from "@/project/types/database";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { runTool } from "@/editor/tools";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { findChasePath, nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import { addFollowerToSession, followerPositions, recordFollowerPlayerStep } from "@/project/followers";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { createHorrorPhase5Fixture, PHASE5_CHASER_ID, PHASE5_MAP_ID, PHASE5_SAFE_CHASER_ID } from "./fixtures/horrorPhase5Fixture";
import { isolateTimers } from "./mergedTeardown";

// Step 2 회귀 스펙(2026-08-20): 트룹 배틀 이벤트 조건 평가에 selfSwitch/battleResult 컨텍스트 주입.
// - battleProcessing 스텝이 소유 이벤트(ownerEventId)를 실어 나르고, 배틀 이벤트의
//   setSelfSwitch 가 그 이벤트의 셀프 스위치를 스냅샷에 기록 → 전투 종료 시 세션 write-back
//   → 맵 이벤트 페이지 전환(RM2K3 "보스 격파 후 페이지 교체" 시나리오).
// - battleResult 조건은 세션 SSOT(직전 전투 결과) 스냅샷으로 실제 평가된다.
// - 소유 이벤트가 없는 전투(랜덤 인카운터/필드 스폰)는 종전 false 취급 + 추적 로그.
describe("battleEventsSelfSwitch", () => {
  isolateTimers();
  function battleProject(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function setTroopPages(project: Project, pages: BattleEventPageRecord[]): void {
    const troop = project.database.troops.find((record) => record.id === "troop_slime");
    if (!troop) throw new Error("missing troop_slime");
    troop.battleEventPages = pages;
  }
  // 기본 조화(gauge) 흐름에서 배틀 이벤트를 한 번 이상 굴리는 최소 시퀀스
  // (battleEventsExhaustive.test.ts 하네스와 동일 관례).
  function driveOneAction(runtime: ReturnType<typeof createBattleRuntime>): void {
    runtime.tick(1_000);
    runtime.performActorCommand({ kind: "defend" });
  }
  describe("battle event selfSwitch / battleResult context injection (Step 2)", () => {
    it("배틀 이벤트가 켠 셀프 스위치가 전투 종료 후 세션에 반영되고 맵 이벤트 페이지가 전환된다", () => {
      const project = battleProject();
      project.switches.push({ id: "sw_page2", name: "격파 후 페이지" });
      // 빠른 승리를 위해 슬라임을 약화(전투 결정론: rng 는 세션 경로 그대로).
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
      if (!slime) throw new Error("missing enemy_slime");
      slime.stats = { ...slime.stats, maxHp: 20, attack: 1 };
      setTroopPages(project, [
        {
          id: "page_self",
          name: "격파 표식",
          conditions: [],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSelfSwitch", key: "A", value: true }],
        },
      ]);
      const event = project.maps["map_battle"]?.events.find((entry) => entry.id === "battle-start");
      if (!event) throw new Error("missing battle-start event");
      const pageBase = {
        graphic: {},
        trigger: { kind: "action" as const },
        priority: "same" as const,
        movement: { type: "fixed" as const, speed: 3, frequency: 3 },
      };
      event.pages = [
        {
          ...pageBase,
          id: "p1",
          name: "전투",
          conditions: [],
          commands: [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: true }],
        },
        {
          ...pageBase,
          id: "p2",
          name: "격파 후",
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          commands: [{ kind: "setSwitch", switchId: "sw_page2", value: true }],
        },
      ];

      const result = runSceneTest(project, {
        mapId: "map_battle",
        start: { x: 0, y: 0 },
        steps: [
          { kind: "face", dir: "right" },
          // 1회차 조사: p1 전투 → 배틀 이벤트가 셀프 스위치 A 를 켬 → 승리 후 세션 write-back.
          { kind: "interact" },
          // 2회차 조사: 페이지가 p2 로 전환되어 sw_page2 를 켠다.
          { kind: "interact" },
          { kind: "expect", switchOn: "sw_page2" },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.log.some((line) => line.includes("battle troop_slime: victory"))).toBe(true);
      expect(result.session.selfSwitches?.["battle-start"]?.A).toBe(true);
    });

    it("setSelfSwitch 는 ownerEventId 소유 이벤트의 셀프 스위치를 스냅샷에 기록한다", () => {
      const project = battleProject();
      setTroopPages(project, [
        {
          id: "page_write",
          name: "셀프 기록",
          conditions: [],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSelfSwitch", key: "B", value: true }],
        },
      ]);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        ownerEventId: "ev-owner",
        sessionState: { switches: {}, variables: {}, inventory: {} },
      });
      driveOneAction(runtime);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.selfSwitches?.["ev-owner"]?.B).toBe(true);
      expect(snapshot.eventLogs.some((log) => log.kind === "message" && log.detail === "selfSwitch B=true")).toBe(true);
    });

    it("selfSwitch 조건은 ownerEventId 가 있으면 세션 셀프 스위치 스냅샷으로 실제 평가된다", () => {
      const project = battleProject();
      project.switches.push({ id: "sw_on_seen", name: "on" }, { id: "sw_off_seen", name: "off" });
      setTroopPages(project, [
        {
          id: "page_self_on",
          name: "A=ON 페이지",
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSwitch", switchId: "sw_on_seen", value: true }],
        },
        {
          id: "page_self_off",
          name: "A=OFF 페이지",
          conditions: [{ kind: "selfSwitch", key: "A", value: false }],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSwitch", switchId: "sw_off_seen", value: true }],
        },
      ]);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        ownerEventId: "ev-owner",
        sessionState: {
          switches: {},
          variables: {},
          inventory: {},
          selfSwitches: { "ev-owner": { A: true } },
        },
      });
      driveOneAction(runtime);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.switches.sw_on_seen).toBe(true);
      expect(snapshot.eventState.switches.sw_off_seen).toBeUndefined();
    });

    it("ownerEventId 없는 전투에서는 selfSwitch 조건이 종전대로 false(OFF) 취급되고 추적 로그가 남는다", () => {
      const project = battleProject();
      project.switches.push({ id: "sw_on_seen", name: "on" }, { id: "sw_off_seen", name: "off" });
      setTroopPages(project, [
        {
          id: "page_self_on",
          name: "A=ON 페이지",
          conditions: [{ kind: "selfSwitch", key: "A", value: true }],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSwitch", switchId: "sw_on_seen", value: true }],
        },
        {
          id: "page_self_off",
          name: "A=OFF 페이지",
          conditions: [{ kind: "selfSwitch", key: "A", value: false }],
          span: "battle",
          runOnce: true,
          commands: [{ kind: "setSwitch", switchId: "sw_off_seen", value: true }],
        },
      ]);
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        // ownerEventId 없음(랜덤 인카운터/필드 스폰 경로) — 세션에 값이 있어도 평가되지 않는다.
        sessionState: {
          switches: {},
          variables: {},
          inventory: {},
          selfSwitches: { "ev-owner": { A: true } },
        },
      });
      driveOneAction(runtime);
      const snapshot = runtime.snapshot();
      expect(snapshot.eventState.switches.sw_on_seen).toBeUndefined();
      expect(snapshot.eventState.switches.sw_off_seen).toBe(true);
      expect(
        snapshot.eventLogs.some(
          (log) => log.kind === "unsupported" && log.detail?.includes("selfSwitch condition without owner event")
        )
      ).toBe(true);
    });

    it("battleResult 조건은 직전 전투 결과 스냅샷(세션 SSOT)으로 분기한다", () => {
      const runFor = (battleResult: "victory" | "defeat" | "escape" | undefined) => {
        const project = battleProject();
        project.switches.push({ id: "sw_after_victory", name: "승리 후" }, { id: "sw_after_escape", name: "도주 후" });
        setTroopPages(project, [
          {
            id: "page_after_victory",
            name: "직전 승리",
            conditions: [{ kind: "battleResult", result: "victory" }],
            span: "battle",
            runOnce: true,
            commands: [{ kind: "setSwitch", switchId: "sw_after_victory", value: true }],
          },
          {
            id: "page_after_escape",
            name: "직전 도주",
            conditions: [{ kind: "battleResult", result: "escape" }],
            span: "battle",
            runOnce: true,
            commands: [{ kind: "setSwitch", switchId: "sw_after_escape", value: true }],
          },
        ]);
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          sessionState: { switches: {}, variables: {}, inventory: {}, battleResult },
        });
        driveOneAction(runtime);
        return runtime.snapshot().eventState.switches;
      };

      expect(runFor("victory")).toMatchObject({ sw_after_victory: true });
      expect(runFor("victory").sw_after_escape).toBeUndefined();
      expect(runFor("escape")).toMatchObject({ sw_after_escape: true });
      expect(runFor("escape").sw_after_victory).toBeUndefined();
      // 직전 전투 결과가 없으면(첫 전투) 두 분기 모두 발화하지 않는다.
      const fresh = runFor(undefined);
      expect(fresh.sw_after_victory).toBeUndefined();
      expect(fresh.sw_after_escape).toBeUndefined();
    });
  });
});

describe("epilogueEndingLoop", () => {
  isolateTimers();
  // 추리 도그푸딩 gen: 진엔딩 에필로그 끝에 {kind:"ending", endingId:"ending_true"} 가 있어 에필로그가
  // 검은 화면에서 끝없이 반복됐다(엔딩 화면에 영영 닿지 못함).
  const EPILOGUE = [
    { kind: "say", speaker: "모로 박사", text: "……내가 무슨 짓을." },
    { kind: "ending", endingId: "ending_true" },
  ];
  function withEnding(project: Project): void {
    project.maps[project.startMapId].events.push({
      id: "ev_end", name: "끝", x: 11, y: 8, trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p", conditions: [], trigger: { kind: "action" }, priority: "same", graphic: {}, commands: [{ kind: "triggerEnding", endingId: "ending_true" }] }],
    } as never);
  }
  describe("엔딩 에필로그 안의 ending beat", () => {
    it("define_ending 은 ending beat 를 빼고 경고한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "define_ending", { id: "ending_true", name: "진실", conditions: [], epilogue: EPILOGUE });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.endings?.find((e) => e.id === "ending_true")?.epilogue?.map((beat) => (beat as { kind: string }).kind)).toEqual(["say"]);
      expect(JSON.stringify(result)).toContain("무한 반복");
    });

    it("옛 저장본의 ending beat 가 있어도 런타임은 에필로그를 한 번만 돌고 엔딩에 닿는다", () => {
      const project = createBlankProject();
      project.endings = [{ id: "ending_true", name: "진실", conditions: [], priority: 0, epilogue: EPILOGUE }];
      withEnding(project);
      const steps = [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_end" }, ...Array.from({ length: 6 }, () => ({ kind: "wait", ticks: 200 })), { kind: "expect", endingReached: "ending_true" }];
      const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 10, y: 8 }, steps } as never);
      expect(result.ok, `${result.failureReason} ${result.log.slice(-8).join(" | ")}`).toBe(true);
      const spoken = result.log.filter((line) => line.includes("내가 무슨 짓을")).length;
      expect(spoken).toBeLessThanOrEqual(1);
    });
  });
});

describe("followerChaseRuntime", () => {
  isolateTimers();
  describe("chase pathfinding", () => {
    it("A*는 벽 사이 경로를 우회해 플레이어 쪽 경로를 찾는다", () => {
      // TILE.* 는 합본 마을 번호 — 2026-10-07 정리 뒤 기본이 beodeul_city 라 시작 맵을 합본 마을에 둔다.
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(TILE.GRASS);
      for (const y of [1, 2, 3]) map.lowerTiles[y * map.width + 3] = TILE.WATER;

      const path = findChasePath(project, map, { x: 1, y: 2 }, { x: 5, y: 2 });

      expect(path.at(-1)).toEqual({ x: 5, y: 2 });
      expect(path.length).toBeGreaterThan(4);
      expect(path.some((point) => point.x === 3 && point.y >= 1 && point.y <= 3)).toBe(false);
    });

    it("시야 밖에서는 대기하고 giveUpRange 밖에서는 추격을 해제한다", () => {
      // TILE.* 는 합본 마을 번호 — 2026-10-07 정리 뒤 기본이 beodeul_city 라 시작 맵을 합본 마을에 둔다.
      const project = startOnRetiredCombinedTown(createBlankProject());
      const map = project.maps[project.startMapId];
      map.lowerTiles.fill(TILE.GRASS);
      const mover: ChaseRuntimeState = { timer: 999, moveIntervalMs: 0 };

      expect(nextChaseDecision({
        project,
        map,
        from: { x: 1, y: 1 },
        player: { x: 8, y: 1 },
        deltaMs: 16,
        mover,
        sightRange: 3,
        giveUpRange: 10,
        pathfind: true,
      })).toEqual({ kind: "wait" });
      expect(mover.chaseActive).not.toBe(true);

      const seen = nextChaseDecision({
        project,
        map,
        from: { x: 1, y: 1 },
        player: { x: 3, y: 1 },
        deltaMs: 16,
        mover,
        sightRange: 3,
        giveUpRange: 10,
        pathfind: true,
      });
      expect(seen.kind).toBe("move");
      expect(mover.chaseActive).toBe(true);

      const gaveUp = nextChaseDecision({
        project,
        map,
        from: { x: 1, y: 1 },
        player: { x: 20, y: 1 },
        deltaMs: 16,
        mover,
        sightRange: 3,
        giveUpRange: 4,
        pathfind: true,
      });
      expect(gaveUp).toEqual({ kind: "wait" });
      expect(mover.chaseActive).toBe(false);
    });
  });
  describe("followers", () => {
    it("플레이어 이동 궤적을 순서대로 승계한다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      addFollowerToSession(project, session, {
        graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 },
        name: "메리",
      });

      recordFollowerPlayerStep(session, { x: 2, y: 2, direction: "right" });
      recordFollowerPlayerStep(session, { x: 3, y: 2, direction: "right" });

      expect(followerPositions(session).map((entry) => ({ name: entry.follower.name, x: entry.x, y: entry.y }))).toEqual([
        { name: "가리", x: 3, y: 2 },
        { name: "메리", x: 2, y: 2 },
      ]);
    });

    it("followers와 trail은 세이브/로드 왕복으로 보존된다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      addFollowerToSession(project, session, { actorId: "actor_hero", name: "가리" });
      recordFollowerPlayerStep(session, { x: 2, y: 2, direction: "down" });

      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));

      expect(restored.followers).toEqual(session.followers);
      expect(restored.followerTrail).toEqual(session.followerTrail);
    });
  });
  describe("run_scene_test Phase 5 integration", () => {
    it("추격자가 장애물을 우회해 플레이어와의 거리를 줄인다", () => {
      const project = createHorrorPhase5Fixture();

      const result = runSceneTest(project, {
        mapId: PHASE5_MAP_ID,
        start: { x: 1, y: 4 },
        steps: [
          { kind: "wait", ticks: 40 },
          { kind: "expect", eventDistanceToPlayerLessThan: { eventId: PHASE5_CHASER_ID, distance: 8 } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
    });

    it("플레이어가 safeZone 안에 있으면 추격자 접촉으로 죽지 않는다", () => {
      const project = createHorrorPhase5Fixture();

      const result = runSceneTest(project, {
        mapId: PHASE5_MAP_ID,
        start: { x: 2, y: 1 },
        steps: [
          { kind: "wait", ticks: 80 },
          { kind: "expect", gameOver: false, eventAt: { eventId: PHASE5_SAFE_CHASER_ID, x: 5, y: 1 } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
    });

    it("접촉 killPlayer 후 체크포인트 리트라이로 시작 위치를 복원한다", () => {
      const project = createHorrorPhase5Fixture();

      const result = runSceneTest(project, {
        mapId: PHASE5_MAP_ID,
        start: { x: 8, y: 4 },
        steps: [
          { kind: "wait", ticks: 20 },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          { kind: "expect", gameOver: false, playerAt: { x: 8, y: 4, mapId: PHASE5_MAP_ID } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
    });

    it("addFollower 후 이동하면 followerAt 기대값을 만족한다", () => {
      const project = createHorrorPhase5Fixture();

      const result = runSceneTest(project, {
        mapId: PHASE5_MAP_ID,
        start: { x: 1, y: 4 },
        steps: [
          { kind: "move", dir: "up" },
          { kind: "interact" },
          { kind: "expect", followerCount: 1 },
          { kind: "move", dir: "down" },
          { kind: "expect", followerAt: { name: "가리", x: 1, y: 3 } },
        ],
      });

      expect(result.ok, result.failureReason).toBe(true);
      expect(result.finalState.followerCount).toBe(1);
    });
  });
  describe("make_chase_scene tool", () => {
    it("추격자 이벤트, 안전지대, 진입 체크포인트를 생성한다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const ctx = { project };

      const result = runTool(
        ctx,
        "make_chase_scene",
        {
          mapId,
          chaser: { at: { x: 4, y: 4 }, graphic: { textureKey: "tex_easyrpg_charset_monster1" }, speed: 6, sightRange: 7 },
          killOnTouch: true,
          safeZone: { x: 1, y: 1, w: 2, h: 2 },
          activateSwitch: "sw_chase_on",
          checkpointOnEntry: true,
        }
      );

      expect(result.ok, result.summary).toBe(true);
      const changed = ctx.project;
      const map = changed.maps[mapId];
      expect(map.safeZones).toContainEqual({ x: 1, y: 1, w: 2, h: 2 });
      expect(map.events.some((event) => event.id === `${map.id}_checkpoint_auto`)).toBe(true);
      const chaser = map.events.find((event) => event.pages?.some((page) => page.movement.type === "chase"));
      expect(chaser?.pages?.[0]?.movement).toMatchObject({ type: "chase", speed: 6, sightRange: 7, pathfind: true });
      expect(chaser?.pages?.[0]?.commands).toContainEqual({ kind: "killPlayer", message: "붙잡혔다." });
    });

    // 2026-10-05 스트레스 g-ashen-chase: 포기 스위치=깨우는 스위치라 추격자가 주인공을 보자마자 자기 페이지를 껐다.
    it("pursuit.lostSwitchId 가 activateSwitch 와 같으면 거부한다", () => {
      const project = createBlankProject();
      const ctx = { project };
      const result = runTool(ctx, "make_chase_scene", {
        mapId: project.startMapId,
        chaser: { at: { x: 4, y: 4 }, graphic: { textureKey: "tex_easyrpg_charset_monster1" } },
        killOnTouch: true,
        activateSwitch: "switch_chase",
        pursuit: { scope: "connected", doorDelayMs: 1000, searchMs: 3000, onLost: "wait", lostSwitchId: "switch_chase" },
      });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("lostSwitchId");
    });

    it("은신처 칸을 진짜 은신 이벤트로 만들고, 느린 추격자와 추적 정책을 알린다", () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const ctx = { project };
      const seeded = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_wardrobe", x: 2, y: 2, trigger: { kind: "action" },
          pages: [{ conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, commands: [{ kind: "text", body: "낡은 옷장" }] }] },
      });
      expect(seeded.ok, seeded.summary).toBe(true);
      const result = runTool(ctx, "make_chase_scene", {
        mapId,
        chaser: { at: { x: 6, y: 6 }, graphic: { query: "monster" }, speed: 1 },
        pursuit: { scope: "map", doorDelayMs: 1000, searchMs: 4000, onLost: "return", tracking: "persistent" },
        killOnTouch: true,
        hidingSpots: [{ x: 2, y: 2 }, { x: 8, y: 3 }],
      });
      expect(result.ok, result.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      const hidingIds = (result.data as { hidingEventIds: string[] }).hidingEventIds;
      expect(hidingIds).toHaveLength(2);
      expect(hidingIds[0]).toBe("ev_wardrobe");
      for (const id of hidingIds) {
        const page = map.events.find((event) => event.id === id)?.pages?.[0];
        expect(page?.interaction).toEqual({ kind: "hiding" });
        expect(page?.trigger.kind).toBe("action");
      }
      const chaser = map.events.find((event) => event.pages?.some((page) => page.movement.type === "chase"));
      expect(chaser?.pages?.[0]?.movement).toMatchObject({ speed: 1, frequency: 8, pursuit: { tracking: "persistent" } });
      // 추격 한 칸은 쉬지 않고 이어 걷는 박자다(4127a63455) — speed 3 ≈182ms 는 이제 느린 추격자가 아니고, 경고는 주인공 걷기의 절반 미만(speed 1 ≈327ms)부터다.
      expect((result.diff?.warnings ?? []).join(" ")).toMatch(/주인공 걷기\(160ms\/칸\)의 \d+%/);
    });
  });
  describe("make_chase_scene 은신처 맵", () => {
    it("다른 방의 옷장을 mapId 로 은신처로 만들고, 맨바닥 은신처는 경고한다", () => {
      const project = createBlankProject();
      const ctx = { project };
      const hall = project.startMapId;
      const room = runTool(ctx, "create_map", { name: "침실", width: 12, height: 10 });
      expect(room.ok, room.summary).toBe(true);
      const roomId = (room.data as { mapId: string }).mapId;
      const closet = runTool(ctx, "upsert_event", { mapId: roomId, event: { id: "ev_closet", x: 3, y: 3, trigger: { kind: "action" },
        pages: [{ conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, commands: [] }] } });
      expect(closet.ok, closet.summary).toBe(true);
      const result = runTool(ctx, "make_chase_scene", {
        mapId: hall, chaser: { at: { x: 6, y: 6 }, graphic: { query: "monster" } }, killOnTouch: true,
        hidingSpots: [{ x: 3, y: 3, mapId: roomId }, { x: 2, y: 2 }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[roomId]!.events.find((event) => event.id === "ev_closet")?.pages?.[0]?.interaction).toEqual({ kind: "hiding" });
      expect((result.diff?.warnings ?? []).join(" ")).toContain("맨바닥의 보이지 않는 은신처");
    });
  });
});

// set_life_flower — 이브식 「꽃잎 = 체력」 한 벌이 실제 런타임에서 줄고·회복되고·0장에 게임 오버가 나는지.
// 2026-09-24 갤러리 호러 도그푸딩: 함정마다 `setVariable -= 1` 만 흩뿌려져 시작값 0·게임 오버 없음·꽃잎 HUD 없음.
describe("lifeFlowerTool", () => {
  isolateTimers();
  function setup(extra: Record<string, unknown> = {}): { project: Project } {
    const ctx: { project: Project } = { project: createBlankProject() };
    const life = runTool(ctx, "set_life_flower", { name: "푸른 수국", max: 3, ...extra });
    expect(life.ok, `${life.summary} ${JSON.stringify(life.issues)}`).toBe(true);
    const mapId = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    for (const [id, dx, commonEventId] of [["ev_hand", 1, "ce_life_damage"], ["ev_vase", -1, "ce_life_restore"]] as const) {
      const placed = runTool(ctx, "upsert_event", { mapId, event: {
        id, x: x + dx, y,
        pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "callCommonEvent", commonEventId }] }],
      } });
      expect(placed.ok, placed.summary).toBe(true);
    }
    return ctx;
  }
  describe("set_life_flower", () => {
    it("starts full, shows petals instead of the default HUD, loses and restores petals, and ends at zero", () => {
      const ctx = setup();
      // 조수 경로의 적용 검증은 직렬화 왕복이다 — 여기서 거부되면 도구 변경 전체가 되돌려진다.
      const project = deserialize(serialize(ctx.project));
      expect(project.session.variables.var_life_petals).toBe(3);
      const hud = project.system.fieldHud!;
      expect(hud.theme).toBe("horror");
      expect(hud.widgets?.[0]).toMatchObject({ source: "variable", variableId: "var_life_petals", shape: "petals", max: 3 });
      expect(hud.widgets?.some(widget => widget.source === "hp")).toBe(false);

      const mapId = project.startMapId;
      const start = project.startPos;
      const hand = project.maps[mapId]!.events.find(event => event.id === "ev_hand")!;
      const vase = project.maps[mapId]!.events.find(event => event.id === "ev_vase")!;
      const hit = [{ kind: "face", dir: hand.x > start.x ? "right" : "left" }, { kind: "interact", eventId: "ev_hand" }] as const;
      const heal = [{ kind: "face", dir: vase.x > start.x ? "right" : "left" }, { kind: "interact", eventId: "ev_vase" }] as const;
      const result = runSceneTest(project, { mapId, start, steps: [
        ...hit, ...hit, { kind: "expect", variableEquals: { variableId: "var_life_petals", value: 1 }, gameOver: false },
        ...heal, { kind: "expect", variableEquals: { variableId: "var_life_petals", value: 3 } },
        ...hit, ...hit, ...hit, { kind: "expect", gameOver: true },
      ] });
      expect(result.ok, `${result.failureReason} ${JSON.stringify(result.finalState.variables)}`).toBe(true);
    });

    it("runs the named bad ending at zero when defeatEndingId is given", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const ending = runTool(ctx, "define_ending", { id: "ending_trapped", name: "그림 속에 남다", conditions: [] });
      expect(ending.ok, ending.summary).toBe(true);
      const life = runTool(ctx, "set_life_flower", { max: 1, defeatEndingId: "ending_trapped" });
      expect(life.ok, life.summary).toBe(true);
      const damage = ctx.project.commonEvents.find(event => event.id === "ce_life_damage")!;
      expect(JSON.stringify(damage.commands)).toContain("\"endingId\":\"ending_trapped\"");
    });

    it("rejects an unknown defeat ending instead of wiring a dead reference", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const life = runTool(ctx, "set_life_flower", { defeatEndingId: "ending_missing" });
      expect(life.ok).toBe(false);
      expect(life.summary).toContain("ending_missing");
    });
  });

  describe("qa gameCheck gallery life rules", () => {
    const brief = "꽃잎 5장이 체력이다. 0장이면 게임오버.";
    it("flags scattered petal decrements with no start value, defeat, restore or HUD", async () => {
      const { checkGallery } = await import("@/qa/gameCheck/gallery");
      const ctx: { project: Project } = { project: createBlankProject() };
      const { x, y } = ctx.project.startPos;
      runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_trap", x: x + 1, y, pages: [{ trigger: { kind: "playerTouch" }, conditions: [], commands: [{ kind: "setVariable", variableId: "v_petals", op: "-=", value: 1 }] }] } });
      const codes = checkGallery(ctx.project, brief).map(finding => finding.code).sort();
      expect(codes).toEqual(["gallery-life-no-defeat", "gallery-life-no-restore", "gallery-life-not-shown", "gallery-life-starts-empty"]);
    });
    it("accepts the set_life_flower wiring", async () => {
      const { checkGallery } = await import("@/qa/gameCheck/gallery");
      expect(checkGallery(setup().project, brief)).toEqual([]);
    });
  });
});

// "이벤트에서 접촉"(eventTouch) 은 RM2K3 계약대로 양방향 충돌에서 발동해야 한다.
// 이벤트가 플레이어에게 걸어오는 쪽만 발동하면, 이동 유형이 정지인 이벤트는 무버가
// 없어서 영원히 발동하지 않는다 — 저작은 되지만 절대 실행되지 않는 트리거가 된다.
describe("runtimeEventTouchPlayerCollision", () => {
  isolateTimers();
  const SWITCH_ID = "sw_touched";
  function projectWithTouchEvent(options: {
    readonly trigger: Trigger;
    readonly priority: EventPage["priority"];
    readonly overlapForbidden: boolean;
  }): Project {
    const project = createBlankProject();
    project.switches = [...project.switches, { id: SWITCH_ID, name: "접촉됨" }];
    const map = project.maps[project.startMapId]!;
    map.events = [
      {
        id: "ev_touch",
        x: 3,
        y: 2,
        trigger: options.trigger,
        commands: [],
        pages: [
          {
            id: "p1",
            name: "접촉",
            conditions: [],
            graphic: {},
            trigger: options.trigger,
            priority: options.priority,
            overlapForbidden: options.overlapForbidden,
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [{ kind: "setSwitch", switchId: SWITCH_ID, value: true }],
          },
        ],
      },
    ];
    return project;
  }
  function walkRight(project: Project) {
    return runSceneTest(project, {
      mapId: project.startMapId,
      start: { x: 2, y: 2 },
      steps: [{ kind: "move", dir: "right" }, { kind: "expect", switchOn: SWITCH_ID }],
    });
  }
  describe("eventTouch: 플레이어가 부딪히는 방향", () => {
    it("막는 eventTouch 이벤트에 걸어들어가면 발동한다", () => {
      const result = walkRight(projectWithTouchEvent({
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
      }));
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("통행 가능한 eventTouch 이벤트 칸을 밟으면 발동한다", () => {
      const result = walkRight(projectWithTouchEvent({
        trigger: { kind: "eventTouch" },
        priority: "below",
        overlapForbidden: false,
      }));
      expect(result.failureReason).toBeUndefined();
      expect(result.ok).toBe(true);
    });

    it("조사 트리거는 걸어들어가도 발동하지 않는다", () => {
      const result = walkRight(projectWithTouchEvent({
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
      }));
      expect(result.ok).toBe(false);
    });
  });
});

// 헤드리스 러너(run_scene_test·qa-game 자동 플레이)도 실제 플레이처럼 파티 몬스터로 싸운다.
// 2026-09-24 몬스터 수집 도그푸딩: 러너가 Lv1 영웅으로 싸워 야생에 져 거짓 게임 오버를 냈고,
// 실제 플레이는 스타터 없이 도로에 나가면 매 조우마다 「파티에 몬스터가 없습니다」 오류 창이 떴다.
describe("sceneRunnerMonsterParty", () => {
  isolateTimers();
  function monsterProject(commands: GameEvent["pages"][number]["commands"]): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.system.monsterBattleParty = true;
    project.system.battleParty = "monsters";
    const map = project.maps[project.startMapId]!;
    map.events.push({
      id: "ev_prof", name: "박사", x: project.startPos.x + 1, y: project.startPos.y,
      trigger: { kind: "action" }, commands: [],
      pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, graphic: { kind: "none" }, priority: "same", commands }],
    } as unknown as GameEvent);
    return project;
  }
  describe("scene runner monster party battles", () => {
    it("fights with the party monster, not the Lv1 hero", () => {
      const project = monsterProject([
        { kind: "giveMonster", speciesId: "species_leafling", level: 30 },
        { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true },
      ] as never);
      const result = runSceneTest(project, {
        mapId: project.startMapId, start: project.startPos,
        steps: [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_prof" }, { kind: "wait", ticks: 30 }],
      });
      expect(result.ok, result.failureReason).toBe(true);
      expect(result.log.some((line) => line.startsWith("battle troop_slime"))).toBe(true);
      const session = (result as unknown as { session: { monsterParty: string[]; monsterInstances: Record<string, { currentHp?: number }> } }).session;
      const monster = session.monsterInstances[session.monsterParty[0]!]!;
      // 싸운 것은 파티 몬스터다 — 전투 피해가 인스턴스 HP 에 되돌려 쓰인다(Lv30 리프링 최대 HP 62).
      expect(monster.currentHp).toBeLessThan(62);
    });

    it("does not roll wild encounters before the player has a partner", () => {
      const project = monsterProject([]);
      const map = project.maps[project.startMapId]!;
      map.encounterRate = 1000;
      map.encounterTable = [{ troopId: "troop_slime", weight: 1 }];
      const result = runSceneTest(project, {
        mapId: project.startMapId, start: project.startPos,
        steps: [{ kind: "move", dir: "down" }, { kind: "move", dir: "up" }, { kind: "move", dir: "down" }],
      });
      expect(result.log.some((line) => line.startsWith("random encounter"))).toBe(false);
      expect(result.finalState.gameOver).toBe(false);
    });
  });
  describe("scene runner gen1 battles", () => {
    it("uses the monster's damaging skill when gen1 refuses the plain attack", () => {
      const project = monsterProject([
        { kind: "giveMonster", speciesId: "species_leafling", level: 30 },
        { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true },
      ] as never);
      project.system.battleModel = "gen1";
      // 약한 슬라임 — 몬스터가 한 수라도 두면 이긴다. 공격만 고집하면(gen1 이 거부) 한 대도 못 친다.
      for (const enemy of project.database.enemies) if (enemy.id === "enemy_slime") (enemy as unknown as { stats: { maxHp: number } }).stats.maxHp = 5;
      const result = runSceneTest(project, {
        mapId: project.startMapId, start: project.startPos,
        steps: [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_prof" }, { kind: "wait", ticks: 30 }],
      });
      expect(result.ok, result.failureReason).toBe(true);
      expect(result.log, JSON.stringify(result.log)).toContain("battle troop_slime: victory");
    });
  });
});

describe("sceneTestInputProblem", () => {
  isolateTimers();
  // run_scene_test 입력 거부 문구가 「어느 스텝·어느 필드·무엇이 허용되는지」 를 짚어야 모델이 한 번에 고친다.
  // 실측(run5.log)은 같은 뭉뚱그린 문구로 4번 연속 거부됐다. 도구 인자 원문은 로그에 없어서
  // 아래 잘못된 모양들은 모델이 흔히 틀리는 형태를 **가정**한 것이다.
  function input(steps: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { mapId: "map_start", start: { x: 1, y: 1 }, steps, ...extra };
  }
  const CASES: readonly { readonly name: string; readonly value: unknown; readonly says: readonly (string | RegExp)[] }[] = [
    { name: "좌표를 문자열로", value: input([{ kind: "move", to: { x: "3", y: 4 } }]),
      says: ["steps[0] (move)", "to.x", "0 이상의 정수", "\"3\""] },
    { name: "move 에 dir 와 to 를 같이", value: input([{ kind: "wait", ticks: 10 }, { kind: "move", dir: "up", to: { x: 3, y: 4 } }]),
      says: ["steps[1] (move)", "dir", "to", "하나만"] },
    { name: "move 에 dir·to 둘 다 없음", value: input([{ kind: "move" }]),
      says: ["steps[0] (move)", "dir", "to"] },
    { name: "없는 kind", value: input([{ kind: "talk", eventId: "npc" }]),
      says: ["steps[0]", "'talk'", "interact", "choose", "present"] },
    { name: "kind 누락", value: input([{ eventId: "npc" }]),
      says: ["steps[0]", "kind"] },
    { name: "expect 에 value 필드", value: input([{ kind: "expect", endingReached: "ending_a", value: true }]),
      says: ["steps[0] (expect)", "unexpected field(s): value", "endingReached"] },
    { name: "expect 에 검사가 없음", value: input([{ kind: "expect" }]),
      says: ["steps[0] (expect)", "playerAt", "endingReached"] },
    { name: "endingReached 를 불리언으로", value: input([{ kind: "expect", endingReached: true }]),
      says: ["steps[0] (expect)", "endingReached", "엔딩 id"] },
    { name: "set 에 switches 대신 switch", value: input([{ kind: "set", switch: "sw_a" }]),
      says: ["steps[0] (set)", "unexpected field(s): switch", "switches"] },
    { name: "choose index 를 문자열로", value: input([{ kind: "choose", index: "1" }]),
      says: ["steps[0] (choose)", "index", "정수"] },
    { name: "choose 의 index 누락", value: input([{ kind: "choose", option: 1 }]),
      says: ["steps[0] (choose)", "index"] },
    { name: "wait ticks 누락", value: input([{ kind: "wait", ms: 500 }]),
      says: ["steps[0] (wait)", "ticks"] },
    { name: "present 에 item", value: input([{ kind: "present", item: "item_a" }]),
      says: ["steps[0] (present)", "unexpected field(s): item", "itemId"] },
    { name: "시작 좌표 문자열", value: input([], { start: { x: "24", y: 33 } }),
      says: ["start.x", "0 이상의 정수"] },
    { name: "steps 가 배열이 아님", value: input([], { steps: { kind: "wait", ticks: 1 } }),
      says: ["steps", "배열"] },
    { name: "최상위 오타", value: input([], { startPos: { x: 1, y: 1 } }),
      says: ["unexpected field(s): startPos"] },
  ];
  describe("run_scene_test 입력 거부 문구", () => {
    for (const entry of CASES) {
      it(`${entry.name} → 스텝·필드·허용값을 짚는다`, () => {
        expect(isSceneTestInput(entry.value)).toBe(false);
        const problem = sceneTestInputProblem(entry.value);
        expect(problem).not.toBeNull();
        for (const needle of entry.says) {
          if (typeof needle === "string") expect(problem).toContain(needle);
          else expect(problem).toMatch(needle);
        }
      });
    }

    it("도구 거부 요약에 같은 문구가 실린다", () => {
      const project = createBlankProject();
      const result = runTool({ project }, "run_scene_test", input([{ kind: "move", dir: "up", to: { x: 3, y: 4 } }], { mapId: project.startMapId }) as never);
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("steps[0] (move)");
      expect(result.summary).toContain("하나만");
    });

    it("올바른 입력은 문제 없음이고 isSceneTestInput 과 판정이 같다", () => {
      const valid = input([
        { kind: "set", mapId: "map_start", x: 2, y: 3, facing: "up", switches: ["a"], inventory: { item_a: 1 } },
        { kind: "move", dir: "left" }, { kind: "move", to: { x: 1, y: 1 } }, { kind: "walk", to: { x: 2, y: 2 }, adjacent: true },
        { kind: "interact", eventId: "npc" }, { kind: "choose", index: -1 }, { kind: "present", itemId: "item_a" }, { kind: "present" },
        { kind: "wait", ticks: 0 }, { kind: "face", dir: "down" },
        { kind: "expect", endingReached: "ending_a", inventoryCount: { item_a: 1 }, playerAt: { x: 1, y: 1 } },
      ]);
      expect(sceneTestInputProblem(valid)).toBeNull();
      expect(isSceneTestInput(valid)).toBe(true);
    });
  });
  describe("run_scene_test — 한 겹 감싼 expect", () => {
    // 추리 도그푸딩 gen 두 판: 동봉 시나리오를 옮겨 적으며 {kind:"expect", expect:{…}} 로 감싸 한 번씩 헛돌았다.
    it("{kind:'expect', expect:{…}} 를 펼쳐 실행하고 경고한다", async () => {
      const { runTool } = await import("@/editor/tools");
      const { createBlankProject } = await import("@/project/defaults");
      const project = createBlankProject();
      const result = runTool({ project }, "run_scene_test", {
        mapId: project.startMapId, start: project.startPos,
        steps: [{ kind: "wait", ticks: 1 }, { kind: "expect", expect: { playerAt: project.startPos } }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect((result.data as { ok: boolean }).ok).toBe(true);
      expect(JSON.stringify(result.warnings)).toContain("펼쳐");
    });
  });
});

// expect.shopStock 거부 문구가 모양을 말한다 — 「값 형식이 맞지 않습니다」만으론 모델이 추측하며 시험을 거듭 다시 불렀다
// (2026-10-05 스트레스 p-shop).
describe("sceneTestShopStockMessage", () => {
  isolateTimers();
  describe("scene test expect field messages", () => {
    it("shopStock 잘못된 모양이면 기대 모양을 알려 준다", () => {
      const problem = sceneTestInputProblem({ mapId: "m", start: { x: 1, y: 1 }, steps: [{ kind: "expect", shopStock: [{ itemId: "potion", price: 50 }] }] });
      expect(problem).toContain("shopStock");
      expect(problem).toContain("itemIds");
      expect(problem).not.toContain("값 형식이 맞지 않습니다");
    });
  });
});
