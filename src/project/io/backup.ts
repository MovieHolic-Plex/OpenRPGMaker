import { SCHEMA_VERSION } from "../types";
import type { Project } from "../types";
import { ProjectFormatError } from "./errors";
import { deepClone } from "./guards";

export interface ProjectBackup {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly project: Project;
}

export function createProjectBackup(project: Project): ProjectBackup {
  return {
    schemaVersion: SCHEMA_VERSION,
    project: deepClone(project),
  };
}

export function restoreProjectBackup(backup: ProjectBackup): Project {
  if (backup.schemaVersion !== SCHEMA_VERSION) {
    throw new ProjectFormatError(`백업 스키마 버전 불일치: ${backup.schemaVersion}`);
  }
  return deepClone(backup.project);
}
