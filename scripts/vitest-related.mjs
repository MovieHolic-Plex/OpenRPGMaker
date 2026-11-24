#!/usr/bin/env node
// scripts/vitest-related.mjs — PR 이 건드린 코드와 «직접» 이어진 vitest 파일만 고른다 (ci-related-tests.yml 이 부른다).
//
// 왜 (2026-11-24): PR 에는 ci-fast(타입체크·빌드·패리티·정적)만 돌고 전체 vitest(약 3,000파일, 시험 시간 합 16.5시간)는 ci-full 만 돈다.
//   그래서 PR 의 «내가 바꾼 코드의 시험» 이 빨간 채로 머지돼 4시간 뒤 ci-full 에서야 잡혔다.
//   `npm run test:changed`(vitest --changed)는 import 그래프를 끝까지 타서 코어 모듈을 스치면 1,247파일·30분을 넘긴다(ci-fast.yml 머리말).
//   최근 PR 20건 실측(test-diet-ci): 이행적 폐포는 평균 2,000파일(허브 src/ai/oauth/credentials.ts 가 시험의 91% 에 닿는다) — 쓸 수 없다.
//   **깊이 1**(바뀐 파일을 직접 import 하는 시험 + 바뀐 시험 자신)은 중앙 12파일·약 4분, p75 16파일·8.5분, 최대 252파일·97분이다.
//   그래서 깊이 1 을 기본으로 하고, 시간 상한을 넘으면 결정적으로 잘라 «nightly 로 미룸» 목록을 찍는다(잘린 파일은 ci-full 이 본다).
//
// 고르는 법 (우선순위 순 — 상한에 걸리면 뒤 단계부터 미룬다):
//   1. 바뀐 시험 파일 자신                    (changed-test)
//   2. 바뀐 코드를 직접 import 하는 시험      (direct-import) — 상대 경로 · `@/`(→ src/) · 확장자(.ts .mts .tsx .js .mjs; `./x.js` → x.ts) · index 파일
//      `import … from` · `export … from` · `import("…")` · `require("…")` · `vi.mock("…")` 등 문자열 리터럴 한정자만 본다.
//      `import(\`./a/${x}\`)` 같은 비리터럴 동적 import 는 못 본다(깊이 1 의 알려진 구멍 — nightly 가 본다).
//   3. 코드가 아닌 바뀐 파일(json·css·png·md … 코드 확장자가 아닌 것)의 경로·파일 이름을 문자열 리터럴로 든 시험 (string-literal)
//      파일 이름이 흔한 것(index.json 등)이나 짧은 것은 «상위폴더/이름» 이 같아야 맞는 것으로 친다.
//   안전망 파일(package.json · lock · vitest 설정 · tsconfig · 러너/게이트 스크립트 · ci-*.yml · 공용 시험 도우미 · 기준선)은
//   PR 에서 전체 스위트로 넓히지 않는다 — «safety-net hit: full suite runs nightly» 만 찍고 위 규칙대로(깊이 1 + 상한) 고른다.
//
// 시간 상한: .omo/test-timings.json(ci-full 샤드 실측 초 — 호스티드 1워커 기준)으로 파일 하나의 비용 = --per-file-seconds + --factor × 기록 초 를 잡고,
//   예상 벽시계 = --startup-seconds + Σ비용 / --workers 가 --budget-seconds 를 넘지 않게 우선순위 순·싼 것부터 담는다.
//   단독으로 상한을 넘는 파일은 담지 않는다. 기록 없는 파일(새 파일)은 --default-seconds 로 본다.
//   기본값(DEFAULTS)은 mdc2-heavy 실측이다 — 러너를 바꾸면 워크플로의 selector_args·상수와 함께 바꾼다.
//
// 쓰는 법:
//   node scripts/vitest-related.mjs --base <ref> [--head <ref>] [--out <목록 파일>] [--summary <마크다운 파일>]
//        [--timings .omo/test-timings.json] [--budget-seconds 380] [--workers 4] [--factor 2] [--per-file-seconds 85] [--startup-seconds 200] [--default-seconds 6.4]
//   변경 파일 = `git diff --name-only --no-renames <base>...<head>` (head 기본 HEAD). 고른 파일은 --out 에 한 줄씩, 보고는 표준 출력에 찍는다.
//   이 스크립트는 테스트를 돌리지 않는다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

