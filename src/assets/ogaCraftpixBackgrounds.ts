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

const ASSET_DIR = "assets/oga/craftpix-horizontal";

function layer(id: string, name: string, path: string): OgaCraftpixLayerAsset {
  return { id, name, path: ASSET_DIR + "/" + path };
}

export const OGA_CRAFTPIX_BACKDROP_SETS: readonly OgaCraftpixSetAsset[] = [
  {
    id: "oga-craftpix-hills",
    name: "구름 언덕 배경 (CraftPix)",
    summary: "맑은 낮 — 뭉게구름, 보랏빛 바위산, 산기슭 소나무, 잔잔한 호수",
    composite: layer("oga-craftpix-hills", "구름 언덕 배경 (CraftPix)", "bg1/composite.png"),
    layers: [
      layer("oga-craftpix-hills-layer-sky", "구름 언덕 · 하늘", "bg1/layers/sky.png"),
      layer("oga-craftpix-hills-layer-clouds2", "구름 언덕 · 먼 구름", "bg1/layers/clouds_2.png"),
      layer("oga-craftpix-hills-layer-clouds4", "구름 언덕 · 먼 구름 2", "bg1/layers/clouds_4.png"),
      layer("oga-craftpix-hills-layer-rocks1", "구름 언덕 · 먼 바위산", "bg1/layers/rocks_1.png"),
      layer("oga-craftpix-hills-layer-clouds3", "구름 언덕 · 가까운 구름", "bg1/layers/clouds_3.png"),
      layer("oga-craftpix-hills-layer-rocks2", "구름 언덕 · 가까운 바위산", "bg1/layers/rocks_2.png"),
      layer("oga-craftpix-hills-layer-clouds1", "구름 언덕 · 앞 구름", "bg1/layers/clouds_1.png"),
    ],
  },
  {
    id: "oga-craftpix-pines",
    name: "낮 산등성이 배경 (CraftPix)",
    summary: "흐린 낮 — 큰 뭉게구름과 새, 겹겹이 이어진 갈색 산등성이, 비탈의 소나무",
    composite: layer("oga-craftpix-pines", "낮 산등성이 배경 (CraftPix)", "bg2/composite.png"),
    layers: [
      layer("oga-craftpix-pines-layer-sky", "낮 산등성이 · 하늘", "bg2/layers/sky.png"),
      layer("oga-craftpix-pines-layer-clouds2", "낮 산등성이 · 먼 구름", "bg2/layers/clouds_2.png"),
      layer("oga-craftpix-pines-layer-rocks3", "낮 산등성이 · 먼 바위", "bg2/layers/rocks_3.png"),
      layer("oga-craftpix-pines-layer-clouds1", "낮 산등성이 · 먼 구름 2", "bg2/layers/clouds_1.png"),
      layer("oga-craftpix-pines-layer-rocks2", "낮 산등성이 · 중간 바위", "bg2/layers/rocks_2.png"),
      layer("oga-craftpix-pines-layer-rocks1", "낮 산등성이 · 가까운 바위산", "bg2/layers/rocks_1.png"),
      layer("oga-craftpix-pines-layer-clouds3", "낮 산등성이 · 가까운 구름", "bg2/layers/clouds_3.png"),
      layer("oga-craftpix-pines-layer-pines", "낮 산등성이 · 소나무", "bg2/layers/pines.png"),
      layer("oga-craftpix-pines-layer-birds", "낮 산등성이 · 새", "bg2/layers/birds.png"),
    ],
  },
  {
    id: "oga-craftpix-cliffs",
    name: "밤 소나무 숲 배경 (CraftPix)",
    summary: "밤 — 별하늘과 구름, 짙푸른 전나무 숲 실루엣, 어두운 언덕",
    composite: layer("oga-craftpix-cliffs", "밤 소나무 숲 배경 (CraftPix)", "bg3/composite-1.png"),
    layers: [
      layer("oga-craftpix-cliffs-layer-sky", "밤 소나무 숲 · 하늘", "bg3/layers/sky.png"),
      layer("oga-craftpix-cliffs-layer-rocks", "밤 소나무 숲 · 먼 산", "bg3/layers/rocks.png"),
      layer("oga-craftpix-cliffs-layer-clouds1", "밤 소나무 숲 · 구름", "bg3/layers/clouds_1.png"),
      layer("oga-craftpix-cliffs-layer-ground1", "밤 소나무 숲 · 먼 숲", "bg3/layers/ground_1.png"),
      layer("oga-craftpix-cliffs-layer-ground2", "밤 소나무 숲 · 중간 숲", "bg3/layers/ground_2.png"),
      layer("oga-craftpix-cliffs-layer-ground3", "밤 소나무 숲 · 가까운 숲", "bg3/layers/ground_3.png"),
      layer("oga-craftpix-cliffs-layer-plant", "밤 소나무 숲 · 식물", "bg3/layers/plant.png"),
    ],
  },
  {
    id: "oga-craftpix-ridge",
    name: "폭포 계곡 배경 (CraftPix)",
    summary: "보랏빛 황혼 — 계곡 폭포, 붉은 바위 절벽, 둥근 보라색 나무, 물가",
    composite: layer("oga-craftpix-ridge", "폭포 계곡 배경 (CraftPix)", "bg4/composite.png"),
    layers: [
      layer("oga-craftpix-ridge-layer-sky", "폭포 계곡 · 하늘", "bg4/layers/sky.png"),
      layer("oga-craftpix-ridge-layer-rocks", "폭포 계곡 · 바위산", "bg4/layers/rocks.png"),
      layer("oga-craftpix-ridge-layer-clouds2", "폭포 계곡 · 먼 구름", "bg4/layers/clouds_2.png"),
      layer("oga-craftpix-ridge-layer-ground", "폭포 계곡 · 지면", "bg4/layers/ground.png"),
      layer("oga-craftpix-ridge-layer-clouds1", "폭포 계곡 · 앞 구름", "bg4/layers/clouds_1.png"),
    ],
  },
] as const;

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
