// scripts/lib/releaseGate.mjs
// 조건 기반 자동 릴리스의 **순수 판정**. git·gh 호출은 scripts/release-scheduled.mjs 와
// scripts/ci-full-diff.mjs 가 하고, 여기는 모은 값을 받아 판정만 한다.
//
// 규칙 (오너 2026-11-24 조건 기반 도입 → 2026-11-28 초고속 30분 자동 배포 확정):
//   30분마다 확인해서 아래를 모두 만족하면 발행한다.
//   (1) 지난 태그 이후 사용자가 체감할 변경(feat/fix 커밋) 1개 이상
//   (2) 마지막 발행에서 30분(0.5시간) 이상
//   (3) 열린 PR 에 `hold-release` 라벨 없음
//   (4) 하루(최근 24시간) 최대 48판 (< 48)
//   (5) 산출물 대기 중인 초안 없음, 열린 release/next PR 없음
//   ci-full 은 밤 1회 회귀 감시로 분리하고(requireCiFull: false), 릴리스 시점 검증은
//   release/next 에서 직전 태그 대비 ci-related-tests + ci-fast (+ 필요 시 app-update-e2e) 가 맡는다.
//
// (2) 는 v0.418·v0.419 레인이 손으로 한 대조를 그대로 옮긴 것이다: 두 판의 샤드 리포트
// (`gates-report.json`)에서 실패 파일을 모아, 기준 판에서 돌았고 통과했는데 이번 판에서 실패한
// 파일을 «새 실패» 로 센다. 기준 판에서 아예 안 돈 파일의 실패는 «기준 판에 없음» 으로 따로 세고,
// 이것도 막는다(확인할 수 없는 빨강을 조용히 면제하지 않는다 — gatesRegression.mjs 와 같은 원칙).
import { parseCommitSubject } from "./releaseNotes.mjs";
import { UPDATE_FEED_SINCE } from "./releaseAssets.mjs";

export const AUTO_RELEASE_RULES = Object.freeze({
  minUserCommits: 1,
  minHoursSincePublish: 0.5,
  maxReleasesPer24h: 48,
  requireCiFull: false,
  holdLabel: "hold-release",
  autoLabel: "auto-release",
  appUpdateE2eMaxAgeDays: 14,
});

/** 자동 업데이트·Electron 패키징 경로. 이 중 하나라도 직전 릴리스 태그 이후 바뀌면 app-update-e2e 를 반드시 돌린다. */
export const APP_UPDATE_E2E_WATCH_PATTERNS = Object.freeze([
  /^electron\//u,
  /^scripts\/nsis-wine-shim\//u,
  /^scripts\/electron-builder\.config\.mjs$/u,
  /^scripts\/build-electron\.mjs$/u,
  /^scripts\/qa\/app-update-e2e\.mjs$/u,
  /^src\/app\/appUpdateChip\.ts$/u,
  /^\.github\/workflows\/app-update-e2e\.yml$/u,
]);

function compareSemverTag(left, right) {
  const parse = (raw) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)$/u.exec(String(raw ?? "").trim());
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * package.json 또는 package-lock.json 의 전후 텍스트가 오직 루트 프로젝트 `version`
 * (`version` 및 lockfile 의 `packages[""].version`)만 달라졌는지 판정한다.
 * 파싱할 수 없으면 보수적으로 false(의존성·설정 변경으로 간주)를 돌려준다.
 */
export function isManifestDiffOnlyRootVersion(beforeText, afterText) {
  if (typeof beforeText !== "string" || typeof afterText !== "string") return false;
  const normalize = (text) => {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const copy = { ...parsed };
    delete copy.version;
    if (copy.packages && typeof copy.packages === "object" && copy.packages[""] && typeof copy.packages[""] === "object") {
      const rootPkg = { ...copy.packages[""] };
      delete rootPkg.version;
      copy.packages = { ...copy.packages, "": rootPkg };
    }
    return JSON.stringify(copy);
  };
  try {
    const a = normalize(beforeText);
    const b = normalize(afterText);
    return a !== null && b !== null && a === b;
  } catch {
    return false;
  }
}

/**
 * release/next 자동 릴리스에서 app-update-e2e 를 다시 돌려야 하는지 순수 판정한다.
 * 아래가 **모두** 성립할 때만 중복 실행을 건너뛴다(하나라도 불확실하면 실행):
 *   1. 직전 발행 태그(sinceTag)가 자동 업데이트 도입 판(UPDATE_FEED_SINCE) 이상이다.
 *   2. 최근 `appUpdateE2eMaxAgeDays`(14일) 안에 성공한 app-update-e2e 실행 기록이 있다(러너 OS·FUSE 회귀 안전망).
 *   3. `sinceTag..origin/main` 의 변경 파일 목록을 읽었고, 업데이트·Electron·패키징 경로가 0건이다.
 *   4. package.json / package-lock.json 이 바뀌었더라도 루트 version 외에는 바뀐 것이 없다.
 */
