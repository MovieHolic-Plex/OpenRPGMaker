import { describe, expect, it } from "vitest";
import { COMMAND_GUARANTEES } from "@/project/commandGuaranteeRegistry";
import type { Command } from "@/project/types";
import {
  commandRuntimeSupport,
  commandRuntimeSupportDescriptor,
  m2CommandRuntimeSupport,
} from "@/project/eventCommands/runtimeSupport";

describe("completed battle event support", () => {
  it.each(["text", "changeFace", "displayTextSettings", "wait", "inputWait"] as const)(
    "exposes verified native %s behavior without the obsolete limitation",
    (kind) => {
      expect(COMMAND_GUARANTEES[kind].supportByContext.troop).toBe("full");
      expect(commandRuntimeSupportDescriptor({ kind }, "troop")).toEqual({
        support: "runtime-full",
      });
    },
  );

  it.each([
    "m2-001-show-text",
    "m2-002-display-text-settings",
    "m2-003-change-faceset",
    "m2-060-wait",
    "m2-067-key-input-processing",
  ])("does not promote unverified persisted alias %s", (commandId) => {
    expect(m2CommandRuntimeSupport(commandId, "troop")).toBe("runtime-partial");
  });
});

describe.each(["map", "common"] as const)("system cue support in %s", (context) => {
  it.each([
    ["m2-027-change-system-bgm", "battle"],
    ["m2-027-change-system-bgm", "victory"],
    ["m2-028-change-system-se", "confirm"],
    ["m2-028-change-system-se", "buzzer"],
  ] as const)("classifies the explicit %s/%s cue by its actual consumer", (commandId, cue) => {
    const command: Command = {
      kind: "m2Command",
      commandId,
      fields: { cue, resourceId: "qa_audio", volume: 37 },
    };
    expect(commandRuntimeSupport(command, context)).toBe("runtime-full");
    expect(commandRuntimeSupportDescriptor(command, context)).toEqual({
      support: "runtime-full",
    });
    expect(commandRuntimeSupport(command, "troop")).toBe("runtime-partial");
  });

  it.each([
    ["m2-027-change-system-bgm", undefined],
    ["m2-028-change-system-se", undefined],
    ["m2-027-change-system-bgm", "confirm"],
    ["m2-028-change-system-se", "battle"],
  ] as const)("retains the legacy limitation for %s with cue %s", (commandId, cue) => {
    const command: Command = {
      kind: "m2Command",
      commandId,
      fields: { ...(cue === undefined ? {} : { cue }), resourceId: "qa_audio" },
    };
    expect(commandRuntimeSupportDescriptor(command, context)).toMatchObject({
      support: "runtime-partial",
      reasonCode: "system-audio-metadata-only",
    });
  });
});
