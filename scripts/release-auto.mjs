#!/usr/bin/env node
// scripts/release-auto.mjs
// 릴리스를 "잊지 않게" 하는 로컬 자동화. 두 단계가 있고 둘 다 멱등하다.
//
//   ① 발행 — 릴리스 PR 이 머지됐는데 태그가 없으면: 태그 + GitHub Release
//   ② 제안 — 마지막 태그 이후 커밋이 있으면: release/next 브랜치와 PR 생성/갱신
//
// 왜 로컬인가 — 이 저장소의 GitHub Actions 가 꺼져 있다(repos/.../actions/permissions
// → enabled:false). 대신 이 machine 에 이미 PR 감시 타이머가 있고, 여기서 돌리면
// 릴리스 산출물 생성기를 하나 더 만들지 않아도 된다(scripts/lib/releaseFiles.mjs 공유).
// release-please 와 **같은 의미**다: 자동은 제안까지, 결정은 PR 머지.
//
// 태그를 자동으로 만드는 시점은 **머지된 뒤**뿐이다. 그래서 이 스크립트는
// 사람이 PR 을 머지하지 않으면 아무 릴리스도 내지 않는다.
//
// 사용:
//   node scripts/release-auto.mjs                  # ① + ②
//   node scripts/release-auto.mjs --dry-run        # 계획만 (아무것도 쓰지 않음)
//   node scripts/release-auto.mjs --skip-publish   # 제안만
//   node scripts/release-auto.mjs --skip-propose   # 발행만
//   node scripts/release-auto.mjs --no-gh          # PR 없이 브랜치 푸시까지만
//   node scripts/release-auto.mjs --kind minor     # 자동 판정 덮어쓰기

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RELEASE_LOG_FORMAT, buildReleaseSections, bumpVersion, collectReleaseItems, decideReleaseKind, parseReleaseLog, renderReleaseNotes } from "./lib/releaseNotes.mjs";
import { bumpManifestVersion, changelogEntryFor, localDate, writeChangelog } from "./lib/releaseFiles.mjs";

const PROPOSE_BRANCH = "release/next";
const PROPOSE_BRANCH_TITLE = "release/next";
const root = process.cwd();

function run(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${command} ${args.join(" ")} 실패${stderr ? `: ${stderr}` : ""}`);
  }
}

const git = (args, options) => run("git", args, options);
const gh = (args, options = {}) => run("gh", args, options);

function parseArgs(argv) {
  const args = { dryRun: false, skipPublish: false, skipPropose: false, useGh: true, kind: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--skip-publish") args.skipPublish = true;
    else if (arg === "--skip-propose") args.skipPropose = true;
    else if (arg === "--no-gh") args.useGh = false;
    else if (arg === "--kind") args.kind = argv[++i] ?? null;
    else throw new Error(`모르는 인자입니다: ${arg}`);
  }
  return args;
}

function commitsSince(base, tag) {
  const range = tag ? [base, `^${tag}`] : [base];
  return parseReleaseLog(git(["log", "--no-merges", RELEASE_LOG_FORMAT, ...range], { allowFailure: true }) ?? "");
}

function manifestVersionAt(rev) {
  const raw = git(["show", `${rev}:package.json`], { allowFailure: true });
  if (!raw) return null;
  return JSON.parse(raw).version ?? null;
}

function nearestTag(rev) {
  return git(["describe", "--tags", "--match", "v*", "--abbrev=0", rev], { allowFailure: true });
}

function hasTag(tag) {
  return Boolean(git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { allowFailure: true }));
}

function versionGreater(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

function nextReleaseVersion(packageVersion, tag, kind) {
  const tagged = (tag ?? "").replace(/^v/, "");
  const base = tagged && versionGreater(tagged, packageVersion) ? tagged : packageVersion;
  let next = bumpVersion(base, kind);
  while (hasTag(`v${next}`)) next = bumpVersion(next, "patch");
  return next;
}

/**
 * ① 발행 — main 의 package.json 버전과 마지막 태그가 어긋나면 그 버전이 머지된 것이므로
 * 그 커밋에 주석 태그를 만들고 GitHub Release 를 낸다. 태그 본문은 CHANGELOG 의 그 절이다.
 */
function publish(args) {
  const version = manifestVersionAt("origin/main");
  if (!version) return { step: "publish", result: "package.json 을 못 읽음" };
  const tag = `v${version}`;
  if (nearestTag("origin/main") === tag || hasTag(tag)) {
    return { step: "publish", result: `${tag} 이미 있음` };
  }
  if (args.dryRun) return { step: "publish", result: `${tag} 를 만들 것`, dryRun: true };

  const commit = (git(["log", "--format=%H", "-1", "-S", `"version": "${version}"`, "origin/main", "--", "package.json"], { allowFailure: true }) ?? "")
    .split("\n")[0];
  if (!commit) return { step: "publish", result: `version ${version} 를 올린 커밋을 못 찾음` };

  const changelog = git(["show", `${commit}:CHANGELOG.md`], { allowFailure: true }) ?? "";
  const body = changelogEntryFor(changelog, version) ?? `${tag} 릴리스`;
  git(["tag", "-a", tag, "-m", body, commit]);
  git(["push", "origin", tag]);
  if (args.useGh) gh(["release", "create", tag, "--title", tag, "--notes-from-tag"]);
  return { step: "publish", result: `${tag} 발행`, commit: commit.slice(0, 9) };
}

function prBody(version, kind, notes) {
  const why = kind === "minor" ? "기능 또는 깨지는 변경" : "버그·정리";
  return [
    "이 PR 은 **자동 제안**이다. 머지하는 순간이 릴리스 결정이다.",
    "",
    `- 다음 버전: \`${version}\` (${why}) — \`package.json\`·\`package-lock.json\` 범프 + \`CHANGELOG.md\` 항목`,
    `- 머지하면 \`scripts/release-auto.mjs\` 가 태그 \`v${version}\` 과 GitHub Release 를 만든다`,
    `- 지금 손으로 내려면: \`npm run release -- --${kind}\``,
    "",
    "---",
    "",
    notes,
  ].join("\n");
}

