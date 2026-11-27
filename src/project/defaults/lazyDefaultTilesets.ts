// defaultTilesets() 의 미접근 번들 타일셋 지연 생성(lazy materialization) 레지스트리.
//
// 왜: 빈 새 프로젝트(createBlankProject)는 번들 타일셋 49개(약 74MB, 생성 1~2.5s · +633MB RSS)를 싣지만
// 대부분의 테스트·편집·조수 세션은 기본 타일셋 1~2개만 실제로 읽는다.
// 각 자리를 일반 enumerable/configurable 접근자(Object.defineProperty)로 두면:
//  - `Object.keys`·`in`·`Object.hasOwn` 은 49개를 원래 순서대로 보고 하나도 생성하지 않는다.
//  - 처음 읽는 자리만 그때 fresh 사본을 만들어 보통 데이터 속성으로 정착(settle)한다.
//  - 대입(`tilesets[id] = ...`)·삭제(`delete tilesets[id]`)는 getter 를 깨우지 않고 즉시 동작한다.
//  - `projectClone`·`contentDigest`·`removeLegacySpriteReferences`·`ensureBundledTilesets` 는
//    미접근 자리를 깨우지 않고 그대로 넘기거나(복제) 구운 요약(bundledTilesetDigests.json)으로 O(1) 해시한다.
//  - `structuredClone`·`JSON.stringify`·`Object.values` 등 외부 코드는 접근자를 통해 100% 동일한 값을 받는다.
//
// 의존성이 없는 작은 모듈이라 contentDigest·projectClone·defaultAssets 모두 순환 없이 읽는다.
import BAKED_DIGESTS from "../../assets/bundledTilesetDigests.json" with { type: "json" };

type BakedEntry = { readonly digest: string; readonly count: number };
const baked = BAKED_DIGESTS as unknown as Readonly<Record<string, BakedEntry>>;

export type LazyDefaultTilesetBuilder<T = unknown> = () => T;

const pendingByDict = new WeakMap<object, Map<string, LazyDefaultTilesetBuilder>>();

/** 사전에 지연 번들 타일셋 자리를 등록한다. 처음 읽힐 때만 `build()` 를 불러 데이터 속성으로 정착시킨다. */
export function registerLazyDefaultTileset<T>(
  dict: Record<string, T>,
  id: string,
  build: LazyDefaultTilesetBuilder<T>,
): void {
  let map = pendingByDict.get(dict);
  if (!map) {
    map = new Map();
    pendingByDict.set(dict, map);
  }
  map.set(id, build);
  Object.defineProperty(dict, id, {
    enumerable: true,
    configurable: true,
    get(): T {
      map!.delete(id);
      const value = build();
      Object.defineProperty(dict, id, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
      return value;
    },
    set(value: T) {
      map!.delete(id);
      Object.defineProperty(dict, id, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
  });
}

/** 이 사전에 아직 깨어나지 않은 지연 번들 타일셋 자리가 하나 이상 있는가(O(1)). */
export function hasPendingDefaultTilesets(dict: unknown): boolean {
  if (dict === null || typeof dict !== "object") return false;
  const map = pendingByDict.get(dict);
  return map !== undefined && map.size > 0;
}

/**
 * `dict[id]` 가 아직 깨어나지 않은 순정 번들 기본 타일셋이면 그 생성기를 돌려준다.
 * 이미 읽혔거나 덮어쓰였거나 삭제되었으면 undefined(delete 는 descriptor 가 없어져 자동으로 걸러진다).
 */
export function pendingDefaultTilesetBuilder(
  dict: unknown,
  id: string,
): LazyDefaultTilesetBuilder | undefined {
  if (dict === null || typeof dict !== "object") return undefined;
  const map = pendingByDict.get(dict);
  if (!map) return undefined;
  const build = map.get(id);
  if (!build) return undefined;
  const desc = Object.getOwnPropertyDescriptor(dict, id);
  if (!desc || typeof desc.get !== "function") {
    map.delete(id);
    return undefined;
  }
  return build;
}

/** 미접근 순정 번들 타일셋의 미리 구운 SHA-256 요약(contentDigest 토큰 `#<digest>`). 없으면 undefined. */
export function bakedDigestForPendingDefaultTileset(id: string): string | undefined {
  return baked[id]?.digest;
}

/**
 * 타일셋 사전을 얕게 복사한다 — 이미 정착된 항목은 객체 참조를 그대로, 아직 안 깨어난 지연 자리는
 * 깨우지 않고 같은 지연 생성기로 새 사전에 등록한다. 키 순서는 원본과 같다.
 */
export function copyTilesetDictionaryPreservingLazy<T>(source: Record<string, T>): Record<string, T> {
  if (!hasPendingDefaultTilesets(source)) return { ...source };
  const copy: Record<string, T> = {};
  for (const id of Object.keys(source)) {
    const build = pendingDefaultTilesetBuilder(source, id);
    if (build) registerLazyDefaultTileset(copy, id, build as LazyDefaultTilesetBuilder<T>);
    else copy[id] = source[id]!;
  }
  return copy;
}
