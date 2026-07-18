import { describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";

describe("editor default layer", () => {
  it("starts on the event layer/tool for event-authoring QA", () => {
    // Module singleton defaults — not reset by tests that only patch partial state.
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });
});