/**
 * ② 제안 — 마지막 태그 이후 커밋으로 다음 버전을 정하고 release/next 브랜치를 다시 만든다.
 * 브랜치는 매번 origin/main 에서 다시 만들고, 트리가 같으면 아무것도 하지 않는다(멱등).
 */
function propose(args) {
  const base = "origin/main";
  const version = manifestVersionAt(base);
  if (!version) return { step: "propose", result: "package.json 을 못 읽음" };
  const tag = nearestTag(base);
  const commits = commitsSince(base, tag);
  if (commits.length === 0) return { step: "propose", result: `${tag ?? "태그"} 이후 커밋 없음` };

  const kind = args.kind ?? decideReleaseKind(commits);
  if (!kind) return { step: "propose", result: "낼 만한 변경 없음(문서·테스트·잡무만)" };

  // 긴 브랜치 병합이 package.json 버전을 태그보다 뒤로 되돌리면(실측 #1818 → 0.53.0, 태그는 v0.54.0)
  // 계산된 다음 태그가 이미 있다. 그때 멈추지 않고 태그 버전에서 이어서 올린다.
  const next = nextReleaseVersion(version, tag, kind);
  const nextTag = `v${next}`;
  if (hasTag(nextTag)) return { step: "propose", result: `${nextTag} 이미 있음` };

  const sections = buildReleaseSections(collectReleaseItems(commits));
  const notes = renderReleaseNotes({ version: next, date: localDate(), sections });
  if (args.dryRun) {
    return { step: "propose", result: `${nextTag} 제안(커밋 ${commits.length}건)`, dryRun: true, notes };
  }

  const scratch = join(tmpdir(), "oprn-release-next");
  if (existsSync(scratch)) rmSync(scratch, { recursive: true, force: true });
  git(["worktree", "prune"]);
  git(["worktree", "add", "--force", "-B", PROPOSE_BRANCH, scratch, base]);
  let tree;
  try {
    bumpManifestVersion(scratch, "package.json", version, next, 1);
    if (existsSync(join(scratch, "package-lock.json"))) {
      bumpManifestVersion(scratch, "package-lock.json", version, next, 2);
    }
    writeChangelog(scratch, notes);
    git(["-C", scratch, "add", "-A"]);
    tree = git(["-C", scratch, "write-tree"]);
    const remoteTree = git(["rev-parse", `refs/remotes/origin/${PROPOSE_BRANCH}^{tree}`], { allowFailure: true });
    if (remoteTree && remoteTree === tree) {
      return { step: "propose", result: `${nextTag} 제안이 이미 열려 있음` };
    }
    git(["-C", scratch, "commit", "-qm", `chore(release): ${nextTag}`]);
    git(["push", "--force-with-lease", "origin", `${PROPOSE_BRANCH}:${PROPOSE_BRANCH}`]);
  } finally {
    git(["worktree", "remove", "--force", scratch], { allowFailure: true });
  }

  if (!args.useGh) return { step: "propose", result: `${nextTag} 브랜치 푸시(--no-gh)`, version: next };

  const head = PROPOSE_BRANCH_TITLE;
  const listed = gh(["pr", "list", "--head", head, "--state", "open", "--json", "number,body"], { allowFailure: true }) ?? "[]";
  const open = JSON.parse(listed || "[]");
  const title = `chore(release): ${nextTag}`;
  const bodyFile = join(tmpdir(), `oprn-release-pr-${next}.md`);
  writeFileSync(bodyFile, prBody(next, kind, notes));
  if (open.length === 0) {
    const url = gh(["pr", "create", "--base", "main", "--head", head, "--title", title, "--body-file", bodyFile]);
    return { step: "propose", result: `${nextTag} PR 생성`, version: next, pr: url.split("/").pop() };
  }
  const existing = open[0];
  const same = String(existing.body ?? "").trim() === readFileSync(bodyFile, "utf8").trim();
  if (!same) gh(["pr", "edit", String(existing.number), "--title", title, "--body-file", bodyFile]);
  return { step: "propose", result: same ? `${nextTag} PR 그대로` : `${nextTag} PR 갱신`, version: next, pr: `#${existing.number}` };
}

const args = parseArgs(process.argv.slice(2));
const results = [];
try {
  git(["fetch", "origin", "--tags", "--quiet"], { allowFailure: true });
  if (!args.skipPublish) results.push(publish(args));
  if (!args.skipPropose) results.push(propose(args));
} catch (error) {
  console.error(`[release-auto] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
for (const entry of results) {
  const extra = entry.pr ? ` · PR ${entry.pr}` : entry.commit ? ` · ${entry.commit}` : entry.version ? ` · ${entry.version}` : "";
  console.log(`[release-auto] ${entry.step}: ${entry.result}${extra}`);
  if (entry.notes) console.log(`\n${entry.notes}`);
}