export function evaluateAppUpdateE2eNeed({
  sinceTag = null,
  changedFiles = null,
  packageManifestDiffOnlyVersion = true,
  lockfileDiffOnlyVersion = true,
  lastPassingRun = null,
  now = new Date(),
} = {}) {
  const cmp = compareSemverTag(sinceTag, UPDATE_FEED_SINCE);
  if (cmp === null || cmp < 0) {
    return { required: true, reason: `직전 태그(${sinceTag ?? "없음"})가 ${UPDATE_FEED_SINCE} 이전`, matchedFiles: [] };
  }
  if (!lastPassingRun?.completedAt && !lastPassingRun?.createdAt) {
    return { required: true, reason: "최근 성공한 app-update-e2e 기록 없음", matchedFiles: [] };
  }
  const passedAt = new Date(lastPassingRun.completedAt ?? lastPassingRun.createdAt).getTime();
  const nowMs = new Date(now).getTime();
  const maxAgeMs = AUTO_RELEASE_RULES.appUpdateE2eMaxAgeDays * 24 * 3_600_000;
  if (!Number.isFinite(passedAt) || !Number.isFinite(nowMs) || nowMs - passedAt > maxAgeMs) {
    return { required: true, reason: `최근 성공한 app-update-e2e 가 ${AUTO_RELEASE_RULES.appUpdateE2eMaxAgeDays}일보다 오래됨`, matchedFiles: [] };
  }
  if (!Array.isArray(changedFiles)) {
    return { required: true, reason: `${sinceTag} 이후 변경 파일 목록을 읽지 못함`, matchedFiles: [] };
  }
  const matched = [];
  for (const rawFile of changedFiles) {
    const file = String(rawFile ?? "").trim();
    if (!file) continue;
    if (APP_UPDATE_E2E_WATCH_PATTERNS.some((pattern) => pattern.test(file))) {
      matched.push(file);
    } else if (file === "package.json" && !packageManifestDiffOnlyVersion) {
      matched.push(file);
    } else if (file === "package-lock.json" && !lockfileDiffOnlyVersion) {
      matched.push(file);
    }
  }
  if (matched.length > 0) {
    return { required: true, reason: `업데이트 관련 변경 ${matched.length}건 (${matched.slice(0, 4).join(", ")})`, matchedFiles: matched };
  }
  return {
    required: false,
    reason: `${sinceTag} 이후 업데이트·Electron·의존성 변경 없음 (최근 통과 run ${lastPassingRun.id ?? "?"})`,
    matchedFiles: [],
  };
}

/** 사용자가 체감하지 않는 범위. `fix(test): …`·`feat(ci): …` 는 앱을 바꾸지 않는다. */
const NON_USER_SCOPES = new Set(["test", "tests", "ci", "ci-fast", "ci-full", "gates", "release", "deps-dev", "openwiki", "docs"]);

/**
 * 지난 태그 이후 커밋 중 사용자가 체감할 변경(feat·fix, 깨지는 변경 포함)을 고른다.
 * @param {{ sha: string, subject: string }[]} commits
 */
export function selectUserFacingCommits(commits = []) {
  const picked = [];
  for (const commit of commits) {
    const parsed = parseCommitSubject(commit.subject ?? "");
    if (!parsed) continue;
    if (parsed.type !== "feat" && parsed.type !== "fix") continue;
    const scopes = String(parsed.scope ?? "")
      .split(/[,/]/u)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    if (scopes.length > 0 && scopes.every((scope) => NON_USER_SCOPES.has(scope))) continue;
    picked.push({ sha: commit.sha, subject: commit.subject });
  }
  return picked;
}

/**
 * 한 ci-full 판의 샤드 리포트들을 합친다.
 * 실패 파일 = 샤드들의 `tests.failedFiles` 합집합에서 단독 재실행이 통과한 파일(`flakeRetries`)을 뺀 것.
 * @param {object[]} reports gates-report.json 들
 */
export function summarizeShardReports(reports = []) {
  const failed = new Set();
  const ran = new Set();
  const flaky = new Set();
  for (const report of reports) {
    for (const file of report?.tests?.failedFiles ?? []) failed.add(file);
    for (const file of report?.tests?.testFiles ?? []) ran.add(file);
    for (const file of report?.flakeRetries ?? []) flaky.add(file);
  }
  for (const file of flaky) failed.delete(file);
  // 실패 파일은 그 판에서 돈 파일이다(testFiles 가 비어 있는 옛 리포트에서도 대조가 맞도록).
  for (const file of failed) ran.add(file);
  return { failedFiles: [...failed].sort(), ranFiles: [...ran].sort(), flakyFiles: [...flaky].sort() };
}

