#!/usr/bin/env node
// scripts/check-css-live-classes.mjs
//
// CSS 정리(과제 C)의 시각 회귀 안전망. 줄 수·파일 수 게이트는 시트를 비워도 "개선"으로
// 보고한다(실측). 이 게이트는 반대 방향을 본다:
//
//   "폼·셸이 실제로 내보내는 클래스는, 그 클래스가 갖고 있던 CSS **속성**을 잃지 않아야 한다"
//
// 실사용 클래스 정본 = 표면 스냅샷 기준선(test/fixtures/*Surface.baseline.json)의 classes 축.
// 렌더로 증명된 목록이라 grep 추정이 아니다.
//
// ── 왜 "선언 개수"가 아니라 "속성 집합"인가 (실측) ────────────────────────────────
// 이전 판은 클래스별 **선언 개수**만 셌다. 이 저장소의 event-editor CSS 는 8세대가 겹쳐
// 있어서(event-editor.css / .part-1~4 / -legacy / .modern / .balanced / .mockup / …)
// 한 시트를 통째로 비워도 같은 클래스가 다른 세대에 남아 개수 감소가 관용 한도(50%) 안에
// 들어갔다. 실측: exit 0 을 유지한 채 262개 시트 중 224개(63,887줄)를 지울 수 있었고,
// event-editor 관련 시트는 55개 중 21개가 삭제 가능했다.
//
// 그래서 지표를 바꾼다:
//   properties  클래스가 어떤 CSS 속성을 갖는지의 **집합**. 속성이 통째로 사라지면
//               그 클래스는 스타일 차원 하나를 잃은 것이다 → 하드 실패.
//               다른 세대에 같은 속성이 남아 있으면 스타일은 실제로 살아 있다 → 통과.
//               (중복 제거는 정리의 목적이므로 이건 올바른 관용이다.)
//   declarations `속성:값` 집합. 속성은 남았지만 값이 바뀐 것은 **보고만** 한다
//               (디자인 변경과 구분 불가). 값 집합이 통째로 비면 위 속성 검사가 잡는다.
//
// ── 정본 축 ─────────────────────────────────────────────────────────────────────
// 커맨드 폼 축만 보면 셸이 통째로 사각이다 — event-editor.balanced.css 클래스 140종 중
// 127종이 셸 전용이다. 그래서 존재하는 표면 기준선 전부를 정본으로 읽고, 필수 축이
// 없으면 **하드 실패**한다(조용히 좁은 정본으로 통과하는 경로를 없앤다).
//
// 사용:
//   node scripts/check-css-live-classes.mjs                 # 기준선 대조(게이트)
//   CSS_LIVE_BASELINE_UPDATE=1 node scripts/check-css-live-classes.mjs --save-baseline
//                                                           # 기준선 갱신(의도적으로 exit 1)
//   node scripts/check-css-live-classes.mjs --report-unused  # 렌더로 증명되지 않은 클래스
//   node scripts/check-css-live-classes.mjs --print-rendered-classes
//                                                           # 정본 축이 증명한 클래스 집합(JSON) — 사각지대 계산용
//   CSS_LIVE_STYLES_DIR=<dir> node scripts/check-css-live-classes.mjs
//                                                           # 게이트 자체를 검증할 때 시트 루트를 갈아끼운다
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { warnIfStale } from "./lib/baseline-age.mjs";

const ROOT = process.cwd();
// 세 경로 모두 환경변수로 바꿔 끼울 수 있다 — 그래야 이 게이트의 안전장치(0 기준선 거부,
// 대량 열화 거부, 필수 축 누락 거부)를 **실제로 밟아서** 증명할 수 있다. 프로덕션 파일을
// 건드리지 않고 임시 디렉터리로 재현하는 것이 목적이고, 기본값은 전부 저장소 경로다.
const BASELINE = process.env.CSS_LIVE_BASELINE_PATH
  ? join(ROOT, process.env.CSS_LIVE_BASELINE_PATH)
  : join(ROOT, ".omo/css-live-classes-baseline.json");
