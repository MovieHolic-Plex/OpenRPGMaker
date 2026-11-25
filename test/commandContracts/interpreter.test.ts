import { describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { freshBlankProject } from "../support/blankProject";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands, buildContractProject, CONTRACT_EVENT_ID, runCommandContract } from "./harness";
import { isolateTimers } from "../mergedTeardown";

describe("despawnFieldEnemy.contract", () => {
  isolateTimers();
  describe("despawnFieldEnemy interpreter handoff contract", () => {
    it.each(["spawn_contract", ""])("forwards spawn identity %s and awaits host resume", (spawnId) => {
      const project = freshBlankProject();
      const session = createContractSession(project);
      const command: Command = { kind: "despawnFieldEnemy", spawnId };
      const interpreter = createInterpreter([command, { kind: "setFlag", flag: "after", value: true }], session, project);
      expect(interpreter.start()).toEqual(command);
      expect(session.flags.after).toBeUndefined();
      expect(interpreter.resume()).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
      expect(roundtripCommands([command])).toEqual([command]);
    });
  });
});

// test/commandContracts/loop.contract.test.ts
// G1 계약: loop (스펙 §5.2 loop/breakLoop 행).
//
// 실측 메모:
// - breakLoop 상호작용은 breakLoop.contract.test.ts 가 이미 고정한다. 이 파일은 loop 자체의
//   반복 프레임, 빈 body 경계, 하네스 maxSteps 안전핀을 다룬다.
describe("loop.contract", () => {
  isolateTimers();
  describe("loop 계약", () => {
    it("정상 효과: loop body 가 반복 실행되고 인터프리터 반복 가드 도달 후 다음 명령으로 진행한다", () => {
      const commands: Command[] = [
        { kind: "loop", body: [{ kind: "setVariable", variableId: "loop_counter", op: "+=", value: 1 }] },
        { kind: "setSwitch", switchId: "after_loop_guard", value: true },
      ];
      const project = buildContractProject(commands);
      const session = createContractSession(project);
      const warnings: string[] = [];
      const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
        warnings.push(args.map((arg) => String(arg)).join(" "));
      });
      try {
        const interpreter = createInterpreter(commands, session, project, {
          currentEventId: CONTRACT_EVENT_ID,
          maxLoopIterations: 3,
        });
        expect(interpreter.start()).toEqual({ kind: "done" });
      } finally {
        warnSpy.mockRestore();
      }

      expect(session.variables.loop_counter).toBe(3);
      expect(session.switches.after_loop_guard).toBe(true);
      expect(warnings.some((message) => message.includes("루프 최대 반복 횟수"))).toBe(true);
    });

    it("경계: 빈 body 는 경고 없이 루프를 건너뛰고 다음 명령으로 진행한다", () => {
      const result = runCommandContract([
        { kind: "loop", body: [] },
        { kind: "setSwitch", switchId: "after_empty_loop", value: true },
      ]);

      expect(result.session.switches.after_empty_loop).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.finished).toBe(true);
    });

    it("무한루프 방지: pause 를 내는 무한 loop 는 하네스 maxSteps 안전핀이 실패시킨다", () => {
      expect(() => runCommandContract([{ kind: "loop", body: [{ kind: "wait", ms: 1 }] }], { maxSteps: 8 }))
        .toThrow(/maxSteps\(8\) 초과/);
    });

    it("왕복 동일성: serialize→deserialize 후 실행해도 빈 loop 경계 결과가 같다", () => {
      const commands: Command[] = [
        { kind: "loop", body: [] },
        { kind: "setSwitch", switchId: "after_loop_roundtrip", value: true },
      ];

      const original = runCommandContract(commands);
      const restoredCommands = roundtripCommands(commands, (project) => {
        project.switches.push({ id: "after_loop_roundtrip", name: "after loop" });
      });
      expect(restoredCommands).toEqual(commands);
      const restored = runCommandContract(restoredCommands);

      expect(restored.session).toEqual(original.session);
    });

    it("pause 의미론: loop 자체는 non-blocking — 빈 body 에서는 pause 가 발생하지 않는다", () => {
      const result = runCommandContract([{ kind: "loop", body: [] }]);

      expect(result.pauses).toEqual([]);
      expect(result.finished).toBe(true);
    });
  });
});