/**
 * 기준 판 여러 개(새 것부터)를 한 기준으로 겹친다. 파일마다 그 파일을 돌린 **가장 새 판**의 결과를 쓴다.
 * 레인들이 쓰던 «기준 판 + 그 뒤 고친 것» 과 같은 뜻이다: 가장 새 기준 판이 일부 샤드만 남겼으면
 * (v0.418 의 45206810315 는 샤드 14 가 취소됐다) 빠진 파일만 그 앞 판에서 채운다.
 * @param {{ failedFiles: string[], ranFiles: string[] }[]} summaries 새 판부터
 */
export function layerBaselines(summaries = []) {
  const decided = new Map();
  for (const summary of summaries) {
    const failed = new Set(summary.failedFiles);
    for (const file of summary.ranFiles) if (!decided.has(file)) decided.set(file, failed.has(file));
  }
  const ranFiles = [...decided.keys()].sort();
  return { failedFiles: ranFiles.filter((file) => decided.get(file)), ranFiles };
}

/**
 * 이번 판(candidate)을 기준 판(baseline)과 실패 파일 단위로 대조한다.
 * @param {{ failedFiles: string[], ranFiles: string[] }} candidate
 * @param {{ failedFiles: string[], ranFiles: string[] }} baseline
 */
export function diffFailedFiles(candidate, baseline) {
  const baseFailed = new Set(baseline.failedFiles);
  const baseRan = new Set(baseline.ranFiles);
  const candFailed = new Set(candidate.failedFiles);
  const candRan = new Set(candidate.ranFiles);
  const newFailures = [];
  const notInBaseline = [];
  const stillFailing = [];
  for (const file of [...candFailed].sort()) {
    if (baseFailed.has(file)) stillFailing.push(file);
    else if (baseRan.has(file)) newFailures.push(file);
    else notInBaseline.push(file);
  }
  const fixed = [...baseFailed].filter((file) => candRan.has(file) && !candFailed.has(file)).sort();
  return {
    ok: newFailures.length === 0 && notInBaseline.length === 0,
    newFailures,
    notInBaseline,
    stillFailing,
    fixed,
  };
}

/**
 * 판 하나가 대조에 쓸 만큼 완전한가. 시험 잡이 전부 끝(success·failure)났고 잡마다 리포트가 있어야 한다.
 * @param {{ testJobs: { name: string, conclusion: string | null }[], reportCount: number }} run
 */
export function runCompleteness({ testJobs = [], reportCount = 0 }) {
  const finished = testJobs.filter((job) => job.conclusion === "success" || job.conclusion === "failure");
  const complete = testJobs.length > 0 && finished.length === testJobs.length && reportCount === testJobs.length;
  return { complete, testJobs: testJobs.length, finished: finished.length, reports: reportCount };
}

const HOUR_MS = 3_600_000;

/**
 * 모은 값으로 발행 여부를 정한다. 모든 검사를 항상 다 계산해 이유를 남긴다.
 * @param {object} input
 * @param {{ sha: string, subject: string }[]} input.userCommits   selectUserFacingCommits 결과
 * @param {string | null} input.sinceTag
 * @param {{ ok: boolean, newFailures?: string[], notInBaseline?: string[], error?: string, candidate?: object, baseline?: object } | null} input.ciDiff
 * @param {string | null} input.lastPublishedAt  마지막으로 발행된(초안 아님) 릴리스의 published_at
 * @param {string[]} input.recentReleaseTags      최근 24시간 안에 만들어진 릴리스 태그(초안 포함)
 * @param {{ number: number, title?: string }[]} input.holdPrs
 * @param {string[]} input.draftTags              아직 초안인 vX.Y.Z 릴리스(산출물 대기)
 * @param {{ number: number, auto: boolean } | null} input.openReleasePr
 * @param {Date | string | number} input.now
 */
