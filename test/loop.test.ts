import { describe, it, expect, vi } from "vitest";
import { createInterpreter, type Interpreter, type StepResult } from "@/player/interpreter";
import type { Command, Project } from "@/project/types";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession, DEFAULT_MESSAGE_WINDOW_SETTINGS, evalCondition } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { hasSessionCheckpoint, restoreSessionCheckpoint, getSessionCheckpoint, MAP_ENTRY_CHECKPOINT_LABEL } from "@/player/checkpoints";
import { deserialize, serialize } from "@/project/io";
import { PREVIOUS_PARTY_SET_ID, recallPartySet, storePartySet } from "@/project/partySets";
import { session } from "./runtimeEventPageFixtures";
import { isolateTimers } from "./mergedTeardown";

describe("callMapEvent", () => {
  isolateTimers();
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
});

describe("checkpointEndingRuntime", () => {
  isolateTimers();
  describe("checkpointSave / killPlayer / triggerEnding", () => {
    it("checkpointSave는 저장 슬롯 스냅샷으로 세션 상태를 왕복 복원한다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const switchId = project.switches[0]!.id;
      const variableId = project.variables[0]!.id;
      const actorId = session.partyActorIds[0]!;
      session.currentMapId = project.startMapId;
      session.x = 3;
      session.y = 4;
      session.switches[switchId] = true;
      session.variables[variableId] = 7;
      session.actorVitals[actorId]!.hp = 5;

      const result = createInterpreter([{ kind: "checkpointSave" }], session, project).start();
      expect(result).toEqual({ kind: "done" });

      session.x = 1;
      session.y = 1;
      session.switches[switchId] = false;
      session.variables[variableId] = 0;
      session.actorVitals[actorId]!.hp = 1;
      const restored = restoreSessionCheckpoint(project, session);

      expect(restored).not.toBeNull();
      expect(restored).toMatchObject({
        currentMapId: project.startMapId,
        x: 3,
        y: 4,
      });
      expect(restored!.switches[switchId]).toBe(true);
      expect(restored!.variables[variableId]).toBe(7);
      expect(restored!.actorVitals[actorId]!.hp).toBe(5);
    });

    it("체크포인트는 일반 세이브 스냅샷에 포함되지 않는다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      createInterpreter([{ kind: "checkpointSave" }], session, project).start();
      expect(hasSessionCheckpoint(session)).toBe(true);

      const loaded = applySaveSnapshot(project, createSaveSnapshot(project, session));

      expect(hasSessionCheckpoint(loaded)).toBe(false);
    });

    it("killPlayer는 파티 전멸 후 gameOver를 내고 체크포인트 복원으로 이전 상태를 돌린다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const variableId = project.variables[0]!.id;
      const actorId = session.partyActorIds[0]!;
      session.x = 2;
      session.y = 2;

      const commands: Command[] = [
        { kind: "checkpointSave" },
        { kind: "setVariable", variableId, op: "=", value: 9 },
        { kind: "killPlayer", message: "함정" },
      ];
      const step = createInterpreter(commands, session, project).start();

      expect(step).toEqual({ kind: "gameOver", message: "함정" });
      expect(session.actorVitals[actorId]!.hp).toBe(0);
      const restored = restoreSessionCheckpoint(project, session);
      expect(restored).not.toBeNull();
      expect(restored!.x).toBe(2);
      expect(restored!.y).toBe(2);
      expect(restored!.variables[variableId]).toBe(0);
    });

    it("triggerEnding은 조건 만족 엔딩 중 priority가 가장 높은 항목을 고른다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const variableId = project.variables[0]!.id;
      project.endings = [
        { id: "ending_low", name: "낮은 엔딩", priority: 1, conditions: [{ kind: "variable", variableId, op: ">=", value: 0 }] },
        { id: "ending_high", name: "높은 엔딩", priority: 10, conditions: [{ kind: "variable", variableId, op: ">=", value: 0 }] },
      ];

      const step = createInterpreter([{ kind: "triggerEnding" }], session, project).start();

      // 엔딩 종료 단계는 이제 클리어 기록용 endingId 를 함께 싣는다.
      expect(step).toEqual({ kind: "returnToTitle", title: "높은 엔딩", message: "", clear: { endingId: "ending_high" } });
      expect(session.flags["ending:ending_high"]).toBe(true);
      expect(session.flags["ending:ending_low"]).toBeUndefined();
    });

    it("이름 있는 triggerEnding은 엔딩 조건이 거짓이면 끝나지 않고, 참이면 그 엔딩을 연다", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const variableId = project.variables[0]!.id;
      project.endings = [
        { id: "ending_love", name: "고백", priority: 10, conditions: [{ kind: "variable", variableId, op: ">=", value: 6 }] },
      ];
      session.variables[variableId] = 2;
      const blocked = createInterpreter([{ kind: "triggerEnding", endingId: "ending_love" }], session, project).start();
      expect(blocked).toEqual({ kind: "done" });
      expect(session.flags["ending:ending_love"]).toBeUndefined();

      session.variables[variableId] = 6;
      const opened = createInterpreter([{ kind: "triggerEnding", endingId: "ending_love" }], session, project).start();
      expect(opened).toEqual({ kind: "returnToTitle", title: "고백", message: "", clear: { endingId: "ending_love" } });
      expect(session.flags["ending:ending_love"]).toBe(true);
    });

    it("define_ending은 같은 조건 집합의 낮은 priority 엔딩을 warning으로 보고한다", () => {
      const project = createBlankProject();
      const switchId = project.switches[0]!.id;
      // priority 는 endingId 없는 triggerEnding(조건 선택형)이 있을 때만 결말을 가른다(3ed617bbea #2692) — 그 호출을 둔다.
      project.commonEvents.push({ id: "pick_ending", name: "결말 고르기", trigger: "none", commands: [{ kind: "triggerEnding" }] });
      const ctx = { project };
      const first = runTool(ctx, "define_ending", {
        id: "ending_low",
        name: "낮은 엔딩",
        priority: 1,
        conditions: [{ kind: "switch", switchId, value: true }],
      });
      expect(first.ok, first.summary).toBe(true);

      const second = runTool(ctx, "define_ending", {
        id: "ending_high",
        name: "높은 엔딩",
        priority: 5,
        conditions: [{ kind: "switch", switchId, value: true }],
      });

      expect(second.ok, second.summary).toBe(true);
      expect(second.diff?.warnings.join("\n")).toContain("ending_low");
      expect(second.diff?.warnings.join("\n")).toContain("가려집니다");
    });
  });
});

