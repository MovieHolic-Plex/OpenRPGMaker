// DB 모달 radio 커스텀 가드.
//
// `modern-controls.css` 의 기준선이 DB 모달 안 네이티브 radio 외형을 스튜디오 토큰으로
// 다시 그린다(appearance:none + 커스텀 원). 이 가드는 회귀 두 가지를 기계로 고정한다.
//
//   1. 커스텀 블록이 사라지면 DB radio 가 전부 OS 기본 회색 원으로 되돌아간다.
//      기준선 규칙(input[type="radio"])이 파일에 실제로 있는지 본다.
//   2. 탭별 규칙이 radio 를 직접 잡으면 기준선 위에 겹쳐 칠해진다. 직접 규칙은
//      기준선 파일의 커스텀 블록과 세그먼트 필 예외만 허용한다. bare `input` 을
//      품은 :is() 결합도 radio 를 함께 칠하므로 `:not([type="radio"])` 제외가
//      없으면 잡는다(라벨 래퍼 :has() 와 :not() 제외 자체는 오탐이라 걷어낸다).
//   3. 커스텀에 하드코딩 색이 섞이면 토큰 교체(다크 모드 등)가 radio 만 놓친다.
//      radio 규칙 선언에 hex/rgba 리터럴이 없는지 본다.
//
// 검사 범위는 select chevron 가드와 같은 `src/styles/database/**`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");
const databaseStyleRoot = join(repoRoot, "src", "styles", "database");
const baselineFile = join(databaseStyleRoot, "modern-controls.css");

const rel = (file: string): string => relative(repoRoot, file).split("\\").join("/");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".css")) out.push(full);
  }
  return out;
}

/** 주석을 공백으로 덮는다 — 길이를 보존해 파일:행 번호가 원본과 일치한다. */
function blankComments(css: string): string {
  const out = css.split("");
  let index = 0;
  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let i = index; i < stop && i < out.length; i += 1) if (out[i] !== "\n") out[i] = " ";
      index = stop;
      continue;
    }
    index += 1;
  }
  return out.join("");
}

type Rule = { readonly selector: string; readonly body: string; readonly line: number };

