import { describe, it, expect } from "vitest";
import { createInterpreter, type Interpreter } from "@/player/interpreter";
import type { Command, Project } from "@/project/types";
import type { PlaySessionLike } from "@/player/types";

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
    playTimeSeconds: 0,
  };
}

// 맵 이벤트 호출 테스트용 최소 project. m1 맵에 ev_target 이벤트(페이지 1개)가 있고,
// 그 페이지의 commands 가 변수를 설정한다.
function mkProject(): Project {
  const commands: Command[] = [{ kind: "setVariable", variableId: "called", op: "=", value: 1 }];
  return {
    meta: { title: "test", author: "" },
    maps: {
      m1: {
        id: "m1", name: "맵 1", width: 16, height: 16,
        tilesetId: "ts", tileSize: 16,
        lowerTiles: [], upperTiles: [], events: [
          {
            id: "ev_target", x: 0, y: 0, trigger: { kind: "action" }, commands,
            pages: [{ id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
          },
        ],
      },
    },
    tilesets: {},
    switches: [],
    variables: [],
    commonEvents: [],
    database: { actors: [], classes: [], skills: [], items: [], equipment: [], enemies: [], troops: [], states: [], battleAnimations: [] },
    system: { startActorIds: [], titleResourceId: "", systemResourceId: "", battleSystemResourceId: "" },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    startMapId: "m1",
    startPos: { x: 0, y: 0 },
    mapTree: [],
    mapConnections: [],
    flags: {},
  } as unknown as Project;
}

function drainText(it: Interpreter, session: PlaySessionLike): void {
  let r = it.start();
  let guard = 0;
  while (r.kind !== "done" && guard++ < 1000) {
    if (r.kind === "text" || r.kind === "wait") r = it.resume(undefined);
    else break;
  }
  void session;
}

describe("Call Map Event", () => {
  it("현재 맵의 다른 이벤트 활성 페이지 commands 를 실행한다", () => {
    const session = mkSession();
    const project = mkProject();
    const interp = createInterpreter(
      [{ kind: "callMapEvent", eventId: "ev_target" }],
      session,
      project
    );
    drainText(interp, session);

    expect(session.variables.called).toBe(1);
  });

  it("존재하지 않는 이벤트는 경고 후 다음 명령으로 진행한다", () => {
    const session = mkSession();
    const project = mkProject();
    const interp = createInterpreter(
      [
        { kind: "callMapEvent", eventId: "ev_missing" },
        { kind: "setVariable", variableId: "after", op: "=", value: 9 },
      ],
      session,
      project
    );
    drainText(interp, session);

    expect(session.variables.after).toBe(9);
  });
});

describe("병렬 이벤트 skip", () => {
  it("skip() 이 블로킹 단계를 건너뛰고 다음 명령으로 진행한다", () => {
    const session = mkSession();
    // text(블로킹) 다음에 변수 설정. text 에서 skip 하면 변수가 설정되어야 함.
    const interp = createInterpreter(
      [
        { kind: "text", body: "막히는 메시지" },
        { kind: "setVariable", variableId: "skipped", op: "=", value: 1 },
      ],
      session
    );
    // start() → text 반환 → skip() → 다음 명령 진행
    const r1 = interp.start();
    expect(r1.kind).toBe("text");
    const r2 = interp.skip();
    // skip 후 setVariable 이 실행되어 done(이벤트 종료)
    expect(r2.kind).toBe("done");
    expect(session.variables.skipped).toBe(1);
  });
});
