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
  "indexedDB",
  "openDatabase(",
  "sqlite",
  "sql.js",
  "better-sqlite",
  "createSupabaseFallbackProject",
  "supabaseRecoveredHouseTemplateProject",
] as const;

function forbiddenLocalDbReferences(text: string): readonly string[] {
  const source = text.includes("indexedDB")
    ? ts.createSourceFile("runtime.ts", text, ts.ScriptTarget.Latest, true)
    : null;
  const usesIndexedDb = (node: ts.Node): boolean => {
    if ((ts.isIdentifier(node) || ts.isStringLiteralLike(node)) && node.text === "indexedDB") {
      // A capability check cannot read or write project data. Every actual access,
      // including aliases and computed property access, remains forbidden here.
      return !(ts.isIdentifier(node) && ts.isTypeOfExpression(node.parent));
    }
    return ts.forEachChild(node, usesIndexedDb) ?? false;
  };
  return forbiddenRuntimePatterns.filter((pattern) =>
    pattern === "indexedDB" ? source !== null && usesIndexedDb(source) : text.includes(pattern),
  );
}

describe("렌더러는 로컬 DB 를 열지 않는다 — 정본 SQLite 는 electron/local-store 가 연다", () => {
  it("옛 로컬 DB 구현 파일이 남아 있지 않다", async () => {
    const fs = await loadFs();

    for (const path of removedLocalDbFiles) {
      expect(fs.existsSync(path), `${path} should not exist`).toBe(false);
    }
  });

  it("렌더러 소스가 IndexedDB·SQLite·로컬 JSON 폴백에 접근하지 않는다", async () => {
    const fs = await loadFs();
    const files = runtimeSourceRoots.flatMap((root) => sourceFiles(fs, root));
    const offenders: string[] = [];

    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenLocalDbReferences(text)) offenders.push(`${file}: ${pattern}`);
    }

    expect(offenders).toEqual([]);
  });

  it("가능성 검사(typeof indexedDB)는 허용하되 로컬 프로젝트 DB 접근은 허용하지 않는다", () => {
    expect(forbiddenLocalDbReferences('const available = typeof indexedDB !== "undefined";')).toEqual([]);
  });

  it.each([
    'indexedDB.open("project");',
    'typeof indexedDB !== "undefined" && indexedDB.open("project");',
    'const factory = indexedDB; factory.open("project");',
    'window.indexedDB.open("project");',
    'globalThis["indexedDB"].open("project");',
    'globalThis[`indexedDB`].open("project");',
  ])("rejects actual local database access: %s", (source) => {
    expect(forbiddenLocalDbReferences(source)).toContain("indexedDB");
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