/**
 * 루프 반복 가드는 **루프마다 따로** 세어야 한다.
 *
 * 회귀 배경: `state.loopIterations` 가 인터프리터 전역 카운터 하나였고
 * `commandCatalog` 의 `case "loop"` 이 루프에 **진입할 때마다** 그 카운터를 0 으로
 * 되돌렸다. 그래서 안쪽 루프가 바깥 루프의 반복 수를 매 바깥 반복마다 지웠고,
 * 바깥 루프의 `maxLoopIterations` 가드는 영원히 울리지 않았다. 실제로 멈춘 것은
 * `maxInstructions` 였다 — 엉뚱한 가드가 울리니 로그도 원인을 가리키지 못했다.
 */
describe("interpreterNestedLoopBudget", () => {
  isolateTimers();
  function mkSession(): PlaySessionLike {
    return {
      flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
      partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
      currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
    } as unknown as PlaySessionLike;
  }
  /** 예산 소진 경고만 순서대로 모은다. 루프 종료는 `console.warn` 도 내므로 함께 삼킨다. */
  function runCollectingBudgetWarnings(
    commands: Command[],
    options: { maxLoopIterations: number; maxInstructions: number },
  ): string[] {
    const warnings: string[] = [];
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      createInterpreter(commands, mkSession(), undefined, {
        ...options,
        onUnverified: (message) => warnings.push(message),
      }).start();
    } finally {
      consoleWarn.mockRestore();
    }
    return warnings;
  }
  describe("루프 반복 예산", () => {
    it("안쪽 루프가 바깥 루프의 반복 수를 지우지 않는다", () => {
      // 바깥 루프는 끝나지 않는다. 본문은 「즉시 빠져나오는 안쪽 루프」 하나뿐이라
      // 바깥 반복마다 안쪽 루프 진입이 일어난다.
      const commands: Command[] = [{
        kind: "loop",
        body: [{ kind: "loop", body: [{ kind: "breakLoop" }] }],
      }];

      const warnings = runCollectingBudgetWarnings(commands, {
        maxLoopIterations: 5,
        maxInstructions: 1000,
      });

      // 바깥 루프가 6번째 반복에서 자기 예산으로 멈춰야 한다 — 명령 예산이 아니라.
      expect(warnings).toEqual(["Interpreter loop budget exhausted"]);
    });

    it("앞선 루프가 소진돼도 다음 루프는 자기 예산을 새로 받는다", () => {
      const neverEnding = (): Command => ({ kind: "loop", body: [{ kind: "label", name: "x" }] });
      const commands: Command[] = [neverEnding(), neverEnding()];

      const warnings = runCollectingBudgetWarnings(commands, {
        maxLoopIterations: 3,
        maxInstructions: 1000,
      });

      expect(warnings).toEqual([
        "Interpreter loop budget exhausted",
        "Interpreter loop budget exhausted",
      ]);
    });
  });
});