// 2026-11-24 실측(PR #5003 의 수동 실행 7회). 시간 기록(.omo/test-timings.json)은 «케이스 실행 시간» 이라 파일마다 드는 고정 비용(모듈 import·jsdom 설정)이 빠져 있다.
//   mdc2-heavy(박스 load 약 38/40코어): 같은 36파일(기록 합 377초)이 워커 4 로 11분에 20파일, 워커 2 로 11분에 14파일 — 워커 시간으로 파일당 70~90초, 첫 파일 완료까지 2~4분.
//   ubuntu-latest(워커 1): 같은 18파일 중 7분에 13파일 — 파일당 27초, 시작 70초. 기록의 초는 파일 크기에 거의 비례하지 않는다(파일당 고정 비용이 지배).
//   그래서 파일 하나의 비용 = perFileSeconds + factor × 기록 초(워커 초), 예상 벽시계 = startupSeconds + Σ비용 / workers 로 본다.
//   기본값(85 + 2×초, 시작 200초)은 mdc2-heavy·워커 4 실측 4회에 맞췄다: 7파일(기록 합 18초) 예상 358초 → 실제 vitest 393초, 6파일(합 74초) 예상 365초 → 450초 시간 상자에 끊김.
//   즉 파일 수가 비용을 지배한다(기록 초는 거의 비례하지 않는다). 러너나 박스 부하가 바뀌면 워크플로의 selector_args 로 보정한다.
export const DEFAULTS = Object.freeze({ budgetSeconds: 380, workers: 4, factor: 2, perFileSeconds: 85, startupSeconds: 200, defaultSeconds: 6.4 });

const TIERS = ["changed-test", "direct-import", "string-literal"];
const CODE_EXTENSION = /\.(?:[cm]?[jt]sx?|vue|svelte)$/u;
const RESOLVE_EXTENSIONS = [".ts", ".mts", ".tsx", ".js", ".mjs"];
const GENERIC_BASENAMES = new Set([
  "index.json", "index.css", "index.md", "readme.md", "package.json", "package-lock.json", "tsconfig.json", "manifest.json",
  "config.json", "data.json", "meta.json", "settings.json", "default.json", "atlas.json", "style.css", "styles.css", "main.css",
]);

// 안전망 — 바뀌면 «전체가 의심» 인 파일. PR 에서는 전체로 넓히지 않고 표시만 한다.
const SAFETY_NET = [
  /^package\.json$/u,
  /^package-lock\.json$/u,
  /^vitest[^/]*\.[cm]?ts$/u,
  /^tsconfig[^/]*\.json$/u,
  /^scripts\/run-vitest[^/]*\.mjs$/u,
  /^scripts\/verify-gates\.mjs$/u,
  /^scripts\/lib\/ciOnlyTests\.mjs$/u,
  /^\.github\/workflows\/ci-[^/]*\.ya?ml$/u,
  /^test\/setup(?![^/]*\.test\.)[^/]*$/u,
  /^test\/(?:helpers|support)\//u,
  /^\.omo\/gates-baseline\.json$/u,
];

/** vitest.config.ts 의 include/exclude 와 같다: test/**\/*.test.ts 에서 *.bun · *.quarantine · *.browser 와 lakeVillageRebuildFinal 을 뺀다. */
export function isVitestFile(path) {
  if (!/^test\/.+\.test\.ts$/u.test(path)) return false;
  if (/\.(?:bun|quarantine|browser)\.test\.ts$/u.test(path)) return false;
  if (path === "test/lakeVillageRebuildFinal.test.ts") return false;
  return !/(?:^|\/)(?:node_modules|dist|cypress|\.git)\//u.test(path);
}

export function isSafetyNet(path) {
  return SAFETY_NET.some((pattern) => pattern.test(path));
}

export function isCodeFile(path) {
  return CODE_EXTENSION.test(path);
}

