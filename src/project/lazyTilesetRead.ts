import type { Project, TilesetDef } from "./types";

/**
 * `projectClone.cloneProjectForMutation` 의 지연 타일셋 사전 → 원본 사전. 사전이 확정(`finishProjectMutation`)되면 빠진다.
 * 이 모듈은 런타임(collision)도 읽으므로 편집기 코드를 끌어들이지 않는다.
 */
const lazyOriginals = new WeakMap<object, Project["tilesets"]>();

export function registerLazyTilesets(dictionary: Project["tilesets"], originals: Project["tilesets"]): void {
  lazyOriginals.set(dictionary, originals);
}

export function unregisterLazyTilesets(dictionary: Project["tilesets"]): void {
  lazyOriginals.delete(dictionary);
}

/**
 * 읽기 전용 타일셋 조회. 도구 초안의 지연 사전에서 아직 아무도 읽지 않은 자리면 복제하지 않고 원본을 돌려준다
 * (그 자리의 값은 원본과 같다). 그 밖에는 `tilesets[id]` 그대로다. **반환값을 고치지 않는 곳에서만 쓴다** —
 * 원본은 스토어·되돌리기 기록이 함께 가리킨다.
 *
 * 왜(2026-11-23 실측, 폴른 스타 데모 빌드 1,290s): 도구 호출마다 집 보호·통행 검사가 초안 타일셋을 읽기만 했는데,
 * 읽는 순간 그 타일셋 전체가 깊게 복제되고(397s) 커밋 전에 원본과 값 비교됐다(jsonEqual 72s).
 */
export function readTileset(tilesets: Project["tilesets"], id: string): TilesetDef | undefined {
  const originals = lazyOriginals.get(tilesets);
  if (originals && Object.getOwnPropertyDescriptor(tilesets, id)?.get) return originals[id];
  return tilesets[id];
}
