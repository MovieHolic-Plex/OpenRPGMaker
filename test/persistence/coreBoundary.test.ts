import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CORE_DIR = "src/project/persistence/core";
// 렌더러 전용 능력. core 는 메인 프로세스·노드 스크립트에서도 그대로 돌아야 한다.
const FORBIDDEN_TOKENS = ["window.", "document.", "localStorage", "navigator.", "fetch(", "import.meta.env", "XMLHttpRequest"] as const;
// LegacyDb 와 편집기 UI 로 되돌아가는 import.
// "legacyDb" is the needle the dynamic-import case below expects (the public-baseline rename dropped it from this list).
const FORBIDDEN_IMPORTS = ["project-store", "legacyDb", "@/editor", "@/ai", "@/app", "spatial/persistence", "spatial/saveRouting"] as const;

// 정적 import(여러 줄 포함)·부수효과 import·동적 import() 의 모듈 경로를 전부 뽑는다.
const IMPORT_SOURCE_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

/**
 * A global token, not a property (`folded.document.`) or a local binding of the same name
 * (`const document = JSON.parse(...)` in core/foldedProject.ts reads a parsed project document, not the DOM).
 */
export function usesForbiddenToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`(?<![\\w$.])${escaped}`).test(text)) return false;
  const name = /^[A-Za-z_$][\w$]*/.exec(token)?.[0];
  if (!name || !token.endsWith(".")) return true;
  const localBinding = new RegExp(`\\b(?:const|let|var)\\s+${name}\\b|[(,]\\s*${name}\\s*[:,)]`);
  return !localBinding.test(text);
}

export function forbiddenImportSources(text: string): string[] {
  const hits: string[] = [];
  for (const match of text.matchAll(IMPORT_SOURCE_PATTERN)) {
    const source = match[1] ?? "";
    for (const needle of FORBIDDEN_IMPORTS) if (source.includes(needle)) hits.push(`${needle} (${source})`);
  }
  return hits;
}

function coreFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? coreFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("persistence core boundary", () => {
  it("core 디렉터리가 있고 파일이 하나 이상이다", () => {
    expect(existsSync(CORE_DIR)).toBe(true);
    expect(coreFiles(CORE_DIR).length).toBeGreaterThan(0);
  });

  it("core 는 DOM·네트워크·LegacyDb 를 모른다", () => {
    const offenders: string[] = [];
    for (const file of coreFiles(CORE_DIR)) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) if (usesForbiddenToken(text, token)) offenders.push(`${file}: ${token}`);
      for (const hit of forbiddenImportSources(text)) offenders.push(`${file}: import ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("import 스캔은 여러 줄·부수효과·동적 import 를 모두 잡는다", () => {
    expect(forbiddenImportSources('import {\n  a,\n} from "@/editor/x";')).toEqual(["@/editor (@/editor/x)"]);
    expect(forbiddenImportSources('import "@/ai/boot";')).toEqual(["@/ai (@/ai/boot)"]);
    expect(forbiddenImportSources('const m = await import("../../legacyDbProjectSync");')).toEqual(["legacyDb (../../legacyDbProjectSync)"]);
    expect(forbiddenImportSources('import { serialize } from "../../io";\nexport * from "./canonicalJson";')).toEqual([]);
  });

  it("토큰 스캔은 전역 접근만 잡고 같은 이름의 지역 값·속성은 넘긴다", () => {
    expect(usesForbiddenToken("document.body.append(x);", "document.")).toBe(true);
    expect(usesForbiddenToken("const x = window.location;", "window.")).toBe(true);
    expect(usesForbiddenToken("const document = JSON.parse(text);\ndocument.tilesets = {};", "document.")).toBe(false);
    expect(usesForbiddenToken("export function f(document: Doc) { return document.assets; }", "document.")).toBe(false);
    expect(usesForbiddenToken("folded.document.tilesets = t;", "document.")).toBe(false);
    expect(usesForbiddenToken("await fetch(url);", "fetch(")).toBe(true);
  });
});
