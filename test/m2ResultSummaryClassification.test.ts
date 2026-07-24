import { describe, expect, it } from "vitest";
import { m2CommandRuntimeSupport, battleEventCommandRuntimeSupport } from "@/editor/eventCommands/runtimeSupport";

describe("m2-109-result-summary 분류", () => {
  it("미분류 예외 없이 editor-only로 분류된다", () => {
    expect(m2CommandRuntimeSupport("m2-109-result-summary")).toBe("editor-only");
    expect(battleEventCommandRuntimeSupport({ kind: "m2Command", commandId: "m2-109-result-summary", fields: {} })).toBe("editor-only");
  });
});
