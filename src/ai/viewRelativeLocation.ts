// 사람 말의 추상 위치(오른쪽 위, 왼쪽, …) → 지금 보고 있는 화면 상자.
// 모델이 맵 원점이나 마을 기본 숲 띠를 짐작하지 못하게, 코드가 좌표를 확정한다.

import type { MapViewportSnapshot } from "./mapViewportContext";
import type { BuildSpec } from "./buildSpec";

export type SpatialHorizontal = "left" | "center" | "right";
export type SpatialVertical = "top" | "center" | "bottom";

export type SpatialAnchor = {
  readonly horizontal: SpatialHorizontal;
  readonly vertical: SpatialVertical;
};

export type SpatialPhrase = SpatialAnchor & {
  readonly phrase: string;
};

export type TileRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

const COMPOUND: readonly { readonly pattern: RegExp; readonly phrase: string; readonly horizontal: SpatialHorizontal; readonly vertical: SpatialVertical }[] = [
  { pattern: /북동|northeast|upper[\s-]?right|top[\s-]?right/, phrase: "오른쪽 위", horizontal: "right", vertical: "top" },
  { pattern: /북서|northwest|upper[\s-]?left|top[\s-]?left/, phrase: "왼쪽 위", horizontal: "left", vertical: "top" },
  { pattern: /남동|southeast|lower[\s-]?right|bottom[\s-]?right/, phrase: "오른쪽 아래", horizontal: "right", vertical: "bottom" },
  { pattern: /남서|southwest|lower[\s-]?left|bottom[\s-]?left/, phrase: "왼쪽 아래", horizontal: "left", vertical: "bottom" },
];

export function parseSpatialPhrase(text: string): SpatialPhrase | null {
  const raw = text.normalize("NFKC");
  const folded = raw.toLowerCase();
  for (const entry of COMPOUND) {
    if (entry.pattern.test(folded)) {
      return { phrase: entry.phrase, horizontal: entry.horizontal, vertical: entry.vertical };
    }
  }

  const right = /오른쪽|우측|동쪽|\bright\b|\beast\b/.test(folded);
  const left = /왼쪽|좌측|서쪽|\bleft\b|\bwest\b/.test(folded);
  const top = /위쪽|윗쪽|상단|북쪽|위에|위로|위(?![가-힣])|\bupper\b|\btop\b|\bnorth\b/.test(folded);
  const bottom = /아래쪽|하단|남쪽|아래에|아래로|아래(?![가-힣])|\blower\b|\bbottom\b|\bsouth\b/.test(folded);
  const middle = /가운데|중앙|\bcenter\b|\bmiddle\b/.test(folded);

  const horizontal: SpatialHorizontal | null = right ? "right" : left ? "left" : null;
  const vertical: SpatialVertical | null = top ? "top" : bottom ? "bottom" : null;
  if (horizontal === null && vertical === null) {
    if (!middle) return null;
    return { phrase: "가운데", horizontal: "center", vertical: "center" };
  }

  const h = horizontal ?? "center";
  const v = vertical ?? "center";
  return { phrase: phraseLabel(h, v), horizontal: h, vertical: v };
}

export function resolveSpatialRect(frame: TileRect, anchor: SpatialAnchor): TileRect {
  const xSlice = sliceAxis(frame.x, frame.w, anchor.horizontal === "left" ? "start" : anchor.horizontal === "right" ? "end" : "mid");
  const ySlice = sliceAxis(frame.y, frame.h, anchor.vertical === "top" ? "start" : anchor.vertical === "bottom" ? "end" : "mid");
  const x = anchor.horizontal === "center" && anchor.vertical !== "center" ? frame.x : xSlice.start;
  const w = anchor.horizontal === "center" && anchor.vertical !== "center" ? frame.w : xSlice.size;
  const y = anchor.vertical === "center" && anchor.horizontal !== "center" ? frame.y : ySlice.start;
  const h = anchor.vertical === "center" && anchor.horizontal !== "center" ? frame.h : ySlice.size;
  return { x, y, w, h };
}

export function viewportVisibleFrame(viewport: MapViewportSnapshot): TileRect {
  const viewW = viewport.viewW;
  const viewH = viewport.viewH;
  const viewX = viewport.viewX;
  const viewY = viewport.viewY;
  if (
    typeof viewW === "number" && viewW > 0
    && typeof viewH === "number" && viewH > 0
    && typeof viewX === "number"
    && typeof viewY === "number"
  ) {
    return { x: viewX, y: viewY, w: viewW, h: viewH };
  }
  return { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h };
}

export function formatResolvedSpatialBlock(input: {
  readonly phrase: string;
  readonly frame: TileRect;
  readonly rect: TileRect;
}): string {
  const { phrase, frame, rect } = input;
  return [
    "## 위치 지시(코드가 계산함 — 추측 금지)",
    `- 말한 위치: 「${phrase}」`,
    `- 기준: 지금 보고 있는 화면 (${frame.w}×${frame.h}, 원점 ${frame.x},${frame.y})`,
    `- 배치 상자: (${rect.x},${rect.y}) ${rect.w}×${rect.h}`,
    "이 상자 안에만 해당 지형·소품을 놓으세요. 맵 전체의 구석이 아닙니다.",
  ].join("\n");
}

export function implicitSpecFromViewLocation(input: {
  readonly mapId: string;
  readonly requestText: string;
  readonly rect: TileRect;
}): BuildSpec | null {
  const parsed = parseSpatialPhrase(input.requestText);
  if (!parsed) return null;
  return {
    mapId: input.mapId,
    title: `화면 기준 위치: ${parsed.phrase}`,
    assets: [{
      id: "위치 지시",
      kind: assetKindFromRequest(input.requestText),
      x: input.rect.x,
      y: input.rect.y,
      w: input.rect.w,
      h: input.rect.h,
    }],
  };
}

export function resolveTurnViewLocation(
  requestText: string,
  viewport: MapViewportSnapshot | null | undefined,
): { readonly phrase: SpatialPhrase; readonly frame: TileRect; readonly rect: TileRect } | null {
  if (!viewport) return null;
  const parsed = parseSpatialPhrase(requestText);
  if (!parsed) return null;
  const frame = viewportVisibleFrame(viewport);
  if (frame.w < 1 || frame.h < 1) return null;
  return { phrase: parsed, frame, rect: resolveSpatialRect(frame, parsed) };
}

function phraseLabel(horizontal: SpatialHorizontal, vertical: SpatialVertical): string {
  const h = horizontal === "right" ? "오른쪽" : horizontal === "left" ? "왼쪽" : "";
  const v = vertical === "top" ? "위" : vertical === "bottom" ? "아래" : "";
  if (h && v) return `${h} ${v}`;
  if (h) return h;
  if (v) return v;
  return "가운데";
}

function sliceAxis(origin: number, size: number, which: "start" | "mid" | "end"): { readonly start: number; readonly size: number } {
  if (size <= 1) return { start: origin, size: Math.max(1, size) };
  const half = Math.floor(size / 2);
  if (which === "start") return { start: origin, size: Math.max(1, half) };
  if (which === "end") return { start: origin + half, size: size - half };
  const quarter = Math.floor(size / 4);
  return { start: origin + quarter, size: Math.max(1, size - quarter * 2) };
}

function assetKindFromRequest(text: string): string {
  if (/숲|나무|침엽|활엽|forest|tree|woods/i.test(text)) return "prop";
  if (/길|도로|path|road/i.test(text)) return "road";
  if (/물|호수|강|연못|lake|river/i.test(text)) return "terrain";
  return "selection";
}
