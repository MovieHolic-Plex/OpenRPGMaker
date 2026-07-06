// W3-1 performance budget draft agreed for measurement on feat/6b-perf-bench.
// CI does not gate these timings because they are machine-dependent; the
// headless benchmark script records evidence and exits non-zero on local budget
// failures so budget changes stay explicit.
export const PERF_BUDGETS = {
  // 잠정 예산(2026-07-06 실측 p95 35.7ms 기준 보정). 16ms 복귀 조건: store.update의
  // 전체 프로젝트 structuredClone을 map/cell 패치 경로로 대체하는 최적화(백로그) 이후.
  editDataPipelineP95Ms: 40,
  undoSnapshotBytes: 100 * 1024 * 1024,
  // 실측 180ms — 3s는 과잉 여유라 500ms로 하향(50맵×128×128 기준).
  projectLoadP95Ms: 500,
} as const;

export const PERF_BENCHMARK_CONFIG = {
  editIterations: 500,
  editWarmupIterations: 50,
  renderPlanIterations: 500,
  undoSnapshotCount: 50,
  undoProjectMapCount: 50,
  undoProjectMapSize: 64,
  projectLoadIterations: 10,
  projectLoadMapCount: 50,
  projectLoadMapSize: 128,
  editMapSize: 128,
} as const;
