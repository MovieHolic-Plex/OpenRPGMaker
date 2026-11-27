#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";
import {
  FALLBACK_HEAP_MB,
  MIN_WORKER_HEAP_MB,
  cgroupCpus,
  explicitHeapMb,
  resolveVitestBudget,
} from "./lib/vitestBudget.mjs";

applyLegacyEnvAliases();

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === "--oprn-unit") {
  if (!cliArgs[1]?.trim() || cliArgs[1].startsWith("-")) {
    console.error("Usage: npm run test:unit -- <test file> [more test files] [Vitest options]");
    process.exit(2);
  }
  cliArgs.splice(0, 1, "run", "--configLoader", "bundle", "--maxWorkers=1");
}

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

function cgroupBudget(args) {
  return resolveVitestBudget(plannedWorkers(args));
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
  const workerArgs = [...stripped, `--maxWorkers=${budget.workers}`];
  if (VITEST_SUPPORTS_MIN_WORKERS) workerArgs.push("--minWorkers=1");
  return workerArgs;
}

function dropUnsupportedMinWorkers(args) {
  if (VITEST_SUPPORTS_MIN_WORKERS) return args;
  const stripped = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--minWorkers=")) continue;
    if (arg === "--minWorkers") { index += 1; continue; }
    stripped.push(arg);
  }
  return stripped;
}

const packagePath = fileURLToPath(import.meta.resolve("vitest/package.json"));
const vitestVersion = JSON.parse(readFileSync(packagePath, "utf8")).version;
const VITEST_SUPPORTS_MIN_WORKERS = Number.parseInt(vitestVersion.split(".")[0], 10) < 4;
const vitestCli = canonicalizeWindowsDrive(join(dirname(packagePath), "vitest.mjs"));
const root = canonicalizeWindowsDrive(process.cwd());
const requestedArgs = canonicalizeRootArgs(cliArgs, root);
// cgroup 상한이 있으면(= CI 슬라이스) 워커 수와 힙을 예산에 맞춘다. 없으면 그대로 간다.
const budget = cgroupBudget(requestedArgs);
// vitest 4+ 는 --minWorkers 가 없다. 예산으로 워커를 깎지 않으면 플래그가 그대로 전달돼
// `Unknown option --minWorkers` 로 리포트도 못 내고 죽는다 (GitHub 호스티드, 2026-10-12).
const args = dropUnsupportedMinWorkers(withWorkerCap(requestedArgs, budget));
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
