import type { Project } from "@/project/types";
import {
  EQUIPMENT_FOCUS_CHARM_ID,
  EQUIPMENT_LEATHER_ARMOR_ID,
  EQUIPMENT_MAGE_STAFF_ID,
  EQUIPMENT_MYSTIC_ROBE_ID,
  EQUIPMENT_OAK_SHIELD_ID,
  EQUIPMENT_SCOUT_DAGGER_ID,
  EQUIPMENT_TRAVELER_HAT_ID,
} from "./defaultDatabaseRecordIds";
import { DEFAULT_EQUIPMENT_ID } from "./constants";
import { defaultItemRecords } from "./defaultDatabaseItemRecords";

const DEFAULT_ITEM_ICON_RESOURCE_BY_ID = new Map(
  defaultItemRecords()
    .filter((item) => item.iconResourceId !== undefined)
    .map((item) => [item.id, item.iconResourceId]),
);

const DEFAULT_EQUIPMENT_ICON_RESOURCE_BY_ID: Readonly<Record<string, string>> = {
  [DEFAULT_EQUIPMENT_ID]: "cc0-jetrel-bronze-sword",
  [EQUIPMENT_MAGE_STAFF_ID]: "cc0-jetrel-mage-staff",
  [EQUIPMENT_SCOUT_DAGGER_ID]: "cc0-jetrel-scout-dagger",
  equip_iron_sword: "cc0-jetrel-iron-sword",
  equip_steel_sword: "cc0-jetrel-steel-sword",
  equip_short_sword: "cc0-jetrel-scout-dagger",
  [EQUIPMENT_OAK_SHIELD_ID]: "cc0-jetrel-oak-shield",
  [EQUIPMENT_LEATHER_ARMOR_ID]: "cc0-jetrel-leather-armor",
  [EQUIPMENT_MYSTIC_ROBE_ID]: "cc0-jetrel-mystic-robe",
  [EQUIPMENT_TRAVELER_HAT_ID]: "cc0-jetrel-traveler-hat",
  [EQUIPMENT_FOCUS_CHARM_ID]: "cc0-jetrel-focus-charm",
  equip_iron_shield: "cc0-jetrel-iron-shield",
  equip_steel_armor: "cc0-jetrel-steel-armor",
  equip_mage_hat: "cc0-jetrel-mage-hat",
  equip_gloves: "cc0-jetrel-gloves",
  equip_boots: "cc0-jetrel-boots",
  equip_cloak: "cc0-jetrel-cloak",
  equip_ring: "cc0-jetrel-ring",
  equip_necklace: "cc0-jetrel-necklace",
  equip_focus_ring: "cc0-jetrel-focus-ring",
};

export function ensureDefaultDatabaseIconResources(project: Project): boolean {
  let changed = false;

  for (const item of project.database.items) {
    const resourceId = DEFAULT_ITEM_ICON_RESOURCE_BY_ID.get(item.id);
    if (resourceId === undefined) continue;
    changed = assignImageAndIcon(item, resourceId) || changed;
  }

  for (const equipment of project.database.equipment) {
    const resourceId = DEFAULT_EQUIPMENT_ICON_RESOURCE_BY_ID[equipment.id];
    if (resourceId === undefined) continue;
    changed = assignImageAndIcon(equipment, resourceId) || changed;
  }

  return changed;
}

function assignImageAndIcon(record: { imageResourceId?: string; iconResourceId?: string }, resourceId: string): boolean {
  let changed = false;
  if (shouldFillResourceId(record.imageResourceId)) {
    record.imageResourceId = resourceId;
    changed = true;
  }
  if (shouldFillResourceId(record.iconResourceId)) {
    record.iconResourceId = resourceId;
    changed = true;
  }
  return changed;
}

function shouldFillResourceId(resourceId: string | undefined): boolean {
  return resourceId === undefined || resourceId.length === 0 || resourceId === "easyrpg-battle-weapon-weapon";
}
