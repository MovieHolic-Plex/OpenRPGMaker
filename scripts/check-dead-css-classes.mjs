#!/usr/bin/env node
/**
 * TS 가 발행하는 클래스 이름 ↔ CSS 선택자 교차검증 게이트.
 *
 * 왜 필요한가 — 이 저장소의 편집기 UI 는 CSS 를 12+ 레이어로 손조립하고 있어서, TS 에서
 * 클래스를 붙였지만 대응 규칙이 **아예 없는** 경우가 반복해서 나온다. 그러면 컨트롤이
 * 브라우저 UA 기본 스타일로 렌더되는데, 타입체커도 린터도 테스트도 이걸 잡지 못한다.
 *
 * 실제 사례(2026-09 파티 그룹 감사):
 *  - `.db-view-toggle` : 갤러리/목록 전환 버튼. CSS 규칙 0건 → Arial 13.33px + 2px outset
 *    베벨로 렌더되고 `.active` 도 무효라 **어느 뷰가 켜졌는지 눈으로 알 수 없었다.**
 *  - `.db-class-curve-graph` : 능력치 곡선 막대 컨테이너. `height` 외 규칙 0건 →
 *    막대가 인라인·무배경으로 렌더돼 **한 번도 보인 적이 없었다.**
 *
 * 래칫 방식이다: 현재 남아 있는 죽은 클래스는 베이스라인에 기록해 통과시키고,
 * **새로 생기는 것만** 실패시킨다. 베이스라인을 줄이는 건 별도 작업으로 한다.
 *
 * ── 2026-09-17 실측: "규칙 0건" 이 곧 "화면이 깨짐"은 아니다 ──────────────────────
 * 이 게이트가 지목한 37건을 브라우저에서 하나씩 재 봤다. 조상·후손 선택자가 스타일을
 * 주는 경우가 많아서, 클래스 목록만으로는 피해를 알 수 없다. 실제로 깨진 건 2건뿐이었다:
 *
 *  - `.db-overview-canon` / `.db-overview-codex` — 개요 탭 pulse 카드 7장 중 이 둘만
 *    `<button>` 이다. `.db-overview-pulse-card` 가 font-family 를 안 줬고 폰트는 폼
 *    컨트롤로 상속되지 않으므로, 같은 그리드에서 이 둘만 Arial 13.3333px · 가운데 정렬로
 *    렌더됐다(나머지 5장은 system-ui 14px · 좌측). 고쳤다 — overview-dashboard.css.
 *
 * 나머지는 "요소는 스타일되는데 수식어 클래스만 규칙이 없는" 경우다. 가장 큰 덩어리인
 * `.db-ws-btn-ghost`(18파일 42회)는 항상 `.db-ws-btn` 과 같이 쓰이고 그 기본 규칙이
 * 살아 있어서 system-ui 12.5px 로 정상 렌더된다 — 즉 **ghost 변형이 구현되지 않은 것**이지
 * 깨진 게 아니다. 구현(리포에 `is-ghost`·`.btn.ghost` 선례가 있다)과 제거 중 무엇을 할지는
 * 버튼 42개의 외형을 바꾸는 제품 판단이라 여기서 임의로 정하지 않고 유예에 남겼다.
 *
 * 사용법:
 *   node scripts/check-dead-css-classes.mjs            # 검사(실패 시 exit 1)
 *   node scripts/check-dead-css-classes.mjs --report    # 전체 목록만 출력(항상 exit 0)
 *   node scripts/check-dead-css-classes.mjs --write-baseline
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
// 주석 제거는 scripts/lib/css-import-re.mjs 하나만 쓴다(문자열 내용은 보존하는 스캐너).
import { stripCssComments } from "./lib/css-import-re.mjs";
import { warnIfStale } from "./lib/baseline-age.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const BASELINE_PATH = join(ROOT, "scripts", "dead-css-baseline.json");

/** 이 접두어를 가진 클래스만 본다 — 서드파티·유틸 클래스까지 보면 소음이 이긴다. */
const PREFIXES = ["db-", "actor-", "oprn-"];

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const interesting = (token) => PREFIXES.some((p) => token.startsWith(p));