const STYLES_DIR = process.env.CSS_LIVE_STYLES_DIR
  ? join(ROOT, process.env.CSS_LIVE_STYLES_DIR)
  : join(ROOT, "src/styles");
/** 정본 축 JSON 을 찾을 기준 디렉터리. 기본은 저장소 루트(축 경로가 test/fixtures/… 이다). */
const CANON_ROOT = process.env.CSS_LIVE_CANON_ROOT ? join(ROOT, process.env.CSS_LIVE_CANON_ROOT) : ROOT;

/**
 * 정본 축. `required: true` 인 축이 없으면 게이트는 통과하지 않고 하드 실패한다 —
 * 정본이 좁아지면 게이트가 조용히 무력해지기 때문이다(축 하나가 클래스 수백 종을 담당한다).
 * 6축 전부 `required: true` 다(신설 직후에만 false 였다). 축 파일이 사라져도 게이트가 초록이면
 * 정본이 조용히 좁아지는데, 그건 `canonShrink()` 와 겹치는 방어가 아니다 — canonShrink 는
 * 기준선에 있던 클래스가 사라진 걸 보고, 이건 축 파일 자체의 부재를 본다.
 */
const CANON_AXES = [
  { path: "test/fixtures/eventEditorFormSurface.baseline.json", required: true, regen: "FORM_SURFACE_UPDATE=1 npx vitest run test/eventEditorFormSurface.baseline.test.ts" },
  { path: "test/fixtures/eventEditorM2Surface.baseline.json", required: true, regen: "M2_SURFACE_UPDATE=1 npx vitest run test/eventEditorM2Surface.baseline.test.ts" },
  { path: "test/fixtures/eventEditorShellSurface.baseline.json", required: true, regen: "SHELL_SURFACE_UPDATE=1 npx vitest run test/eventEditorShellSurface.baseline.test.ts" },
  { path: "test/fixtures/eventEditorConditionSurface.baseline.json", required: true, regen: "CONDITION_SURFACE_UPDATE=1 npx vitest run test/eventEditorConditionSurface.baseline.test.ts" },
  // 포털(피커/모달) 축. `document.body` 로 렌더되는 표면이라 폼/셸 축이 하나도 못 본다 —
  // 실측: 이 축이 없으면 06-event-command-picker-favorite.css(456줄)와
  // event-editor.p1-route.css(117줄)를 통째로 비워도 게이트가 통과한다.
  { path: "test/fixtures/eventEditorPortalSurface.baseline.json", required: true, regen: "PORTAL_SURFACE_UPDATE=1 npx vitest run test/eventEditorPortalSurface.baseline.test.ts" },
  // 상호작용 후 폼 축. 조건부로만 나타나는 UI 의 클래스는 초기 렌더에 없으므로 이 축만 증명한다.
  { path: "test/fixtures/eventEditorInteractionSurface.baseline.json", required: true, regen: "INTERACTION_SURFACE_UPDATE=1 npx vitest run test/eventEditorInteractionSurface.baseline.test.ts" },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

function stripComments(css) {
  let out = "";
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
      out += " ";
      continue;
    }
    out += css[i];
  }
  return out;
}

/**
 * 선언 정규화. 공백·대소문자 차이로 같은 선언이 다르게 보이면 거짓 "속성 소실"이 난다.
 * `!important` 는 값의 일부로 남긴다 — 떼면 캐스케이드 승자가 바뀌므로 같은 선언이 아니다.
 */
function normalizeDecl(raw) {
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const prop = raw.slice(0, idx).trim().toLowerCase();
  const value = raw.slice(idx + 1).trim().replace(/\s+/g, " ").toLowerCase();
  if (!prop || !value) return null;
  // 커스텀 프로퍼티(--x)도 스타일 차원이므로 그대로 담는다.
  if (!/^[-a-z]+$/.test(prop)) return null;
  return { prop, decl: `${prop}:${value}` };
}

