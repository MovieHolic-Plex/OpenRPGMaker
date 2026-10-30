// Export player stub for @/project/store. Needed because store.ts pulls project storage
// client + dev showcase factory wiring that the exported player must not bundle.

import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { setPixelEnemySheetProjectSource } from "@/assets/pixelEnemySheets";

let currentProject: Project = createBlankProject();

export function setExportedProject(project: Project): void {
  currentProject = project;
}

export function exportedProjectId(project: Project = currentProject): string {
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
    return currentProject;
  },

  subscribe(_listener: unknown): () => void {
    return () => {};
  },

  beginReadOnlyProjectSnapshot(project: Project, options: { readonly owned?: boolean } = {}): () => void {
    const previous = currentProject;
    const snapshot = options.owned ? project : structuredClone(project);
    currentProject = snapshot;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (currentProject === snapshot) currentProject = previous;
    };
  },
};

// 저작 적 도트 시트(project.assets.uploaded)를 내보낸 플레이어 전투도 찾게 한다(store.ts 와 같은 등록).
setPixelEnemySheetProjectSource(() => currentProject);
