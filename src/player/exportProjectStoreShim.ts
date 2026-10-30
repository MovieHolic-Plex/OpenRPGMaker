// Export player stub for @/project/store. Needed because store.ts pulls project storage
// client + dev showcase factory wiring that the exported player must not bundle.

import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";

// 빈 프로젝트는 처음 물을 때 만든다. 모듈을 읽을 때 만들면 기본 타일셋 정의(번들 칩셋 JSON 전부, 수십 MB)를
// 부팅 첫 순간에 동기로 읽는다 — 실제 게임을 setExportedProject 로 넣기 전이라 그 일은 통째로 버려진다.
let loadedProject: Project | null = null;
function current(): Project {
  return (loadedProject ??= createBlankProject());
}

export function setExportedProject(project: Project): void {
  loadedProject = project;
}

export function exportedProjectId(project: Project = current()): string {
  const basis = `${project.meta.title}:${project.meta.author}`.trim() || "project";
  const slug = basis
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "project";
}

export const store = {
  getCurrent(): Project {
    return current();
  },

  subscribe(_listener: unknown): () => void {
    return () => {};
  },

  beginReadOnlyProjectSnapshot(project: Project, options: { readonly owned?: boolean } = {}): () => void {
    const previous = loadedProject;
    const snapshot = options.owned ? project : structuredClone(project);
    loadedProject = snapshot;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (loadedProject === snapshot) loadedProject = previous;
    };
  },
};

// 저작 적 도트 시트(project.assets.uploaded)를 내보낸 플레이어 전투도 찾게 한다(store.ts 와 같은 등록).
// 게임을 넣기 전에는 저작 시트가 없다 — 빈 프로젝트를 만들지 않고 번들 시트만 찾게 둔다.
setPixelEnemySheetProjectSource(() => loadedProject ?? undefined);
