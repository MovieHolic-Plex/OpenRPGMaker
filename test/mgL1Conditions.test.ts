// 명작 공백 G1 — 배우 수치·상태·선두·방향·숨기·회차·요일·문자열 조건과 조회(2026-09-27).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { evalCondition, startSession } from "@/project/session";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { evaluateM2Expression } from "@/player/interpreter/m2Expression";
import { createInterpreter } from "@/player/interpreter";
import { gameWeekday, sessionQueryValue } from "@/project/conditionActorQueries";
import { clearCountOf, clearHistoryOf } from "@/player/clearRecord";
import { resolveDialogueText } from "@/player/dialogue";
import type { Command, Project } from "@/project/types";

function project(): Project {
  const p = createBlankProject();
  return p;
}

function session(p = project()) {
  const s = startSession(p);
  s.partyActorIds = ["hero", "mage"];
  s.actorLevels = { hero: 12, mage: 3 };
  s.actorVitals = { hero: { hp: 30, mp: 5, maxHp: 120, maxMp: 20 }, mage: { hp: 50, mp: 40, maxHp: 50, maxMp: 40 } };
  return s;
}

function dataQuery(s: ReturnType<typeof session>, p: Project, query: string, target = ""): number {
  const entry = m2CommandById("m2-217-data-query");
  expect(entry).toBeDefined();
  executeM2RuntimeCommand(s, entry!, { commandId: entry!.id, fields: { query, target, variableId: "out" } }, { project: p });
  return s.variables.out ?? -1;
}

describe("명작 공백 G1 — 배우·파티 조건", () => {
  it("선두 레벨·HP% 로 분기하고, 파티에 없는 배우는 거짓", () => {
    const s = session();
    expect(evalCondition(s, { kind: "actorStat", actorId: "leader", stat: "level", op: ">=", value: 10 })).toBe(true);
    expect(evalCondition(s, { kind: "actorStat", actorId: "hero", stat: "hpPercent", op: "<=", value: 25 })).toBe(true);
    expect(evalCondition(s, { kind: "actorStat", actorId: "mage", stat: "hpPercent", op: "<=", value: 25 })).toBe(false);
    expect(evalCondition(s, { kind: "actorStat", actorId: "ghost", stat: "level", op: ">=", value: 0 })).toBe(false);
  });

  it("상태 보유(누군가/특정)·선두·인원", () => {
    const s = session();
    s.actorStateIds = { mage: ["state_poison"] };
    expect(evalCondition(s, { kind: "actorState", actorId: "anyone", stateId: "state_poison", present: true })).toBe(true);
    expect(evalCondition(s, { kind: "actorState", actorId: "hero", stateId: "state_poison", present: true })).toBe(false);
    expect(evalCondition(s, { kind: "partyLeader", actorId: "hero" })).toBe(true);
    s.partyActorIds = [];
    expect(evalCondition(s, { kind: "partyLeader", actorId: "hero" })).toBe(false);
    expect(evalCondition(s, { kind: "partySize", op: "==", value: 0 })).toBe(true);
  });
});

describe("명작 공백 G1 — Data Query·식 식별자", () => {
  it("배우 레벨·HP·파티 인원·걸음·플레이 시간·클리어 수를 변수로 읽는다", () => {
    const p = project();
    const s = session(p);
    s.stepCount = 77;
    s.playTimeSeconds = 125.9;
    s.clearHistory = { count: 3, endingIds: ["a"] };
    expect(dataQuery(s, p, "actorLevel", "leader")).toBe(12);
    expect(dataQuery(s, p, "actorHp", "mage")).toBe(50);
    expect(dataQuery(s, p, "actorHpPercent", "hero")).toBe(25);
    expect(dataQuery(s, p, "partySize")).toBe(2);
    expect(dataQuery(s, p, "steps")).toBe(77);
    expect(dataQuery(s, p, "playtimeSeconds")).toBe(125);
    expect(dataQuery(s, p, "clearCount")).toBe(3);
    expect(dataQuery(s, p, "actorLevel", "nobody")).toBe(0);
  });

  it("식에서 leaderLevel·partySize 를 쓴다", () => {
    const s = session();
    expect(evaluateM2Expression("leaderLevel * 2 + partySize", s)).toBe(26);
  });
});