/**
 * 클래스 → { props:Set, decls:Set, sheets:Set }.
 *
 * 최상위 규칙 블록만 훑는다: "선택자 { 선언들 }". `@media` 등의 중첩은 내부 블록이 다시
 * 잡히므로 그 안의 규칙도 포함된다. 다만 **미디어 컨텍스트는 구분하지 않는다** —
 * `@media print` 안에서만 스타일된 클래스도 "스타일 있음"으로 본다. 이 저장소의 이벤트
 * 에디터 시트에는 print 전용 규칙이 없어 실효 손실이 없고, 컨텍스트를 키에 넣으면
 * 브레이크포인트를 조정하는 정상 리팩터가 전부 "속성 소실"로 오탐된다.
 */
function cssClassIndex(files) {
  const index = new Map();
  const touch = (cls, rel) => {
    if (!index.has(cls)) index.set(cls, { props: new Set(), decls: new Set(), sheets: new Set() });
    const e = index.get(cls);
    e.sheets.add(rel);
    return e;
  };
  for (const file of files) {
    const rel = relative(ROOT, file);
    const text = stripComments(readFileSync(file, "utf8"));
    for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = m[1];
      const body = m[2];
      const classes = new Set([...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((x) => x[1]));
      if (!classes.size) continue;
      const decls = [];
      for (const chunk of body.split(";")) {
        const n = normalizeDecl(chunk);
        if (n) decls.push(n);
      }
      for (const c of classes) {
        const e = touch(c, rel);
        for (const { prop, decl } of decls) {
          e.props.add(prop);
          e.decls.add(decl);
        }
      }
    }
    // 선택자에만 등장하고 선언이 0인 경우(@media 헤더 등)도 존재는 기록한다.
    for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      if (!index.has(m[1])) touch(m[1], rel);
    }
  }
  return index;
}

/** 표면 기준선 JSON 어디에 있든 `classes` 배열을 재귀로 긁는다(축 스키마 변경에 불변). */
function collectClasses(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) collectClasses(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "classes" && Array.isArray(value)) {
      for (const c of value) if (typeof c === "string" && c) out.add(c);
      continue;
    }
    collectClasses(value, out);
  }
}

function renderedClasses() {
  const set = new Set();
  const used = [];
  const missing = [];
  for (const axis of CANON_AXES) {
    const p = join(CANON_ROOT, axis.path);
    if (!existsSync(p)) {
      if (axis.required) missing.push(axis);
      continue;
    }
    const before = set.size;
    collectClasses(JSON.parse(readFileSync(p, "utf8")), set);
    used.push({ path: axis.path, added: set.size - before });
  }
  if (missing.length) {
    console.error(`FAIL: 필수 정본 축의 표면 기준선이 없다 ${missing.length}건 — 정본이 좁아지면 게이트가 조용히 무력해진다.`);
    for (const axis of missing) {
      console.error(`  없음: ${axis.path}`);
      console.error(`    생성: ${axis.regen}`);
    }
    process.exit(2);
  }
  return { set, used };
}

const args = process.argv.slice(2);
if (!existsSync(STYLES_DIR)) {
  console.error(`FAIL: 시트 루트가 없다 — ${relative(ROOT, STYLES_DIR)}`);
  process.exit(2);
}
const cssFiles = walk(STYLES_DIR);
const index = cssClassIndex(cssFiles);
const { set: rendered, used: canonUsed } = renderedClasses();

// 정본 축이 증명한 클래스 집합을 그대로 내보내는 출구.
// measure-css-deletable.mjs 가 CANON_AXES 를 복제하지 않고 이 한 곳을 읽게 하려고 있다 —
// 복제하면 축이 늘어날 때 두 파일이 조용히 어긋나고, 어긋난 쪽이 «사각지대 없음»을 보고한다.
if (args.includes("--print-rendered-classes")) {
  process.stdout.write(`${JSON.stringify([...rendered].sort())}\n`);
  process.exit(0);
}

// 렌더로 증명된 클래스 중 CSS 선언을 가진 것 = 보호 대상.
const live = {};
for (const c of [...rendered].sort()) {
  const e = index.get(c);
  if (!e || e.props.size === 0) continue;
  live[c] = {
    props: [...e.props].sort(),
    decls: [...e.decls].sort(),
    sheets: [...e.sheets].sort(),
  };
}
const unstyled = [...rendered].filter((c) => !(index.get(c)?.props.size > 0)).sort();