/** 소스 문자열에서 import 한정자(문자열 리터럴)를 뽑는다. 주석 안의 것도 뽑지만 과선택일 뿐이다. */
export function parseSpecifiers(source) {
  const found = new Set();
  const statement = /\b(?:import|export)\s+(?:type\s+)?(?:[^'"`;]*?\sfrom\s*)?(["'])([^"'\n]+)\1/gu;
  const call = /\b(?:import|require|vi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock))\s*\(\s*(["'`])([^"'`\n$]+)\1/gu;
  for (const pattern of [statement, call]) {
    for (const match of source.matchAll(pattern)) found.add(match[2]);
  }
  return [...found];
}

/** 한정자가 가리킬 수 있는 저장소 상대 경로들. 패키지(베어) 한정자는 빈 배열. */
export function importCandidates(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = posix.join("src", specifier.slice(2));
  else if (/^\.\.?(?:\/|$)/u.test(specifier)) base = posix.join(posix.dirname(fromFile), specifier);
  else return [];
  base = base.replace(/[?#].*$/u, "");
  const out = [base];
  const stripped = base.replace(/\.[cm]?jsx?$/u, "");
  const stems = stripped === base ? [base] : [base, stripped];
  for (const stem of stems) {
    for (const extension of RESOLVE_EXTENSIONS) out.push(`${stem}${extension}`);
  }
  for (const extension of RESOLVE_EXTENSIONS) out.push(`${base}/index${extension}`);
  return [...new Set(out)];
}

/** 시험 소스 중 바뀐 파일(코드든 `import x from "…/a.json"` 같은 데이터든)을 직접 import 하는 것. Map<시험 경로, 바뀐 파일[]> */
export function findDirectImporters(testSources, changedFiles) {
  const changed = new Set(changedFiles);
  const hits = new Map();
  if (changed.size === 0) return hits;
  for (const [test, source] of testSources) {
    const reached = new Set();
    for (const specifier of parseSpecifiers(source)) {
      for (const candidate of importCandidates(test, specifier)) {
        if (changed.has(candidate)) reached.add(candidate);
      }
    }
    if (reached.size > 0) hits.set(test, [...reached].sort());
  }
  return hits;
}

/** 소스의 문자열 리터럴에서 «마지막 경로 조각» 과 «상위폴더/마지막 조각» 키를 뽑는다. */
export function literalKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n]){1,300})\1/gu)) {
    const parts = match[2].replaceAll("\\", "/").replace(/[?#].*$/u, "").split("/").filter(Boolean);
    const last = parts.at(-1);
    if (!last || /\s/u.test(last)) continue;
    keys.add(last);
    if (parts.length >= 2) keys.add(`${parts.at(-2)}/${last}`);
  }
  return keys;
}

/** 코드가 아닌 바뀐 파일의 경로·이름을 문자열 리터럴로 든 시험. Map<시험 경로, 바뀐 파일[]> */
export function findLiteralReferences(testSources, changedNonCode) {
  const hits = new Map();
  if (changedNonCode.length === 0) return hits;
  const wanted = new Map(); // 키 → 바뀐 파일[]
  for (const path of changedNonCode) {
    const base = posix.basename(path);
    const parent = posix.basename(posix.dirname(path));
    const generic = GENERIC_BASENAMES.has(base.toLowerCase()) || base.length < 6;
    const key = generic ? (parent && parent !== "." ? `${parent}/${base}` : base) : base;
    if (!wanted.has(key)) wanted.set(key, []);
    wanted.get(key).push(path);
  }
  for (const [test, source] of testSources) {
    const reached = new Set();
    for (const key of literalKeys(source)) {
      for (const path of wanted.get(key) ?? []) reached.add(path);
    }
    if (reached.size > 0) hits.set(test, [...reached].sort());
  }
  return hits;
}

/**
 * 후보를 우선순위(changed-test > direct-import > string-literal) → 싼 것 → 경로 순으로 훑으며 예상 벽시계가 상한 안인 것만 담는다.
 * 파일 비용(워커 초) = perFileSeconds + factor × 초. 예상 벽시계 = startupSeconds + max(Σ비용 / workers, 가장 큰 파일 하나의 비용). 담지 못한 것은 skipped 에 사유와 함께 남는다.
 * @param {{file: string, tier: string, reasons: string[]}[]} candidates
 * @param {Record<string, {sec: number}>} timings
 */
export function applyBudget(candidates, timings, options = {}) {
  const { budgetSeconds, workers, factor, perFileSeconds, startupSeconds, defaultSeconds } = { ...DEFAULTS, ...options };
  const sized = candidates.map((candidate) => ({ ...candidate, sec: timings[candidate.file]?.sec ?? defaultSeconds, known: timings[candidate.file] != null }));
  sized.sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || a.sec - b.sec || (a.file < b.file ? -1 : 1));
  const selected = [];
  const skipped = [];
  let sum = 0;
  let cost = 0;
  let largest = 0;
  for (const entry of sized) {
    const wall = perFileSeconds + entry.sec * factor;
    if (startupSeconds + wall > budgetSeconds) skipped.push({ ...entry, why: `단독 예상 ${Math.round(startupSeconds + wall)}초 > 상한 ${budgetSeconds}초` });
    else if (startupSeconds + Math.max(largest, wall, (cost + wall) / workers) > budgetSeconds) skipped.push({ ...entry, why: "상한 초과" });
    else {
      selected.push(entry);
      sum += entry.sec;
      cost += wall;
      largest = Math.max(largest, wall);
    }
  }
  selected.sort((a, b) => (a.file < b.file ? -1 : 1));
  skipped.sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || (a.file < b.file ? -1 : 1));
  const estWallSeconds = selected.length === 0 ? 0 : Math.round(startupSeconds + Math.max(largest, cost / workers));
  return { selected, skipped, sumSeconds: Math.round(sum), estWallSeconds };
}

