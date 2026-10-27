/**
 * 맵 상세 칸의 주 버튼은 옅은 인디고 면 위에 흰 글자(--on-accent)를 써서
 * 「맵 설정」과 「+ 새 맵」이 약 1.4:1 로 사라졌다. 같은 패널의 사이드바 주 버튼처럼
 * 옅은 면 + 인디고 글자여야 하고, 키보드 링은 hover 규칙의 outline:none 에 먹히면 안 된다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const panelCss = readFileSync(resolve("src/styles/map/map-panel.modern.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = readFileSync(resolve("src/styles/tokens.css"), "utf8");

type LeafRule = { readonly selector: string; readonly body: string };

function leafRules(css: string): readonly LeafRule[] {
  const rules: LeafRule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) rules.push({ selector: match[1]!, body: match[2]! });
  return rules;
}

function token(name: string): string {
  const found = tokens.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!found) throw new Error(`missing token --${name}`);
  return found[1]!.trim();
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
}

function parseColor(raw: string): { rgb: [number, number, number]; alpha: number } {
  const hex = raw.match(/#([0-9a-fA-F]{6})/);
  if (hex) return { rgb: hexToRgb(`#${hex[1]}`), alpha: 1 };
  const rgba = raw.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?\s*\)/);
  if (!rgba) throw new Error(`cannot parse color: ${raw}`);
  return {
    rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
    alpha: rgba[4] != null ? Number(rgba[4]) : 1,
  };
}

function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return fg.map((channel, index) => Math.round(alpha * channel + (1 - alpha) * bg[index]!)) as [number, number, number];
}

function mix(fg: [number, number, number], bg: [number, number, number], amount: number): [number, number, number] {
  return composite(fg, amount, bg);
}

function lum(rgb: [number, number, number]): number {
  const lin = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const left = lum(a);
  const right = lum(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function restRule(needle: string): LeafRule {
  const rule = leafRules(panelCss).find((item) => {
    const parts = item.selector.split(",").map((part) => part.trim());
    return parts.some((part) => part.endsWith(needle) && !part.includes(":hover") && !part.includes(":focus"));
  });
  if (!rule) throw new Error(`rest rule missing: ${needle}`);
  return rule;
}

describe("map inspector primary labels", () => {
  it("paints 맵 설정 and + 새 맵 in accent ink on a muted wash, not white on lavender", () => {
    for (const needle of [".map-inspector-action.is-primary", ".map-tree-basic-add"]) {
      const rule = restRule(needle);
      expect(rule.body, needle).toMatch(/color:\s*var\(--accent\)/);
      expect(rule.body, needle).toMatch(/background:\s*var\(--accent-muted\)/);
      expect(rule.body, needle).not.toMatch(/--on-accent/);
    }
    const hovers = leafRules(panelCss).filter((rule) =>
      (rule.selector.includes(".map-inspector-action.is-primary") || rule.selector.includes(".map-tree-basic-add"))
      && rule.selector.includes(":hover"));
    expect(hovers.length).toBeGreaterThan(0);
    for (const rule of hovers) {
      expect(rule.body).toMatch(/color:\s*var\(--accent-hover\)/);
      expect(rule.body).not.toMatch(/--on-accent/);
    }
  });

  it("keeps the keyboard ring on map inspector actions", () => {
    const rules = leafRules(panelCss).filter((rule) => rule.selector.includes(".map-inspector-action") || rule.selector.includes(".map-tree-basic-add"));
    const wiped = rules.filter((rule) => rule.selector.includes(":focus-visible") && /outline:\s*none/.test(rule.body));
    expect(wiped).toEqual([]);
    const ring = rules.find((rule) => rule.selector.includes(".map-inspector-action:focus-visible") && /outline:\s*var\(--focus-outline\)/.test(rule.body));
    expect(ring).toBeTruthy();
  });

  it("meets 4.5:1 for the muted rest state and the 22% hover wash", () => {
    const accent = parseColor(token("accent")).rgb;
    const accentHover = parseColor(token("accent-hover")).rgb;
    const onAccent = parseColor(token("on-accent")).rgb;
    const mixBase = parseColor(token("mix-base")).rgb;
    const muted = parseColor(token("accent-muted"));
    const paper = parseColor(token("bg-raised")).rgb;
    const rest = composite(muted.rgb, muted.alpha, paper);
    const hover = mix(accent, mixBase, 0.22);
    expect(ratio(accent, rest)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(accentHover, hover)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(onAccent, hover)).toBeLessThan(3);
  });
});
