// 시험 파일 합치기 도구의 핵심 — TypeScript AST 로 파일을 읽고, 같은 모듈 가족의 파일들을 한 파일로 합친다.
//
// 왜: 파일마다 import·환경 준비에 10~15초가 든다(ci-full 샤드 시간의 29~45%). 버그 하나마다 새로 생긴 1~3개짜리 파일을
// 사람이 하나씩 옮기면 끝이 안 나므로, 같은 일을 기계로 한다. 규칙은 scripts/test-merge/README.md 와 같다.
//
// 이 파일은 시험을 돌리지 않는다. 읽고 쓰고 세기만 한다.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript5"; // typescript 는 7(native)이라 JS API 가 없다. 5.9 별칭을 쓴다.

const parse = (path, text) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const TEST_ROOTS = new Set(["it", "test"]);
const HOOK_NAMES = new Set(["beforeEach", "afterEach", "beforeAll", "afterAll"]);
const MOCK_RE = /^vi\.(mock|doMock|unmock|doUnmock|hoisted)\b/;

/** `a.b.c` 형태 식별자 사슬을 문자열로. 아니면 null. */
function chainText(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    const left = chainText(node.expression);
    return left === null ? null : `${left}.${node.name.text}`;
  }
  return null;
}

/** it / test / describe 호출이면 종류('it'|'describe')를 돌려준다. `.each(rows)(name, fn)` 의 바깥 호출 하나만 센다. */
export function callKind(call) {
  const callee = call.expression;
  let chain = chainText(callee);
  if (chain === null && ts.isCallExpression(callee)) {
    // it.each(rows)("name", fn)
    const inner = chainText(callee.expression);
    if (inner && /\.each$/.test(inner)) chain = inner;
    else return null;
    const root = chain.split(".")[0];
    if (TEST_ROOTS.has(root)) return "it";
    if (root === "describe") return "describe";
    return null;
  }
  if (chain === null && ts.isTaggedTemplateExpression(callee)) return null;
  if (chain === null) return null;
  const parts = chain.split(".");
  const root = parts[0];
  // `it.each(rows)` 자체(뒤에 ("name", fn) 이 따로 붙는다)는 세지 않는다.
  if (parts[parts.length - 1] === "each") return null;
  if (TEST_ROOTS.has(root)) return "it";
  if (root === "describe") return "describe";
  return null;
}

