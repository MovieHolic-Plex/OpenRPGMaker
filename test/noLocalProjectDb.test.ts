import { describe, expect, it } from "vitest";
// typescript 7 (#2396) ships no JS compiler API (`import ts from "typescript"` is only { version }); parse with vite's oxc parser instead.
import { parseSync } from "vite";

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
  "src/project/defaults/projectRecoveredHouseTemplateProject.json",
  "src/project/tileMetadataDbIdb.ts",
  "src/project/tileMetadataDbProject.ts",
  "src/project/tileMetadataDbSchema.ts",
] as const;

// Device-local IndexedDB stores that hold no project data — each is a disposable cache or a per-device library.
// The project's canonical store stays the host SQLite; these are deliberate product features, not project-DB fallbacks.
const deviceCacheFiles: ReadonlySet<string> = new Set([
  "src/project/persistence/tilesetBlobCache.ts", // tileset body cache keyed by SHA-256 (refetched from the host on miss)
  "src/project/sharedContentCache.ts", // shared-content response cache (ETag + parsed snapshot)
  "src/editor/terrainStampLibrary.ts", // per-device terrain stamp library (oprn-terrain-library), shared across projects
  "src/editor/workshop/queue/jobStore.ts", // workshop job queue oprn-workshop-jobs (#3212)
]);

const forbiddenRuntimePatterns = [
  "indexedDB",
  "openDatabase(",
  "sqlite",
  "sql.js",
  "better-sqlite",
  "createLegacyDbFallbackProject",
  "projectRecoveredHouseTemplateProject",
] as const;

type AstNode = { readonly type: string; readonly [key: string]: unknown };

function isAstNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";
}

function usesIndexedDb(node: unknown, parent: AstNode | null): boolean {
  if (Array.isArray(node)) return node.some((child) => usesIndexedDb(child, parent));
  if (!isAstNode(node)) return false;
  if (node.type === "Identifier" && node.name === "indexedDB") {
    // A capability check cannot read or write project data. Every actual access,
    // including aliases and computed property access, remains forbidden here.
    return !(parent?.type === "UnaryExpression" && parent.operator === "typeof");
  }
  if (node.type === "Literal" && node.value === "indexedDB") return true;
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis as readonly { readonly value: { readonly cooked: string | null } }[];
    const expressions = node.expressions as readonly unknown[];
    if (expressions.length === 0 && quasis.length === 1 && quasis[0]?.value.cooked === "indexedDB") return true;
  }
  return Object.entries(node).some(([key, child]) => key !== "parent" && typeof child === "object" && child !== null && usesIndexedDb(child, node));
}

function forbiddenLocalDbReferences(text: string): readonly string[] {
  const program = text.includes("indexedDB") ? parseSync("runtime.ts", text, { lang: "ts" }).program : null;
  // Prose naming the host's canonical file (ontology contracts: "lives in project.sqlite") is not a database driver.
  const driverText = text.replaceAll("project.sqlite", "");
  return forbiddenRuntimePatterns.filter((pattern) =>
    pattern === "indexedDB" ? program !== null && usesIndexedDb(program, null) : driverText.includes(pattern),
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
      if (deviceCacheFiles.has(file)) continue;
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
