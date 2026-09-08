import { describe, expect, it } from "vitest";
import ts from "typescript";

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
  "openDatabase(",
  "sqlite",
  "sql.js",
  "better-sqlite",
  "createSupabaseFallbackProject",
  "supabaseRecoveredHouseTemplateProject",
] as const;

describe("canonical project persistence has no local DB fallback", () => {
  it("does not keep old local DB implementation files", async () => {
    const fs = await loadFs();

    for (const path of removedLocalDbFiles) {
      expect(fs.existsSync(path), `${path} should not exist`).toBe(false);
    }
  });

  it("does not reference IndexedDB SQLite or local JSON fallback in runtime source", async () => {
    const fs = await loadFs();
    const files = runtimeSourceRoots.flatMap((root) => sourceFiles(fs, root));
    const offenders: string[] = [];

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("indexedDB")) {
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node): void => {
          // AI records may inspect browser durability; opening/using a local project DB remains forbidden.
          if (((ts.isIdentifier(node) && !ts.isTypeOfExpression(node.parent)) || ts.isStringLiteralLike(node))
            && node.text === "indexedDB") {
            offenders.push(`${file}: indexedDB access`);
          }
          ts.forEachChild(node, visit);
        };
        visit(source);
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
