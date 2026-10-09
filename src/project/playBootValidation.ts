// src/project/playBootValidation.ts
import { collectProjectReferenceIssues } from "./io/references";
import type { Project } from "./types";

export function validateProjectForPlay(project: Project): string[] {
  return collectProjectReferenceIssues(project);
}

// Non-blocking DEV diagnostic: validation must never prevent boot, so failures are swallowed on purpose.
export function warnIfPlayBootIssues(project: Project): void {
  if (!import.meta.env?.DEV) return;
  try {
    const issues = validateProjectForPlay(project);
    if (issues.length > 0) console.warn(`[play-boot] 프로젝트 참조 경고 ${issues.length}건:\n${issues.join("\n")}`);
  } catch {
    // deliberate: a validator error must not break game start
  }
}
