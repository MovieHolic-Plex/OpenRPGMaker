import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { parseBattleCommandCss, mountBattleCommandCss } from "@/project/battleCommandCss";
import { Window } from "happy-dom";

describe("authored battle command CSS", () => {
  it("preserves CSS through the public project save and load boundary", () => {
    const project = createBlankProject();
    const css = ".command { color: #123456; border-radius: 8px; }";
    const authored = { ...project, system: { ...project.system, battleCommandCss: css } };
    const restored = deserialize(serialize(authored));
    expect(restored.system).toMatchObject({ battleCommandCss: css });
  });
  it("keeps legacy projects free of overrides", () => {
    expect(deserialize(serialize(createBlankProject())).system.battleCommandCss).toBeUndefined();
  });
  it.each([
    "body { color: red; }", ".command, body { color: red; }",
    "@import 'https://example.com/a.css';", ".command { position: fixed; }",
    ".command { background-color: url(https://example.com); }",
    ".command { color: var(--outside); }", ".command { color: red !important; }",
    ".command { color: red; } </style><script>alert(1)</script>",
    ".command { color: r\\65 d; }", ".command { color: red;",
    "x".repeat(8001),
  ])("rejects CSS outside the menu dialect: %s", (css) => {
    expect(parseBattleCommandCss(css).ok).toBe(false);
  });
  it("accepts colors, focus states and independent blocks", () => {
    expect(parseBattleCommandCss("/* sample */ .command { color: rgba(20, 40, 60, 0.8); } .command:focus-visible { border-color: #abcdef; }")).toMatchObject({
      ok: true, rules: [
        { selector: ".battle-command", declarations: "color: rgba(20, 40, 60, 0.8) !important;" },
        { selector: ".battle-command:focus-visible", declarations: "border-color: #abcdef !important;" },
      ],
    });
  });
  it("rejects non-string persisted CSS at the import boundary", () => {
    const project = createBlankProject();
    expect(() => deserialize(JSON.stringify({ ...project, system: { ...project.system, battleCommandCss: 42 } }))).toThrow();
  });
  it("isolates two mounted menus and removes overrides on reset", () => {
    const window = new Window();
    vi.stubGlobal("document", window.document);
    try {
      const first = document.createElement("section");
      const second = document.createElement("section");
      mountBattleCommandCss(first, ".command { color: #123456; }");
      mountBattleCommandCss(second, ".command { color: #abcdef; }");
      const firstScope = first.dataset.commandCssScope;
      const secondScope = second.dataset.commandCssScope;
      expect(firstScope).not.toBe(secondScope);
      expect(first.querySelector("style")?.textContent).toContain(`[data-command-css-scope="${firstScope}"] .battle-command`);
      expect(second.querySelector("style")?.textContent).not.toContain(firstScope);
      mountBattleCommandCss(first, ".command { color: red; }");
      expect(first.querySelectorAll("style")).toHaveLength(1);
      mountBattleCommandCss(first, "");
      expect(first.querySelectorAll("style")).toHaveLength(0);
      expect(second.querySelectorAll("style")).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
