import { describe, expect, it } from "vitest";
import { PROJECT_TOOLS } from "@/editor/tools/projectTools";
import { createBlankProject } from "@/project/defaults";
import { FONT_ROLES, fontOptionsForRole } from "@/project/fontRegistry";
import type { JsonSchema } from "@/editor/tools/types";

const settings = PROJECT_TOOLS.find(tool => tool.name === "set_project_settings")!;

describe("project font tool provider contract", () => {
  it("does not send empty enum members that prevent Gemini from starting any tool call", () => {
    const visit = (schema: JsonSchema): void => {
      expect(schema.enum).not.toContain("");
      for (const child of Object.values(schema.properties ?? {})) visit(child);
      for (const child of schema.oneOf ?? []) visit(child);
      if (schema.items) visit(schema.items);
    };
    visit(settings.parameters);
  });

  it("preserves role validation and the empty-string reset at execution", () => {
    const project = createBlankProject();
    settings.run(project, { fonts: { ui: "galmuri11", pixel: "galmuri9", mono: "neodgm" } });
    settings.run(project, { fonts: { ui: "" } });
    expect(project.system.fonts).toEqual({ pixel: "galmuri9", mono: "neodgm" });
    for (const role of FONT_ROLES) {
      const before = structuredClone(project.system.fonts);
      expect(() => settings.run(project, { fonts: { [role]: "unknown-font" } })).toThrow();
      expect(project.system.fonts).toEqual(before);
      const unsuitable = ["system-sans", "system-serif", "system-mono"].find(id => !fontOptionsForRole(role).some(font => font.id === id));
      if (unsuitable) expect(() => settings.run(project, { fonts: { [role]: unsuitable } })).toThrow();
    }
  });
});
