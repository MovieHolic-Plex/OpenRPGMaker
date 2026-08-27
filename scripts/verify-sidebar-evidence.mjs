#!/usr/bin/env node
/**
 * 좌측 사이드바 수리 증거 판정기 — before/after 프로브 JSON 을 읽어 기준마다 PASS/FAIL 을 낸다.
 *
 * 왜 스크립트인가: 사람이 JSON 두 개를 눈으로 비교하면 "조수 카드가 1px 움직였다"를 놓친다.
 * 감독의 하드 제약(조수 위치 불변)은 눈이 아니라 등호로 지켜야 한다.
 *
 * 사용: node scripts/verify-sidebar-evidence.mjs [--dir .omo/evidence/left-sidebar-repair] [--mode standard]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv;
const pick = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const DIR = pick("dir", ".omo/evidence/left-sidebar-repair");
const MODE = pick("mode", "standard");

const load = (tag, kind) => {
  const file = join(DIR, `${tag}-${MODE}-${kind}.json`);
  if (!existsSync(file)) return { missing: file };
  return JSON.parse(readFileSync(file, "utf8"));
};

const before = load("before", "contract");
const after = load("after", "contract");
const beforeFeat = load("before", "overflow-features");
const afterFeat = load("after", "overflow-features");

const results = [];
const check = (id, label, pass, detail) => results.push({ id, label, pass, detail });

if (before.missing || after.missing) {
  console.error(`프로브 JSON 이 없다: ${before.missing ?? ""} ${after.missing ?? ""}`);
  process.exit(2);
}

/* C5 먼저 — 감독의 하드 제약. 실패하면 나머지 통과는 의미가 없다. */
const sameRect = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check(
  "C5",
  "조수 카드 위치·크기 불변",
  sameRect(before.geometry.aiPanel, after.geometry.aiPanel),
  `before=${JSON.stringify(before.geometry.aiPanel)} after=${JSON.stringify(after.geometry.aiPanel)}`,
);
check(
  "C5b",
  "좌패널 기하 불변",
  sameRect(before.geometry.leftPanel, after.geometry.leftPanel),
  `before=${JSON.stringify(before.geometry.leftPanel)} after=${JSON.stringify(after.geometry.leftPanel)}`,
);
check(
  "C5c",
  "캔버스 기하 불변",
  sameRect(before.geometry.canvas, after.geometry.canvas),
  `before=${JSON.stringify(before.geometry.canvas)} after=${JSON.stringify(after.geometry.canvas)}`,
);

/* C1 ⋯ 도달성 */
check("C1a", "⋯ 트리거가 좌패널 안에 있다", after.overflow.triggerInsideLeftPanel === true, `before=${before.overflow.triggerInsideLeftPanel} after=${after.overflow.triggerInsideLeftPanel} rect=${JSON.stringify(after.overflow.triggerRect)}`);
check("C1b", "드롭다운 중심 히트테스트가 메뉴 안이다", String(after.overflow.hitTestAtDropdownCenter).includes("insideDropdown=true"), `before=${before.overflow.hitTestAtDropdownCenter} after=${after.overflow.hitTestAtDropdownCenter}`);
check("C1c", "드롭다운이 화면 안에 있다", after.overflow.dropdownOnScreen === true, `rect=${JSON.stringify(after.overflow.dropdownRect)}`);

/* C2 포커스 생존 + 화살표 */
check("C2a", "Enter 활성화 후 같은 버튼이 포커스를 유지한다", after.focus.afterEnterFocus === "BUTTON[tool-fill]", `before=${before.focus.afterEnterFocus} after=${after.focus.afterEnterFocus}`);
check("C2b", "ArrowRight 가 다음 버튼으로 포커스를 옮긴다", after.focus.afterArrowRight !== "BUTTON[tool-select]" && String(after.focus.afterArrowRight).startsWith("BUTTON["), `before=${before.focus.afterArrowRight} after=${after.focus.afterArrowRight}`);
check("C2c", "Home 이 첫 버튼으로 간다", String(after.focus.afterHome).startsWith("BUTTON[") && after.focus.afterHome !== after.focus.afterArrowRight, `before=${before.focus.afterHome} after=${after.focus.afterHome}`);
check("C2d", "도구막대가 탭 스톱 1개다", after.focus.tabStopsInToolbar === 1, `before=${before.focus.tabStopsInToolbar} after=${after.focus.tabStopsInToolbar}`);

/* C3 닫기 계약 */
check("C3a", "Escape 로 닫힌다", after.overflow.afterEscapeOpen === false, `before=${before.overflow.afterEscapeOpen} after=${after.overflow.afterEscapeOpen}`);
check("C3b", "Escape 후 포커스가 트리거로 돌아온다", after.overflow.afterEscapeFocus === "BUTTON[oprn-tool-overflow]", `before=${before.overflow.afterEscapeFocus} after=${after.overflow.afterEscapeFocus}`);

/* C4 커서 + 레이어 패리티 */
const cursorValues = Object.values(after.cursors ?? {}).map((v) => String(v).split("=>")[1] ?? "");
const distinct = new Set(cursorValues).size === cursorValues.length;
const noDefault = !cursorValues.includes("default");
const noFail = !Object.values(after.cursors ?? {}).some((v) => String(v).includes("APPLY-FAILED"));
check("C4a", "도구 8종 커서가 모두 다르다", distinct && cursorValues.length === 8, `values=${cursorValues.map((c) => c.slice(0, 28)).join(" | ")}`);
check("C4b", "default 로 떨어지는 도구가 없다", noDefault, `default 포함=${!noDefault}`);
check("C4c", "도구 적용 실패가 없다", noFail, "APPLY-FAILED 없음");
check("C4d", "장면 놓기가 레이어를 이벤트로 바꾼다", after.parity.layerBeforeEventTool === "바닥" && after.parity.layerAfterEventToolClick === "이벤트", `before=${before.parity.layerBeforeEventTool}->${before.parity.layerAfterEventToolClick} after=${after.parity.layerBeforeEventTool}->${after.parity.layerAfterEventToolClick}`);

/* C1d 갇혀 있던 기능 9개가 사람 손으로 닿는가 */
if (!afterFeat.missing) {
  const entries = Object.entries(afterFeat.features).filter(([k]) => k !== "⋯ 열림");
  const blocked = entries.filter(([, v]) => v !== "reachable");
  const beforeBlocked = beforeFeat.missing ? "?" : Object.entries(beforeFeat.features).filter(([k, v]) => k !== "⋯ 열림" && v !== "reachable").length;
  check("C1d", "갇힌 기능 9개가 전부 히트테스트로 도달된다", blocked.length === 0, `before차단=${beforeBlocked}/9 after차단=${blocked.length}/9 ${blocked.map(([k, v]) => `${k}:${v}`).join(", ")}`);
} else {
  check("C1d", "갇힌 기능 9개 도달성", false, `after 기능 프로브 없음: ${afterFeat.missing}`);
}

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id.padEnd(4)} ${r.label}\n        ${r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} PASS (mode=${MODE})`);
if (failed.length) {
  console.error(`\nFAILED: ${failed.map((r) => r.id).join(", ")}`);
  process.exit(1);
}
