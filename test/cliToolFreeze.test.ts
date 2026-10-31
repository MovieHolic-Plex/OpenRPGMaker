import { describe, expect, it } from "vitest";
import { CLI_CALL_TOOL, cliListNeedsAnnounce, unwrapCallTool } from "../src/ai/piAgent/cliToolFreeze";

describe("local CLI tool-list freeze", () => {
  it("does not re-announce when tools were only added (they run through call_tool)", () => {
    expect(cliListNeedsAnnounce(["todo", "get_event"], ["todo", "get_event", "upsert_enemy"])).toBe(false);
  });
  it("re-announces when a listed tool is gone (a wholesale swap such as the polish round)", () => {
    expect(cliListNeedsAnnounce(["todo", "get_event"], ["rewrite_dialogue", "lint_dialogue"])).toBe(true);
    expect(cliListNeedsAnnounce([CLI_CALL_TOOL, "todo"], ["todo"])).toBe(false);
  });
  it("unwraps call_tool to the inner tool and strips the CLI prefix", () => {
    expect(unwrapCallTool({ name: "mcp__oprn__upsert_enemy", args: { enemy: { id: "e1" } } })).toEqual({ name: "upsert_enemy", args: { enemy: { id: "e1" } } });
    expect(unwrapCallTool({ name: "get_script_api" })).toEqual({ name: "get_script_api", args: {} });
    expect("error" in unwrapCallTool({ args: {} })).toBe(true);
    expect("error" in unwrapCallTool({ name: CLI_CALL_TOOL, args: {} })).toBe(true);
  });
});
