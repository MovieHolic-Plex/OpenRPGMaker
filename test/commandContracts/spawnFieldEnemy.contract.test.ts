import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands } from "./harness";

describe("spawnFieldEnemy interpreter handoff contract", () => {
  it("forwards the spawn definition without executing subsequent commands before host resume", () => {
    const project = createBlankProject();
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
