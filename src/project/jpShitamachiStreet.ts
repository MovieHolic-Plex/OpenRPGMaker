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
    { id: "jp-shop-greengrocer", w: 6, h: 7 },
    { id: "jp-izakaya-brick-wall", w: 4, h: 7 },
    { id: "jp-vending-stripe-alcove", w: 3, h: 7 },
    { id: "jp-mansion-tile", w: 6, h: 7 },
    { id: "jp-monthly-parking", w: 8, h: 7 },
    { id: "jp-fg-rooftop-dish", w: 6, h: 7 },
    { id: "jp-alley-stair-tree", w: 6, h: 7 },
    { id: "jp-fg-tiled-balcony", w: 6, h: 7 },
    { id: "jp-shop-market-kissa", w: 4, h: 7 },
    { id: "jp-coin-parking", w: 8, h: 7 },
  ],
  // 2026-10-18 사용자 반려 「대문통 이거 맞냐?」: 길 한가운데 홀로 선 大門通 간판 문은 뺐다 — 아케이드는 세로 보행자 길을 덮는 지붕(FLAVOR_ARCADE)이다.
  shotengai: [
    { id: "jp-shop-greengrocer", w: 6, h: 7 },
    { id: "jp-shop-market-butcher", w: 4, h: 7 },
    { id: "jp-shop-market-fish", w: 4, h: 7 },
    { id: "jp-shop-market-drug", w: 4, h: 7 },
    { id: "jp-shop-market-kissa", w: 4, h: 7 },
    { id: "jp-shotengai-canopy", w: 8, h: 7 },
    { id: "jp-coin-parking", w: 8, h: 7 },
    { id: "jp-vending-stripe-alcove", w: 3, h: 7 },
  ],
};

/**
 * 쇼텐가이 비 가림 아케이드(shitamachi_pack ARCADE_WIDTHS): 세로 길(폭 w = 차로 + 양옆 보도)을 보행자 시장 길로 바꿔 한 줄마다 지붕(세 줄마다 -rib 철 아치),
 * 큰길 쪽 어귀에 간판 아치(w×3)를 세운다. 지붕 양끝 칸은 처마 밑 진열대(막힘), 가운데는 걷는 통로.
 */
export const FLAVOR_ARCADE = { widths: [4, 5] as readonly number[], gateRows: 3, ribEvery: 3 } as const;
export const arcadeRoofKit = (w: number, rib: boolean): string => `jp-arcade-roof-${w}${rib ? "-rib" : ""}`;
export const arcadeGateKit = (w: number): string => `jp-arcade-gate-${w}`;
/** 골목 꾸밈: 건물 옆 빈 열에 지장보살 감실(2×2). */
export const FLAVOR_HOKORA = { id: "jp-hokora-jizo", w: 2, h: 2 } as const;

/**
 * 조립 건물 위에 덮는 깊은 3/4 지붕 키트 `jp-roof-<종류>-<폭>`(shitamachi_pack ROOF_STYLES · ROOF_WIDTHS · ROOF_ROWS 와 같아야 한다).
 * 참고 그림의 집은 3~4줄 깊이 지붕(기와 비탈·옥상 기물)이 보이는데 조립 지붕은 1~2줄 띠라 「같은 창 벽의 벽」으로 읽혔다(2026-10-18 5라운드).
 */
export const FLAVOR_ROOF_ROWS = 4;
export const FLAVOR_ROOF_WIDTHS: readonly [number, number] = [3, 10];
export const FLAVOR_ROOFS: Readonly<Record<JpStreetFlavor, readonly string[]>> = {
  shitamachi: ["kawara", "kuro", "deck", "dish", "tin-aka", "kawara", "kuro"],
  shotengai: ["deck", "dish", "tin-aka", "tin-sora", "kuro", "deck"],
};
export function flavorRoofKit(style: string, w: number): string | undefined {
  return w >= FLAVOR_ROOF_WIDTHS[0] && w <= FLAVOR_ROOF_WIDTHS[1] ? `jp-roof-${style}-${w}` : undefined;
}

export const FLAVOR_POLE = { id: "jp-utility-pole-xfmr", w: 2, h: 6 } as const;
export const FLAVOR_BUS_STOP = { id: "jp-bus-stop-sign", w: 1, h: 3 } as const;
export const FLAVOR_POSTBOX = { id: "jp-postbox-red", w: 1, h: 2 } as const;

/** 바닥 그룹 이름(shitamachi_pack GROUND_GROUPS) — fill_region material. */
export const FLAVOR_SIDEWALK = "콘크리트 판석 보도";
export const FLAVOR_ROAD = "따뜻한 아스팔트 골목";

/** 1칸 바닥 키트(아래층). */
export const GND = {
  ochre: "jp-gnd-slab-b",
  stain: "jp-gnd-slab-c",
  crack: "jp-gnd-asph-crack",
  manhole: "jp-gnd-manhole",
  drain: "jp-gnd-drain",
  curbS: "jp-gnd-curb-s",
  curbN: "jp-gnd-curb-n",
  curbShade: "jp-gnd-curb-s-shade",
  curbShadeL: "jp-gnd-curb-s-shade-dl",
  curbShadeR: "jp-gnd-curb-s-shade-dr",
  shade: "jp-gnd-shade-slab",
  shadeL: "jp-gnd-shade-slab-dl",
  shadeR: "jp-gnd-shade-slab-dr",
  lineN: "jp-gnd-asph-line-n",
  lineS: "jp-gnd-asph-line-s",
  zebra: "jp-gnd-zebra",
  curbE: "jp-gnd-curb-e",
  curbW: "jp-gnd-curb-w",
  curbSE: "jp-gnd-curb-se",
  curbSW: "jp-gnd-curb-sw",
  curbNE: "jp-gnd-curb-ne",
  curbNW: "jp-gnd-curb-nw",
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
  const arcade = flavor === "shotengai" ? FLAVOR_ARCADE.widths.flatMap((w) => [arcadeRoofKit(w, false), arcadeRoofKit(w, true), arcadeGateKit(w)]) : [];
  return [...FLAVOR_KITS[flavor].map((k) => k.id), ...arcade].every((id) => ids.has(id));
}
