import { describe, expect, it } from "vitest";
import { CC0_ICON_ASSETS } from "@/assets/cc0IconAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import { ensureDefaultDatabaseIconResources } from "@/project/defaults/defaultDatabaseIconResources";
import { deserialize, serialize } from "@/project/io";

describe("safe CC0 item and equipment icons", () => {
  it("ships every declared icon file and resolves it at runtime", async () => {
    const existsSync = await loadExistsSync();

    expect(CC0_ICON_ASSETS.every((asset) => asset.license === "CC0-1.0" || asset.license === "generated")).toBe(true);
    expect(CC0_ICON_ASSETS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CC0_ICON_ASSETS.map((asset) => asset.id)).size).toBe(CC0_ICON_ASSETS.length);

    const missing = CC0_ICON_ASSETS.filter((asset) => !existsSync(`public/${asset.path}`)).map((asset) => asset.path);
    expect(missing).toEqual([]);
    expect(resolveAssetResourceUrl("cc0-jetrel-potion-red")).toBe("/assets/cc0/jetrel/icons/potion-red.png");
    expect(resolveAssetResourceUrl("cc0-jetrel-old-key")).toBe("/assets/cc0/jetrel/icons/old-key.png");
    expect(resolveAssetResourceUrl("cc0-jetrel-capture-orb")).toBe("/assets/cc0/jetrel/icons/capture-orb.png");
  });

  it("fills all default items and equipment with catalog image and icon resources", () => {
    const project = deserialize(serialize(createBlankProject()));
    const allowedIds = new Set(CC0_ICON_ASSETS.map((asset) => asset.id));
    const itemRefs = project.database.items.flatMap((item) => [item.imageResourceId, item.iconResourceId]);
    const equipmentRefs = project.database.equipment.flatMap((equipment) => [equipment.imageResourceId, equipment.iconResourceId]);
    const allRefs = [...itemRefs, ...equipmentRefs];

    expect(allRefs.every((id) => typeof id === "string" && allowedIds.has(id))).toBe(true);
    expect(project.resourceProfiles.filter((profile) => profile.assetId?.startsWith("cc0-jetrel-"))).toHaveLength(CC0_ICON_ASSETS.length);
  });

  it("ships a broad JRPG item catalog that uses every catalog icon across items and equipment", () => {
    const project = deserialize(serialize(createBlankProject()));
    const usedIcons = new Set([
      ...project.database.items.flatMap((item) => [item.imageResourceId, item.iconResourceId]),
      ...project.database.equipment.flatMap((equipment) => [equipment.imageResourceId, equipment.iconResourceId]),
    ]);
    const itemIds = new Set(project.database.items.map((item) => item.id));

    expect(project.database.items.length).toBeGreaterThanOrEqual(100);
    for (const asset of CC0_ICON_ASSETS) {
      expect(usedIcons).toContain(asset.id);
    }
    expect([...itemIds]).toEqual(
      expect.arrayContaining([
        "item_hi_potion",
        "item_elixir",
        "item_panacea",
        "item_warp_scroll",
        "item_guard_talisman",
        "item_lucky_charm",
        "item_old_key",
        "item_capture_orb",
      ]),
    );
    expect(project.database.items.find((item) => item.id === "item_old_key")).toMatchObject({
      imageResourceId: "cc0-jetrel-old-key",
      iconResourceId: "cc0-jetrel-old-key",
    });
    expect(project.database.items.find((item) => item.id === "item_capture_orb")).toMatchObject({
      imageResourceId: "cc0-jetrel-capture-orb",
      iconResourceId: "cc0-jetrel-capture-orb",
    });
    expect(project.database.items.find((item) => item.id === "item_warp_scroll")).toMatchObject({
      imageResourceId: "cc0-jetrel-warp-scroll",
      iconResourceId: "cc0-jetrel-warp-scroll",
    });
    expect(project.database.items.find((item) => item.id === "item_blank_scroll")).toMatchObject({
      imageResourceId: "cc0-jetrel-scroll",
      iconResourceId: "cc0-jetrel-scroll",
    });
    expect(project.database.items.find((item) => item.id === "item_traveler_badge")).toMatchObject({
      imageResourceId: "cc0-jetrel-traveler-badge",
      iconResourceId: "cc0-jetrel-traveler-badge",
    });
    expect(project.database.items.find((item) => item.id === "item_guild_badge")).toMatchObject({
      imageResourceId: "cc0-jetrel-badge",
      iconResourceId: "cc0-jetrel-badge",
    });
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

  it("keeps sparse existing catalogs unchanged instead of resurrecting deleted items", () => {
    const project = createBlankProject();
    project.database.items = project.database.items.slice(0, 1);

    expect(ensureDefaultDatabaseIconResources(project)).toBe(false);
    expect(project.database.items.length).toBe(1);
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
