// DB 모달 select chevron 가드.
//
// `modern-controls.css` 의 기준선은 `appearance: none` 으로 OS 위젯을 지우고 chevron 을
// 순수 CSS(background-image 두 겹)로 다시 그린다. 그래서 두 가지 방식으로 **조용히** 깨진다.
//
//   1. `background:` 단축 — 단축은 background-image 를 initial(none) 로 리셋한다. select 를
//      잡는 규칙이 기준선(0,2,1) 이상 특이성으로 단축을 쓰면 화살표가 사라지고, select 는
//      화살표 없는 밋밋한 사각형이 된다. PR #227 이 이 이유로 20건을 `background-color:` 로
//      바꿨지만, 다음 브랜치가 단축을 다시 쓰면 아무 테스트도 울지 않는다.
//   2. 짧은 `padding` 단축 — chevron 은 패딩 박스 오른쪽 밴드(현재 7~17px)를 쓰고, 텍스트는
//      콘텐츠 박스 오른쪽 끝까지 갈 수 있다. 기준선의 `padding-right: 24px` 는 특이성이
//      낮아 탭별 규칙의 `padding: 0 8px` 류에 지고, 그러면 글자가 화살표를 8~9px 침범한다
//      (Chromium 실측 6개 표면). 기준선을 고쳐도 재발 지점은 탭 규칙 쪽이라 여기서 본다.
//
// 검사 범위는 `src/styles/database/**` — 기준선이 사는 트리이고 PR #227 이 스윕한 범위다.
// `src/styles/map/**` 에는 `background:` 단축이 아직 여러 건 남아 있는데, 그 규칙들은
// 특이성이 기준선보다 낮아(`.db-detail-form select` = (0,1,1) < (0,2,1)) 화살표를 지우지
// 못한다 — 갚아야 할 부채지만 이 가드의 대상은 아니다.
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

/**
 * 주석과 문자열 **내용**을 같은 길이의 공백으로 덮는다. 길이를 보존해야 뒤에서 계산하는
 * 파일:행 번호가 원본과 일치한다. 문자열을 지우는 이유는 `content: "{"` 같은 선언이 중괄호
 * 스캐너를 흔들지 못하게 하는 것(check-css-budget.mjs 가 같은 이유로 같은 일을 한다).
 */
function blankNoise(css: string): string {
  const out = css.split("");
  let index = 0;
  const blankRange = (from: number, to: number): void => {
    for (let i = from; i < to && i < out.length; i += 1) if (out[i] !== "\n") out[i] = " ";
  };
  while (index < css.length) {
    if (css.startsWith("/*", index)) {
      const end = css.indexOf("*/", index + 2);
      const stop = end === -1 ? css.length : end + 2;
      blankRange(index, stop);
      index = stop;
      continue;
    }
    const char = css[index];
    if (char === '"' || char === "'") {
      let cursor = index + 1;
      while (cursor < css.length && css[cursor] !== char) {
        if (css[cursor] === "\\") cursor += 1;
        cursor += 1;
      }
      blankRange(index, Math.min(cursor + 1, css.length));
      index = cursor + 1;
      continue;
    }
    index += 1;
  }
  return out.join("");
}

type Rule = {
  /** 선택자 원문(쉼표 목록 그대로). */
  readonly selector: string;
  /** 선언 블록 원문. */
  readonly body: string;
  /** 파일 안 등장 순서 — 같은 특이성일 때 뒤가 이기므로 캐스케이드 판정에 쓴다. */
  readonly order: number;
  readonly line: number;
};

/** `@media` 등 at-rule 안으로 내려가면서 평범한 규칙만 순서대로 모은다. */
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
          order: sink.length,
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

/** 괄호 깊이를 지켜 쉼표로 나눈다 — `:is(input, select)` 를 두 조각으로 찢지 않는다. */
function splitList(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(buffer.trim());
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer.trim().length > 0) parts.push(buffer.trim());
  return parts;
}

