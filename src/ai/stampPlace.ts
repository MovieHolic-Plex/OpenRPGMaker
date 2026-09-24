// 바로 깔기 — 의도 분류·계획 턴·실행 턴 없이 place_props 인자만 만든다.
// 밀도 낱말→enum 은 이 층에서 끝난다. place_props 는 enum 만 읽는다.

export interface StampSelection {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface StampPlaceArgs {
  readonly mapId: string;
  readonly area: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly material: string;
  readonly density?: "sparse" | "normal" | "dense" | "impassable";
  readonly count?: number;
}

export interface StampPlacePlan {
  readonly args: StampPlaceArgs;
  /** 채팅에 남길 한 줄. */
  readonly label: string;
}

const FILLER = /(?:좀|여기(?:에|다가)?|이\s*영역(?:에)?|만들어\s*줘|만들어|깔아\s*줘|깔아|해\s*줘|해줘|넣어\s*줘|넣어|please|make(?:\s+a)?)\s*/giu;

function densityOf(text: string): StampPlaceArgs["density"] | undefined {
  if (/울창|빽빽|통행\s*불가|impassable/iu.test(text)) return "impassable";
  if (/드문드문|가로수|sparse/iu.test(text)) return "sparse";
  if (/성글|normal/iu.test(text)) return "normal";
  if (/숲|나무|forest|woods|tree/iu.test(text)) return "dense";
  return undefined;
}

function materialOf(text: string, density: StampPlaceArgs["density"] | undefined): string {
  if (/활엽/u.test(text)) return "활엽수";
  if (/침엽|소나무|conifer/iu.test(text)) return "침엽수";
  const leftover = text
    .replace(FILLER, " ")
    .replace(/울창|빽빽|통행\s*불가|impassable|드문드문|가로수|sparse|성글|normal|숲|forest|woods|나무|tree/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (leftover.length > 0) return leftover;
  if (density) return "침엽수";
  return "";
}

/** 선택 영역이 있으면 그 사각형, 없으면 맵 전체. 빈 문장은 숲(침엽수·dense). */
export function planStampPlace(input: {
  readonly text: string;
  readonly mapId: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly selection: StampSelection | null;
}): StampPlacePlan | { readonly error: string } {
  const { mapId, mapWidth, mapHeight, selection } = input;
  if (mapWidth < 1 || mapHeight < 1) return { error: "맵 크기를 알 수 없습니다." };
  const selected = selection && selection.mapId === mapId && selection.width > 0 && selection.height > 0
    ? { x: selection.x, y: selection.y, w: selection.width, h: selection.height }
    : { x: 0, y: 0, w: mapWidth, h: mapHeight };
  const raw = input.text.trim();
  const text = raw.length > 0 ? raw : "숲";
  const density = densityOf(text);
  const material = materialOf(text, density);
  if (!material) return { error: "깔 재료를 적으세요. 예: 숲, 침엽수, 나무 상자" };
  const count = density ? undefined : Math.max(1, Math.min(24, Math.floor((selected.w * selected.h) / 12)));
  const where = selection && selection.mapId === mapId ? "선택 영역" : "맵 전체";
  const densityLabel = density ? ` · ${density}` : "";
  return {
    args: {
      mapId,
      area: selected,
      material,
      ...(density ? { density } : { count }),
    },
    label: `${where}에 ${material}${densityLabel} 바로 깔기`,
  };
}
