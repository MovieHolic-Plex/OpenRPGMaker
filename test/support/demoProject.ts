import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import type { Project, TilesetDef } from "@/project/types";

// createScarloxyDemoProject() 도 createBlankProject() 처럼 부를 때마다 번들 타일셋(77MB)을 새로 짓는다(약 3 s).
// freshBlankProject()(blankProject.ts)와 같은 규칙: 파일마다 한 번 짓고 타일셋은 깊이 얼려 참조로 나누고, 나머지만 복제한다.
// 얼린 타일셋을 제자리에서 고치면 다른 케이스로 새지 않고 그 자리에서 TypeError 가 난다.
let cached: { readonly rest: Omit<Project, "tilesets">; readonly tilesets: Readonly<Record<string, TilesetDef>> } | undefined;

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
}

/** createScarloxyDemoProject() 와 같은 값의 독립 사본(타일셋은 동결 공유). */
export function freshScarloxyDemoProject(): Project {
  if (!cached) {
    const { tilesets, ...rest } = createScarloxyDemoProject();
    for (const tileset of Object.values(tilesets)) deepFreeze(tileset);
    cached = { rest, tilesets };
  }
  return { ...structuredClone(cached.rest), tilesets: { ...cached.tilesets } };
}

/**
 * structuredClone(project) 와 값·키 순서가 같은 사본. 타일셋 항목은 복제하지 않고 같은 객체를 가리킨다 —
 * 얼린 타일셋을 가진 프로젝트(freshScarloxyDemoProject · freshBlankProject)에만 쓴다.
 */
export function cloneSharingFrozenTilesets(project: Project): Project {
  return { ...structuredClone({ ...project, tilesets: {} }), tilesets: { ...project.tilesets } };
}