/** 선택자의 **주체**(마지막 복합 선택자)만 떼어 낸다. 스타일이 붙는 요소가 그것이다. */
function subject(selector: string): string {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (depth === 0 && /[\s>+~]/u.test(char)) start = index + 1;
  }
  return selector.slice(start).trim();
}

/** 복합 선택자가 `select` 요소를 가리키는가. `.selected` 류 클래스에 걸리지 않게 분해한다. */
function targetsSelect(compound: string): boolean {
  const functional = [...compound.matchAll(/:(?:is|where|matches|any)\(([^()]*)\)/gu)];
  const bare = compound
    .replace(/:(?:is|where|matches|any)\([^()]*\)/gu, "")
    .replace(/\[[^\]]*\]/gu, "")
    .replace(/::?[\w-]+(?:\([^()]*\))?/gu, "")
    .replace(/[.#][\w-]+/gu, "")
    .trim();
  if (bare === "select") return true;
  return functional.some((match) => splitList(match[1]).some((part) => targetsSelect(subject(part))));
}

const selectSelectors = (rule: Rule): string[] =>
  splitList(rule.selector).filter((selector) => targetsSelect(subject(selector)));

/** 선택자에 등장하는 클래스 전체. 같은 표면을 겨냥했는지 판정하는 근사값으로 쓴다. */
const classesOf = (selector: string): Set<string> =>
  new Set([...selector.matchAll(/\.([\w-]+)/gu)].map((match) => match[1]));

type Specificity = readonly [number, number, number];

/**
 * 선택자 특이성 (id, class, type). 보정 규칙이 원래 규칙을 실제로 이기는지 보려면 모양
 * 비교로는 부족하다 — `:is(input[type="text"], …, select)` 는 인자 중 **가장 높은 것**을
 * 따라 (0,1,1) 을 더하므로, 같아 보이는 `… select` 보정이 조용히 진다(실측으로 겹침 2건이
 * 이 이유로 남아 있었다). `:where()` 는 0, `:is/:not/:has` 는 인자 최대값이다.
 */
function specificity(selector: string): Specificity {
  let ids = 0;
  let classes = 0;
  let types = 0;
  let rest = selector;
  const functional = /:(is|matches|any|not|has|where)\(/u;
  // 함수형 의사클래스를 앞에서부터 하나씩 떼어 내며(중첩 괄호 고려) 재귀 계산한다.
  for (;;) {
    const found = rest.match(functional);
    if (!found || found.index === undefined) break;
    const open = found.index + found[0].length - 1;
    let depth = 0;
    let close = open;
    for (let index = open; index < rest.length; index += 1) {
      if (rest[index] === "(") depth += 1;
      else if (rest[index] === ")") {
        depth -= 1;
        if (depth === 0) {
          close = index;
          break;
        }
      }
    }
    const args = splitList(rest.slice(open + 1, close));
    if (found[1] !== "where") {
      let best: Specificity = [0, 0, 0];
      for (const arg of args) {
        const value = specificity(arg);
        if (value[0] > best[0] || (value[0] === best[0] && (value[1] > best[1] || (value[1] === best[1] && value[2] > best[2])))) {
          best = value;
        }
      }
      ids += best[0];
      classes += best[1];
      types += best[2];
    }
    rest = `${rest.slice(0, found.index)} ${rest.slice(close + 1)}`;
  }
  rest = rest.replace(/::[\w-]+/gu, () => {
    types += 1;
    return " ";
  });
  rest = rest.replace(/#[\w-]+/gu, () => {
    ids += 1;
    return " ";
  });
  rest = rest.replace(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/gu, () => {
    classes += 1;
    return " ";
  });
  for (const token of rest.split(/[\s>+~]+/u)) {
    if (/^[a-zA-Z][\w-]*$/u.test(token.trim())) types += 1;
  }
  return [ids, classes, types];
}

const atLeastAsSpecific = (a: Specificity, b: Specificity): boolean => {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index];
  }
  return true;
};

