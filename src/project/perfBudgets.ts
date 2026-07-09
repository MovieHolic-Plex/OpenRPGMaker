// W3-1 performance budget draft agreed for measurement on feat/6b-perf-bench.
// CI does not gate these timings because they are machine-dependent; the
// headless benchmark script records evidence and exits non-zero on local budget
// failures so budget changes stay explicit.
export const PERF_BUDGETS = {
  // 2026-07-06 W4-1: map-only paint benchmark now uses store.updateMap,
  // cloning one GameMap with structural sharing instead of cloning the whole project.
  editDataPipelineP95Ms: 16,
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