/**
 * @param {object} input
 * @param {readonly string[]} input.changed          git diff --name-only 결과(저장소 상대·슬래시)
 * @param {ReadonlyMap<string, string>} input.testSources  vitest 가 모으는 시험 파일 → 소스
 * @param {(path: string) => boolean} input.exists   바뀐 시험 파일이 체크아웃에 있는지(삭제된 파일 거르기)
 */
export function selectRelated({ changed, testSources, exists, timings = {}, options = {} }) {
  const safetyNet = changed.filter(isSafetyNet);
  const changedNonCode = changed.filter((path) => !isCodeFile(path));
  const candidates = new Map();
  const add = (file, tier, reasons) => {
    const known = candidates.get(file);
    if (!known) candidates.set(file, { file, tier, reasons });
    else if (TIERS.indexOf(tier) < TIERS.indexOf(known.tier)) candidates.set(file, { file, tier, reasons });
  };
  for (const path of changed) if (isVitestFile(path) && exists(path)) add(path, "changed-test", [path]);
  for (const [test, reasons] of findDirectImporters(testSources, changed)) add(test, "direct-import", reasons);
  for (const [test, reasons] of findLiteralReferences(testSources, changedNonCode)) add(test, "string-literal", reasons);
  const budget = applyBudget([...candidates.values()], timings, options);
  return { changed, safetyNet, candidateCount: candidates.size, ...budget };
}

const seconds = (value) => `${Math.round(value)}초(${(value / 60).toFixed(1)}분)`;

function tierCounts(entries) {
  return TIERS.map((tier) => `${tier} ${entries.filter((entry) => entry.tier === tier).length}`).join(" · ");
}

/** 표준 출력 보고(여러 줄). */
export function formatReport(result, options = {}) {
  const { budgetSeconds, workers, factor, perFileSeconds, startupSeconds } = { ...DEFAULTS, ...options };
  const lines = [`vitest-related: 바뀐 파일 ${result.changed.length}개 → 후보 ${result.candidateCount}개`];
  for (const path of result.safetyNet) lines.push(`safety-net hit: ${path} — full suite runs nightly (PR 에서는 깊이 1 + 시간 상한만 돈다)`);
  lines.push(
    `선택 ${result.selected.length}개 (${tierCounts(result.selected)}) — 시험 시간 합 ${seconds(result.sumSeconds)}(호스티드 기준), ` +
      `예상 벽시계 ${seconds(result.estWallSeconds)} (워커 ${workers} · 파일당 ${perFileSeconds}초 + ${factor}× · 시작 ${startupSeconds}초 · 상한 ${seconds(budgetSeconds)})`,
  );
  for (const entry of result.selected) lines.push(`  + ${entry.file}  ${entry.sec.toFixed(1)}s  [${entry.tier}${entry.known ? "" : " · 시간 기록 없음"}]`);
  if (result.skipped.length > 0) {
    lines.push(`nightly 로 미룸 ${result.skipped.length}개 (시간 상한 — ci-full 이 본다):`);
    for (const entry of result.skipped) lines.push(`  - ${entry.file}  ${entry.sec.toFixed(1)}s  [${entry.tier}] ${entry.why}`);
  }
  return lines.join("\n");
}

