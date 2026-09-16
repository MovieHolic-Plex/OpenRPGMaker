#!/usr/bin/env node
// CSS 그래프 게이트 — @import 그래프의 **구조적 무결성**만 본다(스타일 품질이 아니라 배선).
//
// 왜 필요한가 (실측 사고 2건):
//  1. 미등록 고아 파일 — `src/styles/editor/event-editor.command-preview/07-identifiable-previews.css`
//     는 커밋 cf91ee76 에서 배럴(`event-editor.command-preview.css`)의 @import 와 **같이** 들어왔는데,
//     PR #98 의 squash merge 가 배럴 한 줄만 조용히 되돌렸다. 파일은 살아남고 등록만 사라졌다.
//     그 뒤로 실제 시각 버그(faceset 시트가 96px 클립 위에 원본 크기로 그려짐)가 계속 배포됐고,
//     `test/quickAuthoringPreviewIdentity.test.ts` 의 실패 테스트 2건을 아무도 이 사고와 연결하지 못했다.
//     빌드는 초록이었다 — 아무도 안 읽는 CSS 파일은 컴파일러가 잡아주지 않기 때문이다.
//  2. 이중 @import — 같은 번들 안에서 서로 다른 배럴이 같은 파일을 두 번 부르는 케이스.
//     Vite 의 postcss-import 는 **첫 번째 위치**로 dedup 하므로, 두 번째 배럴이 선언한
//     cascade 순서 계약은 거짓말이 된다. 나중 배럴을 읽고 우선순위를 추론한 사람은
//     반드시 틀린 결론에 도달한다. (P0 기준선의 5건은 2026-09-11 Task 7 에서 해소됐다.)
//
// 현재 상태 실측 (2026-09-17): 엔트리 6개 · CSS 290개 · 도달 290개 · 고아 0 · 이중 0 ·
// 미등록 슬라이스 0 · 번호 충돌 0. **ALLOWLIST 네 개가 전부 비어 있다** — 초록의 이유는
// 유예가 아니라 빚을 갚았기 때문이다. (2026-08-28 판 주석은 "전부 유예돼 초록"이라고
// 정반대로 말하고 있었고, 그 문장이 실제로 리뷰어를 오도했다.)
//
// 기준선 철학은 scripts/verify-gates.mjs 와 같다: 기존 위반은 아래 ALLOWLIST 로 유예하고
// **새로 생긴 위반만** 회귀로 취급한다. 유예 항목을 고치면 목록에서 한 줄 지우면 끝이다.
//
// 사용:
//   node scripts/check-css-graph.mjs                 # 검사 + 요약 (exit 1 = 새 위반)
//   node scripts/check-css-graph.mjs --json          # 기계 판독용 출력
//   node scripts/check-css-graph.mjs --print-baseline # 현재 상태를 ALLOWLIST 스니펫으로 출력(붙여넣기용)
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative, basename } from "node:path";
import { parseImports, stripCssComments } from "./lib/css-import-re.mjs";
// 엔트리 발견은 scripts/lib/css-entries.mjs 하나만 쓴다 — 승자 게이트와 같은 목록을 봐야 한다.
import { discoverEntries, walk, resolveSpecifier as resolveCssSpecifier } from "./lib/css-entries.mjs";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "src");

// 게이트가 책임지는 CSS 우주. 이 밖(예: node_modules)의 파일은 도달 계산에만 쓰고 위반 판정은 안 한다.
const CSS_ROOTS = ["src/styles", "src/player", "src/benchmark"];

// 엔트리는 하드코딩하지 않고 src/**/*.ts 의 `import "....css"` 로 **발견**한다.
// 엔트리가 늘거나 옮겨져도 게이트가 따라가야 하기 때문이다. 목록·폴백은 scripts/lib/css-entries.mjs.
// (2026-09-11 Task 7 이후) TS 가 직접 붙이던 database 시트(curve-editors·battle-studio·animation-editor 등)는
// database/index.css 진입 시트로 흡수됐다 — 폴백은 편집기·플레이어·벤치마크 엔트리와 두 지연 진입 시트만 둔다.

// ── 유예 목록 (P0 기준선) ───────────────────────────────────────────────────────
// 여기 있는 항목은 "이미 알고 있는 빚"이다. 고치는 순간 해당 줄을 지우면 게이트가 다시 지켜준다.

// 검사 1: 어떤 엔트리에서도 도달 불가능한 CSS.
const UNREACHABLE_ALLOWLIST = new Set([]);

// 검사 2: 두 곳 이상에서 @import 되는 파일 — postcss-import 가 첫 위치로 dedup 하므로
// 두 번째 배럴의 cascade 순서 선언은 실제로 적용되지 않는다.
// (P0 기준선의 5건은 2026-09-11 Task 7 의 진입 시트로 전부 해소돼 유예 목록이 비었다.)
const DOUBLE_IMPORT_ALLOWLIST = new Set([]);

