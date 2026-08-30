import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";

const AUTHORABLE_ITEM_TYPES = ["normalGoods", "medicine", "book", "seed", "special", "switch"] as const;
const EQUIPMENT_SLOTS = ["weapon", "shield", "armor", "helmet", "accessory"] as const;
const WEARABLE_ITEM_TYPES = ["weapon", "shield", "body", "head", "accessory"] as const;

describe("default catalog minimum per type", () => {
  it("keeps at least ten records in every authorable item and equipment category", () => {
    const project = createBlankProject();

    for (const type of AUTHORABLE_ITEM_TYPES) {
      const count = project.database.items.filter((record) => record.type === type).length;
      expect(count, `item type ${type}`).toBeGreaterThanOrEqual(10);
    }

    for (const slot of EQUIPMENT_SLOTS) {
      const count = project.database.equipment.filter((record) => record.slot === slot).length;
      expect(count, `equipment slot ${slot}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps wearable gear out of the item catalog", () => {
    const project = createBlankProject();

    // openwiki/editor-database.md 계약: 착용 장비는 project.database.equipment에만 둔다.
    for (const type of WEARABLE_ITEM_TYPES) {
      const count = project.database.items.filter((record) => record.type === type).length;
      expect(count, `wearable item type ${type}`).toBe(0);
    }
  });
});
