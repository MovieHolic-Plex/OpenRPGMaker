#!/usr/bin/env node
// scripts/release.mjs
// 릴리스 자르기 — 버전 범프 + CHANGELOG 생성 + 주석 태그. 푸시는 하지 않는다(사람이 확인하고 민다).
//
// 사용:
//   npm run release -- --first                        첫 릴리스: 현재 package.json 버전을 그대로 태그
//   npm run release -- --minor                        0.1.0 → 0.2.0
//   npm run release -- --patch                        0.1.0 → 0.1.1
//   npm run release -- --major                        0.1.0 → 1.0.0
//   npm run release -- --set 0.3.0                    버전 직접 지정
//   npm run release -- --minor --summary "로컬 저장"    사람이 쓰는 표제 한 줄
//   npm run release -- --minor --dry-run              아무것도 쓰지 않고 계획과 노트만 출력
//
// 왜 매 머지가 아니라 사람이 부르는가 —
//   실측: 지난 7일 머지 184건(하루 약 26건). 매 머지마다 버전을 올리면 하루에 26개 버전이
//   생겨 숫자가 아무 약속도 하지 않는다. 머지마다 자동으로 바뀌는 것은 **빌드 식별자**
//   (`0.1.0-dev.184+gddc7a88`, scripts/lib/appVersion.mjs)이고 릴리스 버전은 여기서만 올린다.
//
// 순서: 검사 → 버전 계산 → 커밋 수집 → 노트 생성 → (dry-run 이면 출력) → 파일 쓰기 → 커밋 → 태그.
// 실패는 전부 던진다. 반쯤 쓴 릴리스(버전만 올라간 커밋)를 만들지 않는다.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readAppVersion } from "./lib/appVersion.mjs";
import { buildReleaseSections, bumpVersion, collectReleaseItems, renderReleaseNotes } from "./lib/releaseNotes.mjs";

const CHANGELOG_FILE = "CHANGELOG.md";
const RELEASE_TAG_PREFIX = "v";
/** 첫 릴리스 노트가 저장소 전체 이력(수천 건)을 나열하지 않게 하는 상한. */
const FIRST_RELEASE_LIMIT = 300;
const CHANGELOG_HEADER = `# 변경 기록

이 파일은 \`npm run release\` 가 커밋 메시지에서 생성한다. 손으로 고치지 말 것 —
고칠 것은 커밋 메시지다(\`feat:\` \`fix:\` \`refactor:\` … 규약은 openwiki/release-and-version.md).

<!-- releases -->
`;

const root = process.cwd();

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

const USAGE = `사용: npm run release -- (--first | --patch | --minor | --major | --set X.Y.Z) [--summary "표제"] [--dry-run]

  --first        첫 릴리스. 현재 package.json 버전을 그대로 태그한다(범프 없음).
  --patch        버그·수정만.
  --minor        0.x 에서는 깨지는 변경도 여기다.
  --major        1.0.0 선언.
  --set X.Y.Z    버전을 직접 지정.
  --summary      릴리스 노트 맨 위에 붙는 사람이 쓴 한 줄.
  --dry-run      파일·커밋·태그를 만들지 않고 계획과 노트만 출력.
  --limit N      수집할 커밋 수 상한(기본: 일반 릴리스는 무제한, --first 는 ${FIRST_RELEASE_LIMIT}).`;

function parseArgs(argv) {
  const args = { kind: null, set: null, summary: null, dryRun: false, first: false, limit: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--first") args.first = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--patch" || arg === "--minor" || arg === "--major") args.kind = arg.slice(2);
    else if (arg === "--set") args.set = argv[++i] ?? null;
    else if (arg === "--summary") args.summary = argv[++i] ?? null;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
    else fail(`모르는 인자입니다: ${arg}`);
  }
  return args;
}

/** 버전 문자열을 name 표제에 못 박아 찾는다 — 의존성의 같은 버전 문자열을 건드리지 않기 위해서다. */
function bumpManifestVersion(file, from, to, expectedMatches) {
  const path = join(root, file);
  const text = readFileSync(path, "utf8");
  const pattern = new RegExp(`("name":\\s*"oprn",\\s*\\n\\s*"version":\\s*")${from.replace(/\./g, "\\.")}(")`, "g");
  const matches = text.match(pattern) ?? [];
  if (matches.length !== expectedMatches) {
    fail(`${file} 에서 버전 자리를 ${expectedMatches}개 찾아야 하는데 ${matches.length}개 찾았습니다 — 손으로 확인하세요.`);
  }
  const next = text.replace(pattern, `$1${to}$2`);
  const parsed = JSON.parse(next);
  if (parsed.version !== to) fail(`${file} 검증 실패: version=${parsed.version}`);
  writeFileSync(path, next);
  return parsed;
}

function writeChangelog(entry) {
  const path = join(root, CHANGELOG_FILE);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (!existing.trim()) {
    writeFileSync(path, `${CHANGELOG_HEADER}\n${entry}`);
    return;
  }
  const marker = existing.indexOf("<!-- releases -->");
  if (marker < 0) {
    // 표식이 없는 파일(사람이 시작한 CHANGELOG)도 덮지 않는다 — 첫 `## ` 앞에 끼워 넣는다.
    const firstEntry = existing.indexOf("\n## ");
    const head = firstEntry < 0 ? existing.trimEnd() : existing.slice(0, firstEntry).trimEnd();
    const tail = firstEntry < 0 ? "" : existing.slice(firstEntry);
    writeFileSync(path, `${head}\n\n${entry}${tail}`);
    return;
  }
  const insertAt = existing.indexOf("\n", marker) + 1;
  writeFileSync(path, `${existing.slice(0, insertAt)}\n${entry}${existing.slice(insertAt)}`);
}