// 검사 3: NN-*.css 인데 형제 배럴도, 그 슬라이스를 @import 하는 표면 진입 시트도 없는 슬라이스 파일.
// (사고 (1) 을 잡아냈어야 할 검사. 유예 항목은 UNREACHABLE 과 중복될 수 있다.
//  P0 기준선의 13-actor-studio.css 는 database/index.css 진입 시트가 직접 들여와 해소됐다.)
const UNREGISTERED_SLICE_ALLOWLIST = new Set([]);

// 검사 4: 같은 슬라이스 디렉터리에서 NN- 접두사가 겹치는 파일들.
// 병렬 워크트리에서 각자 다음 번호를 집어 생긴 충돌이다. 번호가 곧 cascade 순서라
// 겹치면 로드 순서가 배럴 줄 순서에만 의존하게 되고, 리네임 한 번에 조용히 뒤집힌다.
// 키 형식: "<슬라이스 디렉터리>#<NN>"
// 실측: 8개 슬라이스 디렉터리(총 94개 번호 파일)를 전수 조사한 결과 충돌 그룹은 **1개**뿐이었다
// (event-editor.command-preview 의 07 세 파일). 2026-09-11 Task 13 이 이벤트 시트를 번호 없는 구성 요소 버킷으로
// 접어 그 그룹이 사라졌다 → 유예 목록은 비어 있다.
const DUPLICATE_PREFIX_ALLOWLIST = new Set([]);

// ── 도구 ────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const asJson = flag("--json");

const toRel = (abs) => relative(ROOT, abs).split("\\").join("/");


// 주석 안의 @import 는 죽은 코드다. 지우지 않고 세면 "등록됐다"는 거짓 초록이 나온다.
// stripComments / CSS_IMPORT_RE 는 scripts/lib/css-import-re.mjs 로 옮겼다.

// TS 쪽 엔트리: `import "@/styles/index.css";` 또는 `import "./styles.css";`

// `@/` 별칭은 vite.config.ts 의 alias 와 같게 src/ 로 푼다.

function readImports(file) {
  // 파서는 scripts/lib/css-import-re.mjs 하나다. css-flatten.mjs 와 같은 정의를 써야
  // "한 도구에만 보이는 @import" 가 생기지 않는다(2026-09-17 세탁 경로 참조).
  const raw = readFileSync(file, "utf8");
  const css = stripCssComments(raw);
  const found = [];
  for (const imp of parseImports(raw)) {
    const target = resolveCssSpecifier(imp.spec, file, SRC_DIR);
    if (!target) continue;
    const line = css.slice(0, imp.index).split("\n").length;
    found.push({ spec: imp.spec, target, line });
  }
  return found;
}

// ── 엔트리 발견 ─────────────────────────────────────────────────────────────────
const { entries, discovery: entryDiscovery } = discoverEntries(ROOT);

// ── 그래프 순회 ─────────────────────────────────────────────────────────────────
// 엔트리마다 **따로** 순회한다. postcss-import 의 dedup 범위는 번들 1개이므로,
// index.css 번들과 player.css 번들이 각자 tokens.css 를 부르는 건 정상이다(서로 다른 산출물).
// 전역으로 세면 이 정상 케이스 2건이 위반으로 섞여 들어와 게이트가 양치기 소년이 된다
// (실측: 전역 집계 7건 → 번들별 집계 5건, 후자가 실제 cascade 거짓말 건수와 일치).
const reachable = new Set();
const missingTargets = [];
const graphs = []; // { entry, sites: Map<대상, [{from,line}]> }

