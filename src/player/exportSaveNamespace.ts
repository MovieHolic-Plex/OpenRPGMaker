import type { Project } from "@/project/types";
import { exportedProjectId } from "@/player/exportProjectStoreShim";

export type ExportProjectSource = "bundled" | "opened-file";

export interface ExportSaveNamespaceOptions {
  readonly source: ExportProjectSource;
  readonly hostSaveNamespace?: string;
  readonly pathname: string;
}

export function resolveExportSaveNamespace(
  project: Project,
  options: ExportSaveNamespaceOptions,
): string {
  const projectNamespace = `rpgzzu-export:${exportedProjectId(project)}`;
  if (options.source === "opened-file") return projectNamespace;

  const communitySlug = /^\/play\/([^/]+)/.exec(options.pathname)?.[1];
  return options.hostSaveNamespace
    ?? (communitySlug
      ? `rpgzzu-export:${decodeURIComponent(communitySlug)}`
      : projectNamespace);
}
