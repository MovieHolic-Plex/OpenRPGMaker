#!/usr/bin/env node
// CSS 예산 래칫 — 네 개 품질 지표의 증가를 막는다. 파일 수는 판정에 쓰지 않는 참고 지표다.
//
// 왜 필요한가 (실측):
//  1. TOKENS.md §4.1 "하드코딩 hex/rgba 색 금지" 에는 테스트가 없었다. 문서가 생긴
//     7e5f7ba6(2026-07-06) 593건 → 2026-08-28 1,940건, **3.27배**로 불었다.
//     `git grep -ohE '#[0-9a-fA-F]{3,8}\b' <ref> -- 'src/styles/*.css' | wc -l` 로 재현된다.
//     규칙 문서만 있고 기계 가드가 없으면 규칙이 아니라 희망사항이다.
//  2. 그래서 §4.1 을 포함한 네 품질 지표를 여기서 기계로 고정한다. 이 게이트의 헤드라인은
//     hexLiterals 다 — 3.27배로 되돌아간 바로 그 규칙이기 때문이다.
//
// 이 파일의 초판(a742f105)은 위 1번에 §4.7("font-family 리터럴 금지"는 테스트가 있어
// 위반 0건)을 대조군으로 붙여 "차이는 가드의 유무"라고 단언했다. **그 인과는 틀렸다.**
// `test/fontFamilyTokenGuard.test.ts` 는 2026-08-27 에 추가됐다 — §4.1 이 8주에 걸쳐
// 3.27배가 된 **뒤**다. 그 가드는 드리프트를 막은 게 아니라 이미 깨끗한 상태를 고정했을
// 뿐이라, 통제된 대조 실험이 아니라 서로 다른 두 시점의 관찰이다.
// 남는 근거는 1번 하나이고, 그것만으로 래칫은 정당하다: 가드 없는 규칙이 실제로
// 3.27배 무너진 것은 측정된 사실이다. "가드가 있었으면 막았다"는 합리적 추론이지
// 이 저장소가 증명한 명제가 아니다 — 그 선을 넘지 말 것.
//
// 왜 "0" 이 아니라 "래칫" 인가:
//  이 저장소의 기준선은 이미 빨간불이다(hex 1,915건 · !important 1,033건).
//  도착하자마자 빨간 게이트는 다음 사람이 CI 에서 지운다 — verify-gates.mjs 와 같은 판단으로,
//  "기준선 대비 새로 생긴 위반만 회귀로 취급" 한다. 줄이면 GOOD 을 찍어 기준선 재저장을 유도한다.
//
// 사용:
//   node scripts/check-css-budget.mjs                     # 기준선 대비 비교 (기본)
//   node scripts/check-css-budget.mjs --save-baseline     # 현재 상태를 기준선으로 저장
//   node scripts/check-css-budget.mjs --baseline <path>   # 기준선 경로 지정
//   node scripts/check-css-budget.mjs --json              # 기계 판독용 출력
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const DEFAULT_BASELINE = resolve(ROOT, ".omo/css-budget-baseline.json");

// 측정 대상. src/styles 트리 전체 + 플레이어 런타임 시트 한 장.
// player.css 는 styles/ 밖에 홀로 있어서 스윕에서 계속 누락됐다 — 명시적으로 끌어온다.
const CSS_ROOTS = ["src/styles"];
const EXTRA_CSS_FILES = ["src/player/player.css"];
const TS_ROOT = "src";

