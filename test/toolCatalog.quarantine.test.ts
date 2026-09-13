// test/toolCatalog.test.ts
// 툴 카탈로그 자동 생성 검증(레지스트리 파생, 드리프트 없음).

import { describe, expect, it } from "vitest";
import { generateToolCatalogMarkdown } from "@/editor/tools/toolCatalog";
import { allTools } from "@/editor/tools/toolRegistry";

describe("toolCatalog", () => {
  const markdown = generateToolCatalogMarkdown();

  it("모든 등록 툴 이름이 문서에 등장한다", () => {
    for (const tool of allTools()) {
      expect(markdown).toContain(`\`${tool.name}\``);
    }
  });

  it("쓰기/읽기 섹션과 총 개수를 표기한다", () => {
    expect(markdown).toContain("## 쓰기 툴");
    expect(markdown).toContain("## 읽기 툴");
    expect(markdown).toContain(`총 ${allTools().length}개 툴`);
  });

  it("주요 신규 툴(create_quest/simulate_battle/generate_map/rename_switch)이 포함된다", () => {
    for (const name of ["create_quest", "simulate_battle", "tune_enemy", "generate_map", "rename_switch", "prune_unused"]) {
      expect(markdown).toContain(`\`${name}\``);
    }
  });

  // 스냅샷 동기화: docs/tool-catalog.md가 레지스트리와 일치해야 한다.
  // 드리프트(새 툴 추가 후 문서 미갱신) 시 실패 → `node scripts/generateToolCatalog.mjs`로 재생성.
  it("docs/tool-catalog.md가 레지스트리와 동기화되어 있다", async () => {
    // node 모듈은 동적 import(모듈명 변수화)로 types:[] 환경의 tsc 오류를 피한다(기존 관례).
    const moduleName = "node:fs";
    const fs = (await import(moduleName)) as {
      readFileSync(path: string, enc: string): string;
      writeFileSync(path: string, data: string): void;
    };
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
    const expected = markdown + "\n";
    // 재생성 모드(scripts/generateToolCatalog.mjs): 파일을 갱신하고 통과.
    if (env.UPDATE_CATALOG === "1") {
      fs.writeFileSync("docs/tool-catalog.md", expected);
      return;
    }
    expect(fs.readFileSync("docs/tool-catalog.md", "utf8")).toBe(expected);
  });
});
