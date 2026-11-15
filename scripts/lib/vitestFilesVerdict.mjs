// scripts/lib/vitestFilesVerdict.mjs
// ci-vitest-files 의 끝줄 넷을 만든다 — `RESULT:` 줄 뒤에 붙는 NEW-FAIL · KNOWN-FAIL · NOW-PASSING · VERDICT.
//
// 왜 (2026-11-15): agent/* 가지에서는 이 워크플로의 실행 결론이 늘 success 다(실패 알림 소음 때문 — 워크플로 머리말).
// 진짜 결과는 `RESULT:` 줄 하나뿐인데, 그 줄은 «떨어진 파일이 main 에서 이미 빨간 것인지» 를 말하지 않는다. main 에는
// 알려진 빨강이 많아(.omo/gates-baseline.json 의 tests.failedFiles) FAIL 이 곧 «내가 깨뜨렸다» 가 아니고, 읽는 사람이 매번
// 기준선과 손으로 대조했다. 그 대조를 여기서 한다. 실행 결론은 바꾸지 않는다 — 더하는 것은 줄뿐이다.
//
// 가르는 법(scripts/verify-gates.mjs 의 판정과 같은 기준선·같은 경로 표기):
//   NEW-FAIL     이번에 떨어졌고 기준선의 failedFiles 에 없는 파일
//   KNOWN-FAIL   이번에 떨어졌고 기준선에 있는 파일
//   NOW-PASSING  기준선에 실패로 적혀 있는데 이번에 돌아서 통과한 파일 — 기준선에서 뺄 것.
//                태그가 timeout 인 항목(부하에 따라 흔들린다)은 넣지 않는다 — verify-gates 도 그것만 봐준다.
//   VERDICT      CLEAN(새로 떨어진 파일 없음) · NEW-FAIL n files · UNKNOWN(가를 수 없었다 — 까닭을 적는다)
// 가를 수 없으면 CLEAN 이라고 하지 않는다: vitest 가 실패했는데 실패 파일을 못 읽었거나(시험 밖 오류 포함),
// 떨어진 파일이 있는데 기준선을 못 읽었거나, vitest 스텝이 돌지 않은 경우다.

const NONE = "(없음)";
const list = (files) => (files.length > 0 ? files.join(", ") : NONE);

/** vitest 가 적는 경로(절대·역슬래시)를 기준선 표기(`test/…`)로 맞춘다. verify-gates.mjs 의 normalize 와 같다. */
export function normalizeTestPath(name) {
  const slashed = String(name ?? "").split("\\").join("/");
  const index = slashed.indexOf("/test/");
  return index >= 0 ? slashed.slice(index + 1) : slashed.replace(/^\.\//u, "");
}

/** vitest JSON 리포트(testResults[].name·status)에서 돈 파일과 떨어진 파일을 읽는다. 리포트가 없으면 null. */
export function readVitestReport(report) {
  const results = report && Array.isArray(report.testResults) ? report.testResults : null;
  if (!results) return null;
  const ran = [...new Set(results.map((entry) => normalizeTestPath(entry.name)))].sort();
  const failed = [...new Set(results.filter((entry) => entry.status !== "passed").map((entry) => normalizeTestPath(entry.name)))].sort();
  return { ran, failed };
}

/**
 * @param {object} input
 * @param {string} input.outcome                 vitest 스텝의 outcome (success · failure · skipped · cancelled · "")
 * @param {readonly string[]} input.failedFiles  이번에 떨어진 파일(리포트와 로그에서 읽은 것의 합)
 * @param {readonly string[] | null} input.ranFiles  이번에 돈 파일. 알 수 없으면 null
 * @param {{ failedFiles?: readonly string[], failedFileTags?: Record<string, string> } | null} input.baselineTests
 *   기준선의 tests 칸. 읽지 못했으면 null
 * @returns {{ lines: string[], verdict: "CLEAN" | "NEW-FAIL" | "UNKNOWN", newFail: string[], knownFail: string[], nowPassing: string[] }}
 */
export function vitestFilesVerdict({ outcome, failedFiles = [], ranFiles = null, baselineTests = null }) {
  const failed = [...new Set(failedFiles.map(normalizeTestPath))].sort();
  const known = baselineTests && Array.isArray(baselineTests.failedFiles) ? new Set(baselineTests.failedFiles) : null;
  const tags = baselineTests?.failedFileTags ?? {};
  const newFail = known ? failed.filter((file) => !known.has(file)) : [];
  const knownFail = known ? failed.filter((file) => known.has(file)) : [];
  const failedSet = new Set(failed);
  const nowPassing = known && ranFiles
    ? [...new Set(ranFiles.map(normalizeTestPath))].filter((file) => known.has(file) && !failedSet.has(file) && tags[file] !== "timeout").sort()
    : [];

  let why = "";
  if (outcome !== "success" && outcome !== "failure") why = `vitest 스텝이 실행되지 않았다: ${outcome || "없음"}`;
  else if (outcome === "failure" && failed.length === 0) why = "vitest 가 실패했는데 실패 파일을 읽지 못했다(시험 밖 오류일 수 있다) — 위 로그를 본다";
  else if (!known && failed.length > 0) why = "기준선(.omo/gates-baseline.json 의 tests.failedFiles)을 읽지 못해 가르지 못했다";

  const unknownList = "(가르지 못했다)";
  const lines = [
    `NEW-FAIL: ${why ? unknownList : list(newFail)}`,
    `KNOWN-FAIL: ${why ? unknownList : list(knownFail)}`,
    `NOW-PASSING(기준선에서 뺄 것): ${!known || !ranFiles ? "(알 수 없다)" : list(nowPassing)}`,
    why ? `VERDICT: UNKNOWN (${why})` : newFail.length > 0 ? `VERDICT: NEW-FAIL ${newFail.length} files` : "VERDICT: CLEAN",
  ];
  return { lines, verdict: why ? "UNKNOWN" : newFail.length > 0 ? "NEW-FAIL" : "CLEAN", newFail, knownFail, nowPassing };
}
