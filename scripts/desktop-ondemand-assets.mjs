#!/usr/bin/env node
// 데스크톱 패키지에서 큰 자산을 빼고, 앱이 처음 쓸 때 받을 목록(dist/ondemand-assets.json)을 쓴다.
// electron/main/assetsOnDemand.ts 가 이 목록을 읽어 공개 저장소의 같은 커밋 public/ 에서 받는다.
//
// 빼는 것: 공용 초상(assets/shared/portraits, PNG 2,685장 254MB)과 장소 내려받기(assets/region-references/*.oprn.json).
// 남기는 것: 예제 데모(dist/demos)가 가리키는 파일(오프라인에서도 데모가 그대로 돈다), 저장소의 그 커밋 파일과
// 바이트가 다른 파일(받을 곳이 없다). 장소 미리보기 PNG 는 목록 화면이 바로 그리므로 남긴다.
//
// 쓰기: node scripts/desktop-ondemand-assets.mjs [--dist dist] [--out dist-ondemand] [--dry]
// bake:demos 다음, electron-builder 전에 돈다(.github/workflows/desktop-release.yml).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ONDEMAND_REPO = "MovieHolic-Plex/OpenRPGMaker";
// 대사창은 초상을 경로가 아니라 리소스 id(shared-<폴더>-expressions-<bust|full>-<표정>)로 고르고, 얼굴(…-expressions-NN)도
// 전신 베일 프리셋에서 같은 세트의 전신으로 승격한다(src/player/dialogue.ts promoteFaceToFullPortrait). 그래서 데모가
// 초상 id 나 얼굴·초상 리소스 id 로 그 세트를 쓰는지 본다. 모든 데모에 실리는 얼굴 카탈로그("assetId")는 쓰임이 아니다.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
// 세트 안에서도 대사 감정이 자동으로 고르는 다섯 표정(SHARED_PORTRAIT_DIALOGUE_EXPRESSIONS)과 데모가 이름으로 부른 표정만 남긴다.
// 흉상↔전신은 프리셋이 서로 바꿔 부르므로 두 모양을 함께 남긴다. 나머지는 처음 보일 때 받는다.
const DIALOGUE_EXPRESSIONS = new Set(["base", "happy", "sad", "angry", "surprised"]);
// 세트(폴더)마다 데모 글을 두 번만 훑는다. 예전에는 초상 파일(2,685장)마다 약 60MB 데모 글에 정규식 두 개를 새로 만들어 돌려
// 릴리스 단계가 약 3분 걸렸다(2026-11-25 dev-bottlenecks, v0.419 run 45420794518). 판정은 같다:
// ① 세트를 쓰는가는 같은 정규식 ② 이름으로 부른 표정은 `<세트>-(bust|full)-<표정>"` 를 한 번에 모아 집합으로 본다(표정에는 " 가 없다).
const portraitSets = new Map();
const portraitSetUse = (folder, demos) => {
  let byText = portraitSets.get(demos);
  if (!byText) { byText = new Map(); portraitSets.clear(); portraitSets.set(demos, byText); }
  let use = byText.get(folder);
  if (!use) {
    const set = escapeRegExp(`shared-${folder}-expressions`);
    const used = new RegExp(`${set}-(?:bust|full)-|"(?:face|portrait)[A-Za-z]*Id":"${set}`, "u").test(demos);
    const named = new Set(used ? [...demos.matchAll(new RegExp(`${set}-(?:bust|full)-([^"]*)"`, "gu"))].map((m) => m[1]) : []);
    use = { used, named };
    byText.set(folder, use);
  }
  return use;
};
const portraitUsedByDemo = (rel, demos) => {
  const [, , , folder = "", file = ""] = rel.split("/");
  const use = portraitSetUse(folder, demos);
  if (!use.used) return false;
  const expression = file.replace(/^(?:bust|full)-/u, "").replace(/\.png$/u, "");
  return DIALOGUE_EXPRESSIONS.has(expression) || use.named.has(expression);
};
export const ONDEMAND_RULES = [
  { prefix: "assets/shared/portraits/", match: (rel) => rel.endsWith(".png"), usedByDemo: portraitUsedByDemo },
  { prefix: "assets/region-references/", match: (rel) => rel.endsWith(".oprn.json"), usedByDemo: (rel, demos) => demos.includes(rel) },
];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function git(args) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

/** git 이 그 커밋에 담은 파일의 blob id. 바이트가 같아야 공개 저장소에서 같은 파일을 받는다. */
function trackedBlobs(prefixes) {
  const blobs = new Map();
  for (const line of git(["ls-files", "-s", "--", ...prefixes.map((p) => `public/${p}`)]).split("\n")) {
    const match = /^\d+ ([0-9a-f]{40}) \d\t(.+)$/u.exec(line);
    if (match) blobs.set(match[2].replace(/^public\//u, ""), match[1]);
  }
  return blobs;
}

function blobId(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function demoText(distDir) {
  const demos = join(distDir, "demos");
  if (!existsSync(demos)) return "";
  return walk(demos).filter((file) => file.endsWith(".json")).map((file) => readFileSync(file, "utf8")).join("\n");
}

export function planOnDemand({ distDir, blobs, demos }) {
  const moved = [];
  const kept = { demo: [], untracked: [] };
  for (const rule of ONDEMAND_RULES) {
    const dir = join(distDir, rule.prefix);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir)) {
      const rel = relative(distDir, file).split("\\").join("/");
      if (!rule.match(rel)) continue;
      if (rule.usedByDemo(rel, demos)) { kept.demo.push(rel); continue; }
      const bytes = readFileSync(file);
      if (blobs.get(rel) !== blobId(bytes)) { kept.untracked.push(rel); continue; }
      moved.push({ rel, file, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  return { moved, kept };
}

function main() {
  const distDir = resolve(REPO_ROOT, arg("dist", "dist"));
  const outDir = resolve(REPO_ROOT, arg("out", "dist-ondemand"));
  const dry = process.argv.includes("--dry");
  const commit = git(["rev-parse", "HEAD"]).trim();
  const onRemote = git(["branch", "-r", "--contains", commit]).trim() || git(["tag", "--points-at", commit]).trim();
  if (!onRemote) process.stderr.write(`warning: ${commit} 가 원격 브랜치·태그에 없다 — 푸시 전까지 앱이 뺀 파일을 받지 못한다\n`);
  const plan = planOnDemand({ distDir, blobs: trackedBlobs(ONDEMAND_RULES.map((r) => r.prefix)), demos: demoText(distDir) });
  const total = plan.moved.reduce((sum, item) => sum + item.bytes, 0);
  process.stdout.write(`ondemand: ${plan.moved.length} files ${(total / 1e6).toFixed(1)}MB out of the package; kept ${plan.kept.demo.length} demo-referenced, ${plan.kept.untracked.length} not matching ${commit.slice(0, 9)}\n`);
  if (dry) return;
  const manifest = {
    base: `https://raw.githubusercontent.com/${ONDEMAND_REPO}/${commit}/public/`,
    files: Object.fromEntries(plan.moved.map((item) => [item.rel, [item.bytes, item.sha256]])),
  };
  for (const item of plan.moved) {
    const target = join(outDir, item.rel);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(item.file, target);
  }
  writeFileSync(join(distDir, "ondemand-assets.json"), `${JSON.stringify(manifest)}\n`);
  const written = statSync(join(distDir, "ondemand-assets.json")).size;
  process.stdout.write(`wrote dist/ondemand-assets.json (${written} bytes), moved files to ${relative(REPO_ROOT, outDir)}/\n`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) main();
