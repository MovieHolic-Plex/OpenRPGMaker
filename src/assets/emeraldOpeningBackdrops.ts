/**
 * 몬스터 수집(에메랄드 결) 오프닝 애니메틱의 내장 배경 그림.
 * 별빛섬 캠페인의 실제 타일 맵에서 이벤트를 지우고 1:1 로 잘라 구운 그림이다(scripts/content/monsters/bake_opening_backdrops.mts).
 * 플레이어·내보내기는 generatedAssetResourceResolver 가 id 로 찾는다 — 프로젝트에 바이트를 싣지 않는다.
 */
export type EmeraldOpeningBackdropId = 'dawn' | 'route' | 'lab' | 'stage' | 'gym' | 'town';

export type EmeraldOpeningBackdrop = {
  readonly id: EmeraldOpeningBackdropId;
  readonly resourceId: string;
  readonly fileName: string;
  /** 구운 원본 맵(별빛섬 캠페인 기본 풀밭 테마). */
  readonly mapId: string;
  /** 맵 그림 위 자르기(px, 16px 타일 격자). width/height 가 곧 배경 그림 크기다. */
  readonly crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
};

const backdrop = (id: EmeraldOpeningBackdropId, mapId: string, x: number, y: number, width: number, height: number): EmeraldOpeningBackdrop => ({
  id, resourceId: `oprn_emerald_opening_${id}`, fileName: `${id}.png`, mapId, crop: { x, y, width, height },
});

export const EMERALD_OPENING_BACKDROPS: readonly EmeraldOpeningBackdrop[] = [
  backdrop('dawn', 'mx_map_beach', 0, 0, 416, 544),
  backdrop('route', 'mx_map_meadow', 0, 0, 384, 512),
  backdrop('lab', 'mx_map_lab', 0, 0, 240, 192),
  backdrop('stage', 'mx_map_garden', 0, 0, 448, 320),
  backdrop('gym', 'mx_map_grove_gym', 0, 0, 272, 336),
  backdrop('town', 'mx_map_home', 0, 0, 352, 320),
];

export const EMERALD_OPENING_BACKDROP_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  EMERALD_OPENING_BACKDROPS.map(entry => [entry.resourceId, `/assets/emerald-monster/opening/${entry.fileName}`]),
);

export function emeraldOpeningBackdrop(id: EmeraldOpeningBackdropId): EmeraldOpeningBackdrop {
  return EMERALD_OPENING_BACKDROPS.find(entry => entry.id === id)!;
}
