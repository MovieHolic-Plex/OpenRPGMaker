// CSS 표면 격리 게이트 — 스펙 docs/superpowers/specs/2026-09-11-css-surface-isolation-design.md §3.3 R1–R6.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flattenImports, indexDeclarations } from "./css-flatten.mjs";

const BASELINE_PATH = "scripts/css-surfaces.baseline.json";
// 기준선 지문을 남기는 규칙. R1 은 표면별 카운트(unlayered, hubs)로 래칫한다.
const FINGERPRINT_RULES = new Set(["R2", "R4", "R5", "R6"]);
// 레지스트리 표면에 속하지 않는 파일(surface === null)의 카운트 버킷. 레지스트리 surfaces 에는 넣지 않는다.
const UNASSIGNED = "unassigned";
const COUNT_KEYS = ["important", "unlayered", "hubs"];
const bucketOf = (surface) => surface ?? UNASSIGNED;

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|^\.|dist|output/.test(e.name)) walkFiles(p, exts, out); }
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

// 여러 진입 시트를 하나의 dedup 으로 평탄화한다. 앞선 진입에서 이미 닿은 파일은 뒤 진입에서 copy > 1 이다.
function flattenAll(entries) {
  const seen = new Map();
  const out = [];
  for (const e of entries) {
    for (const o of flattenImports(e)) {
      const n = (seen.get(o.file) ?? 0) + 1;
      seen.set(o.file, n);
      out.push(n === o.copy ? o : { ...o, copy: n });
    }
  }
  return out;
}

function surfaceOfFile(relFile, registry) {
  for (const [name, s] of Object.entries(registry.surfaces)) {
    const dir = s.dir.replace(/^src\/styles\/?/, "").replace(/^styles\/?/, "");
    if (dir && (relFile === dir || relFile.startsWith(dir + "/"))) return name;
  }
  return null;
}

