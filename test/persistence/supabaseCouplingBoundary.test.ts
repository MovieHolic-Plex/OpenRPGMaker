import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("정본 저장소 퇴역 (P6 완료)", () => {
  it("src 어디에도 PostgREST 경로(/rest/v1)가 없다", () => {
    const offenders = sourceFiles("src").filter((file) => readFileSync(file, "utf8").includes("/rest/v1"));

    expect(offenders).toEqual([]);
  });

  it("퇴역한 Supabase 모듈이 되살아나지 않는다", () => {
    const forbidden = [
      "src/project/supabaseProjectSync.ts",
      "src/project/supabaseProjectConfig.ts",
      "src/project/supabaseProxyPath.ts",
      "src/project/persistence/supabaseRepository.ts",
      "src/project/spatial/persistenceHttp.ts",
      "src/project/spatial/persistence.ts",
    ];
    const revived = forbidden.filter((path) => {
      try {
        readFileSync(path);
        return true;
      } catch {
        return false;
      }
    });

    expect(revived).toEqual([]);
  });

  it("브리지 없는 세션의 기본 저장소는 메모리 어댑터다", async () => {
    const { projectRepository } = await import("@/project/persistence/repository");
    expect(projectRepository().kind).toBe("memory");
  });
});
