import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { commandRuntimeSupportDescriptor } from "@/project/eventCommands/runtimeSupport";
import type { Command } from "@/project/types";
import { createContractSession, roundtripCommands } from "./harness";

describe("playMovie interpreter handoff contract", () => {
  it.each([true, false])("preserves wait=%s and blocks the sentinel until the host resumes", (wait) => {
    const project = createBlankProject();
    const session = createContractSession(project);
    const command: Command = { kind: "playMovie", resourceId: "movie_contract", wait, skippable: false };
    const interpreter = createInterpreter([command, { kind: "setFlag", flag: "after", value: true }], session, project);
    expect(interpreter.start()).toEqual(command);
    expect(session.flags.after).toBeUndefined();
    expect(interpreter.resume()).toEqual({ kind: "done" });
    expect(session.flags.after).toBe(true);
    expect(commandRuntimeSupportDescriptor(command, "troop")).toMatchObject({ reasonCode: "not-executed-in-context" });
  });

  it("retains an empty resource and explicit playback options through project roundtrip", () => {
    const command: Command = { kind: "playMovie", resourceId: "", wait: false, skippable: false };
    expect(roundtripCommands([command])).toEqual([command]);
  });

  it("roundtrips a registered movie and still forwards its non-default playback controls", () => {
    const command: Command = { kind: "playMovie", resourceId: "movie_contract", wait: false, skippable: false };
    const restored = roundtripCommands([command], (project) => {
      project.assets.uploaded.movie_contract = {
        id: "movie_contract", name: "Contract movie", kind: "picture",
        dataUrl: "data:video/webm;base64,GkXfo0AgQoaBAULygQRC", meta: {},
      };
    });
    expect(restored).toEqual([command]);
    const project = createBlankProject();
    const interpreter = createInterpreter(restored, createContractSession(project), project);
    expect(interpreter.start()).toEqual(command);
  });
});
