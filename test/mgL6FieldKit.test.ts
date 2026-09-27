// 명작 공백 G3 필드 키트(#1 미니게임 · #5 필드 능력 · #24 순간이동 · #25 걸음 상태 · #32 클릭 이동) — 2026-09-27.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { applyFieldStepStates } from "@/project/stateFieldSteps";
import { recordTeleportPoint, teleportMenuEntries } from "@/project/teleportPoints";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { createInterpreter } from "@/player/interpreter";
import { applyHighScore, applyKeyPoll, judgeQuickTime, quickTimeStep } from "@/player/interpreter/minigameCommands";
import { prepareFieldAbility } from "@/player/fieldAbility";
import { clientToWorld, pointerTile } from "@/player/playScenePointerMove";
import type { Command, Project, SkillRecord, StateRecord } from "@/project/types";

function poisonProject(state: Partial<StateRecord>): Project {
  const project = createBlankProject();
  project.database.states = [{ id: "state_swamp", name: "늪독", ...state } as StateRecord];
  return project;
}

function partySession(project: Project) {
  const session = startSession(project);
  session.partyActorIds = ["hero"];
  session.actorVitals = { hero: { hp: 10, mp: 8, maxHp: 30, maxMp: 20 } };
  session.actorStateIds = { hero: ["state_swamp"] };
  return session;
}

describe("#25 필드 걸음 상태", () => {
  it("간격마다 HP 를 깎고 1 아래로는 내리지 않는다", () => {
    const project = poisonProject({ hpReleaseStep: -4, fieldStepInterval: 2 });
    const session = partySession(project);
    applyFieldStepStates(project, session);
    expect(session.actorVitals.hero!.hp).toBe(10);
    applyFieldStepStates(project, session);
    expect(session.actorVitals.hero!.hp).toBe(6);
    for (let i = 0; i < 10; i += 1) applyFieldStepStates(project, session);
    expect(session.actorVitals.hero!.hp).toBe(1);
  });

  it("fieldStepCanKill 이면 전원 0 에서 패배를 알린다", () => {
    const project = poisonProject({ hpReleaseStep: -20, fieldStepCanKill: true });
    const session = partySession(project);
    expect(applyFieldStepStates(project, session).defeated).toBe(true);
  });

  it("releaseAfterSteps 를 채우면 상태가 풀리고 카운터도 지운다", () => {
    const project = poisonProject({ releaseAfterSteps: 3 });
    const session = partySession(project);
    applyFieldStepStates(project, session);
    applyFieldStepStates(project, session);
    expect(session.actorStateIds!.hero).toContain("state_swamp");
    const result = applyFieldStepStates(project, session);
    expect(result.released).toEqual([{ actorId: "hero", stateId: "state_swamp" }]);
    expect(session.actorStateIds!.hero).not.toContain("state_swamp");
  });

  it("걸음 효과가 없는 옛 상태는 아무것도 바꾸지 않는다", () => {
    const project = poisonProject({});
    const session = partySession(project);
    expect(applyFieldStepStates(project, session)).toEqual({ changed: 0, released: [], defeated: false });
    expect(session.stateStepCounts).toBeUndefined();
  });
});

describe("#24 방문지 순간이동", () => {
  it("Set Teleportation Point 가 목록에 쌓이고 메뉴는 지금 맵과 없는 맵을 뺀다", () => {
    const project = createBlankProject();
    project.maps.town = { ...project.maps[project.startMapId]!, id: "town", name: "물가 마을" };
    const session = startSession(project);
    const entry = m2CommandById("m2-072-set-teleportation-point")!;
    executeM2RuntimeCommand(session, entry, { commandId: entry.id, fields: { mapId: "town", x: 3, y: 4 } }, { project });
    recordTeleportPoint(session, { mapId: "gone", x: 0, y: 0 });
    recordTeleportPoint(session, { mapId: session.currentMapId, x: 1, y: 1 });
    expect(teleportMenuEntries(session, project.maps).map((e) => e.label)).toEqual(["물가 마을"]);
  });

  it("순간이동이 금지되면 Teleport Menu 는 결과 변수에 -1 을 쓰고 멈추지 않는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const commands: Command[] = [
      { kind: "m2Command", commandId: "m2-073-teleportation-on-off", fields: { enabled: "false" } },
      { kind: "m2Command", commandId: "m2-223-teleport-menu", fields: { resultVariableId: "where" } },
    ];
    const step = createInterpreter(commands, session, project).start();
    expect(step.kind).toBe("done");
    expect(session.variables.where).toBe(-1);
  });
});

