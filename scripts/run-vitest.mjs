#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

function canonicalizeWindowsDrive(path) {
  if (process.platform !== "win32") return path;
  return path.replace(/^([a-z]):/, (_, drive) => `${drive.toUpperCase()}:`);
}

function canonicalizeRootArgs(args, defaultRoot) {
  const normalized = [...args];
  let hasRoot = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const argument = normalized[index];
    if (argument === "--root" || argument === "-r") {
      hasRoot = true;
      if (normalized[index + 1]) {
        normalized[index + 1] = canonicalizeWindowsDrive(normalized[index + 1]);
        index += 1;
      }
      continue;
    }
    if (argument.startsWith("--root=")) {
      hasRoot = true;
      normalized[index] = `--root=${canonicalizeWindowsDrive(argument.slice("--root=".length))}`;
    }
  }

  if (!hasRoot) normalized.push("--root", defaultRoot);
  return normalized;
}


/**
 * vitest 워커의 힙 상한.
 *
 * 이 저장소의 스위트는 파일 단위로 워커가 갈리고(pool=forks), 케이스가 많은 파일일수록 한 워커의 힙이
 * 자란다. 실측(2026-09-11): `test/verificationPlanAtomicity.test.ts` 가 108케이스에서 피크 4.34GB —
 * Node 기본 상한(이 박스에서 4,288MB, `v8.getHeapStatistics().heap_size_limit`)을 넘겨 워커가
 * `Ineffective mark-compacts near heap limit` 으로 죽고, 그 워커가 맡은 파일은 결과를 못 내놨다.
 * 기본 상한은 머신 메모리(98GB)와 무관하게 **프로세스당** 걸리므로 RAM 이 남아도 소용이 없다.
 *
 * 그래서 8GB 를 기본으로 깔아 둔다(근본 수정은 그 파일을 세 파일로 가른 것 — 각 피크 3.13/2.06/2.88GB).
 * 사용자가 이미 `--max-old-space-size` 를 줬으면 그 값을 존중한다. 더 키우려면 `OPRN_VITEST_HEAP_MB`.
 */
const FALLBACK_HEAP_MB = 8192;

/**
 * 자기 cgroup(v2) 조상 사슬을 훑어 실효 상한을 구한다.
 *
 * 상한은 프로세스가 직접 든 cgroup 이 아니라 **조상 슬라이스**에 걸려 있는 게 보통이다.
 * 예) CI 러너는 `…/ci.slice/gh-runner-rpg-zzu.service` 에 있고 memory.max 는 `ci.slice` 에 있다.
 * 그래서 루트까지 올라가며 최솟값을 취한다. cgroup v2 가 아니거나 상한이 없으면 null.
 */
function cgroupLimit(fileName, parse) {
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

/**
 * cgroup 이 허용하는 코어 수. 없으면 null.
 *
 * **`os.availableParallelism()` 을 쓰면 안 된다.** 중첩 슬라이스에서 틀린 값을 준다 —
 * 실측(2026-09-17): 리프에 CPUQuota=300% 를 걸고 부모 ci-full.slice(600%) / 조부모
 * ci.slice(800%) 아래에서 돌렸더니 **8** 이 나왔다. 체인에서 가장 **느슨한** 쿼터를 집는다.
 * (조상에 쿼터가 없는 단순한 경우엔 리프 값을 맞게 준다 — 그래서 알아채기 어렵다.)
 * 위의 cgroupLimit 은 체인의 **최솟값**을 취하므로 실효 상한이 나온다.
 */
function cgroupCpus() {
  return cgroupLimit("cpu.max", (raw) => {
    const [quota, period] = raw.split(/\s+/);
    if (quota === "max") return null;
    const parsedQuota = Number(quota);
    const parsedPeriod = Number(period);
    if (!Number.isFinite(parsedQuota) || !Number.isFinite(parsedPeriod) || parsedPeriod <= 0) return null;
    return Math.max(1, Math.floor(parsedQuota / parsedPeriod));
  });
}

/** vitest 가 실제로 띄울 워커 수. CLI 가 지정했으면 그 값, 아니면 cgroup 이 주는 코어 수. */
function plannedWorkers(args) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index].startsWith("--maxWorkers=")
      ? args[index].slice("--maxWorkers=".length)
      : args[index] === "--maxWorkers" ? args[index + 1] : null;
    const parsed = Number.parseInt(value ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Math.max(1, cgroupCpus() ?? availableParallelism());
}