describe("interpreterPartyVitals", () => {
  isolateTimers();
  function session(): PlaySessionLike {
    return {
      flags: {},
      switches: {},
      variables: {},
      timers: {},
      gold: 0,
      inventory: {},
      partyActorIds: [],
      actorVitals: {},
      currentMapId: "map",
      x: 0,
      y: 0,
    };
  }
  it("changeParty initializes actor vitals when interpreter has project context", () => {
    const project = createBlankProject();
    const actorId = project.database.actors[0]?.id;
    if (!actorId) throw new Error("missing default actor");
    const state = session();
    const commands: Command[] = [{ kind: "changeParty", actorId, action: "add" }];

    createInterpreter(commands, state, project).start();

    expect(state.partyActorIds).toEqual([actorId]);
    expect(state.actorVitals[actorId]?.hp).toBeGreaterThan(0);
    expect(state.actorVitals[actorId]?.mp).toBeGreaterThanOrEqual(0);
    expect(state.actorVitals[actorId]?.hp).toBe(state.actorVitals[actorId]?.maxHp);
    expect(state.actorVitals[actorId]?.mp).toBe(state.actorVitals[actorId]?.maxMp);
  });
});

describe("loop", () => {
  isolateTimers();
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
    };
  }
  // loop 는 pause 를 만들지 않고 인터프리터 내부에서 반복을 수행한다.
  // 따라서 start() 한 번으로 breakLoop 또는 가드 도달까지 실행된다.
  // 단 body 안에 text 가 있으면 pause 하므로 resume 이 필요하다.
  function runToEnd(
    commands: Command[],
    session: PlaySessionLike,
    opts?: { maxLoopIterations?: number; onText?: () => void }
  ): void {
    const interp = createInterpreter(commands, session, undefined, { maxLoopIterations: opts?.maxLoopIterations });
    let r = interp.start();
    let guard = 0;
    while (r.kind !== "done" && guard++ < 5000) {
      if (r.kind === "text") {
        opts?.onText?.();
        r = interp.resume(undefined);
      } else if (r.kind === "wait") {
        r = interp.resume(undefined);
      } else {
        break;
      }
    }
  }
  describe("Loop / Break Loop", () => {
    it("루프 본문이 breakLoop 만날 때까지 반복된다", () => {
      const session = mkSession();
      // 변수 counter 가 3 이상이면 탈출, 매 반복마다 +1
      const commands: Command[] = [
        { kind: "setVariable", variableId: "counter", op: "=", value: 0 },
        {
          kind: "loop",
          body: [
            { kind: "setVariable", variableId: "counter", op: "+=", value: 1 },
            {
              kind: "fork",
              condition: { kind: "variable", variableId: "counter", op: ">=", value: 3 },
              then: [{ kind: "breakLoop" }],
            },
          ],
        },
        { kind: "setVariable", variableId: "after", op: "=", value: 99 },
      ];

      runToEnd(commands, session);

      expect(session.variables.counter).toBe(3);
      expect(session.variables.after).toBe(99);
    });

    it("breakLoop 없이 루프를 탈출하면 무한 반복 가드가 종료시킨다", () => {
      const session = mkSession();
      const commands: Command[] = [
        { kind: "setVariable", variableId: "counter", op: "=", value: 0 },
        {
          kind: "loop",
          body: [{ kind: "setVariable", variableId: "counter", op: "+=", value: 1 }],
        },
        { kind: "setVariable", variableId: "after", op: "=", value: 7 },
      ];

      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      runToEnd(commands, session, { maxLoopIterations: 5 });
      warn.mockRestore();

      // 가드(maxLoopIterations=5) 도달 후 정상적으로 이후 명령 실행
      expect(session.variables.after).toBe(7);
      expect(session.variables.counter).toBe(5);
    });

    it("빈 루프 본문은 한 번도 실행되지 않고 건너뛴다", () => {
      const session = mkSession();
      const commands: Command[] = [
        { kind: "setVariable", variableId: "before", op: "=", value: 1 },
        { kind: "loop", body: [] },
        { kind: "setVariable", variableId: "after", op: "=", value: 2 },
      ];

      runToEnd(commands, session);

      expect(session.variables.before).toBe(1);
      expect(session.variables.after).toBe(2);
    });

    it("루프 안의 text 명령은 매 반복마다 pause/ resume 된다", () => {
      const session = mkSession();
      const commands: Command[] = [
        { kind: "setVariable", variableId: "n", op: "=", value: 0 },
        {
          kind: "loop",
          body: [
            { kind: "setVariable", variableId: "n", op: "+=", value: 1 },
            { kind: "text", body: "반복" },
            {
              kind: "fork",
              condition: { kind: "variable", variableId: "n", op: ">=", value: 2 },
              then: [{ kind: "breakLoop" }],
            },
          ],
        },
      ];

      let textCount = 0;
      runToEnd(commands, session, { onText: () => { textCount += 1; } });

      expect(session.variables.n).toBe(2);
      expect(textCount).toBe(2);
    });
  });
});

