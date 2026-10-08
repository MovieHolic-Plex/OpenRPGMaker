#!/usr/bin/env node
// 공개 저장소로 내보내기 전 사전 스캔. 한 커밋(기본 origin/main)의 트리만 본다 — 공개본은 이력 없이
// 스냅샷 한 커밋으로 올리므로 이력은 대상이 아니다.
//
//   node scripts/oss/prescan.mjs [--ref origin/main] [--public] [--out <dir>]
//   --public: publicSet.mjs 의 제외 경로를 빼고 공개본에 남을 파일만 본다.
//
// 네 갈래를 센다: 비밀값 후보, 내부 기반 정보(경로·호스트·IP), 제3자 출처 표지, 크기.
// 판정은 하지 않는다. 사람이 보고 지울지·뺄지·남길지 정한다. 결과는 --out 에 report.md + report.json.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isPublicPath, publicExcludePathspecs } from "./publicSet.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const ref = opt("ref", "origin/main");
const publicOnly = args.includes("--public");
const outDir = path.resolve(opt("out", path.join(process.env.HOME, "oss-prescan", new Date().toISOString().slice(0, 10) + (publicOnly ? "-public" : ""))));

const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 30 });
// 한 줄짜리 JSON 이 수 MB 라 줄 단위로 받으면 메모리가 터진다(실측: exit 137).
// 그래서 git grep 은 파일 이름만(-l) 받고, 내용 조각이 필요하면 그 파일만 열어 JS 정규식으로 자른다.
const gitGrepFiles = (pattern) => {
  try {
    return git("grep", "-lIP", "--full-name", "-e", pattern, ref, "--", ".", ":!package-lock.json", ":!**/package-lock.json", ...(publicOnly ? publicExcludePathspecs() : []))
      .split("\n").filter(Boolean).map((line) => line.slice(ref.length + 1));
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
};
// PCRE 의 (?i) 를 JS 플래그로 옮긴다.
const toJsRegex = (pattern) => pattern.startsWith("(?i)") ? new RegExp(pattern.slice(4), "gi") : new RegExp(pattern, "g");
const snippets = (file, pattern, limit = 5) => {
  const text = git("show", `${ref}:${file}`);
  const re = toJsRegex(pattern);
  const out = [];
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 50), m.index);
    // data: URI·base64 덩어리 안의 우연한 일치 — 앞 40자가 끊김 없는 base64 글자면 버린다.
    if (/base64,[A-Za-z0-9+/=]*$/.test(before) || /[A-Za-z0-9+/]{40}$/.test(before)) continue;
    const line = text.slice(0, m.index).split("\n").length;
    out.push({ file, line, text: (before + m[0] + text.slice(m.index + m[0].length, m.index + m[0].length + 50)).replace(/\s+/g, " ") });
    if (out.length >= limit) break;
  }
  return out;
};
const gitGrep = (pattern, mode = "context") => {
  const files = gitGrepFiles(pattern);
  if (mode === "files") return files.map((file) => ({ file, line: 0, text: "" }));
  return files.flatMap((file) => snippets(file, pattern));
};
const topDir = (file, depth = 2) => file.split("/").slice(0, depth).join("/");
const groupCount = (hits, depth = 2) => {
  const files = new Map();
  for (const h of hits) files.set(h.file, (files.get(h.file) ?? 0) + 1);
  const dirs = new Map();
  for (const f of files.keys()) dirs.set(topDir(f, depth), (dirs.get(topDir(f, depth)) ?? 0) + 1);
  return { files: files.size, dirs: [...dirs].sort((a, b) => b[1] - a[1]) };
};
const clip = (s, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── 1. 비밀값 후보 ─────────────────────────────────────
// data: URI 의 base64 는 우연히 걸리므로 그 줄은 버린다.
const SECRET_RULES = [
  ["anthropic", String.raw`sk-ant-[A-Za-z0-9_-]{20,}`],
  ["openai-like", String.raw`\bsk-(?:proj-)?[A-Za-z0-9]{32,}`],
  ["google-api", String.raw`AIza[0-9A-Za-z_-]{35}`],
  ["github", String.raw`\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b|github_pat_[A-Za-z0-9_]{40,}`],
  ["aws", String.raw`\bAKIA[0-9A-Z]{16}\b`],
  ["slack", String.raw`xox[abpr]-[0-9A-Za-z-]{20,}|hooks\.slack\.com/services/`],
  ["private-key", String.raw`-----BEGIN [A-Z ]*PRIVATE KEY-----`],
  ["jwt", String.raw`\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}`],
  ["cloudflare/r2", String.raw`(?i)(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN|R2_SECRET|R2_ACCESS_KEY)\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}`],
  ["assignment", String.raw`(?i)\b(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret)\b["']?\s*[:=]\s*["'][A-Za-z0-9_./+=-]{20,}["']`],
];
const secrets = [];
for (const [rule, pattern] of SECRET_RULES) {
  for (const hit of gitGrep(pattern)) secrets.push({ rule, ...hit, text: clip(hit.text.trim()) });
}
const envFiles = git("ls-tree", "-r", "--name-only", ref).split("\n")
  .filter((f) => (!publicOnly || isPublicPath(f)) && /(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f));

// ── 2. 내부 기반 정보 ──────────────────────────────────
const INFRA_RULES = [
  ["home-path", String.raw`/home/main\b`],
  ["internal-host", String.raw`\bmdc-server\b|\boprn-box(?:-2|-full)?\b|\bseogo\b`],
  ["tailscale-ip", String.raw`\b100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b`],
  ["private-ip", String.raw`\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b`],
  ["agent-account", String.raw`\bnekos(?:-2)?\b|teamclaude|\.t3/worktrees`],
];
const infra = {};
for (const [rule, pattern] of INFRA_RULES) infra[rule] = gitGrep(pattern, "files");

// ── 3. 제3자 출처 표지 ─────────────────────────────────
const THIRD_PARTY_RULES = [
  ["nintendo/pokemon-original", String.raw`(?i)Game ?Freak|Nintendo|pret/poke(?:emerald|ruby|firered|crystal)|"independentlyAuthored":\s*false`],
  ["rpgmaker-commercial", String.raw`(?i)\bEnterbrain\b|KADOKAWA|Gotcha Gotcha|\bRTP\b(?!.*EasyRPG)`],
  ["commercial-packs", String.raw`(?i)\bRasak\b|\bREFMAP\b|\bPAW\b|Modern Exteriors|LimeZu|Time Fantasy|CraftPix|itch\.io/`],
  ["copyleft/sharealike", String.raw`(?i)CC[- ]BY[- ]SA|\bGPL(?:v?[23])?\b|\bAGPL\b`],
  ["other-game-capture", String.raw`(?i)스크린샷|screenshot of|원작 (?:화면|그림|스프라이트)`],
];
const thirdParty = {};
for (const [rule, pattern] of THIRD_PARTY_RULES) thirdParty[rule] = gitGrep(pattern, "files");

// ── 4. 크기 ────────────────────────────────────────────
const sizes = new Map();
let totalBytes = 0;
let fileCount = 0;
// -z: 한글 파일 이름이 따옴표·8진 이스케이프로 바뀌지 않게 한다.
for (const line of git("ls-tree", "-r", "-l", "-z", ref).split("\0")) {
  const m = line.match(/^\d+ blob [0-9a-f]+\s+(\d+)\t(.*)$/s);
  if (!m) continue;
  if (publicOnly && !isPublicPath(m[2])) continue;
  const bytes = Number(m[1]);
  totalBytes += bytes;
  fileCount += 1;
  const d = topDir(m[2], 1);
  sizes.set(d, (sizes.get(d) ?? 0) + bytes);
}
const mb = (b) => `${(b / 1048576).toFixed(1)}MB`;

// ── 보고 ───────────────────────────────────────────────
const commit = git("rev-parse", ref).trim();
const report = { ref, commit, scannedAt: new Date().toISOString(), secrets, envFiles,
  infra: Object.fromEntries(Object.entries(infra).map(([k, v]) => [k, v.map(({ file, line }) => ({ file, line }))])),
  thirdParty: Object.fromEntries(Object.entries(thirdParty).map(([k, v]) => [k, v.map(({ file, line, text }) => ({ file, line, text: clip(text.trim()) }))])),
  size: { totalBytes, fileCount, byTopDir: Object.fromEntries([...sizes].sort((a, b) => b[1] - a[1])) } };

const md = [];
md.push(`# 공개 전 사전 스캔${publicOnly ? " (공개본 범위)" : ""}`, ``, `- 대상: \`${ref}\` = \`${commit.slice(0, 10)}\``, `- 파일 ${fileCount}개 · ${mb(totalBytes)}`, ``);
md.push(`## 1. 비밀값 후보 (${secrets.length}건)`, ``);
md.push(envFiles.length ? `추적 중인 .env 파일: ${envFiles.map((f) => `\`${f}\``).join(", ")}` : `추적 중인 .env 파일 없음.`, ``);
if (secrets.length) {
  md.push(`| 규칙 | 위치 | 내용 |`, `|---|---|---|`);
  for (const s of secrets) md.push(`| ${s.rule} | \`${s.file}:${s.line}\` | \`${s.text.replace(/\|/g, "\\|").replace(/`/g, "'")}\` |`);
  md.push(``);
}
md.push(`## 2. 내부 기반 정보`, ``, `| 규칙 | 파일 수 | 많은 폴더 |`, `|---|---|---|`);
for (const [rule, hits] of Object.entries(infra)) {
  const g = groupCount(hits);
  md.push(`| ${rule} | ${g.files} | ${g.dirs.slice(0, 6).map(([d, n]) => `${d} (${n})`).join(", ")} |`);
}
md.push(``, `## 3. 제3자 출처 표지`, ``, `| 규칙 | 파일 수 | 많은 폴더 |`, `|---|---|---|`);
for (const [rule, hits] of Object.entries(thirdParty)) {
  const g = groupCount(hits, 3);
  md.push(`| ${rule} | ${g.files} | ${g.dirs.slice(0, 6).map(([d, n]) => `${d} (${n})`).join(", ")} |`);
}
md.push(``, `## 4. 크기 (최상위 폴더)`, ``, `| 폴더 | 크기 |`, `|---|---|`);
for (const [d, b] of [...sizes].sort((a, b) => b[1] - a[1]).slice(0, 25)) md.push(`| ${d} | ${mb(b)} |`);
md.push(``, `전체 목록은 report.json.`);

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
writeFileSync(path.join(outDir, "report.md"), md.join("\n") + "\n");
console.log(`${path.join(outDir, "report.md")}  secrets=${secrets.length}  files=${fileCount}  size=${mb(totalBytes)}`);