/** 릴리스 날짜는 로컬 기준이다 — KST 새벽에 자른 릴리스가 전날로 적히면 안 된다. */
function localDate(when = new Date()) {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

function collectCommits(range, limit) {
  const args = ["log", "--no-merges", "--pretty=format:%H%x09%s"];
  if (limit) args.push(`-n${limit}`);
  if (range) args.push(range);
  const output = git(args, { allowFailure: true }) ?? "";
  return output
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const [sha, ...rest] = line.split("\t");
      return { sha, subject: rest.join("\t") };
    });
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

if (!existsSync(join(root, "package.json"))) fail("package.json 이 없습니다. 저장소 트리 루트에서 실행하세요.");
if (!git(["rev-parse", "--is-inside-work-tree"], { allowFailure: true })) fail("git 저장소가 아닙니다.");

// 0. 릴리스 대상 파일이 이미 더러우면 멈춘다 — 사람의 미완성 편집을 릴리스 커밋에 섞지 않는다.
const dirty = git(["status", "--porcelain", "--", "package.json", "package-lock.json", CHANGELOG_FILE], { allowFailure: true });
if (dirty) fail(`다음 파일에 미커밋 변경이 있습니다. 먼저 정리하세요:\n${dirty}`);

const info = readAppVersion(root);
const headTag = git(["describe", "--tags", "--match", `${RELEASE_TAG_PREFIX}*`, "--abbrev=0"], { allowFailure: true });

// 1. 다음 버전과 태그.
let version;
if (args.first) {
  if (headTag) fail(`이미 ${headTag} 태그가 있습니다. --first 는 릴리스 태그가 하나도 없을 때만 씁니다.`);
  version = info.version;
} else {
  if (!args.kind && !args.set) fail(`범프 종류가 필요합니다.\n\n${USAGE}`);
  if (args.kind && args.set) fail("--patch/--minor/--major 와 --set 은 함께 쓸 수 없습니다.");
  version = args.set ?? bumpVersion(info.version, args.kind);
  if (version === info.version) fail(`버전이 그대로입니다(${version}). --first 를 쓰거나 다른 버전을 지정하세요.`);
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`semver 가 아닙니다: ${version}`);
}
const tag = `${RELEASE_TAG_PREFIX}${version}`;
if (git(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], { allowFailure: true })) fail(`${tag} 태그가 이미 있습니다.`);

// 2. 노트.
const limit = args.limit ?? (args.first ? FIRST_RELEASE_LIMIT : null);
if (!args.first && !headTag) fail("릴리스 태그가 아직 없습니다. 첫 릴리스는 --first 로 자르세요.");
const range = args.first ? null : `${headTag}..HEAD`;
if (range) {
  const sinceTag = collectCommits(range, null);
  if (sinceTag.length === 0) fail(`${headTag} 이후 커밋이 없습니다. 낼 릴리스가 없습니다.`);
}
const allCommits = collectCommits(range, null);
const commits = limit ? allCommits.slice(0, limit) : allCommits;
const items = collectReleaseItems(commits);
const sections = buildReleaseSections(items);
const date = localDate();
const notes = renderReleaseNotes({
  version,
  date,
  summary: args.summary,
  sections,
  omitted: allCommits.length - commits.length,
});

const bumps = args.first ? [] : ["package.json", ...(existsSync(join(root, "package-lock.json")) ? ["package-lock.json"] : [])];
const plan = [
  `버전           ${info.version} → ${version}   (지금 이 커밋의 빌드 라벨 ${info.label})`,
  `태그           ${tag} — 주석 태그, 본문 = 릴리스 노트`,
  args.first ? "package.json   범프 없음 (--first)" : `package.json   version 필드 갱신 (+ ${bumps.slice(1).join(", ") || "lock 없음"})`,
  "CHANGELOG.md   항목 1개 추가",
  `수집 범위      ${range ?? "저장소 전체(상한 적용)"} · 커밋 ${commits.length}건 → 노트 ${items.length}줄`,
];

if (args.dryRun) {
  console.log("[release] dry-run — 아무것도 쓰지 않았습니다.\n");
  console.log(plan.map((line) => `  ${line}`).join("\n"));
  console.log(`\n----- CHANGELOG 에 들어갈 내용 -----\n${notes}`);
  process.exit(0);
}

// 3. 파일 쓰기.
for (const file of bumps) {
  bumpManifestVersion(file, info.version, version, file === "package.json" ? 1 : 2);
}
writeChangelog(notes);

// 4. 커밋과 태그.
git(["add", "--", CHANGELOG_FILE, ...bumps]);
git(["commit", "-m", `chore(release): ${tag}`]);
git(["tag", "-a", tag, "-m", notes.trimEnd()]);

console.log(`[release] ${tag} 완료.\n`);
console.log(plan.map((line) => `  ${line}`).join("\n"));
console.log(`
다음 단계 (자동으로 하지 않는다 — 사람이 확인하고 민다):
  git push origin HEAD
  git push origin ${tag}
  gh release create ${tag} --title "${tag}" --notes-from-tag
`);