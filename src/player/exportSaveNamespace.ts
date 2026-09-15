import type { Project } from "@/project/types";
import { exportedProjectId } from "@/player/exportProjectStoreShim";
import { EXPORT_SAVE_NAMESPACE_PREFIX } from "@/player/exportSaveNamespacePrefix";

export type ExportProjectSource = "bundled" | "opened-file";

/** The immutable community listing path is host authority; project IDs and boot overrides are not. */
export function resolveCommunitySaveScope(pathname: string): string | undefined {
  const slug = /^\/play\/([^/]+)(?:\/|$)/.exec(pathname)?.[1];
  return slug === undefined ? undefined : decodeURIComponent(slug);
}

export interface ExportSaveNamespaceOptions {
  readonly source: ExportProjectSource;
  readonly hostSaveNamespace?: string;
  readonly pathname: string;
}

export function resolveExportSaveNamespace(
  project: Project,
  options: ExportSaveNamespaceOptions,
): string {
  const projectNamespace = `${EXPORT_SAVE_NAMESPACE_PREFIX}${exportedProjectId(project)}`;
  if (options.source === "opened-file") return projectNamespace;

  const communitySlug = /^\/play\/([^/]+)/.exec(options.pathname)?.[1];
  return options.hostSaveNamespace
    ?? (communitySlug
      ? `${EXPORT_SAVE_NAMESPACE_PREFIX}${decodeURIComponent(communitySlug)}`
      : projectNamespace);
}