describe("mgL7sysPartySets", () => {
  isolateTimers();
  function partyProject(): Project {
    return createBlankProject();
  }
  /** 명령을 끝까지 돌리고 pause 된 스텝 종류를 순서대로 돌려준다(transfer 는 호스트 대신 좌표를 반영한다). */
  function run(commands: Command[], project: Project, session: PlaySession): StepResult[] {
    const steps: StepResult[] = [];
    const interpreter = createInterpreter(commands, session, project, { continueAfterTransfer: true });
    let step = interpreter.start();
    while (step.kind !== "done") {
      steps.push(step);
      if (step.kind === "transfer") {
        session.currentMapId = step.mapId;
        session.x = step.x;
        session.y = step.y;
      }
      step = interpreter.resume();
    }
    return steps;
  }
  describe("multiple parties (#22)", () => {
    it("storeParty saves members and position under a name", () => {
      const project = partyProject();
      const session = startSession(project, 1);
      session.partyActorIds = ["actor_hero", "actor_mage"];
      session.x = 3;
      session.y = 4;
      run([{ kind: "storeParty", partySetId: "north" }], project, session);
      expect(session.partySets?.north).toEqual({ actorIds: ["actor_hero", "actor_mage"], mapId: project.startMapId, x: 3, y: 4 });
      expect(session.activePartySetId).toBe("north");
    });

    it("recallParty swaps members, auto-stores the leaving party and transfers to the recalled position", () => {
      const project = partyProject();
      const session = startSession(project, 1);
      session.partyActorIds = ["actor_hero"];
      session.x = 2;
      session.y = 2;
      storePartySet(session, "a");
      session.partySets = { ...session.partySets, b: { actorIds: ["actor_scout", "actor_cleric"], mapId: project.startMapId, x: 7, y: 5 } };
      // 파티 a 가 걸어간 뒤 b 로 바꾼다.
      session.x = 9;
      session.y = 1;
      const steps = run([{ kind: "recallParty", partySetId: "b" }], project, session);
      expect(steps.map((step) => step.kind)).toEqual(["transfer"]);
      expect(session.flags.recallPartySuccess).toBe(true);
      expect(session.partyActorIds).toEqual(["actor_scout", "actor_cleric"]);
      expect({ x: session.x, y: session.y }).toEqual({ x: 7, y: 5 });
      expect(session.activePartySetId).toBe("b");
      // 떠난 파티 a 는 떠난 자리(9,1)로 저장된다 — 되부르면 거기서 이어간다.
      expect(session.partySets?.a).toEqual({ actorIds: ["actor_hero"], mapId: project.startMapId, x: 9, y: 1 });
      expect(session.actorVitals.actor_scout).toBeDefined();
    });

    it("recallParty on an unknown set fails without touching the party", () => {
      const project = partyProject();
      const session = startSession(project, 1);
      const before = [...session.partyActorIds];
      const steps = run([{ kind: "recallParty", partySetId: "ghost" }], project, session);
      expect(steps).toEqual([]);
      expect(session.flags.recallPartySuccess).toBe(false);
      expect(session.partyActorIds).toEqual(before);
    });

    it("stores the leaving party under the fallback id when no set was active and drops deleted actors", () => {
      const project = partyProject();
      const session = startSession(project, 1);
      session.partySets = { b: { actorIds: ["actor_mage", "actor_deleted"], mapId: project.startMapId, x: session.x, y: session.y } };
      const result = recallPartySet(project, session, "b");
      expect(result.ok && result.moved).toBe(false);
      expect(session.partyActorIds).toEqual(["actor_mage"]);
      expect(session.partySets?.[PREVIOUS_PARTY_SET_ID]?.actorIds).toEqual(["actor_hero"]);
    });

    it("persists party sets through save/load and the commands through project serialize", () => {
      const project = partyProject();
      project.maps[project.startMapId]!.events.push({
        id: "ev_switch_party", x: 1, y: 1, trigger: { kind: "action" },
        commands: [{ kind: "storeParty", partySetId: "a" }, { kind: "recallParty", partySetId: "b" }],
      });
      const reloaded = deserialize(serialize(project));
      expect(reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_switch_party")!.commands)
        .toEqual([{ kind: "storeParty", partySetId: "a" }, { kind: "recallParty", partySetId: "b" }]);

      const session = startSession(project, 1);
      storePartySet(session, "a");
      const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
      expect(restored.partySets).toEqual(session.partySets);
      expect(restored.activePartySetId).toBe("a");
    });
  });
});

describe("persistedMessageSettings", () => {
  isolateTimers();
  describe('persisted M2 display text settings',()=>{
   it('applies authored settings to the following dialogue instead of resetting them',()=>{
    const s=session();
    const settings={format:'transparent',position:'top',preventObscuringPlayer:false,allowEventMovementDuringWait:true};
    const i=createInterpreter([
     {kind:'m2Command',commandId:'m2-002-display-text-settings',fields:settings},
     {kind:'text',body:'probe'},
    ],s);
    expect(i.start()).toMatchObject({kind:'text',settings});
   });
   it('uses safe defaults when legacy fields are absent or invalid',()=>{
    const s=session();
    const i=createInterpreter([
     {kind:'m2Command',commandId:'m2-002-display-text-settings',fields:{format:'invalid',position:'invalid'}},
     {kind:'text',body:'probe'},
    ],s);
    expect(i.start()).toMatchObject({kind:'text',settings:DEFAULT_MESSAGE_WINDOW_SETTINGS});
   });
  });
});

describe("playerCheckpointKeepsProgress", () => {
  isolateTimers();
  describe("map-entry checkpoint retry keeps progress (J58)", () => {
    it("moves back to the entry spot but keeps what was gained after the checkpoint", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const switchId = project.switches[0]!.id;
      const at = { mapId: session.currentMapId, x: session.x, y: session.y };
      createInterpreter([{ kind: "checkpointSave", label: MAP_ENTRY_CHECKPOINT_LABEL }], session, project).start();
      session.switches[switchId] = true;
      createInterpreter([{ kind: "killPlayer", message: "붙잡혔다" }], session, project).start();
      const restored = restoreSessionCheckpoint(project, session)!;
      expect(restored.switches[switchId]).toBe(true);
      expect({ mapId: restored.currentMapId, x: restored.x, y: restored.y }).toEqual(at);
      expect(restored.actorVitals[restored.partyActorIds[0]!]!.hp).toBeGreaterThan(0);
      expect(getSessionCheckpoint(restored)).toBe(getSessionCheckpoint(session));
    });
    it("an unlabeled checkpoint still restores the full snapshot", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const switchId = project.switches[0]!.id;
      createInterpreter([{ kind: "checkpointSave" }], session, project).start();
      session.switches[switchId] = true;
      expect(restoreSessionCheckpoint(project, session)!.switches[switchId]).toBeFalsy();
    });
  });
});

