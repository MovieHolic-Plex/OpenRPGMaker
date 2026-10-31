import type { MonsterResource } from "@/assets/monsterResourceCatalog";
import { monsterBattleCells, monsterBattleMotion } from "@/assets/pixelEnemySheets";
import type { Project } from "@/project/types";
import { sha256HexTextSync } from "@/util/sha256";

/** Full read/evidence projection. Image data stays local; only its digest crosses the tool boundary. */
export function monsterResourceSnapshot(project: Project, resource: MonsterResource): MonsterResource & { readonly assetIdentity: string; readonly battleMotion?: string; readonly battleCells?: 16 } {
  const upload = project.assets.uploaded[resource.resourceId];
  // Bundled/profile sources are fixed by raw ID in the running asset build; uploads are project-mutable.
  const imageSource = [resource.resourceId, upload?.dataUrl ?? null, upload?.meta ?? null];
  const battleMotion = monsterBattleMotion(project, resource.resourceId);
  const battleCells = battleMotion ? monsterBattleCells(project, resource.resourceId) : undefined;
  return { ...resource, assetIdentity: `sha256:${sha256HexTextSync(JSON.stringify(imageSource))}`, ...(battleMotion ? { battleMotion } : {}), ...(battleCells === 16 ? { battleCells } : {}) };
}
