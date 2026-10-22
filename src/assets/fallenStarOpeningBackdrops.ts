/**
 * 『폴른 스타』 타이틀·오프닝 그림 (2026-10-21 사용자 「타이틀·오프닝은 생성 이미지로 제대로」).
 *
 * 이미지 모델(god-tibo-imagen, 유료 대체 경로 끔)로 컷마다 셋을 만들고 감독이 골랐다(by: supervisor, 고른 번호는 아래 source).
 * 프롬프트는 게임의 16px 3/4 탑뷰 칩셋 화풍을 지시하고 실제 맵 화면을 참고 그림으로 주었다(.omo 작업 스크립트 genart.mts).
 * 원본(1672×941)을 게임 화면 배율에 맞춰 줄이고 64색 도트로 눌렀다 — 타이틀은 480×270(화면 1배), 오프닝 컷은
 * 카메라가 천천히 흐를 수 있게 528×297(1.1배)이다. 무대에서는 nearest 로 1배 그대로 그린다.
 * 후보 비교: ~/claude-viz/fallen-star-title-pick-1.html. 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다.
 */
export type FallenStarArtId = 'title' | 'town' | 'fall' | 'observatory' | 'crash' | 'morning';

export type FallenStarArt = {
  readonly id: FallenStarArtId;
  readonly resourceId: string;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  /** 고른 후보(컷-번호)와 고른 사람. */
  readonly source: string;
};

const art = (id: FallenStarArtId, width: number, height: number, source: string): FallenStarArt => ({
  id, resourceId: `oprn_fallen_star_art_${id}`, fileName: `art/${id}.png`, width, height, source,
});

export const FALLEN_STAR_ART: readonly FallenStarArt[] = [
  art('title', 480, 270, 'title-3 · by: supervisor'),
  art('town', 528, 297, 'town-2 · by: supervisor'),
  art('fall', 528, 297, 'fall-2 · by: supervisor'),
  art('observatory', 528, 297, 'observatory-2 · by: supervisor'),
  art('crash', 528, 297, 'crash-2 · by: supervisor'),
  art('morning', 528, 297, 'morning-2 · by: supervisor'),
];

export const FALLEN_STAR_BACKDROP_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  FALLEN_STAR_ART.map(entry => [entry.resourceId, `/assets/fallen-star/opening/${entry.fileName}`]),
);

export function fallenStarArt(id: FallenStarArtId): FallenStarArt {
  return FALLEN_STAR_ART.find(entry => entry.id === id)!;
}