const METRICS = [
  ["hexLiterals", "하드코딩 hex 리터럴 (TOKENS.md §4.1)"],
  ["important", "!important 선언"],
  ["undefinedVars", "정의 없는 커스텀 프로퍼티"],
  ["globalRootFiles", "전역 :root 블록을 가진 파일"],
  ["cssFileCount", "CSS 파일 수 (참고·판정 제외)"],
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const asJson = flag("--json");
const saveBaseline = flag("--save-baseline");
const baselinePath = resolve(value("--baseline", DEFAULT_BASELINE));

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

const rel = (file) => relative(ROOT, file).split("\\").join("/");

// CSS 주석은 규칙이 아니다. 이걸 안 걷어내면 "!important 를 왜 썼는지" 설명하는 주석
// 13개 파일 18건이 위반으로 잡힌다(naive 1,051 vs 실제 1,033). 설명을 쓸수록 점수가
// 나빠지는 게이트는 주석을 지우게 만든다.
//
// 정규식(`/\*[\s\S]*?\*\//g`) 대신 문자 스캐너인 이유 (실측 공격):
//   .a::before { content: "/*"; }
//   .sneaky { color: #ff00ff !important; border-color: #00ff00 !important; }
//   .b::after { content: "*/"; }
// 이 다섯 줄을 tokens.css 에 덧붙이면 정규식 판은 두 문자열 사이를 통째로 주석으로 오인해
// hex 2건 + !important 2건을 통계에서 지워버린다 — 게이트가 exit 0 으로 통과했다.
// 문자열 안의 `/*` 는 주석이 아니다. 반대로 주석 안의 따옴표는 문자열이 아니므로
// 주석 판정을 먼저 한다.
//
// 문자열 **내용**은 빈칸으로 지운다. `content: "#fff"` 는 색 선언이 아니라서 세면 오탐이고,
// 위 공격처럼 문자열이 파서를 흔드는 것도 막는다. (실측: 현재 코퍼스는 문자열 보존/삭제
// 어느 쪽이든 hex 1,915 · !important 1,033 로 동일 — 지금 값은 안 바뀌고 구멍만 막힌다.)
function stripComments(css) {
  let out = "";
  let index = 0;
  while (index < css.length) {
    const ch = css[index];
    if (ch === "/" && css[index + 1] === "*") {
      const end = css.indexOf("*/", index + 2);
      index = end === -1 ? css.length : end + 2;
      out += " "; // 토큰이 붙어버리지 않게 공백 한 칸으로 치환
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      index += 1;
      while (index < css.length && css[index] !== quote) {
        if (css[index] === "\\") index += 1;
        index += 1;
      }
      index += 1;
      out += `${quote}${quote}`; // 따옴표 쌍은 남긴다 — :root 스캐너가 문자열 경계를 본다
      continue;
    }
    out += ch;
    index += 1;
  }
  return out;
}

/** 균형 잡힌 괄호 안을 지운다 — `:root:has(.a .b)` 의 공백을 조합자로 오인하지 않기 위해. */
function stripParens(selector) {
  let out = "";
  let depth = 0;
  for (const ch of selector) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0) out += ch;
  }
  return out;
}

/**
 * 선택자 목록이 **전역 :root 자체**를 겨냥하는지 본다.
 * `:root` · `:root.dark` · `:root[data-theme]` 는 전역 선언이라 센다.
 * `:root .panel` 이나 `.studio :root` 는 :root 에 값을 심는 게 아니므로 세지 않는다.
 */
function selectorTargetsGlobalRoot(selectorList) {
  return selectorList.split(",").some((part) => {
    const compound = stripParens(part).trim();
    if (!compound.startsWith(":root")) return false;
    const tail = compound.slice(":root".length);
    if (/^[\w-]/u.test(tail)) return false; // `:rooted` 같은 우연한 접두 일치 방지
    return !/[\s>+~]/u.test(tail); // 조합자가 붙으면 대상이 :root 가 아니다
  });
}

/**
 * 중괄호 깊이를 직접 추적한다. 정규식 한 방으로는 `@media` 안의 전역 :root(정상)와
 * 다른 규칙 안에 중첩된 :root(전역 아님)를 구분할 수 없다.
 * `@media`/`@supports`/`@layer` 블록은 투명하게 취급한다 — 그 안의 :root 도 여전히 전역이다.
 */
