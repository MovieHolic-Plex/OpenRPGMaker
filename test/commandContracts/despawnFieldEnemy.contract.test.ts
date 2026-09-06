import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands } from "./harness";

describe("despawnFieldEnemy interpreter handoff contract", () => {
  it.each(["spawn_contract", ""])("forwards spawn identity %s and awaits host resume", (spawnId) => {
    const project = createBlankProject();
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
