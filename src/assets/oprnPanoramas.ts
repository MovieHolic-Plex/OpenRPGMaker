// OPRN 자체 맵 배경(파노라마) 견본 — 코드로 찍은 그림이라 제3자 저작권이 없다.
//
// 그림: public/assets/panoramas/*.png, 생성기 scripts/content/panoramas/bake_panoramas.py(결정적).
// 2026-10-07 저작권 정리로 CraftPix·greggman 배경이 빠지면서 「맵 배경」 고르기에는 전투 배경 세 장만 남았다
// (하늘·노을·바다·별 없음). 이 견본이 그 자리를 채운다 — 편집기 「배경 고르기」 카드, 조수
// `set_map_properties.background.preset`, 이벤트 명령 「먼 배경 변경」 이 같은 목록을 본다.
//
// 세트 = 아래→위 층 목록. 층마다 권장 움직임(흐름·깊이·반복·맞추기)이 들어 있어 세트를 고르는 것만으로
// 게임에서 바로 그럴듯하게 움직인다. 움직임 프리셋(`MAP_BACKGROUND_MOTIONS`)으로 통째로 바꿀 수 있다.

import type { MapBackground, MapBackgroundFit, MapBackgroundLayer } from "@/project/types";

export type OprnPanoramaLayerAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  /** 권장 움직임 — 세트를 펼 때 이 층에 들어간다. */
  readonly fit: MapBackgroundFit;
  readonly scrollX?: number;
  readonly scrollY?: number;
  readonly cameraFollow?: number;
  readonly loopY?: boolean;
};

export type OprnPanoramaSet = {
  readonly id: string;
  readonly name: string;
  /** 그림에 실제로 보이는 것 + 어디에 쓰는지 — 조수가 고를 때 읽는 한 줄. */
  readonly summary: string;
  /** horizon = 옆에서 본 하늘(절벽·지붕 뒤), surface = 위에서 본 면(섬 둘레 바다·구름 위·우주). */
  readonly view: "horizon" | "surface";
  readonly tags: readonly string[];
  readonly layers: readonly OprnPanoramaLayerAsset[];
};

const DIR = "assets/panoramas";
const horizon = (id: string, name: string, extra: Partial<OprnPanoramaLayerAsset> = {}): OprnPanoramaLayerAsset => ({
  id, name, path: `${DIR}/${id}.png`, width: 640, height: 240, fit: "cover", loopY: false, ...extra,
});
const surface = (id: string, name: string, width: number, height: number, extra: Partial<OprnPanoramaLayerAsset> = {}): OprnPanoramaLayerAsset => ({
  id, name, path: `${DIR}/${id}.png`, width, height, fit: "native", ...extra,
});

