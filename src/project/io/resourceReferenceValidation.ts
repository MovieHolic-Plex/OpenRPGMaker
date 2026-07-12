import type {
  ActorRecord,
  BattleAnimationRecord,
  BattlerAnimationRecord,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  Project,
  SystemRecords,
} from "../types";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { RM2K3_GENERATED_ASSET_PLAN } from "@/assets/rm2k3GeneratedAssetPlan";
import { SCARLOXY_RESOURCE_IDS } from "@/assets/scarloxyPack";
import { assert } from "./guards";

export function collectResourceIds(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const id of Object.keys(project.assets.sprites)) ids.add(id);
  for (const id of Object.keys(project.assets.uploaded)) ids.add(id);
  for (const profile of project.resourceProfiles) if (profile.assetId) ids.add(profile.assetId);
  for (const tileset of Object.values(project.tilesets)) ids.add(tileset.image.id);
  for (const asset of RM2K3_GENERATED_ASSET_PLAN.assets) {
    if (asset.status === "promoted") ids.add(asset.resourceId);
  }
  for (const id of builtinGeneratedResourceIds()) ids.add(id);
  for (const asset of EASYRPG_RTP_ASSETS) {
    ids.add(asset.id);
    if ("textureKey" in asset) ids.add(asset.textureKey);
  }
  for (const asset of CC0_ICON_ASSETS) ids.add(asset.id);
  for (const id of SCARLOXY_RESOURCE_IDS) ids.add(id);
  return ids;
}

export function validateActorResources(actor: ActorRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`actor ${actor.id}: faceResourceId`, actor.faceResourceId, resourceIds);
  validateOptionalResource(`actor ${actor.id}: characterResourceId`, actor.characterResourceId, resourceIds);
  validateOptionalResource(`actor ${actor.id}: battleCharacterResourceId`, actor.battleCharacterResourceId, resourceIds);
}

export function validateItemResources(item: ItemRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`item ${item.id}: imageResourceId`, item.imageResourceId, resourceIds);
  validateOptionalResource(`item ${item.id}: iconResourceId`, item.iconResourceId, resourceIds);
}

export function validateEquipmentResources(equipment: EquipmentRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`equipment ${equipment.id}: imageResourceId`, equipment.imageResourceId, resourceIds);
  validateOptionalResource(`equipment ${equipment.id}: iconResourceId`, equipment.iconResourceId, resourceIds);
}

export function validateEnemyResources(enemy: EnemyRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`enemy ${enemy.id}: monsterResourceId`, enemy.monsterResourceId, resourceIds);
}

export function validateAnimationResource(animation: BattleAnimationRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`animation ${animation.id}: resourceId`, animation.resourceId, resourceIds);
  for (const timing of animation.timings ?? []) validateOptionalResource(`animation ${animation.id}: timing soundResourceId`, timing.soundResourceId, resourceIds);
}

export function validateBattlerAnimationResources(animation: BattlerAnimationRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`battler animation ${animation.id}: resourceId`, animation.resourceId, resourceIds);
}

export function validateSystemResources(system: SystemRecords, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource("system.titleResourceId", system.titleResourceId, resourceIds);
  validateOptionalResource("system.systemResourceId", system.systemResourceId, resourceIds);
  validateOptionalResource("system.battleSystemResourceId", system.battleSystemResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.backgroundResourceId", system.titleScreen?.backgroundResourceId, resourceIds);
}

export function validateOptionalResource(
  label: string,
  id: string | undefined,
  knownResourceIds: ReadonlySet<string>
): void {
  if (id === undefined) return;
  assert(knownResourceIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
}