for (const entryAbs of entries.keys()) {
  const sites = new Map();
  const seen = new Set([entryAbs]);
  const queue = [entryAbs];
  reachable.add(entryAbs);
  while (queue.length > 0) {
    const file = queue.shift();
    if (!existsSync(file)) continue;
    for (const { spec, target, line } of readImports(file)) {
      if (!sites.has(target)) sites.set(target, []);
      sites.get(target).push({ from: toRel(file), line });
      if (!existsSync(target)) {
        missingTargets.push({ from: toRel(file), line, spec });
        continue;
      }
      reachable.add(target);
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  graphs.push({ entry: toRel(entryAbs), sites });
}

// ── 검사 대상 우주 ──────────────────────────────────────────────────────────────
const universe = [];
for (const root of CSS_ROOTS) universe.push(...walk(join(ROOT, root), (f) => f.endsWith(".css")));
const universeRel = universe.map(toRel).sort();

let failures = 0;
const report = { entryDiscovery, entries: [], universe: universeRel.length, reachable: 0, checks: {} };
for (const [abs, importers] of entries) report.entries.push({ file: toRel(abs), importedBy: importers });
report.entries.sort((a, b) => a.file.localeCompare(b.file));
report.reachable = universe.filter((f) => reachable.has(f)).length;

function fail(message) {
  if (!asJson) console.error(`FAIL: ${message}`);
  failures++;
}

// ── 검사 0: 존재하지 않는 @import 대상 (유예 없음 — 항상 새 위반이다) ───────────
// 같은 파일이 여러 번들에 들어가면 중복 보고되므로 from:line 으로 접는다.
const uniqueMissing = [...new Map(missingTargets.map((m) => [`${m.from}:${m.line}`, m])).values()];
report.checks.missingTarget = uniqueMissing;
for (const { from, line, spec } of uniqueMissing) {
  fail(`${from}:${line} 이 존재하지 않는 파일을 @import 한다: "${spec}". 경로를 고치거나 그 줄을 지우세요.`);
}

// ── 검사 1: 도달 불가능 ────────────────────────────────────────────────────────
const unreachable = universeRel.filter((rel) => !reachable.has(join(ROOT, rel)));
report.checks.unreachable = { found: unreachable, allowlisted: [...UNREACHABLE_ALLOWLIST], new: [] };
for (const rel of unreachable) {
  if (UNREACHABLE_ALLOWLIST.has(rel)) continue;
  report.checks.unreachable.new.push(rel);
  fail(`${rel} 은 어떤 엔트리에서도 도달할 수 없다 (죽은 CSS). 배럴에 @import 를 추가하거나 파일을 지우세요.`);
}

// ── 검사 2: 이중 @import ───────────────────────────────────────────────────────
const doublesByFile = new Map(); // 파일 → { file, bundles: [{ entry, sites }] }
for (const { entry, sites } of graphs) {
  for (const [abs, hits] of sites) {
    if (hits.length < 2) continue;
    const rel = toRel(abs);
    if (!doublesByFile.has(rel)) doublesByFile.set(rel, { file: rel, bundles: [] });
    doublesByFile.get(rel).bundles.push({ entry, sites: hits.map((s) => `${s.from}:${s.line}`) });
  }
}
const doubles = [...doublesByFile.values()].sort((a, b) => a.file.localeCompare(b.file));
report.checks.doubleImport = { found: doubles, allowlisted: [...DOUBLE_IMPORT_ALLOWLIST], new: [] };
for (const hit of doubles) {
  if (DOUBLE_IMPORT_ALLOWLIST.has(hit.file)) continue;
  report.checks.doubleImport.new.push(hit.file);
  const bundle = hit.bundles[0];
  fail(
    `${hit.file} 이 번들 ${bundle.entry} 안에서 ${bundle.sites.length} 번 @import 된다 (${bundle.sites.join(", ")}). ` +
      `postcss-import 는 첫 위치로 dedup 하므로 뒤쪽 배럴이 선언한 cascade 순서는 적용되지 않는다 — 한 곳만 남기세요.`
  );
}

// ── 슬라이스 디렉터리 수집 ─────────────────────────────────────────────────────
// 슬라이스 = NN-*.css 를 가진 디렉터리. 형제 배럴은 `<디렉터리>.css`.
const NUMBERED_RE = /^(\d{2})-.+\.css$/;
// 표면 진입 시트 — 배럴이 없는 슬라이스 디렉터리의 등록처(검사 3). 레지스트리가 없거나 파일이 없으면 빈 목록.
const SURFACE_ENTRIES = (() => {
  const reg = join(ROOT, "scripts/css-surfaces.json");
  if (!existsSync(reg)) return [];
  return Object.values(JSON.parse(readFileSync(reg, "utf8")).surfaces ?? {})
    .map((s) => resolve(ROOT, s.entry))
    .filter((p) => existsSync(p));
})();
const sliceDirs = new Map(); // 디렉터리 절대경로 → 번호 파일명 배열
for (const abs of universe) {
  if (!NUMBERED_RE.test(basename(abs))) continue;
  const dir = dirname(abs);
  if (!sliceDirs.has(dir)) sliceDirs.set(dir, []);
  sliceDirs.get(dir).push(abs);
}

// ── 검사 3: 미등록 번호 슬라이스 ───────────────────────────────────────────────
report.checks.unregisteredSlice = { found: [], allowlisted: [...UNREGISTERED_SLICE_ALLOWLIST], new: [] };
for (const [dir, files] of [...sliceDirs].sort()) {
  // 형제 배럴(<디렉터리>.css)이 있으면 그것이 등록처다. 표면 격리 1단계(2026-09-11) 이후 배럴은
  // 지워지고 표면 진입 시트(scripts/css-surfaces.json 의 entry)가 슬라이스를 직접 @import 하므로,
  // 배럴이 없으면 진입 시트들을 등록처로 본다. 둘 다 없으면 여전히 실패다.
  const siblingBarrel = `${dir}.css`;
  const barrel = existsSync(siblingBarrel) ? siblingBarrel : SURFACE_ENTRIES.find((e) => readImports(e).some((imp) => dirname(imp.target) === dir));
  if (!barrel) {
    fail(`${toRel(dir)} 은 번호 슬라이스인데 형제 배럴 ${toRel(siblingBarrel)} 도, 그 슬라이스를 @import 하는 표면 진입 시트도 없다. 진입 시트에 연결하세요.`);
    continue;
  }
  const registered = new Set(readImports(barrel).map((imp) => imp.target));
  for (const abs of files.sort()) {
    const rel = toRel(abs);
    if (registered.has(abs)) continue;
    report.checks.unregisteredSlice.found.push(rel);
    if (UNREGISTERED_SLICE_ALLOWLIST.has(rel)) continue;
    report.checks.unregisteredSlice.new.push(rel);
    fail(`${rel} 이 형제 배럴 ${toRel(barrel)} 에 등록돼 있지 않다. ${toRel(barrel)} 에 @import 를 추가하거나 파일을 지우세요.`);
  }
}

// ── 검사 4: NN- 접두사 중복 ────────────────────────────────────────────────────
report.checks.duplicatePrefix = { found: [], allowlisted: [...DUPLICATE_PREFIX_ALLOWLIST], new: [] };
for (const [dir, files] of [...sliceDirs].sort()) {
  const byPrefix = new Map();
  for (const abs of files.sort()) {
    const prefix = NUMBERED_RE.exec(basename(abs))[1];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(basename(abs));
  }
  for (const [prefix, names] of [...byPrefix].sort()) {
    if (names.length < 2) continue;
    const key = `${toRel(dir)}#${prefix}`;
    report.checks.duplicatePrefix.found.push({ key, files: names });
    if (DUPLICATE_PREFIX_ALLOWLIST.has(key)) continue;
    report.checks.duplicatePrefix.new.push(key);
    fail(`${toRel(dir)} 에서 ${prefix}- 접두사가 ${names.length} 개 겹친다 (${names.join(", ")}). 번호가 cascade 순서이므로 하나를 다음 번호로 리네임하세요.`);
  }
}

// ── 출력 ───────────────────────────────────────────────────────────────────────
report.failures = failures;

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (flag("--print-baseline")) {
  // 기준선 갱신용 스니펫 — 아래 출력을 그대로 상수 블록에 붙여넣는다.
  const quote = (values) => values.map((v) => `  ${JSON.stringify(v)},`).join("\n");
  console.log(`UNREACHABLE_ALLOWLIST:\n${quote(unreachable)}`);
  console.log(`DOUBLE_IMPORT_ALLOWLIST:\n${quote(doubles.map((d) => d.file))}`);
  console.log(`UNREGISTERED_SLICE_ALLOWLIST:\n${quote(report.checks.unregisteredSlice.found)}`);
  console.log(`DUPLICATE_PREFIX_ALLOWLIST:\n${quote(report.checks.duplicatePrefix.found.map((d) => d.key))}`);
} else {
  console.log(
    `CSS graph gate: entries=${entries.size} (${entryDiscovery}), files=${report.universe}, reachable=${report.reachable}, orphan=${unreachable.length}`
  );
  console.log(`  missing @import target : ${missingTargets.length} new (유예 없음)`);
  console.log(`  unreachable            : ${unreachable.length} found, ${UNREACHABLE_ALLOWLIST.size} allowlisted, ${report.checks.unreachable.new.length} new`);
  console.log(`  double-imported        : ${doubles.length} found, ${DOUBLE_IMPORT_ALLOWLIST.size} allowlisted, ${report.checks.doubleImport.new.length} new`);
  console.log(`  unregistered slice     : ${report.checks.unregisteredSlice.found.length} found, ${UNREGISTERED_SLICE_ALLOWLIST.size} allowlisted, ${report.checks.unregisteredSlice.new.length} new`);
  console.log(`  duplicate NN- prefix   : ${report.checks.duplicatePrefix.found.length} found, ${DUPLICATE_PREFIX_ALLOWLIST.size} allowlisted, ${report.checks.duplicatePrefix.new.length} new`);
}

if (failures > 0) {
  if (!asJson) console.error(`\n${failures} 건의 새 CSS 그래프 위반. 유예가 필요하면 scripts/check-css-graph.mjs 의 ALLOWLIST 에 근거와 함께 추가하세요.`);
  process.exit(1);
}
process.exit(0);