/** it/test(.each 행은 호출 하나), describe, expect( 호출 수를 AST 로 센다. */
export function countCalls(text, path = "x.test.ts") {
  const sf = parse(path, text);
  const out = { it: 0, describe: 0, expect: 0 };
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const kind = callKind(node);
      if (kind) out[kind] += 1;
      else if (ts.isIdentifier(node.expression) && node.expression.text === "expect") out.expect += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const normMod = (m) => m.replace(/^\.\.\/src\//, "@/").replace(/^node:/, "");

/** import 선언 하나를 {mod, side, specs[]} 로 푼다. */
function readImport(decl) {
  const mod = decl.moduleSpecifier.text;
  const c = decl.importClause;
  if (!c) return { mod, side: true, specs: [] };
  const specs = [];
  const declType = !!c.isTypeOnly;
  if (c.name) specs.push({ kind: "default", local: c.name.text, imported: "default", typeOnly: declType });
  if (c.namedBindings) {
    if (ts.isNamespaceImport(c.namedBindings)) specs.push({ kind: "ns", local: c.namedBindings.name.text, imported: "*", typeOnly: declType });
    else {
      for (const e of c.namedBindings.elements) {
        specs.push({
          kind: "named",
          local: e.name.text,
          imported: (e.propertyName || e.name).text,
          typeOnly: declType || !!e.isTypeOnly,
          alias: e.propertyName ? `${e.propertyName.text} as ${e.name.text}` : e.name.text,
        });
      }
    }
  }
  return { mod, side: false, specs };
}

function hasModifier(stmt, kind) {
  return !!stmt.modifiers?.some((m) => m.kind === kind);
}

/** 노드 안(함수 본문 밖)에서 곧바로 실행되는 호출·new 가 있는가 */
function hasEagerCall(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) return;
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function containsTestCall(node) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isCallExpression(n) && (callKind(n) || (ts.isIdentifier(n.expression) && HOOK_NAMES.has(n.expression.text)))) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function topLevelAwait(sf) {
  let found = false;
  const visit = (n) => {
    if (found) return;
    if (ts.isFunctionLike(n) || ts.isClassLike(n)) return;
    if (ts.isAwaitExpression(n) || (ts.isForOfStatement(n) && n.awaitModifier)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function exprText(stmt) {
  return ts.isExpressionStatement(stmt) ? stmt.expression.getText() : "";
}

/**
 * 파일 하나를 분석한다. 합칠 수 없는 사유는 reasons 에 모은다.
 * stmts[i].role: 'import' | 'mock' | 'keep' | 'effect'
 */
export function analyzeFile(path, text) {
  const sf = parse(path, text);
  const reasons = [];
  const envMatch = text.slice(0, Math.max(0, (sf.statements[0]?.getStart() ?? text.length))).match(/@vitest-environment\s+(\S+)/);
  const env = envMatch ? envMatch[1] : "node";
  const imports = [];
  const mocks = [];
  const stmts = [];
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s)) {
      imports.push(readImport(s));
      stmts.push({ node: s, role: "import" });
      continue;
    }
    if (s.kind === ts.SyntaxKind.EmptyStatement) continue;
    if (hasModifier(s, ts.SyntaxKind.DeclareKeyword)) {
      reasons.push("declare");
      continue;
    }
    if (ts.isExpressionStatement(s)) {
      const t = exprText(s);
      if (ts.isStringLiteral(s.expression)) continue; // "use strict" 같은 지시문
      const head = ts.isCallExpression(s.expression) ? chainText(s.expression.expression) : null;
      if (MOCK_RE.test(t.replace(/\s+/g, ""))) {
        mocks.push(s.getText().replace(/\s+/g, " "));
        stmts.push({ node: s, role: "mock" });
        continue;
      }
      const isTestish = (ts.isCallExpression(s.expression) && (callKind(s.expression) || (head && HOOK_NAMES.has(head)))) || containsTestCall(s);
      stmts.push({ node: s, role: isTestish ? "keep" : "effect" });
      continue;
    }
    if (ts.isVariableStatement(s)) {
      if (s.declarationList.declarations.some((d) => d.initializer && /\bvi\.hoisted\b/.test(d.initializer.getText()))) {
        mocks.push(s.getText().replace(/\s+/g, " "));
        stmts.push({ node: s, role: "mock" });
        continue;
      }
      stmts.push({ node: s, role: "keep" });
      continue;
    }
    if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s) || ts.isTypeAliasDeclaration(s) || ts.isInterfaceDeclaration(s) || ts.isEnumDeclaration(s)) {
      stmts.push({ node: s, role: "keep" });
      continue;
    }
    if (ts.isForStatement(s) || ts.isForOfStatement(s) || ts.isForInStatement(s) || ts.isIfStatement(s) || ts.isBlock(s) || ts.isTryStatement(s) || ts.isWhileStatement(s)) {
      stmts.push({ node: s, role: containsTestCall(s) ? "keep" : "effect" });
      continue;
    }
    reasons.push(`unsupported:${ts.SyntaxKind[s.kind]}`);
  }
  if (topLevelAwait(sf)) reasons.push("top-level-await");
  // vi.resetModules() 는 시험마다 모듈 그래프를 새로 올린다 — 합친 파일에서는 힙이 한 프로세스에 쌓여 워커가 OOM 으로 죽는다(run 45388407639).
  if (/\bvi\.resetModules\(/.test(text)) reasons.push("reset-modules");
  // 되돌리지 않는 가짜 타이머·전역/환경 스텁은 같은 파일의 뒤 describe 로 샌다(파일이 따로일 때는 프로세스와 함께 사라졌다).
  if (/\bvi\.useFakeTimers\b/.test(text) && !/\bvi\.useRealTimers\b/.test(text)) reasons.push("fake-timers-leak");
  if (/\bvi\.stubGlobal\b/.test(text) && !/\bvi\.unstubAllGlobals\b/.test(text)) reasons.push("global-stub-leak");
  if (/\bvi\.stubEnv\b/.test(text) && !/\bvi\.unstubAllEnvs\b/.test(text)) reasons.push("env-stub-leak");
  if (/\bimport\s*\(\s*["'`]\.\.?\//.test(text) === false && false) reasons.push("never");
  // 부수효과 문을 beforeAll 로 옮기면, 뒤따르는 선언이 수집 때 곧바로 부르는 호출은 그 준비물을 못 본다.
  const firstEffect = stmts.findIndex((x) => x.role === "effect");
  if (firstEffect >= 0) {
    for (let i = firstEffect + 1; i < stmts.length; i += 1) {
      const n = stmts[i].node;
      if (ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.initializer && hasEagerCall(d.initializer))) {
        reasons.push("effect-before-eager-decl");
        break;
      }
      if (ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && callKind(n.expression) === "describe" && describeBodyEager(n.expression)) {
        reasons.push("effect-before-eager-describe");
        break;
      }
    }
  }
  const counts = countCalls(text, path);
  return { path, env, imports, mocks, stmts, sf, text, reasons, counts, hasEffect: firstEffect >= 0 };
}

/** describe 콜백 몸통의 직접 선언이 수집 때 곧바로 부르는 호출을 가졌는가(중첩 describe 포함) */
function describeBodyEager(call) {
  const cb = call.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
  if (!cb || !ts.isBlock(cb.body)) return false;
  for (const s of cb.body.statements) {
    if (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.initializer && hasEagerCall(d.initializer))) return true;
    if (ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && callKind(s.expression) === "describe" && describeBodyEager(s.expression)) return true;
  }
  return false;
}

/** 수집 때 불리는 가장 구체적인 `@/` 모듈 — 가족을 나누는 열쇠. hubs 는 제외한다. */
export const HUB_MODULES = new Set([
  "@/project/defaults",
  "@/project/defaults/defaultProject",
  "@/project/store",
  "@/project/types",
  "@/project/types/database",
  "@/project/session",
  "./fakeDom",
  "vitest",
]);

export function primaryModule(imports) {
  let best = null;
  for (const imp of imports) {
    const mod = normMod(imp.mod);
    if (!mod.startsWith("@/") || HUB_MODULES.has(mod)) continue;
    if (imp.specs.length && imp.specs.every((s) => s.typeOnly)) continue;
    const depth = mod.split("/").length;
    if (!best || depth > best.depth || (depth === best.depth && mod.length > best.mod.length)) best = { mod, depth };
  }
  return best?.mod ?? null;
}

function indentWithLiterals(text, startOffset, ranges, prefix) {
  // ranges: 원본 절대 오프셋 [a,b) — 문자열·템플릿 리터럴 안쪽 줄은 들여쓰지 않는다(값이 바뀌므로).
  const lines = text.split("\n");
  let off = startOffset;
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const lineStart = off;
    off += lines[i].length + 1;
    const inLiteral = i > 0 && ranges.some(([a, b]) => lineStart > a && lineStart < b);
    out.push(lines[i].length === 0 || inLiteral ? lines[i] : prefix + lines[i]);
  }
  return out.join("\n");
}