/**
 * TS 소스에서 클래스로 쓰인 토큰을 뽑는다.
 *
 * 템플릿 리터럴이 까다롭다 — `class: \`db-row${sel ? " active" : ""}\`` 처럼 보간 안에
 * 따옴표가 들어가면 "따옴표까지 캡처" 방식은 중간에서 끊겨 `db-row${sel` 같은 쓰레기
 * 토큰을 만든다. 그래서 백틱은 백틱까지(줄바꿈 포함) 따로 캡처하고, 보간을 **구분자**로
 * 치환한 뒤 토큰을 쪼갠다. 보간에 붙어 있던 조각(`db-row` + 뒤쪽)은 접두어만 남으므로
 * 끝이 `-` 인 불완전 토큰은 버린다.
 */
function classTokensFromTs(text) {
  const found = new Map(); // token -> first line
  const offsetToLine = (offset) => text.slice(0, offset).split("\n").length;
  const collect = (raw, offset) => {
    const cleaned = raw.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, " ");
    for (const token of cleaned.split(/\s+/)) {
      if (!token || !interesting(token)) continue;
      if (token.endsWith("-")) continue; // 보간 앞 조각 — 완전한 클래스 이름이 아니다
      if (/[${}`"'()?:]/.test(token)) continue; // 파싱 잔여물
      if (!found.has(token)) found.set(token, offsetToLine(offset));
    }
  };

  for (const m of text.matchAll(/(?:class:|className\s*=)\s*`([\s\S]*?)`/g)) collect(m[1], m.index);
  for (const m of text.matchAll(/(?:class:|className\s*=)\s*"([^"\n]*)"/g)) collect(m[1], m.index);
  for (const m of text.matchAll(/(?:class:|className\s*=)\s*'([^'\n]*)'/g)) collect(m[1], m.index);
  for (const m of text.matchAll(/classList\.(?:add|remove|toggle)\(\s*["'`]([^"'`\n]*)["'`]/g)) collect(m[1], m.index);
  for (const m of text.matchAll(/\bclass="([^"\n]*)"/g)) collect(m[1], m.index);
  return found;
}

// 주석을 먼저 지운다. 안 지우면 주석 안에 이름만 적힌 클래스가 "규칙이 있다"로 집계돼서
// TS 가 붙이는 죽은 클래스를 가려 준다 — 게이트의 초록이 허위가 되는 경로다.
// (2026-09-17 실측: 주석에만 등장하는 `.xxx` 토큰 82종.)
function cssClassSet(text) {
  const set = new Set();
  for (const m of stripCssComments(text).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) set.add(m[1]);
  return set;
}

const files = await walk(join(ROOT, "src"));
const cssClasses = new Set();
for (const file of files) {
  if (extname(file) !== ".css") continue;
  for (const cls of cssClassSet(readFileSync(file, "utf8"))) cssClasses.add(cls);
}

const dead = [];
for (const file of files) {
  if (!/\.tsx?$/.test(file)) continue;
  for (const [token, line] of classTokensFromTs(readFileSync(file, "utf8"))) {
    if (cssClasses.has(token)) continue;
    dead.push({ token, where: `${file.replace(ROOT, "")}:${line}` });
  }
}
dead.sort((a, b) => a.token.localeCompare(b.token) || a.where.localeCompare(b.where));

const mode = process.argv.includes("--write-baseline")
  ? "write"
  : process.argv.includes("--report")
    ? "report"
    : "check";

if (mode === "write") {
  const tokens = [...new Set(dead.map((d) => d.token))].sort();
  // generatedAt 을 같이 적는다 — 이게 없으면 유예 목록이 몇 달 낡아도 아무도 모른다.
  const doc = { generatedAt: new Date().toISOString(), tokens };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`baseline 기록: ${tokens.length}개 → scripts/dead-css-baseline.json`);
  process.exit(0);
}

if (mode === "report") {
  console.log(`CSS 규칙이 없는 클래스 ${dead.length}건:`);
  for (const d of dead) console.log(`  ${d.token}  ${d.where}`);
  process.exit(0);
}

warnIfStale(BASELINE_PATH, "dead-css");
const baseline = existsSync(BASELINE_PATH)
  ? new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).tokens)
  : new Set();
const added = dead.filter((d) => !baseline.has(d.token));

if (added.length > 0) {
  console.error(`죽은 CSS 클래스가 새로 ${added.length}건 생겼다 — TS 가 붙이지만 대응 규칙이 없다:`);
  for (const d of added) console.error(`  .${d.token}   ${d.where}`);
  console.error("\n규칙을 추가하거나, 정말 스타일이 불필요하면 --write-baseline 으로 근거를 남겨라.");
  process.exit(1);
}

console.log(`죽은 CSS 클래스 신규 0건 (베이스라인 ${baseline.size}건 유지).`);