const declarations = (body: string): Array<{ readonly property: string; readonly value: string }> =>
  body
    .split(";")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.includes(":"))
    .map((chunk) => {
      const colon = chunk.indexOf(":");
      return { property: chunk.slice(0, colon).trim().toLowerCase(), value: chunk.slice(colon + 1).trim() };
    });

/** px 길이만 해석한다. `0` 은 단위가 없어도 0px. 그 밖(var/calc/em)은 "모름". */
function pixels(value: string): number | undefined {
  const trimmed = value.trim();
  if (/^0(?:\.0+)?$/u.test(trimmed)) return 0;
  const match = trimmed.match(/^(-?[\d.]+)px$/u);
  return match ? Number(match[1]) : undefined;
}

/** 규칙이 정하는 **오른쪽 패딩**. 선언이 없으면 undefined, 해석 못 하면 null. */
function rightPadding(body: string): number | undefined | null {
  let result: number | undefined | null;
  for (const { property, value } of declarations(body)) {
    if (property === "padding-right" || property === "padding-inline-end") {
      result = pixels(value) ?? null;
      continue;
    }
    if (property !== "padding" && property !== "padding-inline") continue;
    const parts = value.split(/\s+/u).filter((part) => part.length > 0);
    const right = property === "padding-inline" ? (parts[1] ?? parts[0]) : (parts.length === 1 ? parts[0] : parts[1]);
    result = right === undefined ? null : (pixels(right) ?? null);
  }
  return result;
}

const cssFiles = walk(databaseStyleRoot);
const rulesByFile = new Map<string, Rule[]>(
  cssFiles.map((file) => [file, parseRules(blankNoise(readFileSync(file, "utf8")))]),
);

/**
 * 기준선이 실제로 그리는 chevron 밴드의 오른쪽 끝(px)을 CSS 에서 읽어 낸다. 밴드를 다시
 * 튜닝하면 요구 패딩도 같이 따라오도록 상수를 코드에 박지 않는다.
 */
function chevronBandEnd(): number {
  const rules = rulesByFile.get(baselineFile) ?? [];
  const chevron = rules.find(
    (rule) => selectSelectors(rule).length > 0 && declarations(rule.body).some((decl) => decl.property === "background-image"),
  );
  expect(chevron, "modern-controls.css 에서 chevron 을 그리는 select 규칙을 찾지 못했다").toBeTruthy();
  const decls = declarations(chevron!.body);
  const size = decls.find((decl) => decl.property === "background-size")?.value ?? "";
  const width = pixels(splitList(size)[0]?.split(/\s+/u)[0] ?? "");
  expect(width, `background-size 의 폭을 px 로 읽지 못했다: "${size}"`).toBeTypeOf("number");
  const position = decls.find((decl) => decl.property === "background-position")?.value ?? "";
  const offsets = splitList(position)
    .map((layer) => layer.match(/right\s+([\d.]+px)/u)?.[1])
    .map((offset) => (offset === undefined ? undefined : pixels(offset)))
    .filter((offset): offset is number => typeof offset === "number");
  expect(offsets.length, `background-position 에서 right 오프셋을 읽지 못했다: "${position}"`).toBeGreaterThan(0);
  return Math.max(...offsets) + (width as number);
}

