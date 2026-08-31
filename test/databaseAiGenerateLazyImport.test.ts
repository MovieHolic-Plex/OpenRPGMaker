import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* 실측(2026-08-30): `databaseRecordViews.ts` 가 생성 모달을 **정적으로** import 하면
 * `npm run build:app` 은 통과하는데 출하 번들 부팅이
 * `TypeError: Cannot read properties of undefined (reading 'deprecated')` 로 죽는다.
 * 모달이 aiDatabaseGeneration → applyChangesetToStore → 툴 레지스트리를 끌어와
 * store 청크 초기화 순환을 만들기 때문이다. dev 서버와 vitest 는 이 순환을 견디므로
 * 타입체크·단위테스트·CSS·surface 게이트가 전부 초록인 채로 출하물만 깨진다.
 * 그래서 "동적 import 로 남아 있어야 한다"를 소스 수준에서 고정한다. */
const SOURCE = readFileSync("src/editor/panels/databaseRecordViews.ts", "utf8");
const DIALOG_MODULE = "@/editor/panels/databaseAiGenerateDialog";

describe("databaseRecordViews ↔ AI 생성 모달 결합", () => {
  it("모달을 정적 import 하지 않는다", () => {
    const staticImport = new RegExp(`^\\s*import\\s[^\n]*${DIALOG_MODULE.replace(/[/@]/g, "\\$&")}`, "m");

    expect(SOURCE).not.toMatch(staticImport);
  });

  it("모달은 클릭 시점에 동적으로 불러온다", () => {
    expect(SOURCE).toContain(`import("${DIALOG_MODULE}")`);
  });
});
