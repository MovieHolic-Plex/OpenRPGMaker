export type TooltipRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type TooltipSize = {
  readonly width: number;
  readonly height: number;
};

export type TooltipAnchor = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export type TooltipPlacement = {
  readonly left: number;
  readonly top: number;
  readonly anchor: TooltipAnchor;
};

export type TooltipPlacementInput = {
  readonly tile: TooltipRect;
  readonly tip: TooltipSize;
  readonly host: TooltipSize;
};

const GAP = 8;
const MARGIN = 4;

export function computeEventMarkerTooltipPlacement(input: TooltipPlacementInput): TooltipPlacement {
  const { tile, tip, host } = input;

  let left = tile.x + tile.width + GAP;
  let side: "right" | "left" = "right";
  if (left + tip.width > host.width - MARGIN) {
    left = tile.x - tip.width - GAP;
    side = "left";
  }

  let top = tile.y - tip.height - GAP;
  let vertical: "top" | "bottom" = "top";
  if (top < MARGIN) {
    top = tile.y + tile.height + GAP;
    vertical = "bottom";
  }

  return {
    left: clamp(left, MARGIN, Math.max(MARGIN, host.width - tip.width - MARGIN)),
    top: clamp(top, MARGIN, Math.max(MARGIN, host.height - tip.height - MARGIN)),
    anchor: `${vertical}-${side}`,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
