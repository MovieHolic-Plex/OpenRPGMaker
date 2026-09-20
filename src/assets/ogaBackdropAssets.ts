// OpenGameArt 배경 그림(backdrop) 팩 리소스 등록.
//
// 원본: https://opengameart.org/content/backgrounds-for-2d-platformers
// 라이선스: CC-BY 3.0 — 저작자 표기 의무가 있어 public/assets/ATTRIBUTION.md 의
//   OGA 섹션과 함께 유지한다. 표기 없이 이 파일만 남기면 라이선스 위반이다.
// 이미지: 페이지 첨부 5장을 1280x720 규격으로 통일해 public/assets/oga/ 에 둔다.
//   1:1 원본(1920x1080) 대신 720p 로 통일한 이유는 기존 720p 첨부 2장과 규격을
//   맞추고 합성·리사이즈 없이 저장소에 싣기 위해서다.

type OgaBackdropAsset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly tags: readonly string[];
};

const ASSET_DIR = "assets/oga/greggman-backgrounds";

export const OGA_BACKDROP_ASSETS: readonly OgaBackdropAsset[] = [
  {
    id: "oga-backdrop-meadow",
    name: "초원 언덕 배경 (greggman)",
    path: `${ASSET_DIR}/meadow.png`,
    tags: ["배경", "초원", "들판", "언덕", "맑음"],
  },
  {
    id: "oga-backdrop-city-night",
    name: "야경 도시 배경 (greggman)",
    path: `${ASSET_DIR}/city-night.png`,
    tags: ["배경", "도시", "밤", "야경", "실루엣"],
  },
  {
    id: "oga-backdrop-haunted-forest",
    name: "윤곽 숲 배경 (greggman)",
    path: `${ASSET_DIR}/haunted-forest.png`,
    tags: ["배경", "숲", "밤", "공포", "실루엣"],
  },
  {
    id: "oga-backdrop-dusk-mountains",
    name: "황혼 산 배경 (greggman)",
    path: `${ASSET_DIR}/dusk-mountains.png`,
    tags: ["배경", "산", "황혼", "노을"],
  },
  {
    id: "oga-backdrop-snow-mountains",
    name: "설원 산 배경 (greggman)",
    path: `${ASSET_DIR}/snow-mountains.png`,
    tags: ["배경", "산", "설원", "눈"],
  },
] as const;

export function resolveOgaBackdropAssetUrl(resourceId: string): string | null {
  const asset = OGA_BACKDROP_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}
