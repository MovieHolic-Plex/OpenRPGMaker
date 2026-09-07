import type { MonsterResource } from "@/assets/monsterResourceCatalog";
import type { Project } from "@/project/types";
import { sha256HexTextSync } from "@/util/sha256";

/** Full read/evidence projection. Image data stays local; only its digest crosses the tool boundary. */
export function monsterResourceSnapshot(project: Project, resource: MonsterResource): MonsterResource & { readonly assetIdentity: string } {
  const upload = project.assets.uploaded[resource.resourceId];
  // Bundled/profile sources are fixed by raw ID in the running asset build; uploads are project-mutable.
  const imageSource = [resource.resourceId, upload?.dataUrl ?? null, upload?.meta ?? null];
  return { ...resource, assetIdentity: `sha256:${sha256HexTextSync(JSON.stringify(imageSource))}` };
}
