import { describe, expect, it } from "vitest";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { deserialize, serialize } from "@/project/io";

describe("safe CC0 item and equipment icons", () => {
  it("ships every declared CC0 icon file and resolves it at runtime", async () => {
    const existsSync = await loadExistsSync();

    expect(CC0_ICON_ASSETS.every((asset) => asset.license === "CC0-1.0")).toBe(true);
    expect(CC0_ICON_ASSETS.map((asset) => asset.id)).toEqual([
      "cc0-jetrel-potion-red",
      "cc0-jetrel-ether-blue",
      "cc0-jetrel-antidote-green",
      "cc0-jetrel-wake-herb",
      "cc0-jetrel-poison-dart",
      "cc0-jetrel-old-key-scroll",
      "cc0-jetrel-bronze-sword",
      "cc0-jetrel-mage-staff",
      "cc0-jetrel-scout-dagger",
      "cc0-jetrel-oak-shield",
      "cc0-jetrel-leather-armor",
      "cc0-jetrel-mystic-robe",
      "cc0-jetrel-traveler-hat",
      "cc0-jetrel-focus-charm",
    ]);

    const missing = CC0_ICON_ASSETS.filter((asset) => !existsSync(`public/${asset.path}`)).map((asset) => asset.path);
    expect(missing).toEqual([]);
    expect(resolveAssetResourceUrl("cc0-jetrel-potion-red")).toBe("/assets/cc0/jetrel/icons/potion-red.png");
  });

  it("fills all default items and equipment with safe CC0 image and icon resources", () => {
    const project = deserialize(serialize(createBlankProject()));
    const allowedIds = new Set(CC0_ICON_ASSETS.map((asset) => asset.id));
    const itemRefs = project.database.items.flatMap((item) => [item.imageResourceId, item.iconResourceId]);
    const equipmentRefs = project.database.equipment.flatMap((equipment) => [equipment.imageResourceId, equipment.iconResourceId]);
    const allRefs = [...itemRefs, ...equipmentRefs];

    expect(allRefs.every((id) => typeof id === "string" && allowedIds.has(id))).toBe(true);
    expect(project.resourceProfiles.filter((profile) => profile.assetId?.startsWith("cc0-jetrel-"))).toHaveLength(CC0_ICON_ASSETS.length);
  });

  it("ships a broad JRPG item catalog that uses every safe CC0 icon in the Items database", () => {
    const project = deserialize(serialize(createBlankProject()));
    const usedItemIcons = new Set(project.database.items.flatMap((item) => [item.imageResourceId, item.iconResourceId]));
    const itemIds = new Set(project.database.items.map((item) => item.id));

    expect(project.database.items.length).toBeGreaterThanOrEqual(20);
    for (const asset of CC0_ICON_ASSETS) {
      expect(usedItemIcons).toContain(asset.id);
    }
    expect([...itemIds]).toEqual(
      expect.arrayContaining([
        "item_hi_potion",
        "item_elixir",
        "item_panacea",
        "item_warp_scroll",
        "item_guard_talisman",
        "item_lucky_charm",
      ]),
    );
  });

  it("upgrades existing default database rows that are missing item and equipment icons", () => {
    const project = createBlankProject();
    for (const item of project.database.items) {
      item.imageResourceId = undefined;
      item.iconResourceId = undefined;
    }
    for (const equipment of project.database.equipment) {
      equipment.imageResourceId = undefined;
      equipment.iconResourceId = undefined;
    }

    expect(ensureDefaultDatabaseIconResources(project)).toBe(true);
    expect(project.database.items.find((item) => item.id === "item_potion")).toMatchObject({
      imageResourceId: "cc0-jetrel-potion-red",
      iconResourceId: "cc0-jetrel-potion-red",
    });
    expect(project.database.equipment.find((equipment) => equipment.id === "equip_mage_staff")).toMatchObject({
      imageResourceId: "cc0-jetrel-mage-staff",
      iconResourceId: "cc0-jetrel-mage-staff",
    });
    expect(ensureDefaultDatabaseIconResources(project)).toBe(false);
  });

  it("preserves existing customized icons when upgrading sparse saved projects", () => {
    const project = createBlankProject();
    const potion = project.database.items.find((item) => item.id === "item_potion");
    const sword = project.database.equipment.find((equipment) => equipment.id === "equip_sword");
    if (potion === undefined || sword === undefined) throw new Error("missing starter records");
    potion.imageResourceId = "custom-potion-image";
    potion.iconResourceId = "custom-potion-icon";
    sword.imageResourceId = "custom-sword-image";
    sword.iconResourceId = "custom-sword-icon";

    expect(ensureDefaultDatabaseIconResources(project)).toBe(false);
    expect(project.database.items.find((item) => item.id === "item_potion")).toMatchObject({
      imageResourceId: "custom-potion-image",
      iconResourceId: "custom-potion-icon",
    });
    expect(project.database.equipment.find((equipment) => equipment.id === "equip_sword")).toMatchObject({
      imageResourceId: "custom-sword-image",
      iconResourceId: "custom-sword-icon",
    });
  });

  it("expands sparse existing projects with the default JRPG item catalog without duplicates", () => {
    const project = createBlankProject();
    project.database.items = project.database.items.slice(0, 1);

    expect(ensureDefaultDatabaseIconResources(project)).toBe(true);
    expect(project.database.items.length).toBeGreaterThanOrEqual(20);
    expect(new Set(project.database.items.map((item) => item.id)).size).toBe(project.database.items.length);
    expect(ensureDefaultDatabaseIconResources(project)).toBe(false);
  });
});

async function loadExistsSync(): Promise<(path: string) => boolean> {
  const moduleName = "node:fs";
  const fsModule = await import(moduleName);
  if (typeof fsModule.existsSync !== "function") throw new Error("node:fs existsSync is unavailable");
  return fsModule.existsSync;
}