export const OPRN_PANORAMA_SETS: readonly OprnPanoramaSet[] = [
  {
    id: "oprn-sky-day",
    name: "맑은 하늘",
    summary: "파란 낮 하늘과 뭉게구름 두 겹(옆에서 본 지평선, 구름은 화면 위쪽 절반) — 절벽·높은 곳·지붕 뒤의 하늘",
    view: "horizon",
    tags: ["하늘", "낮", "구름", "sky", "day"],
    layers: [
      horizon("oprn-pano-sky-day", "맑은 하늘 — 바탕"),
      horizon("oprn-pano-sky-day-clouds-far", "맑은 하늘 — 먼 구름", { scrollX: 0.15, cameraFollow: 0.1 }),
      horizon("oprn-pano-sky-day-clouds-near", "맑은 하늘 — 가까운 구름", { scrollX: 0.4, cameraFollow: 0.25 }),
    ],
  },
  {
    id: "oprn-sky-day-city",
    name: "맑은 하늘·도시",
    summary: "파란 낮 하늘·구름 아래 빌딩 숲 두 겹(먼 줄은 하늘색에 묻힘, 바닥선은 그림 아래쪽) — 옥상·높은 층 창밖·전망대. 옥상 둘레를 비우면 둘러싼 빌딩이 보여 공중에 뜬 상자로 읽히지 않는다",
    view: "horizon",
    tags: ["하늘", "낮", "도시", "빌딩", "옥상", "sky", "city", "rooftop"],
    layers: [
      horizon("oprn-pano-sky-day", "맑은 하늘 — 바탕"),
      horizon("oprn-pano-sky-day-clouds-far", "맑은 하늘 — 먼 구름", { scrollX: 0.15, cameraFollow: 0.1 }),
      horizon("oprn-pano-sky-day-clouds-near", "맑은 하늘 — 가까운 구름", { scrollX: 0.4, cameraFollow: 0.25 }),
      horizon("oprn-pano-sky-day-city-far", "낮 도시 — 먼 빌딩", { cameraFollow: 0.15 }),
      horizon("oprn-pano-sky-day-city-near", "낮 도시 — 가까운 빌딩", { cameraFollow: 0.3 }),
    ],
  },
  {
    id: "oprn-sunset",
    name: "노을",
    summary: "보라→주황 노을 하늘·지는 해·먼 도시 실루엣(옆에서 본 지평선, 지평선은 화면 위쪽 절반 — 그 아래 물은 보통 맵 타일에 가려 안 보인다) — 지붕 위·언덕·바닷가의 저녁. 윗줄 몇 칸만 비워도 해가 보인다",
    view: "horizon",
    tags: ["노을", "저녁", "석양", "해질녘", "sunset", "evening"],
    layers: [
      horizon("oprn-pano-sunset", "노을 — 하늘과 해"),
      horizon("oprn-pano-sunset-clouds", "노을 — 구름 줄", { scrollX: 0.12, cameraFollow: 0.05 }),
      horizon("oprn-pano-sunset-skyline", "노을 — 먼 도시 실루엣", { cameraFollow: 0.2 }),
    ],
  },
  {
    id: "oprn-night-stars",
    name: "밤하늘·별",
    summary: "짙은 남색 성운과 별 두 겹(사방 반복) — 밤하늘·우주·꿈 장면, 위에서 본 우주 맵 둘레",
    view: "surface",
    tags: ["밤", "별", "우주", "성운", "night", "stars", "space"],
    layers: [
      surface("oprn-pano-night", "밤하늘 — 성운", 320, 256),
      surface("oprn-pano-night-stars-far", "밤하늘 — 먼 별", 320, 256, { cameraFollow: 0.1 }),
      surface("oprn-pano-night-stars-near", "밤하늘 — 가까운 별", 320, 256, { cameraFollow: 0.3 }),
    ],
  },
  {
    id: "oprn-sea",
    name: "바다",
    summary: "위에서 본 짙푸른 바다와 흐르는 물결(사방 반복, 타일과 같이 움직임) — 섬 맵 바깥·배 위·해안 둘레",
    view: "surface",
    tags: ["바다", "물", "섬", "해양", "sea", "ocean", "water"],
    layers: [
      surface("oprn-pano-sea", "바다 — 수면", 256, 256, { cameraFollow: 1 }),
      surface("oprn-pano-sea-waves", "바다 — 물결", 256, 256, { cameraFollow: 1, scrollX: 0.2 }),
    ],
  },
  {
    id: "oprn-clouds",
    name: "구름 바다",
    summary: "위에서 내려다본 구름 바다와 떠가는 구름(사방 반복, 느린 시차) — 하늘섬·천공 맵 둘레",
    view: "surface",
    tags: ["구름", "하늘섬", "천공", "clouds", "sky island"],
    layers: [
      surface("oprn-pano-clouds", "구름 바다 — 아래 구름", 320, 256, { cameraFollow: 0.5 }),
      surface("oprn-pano-clouds-near", "구름 바다 — 떠가는 구름", 320, 256, { cameraFollow: 0.8, scrollX: 0.3 }),
    ],
  },
];

export const OPRN_PANORAMA_ASSETS: readonly OprnPanoramaLayerAsset[] = OPRN_PANORAMA_SETS.flatMap((set) => set.layers);

export function findOprnPanoramaSet(setId: string): OprnPanoramaSet | undefined {
  return OPRN_PANORAMA_SETS.find((set) => set.id === setId);
}

export function resolveOprnPanoramaAssetUrl(resourceId: string): string | null {
  const asset = OPRN_PANORAMA_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}

/** 이 그림 id 가 들어 있는 세트(그림 카드의 이름표·미리보기에 쓴다). */
export function oprnPanoramaSetOfImage(imageId: string): OprnPanoramaSet | undefined {
  return OPRN_PANORAMA_SETS.find((set) => set.layers.some((layer) => layer.id === imageId));
}

function layerFromAsset(asset: OprnPanoramaLayerAsset): MapBackgroundLayer {
  return {
    imageId: asset.id,
    fit: asset.fit,
    ...(asset.scrollX ? { scrollX: asset.scrollX } : {}),
    ...(asset.scrollY ? { scrollY: asset.scrollY } : {}),
    ...(asset.cameraFollow ? { cameraFollow: asset.cameraFollow } : {}),
    ...(asset.loopY === false ? { loopY: false } : {}),
  };
}

/**
 * 세트를 맵 배경 저작값으로 편다 — 권장 움직임 그대로. **빈 칸에도 보이기(showInEmptyCells)를 켠다**:
 * 지금 남은 칩셋에는 RM2K 파노라마 창 타일이 없어서, 이것 없이는 플레이에서 배경이 한 칸도 안 보인다
 * (2026-10-21 실측: 편집기 미리보기에는 하늘이 보이는데 플레이는 검은 칸).
 */
export function mapBackgroundFromPanoramaSet(setId: string): MapBackground | undefined {
  const set = findOprnPanoramaSet(setId);
  if (!set) return undefined;
  const [base, ...rest] = set.layers.map(layerFromAsset);
  return { ...base!, showInEmptyCells: true, ...(rest.length > 0 ? { layers: rest } : {}) };
}
