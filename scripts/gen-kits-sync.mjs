#!/usr/bin/env node
// 생성기 저장소(object-gen·char-gen·tile-gen)를 tiledata/gen-kits.lock.json 의 고정 커밋으로 묶는다(선례: worldmap-kit-sync.mjs).
//
//   npm run gen-kits:sync                    # lock 커밋에서 생성물을 다시 만든다(object-gen 상수·그림) + 모든 계약 검사
//   npm run gen-kits:sync -- --check         # 생성물이 lock 커밋과 같은지·계약이 맞는지만 본다(다르면 exit 1)
//   npm run gen-kits:sync -- --drift         # lock 커밋과 각 저장소 main 의 차이(커밋 수·바뀐 파일·상수 차이)를 보고한다
//   npm run gen-kits:sync -- --drift --json  # 같은 보고를 JSON 으로
//   npm run gen-kits:sync -- --bump object-gen   # 그 저장소 main 으로 lock 을 올리고 다시 만든다(계약이 깨지면 올리지 않는다)
//   npm run gen-kits:check                   # CI 용: --check --only object-gen --max-behind 10 (생성물이 lock 과 다르거나, lock 이 main 보다 10커밋 넘게 뒤처지면 exit 1)
//     --only a,b        이 생성기만 본다(CI 러너는 비공개 저장소를 못 받는다)
//     --max-behind N    lock 이 그 저장소 main 보다 N 커밋 넘게 뒤처지면 실패. 뒤처짐이 1~N 이면 큰 경고만(GitHub Actions 주석 포함)
//
// 저장소는 .gen-kits/<kit>.git 에 bare 로 받는다(작업 트리 없음 — 파일은 git show <커밋>:<경로> 로 읽는다).
// 비공개 저장소(char-gen·tile-gen)는 사용자의 git 자격으로 받고, 그 글은 생성물에 넣지 않는다(공개 모노레포로 새지 않게) — 계약만 본다.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = join(root, "tiledata/gen-kits.lock.json");
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const cacheDir = resolve(root, process.env.OPRN_GEN_KITS_DIR || ".gen-kits");
const summaryOut = "src/harnesses/_core/workshop/genKits/kits.json";
const only = (opt("--only") ?? "").split(",").map((name) => name.trim()).filter(Boolean);
const kitEntries = () => Object.entries(lock.kits).filter(([kit]) => !only.length || only.includes(kit));
if (only.some((name) => !lock.kits[name])) throw new Error(`lock 에 없는 생성기: ${only.filter((name) => !lock.kits[name]).join(", ")}`);

const gitDir = (kit) => join(cacheDir, `${kit}.git`);
const git = (kit, ...args) => execFileSync("git", ["--git-dir", gitDir(kit), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 }).trim();
const gitBytes = (kit, ...args) => execFileSync("git", ["--git-dir", gitDir(kit), ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });

function ensureRepo(kit, spec, wanted) {
  if (!existsSync(gitDir(kit))) {
    mkdirSync(cacheDir, { recursive: true });
    execFileSync("git", ["clone", "--bare", "--quiet", spec.repo, gitDir(kit)], { stdio: ["ignore", "inherit", "inherit"] });
  }
  for (const commit of wanted) {
    try { git(kit, "cat-file", "-e", `${commit}^{commit}`); } catch {
      execFileSync("git", ["--git-dir", gitDir(kit), "fetch", "--quiet", "origin", `+refs/heads/*:refs/heads/*`], { stdio: ["ignore", "inherit", "inherit"] });
      git(kit, "cat-file", "-e", `${commit}^{commit}`);
    }
  }
}

function remoteHead(kit, spec) {
  const line = execFileSync("git", ["ls-remote", spec.repo, `refs/heads/${spec.branch}`], { encoding: "utf8" }).trim();
  const sha = line.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error(`${kit}: ${spec.branch} 브랜치 머리를 못 읽었다(접근 권한?)`);
  return sha;
}

const listFiles = (kit, commit) => git(kit, "ls-tree", "-r", "--name-only", commit).split("\n").filter(Boolean);
const globToRegex = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
const show = (kit, commit, path) => git(kit, "show", `${commit}:${path}`);