describe("DB 모달 select chevron 가드", () => {
  const bandEnd = chevronBandEnd();

  it("chevron 밴드를 CSS 에서 읽어 낸다 (현재 오른쪽 17px)", () => {
    expect(bandEnd).toBe(17);
  });

  it("기준선의 padding-right 가 chevron 밴드를 덮는다", () => {
    const rules = rulesByFile.get(baselineFile) ?? [];
    const chevron = rules.find(
      (rule) => selectSelectors(rule).length > 0 && declarations(rule.body).some((decl) => decl.property === "background-image"),
    );
    const padding = rightPadding(chevron?.body ?? "");
    expect(
      padding,
      `기준선 select 규칙의 오른쪽 패딩이 ${String(padding)} 이다 — chevron 밴드는 오른쪽 ${bandEnd}px 까지 쓰므로 ` +
      "그보다 좁으면 아무 탭도 안 덮은 select 에서도 글자가 화살표를 침범한다.",
    ).toBeGreaterThanOrEqual(bandEnd);
  });

  it("select 를 잡는 규칙은 `background:` 단축을 쓰지 않는다 (chevron 이 지워진다)", () => {
    const offenders: string[] = [];
    for (const [file, rules] of rulesByFile) {
      for (const rule of rules) {
        if (selectSelectors(rule).length === 0) continue;
        if (!declarations(rule.body).some((decl) => decl.property === "background")) continue;
        offenders.push(
          `${rel(file)}:${rule.line} — ${splitList(rule.selector).join(", ")}\n` +
          "    `background:` 단축은 background-image 를 none 으로 리셋한다. modern-controls.css 의 " +
          "chevron(background-image 두 겹)이 사라져 select 가 화살표 없는 사각형이 된다.\n" +
          "    → 색만 바꿀 의도라면 `background-color:` 를 써라.",
        );
      }
    }
    expect(offenders, `select 규칙에서 \`background:\` 단축 ${offenders.length}건:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("오른쪽 패딩을 chevron 밴드보다 좁게 주는 select 규칙은 select 전용 보정을 동반한다", () => {
    const offenders: string[] = [];
    for (const [file, rules] of rulesByFile) {
      for (const rule of rules) {
        const declared = rightPadding(rule.body);
        if (declared === undefined) continue;
        if (typeof declared === "number" && declared >= bandEnd) continue;
        for (const selector of selectSelectors(rule)) {
          const wanted = classesOf(selector);
          const need = specificity(selector);
          let weaker: string | undefined;
          const repaired = rules.some((candidate) => {
            if (candidate.order <= rule.order) return false;
            const padding = rightPadding(candidate.body);
            if (typeof padding !== "number" || padding < bandEnd) return false;
            return splitList(candidate.selector).some((option) => {
              if (!targetsSelect(subject(option))) return false;
              const classes = classesOf(option);
              if (![...wanted].every((name) => classes.has(name))) return false;
              const have = specificity(option);
              if (atLeastAsSpecific(have, need)) return true;
              weaker =
                `${rel(file)}:${candidate.line} — ${option.trim()} 의 특이성 (${have.join(",")}) 이 ` +
                `(${need.join(",")}) 보다 낮아 캐스케이드에서 진다`;
              return false;
            });
          });
          if (repaired) continue;
          offenders.push(
            `${rel(file)}:${rule.line} — ${selector.trim()} [특이성 ${need.join(",")}]\n` +
            `    오른쪽 패딩이 ${declared === null ? "px 로 해석되지 않는 값" : `${declared}px`} 이다. chevron 은 패딩 박스 ` +
            `오른쪽 ${bandEnd}px 까지를 쓰고 글자는 콘텐츠 박스 끝까지 가므로, 긴 옵션 텍스트가 화살표를 ` +
            `${declared === null ? "" : `${bandEnd - declared}px `}침범한다.\n` +
            (weaker === undefined
              ? "    → 이 규칙 **뒤에** select 전용 보정을 붙여라: `<같은 선택자 앞부분> select { padding-right: 24px; }`"
              : `    → 보정은 있는데 이긴다는 보장이 없다: ${weaker}.\n` +
                "       `:is(input[type=…], select)` 처럼 속성 선택자가 섞인 목록은 특이성이 한 단 올라간다 — " +
                "select 를 선택자 목록으로 빼서 두 갈래가 각자의 특이성을 갖게 하라."),
          );
        }
      }
    }
    expect(
      offenders,
      `chevron 밴드를 글자에 내주는 select 규칙 ${offenders.length}건:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
