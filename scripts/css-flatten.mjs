// CSS 평탄화 + 선언 인덱스. 다른 css-* 스크립트의 공통 라이브러리. 단독 실행 시 JSON 출력.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
// @import 파서는 scripts/lib/css-import-re.mjs 하나만 쓴다.
// 예전엔 여기 따로 정규식이 있었고 따옴표를 필수로 요구해, `@import url(x.css)` 형태가
// 이 도구에만 안 보였다 — 표면 검사에서 시트를 통째로 숨기는 세탁 경로가 됐다.
import { parseImports, stripCssComments } from "./lib/css-import-re.mjs";

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
    src = stripCssComments(src);
    for (const imp of parseImports(src)) {
      walk(path.resolve(path.dirname(abs), imp.spec), depth + 1, imp.layer ?? layer);
    }
  };
  walk(entryAbs, 0, null);
  return order;
}

function contextOf(node) {
  const layers = [];
  const at = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "atrule") continue;
    if (p.name === "layer") layers.push(p.params.trim());
    else at.push(`@${p.name} ${p.params.trim()}`);
  }
  return { layers: layers.reverse(), at: at.reverse().join(" / ") };
}

// 한 시트의 선언 목록. `layer` 는 `@import … layer(X)` 가 부여한 레이어다.
//
// layer 필드는 **실효 레이어 경로**다. import 가 준 레이어와 파일 안 `@layer` 가 겹치면
// 점으로 이어 붙인다 — `layer(runtime)` 으로 들어온 시트가 안에서 다시 `@layer runtime {`
// 으로 감싸면 `runtime.runtime` 서브레이어이고, 서브레이어는 부모 직속에게 **진다**.
// 예전엔 이 함수가 파일 안 이름 하나만 남기고 import 레이어를 버려서 둘을 구분할 수 없었다.
// 현재 리포에 이 모양인 시트가 9개 있다(components 3, shell 1, map 1, runtime 4).
export function declarationsOf({ name, css, layer = null }) {
  const ast = postcss.parse(css, { from: name });
  const out = [];
  ast.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    const ctx = contextOf(rule);
    const eff = [layer, ...ctx.layers].filter(Boolean).join(".") || null;
    for (const sel of rule.selectors.map((s) => s.replace(/\s+/g, " ").trim())) {
      rule.each((d) => {
        if (d.type !== "decl") return;
        out.push({
          file: name, line: d.source.start.line, sel, layer: eff, at: ctx.at,
          prop: d.prop.toLowerCase(), value: d.value.replace(/\s+/g, " ").trim(), imp: Boolean(d.important),
        });
      });
    }
  });
  return out;
}

function declsOfFile(entry, rootAbs) {
  let src;
  try { src = fs.readFileSync(entry.file, "utf8"); } catch { return []; }
  return declarationsOf({ name: path.relative(rootAbs, entry.file), css: src, layer: entry.layer });
}

// CSS 는 @import 가 규칙보다 앞에 와야 하므로, 허브 자신의 규칙은 그 허브가 import 한 모든 시트 뒤에 온다.
// 따라서 자식(깊이 큰 파일)을 먼저 내보내고 부모 자신의 선언은 부모의 부분 트리가 끝날 때 내보낸다.
export function emitOrder(order) {
  const out = [];
  const stack = [];
  for (const entry of order) {
    if (entry.copy > 1) continue;
    while (stack.length && stack[stack.length - 1].depth >= entry.depth) out.push(stack.pop());
    stack.push(entry);
  }
  while (stack.length) out.push(stack.pop());
  return out;
}

export function indexDeclarations(order, rootAbs) {
  const decls = [];
  let seq = 0;
  for (const entry of emitOrder(order)) {
    for (const d of declsOfFile(entry, rootAbs)) decls.push({ seq: seq++, ...d });
  }
  return decls;
}

// --- 선택자 스캐너 -----------------------------------------------------------
// 정규식은 괄호 깊이를 모른다. `:nth-child(2n+1)` 의 `+`, `:not(.b > .c)` 의 `>`,
// `[href="x y"]` 의 공백은 결합자가 아니므로 문자 단위로 깊이를 세며 걷는다.

// s[i] 가 여는 따옴표일 때 닫는 따옴표 다음 인덱스. 백슬래시 이스케이프를 건너뛴다.
function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === q) return i + 1;
  }
  return s.length;
}

// s[i] 가 `(` 또는 `[` 일 때 짝이 되는 닫는 괄호 다음 인덱스. 중첩과 문자열을 존중한다.
function skipGroup(s, i) {
  const open = s[i], close = open === "(" ? ")" : "]";
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === '"' || c === "'") i = skipString(s, i) - 1;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  return s.length;
}

