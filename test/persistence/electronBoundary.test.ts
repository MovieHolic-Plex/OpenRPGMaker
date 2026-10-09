import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_SOURCE_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
const SOURCE_FILE = /\.(ts|tsx|mts|cts|js|mjs|cjs)$/;

const SQLITE_DRIVER_TOKENS = ["node:sqlite", "better-sqlite3", "sql.js", "sqlite3"] as const;
const SQLITE_ALLOWED_PREFIX = "electron/local-store/";

const ELECTRON_TO_SRC_ALLOWLIST = [
  "src/brand.ts",
  "src/project/types",
  "src/project/persistence/core",
] as const;

const SRC_TO_ELECTRON_ALLOWLIST = ["electron/shared/"] as const;

export function importSources(text: string): readonly string[] {
  return [...text.matchAll(IMPORT_SOURCE_PATTERN)].map((match) => match[1] ?? "");
}

export function sqliteDriverImports(text: string): readonly string[] {
  return importSources(text).filter((source) => SQLITE_DRIVER_TOKENS.some((token) => source.includes(token)));
}

export function resolveSpecifier(file: string, specifier: string): string {
  return normalize(join(dirname(file), specifier));
}

function sourceFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (entry.isFile() && SOURCE_FILE.test(entry.name)) files.push(path);
  }
  return files;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

describe("storage boundary policy", () => {
  it("렌더러(src)는 SQLite 드라이버를 부르지 않는다", () => {
    const offenders = sourceFiles("src").flatMap((file) =>
      sqliteDriverImports(read(file)).map((source) => `${file}: ${source}`));

    expect(offenders).toEqual([]);
    expect(sqliteDriverImports('import { DatabaseSync } from "node:sqlite";')).toEqual(["node:sqlite"]);
    expect(sqliteDriverImports('const m = await import("better-sqlite3");')).toEqual(["better-sqlite3"]);
  });

  it("electron 에서 SQLite 드라이버를 부르는 곳은 local-store 하나뿐이다", () => {
    const offenders = sourceFiles("electron").flatMap((file) =>
      sqliteDriverImports(read(file))
        .filter(() => !file.startsWith(SQLITE_ALLOWED_PREFIX))
        .map((source) => `${file}: ${source}`));

    expect(offenders).toEqual([]);
    expect(sourceFiles("electron").some((file) => file.startsWith(SQLITE_ALLOWED_PREFIX))).toBe(true);
  });

  it("electron 은 src 에서 core·project types·brand 만 가져온다", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("electron")) {
      for (const source of importSources(read(file))) {
        const resolved = source.startsWith(".") ? resolveSpecifier(file, source) : source;
        if (!resolved.startsWith("src/")) continue;
        const normalized = resolved.replace(/\.ts$/, "");
        if (ELECTRON_TO_SRC_ALLOWLIST.some((allowed) => normalized === allowed || normalized.startsWith(`${allowed}/`))) continue;
        offenders.push(`${file}: ${source} -> ${resolved}`);
      }
    }

    expect(offenders).toEqual([]);
    expect(sourceFiles("electron").some((file) => sqliteDriverImports(read(file)).length === 0)).toBe(true);
  });

  it("src 는 electron/shared 밖을 import 하지 않는다", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      for (const source of importSources(read(file))) {
        if (!source.includes("electron/")) continue;
        if (SRC_TO_ELECTRON_ALLOWLIST.some((allowed) => source.includes(allowed))) continue;
        offenders.push(`${file}: ${source}`);
      }
    }

    expect(offenders).toEqual([]);
    expect('import { channels } from "./electron/local-store/store";'.includes(SRC_TO_ELECTRON_ALLOWLIST[0])).toBe(false);
  });

  it("렌더러 어댑터 파일 이름에는 sqlite 가 없다", () => {
    const offenders = sourceFiles("src/project/persistence").filter((file) => file.toLowerCase().includes("sqlite"));

    expect(offenders).toEqual([]);
    expect(sourceFiles("src/project/persistence").length).toBeGreaterThan(0);
  });

  it("electron 소스가 실제로 존재한다", () => {
    const files = sourceFiles("electron");
    expect(files.length).toBeGreaterThan(0);
    expect(statSync("electron/local-store").isDirectory()).toBe(true);
  });

  it("shared layer stands alone — no node:, src, or electron imports", () => {
    const offenders = sourceFiles("electron/shared").flatMap((file) =>
      importSources(read(file))
        .filter((source) => source.startsWith("node:") || source.includes("electron/") || source.startsWith("../") || source.includes("/src/"))
        .map((source) => `${file}: ${source}`));

    expect(offenders).toEqual([]);
    expect(sourceFiles("electron/shared").length).toBeGreaterThan(0);
  });
});