if (args.includes("--report-unused")) {
  const unused = [...index.keys()].filter((c) => !rendered.has(c)).sort();
  console.log(`정본 축 ${canonUsed.length}개: ${canonUsed.map((u) => `${u.path.replace(/^test\/fixtures\//, "")}(+${u.added})`).join(", ")}`);
  console.log(`렌더 증명 클래스 ${rendered.size}종 / CSS 선택자 클래스 ${index.size}종 / 시트 ${cssFiles.length}개`);
  console.log(`규칙 있고 렌더에도 있음(보호 대상): ${Object.keys(live).length}종`);
  console.log(`렌더에 있으나 규칙 없음(스타일 미적용): ${unstyled.length}종`);
  console.log(`규칙 있으나 어떤 축에도 없음(삭제 후보 — 맵/DB/타일셋 패널 표면은 정본에 없으므로 그대로 지우면 안 된다): ${unused.length}종`);
  console.log(unused.slice(0, 40).map((c) => `  .${c}`).join("\n"));
  process.exit(0);
}

function summarize() {
  const propTotal = Object.values(live).reduce((n, e) => n + e.props.length, 0);
  const declTotal = Object.values(live).reduce((n, e) => n + e.decls.length, 0);
  return { classes: Object.keys(live).length, propTotal, declTotal };
}

if (args.includes("--save-baseline")) {
  // 기준선 갱신은 "통과"가 아니라 "리뷰 요청"이다. 실측: 표면 게이트에서 `*_UPDATE=1` 이
  // 즉시 PASS 를 반환해, 몇 초 전 자기가 쓴 파일에 대한 자기 확인이 "9 tests 통과"로
  // 보고된 사고가 있었다. 그래서 (1) 전용 환경변수를 요구하고 (2) 무엇을 승인하는지 찍고
  // (3) 의도적으로 exit 1 한다.
  if (process.env.CSS_LIVE_BASELINE_UPDATE !== "1") {
    console.error("FAIL: --save-baseline 은 CSS_LIVE_BASELINE_UPDATE=1 을 함께 요구한다.");
    console.error("  이유: 기준선을 다시 쓰면 그 순간의 상태가 무엇이든 정답이 된다. 실수로 래칫을 푸는 경로를 막는다.");
    process.exit(2);
  }
  if (process.env.CI) {
    console.error("FAIL: CI 에서 기준선을 갱신할 수 없다 — CI 가 기준선을 다시 쓰면 래칫이 사라진다.");
    process.exit(2);
  }
  const had = existsSync(BASELINE);
  let approved = [];
  if (had) approved = compare(JSON.parse(readFileSync(BASELINE, "utf8")));

  // 열화한 기준선을 쓰지 않는다. 위의 환경변수·리뷰·exit 1 래칫은 "사람이 실수로 푸는 것"을
  // 막지만, 정본 축이 크래시해서 클래스가 0종으로 수확된 상태에서 갱신하면 **0 기준선**이 굳고
  // 그 뒤로는 무엇을 잃어도 통과한다(잃을 게 없으므로). 같은 함정을 표면 게이트 하한선에서도
  // 실측했다 — test/surfaceGateSupport.ts 의 checkFloor 주석 참조.
  const now = Object.keys(live).length;
  if (now === 0) {
    console.error("FAIL: 기준선을 쓰지 않았다 — 수확된 클래스가 0종이다. 정본 축이 크래시한 상태로 보인다.");
    console.error("  0 기준선이 굳으면 그 뒤로는 무엇을 잃어도 통과한다. 축 렌더 오류를 먼저 고쳐라.");
    process.exit(2);
  }
  if (had) {
    const before = Object.keys(JSON.parse(readFileSync(BASELINE, "utf8")).live ?? {}).length;
    if (before > 0 && now < before * 0.1) {
      console.error(`FAIL: 기준선을 쓰지 않았다 — 보호 클래스가 ${before} → ${now} (10% 미만)으로 떨어졌다.`);
      console.error("  대량 열화다. 의도한 축소면 기준선 파일을 직접 삭제하고 다시 만들어라(그 삭제가 리뷰에 남는다).");
      process.exit(2);
    }
  }

  writeFileSync(
    BASELINE,
    `${JSON.stringify({ ranAt: new Date().toISOString(), canon: canonUsed, live, unstyled }, null, 1)}\n`
  );
  const s = summarize();
  console.log(`기준선 ${had ? "갱신" : "생성"}: ${relative(ROOT, BASELINE)} — 보호 ${s.classes}종 / 속성 ${s.propTotal} / 선언 ${s.declTotal}`);
  if (approved.length) {
    console.log(`이 갱신으로 승인되는 손실 ${approved.length}건:`);
    for (const line of approved.slice(0, 40)) console.log(`  ${line}`);
    if (approved.length > 40) console.log(`  … 외 ${approved.length - 40}건`);
  }
  console.log("");
  console.log("갱신 실행은 의도적으로 실패한다 — 위 목록을 리뷰하고, 플래그 없이 다시 돌려 초록을 확인하라.");
  process.exit(1);
}

/**
 * 기준선 대비 손실 목록. 반환이 비면 통과다.
 *
 * 하드 실패로 보는 것:
 *   - 클래스가 스타일을 통째로 잃었다 (속성 0개)
 *   - 클래스가 갖고 있던 **속성**이 사라졌다 (스타일 차원 소실)
 * 보고만 하는 것:
 *   - 속성은 남았는데 값이 바뀌었다 (디자인 변경과 구분 불가)
 */
function compare(base) {
  const failures = [];
  for (const [c, was] of Object.entries(base.live ?? {})) {
    const now = index.get(c);
    if (!now || now.props.size === 0) {
      failures.push(`.${c} — 스타일이 통째로 사라졌다 (이전 속성 ${was.props.length}종, 시트 ${(was.sheets ?? []).length}개)`);
      continue;
    }
    const lostProps = (was.props ?? []).filter((p) => !now.props.has(p));
    if (lostProps.length) {
      failures.push(`.${c} — 속성 ${lostProps.length}종 소실 [${lostProps.slice(0, 10).join(", ")}]`);
    }
  }
  return failures;
}

/**
 * **정본 래칫.** 렌더로 증명된 클래스 집합이 줄어들었는지 본다.
 *
 * 왜 별도로 필요한가 (실측된 구멍): `compare()` 는 기준선의 클래스마다 **CSS 인덱스**를 조회한다.
 * 즉 "이 클래스에 아직 규칙이 있나"만 확인하고 "이 클래스가 아직 렌더되나"는 안 본다. 그래서
 * 정본 축 파일을 `{}` 로 만들어 렌더 증명 클래스를 970종 → 2종으로 붕괴시켰을 때 게이트가
 * **exit 0** 이었다. CSS 를 안 건드렸으니 잃은 속성이 없었던 것이다.
 * `required: true` 는 파일이 **없을 때**만 잡는다 — 속이 빈 파일은 잡지 못한다.
 *
 * 기준선은 이미 이전 렌더 집합을 통째로 담고 있다(`live` 키 ∪ `unstyled`). 추가 저장 없이
 * 그 합집합과 현재 렌더 집합을 비교하면 된다.
 *
 * 이게 하드 실패인 이유: 정본이 좁아지면 이 게이트가 보증하는 것도 같이 좁아지는데, 출력은
 * 여전히 "보호 970종 통과"라고 말한다. 게이트가 자기 증거가 사라진 걸 모르는 상태가 가장 나쁘다.
 * UI 가 정말로 그 클래스를 더 안 그리게 된 경우라면 표면 축이 먼저 빨개졌을 것이고, 거기서
 * 승인했다면 여기 기준선도 같이 갱신하는 것이 맞다.
 */
function canonShrink(base) {
  const wasRendered = [...new Set([...Object.keys(base.live ?? {}), ...(base.unstyled ?? [])])];
  const gone = wasRendered.filter((c) => !rendered.has(c)).sort();
  return { wasRendered: wasRendered.length, gone };
}

function valueChanges(base) {
  const changes = [];
  for (const [c, was] of Object.entries(base.live ?? {})) {
    const now = index.get(c);
    if (!now || now.props.size === 0) continue;
    const lost = (was.decls ?? []).filter((d) => !now.decls.has(d));
    // 속성이 남아 있는 선언 손실만 = 값 변경. 속성째 소실은 compare() 가 이미 잡는다.
    const valueOnly = lost.filter((d) => now.props.has(d.slice(0, d.indexOf(":"))));
    if (valueOnly.length) changes.push(`.${c} — 값 변경 ${valueOnly.length}건 [${valueOnly.slice(0, 4).join(" / ")}]`);
  }
  return changes;
}

if (!existsSync(BASELINE)) {
  console.error("FAIL: 기준선 없음 —");
  console.error("  CSS_LIVE_BASELINE_UPDATE=1 node scripts/check-css-live-classes.mjs --save-baseline");
  process.exit(2);
}

warnIfStale(BASELINE, "css-live-classes");
const base = JSON.parse(readFileSync(BASELINE, "utf8"));
const failures = compare(base);
const changes = valueChanges(base);
const shrink = canonShrink(base);
const s = summarize();

// 정본 축소를 CSS 손실보다 **먼저** 본다. 정본이 붕괴한 상태에서는 compare() 의 결과 자체가
// 무의미하다(잃을 것이 없으므로 언제나 조용하다).
if (shrink.gone.length) {
  console.error(
    `FAIL: 렌더로 증명되던 클래스 ${shrink.gone.length}종이 정본에서 사라졌다 ` +
      `(이전 ${shrink.wasRendered}종 → 현재 ${rendered.size}종) — 게이트의 증거가 줄었다.`
  );
  for (const c of shrink.gone.slice(0, 30)) console.error(`  .${c}`);
  if (shrink.gone.length > 30) console.error(`  … 외 ${shrink.gone.length - 30}종`);
  console.error("");
  console.error("가능한 원인 두 가지:");
  console.error("  1) 표면 축 기준선이 좁아졌다(축 수확이 깨졌거나 kind/포털이 빠졌다) — 표면 게이트를 먼저 보라.");
  console.error(`     현재 정본: ${canonUsed.map((u) => `${u.path.replace(/^test\/fixtures\//, "")}(+${u.added})`).join(", ")}`);
  console.error("  2) UI 가 정말로 그 클래스를 더 이상 그리지 않는다 — 표면 축에서 이미 승인했다면 이 기준선도 갱신하라.");
  process.exit(1);
}

if (failures.length) {
  console.error(`FAIL: 렌더로 증명된 클래스 ${failures.length}종이 CSS 속성을 잃었다`);
  for (const f of failures.slice(0, 30)) console.error(`  ${f}`);
  if (failures.length > 30) console.error(`  … 외 ${failures.length - 30}종`);
  console.error("");
  console.error("중복 제거로 의도한 감소라면: 같은 속성이 다른 시트에 남아 있는지 확인하라(남아 있으면 이 게이트는 통과한다).");
  console.error("정말로 속성을 없애는 변경이면 스크린샷 대조 후 기준선 갱신을 리뷰에 포함하세요.");
  process.exit(1);
}

console.log(
  `CSS 실사용 클래스 게이트 통과: 보호 ${Object.keys(base.live ?? {}).length}종 / 속성 ${s.propTotal} 유지, 미스타일 ${unstyled.length}종`
);
console.log(`  정본 축: ${canonUsed.map((u) => `${u.path.replace(/^test\/fixtures\//, "")}(+${u.added})`).join(", ")}`);
if (changes.length) {
  console.log(`  값 변경 ${changes.length}종 (속성은 유지 — 실패 아님):`);
  for (const line of changes.slice(0, 10)) console.log(`    ${line}`);
  if (changes.length > 10) console.log(`    … 외 ${changes.length - 10}종`);
}