function classTokens(sel) {
  // [attr="..."] 안의 텍스트와 :not(.x) 안의 클래스는 규칙이 스타일하는 대상이 아니다 → 제외
  const stripped = sel.replace(/\[[^\]]*\]/g, "").replace(/:not\([^)]*\)/g, "");
  return [...stripped.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

// `-` 로 끝나는 항목만 접두어(startsWith), 나머지 낱말은 정확히 일치해야 한다.
function matchesPrefix(cls, p) {
  return p.endsWith("-") ? cls === p.slice(0, -1) || cls.startsWith(p) : cls === p;
}

function collectSourceTokens(srcRoot, minLen) {
  const files = walkFiles(srcRoot, [".ts", ".tsx", ".js", ".html"]);
  const literal = new Set();
  const dynamicPrefixes = new Set();
  for (const f of files) {
    if (f.includes(`${path.sep}styles${path.sep}`)) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/[\w-]+/g)) literal.add(m[0]);
    for (const m of src.matchAll(/`([\w-]*[-_])\$\{/g)) if (m[1].length >= minLen) dynamicPrefixes.add(m[1]);
    for (const m of src.matchAll(/["']([\w-]*[-_])["']\s*\+/g)) if (m[1].length >= minLen) dynamicPrefixes.add(m[1]);
  }
  return { literal, dynamicPrefixes: [...dynamicPrefixes] };
}

function parseVarUses(value) {
  const out = [];
  let i = 0;
  while ((i = value.indexOf("var(", i)) !== -1) {
    let j = i + 4, depth = 1;
    while (j < value.length && depth > 0) { if (value[j] === "(") depth++; else if (value[j] === ")") depth--; j++; }
    const inner = value.slice(i + 4, j - 1);
    const c = inner.indexOf(",");
    out.push({ name: (c === -1 ? inner : inner.slice(0, c)).trim(), fallback: c === -1 ? null : inner.slice(c + 1).trim() });
    i = j;
  }
  return out;
}

export function runSurfaceChecks({ stylesRoot, srcRoot, registry, entries }) {
  const violations = [];
  const counts = Object.fromEntries([...Object.keys(registry.surfaces), UNASSIGNED].map((s) => [s, { important: 0, unlayered: 0, hubs: 0 }]));
  const push = (rule, surface, file, line, sel, detail, message) => violations.push({ rule, surface, file, line, sel, detail, message });

  const order = flattenAll(entries);
  const decls = indexDeclarations(order, stylesRoot);
  const entryRel = new Set(entries.map((e) => path.relative(stylesRoot, e)));
  for (const s of Object.values(registry.surfaces)) entryRel.add(s.entry.replace(/^src\/styles\/?/, "").replace(/^styles\/?/, ""));

  // 토큰 정의 수집 (R4)
  const defsBySurface = new Map(); // surface|null -> Set(name)
  for (const d of decls) {
    if (!d.prop.startsWith("--")) continue;
    const s = surfaceOfFile(d.file, registry);
    if (!defsBySurface.has(s)) defsBySurface.set(s, new Set());
    defsBySurface.get(s).add(d.prop);
  }
  const tokenDefs = defsBySurface.get("tokens") ?? new Set();
  const tsDefs = new Set();
  for (const f of walkFiles(srcRoot, [".ts", ".tsx"])) {
    if (f.includes(`${path.sep}styles${path.sep}`)) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/setProperty\(\s*[`"'](--[\w-]+)/g)) tsDefs.add(m[1]);
    for (const m of src.matchAll(/setProperty\(\s*`(--[\w-]*)\$\{/g)) tsDefs.add(m[1] + "*");
  }
  const tsDefined = (name) => tsDefs.has(name) || [...tsDefs].some((k) => k.endsWith("*") && name.startsWith(k.slice(0, -1)));

  const source = collectSourceTokens(srcRoot, registry.dynamicPrefixMinLength ?? 3);
  const alive = (cls) => source.literal.has(cls) || source.dynamicPrefixes.some((p) => cls.startsWith(p));

  // R2 — 상태 클래스(is-/active/...)는 공유 어휘라 어느 표면의 소유도 아니다.
  const sharedState = registry.sharedStatePrefixes ?? [];

  const seenRule = new Set();
  for (const d of decls) {
    const surface = surfaceOfFile(d.file, registry);
    const spec = surface ? registry.surfaces[surface] : null;
    // R1 — (file, sel) 당 한 번
    if (!d.layer && (!surface || !["tokens", "base"].includes(surface))) {
      const key = `R1|${d.file}|${d.sel}`;
      if (!seenRule.has(key)) {
        seenRule.add(key);
        counts[bucketOf(surface)].unlayered++;
        push("R1", surface, d.file, d.line, d.sel, "", `언레이어 규칙: ${d.sel}`);
      }
    }
    // R3
    if (d.imp && surface !== "overrides") counts[bucketOf(surface)].important++;
    // R2
    if (spec && !spec.prefixes.includes("*")) {
      const allowed = [...spec.prefixes, ...(registry.surfaces.components?.prefixes ?? []), ...sharedState];
      for (const cls of classTokens(d.sel)) {
        if (!allowed.some((p) => matchesPrefix(cls, p))) {
          const key = `R2|${d.file}|${d.line}|${cls}`;
          if (!seenRule.has(key)) { seenRule.add(key); push("R2", surface, d.file, d.line, d.sel, cls, `표면 밖 클래스 .${cls} in ${d.sel}`); }
        }
      }
    }
    // R4
    for (const u of parseVarUses(d.value)) {
      const definedHere = defsBySurface.get(surface)?.has(u.name);
      if (tokenDefs.has(u.name) || definedHere || tsDefined(u.name)) continue;
      const fallbackOk = u.fallback !== null && (!/var\(/.test(u.fallback) || parseVarUses(u.fallback).every((f) => tokenDefs.has(f.name)));
      if (fallbackOk) continue;
      const key = `R4|${d.file}|${d.line}|${u.name}`;
      if (!seenRule.has(key)) { seenRule.add(key); push("R4", surface, d.file, d.line, d.sel, u.name, `미정의 변수 ${u.name} (폴백 없음)`); }
    }
    // R5 — 선택자의 클래스 전부가 소스에 없을 때만
    const classes = classTokens(d.sel);
    if (classes.length > 0 && classes.every((c) => !alive(c))) {
      const key = `R5|${d.file}|${d.sel}`;
      if (!seenRule.has(key)) { seenRule.add(key); push("R5", surface, d.file, d.line, d.sel, d.sel, `죽은 선택자 ${d.sel}`); }
    }
  }
  // R6 — 순서 주석
  const patterns = registry.orderCommentPatterns ?? [];
  const cssFiles = new Set(order.map((o) => o.file));
  for (const abs of cssFiles) {
    const rel = path.relative(stylesRoot, abs);
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    lines.forEach((L, i) => {
      if (!patterns.some((p) => L.includes(p))) return;
      const text = L.trim().slice(0, 80);
      push("R6", surfaceOfFile(rel, registry), rel, i + 1, "", text, `순서 주석: ${text}`);
    });
  }
  // 허브 깊이 1 (진입 시트 밖 @import)
  for (const o of order) {
    if (o.copy > 1) continue;
    const rel = path.relative(stylesRoot, o.file);
    if (o.depth >= 1 && !entryRel.has(rel) && /@import/.test(fs.readFileSync(o.file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))) {
      const surface = surfaceOfFile(rel, registry);
      counts[bucketOf(surface)].hubs++;
      push("R1", surface, rel, 1, "", "", "진입 시트가 아닌 파일의 @import (허브 깊이 1 위반)");
    }
  }
  return { violations, counts };
}

// 줄 번호를 넣지 않는다 — 위쪽 편집으로 줄이 밀려도 같은 부채는 같은 지문이어야 한다.
export function fingerprint(v) { return `${v.rule}|${v.file}|${v.sel}|${v.detail}`; }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const registry = JSON.parse(fs.readFileSync("scripts/css-surfaces.json", "utf8"));
  const stylesRoot = path.resolve("src/styles");
  const entries = [path.resolve("src/styles/index.css"), ...Object.values(registry.surfaces).map((s) => path.resolve(s.entry))]
    .filter((p, i, a) => fs.existsSync(p) && a.indexOf(p) === i);
  const { violations, counts } = runSurfaceChecks({ stylesRoot, srcRoot: path.resolve("src"), registry, entries });
  const fingerprinted = violations.filter((v) => FINGERPRINT_RULES.has(v.rule));
  if (args.includes("--baseline")) {
    const known = [...new Set(fingerprinted.map(fingerprint))].sort();
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ counts, known }, null, 2) + "\n");
    console.log(`baseline saved: ${known.length} known fingerprints, ${violations.length} violations`);
    process.exit(0);
  }
  const baseline = fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) : { counts: {}, known: [] };
  const known = new Set(baseline.known);
  const enforce = new Set(args.flatMap((a, i) => (a === "--enforce" ? [args[i + 1]] : [])));
  const enforced = (s) => enforce.has("all") || enforce.has(bucketOf(s));
  let failed = false;
  const byRule = {};
  for (const v of violations) byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
  for (const v of fingerprinted) {
    if (!known.has(fingerprint(v)) && enforced(v.surface)) { failed = true; console.error(`FAIL ${v.rule} [${bucketOf(v.surface)}] ${v.file}:${v.line} ${v.message}`); }
  }
  for (const [s, c] of Object.entries(counts)) {
    if (!enforced(s)) continue;
    for (const k of COUNT_KEYS) {
      // 기준선에 없는 표면은 0 — 새로 등록한 표면은 처음부터 강제된다.
      const base = baseline.counts?.[s]?.[k] ?? 0;
      if (c[k] > base) { failed = true; console.error(`FAIL ${k === "important" ? "R3" : "R1"} [${s}] ${k} ${base} → ${c[k]}`); }
    }
  }
  const summary = (k) => JSON.stringify(Object.fromEntries(Object.entries(counts).map(([s, c]) => [s, c[k]])));
  console.log("css-surfaces:", JSON.stringify(byRule), ...COUNT_KEYS.flatMap((k) => [`${k}:`, summary(k)]));
  process.exit(failed ? 1 : 0);
}