export function decideAutoRelease(input) {
  const rules = AUTO_RELEASE_RULES;
  const now = new Date(input.now ?? Date.now()).getTime();
  const checks = [];
  const add = (id, label, ok, value, need) => checks.push({ id, label, ok: Boolean(ok), value, need });

  const userCount = (input.userCommits ?? []).length;
  add("user-commits", `${input.sinceTag ?? "태그"} 이후 사용자 체감 변경(feat/fix)`, userCount >= rules.minUserCommits, `${userCount}개`, `${rules.minUserCommits}개 이상`);

  const requireCiFull = input.requireCiFull ?? rules.requireCiFull;
  if (requireCiFull) {
    const diff = input.ciDiff;
    let ciValue;
    if (!diff) ciValue = "대조 안 함";
    else if (diff.error) ciValue = `판정 불가: ${diff.error}`;
    else {
      const n = (diff.newFailures ?? []).length;
      const u = (diff.notInBaseline ?? []).length;
      ciValue = `새 실패 ${n} · 기준 판에 없던 파일 실패 ${u}`;
    }
    add("ci-full", "main 마지막 ci-full 대 기준 판", Boolean(diff && !diff.error && diff.ok), ciValue, "새 실패 0");
  } else {
    add("ci-full", "ci-full 게이트", true, "게이트 분리 (밤 1회 감시 · 릴리스는 ci-fast + ci-related-tests)", "분리됨");
  }

  let hours = null;
  if (input.lastPublishedAt) hours = (now - new Date(input.lastPublishedAt).getTime()) / HOUR_MS;
  const formatCooldown = (value) => (value < 1 ? `${Math.round(value * 60)}분` : `${value}시간`);
  const formatElapsed = (value) => (value < 1 ? `${Math.round(value * 60)}분` : `${value.toFixed(1)}시간`);
  add(
    "since-publish",
    "마지막 발행 이후",
    hours === null || hours >= rules.minHoursSincePublish,
    hours === null ? "발행 기록 없음" : formatElapsed(hours),
    `${formatCooldown(rules.minHoursSincePublish)} 이상`,
  );

  const holds = input.holdPrs ?? [];
  add("hold-label", `열린 PR 의 ${rules.holdLabel} 라벨`, holds.length === 0, holds.length === 0 ? "없음" : holds.map((pr) => `#${pr.number}`).join(", "), "없음");

  const recent = input.recentReleaseTags ?? [];
  add("daily-cap", "최근 24시간 릴리스", recent.length < rules.maxReleasesPer24h, `${recent.length}판${recent.length ? ` (${recent.join(", ")})` : ""}`, `${rules.maxReleasesPer24h}판 미만`);

  const drafts = input.draftTags ?? [];
  add("no-draft", "산출물 대기 중인 초안", drafts.length === 0, drafts.length === 0 ? "없음" : drafts.join(", "), "없음");

  const open = input.openReleasePr;
  add(
    "no-open-release-pr",
    "열린 release/next PR",
    !open,
    open ? `#${open.number}${open.auto ? " (자동, 앞 회차가 머지 못 함)" : " (사람이 진행 중)"}` : "없음",
    "없음",
  );

  const failed = checks.filter((check) => !check.ok);
  return {
    release: failed.length === 0,
    checks,
    reasons: failed.map((check) => `${check.label}: ${check.value} (필요: ${check.need})`),
  };
}

/** 워크플로 요약(마크다운). 사람이 Actions 화면에서 바로 읽는다. */
export function renderGateSummary({ decision, at, dryRun, ciDiff }) {
  const lines = [
    `## 자동 릴리스 판정 ${decision.release ? "✅ 발행" : "⏸ 넘어감"}${dryRun ? " (건조 실행)" : ""}`,
    "",
    `판정 시각: ${at}`,
    "",
    "| 조건 | 값 | 필요 | 결과 |",
    "|---|---|---|---|",
    ...decision.checks.map((check) => `| ${check.label} | ${check.value} | ${check.need} | ${check.ok ? "통과" : "불통"} |`),
  ];
  if (ciDiff && !ciDiff.error) {
    lines.push("", `ci-full 대조: 이번 판 ${ciDiff.candidate?.id ?? "?"} (${String(ciDiff.candidate?.headSha ?? "").slice(0, 9)}) · 기준 판 ${(ciDiff.baselineLayers ?? [ciDiff.baseline]).filter(Boolean).map((run) => `${run.id} (${String(run.headSha ?? "").slice(0, 9)}${run.complete ? "" : `, 샤드 ${run.reports}/${run.testJobs}`})`).join(" → ")}`);
    for (const [title, list] of [["새 실패", ciDiff.newFailures], ["기준 판에 없던 파일의 실패", ciDiff.notInBaseline], ["고쳐진 파일", ciDiff.fixed]]) {
      if (list?.length) lines.push("", `<details><summary>${title} ${list.length}</summary>`, "", ...list.map((file) => `- ${file}`), "", "</details>");
    }
  }
  if (!decision.release) lines.push("", "넘어간 이유:", ...decision.reasons.map((reason) => `- ${reason}`));
  return `${lines.join("\n")}\n`;
}
