import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

// Editor surfaces share validation per revision. The pure validator remains uncached:
// import/normalization callers may mutate a project in place between checks.
const cache = new WeakMap<Project, { lineage: number; generation: number; issues: readonly string[] }>();

export function collectEditorProjectReferenceIssues(project: Project): readonly string[] {
  const { lineage, generation } = store.getVersionToken();
  const previous = cache.get(project);
  if (previous?.lineage === lineage && previous.generation === generation) return previous.issues;
  const issues = collectProjectReferenceIssues(project);
  cache.set(project, { lineage, generation, issues });
  return issues;
}
