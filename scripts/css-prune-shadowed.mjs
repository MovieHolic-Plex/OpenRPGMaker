// 뒤 선언에 완전히 가려지는 앞 선언을 찾아 지운다. 스펙 §3.4 2단계.
//
// 가려짐의 정의: 같은 레이어·같은 at-규칙 문맥·같은 선택자·같은 속성인 뒤 선언이 있고,
// 앞 선언이 !important 가 아니거나 뒤 선언도 !important 인 경우. 값이 같아도 가려진 것이다(중복).
// 같은 선택자는 특이도가 같으므로 남는 판정 기준은 !important 와 순서뿐이다.
//
// 이 도구가 모르는 것: 브라우저가 뒤 값을 이해하지 못할 때를 위한 폴백
// (`height: 100vh; height: 100dvh;`). 같은 규칙 안에서 같은 속성이 다른 값으로 다시 나오면
// 폴백으로 보고 기본값으로 남긴다(keepFallbacks). 다른 규칙·다른 파일에 있는 폴백은 알아볼 수 없다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { flattenImports, indexDeclarations } from "./css-flatten.mjs";

const keyOf = (d) => `${d.layer ?? ""}|${d.at}|${d.sel}|${d.prop}`;
const beats = (earlier, later) => !earlier.imp || later.imp;

// 가려진 앞 선언과 그것을 가린 가장 가까운 뒤 선언의 쌍. 뒤 선언이 다시 가려질 수 있으므로 사슬로 읽는다.
export function findShadowedPairs(decls) {
  const byKey = new Map();
  for (const d of decls) {
    const k = keyOf(d);
    (byKey.get(k) ?? byKey.set(k, []).get(k)).push(d);
  }
  const out = [];
  for (const arr of byKey.values()) {
    arr.sort((x, y) => x.seq - y.seq);
    for (let i = 0; i < arr.length - 1; i++) {
      const winner = arr.slice(i + 1).find((b) => beats(arr[i], b));
      if (winner) out.push({ loser: arr[i], winner });
    }
  }
  return out.sort((x, y) => x.loser.seq - y.loser.seq);
}

export function findShadowed(decls) {
  return findShadowedPairs(decls).map((p) => p.loser);
}

const normValue = (v) => v.replace(/\s+/g, " ").trim();
const normSel = (s) => s.replace(/\s+/g, " ").trim();

// 대상은 {line, prop} 이 필수, {value, imp, sel} 은 있으면 함께 맞춘다.
// 한 줄에 선언이 여럿일 수 있어(`.k { color: red; margin: 0; }`) 줄 번호만으로는 지울 수 없다.
function checkTargets(targets) {
  for (const t of targets) {
    if (typeof t !== "object" || t === null || !Number.isInteger(t.line) || typeof t.prop !== "string") {
      throw new TypeError(`pruneSource: 대상은 {line, prop} 객체여야 한다: ${JSON.stringify(t)}`);
    }
  }
}

function matches(t, decl) {
  return t.line === decl.source.start.line
    && t.prop === decl.prop.toLowerCase()
    && (t.value === undefined || normValue(t.value) === normValue(decl.value))
    && (t.imp === undefined || Boolean(t.imp) === Boolean(decl.important));
}

// 같은 규칙 안에서 뒤에 같은 속성이 다른 값으로 다시 나오면 앞 것은 폴백이다.
function isFallback(decl, rule) {
  const i = rule.index(decl);
  return rule.nodes.some((n, j) => j > i && n.type === "decl"
    && n.prop.toLowerCase() === decl.prop.toLowerCase() && normValue(n.value) !== normValue(decl.value));
}

// 비어 버린 규칙과, 그래서 비어 버린 at-규칙을 위로 올라가며 지운다. 건드리지 않은 빈 규칙은 그대로 둔다.
const KEEP_EMPTY = new Set(["import", "layer", "keyframes", "font-face", "charset", "namespace"]);
function removeEmptied(node) {
  while (node && node.type !== "root" && node.nodes && node.nodes.length === 0) {
    if (node.type === "atrule" && KEEP_EMPTY.has(node.name)) return;
    const parent = node.parent;
    node.remove();
    node = parent;
  }
}

// 선언을 지운 새 소스. 건드리지 않은 노드는 postcss 가 원문 그대로 다시 쓴다.
// - 선택자 목록 규칙(`.a, .b { … }`) 의 선언은 목록의 모든 선택자에 대한 대상이 있을 때만 지운다.
//   대상에 sel 이 없으면 규칙 전체를 뜻하는 것으로 본다(단일 선택자 규칙에서만 안전).
// - 한 줄에 같은 (prop, value, imp) 가 여럿이면 대상 수만큼 앞에서부터 지운다 — 가려지는 쪽은 언제나 앞이다.
// - opts.keepFallbacks(기본 true): 같은 규칙 안에서 다른 값으로 다시 선언된 앞 선언은 폴백으로 보고 남긴다.
// - opts.stats 를 넘기면 removed 에 {target}, skipped 에 {target, reason} 을 채운다. target 은 넘긴 대상 객체 그대로다.
export function pruneSource(src, targets, opts = {}) {
  checkTargets(targets);
  const { keepFallbacks = true, from = undefined } = opts;
  const stats = opts.stats ?? {};
  const removed = (stats.removed ??= []);
  const skipped = (stats.skipped ??= []);
  const pending = targets.map((t) => ({ t, used: false }));
  const skip = (p, reason) => { p.used = true; skipped.push({ target: p.t, reason }); };
  const bom = src.startsWith("﻿") ? "﻿" : ""; // postcss 는 BOM 을 떼고 파싱한다 — 원문 그대로 되돌린다
  const root = postcss.parse(src, { from });
  const touched = new Set();
  root.walkDecls((decl) => {
    const rule = decl.parent;
    if (!rule || rule.type !== "rule") return;
    const candidates = pending.filter((p) => !p.used && matches(p.t, decl));
    if (candidates.length === 0) return;
    const sels = rule.selectors.map(normSel);
    const take = [];
    for (const s of sels) {
      const p = candidates.find((c) => !take.includes(c) && (c.t.sel === undefined ? sels.length === 1 : normSel(c.t.sel) === s));
      if (!p) break;
      take.push(p);
    }
    if (take.length !== sels.length) {
      if (sels.length > 1) for (const c of candidates) skip(c, `selector list "${normSel(rule.selector)}" not fully shadowed`);
      return;
    }
    if (keepFallbacks && isFallback(decl, rule)) {
      for (const p of take) skip(p, "fallback: same rule re-declares the property with a different value");
      return;
    }
    for (const p of take) { p.used = true; removed.push({ target: p.t }); }
    touched.add(rule);
    // `--x: y; /* 설명 */` — 같은 줄에 붙은 뒤 주석은 그 선언의 설명이므로 함께 지운다. 안 지우면 고아 주석이 한 줄로 뭉친다.
    const next = decl.next();
    decl.remove();
    if (next?.type === "comment" && next.source?.start.line === decl.source.end.line && !/\n/.test(next.raws.before ?? "")) next.remove();
  });
  for (const p of pending) if (!p.used) skip(p, "no matching declaration");
  for (const rule of touched) removeEmptied(rule);
  return bom + root.toString();
}