/** 계약: 편집기가 기대는 것(묶음 형식·CLI 동사·지형 종류). 어긋나면 문제 목록. */
function contractProblems(kit, spec, commit) {
  const problems = [];
  for (const rule of spec.contract ?? []) {
    let text;
    try { text = show(kit, commit, rule.file); } catch { problems.push(`${rule.file} 이 없다`); continue; }
    for (const needle of rule.contains ?? []) if (!text.includes(needle)) problems.push(`${rule.file} 에 「${needle}」 이 없다`);
    for (const verb of rule.verbs ?? []) if (!new RegExp(`add_parser\\(\\s*["']${verb}["']`).test(text)) problems.push(`${rule.file} 에 CLI 동사 ${verb} 가 없다`);
  }
  return problems;
}

/** object-gen 같은 공개 저장소: 모듈 상수 + 글 파일을 하나의 JSON 으로. 그림은 public/ 아래로 복사(복사할 목록을 돌려준다). */
function vendor(kit, spec, commit) {
  const files = listFiles(kit, commit);
  const sources = Object.fromEntries(spec.vendor.modules.map((path) => [path, show(kit, commit, path)]));
  const constants = JSON.parse(execFileSync("python3", [join(root, "scripts/lib/gen-kits-extract.py")], { input: JSON.stringify(sources), encoding: "utf8", maxBuffer: 64 << 20 }));
  const textFiles = {};
  for (const glob of spec.vendor.files ?? []) {
    const re = globToRegex(glob);
    for (const path of files.filter((file) => re.test(file)).sort()) textFiles[path] = show(kit, commit, path);
  }
  const copies = [];
  for (const rule of spec.vendor.copy ?? []) {
    for (const path of files.filter((file) => file.startsWith(rule.from) && file.endsWith(rule.ext)).sort()) {
      copies.push({ from: path, to: join(rule.to, path.slice(rule.from.length)) });
    }
  }
  const json = JSON.stringify({ kit, repo: spec.repo, commit, constants, files: textFiles, assets: copies.map((c) => `/${c.to.replace(/^public\//, "")}`) }, null, 1) + "\n";
  return { json, copies };
}

/**
 * 지시문·판정 기준 파일의 지문(sha256 앞 16자). 비공개 저장소는 글을 옮기지 않으므로 지문만 남긴다 —
 * lock 을 올리면 지문이 바뀌어 「char-gen 의 지시문·판정 기준이 바뀌었다」가 생성물 diff 에 보인다.
 */
function fingerprints(kit, spec, commit) {
  const out = {};
  for (const path of spec.fingerprint ?? []) {
    try { out[path] = createHash("sha256").update(gitBytes(kit, "show", `${commit}:${path}`)).digest("hex").slice(0, 16); } catch { out[path] = "missing"; }
  }
  return out;
}

function summary(results) {
  return JSON.stringify({
    note: "생성물 — 손으로 고치지 말 것(npm run gen-kits:sync). 공방이 어느 생성기 커밋을 따르는지 보인다.",
    kits: Object.fromEntries(results.map((r) => [r.kit, { repo: r.repo, visibility: r.visibility, commit: r.commit, vendored: r.vendored, contract: r.problems.length ? r.problems : "ok", ...(Object.keys(r.fingerprint).length ? { fingerprint: r.fingerprint } : {}) }])),
  }, null, 1) + "\n";
}

