// OpenGameArt 배경 팩(CraftPix, 레이어 분리) 리소스 등록.
//
// 원본: https://opengameart.org/content/horizontal-2d-backgrounds
// 라이선스: OGA-BY 3.0 (CC-BY 3.0과 실질 동일 — 저작자 표기 의무). 표기는
//   public/assets/ATTRIBUTION.md 의 OGA 섹션에서 유지한다. 표기 없이 이 파일만
//   남기면 라이선스 위반이다.
// 이미지: 페이지 첨부 zip 의 4세트 × (합성본 + layers 폴더) 를 그대로 둔다.
//   레이어 PNG 29장은 맵 배경 다층 저작(MapBackground.layers)용이고, 합성본
//   6장은 단일 이미지로 쓰고 싶을 때의 대체품이다. 픽셀은 편집하지 않았다.
//
// 세트 이름은 그림 내용을 따른다(2026-09-27 정정) — id 는 업스트림 폴더 이름을 딴 옛 이름 그대로 둔다
// (저장된 프로젝트가 id 로 참조한다). 실측: cliffs(bg3)는 밤 전나무 숲, pines(bg2)는 낮 산등성이,
// ridge(bg4)는 폭포 계곡이었다 — 이름만 보고 고르면 조수가 「회상용 낮 숲」 에 밤 그림을 깐다.
//
// 레이어 순서는 아래가 하늘, 위가 앞(지면·나무)이다. MapBackground.layers 의
// 배열 순서(앞이 아래)와 같게 defaultLayers 를 두었다 — 저작 화면에서 세트를
// 고르면 그 순서 그대로 얹힌다.

export type OgaCraftpixLayerAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
};

export type OgaCraftpixSetAsset = {
  readonly id: string;
  readonly name: string;
  /** 그림에 실제로 보이는 것 — 조수가 세트를 고를 때 읽는 한 줄. */
  readonly summary: string;
  /** 단일 이미지(합성본) — layers 를 쓰고 싶지 않을 때 고르는 그림. */
  readonly composite: OgaCraftpixLayerAsset;
  /** 아래→위. 맵 배경 레이어 스택의 기본 저작값. */
  readonly layers: readonly OgaCraftpixLayerAsset[];
};

// 2026-10-07 저작권 정리: CraftPix 배경 그림(public/assets/oga/craftpix-horizontal)을 지웠다. 목록은 비워 두고 형태만 남긴다.
export const OGA_CRAFTPIX_BACKDROP_SETS: readonly OgaCraftpixSetAsset[] = [];

/** 레이어 id → 파일 경로. 등록 검증·해석에서 함께 쓴다. */
export const OGA_CRAFTPIX_BACKDROP_ASSETS: readonly OgaCraftpixLayerAsset[] = [
  ...OGA_CRAFTPIX_BACKDROP_SETS.flatMap((set) => [set.composite, ...set.layers]),
];

/** 세트 id → 기본 레이어 저작값(아래→위). 맵 속성의 「레이어 불러오기」 가 쓴다. */
export function craftpixDefaultLayers(setId: string): readonly OgaCraftpixLayerAsset[] {
  return OGA_CRAFTPIX_BACKDROP_SETS.find((set) => set.id === setId)?.layers ?? [];
}

export function resolveOgaCraftpixAssetUrl(resourceId: string): string | null {
  const asset = OGA_CRAFTPIX_BACKDROP_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? "/" + asset.path : null;
}
