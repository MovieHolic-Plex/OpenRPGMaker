// R5(CSS→TS 죽은 선택자) 규칙을 지운다. 스펙 §3.4 3단계.
//
// 게이트(check-css-surfaces.mjs)가 "죽은 선택자"로 판정한 (file, sel) 을 받아 그 파일에서
// - 규칙의 선택자 목록 전부가 죽었으면 규칙을 통째로 지우고,
// - 일부만 죽었으면 그 선택자만 목록에서 뺀다(`.a, .dead { … }` → `.a { … }`).
// @keyframes(벤더 접두 포함) 안의 규칙과 다른 규칙 안에 중첩된 규칙(CSS nesting)은 건드리지 않고 건너뛴 이유를 남긴다.
// 건드리지 않은 노드는 postcss 가 원문 그대로 다시 쓰고, BOM 도 되돌린다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { runSurfaceChecks } from "./check-css-surfaces.mjs";

// 게이트(css-flatten.mjs declsOfFile)가 sel 을 만드는 것과 같은 정규화 — 공백만 접고 대소문자는 건드리지 않는다.
export const normSel = (s) => s.replace(/\s+/g, " ").trim();

// 비어 버린 at-규칙을 위로 올라가며 지운다. 건드리지 않은 빈 노드는 그대로 둔다.
const KEEP_EMPTY = new Set(["import", "layer", "keyframes", "font-face", "charset", "namespace"]);
function removeEmptied(node) {
  while (node && node.type !== "root" && node.nodes && node.nodes.length === 0) {
    if (node.type === "atrule" && KEEP_EMPTY.has(node.name)) return;
    const parent = node.parent;
    node.remove();
    node = parent;
  }
}

// 규칙이 놓인 자리가 손댈 수 없는 곳이면 그 이유, 아니면 null.
function untouchableReason(rule) {
  for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "rule") return "nested rule";
    if (p.type === "atrule" && /keyframes$/.test(p.name)) return `inside @${p.name}`;
  }
  return null;
}

// 죽은 선택자를 뺀 새 소스.
// - deadSelectors 는 정규화된(normSel) 선택자의 Set 이다. 게이트의 v.sel 을 그대로 넣으면 된다.
// - opts.stats 를 넘기면 removed 에 {sel, line, action}, skipped 에 {sel, line, reason} 을 채운다.
//   action 은 "remove-rule" 또는 "remove-from-list". 한 선택자가 여러 규칙에 나오면 규칙마다 한 항목이다.
export function dropDeadSource(src, deadSelectors, opts = {}) {
  const { from = undefined } = opts;
  const stats = opts.stats ?? {};
  const removed = (stats.removed ??= []);
  const skipped = (stats.skipped ??= []);
  const bom = src.startsWith("﻿") ? "﻿" : ""; // postcss 는 BOM 을 떼고 파싱한다 — 원문 그대로 되돌린다
  const root = postcss.parse(src, { from });
  const doomed = [];
  root.walkRules((rule) => {
    const line = rule.source?.start.line ?? 0;
    const dead = rule.selectors.filter((s) => deadSelectors.has(normSel(s)));
    if (dead.length === 0) return;
    const reason = untouchableReason(rule);
    if (reason) { for (const s of dead) skipped.push({ sel: normSel(s), line, reason }); return; }
    if (dead.length === rule.selectors.length) {
      for (const s of dead) removed.push({ sel: normSel(s), line, action: "remove-rule" });
      doomed.push(rule); // 걷는 도중에 지우면 walk 가 어긋나므로 모아서 지운다
    } else {
      for (const s of dead) removed.push({ sel: normSel(s), line, action: "remove-from-list" });
      rule.selectors = rule.selectors.filter((s) => !deadSelectors.has(normSel(s)));
    }
  });
  for (const rule of doomed) {
    // `.x { … } /* 설명 */` — 같은 줄에 붙은 뒤 주석은 그 규칙의 설명이므로 함께 지운다.
    const next = rule.next();
    const parent = rule.parent;
    rule.remove();
    if (next?.type === "comment" && next.source?.start.line === rule.source?.end.line && !/\n/.test(next.raws.before ?? "")) next.remove();
    removeEmptied(parent);
  }
  return bom + root.toString();
}

