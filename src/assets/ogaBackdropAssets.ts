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

// 2026-10-07 저작권 정리: greggman 배경 그림(public/assets/oga/greggman-backgrounds)을 지웠다. 목록은 비워 둔다.
export const OGA_BACKDROP_ASSETS: readonly OgaBackdropAsset[] = [];

export function resolveOgaBackdropAssetUrl(resourceId: string): string | null {
  const asset = OGA_BACKDROP_ASSETS.find((entry) => entry.id === resourceId);
  return asset ? `/${asset.path}` : null;
}