/**
 * presentItem — 「NPC 에게 증거를 들이민다」 명령.
 *
 * 추리 게임 도그푸딩에서 choices + 아이템 소지 조건으로 흉내만 내던 동작을 엔진 명령으로
 * 만들었다. 인터프리터는 소지한 후보만 목록에 올리고, 고른 itemId 로 재개되면
 * 맞는 option → 그 branch, 후보지만 틀린 것 → otherwiseBranch, 닫음·후보 없음 → cancelBranch.
 */
describe("presentItemCommand", () => {
  isolateTimers();
  function mkSession(inventory: Record<string, number>): PlaySessionLike {
    return {
      flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: { ...inventory },
      partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
      currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
    } as unknown as PlaySessionLike;
  }
  const say = (body: string): Command => ({ kind: "text", body });
  function presentCommand(overrides: Partial<Extract<Command, { kind: "presentItem" }>> = {}): Command {
    return {
      kind: "presentItem",
      prompt: "무엇을 보여줄까?",
      options: [{ itemId: "knife", branch: [say("그 칼은…!")] }],
      otherwiseBranch: [say("그게 무슨 상관이죠?")],
      cancelBranch: [say("할 말 없으면 가세요.")],
      ...overrides,
    };
  }
  /** 첫 정지에서 목록을 보고, value 로 재개한 뒤 이어지는 대사를 모은다. */
  function run(command: Command, inventory: Record<string, number>, value: string | undefined) {
    const session = mkSession(inventory);
    const interp = createInterpreter([command, say("끝")], session);
    const first = interp.start();
    const bodies: string[] = [];
    let step = first.kind === "presentItem" ? interp.resume(value) : first;
    while (step.kind === "text") {
      bodies.push(step.body);
      step = interp.resume(undefined);
    }
    return { first, bodies, session, last: step };
  }
  describe("presentItem 인터프리터", () => {
    it("소지한 후보만 목록에 올리고 prompt 를 함께 낸다", () => {
      const { first } = run(presentCommand({ itemIds: ["knife", "letter", "ring"] }), { knife: 1, ring: 2, potion: 5 }, undefined);
      expect(first).toMatchObject({
        kind: "presentItem",
        prompt: "무엇을 보여줄까?",
        items: [{ itemId: "knife", count: 1 }, { itemId: "ring", count: 2 }],
      });
    });

    it("itemIds 를 생략하면 소지품 전체가 후보다", () => {
      const { first } = run(presentCommand(), { knife: 1, potion: 3, empty: 0 }, undefined);
      expect(first.kind === "presentItem" && first.items.map((item) => item.itemId)).toEqual(["knife", "potion"]);
    });

    it("맞는 아이템을 내면 그 option 의 branch 를 실행하고 뒤로 이어간다", () => {
      const { bodies, session } = run(presentCommand(), { knife: 1, potion: 1 }, "knife");
      expect(bodies).toEqual(["그 칼은…!", "끝"]);
      expect(session.inventory.knife).toBe(1);
    });

    it("후보지만 틀린 아이템을 내면 otherwiseBranch", () => {
      const { bodies } = run(presentCommand(), { knife: 1, potion: 1 }, "potion");
      expect(bodies).toEqual(["그게 무슨 상관이죠?", "끝"]);
    });

    it("닫으면 cancelBranch", () => {
      const { bodies } = run(presentCommand(), { knife: 1 }, undefined);
      expect(bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
    });

    it("소지하지 않았거나 후보가 아닌 아이템 id 로 재개하면 취소로 본다", () => {
      expect(run(presentCommand(), { potion: 1 }, "knife").bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
      expect(run(presentCommand({ itemIds: ["knife"] }), { knife: 1, potion: 1 }, "potion").bodies)
        .toEqual(["할 말 없으면 가세요.", "끝"]);
    });

    it("보여줄 후보가 없으면 빈 목록으로 멈추고, 닫으면 cancelBranch", () => {
      const { first, bodies } = run(presentCommand({ itemIds: ["knife"] }), { potion: 1 }, undefined);
      expect(first).toMatchObject({ kind: "presentItem", items: [] });
      expect(bodies).toEqual(["할 말 없으면 가세요.", "끝"]);
    });

    it("consume 이면 맞는 아이템만 1개 소모한다", () => {
      expect(run(presentCommand({ consume: true }), { knife: 2 }, "knife").session.inventory.knife).toBe(1);
      expect(run(presentCommand({ consume: true }), { knife: 1, potion: 1 }, "potion").session.inventory.potion).toBe(1);
    });

    it("분기를 비워도 다음 명령으로 넘어간다", () => {
      const { bodies } = run({ kind: "presentItem", options: [{ itemId: "knife", branch: [] }] }, { knife: 1, potion: 1 }, "potion");
      expect(bodies).toEqual(["끝"]);
    });
  });
});

describe("selfSwitch", () => {
  isolateTimers();
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
});
