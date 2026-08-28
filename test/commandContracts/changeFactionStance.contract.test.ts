import { describe, expect, it, vi } from "vitest";
import { effectiveFactionStance } from "@/project/factionRuntime";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands, runCommandContract } from "./harness";

describe("changeFactionStance 계약", () => {
  it("절대 설정과 증감이 같은 세션 오버레이에 누적된다", () => {
    const result = runCommandContract([
      { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "=", value: 1 },
      { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "-=", value: 2 },
    ], {
      mutateProject: (project) => {
        project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
      },
    });
    const table = resolveFactionTable({ defs: [{ id: "guard", name: "경비병" }], relations: [] });
    expect(effectiveFactionStance(table, result.session.factionStanceOverrides, "guard", PLAYER_FACTION_ID)).toBe(-1);
    expect(result.finished).toBe(true);
    expect(result.pauses).toEqual([]);
  });

  it("범위를 벗어난 값은 -2..2로 클램프한다", () => {
    const result = runCommandContract([
      { kind: "changeFactionStance", a: "enemy", b: PLAYER_FACTION_ID, op: "=", value: 99 },
    ]);
    const table = resolveFactionTable(undefined);
    expect(effectiveFactionStance(table, result.session.factionStanceOverrides, "enemy", PLAYER_FACTION_ID)).toBe(2);
  });

  it("invalidates live target selection immediately after changing a stance", () => {
    const onFactionStanceChanged = vi.fn();
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
    const session = createContractSession(project);
    const interpreter = createInterpreter([
      { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "=", value: -1 },
    ], session, project, { onFactionStanceChanged });

    expect(interpreter.start()).toEqual({ kind: "done" });
    expect(onFactionStanceChanged).toHaveBeenCalledTimes(1);
  });

  it("serialize→deserialize 왕복에서 명령 셰이프가 보존된다", () => {
    const commands: Command[] = [
      { kind: "changeFactionStance", a: "guard", b: PLAYER_FACTION_ID, op: "+=", value: 0.25 },
    ];
    expect(roundtripCommands(commands, (project) => {
      project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
    })).toEqual(commands);
  });
});
