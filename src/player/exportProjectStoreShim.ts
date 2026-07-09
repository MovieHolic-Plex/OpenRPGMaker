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
};
