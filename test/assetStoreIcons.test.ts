// 스토어 아이콘 팩(kind "icon", 32×32 PNG 한 장씩, meta.oprnIcon): 매니페스트 검사 → 넣기(크기 검사·자료집 목록) → 아이콘 고르기 →
// upsert 자동 아이콘 → assign_store_icons 일괄 배정 → 스킬·상태 iconResourceId 정규화·참조 검사.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STORE_ICON_SIZE, storeImageSizeProblem, storeProjectId, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { applyPackToProject } from "@/assetStore/pack";
import { subsetAudioManifest } from "@/assetStore/storeSoundPick";
import { inferIconElement, planIconAssignments, rankStoreIcons, readStoreIconMeta, projectStoreIcons } from "@/assetStore/storeIconPick";
import { addStoreProfiles } from "@/editor/assetStore/storeProfiles";
import { uploadedMatchesKind } from "@/editor/resourceOptions";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { STORE_ICON_TOOLS } from "@/editor/tools/storeIconTools";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { validateProjectReferences } from "@/project/io/references";
import type { Project } from "@/project/types";

function png(width: number, height: number, salt = 0): Uint8Array {
  const bytes = new Uint8Array(33 + salt);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const ICONS = [
  { id: "sword-iron", nameEn: "Iron sword", nameKo: "철검", category: "weapon", itemType: "weapon", element: "", tags: ["sword", "blade", "검"] },
  { id: "potion-red", nameEn: "Healing potion", nameKo: "회복 물약", category: "consumable", itemType: "medicine", element: "", tags: ["potion", "heal", "hp", "물약", "포션"] },
  { id: "magic-fire-1", nameEn: "Fire", nameKo: "파이어", category: "skill", itemType: "skill", element: "fire", tags: ["magic", "spell", "fire", "불", "마법"] },
  { id: "st-poison", nameEn: "Poison", nameKo: "독", category: "state", itemType: "state", element: "poison", tags: ["poison", "독", "status"] },
  { id: "shield-wood", nameEn: "Wooden shield", nameKo: "나무 방패", category: "armor", itemType: "shield", element: "", tags: ["shield", "방패"] },
] as const;

function iconPack(size = STORE_ICON_SIZE): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
  const blobs = new Map<string, Uint8Array>();
  const assets: StorePackManifest["content"]["assets"] = {};
  ICONS.forEach((icon, index) => {
    const bytes = png(size, size, index);
    blobs.set(sha(bytes), bytes);
    assets[icon.id] = {
      id: icon.id, name: icon.nameEn, kind: "icon", blob: sha(bytes), mime: "image/png",
      meta: { width: size, height: size, oprnIcon: { version: 1, ...icon } } as never,
      generation: { method: "mixed", engine: "test", model: "test-model" },
    };
  });
  const first = [...blobs.keys()][0]!;
  return {
    manifest: {
      schema: "oprn-store-pack/1", title: "Test icons", summary: "", description: "", tags: [], kind: "icon", license: "OPRN-GAME", aiGenerated: true, credits: "AI",
      content: { assets, tilesets: {} }, previews: [first],
      blobs: [...blobs].map(([key, bytes]) => ({ sha256: key, mime: "image/png" as const, bytes: bytes.byteLength })),
    },
    blobs,
  };
}
const SLUG = "oprn-icons-test";
const context = (blobs: Map<string, Uint8Array>) => ({ slug: SLUG, version: 1, author: "OPRN", storeUrl: "https://store.example", itemUrl: "https://store.example/items/x", blob: (key: string) => blobs.get(key)! });

function projectWithIcons(): Project {
  const project = createBlankProject();
  const { manifest, blobs } = iconPack();
  const result = applyPackToProject(project, manifest, context(blobs));
  addStoreProfiles(project, result.assetIds);
  return project;
}

const tool = (name: string) => [...DB_TOOLS, ...STORE_ICON_TOOLS].find((entry) => entry.name === name)!;