function build(write) {
  const results = [];
  const mismatches = [];
  for (const [kit, spec] of kitEntries()) {
    if (!/^[0-9a-f]{40}$/.test(spec.commit)) throw new Error(`${kit}: lock commit 이 40자 해시가 아니다`);
    ensureRepo(kit, spec, [spec.commit]);
    const problems = contractProblems(kit, spec, spec.commit);
    const vendored = Boolean(spec.vendor);
    results.push({ kit, repo: spec.repo, visibility: spec.visibility, commit: spec.commit, problems, vendored, fingerprint: fingerprints(kit, spec, spec.commit) });
    if (!spec.vendor) continue;
    if (spec.visibility !== "public") throw new Error(`${kit}: 비공개 저장소는 vendor 할 수 없다(공개 모노레포로 새어 나간다)`);
    const { json, copies } = vendor(kit, spec, spec.commit);
    const outPath = join(root, spec.vendor.out);
    if (!existsSync(outPath) || readFileSync(outPath, "utf8") !== json) mismatches.push(spec.vendor.out);
    if (write) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, json); }
    for (const copy of copies) {
      const bytes = gitBytes(kit, "show", `${spec.commit}:${copy.from}`);
      const target = join(root, copy.to);
      if (!existsSync(target) || !readFileSync(target).equals(bytes)) mismatches.push(copy.to);
      if (write) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes); }
    }
  }
  const summaryPath = join(root, summaryOut);
  if (only.length) {
    // 일부만 볼 때: 요약 파일의 그 생성기 줄(커밋)만 맞춰 본다(나머지는 받지 못했을 수 있다).
    const current = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, "utf8")).kits ?? {} : {};
    for (const r of results) if (current[r.kit]?.commit !== r.commit) mismatches.push(`${summaryOut} (${r.kit})`);
  } else {
    const summaryText = summary(results);
    if (!existsSync(summaryPath) || readFileSync(summaryPath, "utf8") !== summaryText) mismatches.push(summaryOut);
    if (write) writeFileSync(summaryPath, summaryText);
  }
  return { results, mismatches };
}

/** lock 커밋 → main: 커밋 목록, 계약·뽑는 파일 중 바뀐 것, (공개 저장소면) 상수 이름별 차이. */
function drift() {
  const report = [];
  for (const [kit, spec] of kitEntries()) {
    const head = remoteHead(kit, spec);
    ensureRepo(kit, spec, [spec.commit, head]);
    const entry = { kit, visibility: spec.visibility, pinned: spec.commit, main: head, behind: 0, commits: [], trackedChanged: [], constantsChanged: [], contractAtMain: [] };
    if (head !== spec.commit) {
      entry.commits = git(kit, "log", "--format=%h %ad %s", "--date=short", `${spec.commit}..${head}`).split("\n").filter(Boolean);
      entry.behind = entry.commits.length;
      const tracked = new Set([...(spec.contract ?? []).map((rule) => rule.file), ...(spec.vendor?.modules ?? [])]);
      const changed = git(kit, "diff", "--name-only", spec.commit, head).split("\n").filter(Boolean);
      const vendorGlobs = [...(spec.vendor?.files ?? []).map(globToRegex), ...(spec.vendor?.copy ?? []).map((rule) => new RegExp(`^${rule.from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.*${rule.ext.replace(".", "\\.")}$`))];
      entry.trackedChanged = changed.filter((file) => tracked.has(file) || vendorGlobs.some((re) => re.test(file)));
      entry.otherChanged = changed.length - entry.trackedChanged.length;
      entry.contractAtMain = contractProblems(kit, spec, head);
      const before = fingerprints(kit, spec, spec.commit), after = fingerprints(kit, spec, head);
      entry.promptFilesChanged = Object.keys({ ...before, ...after }).filter((path) => before[path] !== after[path]);
      if (spec.vendor) {
        const before = JSON.parse(vendor(kit, spec, spec.commit).json).constants;
        const after = JSON.parse(vendor(kit, spec, head).json).constants;
        for (const module of new Set([...Object.keys(before), ...Object.keys(after)])) {
          for (const name of new Set([...Object.keys(before[module] ?? {}), ...Object.keys(after[module] ?? {})])) {
            const a = JSON.stringify(before[module]?.[name]), b = JSON.stringify(after[module]?.[name]);
            if (a !== b) entry.constantsChanged.push(`${module}.${name}${a === undefined ? " (새로 생김)" : b === undefined ? " (없어짐)" : ""}`);
          }
        }
      }
    }
    report.push(entry);
  }
  return report;
}

if (flag("--drift")) {
  const report = drift();
  if (flag("--json")) console.log(JSON.stringify({ at: new Date().toISOString(), report }, null, 1));
  else {
    for (const r of report) {
      console.log(`${r.kit} (${r.visibility}) lock ${r.pinned.slice(0, 9)} · main ${r.main.slice(0, 9)} · ${r.behind ? `${r.behind}커밋 뒤처짐` : "같음"}`);
      for (const c of r.commits.slice(0, 12)) console.log(`   ${c}`);
      if (r.trackedChanged.length) console.log(`   편집기가 따르는 파일이 바뀜: ${r.trackedChanged.join(", ")}`);
      if (r.constantsChanged.length) console.log(`   상수 차이: ${r.constantsChanged.join(", ")}`);
      if (r.contractAtMain.length) console.log(`   main 에서 계약이 깨짐: ${r.contractAtMain.join(" / ")}`);
      if (r.promptFilesChanged?.length) console.log(`   지시문·판정 기준 파일이 바뀜: ${r.promptFilesChanged.join(", ")}`);
    }
  }
  process.exit(flag("--strict") && report.some((r) => r.behind > 0) ? 1 : 0);
}

