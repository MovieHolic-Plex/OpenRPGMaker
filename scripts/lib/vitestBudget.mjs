// cgroup(v2) · GitHub 호스티드 러너 메모리/코어 예산에서 vitest 의 (실효 워커 수, 워커당 힙)을 계산하는 단일 출처.
// scripts/run-vitest.mjs(실행) 와 scripts/vitest-related.mjs(조각·시간 상한 계획) 가 같은 공식을 공유한다.
import { readFileSync } from "node:fs";
import { availableParallelism, totalmem } from "node:os";
import { dirname, join } from "node:path";

export const FALLBACK_HEAP_MB = 8192;
export const MIN_WORKER_HEAP_MB = 3584;
export const OVERCOMMIT_FACTOR = 2;

/**
 * 자기 cgroup(v2) 조상 사슬을 훑어 실효 상한을 구한다.
 * 상한은 리프가 아니라 조상 슬라이스(ci.slice 등)에 걸린 경우가 흔하므로 최솟값을 취한다.
 */
export function cgroupLimit(fileName, parse) {
  try {
    const own = readFileSync("/proc/self/cgroup", "utf8").trim().split("\n").at(-1)?.split(":").at(2);
    if (!own) return null;
    let dir = join("/sys/fs/cgroup", own);
    let best = null;
    for (let depth = 0; depth < 32; depth += 1) {
      try {
        const parsed = parse(readFileSync(join(dir, fileName), "utf8").trim());
        if (parsed != null) best = best == null ? parsed : Math.min(best, parsed);
      } catch { /* 이 층엔 해당 파일이 없다 — 계속 올라간다 */ }
      const parent = dirname(dir);
      if (parent === dir || !parent.startsWith("/sys/fs/cgroup")) break;
      dir = parent;
    }
    return best;
  } catch {
    return null;
  }
}

export function cgroupCpus() {
  return cgroupLimit("cpu.max", (raw) => {
    const [quota, period] = raw.split(/\s+/);
    if (quota === "max") return null;
    const parsedQuota = Number(quota);
    const parsedPeriod = Number(period);
    if (!Number.isFinite(parsedQuota) || !Number.isFinite(parsedPeriod) || parsedPeriod <= 0) return null;
    return Math.max(1, Math.floor(parsedQuota / parsedPeriod));
  });
}

export function explicitHeapMb(nodeOptions) {
  const match = /--max-old-space-size(?:=|\s+)(\d+)/.exec(nodeOptions ?? "");
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function inheritedHeapMb(env = process.env) {
  const fromNode = explicitHeapMb(env.NODE_OPTIONS);
  if (fromNode != null) return fromNode;
  const override = Number.parseInt(env.OPRN_VITEST_HEAP_MB ?? "", 10);
  if (Number.isFinite(override) && override > 0) return override;
  return null;
}

function heapForWorkers(usableMb, workers) {
  return Math.min(FALLBACK_HEAP_MB, Math.max(MIN_WORKER_HEAP_MB, Math.floor(usableMb / workers)));
}

/**
 * cgroup / 호스티드 VM 예산에서 (workers, heapMb, usableMb, cpus) 를 계산한다.
 * 로컬 개발(상한 없음)은 null.
 */
export function resolveVitestBudget(requestedWorkers, env = process.env) {
  let memoryMax = cgroupLimit("memory.max", (raw) => (raw === "max" ? null : Number(raw)));
  let cpus = cgroupCpus();
  // GitHub 호스티드 러너는 cgroup 이 max(무제한)로 찍힌다. VM 은 4코어/16GB 인데
  // 그 값을 안 보면 --maxWorkers=8 × 힙 8GB 가 그대로 나가 잡이 죽는다.
  if (memoryMax == null && cpus == null && env.GITHUB_ACTIONS === "true") {
    memoryMax = totalmem();
    cpus = availableParallelism();
  }
  const hasMemory = memoryMax != null && Number.isFinite(memoryMax);
  if (!hasMemory && cpus == null) return null;

  let workers = requestedWorkers;
  if (cpus != null) workers = Math.min(workers, cpus);

  let usableMb = null;
  let heapMb = FALLBACK_HEAP_MB;
  if (hasMemory) {
    usableMb = Math.floor((memoryMax * 0.75) / 1024 / 1024);
    const memoryWorkers = Math.max(1, Math.floor((usableMb * OVERCOMMIT_FACTOR) / MIN_WORKER_HEAP_MB));
    workers = Math.min(workers, memoryWorkers);
  }
  workers = Math.max(1, workers);

  if (usableMb != null) {
    const memoryMaxMb = memoryMax / 1024 / 1024;
    const workerOverride = Number.parseInt(env.OPRN_VITEST_WORKERS ?? "", 10);
    if (Number.isFinite(workerOverride) && workerOverride > 0) {
      workers = Math.min(workers, workerOverride);
      heapMb = Math.min(12288, Math.max(MIN_WORKER_HEAP_MB, Math.floor((usableMb * OVERCOMMIT_FACTOR) / workers)));
    } else if (memoryMaxMb < 14 * 1024) {
      // 12GB 이하 cgroup 슬라이스에서는 안전하게 워커 1개 × 75% 힙.
      workers = 1;
      heapMb = Math.min(12288, Math.floor(memoryMaxMb * 0.75));
    } else if (memoryMaxMb <= 16 * 1024) {
      // GitHub 호스티드 4코어/16GB VM (2026-11-27 perf/ci-speed-aggressive):
      // 3워커 × 5120MB 는 대형 병합 테스트(editorPfx34/40 등)가 V8 5.1GB 천장에서 GC 스래싱·OOM 을 일으켰다(실측 #5300).
      // 2워커 × 6656MB 로 2배 병렬성과 워커당 6.5GB 여유 힙을 함께 확보한다.
      workers = Math.min(workers, 2);
      heapMb = Math.min(6656, Math.max(MIN_WORKER_HEAP_MB, Math.floor((usableMb * OVERCOMMIT_FACTOR) / workers)));
    } else {
      heapMb = heapForWorkers(usableMb, workers);
      const inherited = inheritedHeapMb(env);
      if (inherited != null) heapMb = inherited;
      while (workers > 1 && workers * heapMb > usableMb) {
        workers -= 1;
        if (inherited == null) heapMb = heapForWorkers(usableMb, workers);
      }
      if (workers * heapMb > usableMb) heapMb = heapForWorkers(usableMb, workers);
    }
  }
  return { workers, heapMb, usableMb, cpus };
}

/**
 * 계획기(`vitest-related.mjs`)가 러너와 동일한 실효 워커 수를 구한다.
 * 로컬·비제한 환경에서는 호스티드 16GB 기본값(2)을 반환한다(명시적 OPRN_VITEST_WORKERS 가 있으면 존중).
 */
export function effectiveVitestWorkers(requestedWorkers = 4, env = process.env) {
  const budget = resolveVitestBudget(requestedWorkers, env);
  if (budget) return budget.workers;
  const override = Number.parseInt(env.OPRN_VITEST_WORKERS ?? "", 10);
  if (Number.isFinite(override) && override > 0) return Math.min(requestedWorkers, override);
  return 2;
}
