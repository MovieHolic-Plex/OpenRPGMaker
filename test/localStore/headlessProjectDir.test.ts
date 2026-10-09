import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { initLocalProjectStore } from "../../electron/local-store/store";

const projectDir = mkdtempSync(join(tmpdir(), "oprn-headless-"));

afterAll(() => {
  rmSync(projectDir, { force: true, recursive: true });
});

function runTool(args: readonly string[]): unknown {
  const output = execFileSync("node", ["scripts/oprn-tools.mjs", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output) as unknown;
}

describe("headless tools open a project folder", () => {
  it("--project-dir 로 폴더 프로젝트를 열어 도구를 돌린다", async () => {
    const store = await initLocalProjectStore({ projectDir });
    await store.saveProject(projectWithoutEventDrafts(createScarloxyDemoProject()));
    store.close();

    const result = runTool([
      "--project-dir",
      projectDir,
      "create_map",
      JSON.stringify({ name: "폴더 맵", width: 12, height: 10 }),
    ]) as { readonly ok?: boolean; readonly diff?: { readonly mapsAdded?: number } };

    expect(result.ok).toBe(true);
    expect(result.diff?.mapsAdded).toBe(1);
  }, 180_000);

  it("--list 는 폴더 없이도 그대로 동작한다", () => {
    const listed = runTool(["--list"]) as { readonly tools?: readonly unknown[] };

    expect(Array.isArray(listed.tools)).toBe(true);
    expect((listed.tools ?? []).length).toBeGreaterThan(0);
  }, 180_000);
});
