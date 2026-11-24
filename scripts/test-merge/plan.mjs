#!/usr/bin/env node
// 시험 파일 합치기 계획 — 통과 중인 파일만 같은 폴더·같은 모듈 가족끼리 묶는다(파일은 건드리지 않는다).
//
// 쓰는 법:
//   node scripts/test-merge/plan.mjs --timings <timings.json> [--exclude-list <줄마다 파일 경로>] [--out plan.json]
//
// timings 는 CI(ci-full)가 남긴 [{file, wall, cases, status}] 배열이다. 실패·미측정 파일은 합치지 않는다.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { analyzeFile, primaryModule } from "./lib.mjs";

/** 다른 레인이 쥔 것·합칠 수 없는 종류 */
export const DEFAULT_EXCLUDES = [
  /\.(quarantine|browser|bun|live)\.test\.ts$/,
  /^test\/lakeVillageRebuildFinal\.test\.ts$/,
  /^test\/smallTaskPrimitives\//, // td-small
  /^test\/commandContracts\//, // td-blank
  /^test\/(aiAssistantSession|npcRewardSession|npcPrerequisiteSession|approachCorrection|aiRunEndProof|spatialObjectActions|assistantVisualEvidenceSession|npcApproach)\.test\.ts$/, // td-slow
  /^test\/(verification|aiSpecGate|beodeul)/, // td-slow
  /^test\/eventEditor.*baseline.*\.test\.ts$/, // td-slow
];

const WORD_RE = /[A-Z]?[a-z]+\d*|[A-Z]+\d*(?![a-z])|\d+/g;
export const words = (name) => name.match(WORD_RE) ?? [name];

export function readTimings(path) {
  const table = new Map();
  for (const e of JSON.parse(readFileSync(path, "utf8"))) {
    const cur = table.get(e.file) ?? { passed: true, wall: 0, cases: 0, runs: 0 };
    cur.passed = cur.passed && e.status === "passed" && e.cases > 0;
    cur.wall = Math.max(cur.wall, e.wall ?? 0);
    cur.cases = Math.max(cur.cases, e.cases ?? 0);
    cur.runs += 1;
    table.set(e.file, cur);
  }
  return table;
}