describe("명작 공백 G1 — 방향·등 뒤·숨기·추격", () => {
  it("주인공 방향과 이벤트 등 뒤 판정", () => {
    const s = session();
    s.playerFacing = "left";
    expect(evalCondition(s, { kind: "facing", subject: "player", dir: "left" })).toBe(true);
    // 이벤트(5,5) 가 오른쪽을 본다. 주인공(3,5) 은 그 등 뒤.
    s.x = 3;
    s.y = 5;
    const host = { eventId: "statue" };
    s.eventLocations.statue = { mapId: s.currentMapId, x: 5, y: 5, direction: "right" };
    expect(evalCondition(s, { kind: "relativeFacing", relation: "playerBehindEvent" }, host.eventId)).toBe(true);
    // 주인공이 왼쪽(석상 반대)을 보면 석상을 보고 있지 않다 → 안 볼 때 움직이는 조각상.
    expect(evalCondition(s, { kind: "not", condition: { kind: "relativeFacing", relation: "playerFacingEvent" } }, host.eventId)).toBe(true);
    s.playerFacing = "right";
    expect(evalCondition(s, { kind: "relativeFacing", relation: "playerFacingEvent" }, host.eventId)).toBe(true);
  });

  it("숨기·추격 중 조건", () => {
    const s = session();
    expect(evalCondition(s, { kind: "hiding", value: false })).toBe(true);
    s.horror = { pursuits: { oni: { home: { mapId: "m", x: 0, y: 0 }, active: true, searchMs: 0, doors: [] } }, hiding: { mapId: "m", eventId: "closet", witnessedBy: [] } };
    expect(evalCondition(s, { kind: "hiding", value: true })).toBe(true);
    expect(evalCondition(s, { kind: "pursuitActive", eventId: "oni", value: true })).toBe(true);
    expect(evalCondition(s, { kind: "pursuitActive", eventId: "other", value: true })).toBe(false);
  });
});

describe("명작 공백 G1 — 회차·요일·문자열", () => {
  it("클리어 기록: 옛 기록은 본 엔딩 수, 새 기록은 누적 횟수", () => {
    expect(clearCountOf(undefined)).toBe(0);
    expect(clearCountOf({ endingIds: ["a", "b"], clearedAt: "x", carry: {} })).toBe(2);
    expect(clearHistoryOf({ endingIds: ["a"], clearCount: 5, clearedAt: "x", carry: {} })).toEqual({ count: 5, endingIds: ["a"] });
  });

  it("회차·본 엔딩·강하게 다시 하기 조건", () => {
    const s = session();
    expect(evalCondition(s, { kind: "clearCount", op: ">=", value: 1 })).toBe(false);
    s.clearHistory = { count: 2, endingIds: ["true_end"] };
    s.flags.ngplus = true;
    expect(evalCondition(s, { kind: "clearCount", op: ">=", value: 2 })).toBe(true);
    expect(evalCondition(s, { kind: "endingSeen", endingId: "true_end", value: true })).toBe(true);
    expect(evalCondition(s, { kind: "newGamePlus", value: true })).toBe(true);
  });

  it("요일은 1년 1일 월요일 기준으로 7일마다 돈다, 시계가 없으면 거짓", () => {
    expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "spring", year: 1 }, 28)).toBe(1);
    expect(gameWeekday({ minute: 0, hour: 8, day: 7, season: "spring", year: 1 }, 28)).toBe(0);
    expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "summer", year: 1 }, 28)).toBe(1);
    expect(gameWeekday({ minute: 0, hour: 8, day: 1, season: "spring", year: 1 }, 28, 3)).toBe(3);
    const s = session();
    s.gameTime = undefined;
    expect(evalCondition(s, { kind: "weekday", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
  });

  it("문자 입력은 문자열 변수에 들어가고 \\T[id] 로 대사에 찍히며 조건이 읽는다", () => {
    const p = project();
    const s = session(p);
    const commands: Command[] = [{ kind: "enterHeroName", actorId: "", maxLength: 8, showInitialName: false, stringVariableId: "prayer", prompt: "기도문" }];
    const interpreter = createInterpreter(commands, s, p);
    const step = interpreter.start();
    expect(step).toMatchObject({ kind: "enterHeroName", prompt: "기도문" });
    interpreter.resume("빛이여 오라");
    expect(s.stringVariables?.prayer).toBe("빛이여 오라");
    expect(evalCondition(s, { kind: "stringVariable", stringVariableId: "prayer", op: "contains", value: "빛" })).toBe(true);
    expect(evalCondition(s, { kind: "stringVariable", stringVariableId: "missing", op: "empty", value: "" })).toBe(true);
    expect(sessionQueryValue(s, "stringLength", "prayer")).toBe(6);
    expect(resolveDialogueText("기도: \\T[prayer]!", { session: s, project: p })).toBe("기도: 빛이여 오라!");
  });
});
