/**
 * 『여덟째 자리』 오프닝·타이틀 배경 — 게임 맵 그 자체를 1:1(16px 칸)로 구운 그림(새 그림 생성 없음).
 * 굽기: scripts/content/eighth-seat/bake_opening_backdrops.mts → public/assets/eighth-seat/opening/*.png.
 * 인물·이벤트는 빼고 굽는다(배우는 오프닝 레이어로 따로 걷는다).
 */
export type EighthSeatBackdropId = 'coach' | 'hall' | 'library' | 'clock' | 'duel';

export type EighthSeatBackdrop = {
  readonly id: EighthSeatBackdropId;
  readonly resourceId: string;
  readonly mapId: string;
  readonly fileName: string;
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};

const backdrop = (id: EighthSeatBackdropId, mapId: string, crop: EighthSeatBackdrop['crop']): EighthSeatBackdrop => ({
  id, resourceId: `oprn_eighth_seat_opening_${id}`, mapId, fileName: `${id}.png`, crop,
});

export const EIGHTH_SEAT_BACKDROPS: readonly EighthSeatBackdrop[] = [
  backdrop('coach', 'es_coach', { x: 0, y: 0, width: 480, height: 320 }),
  backdrop('hall', 'es_hall', { x: 0, y: 0, width: 480, height: 352 }),
  backdrop('library', 'es_library', { x: 0, y: 0, width: 384, height: 304 }),
  backdrop('clock', 'es_clock', { x: 0, y: 0, width: 288, height: 240 }),
  backdrop('duel', 'es_duelroom', { x: 0, y: 0, width: 352, height: 256 }),
];

export const EIGHTH_SEAT_BACKDROP_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  EIGHTH_SEAT_BACKDROPS.map(entry => [entry.resourceId, `/assets/eighth-seat/opening/${entry.fileName}`]),
);

export function eighthSeatBackdrop(id: EighthSeatBackdropId): EighthSeatBackdrop {
  return EIGHTH_SEAT_BACKDROPS.find(entry => entry.id === id)!;
}