function parseRules(css: string, from = 0, to = css.length, sink: Rule[] = []): Rule[] {
  let index = from;
  let preludeStart = from;
  while (index < to) {
    const char = css[index];
    if (char === "{") {
      const prelude = css.slice(preludeStart, index).trim();
      let depth = 1;
      let cursor = index + 1;
      while (cursor < to && depth > 0) {
        if (css[cursor] === "{") depth += 1;
        else if (css[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      if (prelude.startsWith("@")) parseRules(css, index + 1, cursor - 1, sink);
      else if (prelude.length > 0) {
        sink.push({
          selector: prelude,
          body: css.slice(index + 1, cursor - 1),
          line: css.slice(0, preludeStart).split("\n").length,
        });
      }
      index = cursor;
      preludeStart = cursor;
      continue;
    }
    if (char === ";") preludeStart = index + 1;
    index += 1;
  }
  return sink;
}

const BASELINE_RELPATH = "src/styles/database/modern-controls.css";

/** 기준선·세그먼트 예외가 아닌 직접 radio 규칙인가. */
function isForeignRadioRule(file: string, selector: string): boolean {
  if (rel(file) === BASELINE_RELPATH) return false;
  if (!/input\[type="radio"\]/.test(selector)) return false;
  if (selector.includes(".db-segmented-pill")) return false;
  return true;
}

/** bare `input` 을 인자로 품은 :is()/:where() — radio 제외 없이 radio 까지 칠한다.
 * arg 자체에 :not([type="radio"]) 제외가 붙은 인자는 제외로 본다. */
function hasBareInputUnion(selector: string): boolean {
  const pruned = stripFunctional(selector, ["has"]);
  for (const match of pruned.matchAll(/:(?:is|where|matches|any)\(([^()]*)\)/gu)) {
    const args = match[1].split(",").map((part) => part.trim());
    for (const part of args) {
      if (!/^(?:[\w-]+\s+)*input(?::[\w-]+(?:\([^()]*\))?)*$/.test(part)) continue;
      const exclusions = [...part.matchAll(/:not\(([^()]*)\)/gu)].map((entry) => entry[1]);
      if (exclusions.some((entry) => /type\s*=\s*["']?radio["']?/.test(entry))) continue;
      return true;
    }
  }
  return false;
}

/** radio 가 들어갈 수 없는 스코프 — DOM 실측으로 radio/segmentedControl 없음.
 * (스킬 상세 min-height, 시스템/용어·공통이벤트·애니메이션 구형 스킨, parity 폼) */
function isKnownRadioFreeScope(selector: string): boolean {
  return (
    selector.includes(".oprn-detail-skills") ||
    selector.includes(".db-system-form") ||
    selector.includes(".db-terms-form") ||
    selector.includes(".db-common-event-editor") ||
    selector.includes(".db-animation-panel") ||
    selector.includes(".db-parity-form")
  );
}

/** radio 원 외형을 실제로 덧칠하는 선언인가 — 레이아웃(box-sizing/width)만은 제외. */
function paintsRadioChrome(body: string): boolean {
  const props = body
    .split(";")
    .map((chunk) => chunk.slice(0, chunk.indexOf(":")).trim().toLowerCase())
    .filter((prop) => prop.length > 0 && prop !== "content");
  const painters = new Set([
    "background", "background-color", "background-image",
    "border", "border-color", "border-style", "border-width", "border-radius",
    "box-shadow", "outline", "accent-color", "appearance",
    "height", "min-height", "padding", "font", "color",
  ]);
  return props.some((prop) => painters.has(prop));
}
/** 함수형 의사클래스(:not/:has 등) 블록을 걷어낸다 — 제외와 라벨 래퍼는 radio 자체를 칠하지 않으므로. */
function stripFunctional(selector: string, names: readonly string[]): string {
  let out = selector;
  for (;;) {
    const found = out.match(new RegExp(`:(${names.join("|")})\\(`, "u"));
    if (!found || found.index === undefined) break;
    const open = found.index + found[0].length - 1;
    let depth = 0;
    let close = open;
    for (let i = open; i < out.length; i += 1) {
      if (out[i] === "(") depth += 1;
      else if (out[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    out = `${out.slice(0, found.index)} ${out.slice(close + 1)}`;
  }
  return out;
}

/** 선언 블록에 하드코딩 색 리터럴이 있는가. */
function hasHardcodedColor(body: string): boolean {
  const stripped = body.replace(/var\([^()]*\)/gu, "var()");
  return /#[0-9a-fA-F]{3,8}\b/.test(stripped) || /\brgba?\s*\(/.test(stripped);
}

const baseline = blankComments(readFileSync(baselineFile, "utf-8"));
const baselineRules = parseRules(baseline);

describe("database radio custom guard", () => {
  it("기준선이 DB radio 커스텀 원 규칙을 가진다", () => {
    const radioRules = baselineRules.filter((rule) =>
      /(^|[\s>+~])input\[type="radio"\]/.test(rule.selector),
    );
    expect(
      radioRules.map((rule) => `${rel(baselineFile)}:${rule.line} ${rule.selector}`),
      "modern-controls.css 에 input[type=\"radio\"] 기준선 규칙이 있어야 한다",
    ).not.toHaveLength(0);
    const bodies = radioRules.map((rule) => rule.body).join("\n");
    expect(bodies, "커스텀 원은 appearance:none 이어야 한다").toMatch(/appearance\s*:\s*none/);
    expect(bodies, "선택 점은 스튜디오 accent 토큰이어야 한다").toMatch(/--db-studio-accent/);
  });

  it("기준선 밖의 직접 radio 규칙이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(databaseStyleRoot)) {
      const css = blankComments(readFileSync(file, "utf-8"));
      for (const rule of parseRules(css)) {
        if (isForeignRadioRule(file, rule.selector)) offenders.push(`${rel(file)}:${rule.line} ${rule.selector}`);
      }
    }
    expect(offenders, "탭별 직접 규칙이 커스텀 원 위에 겹쳐 칠해진다").toEqual([]);
  });

  it("radio 제외 없는 bare input 결합이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(databaseStyleRoot)) {
      if (rel(file) === BASELINE_RELPATH) continue;
      const css = blankComments(readFileSync(file, "utf-8"));
      for (const rule of parseRules(css)) {
        if (!rule.selector.includes(".database-modal-")) continue;
        // 시스템 스튜디오는 !important 스킨이라 커스텀을 의도적으로 덮는다 — 별도 소유.
        if (rule.selector.includes(".db-system-studio")) continue;
        // 세그먼트 필 안의 작은 네이티브 radio 는 기준선의 의도적 예외다.
        if (rule.selector.includes(".db-segmented-pill")) continue;
        if (isKnownRadioFreeScope(rule.selector)) continue;
        if (!hasBareInputUnion(rule.selector)) continue;
        if (!paintsRadioChrome(rule.body)) continue;
        offenders.push(`${rel(file)}:${rule.line} ${rule.selector}`);
      }
    }
    expect(offenders, "bare input 결합이 radio 까지 함께 칠한다").toEqual([]);
  });

  it("radio 규칙에 하드코딩 색이 없다", () => {
    const offenders: string[] = [];
    for (const file of walk(databaseStyleRoot)) {
      const css = blankComments(readFileSync(file, "utf-8"));
      for (const rule of parseRules(css)) {
        if (!/input\[type="radio"\]/.test(rule.selector)) continue;
        if (rule.selector.includes(".db-segmented-pill")) continue;
        if (hasHardcodedColor(rule.body)) offenders.push(`${rel(file)}:${rule.line} ${rule.selector}`);
      }
    }
    expect(offenders, "radio 색은 --db-studio-* 토큰만 써야 한다").toEqual([]);
  });
});
