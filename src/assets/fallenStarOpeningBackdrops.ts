/**
 * 『폴른 스타』 오프닝·타이틀의 내장 배경 그림.
 * 게임 안 실제 맵(왕도·천문대·숲)에서 이벤트를 지우고 1:1(16px 타일 그대로) 잘라 구운 그림이다.
 * 오프닝 레이어는 배경을 (crop.x, crop.y) 에 놓으므로 컷 안 좌표는 원본 맵의 px 좌표 그대로다.
 * 밤 컷은 구울 때 달빛 색으로 눌렀다(scripts/content/flagship/bake_fallen_star_backdrops.mts).
 * 생성 이미지가 아니다 — 맵을 그린 손 도트 타일 그대로다. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type FallenStarBackdropId = 'hub-night' | 'hub-day' | 'observatory-night' | 'forest-night' | 'title';
export type FallenStarBackdropGrade = 'day' | 'night' | 'candle';

export type FallenStarBackdrop = {
  readonly id: FallenStarBackdropId;
  readonly resourceId: string;
  readonly fileName: string;
  /** 구운 원본 맵(createChronoBellFlagshipDemo 의 맵 id). */
  readonly mapId: string;
  /** 맵 그림 위 자르기(px). width/height 가 곧 배경 그림 크기다. */
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly grade: FallenStarBackdropGrade;
};

const backdrop = (id: FallenStarBackdropId, mapId: string, grade: FallenStarBackdropGrade, x: number, y: number, width: number, height: number): FallenStarBackdrop => ({
  id, resourceId: `oprn_fallen_star_${id.replace(/-/g, '_')}`, fileName: `${id}.png`, mapId, crop: { x, y, width, height }, grade,
});

export const FALLEN_STAR_BACKDROPS: readonly FallenStarBackdrop[] = [
  backdrop('hub-night', 'fs_hub', 'night', 192, 48, 544, 432),
  backdrop('hub-day', 'fs_hub', 'day', 48, 208, 688, 288),
  backdrop('observatory-night', 'fs_observatory', 'candle', 0, 0, 288, 304),
  backdrop('forest-night', 'fs_forest', 'night', 0, 0, 480, 320),
  // 타이틀 — 운하 다리와 천문대 지붕이 보이는 밤 왕도 한 화면(480×270, 게임 화면과 같은 1배).
  backdrop('title', 'fs_hub', 'night', 208, 176, 480, 270),
];

export const FALLEN_STAR_BACKDROP_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  FALLEN_STAR_BACKDROPS.map(entry => [entry.resourceId, `/assets/fallen-star/opening/${entry.fileName}`]),
);

export function fallenStarBackdrop(id: FallenStarBackdropId): FallenStarBackdrop {
  return FALLEN_STAR_BACKDROPS.find(entry => entry.id === id)!;
}
