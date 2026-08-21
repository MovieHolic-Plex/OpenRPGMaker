import type {
  ActorRecord,
  BattleAnimationRecord,
  EnemyRecord,
  EquipmentRecord,
  ItemRecord,
  Project,
  SystemRecords,
} from "../types";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { bgmCatalogResourceIds } from "@/assets/bgmCatalogRuntime";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import { FARMING_RESOURCE_IDS } from "@/assets/farmingSprites";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { SCARLOXY_RESOURCE_IDS } from "@/assets/scarloxyPack";
import { assert } from "./guards";

export function collectResourceIds(project: Project): Set<string> {
  const ids = new Set<string>();
  for (const id of Object.keys(project.assets.sprites)) ids.add(id);
  for (const id of Object.keys(project.assets.uploaded)) ids.add(id);
  for (const profile of project.resourceProfiles) if (profile.assetId) ids.add(profile.assetId);
  for (const tileset of Object.values(project.tilesets)) ids.add(tileset.image.id);
  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status === "promoted") ids.add(asset.resourceId);
  }
  for (const id of builtinGeneratedResourceIds()) ids.add(id);
  for (const asset of EASYRPG_RTP_ASSETS) {
    ids.add(asset.id);
    if ("textureKey" in asset) ids.add(asset.textureKey);
  }
  for (const asset of CC0_ICON_ASSETS) ids.add(asset.id);
  for (const asset of CC0_AUDIO_ASSETS) ids.add(asset.id);
  // 281곡 BGM 카탈로그. 여기서 빠지면 이 곡을 지정한 프로젝트가 **역직렬화 자체에 실패**한다
  // (validateOptionalResource 가 알려진 id 집합에 없다며 assert 로 던진다).
  for (const id of bgmCatalogResourceIds()) ids.add(id);
  for (const id of SCARLOXY_RESOURCE_IDS) ids.add(id);
  for (const id of FARMING_RESOURCE_IDS) ids.add(id);
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

export function validateBattlerAnimationResources(animation: BattleAnimationRecord, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource(`battler animation ${animation.id}: resourceId`, animation.resourceId, resourceIds);
}

export function validateSystemResources(system: SystemRecords, resourceIds: ReadonlySet<string>): void {
  validateOptionalResource("system.titleResourceId", system.titleResourceId, resourceIds);
  validateOptionalResource("system.systemResourceId", system.systemResourceId, resourceIds);
  validateOptionalResource("system.battleSystemResourceId", system.battleSystemResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.backgroundResourceId", system.titleScreen?.backgroundResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.musicResourceId", system.titleScreen?.musicResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.sounds.cursorSeResourceId", system.titleScreen?.sounds?.cursorSeResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.sounds.confirmSeResourceId", system.titleScreen?.sounds?.confirmSeResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.sounds.cancelSeResourceId", system.titleScreen?.sounds?.cancelSeResourceId, resourceIds);
  validateOptionalResource("system.titleScreen.titleGraphic.resourceId", system.titleScreen?.titleGraphic?.resourceId, resourceIds);
  for (const [index, layer] of (system.titleScreen?.backgroundLayers ?? []).entries()) {
    validateOptionalResource(`system.titleScreen.backgroundLayers[${index}].resourceId`, layer.resourceId, resourceIds);
  }
}

export function validateOptionalResource(
  label: string,
  id: string | undefined,
  knownResourceIds: ReadonlySet<string>
): void {
  if (id === undefined) return;
  if (knownResourceIds.has(id)) return;
  const isGeneratedPrefix =
    id.startsWith("generated-enemy-") || id.startsWith("farming-crop-") || id.startsWith("easyrpg-monster-");
  if (!isGeneratedPrefix) {
    assert(knownResourceIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
    return;
  }
  const base = baseGeneratedResourceId(id);
  if (base && knownResourceIds.has(base)) return;
  assert(knownResourceIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
}

function baseGeneratedResourceId(id: string): string | null {
  for (const marker of ["-enemy_", "-species_"]) {
    const at = id.indexOf(marker);
    if (at > 0) return id.slice(0, at).replace(/-+$/u, "");
  }
  const cropDash = id.indexOf("-crop-");
  if (cropDash > 0) {
    const nextDash = id.indexOf("-", cropDash + 6);
    if (nextDash > 0) return id.slice(0, nextDash);
  }
  return null;
}