describe("store icon kind", () => {
  it("accepts an icon pack and enforces 32×32", () => {
    expect(validateManifest(iconPack().manifest).ok).toBe(true);
    expect(storeImageSizeProblem("icon", 32, 32)).toBeNull();
    expect(storeImageSizeProblem("icon", 24, 24)).toContain("32×32");
    const { manifest, blobs } = iconPack(48);
    expect(() => applyPackToProject(createBlankProject(), manifest, context(blobs))).toThrow(/32×32/);
  });

  it("installs icons as kind icon with meta, profiles and editor picker visibility", () => {
    const project = projectWithIcons();
    const id = storeProjectId(SLUG, "sword-iron");
    expect(project.assets.uploaded[id]).toMatchObject({ kind: "icon", origin: { itemSlug: SLUG } });
    expect(readStoreIconMeta(project.assets.uploaded[id]!.meta)?.nameKo).toBe("철검");
    expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "icon")).toBe(true);
    expect(uploadedMatchesKind("icon", "icon", id)).toBe(true);
    expect(uploadedMatchesKind("image", "icon", id)).toBe(true);
    expect(projectStoreIcons(project)).toHaveLength(ICONS.length);
  });

  it("subsets an icon pack to picked icons", () => {
    const { manifest } = iconPack();
    const subset = subsetAudioManifest(manifest, ["potion-red"]);
    expect(Object.keys(subset.content.assets)).toEqual(["potion-red"]);
    expect(subset.blobs).toHaveLength(1);
  });

  it("ranks by name, item type and element and keeps skills/states apart from items", () => {
    const icons = projectStoreIcons(projectWithIcons());
    expect(rankStoreIcons(icons, { target: "item", name: "회복 물약", itemType: "medicine" })[0]?.id).toBe(storeProjectId(SLUG, "potion-red"));
    expect(rankStoreIcons(icons, { target: "equipment", name: "Bronze sword", itemType: "weapon" })[0]?.id).toBe(storeProjectId(SLUG, "sword-iron"));
    expect(rankStoreIcons(icons, { target: "skill", name: "불꽃", element: "fire" })[0]?.id).toBe(storeProjectId(SLUG, "magic-fire-1"));
    expect(rankStoreIcons(icons, { target: "item", name: "독" }).some((icon) => icon.id === storeProjectId(SLUG, "st-poison"))).toBe(false);
    expect(rankStoreIcons(icons, { target: "state", name: "독 poison" })[0]?.id).toBe(storeProjectId(SLUG, "st-poison"));
  });

  it("reads elements by whole words only (열쇠 is not fire, 돌아가는 is not earth)", () => {
    expect(inferIconElement("낡은 열쇠", "오래된 문을 열 수 있을 것 같은 열쇠입니다.")).toBe("");
    expect(inferIconElement("귀환 주문서", "마을이나 안전 지점으로 돌아가는 아이템입니다.")).toBe("");
    expect(inferIconElement("물약")).toBe("");
    expect(inferIconElement("암석 파쇄", "대지 속성으로 적을 짓누릅니다.")).toBe("earth");
    expect(inferIconElement("성광", "신성 속성으로 적을 정화합니다.")).toBe("light");
    expect(inferIconElement("불의 화살")).toBe("fire");
    expect(inferIconElement("독")).toBe("poison");
  });

  it("upsert_* auto-picks a confident store icon and leaves others empty", () => {
    const project = projectWithIcons();
    const item = tool("upsert_item").run(project, { item: { id: "item_hp", name: "회복 물약", type: "medicine", price: 50 } });
    expect((item as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "potion-red"));
    const odd = tool("upsert_item").run(project, { item: { id: "item_odd", name: "Mysterious thing", price: 5 } });
    expect((odd as { data: { iconResourceId?: string } }).data.iconResourceId).toBeUndefined();
    const given = tool("upsert_item").run(project, { item: { id: "item_given", name: "회복 물약", iconResourceId: storeProjectId(SLUG, "sword-iron") } });
    expect((given as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "sword-iron"));
    const skill = tool("upsert_skill").run(project, { skill: { id: "skill_fire_test", name: "파이어", elementId: "fire" } });
    expect((skill as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "magic-fire-1"));
    const state = tool("upsert_state").run(project, { state: { id: "state_poison_test", name: "독" } });
    expect((state as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "st-poison"));
  });

  it("assign_store_icons fills missing icons from installed icons without a store", () => {
    const project = projectWithIcons();
    project.database.equipment.push({ ...project.database.equipment[0]!, id: "equip_t_shield", name: "Wooden shield", slot: "shield", iconResourceId: undefined });
    project.database.items.push({ ...project.database.items[0]!, id: "item_t_potion", name: "Healing potion", type: "medicine", iconResourceId: undefined });
    const plan = planIconAssignments(project, { ids: ["equip_t_shield", "item_t_potion"] });
    expect(plan.assign.map((a) => a.iconResourceId).sort()).toEqual([storeProjectId(SLUG, "potion-red"), storeProjectId(SLUG, "shield-wood")].sort());
    const result = tool("assign_store_icons").run(project, { ids: ["equip_t_shield", "item_t_potion"] }) as { data: { assigned: unknown[] } };
    expect(result.data.assigned).toHaveLength(2);
    expect(project.database.equipment.find((e) => e.id === "equip_t_shield")?.iconResourceId).toBe(storeProjectId(SLUG, "shield-wood"));
  });

  it("keeps skill/state iconResourceId optional and reference-checked", () => {
    expect(normalizeSkillRecord({ id: "s", name: "s" })).not.toHaveProperty("iconResourceId");
    expect(normalizeStateRecord({ id: "t", name: "t" })).not.toHaveProperty("iconResourceId");
    expect(normalizeSkillRecord({ id: "s", name: "s", iconResourceId: "x" }).iconResourceId).toBe("x");
    const project = projectWithIcons();
    project.database.skills[0] = { ...project.database.skills[0]!, iconResourceId: storeProjectId(SLUG, "magic-fire-1") };
    expect(() => validateProjectReferences(project)).not.toThrow();
    project.database.states[0] = { ...project.database.states[0]!, iconResourceId: "missing-icon" };
    expect(() => validateProjectReferences(project)).toThrow(/state .*iconResourceId/);
  });
});
