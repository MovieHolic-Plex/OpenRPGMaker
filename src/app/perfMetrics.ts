export type PerfMetrics = {
  initialEditRenderMs?: number;
  playRenderMs?: number;
  battleEntryMs?: number;
  modeSwitchMs: number[];
};

const metrics: PerfMetrics = {
  modeSwitchMs: [],
};

let metricsNode: HTMLElement | null = null;

export function mountPerfMetrics(root: HTMLElement): void {
  const existing = root.querySelector("[data-testid='perf-metrics-json']");
  if (existing instanceof HTMLElement) {
    metricsNode = existing;
  } else {
    metricsNode = document.createElement("pre");
    metricsNode.hidden = true;
    metricsNode.dataset.testid = "perf-metrics-json";
    root.append(metricsNode);
  }
  renderPerfMetrics();
}

export function markInitialEditRender(startedAt: number): void {
  if (metrics.initialEditRenderMs === undefined) {
    metrics.initialEditRenderMs = elapsedMs(startedAt);
    renderPerfMetrics();
  }
}

export function markPlayRender(startedAt: number): void {
  metrics.playRenderMs = elapsedMs(startedAt);
  renderPerfMetrics();
}

export function markBattleEntry(startedAt: number): void {
  metrics.battleEntryMs = elapsedMs(startedAt);
  renderPerfMetrics();
}

export function markModeSwitch(startedAt: number): void {
  metrics.modeSwitchMs.push(elapsedMs(startedAt));
  renderPerfMetrics();
}

function elapsedMs(startedAt: number): number {
  return Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
}

function renderPerfMetrics(): void {
  if (!metricsNode) return;
  metricsNode.textContent = JSON.stringify(metrics);
}