describe("openSaveMenu.contract", () => {
  isolateTimers();
  describe("openSaveMenu interpreter handoff contract", () => {
    it("pauses before subsequent commands and resumes after the host closes the menu", () => {
      const project = freshBlankProject();
      const session = createContractSession(project);
      const interpreter = createInterpreter([
        { kind: "openSaveMenu" }, { kind: "setFlag", flag: "after", value: true },
      ], session, project);
      expect(interpreter.start()).toEqual({ kind: "openSaveMenu" });
      expect(session.flags.after).toBeUndefined();
      expect(interpreter.resume()).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
    });

    it("survives project roundtrip without additional fields", () => {
      expect(roundtripCommands([{ kind: "openSaveMenu" }])).toEqual([{ kind: "openSaveMenu" }]);
    });
  });
});

describe("spawnFieldEnemy.contract", () => {
  isolateTimers();
  describe("spawnFieldEnemy interpreter handoff contract", () => {
    it("forwards the spawn definition without executing subsequent commands before host resume", () => {
      const project = freshBlankProject();
      const session = createContractSession(project);
      const command: Command = { kind: "spawnFieldEnemy", spawn: {
        id: "spawn_contract", troopId: "troop_contract", area: { x: 2, y: 3, w: 4, h: 5 },
      } };
      const interpreter = createInterpreter([command, { kind: "setFlag", flag: "after", value: true }], session, project);
      expect(interpreter.start()).toEqual(command);
      expect(session.flags.after).toBeUndefined();
      expect(interpreter.resume()).toEqual({ kind: "done" });
      expect(session.flags.after).toBe(true);
    });

    it("preserves spawn identity and area through project roundtrip", () => {
      const command: Command = { kind: "spawnFieldEnemy", spawn: {
        id: "spawn_contract", troopId: "", area: { x: 0, y: 0, w: 1, h: 1 },
      } };
      expect(roundtripCommands([command])).toMatchObject([command]);
    });
  });
});

describe("tacticsBattle.contract", () => {
  isolateTimers();
  describe("tacticsBattle interpreter handoff contract", () => {
    it("pauses for the host and runs the branch matching the resumed result", () => {
      const project = freshBlankProject();
      for (const [result, flag] of [["victory", "won"], ["defeat", "lost"]] as const) {
        const session = createContractSession(project);
        const command: Command = {
          kind: "tacticsBattle", troopId: "troop_contract", canLose: true,
          victoryBranch: [{ kind: "setFlag", flag: "won", value: true }],
          defeatBranch: [{ kind: "setFlag", flag: "lost", value: true }],
        };
        const interpreter = createInterpreter([command, { kind: "setFlag", flag: "after", value: true }], session, project);
        expect(interpreter.start()).toEqual({ kind: "tacticsBattle", troopId: "troop_contract", width: undefined, height: undefined, canLose: true });
        expect(session.flags.after).toBeUndefined();
        expect(interpreter.resume(result)).toEqual({ kind: "done" });
        expect(session.flags[flag]).toBe(true);
        expect(session.flags[flag === "won" ? "lost" : "won"]).toBeUndefined();
        expect(session.flags.after).toBe(true);
      }
    });

    it("preserves grid size, canLose and both branches through project roundtrip", () => {
      const command: Command = {
        kind: "tacticsBattle", troopId: "", width: 10, height: 5, canLose: false,
        victoryBranch: [{ kind: "setFlag", flag: "won", value: true }],
        defeatBranch: [],
      };
      // 참조 검증은 troopId 존재를 요구하므로 빈 id 는 적 그룹 하나를 등록해 맞춘다.
      expect(roundtripCommands([command], (project) => {
        project.database.troops.push({ id: "", name: "빈", enemyIds: [], autoAlign: true, battleEventPages: [] });
      })).toMatchObject([command]);
    });
  });
});
