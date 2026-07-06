// W3-1 performance budget draft agreed for measurement on feat/6b-perf-bench.
// CI does not gate these timings because they are machine-dependent; the
// headless benchmark script records evidence and exits non-zero on local budget
// failures so budget changes stay explicit.
export const PERF_BUDGETS = {
  editDataPipelineP95Ms: 16,
  undoSnapshotBytes: 100 * 1024 * 1024,
  projectLoadP95Ms: 3000,
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
