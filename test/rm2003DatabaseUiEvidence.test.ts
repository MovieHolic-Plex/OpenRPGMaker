import { describe, expect, it } from "vitest";

type FsReader = {
  readonly existsSync: (path: string) => boolean;
  readonly readFileSync: (path: string, encoding: "utf8") => string;
};

const loadFs = async (): Promise<FsReader> => {
  const moduleName = "node:fs";
  return (await import(moduleName)) as FsReader;
};

const viteConfigPath = "vite.config.ts";

describe("RM2003 database UI evidence plan", () => {
  // .omo/evidence/rm2003-database-plan(매트릭스·캡처 스크립트)는 공개 기준선의 산출물 정리(0d4f13e7c8)에서 빠졌다 —
  // 그 파일을 읽던 두 경우는 뺐다. Vite 감시 제외 계약만 남는다.
  it("keeps evidence artifacts out of the Vite file watcher on Windows", async () => {
    const { readFileSync } = await loadFs();
    const config = readFileSync(viteConfigPath, "utf8");

    expect(config).toContain("watch");
    expect(config).toContain("**/.omo/**");
  });
});