// 최상위(깊이 0)에서만 `sep(c)` 가 참인 문자로 나눈다. 빈 조각은 버린다.
function splitTopLevel(s, sep) {
  const parts = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") i++;
    else if (c === '"' || c === "'") i = skipString(s, i) - 1;
    else if (c === "(" || c === "[") i = skipGroup(s, i) - 1;
    else if (sep(c)) { if (i > start) parts.push(s.slice(start, i)); start = i + 1; }
  }
  if (start < s.length) parts.push(s.slice(start));
  return parts;
}

const isCombinator = (c) => c === ">" || c === "+" || c === "~" || /\s/.test(c);
const splitCompounds = (sel) => splitTopLevel(sel, isCombinator);
const splitArgs = (args) => splitTopLevel(args, (c) => c === ",").map((a) => a.trim()).filter(Boolean);

const isIdent = (c) => c !== undefined && /[\w-]/.test(c);
function scanIdent(s, i) {
  while (i < s.length && (isIdent(s[i]) || s[i] === "\\")) i += s[i] === "\\" ? 2 : 1;
  return i;
}

// 복합 선택자를 단순 선택자 토큰으로 나눈다. 의사 클래스 함수는 중첩 인수까지 통째로 한 토큰이다.
// 모르는 문자(`&`, `%` 등)는 other 로 남겨 원문을 그대로 재조립할 수 있게 한다.
function tokenizeCompound(comp) {
  const tokens = [];
  let i = 0;
  while (i < comp.length) {
    const c = comp[i];
    let j;
    if (c === "[") {
      j = skipGroup(comp, i);
      tokens.push({ kind: "attr", text: comp.slice(i, j) });
    } else if (c === ":") {
      const element = comp[i + 1] === ":";
      const nameStart = i + (element ? 2 : 1);
      j = scanIdent(comp, nameStart);
      const name = comp.slice(nameStart, j).toLowerCase();
      let arg = null;
      if (comp[j] === "(") { const k = skipGroup(comp, j); arg = comp.slice(j + 1, k - 1); j = k; }
      tokens.push({ kind: element ? "pseudoElement" : "pseudoClass", name, arg, text: comp.slice(i, j) });
    } else if (c === "." || c === "#") {
      j = scanIdent(comp, i + 1);
      tokens.push({ kind: c === "." ? "class" : "id", text: comp.slice(i, j) });
    } else if (c === "*") {
      j = i + 1;
      tokens.push({ kind: "universal", text: "*" });
    } else if (/[a-zA-Z_\\]/.test(c)) {
      j = scanIdent(comp, i);
      tokens.push({ kind: "type", text: comp.slice(i, j) });
    } else {
      j = i + 1;
      tokens.push({ kind: "other", text: c });
    }
    i = j;
  }
  return tokens;
}

// CSS Selectors 4 §17. :not/:is/:has 는 가장 특이한 인수의 특이도, :where 는 0, 그 외 함수형은 의사 클래스 하나.
const MOST_SPECIFIC_ARG = new Set(["not", "is", "has", "matches", "any"]);
const LEGACY_PSEUDO_ELEMENTS = new Set(["before", "after", "first-line", "first-letter"]);

const compareTriple = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function specificityTriple(sel) {
  const t = [0, 0, 0];
  for (const comp of splitCompounds(sel)) {
    for (const tok of tokenizeCompound(comp)) {
      switch (tok.kind) {
        case "id": t[0]++; break;
        case "class": case "attr": t[1]++; break;
        case "type": case "pseudoElement": t[2]++; break;
        case "pseudoClass":
          if (tok.arg !== null && MOST_SPECIFIC_ARG.has(tok.name)) {
            let best = [0, 0, 0];
            for (const arg of splitArgs(tok.arg)) {
              const s = specificityTriple(arg);
              if (compareTriple(s, best) > 0) best = s;
            }
            t[0] += best[0]; t[1] += best[1]; t[2] += best[2];
          } else if (tok.name === "where") {
            // 0
          } else if (LEGACY_PSEUDO_ELEMENTS.has(tok.name)) {
            t[2]++;
          } else {
            t[1]++;
          }
          break;
        default: break; // universal, other
      }
    }
  }
  return t;
}

export function specificity(sel) {
  const [ids, classes, types] = specificityTriple(sel);
  return ids * 10000 + classes * 100 + types;
}

export function lastCompound(sel) {
  const parts = splitCompounds(sel.trim());
  const last = parts[parts.length - 1] ?? "";
  return tokenizeCompound(last)
    .filter((tok) => tok.kind !== "pseudoClass" && tok.kind !== "pseudoElement")
    .map((tok) => tok.text)
    .join("");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = path.resolve(process.argv[2] ?? "src/styles/index.css");
  const root = path.resolve("src/styles");
  const order = flattenImports(entry);
  const decls = indexDeclarations(order, root);
  process.stdout.write(JSON.stringify({ order: order.map((o) => ({ ...o, file: path.relative(root, o.file) })), decls }));
}