const bump = opt("--bump");
if (bump) {
  const spec = lock.kits[bump];
  if (!spec) throw new Error(`lock 에 ${bump} 가 없다`);
  const head = remoteHead(bump, spec);
  ensureRepo(bump, spec, [head]);
  const problems = contractProblems(bump, spec, head);
  if (problems.length) { console.error(`${bump} main(${head.slice(0, 9)}) 이 계약을 깨서 올리지 않는다:\n  ${problems.join("\n  ")}`); process.exit(1); }
  spec.commit = head;
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
  console.log(`${bump} lock → ${head.slice(0, 12)}`);
}

/** lock 이 main 보다 몇 커밋 뒤처졌나(받을 수 없으면 null — 비공개 저장소를 자격 없이 볼 때). */
function behindCount(kit, spec) {
  try {
    const head = remoteHead(kit, spec);
    if (head === spec.commit) return { behind: 0, head };
    ensureRepo(kit, spec, [spec.commit, head]);
    return { behind: Number(git(kit, "rev-list", "--count", `${spec.commit}..${head}`)), head };
  } catch (error) {
    return { behind: null, head: null, error: error instanceof Error ? error.message.split("\n")[0] : String(error) };
  }
}

const ci = Boolean(process.env.GITHUB_ACTIONS);
const loud = (level, text) => {
  if (ci) console.log(`::${level}::${text}`);
  const bar = "!".repeat(Math.min(100, text.length + 8));
  console.error(`\n${bar}\n!!! ${text}\n${bar}\n`);
};

if (flag("--check")) {
  const { results, mismatches } = build(false);
  const broken = results.filter((r) => r.problems.length);
  const maxBehind = opt("--max-behind") === undefined ? null : Number(opt("--max-behind"));
  const lag = [];
  if (maxBehind !== null) {
    for (const [kit, spec] of kitEntries()) {
      const { behind, head, error } = behindCount(kit, spec);
      lag.push({ kit, behind, main: head, ...(error ? { error } : {}) });
      if (behind === null) loud("warning", `gen-kits: ${kit} main 을 읽지 못해 뒤처짐을 못 쟀다 (${error})`);
      else if (behind > maxBehind) loud("error", `gen-kits: ${kit} lock ${spec.commit.slice(0, 9)} 이 main ${head.slice(0, 9)} 보다 ${behind}커밋 뒤처짐 (한도 ${maxBehind}) — npm run gen-kits:sync -- --bump ${kit}`);
      else if (behind > 0) loud("warning", `gen-kits: ${kit} lock 이 main 보다 ${behind}커밋 뒤처짐 — 공방은 아직 옛 지시문으로 돈다. npm run gen-kits:sync -- --drift 로 차이를 보고 --bump ${kit}`);
    }
  }
  for (const path of mismatches) loud("error", `gen-kits: 생성물 ${path} 이 lock 과 다르다 — npm run gen-kits:sync`);
  console.log(JSON.stringify({ kits: results.map((r) => ({ kit: r.kit, commit: r.commit, contract: r.problems.length ? r.problems : "ok" })), stale: mismatches, ...(maxBehind !== null ? { maxBehind, lag } : {}) }, null, 1));
  const tooFar = lag.some((entry) => entry.behind !== null && entry.behind > maxBehind);
  process.exit(broken.length || mismatches.length || tooFar ? 1 : 0);
}

const { results } = build(true);
for (const r of results) console.log(`${r.kit} ${r.commit.slice(0, 12)} · 계약 ${r.problems.length ? `깨짐: ${r.problems.join(" / ")}` : "ok"}${r.vendored ? " · 생성물 갱신" : ""}`);
if (results.some((r) => r.problems.length)) process.exit(1);