function literalRanges(sf) {
  const r = [];
  const visit = (n) => {
    if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || ts.isStringLiteral(n) || ts.isRegularExpressionLiteral(n)) {
      r.push([n.getStart(), n.getEnd()]);
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return r;
}

/** 한 파일의 import 뒤 몸통을 describe 한 덩어리로 만든다. 부수효과 문은 beforeAll 로 옮긴다. */
function wrapBody(info) {
  const { sf, text, stmts, path } = info;
  const rest = stmts.filter((x) => x.role === "keep" || x.role === "effect");
  const ranges = literalRanges(sf);
  const pieces = [];
  let effectPlaced = false;
  const effects = rest.filter((x) => x.role === "effect");
  const sliceOf = (node, extraStrip) => {
    const start = node.getFullStart();
    let s = text.slice(start, node.getEnd());
    // export 수식어 제거
    const m = node.modifiers?.find((mm) => mm.kind === ts.SyntaxKind.ExportKeyword);
    let rel = null;
    if (m) {
      rel = [m.getStart() - start, m.getEnd() + 1 - start];
      s = s.slice(0, rel[0]) + s.slice(rel[1]);
    }
    return { start, s, rel, extraStrip };
  };
  const stripRanges = (start, rel) => ranges.filter(([a, b]) => a >= start && b <= start + 100000000).map(([a, b]) => {
    if (!rel) return [a - start, b - start];
    const adj = (o) => (o >= rel[1] ? o - (rel[1] - rel[0]) : o > rel[0] ? rel[0] : o);
    return [adj(a - start), adj(b - start)];
  });
  const format = (node, extra) => {
    const { start, s, rel } = sliceOf(node);
    const rg = stripRanges(start, rel);
    return indentWithLiterals(s, 0, rg, "  " + extra).replace(/^\n+/, "\n");
  };
  for (const item of rest) {
    if (item.role === "keep") {
      pieces.push(format(item.node, ""));
    } else if (!effectPlaced) {
      effectPlaced = true;
      const inner = effects.map((e) => format(e.node, "  ").replace(/^\n+/, "\n")).join("");
      pieces.push(`\n  beforeAll(() => {${inner}\n  });`);
    }
  }
  const name = path.replace(/^.*\//, "").replace(/\.test\.ts$/, "");
  return { name, body: pieces.join("").replace(/^\n+/, "").replace(/\s+$/, "") };
}

/**
 * 같은 폴더·같은 환경 파일들을 한 파일 텍스트로 합친다.
 * files: [{path, text}] — 순서가 곧 describe 순서. 합칠 수 없는 파일은 excluded 로 돌려준다.
 */
export function mergeGroup(files, { header = "", resolver = null, teardownImport = null } = {}) {
  const idOf = (mod, sp) => (resolver ? resolver(normMod(mod), sp.imported, sp.kind) : null) ?? `${normMod(mod)}\0${sp.imported}`;
  const infos = files.map((f) => analyzeFile(f.path, f.text));
  const excluded = [];
  const ok = [];
  for (const info of infos) {
    if (info.reasons.length) excluded.push({ path: info.path, reason: info.reasons.join(",") });
    else ok.push(info);
  }
  // 환경·모킹이 첫 파일과 같은 것만
  const base = ok[0];
  const same = [];
  for (const info of ok) {
    if (info.env !== base.env) excluded.push({ path: info.path, reason: `env ${info.env}` });
    else if (info.mocks.join("\n") !== base.mocks.join("\n")) excluded.push({ path: info.path, reason: "different-mocks" });
    else same.push(info);
  }
  // import 병합 — 같은 지역 이름이 다른 출처에 묶이면 그 파일은 뺀다.
  const bound = new Map(); // local -> `${mod}\0${imported}`
  const named = new Map(); // mod -> Map(local -> spec)
  const others = []; // default / ns lines
  const sideEffects = new Set();
  const emitted = new Map(); // local -> 내보낸 spec (같은 바인딩이 다른 경로로 또 오면 건너뛴다)
  const order = [];
  const kept = [];
  for (const info of same) {
    const trial = new Map();
    let conflict = null;
    for (const imp of info.imports) {
      if (imp.side) continue;
      for (const sp of imp.specs) {
        const key = `${idOf(imp.mod, sp)}\0${sp.kind}`;
        const prev = bound.get(sp.local) ?? trial.get(sp.local);
        if (prev && prev !== key) conflict = sp.local;
        trial.set(sp.local, key);
      }
    }
    if (conflict) {
      excluded.push({ path: info.path, reason: `import-conflict:${conflict}` });
      continue;
    }
    for (const [k, v] of trial) bound.set(k, v);
    for (const imp of info.imports) {
      const mod = imp.mod;
      if (imp.side) {
        sideEffects.add(mod);
        continue;
      }
      for (const sp of imp.specs) {
        // 이미 합친 파일을 다시 합칠 때: 그 파일의 isolateTimers import 는 아래 머리 줄 하나로 대신한다(두 번 선언하면 구문 오류).
        if (teardownImport && sp.local === "isolateTimers" && /(^|\/)mergedTeardown(\.ts)?$/.test(mod)) continue;
        const had = emitted.get(sp.local);
        if (had) {
          if (had.typeOnly && !sp.typeOnly) had.typeOnly = false; // 값 import 가 하나라도 있으면 값으로 둔다.
          continue;
        }
        emitted.set(sp.local, sp);
        if (sp.kind === "named") {
          const nm = normMod(mod);
          if (!named.has(nm)) {
            named.set(nm, { mod, specs: new Map() });
            order.push(["named", nm]);
          }
          const entry = named.get(nm);
          const prev = entry.specs.get(sp.local);
          // 값 import 가 하나라도 있으면 값으로 둔다.
          if (!prev || (prev.typeOnly && !sp.typeOnly)) entry.specs.set(sp.local, sp);
        } else {
          const id = `${sp.kind}\0${normMod(mod)}\0${sp.local}`;
          if (!others.some((o) => o.id === id)) {
            others.push({ id, mod, sp });
            order.push(["other", id]);
          }
        }
      }
    }
    kept.push(info);
  }
  if (!kept.length) return { text: null, merged: [], excluded, counts: null };
  const lines = [];
  if (base.env !== "node") lines.push(`// @vitest-environment ${base.env}`, "");
  const vitestSpecs = named.get("vitest");
  if (vitestSpecs) vitestSpecs.specs.set("describe", vitestSpecs.specs.get("describe") ?? { kind: "named", local: "describe", imported: "describe", typeOnly: false, alias: "describe" });
  else {
    named.set("vitest", { mod: "vitest", specs: new Map([["describe", { kind: "named", local: "describe", imported: "describe", typeOnly: false, alias: "describe" }]]) });
    order.unshift(["named", "vitest"]);
  }
  const usesBeforeAll = kept.some((k) => k.hasEffect);
  if (usesBeforeAll) {
    named.get("vitest").specs.set("beforeAll", named.get("vitest").specs.get("beforeAll") ?? { kind: "named", local: "beforeAll", imported: "beforeAll", typeOnly: false, alias: "beforeAll" });
  }
  // vitest 를 맨 앞으로
  const vi = order.findIndex(([k, id]) => k === "named" && id === "vitest");
  if (vi > 0) order.unshift(...order.splice(vi, 1));
  for (const [kind, id] of order) {
    if (kind === "named") {
      const entry = named.get(id);
      const specs = [...entry.specs.values()];
      const allType = specs.every((s) => s.typeOnly);
      const parts = specs.map((s) => (s.typeOnly && !allType ? `type ${s.alias}` : s.alias));
      lines.push(`import ${allType ? "type " : ""}{ ${parts.join(", ")} } from "${entry.mod}";`);
    } else {
      const o = others.find((x) => x.id === id);
      const ty = o.sp.typeOnly ? "type " : "";
      lines.push(o.sp.kind === "default" ? `import ${ty}${o.sp.local} from "${o.mod}";` : `import ${ty}* as ${o.sp.local} from "${o.mod}";`);
    }
  }
  for (const mod of sideEffects) lines.push(`import "${mod}";`);
  // 파일이 따로일 때와 같은 «끝나면 사라짐» 을 describe 마다 주는 도우미(test/mergedTeardown.ts).
  if (teardownImport) lines.push(`import { isolateTimers } from "${teardownImport}";`);
  if (base.mocks.length) lines.push("", ...base.mocks);
  const blocks = [];
  for (const info of kept) {
    const { name, body } = wrapBody(info);
    const first = info.sf.statements[0];
    const lead = first ? info.text.slice(0, first.getStart()).split("\n").filter((l) => !/@vitest-environment/.test(l)).join("\n").trim() : "";
    const note = lead && /^\/\/|^\/\*/.test(lead) ? `${lead}\n` : "";
    blocks.push(`${note}describe(${JSON.stringify(name)}, () => {\n${teardownImport ? "  isolateTimers();\n" : ""}${body}\n});`);
  }
  const textOut = `${header}${lines.join("\n")}\n\n${blocks.join("\n\n")}\n`;
  const before = { it: 0, describe: 0, expect: 0 };
  for (const k of kept) for (const key of Object.keys(before)) before[key] += k.counts[key];
  const after = countCalls(textOut, "merged.test.ts");
  return { text: textOut, merged: kept.map((k) => k.path), excluded, before, after, wrappers: kept.length };
}

/** 수 비교 — it·expect 는 같아야 하고, describe 는 감싼 개수만큼만 늘어야 한다. */
export function countMismatch(res) {
  if (!res.before) return null;
  const problems = [];
  if (res.before.it !== res.after.it) problems.push(`it ${res.before.it} -> ${res.after.it}`);
  if (res.before.expect !== res.after.expect) problems.push(`expect ${res.before.expect} -> ${res.after.expect}`);
  if (res.before.describe + res.wrappers !== res.after.describe) problems.push(`describe ${res.before.describe}+${res.wrappers} -> ${res.after.describe}`);
  return problems.length ? problems.join("; ") : null;
}

/**
 * `@/` 모듈의 이름이 어디서 선언됐는지 재수출을 따라가 찾는다 — `@/project/defaults` 와 `@/project/defaults/blankProject` 의
 * createBlankProject 가 같은 바인딩임을 알아보려는 것이다. 못 찾으면 null.
 */
export function makeResolver(root) {
  const cache = new Map();
  const parsed = new Map();
  const exts = [".ts", ".tsx", ".mts", "/index.ts", "/index.tsx"];
  const fileFor = (base) => {
    if (existsSync(base) && statSync(base).isFile()) return base;
    for (const e of exts) if (existsSync(base + e)) return base + e;
    return null;
  };
  const load = (file) => {
    if (!parsed.has(file)) parsed.set(file, parse(file, readFileSync(file, "utf8")));
    return parsed.get(file);
  };
  const specFile = (spec, fromFile) => {
    if (spec.startsWith("@/")) return fileFor(join(root, "src", spec.slice(2)));
    if (spec.startsWith(".")) return fileFor(join(dirname(fromFile), spec));
    return null;
  };
  const resolveExport = (file, name, seen) => {
    const key = `${file}#${name}`;
    if (cache.has(key)) return cache.get(key);
    if (seen.has(key)) return null;
    seen.add(key);
    const sf = load(file);
    let found = null;
    const stars = [];
    const localImports = new Map();
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) && st.importClause) {
        const c = st.importClause;
        if (c.name) localImports.set(c.name.text, { spec: st.moduleSpecifier.text, imported: "default" });
        if (c.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) localImports.set(e.name.text, { spec: st.moduleSpecifier.text, imported: (e.propertyName || e.name).text });
      }
    }
    for (const st of sf.statements) {
      if (found) break;
      if (ts.isExportDeclaration(st)) {
        if (st.exportClause && ts.isNamedExports(st.exportClause)) {
          for (const e of st.exportClause.elements) {
            if (e.name.text !== name) continue;
            const orig = (e.propertyName || e.name).text;
            if (st.moduleSpecifier) {
              const f = specFile(st.moduleSpecifier.text, file);
              found = f ? resolveExport(f, orig, seen) : null;
            } else if (localImports.has(orig)) {
              const li = localImports.get(orig);
              const f = specFile(li.spec, file);
              found = f ? resolveExport(f, li.imported, seen) : null;
            } else found = `${file}#${orig}`;
          }
        } else if (!st.exportClause && st.moduleSpecifier) stars.push(st.moduleSpecifier.text);
        continue;
      }
      const exported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      const isDefault = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (isDefault && name === "default") found = `${file}#default`;
      else if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) found = `${file}#${name}`;
      } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isEnumDeclaration(st)) && st.name?.text === name) found = `${file}#${name}`;
    }
    if (!found && name !== "default") {
      for (const spec of stars) {
        const f = specFile(spec, file);
        const r = f ? resolveExport(f, name, seen) : null;
        if (r) {
          found = r;
          break;
        }
      }
    }
    cache.set(key, found);
    return found;
  };
  return (mod, imported, kind) => {
    if (kind === "ns" || !mod.startsWith("@/")) return null;
    const f = specFile(mod, "");
    return f ? resolveExport(f, imported, new Set()) : null;
  };
}

export { parse, normMod };