describe("#1 미니게임 키트", () => {
  it("Key Poll 이 지금 눌린 키를 변수·스위치로 옮긴다", () => {
    const session = startSession(createBlankProject());
    session.heldInput = { dir: 6, confirm: true, cancel: false, dash: true };
    applyKeyPoll(session, { dirVariableId: "dir", confirmSwitchId: "hit", dashSwitchId: "run" });
    expect(session.variables.dir).toBe(6);
    expect(session.switches.hit).toBe(true);
    expect(session.switches.run).toBe(true);
  });

  it("High Score: 높은 점수만 갱신하고 새 기록 스위치를 켠다, 시간 기록은 낮을수록", () => {
    const session = startSession(createBlankProject());
    session.variables.score = 120;
    applyHighScore(session, { scoreId: "fish", action: "submit", valueVariableId: "score", resultVariableId: "best", recordSwitchId: "new" });
    expect([session.variables.best, session.switches.new]).toEqual([120, true]);
    session.variables.score = 80;
    applyHighScore(session, { scoreId: "fish", action: "submit", valueVariableId: "score", resultVariableId: "best", recordSwitchId: "new" });
    expect([session.variables.best, session.switches.new]).toEqual([120, false]);
    session.variables.score = 42;
    applyHighScore(session, { scoreId: "race", action: "submitLow", valueVariableId: "score", resultVariableId: "best" });
    session.variables.score = 50;
    applyHighScore(session, { scoreId: "race", action: "submitLow", valueVariableId: "score", resultVariableId: "best" });
    expect(session.highScores).toEqual({ fish: 120, race: 42 });
  });

  it("QTE 판정: 순서가 맞아야 1, 연타는 횟수", () => {
    const step = quickTimeStep({ mode: "sequence", keys: "up, down ,z, nope", windowMs: 800 });
    expect(step.keys).toEqual(["up", "down", "z"]);
    expect(judgeQuickTime(step, ["up", "down", "z"])).toBe(1);
    expect(judgeQuickTime(step, ["up", "z"])).toBe(0);
    expect(judgeQuickTime(quickTimeStep({ mode: "mash", keys: "z" }), ["z", "z", "z", "z"])).toBe(4);
  });

  it("Timed Choice·QTE 는 일시정지하고 결과가 변수·스위치로 돌아온다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const commands: Command[] = [
      { kind: "m2Command", commandId: "m2-220-timed-choice", fields: { options: "싸운다\n도망친다", timeLimitMs: 2000, resultVariableId: "pick" } },
      { kind: "m2Command", commandId: "m2-221-quick-time-event", fields: { mode: "sequence", keys: "z", resultVariableId: "qte", resultSwitchId: "ok" } },
    ];
    const interpreter = createInterpreter(commands, session, project);
    const first = interpreter.start();
    expect(first).toMatchObject({ kind: "timedChoice", options: ["싸운다", "도망친다"], timeLimitMs: 2000 });
    const second = interpreter.resume(0);
    expect(session.variables.pick).toBe(0);
    expect(second.kind).toBe("quickTimeEvent");
    interpreter.resume(1);
    expect([session.variables.qte, session.switches.ok]).toEqual([1, true]);
  });
});

describe("#5 필드 능력", () => {
  it("MP 를 내고 정면 대상과 좌표를 적는다, MP 가 모자라면 쓰지 못한다", () => {
    const project = createBlankProject();
    project.commonEvents = [{ id: "ce_move", name: "무브", trigger: "none", commands: [] } as Project["commonEvents"][number]];
    const skill = { id: "sk_move", name: "무브", mpCost: { flat: 5, percentMax: 0 }, fieldCommonEventId: "ce_move" } as SkillRecord;
    const session = startSession(project);
    session.partyActorIds = ["hero"];
    session.actorVitals = { hero: { hp: 10, mp: 7, maxHp: 10, maxMp: 20 } };
    session.x = 4;
    session.y = 4;
    expect(prepareFieldAbility(project, session, "hero", skill, { facing: "up", eventId: "boulder" })).toEqual({ kind: "ok", commonEventId: "ce_move" });
    expect(session.actorVitals.hero!.mp).toBe(2);
    expect([session.variables.fieldAbilityX, session.variables.fieldAbilityY, session.stringVariables?.fieldAbilityTarget]).toEqual([4, 3, "boulder"]);
    expect(prepareFieldAbility(project, session, "hero", skill, { facing: "up" }).kind).toBe("unusable");
  });
});

describe("#32 클릭 이동", () => {
  it("화면 좌표를 타일로 바꾸고 맵 밖은 무시한다", () => {
    const scene = { map: { width: 10, height: 8, tileSize: 16 } } as unknown as Parameters<typeof pointerTile>[0];
    expect(pointerTile(scene, 40, 20)).toEqual({ x: 2, y: 1 });
    expect(pointerTile(scene, -1, 5)).toBeUndefined();
    expect(pointerTile(scene, 16 * 10, 5)).toBeUndefined();
  });

  it("화면 좌표를 캔버스 배율·스크롤·줌으로 월드 좌표로 되돌리고 캔버스 밖은 버린다", () => {
    // 캔버스 CSS 960x720 에 논리 320x240(3배), 왼쪽·위 32·24 px 여백.
    const rect = { left: 32, top: 24, width: 960, height: 720 };
    const camera = { scrollX: 0, scrollY: 0, zoom: 1, width: 320, height: 240 };
    expect(clientToWorld(rect, camera, 32 + 12.5 * 16 * 3, 24 + 8.5 * 16 * 3)).toEqual({ x: 200, y: 136 });
    expect(clientToWorld(rect, { ...camera, scrollX: 48, zoom: 2 }, 32 + 96, 24)).toEqual({ x: 64, y: 0 });
    expect(clientToWorld(rect, camera, 10, 10)).toBeUndefined();
  });
});
