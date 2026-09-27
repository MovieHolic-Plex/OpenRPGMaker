import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands } from "./harness";

describe("tacticsBattle interpreter handoff contract", () => {
  it("pauses for the host and runs the branch matching the resumed result", () => {
    const project = createBlankProject();
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
