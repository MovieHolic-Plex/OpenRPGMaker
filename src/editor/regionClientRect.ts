// 타일 영역 → 화면(클라이언트) 사각형 해석기 등록소.
//
// 이 변환은 Phaser 카메라(worldView·zoom)와 캔버스 위치를 읽어야 하므로 EditScene 만 할 수
// 있다. 반면 이 값을 필요로 하는 쪽(선택 액션 바 → 영역 작업 창의 `avoid`)은 Phaser 를
// 모르는 DOM 코드다. editorMapViewport 와 같은 모양으로, EditScene 이 계산을 등록하고
// 소비자는 함수만 부른다.
//
// 등록이 없으면(테스트·헤드리스) null 이고, 그때 창은 anchor 배치로 폴백한다.

export type RegionTileRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type RegionClientRect = RegionTileRect;

export type RegionClientRectResolver = (region: RegionTileRect) => RegionClientRect | null;

let resolver: RegionClientRectResolver | null = null;

export function setRegionClientRectResolver(next: RegionClientRectResolver | null): void {
  resolver = next;
}

export function resolveRegionClientRect(region: RegionTileRect): RegionClientRect | null {
  if (!resolver) return null;
  try {
    return resolver(region);
  } catch {
    // 카메라/캔버스를 못 읽는 순간(씬 종료 중 등)에 창이 안 열리는 것보다 avoid 없이
    // 여는 편이 낫다.
    return null;
  }
}
