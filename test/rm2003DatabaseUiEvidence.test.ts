import { describe, expect, it } from "vitest";

type FsReader = {
  readonly existsSync: (path: string) => boolean;
  readonly readFileSync: (path: string, encoding: "utf8") => string;
};

const loadFs = async (): Promise<FsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsReader;
};

const matrixPath = ".omo/evidence/rm2003-database-plan/db-ui-coverage-matrix.md";
const captureScriptPath = ".omo/evidence/rm2003-database-plan/capture-db-ui.mjs";
const viteConfigPath = "vite.config.ts";

const requiredManualPages = [
  "Database Settings",
  "Actors",
  "Classes",
  "Skills",
  "Items",
  "Enemy Battlers",
  "Enemy Troops",
  "Elements",
  "States",
  "Battle Animation",
  "Battle Animation 2",
  "Battle Screen",
  "Terrain",
  "Tilesets",
  "Terms",
  "System",
  "System 2",
  "Common Events",
  "Supplementary Windows",
] as const;

describe("RM2003 database UI evidence plan", () => {
  it("covers every Haylee Database manual page in the UI matrix", async () => {
    const { existsSync, readFileSync } = await loadFs();
    expect(existsSync(matrixPath)).toBe(true);

    const matrix = readFileSync(matrixPath, "utf8");

    for (const page of requiredManualPages) {
      expect(matrix, `${page} should be represented`).toContain(`| ${page} |`);
    }
  });

  it("provides an executable screenshot harness for post-change browser evidence", async () => {
    const { existsSync, readFileSync } = await loadFs();
    expect(existsSync(captureScriptPath)).toBe(true);

    const script = readFileSync(captureScriptPath, "utf8");

    expect(script).toContain("post-db-actors.png");
    expect(script).toContain("post-mobile-db-tabs.png");
    expect(script).toContain("VITE_WATCH_GUARD");
  });

  it("keeps evidence artifacts out of the Vite file watcher on Windows", async () => {
    const { readFileSync } = await loadFs();
    const config = readFileSync(viteConfigPath, "utf8");

    expect(config).toContain("watch");
    expect(config).toContain("**/.omo/**");
  });
});
