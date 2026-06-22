import type { ResourceKind } from "@/project/types";

export const GENERATED_ASSET_TARGETS = [
  "actorFace",
  "actorCharset",
  "actorBattleCharset",
  "enemyMonster",
  "itemImage",
  "itemIcon",
  "equipmentImage",
  "equipmentIcon",
  "troopPreview",
] as const;

export const GENERATION_STATUSES = ["planned", "generated", "validated", "promoted", "rejected"] as const;

export const IMAGE_RESOURCE_KINDS = [
  "chipset",
  "charset",
  "battleCharset",
  "battleWeapon",
  "backdrop",
  "monster",
  "faceset",
  "picture",
  "system",
  "system2",
  "title",
] as const satisfies readonly ResourceKind[];

export const BANNED_PROMPT_TERMS = [
  "easy rpg rtp",
  "easyrpg rtp",
  "official rtp",
  "enterbrain",
  "square enix",
  "nintendo",
  "pokemon",
  "zelda",
  "mario",
] as const;

export const UNSAFE_GENERATED_FILE_NAMES = ["output.png", "test.png", "image.png"] as const;
