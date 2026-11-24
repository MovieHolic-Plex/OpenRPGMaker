#!/usr/bin/env node
// 시험 파일 합치기 실행 — plan.mjs 가 만든 계획대로 파일을 합쳐 쓰고, 합쳐진 원본을 지운다.
// 합치기 전·후 it/describe/expect 호출 수가 다르면 아무것도 쓰지 않고 실패한다.
//
// 쓰는 법:
//   node scripts/test-merge/merge.mjs --plan plan.json [--root dir] [--family a,b] [--family-match regex] [--part K/N] [--skip file,file] [--table out.md] [--result out.json] [--dry]
//   --skip 은 CI 에서 합친 뒤 떨어진 «원본 파일»을 그룹에서 빼는 데 쓴다(단언을 고치지 않고 따로 둔다).
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { countMismatch, makeResolver, mergeGroup } from "./lib.mjs";

export function runMerge({ plan, root, families = null, familyMatch = null, part = null, skip = new Set(), dry = false }) {
  const results = [];
  const failures = [];
  const resolver = makeResolver(root);
  // part=[k,n]: 가족 안의 그룹을 이름순으로 줄 세워 n 몫으로 나눈 k 번째(1부터)만 합친다 — 큰 가족을 PR 여럿으로 쪼갤 때 쓴다.
  const picked = plan.groupList
    .filter((g) => (!families || families.has(g.family)) && (!familyMatch || familyMatch.test(g.family)))
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((_, i) => !part || i % part[1] === part[0] - 1);
  for (const g of picked) {
    const members = g.sources.filter((p) => !skip.has(p) && existsSync(join(root, p)));
    if (members.length < 2) continue;
    const files = members.map((p) => ({ path: p, text: readFileSync(join(root, p), "utf8") }));
    // 합친 파일은 같은 폴더 안에 놓이므로 도우미(test/mergedTeardown.ts)까지의 상대 경로를 그 폴더에서 센다.
    const rel = relative(dirname(g.target), "test") || ".";
    const teardownImport = `${rel.startsWith(".") ? rel : "./" + rel}/mergedTeardown`.replace(/^\.\/\.\.\//, "../");
    const res = mergeGroup(files, { resolver, teardownImport });
    if (!res.text || res.merged.length < 2) {
      results.push({ group: g.id, merged: [], excluded: res.excluded, skipped: true });
      continue;
    }
    const bad = countMismatch(res);
    if (bad) {
      failures.push(`${g.id}: ${bad}`);
      continue;
    }
    // 대상 이름이 합쳐지지 않은 기존 파일과 겹치면 합쳐진 첫 구성원 이름을 쓴다.
    let target = g.target;
    if (!res.merged.includes(target) && existsSync(join(root, target))) target = res.merged[0];
    results.push({ group: g.id, target, merged: res.merged, excluded: res.excluded, before: res.before, after: res.after, wrappers: res.wrappers, text: res.text });
  }
  if (failures.length) return { failures, results };
  if (!dry) {
    for (const r of results) {
      if (!r.text) continue;
      mkdirSync(dirname(join(root, r.target)), { recursive: true });
      writeFileSync(join(root, r.target), r.text);
      for (const s of r.merged) if (s !== r.target) unlinkSync(join(root, s));
    }
  }
  return { failures, results };
}

export function renderTable(results, casesOf = () => null) {
  const rows = results.filter((r) => r.text);
  const lines = ["| target | merged sources | it before/after | expect before/after | describe before/after |", "|---|---|---|---|---|"];
  const tot = { files: 0, it: 0, expect: 0, targets: 0 };
  for (const r of rows) {
    const names = r.merged.map((p) => p.replace(/^.*\//, "").replace(/\.test\.ts$/, ""));
    lines.push(`| ${r.target} | ${r.merged.length}: ${names.join(", ")} | ${r.before.it}/${r.after.it} | ${r.before.expect}/${r.after.expect} | ${r.before.describe}+${r.wrappers}/${r.after.describe} |`);
    tot.files += r.merged.length;
    tot.targets += 1;
    tot.it += r.before.it;
    tot.expect += r.before.expect;
  }
  lines.push(`| **total** | ${tot.files} files -> ${tot.targets} | ${tot.it}/${tot.it} | ${tot.expect}/${tot.expect} | |`);
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name, dflt = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : dflt;
  };
  const planPath = opt("plan");
  if (!planPath) {
    console.error("usage: merge.mjs --plan plan.json [--root dir] [--family a,b] [--family-match regex] [--part K/N] [--skip f1,f2] [--table out.md] [--result out.json] [--dry]");
    process.exit(2);
  }
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const root = opt("root", process.cwd());
  const families = opt("family") ? new Set(opt("family").split(",")) : null;
  const familyMatch = opt("family-match") ? new RegExp(opt("family-match")) : null;
  const part = opt("part") ? opt("part").split("/").map(Number) : null;
  const skip = new Set(opt("skip") ? opt("skip").split(",").filter(Boolean) : []);
  const { failures, results } = runMerge({ plan, root, families, familyMatch, part, skip, dry: args.includes("--dry") });
  if (failures.length) {
    console.error("COUNT MISMATCH — nothing written:\n" + failures.join("\n"));
    process.exit(1);
  }
  const table = renderTable(results);
  if (opt("table")) writeFileSync(opt("table"), table + "\n");
  if (opt("result")) {
    writeFileSync(
      opt("result"),
      JSON.stringify(results.map(({ text, ...rest }) => rest), null, 2),
    );
  }
  const done = results.filter((r) => r.text);
  const excluded = results.flatMap((r) => r.excluded.map((e) => `${e.path}: ${e.reason}`));
  console.log(`merged ${done.reduce((a, r) => a + r.merged.length, 0)} files into ${done.length}; left out ${excluded.length}`);
  if (excluded.length) console.log(excluded.slice(0, 80).join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
