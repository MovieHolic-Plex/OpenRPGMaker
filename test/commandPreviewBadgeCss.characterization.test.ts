// 명령 미리보기 배지 — 현재 동작 특성화 테스트.
//
// 이전 판(수정 전)은 "배지가 전경/배경 같은 색으로 숨겨져 있다"를 기록했다. 배지 대비를
// 고쳤으므로(02-changeface-play-mock-larger.css) 관측값이 바뀌었고, 파일 머리말의 지침대로
// 특성화를 지우지 않고 새 실측(전경 ≠ 배경)으로 갱신했다.
//
// 대조: commandPreviewBadgeCss.contract.test.ts 는 배지 네 개의 계약을 단언한다. 이 파일은
// 램프까지 포함해 여섯 셀렉터가 실제로 배경과 다른 전경색을 갖는지 토큰 해석까지 거쳐 기록한다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const BADGE_CSS_PATH = "src/styles/editor/event-editor.command-preview/02-changeface-play-mock-larger.css";
const TOKENS_CSS_PATH = "src/styles/tokens.css";

/** 전경 ≠ 배경 으로 관측되는(즉 보이는) 배지/램프 셀렉터. */
const OBSERVED_VISIBLE_BADGES = [
  ".ecp-battle-badge",
  ".ecp-exp-badge",
  ".ecp-gold-badge",
  ".ecp-skill-badge",
  ".ecp-lamp.on",
  ".ecp-lamp.off",
] as const;

function readCss(path: string): string {
  return readFileSync(path, "utf8");
}

function tokenTable(css: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function ruleBlocks(css: string): { selectors: string[]; body: string }[] {
  const out: { selectors: string[]; body: string }[] = [];
  const regex = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css))) {
    const selectors = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    if (selectors.length > 0) out.push({ selectors, body: match[2] });
  }
  return out;
}

function declarationsFor(selector: string, css: string): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const block of ruleBlocks(css)) {
    if (!block.selectors.includes(selector)) continue;
    for (const decl of block.body.split(";")) {
      const colon = decl.indexOf(":");
      if (colon <= 0) continue;
      const prop = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim();
      if (prop && value) merged[prop] = value;
    }
  }
  return merged;
}

function resolveValue(value: string, tokens: Record<string, string>): string {
  return value.replace(/var\(--([a-zA-Z0-9-]+)(?:,\s*([^)]*))?\)/g, (raw, name, fallback) => {
    return tokens[name] ?? (fallback !== undefined ? fallback.trim() : raw);
  });
}

function backgroundBaseColors(background: string, tokens: Record<string, string>): string[] {
  const resolved = resolveValue(background, tokens);
  const stops = collectGradientStops(resolved);
  if (stops.length > 0) return stops;
  return [resolved];
}

function collectGradientStops(resolved: string): string[] {
  const match = /(?:radial|linear|conic)-gradient\(([\s\S]*)\)/.exec(resolved);
  if (!match) return [];
  const inner = match[1];
  const parts = splitTopLevelCommas(inner);
  const colorish = parts.filter((part) => /(?:#|rgb|hsl|var\()/i.test(part));
  return colorish.map((part) => stripColorHint(part.trim()));
}

function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

function stripColorHint(part: string): string {
  return part.replace(/\s+\d+(?:\.\d+)?(?:px|%|deg|turn|rad|grad)?\s*$/, "").trim();
}

describe("command preview badge — current visible-badge trace", () => {
  const badgeCss = readCss(BADGE_CSS_PATH);
  const tokens = tokenTable(readCss(TOKENS_CSS_PATH));

  for (const selector of OBSERVED_VISIBLE_BADGES) {
    it(`기록: ${selector} 는 현재 전경 ≠ 배경 기준 색이다 (대비 확보)`, () => {
      const decls = declarationsFor(selector, badgeCss);
      const color = resolveValue(decls["color"] ?? "", tokens);
      const backgrounds = backgroundBaseColors(decls["background"] ?? "", tokens);

      // 현재 코드 관측값: 배지 전경색이 어느 배경 기준색과도 같지 않다. 다시 같아지면
      // 배지가 배경에 묻히므로 이 특성화가 깨져서 회귀를 알린다.
      expect(color, `${selector} color 토큰이 있어야 한다`).toBeTruthy();
      expect(backgrounds.length, `${selector} 배경 기준 색이 있어야 한다`).toBeGreaterThan(0);
      expect(
        backgrounds.some((bg) => bg === color),
        `${selector}: 전경 ${color} 가 배경(${backgrounds.join(" / ")})과 같아 배지가 묻힌다`
      ).toBe(false);
    });
  }
});