/**
 * vitest 워커의 힙 상한.
 *
 * 이 저장소의 스위트는 파일 단위로 워커가 갈리고(pool=forks), 케이스가 많은 파일일수록 한 워커의 힙이
 * 자란다. 실측(2026-09-11): `test/verificationPlanAtomicity.test.ts` 가 108케이스에서 피크 4.34GB —
 * Node 기본 상한(이 박스에서 4,288MB)을 넘겨 워커가 `Ineffective mark-compacts near heap limit` 으로
 * 죽고, 그 워커가 맡은 파일은 결과를 못 내놨다. 그래서 8GB 를 기본으로 깔아 뒀다
 * (근본 수정은 그 파일을 세 파일로 가른 것 — 각 피크 3.13/2.06/2.88GB).
 *
 * **그런데 그 기본값은 메모리가 무제한일 때만 옳다.** cgroup 으로 묶인 CI 슬라이스(8코어/24GB)에서
 * 8워커 × 8GB = 64GB 천장은 그대로 OOM 이다 — 이 박스는 상한이 없던 시절 유저 슬라이스가
 * peak 91GB 를 찍고 oom_kill 이 323회 났고, 전체 실행이 78분쯤 출력 없이 사라졌다.
 * 그래서 상한이 걸려 있으면 거기에 맞춰 나눈다: 워커들이 합쳐서 메모리의 75%를 넘지 않게.
 *
 * 우선순위: 사용자가 준 `--max-old-space-size` > `OPRN_VITEST_HEAP_MB` > cgroup 유도값 > 8192.
 */
/**
 * 워커 하나가 반드시 가져야 하는 힙.
 *
 * 실측(2026-09-11) 최악 파일 피크는 4.34GB 였고, 세 파일로 가른 뒤에도 3.13/2.06/2.88GB 다.
 * 즉 워커 힙 상한이 3.13GB 아래면 그 파일은 `Ineffective mark-compacts` 로 죽는다.
 * **그러므로 메모리 예산을 워커 수로 그냥 나누면 안 된다** — 나눗셈이 이 바닥 아래로 내려가면
 * 워커 수를 줄이는 게 맞다. CPU 가 8코어라도 메모리가 5워커어치면 묶이는 쪽은 메모리다.
 */
const MIN_WORKER_HEAP_MB = 3584;

/**
 * 힙 상한은 «동시에 전원이 최대치» 를 가정한 값이라 실제 사용량보다 훨씬 크다.
 *
 * 실측(2026-09-17, ci.slice 8코어/24GB, 전체 스위트 2,338파일 완주):
 *   워커 5개 × 힙 3,686MB = **이론 천장 18.4GB** 였는데 슬라이스 **실측 피크는 9.00GB(49%)**.
 * 무거운 파일이 동시에 여러 워커에 걸리는 일이 드물기 때문이다. 이론 천장으로 워커를 깎으면
 * CPU 가 논다 — 그 실행은 8코어를 줬는데 CPU 를 5.2코어어치만 썼다.
 *
 * 후보 워커 수는 그래서 이론 천장이 예산의 2배까지인 쪽으로 잡는다.
 * 그 합이 75% 예산을 넘으면 워커를 줄인다. 2배 허용은 실측 RSS 가 이론의 절반일 때만
 * 맞았다. 12GB 슬라이스(ci-full, 2026-10-04)에서는 서비스가 물려 준 힙 4096MB × 워커 3 이
 * memory.max 와 같아서 피크 12.00GiB, OOM kill 1 (run 37183989815) 로 JSON 리포트가 사라졌다.
 */
const OVERCOMMIT_FACTOR = 2;

