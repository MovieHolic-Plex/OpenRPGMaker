/**
 * RM2k3 / EasyRPG System2 sheet layout (80×96).
 *
 * System2 is gauge / number / arrow chrome — never a windowskin or battle backdrop.
 * Orange (#ff9c00 on System2C) is the transparent key color.
 *
 * Layout (source pixels):
 *   y  0–16  up arrows
 *   y 16–32  down arrows
 *   y 32–48  HP label + empty track + red fill  (fill @ x48, y44)
 *   y 48–64  SP label + empty track + green fill (fill @ x48, y60)
 *   y 64–80  AT label + empty track + blue fill  (fill @ x48, y76)
 *   y 80–96  digits 0–9
 */

export type System2Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export const SYSTEM2_SHEET_WIDTH = 80;
export const SYSTEM2_SHEET_HEIGHT = 96;

/** EasyRPG System2C key color (also top-left of A/B/C sheets). */
export const SYSTEM2_TRANSPARENT_KEY = { r: 255, g: 156, b: 0 } as const;

/**
 * Solid fill colors sampled from System2C gauge strips (y44/y60/y76 @ x48+).
 * Used for reliable bar fills; sheet sprite coords remain for future digit/arrow chrome.
 */
export const SYSTEM2_FILL_COLORS = {
  hpHi: "#e7874e",
  hpLo: "#e0671f",
  spHi: "#6dc145",
  spLo: "#46b013",
  atHi: "#82caf2",
  atLo: "#60bcee",
} as const;

export const SYSTEM2_REGIONS = {
  arrowUp: { x: 0, y: 0, w: 16, h: 16 },
  arrowDown: { x: 0, y: 16, w: 16, h: 16 },
  hpLabel: { x: 0, y: 32, w: 32, h: 16 },
  spLabel: { x: 0, y: 48, w: 32, h: 16 },
  atLabel: { x: 0, y: 64, w: 32, h: 16 },
  /** Solid red/orange HP gauge fill strip (pure color rows only). */
  hpFill: { x: 48, y: 44, w: 32, h: 2 },
  /** Solid green SP/MP gauge fill strip. */
  spFill: { x: 48, y: 60, w: 32, h: 2 },
  /** Solid blue AT/time gauge fill strip. */
  atFill: { x: 48, y: 76, w: 32, h: 2 },
  digits: { x: 0, y: 80, w: 80, h: 16 },
} as const satisfies Record<string, System2Rect>;

export type System2SpriteCss = {
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
};

/**
 * CSS background-size / background-position so `region` of the 80×96 sheet
 * stretches to fill the target element (percentage form, resolution-independent).
 */
export function system2SpriteCss(region: System2Rect): System2SpriteCss {
  const W = SYSTEM2_SHEET_WIDTH;
  const H = SYSTEM2_SHEET_HEIGHT;
  const sizeX = (W / region.w) * 100;
  const sizeY = (H / region.h) * 100;
  // Align region inside sheet to the element box (standard CSS sprite % formula).
  const posX = W === region.w ? 0 : (region.x / (W - region.w)) * 100;
  const posY = H === region.h ? 0 : (region.y / (H - region.h)) * 100;
  return {
    backgroundSize: `${sizeX}% ${sizeY}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  };
}

/** CSS custom properties for battle-root System2 gauge wiring. */
export function system2GaugeCssVars(): Record<string, string> {
  const hp = system2SpriteCss(SYSTEM2_REGIONS.hpFill);
  const sp = system2SpriteCss(SYSTEM2_REGIONS.spFill);
  const at = system2SpriteCss(SYSTEM2_REGIONS.atFill);
  return {
    "--system2-hp-fill-size": hp.backgroundSize,
    "--system2-hp-fill-pos": hp.backgroundPosition,
    "--system2-sp-fill-size": sp.backgroundSize,
    "--system2-sp-fill-pos": sp.backgroundPosition,
    "--system2-at-fill-size": at.backgroundSize,
    "--system2-at-fill-pos": at.backgroundPosition,
    "--system2-hp-fill-hi": SYSTEM2_FILL_COLORS.hpHi,
    "--system2-hp-fill-lo": SYSTEM2_FILL_COLORS.hpLo,
    "--system2-sp-fill-hi": SYSTEM2_FILL_COLORS.spHi,
    "--system2-sp-fill-lo": SYSTEM2_FILL_COLORS.spLo,
    "--system2-at-fill-hi": SYSTEM2_FILL_COLORS.atHi,
    "--system2-at-fill-lo": SYSTEM2_FILL_COLORS.atLo,
  };
}