export function dropDeadRules(fileAbs, deadSelectors, opts = {}) {
  return dropDeadSource(fs.readFileSync(fileAbs, "utf8"), deadSelectors, { ...opts, from: fileAbs });
}

// --- CLI -----------------------------------------------------------------------
const USAGE = `usage:
  node scripts/css-drop-dead.mjs --surface <name> [--write] [--json <path>]
--surface  registry(scripts/css-surfaces.json) 의 표면 이름. 게이트 R5 위반 중 그 표면 파일의 것만 지운다
--write    없으면 시뮬레이션만(dry run) — 무엇을 지우고 무엇을 남길지는 두 모드가 같다
--json     행 목록을 [{file,line,sel,action}] 으로 저장. action 은 "remove-rule" | "remove-from-list" | "skip: <reason>"`;

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? null) : undefined; };
  const surface = flag("--surface");
  const write = args.includes("--write");
  const jsonPath = flag("--json");
  if (!surface || surface.startsWith("--") || jsonPath === null) { console.error(USAGE); process.exit(1); }

  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const registry = JSON.parse(fs.readFileSync(path.join(repo, "scripts/css-surfaces.json"), "utf8"));
  if (!registry.surfaces[surface]) { console.error(`unknown surface: ${surface}\n${USAGE}`); process.exit(1); }
  const stylesRoot = path.join(repo, "src/styles");
  const entries = [path.join(stylesRoot, "index.css"), ...Object.values(registry.surfaces).map((s) => path.join(repo, s.entry))]
    .filter((p, i, a) => fs.existsSync(p) && a.indexOf(p) === i);
  const { violations } = runSurfaceChecks({ stylesRoot, srcRoot: path.join(repo, "src"), registry, entries });

  // 게이트는 (file, sel) 당 한 번만 낸다. 파일별 죽은 선택자 집합으로 모은다.
  const byFile = new Map();
  for (const v of violations) {
    if (v.rule !== "R5" || v.surface !== surface) continue;
    const sel = v.sel ?? v.message.replace(/^죽은 선택자 /, "");
    (byFile.get(v.file) ?? byFile.set(v.file, new Set()).get(v.file)).add(normSel(sel));
  }

  const rows = [];
  const actions = new Map();
  const count = (a) => actions.set(a, (actions.get(a) ?? 0) + 1);
  let n = 0;
  for (const [file, sels] of [...byFile].sort((a, b) => b[1].size - a[1].size)) {
    n += sels.size;
    const abs = path.join(stylesRoot, file);
    const stats = {};
    const out = dropDeadRules(abs, sels, { stats });
    const seen = new Set();
    for (const r of stats.removed) { rows.push({ file, line: r.line, sel: r.sel, action: r.action }); count(r.action); seen.add(r.sel); }
    for (const r of stats.skipped) { const a = `skip: ${r.reason}`; rows.push({ file, line: r.line, sel: r.sel, action: a }); count(a); seen.add(r.sel); }
    for (const sel of sels) if (!seen.has(sel)) { const a = "skip: no matching rule"; rows.push({ file, line: 0, sel, action: a }); count(a); }
    const removeRule = stats.removed.filter((r) => r.action === "remove-rule").length;
    const fromList = stats.removed.length - removeRule;
    console.log(`${file}: ${sels.size} dead selectors → remove-rule ${removeRule}, remove-from-list ${fromList}, skip ${stats.skipped.length}`);
    if (write && stats.removed.length) fs.writeFileSync(abs, out);
  }
  if (jsonPath !== undefined) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(rows, null, 1) + "\n");
  console.log(`total dead selectors: ${n} in ${byFile.size} files${write ? " (written)" : " (dry run)"}`);
  for (const [a, c] of [...actions].sort((x, y) => y[1] - x[1])) console.log(`  ${c} × ${a}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
