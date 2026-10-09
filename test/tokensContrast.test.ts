import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace("#", "").trim();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function parseColor(raw: string): { rgb: [number, number, number]; alpha: number } | null {
  raw = raw.trim();
  const hexM = raw.match(/^#([0-9a-fA-F]{3,8})\b/);
  if (hexM) return { rgb: hexToRgb(hexM[0]), alpha: 1 };
  const rgbaM = raw.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+))?\s*\)/);
  if (rgbaM) {
    return { rgb: [Number(rgbaM[1]), Number(rgbaM[2]), Number(rgbaM[3])], alpha: rgbaM[4] != null ? Number(rgbaM[4]) : 1 };
  }
  return null;
}
function composite(fg: [number, number, number], alpha: number, bg: [number, number, number]): [number, number, number] {
  return fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i])) as [number, number, number];
}
function srgbToLin(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function lum(rgb: [number, number, number]): number {
  return 0.2126 * srgbToLin(rgb[0]) + 0.7152 * srgbToLin(rgb[1]) + 0.0722 * srgbToLin(rgb[2]);
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
function extractTokens(css: string): Map<string, string> {
  const m = new Map<string, string>();
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let g: RegExpExecArray | null;
  while ((g = re.exec(css))) m.set(g[1], g[2].trim());
  return m;
}
function resolveColor(tokenVal: string, tokens: Map<string, string>): { rgb: [number, number, number]; alpha: number } | null {
  // handle var(--accent) etc - not needed for these tokens (literal)
  const c = parseColor(tokenVal);
  if (c) return c;
  return null;
}

describe("tokensContrast (cream SSOT)", () => {
  const cssPath = path.resolve("src/styles/tokens.css");
  const css = fs.readFileSync(cssPath, "utf8");
  const tokens = extractTokens(css);

  function getRgb(name: string, ground?: [number, number, number]): [number, number, number] {
    const raw = tokens.get(name);
    if (!raw) throw new Error(`missing token --${name}`);
    const parsed = resolveColor(raw, tokens);
    if (!parsed) throw new Error(`cannot parse --${name}: ${raw}`);
    if (parsed.alpha >= 1 || !ground) return parsed.rgb;
    return composite(parsed.rgb, parsed.alpha, ground);
  }
  function getGround(name: string): [number, number, number] {
    const raw = tokens.get(name);
    if (!raw) throw new Error(`missing ground --${name}`);
    const p = parseColor(raw);
    if (!p) throw new Error(`cannot parse ground --${name}: ${raw}`);
    if (p.alpha < 1) return composite(p.rgb, p.alpha, [255, 255, 255]);
    return p.rgb;
  }

  const bgNames = ["bg-base", "bg-surface", "bg-raised", "bg-inset", "bg-overlay"] as const;
  const textNames = ["text-1", "text-2", "text-3", "text-placeholder"] as const;

  for (const tName of textNames) {
    for (const bgName of bgNames) {
      it(`${tName} vs ${bgName} >= 4.5`, () => {
        const bg = getGround(bgName);
        const fg = getRgb(tName, bg);
        const r = ratio(fg, bg);
        expect(r, `${tName} (${tokens.get(tName)}) vs ${bgName} (${tokens.get(bgName)}) ratio ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("on-accent vs accent >= 4.5", () => {
    const accentRaw = tokens.get("accent")!;
    const onAccentRaw = tokens.get("on-accent")!;
    const accent = parseColor(accentRaw)!.rgb;
    const onAccent = parseColor(onAccentRaw)!.rgb;
    const r = ratio(onAccent, accent);
    expect(r, `on-accent vs accent ratio ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });

  for (const s of ["danger", "success", "warning"] as const) {
    it(`${s} vs bg-surface >= 4.5`, () => {
      const bg = getGround("bg-surface");
      const fg = getRgb(s, bg);
      const r = ratio(fg, bg);
      expect(r, `${s} vs bg-surface ratio ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const border of ["border-default", "border-strong"] as const) {
    for (const bg of ["bg-base", "bg-surface"] as const) {
      it(`composited ${border} vs ${bg} >= 1.3 delta and strong >=3`, () => {
        const bgRgb = getGround(bg);
        const fg = getRgb(border, bgRgb);
        const r = ratio(fg, bgRgb);
        expect(r, `${border} vs ${bg} ratio ${r.toFixed(2)}`).toBeGreaterThanOrEqual(1.3);
        if (border === "border-strong") {
          expect(r, `border-strong vs ${bg} must be >=3 (WCAG 1.4.11)`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});
