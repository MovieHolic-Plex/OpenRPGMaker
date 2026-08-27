import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeSvgIcon, SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { installFakeDom } from "./fakeDom";
import * as fs from "node:fs";
import * as path from "node:path";

const REQUIRED_REGION_TASK_ICONS: readonly SvgIconName[] = [
  "terrain",
  "structure",
  "polish",
  "npc",
  "chest",
  "combat",
  "mood",
  "composite",
  "pin",
  "save",
  "warning",
  "door",
  "sign",
  "shop",
];

describe("region task icons", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("SVG_ICON_NAMES contains all 14 new region-task icons", () => {
    for (const name of REQUIRED_REGION_TASK_ICONS) {
      expect(SVG_ICON_NAMES).toContain(name);
    }
  });

  it("every icon in SVG_ICON_NAMES produces a valid svg with currentColor stroke, none fill, and child elements", () => {
    for (const name of SVG_ICON_NAMES) {
      const svg = makeSvgIcon(name);
      expect(svg).toBeDefined();
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("fill")).toBe("none");
      expect(svg.childNodes.length).toBeGreaterThan(0);
    }
  });

  it("no icon spec attribute value in tileToolbarIcons matches color literals (hex, rgb, hsl)", () => {
    const filePath = path.resolve(__dirname, "../src/editor/panels/tileToolbarIcons.ts");
    const source = fs.readFileSync(filePath, "utf-8");

    // Match hex colors (#fff, #123456), rgb(...), hsl(...)
    const colorLiteralRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]*\)|hsl\([^)]*\)/g;
    const matches = source.match(colorLiteralRegex);
    expect(matches).toBeNull();
  });
});
