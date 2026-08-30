import { createBlankProject } from "@/project/defaults";

const ITEM_TYPES = ["normalGoods", "medicine", "book", "seed", "special", "switch"] as const;
const EQUIPMENT_SLOTS = ["weapon", "shield", "armor", "helmet", "accessory"] as const;

const project = createBlankProject();
const itemCounts = Object.fromEntries(
  ITEM_TYPES.map((type) => [type, project.database.items.filter((record) => record.type === type).length]),
);
const equipmentCounts = Object.fromEntries(
  EQUIPMENT_SLOTS.map((slot) => [slot, project.database.equipment.filter((record) => record.slot === slot).length]),
);

console.log("Default catalog counts");
console.log("Items:");
for (const type of ITEM_TYPES) console.log(`  ${type}: ${itemCounts[type]}`);
console.log("Equipment:");
for (const slot of EQUIPMENT_SLOTS) console.log(`  ${slot}: ${equipmentCounts[slot]}`);
console.log("JSON:");
console.log(JSON.stringify({ items: itemCounts, equipment: equipmentCounts }, null, 2));