function explicitHeapMb(nodeOptions) {
  const match = /--max-old-space-size(?:=|\s+)(\d+)/.exec(nodeOptions ?? "");
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * `withHeapOption` 이 실제로 남기는 힙.
 * 사용자가 `--max-old-space-size` 를 줬으면(서비스 NODE_OPTIONS 포함) 그 값이 우선이다.
 */
function inheritedHeapMb() {
  const fromNode = explicitHeapMb(process.env.NODE_OPTIONS);
  if (fromNode != null) return fromNode;
  const override = Number.parseInt(process.env.OPRN_VITEST_HEAP_MB ?? "", 10);
  if (Number.isFinite(override) && override > 0) return override;
  return null;
}

function heapForWorkers(usableMb, workers) {
  return Math.min(FALLBACK_HEAP_MB, Math.max(MIN_WORKER_HEAP_MB, Math.floor(usableMb / workers)));
}

/**
 * cgroup 메모리 상한에서 (워커 수, 워커당 힙)을 함께 결정한다.
 *
 * 상한이 없으면(로컬 개발) null — 아무것도 바꾸지 않는다. 기존 동작 그대로 힙 8GB, 워커는 호출자 결정.
 *
 * 이 박스는 상한이 없던 시절 유저 슬라이스가 peak 91GB / 98GB 를 찍고 oom_kill 이 323회 났으며,
 * 전체 vitest 실행이 78분쯤 출력 없이 사라졌다. 그 재발 방지가 이 함수의 존재 이유다.
 */
function cgroupBudget(args) {
  const memoryMax = cgroupLimit("memory.max", (raw) => (raw === "max" ? null : Number(raw)));
  const cpus = cgroupCpus();
  const hasMemory = memoryMax != null && Number.isFinite(memoryMax);
  if (!hasMemory && cpus == null) return null;

  // CPU 상한은 **호출자가 --maxWorkers 를 명시했어도** 덮는다. verify-gates 는 8을 주지만
  // full 레인은 6코어다(ci-full.slice). 8워커가 6코어를 나눠 갖는 건 스로틀만 늘린다.
  let workers = plannedWorkers(args);
  if (cpus != null) workers = Math.min(workers, cpus);

  let usableMb = null;
  let heapMb = FALLBACK_HEAP_MB;
  if (hasMemory) {
    usableMb = Math.floor((memoryMax * 0.75) / 1024 / 1024);
    const memoryWorkers = Math.max(1, Math.floor((usableMb * OVERCOMMIT_FACTOR) / MIN_WORKER_HEAP_MB));
    workers = Math.min(workers, memoryWorkers);
  }
  workers = Math.max(1, workers);
  // 힙은 최악 파일(피크 3.13GB)을 담을 수 있어야 한다 — 이 아래로 내리면 그 파일이
  // `Ineffective mark-compacts near heap limit` 으로 죽고 결과를 못 내놓는다.
  if (usableMb != null) {
    const memoryMaxMb = memoryMax / 1024 / 1024;
    // 16GB 이하에서는 워커를 둘 이상 두면 슬라이스가 12GiB 에 붙는다.
    // 2×3584MB 도 워커가 `Ineffective mark-compacts near heap limit` 으로 죽었다
    // (run 37187303515). 워커는 하나, 힙은 8GB. 자라는 건 그 파일만큼이다.
    if (memoryMaxMb <= 16 * 1024) {
      workers = 1;
      heapMb = FALLBACK_HEAP_MB;
    } else {
      heapMb = heapForWorkers(usableMb, workers);
      const inherited = inheritedHeapMb();
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

function heapMbFor(budget) {
  const override = Number.parseInt(process.env.OPRN_VITEST_HEAP_MB ?? "", 10);
  if (Number.isFinite(override) && override > 0) return override;
  return budget?.heapMb ?? FALLBACK_HEAP_MB;
}

function withHeapOption(nodeOptions, budget) {
  const current = nodeOptions ?? "";
  const pinned = explicitHeapMb(current);
  const wanted = heapMbFor(budget);
  // 상한이 없으면 사용자가 준 힙을 그대로 둔다.
  if (budget == null) {
    if (pinned != null) return current;
    return `${current} --max-old-space-size=${wanted}`.trim();
  }
  // cgroup 예산이 있으면 그 힙을 쓴다. 러너 서비스의 4096 은 워커를 그 값에 묶어
  // 8GB 가 필요한 파일을 heap limit 으로 죽인다.
  if (pinned === wanted) return current;
  const stripped = current.replace(/--max-old-space-size(?:=|\s+)\d+/, "").trim();
  return `${stripped} --max-old-space-size=${wanted}`.trim();
}

/** cgroup 이 허용하는 것보다 많은 워커를 요청했으면 낮춰 준다. 상한이 없으면 손대지 않는다. */
function withWorkerCap(args, budget) {
  if (!budget || budget.workers >= plannedWorkers(args)) return args;
  // maxWorkers 와 minWorkers 를 **둘 다** 걷어낸다. vitest 의 CLI 파서는 같은 옵션이 두 번
  // 오면 `Expected a single value for option "--minWorkers <workers>", received [1, 1]` 로 죽는다
  // (실측: max 만 걷어내고 min 을 덧붙였다가 게이트가 리포트도 못 내고 exit 1).
  const stripped = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--maxWorkers=") || arg.startsWith("--minWorkers=")) continue;
    if (arg === "--maxWorkers" || arg === "--minWorkers") { index += 1; continue; }
    stripped.push(arg);
  }
  const memoryPart = budget.usableMb == null ? "메모리 상한 없음" : `${Math.floor(budget.usableMb / 1024)}GiB`;
  const cpuPart = budget.cpus == null ? "CPU 상한 없음" : `${budget.cpus}코어`;
  console.error(
    `[run-vitest] cgroup 예산 ${cpuPart} / ${memoryPart} → 워커 ${budget.workers}개 ` +
    `× 힙 ${budget.heapMb}MB 로 낮춘다 (워커당 최소 ${MIN_WORKER_HEAP_MB}MB 보장).`,
  );
  return [...stripped, `--maxWorkers=${budget.workers}`, "--minWorkers=1"];
}

const packagePath = fileURLToPath(import.meta.resolve("vitest/package.json"));
const vitestCli = canonicalizeWindowsDrive(join(dirname(packagePath), "vitest.mjs"));
const root = canonicalizeWindowsDrive(process.cwd());
const requestedArgs = canonicalizeRootArgs(process.argv.slice(2), root);
// cgroup 상한이 있으면(= CI 슬라이스) 워커 수와 힙을 예산에 맞춘다. 없으면 그대로 간다.
const budget = cgroupBudget(requestedArgs);
const args = withWorkerCap(requestedArgs, budget);
const result = spawnSync(process.execPath, [vitestCli, ...args], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: withHeapOption(process.env.NODE_OPTIONS, budget) },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.signal) {
  console.error(`Vitest terminated by signal ${result.signal}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
