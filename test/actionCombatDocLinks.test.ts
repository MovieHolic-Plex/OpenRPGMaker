import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

describe("openwiki action combat documentation", () => {
  const root = resolve(__dirname, "..");
  const docPath = resolve(root, "openwiki/runtime-action-combat.md");

  it("exists and has substantive size (over 3KB)", () => {
    expect(existsSync(docPath)).toBe(true);
    const content = readFileSync(docPath, "utf-8");
    expect(Buffer.byteLength(content, "utf-8")).toBeGreaterThan(3000);
  });

  it("is linked from AGENTS.md, runtime-and-data.md, runtime-pre-edit-routing.md, and runtime-battle.md", () => {
    const agents = readFileSync(resolve(root, "AGENTS.md"), "utf-8");
    const runtimeAndData = readFileSync(resolve(root, "openwiki/runtime-and-data.md"), "utf-8");
    const preEdit = readFileSync(resolve(root, "openwiki/runtime-pre-edit-routing.md"), "utf-8");
    const runtimeBattle = readFileSync(resolve(root, "openwiki/runtime-battle.md"), "utf-8");

    expect(agents).toContain("openwiki/runtime-action-combat.md");
    expect(runtimeAndData).toContain("runtime-action-combat.md");
    expect(preEdit).toContain("runtime-action-combat.md");
    expect(runtimeBattle).toContain("runtime-action-combat.md");
  });
});
