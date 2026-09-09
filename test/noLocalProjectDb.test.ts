import { describe, expect, it } from "vitest";

type DirentLike = {
  readonly name: string;
  readonly isDirectory: () => boolean;
  readonly isFile: () => boolean;
};

type FsLike = {
  readonly existsSync: (path: string) => boolean;
  readonly readFileSync: (path: string, encoding: "utf8") => string;
  readonly readdirSync: (path: string, options: { readonly withFileTypes: true }) => readonly DirentLike[];
};

const loadFs = async (): Promise<FsLike> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsLike;
};

const runtimeSourceRoots = ["src/project", "src/editor"] as const;
const removedLocalDbFiles = [
  "src/project/defaults/supabaseRecoveredHouseTemplateProject.json",
  "src/project/tileMetadataDbIdb.ts",
  "src/project/tileMetadataDbProject.ts",
  "src/project/tileMetadataDbSchema.ts",
] as const;

const forbiddenRuntimePatterns = [
  "indexedDB",
  "openDatabase(",
  "sqlite",
  "sql.js",
  "better-sqlite",
  "createSupabaseFallbackProject",
  "supabaseRecoveredHouseTemplateProject",
] as const;

// These exact capabilities are not canonical project persistence. The application
// journal retains receipt snapshots, but recovery must never install them as live data
// (behavioral negative controls in aiJobApplication.test.ts). All other uses, including
// another indexedDB expression in either file, remain forbidden.
const indexedDbCapabilities = new Map([
  ["src/editor/aiJobs/applicationRecords.ts", "factory: IDBFactory = indexedDB"],
  ["src/editor/panels/aiChatPanel.ts", 'typeof indexedDB !== "undefined"'],
]);

describe("canonical project persistence has no local DB fallback", () => {
  it("does not keep old local DB implementation files", async () => {
    const fs = await loadFs();

    for (const path of removedLocalDbFiles) {
      expect(fs.existsSync(path), `${path} should not exist`).toBe(false);
    }
  });

  it("permits only the application-journal factory and reload capability check, not a local project DB", async () => {
    const fs = await loadFs();
    const files = runtimeSourceRoots.flatMap((root) => sourceFiles(fs, root));
    const offenders: string[] = [];

    for (const file of files) {
      let text = fs.readFileSync(file, "utf8");
      const capability = indexedDbCapabilities.get(file);
      if (capability) {
        expect(text.split(capability)).toHaveLength(2);
        text = text.replace(capability, "");
      }
      for (const pattern of forbiddenRuntimePatterns) {
        if (text.includes(pattern)) offenders.push(`${file}: ${pattern}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(fs: FsLike, root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...sourceFiles(fs, path));
    } else if (entry.isFile() && /\.(ts|tsx|mts|cts|js|mjs|json)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}
