// test/gatesRegression.test.ts
//
// 게이트 회귀 판정의 계약. 왜 이 계약이 필요한가(실측 2026-09-11): 판정이 «기준선의 failedFiles
// 에 없으면 곧바로 회귀» 였을 때, 기준선(2026-09-02) 이후 추가된 1,116개 테스트 파일 중 이미
// 빨간 것들이 전부 회귀로 잡혀 127건이 됐다 — 그중 84건은 그때 **존재하지도 않던 파일**이다.
// 반대로 «신규면 무조건 면제» 로 뒤집으면 래칫이 죽는다(갱신만 하면 영구히 초록).
// 그래서 이 파일은 **양쪽 경계**를 고정한다: 신규는 회귀가 아니되, 신규 여부를 확인할 수 없으면
// 회귀로 남는다.
import { describe, expect, it } from "vitest";
import { classifyTestFailures } from "../scripts/lib/gatesRegression.mjs";

const BASELINE_FAILED = ["test/knownRed.test.ts", "test/alsoRed.test.ts"];

describe("게이트 회귀 판정 — 실패 파일 세 갈래", () => {
  it("기준선에도 실패로 적혀 있던 파일은 어느 갈래에도 넣지 않는다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/knownRed.test.ts"],
      baselineFailedFiles: BASELINE_FAILED,
      isNewFile: () => false,
    });
    expect(result.regressions).toEqual([]);
    expect(result.newFileFailures).toEqual([]);
  });

  it("기준선 시점에 있던 파일이 새로 실패하면 회귀다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/oldButGreen.test.ts"],
      baselineFailedFiles: BASELINE_FAILED,
      isNewFile: () => false,
    });
    expect(result.regressions).toEqual(["tests test/oldButGreen.test.ts: 새로 실패"]);
    expect(result.newFileFailures).toEqual([]);
    expect(result.attribution).toBe("known");
  });

  it("기준선 시점에 없던 파일의 실패는 신규 갈래로 가고 회귀가 아니다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/addedLater.test.ts"],
      baselineFailedFiles: BASELINE_FAILED,
      isNewFile: (file) => file === "test/addedLater.test.ts",
    });
    expect(result.regressions).toEqual([]);
    expect(result.newFileFailures).toEqual(["tests test/addedLater.test.ts: 기준선 이후 신규 파일"]);
  });

  it("신규 여부를 확인할 수 없으면 회귀로 남긴다 — 조용히 면제하지 않는다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/mystery.test.ts"],
      baselineFailedFiles: BASELINE_FAILED,
    });
    expect(result.regressions).toEqual(["tests test/mystery.test.ts: 새로 실패"]);
    expect(result.newFileFailures).toEqual([]);
    expect(result.attribution).toBe("unknown");
  });

  it("한 파일을 두 번 세지 않고, 입력 순서와 무관하게 결정적이다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/b.test.ts", "test/a.test.ts", "test/b.test.ts"],
      baselineFailedFiles: [],
      isNewFile: () => false,
    });
    expect(result.regressions).toEqual(["tests test/a.test.ts: 새로 실패", "tests test/b.test.ts: 새로 실패"]);
  });

  it("신규 갈래와 회귀 갈래는 겹치지 않는다", () => {
    const result = classifyTestFailures({
      failedFiles: ["test/old.test.ts", "test/new.test.ts"],
      baselineFailedFiles: [],
      isNewFile: (file) => file.endsWith("new.test.ts"),
    });
    expect(result.regressions).toEqual(["tests test/old.test.ts: 새로 실패"]);
    expect(result.newFileFailures).toEqual(["tests test/new.test.ts: 기준선 이후 신규 파일"]);
    expect(new Set([...result.regressions, ...result.newFileFailures]).size).toBe(2);
  });

  it("기준선이 비어 있으면(failedFiles 없음) 전부 미지의 실패다", () => {
    const result = classifyTestFailures({ failedFiles: ["test/x.test.ts"] });
    expect(result.regressions).toEqual(["tests test/x.test.ts: 새로 실패"]);
  });
});
