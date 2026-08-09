import { describe, it, expect } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { evalCondition } from "@/project/session";
import type { Command } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"

function mkSession(): PlaySessionLike {
  return {
    flags: {},
    switches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    actorExperience: {},
    actorLevels: {},
    actorEquipment: {},
    actorVitals: {},
    currentMapId: "m1",
    x: 0,
    y: 0,
    audio: {},
    pictures: {},
  };
}

function drain(commands: Command[], session: PlaySessionLike): void {
  const interp = createInterpreter(commands, session, undefined, { currentEventId: "ev_chest" });
  let r = interp.start();
  let guard = 0;
  while (r.kind !== "done" && guard++ < 1000) {
    if (r.kind === "text" || r.kind === "wait") {
      r = interp.resume(undefined);
    } else {
      break;
    }
  }
}

describe("셀프 스위치", () => {
  it("setSelfSwitch 가 현재 이벤트의 셀프 스위치를 설정한다", () => {
    const session = mkSession();
    drain([{ kind: "setSelfSwitch", key: "A", value: true }], session);

    expect(session.selfSwitches?.ev_chest?.A).toBe(true);
  });

  it("여러 키(A/B)를 독립적으로 설정한다", () => {
    const session = mkSession();
    drain([
      { kind: "setSelfSwitch", key: "A", value: true },
      { kind: "setSelfSwitch", key: "B", value: true },
    ], session);

    expect(session.selfSwitches?.ev_chest?.A).toBe(true);
    expect(session.selfSwitches?.ev_chest?.B).toBe(true);
  });

  it("currentEventId 없으면 셀프 스위치를 설정하지 않는다", () => {
    const session = mkSession();
    const interp = createInterpreter([{ kind: "setSelfSwitch", key: "A", value: true }], session);
    interp.start();

    expect(session.selfSwitches).toBeUndefined();
  });
});

describe("조건 평가 — 확장된 종류", () => {
  it("selfSwitch 조건이 현재 이벤트 기준으로 평가된다", () => {
    const session = mkSession();
    session.selfSwitches = { ev_chest: { A: true } };

    expect(evalCondition(session, { kind: "selfSwitch", key: "A", value: true }, "ev_chest")).toBe(true);
    expect(evalCondition(session, { kind: "selfSwitch", key: "A", value: false }, "ev_chest")).toBe(false);
    expect(evalCondition(session, { kind: "selfSwitch", key: "B", value: true }, "ev_chest")).toBe(false);
  });

  it("actor 조건이 파티 멤버를 검사한다", () => {
    const session = mkSession();
    session.partyActorIds = ["hero", "mage"];

    expect(evalCondition(session, { kind: "actor", actorId: "hero", present: true })).toBe(true);
    expect(evalCondition(session, { kind: "actor", actorId: "cleric", present: true })).toBe(false);
    expect(evalCondition(session, { kind: "actor", actorId: "mage", present: false })).toBe(false);
  });

  it("item 조건이 소지 여부를 검사한다", () => {
    const session = mkSession();
    session.inventory = { potion: 3 };

    expect(evalCondition(session, { kind: "item", itemId: "potion", present: true })).toBe(true);
    expect(evalCondition(session, { kind: "item", itemId: "ether", present: true })).toBe(false);
  });

  it("gold 조건이 소지금을 비교한다", () => {
    const session = mkSession();
    session.gold = 500;

    expect(evalCondition(session, { kind: "gold", op: ">=", amount: 100 })).toBe(true);
    expect(evalCondition(session, { kind: "gold", op: ">=", amount: 1000 })).toBe(false);
    expect(evalCondition(session, { kind: "gold", op: "==", amount: 500 })).toBe(true);
  });

  it("timer 조건이 남은 초를 검사한다", () => {
    const session = mkSession();
    session.timers = { timer1: 30, timer2: 0 };

    expect(evalCondition(session, { kind: "timer", timerId: "timer1", seconds: 60 })).toBe(true);
    expect(evalCondition(session, { kind: "timer", timerId: "timer1", seconds: 10 })).toBe(false);
    expect(evalCondition(session, { kind: "timer", timerId: "timer2", seconds: 0 })).toBe(true);
  });
});

describe("fork 조건 분기 — 확장된 종류", () => {
  it("selfSwitch 조건으로 분기한다", () => {
    const session = mkSession();
    session.selfSwitches = { ev_chest: { A: true } };
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "selfSwitch", key: "A", value: true },
        then: [{ kind: "setVariable", variableId: "opened", op: "=", value: 1 }],
      },
    ];

    drain(commands, session);

    expect(session.variables.opened).toBe(1);
  });

  it("gold 조건으로 분기한다", () => {
    const session = mkSession();
    session.gold = 200;
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "gold", op: ">=", amount: 100 },
        then: [{ kind: "setVariable", variableId: "rich", op: "=", value: 1 }],
      },
    ];

    drain(commands, session);

    expect(session.variables.rich).toBe(1);
  });
});