export function pruneFile(fileAbs, targets, opts = {}) {
  return pruneSource(fs.readFileSync(fileAbs, "utf8"), targets, { ...opts, from: fileAbs });
}

// --- CLI -----------------------------------------------------------------------
const USAGE = `usage:
  node scripts/css-prune-shadowed.mjs --all [--write] [--prune-fallbacks] [--json <path>]
  node scripts/css-prune-shadowed.mjs --surface <name> [--write] [--prune-fallbacks] [--json <path>]
--all              src/styles/index.css 그래프 전체(레이어 무관)
--surface          registry 의 표면 진입점을 평탄화하고 layer === <name> 인 선언만 본다
--write            없으면 시뮬레이션만(dry run) — 무엇을 지우고 무엇을 남길지는 두 모드가 같다
--prune-fallbacks  같은 규칙 안의 다른 값 재선언(폴백) 도 지운다. 기본은 남김
--json             쌍 목록을 [{file,line,sel,prop,value,imp,winnerFile,winnerLine,winnerValue,sameFile,sameValue,action}] 로 저장
                   action 은 "remove" 또는 "skip: <reason>"`;

function main(argv) {
  const args = argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? null) : undefined; };
  const all = args.includes("--all");
  const surface = flag("--surface");
  const write = args.includes("--write");
  const keepFallbacks = !args.includes("--prune-fallbacks");
  const jsonPath = flag("--json");
  if (all === Boolean(surface) || surface === null || surface?.startsWith("--") || jsonPath === null || jsonPath?.startsWith("--")) { console.error(USAGE); process.exit(1); }

  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const root = path.join(repo, "src/styles");
  let entry;
  if (all) entry = path.join(root, "index.css");
  else {
    const registry = JSON.parse(fs.readFileSync(path.join(repo, "scripts/css-surfaces.json"), "utf8"));
    const spec = registry.surfaces[surface];
    if (!spec) { console.error(`unknown surface: ${surface}\n${USAGE}`); process.exit(1); }
    entry = path.join(repo, spec.entry);
  }
  let decls = indexDeclarations(flattenImports(entry), root);
  if (surface) decls = decls.filter((d) => d.layer === surface);
  const pairs = findShadowedPairs(decls);

  // 쌍 한 줄이 곧 prune 대상이다. 시뮬레이션이 action 을 채운다.
  const rows = pairs.map(({ loser: l, winner: w }) => ({
    file: l.file, line: l.line, sel: l.sel, prop: l.prop, value: l.value, imp: l.imp,
    winnerFile: w.file, winnerLine: w.line, winnerValue: w.value,
    sameFile: l.file === w.file, sameValue: l.value === w.value, action: undefined,
  }));
  const byFile = new Map();
  for (const r of rows) (byFile.get(r.file) ?? byFile.set(r.file, []).get(r.file)).push(r);

  let removed = 0, skipped = 0;
  const skipReasons = new Map();
  for (const [file, targets] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
    const stats = {};
    const abs = path.join(root, file);
    const out = pruneFile(abs, targets, { stats, keepFallbacks });
    for (const { target } of stats.removed) target.action = "remove";
    for (const { target, reason } of stats.skipped) { target.action = `skip: ${reason}`; skipReasons.set(target.action, (skipReasons.get(target.action) ?? 0) + 1); }
    removed += stats.removed.length; skipped += stats.skipped.length;
    if (write && stats.removed.length) fs.writeFileSync(abs, out);
    console.log(`${file}: ${targets.length} shadowed decls → remove ${stats.removed.length}, skip ${stats.skipped.length}`);
  }
  for (const r of rows) if (r.action === undefined) r.action = "skip: not visited";
  if (jsonPath !== undefined) fs.writeFileSync(path.resolve(jsonPath), JSON.stringify(rows, null, 1) + "\n");

  const cross = pairs.filter((p) => p.loser.file !== p.winner.file).length;
  console.log(`total shadowed: ${pairs.length} (same-file ${pairs.length - cross}, cross-file ${cross}) in ${byFile.size} files`
    + ` → remove ${removed}, skip ${skipped}${write ? " (written)" : " (dry run)"}`);
  for (const [reason, n] of skipReasons) console.log(`  ${n} × ${reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
