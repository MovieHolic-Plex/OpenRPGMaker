import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { createContractSession, roundtripCommands } from "./harness";

describe("openSaveMenu interpreter handoff contract", () => {
  it("pauses before subsequent commands and resumes after the host closes the menu", () => {
    const project = createBlankProject();
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
