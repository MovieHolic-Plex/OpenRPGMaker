/**
 * 『첫사랑』 오프닝 몽타주 배경(2026-10-25, 애니 오프닝풍 C 안) — 게임 맵 그 자체를 1:1(16px 칸)로 구운 그림.
 * 새 그림 생성이 아니라 플레이 화면의 같은 맵이다(인물·표식 이벤트는 빼고 굽는다). 굽기:
 * scripts/content/first-love/bake_opening_backdrops.mts → public/assets/first-love/opening/*.png.
 * 오프닝 무대(480×270)보다 조금 크게 잘라 카메라가 천천히 흐른다.
 */
export type FirstLoveOpeningBackdropId = 'blossom' | 'subway' | 'office' | 'rooftop';

export type FirstLoveOpeningBackdrop = {
  readonly id: FirstLoveOpeningBackdropId;
  readonly resourceId: string;
  readonly mapId: string;
  readonly fileName: string;
  /** 맵 그림(1배)에서 자를 자리. */
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};

const backdrop = (id: FirstLoveOpeningBackdropId, mapId: string, crop: FirstLoveOpeningBackdrop['crop']): FirstLoveOpeningBackdrop => ({
  id, resourceId: `oprn_first_love_opening_${id}`, mapId, fileName: `${id}.png`, crop,
});

export const FIRST_LOVE_OPENING_BACKDROPS: readonly FirstLoveOpeningBackdrop[] = [
  // 거리 남동쪽 공원 — 노란 벚나무·잔디·분수와 보도(차도는 왼쪽 끝 한 줄만).
  backdrop('blossom', 'fl_street', { x: 300, y: 330, width: 500, height: 290 }),
  // 아침 승강장 — 기둥·의자·점자 끝선·선로 두 줄.
  backdrop('subway', 'fl_platform_am', { x: 0, y: 0, width: 528, height: 272 }),
  // 사무층 — 자리 무리·엘리베이터 홀.
  backdrop('office', 'fl_office', { x: 0, y: 0, width: 416, height: 368 }),
  // 옥상 — 넓은 하늘과 난간, 데크.
  backdrop('rooftop', 'fl_rooftop', { x: 0, y: 284, width: 480, height: 186 }),
];

export const FIRST_LOVE_OPENING_BACKDROP_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  FIRST_LOVE_OPENING_BACKDROPS.map(entry => [entry.resourceId, `/assets/first-love/opening/${entry.fileName}`]),
);

export function firstLoveOpeningBackdrop(id: FirstLoveOpeningBackdropId): FirstLoveOpeningBackdrop {
  return FIRST_LOVE_OPENING_BACKDROPS.find(entry => entry.id === id)!;
}
