import { describe, expect, it } from "vitest";
import { isDialogueAdvanceKey, resolveDialogueText } from "@/player/dialogue";
import { createBlankProject } from "@/project/defaults";

describe("dialogue keyboard controls", () => {
  it("accepts normalized keyboard-only advance keys", () => {
    expect(isDialogueAdvanceKey("Enter")).toBe(true);
    expect(isDialogueAdvanceKey("ENTER")).toBe(true);
    expect(isDialogueAdvanceKey(" ")).toBe(true);
    expect(isDialogueAdvanceKey("Space")).toBe(true);
    expect(isDialogueAdvanceKey("Escape")).toBe(true);
    expect(isDialogueAdvanceKey("E")).toBe(true);
    expect(isDialogueAdvanceKey("z")).toBe(true);
    expect(isDialogueAdvanceKey("Z")).toBe(true);
    expect(isDialogueAdvanceKey("ArrowDown")).toBe(false);
  });
});

describe("dialogue text codes", () => {
  it("resolves variables, actor names, colors, and escaped backslashes at display time", () => {
    const project = createBlankProject();
    project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
    expect(project.variables[0]?.id).toBe("var_0001");
    const context = {
      session: {
        variables: { var_0001: 42 },
        actorNames: { hero: "Renamed" },
      },
      project,
    };

    expect(resolveDialogueText("Gold \\v[1] / \\n[1] / \\c[2]red / \\\\", context)).toBe("Gold 42 / Renamed / red / \\");
  });

  it("keeps raw-index variable fallback for custom or legacy sessions", () => {
    const project = createBlankProject();
    const context = {
      session: {
        variables: { "1": 7 },
        actorNames: {},
      },
      project,
    };

    expect(resolveDialogueText("\\v[1]", context)).toBe("7");
  });

  it("falls back to database actor names and zero for missing variables", () => {
    const project = createBlankProject();
    project.database.actors = [{ ...project.database.actors[0]!, id: "hero", name: "Hero" }];
    const context = {
      session: { variables: {}, actorNames: {} },
      project,
    };

    expect(resolveDialogueText("\\n[1]:\\v[99]", context)).toBe("Hero:0");
  });
});