function familyOf(primary, fileBase) {
  if (primary) {
    const seg = primary.replace(/^@\//, "").split("/");
    return seg[0] === "editor" || seg[0] === "ai" ? seg.slice(0, 2).join("-").replace(/\.\w+$/, "") : seg[0];
  }
  return `name-${words(fileBase)[0].toLowerCase()}`;
}

/**
 * 계획을 만든다.
 * infos: [{path, dir, base, env, mockSig, primary, wall, cases}]
 */
// 그룹 원본 시간 합 60초 안쪽 — CI 실측에서 합친 시간이 80초를 넘는 그룹은 열에 일곱이 힙 부족·15초 제한으로 깨졌다(40초 이하는 14곳 중 1곳).
export function groupFiles(infos, { maxFiles = 15, maxWallSec = 60, tierCount = 3 } = {}) {
  const used = new Set();
  const groups = [];
  const tiers = [
    (f) => f.primary && `p:${f.primary}`,
    (f) => `n2:${words(f.base).slice(0, 2).join("")}`,
    (f) => f.primary && `d:${dirname(f.primary)}`,
    (f) => `n1:${words(f.base)[0]}`,
  ];
  const run = (minSize) => {
    // 마지막 층(파일 이름 첫 낱말만 같은 묶음)은 서로 상관없는 시험이 섞여 기본에서 뺐다 — tierCount=4 로 켠다.
    for (let t = 0; t < Math.min(tierCount, tiers.length); t += 1) {
      const buckets = new Map();
      for (const f of infos) {
        if (used.has(f.path)) continue;
        const k = tiers[t](f);
        if (!k) continue;
        const key = `${f.dir}\0${f.env}\0${f.mockSig}\0${k}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(f);
      }
      for (const [key, list] of [...buckets].sort((a, b) => a[0].localeCompare(b[0]))) {
        if (list.length < minSize) continue;
        list.sort((a, b) => a.base.localeCompare(b.base));
        let chunk = [];
        let sec = 0;
        const flush = () => {
          if (chunk.length >= minSize) {
            groups.push({ key, tier: t, files: chunk });
            for (const f of chunk) used.add(f.path);
          }
          chunk = [];
          sec = 0;
        };
        for (const f of list) {
          if (chunk.length && (chunk.length >= maxFiles || sec + f.wall > maxWallSec)) flush();
          chunk.push(f);
          sec += f.wall;
        }
        flush();
      }
    }
  };
  run(3);
  run(2);
  return groups;
}

function commonWordPrefix(bases) {
  const ws = bases.map(words);
  const out = [];
  for (let i = 0; ; i += 1) {
    const w = ws[0][i];
    if (!w || !ws.every((x) => x[i] === w)) break;
    out.push(w);
  }
  return out.join("");
}

const GENERIC_MODULE = /^(runtime|registry|index|types|store|util|utils|helpers|session|core|model|schema|state|constants|common|shared|base|main|config)$/;

/** `@/battle/runtime` 처럼 너무 흔한 이름은 상위 폴더를 붙여 `battleRuntime` 으로 쓴다. */
export function moduleTestName(mod) {
  const parts = mod.replace(/^@\//, "").split("/");
  const leaf = parts[parts.length - 1].replace(/\.\w+$/, "");
  if (!GENERIC_MODULE.test(leaf) || parts.length < 2) return leaf;
  const parent = parts[parts.length - 2];
  return parent + leaf[0].toUpperCase() + leaf.slice(1);
}

export function moduleDirName(mod) {
  const parts = mod.replace(/^@\//, "").split("/").slice(0, -1);
  const last = parts.slice(-2);
  return last.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("") || "misc";
}

/** 대상 파일 이름 — 모듈 이름 > 공통 접두사 > 가장 짧은 구성원. 그룹 밖에 이미 있는 파일 이름은 쓰지 않는다. */
export function chooseTargets(groups, existing) {
  const taken = new Set();
  return groups.map((g) => {
    const dir = g.files[0].dir;
    const members = new Set(g.files.map((f) => f.path));
    const free = (p) => !taken.has(p) && (members.has(p) || !existing.has(p));
    const cands = [];
    const prim = g.files.map((f) => f.primary).find(Boolean);
    if (g.tier === 0 && prim) cands.push(`${dir}/${moduleTestName(prim)}.test.ts`);
    const pre = commonWordPrefix(g.files.map((f) => f.base));
    // 모듈 폴더로 묶인 그룹(층 2)은 «같은 폴더의 모듈들»이므로 그 폴더 이름(@/player/battle → playerBattle)으로 짓는다.
    // 폴더만 같은 잡다한 묶음은 구성원 하나의 이름을 빌리면 오해를 부르므로 «<폴더>Suite» 로 짓는다(자리가 차 있으면 2, 3 ...).
    if (g.tier === 2 && prim) {
      const base = `${moduleDirName(prim)}Suite`;
      for (let n = 1; n < 50; n += 1) cands.push(`${dir}/${base}${n === 1 ? "" : n}.test.ts`);
    }
    if (pre.length >= 4) cands.push(`${dir}/${pre}.test.ts`);
    for (const f of [...g.files].sort((a, b) => a.base.length - b.base.length || a.base.localeCompare(b.base))) cands.push(f.path);
    const target = cands.find(free) ?? g.files[0].path;
    taken.add(target);
    const primaries = g.files.map((f) => f.primary).filter(Boolean);
    const common = primaries.sort((a, b) => primaries.filter((x) => x === b).length - primaries.filter((x) => x === a).length)[0] ?? null;
    return {
      id: target,
      target,
      tier: g.tier,
      family: familyOf(common, g.files[0].base),
      env: g.files[0].env,
      sources: g.files.map((f) => f.path),
      wallSec: Math.round(g.files.reduce((a, f) => a + f.wall, 0)),
      cases: g.files.reduce((a, f) => a + f.cases, 0),
    };
  });
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const root = opt("root", process.cwd());
  const timingsPath = opt("timings");
  if (!timingsPath) {
    console.error("usage: plan.mjs --timings <timings.json> [--root dir] [--exclude-list file] [--out plan.json] [--max-file-sec 120] [--heavy-wall-sec 15 --heavy-sec-per-case 4] [--max-group-files 15 --max-group-sec 60 --tiers 3]");
    process.exit(2);
  }
  const maxFileSec = Number(opt("max-file-sec", "120"));
  const heavyWallSec = Number(opt("heavy-wall-sec", "15"));
  const heavySecPerCase = Number(opt("heavy-sec-per-case", "4"));
  const timings = readTimings(timingsPath);
  const extra = new Set(opt("exclude-list") ? readFileSync(opt("exclude-list"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean) : []);
  const all = execFileSync("git", ["ls-files", "test"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }).split("\n").filter((f) => /\.test\.ts$/.test(f));
  const existing = new Set(all);
  const skipped = {};
  const bump = (k) => (skipped[k] = (skipped[k] ?? 0) + 1);
  const infos = [];
  for (const path of all) {
    if (DEFAULT_EXCLUDES.some((re) => re.test(path)) || extra.has(path)) {
      bump("owned-or-special");
      continue;
    }
    const t = timings.get(path);
    if (!t) {
      bump("no-timing");
      continue;
    }
    if (!t.passed) {
      bump("failing");
      continue;
    }
    if (t.wall > maxFileSec) {
      bump("slow");
      continue;
    }
    // 시험 한 건이 무거운 파일(시뮬레이션·큰 프로젝트)은 합치면 한 프로세스 힙에 쌓여 죽거나 15초 제한을 넘는다 — 따로 둔다.
    if (t.wall >= heavyWallSec && t.wall / t.cases >= heavySecPerCase) {
      bump("heavy");
      continue;
    }
    let info;
    try {
      info = analyzeFile(path, readFileSync(join(root, path), "utf8"));
    } catch (e) {
      bump("unreadable");
      continue;
    }
    if (info.reasons.length) {
      bump(`unmergeable:${info.reasons[0].split(":")[0]}`);
      continue;
    }
    infos.push({
      path,
      dir: dirname(path),
      base: basename(path).replace(/\.test\.ts$/, ""),
      env: info.env,
      mockSig: info.mocks.join("|"),
      primary: primaryModule(info.imports),
      wall: t.wall,
      cases: t.cases,
    });
  }
  const groups = chooseTargets(groupFiles(infos, { maxFiles: Number(opt("max-group-files", "15")), maxWallSec: Number(opt("max-group-sec", "60")), tierCount: Number(opt("tiers", "3")) }), existing);
  const merged = groups.reduce((a, g) => a + g.sources.length, 0);
  const plan = {
    totalFiles: all.length,
    candidates: infos.length,
    groups: groups.length,
    filesMerged: merged,
    plannedFilesAfter: all.length - merged + groups.length,
    skipped,
    groupList: groups,
  };
  const byFamily = {};
  for (const g of groups) {
    const f = (byFamily[g.family] ??= { groups: 0, files: 0 });
    f.groups += 1;
    f.files += g.sources.length;
  }
  plan.families = byFamily;
  const out = opt("out");
  if (out) writeFileSync(out, JSON.stringify(plan, null, 2));
  console.log(`test files: ${plan.totalFiles} -> ${plan.plannedFilesAfter} (candidates ${plan.candidates}, groups ${plan.groups}, merged ${merged})`);
  console.log("skipped:", JSON.stringify(skipped));
  for (const [k, v] of Object.entries(byFamily).sort((a, b) => b[1].files - a[1].files)) console.log(`  ${k}: ${v.files} files -> ${v.groups}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