/** GITHUB_STEP_SUMMARY 용 마크다운. */
export function formatSummary(result, options = {}) {
  const { budgetSeconds, workers, factor, perFileSeconds, startupSeconds } = { ...DEFAULTS, ...options };
  const lines = [
    "### ci-related-tests",
    "",
    `- 바뀐 파일 ${result.changed.length}개 → 후보 ${result.candidateCount}개, **선택 ${result.selected.length}개** (${tierCounts(result.selected)})`,
    `- 시험 시간 합 ${seconds(result.sumSeconds)}(호스티드 기준) · 예상 벽시계 ${seconds(result.estWallSeconds)} (워커 ${workers} · 파일당 ${perFileSeconds}초 + ${factor}× · 시작 ${startupSeconds}초 · 상한 ${seconds(budgetSeconds)})`,
  ];
  for (const path of result.safetyNet) lines.push(`- safety-net hit: \`${path}\` — full suite runs nightly`);
  if (result.skipped.length > 0) {
    lines.push(`- **nightly 로 미룸 ${result.skipped.length}개** (시간 상한 — ci-full 이 본다)`, "", "<details><summary>미룬 파일</summary>", "");
    for (const entry of result.skipped) lines.push(`- \`${entry.file}\` ${entry.sec.toFixed(1)}s [${entry.tier}] ${entry.why}`);
    lines.push("", "</details>");
  }
  if (result.selected.length > 0) {
    lines.push("", "<details><summary>고른 파일</summary>", "");
    for (const entry of result.selected) lines.push(`- \`${entry.file}\` ${entry.sec.toFixed(1)}s [${entry.tier}]`);
    lines.push("", "</details>");
  }
  return `${lines.join("\n")}\n`;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!flag.startsWith("--")) throw new Error(`알 수 없는 인자: ${flag}`);
    const [name, inline] = flag.slice(2).split("=", 2);
    const value = inline ?? argv[++index];
    if (value === undefined) throw new Error(`--${name} 에 값이 없다`);
    options[name] = value;
  }
  return options;
}

const numberOption = (value, fallback, name, minimum = 0.000001) => {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(`--${name} 값이 올바르지 않다: ${value}`);
  return parsed;
};

function main(argv) {
  const args = parseArguments(argv);
  if (!args.base) throw new Error("--base <ref> 가 필요하다");
  const options = {
    budgetSeconds: numberOption(args["budget-seconds"], DEFAULTS.budgetSeconds, "budget-seconds"),
    workers: numberOption(args.workers, DEFAULTS.workers, "workers"),
    factor: numberOption(args.factor, DEFAULTS.factor, "factor"),
    perFileSeconds: numberOption(args["per-file-seconds"], DEFAULTS.perFileSeconds, "per-file-seconds", 0),
    startupSeconds: numberOption(args["startup-seconds"], DEFAULTS.startupSeconds, "startup-seconds", 0),
    defaultSeconds: numberOption(args["default-seconds"], DEFAULTS.defaultSeconds, "default-seconds"),
  };
  const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const changed = git("diff", "--name-only", "--no-renames", "-z", `${args.base}...${args.head ?? "HEAD"}`).split("\0").filter(Boolean).sort();

  let timings = {};
  const timingsPath = args.timings ?? ".omo/test-timings.json";
  try {
    timings = JSON.parse(readFileSync(timingsPath, "utf8")).files ?? {};
  } catch {
    console.log(`시간 기록(${timingsPath})을 읽지 못했다 — 모든 파일을 ${options.defaultSeconds}초로 본다.`);
  }

  // 시험 소스는 필요할 때만 읽는다: 바뀐 파일이 시험뿐이거나 없으면 건너뛴다.
  const testSources = new Map();
  if (changed.some((path) => !isVitestFile(path))) {
    for (const path of git("ls-files", "-z", "--", "test").split("\0").filter(isVitestFile)) {
      try {
        testSources.set(path, readFileSync(path, "utf8"));
      } catch { /* 작업 트리에서 지워진 파일 */ }
    }
  }

  const result = selectRelated({ changed, testSources, exists: existsSync, timings, options });
  console.log(formatReport(result, options));
  if (args.out) writeFileSync(args.out, result.selected.map((entry) => `${entry.file}\n`).join(""));
  if (args.summary) writeFileSync(args.summary, formatSummary(result, options), { flag: "a" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`vitest-related: ${error.message}`);
    process.exitCode = 2;
  }
}
