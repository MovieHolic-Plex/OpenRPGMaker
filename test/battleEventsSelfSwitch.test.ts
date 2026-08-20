// Step 2 회귀 스펙(2026-08-20): 트룹 배틀 이벤트 조건 평가에 selfSwitch/battleResult 컨텍스트 주입.
// - battleProcessing 스텝이 소유 이벤트(ownerEventId)를 실어 나르고, 배틀 이벤트의
//   setSelfSwitch 가 그 이벤트의 셀프 스위치를 스냅샷에 기록 → 전투 종료 시 세션 write-back
//   → 맵 이벤트 페이지 전환(RM2K3 "보스 격파 후 페이지 교체" 시나리오).
// - battleResult 조건은 세션 SSOT(직전 전투 결과) 스냅샷으로 실제 평가된다.
// - 소유 이벤트가 없는 전투(랜덤 인카운터/필드 스폰)는 종전 false 취급 + 추적 로그.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import type { BattleEventPageRecord } from "@/project/types/database";
import battleFixture from "./fixtures/projects/battle-v3.json";

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
