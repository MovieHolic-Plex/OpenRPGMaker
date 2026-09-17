#!/usr/bin/env node
// CI 잡의 자원 사용을 cgroup v2 에서 직접 읽어 남긴다.
//
// 왜 필요한가 — 2026-09-17 실측:
//   전체 vitest 를 두 번 돌렸고 **둘 다 78분쯤 출력 한 줄 없이 사라졌다**. 커널 로그는
//   권한이 없어 못 읽고(`dmesg: Operation not permitted`), 리포트 파일도 안 남아서
//   "왜 죽었는가"를 끝내 확정하지 못했다. 유저 슬라이스에 상한이 없어(memory.max: max)
//   커널이 전역에서 희생자를 골랐기 때문이다.
//
//   cgroup 의 memory.events / memory.peak 는 root 없이 읽힌다. 그래서 스테이지 전후로
//   스냅샷을 떠 두면 "62분에 OOM, peak 23.8GB, oom_kill +1" 처럼 사후 진단이 가능해진다.
//
// 사용법:
//   node scripts/ci-resource-report.mjs start            # 시작 스냅샷 저장
//   node scripts/ci-resource-report.mjs report [제목]     # 차이를 출력 + GITHUB_STEP_SUMMARY 에 append
//
// 스냅샷 경로는 OPRN_CI_RESOURCE_SNAPSHOT 으로 바꿀 수 있다(기본 .omo/ci-resource-start.json).
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SNAPSHOT = resolve(process.env.OPRN_CI_RESOURCE_SNAPSHOT ?? ".omo/ci-resource-start.json");

/** 자기 cgroup 디렉터리. v2 가 아니면 null. */
function ownCgroupDir() {
  try {
    const own = readFileSync("/proc/self/cgroup", "utf8").trim().split("\n").at(-1)?.split(":").at(2);
    if (!own) return null;
    const dir = join("/sys/fs/cgroup", own);
    return existsSync(dir) ? dir : null;
  } catch {
    return null;
  }
}

/**
 * 상한이 실제로 걸려 있는 조상을 찾는다.
 *
 * 잡 프로세스는 `…/ci.slice/gh-runner-…service/…` 처럼 깊이 들어가 있고 memory.max 는
 * 보통 `ci.slice` 에 있다. 계측값(peak/events)도 상한이 걸린 그 층에서 읽어야 의미가 있다.
 */
function budgetDir() {
  let dir = ownCgroupDir();
  for (let depth = 0; dir && depth < 32; depth += 1) {
    const raw = readOptional(join(dir, "memory.max"));
    if (raw && raw !== "max") return dir;
    const parent = dirname(dir);
    if (parent === dir || !parent.startsWith("/sys/fs/cgroup")) break;
    dir = parent;
  }
  return ownCgroupDir();
}

function readOptional(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return null;
  }
}

/** `key value` 줄들을 객체로. cgroup 의 memory.events / cpu.stat 형식. */
function readKeyed(path) {
  const raw = readOptional(path);
  if (!raw) return {};
  return Object.fromEntries(
    raw.split("\n").map((line) => line.split(/\s+/)).filter((parts) => parts.length >= 2)
      .map(([key, value]) => [key, Number(value)]),
  );
}

function sample() {
  const dir = budgetDir();
  if (!dir) return { at: Date.now(), cgroup: null };
  return {
    at: Date.now(),
    cgroup: dir.replace("/sys/fs/cgroup", "") || "/",
    memoryMax: Number(readOptional(join(dir, "memory.max"))) || null,
    memoryHigh: Number(readOptional(join(dir, "memory.high"))) || null,
    memoryCurrent: Number(readOptional(join(dir, "memory.current"))) || 0,
    memoryPeak: Number(readOptional(join(dir, "memory.peak"))) || 0,
    events: readKeyed(join(dir, "memory.events")),
    cpu: readKeyed(join(dir, "cpu.stat")),
  };
}

const gib = (bytes) => (bytes == null ? "—" : `${(bytes / 1024 ** 3).toFixed(2)} GiB`);
const secs = (usec) => (usec == null ? "—" : `${(usec / 1e6).toFixed(0)} s`);

const mode = process.argv[2] ?? "report";

if (mode === "start") {
  mkdirSync(dirname(SNAPSHOT), { recursive: true });
  writeFileSync(SNAPSHOT, `${JSON.stringify(sample(), null, 2)}\n`, "utf8");
  const now = sample();
  console.log(
    now.cgroup
      ? `[ci-resource] 시작 스냅샷: ${now.cgroup} — 상한 ${gib(now.memoryMax)}, 현재 ${gib(now.memoryCurrent)}`
      : "[ci-resource] cgroup v2 를 못 찾았다 — 계측 없이 진행한다.",
  );
  process.exit(0);
}

const end = sample();
if (!end.cgroup) {
  console.log("[ci-resource] cgroup v2 를 못 찾았다 — 리포트를 건너뛴다.");
  process.exit(0);
}
const start = existsSync(SNAPSHOT) ? JSON.parse(readFileSync(SNAPSHOT, "utf8")) : null;
const title = process.argv.slice(3).join(" ") || "CI 자원 사용";
const elapsed = start ? (end.at - start.at) / 1000 : null;
const oomDelta = (end.events.oom_kill ?? 0) - (start?.events?.oom_kill ?? 0);
const highDelta = (end.events.high ?? 0) - (start?.events?.high ?? 0);
const maxDelta = (end.events.max ?? 0) - (start?.events?.max ?? 0);
const cpuDelta = (end.cpu.usage_usec ?? 0) - (start?.cpu?.usage_usec ?? 0);

const rows = [
  ["cgroup", end.cgroup],
  ["경과", elapsed == null ? "—" : `${Math.floor(elapsed / 60)}분 ${Math.round(elapsed % 60)}초`],
  ["메모리 상한", `${gib(end.memoryMax)} (high ${gib(end.memoryHigh)})`],
  ["메모리 피크", gib(end.memoryPeak)],
  ["CPU 사용", secs(cpuDelta)],
  ["throttle(high 초과)", `${highDelta}회`],
  ["상한 도달(max)", `${maxDelta}회`],
  ["**OOM kill**", oomDelta > 0 ? `**${oomDelta}회** ⚠` : "0회"],
];

console.log(`\n[ci-resource] ${title}`);
for (const [key, value] of rows) console.log(`  ${key.replace(/\*/g, "").padEnd(22)} ${String(value).replace(/\*/g, "")}`);
if (oomDelta > 0) {
  console.log(
    "\n  ⚠ 이 슬라이스에서 OOM kill 이 발생했다. 잡이 조용히 죽었다면 원인은 이것이다.\n" +
    "    예산(ci.slice 의 MemoryMax)을 올리거나 vitest 워커를 줄여라 — run-vitest.mjs 가\n" +
    "    cgroup 상한에서 워커·힙을 유도하므로 슬라이스 값만 바꾸면 따라온다.",
  );
}

const summary = process.env.GITHUB_STEP_SUMMARY;
if (summary) {
  const table = [
    `### ${title}`,
    "",
    "| 항목 | 값 |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | ${value} |`),
    "",
  ].join("\n");
  appendFileSync(summary, `${table}\n`, "utf8");
}

// OOM 은 그 자체로 잡을 실패시키지 않는다 — 판정은 게이트가 한다. 여기서는 증거만 남긴다.
process.exit(0);
