import { describe, expect, it } from "vitest";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { domTitleViolations, formatDomTitleViolations, scanRuntimeDomTitles } from "../scripts/lib/runtimeDomTitleGuard.mjs";

// Debug-only surfaces are never mounted by a normal export boot (item 3 capability gate).
const QA_ONLY_FILES = new Set(["runtimeDebugPanel.ts"]);

async function shippingRuntimeFiles(): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith(".ts") && !QA_ONLY_FILES.has(entry.name)) files.push(path);
    }
  };
  await walk("src/player");
  return files;
}

describe("shipping runtime native title tooltips", () => {
  it("no player runtime module writes a DOM title attribute", async () => {
    const violations = await scanRuntimeDomTitles(await shippingRuntimeFiles());
    expect(formatDomTitleViolations(violations)).toBe("");
  });

  it("reports file, line, and form so the failure is actionable", () => {
    const message = formatDomTitleViolations(domTitleViolations("button.title = reason;", "src/player/x.ts"));
    expect(message).toContain("src/player/x.ts:1");
    expect(message).toContain("property-write");
    expect(message).toContain("aria-label");
  });

  it("flags every DOM write form", () => {
    expect(domTitleViolations("button.title = reason;").map((v) => v.kind)).toEqual(["property-write"]);
    expect(domTitleViolations('node.setAttribute("title", name);').map((v) => v.kind)).toEqual(["set-attribute"]);
    expect(domTitleViolations('el("span", { attrs: { title: name } });').map((v) => v.kind)).toEqual([
      "attribute-bag",
    ]);
  });

  it("does not flag data-model fields or reads named title", () => {
    expect(domTitleViolations("expect(text.title).toBe(terms.innTitle);")).toEqual([]);
    expect(domTitleViolations("return { title: terms.innTitle, note };")).toEqual([]);
    expect(domTitleViolations('const command = { kind: "ending", title: name, message };')).toEqual([]);
    expect(domTitleViolations("if (entry.title === \"Comment\") return true;")).toEqual([]);
    expect(domTitleViolations("const title = document.createElement(\"div\");")).toEqual([]);
    // The browser tab title is not an element tooltip.
    expect(domTitleViolations("document.title = project.meta.title;")).toEqual([]);
  });
});
