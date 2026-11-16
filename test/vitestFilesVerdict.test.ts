// test/vitestFilesVerdict.test.ts
//
// ci-vitest-files 끝줄 넷(NEW-FAIL · KNOWN-FAIL · NOW-PASSING · VERDICT)의 계약.
// 왜 (2026-11-15): agent/* 가지에서는 그 워크플로의 실행 결론이 늘 success 라 읽을 것은 끝줄뿐이다. 그 줄이
// «알려진 빨강만 떨어졌다» 와 «새로 깨뜨렸다» 를 가르지 못하면 «CI 초록» 이라는 잘못된 보고가 다시 나온다.
// 여기서 고정하는 경계: 기준선에 없는 실패는 NEW-FAIL, 가를 수 없으면 CLEAN 이 아니라 UNKNOWN.
import { describe, expect, it } from "vitest";
import { normalizeTestPath, readVitestReport, vitestFilesVerdict } from "../scripts/lib/vitestFilesVerdict.mjs";

const BASELINE = {
  failedFiles: ["test/knownRed.test.ts", "test/fixedSince.test.ts", "test/flaky.test.ts"],
  failedFileTags: { "test/knownRed.test.ts": "drift", "test/fixedSince.test.ts": "drift", "test/flaky.test.ts": "timeout" },
};

describe("ci-vitest-files 끝줄 — 기준선과 대조한 판정", () => {
  it("전부 통과하면 CLEAN 이고 세 목록은 (없음) 이다", () => {
    const result = vitestFilesVerdict({ outcome: "success", failedFiles: [], ranFiles: ["test/a.test.ts"], baselineTests: BASELINE });
    expect(result.lines).toEqual(["NEW-FAIL: (없음)", "KNOWN-FAIL: (없음)", "NOW-PASSING(기준선에서 뺄 것): (없음)", "VERDICT: CLEAN"]);
  });

  it("기준선에 있는 파일만 떨어지면 KNOWN-FAIL 에 적고 CLEAN 이다", () => {
    const result = vitestFilesVerdict({ outcome: "failure", failedFiles: ["test/knownRed.test.ts"], ranFiles: ["test/knownRed.test.ts", "test/a.test.ts"], baselineTests: BASELINE });
    expect(result.lines).toEqual(["NEW-FAIL: (없음)", "KNOWN-FAIL: test/knownRed.test.ts", "NOW-PASSING(기준선에서 뺄 것): (없음)", "VERDICT: CLEAN"]);
  });

  it("기준선에 없는 파일이 떨어지면 NEW-FAIL 이고 그 수를 센다 — 알려진 빨강과 섞여도", () => {
    const result = vitestFilesVerdict({ outcome: "failure", failedFiles: ["test/knownRed.test.ts", "test/b.test.ts", "test/a.test.ts"], ranFiles: null, baselineTests: BASELINE });
    expect(result.lines[0]).toBe("NEW-FAIL: test/a.test.ts, test/b.test.ts");
    expect(result.lines[1]).toBe("KNOWN-FAIL: test/knownRed.test.ts");
    expect(result.lines[3]).toBe("VERDICT: NEW-FAIL 2 files");
  });

  it("기준선에 실패로 적힌 파일이 돌아서 통과하면 NOW-PASSING 에 적는다 — timeout 태그는 빼고", () => {
    const result = vitestFilesVerdict({ outcome: "success", failedFiles: [], ranFiles: ["test/fixedSince.test.ts", "test/flaky.test.ts", "test/a.test.ts"], baselineTests: BASELINE });
    expect(result.lines[2]).toBe("NOW-PASSING(기준선에서 뺄 것): test/fixedSince.test.ts");
    expect(result.verdict).toBe("CLEAN");
  });

  it("무엇이 돌았는지 모르면 NOW-PASSING 을 (없음) 이라고 하지 않는다", () => {
    const result = vitestFilesVerdict({ outcome: "success", failedFiles: [], ranFiles: null, baselineTests: BASELINE });
    expect(result.lines[2]).toBe("NOW-PASSING(기준선에서 뺄 것): (알 수 없다)");
  });

  it("vitest 가 실패했는데 실패 파일이 없으면 CLEAN 이 아니라 UNKNOWN 이다", () => {
    const result = vitestFilesVerdict({ outcome: "failure", failedFiles: [], ranFiles: ["test/a.test.ts"], baselineTests: BASELINE });
    expect(result.verdict).toBe("UNKNOWN");
    expect(result.lines[3]).toMatch(/^VERDICT: UNKNOWN \(/u);
    expect(result.lines[0]).toBe("NEW-FAIL: (가르지 못했다)");
  });

  it("떨어진 파일이 있는데 기준선을 못 읽으면 UNKNOWN 이다 — 없으면 떨어진 것도 없으니 CLEAN", () => {
    expect(vitestFilesVerdict({ outcome: "failure", failedFiles: ["test/a.test.ts"], ranFiles: null, baselineTests: null }).verdict).toBe("UNKNOWN");
    expect(vitestFilesVerdict({ outcome: "success", failedFiles: [], ranFiles: null, baselineTests: null }).verdict).toBe("CLEAN");
  });

  it("vitest 스텝이 돌지 않았으면 UNKNOWN 이다", () => {
    expect(vitestFilesVerdict({ outcome: "skipped", failedFiles: [], ranFiles: null, baselineTests: BASELINE }).lines[3]).toBe("VERDICT: UNKNOWN (vitest 스텝이 실행되지 않았다: skipped)");
  });

  it("리포트의 절대 경로를 기준선 표기로 맞춰 읽는다", () => {
    expect(normalizeTestPath("/home/runner/work/x/x/test/a.test.ts")).toBe("test/a.test.ts");
    expect(normalizeTestPath("D:\\a\\x\\test\\a.test.ts")).toBe("test/a.test.ts");
    const report = readVitestReport({ testResults: [{ name: "/w/test/knownRed.test.ts", status: "failed" }, { name: "/w/test/a.test.ts", status: "passed" }] });
    expect(report).toEqual({ ran: ["test/a.test.ts", "test/knownRed.test.ts"], failed: ["test/knownRed.test.ts"] });
    expect(readVitestReport(null)).toBeNull();
  });
});
