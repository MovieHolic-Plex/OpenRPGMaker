// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { isDatabaseUxVisible, uxLevel } from "@/editor/panels/databaseUxLevel";

describe("databaseUxLevel", () => {
  afterEach(() => resetEditorUiModeForTests());

  it("marks nodes with data-db-ux", () => {
    const node = uxLevel(document.createElement("div"), "advanced");
    expect(node.dataset.dbUx).toBe("advanced");
  });

  it("answers visibility per editor mode", () => {
    const table = { beginner: [false, false, true], standard: [true, false, true], expert: [true, true, false] } as const;
    for (const [mode, [advanced, expert, guide]] of Object.entries(table)) {
      resetEditorUiModeForTests(mode as "beginner" | "standard" | "expert");
      expect([isDatabaseUxVisible("advanced"), isDatabaseUxVisible("expert"), isDatabaseUxVisible("guide")]).toEqual([advanced, expert, guide]);
    }
  });

  it("CSS hides exactly the levels the helper reports as invisible", () => {
    const css = readFileSync("src/styles/database/modern/monster-ux.css", "utf8");
    for (const [mode, level] of [["beginner", "advanced"], ["beginner", "expert"], ["standard", "expert"], ["expert", "guide"]]) {
      expect(css).toContain(`body.editor-ui-${mode} [data-db-ux="${level}"]`);
    }
    expect(css).not.toContain('body.editor-ui-beginner [data-db-ux="guide"]');
    expect(readFileSync("src/styles/database/index.css", "utf8")).toContain('@import "./modern/monster-ux.css" layer(database);');
  });
});