function hasGlobalRootRule(css) {
  const stack = [];
  let prelude = "";
  for (let index = 0; index < css.length; index += 1) {
    const ch = css[index];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      index += 1;
      while (index < css.length && css[index] !== quote) {
        if (css[index] === "\\") index += 1;
        index += 1;
      }
      continue; // 문자열 리터럴은 선택자가 아니다
    }
    if (ch === "{") {
      const prelude_ = prelude.trim();
      const isAtRule = prelude_.startsWith("@");
      if (!isAtRule && !stack.includes("style") && selectorTargetsGlobalRoot(prelude_)) return true;
      stack.push(isAtRule ? "at" : "style");
      prelude = "";
      continue;
    }
    if (ch === "}") {
      stack.pop();
      prelude = "";
      continue;
    }
    if (ch === ";") {
      prelude = "";
      continue;
    }
    prelude += ch;
  }
  return false;
}

// 3·4·6·8 자리만 hex 색이다. 자릿수를 열어두면 `#12345` 같은 비색상 토큰까지 삼킨다.
// (실측: 3~8 자리 무제한 매칭과 결과가 동일했지만, 규칙을 느슨하게 두면 다음 사람이 못 믿는다.)
const HEX_LITERAL = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/gu;
const IMPORTANT = /!\s*important\b/giu;
const VAR_REFERENCE = /var\(\s*(--[A-Za-z0-9_-]+)/gu;
// 선언은 `--x:` 앞이 단어 문자가 아닐 때만이다. 이 lookbehind 가 없으면 BEM 수식어 선택자가
// 선언으로 둔갑한다 — `.empty-state__action--primary:hover` 가 `--primary` 를,
// `.empty-state__action--ghost:hover` 가 `--ghost` 를 "정의됨" 으로 등록한다(실측 2건).
// 그러면 그 이름을 쓰는 var() 는 영원히 미정의로 안 잡힌다: `.card--zzz:hover{}` 한 줄이면
// `var(--zzz)` 가 게이트를 통과했다. (실측: 이 수정으로 CSS 선언 집합 513 → 511,
// undefinedVars 는 74 그대로 — `--primary`/`--ghost` 를 var() 로 쓰는 곳이 아직 없다.)
const VAR_DECLARATION = /(?<![\w-])(--[A-Za-z0-9_-]+)\s*:/gu;

// JS 가 런타임에 심는 커스텀 프로퍼티. 이걸 빼먹으면 게이트가 "정의 없음" 으로 오진한다.
// 이 저장소는 최소 네 가지 관용구를 쓴다:
//   setProperty("--x", v) / setStyleVar(el, "--x", v) / `--x:${v}` 인라인 style 문자열 /
//   { "--x": v } 스타일 객체
const TS_SETTER_PATTERNS = [
  /setProperty\(\s*[`"']\s*(--[A-Za-z0-9_-]+)/gu,
  /setStyleVar\([^,)]*,\s*[`"']\s*(--[A-Za-z0-9_-]+)/gu,
  /[`"'](--[A-Za-z0-9_-]+)\s*:/gu,
  /[`"'](--[A-Za-z0-9_-]+)[`"']\s*:/gu,
];
// 위 네 패턴으로도 못 잡는 간접 호출(상수 맵, 여러 줄 인자, 헬퍼 경유, 옵셔널 호출)이 남는다.
// 실측 3단: setProperty 패턴 하나만 = 미정의 118건 / 위 네 패턴 전부 = 76건 /
// TS 소스에 이름이 등장하기만 해도 인정 = 74건.
// 마지막 2건은 정규식으로는 못 보는 관용구였다:
//   --editor-left-safe   → `setProperty?.("--editor-left-safe", px)` (옵셔널 호출, panels/editor.ts)
//   --custom-min-cell    → `` style: `--custom-cols:${c};--custom-min-cell:${n}px` `` (인라인 문자열 2번째 항목)
// 남는 74건은 진짜 고아(--oprn-*, --studio-*, --ink …)다. 오탐 하나가 게이트 전체의 신뢰를
// 깎으므로 느슨한 쪽(= FAIL 을 덜 내는 쪽)으로 판정한다.
const TS_ANY_MENTION = /(--[A-Za-z0-9_-]+)/gu;

function collect() {
  const cssFiles = [
    ...CSS_ROOTS.flatMap((dir) => walk(join(ROOT, dir), (file) => file.endsWith(".css"))),
    ...EXTRA_CSS_FILES.map((file) => join(ROOT, file)).filter((file) => existsSync(file)),
  ];

  // 이전 보고서와 같은 src/styles 범위로 파일 수를 집계한다.
  // 파일 분리·통합 자체는 품질 개선이나 회귀가 아니므로 판정에는 사용하지 않는다.
  const budgetedFileList = cssFiles
    .map(rel)
    .filter((path) => CSS_ROOTS.some((dir) => path.startsWith(`${dir}/`)))
    .sort();

  const hexByFile = {};
  const importantByFile = {};
  const globalRootFileList = [];
  const declared = new Set();
  const referencedBy = new Map();

  for (const file of cssFiles) {
    const path = rel(file);
    const css = stripComments(readFileSync(file, "utf8"));

    const hex = (css.match(HEX_LITERAL) ?? []).length;
    if (hex > 0) hexByFile[path] = hex;

    const important = (css.match(IMPORTANT) ?? []).length;
    if (important > 0) importantByFile[path] = important;

    if (hasGlobalRootRule(css)) globalRootFileList.push(path);

    for (const match of css.matchAll(VAR_DECLARATION)) declared.add(match[1]);
    for (const match of css.matchAll(VAR_REFERENCE)) {
      const list = referencedBy.get(match[1]) ?? [];
      if (list.length < 3) list.push(path);
      referencedBy.set(match[1], list);
    }
  }

  const jsDeclared = new Set();
  for (const file of walk(join(ROOT, TS_ROOT), (f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    const source = readFileSync(file, "utf8");
    for (const pattern of TS_SETTER_PATTERNS) {
      for (const match of source.matchAll(pattern)) jsDeclared.add(match[1]);
    }
    for (const match of source.matchAll(TS_ANY_MENTION)) jsDeclared.add(match[1]);
  }

  const undefinedVarList = [...referencedBy.keys()]
    .filter((name) => !declared.has(name) && !jsDeclared.has(name))
    .sort();

  const sum = (record) => Object.values(record).reduce((total, n) => total + n, 0);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    metrics: {
      hexLiterals: sum(hexByFile),
      important: sum(importantByFile),
      undefinedVars: undefinedVarList.length,
      globalRootFiles: globalRootFileList.length,
      cssFileCount: budgetedFileList.length,
    },
    details: {
      hexByFile,
      importantByFile,
      globalRootFileList: globalRootFileList.sort(),
      undefinedVarList,
      undefinedVarUsage: Object.fromEntries(undefinedVarList.map((name) => [name, referencedBy.get(name)])),
      cssFileList: budgetedFileList,
    },
  };
}

/** 지표가 올랐을 때 "어디가 늘었는지"를 뽑는다. 숫자만 던지는 게이트는 아무도 못 고친다. */
function offenders(metric, report, baseline) {
  const grew = (current = {}, before = {}) =>
    Object.entries(current)
      .filter(([file, count]) => count > (before[file] ?? 0))
      .sort((a, b) => b[1] - a[1])
      .map(([file, count]) => `${file}: ${before[file] ?? 0} → ${count}`);
  const added = (current = [], before = []) => {
    const known = new Set(before);
    return current.filter((entry) => !known.has(entry));
  };

  if (metric === "hexLiterals") return grew(report.details.hexByFile, baseline.details?.hexByFile);
  if (metric === "important") return grew(report.details.importantByFile, baseline.details?.importantByFile);
  if (metric === "globalRootFiles")
    return added(report.details.globalRootFileList, baseline.details?.globalRootFileList);
  if (metric === "undefinedVars") {
    return added(report.details.undefinedVarList, baseline.details?.undefinedVarList).map(
      (name) => `${name} (사용: ${(report.details.undefinedVarUsage[name] ?? []).join(", ") || "?"})`
    );
  }
  return [];
}

const report = collect();

if (saveBaseline) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  if (!asJson) {
    console.log(`기준선 저장: ${rel(baselinePath)}`);
    for (const [key, label] of METRICS) console.log(`   ${key.padEnd(16)} ${String(report.metrics[key]).padStart(6)}  ${label}`);
  } else {
    console.log(JSON.stringify({ ...report, baseline: baselinePath, saved: true }, null, 2));
  }
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;

// 기준선이 없는 건 회귀가 아니라 **설치 전 상태**다. 여기서 실패시키면 게이트를 처음 켜는
// 사람이 빨간불부터 보게 되고, 그러면 켜지 않는다.
if (!baseline) {
  const payload = { ...report, baseline: null, regressions: [], improvements: [] };
  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`CSS 예산 게이트 — 기준선 없음 (${rel(baselinePath)})`);
    for (const [key, label] of METRICS) console.log(`   ${key.padEnd(16)} ${String(report.metrics[key]).padStart(6)}  ${label}`);
    console.log(`\n먼저 기록하세요: node scripts/check-css-budget.mjs --save-baseline`);
  }
  process.exit(0);
}

const regressions = [];
const improvements = [];
for (const [key] of METRICS) {
  if (key === "cssFileCount") continue;
  const before = baseline.metrics?.[key] ?? 0;
  const after = report.metrics[key];
  if (after > before) regressions.push({ metric: key, before, after, delta: after - before, offenders: offenders(key, report, baseline) });
  else if (after < before) improvements.push({ metric: key, before, after, delta: after - before });
}

const payload = { ...report, baseline: baselinePath, regressions, improvements };

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(regressions.length === 0 ? 0 : 1);
}

console.log(`CSS 예산 래칫 — 기준선 ${rel(baselinePath)}`);
console.log(`   ${"지표".padEnd(16)} ${"기준선".padStart(8)} ${"현재".padStart(8)} ${"증감".padStart(7)}  설명`);
for (const [key, label] of METRICS) {
  const before = baseline.metrics?.[key] ?? 0;
  const after = report.metrics[key];
  const delta = after - before;
  const mark = delta > 0 ? "+" : delta < 0 ? "" : " ";
  console.log(`   ${key.padEnd(16)} ${String(before).padStart(8)} ${String(after).padStart(8)} ${`${mark}${delta}`.padStart(7)}  ${label}`);
}
console.log("");

for (const item of improvements) {
  console.log(`GOOD: ${item.metric} ${item.before} → ${item.after} (${item.delta}). 래칫을 조이세요 — node scripts/check-css-budget.mjs --save-baseline`);
}

for (const item of regressions) {
  console.error(`FAIL: ${item.metric} ${item.before} → ${item.after} (+${item.delta})`);
  for (const line of item.offenders.slice(0, 10)) console.error(`         ${line}`);
  const hidden = item.offenders.length - 10;
  if (hidden > 0) console.error(`         ... 외 ${hidden}건`);
}

if (regressions.length > 0) {
  console.error(`\n${regressions.length}개 지표가 기준선을 넘었다. 새로 들어온 위반을 되돌리세요.`);
  console.error(`토큰을 쓰는 법: src/styles/TOKENS.md §4. 의도적 상향이면 --save-baseline 을 리뷰에 포함하세요.`);
  process.exit(1);
}

console.log(`CSS 예산 게이트 통과: ${report.metrics.cssFileCount}개 파일 검사, 회귀 0건, 개선 ${improvements.length}건.`);
process.exit(0);
