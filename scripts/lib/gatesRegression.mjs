// scripts/lib/gatesRegression.mjs
// 게이트 회귀 판정의 **순수 부분** — «기준선에 없던 실패» 를 두 갈래로 가른다.
//
// 왜 필요한가 (실측 2026-09-11): 판정은 실패 파일이 기준선의 `failedFiles` 에 없으면 곧바로
// «새로 실패» 로 셌다. 그런데 기준선(2026-09-02) 이후 테스트 파일이 1,116개 늘었고
// (파일 1,905 → 3,016), 그 사이 이미 빨개진 새 파일들이 전부 회귀로 잡혀 127건이 됐다 —
// 그중 **84건은 기준선 시점에 존재하지도 않던 파일**이다. 없는 파일은 회귀할 수 없다.
//
// 그래서 세 번째 갈래를 만든다: «기준선 이후 신규 파일» (보고만 하고 회귀로 세지 않는다).
// 대신 신규 여부를 **확인할 수 없으면 회귀로 센다** — 조용히 면제해 주는 쪽이 래칫을 죽인다.
// (`.omo` 래칫 문서가 경고하는 실패 경로: «갱신 모드로 커밋하면 그 뒤 영구히 초록».)

/**
 * 실패 파일을 기준선과 대조해 세 갈래로 가른다.
 *
 * @param {object} input
 * @param {readonly string[]} input.failedFiles        이번 실행에서 실패한 파일(정규화된 경로)
 * @param {readonly string[]} input.baselineFailedFiles 기준선이 기록한 실패 파일
 * @param {(path: string) => boolean} [input.isNewFile] «이 파일은 기준선 시점에 없었다» 술어.
 *   확인할 수 없으면 넘기지 않는다 — 그러면 모든 미지 파일이 회귀로 남는다(fail-safe).
 * @returns {{ regressions: string[], newFileFailures: string[], attribution: "known" | "unknown" }}
 */
export function classifyTestFailures({ failedFiles = [], baselineFailedFiles = [], isNewFile } = {}) {
  const known = new Set(baselineFailedFiles);
  const regressions = [];
  const newFileFailures = [];
  for (const file of [...new Set(failedFiles)].sort()) {
    // 기준선에도 실패로 적혀 있던 파일은 «이미 알고 있던 빨강» 이다 — 어느 갈래에도 넣지 않는다.
    if (known.has(file)) continue;
    if (typeof isNewFile === "function" && isNewFile(file)) {
      newFileFailures.push(`tests ${file}: 기준선 이후 신규 파일`);
      continue;
    }
    regressions.push(`tests ${file}: 새로 실패`);
  }
  return { regressions, newFileFailures, attribution: typeof isNewFile === "function" ? "known" : "unknown" };
}
