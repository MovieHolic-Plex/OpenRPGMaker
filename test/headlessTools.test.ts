import { describe, expect, it } from "vitest";
import { allTools } from "@/editor/tools/toolRegistry";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import {
  isHeadlessPackagePath,
  listHeadlessMcpTools,
  listHeadlessTools,
  loadHeadlessProject,
  loadHeadlessProjectFromPackage,
  runHeadlessTool,
} from "@/headless";

describe("headless tool runner", () => {
  it("loads project JSON through deserialize validation", () => {
    const project = createScarloxyDemoProject();
    const loaded = loadHeadlessProject(JSON.stringify(project));
    expect(loaded.meta.title).toBe(project.meta.title);
    expect(Object.keys(loaded.maps)).toEqual(Object.keys(project.maps));
  });

  // 헤드리스 CLI/MCP 가 --project 로 받는 패키지 판정. 현재 확장자 .oprn 이 우선이고 옛 .rpgzzu 도 계속 연다.
  it("treats .oprn as the package extension and still accepts legacy .rpgzzu", () => {
    expect(isHeadlessPackagePath("/tmp/game.oprn")).toBe(true);
    expect(isHeadlessPackagePath("/tmp/legacy.rpgzzu")).toBe(true);
    expect(isHeadlessPackagePath("/tmp/Game.OPRN")).toBe(true);
    expect(isHeadlessPackagePath("/tmp/project.json")).toBe(false);
    expect(isHeadlessPackagePath("/tmp/game.oprn.json")).toBe(false);
  });

  it("names the current package extension when a package lacks project.json", () => {
    expect(() => loadHeadlessProjectFromPackage(new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])))
      .toThrow(/\.oprn/);
  });

  it("exposes every registry tool with accurate read/write mode metadata", () => {
    const headlessTools = listHeadlessTools();
    expect(headlessTools).toHaveLength(allTools().length);
    for (const tool of allTools()) {
      expect(headlessTools.find((entry) => entry.name === tool.name)).toMatchObject({
        name: tool.name,
        mode: tool.mode,
        parameters: tool.parameters,
      });
    }

    const mcpTools = listHeadlessMcpTools();
    expect(mcpTools).toHaveLength(allTools().length);
    for (const tool of allTools()) {
      const listed = mcpTools.find((entry) => entry.name === tool.name);
      expect(listed?.inputSchema).toBe(tool.parameters);
      if (tool.mode === "write") expect(listed?.description).toContain("[dry-run only]");
      else expect(listed?.description).not.toContain("[dry-run only]");
    }
  });

  it("runs write tools as dry-run diff only and preserves the original project", () => {
    const project = createScarloxyDemoProject();
    const before = JSON.stringify(project);
    const result = runHeadlessTool(project, "create_map", { name: "헤드리스 실험", width: 12, height: 10 });

    expect(result.ok).toBe(true);
    expect(result.diff?.mapsAdded).toBe(1);
    expect(result.data).toBeUndefined();
    expect(JSON.stringify(project)).toBe(before);
  });

  it("new headless surfaces do not import write commit or remote transport paths", async () => {
    const fsModule = "node:fs";
    const pathModule = "node:path";
    const fs = (await import(fsModule)) as {
      readFileSync(path: string, encoding: "utf8"): string;
      readdirSync(path: string, options?: { withFileTypes?: false }): string[];
      statSync(path: string): { isDirectory(): boolean };
    };
    const path = (await import(pathModule)) as {
      join(...segments: string[]): string;
    };
    const targets = [
      ...collectFiles(fs, path, "src/headless"),
      "scripts/oprn-tools.mjs",
      "scripts/oprn-mcp-server.mjs",
    ];
    const forbidden = [
      /import\s+.*applyChangesetToStore/,
      /import\s+.*commitChangeset/,
      /import\s+.*legacyDb/i,
      /from\s+["'][^"']*legacyDb[^"']*["']/i,
    ];

    for (const target of targets) {
      const source = fs.readFileSync(target, "utf8");
      const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line)).join("\n");
      for (const pattern of forbidden) {
        expect(importLines, target).not.toMatch(pattern);
      }
    }
  });
});

function collectFiles(
  fs: {
    readdirSync(path: string, options?: { withFileTypes?: false }): string[];
    statSync(path: string): { isDirectory(): boolean };
  },
  path: { join(...segments: string[]): string },
  root: string
): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root)) {
    const fullPath = path.join(root, entry);
    if (fs.statSync(fullPath).isDirectory()) files.push(...collectFiles(fs, path, fullPath));
    else files.push(fullPath);
  }
  return files;
}
