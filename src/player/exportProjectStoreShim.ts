// Export player stub for @/project/store. Needed because store.ts pulls Supabase
// client + dev showcase factory wiring that the exported player must not bundle.

import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

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

  beginReadOnlyProjectSnapshot(project: Project): () => void {
    const previous = currentProject;
    const snapshot = structuredClone(project);
    currentProject = snapshot;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (currentProject === snapshot) currentProject = previous;
    };
  },
};
