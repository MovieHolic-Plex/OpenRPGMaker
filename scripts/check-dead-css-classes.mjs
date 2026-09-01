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
 * 사용법:
 *   node scripts/check-dead-css-classes.mjs            # 검사(실패 시 exit 1)
 *   node scripts/check-dead-css-classes.mjs --report    # 전체 목록만 출력(항상 exit 0)
 *   node scripts/check-dead-css-classes.mjs --write-baseline
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

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

function cssClassSet(text) {
  const set = new Set();
  for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) set.add(m[1]);
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
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ tokens }, null, 2)}\n`);
  console.log(`baseline 기록: ${tokens.length}개 → scripts/dead-css-baseline.json`);
  process.exit(0);
}

if (mode === "report") {
  console.log(`CSS 규칙이 없는 클래스 ${dead.length}건:`);
  for (const d of dead) console.log(`  ${d.token}  ${d.where}`);
  process.exit(0);
}

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
