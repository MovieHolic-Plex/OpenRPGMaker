// CSS 평탄화 + 선언 인덱스. 다른 css-* 스크립트의 공통 라이브러리. 단독 실행 시 JSON 출력.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?([^;]*);/g;

export function flattenImports(entryAbs) {
  const order = [];
  const seen = new Map();
  const walk = (file, depth, layer) => {
    const abs = path.resolve(file);
    const copy = (seen.get(abs) ?? 0) + 1;
    seen.set(abs, copy);
    order.push({ file: abs, depth, layer, copy });
    if (copy > 1) return; // postcss-import 는 첫 위치로 dedup 한다
    let src;
    try { src = fs.readFileSync(abs, "utf8"); } catch { return; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(IMPORT_RE)) {
      const tail = m[2] ?? "";
      const lm = /layer\(\s*([\w.-]+)\s*\)/.exec(tail);
      walk(path.resolve(path.dirname(abs), m[1]), depth + 1, lm ? lm[1] : layer);
    }
  };
  walk(entryAbs, 0, null);
  return order;
}

function contextOf(node) {
  let layer = null;
  const at = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "atrule") continue;
    if (p.name === "layer") layer = p.params.trim();
    else at.push(`@${p.name} ${p.params.trim()}`);
  }
  return { layer, at: at.reverse().join(" / ") };
}

function declsOfFile(entry, rootAbs) {
  let src;
  try { src = fs.readFileSync(entry.file, "utf8"); } catch { return []; }
  const ast = postcss.parse(src, { from: entry.file });
  const rel = path.relative(rootAbs, entry.file);
  const out = [];
  ast.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && rule.parent.name === "keyframes") return;
    const ctx = contextOf(rule);
    const layer = ctx.layer ?? entry.layer;
    for (const sel of rule.selectors.map((s) => s.replace(/\s+/g, " ").trim())) {
      rule.each((d) => {
        if (d.type !== "decl") return;
        out.push({
          file: rel, line: d.source.start.line, sel, layer, at: ctx.at,
          prop: d.prop.toLowerCase(), value: d.value.replace(/\s+/g, " ").trim(), imp: Boolean(d.important),
        });
      });
    }
  });
  return out;
}

// CSS 는 @import 가 규칙보다 앞에 와야 하므로, 허브 자신의 규칙은 그 허브가 import 한 모든 시트 뒤에 온다.
// 따라서 자식(깊이 큰 파일)을 먼저 내보내고 부모 자신의 선언은 부모의 부분 트리가 끝날 때 내보낸다.
export function indexDeclarations(order, rootAbs) {
  const decls = [];
  let seq = 0;
  const emit = (entry) => { for (const d of declsOfFile(entry, rootAbs)) decls.push({ seq: seq++, ...d }); };
  const stack = [];
  for (const entry of order) {
    if (entry.copy > 1) continue;
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) emit(stack.pop());
    stack.push(entry);
  }
  while (stack.length) emit(stack.pop());
  return decls;
}

export function specificity(sel) {
  let ids = 0, classes = 0, types = 0;
  const s = sel.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, (m) => {
    if (m.startsWith("::") || /^:(before|after|first-line|first-letter)/.test(m)) types++;
    else if (!/^:(is|where|not|has)\(/.test(m)) classes++;
    return " ";
  });
  ids += (s.match(/#[\w-]+/g) ?? []).length;
  classes += (s.match(/\.[\w-]+/g) ?? []).length + (s.match(/\[[^\]]+\]/g) ?? []).length;
  types += (s.match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) ?? []).length;
  return ids * 10000 + classes * 100 + types;
}

export function lastCompound(sel) {
  const parts = sel.trim().split(/\s*[>~+]\s*|\s+(?![^(]*\))/);
  return parts[parts.length - 1].replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = path.resolve(process.argv[2] ?? "src/styles/index.css");
  const root = path.resolve("src/styles");
  const order = flattenImports(entry);
  const decls = indexDeclarations(order, root);
  process.stdout.write(JSON.stringify({ order: order.map((o) => ({ ...o, file: path.relative(root, o.file) })), decls }));
}
