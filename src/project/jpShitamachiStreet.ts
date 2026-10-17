// jp_city 거리 구성기의 시타마치(下町 골목)·쇼텐가이(商店街 아케이드) 변형 — 키트 표와 바닥 재료.
// 2026-10-18 사용자: 「이런 식의 일본 실외도 만들 수 있음 좋겠군」(참고 그림 .herdr-web-ui/paste-20261017-181615 · -181623).
// 키트·바닥은 scripts/content/jp-city/blocks/shitamachi_pack.py 가 그린다. 이 표의 폭·높이는 그 파일의 @kit(w, h) 와 같아야 한다.
// 번들에 아직 굽지 않은 칩셋에서는 키트 자리가 비므로, 부르는 쪽이 flavorAvailable 로 확인하고 없으면 기본 상가 거리로 낮춘다.

import type { TilesetDef } from "@/project/types";

export type JpStreetFlavor = "shitamachi" | "shotengai";

export interface FlavorKit { readonly id: string; readonly w: number; readonly h: number }

/** 건물 띠에 줄지어 세우는 키트(왼쪽부터 붙여 찍는다). 앞쪽이 먼저 고려된다. */
export const FLAVOR_KITS: Readonly<Record<JpStreetFlavor, readonly FlavorKit[]>> = {
  shitamachi: [
    { id: "jp-shop-greengrocer", w: 6, h: 5 },
    { id: "jp-izakaya-brick-wall", w: 4, h: 5 },
    { id: "jp-vending-stripe-alcove", w: 3, h: 5 },
    { id: "jp-fg-rooftop-dish", w: 6, h: 5 },
    { id: "jp-alley-stair-tree", w: 4, h: 5 },
    { id: "jp-fg-tiled-balcony", w: 6, h: 5 },
  ],
  shotengai: [
    { id: "jp-shotengai-canopy", w: 8, h: 6 },
    { id: "jp-shotengai-arch", w: 7, h: 6 },
    { id: "jp-coin-parking", w: 8, h: 6 },
    { id: "jp-shop-greengrocer", w: 6, h: 5 },
    { id: "jp-vending-stripe-alcove", w: 3, h: 5 },
  ],
};

/** 키트 위 빈 대지(띠 꼭대기까지)를 덮는 뒤쪽 지붕 줄(4×2) — 참고 그림처럼 지붕이 빈틈 없이 이어진다. */
export const BACK_ROOFS: readonly string[] = ["jp-back-roofs", "jp-back-roofs-1", "jp-back-roofs-2", "jp-back-roofs-3"];
export const BACK_ROOF_W = 4;
export const BACK_ROOF_H = 2;

export const FLAVOR_POLE = { id: "jp-utility-pole-xfmr", w: 2, h: 6 } as const;
export const FLAVOR_BUS_STOP = { id: "jp-bus-stop-sign", w: 1, h: 3 } as const;
export const FLAVOR_POSTBOX = { id: "jp-postbox-red", w: 1, h: 2 } as const;

/** 바닥 그룹 이름(shitamachi_pack GROUND_GROUPS) — fill_region material. */
export const FLAVOR_SIDEWALK = "테라코타 벽돌 보도";
export const FLAVOR_ROAD = "따뜻한 아스팔트 골목";

/** 1칸 바닥 키트(아래층). */
export const GND = {
  ochre: "jp-gnd-brick-ochre",
  stain: "jp-gnd-brick-c",
  crack: "jp-gnd-asph-crack",
  manhole: "jp-gnd-manhole",
  drain: "jp-gnd-drain",
  curbS: "jp-gnd-curb-s",
  curbN: "jp-gnd-curb-n",
  shade: "jp-gnd-shade-brick",
  shadeL: "jp-gnd-shade-brick-dl",
  shadeR: "jp-gnd-shade-brick-dr",
} as const;

export const FLAVOR_KO: Readonly<Record<JpStreetFlavor, string>> = { shitamachi: "시타마치 골목", shotengai: "쇼텐가이 아케이드 상가" };

/** 기획·요청 글에서 변형을 고른다 — 아케이드·상점가·시장이면 쇼텐가이, 골목·시타마치·일본 거리면 시타마치. */
export function flavorFromText(text: string): JpStreetFlavor | undefined {
  if (/아케이드|상점가|시장|쇼텐가이|商店街|shotengai|arcade|market street/iu.test(text)) return "shotengai";
  if (/골목|시타마치|下町|일본\s*거리|shitamachi|back\s*alley/iu.test(text)) return "shitamachi";
  return undefined;
}

/** 이 칩셋에 변형 키트가 모두 구워져 있는가 — 없으면 키트 줄이 빈 대지로 남으므로 변형을 쓰지 않는다. */
export function flavorAvailable(tileset: Pick<TilesetDef, "structureKits"> | undefined, flavor: JpStreetFlavor): boolean {
  const ids = new Set((tileset?.structureKits ?? []).map((k) => k.id));
  return FLAVOR_KITS[flavor].every((k) => ids.has(k.id));
}
