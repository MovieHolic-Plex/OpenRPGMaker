import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CORE_DIR = "src/project/persistence/core";
// 렌더러 전용 능력. core 는 메인 프로세스·노드 스크립트에서도 그대로 돌아야 한다.
const FORBIDDEN_TOKENS = ["window.", "document.", "localStorage", "navigator.", "fetch(", "import.meta.env", "XMLHttpRequest"] as const;
// Supabase 와 편집기 UI 로 되돌아가는 import.
const FORBIDDEN_IMPORTS = ["supabase", "@/editor", "@/ai", "@/app", "spatial/persistence", "spatial/saveRouting"] as const;

// 정적 import(여러 줄 포함)·부수효과 import·동적 import() 의 모듈 경로를 전부 뽑는다.
const IMPORT_SOURCE_PATTERN = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

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

  it("core 는 DOM·네트워크·Supabase 를 모른다", () => {
    const offenders: string[] = [];
    for (const file of coreFiles(CORE_DIR)) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN_TOKENS) if (text.includes(token)) offenders.push(`${file}: ${token}`);
      for (const hit of forbiddenImportSources(text)) offenders.push(`${file}: import ${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  it("import 스캔은 여러 줄·부수효과·동적 import 를 모두 잡는다", () => {
    expect(forbiddenImportSources('import {\n  a,\n} from "@/editor/x";')).toEqual(["@/editor (@/editor/x)"]);
    expect(forbiddenImportSources('import "@/ai/boot";')).toEqual(["@/ai (@/ai/boot)"]);
    expect(forbiddenImportSources('const m = await import("../../supabaseProjectSync");')).toEqual(["supabase (../../supabaseProjectSync)"]);
    expect(forbiddenImportSources('import { serialize } from "../../io";\nexport * from "./canonicalJson";')).toEqual([]);
  });
});
