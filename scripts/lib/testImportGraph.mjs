// scripts/lib/testImportGraph.mjs — 저장소의 런타임 import 그래프(정적 문자열 한정자만)와 그 위의 거리 계산.
//
// 누가 쓰나: scripts/vitest-related.mjs(PR 관련 시험 고르기 — 바뀐 파일에서 거꾸로 몇 걸음에 닿는 시험인가),
//   scripts/ci-full-blame.mjs(ci-full 새 실패 파일 → 그 시험이 기대는 파일을 건드린 최근 머지 PR).
//
// 무엇을 간선으로 보나: `import … from "x"` · `export … from "x"` · `import "x"` · `import("x")` · `require("x")` · `vi.mock("x")` 등 문자열 리터럴 한정자.
//   상대 경로·`@/`(→ src/)만 푼다(패키지 한정자는 간선이 아니다). `import type …`·`export type …`·`import { type A, type B } …` 처럼 타입만 가져오는 문장은
//   실행 시 사라지므로 간선이 아니다 — 타입만 바뀐 파일은 타입체크(ci-fast)가 본다.
//   비리터럴 동적 import(`import(\`./a/${x}\`)`)는 못 본다(알려진 구멍 — ci-full 이 본다).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";

const SOURCE = /\.(?:[cm]?[jt]sx?)$/u;
const RESOLVE_EXTENSIONS = [".ts", ".mts", ".tsx", ".js", ".mjs", ".json"];
const ROOTS = ["src", "test", "scripts", "electron", "shared", "harness", "evals"];

/** 런타임 한정자만 뽑는다(타입 전용 import/export 제외). */
export function runtimeSpecifiers(source) {
  const found = new Set();
  const statement = /\b(import|export)\s+(type\s+)?([^'"`;]*?)\s*from\s*(["'])([^"'\n]+)\4/gu;
  for (const match of source.matchAll(statement)) {
    if (match[2]) continue;
    const brace = match[3].trim().match(/^\{([^}]*)\}$/u);
    if (brace) {
      const names = brace[1].split(",").map((name) => name.trim()).filter(Boolean);
      if (names.length > 0 && names.every((name) => name.startsWith("type "))) continue;
    }
    found.add(match[5]);
  }
  for (const match of source.matchAll(/(?:^|[;\s])import\s*(["'])([^"'\n]+)\1/gu)) found.add(match[2]);
  const call = /\b(?:import|require|vi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock))\s*\(\s*(["'`])([^"'`\n$]+)\1/gu;
  for (const match of source.matchAll(call)) found.add(match[2]);
  return [...found];
}

/** 한정자를 저장소 상대 경로로 푼다. 못 풀면 null. */
export function resolveSpecifier(fromFile, specifier, fileSet) {
  let base;
  if (specifier.startsWith("@/")) base = posix.join("src", specifier.slice(2));
  else if (/^\.\.?(?:\/|$)/u.test(specifier)) base = posix.join(posix.dirname(fromFile), specifier);
  else return null;
  base = base.replace(/[?#].*$/u, "");
  if (fileSet.has(base)) return base;
  const stripped = base.replace(/\.[cm]?jsx?$/u, "");
  for (const stem of stripped === base ? [base] : [stripped, base]) {
    for (const extension of RESOLVE_EXTENSIONS) if (fileSet.has(`${stem}${extension}`)) return `${stem}${extension}`;
  }
  for (const extension of RESOLVE_EXTENSIONS) if (fileSet.has(`${base}/index${extension}`)) return `${base}/index${extension}`;
  return null;
}

/**
 * @param {ReadonlyMap<string, string>} sources 경로 → 소스(코드 파일만)
 * @param {Iterable<string>} allFiles 추적 중인 모든 파일(데이터 파일 import 를 풀기 위해)
 * @returns {{ forward: Map<string, Set<string>>, reverse: Map<string, Set<string>> }}
 */
export function buildGraph(sources, allFiles) {
  const fileSet = new Set(allFiles);
  for (const path of sources.keys()) fileSet.add(path);
  const forward = new Map();
  const reverse = new Map();
  for (const [file, source] of sources) {
    const targets = new Set();
    for (const specifier of runtimeSpecifiers(source)) {
      const target = resolveSpecifier(file, specifier, fileSet);
      if (target && target !== file) targets.add(target);
    }
    forward.set(file, targets);
    for (const target of targets) {
      if (!reverse.has(target)) reverse.set(target, new Set());
      reverse.get(target).add(file);
    }
  }
  return { forward, reverse };
}

/** 시작 파일들에서 간선을 따라 닿는 파일 → 최소 걸음 수(시작 파일 자신은 0). maxDepth 를 넘으면 멈춘다. */
export function distances(edges, starts, maxDepth = Infinity) {
  const seen = new Map();
  let frontier = [];
  for (const start of starts) if (!seen.has(start)) { seen.set(start, 0); frontier.push(start); }
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next = [];
    for (const node of frontier) {
      for (const neighbour of edges.get(node) ?? []) {
        if (seen.has(neighbour)) continue;
        seen.set(neighbour, depth);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return seen;
}

/** git 체크아웃에서 그래프를 만든다(읽기만). */
export function loadRepoGraph(cwd = process.cwd()) {
  const allFiles = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8", maxBuffer: 1 << 28 }).split("\0").filter(Boolean);
  const sources = new Map();
  for (const path of allFiles) {
    if (!SOURCE.test(path) || !ROOTS.includes(path.split("/")[0])) continue;
    try {
      sources.set(path, readFileSync(posix.join(cwd, path), "utf8"));
    } catch { /* 작업 트리에서 지워진 파일 */ }
  }
  return { ...buildGraph(sources, allFiles), allFiles, sources };
}
