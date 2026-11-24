import { createBlankProject } from "@/project/defaults";
import type { Project, TilesetDef } from "@/project/types";

// createBlankProject() 는 호출마다 약 80MB(그중 번들 타일셋 77MB, 객체 77만 개)를 새로 만든다 — 실측 2.7~3.3 s.
// 케이스마다 그것을 부르던 테스트가 느린 시간의 대부분이었다. structuredClone(전체) 는 1.9 s 로 겨우 30% 싼 데 그친다
// (복제 비용도 타일셋 크기에 비례). 그래서 타일셋만 참조로 공유하고 나머지(DB·맵·세션 ≈3MB)만 복제한다 → 호출당 ≈50 ms.
//
// 공유하는 타일셋은 **깊은 동결**이다. 한 테스트가 고치면 다른 테스트로 새는 대신 그 자리에서 TypeError 가 난다.
// 타일셋을 고쳐야 하는 테스트는 ownTileset() 으로 그 하나만 복제해 쓴다.
// 캐시는 모듈(= vitest 파일) 단위다. 첫 호출이 createBlankProject() 한 번 + 동결(≈0.25 s) 값을 낸다.
let cached: { readonly rest: Omit<Project, "tilesets">; readonly tilesets: Readonly<Record<string, TilesetDef>> } | undefined;

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
    return;
  }
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
}

/**
 * createBlankProject() 와 같은 값의 독립 사본. 호출자가 마음대로 고쳐도 되지만 `tilesets` 안의 각 타일셋은
 * 동결된 공유본이다(레코드 자체는 새것이라 타일셋 추가·교체는 된다). 타일셋 내용을 고쳐야 하면 ownTileset().
 */
export function freshBlankProject(): Project {
  if (!cached) {
    const { tilesets, ...rest } = createBlankProject();
    for (const tileset of Object.values(tilesets)) deepFreeze(tileset);
    cached = { rest, tilesets };
  }
  return { ...structuredClone(cached.rest), tilesets: { ...cached.tilesets } };
}

/** project.tilesets[id] 를 동결된 공유본에서 고칠 수 있는 개인 사본으로 바꿔 돌려준다. */
export function ownTileset(project: Project, id: string): TilesetDef {
  const shared = project.tilesets[id];
  if (!shared) throw new Error(`[freshBlankProject] 타일셋 ${id} 가 없습니다`);
  const own = structuredClone(shared);
  project.tilesets[id] = own;
  return own;
}
