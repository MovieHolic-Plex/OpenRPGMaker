import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import { switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { PlaySession } from "@/project/session";

function mkSession(): PlaySession {
  return {
    switches: {},
    selfSwitches: { ev1: { A: true } },
    variables: {},
    timers: {},
    gold: 750,
    inventory: { potion: 3 },
    partyActorIds: [],
    classOverrides: {},
    actorSkillIds: {},
    actorExperience: {},
    actorLevels: {},
    actorVitals: {},
    eventLocations: {},
    erasedEventIds: [],
    npcTravelStates: {},
    followers: [],
    followerTrail: [],
    actorEquipment: {},
    actorRows: {},
    currentMapId: "m1",
    x: 5,
    y: 6,
    lighting: { ambient: 0, sources: [] },
    mapOverrides: {},
    flags: {},
    audio: {},
    pictures: {},
    playTimeSeconds: 0,
  };
}

function mkSessionWithMeta(): PlaySession {
  const session = mkSession();
  session.playTimeSeconds = 3661; // 1h 1m 1s
  return session;
}

describe("세이브 직렬화 — gold/selfSwitches", () => {
  it("gold 가 스냅샷에 저장되고 로드 후 복원된다", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, mkSession());

    expect(snapshot.session.gold).toBe(750);

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.gold).toBe(750);
  });

  it("selfSwitches 가 스냅샷에 저장되고 로드 후 복원된다", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, mkSession());

    expect(snapshot.session.selfSwitches?.ev1?.A).toBe(true);

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.selfSwitches.ev1?.A).toBe(true);
  });

  it("playTimeSeconds 가 스냅샷에 저장되고 복원된다", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, mkSessionWithMeta());

    expect(snapshot.playTimeSeconds).toBe(3661);
    expect(snapshot.session.playTimeSeconds).toBe(3661);

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.playTimeSeconds).toBe(3661);
  });

  it("현재 맵 이름이 스냅샷 메타데이터에 저장된다", () => {
    const project = createBlankProject();
    const firstMapId = Object.keys(project.maps)[0]!;
    project.maps[firstMapId]!.name = "시작 마을";
    const session = mkSession();
    session.currentMapId = firstMapId;

    const snapshot = createSaveSnapshot(project, session);

    expect(snapshot.mapName).toBe("시작 마을");
  });

  it("대표 파티 레벨이 슬롯 메타데이터에 저장된다", () => {
    const project = createBlankProject();
    const actorId = project.database.actors[0]!.id;
    const session = mkSession();
    session.partyActorIds = [actorId];
    session.actorLevels = { [actorId]: 7 };

    const snapshot = createSaveSnapshot(project, session);

    expect(snapshot.partyLevel).toBe(7);
  });

  it("erasedEventIds 가 스냅샷에 저장되고 로드 후 복원된다", () => {
    const project = createBlankProject();
    const session = mkSession();
    session.erasedEventIds = ["ev_erased"];

    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);

    expect(snapshot.session.erasedEventIds).toEqual(["ev_erased"]);
    expect(restored.erasedEventIds).toEqual(["ev_erased"]);
  });
});

describe("스위치/변수 삭제 참조 경고", () => {
  beforeEach(() => {
    // store 에 테스트용 프로젝트를 올린다.
    const project = createBlankProject();
    project.switches = [{ id: "sw1", name: "문 열림" }];
    project.variables = [{ id: "var1", name: "카운트" }];
    store.replace(project);
  });

  afterEach(() => {
    store.replace(createBlankProject());
  });

  it("참조되지 않은 스위치는 경고 없이 삭제 가능하다", () => {
    expect(switchVariableReferenceMessage("switch", "sw1")).toBeNull();
  });

  it("참조되지 않은 변수는 경고 없이 삭제 가능하다", () => {
    expect(switchVariableReferenceMessage("variable", "var1")).toBeNull();
  });

  it("명령에서 참조 중인 스위치는 경고를 반환한다", () => {
    const project = store.getCurrent();
    project.maps[Object.keys(project.maps)[0]!].events.push({
      id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
      commands: [{ kind: "setSwitch", switchId: "sw1", value: true }],
    });
    store.replace(project);

    expect(switchVariableReferenceMessage("switch", "sw1")).not.toBeNull();
  });

  it("fork 조건에서 참조 중인 변수는 경고를 반환한다", () => {
    const project = store.getCurrent();
    project.maps[Object.keys(project.maps)[0]!].events.push({
      id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
      commands: [{
        kind: "fork",
        condition: { kind: "variable", variableId: "var1", op: ">=", value: 5 },
        then: [{ kind: "text", body: "hi" }],
      }],
    });
    store.replace(project);

    expect(switchVariableReferenceMessage("variable", "var1")).not.toBeNull();
  });
});
