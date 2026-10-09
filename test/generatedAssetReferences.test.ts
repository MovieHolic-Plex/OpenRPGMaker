import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { resourceReferenceMessage } from "@/editor/databaseReferences";
import { updateDatabaseRecord, duplicateDatabaseRecord } from "@/editor/databaseActions";
import { createBlankProject } from "@/project/defaults";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new Error(`${label} fixture was not an object`);
}

function array(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Error(`${label} fixture was not an array`);
}

function firstRecord(value: unknown, label: string): Record<string, unknown> {
  return record(array(value, label)[0], `${label}[0]`);
}

function addGeneratedResources(project: Project, ids: readonly string[]): void {
  for (const id of ids) {
    project.assets.uploaded[id] = {
      id,
      name: id,
      kind: "picture",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      meta: { width: 32, height: 32 },
    };
  }
}

describe("generated item and equipment image resources", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("imports old database data when item and equipment image fields are absent", () => {
    // Given: a schema-v3 project shaped like older exports without item/equipment art fields.
    const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
    const database = record(record(rawProject, "project").database, "database");
    const item = firstRecord(database.items, "database.items");
    const equipment = firstRecord(database.equipment, "database.equipment");
    delete item.imageResourceId;
    delete item.iconResourceId;
    delete equipment.imageResourceId;
    delete equipment.iconResourceId;

    // When: the project is imported through the real deserializer.
    const restored = deserialize(JSON.stringify(rawProject));

    // Then: the new fields are safely empty.
    expect(restored.database.items[0]?.imageResourceId).toBeUndefined();
    expect(restored.database.items[0]?.iconResourceId).toBeUndefined();
    expect(restored.database.equipment[0]?.imageResourceId).toBeUndefined();
    expect(restored.database.equipment[0]?.iconResourceId).toBeUndefined();
  });

  it("round-trips exported item and equipment image fields without overloading animation ids", () => {
    // Given: generated image/icon resources assigned to the default item and equipment.
    const resourceIds = ["gen_item_image", "gen_item_icon", "gen_equipment_image", "gen_equipment_icon"] as const;
    store.update((project) => addGeneratedResources(project, resourceIds));
    const project = store.getCurrent();
    const itemId = project.database.items[0]?.id ?? "";
    const equipmentId = project.database.equipment[0]?.id ?? "";
    const animationId = project.database.battleAnimations[0]?.id;

    updateDatabaseRecord("items", itemId, {
      imageResourceId: "gen_item_image",
      iconResourceId: "gen_item_icon",
      animationId,
    });
    updateDatabaseRecord("equipment", equipmentId, {
      imageResourceId: "gen_equipment_image",
      iconResourceId: "gen_equipment_icon",
    });

    // When: the project is exported and imported again.
    const restored = deserialize(serialize(store.getCurrent()));
    const item = restored.database.items.find((record) => record.id === itemId);
    const equipment = restored.database.equipment.find((record) => record.id === equipmentId);

    // Then: generated art fields survive separately from the battle animation reference.
    expect(item?.imageResourceId).toBe("gen_item_image");
    expect(item?.iconResourceId).toBe("gen_item_icon");
    expect(item?.animationId).toBe(animationId);
    expect(equipment?.imageResourceId).toBe("gen_equipment_image");
    expect(equipment?.iconResourceId).toBe("gen_equipment_icon");
  });

  it("duplicates item and equipment generated image fields", () => {
    // Given: standalone item and equipment records with generated image/icon ids.
    const resourceIds = ["dup_item_image", "dup_item_icon", "dup_equipment_image", "dup_equipment_icon"] as const;
    store.update((project) => addGeneratedResources(project, resourceIds));
    const itemId = store.getCurrent().database.items[0]?.id ?? "";
    const equipmentId = store.getCurrent().database.equipment[0]?.id ?? "";
    updateDatabaseRecord("items", itemId, { imageResourceId: "dup_item_image", iconResourceId: "dup_item_icon" });
    updateDatabaseRecord("equipment", equipmentId, {
      imageResourceId: "dup_equipment_image",
      iconResourceId: "dup_equipment_icon",
    });

    // When: the records are duplicated through database actions.
    const itemCopyId = duplicateDatabaseRecord("items", itemId);
    const equipmentCopyId = duplicateDatabaseRecord("equipment", equipmentId);

    // Then: the generated art references are preserved in the copied records.
    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.database.items.find((item) => item.id === itemCopyId)).toMatchObject({
      imageResourceId: "dup_item_image",
      iconResourceId: "dup_item_icon",
    });
    expect(restored.database.equipment.find((equipment) => equipment.id === equipmentCopyId)).toMatchObject({
      imageResourceId: "dup_equipment_image",
      iconResourceId: "dup_equipment_icon",
    });
  });

  it("normalizes malformed optional item and equipment resource ids to empty fields", () => {
    // Given: imported data with blank and non-string generated art ids.
    const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
    const database = record(record(rawProject, "project").database, "database");
    const item = firstRecord(database.items, "database.items");
    const equipment = firstRecord(database.equipment, "database.equipment");
    item.imageResourceId = "   ";
    item.iconResourceId = 42;
    equipment.imageResourceId = "";
    equipment.iconResourceId = false;

    // When: the project is imported through the real deserializer.
    const restored = deserialize(JSON.stringify(rawProject));

    // Then: malformed optional ids do not survive as stale references.
    expect(restored.database.items[0]?.imageResourceId).toBeUndefined();
    expect(restored.database.items[0]?.iconResourceId).toBeUndefined();
    expect(restored.database.equipment[0]?.imageResourceId).toBeUndefined();
    expect(restored.database.equipment[0]?.iconResourceId).toBeUndefined();
  });

  it("rejects stale generated item and equipment resource references", () => {
    // Given: imported data with non-empty resource ids that do not exist in assets or profiles.
    const rawProject: unknown = JSON.parse(serialize(createBlankProject()));
    const database = record(record(rawProject, "project").database, "database");
    firstRecord(database.items, "database.items").imageResourceId = "missing_item_image";
    firstRecord(database.equipment, "database.equipment").iconResourceId = "missing_equipment_icon";

    // When/Then: project reference validation reports the stale generated resource id.
    expect(() => deserialize(JSON.stringify(rawProject))).toThrow(ProjectFormatError);
    expect(() => deserialize(JSON.stringify(rawProject))).toThrow(/missing_item_image|missing_equipment_icon/);
  });

  it("detects item and equipment image usage in resource reference checks", () => {
    // Given: generated item/equipment image resources assigned to records.
    const resourceIds = ["ref_item_image", "ref_equipment_icon"] as const;
    store.update((project) => addGeneratedResources(project, resourceIds));
    const itemId = store.getCurrent().database.items[0]?.id ?? "";
    const equipmentId = store.getCurrent().database.equipment[0]?.id ?? "";
    updateDatabaseRecord("items", itemId, { imageResourceId: "ref_item_image" });
    updateDatabaseRecord("equipment", equipmentId, { iconResourceId: "ref_equipment_icon" });

    // When/Then: resource reference checks block referenced generated art but not unrelated ids.
    expect(resourceReferenceMessage("ref_item_image")).toContain("아이템");
    expect(resourceReferenceMessage("ref_equipment_icon")).toContain("장비");
    expect(resourceReferenceMessage("unrelated_generated")).toBeNull();
  });

  it("imports default EasyRPG runtime package actor resources as known references", () => {
    const restored = deserialize(serialize(createBlankProject()));

    // 한 얼굴 = 한 파일: 기본 얼굴은 낱장 리소스 id(칸 0)다.
    expect(restored.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-actor1-00");
    expect(restored.database.actors[0]?.characterResourceId).toBe("easyrpg-charset-actor1");
  });

  it("resolves every sliced face id to its own file", () => {
    const unresolved = FACESET_FACE_ASSETS
      .filter((face) => resolveAssetResourceUrl(face.id) !== `/${face.path}`)
      .map((face) => `${face.id}:${resolveAssetResourceUrl(face.id)}`);
    const missingFiles = FACESET_FACE_ASSETS
      .filter((face) => !existsSync(path.join("public", face.path)))
      .map((face) => face.path);

    expect(unresolved).toEqual([]);
    expect(missingFiles).toEqual([]);
  });

  it("registers every sliced face id as a known project reference", () => {
    const knownIds = collectResourceIds(createBlankProject());
    const unregistered = FACESET_FACE_ASSETS.filter((face) => !knownIds.has(face.id)).map((face) => face.id);

    expect(unregistered).toEqual([]);
  });

  it("deserializes a project whose actor points at a sliced face", () => {
    const rawProject = record(JSON.parse(serialize(createBlankProject())), "project");
    const database = record(rawProject.database, "database");
    firstRecord(database.actors, "database.actors").faceResourceId = "easyrpg-faceset-people1-15";

    const restored = deserialize(JSON.stringify(rawProject));

    expect(restored.database.actors[0]?.faceResourceId).toBe("easyrpg-faceset-people1-15");
  });
});
